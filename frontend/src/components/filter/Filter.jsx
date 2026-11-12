import React, { useEffect, useState } from 'react';
import { getFilters } from '../../api.js';
import Button from '../button/Button.jsx';
import './Filter.css'

function Filter({ brand, setBrand, category, setCategory }) {
  const [filters, setFilters] = useState({ brands: [], categories: [] });

  useEffect(() => {
    getFilters()
      .then(setFilters)
      .catch(console.error);
  }, []);

  const clear = () => {
    setBrand('');
    setCategory('');
  };

  return (
    <div className="filters">
      <select className="filter-select" value={brand} onChange={(e) => setBrand(e.target.value)}>
        <option value="">All brands</option>
        {filters.brands.map((b) => (
          <option key={b}>{b}</option>
        ))}
      </select>
      <select className="filter-select" value={category} onChange={(e) => setCategory(e.target.value)}>
        <option value="">All categories</option>
        {filters.categories.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
      {(brand || category) && (
        <Button text="Clear" type="clear" onClick={clear} />
      )}
    </div>
  )
}

export default Filter