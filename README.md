# GroBud

Before creating and loading the database, the dataset for grocery prices need to be loaded using Selenium.

1. Start the MySQL Docker container: docker compose up -d

2. Create MySQL database and tables: mysql ... < sql/create_tables.sql

3. Load grocery data: mysql ... < sql/load_grocery_data.sql

4. Run the application.