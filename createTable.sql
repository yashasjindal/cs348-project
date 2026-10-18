CREATE DATABASE IF NOT EXISTS grocery_prices;

USE grocery_prices;

CREATE TABLE grocery_price_data (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    price_date DATE NOT NULL,
    geography VARCHAR(255) NOT NULL,
    item VARCHAR(255) NOT NULL,
    unit VARCHAR(100),
    price_cad DECIMAL(10, 2),

    INDEX idx_date (price_date),
    INDEX idx_item (item),
    INDEX idx_geography (geography)
);
