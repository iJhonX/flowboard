import { apiFetch } from './client';

export function register(name, email, password) {
  return apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
}

export function login(email, password) {
  return apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function refresh() {
  return apiFetch('/api/auth/refresh', { method: 'POST' });
}

// logout devuelve 204 sin cuerpo: apiFetch haría res.json() y fallaría,
// así que se usa fetch directo.
export async function logout() {
  await fetch(`${import.meta.env.VITE_API_URL}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
}

export function fetchMe() {
  return apiFetch('/api/auth/me');
}
