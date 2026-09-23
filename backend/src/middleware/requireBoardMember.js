import { pool } from '../config/postgres.js';

/**
 * Devuelve el tablero (con `membership_role` del usuario en el equipo dueño)
 * si `userId` es miembro, o `null` si no. Extraído como función
 * independiente para poder reutilizar la misma comprobación de membresía
 * desde fuera de Express (sockets/index.js).
 */
export async function findBoardIfMember(userId, boardId) {
  const { rows } = await pool.query(
    `SELECT b.*, tm.role AS membership_role
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
 *
 * Requiere que la ruta ya haya pasado por validateIdParam('boardId').
 */
export async function requireBoardMember(req, res, next) {
  const boardId = req.params.boardId;

  try {
    const board = await findBoardIfMember(req.userId, boardId);
    if (!board) {
      return res.status(404).json({ error: 'Tablero no encontrado o no eres miembro del equipo' });
    }

    req.board = board;
    req.membershipRole = board.membership_role;
    next();
  } catch (err) {
    next(err);
  }
}
