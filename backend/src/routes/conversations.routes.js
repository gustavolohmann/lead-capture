import { Router } from 'express';
import { conversationsController } from '../controllers/conversations.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { sendMessageSchema } from '../validators/messaging.validator.js';
import { oauthRateLimiter } from '../middlewares/rateLimit.middleware.js';

const conversationsRoutes = Router();

conversationsRoutes.use(authMiddleware);

conversationsRoutes.get('/', conversationsController.list);
conversationsRoutes.get('/:id/contact', conversationsController.getContact);
conversationsRoutes.get('/:id/messages', conversationsController.listMessages);
conversationsRoutes.post(
  '/:id/messages',
  oauthRateLimiter,
  validate(sendMessageSchema),
  conversationsController.sendMessage
);

export { conversationsRoutes };
