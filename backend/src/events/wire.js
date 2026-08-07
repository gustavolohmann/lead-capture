import { onLeadCreated } from './lead.events.js';
import { onMessageCreated } from './message.events.js';
import {
  onNotificationCreated,
  onNotificationRead,
} from './notification.events.js';
import { automationService } from '../services/automation.service.js';
import { notificationService } from '../services/notification.service.js';
import { realtimeGateway } from '../realtime/socket.events.js';
import { logger } from '../utils/logger.js';

let wired = false;

/**
 * Conecta eventos de domínio aos handlers.
 * Services emitem eventos; realtime e side-effects escutam aqui.
 */
export function wireDomainEvents() {
  if (wired) return;
  wired = true;

  onLeadCreated(async ({ companyId, leadId }) => {
    logger.info('Evento lead.created recebido', { companyId, leadId });
    await automationService.onLeadCreated({ companyId, leadId });
  });

  onMessageCreated(async (payload) => {
    realtimeGateway.publishMessageCreated(payload);

    const message = payload?.message;
    if (!message || message.direction !== 'INBOUND') return;

    const viewers = realtimeGateway.getUserIdsInConversation(
      message.companyId,
      message.conversationId
    );

    await notificationService.createNewMessageNotifications({
      message,
      excludeUserIds: viewers,
    });
  });

  onNotificationCreated((notification) => {
    realtimeGateway.publishNotificationCreated(notification);
  });

  onNotificationRead((payload) => {
    realtimeGateway.publishNotificationRead(payload);
  });
}
