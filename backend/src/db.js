import 'dotenv/config';
import mysql from 'mysql2/promise';

// One shared connection pool for the whole server. Every query goes through
// pool.execute(), which sends values as prepared-statement parameters.
export const pool = mysql.createPool({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'smartcart',
  password: process.env.DB_PASSWORD ?? 'smartcart_dev',
  database: process.env.DB_NAME ?? 'smartcart',
  connectionLimit: 10,
  // Return DECIMAL columns (prices, quantities) as JS numbers instead of strings.
  decimalNumbers: true,
});
