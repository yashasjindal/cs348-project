-- SmartCart schema (MySQL 8.0+ / 9.x)
-- Run against the `smartcart` database: mysql -u smartcart -p smartcart < db/schema.sql
-- Re-runnable: drops existing tables first (children before parents).
-- Table names are case-sensitive on Linux, so always write them exactly as below.

DROP TABLE IF EXISTS BasketItem;
DROP TABLE IF EXISTS Basket;
DROP TABLE IF EXISTS User;
DROP TABLE IF EXISTS StatCanPriceHistory;
DROP TABLE IF EXISTS PriceHistory;
DROP TABLE IF EXISTS Sells;
DROP TABLE IF EXISTS Product;
DROP TABLE IF EXISTS Vendor;
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

-- A grocery product, independent of which vendor sells it.
-- Every product matches exactly one StatCan item (Matches is (1,1) on the Product side):
-- products without a StatCan equivalent are filtered out when the data is preprocessed.
CREATE TABLE Product (
    pid       INT            NOT NULL,
    sid       INT            NOT NULL,
    name      VARCHAR(255)   NOT NULL,
    brand     VARCHAR(100),                  -- NULL for unbranded items (e.g. produce)
    quantity  DECIMAL(10, 3) NOT NULL,       -- package size, e.g. 2.000
    unit      VARCHAR(20)    NOT NULL,       -- unit of quantity, e.g. 'L', 'g', 'ea'
    category  VARCHAR(100)   NOT NULL,
    PRIMARY KEY (pid),
    -- No cascade: a StatCan item can't be deleted while products still match it.
    CONSTRAINT fk_product_statcan FOREIGN KEY (sid) REFERENCES StatCan (sid),
    CONSTRAINT chk_product_quantity CHECK (quantity > 0)
);

-- A grocery vendor (retailer), e.g. Walmart, No Frills.
CREATE TABLE Vendor (
    vid   INT          NOT NULL,
    name  VARCHAR(100) NOT NULL,
    PRIMARY KEY (vid),
    CONSTRAINT uq_vendor_name UNIQUE (name)
);

-- Sells: the current price of a product at a vendor (many-to-many).
CREATE TABLE Sells (
    vid    INT           NOT NULL,
    pid    INT           NOT NULL,
    price  DECIMAL(8, 2) NOT NULL,
    PRIMARY KEY (vid, pid),
    CONSTRAINT fk_sells_vendor  FOREIGN KEY (vid) REFERENCES Vendor (vid)   ON DELETE CASCADE,
    CONSTRAINT fk_sells_product FOREIGN KEY (pid) REFERENCES Product (pid) ON DELETE CASCADE,
    CONSTRAINT chk_sells_price CHECK (price >= 0)
);

-- Weak entity owned by Sells (identifying relationship HasHistoryProduct):
-- past prices of one product at one vendor.
CREATE TABLE PriceHistory (
    vid          INT           NOT NULL,
    pid          INT           NOT NULL,
    recorded_at  DATETIME      NOT NULL,
    price        DECIMAL(8, 2) NOT NULL,
    PRIMARY KEY (vid, pid, recorded_at),
    CONSTRAINT fk_pricehistory_sells FOREIGN KEY (vid, pid) REFERENCES Sells (vid, pid) ON DELETE CASCADE,
    CONSTRAINT chk_pricehistory_price CHECK (price >= 0)
);

-- Weak entity owned by StatCan (identifying relationship HasHistoryStatCan):
-- national monthly average price. StatCan publishes one value per month, so
-- recorded_at is the first day of the reference month.
CREATE TABLE StatCanPriceHistory (
    sid          INT           NOT NULL,
    recorded_at  DATE          NOT NULL,
    price        DECIMAL(8, 2) NOT NULL,
    PRIMARY KEY (sid, recorded_at),
    CONSTRAINT fk_statcanpricehistory_statcan FOREIGN KEY (sid) REFERENCES StatCan (sid) ON DELETE CASCADE,
    CONSTRAINT chk_statcanpricehistory_price CHECK (price >= 0)
);

-- An app user account. uid is generated on sign-up.
-- username is UNIQUE so two people can't register the same name, even if they sign up at the
-- same moment (the database rejects the second INSERT). The default collation is case-insensitive,
-- so 'Alice' and 'alice' count as the same username.
-- password_hash holds a salted hash (e.g. bcrypt, 60 characters), never the plain password.
CREATE TABLE User (
    uid            INT          NOT NULL AUTO_INCREMENT,
    username       VARCHAR(50)  NOT NULL,
    password_hash  VARCHAR(255) NOT NULL,
    PRIMARY KEY (uid),
    CONSTRAINT uq_user_username UNIQUE (username),
    CONSTRAINT chk_user_username CHECK (CHAR_LENGTH(TRIM(username)) > 0)
);

-- A user's shopping basket. Each user has exactly one: UNIQUE (uid) allows at most one, and the
-- app creates it in the same transaction as the User row (backend/src/routes/auth.js).
-- updated_at changes automatically when the Basket row is updated; the app also touches it
-- when the basket's items change, since those are rows in BasketItem.
CREATE TABLE Basket (
    bid         INT       NOT NULL AUTO_INCREMENT,
    uid         INT       NOT NULL,
    created_at  DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (bid),
    CONSTRAINT uq_basket_user UNIQUE (uid),
    -- Deleting an account deletes its basket.
    CONSTRAINT fk_basket_user FOREIGN KEY (uid) REFERENCES User (uid) ON DELETE CASCADE,
    CONSTRAINT chk_basket_times CHECK (updated_at >= created_at)
);

-- The products in a basket and how many of each (Basket contains Product, many-to-many).
-- Each product appears at most once per basket; changing the amount updates quantity.
CREATE TABLE BasketItem (
    bid       INT  NOT NULL,
    pid       INT  NOT NULL,
    quantity  INT  NOT NULL,
    PRIMARY KEY (bid, pid),
    CONSTRAINT fk_basketitem_basket  FOREIGN KEY (bid) REFERENCES Basket (bid)  ON DELETE CASCADE,
    CONSTRAINT fk_basketitem_product FOREIGN KEY (pid) REFERENCES Product (pid) ON DELETE CASCADE,
    CONSTRAINT chk_basketitem_quantity CHECK (quantity > 0)
);
