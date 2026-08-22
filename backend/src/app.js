import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { routes } from './routes/index.js';
import { webhooksRoutes } from './routes/webhooks.routes.js';
import { metaController } from './controllers/meta.controller.js';
import { calendarController } from './controllers/scheduling.controller.js';
import { oauthRateLimiter } from './middlewares/rateLimit.middleware.js';
import {
  errorHandler,
  notFoundHandler,
} from './middlewares/error.middleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  const frontendOrigin = new URL(env.FRONTEND_URL).origin;

  // Railway / proxies: necessário para rate-limit e X-Forwarded-For
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
    })
  );
  app.use(
    cors({
      origin: frontendOrigin,
      credentials: false,
    })
  );

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

  // OAuth callback permanece na URL cadastrada na Meta (sem /api)
  app.get('/meta/callback', oauthRateLimiter, metaController.callback);

  // Google Calendar OAuth callback (URL cadastrada no Google Cloud Console)
  app.get(
    '/calendar/google/callback',
    oauthRateLimiter,
    calendarController.callbackGoogle
  );

  // APIs da aplicação sob /api — evita conflito com rotas do SPA
  // (/campaigns, /leads, /forms, /conversations, /automations, /meta)
  app.use('/api', routes);

  if (env.SERVE_FRONTEND) {
    const distPath = path.resolve(__dirname, '../../frontend/dist');
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (
        req.path.startsWith('/api') ||
        req.path.startsWith('/webhooks') ||
        req.path === '/health' ||
        req.path === '/meta/callback' ||
        req.path === '/calendar/google/callback'
      ) {
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
