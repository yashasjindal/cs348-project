import React from 'react'
import './BasketCard.css'
import Button from '../button/Button.jsx'

function BasketCard({ items, onSetQuantity, onRemove, vendors, vid, setVid, quote }) {
  const priced = new Map((quote?.lines ?? []).map((l) => [l.pid, l]));
  const count = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="basket-card">
        <div className="basket-card-heading">
            <h1 className="basket-card-header">YOUR BASKET</h1>
            <h2>{count} items</h2>
        </div>
        <h2 className="controls">
            Price at
            <select value={vid ?? ''} onChange={(e) => setVid(Number(e.target.value))}>
            {vendors.map((v) => (
                <option key={v.vid} value={v.vid}>
                {v.name}
                </option>
            ))}
            </select>
        </h2>
        <hr></hr>
        <div className="basket-products">
            {items.length === 0 ? <p>Your basket is empty. Add some products!</p> : 
                items.map((i) => {
                    const line = priced.get(i.pid);
                    return (
                        <div key={i.pid}>
                            <div className="product-brand-price">
                                <div className="basket-actions">
                                    <Button
                                        text="-"
                                        type="symbol"
                                        onClick={() =>
                                            i.quantity === 1
                                                ? onRemove(i.pid)
                                                : onSetQuantity(i.pid, i.quantity - 1)
                                        }
                                    />
                                    <h1 className="product-brand">{i.quantity}</h1>
                                    <Button
                                        text="+"
                                        type="symbol"
                                        onClick={() =>
                                        onSetQuantity(i.pid, i.quantity + 1)
                                        }
                                    />
                                    <h1 className="product-brand">{i.name}</h1>
                                </div>
                                <h1 className="product-brand">{line ? `$${line.subtotal.toFixed(2)}` : 'Not sold here'}</h1>
                            </div>

                            <h2 className="product-name">
                                {i.size} {i.unit} · {line ? `$${line.unit_price.toFixed(2)} each` : '—'}
                            </h2>
                        </div>
        )})}
        </div>
        <hr></hr>
        <div className="basket-card-heading">
            <h1 className="product-brand">Subtotal</h1>
            <h1>{quote ? `$${quote.total.toFixed(2)}` : '$0.00'}</h1>
        </div>
        <div className="checkout-button">
            <Button text="Print my receipt →" type="primary"/>
        </div>
    </div>
  )
}

export default BasketCard