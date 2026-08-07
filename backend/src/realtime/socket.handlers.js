import { conversationRepository } from '../repositories/conversation.repository.js';
import {
  conversationRoom,
  joinCompanyRoom,
  joinUserRoom,
} from './socket.rooms.js';
import { SocketEvents } from './socket.constants.js';
import { logger } from '../utils/logger.js';

export function registerSocketHandlers(socket) {
  joinCompanyRoom(socket);
  joinUserRoom(socket);

  logger.info('socket.connected', {
    socketId: socket.id,
    userId: socket.user?.id,
    companyId: socket.company?.id,
  });

  socket.on(SocketEvents.CONVERSATION_JOIN, async (payload = {}) => {
    try {
      const conversationId = Number(payload.conversationId);
      const companyId = socket.company?.id;
      if (!companyId || !Number.isFinite(conversationId)) {
        socket.emit('error', { code: 'INVALID_CONVERSATION' });
        return;
      }

      const conversation = await conversationRepository.findById(
        conversationId,
        companyId
      );
      if (
        !conversation ||
        Number(conversation.company_id) !== Number(companyId)
      ) {
        socket.emit('error', { code: 'FORBIDDEN_CONVERSATION' });
        return;
      }

      const room = conversationRoom(companyId, conversationId);
      socket.join(room);
      socket.data.activeConversationId = conversationId;
    } catch (error) {
      logger.error('socket.conversation.join.failed', {
        message: error.message,
        userId: socket.user?.id,
      });
    }
  });

  socket.on(SocketEvents.CONVERSATION_LEAVE, (payload = {}) => {
    const conversationId = Number(
      payload.conversationId ?? socket.data.activeConversationId
    );
    const companyId = socket.company?.id;
    if (!companyId || !Number.isFinite(conversationId)) return;
    socket.leave(conversationRoom(companyId, conversationId));
    if (socket.data.activeConversationId === conversationId) {
      socket.data.activeConversationId = null;
    }
  });

  socket.on('disconnect', (reason) => {
    logger.info('socket.disconnected', {
      socketId: socket.id,
      userId: socket.user?.id,
      companyId: socket.company?.id,
      reason,
    });
  });
}
