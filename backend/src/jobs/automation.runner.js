import { automationRepository } from '../repositories/automation.repository.js';
import { automationService } from '../services/automation.service.js';
import { automationExecutorService } from '../services/automation.executor.service.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let timer = null;
let running = false;

async function tick() {
  if (running) return;
  running = true;

  try {
    const due = await automationRepository.findDueRuns(100);
    for (const run of due) {
      await automationService.processDueRun(run);
    }

    await automationExecutorService.processDueExecutions(100);
  } catch (error) {
    logger.error('Automation runner falhou', {
      message: error.message,
    });
  } finally {
    running = false;
  }
}

export function startAutomationRunner() {
  const interval = Number(env.AUTOMATION_POLL_INTERVAL_MS || 30000);
  if (timer) return;

  logger.info('Automation runner iniciado', {
    intervalMs: interval,
    idleSleep: Boolean(env.APP_IDLE_SLEEP),
  });
  setTimeout(tick, 2000);
  if (env.APP_IDLE_SLEEP) {
    return;
  }
  timer = setInterval(tick, interval);
}

export function stopAutomationRunner() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
