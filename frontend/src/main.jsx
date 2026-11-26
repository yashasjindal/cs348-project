import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ShopPage from './pages/ShopPage.jsx';
import ReceiptPage from './pages/Receipt.jsx';
import ComparePage from './pages/ComparisonPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import App from './App.jsx';
import './App.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/shop" element={<ShopPage />} />
        <Route path="/receipt" element={<ReceiptPage />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
