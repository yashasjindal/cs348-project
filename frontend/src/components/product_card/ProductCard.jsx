import React from 'react'
import './ProductCard.css'
import Button from '../button/Button.jsx'
import Tooltip from '../tooltip/ToolTip.jsx'

// One card per product per store: search returns a row for each store that sells the product.
function ProductCard({ brand, name, size, price, vendor, onClick }) {
  return (
    <div className="product-card">
        <div className="product-content">
            <Tooltip
                as="h1"
                className="product-brand"
                text={brand ?? name}
            />
            <Tooltip
                as="h2"
                className="product-name"
                text={size ? `${name} · ${size}` : name}
            >
                <span className="product-name-text truncate">
                    {name}
                </span>

                {size && (
                    <>
                        <span className="product-separator">·</span>
                        <span className="product-size truncate">
                            {size}
                        </span>
                    </>
                )}
            </Tooltip>
            <div className="product-price-add">
                <div className="product-price-block">
                    <h3 className="product-price">${price.toFixed(2)}</h3>
                    {vendor && (
                        <Tooltip
                            className="product-vendor"
                            text={`at ${vendor}`}
                        />
                    )}
                </div>
                <Button text="+ Add" type="add" onClick={onClick} />
            </div>
        </div>
    </div>
  )
}

export default ProductCard