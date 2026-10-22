-- Sample queries for each feature, run against the sample database (db/sample-data.sql).
-- Regenerate the output with:
--   MYSQL_PWD=smartcart_dev mysql -u smartcart smartcart -t -vvv --skip-comments < db/test-sample.sql > db/test-sample.out

-- Feature 1: Search and filter groceries (keyword 'milk', no brand/category filter)
SELECT p.pid, p.name, p.brand, p.quantity, p.unit, p.category, s.price
FROM Product p, Sells s
WHERE p.pid = s.pid AND p.name LIKE '%milk%'
ORDER BY p.name;

-- Feature 2: Shopping basket at a selected retailer (Walmart, vid 1)
WITH BasketItems AS (
    SELECT 101 AS pid, 1 AS cart_quantity
    UNION
    SELECT 102, 2
    UNION
    SELECT 103, 1
)
SELECT p.name, b.cart_quantity, s.price AS unit_price, b.cart_quantity * s.price AS subtotal
FROM BasketItems b JOIN Product p ON b.pid = p.pid JOIN Sells s ON p.pid = s.pid
WHERE s.vid = 1;

-- Feature 3: Receipt with a Canadian (StatCan) benchmark
WITH BasketItems AS (
    SELECT 101 AS pid, 1 AS cart_quantity
    UNION
    SELECT 102, 1
    UNION
    SELECT 103, 1
)
SELECT p.name, b.cart_quantity, s.price AS unit_price, b.cart_quantity * s.price AS subtotal,
       sc.price AS benchmark_price, b.cart_quantity * sc.price AS benchmark_subtotal
FROM BasketItems b JOIN Product p ON b.pid = p.pid JOIN Sells s ON p.pid = s.pid
     LEFT JOIN StatCan sc ON p.sid = sc.sid
WHERE s.vid = 1;

-- Feature 4: Compare basket totals across retailers (only retailers that stock every item)
WITH BasketItems AS (
    SELECT 101 AS pid, 1 AS cart_quantity
    UNION
    SELECT 102, 1
    UNION
    SELECT 103, 1
)
SELECT v.name AS retailer, SUM(b.cart_quantity * s.price) AS total_cost
FROM BasketItems b, Sells s, Vendor v
WHERE b.pid = s.pid AND s.vid = v.vid
GROUP BY v.vid, v.name
HAVING COUNT(DISTINCT b.pid) = (SELECT COUNT(DISTINCT pid) FROM BasketItems)
ORDER BY total_cost ASC;
