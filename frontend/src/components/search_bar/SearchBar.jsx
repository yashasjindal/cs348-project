import React, { useEffect, useState } from 'react';
import './SearchBar.css';
import { getFilters, searchProducts } from '../../api.js';
import Button from '../button/Button.jsx';

function SearchBar({ onResults }) {
  const [q, setQ] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [filters, setFilters] = useState({ brands: [], categories: [] });
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    getFilters().then(setFilters).catch((e) => setError(e.message));
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();

    setResults([]);
    onResults([]);
    setError('');

    try {
      const rows = await searchProducts({ q, brand, category });

      setResults(rows);
      onResults(rows);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <form className="search-bar">
      <input
          type="search"
          placeholder="Product name, e.g. milk"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      <Button text="Search →" type="search" onClick={handleSearch} />
      {error && <p className="error">{error}</p>}
    </form>
  )
}

export default SearchBar;