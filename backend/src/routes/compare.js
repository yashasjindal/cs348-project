import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

// POST /api/compare
// body: { items: [{ pid: 1, name: 'Milk', quantity: 2 }] }
// Names are optional; prices come from the database. Quantity defaults to one.
router.post('/compare', async (req, res) => {
  const { items } = req.body ?? {};

  if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
    return res.status(400).json({ error: 'Basket must contain 1 to 100 items' });
  }
  if (!items.every(item =>
    Number.isSafeInteger(item?.pid) && item.pid > 0 &&
    Number.isSafeInteger(item.quantity ?? 1) && (item.quantity ?? 1) > 0
  )) {
    return res.status(400).json({ error: 'Each item needs a positive integer pid and quantity' });
  }
  if (new Set(items.map(item => item.pid)).size !== items.length) {
    return res.status(400).json({ error: 'Each pid may appear only once' });
  }

  const placeholders = items.map(() => '?').join(', ');
  // Include every vendor, even when it only stocks part of the basket.
  const [rows] = await pool.execute(
    `SELECT p.pid, p.name, p.quantity AS pack_quantity, p.unit,
            v.vid, v.name AS retailer, s.price,
            MIN(s.price) OVER (PARTITION BY p.pid) AS lowest_price
     FROM Product p
     CROSS JOIN Vendor v
     LEFT JOIN Sells s ON s.pid = p.pid AND s.vid = v.vid
     WHERE p.pid IN (${placeholders})
     ORDER BY p.pid, v.vid`,
    items.map(item => item.pid),
  );

  // Work in cents so sums and savings don't accumulate floating-point errors.
  const money = cents => cents / 100;
  const vendors = new Map();
  const productRows = new Map();
  for (const row of rows) {
    if (!vendors.has(row.vid)) {
      vendors.set(row.vid, { vid: row.vid, retailer: row.retailer, cents: 0, count: 0 });
    }
    if (!productRows.has(row.pid)) {
      productRows.set(row.pid, {
        pid: row.pid,
        name: row.name,
        packSize: `${Number(row.pack_quantity)} ${row.unit}`,
        lowestPrice: row.lowest_price === null ? null : Number(row.lowest_price),
        prices: [],
      });
    }
    if (row.price !== null) {
      productRows.get(row.pid).prices.push({ vid: row.vid, price: Number(row.price) });
    }
  }

  const splitStores = new Map();
  let splitCents = 0;
  let canSplit = true;
  const products = items.map(item => {
    const product = productRows.get(item.pid) ?? {
      pid: item.pid, name: null, packSize: null, prices: [],
    };
    const quantity = item.quantity ?? 1;
    const lowestCents = product.lowestPrice == null
      ? null
      : Math.round(product.lowestPrice * 100);
    for (const price of product.prices) {
      const cents = Math.round(price.price * 100);
      const vendor = vendors.get(price.vid);
      vendor.cents += cents * quantity;
      vendor.count++;
    }
    const cheapestVendorIds = product.prices
      .filter(price => Math.round(price.price * 100) === lowestCents)
      .map(price => price.vid);

    if (lowestCents === null) {
      canSplit = false;
    } else {
      splitCents += lowestCents * quantity;
      // Prices are ordered by vendor ID; choose one vendor on ties.
      const vid = cheapestVendorIds[0];
      if (!splitStores.has(vid)) {
        splitStores.set(vid, { vid, retailer: vendors.get(vid).retailer, productIds: [] });
      }
      splitStores.get(vid).productIds.push(item.pid);
    }
    return {
      ...product, quantity, cheapestVendorIds,
      lowestPrice: lowestCents === null ? null : money(lowestCents),
    };
  });

  const storeTotals = [...vendors.values()]
    .map(vendor => ({
      vid: vendor.vid,
      retailer: vendor.retailer,
      total: money(vendor.cents),
      hasAllItems: vendor.count === items.length,
    }))
    .sort((a, b) => a.total - b.total || a.vid - b.vid);
  const cheapest = storeTotals.find(store => store.hasAllItems);
  const cheapestSingleStore = cheapest

    ? { vid: cheapest.vid, retailer: cheapest.retailer, total: cheapest.total }
    : null;
  const cheapestSplitBasket = canSplit
    ? { total: money(splitCents), stores: [...splitStores.values()] }
    : null;

  return res.json({
    storeTotals,
    products,
    summary: {
      cheapestSingleStore,
      cheapestSplitBasket,
      additionalSavings: cheapest && canSplit
        ? money(Math.round(cheapest.total * 100) - splitCents)
        : null,
    },
  });
});

export default router;

