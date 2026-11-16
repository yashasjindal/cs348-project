-- Hand-made toy dataset for testing (not real prices).
-- Load after schema.sql: mysql -u smartcart -p smartcart < db/sample-data.sql
-- pids 101-103 and vendors 1-3 match the sample queries in the report.

INSERT INTO StatCan (sid, name, quantity, unit, price, reference_month) VALUES
    (1, 'Milk, 2 litres',         2.000,   'L',  5.50, '2026-08-01'),
    (2, 'Eggs, 1 dozen',          12.000,  'ea', 4.50, '2026-08-01'),
    (3, 'White bread, 675 grams', 675.000, 'g',  3.95, '2026-08-01'),
    (4, 'Bananas, per kilogram',  1.000,   'kg', 1.68, '2026-08-01'),
    (5, 'Butter, 454 grams',      454.000, 'g',  7.36, '2026-08-01');

-- The latest month for each item equals StatCan.price / reference_month above.
INSERT INTO StatCanPriceHistory (sid, recorded_at, price) VALUES
    (1, '2026-06-01', 5.41), (1, '2026-07-01', 5.45), (1, '2026-08-01', 5.50),
    (2, '2026-06-01', 4.62), (2, '2026-07-01', 4.55), (2, '2026-08-01', 4.50),
    (3, '2026-07-01', 3.89), (3, '2026-08-01', 3.95),
    (4, '2026-08-01', 1.68),
    (5, '2026-07-01', 7.29), (5, '2026-08-01', 7.36);

INSERT INTO Vendor (vid, name) VALUES
    (1, 'Walmart'),
    (2, 'No Frills'),
    (3, 'Sobeys');

-- Every product matches exactly one StatCan item.
INSERT INTO Product (pid, sid, name, brand, quantity, unit, category) VALUES
    (101, 1, 'Lactantia 2% Milk',         'Lactantia',      2.000,   'L',  'Dairy'),
    (102, 2, 'Large Eggs',                'Burnbrae Farms', 12.000,  'ea', 'Dairy'),
    (103, 3, 'White Bread',               'Wonder',         675.000, 'g',  'Bakery'),
    (104, 4, 'Bananas',                   NULL,             1.000,   'kg', 'Produce'),
    (107, 5, 'Lactantia Unsalted Butter', 'Lactantia',      454.000, 'g',  'Dairy');

-- Not every product is sold everywhere: 104 isn't sold at Sobeys, 107 only at Sobeys.
INSERT INTO Sells (vid, pid, price) VALUES
    (1, 101, 5.29), (1, 102, 4.29), (1, 103, 3.19), (1, 104, 1.52),
    (2, 101, 5.49), (2, 102, 4.29), (2, 103, 3.19), (2, 104, 1.48),
    (3, 101, 5.99), (3, 102, 4.99), (3, 103, 3.49), (3, 107, 6.99);

INSERT INTO PriceHistory (vid, pid, recorded_at, price) VALUES
    (1, 101, '2026-09-01 09:00:00', 5.09),
    (1, 101, '2026-10-01 09:00:00', 5.29),
    (2, 101, '2026-09-01 09:00:00', 5.49),
    (2, 101, '2026-10-01 09:00:00', 5.49),
    (3, 101, '2026-10-01 09:00:00', 5.99),
    (1, 102, '2026-09-01 09:00:00', 3.97),
    (1, 102, '2026-10-01 09:00:00', 4.29),
    (2, 104, '2026-09-01 09:00:00', 1.58),
    (2, 104, '2026-10-01 09:00:00', 1.48);

-- Test accounts. The hashes are real bcrypt hashes (cost 10) of the test passwords
-- 'alice-sample-pw' and 'bob-sample-pw'; never store real passwords in sample data.
INSERT INTO User (uid, username, password_hash) VALUES
    (1, 'alice', '$2b$10$WZFKudfjvIr3qdKudJbuFu63QDBzokqxSlDk.6NmSj3tEVQSDb.ZW'),
    (2, 'bob',   '$2b$10$0VbmftAPKBBMl8MNAjrdQO67awD.2.qkA4rhD5/AFwiJRYkdEeT5m');

-- Alice has two saved baskets; basket 1 holds the same items as the report's sample basket queries.
-- Bob has none yet.
INSERT INTO Basket (bid, uid, created_at, updated_at) VALUES
    (1, 1, '2026-11-01 18:30:00', '2026-11-03 09:15:00'),
    (2, 1, '2026-11-10 12:00:00', '2026-11-10 12:00:00');

INSERT INTO BasketItem (bid, pid, quantity) VALUES
    (1, 101, 1), (1, 102, 2), (1, 103, 1),
    (2, 104, 3), (2, 107, 1);
