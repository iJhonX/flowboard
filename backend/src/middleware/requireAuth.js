import { ACCESS_TOKEN_COOKIE, verifyToken } from '../utils/tokens.js';

/**
 * Middleware de autenticación: verifica el access token en la cookie httpOnly.
 * Si es válido, deja req.userId disponible para el controlador.
 * Si falta o está vencido, responde 401 (el cliente puede intentar /auth/refresh).
 */
export function requireAuth(req, res, next) {
  const token = req.cookies?.[ACCESS_TOKEN_COOKIE];

  if (!token) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  try {
    const payload = verifyToken(token, process.env.JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: 'Sesión expirada o inválida' });
  }
}
