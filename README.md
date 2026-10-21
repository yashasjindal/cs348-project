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

E/R Diagram:


![Uploading image.png…]()
