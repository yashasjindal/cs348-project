#!/usr/bin/env bash
# Rebuild the sample database from scratch: drop and recreate all tables, then load sample data.
# Usage: db/reset.sh   (override the defaults with DB_USER, DB_PASSWORD, DB_NAME, DB_HOST)
set -euo pipefail

cd "$(dirname "$0")"

DB_USER="${DB_USER:-smartcart}"
DB_NAME="${DB_NAME:-smartcart}"
DB_HOST="${DB_HOST:-127.0.0.1}"
export MYSQL_PWD="${DB_PASSWORD:-smartcart_dev}"

run() { mysql -h "$DB_HOST" -u "$DB_USER" "$DB_NAME" < "$1"; }

# Recreate the whole database so tables removed or renamed in schema.sql don't linger.
echo "Recreating database $DB_NAME..."
mysql -h "$DB_HOST" -u "$DB_USER" -e "DROP DATABASE IF EXISTS \`$DB_NAME\`; CREATE DATABASE \`$DB_NAME\`;"

echo "Creating tables..."
run schema.sql
echo "Loading sample data..."
run sample-data.sql

mysql -h "$DB_HOST" -u "$DB_USER" "$DB_NAME" -t -e "
    SELECT 'StatCan' AS tbl, COUNT(*) AS \`rows\` FROM StatCan
    UNION ALL SELECT 'StatCanPriceHistory', COUNT(*) FROM StatCanPriceHistory
    UNION ALL SELECT 'Product', COUNT(*) FROM Product
    UNION ALL SELECT 'Retailer', COUNT(*) FROM Retailer
    UNION ALL SELECT 'Sells', COUNT(*) FROM Sells
    UNION ALL SELECT 'PriceHistory', COUNT(*) FROM PriceHistory;"
echo "Done."
