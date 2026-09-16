import { Notification } from '../models/notification.model.js';
import { emitToUser } from '../sockets/index.js';

/**
 * Crea una notificación y la empuja en vivo por socket al usuario
 * destinatario. Best-effort y nunca se espera (`await`) desde el caller
 * (mismo criterio que logActivity.js): un fallo al notificar no debe tumbar
 * la acción principal (asignar una tarjeta, comentar) que ya tuvo éxito.
 */
export async function notifyUser({ userId, type, message, boardId, cardId }) {
  try {
    const notification = await Notification.create({
      user_id: userId,
      type,
      message,
      board_id: boardId,
      related_card_id: cardId,
    });
    emitToUser(userId, 'notification:created', notification);
  } catch (err) {
    console.error('No se pudo crear la notificación:', err);
  }
}
