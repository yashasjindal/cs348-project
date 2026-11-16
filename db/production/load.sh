#!/usr/bin/env bash
# Load the production dataset into its own database (smartcart_prod by default), leaving the
# sample database (smartcart) untouched.
#
# Usage: db/production/load.sh [csv-dir]     (default csv-dir: db/production/out, written by build.py)
# Override the defaults with DB_USER, DB_PASSWORD, DB_NAME, DB_HOST.
#
# One-time setup as root (LOAD DATA LOCAL is off by default in MySQL 8+):
#   CREATE DATABASE smartcart_prod;
#   GRANT ALL PRIVILEGES ON smartcart_prod.* TO 'smartcart'@'localhost';
#   SET PERSIST local_infile = 1;
set -euo pipefail

cd "$(dirname "$0")"

DB_USER="${DB_USER:-smartcart}"
DB_NAME="${DB_NAME:-smartcart_prod}"
DB_HOST="${DB_HOST:-127.0.0.1}"
export MYSQL_PWD="${DB_PASSWORD:-smartcart_dev}"
DATA_DIR="$(cd "${1:-out}" && pwd)"

db() { mysql --local-infile=1 -h "$DB_HOST" -u "$DB_USER" "$@"; }

for f in statcan statcan_price_history vendor product sells price_history; do
    [[ -f "$DATA_DIR/$f.csv" ]] || { echo "Missing $DATA_DIR/$f.csv - run db/production/build.py first." >&2; exit 1; }
done
if [[ "$(db -N -e 'SELECT @@local_infile')" != "1" ]]; then
    echo "local_infile is OFF on the server. As root, run: SET PERSIST local_infile = 1;" >&2
    exit 1
fi

echo "Recreating database $DB_NAME..."
db -e "DROP DATABASE IF EXISTS \`$DB_NAME\`; CREATE DATABASE \`$DB_NAME\`;"
echo "Creating tables (db/schema.sql)..."
db "$DB_NAME" < ../schema.sql

# load <table> <csv file> <column list> [SET clause]
# LOAD DATA LOCAL turns bad rows into warnings instead of errors, so compare row counts afterwards.
load() {
    local table="$1" file="$DATA_DIR/$2" cols="$3" set="${4:-}"
    local expected loaded
    expected=$(( $(wc -l < "$file") - 1 ))
    printf "Loading %-20s" "$table..."
    loaded=$(db "$DB_NAME" -N -e "
        LOAD DATA LOCAL INFILE '$file' INTO TABLE $table
            CHARACTER SET utf8mb4
            FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '\"' ESCAPED BY ''
            LINES TERMINATED BY '\n'
            IGNORE 1 LINES
            $cols $set;
        SELECT COUNT(*) FROM $table;")
    printf "%10s rows\n" "$loaded"
    if [[ "$loaded" != "$expected" ]]; then
        echo "  expected $expected rows from $file; some rows were rejected" >&2
        exit 1
    fi
}

load StatCan             statcan.csv               "(sid, name, quantity, unit, price, reference_month)"
load StatCanPriceHistory statcan_price_history.csv "(sid, recorded_at, price)"
load Vendor              vendor.csv                "(vid, name)"
load Product             product.csv               "(pid, sid, name, @brand, quantity, unit, category)" "SET brand = NULLIF(@brand, '')"
load Sells               sells.csv                 "(vid, pid, price)"
load PriceHistory        price_history.csv         "(vid, pid, recorded_at, price)"

echo "Updating optimizer statistics..."
db "$DB_NAME" -N -e "ANALYZE TABLE StatCan, StatCanPriceHistory, Vendor, Product, Sells, PriceHistory;" > /dev/null
echo "Done."
