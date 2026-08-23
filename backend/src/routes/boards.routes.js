import { Router } from 'express';
import {
  getBoard,
  createColumn,
  updateColumn,
  deleteColumn,
  createCard,
  updateCard,
  deleteCard,
} from '../controllers/boards.controller.js';
import {
  createColumnSchema,
  updateColumnSchema,
  createCardSchema,
  updateCardSchema,
} from '../validators/board.schemas.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireBoardMember } from '../middleware/requireBoardMember.js';

export const boardsRouter = Router();

boardsRouter.use(requireAuth);
// requireBoardMember resuelve tablero -> equipo -> membresía del usuario
boardsRouter.use('/boards/:boardId', requireBoardMember);

boardsRouter.get('/boards/:boardId', getBoard);
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
