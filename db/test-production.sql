-- Feature queries run against the production database (smartcart_prod, built by db/production/).
-- Same query templates as the report and test-sample.sql, with production pids/vids.
-- pids come from the Project Hammer snapshot of 2026-11-14 (hammer-5-csv.zip); a newer snapshot
-- renumbers products, so pick new pids with the query at the bottom of this file.
-- Regenerate the output with:
--   MYSQL_PWD=smartcart_dev mysql -u smartcart smartcart_prod -t -vvv --skip-comments < db/test-production.sql > db/test-production.out

-- Table sizes
SELECT 'StatCan' AS tbl, COUNT(*) AS `rows` FROM StatCan
UNION ALL SELECT 'StatCanPriceHistory', COUNT(*) FROM StatCanPriceHistory
UNION ALL SELECT 'Product', COUNT(*) FROM Product
UNION ALL SELECT 'Vendor', COUNT(*) FROM Vendor
UNION ALL SELECT 'Sells', COUNT(*) FROM Sells
UNION ALL SELECT 'PriceHistory', COUNT(*) FROM PriceHistory;

-- Feature 1: Search and filter groceries (keyword 'milk', no brand/category filter), first 10 rows
SELECT p.pid, p.name, p.brand, p.quantity, p.unit, p.category, s.price, r.name AS retailer
FROM Product p, Sells s, Vendor r
WHERE p.pid = s.pid AND s.vid = r.vid AND p.name LIKE '%milk%'
  AND (NULL IS NULL OR p.category = NULL) AND (NULL IS NULL OR p.brand = NULL)
ORDER BY p.name, p.pid, r.name
LIMIT 10;

-- Feature 1 with filters: keyword 'peanut butter', brand 'Jif', category 'Pantry'
SELECT p.pid, p.name, p.brand, p.quantity, p.unit, p.category, s.price, r.name AS retailer
FROM Product p, Sells s, Vendor r
WHERE p.pid = s.pid AND s.vid = r.vid AND p.name LIKE '%peanut butter%'
  AND ('Pantry' IS NULL OR p.category = 'Pantry') AND ('Jif' IS NULL OR p.brand = 'Jif')
ORDER BY p.name, p.pid, r.name
LIMIT 10;

-- Feature 2: Shopping basket at a selected retailer (Metro, vid 3)
-- 5602 Heinz Tomato Ketchup 1 L, 7312 Jif Crunchy Peanut Butter 1 kg, 1887 Unico Diced Tomatoes 796 mL
WITH BasketItems AS (
    SELECT 5602 AS pid, 1 AS cart_quantity
    UNION
    SELECT 7312, 2
    UNION
    SELECT 1887, 1
)
SELECT p.name, b.cart_quantity, s.price AS unit_price, b.cart_quantity * s.price AS subtotal
FROM BasketItems b JOIN Product p ON b.pid = p.pid JOIN Sells s ON p.pid = s.pid
WHERE s.vid = 3;

-- Feature 3: Receipt with a Canadian (StatCan) benchmark, same basket at Metro
WITH BasketItems AS (
    SELECT 5602 AS pid, 1 AS cart_quantity
    UNION
    SELECT 7312, 1
    UNION
    SELECT 1887, 1
)
SELECT p.name, b.cart_quantity, s.price AS unit_price, b.cart_quantity * s.price AS subtotal,
       sc.price AS benchmark_price, b.cart_quantity * sc.price AS benchmark_subtotal
FROM BasketItems b JOIN Product p ON b.pid = p.pid JOIN Sells s ON p.pid = s.pid
     LEFT JOIN StatCan sc ON p.sid = sc.sid
WHERE s.vid = 3;

-- Feature 4: Compare basket totals across retailers (only retailers that stock every item)
WITH BasketItems AS (
    SELECT 5602 AS pid, 1 AS cart_quantity
    UNION
    SELECT 7312, 1
    UNION
    SELECT 1887, 1
)
SELECT v.name AS retailer, SUM(b.cart_quantity * s.price) AS total_cost
FROM BasketItems b, Sells s, Vendor v
WHERE b.pid = s.pid AND s.vid = v.vid
GROUP BY v.vid, v.name
HAVING COUNT(DISTINCT b.pid) = (SELECT COUNT(DISTINCT pid) FROM BasketItems)
ORDER BY total_cost ASC;

-- Feature 4, as the app runs it (backend/src/routes/compare.js): each basket product's price at
-- every vendor, NULL where the vendor doesn't sell it. The app adds up each store's total from these rows.
SELECT p.pid, p.name, p.quantity AS pack_quantity, p.unit, v.vid, v.name AS retailer, s.price,
       MIN(s.price) OVER (PARTITION BY p.pid) AS lowest_price
FROM Product p CROSS JOIN Vendor v
     LEFT JOIN Sells s ON s.pid = p.pid AND s.vid = v.vid
WHERE p.pid IN (5602, 7312, 1887)
ORDER BY p.pid, v.vid;

-- Feature 5: Create an account, then log in. The production data has no app users yet, so this
-- signs up a test account and removes it again at the end, leaving the database unchanged.
-- (The hash is a real bcrypt hash of the test password 'alice-sample-pw'.)
INSERT INTO User (username, password_hash)
VALUES ('alice', '$2b$10$WZFKudfjvIr3qdKudJbuFu63QDBzokqxSlDk.6NmSj3tEVQSDb.ZW');

SELECT uid, username, password_hash FROM User WHERE username = 'alice';

DELETE FROM User WHERE username = 'alice';

-- Helper (not a feature): the products stocked by the most retailers, for choosing basket pids
SELECT p.pid, p.name, p.brand, p.quantity, p.unit, COUNT(*) AS retailers
FROM Product p JOIN Sells s ON s.pid = p.pid
GROUP BY p.pid, p.name, p.brand, p.quantity, p.unit
ORDER BY retailers DESC, p.pid
LIMIT 10;
