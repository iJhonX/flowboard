import { Router } from 'express';
import { listNotifications, markAllRead } from '../controllers/notifications.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

notificationsRouter.get('/notifications', listNotifications);
notificationsRouter.post('/notifications/mark-read', markAllRead);
