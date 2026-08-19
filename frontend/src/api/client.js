const API_URL = import.meta.env.VITE_API_URL;

/**
 * Renueva la sesión usando el refresh token (cookie httpOnly).
 * Devuelve true solo si el servidor emitió cookies nuevas.
 */
async function tryRefresh() {
  const res = await fetch(`${API_URL}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  return res.ok;
}

/**
 * Cliente HTTP centralizado.
 * - Envía siempre credentials: 'include' para que viajen las cookies de sesión.
 * - Ante un 401 intenta renovar la sesión UNA vez (access token expirado pero
 *   refresh token válido) y reintenta la petición original.
 * - Los endpoints de auth (login/register) no se reintentan: su 401 significa
 *   "credenciales inválidas", no "token expirado".
 */
export async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const isAuthEndpoint = path.includes('/api/auth/login') || path.includes('/api/auth/register');
  if (res.status === 401 && !isAuthEndpoint && !options.retried) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return apiFetch(path, { ...options, retried: true });
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed with status ${res.status}`);
  }

  return res.json();
}
