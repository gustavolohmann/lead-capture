import { notificationRepository } from '../repositories/notification.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import {
  NotificationType,
  toPublicNotification,
} from '../models/notification.model.js';
import {
  emitNotificationCreated,
  emitNotificationRead,
} from '../events/notification.events.js';
import { AppError } from '../utils/errors.js';

function previewText(content, max = 120) {
  const text = String(content || '').trim();
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export const notificationService = {
  async createNewMessageNotifications({ message, excludeUserIds = [] }) {
    if (!message?.companyId || !message?.id) return [];
    if (message.direction !== 'INBOUND') return [];

    const users = await userRepository.findActiveByCompanyId(message.companyId);
    const excluded = new Set(
      (excludeUserIds || []).map((id) => Number(id)).filter(Boolean)
    );

    const created = [];
    for (const user of users) {
      if (excluded.has(Number(user.id))) continue;

      const row = await notificationRepository.create({
        companyId: message.companyId,
        userId: user.id,
        type: NotificationType.NEW_MESSAGE,
        title: 'Nova mensagem',
        message: previewText(message.content),
        conversationId: message.conversationId,
        messageId: message.id,
      });

      if (!row) continue;
      const publicNotification = toPublicNotification(row);
      emitNotificationCreated(publicNotification);
      created.push(publicNotification);
    }

    return created;
  },

  async getUnreadCount(companyId, userId) {
    return notificationRepository.countUnread(companyId, userId);
  },

  async listUnread(companyId, userId) {
    const rows = await notificationRepository.listUnread(companyId, userId);
    return rows.map(toPublicNotification);
  },

  async markRead(companyId, userId, notificationId) {
    const row = await notificationRepository.markRead(
      notificationId,
      companyId,
      userId
    );
    if (!row) {
      throw new AppError('Notificação não encontrada', {
        statusCode: 404,
        code: 'NOTIFICATION_NOT_FOUND',
      });
    }
    const publicNotification = toPublicNotification(row);
    emitNotificationRead({
      id: publicNotification.id,
      userId,
      companyId,
      conversationId: publicNotification.conversationId,
    });
    return publicNotification;
  },

  async markAllRead(companyId, userId) {
    await notificationRepository.markAllRead(companyId, userId);
    emitNotificationRead({
      id: null,
      all: true,
      userId,
      companyId,
    });
    return { success: true };
  },

  async markConversationRead(companyId, userId, conversationId) {
    await notificationRepository.markConversationRead(
      companyId,
      userId,
      conversationId
    );
    emitNotificationRead({
      id: null,
      conversationId,
      userId,
      companyId,
    });
  },
};
