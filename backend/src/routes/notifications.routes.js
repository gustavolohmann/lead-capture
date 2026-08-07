import { Router } from 'express';
import { notificationsController } from '../controllers/notifications.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const notificationsRoutes = Router();

notificationsRoutes.use(authMiddleware);

notificationsRoutes.get(
  '/unread-count',
  notificationsController.unreadCount
);
notificationsRoutes.get('/', notificationsController.listUnread);
notificationsRoutes.patch('/read-all', notificationsController.markAllRead);
notificationsRoutes.patch('/:id/read', notificationsController.markRead);

export { notificationsRoutes };
