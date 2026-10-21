import { useEffect, useState } from 'react';
import { getFilters, getRetailers, quoteBasket, searchProducts } from './api.js';

const money = (n) => `$${n.toFixed(2)}`;

function Search({ onAdd }) {
  const [q, setQ] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [filters, setFilters] = useState({ brands: [], categories: [] });
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    getFilters().then(setFilters).catch((e) => setError(e.message));
  }, []);

  // Re-run the search whenever the keyword or a filter changes.
  useEffect(() => {
    let current = true;
    searchProducts({ q, brand, category })
      .then((rows) => current && (setResults(rows), setError('')))
      .catch((e) => current && setError(e.message));
    return () => {
      current = false;
    };
  }, [q, brand, category]);

  const clear = () => {
    setQ('');
    setBrand('');
    setCategory('');
  };

  return (
    <section>
      <h2>Search groceries</h2>
      <div className="controls">
        <input
          type="search"
          placeholder="Product name, e.g. milk"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={brand} onChange={(e) => setBrand(e.target.value)}>
          <option value="">All brands</option>
          {filters.brands.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {filters.categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button type="button" onClick={clear}>
          Clear
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Brand</th>
            <th>Size</th>
            <th>Category</th>
            <th>Retailer</th>
            <th className="num">Price</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr key={`${r.pid}-${r.vid}`}>
              <td>{r.name}</td>
              <td>{r.brand ?? '—'}</td>
              <td>
                {r.quantity} {r.unit}
              </td>
              <td>{r.category}</td>
              <td>{r.retailer}</td>
              <td className="num">{money(r.price)}</td>
              <td>
                <button type="button" onClick={() => onAdd(r)}>
                  Add
                </button>
              </td>
            </tr>
          ))}
          {results.length === 0 && (
            <tr>
              <td colSpan={7} className="empty">
                No products match.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

function Basket({ items, setItems }) {
  const [retailers, setRetailers] = useState([]);
  const [vid, setVid] = useState(null);
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getRetailers()
      .then((rows) => {
        setRetailers(rows);
        if (rows.length) setVid(rows[0].vid);
      })
      .catch((e) => setError(e.message));
  }, []);

  // Re-price the basket whenever its contents or the chosen retailer change.
  useEffect(() => {
    if (!vid || items.length === 0) {
      setQuote(null);
      return;
    }
    let current = true;
    quoteBasket(
      vid,
      items.map(({ pid, quantity }) => ({ pid, quantity })),
    )
      .then((q) => current && (setQuote(q), setError('')))
      .catch((e) => current && setError(e.message));
    return () => {
      current = false;
    };
  }, [vid, items]);

  const setQuantity = (pid, quantity) =>
    setItems((prev) => prev.map((i) => (i.pid === pid ? { ...i, quantity } : i)));
  const remove = (pid) => setItems((prev) => prev.filter((i) => i.pid !== pid));

  const priced = new Map((quote?.lines ?? []).map((l) => [l.pid, l]));

  return (
    <section>
      <h2>Basket</h2>
      <label className="controls">
        Price at
        <select value={vid ?? ''} onChange={(e) => setVid(Number(e.target.value))}>
          {retailers.map((r) => (
            <option key={r.vid} value={r.vid}>
              {r.name}
            </option>
          ))}
        </select>
      </label>

      {error && <p className="error">{error}</p>}

      {items.length === 0 ? (
        <p className="empty">Your basket is empty. Add products from the search results.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Quantity</th>
              <th className="num">Unit price</th>
              <th className="num">Subtotal</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((i) => {
              const line = priced.get(i.pid);
              return (
                <tr key={i.pid}>
                  <td>{i.name}</td>
                  <td>
                    <input
                      type="number"
                      min="1"
                      value={i.quantity}
                      onChange={(e) => setQuantity(i.pid, Math.max(1, Math.floor(Number(e.target.value)) || 1))}
                    />
                  </td>
                  <td className="num">{line ? money(line.unit_price) : '—'}</td>
                  <td className="num">{line ? money(line.subtotal) : 'Not sold here'}</td>
                  <td>
                    <button type="button" onClick={() => remove(i.pid)}>
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {quote && (
            <tfoot>
              <tr>
                <td colSpan={3}>Estimated total</td>
                <td className="num">{money(quote.total)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      )}
    </section>
  );
}

export default function App() {
  // Basket items: { pid, name, quantity }. A product is listed once however many retailers sell it.
  const [items, setItems] = useState([]);

  const add = (product) =>
    setItems((prev) =>
      prev.some((i) => i.pid === product.pid)
        ? prev.map((i) => (i.pid === product.pid ? { ...i, quantity: i.quantity + 1 } : i))
        : [...prev, { pid: product.pid, name: product.name, quantity: 1 }],
    );

  return (
    <main>
      <h1>SmartCart</h1>
      <Search onAdd={add} />
      <Basket items={items} setItems={setItems} />
    </main>
  );
}
