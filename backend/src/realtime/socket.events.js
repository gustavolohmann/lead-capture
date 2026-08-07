import { SocketEvents } from './socket.constants.js';
import { companyRoom, conversationRoom, userRoom } from './socket.rooms.js';
import { getIO } from './socket.server.js';
import { logger } from '../utils/logger.js';

export { SocketEvents };

function safeEmit(target, event, payload) {
  try {
    target.emit(event, payload);
  } catch (error) {
    logger.error('socket.emit.failed', {
      event,
      message: error.message,
    });
  }
}

export const realtimeGateway = {
  /**
   * Emite apenas para a room da empresa (evita duplicata se o socket
   * também estiver na room da conversa).
   */
  publishMessageCreated(payload) {
    const io = getIO();
    if (!io) return;

    const message = payload?.message;
    if (!message?.companyId || !message?.conversationId) return;

    const companyId = message.companyId;
    const conversationId = message.conversationId;

    safeEmit(
      io.to(companyRoom(companyId)),
      SocketEvents.MESSAGE_CREATED,
      payload
    );

    const conversationPayload = {
      conversation: {
        id: conversationId,
        companyId,
        leadId: message.leadId ?? null,
        channel: message.channel ?? null,
        lastMessagePreview: message.content ?? null,
        lastMessageAt: message.createdAt ?? null,
        lastMessageDirection: message.direction ?? null,
      },
    };
    safeEmit(
      io.to(companyRoom(companyId)),
      SocketEvents.CONVERSATION_UPDATED,
      conversationPayload
    );
  },

  publishNotificationCreated(notification) {
    const io = getIO();
    if (!io || !notification?.userId) return;

    safeEmit(
      io.to(userRoom(notification.userId)),
      SocketEvents.NOTIFICATION_CREATED,
      {
        id: notification.id,
        type: notification.type,
        conversationId: notification.conversationId,
        messageId: notification.messageId,
        title: notification.title,
        preview: notification.message,
        createdAt: notification.createdAt,
      }
    );
  },

  publishNotificationRead(payload) {
    const io = getIO();
    if (!io || !payload?.userId) return;

    safeEmit(
      io.to(userRoom(payload.userId)),
      SocketEvents.NOTIFICATION_READ,
      payload
    );
  },

  /**
   * Usuários com socket na room da conversa (evita notificação redundante).
   */
  getUserIdsInConversation(companyId, conversationId) {
    const io = getIO();
    if (!io) return [];

    const room = conversationRoom(companyId, conversationId);
    const roomSet = io.sockets.adapter.rooms.get(room);
    if (!roomSet || roomSet.size === 0) return [];

    const userIds = new Set();
    for (const socketId of roomSet) {
      const socket = io.sockets.sockets.get(socketId);
      const userId = socket?.user?.id;
      if (userId) userIds.add(Number(userId));
    }
    return [...userIds];
  },
};
