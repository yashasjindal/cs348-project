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

// Send the current browser basket; prices are resolved by the backend.
export function compareBasket(items, { signal } = {}) {
  return request('/api/compare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: items.map(({ pid, quantity }) => ({ pid, quantity })) }),
    signal,
  });
}
