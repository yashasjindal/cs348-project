import React from 'react'
import './ProductCard.css'
import Button from '../button/Button.jsx'

function ProductCard({ brand, name, size, price, onClick }) {
  return (
    <div className="product-card">
        <div className="product-content">
            <h1 className="product-brand">{brand ?? name}</h1>
            <h2 className="product-name">{name} · {size}</h2>
            <div className="product-price-add">
                <h3 className="product-price">${price.toFixed(2)}</h3>
                <Button text="+ Add" type="add" onClick={onClick} />
            </div>
        </div>
    </div>
  )
}

export default ProductCard