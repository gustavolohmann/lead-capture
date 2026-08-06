import { Router } from 'express';
import {
  leadFormsController,
  adsBuilderController,
} from '../controllers/adsBuilder.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createLeadFormSchema,
  createFullCampaignSchema,
} from '../validators/adsBuilder.validator.js';

const leadFormsRoutes = Router();
leadFormsRoutes.use(authMiddleware);
leadFormsRoutes.get('/', leadFormsController.list);
leadFormsRoutes.post('/', validate(createLeadFormSchema), leadFormsController.create);

const adsBuilderRoutes = Router();
adsBuilderRoutes.use(authMiddleware);
adsBuilderRoutes.post(
  '/full',
  validate(createFullCampaignSchema),
  adsBuilderController.createFull
);

export { leadFormsRoutes, adsBuilderRoutes };
