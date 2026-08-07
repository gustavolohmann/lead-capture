import http from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { db } from './config/database.js';
import { logger } from './utils/logger.js';
import { wireDomainEvents } from './events/wire.js';
import { startAutomationRunner } from './jobs/automation.runner.js';
import { initSocketServer } from './realtime/socket.server.js';

const app = createApp();
const httpServer = http.createServer(app);

async function start() {
  try {
    await db.raw('SELECT 1');
    // MASTER só via scripts/seed.js (credenciais na execução). Nunca via env.
    wireDomainEvents();
    initSocketServer(httpServer);
    startAutomationRunner();

    httpServer.listen(env.APP_PORT, () => {
      logger.info(`API iniciada na porta ${env.APP_PORT}`);
    });
  } catch (error) {
    logger.error('Falha ao iniciar a API', {
      detail: error.message,
    });
    process.exit(1);
  }
}

start();
