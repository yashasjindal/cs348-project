#!/usr/bin/env bash
# R-c measurements on the production database, done the way the spec's appendix asks:
#   - EXPLAIN and EXPLAIN ANALYZE for each feature query;
#   - total statement time from performance_schema.events_statements_history, read back in the
#     same session: one warm-up run, then the median of 5 runs;
#   - before/after pairs: create an index, ANALYZE TABLE, measure again, then drop the index.
#
# Usage: db/production/measure.sh [> results.txt]
# Override the defaults with DB_USER, DB_PASSWORD, DB_NAME, DB_HOST, RUNS (default 5),
# KEEP_INDEXES=1 (leave the "after" indexes in place).
#
# One-time setup as root (the app user can't read performance_schema by default):
#   GRANT SELECT ON performance_schema.* TO 'smartcart'@'localhost';
#
# Why the timing is done this way (hand-timing gives large run-to-run variance):
#   - Result rows are discarded instead of printed. TIMER_WAIT includes sending rows to the client,
#     so a slow terminal drawing 451 rows of feature 1 inflates and scatters the timings.
#   - Only this session's statements are read (THREAD_ID = PS_CURRENT_THREAD_ID()). The spec's
#     LIKE pattern alone can also pick up the running app's queries, which have the same text.
#   - The warm-up and the timed runs are back to back, because the history keeps only the
#     last 10 statements of each session.
set -euo pipefail

DB_USER="${DB_USER:-smartcart}"
DB_NAME="${DB_NAME:-smartcart_prod}"
DB_HOST="${DB_HOST:-127.0.0.1}"
RUNS="${RUNS:-5}"
export MYSQL_PWD="${DB_PASSWORD:-smartcart_dev}"

db() { mysql -h "$DB_HOST" -u "$DB_USER" "$DB_NAME" "$@"; }

# ---------------------------------------------------------------- feature queries
# Same text as the report and db/test-production.sql (without the LIMIT used there for short output).
# Basket pids are from the 2026-11-14 Project Hammer snapshot: 5602 Heinz Tomato Ketchup 1 L,
# 7312 Jif Crunchy Peanut Butter 1 kg, 1887 Unico Diced Tomatoes 796 mL; vid 3 is Metro.
F1=$(cat <<'SQL'
SELECT p.pid, p.name, p.brand, p.quantity, p.unit, p.category, s.price, r.name AS retailer
FROM Product p, Sells s, Vendor r
WHERE p.pid = s.pid AND s.vid = r.vid AND p.name LIKE '%milk%'
  AND (NULL IS NULL OR p.category = NULL) AND (NULL IS NULL OR p.brand = NULL)
ORDER BY p.name, p.pid, r.name
SQL
)
F2=$(cat <<'SQL'
WITH BasketItems AS (
    SELECT 5602 AS pid, 1 AS cart_quantity UNION SELECT 7312, 2 UNION SELECT 1887, 1
)
SELECT p.name, b.cart_quantity, s.price AS unit_price, b.cart_quantity * s.price AS subtotal
FROM BasketItems b JOIN Product p ON b.pid = p.pid JOIN Sells s ON p.pid = s.pid
WHERE s.vid = 3
SQL
)
F3=$(cat <<'SQL'
WITH BasketItems AS (
    SELECT 5602 AS pid, 1 AS cart_quantity UNION SELECT 7312, 1 UNION SELECT 1887, 1
)
SELECT p.name, b.cart_quantity, s.price AS unit_price, b.cart_quantity * s.price AS subtotal,
       sc.price AS benchmark_price, b.cart_quantity * sc.price AS benchmark_subtotal
FROM BasketItems b JOIN Product p ON b.pid = p.pid JOIN Sells s ON p.pid = s.pid
     LEFT JOIN StatCan sc ON p.sid = sc.sid
WHERE s.vid = 3
SQL
)
F4=$(cat <<'SQL'
WITH BasketItems AS (
    SELECT 5602 AS pid, 1 AS cart_quantity UNION SELECT 7312, 1 UNION SELECT 1887, 1
)
SELECT v.name AS retailer, SUM(b.cart_quantity * s.price) AS total_cost
FROM BasketItems b, Sells s, Vendor v
WHERE b.pid = s.pid AND s.vid = v.vid
GROUP BY v.vid, v.name
HAVING COUNT(DISTINCT b.pid) = (SELECT COUNT(DISTINCT pid) FROM BasketItems)
ORDER BY total_cost ASC
SQL
)
F5=$(cat <<'SQL'
SELECT uid, username, password_hash FROM User WHERE username = 'alice'
SQL
)

