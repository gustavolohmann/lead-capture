import { Router } from 'express';
import { whatsappTemplateController } from '../controllers/whatsappTemplate.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createWhatsappTemplateSchema,
} from '../validators/whatsappTemplate.validator.js';
import { oauthRateLimiter } from '../middlewares/rateLimit.middleware.js';

const whatsappTemplateRoutes = Router();

whatsappTemplateRoutes.use(authMiddleware);

whatsappTemplateRoutes.get('/', whatsappTemplateController.list);

whatsappTemplateRoutes.post(
  '/sync',
  oauthRateLimiter,
  whatsappTemplateController.sync
);

whatsappTemplateRoutes.post(
  '/',
  oauthRateLimiter,
  validate(createWhatsappTemplateSchema),
  whatsappTemplateController.create
);

export { whatsappTemplateRoutes };
