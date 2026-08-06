import { onLeadCreated } from './lead.events.js';
import { automationService } from '../services/automation.service.js';
import { logger } from '../utils/logger.js';

let wired = false;

/**
 * Conecta eventos de domínio aos handlers (sem acoplar meta.leads → automation).
 */
export function wireDomainEvents() {
  if (wired) return;
  wired = true;

  onLeadCreated(async ({ companyId, leadId }) => {
    logger.info('Evento lead.created recebido', { companyId, leadId });
    await automationService.onLeadCreated({ companyId, leadId });
  });
}
