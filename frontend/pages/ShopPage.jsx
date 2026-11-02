import React from 'react'
import './ShopPage.css'
import Button from '../components/button/Button'

function ShopPage() {
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
          test
        </div>
        <p className="shop-subtitle">TYPE IT. BAG IT. COMPARE IT.</p>
      </div>
    </div>
  );
}

export default ShopPage