import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { metaGraphClient } from './meta.graph.client.js';
import { metaPageRepository } from '../repositories/meta.page.repository.js';
import { leadRepository } from '../repositories/lead.repository.js';
import { webhookEventRepository } from '../repositories/webhookEvent.repository.js';
import { decrypt } from '../utils/encryption.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { LeadStatus, buildLeadOrigin, toPublicLead } from '../models/lead.model.js';

const PROVIDER = 'meta';

function timingSafeEqualHex(a, b) {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifySignature(rawBody, signatureHeader) {
  if (!signatureHeader || !rawBody) {
    return false;
  }

  const expectedPrefix = 'sha256=';
  if (!signatureHeader.startsWith(expectedPrefix)) {
    return false;
  }

  const provided = signatureHeader.slice(expectedPrefix.length);
  const computed = crypto
    .createHmac('sha256', env.META_APP_SECRET)
    .update(rawBody)
    .digest('hex');

  return timingSafeEqualHex(provided, computed);
}

function pickField(fieldData, names) {
  if (!Array.isArray(fieldData)) return null;

  for (const name of names) {
    const field = fieldData.find(
      (item) => String(item?.name || '').toLowerCase() === name
    );
    const value = field?.values?.[0];
    if (value) return String(value);
  }

  return null;
}

function mapLeadFields(fieldData) {
  return {
    name: pickField(fieldData, [
      'full_name',
      'full name',
      'name',
      'nome',
      'first_name',
    ]),
    email: pickField(fieldData, ['email', 'e-mail', 'work_email']),
    phone: pickField(fieldData, [
      'phone_number',
      'phone',
      'telefone',
      'mobile_phone',
    ]),
  };
}

/** Payload do botão "Enviar para meu servidor" no App Dashboard (IDs 4444...). */
function isMetaDashboardSampleLead({ leadgenId, pageId }) {
  const fakeId = /^4{6,}$/;
  return fakeId.test(String(leadgenId || '')) || fakeId.test(String(pageId || ''));
}

export const metaLeadsService = {
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

  async handleLeadWebhook({ rawBody, signature, payload }) {
    logger.info('Webhook Meta recebido');

    if (!verifySignature(rawBody, signature)) {
      logger.error('Assinatura do webhook Meta inválida');
      throw new AppError('Assinatura inválida', {
        statusCode: 403,
        code: 'WEBHOOK_SIGNATURE_INVALID',
      });
    }

    const entries = payload?.entry || [];
    let processed = 0;
    let skipped = 0;

    for (const entry of entries) {
      const changes = entry?.changes || [];

      for (const change of changes) {
        if (change?.field !== 'leadgen') {
          skipped += 1;
          continue;
        }

        const value = change.value || {};
        const leadgenId = value.leadgen_id ? String(value.leadgen_id) : null;
        const pageId = value.page_id ? String(value.page_id) : null;
        const formId = value.form_id ? String(value.form_id) : null;

        if (!leadgenId || !pageId) {
          skipped += 1;
          continue;
        }

        if (isMetaDashboardSampleLead({ leadgenId, pageId })) {
          logger.info(
            'Webhook Meta de amostra do App Dashboard ignorado (IDs fictícios). Use a Lead Ads Testing Tool.',
            { leadgenId, pageId }
          );
          skipped += 1;
          continue;
        }

        const eventId = leadgenId;
        const created = await webhookEventRepository.create({
          provider: PROVIDER,
          eventId,
          payload: { entry: entry.id, value },
        });

        if (!created) {
          const existing = await webhookEventRepository.findByProviderAndEventId(
            PROVIDER,
            eventId
          );
          if (existing?.processed) {
            logger.info('Webhook Meta duplicado ignorado', { eventId });
            skipped += 1;
            continue;
          }
          logger.info('Webhook Meta pendente — reprocessando', { eventId });
        }

        try {
          await this.processLead({
            leadgenId,
            pageId,
            formId,
          });
          await webhookEventRepository.markProcessed(PROVIDER, eventId);
          processed += 1;
        } catch (error) {
          logger.error('Falha ao processar lead do webhook', {
            leadgenId,
            pageId,
            code: error.code || null,
            message: error.message,
          });
          // Mantém evento registrado (anti-replay); processed permanece false
        }
      }
    }

    return { processed, skipped };
  },

  async fetchLeadData(leadgenId, pageAccessToken) {
    return metaGraphClient.getLead(leadgenId, pageAccessToken);
  },

  async processLead({ leadgenId, pageId, formId }) {
    if (await leadRepository.existsByMetaLeadId(leadgenId)) {
      logger.info('Lead já existente, ignorando', { leadgenId });
      return null;
    }

    const page = await metaPageRepository.findByExternalPageId(pageId);
    if (!page) {
      throw new AppError('Página Meta não vinculada a nenhuma empresa', {
        statusCode: 404,
        code: 'META_PAGE_NOT_FOUND',
      });
    }

    if (!page.access_token_encrypted) {
      throw new AppError('Page token ausente para a página Meta', {
        statusCode: 400,
        code: 'META_PAGE_TOKEN_MISSING',
      });
    }

    const companyId = page.company_id;
    const pageToken = decrypt(page.access_token_encrypted);

    let leadData;
    if (env.META_MOCK_MODE) {
      leadData = {
        id: leadgenId,
        created_time: new Date().toISOString(),
        form_id: formId || 'mock_form',
        campaign_id: 'mock_campaign_e2e',
        campaign_name: 'Campanha E2E Mock',
        ad_id: 'mock_ad_e2e',
        ad_name: 'Anúncio E2E Mock',
        is_organic: false,
        platform: 'fb',
        field_data: [
          { name: 'full_name', values: ['Lead Webhook Mock'] },
          { name: 'email', values: ['webhook.mock@example.com'] },
          { name: 'phone_number', values: ['+5541999887766'] },
        ],
      };
    } else {
      leadData = await this.fetchLeadData(leadgenId, pageToken);
    }

    const mapped = mapLeadFields(leadData?.field_data);

    const campaignId = leadData?.campaign_id
      ? String(leadData.campaign_id)
      : null;
    const campaignName = leadData?.campaign_name
      ? String(leadData.campaign_name)
      : null;
    const adsetId = leadData?.adset_id ? String(leadData.adset_id) : null;
    const adsetName = leadData?.adset_name
      ? String(leadData.adset_name)
      : null;
    const adId = leadData?.ad_id ? String(leadData.ad_id) : null;
    const adName = leadData?.ad_name ? String(leadData.ad_name) : null;
    const isOrganic = Boolean(leadData?.is_organic);
    const platform = leadData?.platform ? String(leadData.platform) : null;
    const resolvedFormId = formId || leadData?.form_id || null;

    const origin = buildLeadOrigin({
      source: 'META_LEAD_ADS',
      campaignName,
      adName,
      isOrganic,
    });

    const lead = await leadRepository.create({
      companyId,
      pageId,
      formId: resolvedFormId,
      metaLeadId: leadgenId,
      name: mapped.name,
      email: mapped.email,
      phone: mapped.phone,
      status: LeadStatus.NEW,
      source: 'META_LEAD_ADS',
      origin,
      formName: null,
      campaignId,
      campaignName,
      adsetId,
      adsetName,
      adId,
      adName,
      platform,
      isOrganic,
      rawData: leadData,
    });

    logger.info('Lead criado', {
      companyId,
      leadId: lead.id,
      metaLeadId: leadgenId,
    });

    // Evento de domínio — não bloqueia o webhook
    const { emitLeadCreated } = await import('../events/lead.events.js');
    emitLeadCreated({ companyId, leadId: lead.id });

    return lead;
  },

  async listLeads(companyId) {
    const rows = await leadRepository.findByCompanyId(companyId);
    return rows.map(toPublicLead);
  },

  async getLead(companyId, leadId) {
    const row = await leadRepository.findById(companyId, leadId);
    if (!row) {
      throw new AppError('Lead não encontrado', {
        statusCode: 404,
        code: 'LEAD_NOT_FOUND',
      });
    }
    return toPublicLead(row);
  },
};
