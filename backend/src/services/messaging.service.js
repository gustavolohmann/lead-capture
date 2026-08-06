import { metaConnectionRepository } from '../repositories/meta.connection.repository.js';
import { metaWhatsappRepository } from '../repositories/meta.whatsapp.repository.js';
import { metaInstagramRepository } from '../repositories/meta.instagram.repository.js';
import { conversationRepository } from '../repositories/conversation.repository.js';
import { messageRepository } from '../repositories/message.repository.js';
import { leadRepository } from '../repositories/lead.repository.js';
import { webhookEventRepository } from '../repositories/webhookEvent.repository.js';
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

const WA_INBOUND_PROVIDER = 'meta_whatsapp';

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

function extractInboundText(message) {
  if (!message) return null;
  if (message.type === 'text') return message.text?.body || null;
  if (message.type === 'button') {
    return message.button?.text || message.button?.payload || '[botão]';
  }
  if (message.type === 'interactive') {
    return (
      message.interactive?.button_reply?.title ||
      message.interactive?.list_reply?.title ||
      '[interativo]'
    );
  }
  if (message.type === 'image') {
    return message.image?.caption || '[imagem]';
  }
  if (message.type === 'audio') return '[áudio]';
  if (message.type === 'video') {
    return message.video?.caption || '[vídeo]';
  }
  if (message.type === 'document') {
    return message.document?.filename || '[documento]';
  }
  return `[${message.type || 'mensagem'}]`;
}

function buildTemplateComponents(lead, templateBodyParams) {
  if (!Array.isArray(templateBodyParams) || templateBodyParams.length === 0) {
    return undefined;
  }

  return [
    {
      type: 'body',
      parameters: templateBodyParams.map((value) => {
        const raw = String(value ?? '');
        const rendered = raw.includes('{{')
          ? raw
              .replaceAll('{{name}}', lead?.name || '')
              .replaceAll('{{email}}', lead?.email || '')
              .replaceAll('{{phone}}', lead?.phone || '')
          : raw;
        return { type: 'text', text: rendered || ' ' };
      }),
    },
  ];
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

  async sendOutbound({
    companyId,
    conversation,
    lead,
    content,
    templateName,
    templateLanguage = 'pt_BR',
    templateBodyParams,
  }) {
    const accessToken = await getAccessToken(companyId);
    let externalMessageId = null;
    let storedContent = content;

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
        externalMessageId = templateName
          ? `mock_wa_tpl_${Date.now()}`
          : `mock_wa_msg_${Date.now()}`;
        if (templateName) {
          storedContent = content || `[template:${templateName}]`;
        }
      } else {
        const wabaId = waAccounts[0].business_account_id;
        const phoneNumberId =
          waAccounts[0].phone_number_id ||
          (await whatsappClient.resolvePhoneNumberId(wabaId, accessToken));
        if (!phoneNumberId) {
          throw new AppError('phone_number_id WhatsApp não encontrado', {
            statusCode: 400,
            code: 'WHATSAPP_PHONE_NUMBER_ID_MISSING',
          });
        }

        if (templateName) {
          const result = await whatsappClient.sendTemplate({
            phoneNumberId,
            to: phone,
            templateName,
            languageCode: templateLanguage || 'pt_BR',
            components: buildTemplateComponents(lead, templateBodyParams),
            accessToken,
          });
          externalMessageId = result?.messages?.[0]?.id || null;
          storedContent = content || `[template:${templateName}]`;
        } else {
          const result = await whatsappClient.sendText({
            phoneNumberId,
            to: phone,
            body: content,
            accessToken,
          });
          externalMessageId = result?.messages?.[0]?.id || null;
        }
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
      content: storedContent,
      externalMessageId,
      status: MessageStatus.SENT,
    });

    logger.info('Mensagem outbound enviada', {
      companyId,
      conversationId: conversation.id,
      channel: conversation.channel,
      template: Boolean(templateName),
    });

    return toPublicMessage(message);
  },

  async handleIncomingMessage({ wabaId, value }) {
    const phoneNumberId = value?.metadata?.phone_number_id
      ? String(value.metadata.phone_number_id)
      : null;

    let waAccount = phoneNumberId
      ? await metaWhatsappRepository.findByPhoneNumberId(phoneNumberId)
      : null;
    if (!waAccount && wabaId) {
      waAccount = await metaWhatsappRepository.findByBusinessAccountId(wabaId);
    }
    if (!waAccount) {
      logger.info('Webhook WhatsApp ignorado: conta não mapeada', {
        phoneNumberId,
        wabaId,
      });
      return { processed: 0 };
    }

    const companyId = waAccount.company_id;
    const messages = Array.isArray(value?.messages) ? value.messages : [];
    let processed = 0;

    for (const inbound of messages) {
      const externalMessageId = inbound?.id ? String(inbound.id) : null;
      if (!externalMessageId) continue;

      const createdEvent = await webhookEventRepository.create({
        provider: WA_INBOUND_PROVIDER,
        eventId: externalMessageId,
        payload: inbound,
      });
      if (!createdEvent) continue;

      const existing = await messageRepository.findByExternalMessageId(
        companyId,
        externalMessageId
      );
      if (existing) {
        await webhookEventRepository.markProcessed(
          WA_INBOUND_PROVIDER,
          externalMessageId
        );
        continue;
      }

      const from = normalizePhone(inbound.from);
      if (!from) {
        await webhookEventRepository.markProcessed(
          WA_INBOUND_PROVIDER,
          externalMessageId
        );
        continue;
      }

      const content = extractInboundText(inbound) || '[mensagem]';
      const contactName =
        value?.contacts?.[0]?.profile?.name || null;

      let conversation = await conversationRepository.findByExternalUserId(
        companyId,
        ConversationChannel.WHATSAPP,
        from
      );

      if (!conversation) {
        let lead = await leadRepository.findByPhoneDigits(companyId, from);
        if (!lead) {
          lead = await leadRepository.create({
            companyId,
            name: contactName || from,
            phone: from,
            email: null,
            source: 'WHATSAPP_INBOUND',
            origin: 'whatsapp_inbound',
            rawData: { inbound, metadata: value?.metadata || null },
          });
        }

        conversation = await this.createOrGetConversation({
          companyId,
          leadId: lead.id,
          channel: ConversationChannel.WHATSAPP,
          externalUserId: from,
        });
      }

      await this.saveMessage({
        companyId,
        conversationId: conversation.id,
        direction: MessageDirection.INBOUND,
        content,
        externalMessageId,
        status: MessageStatus.RECEIVED,
      });

      await webhookEventRepository.markProcessed(
        WA_INBOUND_PROVIDER,
        externalMessageId
      );
      processed += 1;

      logger.info('Mensagem WhatsApp inbound salva', {
        companyId,
        conversationId: conversation.id,
        externalMessageId,
      });
    }

    return { processed };
  },
};
