import React from 'react'
import Button from '../components/button/Button.jsx';
import './ComparisonPage.css';

// Temporary sample data for building the layout.
const storeTotals = [
  {
        "vid": 1,
        "retailer": "Walmart",
        "total": 12.77,
        "hasAllItems": true
      },
      {
        "vid": 2,
        "retailer": "No Frills",
        "total": 12.97,
        "hasAllItems": true
      },
      {
        "vid": 3,
        "retailer": "Sobeys",
        "total": 14.47,
        "hasAllItems": true
      }
];

const products = [
  {
        "pid": 1,
        "name": "Lactantia 2% Milk",
        "packSize": "2 L",
        "quantity": 1,
        "prices": [
          { "vid": 1, "price": 5.29 },
          { "vid": 2, "price": 5.49 },
          { "vid": 3, "price": 5.99 }
        ],
        "cheapestVendorIds": [1],
        "lowestPrice": 5.29
      },
      {
        "pid": 2,
        "name": "Large Eggs",
        "packSize": "12 pack",
        "quantity": 1,
        "prices": [
          { "vid": 1, "price": 4.29 },
          { "vid": 2, "price": 4.49 },
          { "vid": 3, "price": 4.99 }
        ],
        "cheapestVendorIds": [1],
        "lowestPrice": 4.29
      },
      {
        "pid": 3,
        "name": "White Bread",
        "packSize": "675 g",
        "quantity": 1,
        "prices": [
          { "vid": 1, "price": 3.19 },
          { "vid": 2, "price": 2.99 },
          { "vid": 3, "price": 3.49 }
        ],
        "cheapestVendorIds": [2],
        "lowestPrice": 2.99
      }
];

const money = (value) => `$${value.toFixed(2)}`;

function ComparisonPage() {

    const completeStores = storeTotals.filter(
        (store) => store.hasAllItems && Number.isFinite(store.total),
    );

const lowestTotalCents = completeStores.length
  ? Math.min(...completeStores.map((store) => Math.round(store.total * 100)))
  : null;

    return (
    <div className="comparison-page">
        <header className="comparison-header">
            <h1 className="logo">SmartCart</h1>
    
            {/* TODO: make this dynamic to update based on the step we're on */}
            <nav className="comparison-nav">
                <Button text="01 SHOP" disabled={true} type="notCurrent" />
                <Button text="02 RECEIPT" disabled={true} type="notCurrent" />
                <Button text="03 COMPARE" disabled={true} type="current" />
            </nav>
        </header>

        {/* Dark green summary banner */}
        <section className="comparison-banner">
            <div>
                <p className="comparison-label">THE BASKET BREAKDOWN</p>
                <h2>Your groceries. Three price tags.</h2>
                <p>Compare the same products and pack sizes, store by store.</p>
            </div>

            <div>
                <p className="comparison-label">LOWEST SINGLE-STORE TOTAL</p>
                <div className="comparison-winner">
                    <h2>Walmart</h2>
                    <strong>$12.77</strong>
                </div>
                {/* hardcoded.... */}
                <p>$1.70 less than Sobeys for this basket</p>
            </div>
        </section>

        {/* Retailer total cards */}
        <section className="comparison-retailers">
            {storeTotals.map((store) => {
                const difference = store.hasAllItems && lowestTotalCents !== null ? (Math.round(store.total * 100) - lowestTotalCents) / 100 : null;
                const isCheapest = difference === 0;
            

                return ( 
                    <article 
                    key={store.vid}
                    className={`comparison-card ${
                        isCheapest ? 'comparison-card-best' : ''
                    }`}
                    >
                        <div className="comparison-card-heading">
                            <h3>{store.retailer}</h3> 
                            <strong>
                                {difference !== null ? money(store.total) : 'Incomplete'}
                            </strong>
                        </div>
                        <p>
                            {difference === null
                            ? 'Some items are unavailable'
                            : isCheapest
                                ? 'LOWEST TOTAL'
                                : `+${money(difference)} vs lowest`}
                        </p>
                    </article>
                );
            })}
        </section>

        {/* Product price comparison table */}
        <section className="comparison-table">
            
        </section>
    </div>      
    );
}

export default ComparisonPage;

