import { messagingService } from './messaging.service.js';
import {
  toPublicConversation,
  toPublicConversationContact,
} from '../models/conversation.model.js';
import { conversationRepository } from '../repositories/conversation.repository.js';
import { leadRepository } from '../repositories/lead.repository.js';
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

  async getContact(companyId, id) {
    const row = await conversationRepository.findById(id, companyId);
    if (!row) {
      throw new AppError('Conversa não encontrada', {
        statusCode: 404,
        code: 'CONVERSATION_NOT_FOUND',
      });
    }

    const lead = row.lead_id
      ? await leadRepository.findById(companyId, row.lead_id)
      : null;

    return toPublicConversationContact(row, lead);
  },
};
