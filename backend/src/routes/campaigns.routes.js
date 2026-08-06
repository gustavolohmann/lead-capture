import { Router } from 'express';
import { campaignsController } from '../controllers/campaigns.controller.js';
import { automationFlowController } from '../controllers/automationFlow.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { createCampaignSchema } from '../validators/campaign.validator.js';
import { createCampaignAutomationSchema } from '../validators/automationFlow.validator.js';

const campaignsRoutes = Router();

campaignsRoutes.use(authMiddleware);

campaignsRoutes.get('/', campaignsController.list);
campaignsRoutes.post(
  '/',
  validate(createCampaignSchema),
  campaignsController.create
);
campaignsRoutes.patch('/:id/pause', campaignsController.pause);
campaignsRoutes.patch('/:id/activate', campaignsController.activate);
campaignsRoutes.post('/sync', campaignsController.sync);

campaignsRoutes.get(
  '/:campaignId/automations',
  automationFlowController.listByCampaign
);
campaignsRoutes.post(
  '/:campaignId/automations',
  validate(createCampaignAutomationSchema),
  automationFlowController.createForCampaign
);

export { campaignsRoutes };
