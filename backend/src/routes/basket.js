import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

const MAX_ITEMS = 100;
const isPositiveInt = (n) => Number.isInteger(n) && n > 0;

// Feature 2: price a shopping basket at one retailer.
// POST /api/basket/quote   body: { "vid": 1, "items": [{ "pid": 101, "quantity": 2 }, ...] }
router.post('/quote', async (req, res) => {
  const { vid, items } = req.body ?? {};

  if (!isPositiveInt(vid)) {
    return res.status(400).json({ error: 'vid must be a positive integer' });
  }
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS) {
    return res.status(400).json({ error: `items must be a list of 1 to ${MAX_ITEMS} products` });
  }
  if (!items.every((i) => isPositiveInt(i?.pid) && isPositiveInt(i?.quantity))) {
    return res.status(400).json({ error: 'each item needs a positive integer pid and quantity' });
  }
  if (new Set(items.map((i) => i.pid)).size !== items.length) {
    return res.status(400).json({ error: 'each pid may appear only once' });
  }

  // Build the BasketItems CTE from placeholders, one row per item. mysql2 sends numbers as
  // doubles, so cast them: an integer quantity times a DECIMAL price stays an exact DECIMAL.
  const basketRows = items
    .map((_, i) =>
      i === 0
        ? 'SELECT CAST(? AS UNSIGNED) AS pid, CAST(? AS UNSIGNED) AS cart_quantity'
        : 'SELECT CAST(? AS UNSIGNED), CAST(? AS UNSIGNED)',
    )
    .join(' UNION ALL ');
  const params = items.flatMap((i) => [i.pid, i.quantity]);

  const [lines] = await pool.execute(
    `WITH BasketItems AS (${basketRows})
     SELECT p.pid, p.name, b.cart_quantity, s.price AS unit_price,
            b.cart_quantity * s.price AS subtotal
     FROM BasketItems b
     JOIN Product p ON b.pid = p.pid
     JOIN Sells s ON p.pid = s.pid
     WHERE s.vid = ?
     ORDER BY p.name`,
    [...params, vid],
  );

  // Items the retailer doesn't sell drop out of the join; report them instead of hiding them.
  const priced = new Set(lines.map((l) => l.pid));
  const unavailable = items.filter((i) => !priced.has(i.pid)).map((i) => i.pid);
  const total = Math.round(lines.reduce((sum, l) => sum + l.subtotal, 0) * 100) / 100;

  res.json({ vid, lines, total, unavailable });
});

export default router;
