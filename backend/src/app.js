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
      if (req.path.startsWith('/api') || req.path.startsWith('/webhooks') || req.path.startsWith('/meta')) {
        return next();
      }
      res.sendFile(path.join(distPath, 'index.html'), (err) => {
        if (err) next();
      });
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
