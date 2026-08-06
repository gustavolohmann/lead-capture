import { Router } from 'express';
import { metaController } from '../controllers/meta.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { oauthRateLimiter } from '../middlewares/rateLimit.middleware.js';

const metaRoutes = Router();

metaRoutes.get('/connect', oauthRateLimiter, authMiddleware, metaController.connect);
metaRoutes.get('/callback', oauthRateLimiter, metaController.callback);
metaRoutes.get('/status', authMiddleware, metaController.status);
metaRoutes.delete('/disconnect', authMiddleware, metaController.disconnect);
metaRoutes.post('/assets/sync', authMiddleware, metaController.syncAssets);
metaRoutes.get('/assets', authMiddleware, metaController.listAssets);

export { metaRoutes };
