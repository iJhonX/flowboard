import { Router } from 'express';
import {
  getBoard,
  createColumn,
  updateColumn,
  deleteColumn,
  createCard,
  updateCard,
  deleteCard,
  reorderCard,
  deleteBoard,
  assignCard,
  unassignCard,
} from '../controllers/boards.controller.js';
import { listComments, createComment } from '../controllers/comments.controller.js';
import { listActivity } from '../controllers/activity.controller.js';
import {
  createColumnSchema,
  updateColumnSchema,
  createCardSchema,
  updateCardSchema,
  reorderCardSchema,
  assignCardSchema,
} from '../validators/board.schemas.js';
import { createCommentSchema } from '../validators/comment.schemas.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireBoardMember } from '../middleware/requireBoardMember.js';
import { requireCardInBoard } from '../middleware/requireCardInBoard.js';
import { requireRole } from '../middleware/requireRole.js';

export const boardsRouter = Router();

boardsRouter.use(requireAuth);
// requireBoardMember resuelve tablero -> equipo -> membresía del usuario
// (y deja req.membershipRole, usado por requireRole más abajo)
boardsRouter.use('/boards/:boardId', requireBoardMember);

boardsRouter.get('/boards/:boardId', getBoard);
boardsRouter.delete('/boards/:boardId', requireRole('owner', 'admin'), deleteBoard);
boardsRouter.post('/boards/:boardId/columns', validate(createColumnSchema), createColumn);
boardsRouter.patch(
  '/boards/:boardId/columns/:columnId',
  validate(updateColumnSchema),
  updateColumn
);
boardsRouter.delete('/boards/:boardId/columns/:columnId', deleteColumn);
boardsRouter.post('/boards/:boardId/cards', validate(createCardSchema), createCard);
boardsRouter.patch('/boards/:boardId/cards/:cardId', validate(updateCardSchema), updateCard);
boardsRouter.delete('/boards/:boardId/cards/:cardId', deleteCard);
boardsRouter.put(
  '/boards/:boardId/cards/:cardId/position',
  validate(reorderCardSchema),
  reorderCard
);

boardsRouter.get('/boards/:boardId/activity', listActivity);
boardsRouter.get(
  '/boards/:boardId/cards/:cardId/comments',
  requireCardInBoard,
  listComments
);
boardsRouter.post(
  '/boards/:boardId/cards/:cardId/comments',
  requireCardInBoard,
  validate(createCommentSchema),
  createComment
);

boardsRouter.post(
  '/boards/:boardId/cards/:cardId/assignees',
  requireCardInBoard,
  validate(assignCardSchema),
  assignCard
);
boardsRouter.delete(
  '/boards/:boardId/cards/:cardId/assignees/:userId',
  requireCardInBoard,
  unassignCard
);
