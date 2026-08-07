import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { messagingService } from './messaging.service.js';
import { getInstagramWebhookSecret } from './meta.instagram.config.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

function timingSafeEqualHex(a, b) {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function signatureMatches(rawBody, providedHex, secret) {
  if (!secret) return false;
  const computed = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return timingSafeEqualHex(providedHex, computed);
}

function verifySignature(rawBody, signatureHeader) {
  if (!signatureHeader || !rawBody) return false;
  const expectedPrefix = 'sha256=';
  if (!signatureHeader.startsWith(expectedPrefix)) return false;

  const provided = signatureHeader.slice(expectedPrefix.length);
  // Aceita secret do app Instagram ou do app Facebook (produto vinculado)
  return (
    signatureMatches(rawBody, provided, getInstagramWebhookSecret()) ||
    signatureMatches(rawBody, provided, env.META_APP_SECRET)
  );
}

export const metaInstagramWebhookService = {
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

  async handleInstagramWebhook({ rawBody, signature, payload }) {
    logger.info('Webhook Instagram recebido');

    if (!env.META_MOCK_MODE && !verifySignature(rawBody, signature)) {
      logger.error('Assinatura do webhook Instagram inválida');
      throw new AppError('Assinatura inválida', {
        statusCode: 403,
        code: 'WEBHOOK_SIGNATURE_INVALID',
      });
    }

    if (payload?.object && payload.object !== 'instagram') {
      return { accepted: true, processed: 0, ignored: true };
    }

    let processed = 0;
    const entries = Array.isArray(payload?.entry) ? payload.entry : [];

    for (const entry of entries) {
      const igAccountId = entry?.id ? String(entry.id) : null;
      const messaging = Array.isArray(entry?.messaging) ? entry.messaging : [];

      if (messaging.length > 0) {
        const result = await messagingService.handleIncomingInstagramMessage({
          igAccountId,
          events: messaging,
        });
        processed += Number(result?.processed || 0);
        continue;
      }

      // Fallback raro: formato changes (alguns apps legado)
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        if (change?.field && change.field !== 'messages') continue;
        const value = change?.value || {};
        const events = Array.isArray(value?.messaging)
          ? value.messaging
          : value?.sender
            ? [value]
            : [];
        if (!events.length) continue;
        const result = await messagingService.handleIncomingInstagramMessage({
          igAccountId,
          events,
        });
        processed += Number(result?.processed || 0);
      }
    }

    return { accepted: true, processed };
  },
};
