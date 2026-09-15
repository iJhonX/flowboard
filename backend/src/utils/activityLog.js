import { ActivityLog } from '../models/activityLog.model.js';
import { getUserName } from './users.js';

/**
 * Registra una entrada de actividad. Se llama desde los controladores de
 * tablero justo después de que la mutación en Postgres ya se confirmó, y
 * deliberadamente NO se espera su resultado desde el caller (ver
 * boards.controller.js): un fallo al escribir en Mongo no debe tumbar una
 * mutación que ya tuvo éxito en la base relacional. Por eso esta función
 * nunca lanza — cualquier error se registra en consola y se traga aquí.
 *
 * `userName` es opcional: si el caller ya lo resolvió (p. ej. al crear un
 * comentario, donde también se necesita para el propio documento) se puede
 * pasar para evitar una segunda consulta a Postgres.
 */
export async function logActivity({ boardId, userId, userName, actionType, metadata = {} }) {
  try {
    const name = userName ?? (await getUserName(userId));
    await ActivityLog.create({
      board_id: boardId,
      user_id: userId,
      user_name: name,
      action_type: actionType,
      metadata,
    });
  } catch (err) {
    console.error('No se pudo registrar actividad:', err);
  }
}
