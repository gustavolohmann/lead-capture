import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { metaInsightsController } from '../controllers/metaInsights.controller.js';

const metaAdsRoutes = Router();

metaAdsRoutes.use(authMiddleware);

metaAdsRoutes.get('/insights', metaInsightsController.insights);
metaAdsRoutes.get('/summary', metaInsightsController.summary);
metaAdsRoutes.get('/campaigns', metaInsightsController.campaigns);
metaAdsRoutes.get('/adsets', metaInsightsController.adsets);
metaAdsRoutes.get('/ads', metaInsightsController.ads);
metaAdsRoutes.get('/comparison', metaInsightsController.comparison);

export { metaAdsRoutes };
