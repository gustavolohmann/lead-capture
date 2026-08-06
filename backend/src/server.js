import { createApp } from './app.js';
import { env } from './config/env.js';
import { db } from './config/database.js';
import { logger } from './utils/logger.js';
import { wireDomainEvents } from './events/wire.js';
import { startAutomationRunner } from './jobs/automation.runner.js';

const app = createApp();

async function start() {
  try {
    await db.raw('SELECT 1');
    wireDomainEvents();
    startAutomationRunner();

    app.listen(env.APP_PORT, () => {
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
