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
      <h1>Shop Page</h1>
      <p>Welcome to the shop!</p>
    </div>
  );
}

export default ShopPage