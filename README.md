# GroBud

Before creating and loading the database, the dataset for grocery prices need to be scraped using Selenium from: https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1810024501.

After completing the preliminary steps above, we can use the application with the following steps:

1. Start the MySQL Docker container: docker compose up -d

2. Create MySQL database and tables: mysql ... < sql/create_tables.sql

3. Load grocery data: mysql ... < sql/load_grocery_data.sql

4. Run the application.