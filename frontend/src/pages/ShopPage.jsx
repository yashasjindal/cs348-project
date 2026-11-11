import React from 'react'
import './ShopPage.css'
import { useEffect, useState } from 'react';
import { getVendors, quoteBasket } from '../api.js';
import Button from '../components/button/Button.jsx'
import ProductCard from '../components/product_card/ProductCard.jsx'
import BasketCard from '../components/basket_card/BasketCard.jsx'
import SearchBar from '../components/search_bar/SearchBar.jsx';

function ShopPage() {
  const [results, setResults] = useState([]);
  const [items, setItems] = useState(() => {
  const savedBasket = localStorage.getItem('basket');
    return savedBasket ? JSON.parse(savedBasket) : [];
  });
  const [vendors, setVendors] = useState([]);
  const [vid, setVid] = useState(null);
  const [quote, setQuote] = useState(null);

  useEffect(() => {
    getVendors()
      .then((rows) => {
        setVendors(rows);
        if (rows.length) setVid(rows[0].vid);
      })
      .catch((e) => setError(e.message));
  }, []);

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

  useEffect(() => {
    localStorage.setItem('basket', JSON.stringify(items));
  }, [items]);

  const add = (product) =>
    setItems((prev) =>
      prev.some((i) => i.pid === product.pid)
        ? prev.map((i) => (i.pid === product.pid ? { ...i, quantity: i.quantity + 1 } : i))
        : [...prev, { pid: product.pid, name: product.name, quantity: 1, size: product.quantity, unit: product.unit }],
    );
  
  const setQuantity = (pid, quantity) =>
    setItems((prev) => prev.map((i) => (i.pid === pid ? { ...i, quantity } : i)));

  const remove = (pid) => setItems((prev) => prev.filter((i) => i.pid !== pid));

  return (
    <div className="shop-page">
      <header className="shop-header">
          <h1 className="logo">SmartCart</h1>

          {/* TODO: make this dynamic to update based on the step we're on */}
          <nav className="shop-nav">
              <Button text="01 SHOP" disabled={true} type="current" />
              <Button text="02 RECEIPT" disabled={true} type="notCurrent" />
              <Button text="03 COMPARE" disabled={true} type="notCurrent" />
          </nav>
      </header>
      <div className="shop-divider">
        <h1>CHECKOUT</h1>
        <h2>NO SCANNING, JUST TYPE, PICK & ADD</h2>
      </div>
      <p className="shop-subtitle">A LITTLE LESS SPENDING, A LITTLE MORE KNOWING</p>
      <div className="shop-terminal">
        <p className="shop-terminal-header">● SELF CHECKOUT</p>
        <div className="shop-content">
          <div className="shop-content-header">
            <h1>What's on your list?</h1>
            <h2>01 / FIND YOUR ITEMS</h2>
          </div>
          <SearchBar  onResults={setResults}/>
          <div className="results">
            {results.length === 0 ? (
              <div className="no-products">
                <h1>Start with one thing.</h1>
                <h2>Milk, eggs, bread… find the exact brand and size you’d put in your real basket.</h2>
              </div>
            ) : (
              <div className="products">
                {results.map((r) => (
                <ProductCard
                  key={r.pid}
                  brand={r.brand}
                  name={r.name}
                  size={`${r.quantity} ${r.unit}`}
                  price={r.price}
                  onClick={() => add(r)}
                />
              ))}
              </div>
            )}
          </div>
          <div className="basket">
            <BasketCard 
              items={items}
              onSetQuantity={setQuantity}
              onRemove={remove}
              vendors={vendors}
              vid={vid}
              setVid={setVid}
              quote={quote}
            />
          </div>
        </div>
        <p className="shop-subtitle">TYPE IT. BAG IT. COMPARE IT.</p>
      </div>
    </div>
  );
}

export default ShopPage