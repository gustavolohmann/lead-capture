import { EventEmitter } from 'node:events';
import { logger } from '../utils/logger.js';

export const leadEvents = new EventEmitter();
leadEvents.setMaxListeners(20);

export const LeadEventNames = Object.freeze({
  LEAD_CREATED: 'lead.created',
});

/**
 * Dispara evento de domínio após criação de lead.
 * Não deve lançar erro para o caller (webhook).
 */
export function emitLeadCreated({ companyId, leadId }) {
  try {
    leadEvents.emit(LeadEventNames.LEAD_CREATED, { companyId, leadId });
  } catch (error) {
    logger.error('Falha ao emitir lead.created', {
      companyId,
      leadId,
      message: error.message,
    });
  }
}

export function onLeadCreated(handler) {
  leadEvents.on(LeadEventNames.LEAD_CREATED, (payload) => {
    Promise.resolve()
      .then(() => handler(payload))
      .catch((error) => {
        logger.error('Handler lead.created falhou', {
          message: error.message,
        });
      });
  });
}
