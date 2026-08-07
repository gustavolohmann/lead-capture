import { EventEmitter } from 'node:events';
import { logger } from '../utils/logger.js';

export const messageEvents = new EventEmitter();
messageEvents.setMaxListeners(20);

export const MessageEventNames = Object.freeze({
  MESSAGE_CREATED: 'message.created',
  MESSAGE_UPDATED: 'message.updated',
  CONVERSATION_UPDATED: 'conversation.updated',
});

/**
 * Dispara evento de domínio após persistência de mensagem.
 * Não deve lançar erro para o caller (webhook / send).
 */
export function emitMessageCreated(payload) {
  try {
    messageEvents.emit(MessageEventNames.MESSAGE_CREATED, payload);
    logger.info('message.created', {
      messageId: payload?.message?.id,
      conversationId: payload?.message?.conversationId,
      companyId: payload?.message?.companyId,
      direction: payload?.message?.direction,
    });
  } catch (error) {
    logger.error('Falha ao emitir message.created', {
      message: error.message,
      messageId: payload?.message?.id,
    });
  }
}

export function onMessageCreated(handler) {
  messageEvents.on(MessageEventNames.MESSAGE_CREATED, (payload) => {
    Promise.resolve()
      .then(() => handler(payload))
      .catch((error) => {
        logger.error('Handler message.created falhou', {
          message: error.message,
        });
      });
  });
}

export function emitConversationUpdated(payload) {
  try {
    messageEvents.emit(MessageEventNames.CONVERSATION_UPDATED, payload);
  } catch (error) {
    logger.error('Falha ao emitir conversation.updated', {
      message: error.message,
    });
  }
}

export function onConversationUpdated(handler) {
  messageEvents.on(MessageEventNames.CONVERSATION_UPDATED, (payload) => {
    Promise.resolve()
      .then(() => handler(payload))
      .catch((error) => {
        logger.error('Handler conversation.updated falhou', {
          message: error.message,
        });
      });
  });
}
