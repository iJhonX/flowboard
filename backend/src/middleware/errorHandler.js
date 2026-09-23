// Códigos de error de Postgres que vale la pena traducir a un 400/409 claro
// en vez de dejarlos caer como 500 genérico con el texto crudo de la DB.
// La validación con Zod y los checks de la capa de rutas (Fase 8) ya
// deberían atajar casi todos estos casos antes de llegar a la base — esto
// es una red de seguridad adicional, no la línea principal de defensa.
const PG_ERROR_STATUS = {
  23505: 409, // unique_violation
  23503: 400, // foreign_key_violation
  23502: 400, // not_null_violation
  '22P02': 400, // invalid_text_representation (p. ej. un id no numérico que se coló)
  22007: 400, // invalid_datetime_format
};

/**
 * Middleware de errores centralizado (Fase 8). Dos reglas:
 * 1. Errores esperados (4xx, con un mensaje ya pensado para el usuario por
 *    `validate.js` o los controladores) exponen ese mensaje tal cual.
 * 2. Errores inesperados (500: un bug, la DB caída, etc.) NUNCA exponen
 *    `err.message` ni el stack al cliente — pueden contener detalles
 *    internos (nombres de tabla, fragmentos de SQL, rutas de archivo). Se
 *    loguean completos en el servidor (`console.error`) para poder
 *    diagnosticarlos, pero el cliente solo ve un mensaje genérico.
 */
export function errorHandler(err, req, res, _next) {
  console.error(err);

  // JSON malformado en el body: express.json() ya marca err.status = 400,
  // pero su mensaje por defecto ("Unexpected token o in JSON at position 1")
  // no es algo que un consumidor de la API pueda entender sin ver el stack.
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo de la petición no es JSON válido' });
  }

  if (err.code && PG_ERROR_STATUS[err.code]) {
    return res
      .status(PG_ERROR_STATUS[err.code])
      .json({ error: 'Los datos enviados no son válidos' });
  }

  const status = err.status ?? 500;
  const message = status >= 500 ? 'Error interno del servidor' : (err.message ?? 'Error interno del servidor');
  res.status(status).json({ error: message });
}
