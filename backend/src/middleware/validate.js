/**
 * Middleware de validación con Zod.
 * Uso: router.post('/register', validate(registerSchema), controller)
 * Si falla la validación responde 400 con un mensaje legible;
 * si pasa, deja en req.body los datos ya validados y normalizados.
 */
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      return res.status(400).json({ error: messages.join(' ') });
    }
    req.body = result.data;
    next();
  };
}
