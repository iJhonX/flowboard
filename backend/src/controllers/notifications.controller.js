import { Notification } from '../models/notification.model.js';

/** GET /api/notifications — últimas 30 notificaciones del usuario autenticado. */
export async function listNotifications(req, res, next) {
  try {
    const notifications = await Notification.find({ user_id: req.userId })
      .sort({ created_at: -1 })
      .limit(30)
      .lean();
    res.json({ notifications });
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
