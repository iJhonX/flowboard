import jwt from 'jsonwebtoken';

// Nombres y duraciones de las cookies de sesión
export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutos
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

/**
 * Opciones comunes para las cookies de sesión.
 * httpOnly: el token nunca es legible desde JS del navegador (protege contra XSS).
 * secure: solo se envía por HTTPS — en desarrollo local (http) debe ser false.
 * sameSite: en desarrollo 'lax' (frontend y backend son localhost, mismo sitio).
 *   En producción el frontend (Vercel) y el backend (Railway) viven en dominios
 *   distintos, así que las peticiones fetch son cross-site y 'lax' haría que el
 *   navegador NO enviara la cookie: se usa 'none' (que exige secure: true).
 *   Al aflojar sameSite se pierde la protección CSRF que daba 'lax'; se compensa
 *   con CORS restringido a CLIENT_URL y con que toda mutación es JSON
 *   (Content-Type: application/json fuerza preflight, que un formulario
 *   cross-site no puede pasar).
 */
const isProduction = process.env.NODE_ENV === 'production';

function getCookieOptions(maxAgeMs) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
    maxAge: maxAgeMs,
  };
}

export function signAccessToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL_MS / 1000,
  });
}

export function signRefreshToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_TTL_MS / 1000,
  });
}

export function verifyToken(token, secret) {
  return jwt.verify(token, secret);
}

/** Establece ambas cookies de sesión en la respuesta. */
export function setAuthCookies(res, userId) {
  res.cookie(ACCESS_TOKEN_COOKIE, signAccessToken(userId), getCookieOptions(ACCESS_TOKEN_TTL_MS));
  res.cookie(REFRESH_TOKEN_COOKIE, signRefreshToken(userId), getCookieOptions(REFRESH_TOKEN_TTL_MS));
}

/** Elimina ambas cookies de sesión (logout). */
export function clearAuthCookies(res) {
  res.clearCookie(ACCESS_TOKEN_COOKIE, getCookieOptions(0));
  res.clearCookie(REFRESH_TOKEN_COOKIE, getCookieOptions(0));
}
