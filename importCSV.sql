USE grocery_prices;

LOAD DATA INFILE
'/var/lib/mysql-files/GroceryData.csv'
INTO TABLE grocery_price_data
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\r\n'
IGNORE 1 ROWS
(@raw_date, geography, item, unit, price_cad)
SET price_date = STR_TO_DATE(CONCAT(@raw_date, '-2026'), '%d-%b-%Y');