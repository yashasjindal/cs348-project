import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

// Escape LIKE wildcards so a search for "50%" matches the text "50%" literally.
const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

// Treat a missing or blank filter as "no filter".
const optional = (value) => {
  const s = typeof value === 'string' ? value.trim() : '';
  return s === '' ? null : s;
};

// Feature 1: search and filter groceries by name keyword, brand and category.
// GET /api/products?q=milk&brand=Lactantia&category=Dairy
router.get('/', async (req, res) => {
  const q = optional(req.query.q) ?? '';
  const brand = optional(req.query.brand);
  const category = optional(req.query.category);

  // pagination logic
  const page = Number(req.query.page ?? 1);
  const limit = 4;

  if (!Number.isSafeInteger(page) || page < 1) {
    return res.status(400).json({ error: 'Invalid page number' });
  }

  const offset = (page - 1) * limit;

  const conditions = `
    FROM Product p
    JOIN Sells s ON s.pid = p.pid
    JOIN Vendor v ON v.vid = s.vid
    WHERE p.name LIKE CONCAT('%', ?, '%')
      AND (? IS NULL OR p.brand = ?)
      AND (? IS NULL OR p.category = ?)
  `;

  const params = [escapeLike(q), brand, brand, category, category,];

  const [rows] = await pool.execute(
    `SELECT p.pid, p.name, p.brand, p.quantity, p.unit, p.category,
            v.vid, v.name AS vendor, s.price
     ${conditions}
     ORDER BY p.name, s.price
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total
     ${conditions}`,
    params
  );

  const total = Number(countRows[0].total);

  res.json({
    products: rows,
    page,
    total,
    totalPages: Math.ceil(total / limit)
  });
});

// Values for the brand and category drop-downs.
// GET /api/products/filters
router.get('/filters', async (req, res) => {
  const [brands] = await pool.execute(
    'SELECT DISTINCT brand FROM Product WHERE brand IS NOT NULL ORDER BY brand',
  );
  const [categories] = await pool.execute(
    'SELECT DISTINCT category FROM Product ORDER BY category',
  );
  res.json({
    brands: brands.map((r) => r.brand),
    categories: categories.map((r) => r.category),
  });
});

export default router;
