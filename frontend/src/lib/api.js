const LOCAL_API_URL = 'http://localhost:5000';
const PRODUCTION_API_URL = 'https://muscle-gilt.vercel.app';
const DEFAULT_API_URL = import.meta.env.PROD ? PRODUCTION_API_URL : LOCAL_API_URL;

export const API_URL = (import.meta.env.VITE_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');

export const apiPath = (path) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_URL}${normalizedPath}`;
};

export const requestJson = async (path, options = {}) => {
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(apiPath(path), {
    ...options,
    headers,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = payload?.details || payload?.error || `Request failed with ${response.status}`;
    throw new Error(message);
  }

  return payload;
};
