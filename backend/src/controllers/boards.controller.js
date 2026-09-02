import { pool } from '../config/postgres.js';
import { emitToBoard } from '../sockets/index.js';

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
    emitToBoard(req.board.id, 'column:created', { boardId: req.board.id, column, actorUserId: req.userId });
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
    emitToBoard(req.board.id, 'column:updated', { boardId: req.board.id, column, actorUserId: req.userId });
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
    emitToBoard(req.board.id, 'column:deleted', {
      boardId: req.board.id,
      columnId: Number(req.params.columnId),
      actorUserId: req.userId,
    });
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
    emitToBoard(req.board.id, 'card:created', { boardId: req.board.id, card, actorUserId: req.userId });
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
    emitToBoard(req.board.id, 'card:updated', { boardId: req.board.id, card, actorUserId: req.userId });
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
    emitToBoard(req.board.id, 'card:deleted', {
      boardId: req.board.id,
      cardId: Number(req.params.cardId),
      actorUserId: req.userId,
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/boards/:boardId/cards/:cardId/position — mueve una tarjeta a la
 * columna e índice indicados y persiste el nuevo orden.
 *
 * Estrategia: el orden destino se calcula en JS (quitar la tarjeta y
 * reinsertarla en el índice destino, 0..n-1) y se persiste reindexando cada
 * columna afectada con un único UPDATE + unnest. Así NO hay empates de
 * position ni desempates por id: el orden guardado es exactamente el pedido.
 *
 * Concurrencia: se bloquean (FOR UPDATE) todas las tarjetas de las columnas
 * afectadas en orden ascendente de id — evita deadlocks entre
 * reordenamientos concurrentes de la misma columna.
 */
export async function reorderCard(req, res, next) {
  const { column_id, position } = req.body;
  const cardId = Number(req.params.cardId);
  if (!Number.isInteger(cardId) || cardId <= 0) {
    return res.status(400).json({ error: 'ID de tarjeta inválido' });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // La tarjeta debe pertenecer a ESTE tablero
    const {
      rows: [card],
    } = await client.query(
      `SELECT id, column_id AS old_column_id
       FROM cards
       WHERE id = $1 AND column_id IN (SELECT id FROM columns WHERE board_id = $2)
       FOR UPDATE`,
      [cardId, req.board.id]
    );
    if (!card) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Tarjeta no encontrada en este tablero' });
    }

    // La columna destino debe pertenecer a ESTE tablero
    const {
      rows: [column],
    } = await client.query('SELECT id FROM columns WHERE id = $1 AND board_id = $2', [
      column_id,
      req.board.id,
    ]);
    if (!column) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'La columna no pertenece a este tablero' });
    }

    // Bloquear todas las tarjetas de ambas columnas en orden de id
    await client.query(
      'SELECT id FROM cards WHERE column_id IN ($1, $2) ORDER BY id FOR UPDATE',
      [card.old_column_id, column_id]
    );

    // Orden actual de cada columna afectada
    const [sourceRes, targetRes] = await Promise.all([
      client.query('SELECT id FROM cards WHERE column_id = $1 ORDER BY position, id', [
        card.old_column_id,
      ]),
      client.query('SELECT id FROM cards WHERE column_id = $1 ORDER BY position, id', [column_id]),
    ]);
    const sourceIds = sourceRes.rows.map((r) => r.id);
    const targetIds = targetRes.rows.map((r) => r.id);

    // Calcular el nuevo orden en JS
    let newSourceIds;
    let newTargetIds;
    if (card.old_column_id === column_id) {
      const without = sourceIds.filter((id) => id !== cardId);
      const targetIndex = Math.min(Math.max(position, 0), without.length);
      newSourceIds = [...without.slice(0, targetIndex), cardId, ...without.slice(targetIndex)];
      newTargetIds = newSourceIds;
    } else {
      const targetIndex = Math.min(Math.max(position, 0), targetIds.length);
      newSourceIds = sourceIds.filter((id) => id !== cardId);
      newTargetIds = [...targetIds.slice(0, targetIndex), cardId, ...targetIds.slice(targetIndex)];
    }

    // Reindexar una columna: UPDATE único con unnest(id, new_pos)
    const reindex = async (columnId, orderedIds) => {
      if (orderedIds.length === 0) return;
      await client.query(
        `UPDATE cards SET position = u.new_pos
         FROM unnest($1::int[], $2::int[]) AS u(id, new_pos)
         WHERE cards.id = u.id`,
        [orderedIds, orderedIds.map((_, index) => index)]
      );
    };

    if (card.old_column_id !== column_id) {
      await client.query(
        'UPDATE cards SET column_id = $1, updated_at = NOW() WHERE id = $2',
        [column_id, cardId]
      );
    }
    await reindex(card.old_column_id, newSourceIds);
    if (card.old_column_id !== column_id) {
      await reindex(column_id, newTargetIds);
    }

    await client.query('COMMIT');
    emitToBoard(req.board.id, 'card:moved', {
      boardId: req.board.id,
      cardId,
      columnId: column_id,
      position,
      actorUserId: req.userId,
    });
    res.json({ ok: true });
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client?.release();
  }
}
