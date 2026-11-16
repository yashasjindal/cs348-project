-- Sample queries for each feature, run against the sample database (db/sample-data.sql).
-- Run db/reset.sh first: feature 5 adds a user, so a second run would hit the UNIQUE username.
-- Regenerate the output with:
--   db/reset.sh && MYSQL_PWD=smartcart_dev mysql -u smartcart smartcart -t -vvv --skip-comments < db/test-sample.sql > db/test-sample.out

-- Feature 1: Search and filter groceries (keyword 'milk', no brand/category filter)
SELECT p.pid, p.name, p.brand, p.quantity, p.unit, p.category, s.price, r.name AS retailer
FROM Product p, Sells s, Vendor r
WHERE p.pid = s.pid AND s.vid = r.vid AND p.name LIKE '%milk%'
  AND (NULL IS NULL OR p.category = NULL) AND (NULL IS NULL OR p.brand = NULL)
ORDER BY p.name, p.pid, r.name;

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

-- Feature 5a: Create an account. The app hashes the password (bcrypt) before the INSERT;
-- uid is generated. 'alice' and 'bob' already exist in the sample data, so sign up 'carol'
-- (the hash is a real bcrypt hash of the test password 'carol-sample-pw').
INSERT INTO User (username, password_hash)
VALUES ('carol', '$2b$10$jmiqauwe9IxFHqtUCFIjI.BNTuBwI03DIx6Usrr3WQaRKo7idksHm');

SELECT uid, username FROM User WHERE username = 'carol';

-- Feature 5b: Log in. The app fetches the stored hash by username and checks the typed
-- password against it; a username with no row means "wrong username or password".
SELECT uid, username, password_hash FROM User WHERE username = 'alice';
