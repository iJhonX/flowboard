import mongoose from 'mongoose';

/**
 * Notificaciones in-app (Fase 7): se generan al asignar una tarjeta o
 * mencionar a alguien (@email) en un comentario. `message` va ya armado en
 * español al crearla (igual que `activity_log`) en vez de guardar solo
 * datos crudos y formatear en el cliente — evita duplicar esa lógica de
 * formato entre backend y frontend.
 *
 * `board_id`/`related_card_id` dejan que el frontend arme un link directo
 * al tablero/tarjeta en cuestión al hacer click en la notificación.
 */
const notificationSchema = new mongoose.Schema({
  user_id: { type: Number, required: true, index: true },
  type: { type: String, required: true, enum: ['assignment', 'mention'] },
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  board_id: { type: Number, required: true },
  related_card_id: { type: Number, required: true },
  created_at: { type: Date, default: Date.now },
});

export const Notification = mongoose.model('Notification', notificationSchema, 'notifications');
