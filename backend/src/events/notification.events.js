import { EventEmitter } from 'node:events';
import { logger } from '../utils/logger.js';

export const notificationEvents = new EventEmitter();
notificationEvents.setMaxListeners(20);

export const NotificationEventNames = Object.freeze({
  NOTIFICATION_CREATED: 'notification.created',
  NOTIFICATION_READ: 'notification.read',
});

export function emitNotificationCreated(payload) {
  try {
    notificationEvents.emit(
      NotificationEventNames.NOTIFICATION_CREATED,
      payload
    );
    logger.info('notification.created', {
      notificationId: payload?.id,
      companyId: payload?.companyId,
      userId: payload?.userId,
      type: payload?.type,
      conversationId: payload?.conversationId,
      messageId: payload?.messageId,
    });
  } catch (error) {
    logger.error('Falha ao emitir notification.created', {
      message: error.message,
    });
  }
}

export function onNotificationCreated(handler) {
  notificationEvents.on(
    NotificationEventNames.NOTIFICATION_CREATED,
    (payload) => {
      Promise.resolve()
        .then(() => handler(payload))
        .catch((error) => {
          logger.error('Handler notification.created falhou', {
            message: error.message,
          });
        });
    }
  );
}

export function emitNotificationRead(payload) {
  try {
    notificationEvents.emit(NotificationEventNames.NOTIFICATION_READ, payload);
  } catch (error) {
    logger.error('Falha ao emitir notification.read', {
      message: error.message,
    });
  }
}

export function onNotificationRead(handler) {
  notificationEvents.on(NotificationEventNames.NOTIFICATION_READ, (payload) => {
    Promise.resolve()
      .then(() => handler(payload))
      .catch((error) => {
        logger.error('Handler notification.read falhou', {
          message: error.message,
        });
      });
  });
}
