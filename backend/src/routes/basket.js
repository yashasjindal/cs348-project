import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

const MAX_ITEMS = 100;
const isPositiveInt = (n) => Number.isInteger(n) && n > 0;

// Validate { vid, items } from a basket request. Returns an error message, or null if valid.
function basketError(vid, items) {
  if (!isPositiveInt(vid)) return 'vid must be a positive integer';
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS) {
    return `items must be a list of 1 to ${MAX_ITEMS} products`;
  }
  if (!items.every((i) => isPositiveInt(i?.pid) && isPositiveInt(i?.quantity))) {
    return 'each item needs a positive integer pid and quantity';
  }
  if (new Set(items.map((i) => i.pid)).size !== items.length) {
    return 'each pid may appear only once';
  }
  return null;
}

// Build the BasketItems CTE from placeholders, one row per item. mysql2 sends numbers as
// doubles, so cast them: an integer quantity times a DECIMAL price stays an exact DECIMAL.
function basketCte(items) {
  const rows = items
    .map((_, i) =>
      i === 0
        ? 'SELECT CAST(? AS UNSIGNED) AS pid, CAST(? AS UNSIGNED) AS cart_quantity'
        : 'SELECT CAST(? AS UNSIGNED), CAST(? AS UNSIGNED)',
    )
    .join(' UNION ALL ');
  return { sql: `WITH BasketItems AS (${rows})`, params: items.flatMap((i) => [i.pid, i.quantity]) };
}

// Items the vendor doesn't sell drop out of the join; report them instead of hiding them.
function unavailableItems(items, lines) {
  const priced = new Set(lines.map((l) => l.pid));
  return items.filter((i) => !priced.has(i.pid)).map((i) => i.pid);
}

// Sum in cents so totals don't pick up floating-point errors.
const sumCents = (lines, field) => lines.reduce((sum, l) => sum + Math.round(l[field] * 100), 0);

// Feature 2: price a shopping basket at one vendor.
// POST /api/basket/quote   body: { "vid": 1, "items": [{ "pid": 101, "quantity": 2 }, ...] }
router.post('/quote', async (req, res) => {
  const { vid, items } = req.body ?? {};
  const error = basketError(vid, items);
  if (error) return res.status(400).json({ error });

  const cte = basketCte(items);
  const [lines] = await pool.execute(
    `${cte.sql}
     SELECT p.pid, p.name, b.cart_quantity, s.price AS unit_price,
            b.cart_quantity * s.price AS subtotal
     FROM BasketItems b
     JOIN Product p ON b.pid = p.pid
     JOIN Sells s ON p.pid = s.pid
     WHERE s.vid = ?
     ORDER BY p.name`,
    [...cte.params, vid],
  );

  res.json({
    vid,
    lines,
    total: sumCents(lines, 'subtotal') / 100,
    unavailable: unavailableItems(items, lines),
  });
});

// Feature 3: receipt with a Canadian benchmark. Prices the basket at one vendor and compares
// each item with its Statistics Canada national average price (Product.sid -> StatCan).
// POST /api/basket/receipt   body: same as /quote
router.post('/receipt', async (req, res) => {
  const { vid, items } = req.body ?? {};
  const error = basketError(vid, items);
  if (error) return res.status(400).json({ error });

  const cte = basketCte(items);
  const [lines] = await pool.execute(
    `${cte.sql}
     SELECT p.pid, p.name, b.cart_quantity, s.price AS unit_price,
            b.cart_quantity * s.price AS subtotal,
            sc.name AS benchmark_item, sc.price AS benchmark_price,
            b.cart_quantity * sc.price AS benchmark_subtotal,
            DATE_FORMAT(sc.reference_month, '%Y-%m') AS benchmark_month
     FROM BasketItems b
     JOIN Product p ON b.pid = p.pid
     JOIN Sells s ON p.pid = s.pid
     LEFT JOIN StatCan sc ON p.sid = sc.sid
     WHERE s.vid = ?
     ORDER BY p.name`,
    [...cte.params, vid],
  );

  // Compare only the items that have a benchmark, so both totals cover the same products.
  // (Every product matches a StatCan item today; the LEFT JOIN keeps an item if one ever doesn't.)
  const benchmarked = lines.filter((l) => l.benchmark_price !== null);
  const storeCents = sumCents(benchmarked, 'subtotal');
  const canadianCents = sumCents(benchmarked, 'benchmark_subtotal');
  const months = [...new Set(benchmarked.map((l) => l.benchmark_month))].sort();

  res.json({
    vid,
    lines,
    total: sumCents(lines, 'subtotal') / 100,
    unavailable: unavailableItems(items, lines),
    benchmark: benchmarked.length === 0 ? null : {
      items: benchmarked.length,
      storeTotal: storeCents / 100,        // this store's prices for the benchmarked items
      canadianTotal: canadianCents / 100,  // StatCan national averages for the same items
      difference: (storeCents - canadianCents) / 100,  // positive: dearer than the average
      percent: canadianCents === 0 ? null
        : Math.round(((storeCents - canadianCents) / canadianCents) * 1000) / 10,
      referenceMonth: months.at(-1) ?? null,  // latest StatCan month used
    },
  });
});

export default router;
