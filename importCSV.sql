USE grocery_prices;

LOAD DATA INFILE
'GroceryData.csv'
INTO TABLE grocery_price_data
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\r\n'
IGNORE 1 ROWS
(price_date, geography, item, unit, price_cad)
