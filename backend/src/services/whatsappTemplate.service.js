import { whatsappClient } from './whatsapp.client.js';
import { companyService } from './company.service.js';
import { metaConnectionRepository } from '../repositories/meta.connection.repository.js';
import { metaWhatsappRepository } from '../repositories/meta.whatsapp.repository.js';
import { whatsappTemplateRepository } from '../repositories/whatsappTemplate.repository.js';
import {
  WhatsappTemplateStatus,
  normalizeMetaStatus,
  toPublicWhatsappTemplate,
} from '../models/whatsappTemplate.model.js';
import { decrypt } from '../utils/encryption.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

async function getCompanyToken(companyId) {
  const company = await companyService.getById(companyId);
  if (!company) {
    throw new AppError('Empresa não encontrada', {
      statusCode: 404,
      code: 'COMPANY_NOT_FOUND',
    });
  }

  const connection = await metaConnectionRepository.findByCompanyId(companyId);
  if (!connection?.access_token_encrypted) {
    throw new AppError('Empresa não possui conexão Meta ativa', {
      statusCode: 400,
      code: 'META_NOT_CONNECTED',
    });
  }

  let accessToken;
  try {
    accessToken = decrypt(connection.access_token_encrypted);
  } catch {
    throw new AppError('Token Meta inválido ou corrompido', {
      statusCode: 401,
      code: 'META_TOKEN_INVALID',
    });
  }

  if (!accessToken) {
    throw new AppError('Token Meta inválido ou expirado', {
      statusCode: 401,
      code: 'META_TOKEN_INVALID',
    });
  }

  return accessToken;
}

async function resolveWabaId(companyId, preferredWabaId) {
  const accounts = await metaWhatsappRepository.findByCompanyId(companyId);
  if (!accounts.length) {
    throw new AppError('Nenhuma conta WhatsApp sincronizada', {
      statusCode: 400,
      code: 'WHATSAPP_NOT_SYNCED',
    });
  }

  if (preferredWabaId) {
    const match = accounts.find(
      (a) => String(a.business_account_id) === String(preferredWabaId)
    );
    if (!match) {
      throw new AppError('WABA não encontrada para esta empresa', {
        statusCode: 404,
        code: 'WABA_NOT_FOUND',
      });
    }
    return String(match.business_account_id);
  }

  return String(accounts[0].business_account_id);
}

function extractVariables(text) {
  const matches = String(text || '').matchAll(/\{\{(\d+)\}\}/g);
  const nums = new Set();
  for (const m of matches) nums.add(Number(m[1]));
  return [...nums].sort((a, b) => a - b);
}

function buildMetaComponents(input) {
  const components = [];

  if (input.header?.text) {
    components.push({
      type: 'HEADER',
      format: 'TEXT',
      text: input.header.text,
    });
  }

  const bodyVars = extractVariables(input.body.text);
  const bodyComponent = {
    type: 'BODY',
    text: input.body.text,
  };

  if (bodyVars.length > 0) {
    const examples = Array.isArray(input.body.examples) ? input.body.examples : [];
    const filled = bodyVars.map((_, idx) => examples[idx] || `exemplo${idx + 1}`);
    bodyComponent.example = { body_text: [filled] };
  }

  components.push(bodyComponent);

  if (input.footer?.text) {
    components.push({
      type: 'FOOTER',
      text: input.footer.text,
    });
  }

  if (Array.isArray(input.buttons) && input.buttons.length > 0) {
    components.push({
      type: 'BUTTONS',
      buttons: input.buttons.map((btn) => {
        if (btn.type === 'URL') {
          return { type: 'URL', text: btn.text, url: btn.url };
        }
        if (btn.type === 'PHONE_NUMBER') {
          return {
            type: 'PHONE_NUMBER',
            text: btn.text,
            phone_number: btn.phone_number,
          };
        }
        return { type: 'QUICK_REPLY', text: btn.text };
      }),
    });
  }

  return components;
}

