import { pool } from '../config/postgres.js';
import { emitToBoard } from '../sockets/index.js';
import { logActivity } from '../utils/activityLog.js';
import { notifyUser } from '../utils/notifications.js';
import { getUserName } from '../utils/users.js';
import { Comment } from '../models/comment.model.js';
import { ActivityLog } from '../models/activityLog.model.js';

/**
 * GET /api/boards/:boardId — tablero con sus columnas y, dentro, sus
 * tarjetas. Cada tarjeta lleva `comment_count` (de Mongo): como Postgres no
 * puede hacer un JOIN contra otra base, se resuelve con un `$group` aparte
 * sobre los ids de tarjetas ya cargados y se combina en memoria — el mismo
 * patrón de "componer entre las dos bases en la capa de aplicación" que ya
 * se usa para borrar comentarios en cascada (ver deleteCard/deleteColumn).
 */
export async function getBoard(req, res, next) {
  try {
    const boardId = req.board.id;

    const [boardRes, columnsRes, cardsRes, teamMembersRes] = await Promise.all([
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
      // Para el selector de "asignar a": quién se puede asignar a una
      // tarjeta de este tablero es quien sea miembro de su equipo dueño.
      pool.query(
        `SELECT u.id, u.name
         FROM team_members tm JOIN users u ON u.id = tm.user_id
         WHERE tm.team_id = $1
         ORDER BY u.name`,
        [req.board.team_id]
      ),
    ]);

    const cardIds = cardsRes.rows.map((card) => card.id);
    const [commentCounts, assigneesRes] = await Promise.all([
      cardIds.length > 0
        ? Comment.aggregate([
            { $match: { card_id: { $in: cardIds } } },
            { $group: { _id: '$card_id', count: { $sum: 1 } } },
          ])
        : Promise.resolve([]),
      cardIds.length > 0
        ? pool.query(
            `SELECT ca.card_id, u.id, u.name
             FROM card_assignees ca
             JOIN users u ON u.id = ca.user_id
             WHERE ca.card_id = ANY($1::int[])
             ORDER BY ca.assigned_at`,
            [cardIds]
          )
        : Promise.resolve({ rows: [] }),
    ]);
    const countByCardId = new Map(commentCounts.map((c) => [c._id, c.count]));
    const assigneesByCardId = new Map();
    for (const row of assigneesRes.rows) {
      const list = assigneesByCardId.get(row.card_id) ?? [];
      list.push({ id: row.id, name: row.name });
      assigneesByCardId.set(row.card_id, list);
    }

    const columns = columnsRes.rows.map((column) => ({ ...column, cards: [] }));
    const cardsByColumn = new Map(columns.map((column) => [column.id, column.cards]));
    for (const card of cardsRes.rows) {
      cardsByColumn.get(card.column_id)?.push({
        ...card,
        comment_count: countByCardId.get(card.id) ?? 0,
        assignees: assigneesByCardId.get(card.id) ?? [],
      });
    }

    res.json({
      board: boardRes.rows[0],
      columns,
      myRole: req.membershipRole,
      teamMembers: teamMembersRes.rows,
    });
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
    logActivity({
      boardId: req.board.id,
      userId: req.userId,
      actionType: 'column_created',
      metadata: { columnId: column.id, columnName: column.name },
    });
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
    logActivity({
      boardId: req.board.id,
      userId: req.userId,
      actionType: 'column_updated',
      metadata: { columnId: column.id, columnName: column.name },
    });
    res.json({ column });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/boards/:boardId/columns/:columnId — borra la columna y sus
 * tarjetas (CASCADE en Postgres). Los comentarios de esas tarjetas viven en
 * Mongo, que no sabe nada de ese CASCADE: hay que borrarlos a mano o quedan
 * huérfanos. Por eso se leen los ids de las tarjetas ANTES del DELETE (una
 * vez borrada la columna ya no hay forma de recuperarlos).
 */
export async function deleteColumn(req, res, next) {
  try {
    const { rows: cardRows } = await pool.query('SELECT id FROM cards WHERE column_id = $1', [
      req.params.columnId,
    ]);

    const {
      rows: [column],
    } = await pool.query('DELETE FROM columns WHERE id = $1 AND board_id = $2 RETURNING id, name', [
      req.params.columnId,
      req.board.id,
    ]);
    if (!column) {
      return res.status(404).json({ error: 'Columna no encontrada en este tablero' });
    }

    if (cardRows.length > 0) {
      Comment.deleteMany({ card_id: { $in: cardRows.map((r) => r.id) } }).catch((err) =>
        console.error('No se pudieron borrar los comentarios de la columna eliminada:', err)
      );
    }

    emitToBoard(req.board.id, 'column:deleted', {
      boardId: req.board.id,
      columnId: column.id,
      actorUserId: req.userId,
    });
    logActivity({
      boardId: req.board.id,
      userId: req.userId,
      actionType: 'column_deleted',
      metadata: { columnId: column.id, columnName: column.name },
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
    logActivity({
      boardId: req.board.id,
      userId: req.userId,
      actionType: 'card_created',
      metadata: { cardId: card.id, title: card.title },
    });
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
    logActivity({
      boardId: req.board.id,
      userId: req.userId,
      actionType: 'card_updated',
      metadata: { cardId: card.id, title: card.title },
    });
    res.json({ card });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/boards/:boardId/cards/:cardId — borra también sus comentarios en Mongo (ver deleteColumn). */
export async function deleteCard(req, res, next) {
  try {
    const {
      rows: [card],
    } = await pool.query(
      `DELETE FROM cards
       WHERE id = $1
         AND column_id IN (SELECT id FROM columns WHERE board_id = $2)
       RETURNING id, title`,
      [req.params.cardId, req.board.id]
    );
    if (!card) {
      return res.status(404).json({ error: 'Tarjeta no encontrada en este tablero' });
    }

    Comment.deleteMany({ card_id: card.id }).catch((err) =>
      console.error('No se pudieron borrar los comentarios de la tarjeta eliminada:', err)
    );

    emitToBoard(req.board.id, 'card:deleted', {
      boardId: req.board.id,
      cardId: card.id,
      actorUserId: req.userId,
    });
    logActivity({
      boardId: req.board.id,
      userId: req.userId,
      actionType: 'card_deleted',
      metadata: { cardId: card.id, title: card.title },
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
  const cardId = req.params.cardId;

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // La tarjeta debe pertenecer a ESTE tablero
    const {
      rows: [card],
    } = await client.query(
      `SELECT id, title, column_id AS old_column_id
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
    logActivity({
      boardId: req.board.id,
      userId: req.userId,
      actionType: 'card_moved',
      metadata: { cardId, title: card.title },
    });
    res.json({ ok: true });
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client?.release();
  }
}

/**
 * DELETE /api/boards/:boardId — borra el tablero completo (CASCADE en
 * Postgres se lleva columnas/tarjetas/asignaciones). Restringido a
 * owner/admin por requireRole en la ruta (Fase 7).
 *
 * Cascada manual a Mongo: se borran los comentarios de TODAS las tarjetas
 * del tablero (igual razón que deleteColumn: quedarían huérfanos) y
 * también el activity_log del tablero — a diferencia del borrado de una
 * tarjeta suelta, acá el tablero entero deja de ser accesible, así que su
 * historial de actividad ya no tiene dónde mostrarse. Las notificaciones
 * NO se tocan: son la bandeja personal de cada usuario, no una vista de
 * este tablero, y "fulano te mencionó" sigue siendo un registro válido
 * aunque el link ya no lleve a ningún lado.
 */
export async function deleteBoard(req, res, next) {
  try {
    const { rows: cardRows } = await pool.query(
      `SELECT id FROM cards WHERE column_id IN (SELECT id FROM columns WHERE board_id = $1)`,
      [req.board.id]
    );

    const { rowCount } = await pool.query('DELETE FROM boards WHERE id = $1', [req.board.id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Tablero no encontrado' });
    }

    if (cardRows.length > 0) {
      Comment.deleteMany({ card_id: { $in: cardRows.map((r) => r.id) } }).catch((err) =>
        console.error('No se pudieron borrar los comentarios del tablero eliminado:', err)
      );
    }
    ActivityLog.deleteMany({ board_id: req.board.id }).catch((err) =>
      console.error('No se pudo borrar el activity_log del tablero eliminado:', err)
    );

    emitToBoard(req.board.id, 'board:deleted', { boardId: req.board.id, actorUserId: req.userId });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/boards/:boardId/cards/:cardId/assignees — asigna un miembro del
 * equipo a la tarjeta. Cualquier miembro puede asignar (no está restringido
 * por rol): asignar tareas es parte de trabajar con el tablero, no una
 * acción administrativa, igual que crear tarjetas.
 */
export async function assignCard(req, res, next) {
  const { user_id: assigneeId } = req.body;

  try {
    const {
      rows: [teamMember],
    } = await pool.query(
      `SELECT u.name FROM team_members tm JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = $1 AND tm.user_id = $2`,
      [req.board.team_id, assigneeId]
    );
    if (!teamMember) {
      return res.status(400).json({ error: 'Ese usuario no es miembro del equipo del tablero' });
    }

    const {
      rows: [assignment],
    } = await pool.query(
      `INSERT INTO card_assignees (card_id, user_id) VALUES ($1, $2)
       ON CONFLICT (card_id, user_id) DO NOTHING
       RETURNING card_id, user_id`,
      [req.card.id, assigneeId]
    );
    if (!assignment) {
      return res.status(409).json({ error: 'Ese usuario ya está asignado a esta tarjeta' });
    }

    emitToBoard(req.board.id, 'card:assigned', {
      boardId: req.board.id,
      cardId: req.card.id,
      user: { id: assigneeId, name: teamMember.name },
      actorUserId: req.userId,
    });
    logActivity({
      boardId: req.board.id,
      userId: req.userId,
      actionType: 'card_assigned',
      metadata: { cardId: req.card.id, title: req.card.title, assigneeName: teamMember.name },
    });

    if (assigneeId !== req.userId) {
      const actorName = await getUserName(req.userId);
      notifyUser({
        userId: assigneeId,
        type: 'assignment',
        message: `${actorName} te asignó a la tarjeta "${req.card.title}"`,
        boardId: req.board.id,
        cardId: req.card.id,
      });
    }

    res.status(201).json({ assignee: { id: assigneeId, name: teamMember.name } });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/boards/:boardId/cards/:cardId/assignees/:userId — quita un asignado. */
export async function unassignCard(req, res, next) {
  const assigneeId = req.params.userId;

  try {
    const { rowCount } = await pool.query(
      'DELETE FROM card_assignees WHERE card_id = $1 AND user_id = $2',
      [req.card.id, assigneeId]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Ese usuario no está asignado a esta tarjeta' });
    }

    emitToBoard(req.board.id, 'card:unassigned', {
      boardId: req.board.id,
      cardId: req.card.id,
      userId: assigneeId,
      actorUserId: req.userId,
    });
    logActivity({
      boardId: req.board.id,
      userId: req.userId,
      actionType: 'card_unassigned',
      metadata: { cardId: req.card.id, title: req.card.title },
    });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
