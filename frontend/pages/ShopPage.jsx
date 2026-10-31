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
                <Button text="01 SHOP" disabled={true} color="#203C34" />
                <Button text="02 RECEIPT" disabled={true} color="transparent" text_color="#607266" />
                <Button text="03 COMPARE" disabled={true} color="transparent" text_color="#607266" />
            </nav>
        </header>
      <h1>Shop Page</h1>
      <p>Welcome to the shop!</p>
    </div>
  );
}

export default ShopPage