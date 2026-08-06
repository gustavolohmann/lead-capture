import { Router } from 'express';
import { automationController } from '../controllers/automation.controller.js';
import { automationFlowController } from '../controllers/automationFlow.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { createAutomationSchema } from '../validators/messaging.validator.js';
import { updateAutomationFlowSchema } from '../validators/automationFlow.validator.js';
import { oauthRateLimiter } from '../middlewares/rateLimit.middleware.js';

const automationRoutes = Router();

automationRoutes.use(authMiddleware);

automationRoutes.get('/', automationController.list);
automationRoutes.post(
  '/',
  oauthRateLimiter,
  validate(createAutomationSchema),
  automationController.create
);
automationRoutes.get('/:id', automationFlowController.getById);
automationRoutes.put(
  '/:id',
  validate(updateAutomationFlowSchema),
  automationFlowController.update
);
automationRoutes.post('/:id/test', automationFlowController.test);
automationRoutes.patch('/:id', automationController.setActive);

export { automationRoutes };
