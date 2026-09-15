import { ActivityLog } from '../models/activityLog.model.js';

/** GET /api/boards/:boardId/activity — últimas 50 acciones del tablero. */
export async function listActivity(req, res, next) {
  try {
    const activity = await ActivityLog.find({ board_id: req.board.id })
      .sort({ created_at: -1 })
      .limit(50)
      .lean();
    res.json({ activity });
  } catch (err) {
    next(err);
  }
}
