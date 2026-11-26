import { useState } from 'react';
import Button from '../components/button/Button.jsx';
import './LoginPage.css';

export default function LoginPage() {
  const [status, setStatus] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    setStatus('Login is currently unavailable.');
  }

  return (
    <main className="login-page">
      <header className="login-brand">SmartCart</header>

      <div className="login-layout">
        <aside className="login-welcome" aria-label="About SmartCart">
          <p className="login-eyebrow">A LITTLE LESS SPENDING.</p>
          <p className="login-headline">Good groceries.<br />Smarter choices.</p>
          <p>Build your basket, compare store prices, and see where your money goes.</p>

          <div className="login-receipt">
            <h2>One smart grocery run</h2>
            <ol>
              <li>Pick your usual store</li>
              <li>Add your grocery essentials</li>
              <li>Compare your basket total</li>
            </ol>
            <p>Less guesswork. More in your basket.</p>
          </div>
        </aside>

        <form className="login-form" aria-labelledby="login-title" onSubmit={handleSubmit}>
          <h1 id="login-title">Log in</h1>
          <p>Log in to start your grocery list.</p>

          <label>
            Email address
            <input name="email" type="email" autoComplete="username" placeholder="you@example.com" required />
          </label>
          <label>
            Password
            <input name="password" type="password" autoComplete="current-password" placeholder="••••••••" required />
          </label>

          <Button text="Log in →" type="search" htmlType="submit" />
          <p role="status" className="login-status">{status}</p>
        </form>
      </div>
    </main>
  );
}
