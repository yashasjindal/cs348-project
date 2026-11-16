import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { compareBasket, receiptBasket } from '../api.js';
import Button from '../components/button/Button.jsx';
import './ComparisonPage.css';
import './Receipt.css';

const receiptDate = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
}).format(new Date()).toUpperCase();

const money = (amount) => `$${Number(amount).toFixed(2)}`;

// '2026-09' -> 'SEP 2026' (StatCan publishes one average per month).
const monthLabel = (yyyymm) => {
  if (!yyyymm) return '';
  const [year, month] = yyyymm.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, 1)))
    .toUpperCase();
};

// One line comparing the basket with the Canadian average.
function benchmarkVerdict({ difference, percent }) {
  const pct = percent === null ? '' : ` (${Math.abs(percent).toFixed(1)}%)`;
  if (difference > 0) return `YOU PAY ${money(difference)}${pct} MORE THAN THE CANADIAN AVERAGE`;
  if (difference < 0) return `YOU PAY ${money(-difference)}${pct} LESS THAN THE CANADIAN AVERAGE`;
  return 'RIGHT ON THE CANADIAN AVERAGE';
}

function ReceiptPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const items = state?.items ?? [];
  const quote = state?.quote;
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  const pricedLines = new Map((quote?.lines ?? []).map((line) => [line.pid, line]));
  const [priceSpread, setPriceSpread] = useState(null);
  const [comparableStoreCount, setComparableStoreCount] = useState(0);
  const [isLoadingSpread, setIsLoadingSpread] = useState(false);
  const [spreadError, setSpreadError] = useState(false);
  // Feature 3: the same basket at this store with Statistics Canada averages.
  const [receipt, setReceipt] = useState(null);
  const [receiptError, setReceiptError] = useState(false);
  const benchmarkLines = new Map((receipt?.lines ?? []).map((line) => [line.pid, line]));
  const benchmark = receipt?.benchmark ?? null;

  useEffect(() => {
    let active = true;
    setReceipt(null);
    setReceiptError(false);
    if (items.length === 0 || !quote?.vid) return () => { active = false; };

    receiptBasket(quote.vid, items.map(({ pid, quantity }) => ({ pid, quantity })))
      .then((result) => { if (active) setReceipt(result); })
      .catch(() => { if (active) setReceiptError(true); });
    return () => { active = false; };
  }, [state]);

  useEffect(() => {
    let active = true;

    if (items.length === 0) {
      setPriceSpread(null);
      setComparableStoreCount(0);
      setIsLoadingSpread(false);
      setSpreadError(false);
      return () => { active = false; };
    }

    setPriceSpread(null);
    setComparableStoreCount(0);
    setIsLoadingSpread(true);
    setSpreadError(false);
    compareBasket(items.map(({ pid, quantity }) => ({ pid, quantity })))
      .then((result) => {
        if (!active) return;
        const completeStores = result.storeTotals.filter(
          (store) => store.hasAllItems && Number.isFinite(store.total),
        );
        setComparableStoreCount(completeStores.length);
        if (completeStores.length > 0) {
          const totalsInCents = completeStores.map((store) => Math.round(store.total * 100));
          setPriceSpread((Math.max(...totalsInCents) - Math.min(...totalsInCents)) / 100);
        }
      })
      .catch(() => {
        if (active) setSpreadError(true);
      })
      .finally(() => {
        if (active) setIsLoadingSpread(false);
      });

    return () => { active = false; };
  }, [state]);

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

      <section className="receipt-frame">
        <aside className="receipt-side receipt-left">
          <h2>BAGGED &amp;<br />TOTALED.</h2>
          <p className="receipt-side-copy">A little paper trail for your grocery run.</p>

          <div className="receipt-store-card">
            <span className="receipt-eyebrow">YOUR STORE</span>
            <strong>{state?.vendorName ?? 'Choose a store'}</strong>
            <span>{items.length} products · {itemCount} items</span>
          </div>

          <div className="receipt-left-action">
            <p>Compare the same basket at other stores next.</p>
            <Link className="receipt-edit-button" to="/shop">← Edit my basket</Link>
          </div>
        </aside>

        <article className="receipt-paper">
          <header className="receipt-paper-header">
            <h2>GROCERSCOPE<br />CORNER MARKET</h2>
            <p>YOUR VIRTUAL GROCERY RECEIPT</p>
            <p>{(state?.vendorName ?? 'SMARTCART').toUpperCase()} · KITCHENER, ON</p>
          </header>

          <div className="receipt-meta">
            <span>VIRTUAL RECEIPT</span>
            <span>{receiptDate}</span>
            <span>{itemCount} ITEMS</span>
          </div>

          {items.length === 0 ? (
            <p className="receipt-empty">Your receipt is empty. Add items to your basket first.</p>
          ) : (
            <ul className="receipt-items">
              {items.map((item) => {
                const line = pricedLines.get(item.pid);
                const benchmarkLine = benchmarkLines.get(item.pid);
                return (
                  <li key={item.pid}>
                    <div className="receipt-item-description">
                      <span>{item.name}</span>
                      <small>{item.quantity} × {item.size} {item.unit}</small>
                      {benchmarkLine?.benchmark_price != null && (
                        <small className="receipt-item-benchmark">
                          CDN AVG {money(benchmarkLine.benchmark_subtotal)} · {benchmarkLine.benchmark_item}
                        </small>
                      )}
                    </div>
                    <span className="receipt-item-price">
                      {line ? money(line.subtotal) : 'N/A'}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          <section className="receipt-total-block">
            <div className="receipt-total">
              <strong>TOTAL&nbsp; CAD</strong>
              <strong>{quote ? money(quote.total) : '—'}</strong>
            </div>
            <div className="receipt-total-meta">
              <span>{itemCount} ITEMS</span>
              <span>ESTIMATED TOTAL</span>
            </div>

            {benchmark && (
              <div className="receipt-benchmark">
                <div className="receipt-benchmark-row">
                  <span>CANADIAN AVERAGE*</span>
                  <span>{money(benchmark.canadianTotal)}</span>
                </div>
                <p className={`receipt-benchmark-verdict ${benchmark.difference > 0 ? 'above' : 'below'}`}>
                  {benchmarkVerdict(benchmark)}
                </p>
                <small className="receipt-benchmark-note">
                  *Statistics Canada average retail prices, {monthLabel(benchmark.referenceMonth)}
                  {benchmark.storeTotal !== receipt.total &&
                    ` · compared on the ${benchmark.items} items with an average (${money(benchmark.storeTotal)} here)`}
                </small>
              </div>
            )}
            {receiptError && (
              <small className="receipt-benchmark-note">The Canadian average is unavailable right now.</small>
            )}
          </section>

          <footer className="receipt-paper-footer">
            <strong>THANK YOU &amp; SEE YOU NEXT SHOP!</strong>
            <span>Not proof of purchase.</span>
          </footer>
        </article>

        <aside className="receipt-side receipt-right">
          <h2>Same basket.<br />Different totals.</h2>
          <p className="receipt-side-copy">Find out which store is cheaper, down to the last loaf.</p>
          <div className="receipt-compare-button">
            <Button
              text="Compare stores →"
              type="primary"
              onClick={() => navigate('/compare', { state })}
            />
          </div>
          <div className="receipt-quick-peek">
            <span className="receipt-eyebrow">A QUICK PEEK</span>
            <strong>
              {isLoadingSpread ? '…' : priceSpread === null ? '—' : money(priceSpread)}
            </strong>
            <span>
              {items.length === 0
                ? 'Add items to compare store totals.'
                : spreadError
                  ? 'Store totals are unavailable right now.'
                  : comparableStoreCount === 0
                    ? 'No store has every item in this basket.'
                    : comparableStoreCount === 1
                      ? 'Only one store carries the complete basket.'
                      : `between the lowest and highest totals across ${comparableStoreCount} stores.`}
            </span>
          </div>
        </aside>
      </section>

      <footer className="receipt-page-footer">
        <strong>A LITTLE LESS SPENDING. A LITTLE MORE KNOWING.</strong>
        <span>SAMPLE PRICES&nbsp; / &nbsp;CAD&nbsp; / &nbsp;NOT A PURCHASE</span>
      </footer>
    </div>
  );
}

export default ReceiptPage;
