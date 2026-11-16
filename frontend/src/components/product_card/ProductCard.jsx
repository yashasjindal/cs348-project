import React from 'react'
import './ProductCard.css'
import Button from '../button/Button.jsx'

// One card per product per store: search returns a row for each store that sells the product.
function ProductCard({ brand, name, size, price, vendor, onClick }) {
  return (
    <div className="product-card">
        <div className="product-content">
            <h1 className="product-brand">{brand ?? name}</h1>
            <h2 className="product-name">{name} · {size}</h2>
            <div className="product-price-add">
                <div className="product-price-block">
                    <h3 className="product-price">${price.toFixed(2)}</h3>
                    {vendor && <span className="product-vendor">at {vendor}</span>}
                </div>
                <Button text="+ Add" type="add" onClick={onClick} />
            </div>
        </div>
    </div>
  )
}

export default ProductCard