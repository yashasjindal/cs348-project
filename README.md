# cs348-project

## Database setup (local MySQL)

Requires MySQL 8.0 or newer. We develop on MySQL 9.7 LTS.

### 1. Install and start MySQL

macOS (Homebrew):

```bash
brew install mysql@9.7
brew services start mysql@9.7
mysql_secure_installation   # answer "no" to VALIDATE PASSWORD, then set a root password
```

On other platforms, install MySQL Community Server from https://dev.mysql.com/downloads/mysql/.

### 2. Create the database and app user (one time)

```bash
mysql -u root -p
```

```sql
CREATE DATABASE smartcart;
CREATE USER 'smartcart'@'localhost' IDENTIFIED BY 'smartcart_dev';
GRANT ALL PRIVILEGES ON smartcart.* TO 'smartcart'@'localhost';
EXIT;
```

### 3. Create the tables and load the sample data

```bash
./db/reset.sh
```

This drops and recreates every table, then loads the toy dataset. Run it again any time to get back to a clean state.
To use a different user/password, set `DB_USER` / `DB_PASSWORD` (and `DB_NAME`, `DB_HOST`) before running it.

| File | Contents |
|---|---|
| `db/schema.sql` | `CREATE TABLE` statements with keys, foreign keys and `CHECK` constraints |
| `db/sample-data.sql` | Hand-made sample rows (not real prices) |
| `db/reset.sh` | Recreates the database, runs both files and prints a row count per table |
| `db/test-sample.sql` | One sample query per feature |
| `db/test-sample.out` | Output of `test-sample.sql` on the sample data |

To regenerate `test-sample.out` after changing the queries or sample data:

```bash
./db/reset.sh
MYSQL_PWD=smartcart_dev mysql -u smartcart smartcart -t -vvv --skip-comments < db/test-sample.sql > db/test-sample.out
```

To poke around: `mysql -u smartcart -p smartcart` (password `smartcart_dev`).

## Running the application

Requires Node.js 20 or newer, and the database from the steps above.

### Backend (Express + mysql2, port 3001)

```bash
cd backend
npm install
cp .env.example .env    # database connection settings; edit if yours differ
npm start               # or `npm run dev` to restart on file changes
```

Check it with `curl localhost:3001/api/health`, which should print `{"status":"ok","products":5}`.

### Frontend (React + Vite 6, port 5173)

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The Vite dev server forwards `/api` requests to the backend, so start the backend first.

### Features currently supported

| Feature | Where | API |
|---|---|---|
| 1. Search and filter groceries by name, brand and category | `backend/src/routes/products.js`, `Search` in `frontend/src/App.jsx` | `GET /api/products?q=&brand=&category=` |
| 2. Shopping basket: add/remove products, change quantities, see the estimated total at a chosen retailer | `backend/src/routes/basket.js`, `Basket` in `frontend/src/App.jsx` | `POST /api/basket/quote` |

Supporting endpoints: `GET /api/products/filters` (brand and category lists), `GET /api/vendors`, `GET /api/health`.

E/R Diagram:


![Uploading image.png…]()
