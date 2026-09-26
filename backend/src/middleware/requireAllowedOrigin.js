const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Defensa CSRF para producción, donde las cookies de sesión llevan
 * sameSite: 'none' (frontend y backend en dominios distintos, ver tokens.js).
 * Toda petición que cambia estado debe venir del origen del frontend: los
 * navegadores siempre envían el header Origin en peticiones cross-site, así
 * que un formulario en otro sitio no puede hacerse pasar por el cliente.
 * Peticiones sin Origin (curl, supertest, server-to-server) se permiten:
 * no son un vector CSRF, que requiere un navegador con las cookies de la víctima.
 */
export function requireAllowedOrigin(req, res, next) {
  const allowed = process.env.CLIENT_URL?.replace(/\/$/, '');
  const origin = req.headers.origin;

  if (SAFE_METHODS.has(req.method) || !allowed || !origin || origin === allowed) {
    return next();
  }
  return res.status(403).json({ error: 'Origen no permitido' });
}
