import { metaConnectionRepository } from '../repositories/meta.connection.repository.js';
import { metaWhatsappRepository } from '../repositories/meta.whatsapp.repository.js';
import { metaInstagramRepository } from '../repositories/meta.instagram.repository.js';
import { conversationRepository } from '../repositories/conversation.repository.js';
import { messageRepository } from '../repositories/message.repository.js';
import { leadRepository } from '../repositories/lead.repository.js';
import { whatsappClient } from './whatsapp.client.js';
import { instagramClient } from './instagram.client.js';
import { decrypt } from '../utils/encryption.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';
import { ConversationChannel } from '../models/conversation.model.js';
import {
  MessageDirection,
  MessageStatus,
  toPublicMessage,
} from '../models/message.model.js';
import { toPublicConversation } from '../models/conversation.model.js';

async function getAccessToken(companyId) {
  const connection = await metaConnectionRepository.findByCompanyId(companyId);
  if (!connection?.access_token_encrypted) {
    throw new AppError('Empresa não possui conexão Meta ativa', {
      statusCode: 400,
      code: 'META_NOT_CONNECTED',
    });
  }
  return decrypt(connection.access_token_encrypted);
}

function normalizePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  return digits || null;
}

export const messagingService = {
  async createOrGetConversation({
    companyId,
    leadId,
    channel,
    externalUserId,
  }) {
    return conversationRepository.upsertByLeadChannel({
      companyId,
      leadId,
      channel,
      externalUserId,
    });
  },

  async saveMessage({
    companyId,
    conversationId,
    direction,
    content,
    externalMessageId,
    status,
  }) {
    return messageRepository.create({
      companyId,
      conversationId,
      direction,
      content,
      externalMessageId,
      status,
    });
  },

  async listConversations(companyId) {
    const rows = await conversationRepository.findByCompanyId(companyId);
    return rows.map(toPublicConversation);
  },

  async listMessages(conversationId, companyId) {
    const conversation = await conversationRepository.findById(
      conversationId,
      companyId
    );
    if (!conversation) {
      throw new AppError('Conversa não encontrada', {
        statusCode: 404,
        code: 'CONVERSATION_NOT_FOUND',
      });
    }

    const rows = await messageRepository.findByConversationId(
      conversationId,
      companyId
    );
    return rows.map(toPublicMessage);
  },

  async sendManualMessage(companyId, conversationId, content) {
    const conversation = await conversationRepository.findById(
      conversationId,
      companyId
    );
    if (!conversation) {
      throw new AppError('Conversa não encontrada', {
        statusCode: 404,
        code: 'CONVERSATION_NOT_FOUND',
      });
    }

    const lead = await leadRepository.findById(companyId, conversation.lead_id);
    if (!lead) {
      throw new AppError('Lead não encontrado', {
        statusCode: 404,
        code: 'LEAD_NOT_FOUND',
      });
    }

    return this.sendOutbound({
      companyId,
      conversation,
      lead,
      content,
    });
  },

  async sendOutbound({ companyId, conversation, lead, content }) {
    const accessToken = await getAccessToken(companyId);
    let externalMessageId = null;

    if (conversation.channel === ConversationChannel.WHATSAPP) {
      const phone = normalizePhone(
        conversation.external_user_id || lead.phone
      );
      if (!phone) {
        throw new AppError('Lead sem telefone para WhatsApp', {
          statusCode: 400,
          code: 'WHATSAPP_PHONE_MISSING',
        });
      }

      const waAccounts = await metaWhatsappRepository.findByCompanyId(companyId);
      if (!waAccounts.length) {
        throw new AppError('Nenhuma conta WhatsApp vinculada', {
          statusCode: 400,
          code: 'WHATSAPP_ACCOUNT_MISSING',
        });
      }

      if (env.META_MOCK_MODE) {
        externalMessageId = `mock_wa_msg_${Date.now()}`;
      } else {
        const wabaId = waAccounts[0].business_account_id;
        const phoneNumberId = await whatsappClient.resolvePhoneNumberId(
          wabaId,
          accessToken
        );
        if (!phoneNumberId) {
          throw new AppError('phone_number_id WhatsApp não encontrado', {
            statusCode: 400,
            code: 'WHATSAPP_PHONE_NUMBER_ID_MISSING',
          });
        }

        const result = await whatsappClient.sendText({
          phoneNumberId,
          to: phone,
          body: content,
          accessToken,
        });
        externalMessageId = result?.messages?.[0]?.id || null;
      }
    } else if (conversation.channel === ConversationChannel.INSTAGRAM) {
      const recipientId = conversation.external_user_id;
      if (!recipientId) {
        throw new AppError('Destinatário Instagram ausente', {
          statusCode: 400,
          code: 'INSTAGRAM_RECIPIENT_MISSING',
        });
      }

      const igAccounts = await metaInstagramRepository.findByCompanyId(
        companyId
      );
      if (!igAccounts.length) {
        throw new AppError('Nenhuma conta Instagram vinculada', {
          statusCode: 400,
          code: 'INSTAGRAM_ACCOUNT_MISSING',
        });
      }

      const result = await instagramClient.sendText({
        igUserId: igAccounts[0].instagram_id,
        recipientId,
        text: content,
        accessToken,
      });
      externalMessageId = result?.message_id || result?.id || null;
    } else {
      throw new AppError('Canal inválido', {
        statusCode: 400,
        code: 'INVALID_CHANNEL',
      });
    }

    const message = await this.saveMessage({
      companyId,
      conversationId: conversation.id,
      direction: MessageDirection.OUTBOUND,
      content,
      externalMessageId,
      status: MessageStatus.SENT,
    });

    logger.info('Mensagem outbound enviada', {
      companyId,
      conversationId: conversation.id,
      channel: conversation.channel,
    });

    return toPublicMessage(message);
  },

  async handleIncomingMessage() {
    // Stub Fase 6 — inbound webhook dedicado virá depois
    return null;
  },
};
