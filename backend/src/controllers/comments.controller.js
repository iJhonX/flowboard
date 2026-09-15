import { Comment } from '../models/comment.model.js';
import { getUserName } from '../utils/users.js';
import { logActivity } from '../utils/activityLog.js';
import { emitToBoard } from '../sockets/index.js';

/** GET /api/boards/:boardId/cards/:cardId/comments */
export async function listComments(req, res, next) {
  try {
    const comments = await Comment.find({ card_id: req.card.id }).sort({ created_at: 1 }).lean();
    res.json({ comments });
  } catch (err) {
    next(err);
  }
}

/** POST /api/boards/:boardId/cards/:cardId/comments */
export async function createComment(req, res, next) {
  const { text } = req.body;

  try {
    const userName = await getUserName(req.userId);
    const comment = await Comment.create({
      card_id: req.card.id,
      user_id: req.userId,
      user_name: userName,
      text,
    });

    // Best-effort, no bloquea la respuesta si falla (ver activityLog.js)
    logActivity({
      boardId: req.board.id,
      userId: req.userId,
      userName,
      actionType: 'comment_created',
      metadata: { cardId: req.card.id, cardTitle: req.card.title, preview: text.slice(0, 80) },
    });

    emitToBoard(req.board.id, 'comment:created', {
      boardId: req.board.id,
      cardId: req.card.id,
      comment,
    });

    res.status(201).json({ comment });
  } catch (err) {
    next(err);
  }
}
