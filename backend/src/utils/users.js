import { pool } from '../config/postgres.js';

/** Nombre de un usuario por id, para desnormalizar en documentos de Mongo. */
export async function getUserName(userId) {
  const { rows } = await pool.query('SELECT name FROM users WHERE id = $1', [userId]);
  return rows[0]?.name ?? 'Usuario eliminado';
}
