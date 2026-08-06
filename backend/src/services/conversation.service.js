import { messagingService } from './messaging.service.js';
import { toPublicConversation } from '../models/conversation.model.js';
import { conversationRepository } from '../repositories/conversation.repository.js';
import { AppError } from '../utils/errors.js';

export const conversationService = {
  async list(companyId) {
    return messagingService.listConversations(companyId);
  },

  async getById(companyId, id) {
    const row = await conversationRepository.findById(id, companyId);
    if (!row) {
      throw new AppError('Conversa não encontrada', {
        statusCode: 404,
        code: 'CONVERSATION_NOT_FOUND',
      });
    }
    return toPublicConversation(row);
  },
};
