import React from 'react'
import { Link } from 'react-router-dom';
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

    const sortedStores = [...completeStores].sort((a, b) => a.total - b.total);

    const cheapestStore = sortedStores[0];
    
    const mostExpensiveStore = sortedStores[sortedStores.length - 1];

    const lowestTotalCents = cheapestStore ? Math.round(cheapestStore.total*100) : null;
    
    const difference = cheapestStore ? (Math.round(mostExpensiveStore.total*100) - lowestTotalCents) / 100 : null;

    const cheapestNames = sortedStores.filter( (store) => Math.round(store.total * 100) === lowestTotalCents,).map((store) => store.retailer).join(' / ');

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

                    {cheapestStore ? (
                        <>
                            <div className="comparison-winner">
                                <h2>{cheapestNames}</h2>
                                <strong>{money(cheapestStore.total)}</strong>
                            </div>

                            <p>
                                {sortedStores.length === 1 ? 'Only this retailer has every item in your basket.'
                                    : difference === 0 ? 'All complete baskets have the same total.'
                                        : `${money(difference)} less than ${mostExpensiveStore.retailer} for this basket`}
                            </p>
                        </>
                    ) : (
                        <p>No single retailer has every item in your basket.</p>
                    )}
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
                            className={`comparison-card ${isCheapest ? 'comparison-card-best' : ''
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
            <section className="comparison-panel">
                <div className="comparison-table-heading">
                    <h2>Where each item wins</h2>
                    <p>LOWEST PRICE HIGHLIGHTED · CAD</p>
                </div>
                <div className="comparison-table-wrapper">
                    <table className="comparison-table">
                        <thead>
                            <tr>
                                <th scope="col">PRODUCT / PACK SIZE</th>

                                {storeTotals.map((store) => (
                                    <th scope="col" key={store.vid}>
                                        {store.retailer}
                                    </th>
                                ))}
                            </tr>
                        </thead>

                        <tbody>
                            {products.map((product) => (
                                <tr key={product.pid}>
                                    <th scope="row">
                                        {product.name} · {product.packSize} × {product.quantity}
                                    </th>

                                    {storeTotals.map((store) => {
                                        // Find this retailer's price for this product
                                        const entry = product.prices.find(
                                            (price) => price.vid === store.vid,
                                        );

                                        const hasPrice = Number.isFinite(entry?.price);
                                        const isCheapestProduct =
                                            hasPrice && product.cheapestVendorIds.includes(store.vid);

                                        return (
                                            <td
                                                key={store.vid}
                                                className={isCheapestProduct ? 'comparison-lowest' : ''}
                                            >
                                                {hasPrice ? money(entry.price) : 'Unavailable'}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>

                        <tfoot>
                            <tr>
                                <th scope="row">BASKET TOTAL</th>

                                {storeTotals.map((store) => {
                                    const isComplete =
                                        store.hasAllItems && Number.isFinite(store.total);

                                    const isCheapestBasket =
                                        isComplete &&
                                        lowestTotalCents !== null &&
                                        Math.round(store.total * 100) === lowestTotalCents;

                                    return (
                                        <td
                                            key={store.vid}
                                            className={isCheapestBasket ? 'comparison-lowest' : ''}
                                        >
                                            {isComplete ? money(store.total) : 'Incomplete'}
                                        </td>
                                    );
                                })}
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </section>

            {/* Action buttons */}
            <div className="comparison-actions">
                <button type="button" disabled>
                    ← Back to my receipt
                </button>
                <Link to="/shop">Edit my basket →</Link>
            </div>

            {/* Footer */}
            <footer className="comparison-footer">
                <p>
                    Illustrative prices · Matched pack sizes ·
                    No loyalty offers or delivery fees included.
                    <br />
                    Prices are estimates for comparison, not a completed purchase.
                </p>

                <div>
                    <span>A LITTLE LESS SPENDING. A LITTLE MORE KNOWING.</span>
                    <span>SAMPLE PRICES / CAD / NOT A PURCHASE</span>
                </div>
            </footer>
        </div>
    );
}

export default ComparisonPage;

