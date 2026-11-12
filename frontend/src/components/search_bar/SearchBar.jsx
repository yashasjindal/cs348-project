import React, { useEffect, useState } from 'react';
import './SearchBar.css';
import { getFilters, searchProducts } from '../../api.js';
import Button from '../button/Button.jsx';

function SearchBar({ q, setQ, onSearch }) {
  const [error, setError] = useState('');
  
  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch();
  };

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <input
          type="search"
          placeholder="Product name, e.g. milk"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      <Button text="Search →" type="search" onClick={onSearch} />
      {error && <p className="error">{error}</p>}
    </form>
  )
}

export default SearchBar;