function mapMetaTemplateRow(item) {
  const quality =
    typeof item?.quality_score === 'object'
      ? item.quality_score?.score || null
      : item?.quality_score || null;

  return {
    metaTemplateId: item?.id ? String(item.id) : null,
    name: String(item?.name || ''),
    language: String(item?.language || 'pt_BR'),
    category: String(item?.category || 'UTILITY').toUpperCase(),
    status: normalizeMetaStatus(item?.status),
    rejectedReason: item?.rejected_reason
      ? String(item.rejected_reason).toUpperCase()
      : null,
    rejectionInfo: null,
    qualityScore: quality ? String(quality) : null,
    components: Array.isArray(item?.components) ? item.components : [],
    parameterFormat: item?.parameter_format || 'POSITIONAL',
  };
}

export const whatsappTemplateService = {
  async list(companyId, { status, approvedOnly } = {}) {
    const filterStatus = approvedOnly
      ? WhatsappTemplateStatus.APPROVED
      : status || null;
    const rows = await whatsappTemplateRepository.findByCompanyId(companyId, {
      status: filterStatus,
    });
    return rows.map(toPublicWhatsappTemplate);
  },

  async syncFromMeta(companyId, preferredWabaId) {
    const accessToken = await getCompanyToken(companyId);
    const wabaId = await resolveWabaId(companyId, preferredWabaId);
    const response = await whatsappClient.listMessageTemplates(
      wabaId,
      accessToken
    );
    const items = response?.data || [];
    let synced = 0;

    for (const item of items) {
      const mapped = mapMetaTemplateRow(item);
      if (!mapped.name) continue;
      await whatsappTemplateRepository.upsertByIdentity({
        companyId,
        wabaId,
        ...mapped,
      });
      synced += 1;
    }

    logger.info('Templates WhatsApp sincronizados', {
      companyId,
      wabaId,
      synced,
    });

    return {
      wabaId,
      synced,
      templates: await this.list(companyId),
    };
  },

  async create(companyId, input) {
    const accessToken = await getCompanyToken(companyId);
    const wabaId = await resolveWabaId(companyId, input.wabaId);
    const components = buildMetaComponents(input);

    const payload = {
      name: input.name,
      language: input.language || 'pt_BR',
      category: input.category,
      parameter_format: input.parameterFormat || 'POSITIONAL',
      components,
    };

    let metaResponse;
    try {
      metaResponse = await whatsappClient.createMessageTemplate(
        wabaId,
        accessToken,
        payload
      );
    } catch (error) {
      logger.error('Falha ao criar template WhatsApp na Meta', {
        companyId,
        wabaId,
        name: input.name,
        code: error.code || null,
        message: error.message,
      });
      throw error;
    }

    const row = await whatsappTemplateRepository.upsertByIdentity({
      companyId,
      wabaId,
      metaTemplateId: metaResponse?.id ? String(metaResponse.id) : null,
      name: input.name,
      language: payload.language,
      category: input.category,
      status: normalizeMetaStatus(metaResponse?.status || 'PENDING'),
      rejectedReason: metaResponse?.rejected_reason || null,
      components,
      parameterFormat: payload.parameter_format,
    });

    logger.info('Template WhatsApp enviado para aprovação', {
      companyId,
      wabaId,
      name: input.name,
      metaTemplateId: row?.meta_template_id,
      status: row?.status,
    });

    return toPublicWhatsappTemplate(row);
  },

  async applyStatusUpdate({
    wabaId,
    metaTemplateId,
    name,
    language,
    event,
    reason,
    rejectionInfo,
  }) {
    const status = normalizeMetaStatus(event);
    const updated = await whatsappTemplateRepository.updateStatusByMetaId({
      metaTemplateId,
      name,
      language,
      wabaId,
      status,
      rejectedReason: reason
        ? String(reason).toUpperCase()
        : status === WhatsappTemplateStatus.REJECTED
          ? 'UNKNOWN'
          : null,
      rejectionInfo: rejectionInfo || null,
    });

    if (!updated && wabaId && name && language) {
      const account =
        await metaWhatsappRepository.findByBusinessAccountId(wabaId);
      if (account?.company_id) {
        await whatsappTemplateRepository.upsertByIdentity({
          companyId: account.company_id,
          wabaId,
          metaTemplateId: metaTemplateId || null,
          name,
          language,
          category: 'UTILITY',
          status,
          rejectedReason: reason ? String(reason).toUpperCase() : null,
          rejectionInfo,
          components: [],
        });
      }
    }

    logger.info('Status de template WhatsApp atualizado', {
      wabaId,
      name,
      language,
      status,
      reason: reason || null,
    });

    return { updated: Boolean(updated), status };
  },
};
