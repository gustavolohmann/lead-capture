import { Router } from 'express';
import { webhooksController } from '../controllers/webhooks.controller.js';
import { webhookRateLimiter } from '../middlewares/rateLimit.middleware.js';

const webhooksRoutes = Router();

webhooksRoutes.get(
  '/meta/leads',
  webhookRateLimiter,
  webhooksController.verifyMetaLeads
);

webhooksRoutes.post(
  '/meta/leads',
  webhookRateLimiter,
  webhooksController.receiveMetaLeads
);

webhooksRoutes.get(
  '/meta/whatsapp',
  webhookRateLimiter,
  webhooksController.verifyMetaWhatsapp
);

webhooksRoutes.post(
  '/meta/whatsapp',
  webhookRateLimiter,
  webhooksController.receiveMetaWhatsapp
);

export { webhooksRoutes };
