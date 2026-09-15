import mongoose from 'mongoose';

/**
 * Comentarios de una tarjeta. `card_id`/`user_id` son ids numéricos de
 * PostgreSQL, no ObjectId de Mongo — no hay FK real entre ambas bases, así
 * que la integridad referencial (p. ej. borrar los comentarios de una
 * tarjeta eliminada) se maneja a mano desde boards.controller.js.
 *
 * `user_name` va desnormalizado en el propio documento: como las dos bases
 * no se pueden unir con un JOIN, listar comentarios sin esto exigiría una
 * consulta extra a Postgres (o N+1) solo para mostrar el autor. Se guarda
 * el nombre tal como era al comentar; si el usuario cambia su nombre después
 * los comentarios viejos no se actualizan (trade-off aceptado, igual que
 * hace cualquier feed de actividad/auditoría).
 */
const commentSchema = new mongoose.Schema({
  card_id: { type: Number, required: true, index: true },
  user_id: { type: Number, required: true },
  user_name: { type: String, required: true },
  text: { type: String, required: true, trim: true, maxlength: 2000 },
  created_at: { type: Date, default: Date.now },
});

export const Comment = mongoose.model('Comment', commentSchema, 'comments');
