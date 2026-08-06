import axios from 'axios';

const TOKEN_KEY = 'lead_capture_token';

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
    (import.meta.env.PROD ? '' : 'http://localhost:3001'),
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
