import { pool } from '../config/postgres.js';

/** GET /api/boards/:boardId — tablero con sus columnas y, dentro, sus tarjetas. */
export async function getBoard(req, res, next) {
  try {
    const boardId = req.board.id;

    const [boardRes, columnsRes, cardsRes] = await Promise.all([
      pool.query('SELECT * FROM boards WHERE id = $1', [boardId]),
      pool.query('SELECT * FROM columns WHERE board_id = $1 ORDER BY position, id', [boardId]),
      pool.query(
        `SELECT id, column_id, title, description,
                to_char(due_date, 'YYYY-MM-DD') AS due_date,
                position, created_by, created_at, updated_at
         FROM cards
         WHERE column_id IN (SELECT id FROM columns WHERE board_id = $1)
         ORDER BY position, id`,
        [boardId]
      ),
    ]);

    const columns = columnsRes.rows.map((column) => ({ ...column, cards: [] }));
    const cardsByColumn = new Map(columns.map((column) => [column.id, column.cards]));
    for (const card of cardsRes.rows) {
      cardsByColumn.get(card.column_id)?.push(card);
    }

    res.json({ board: boardRes.rows[0], columns });
  } catch (err) {
    next(err);
  }
}

/** POST /api/boards/:boardId/columns — nueva columna al final (posición máxima + 1). */
export async function createColumn(req, res, next) {
  const { name } = req.body;

  try {
    const {
      rows: [column],
    } = await pool.query(
      `INSERT INTO columns (board_id, name, position)
       SELECT $1, $2, COALESCE(MAX(position), -1) + 1
       FROM columns WHERE board_id = $1
       RETURNING *`,
      [req.board.id, name]
    );
    res.status(201).json({ column });
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/boards/:boardId/columns/:columnId — renombrar columna. */
export async function updateColumn(req, res, next) {
  const { name } = req.body;

  try {
    const {
      rows: [column],
    } = await pool.query(
      'UPDATE columns SET name = $3 WHERE id = $1 AND board_id = $2 RETURNING *',
      [req.params.columnId, req.board.id, name]
    );
    if (!column) {
      return res.status(404).json({ error: 'Columna no encontrada en este tablero' });
    }
    res.json({ column });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/boards/:boardId/columns/:columnId — borra la columna y sus tarjetas (CASCADE). */
export async function deleteColumn(req, res, next) {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM columns WHERE id = $1 AND board_id = $2',
      [req.params.columnId, req.board.id]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Columna no encontrada en este tablero' });
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

/** POST /api/boards/:boardId/cards — nueva tarjeta al final de su columna.
 *  INSERT ... SELECT atómico: la comprobación de que la columna pertenece a
 *  este tablero y el INSERT se hacen en una sola sentencia, sin ventana TOCTOU
 *  (si la columna se borra a la vez, el SELECT no devuelve filas -> 400). */
export async function createCard(req, res, next) {
  const { column_id, title, description, due_date } = req.body;

  try {
    const {
      rows: [card],
    } = await pool.query(
      `INSERT INTO cards (column_id, title, description, due_date, position, created_by)
       SELECT c.id, $2, $3, $4,
              COALESCE((SELECT MAX(position) FROM cards WHERE column_id = c.id), -1) + 1,
              $5
       FROM columns c
       WHERE c.id = $1 AND c.board_id = $6
       RETURNING id, column_id, title, description,
                 to_char(due_date, 'YYYY-MM-DD') AS due_date,
                 position, created_by, created_at, updated_at`,
      [column_id, title, description, due_date ?? null, req.userId, req.board.id]
    );

    if (!card) {
      return res.status(400).json({ error: 'La columna no pertenece a este tablero' });
    }
    res.status(201).json({ card });
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/boards/:boardId/cards/:cardId — editar tarjeta (reemplazo completo de campos editables). */
export async function updateCard(req, res, next) {
  const { title, description, due_date } = req.body;

  try {
    const {
      rows: [card],
    } = await pool.query(
      `UPDATE cards
       SET title = $3, description = $4, due_date = $5, updated_at = NOW()
       WHERE id = $1
         AND column_id IN (SELECT id FROM columns WHERE board_id = $2)
       RETURNING id, column_id, title, description,
                 to_char(due_date, 'YYYY-MM-DD') AS due_date,
                 position, created_by, created_at, updated_at`,
      [req.params.cardId, req.board.id, title, description, due_date ?? null]
    );
    if (!card) {
      return res.status(404).json({ error: 'Tarjeta no encontrada en este tablero' });
    }
    res.json({ card });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/boards/:boardId/cards/:cardId */
export async function deleteCard(req, res, next) {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM cards
       WHERE id = $1
         AND column_id IN (SELECT id FROM columns WHERE board_id = $2)`,
      [req.params.cardId, req.board.id]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Tarjeta no encontrada en este tablero' });
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
