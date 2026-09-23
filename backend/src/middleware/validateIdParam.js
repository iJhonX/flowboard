/**
 * Middleware genérico de validación de parámetros de ruta numéricos (Fase 8).
 * Antes de esta fase cada middleware/controlador que necesitaba un :id
 * (requireTeamMember, requireBoardMember, requireCardInBoard, reorderCard...)
 * repetía el mismo `Number.isInteger(...) || 400` a mano — y dos rutas
 * (`columnId` en update/deleteColumn, `cardId` en update/deleteCard) directamente
 * no lo tenían, así que un id no numérico llegaba crudo a una consulta SQL y
 * Postgres lo rechazaba con un error de sintaxis (500 con mensaje de la DB,
 * no un 400 limpio).
 *
 * Uso: router.get('/boards/:boardId', validateIdParam('boardId'), getBoard)
 * Deja `req.params[paramName]` ya convertido a Number (antes era siempre
 * string, como cualquier param de Express) para que el controlador no tenga
 * que volver a parsearlo.
 */
export function validateIdParam(paramName) {
  return (req, res, next) => {
    const value = Number(req.params[paramName]);
    if (!Number.isInteger(value) || value <= 0) {
      return res.status(400).json({ error: `${paramName} inválido` });
    }
    req.params[paramName] = value;
    next();
  };
}
