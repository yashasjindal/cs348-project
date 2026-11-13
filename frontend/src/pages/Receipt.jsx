import { Link, useLocation, useNavigate } from 'react-router-dom';
import Button from '../components/button/Button.jsx';
import './ComparisonPage.css';
import './Receipt.css';

function ReceiptPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const items = state?.items ?? [];
  const quote = state?.quote;

  return (
    <div className="comparison-page receipt-page">
      <header className="comparison-header">
        <h1 className="logo">SmartCart</h1>
        <nav className="comparison-nav">
          <Button text="01 SHOP" disabled={true} type="notCurrent" />
          <Button text="02 RECEIPT" disabled={true} type="current" />
          <Button text="03 COMPARE" disabled={true} type="notCurrent" />
        </nav>
      </header>

      <main className="receipt-content">
        <header className="receipt-header">
          <p>SMARTCART · SELF CHECKOUT</p>
          <h1>Your receipt</h1>
          {state?.vendorName && <p>Price at {state.vendorName}</p>}
        </header>

        {items.length === 0 ? (
          <p className="receipt-empty">Your receipt is empty. Add items to your basket first.</p>
        ) : (
          <>
            <ul className="receipt-items">
              {items.map((item) => {
                const line = quote?.lines?.find((quotedLine) => quotedLine.pid === item.pid);
                return (
                  <li key={item.pid}>
                    <span>{item.quantity} × {item.name}</span>
                    <span>{line ? `$${line.subtotal.toFixed(2)}` : 'Not sold here'}</span>
                  </li>
                );
              })}
            </ul>
            <div className="receipt-total">
              <span>Total</span>
              <span>{quote ? `$${quote.total.toFixed(2)}` : '—'}</span>
            </div>
          </>
        )}

        <div className="receipt-compare-button">
          <Button
            text="Compare stores →"
            type="primary"
            onClick={() => navigate('/compare', { state })}
          />
        </div>
        <Link className="receipt-back" to="/shop">← Back to shop</Link>
      </main>
    </div>
  );
}

export default ReceiptPage;
