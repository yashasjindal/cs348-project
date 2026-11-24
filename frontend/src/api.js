// Thin wrappers around the backend's JSON endpoints.

async function request(path, options) {
  const res = await fetch(path, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body;
}

export function searchProducts({ q, brand, category }) {
  const params = new URLSearchParams({ q, brand, category });
  return request(`/api/products?${params}`);
}

export const getFilters = () => request('/api/products/filters');

export const getVendors = () => request('/api/vendors');

export function quoteBasket(vid, items) {
  return request('/api/basket/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vid, items }),
  });
}

// Basket at one store with each item's Statistics Canada average (feature 3, the receipt).
export function receiptBasket(vid, items) {
  return request('/api/basket/receipt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vid, items }),
  });
}

export function compareBasket(items) {
  return request('/api/compare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
}

// Accounts (feature 5). The login lives in a session cookie that the browser sends by itself.
const sendJson = (method, path, body) =>
  request(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// Each resolves to { user: { uid, username } }; a failure throws with the server's message.
export const register = (username, password) => sendJson('POST', '/api/register', { username, password });
export const login = (username, password) => sendJson('POST', '/api/login', { username, password });

// Resolves to { user: { uid, username } } when logged in, or { user: null }.
export const getCurrentUser = () => request('/api/me');

export const logout = () => request('/api/logout', { method: 'POST' });

// Needs the password again; logs out on success.
export const deleteAccount = (password) => sendJson('DELETE', '/api/account', { password });
