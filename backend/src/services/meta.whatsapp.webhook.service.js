import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { messagingService } from './messaging.service.js';
import { whatsappTemplateService } from './whatsappTemplate.service.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

function timingSafeEqualHex(a, b) {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifySignature(rawBody, signatureHeader) {
  if (!signatureHeader || !rawBody) return false;
  const expectedPrefix = 'sha256=';
  if (!signatureHeader.startsWith(expectedPrefix)) return false;

  const provided = signatureHeader.slice(expectedPrefix.length);
  const computed = crypto
    .createHmac('sha256', env.META_APP_SECRET)
    .update(rawBody)
    .digest('hex');

  return timingSafeEqualHex(provided, computed);
}

export const metaWhatsappWebhookService = {
  verifyWebhook({ mode, verifyToken, challenge }) {
    if (!env.META_WEBHOOK_VERIFY_TOKEN) {
      throw new AppError('META_WEBHOOK_VERIFY_TOKEN não configurado', {
        statusCode: 500,
        code: 'WEBHOOK_MISCONFIGURED',
      });
    }

    if (mode !== 'subscribe' || verifyToken !== env.META_WEBHOOK_VERIFY_TOKEN) {
      throw new AppError('Verificação do webhook rejeitada', {
        statusCode: 403,
        code: 'WEBHOOK_VERIFY_FAILED',
      });
    }

    return String(challenge ?? '');
  },

  async handleWhatsappWebhook({ rawBody, signature, payload }) {
    logger.info('Webhook WhatsApp recebido');

    if (!env.META_MOCK_MODE && !verifySignature(rawBody, signature)) {
      logger.error('Assinatura do webhook WhatsApp inválida');
      throw new AppError('Assinatura inválida', {
        statusCode: 403,
        code: 'WEBHOOK_SIGNATURE_INVALID',
      });
    }

    if (payload?.object && payload.object !== 'whatsapp_business_account') {
      return { accepted: true, processed: 0, ignored: true };
    }

    let processed = 0;
    const entries = Array.isArray(payload?.entry) ? payload.entry : [];

    for (const entry of entries) {
      const wabaId = entry?.id ? String(entry.id) : null;
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];

      for (const change of changes) {
        const field = change?.field;

        if (field === 'message_template_status_update') {
          const value = change.value || {};
          await whatsappTemplateService.applyStatusUpdate({
            wabaId,
            metaTemplateId: value.message_template_id
              ? String(value.message_template_id)
              : null,
            name: value.message_template_name || null,
            language: value.message_template_language || null,
            event:
              value.event ||
              value.message_template_status ||
              value.new_status ||
              null,
            reason: value.reason || value.rejected_reason || null,
            rejectionInfo: value.other_info || value.rejection_info || null,
          });
          processed += 1;
          continue;
        }

        if (field && field !== 'messages') continue;

        const result = await messagingService.handleIncomingMessage({
          wabaId,
          value: change?.value || {},
        });
        processed += Number(result?.processed || 0);
      }
    }

    return { accepted: true, processed };
  },
};
