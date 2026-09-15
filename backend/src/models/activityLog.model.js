import mongoose from 'mongoose';

/**
 * Log de actividad por tablero: una entrada por acción relevante (columna o
 * tarjeta creada/editada/borrada/movida, comentario agregado). `metadata` es
 * deliberadamente `Mixed` (sin esquema fijo) porque cada `action_type` guarda
 * datos distintos (p. ej. `card_moved` no necesita título, `comment_created`
 * sí) — forzar esto en Postgres pediría columnas nulas según la acción; en
 * Mongo es natural. Nunca se borra en cascada cuando su tarjeta/columna se
 * elimina: es un historial, no una vista en vivo del estado actual.
 */
const activityLogSchema = new mongoose.Schema({
  board_id: { type: Number, required: true, index: true },
  user_id: { type: Number, required: true },
  user_name: { type: String, required: true },
  action_type: { type: String, required: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  created_at: { type: Date, default: Date.now },
});

export const ActivityLog = mongoose.model('ActivityLog', activityLogSchema, 'activity_log');
