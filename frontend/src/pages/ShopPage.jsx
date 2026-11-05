import React from 'react'
import './ShopPage.css'
import { useEffect, useState } from 'react';
import { getFilters, getVendors, quoteBasket, searchProducts } from '../api.js';
import Button from '../components/button/Button.jsx'
import ProductCard from '../components/product_card/ProductCard.jsx'

function ShopPage() {
  const [q, setQ] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    searchProducts({ q, brand, category })
      .then((rows) => current && (setResults(rows), setError('')))
      .catch((e) => current && setError(e.message));
    return () => {
      current = false;
    };
  }, [q, brand, category]);

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
          {results.map((r) => (
            <ProductCard
              brand={r.brand}
              name={r.name}
              size={`${r.quantity} ${r.unit}`}
              price={r.price}
            />
          ))}
        </div>
        <p className="shop-subtitle">TYPE IT. BAG IT. COMPARE IT.</p>
      </div>
    </div>
  );
}

export default ShopPage