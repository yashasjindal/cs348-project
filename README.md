# SmartCart

Use the application with the following steps:

1. Start the MySQL Docker container: docker compose up -d

2. Create MySQL database and tables: cat createTable.sql | docker compose exec -i -T db mysql -u root -psecret_password grocery_prices

3. Load grocery data: docker compose exec -T db mysql --local-infile=1 -u root -psecret_password grocery_prices < sql/importCSV.sql

4. Run the application.