# ---------------------------------------------------------------- helpers

# time_query <sql>: prints the RUNS timings in ms (after one warm-up run), then median, min, max.
time_query() {
    local sql="$1" i times
    # Untimed runs in a separate session first: right after CREATE/DROP INDEX and ANALYZE TABLE the
    # table is reopened and its pages reloaded, which one warm-up run does not cover. This keeps
    # "before" and "after" under the same warm condition, as the appendix asks.
    for ((i = 0; i < ${PREWARM:-3}; i++)); do printf '%s;\n' "$sql"; done | db -N -B > /dev/null
    times=$(
        {
            for ((i = 0; i <= RUNS; i++)); do printf '%s;\n' "$sql"; done
            printf "SELECT GROUP_CONCAT(ms ORDER BY EVENT_ID SEPARATOR ' ') FROM (
                      SELECT EVENT_ID, ROUND(TIMER_WAIT / 1e9, 3) AS ms
                      FROM performance_schema.events_statements_history
                      WHERE THREAD_ID = PS_CURRENT_THREAD_ID() AND EVENT_NAME = 'statement/sql/select'
                      ORDER BY EVENT_ID DESC LIMIT %d) AS runs;\n" "$RUNS"
        } | db -N -B | tail -1
    )
    echo "$times" | tr ' ' '\n' | sort -n | awk -v all="$times" '
        { v[NR] = $1 }
        END {
            med = (NR % 2) ? v[(NR + 1) / 2] : (v[NR / 2] + v[NR / 2 + 1]) / 2
            printf "runs (ms): %s\nmedian: %.3f ms   (min %.3f, max %.3f)\n", all, med, v[1], v[NR]
        }'
}

show_plans() {
    local sql="$1"
    echo "EXPLAIN (traditional: type, key, rows per table):"
    db -t -e "EXPLAIN FORMAT=TRADITIONAL $sql" | sed 's/^/    /'
    echo "EXPLAIN ANALYZE:"
    db -N -B -r -e "EXPLAIN ANALYZE $sql" | sed 's/^/    /'
}

measure() {
    local title="$1" sql="$2"
    echo "=== $title"
    echo "$sql" | sed 's/^/    /'
    show_plans "$sql"
    time_query "$sql"
    echo
}

index_list() {   # "name:col1,col2" for each index on a table
    db -N -e "SELECT CONCAT(INDEX_NAME, ':', GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX))
              FROM information_schema.STATISTICS
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '$1' GROUP BY INDEX_NAME ORDER BY 1"
}

row_count() { db -N -e "SELECT COUNT(*) FROM ($1) AS q"; }

# before_after <title> <sql before> <sql after> <table> <index name> <CREATE INDEX statement>
before_after() {
    local title="$1" before="$2" after="$3" table="$4" index="$5" create="$6" had missing restore
    echo "=== BEFORE/AFTER: $title"
    echo "--- before (no $index): $(row_count "$before") rows"
    show_plans "$before"
    time_query "$before"
    had=$(index_list "$table")
    echo "--- change: $create; ANALYZE TABLE $table;"
    db -e "$create; ANALYZE TABLE $table;" > /dev/null
    # InnoDB drops a foreign key's auto-created index when a new index can serve the key instead.
    missing=$(comm -23 <(echo "$had") <(index_list "$table"))
    [[ -n "$missing" ]] && echo "    note: MySQL dropped index(es) made redundant by $index: $missing"
    if [[ "$after" != "$before" ]]; then
        echo "--- after (rewritten query): $(row_count "$after") rows"
        echo "$after" | sed 's/^/    /'
    else
        echo "--- after: $(row_count "$after") rows"
    fi
    show_plans "$after"
    time_query "$after"
    if [[ "${KEEP_INDEXES:-0}" != "1" ]]; then
        restore=""
        while IFS=: read -r name cols; do
            [[ -n "$name" ]] && restore+="ADD INDEX \`$name\` ($cols), "
        done <<< "$missing"
        db -e "ALTER TABLE $table ${restore}DROP INDEX $index; ANALYZE TABLE $table;" > /dev/null
        echo "(dropped $index${missing:+ and restored the dropped index}; set KEEP_INDEXES=1 to keep it)"
    fi
    echo
}

# ---------------------------------------------------------------- run

