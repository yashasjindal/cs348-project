import express from 'express';
import { pool } from './db.js';
import productsRouter from './routes/products.js';
import basketRouter from './routes/basket.js';
import compareRouter from './routes/compare.js';
import authRouter from './routes/auth.js';
import { sessionMiddleware } from './session.js';

const app = express();
app.use(express.json());
app.use(sessionMiddleware);

// Connectivity check: confirms the server can reach MySQL.
app.get('/api/health', async (req, res) => {
  const [[row]] = await pool.execute('SELECT COUNT(*) AS products FROM Product');
  res.json({ status: 'ok', products: row.products });
});

app.get('/api/vendors', async (req, res) => {
  const [rows] = await pool.execute('SELECT vid, name FROM Vendor ORDER BY name');
  res.json(rows);
});

app.use('/api/products', productsRouter);
app.use('/api/basket', basketRouter);
app.use('/api', compareRouter);
app.use('/api', authRouter);

app.use('/api', (req, res) => res.status(404).json({ error: 'not found' }));

// Express 5 forwards errors thrown in async handlers here.
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'request body is not valid JSON' });
  }
  console.error(err);
  res.status(500).json({ error: 'internal server error' });
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`SmartCart API listening on http://localhost:${port}`);
});
