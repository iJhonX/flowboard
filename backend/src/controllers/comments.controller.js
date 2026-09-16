import { pool } from '../config/postgres.js';
import { Comment } from '../models/comment.model.js';
import { getUserName } from '../utils/users.js';
import { logActivity } from '../utils/activityLog.js';
import { notifyUser } from '../utils/notifications.js';
import { extractMentionedEmails } from '../utils/mentions.js';
import { emitToBoard } from '../sockets/index.js';

/**
 * Resuelve los @email mencionados en un comentario contra los miembros del
 * equipo del tablero (así no se puede notificar a alguien ajeno al equipo
 * solo por conocer su email) y notifica a cada uno, salvo que se
 * mencionen a sí mismos. Best-effort: un fallo acá no debe tumbar la
 * creación del comentario, que ya se guardó.
 */
async function notifyMentionedUsers({ text, authorId, authorName, board, card }) {
  const mentionedEmails = extractMentionedEmails(text);
  if (mentionedEmails.length === 0) return;

  try {
    const { rows: mentionedUsers } = await pool.query(
      `SELECT u.id, u.email FROM team_members tm
       JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = $1 AND u.email = ANY($2::text[])`,
      [board.team_id, mentionedEmails]
    );

    for (const user of mentionedUsers) {
      if (user.id === authorId) continue;
      notifyUser({
        userId: user.id,
        type: 'mention',
        message: `${authorName} te mencionó en un comentario: "${text.slice(0, 80)}"`,
        boardId: board.id,
        cardId: card.id,
      });
    }
  } catch (err) {
    console.error('No se pudieron resolver las menciones del comentario:', err);
  }
}

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

    notifyMentionedUsers({
      text,
      authorId: req.userId,
      authorName: userName,
      board: req.board,
      card: req.card,
    });

    res.status(201).json({ comment });
  } catch (err) {
    next(err);
  }
}
