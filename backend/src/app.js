import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { routes } from './routes/index.js';
import { webhooksRoutes } from './routes/webhooks.routes.js';
import {
  errorHandler,
  notFoundHandler,
} from './middlewares/error.middleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: false,
    })
  );
  app.use(cors({ origin: true, credentials: true }));

  // Webhook Meta: preserva rawBody para HMAC
  app.use(
    '/webhooks',
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
    webhooksRoutes
  );

  app.use(express.json({ limit: '8mb' }));

  app.get('/health', (_req, res) => {
    res.status(200).json({ success: true, message: 'ok' });
  });

  app.use(routes);

  if (env.SERVE_FRONTEND) {
    const distPath = path.resolve(__dirname, '../../frontend/dist');
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      // APIs que não devem cair no SPA
      const isApi =
        req.path.startsWith('/webhooks') ||
        req.path.startsWith('/auth') ||
        req.path.startsWith('/leads') ||
        req.path.startsWith('/campaigns') ||
        req.path.startsWith('/conversations') ||
        req.path.startsWith('/automations') ||
        req.path.startsWith('/forms') ||
        req.path.startsWith('/lead-forms') ||
        req.path.startsWith('/meta/connect') ||
        req.path.startsWith('/meta/callback') ||
        req.path.startsWith('/meta/status') ||
        req.path.startsWith('/meta/disconnect') ||
        req.path.startsWith('/meta/assets') ||
        req.path === '/health';

      if (isApi) return next();

      res.sendFile(path.join(distPath, 'index.html'), (err) => {
        if (err) next();
      });
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
