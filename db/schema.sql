-- SmartCart schema (MySQL 8.0+ / 9.x)
-- Run against the `smartcart` database: mysql -u smartcart -p smartcart < db/schema.sql
-- Re-runnable: drops existing tables first (children before parents).
-- Table names are case-sensitive on Linux, so always write them exactly as below.

DROP TABLE IF EXISTS StatCanPriceHistory;
DROP TABLE IF EXISTS PriceHistory;
DROP TABLE IF EXISTS Sells;
DROP TABLE IF EXISTS Product;
DROP TABLE IF EXISTS Retailer;
DROP TABLE IF EXISTS StatCan;

-- A Statistics Canada benchmark item, e.g. 'Milk, 2 litres'.
-- Benchmarks are national (Canada-wide) averages; per-province rows are not loaded.
-- price / reference_month duplicate the latest StatCanPriceHistory row so the receipt
-- query can read the current benchmark without searching the history.
CREATE TABLE StatCan (
    sid              INT            NOT NULL,
    name             VARCHAR(255)   NOT NULL,
    quantity         DECIMAL(10, 3) NOT NULL,
    unit             VARCHAR(20)    NOT NULL,
    price            DECIMAL(8, 2)  NOT NULL,
    reference_month  DATE           NOT NULL,    -- first day of the month, e.g. 2026-08-01
    PRIMARY KEY (sid),
    CONSTRAINT uq_statcan_name UNIQUE (name),
    CONSTRAINT chk_statcan_quantity CHECK (quantity > 0),
    CONSTRAINT chk_statcan_price CHECK (price >= 0)
);

-- A grocery product, independent of which retailer sells it.
-- sid is the StatCan item it matches; NULL when there is no comparable StatCan item.
CREATE TABLE Product (
    pid       INT            NOT NULL,
    sid       INT,
    name      VARCHAR(255)   NOT NULL,
    brand     VARCHAR(100),                  -- NULL for unbranded items (e.g. produce)
    quantity  DECIMAL(10, 3) NOT NULL,       -- package size, e.g. 2.000
    unit      VARCHAR(20)    NOT NULL,       -- unit of quantity, e.g. 'L', 'g', 'ea'
    category  VARCHAR(100)   NOT NULL,
    PRIMARY KEY (pid),
    CONSTRAINT fk_product_statcan FOREIGN KEY (sid) REFERENCES StatCan (sid) ON DELETE SET NULL,
    CONSTRAINT chk_product_quantity CHECK (quantity > 0)
);

-- A grocery retailer, e.g. Walmart, No Frills.
CREATE TABLE Retailer (
    vid   INT          NOT NULL,
    name  VARCHAR(100) NOT NULL,
    PRIMARY KEY (vid),
    CONSTRAINT uq_retailer_name UNIQUE (name)
);

-- Sells: the current price of a product at a retailer (many-to-many).
CREATE TABLE Sells (
    vid    INT           NOT NULL,
    pid    INT           NOT NULL,
    price  DECIMAL(8, 2) NOT NULL,
    PRIMARY KEY (vid, pid),
    CONSTRAINT fk_sells_retailer FOREIGN KEY (vid) REFERENCES Retailer (vid) ON DELETE CASCADE,
    CONSTRAINT fk_sells_product  FOREIGN KEY (pid) REFERENCES Product (pid)  ON DELETE CASCADE,
    CONSTRAINT chk_sells_price CHECK (price >= 0)
);

-- Weak entity owned by Sells: past prices of one product at one retailer.
CREATE TABLE PriceHistory (
    vid          INT           NOT NULL,
    pid          INT           NOT NULL,
    recorded_at  DATETIME      NOT NULL,
    price        DECIMAL(8, 2) NOT NULL,
    PRIMARY KEY (vid, pid, recorded_at),
    CONSTRAINT fk_pricehistory_sells FOREIGN KEY (vid, pid) REFERENCES Sells (vid, pid) ON DELETE CASCADE,
    CONSTRAINT chk_pricehistory_price CHECK (price >= 0)
);

-- Weak entity owned by StatCan: national monthly average price.
CREATE TABLE StatCanPriceHistory (
    sid              INT           NOT NULL,
    reference_month  DATE          NOT NULL,
    price            DECIMAL(8, 2) NOT NULL,
    PRIMARY KEY (sid, reference_month),
    CONSTRAINT fk_statcanpricehistory_statcan FOREIGN KEY (sid) REFERENCES StatCan (sid) ON DELETE CASCADE,
    CONSTRAINT chk_statcanpricehistory_price CHECK (price >= 0)
);
