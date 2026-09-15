import { pool } from '../config/postgres.js';

/** Devuelve la tarjeta si pertenece a `boardId`, o `null` si no. */
export async function findCardInBoard(cardId, boardId) {
  const { rows } = await pool.query(
    `SELECT c.*
     FROM cards c
     JOIN columns col ON col.id = c.column_id
     WHERE c.id = $1 AND col.board_id = $2`,
    [cardId, boardId]
  );
  return rows[0] ?? null;
}

/**
 * Igual que requireBoardMember pero un nivel más abajo: resuelve
 * :cardId y verifica que pertenece al tablero ya resuelto en req.board
 * (requireBoardMember debe ejecutarse antes). Deja req.card.
 */
export async function requireCardInBoard(req, res, next) {
  const cardId = Number(req.params.cardId);
  if (!Number.isInteger(cardId) || cardId <= 0) {
    return res.status(400).json({ error: 'ID de tarjeta inválido' });
  }

  try {
    const card = await findCardInBoard(cardId, req.board.id);
    if (!card) {
      return res.status(404).json({ error: 'Tarjeta no encontrada en este tablero' });
    }
    req.card = card;
    next();
  } catch (err) {
    next(err);
  }
}