for idx in SellsPidVidIndex:Sells ProductNameIndex:Product ProductBrandIndex:Product; do
    if [[ -n "$(db -N -e "SHOW INDEX FROM ${idx#*:} WHERE Key_name = '${idx%%:*}'")" ]]; then
        echo "Index ${idx%%:*} already exists on ${idx#*:}; drop it first so 'before' is measured without it." >&2
        exit 1
    fi
done
if [[ "$(db -N -e 'SELECT COUNT(*) FROM Sells WHERE vid = 3 AND pid IN (5602, 7312, 1887)')" != "3" ]]; then
    echo "WARNING: basket pids 5602/7312/1887 aren't all sold by vid 3 in this database (different" >&2
    echo "Project Hammer snapshot?). Features 2-4 will return fewer rows than in test-production.out." >&2
fi

case "$(uname -s)" in
    Darwin) cpu=$(sysctl -n machdep.cpu.brand_string); mem=$(( $(sysctl -n hw.memsize) / 1073741824 ))" GB" ;;
    *)      cpu=$(grep -m1 'model name' /proc/cpuinfo | cut -d: -f2- | sed 's/^ //'); mem=$(awk '/MemTotal/ {printf "%d GB", $2 / 1048576}' /proc/meminfo) ;;
esac
echo "SmartCart R-c measurements, $(date '+%Y-%m-%d %H:%M')"
echo "Machine: $cpu, $mem RAM, $(uname -s) $(uname -r); MySQL $(db -N -e 'SELECT VERSION()')"
echo "Database: $DB_NAME ($(db -N -e 'SELECT COUNT(*) FROM Product') products, $(db -N -e 'SELECT COUNT(*) FROM Sells') Sells rows, $(db -N -e 'SELECT COUNT(*) FROM PriceHistory') PriceHistory rows)"
echo "Timing: total statement time (TIMER_WAIT) from performance_schema.events_statements_history,"
echo "        same session, 1 warm-up run then the median of $RUNS runs, result rows discarded."
echo

measure "Feature 1: search and filter (keyword 'milk')" "$F1"
measure "Feature 2: basket at Metro" "$F2"
measure "Feature 3: receipt with StatCan benchmark" "$F3"
measure "Feature 4: compare basket totals across retailers" "$F4"
if [[ -n "$(db -N -e "SHOW TABLES LIKE 'User'")" ]]; then
    # The production data has no app users; time the lookup against a temporary test account
    # (a real bcrypt hash of 'alice-sample-pw') and remove it afterwards.
    added_alice=0
    if [[ "$(db -N -e "SELECT COUNT(*) FROM User WHERE username = 'alice'")" == "0" ]]; then
        db -e "INSERT INTO User (username, password_hash)
               VALUES ('alice', '\$2b\$10\$WZFKudfjvIr3qdKudJbuFu63QDBzokqxSlDk.6NmSj3tEVQSDb.ZW')"
        added_alice=1
    fi
    measure "Feature 5: log in (look up a user by username)" "$F5"
    [[ "$added_alice" == "1" ]] && db -e "DELETE FROM User WHERE username = 'alice'"
else
    echo "=== Feature 5: skipped (no User table in $DB_NAME yet)"
    echo
fi

# Feature 1 with its brand and category filters set, as in db/test-production.sql.
F1_BRAND=$(cat <<'SQL'
SELECT p.pid, p.name, p.brand, p.quantity, p.unit, p.category, s.price, r.name AS retailer
FROM Product p, Sells s, Vendor r
WHERE p.pid = s.pid AND s.vid = r.vid AND p.name LIKE '%peanut butter%'
  AND ('Pantry' IS NULL OR p.category = 'Pantry') AND ('Jif' IS NULL OR p.brand = 'Jif')
ORDER BY p.name, p.pid, r.name
SQL
)

before_after "Feature 4 with an index on Sells(pid, vid)" "$F4" "$F4" \
    Sells SellsPidVidIndex "CREATE INDEX SellsPidVidIndex ON Sells (pid, vid)"
before_after "Feature 1 (brand filter 'Jif') with an index on Product(brand)" "$F1_BRAND" "$F1_BRAND" \
    Product ProductBrandIndex "CREATE INDEX ProductBrandIndex ON Product (brand)"
before_after "Feature 1 (keyword only) with an index on Product(name)" "$F1" "$F1" \
    Product ProductNameIndex "CREATE INDEX ProductNameIndex ON Product (name)"
