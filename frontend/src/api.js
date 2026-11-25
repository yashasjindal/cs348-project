// Thin wrappers around the backend's JSON endpoints.

async function request(path, options) {
  const res = await fetch(path, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body;
}

export function searchProducts({ q, brand, category, page = 1 }) {
  const params = new URLSearchParams({ q, brand, category, page });
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
