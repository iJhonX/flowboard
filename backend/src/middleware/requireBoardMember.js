import { pool } from '../config/postgres.js';

/**
 * Devuelve el tablero si `userId` es miembro del equipo dueño, o `null` si no.
 * Extraído como función independiente para poder reutilizar la misma
 * comprobación de membresía desde fuera de Express (sockets/index.js).
 */
export async function findBoardIfMember(userId, boardId) {
  const { rows } = await pool.query(
    `SELECT b.*
     FROM boards b
     JOIN teams t ON t.id = b.team_id
     JOIN team_members tm ON tm.team_id = t.id
     WHERE b.id = $1 AND tm.user_id = $2`,
    [boardId, userId]
  );
  return rows[0] ?? null;
}

/**
 * Resuelve el tablero del parámetro :boardId y verifica que el usuario
 * autenticado sea miembro del equipo al que pertenece el tablero.
 * Si lo es, deja req.board (fila del tablero).
 *
 * Igual que requireTeamMember: 404 (no 403) para no revelar la existencia
 * de tableros de equipos ajenos.
 */
export async function requireBoardMember(req, res, next) {
  const boardId = Number(req.params.boardId);
  if (!Number.isInteger(boardId) || boardId <= 0) {
    return res.status(400).json({ error: 'ID de tablero inválido' });
  }

  try {
    const board = await findBoardIfMember(req.userId, boardId);
    if (!board) {
      return res.status(404).json({ error: 'Tablero no encontrado o no eres miembro del equipo' });
    }

    req.board = board;
    next();
  } catch (err) {
    next(err);
  }
}
