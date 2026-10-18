# SmartCart

Frontend: ReactJS

Backend : NodeJS

Development Machines: Local

Database: MySQL

Use the application with the following steps:

1. Start the MySQL Docker container: docker compose up -d

2. Create MySQL database and tables: cat createTable.sql | docker compose exec -i -T db mysql -u root

3. Load grocery data: cat importCSV.sql | docker compose exec -i -T db mysql --local-infile=1 -u root

4. Run the application.
