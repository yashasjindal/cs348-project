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

  const [rows] = await pool.execute(
    `SELECT p.pid, p.name, p.brand, p.quantity, p.unit, p.category,
            r.vid, r.name AS retailer, s.price
     FROM Product p
     JOIN Sells s ON s.pid = p.pid
     JOIN Retailer r ON r.vid = s.vid
     WHERE p.name LIKE CONCAT('%', ?, '%')
       AND (? IS NULL OR p.brand = ?)
       AND (? IS NULL OR p.category = ?)
     ORDER BY p.name, s.price`,
    [escapeLike(q), brand, brand, category, category],
  );
  res.json(rows);
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
