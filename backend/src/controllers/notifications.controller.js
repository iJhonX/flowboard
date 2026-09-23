import { Notification } from '../models/notification.model.js';

const PAGE_SIZE = 20;

/**
 * GET /api/notifications — notificaciones del usuario autenticado, paginadas
 * por cursor (Fase 8: es la única colección de la app sin techo natural —
 * un usuario activo puede acumular cientos con el tiempo, a diferencia de
 * comentarios/actividad que están acotados por tablero).
 *
 * Cursor en vez de offset (`?page=2`): con un `SKIP` grande Mongo igual
 * recorre todos los documentos saltados, y si llegan notificaciones nuevas
 * entre página y página un offset se desincroniza (se repiten o se saltan
 * filas). `?before=<ISO date>` evita ambos problemas — solo pide "lo que es
 * más viejo que la última que ya tengo".
 */
export async function listNotifications(req, res, next) {
  const { before } = req.query;

  try {
    const query = { user_id: req.userId };
    if (before) {
      const beforeDate = new Date(before);
      if (Number.isNaN(beforeDate.getTime())) {
        return res.status(400).json({ error: 'El parámetro "before" debe ser una fecha válida' });
      }
      query.created_at = { $lt: beforeDate };
    }

    // Se piden PAGE_SIZE + 1 para saber si hay más sin una segunda consulta
    // (count aparte, más caro): si vuelven PAGE_SIZE + 1, hay más páginas.
    const rows = await Notification.find(query)
      .sort({ created_at: -1 })
      .limit(PAGE_SIZE + 1)
      .lean();

    const hasMore = rows.length > PAGE_SIZE;
    res.json({ notifications: rows.slice(0, PAGE_SIZE), hasMore });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/notifications/mark-read — marca TODAS las notificaciones no
 * leídas del usuario como leídas. Una sola acción "masiva" en vez de un
 * endpoint por notificación individual: el frontend la dispara al abrir la
 * campanita (mismo patrón que Trello/Slack — abrir el panel = visto).
 */
export async function markAllRead(req, res, next) {
  try {
    await Notification.updateMany({ user_id: req.userId, read: false }, { $set: { read: true } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
