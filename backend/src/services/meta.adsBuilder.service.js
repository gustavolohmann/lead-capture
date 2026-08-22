import crypto from 'node:crypto';
import { companyService } from './company.service.js';
import { metaMarketingClient } from './meta.marketing.client.js';
import { metaGraphClient } from './meta.graph.client.js';
import { metaConnectionRepository } from '../repositories/meta.connection.repository.js';
import { metaPageRepository } from '../repositories/meta.page.repository.js';
import { metaAdAccountRepository } from '../repositories/meta.adAccount.repository.js';
import { metaInstagramRepository } from '../repositories/meta.instagram.repository.js';
import { metaWhatsappRepository } from '../repositories/meta.whatsapp.repository.js';
import { requireInstagramAppConfig } from './meta.instagram.config.js';
import { leadFormRepository } from '../repositories/leadForm.repository.js';
import { adSetRepository } from '../repositories/adSet.repository.js';
import { adCreativeRepository } from '../repositories/adCreative.repository.js';
import { adRepository } from '../repositories/ad.repository.js';
import { campaignRepository } from '../repositories/campaign.repository.js';
import { campaignPublicationRepository } from '../repositories/campaignPublication.repository.js';
import { decrypt } from '../utils/encryption.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import {
  CampaignObjective,
  CampaignStatus,
  META_OBJECTIVE_BY_PRODUCT,
  toPublicCampaign,
} from '../models/campaign.model.js';
import { toPublicLeadForm } from '../models/leadForm.model.js';
import { toPublicAdSet } from '../models/adSet.model.js';
import { toPublicAdCreative } from '../models/adCreative.model.js';
import { toPublicAd } from '../models/ad.model.js';
import { normalizeCampaignAds } from './meta.adsBuilder.normalize.js';

const FIELD_TYPE_MAP = {
  name: 'FULL_NAME',
  full_name: 'FULL_NAME',
  email: 'EMAIL',
  phone: 'PHONE',
  telefone: 'PHONE',
};

/** Tipos do builder → payload Meta leadgen. */
const QUESTION_TYPE_TO_META = {
  FULL_NAME: { metaType: 'FULL_NAME' },
  NAME: { metaType: 'FULL_NAME' },
  EMAIL: { metaType: 'EMAIL' },
  PHONE: { metaType: 'PHONE' },
  CITY: { metaType: 'CITY' },
  STATE: { metaType: 'STATE' },
  POST_CODE: { metaType: 'POST_CODE' },
  ZIP: { metaType: 'POST_CODE' },
  COMPANY_NAME: { metaType: 'COMPANY_NAME' },
  COMPANY: { metaType: 'COMPANY_NAME' },
  JOB_TITLE: { metaType: 'JOB_TITLE' },
  WEBSITE: { metaType: 'WEBSITE' },
  WHATSAPP_NUMBER: { metaType: 'WHATSAPP_NUMBER' },
  WHATSAPP: { metaType: 'WHATSAPP_NUMBER' },
  GENDER: { metaType: 'GENDER' },
  DATE: { metaType: 'DATE_TIME' },
  DATE_TIME: { metaType: 'DATE_TIME' },
  DOB: { metaType: 'DOB' },
  TEXT: { metaType: 'CUSTOM', needsLabel: true },
  TEXTAREA: { metaType: 'CUSTOM', needsLabel: true },
  NUMBER: { metaType: 'CUSTOM', needsLabel: true },
  SELECT: { metaType: 'CUSTOM', needsLabel: true, needsOptions: true },
  RADIO: { metaType: 'CUSTOM', needsLabel: true, needsOptions: true },
  CHECKBOX: { metaType: 'CUSTOM', needsLabel: true, needsOptions: true },
  CUSTOM: { metaType: 'CUSTOM', needsLabel: true },
  MULTIPLE_CHOICE: { metaType: 'CUSTOM', needsLabel: true, needsOptions: true },
};

function slugOptionKey(value, index) {
  const slug = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
  return slug || `opt_${index + 1}`;
}

function normalizeCustomQuestionOptions(custom) {
  const raw = custom?.options ?? custom?.optionsText;
  if (Array.isArray(raw)) {
    return raw
      .map((item, index) => {
        const value =
          typeof item === 'string' ? item : item?.value || item?.label || '';
        const trimmed = String(value).trim();
        if (!trimmed) return null;
        return {
          key: String(item?.key || slugOptionKey(trimmed, index)).slice(0, 60),
          value: trimmed,
        };
      })
      .filter(Boolean);
  }

  if (typeof raw === 'string') {
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((value, index) => ({
        key: slugOptionKey(value, index),
        value,
      }));
  }

  return [];
}

function mapQuestionToMeta(raw, index) {
  if (typeof raw === 'string') {
    const label = raw.trim();
    if (label.length < 2) return null;
    return {
      type: 'CUSTOM',
      key: `custom_${index + 1}`,
      label,
    };
  }

  const questionType = String(raw?.type || 'TEXT')
    .trim()
    .toUpperCase();
  const mapping = QUESTION_TYPE_TO_META[questionType];

  if (!mapping) {
    throw new AppError(`Tipo de pergunta inválido: ${questionType}`, {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  if (mapping.metaType !== 'CUSTOM') {
    return { type: mapping.metaType };
  }

  const label = String(raw?.label || '').trim();
  if (mapping.needsLabel && label.length < 2) {
    throw new AppError('Perguntas personalizadas precisam de um texto', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  const question = {
    type: 'CUSTOM',
    key: String(raw?.key || `custom_${index + 1}`).slice(0, 60),
    label: label || questionType,
  };

  if (mapping.needsOptions) {
    const options = normalizeCustomQuestionOptions(raw);
    if (options.length < 2) {
      throw new AppError(
        `Pergunta "${question.label}" precisa de pelo menos 2 opções`,
        {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
        }
      );
    }
    question.options = options;
  }

  return question;
}

function buildLeadQuestions({
  questions = [],
  fields = [],
  customQuestions = [],
} = {}) {
  const mapped = [];

  if (Array.isArray(questions) && questions.length > 0) {
    questions.forEach((item, index) => {
      const question = mapQuestionToMeta(item, index);
      if (question) mapped.push(question);
    });
  } else {
    for (const field of fields) {
      const key = String(field).trim().toLowerCase();
      const type = FIELD_TYPE_MAP[key];
      if (type) mapped.push({ type });
    }

    customQuestions.forEach((custom, index) => {
      const question = mapQuestionToMeta(custom, mapped.length + index);
      if (question) mapped.push(question);
    });
  }

  if (mapped.length === 0) {
    throw new AppError('Informe ao menos um campo no formulário', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  if (mapped.length > 15) {
    throw new AppError('A Meta aceita no máximo 15 perguntas no formulário', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  return mapped;
}

function resolveBidAmountCents(audience, budgetCents) {
  const raw = audience?.bidAmount ?? audience?.bid_amount;
  if (raw != null && Number(raw) > 0) {
    return Math.round(Number(raw) * 100);
  }
  return Math.max(200, Math.round(budgetCents * 0.05));
}

function normalizeAdAccountId(adAccountId) {
  const id = String(adAccountId || '').trim();
  if (!id) return '';
  return id.startsWith('act_') ? id : `act_${id}`;
}

function toMetaBudgetCents(dailyBudget) {
  const value = Number(dailyBudget);
  if (!Number.isFinite(value) || value <= 0) {
    throw new AppError('Orçamento diário inválido', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }
  return Math.round(value * 100);
}

function isMetaOwnedUrl(urlString) {
  try {
    const host = new URL(String(urlString)).hostname.toLowerCase();
    return (
      host === 'facebook.com' ||
      host.endsWith('.facebook.com') ||
      host === 'fb.com' ||
      host.endsWith('.fb.com') ||
      host === 'instagram.com' ||
      host.endsWith('.instagram.com') ||
      host === 'messenger.com' ||
      host.endsWith('.messenger.com') ||
      host === 'fb.me' ||
      host.endsWith('.fb.me')
    );
  } catch {
    return true;
  }
}

/**
 * Lead Ads exige link externo no criativo (não Página do Facebook).
 * Preferência: follow-up → privacidade → link do criativo.
 */
function resolveLeadAdsExternalLink({
  followUpActionUrl,
  privacyPolicyUrl,
  creativeLink,
} = {}) {
  const candidates = [followUpActionUrl, privacyPolicyUrl, creativeLink]
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    if (!/^https?:\/\//i.test(candidate)) continue;
    if (isMetaOwnedUrl(candidate)) continue;
    return candidate;
  }

  throw new AppError(
    'Lead Ads exige uma URL externa (site/privacidade), não uma Página do Facebook. Informe privacyPolicyUrl ou followUpActionUrl válidos.',
    {
      statusCode: 400,
      code: 'META_LEAD_EXTERNAL_URL_REQUIRED',
    }
  );
}

function stripDataUrl(base64) {
  const value = String(base64 || '').trim();
  const match = value.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
  return match ? match[1] : value;
}

async function assertCompany(companyId) {
  const company = await companyService.getById(companyId);
  if (!company) {
    throw new AppError('Empresa não encontrada', {
      statusCode: 404,
      code: 'COMPANY_NOT_FOUND',
    });
  }
  return company;
}

async function getUserToken(companyId) {
  const connection = await metaConnectionRepository.findByCompanyId(companyId);
  if (!connection?.access_token_encrypted) {
    throw new AppError('Empresa não possui conexão Meta ativa', {
      statusCode: 400,
      code: 'META_NOT_CONNECTED',
    });
  }

  try {
    const accessToken = decrypt(connection.access_token_encrypted);
    if (!accessToken) throw new Error('empty');
    return accessToken;
  } catch {
    throw new AppError('Token Meta inválido ou corrompido', {
      statusCode: 401,
      code: 'META_TOKEN_INVALID',
    });
  }
}

async function getPageWithToken(companyId, pageId) {
  const page = await metaPageRepository.findByPageId(companyId, String(pageId));
  if (!page) {
    throw new AppError('Página não pertence a esta empresa', {
      statusCode: 403,
      code: 'PAGE_FORBIDDEN',
    });
  }
  if (!page.access_token_encrypted) {
    throw new AppError('Página sem token. Sincronize os ativos Meta.', {
      statusCode: 400,
      code: 'PAGE_TOKEN_MISSING',
    });
  }

  try {
    const pageAccessToken = decrypt(page.access_token_encrypted);
    return { page, pageAccessToken };
  } catch {
    throw new AppError('Token da página inválido', {
      statusCode: 401,
      code: 'PAGE_TOKEN_INVALID',
    });
  }
}

async function assertAdAccount(companyId, adAccountId) {
  const normalized = normalizeAdAccountId(adAccountId);
  const account = await metaAdAccountRepository.findByCompanyAndAccountId(
    companyId,
    normalized
  );
  if (account) return normalizeAdAccountId(account.account_id);

  const raw = normalized.replace(/^act_/, '');
  const alt = await metaAdAccountRepository.findByCompanyAndAccountId(
    companyId,
    raw
  );
  if (!alt) {
    throw new AppError('Conta de anúncio não pertence a esta empresa', {
      statusCode: 403,
      code: 'AD_ACCOUNT_FORBIDDEN',
    });
  }
  return normalizeAdAccountId(alt.account_id);
}

function buildTargeting(audience = {}) {
  const ageMin = Number(audience.ageMin ?? audience.age_min ?? 18);
  const ageMax = Number(audience.ageMax ?? audience.age_max ?? 65);
  const country = String(audience.country || 'BR').toUpperCase();
  const city = audience.city || audience.location || null;
  const interests = audience.interests || [];

  const targeting = {
    age_min: Math.max(13, Math.min(ageMin, 65)),
    age_max: Math.max(13, Math.min(ageMax, 65)),
    geo_locations: {
      countries: [country],
    },
    // Obrigatório nas versões recentes da Marketing API
    targeting_automation: {
      advantage_audience: audience.advantageAudience === true || audience.advantageAudience === 1 ? 1 : 0,
    },
  };

  // Only accept genders as Meta array ([1]=male, [2]=female). Omit when absent.
  if (Array.isArray(audience.genders) && audience.genders.length > 0) {
    const genders = audience.genders
      .map((value) => Number(value))
      .filter((value) => value === 1 || value === 2);
    if (genders.length > 0) {
      targeting.genders = [...new Set(genders)];
    }
  }

  if (city && String(city).trim()) {
    // Geo search by city name is limited without location keys.
    // Keep country targeting and store city hint for product UI.
    targeting.geo_locations = {
      countries: [country],
    };
  }

  const interestList = (Array.isArray(interests) ? interests : [])
    .map((item) => {
      if (typeof item === 'object' && item?.id) {
        return { id: String(item.id), name: item.name || undefined };
      }
      return null;
    })
    .filter(Boolean);

  if (interestList.length > 0) {
    targeting.flexible_spec = [{ interests: interestList }];
  }

  return {
    targeting,
    cityHint: city ? String(city).trim() : null,
  };
}

function extractImageHash(uploadResponse) {
  const images = uploadResponse?.images;
  if (!images || typeof images !== 'object') return null;
  const first = Object.values(images)[0];
  return first?.hash || null;
}

function markCleanupRequired(error, context) {
  error.cleanupRequired = true;
  error.cleanupContext = {
    ...(error.cleanupContext || {}),
    ...context,
  };
}

async function cleanupCreativeResource({
  companyId,
  accessToken,
  creativeId,
  metaCreativeId,
  flow,
}) {
  try {
    await metaMarketingClient.deleteAdCreative(metaCreativeId, accessToken);
  } catch (error) {
    logger.error('Falha ao remover Creative Meta após erro', {
      companyId,
      flow,
      metaCreativeId,
      detail: error?.message || null,
    });
    return false;
  }

  try {
    let localCreativeId = creativeId;
    if (!localCreativeId) {
      const local = await adCreativeRepository.findByMetaCreativeId(
        companyId,
        metaCreativeId
      );
      localCreativeId = local?.id || null;
    }
    if (localCreativeId) {
      await adCreativeRepository.deleteById(companyId, localCreativeId);
    }
    return true;
  } catch (error) {
    logger.error('Falha ao remover Creative local após compensação Meta', {
      companyId,
      flow,
      creativeId: creativeId || null,
      metaCreativeId,
      detail: error?.message || null,
    });
    return false;
  }
}

async function cleanupAdResource({
  companyId,
  accessToken,
  metaAdId,
  flow,
}) {
  try {
    await metaMarketingClient.deleteAd(metaAdId, accessToken);
  } catch (error) {
    logger.error('Falha ao remover Ad Meta após erro', {
      companyId,
      flow,
      metaAdId,
      detail: error?.message || null,
    });
    return false;
  }

  try {
    await adRepository.deleteByMetaAdId(companyId, metaAdId);
    return true;
  } catch (error) {
    logger.error('Falha ao remover Ad local após compensação Meta', {
      companyId,
      flow,
      metaAdId,
      detail: error?.message || null,
    });
    return false;
  }
}

async function createCreativeAndPersist({
  companyId,
  adAccountId,
  accessToken,
  pageId,
  campaignName,
  creativeInput,
  ctaType,
  linkUrl,
  ctaValue,
  defaultTitle,
  defaultBody,
  instagramUserId = null,
}) {
  const imageBase64 = stripDataUrl(
    creativeInput.imageBase64 || creativeInput.image
  );
  if (!imageBase64 || imageBase64.length < 32) {
    throw new AppError('Imagem do anúncio é obrigatória (base64)', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  const upload = await metaMarketingClient.uploadAdImage(
    adAccountId,
    accessToken,
    {
      bytesBase64: imageBase64,
      name: creativeInput.imageName || 'ad-creative.jpg',
    }
  );
  const imageHash = extractImageHash(upload);
  if (!imageHash) {
    throw new AppError('Meta não retornou image_hash', {
      statusCode: 502,
      code: 'META_MARKETING_ERROR',
    });
  }

  const creativeName = String(
    creativeInput.name || `Criativo ${campaignName}`
  ).trim();
  const title = String(creativeInput.title || defaultTitle).trim();
  const body = String(
    creativeInput.text || creativeInput.body || defaultBody
  ).trim();

  const callToAction = { type: ctaType };
  if (ctaValue) {
    callToAction.value = ctaValue;
  }

  const isInstagramDirect =
    Boolean(instagramUserId) ||
    ctaType === 'INSTAGRAM_MESSAGE' ||
    ctaValue?.app_destination === 'INSTAGRAM_DIRECT';

  const linkData = {
    image_hash: imageHash,
    message: body,
    call_to_action: callToAction,
  };

  // Click-to-Instagram não usa link de página; CTA aponta para o Direct.
  if (!isInstagramDirect) {
    linkData.link = linkUrl;
    linkData.name = title;
    const description = String(creativeInput.description || '').trim();
    if (description) linkData.description = description;
  } else {
    linkData.link = linkUrl || 'https://www.instagram.com/';
    // Meta limita welcome message a 300 caracteres (não usar o texto longo do anúncio)
    const welcomeRaw = String(
      creativeInput.pageWelcomeMessage || 'Olá! Como posso ajudar?'
    ).trim();
    linkData.page_welcome_message = welcomeRaw.slice(0, 300);
  }

  const objectStorySpec = {
    page_id: String(pageId),
    link_data: linkData,
  };

  // Marketing API: só instagram_user_id (instagram_actor_id está deprecated)
  if (instagramUserId) {
    objectStorySpec.instagram_user_id = String(instagramUserId);
  }

  const creativePayload = {
    name: creativeName,
    object_story_spec: objectStorySpec,
  };

  const metaCreative = await metaMarketingClient.createAdCreative(
    adAccountId,
    accessToken,
    creativePayload
  );

  if (!metaCreative?.id) {
    logger.error('Criativo Meta sem id', {
      companyId,
      adAccountId,
      response: metaCreative || null,
    });
    throw new AppError('Falha ao criar criativo na Meta', {
      statusCode: 502,
      code: 'META_MARKETING_ERROR',
    });
  }

  let creative;
  try {
    creative = await adCreativeRepository.upsertByMetaCreativeId({
      companyId,
      adAccountId,
      metaCreativeId: String(metaCreative.id),
      name: creativeName,
      title,
      body,
      imageHash,
      ctaType,
      status: 'ACTIVE',
    });
  } catch (error) {
    const cleaned = await cleanupCreativeResource({
      companyId,
      accessToken,
      creativeId: null,
      metaCreativeId: String(metaCreative.id),
      flow: 'CREATIVE_LOCAL_PERSIST',
    });
    if (!cleaned) {
      markCleanupRequired(error, {
        metaCreativeId: String(metaCreative.id),
        operation: 'CREATE_CREATIVE',
      });
    }
    throw error;
  }

  return { creative, metaCreative };
}

async function createAdAndPersist({
  companyId,
  adAccountId,
  accessToken,
  adSetId,
  metaAdSetId,
  creativeId,
  metaCreativeId,
  campaignName,
  creativeInput,
}) {
  const adName = String(
    creativeInput.adName || `Anúncio ${campaignName}`
  ).trim();
  let metaAd = null;
  try {
    metaAd = await metaMarketingClient.createAd(adAccountId, accessToken, {
      name: adName,
      adset_id: metaAdSetId,
      creative: { creative_id: metaCreativeId },
      status: 'PAUSED',
    });

    if (!metaAd?.id) {
      const graphError = metaAd?.error || null;
      logger.error('Anúncio Meta sem id', {
        companyId,
        adAccountId,
        metaAdSetId,
        metaCreativeId,
        response: metaAd || null,
      });

      const userMsg =
        graphError?.error_user_msg ||
        graphError?.error_user_title ||
        graphError?.message ||
        null;

      if (
        graphError?.code === 31 ||
        graphError?.error_subcode === 3858385 ||
        /autentique sua conta|pending action|authenticate/i.test(
          String(userMsg || '')
        )
      ) {
        throw new AppError(
          userMsg ||
            'A Meta bloqueou a criação de anúncios: autentique sua conta no Gerenciador de Anúncios e tente de novo.',
          {
            statusCode: 403,
            code: 'META_AD_ACCOUNT_AUTH_REQUIRED',
          }
        );
      }

      throw new AppError(userMsg || 'Falha ao criar anúncio na Meta', {
        statusCode: 502,
        code: 'META_MARKETING_ERROR',
      });
    }

    const ad = await adRepository.upsertByMetaAdId({
      companyId,
      adSetId,
      creativeId,
      metaAdId: String(metaAd.id),
      name: adName,
      status: 'PAUSED',
    });

    return ad;
  } catch (error) {
    let canRemoveCreative = !error?.ambiguous;
    if (metaAd?.id) {
      canRemoveCreative = await cleanupAdResource({
        companyId,
        accessToken,
        metaAdId: String(metaAd.id),
        flow: 'CREATE_AD',
      });
      if (!canRemoveCreative) {
        markCleanupRequired(error, {
          metaAdId: String(metaAd.id),
          metaCreativeId: String(metaCreativeId),
          operation: 'CREATE_AD',
        });
      }
    }

    if (canRemoveCreative) {
      const creativeCleaned = await cleanupCreativeResource({
        companyId,
        accessToken,
        creativeId,
        metaCreativeId: String(metaCreativeId),
        flow: 'CREATE_AD',
      });
      if (!creativeCleaned) {
        markCleanupRequired(error, {
          metaCreativeId: String(metaCreativeId),
          operation: 'CREATE_AD',
        });
      }
    } else if (error?.ambiguous) {
      markCleanupRequired(error, {
        metaCreativeId: String(metaCreativeId),
        operation: 'CREATE_AD_AMBIGUOUS',
      });
    }

    throw error;
  }
}

async function cleanupFailedCampaign({
  companyId,
  campaign,
  metaCampaign,
  accessToken,
  flow,
}) {
  let remoteCleanupSucceeded = !metaCampaign?.id;
  let localCleanupSucceeded = !campaign?.id;

  if (metaCampaign?.id) {
    try {
      await metaMarketingClient.deleteCampaign(metaCampaign.id, accessToken);
      remoteCleanupSucceeded = true;
    } catch (cleanupError) {
      logger.error('Falha ao limpar campanha Meta após erro', {
        companyId,
        flow,
        metaCampaignId: metaCampaign.id,
        detail: cleanupError.message,
      });
    }
  }

  // Preserva o registro local quando a remoção remota falha para permitir
  // reconciliação posterior e evitar perder os IDs dos recursos órfãos.
  if (campaign?.id && remoteCleanupSucceeded) {
    try {
      await campaignRepository.deleteCascade(companyId, campaign.id);
      localCleanupSucceeded = true;
    } catch (cleanupError) {
      logger.error('Falha ao limpar campanha local após erro', {
        companyId,
        flow,
        campaignId: campaign.id,
        detail: cleanupError.message,
      });
    }
  }

  return {
    cleanupRequired: !remoteCleanupSucceeded || !localCleanupSucceeded,
  };
}

function parseStoredJson(value) {
  if (value == null || typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function hashPublicationRequest(input) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(input || {}))
    .digest('hex');
}

async function runIdempotentPublication({
  companyId,
  idempotencyKey,
  storedKey,
  requestPayload,
  publish,
  campaignId,
}) {
  const key = String(idempotencyKey || '').trim();
  if (!key) return publish();
  if (key.length > 128) {
    throw new AppError('Idempotency-Key deve ter no máximo 128 caracteres', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  const requestHash = hashPublicationRequest(requestPayload);
  const publication = await campaignPublicationRepository.begin({
    companyId,
    idempotencyKey: storedKey || key,
    requestHash,
  });

  if (!publication.created) {
    const existing = publication.row;
    if (!existing || existing.request_hash !== requestHash) {
      throw new AppError('Idempotency-Key já usada com outro payload', {
        statusCode: 409,
        code: 'IDEMPOTENCY_KEY_REUSED',
      });
    }
    if (existing.status === 'COMPLETED') {
      const storedResult = parseStoredJson(existing.result);
      if (storedResult) return storedResult;
    }
    if (existing.status === 'FAILED') {
      const restarted = await campaignPublicationRepository.restartFailed(
        companyId,
        existing.id
      );
      if (restarted) {
        publication.created = true;
        publication.row = restarted;
      }
    }
    if (!publication.created) {
      throw new AppError('Publicação já iniciada com esta chave', {
        statusCode: 409,
        code:
          existing.status === 'IN_PROGRESS'
            ? 'PUBLICATION_IN_PROGRESS'
            : 'PUBLICATION_REQUIRES_RECONCILIATION',
      });
    }
  }

  try {
    const result = await publish();
    await campaignPublicationRepository.complete(companyId, publication.row.id, {
      campaignId: campaignId ?? result.campaign?.id ?? null,
      result,
    });
    return result;
  } catch (error) {
    await campaignPublicationRepository.fail(
      companyId,
      publication.row.id,
      error,
      { cleanupRequired: Boolean(error?.cleanupRequired) }
    );
    throw error;
  }
}

function adPublicationKey(campaignId, idempotencyKey) {
  const digest = crypto
    .createHash('sha256')
    .update(String(idempotencyKey || ''))
    .digest('hex');
  return `ad:${campaignId}:${digest}`;
}

function parseJsonObject(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function resolveInstagramUserId(companyId, page, pageAccessToken) {
  requireInstagramAppConfig();
  let instagramUserId = null;

  try {
    const response = await metaGraphClient.getPageInstagram(
      page.page_id,
      pageAccessToken
    );
    if (response?.instagram_business_account?.id) {
      instagramUserId = String(response.instagram_business_account.id);
      await metaInstagramRepository.upsert({
        companyId,
        instagramId: instagramUserId,
        username: response.instagram_business_account.username || null,
      });
    }
  } catch (error) {
    logger.error('Falha ao resolver Instagram da página para anúncio', {
      companyId,
      pageId: page.page_id,
      detail: error?.message || null,
    });
  }

  if (!instagramUserId) {
    const accounts = await metaInstagramRepository.findByCompanyId(companyId);
    instagramUserId = accounts[0]?.instagram_id
      ? String(accounts[0].instagram_id)
      : null;
  }

  if (!instagramUserId) {
    throw new AppError(
      'Nenhuma conta Instagram vinculada à Página selecionada. Vincule o Instagram e sincronize os ativos.',
      {
        statusCode: 400,
        code: 'INSTAGRAM_ACCOUNT_MISSING',
      }
    );
  }

  return instagramUserId;
}

export const metaAdsBuilderService = {
  async listLeadForms(companyId) {
    await assertCompany(companyId);
    const rows = await leadFormRepository.findByCompanyId(companyId);
    return rows.map(toPublicLeadForm);
  },

  async createLeadForm(companyId, input) {
    await assertCompany(companyId);
    const { page, pageAccessToken } = await getPageWithToken(
      companyId,
      input.pageId
    );

    const questions = buildLeadQuestions({
      questions: input.questions || [],
      fields: input.fields || [],
      customQuestions: input.customQuestions || [],
    });

    const privacyUrl = String(input.privacyPolicyUrl || '').trim();
    if (!privacyUrl.startsWith('http')) {
      throw new AppError('URL da política de privacidade é obrigatória', {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }

    const followUpUrl = String(
      input.followUpActionUrl || input.follow_up_action_url || privacyUrl
    ).trim();
    if (!followUpUrl.startsWith('http')) {
      throw new AppError('URL de follow-up (FollowUpActionURL) é obrigatória', {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }

    const name = String(input.name || input.title || 'Formulário de leads').trim();
    const uniqueName = input.skipUniqueSuffix
      ? name
      : `${name} · ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`;

    const payload = {
      name: uniqueName,
      locale: input.locale || 'pt_BR',
      questions,
      follow_up_action_url: followUpUrl,
      privacy_policy: {
        url: privacyUrl,
        link_text: input.privacyPolicyLinkText || 'Política de Privacidade',
      },
    };

    if (input.thankYouTitle || input.thankYouBody) {
      payload.thank_you_page = {
        title: input.thankYouTitle || 'Obrigado!',
        body: input.thankYouBody || 'Recebemos seus dados. Em breve entraremos em contato.',
        button_text: input.thankYouButtonText || 'Fechar',
        button_type: 'CLOSE',
      };
    }

    logger.info('Criando lead form Meta', { companyId, pageId: page.page_id });

    const created = await metaMarketingClient.createLeadForm(
      page.page_id,
      pageAccessToken,
      payload
    );

    if (!created?.id) {
      throw new AppError('Meta não retornou form_id', {
        statusCode: 502,
        code: 'META_MARKETING_ERROR',
      });
    }

    const row = await leadFormRepository.create({
      companyId,
      pageId: String(page.page_id),
      formId: String(created.id),
      name: uniqueName,
      status: 'ACTIVE',
      questions,
    });

    return toPublicLeadForm(row);
  },

  async createFullCampaign(companyId, input, { idempotencyKey } = {}) {
    const publish = async () => {
      const objective = input.objective || CampaignObjective.LEAD_GENERATION;

      if (objective === CampaignObjective.MESSAGES) {
        return this.createMessagesCampaign(companyId, input);
      }
      if (objective === CampaignObjective.TRAFFIC) {
        return this.createTrafficCampaign(companyId, input);
      }
      return this.createLeadAdsCampaign(companyId, input);
    };

    return runIdempotentPublication({
      companyId,
      idempotencyKey,
      requestPayload: input,
      publish,
    });
  },

  async addAdToCampaign(
    companyId,
    campaignId,
    input,
    { idempotencyKey } = {}
  ) {
    if (!String(idempotencyKey || '').trim()) {
      throw new AppError('Idempotency-Key é obrigatória para criar anúncios', {
        statusCode: 400,
        code: 'IDEMPOTENCY_KEY_REQUIRED',
      });
    }

    const publish = async () => {
      await assertCompany(companyId);

      const campaign = await campaignRepository.findById(companyId, campaignId);
      if (!campaign) {
        throw new AppError('Campanha não encontrada', {
          statusCode: 404,
          code: 'CAMPAIGN_NOT_FOUND',
        });
      }
      if (
        campaign.ad_account_id === 'act_demo_1n_local' ||
        String(campaign.campaign_id || '').startsWith('demo_1n_company_')
      ) {
        throw new AppError(
          'Campanhas de demonstração local não podem publicar anúncios na Meta.',
          { statusCode: 400, code: 'LOCAL_DEMO_CAMPAIGN' }
        );
      }
      if (!campaign.campaign_id) {
        throw new AppError('Campanha sem ID Meta', {
          statusCode: 400,
          code: 'CAMPAIGN_META_ID_MISSING',
        });
      }

      const adSet = await adSetRepository.findByCampaignAndId(
        companyId,
        campaign.id,
        input.adSetId
      );
      if (!adSet) {
        throw new AppError('Ad Set não encontrado nesta campanha', {
          statusCode: 404,
          code: 'AD_SET_NOT_FOUND',
        });
      }
      if (!adSet.meta_adset_id) {
        throw new AppError('Ad Set sem ID Meta', {
          statusCode: 400,
          code: 'AD_SET_META_ID_MISSING',
        });
      }

      const adAccountId = await assertAdAccount(
        companyId,
        campaign.ad_account_id
      );
      const accessToken = await getUserToken(companyId);
      const { page, pageAccessToken } = await getPageWithToken(
        companyId,
        input.pageId
      );
      const targeting = parseJsonObject(adSet.targeting);
      const configuredPageId = String(targeting.pageId || '').trim();
      if (configuredPageId && configuredPageId !== String(page.page_id)) {
        throw new AppError('A Página selecionada não pertence a este Ad Set', {
          statusCode: 400,
          code: 'AD_SET_PAGE_MISMATCH',
        });
      }

      const objective = String(campaign.objective || '').toUpperCase();
      const creativeInput = {
        ...input.creative,
        adName: input.name,
        name: input.creative.name || `Criativo ${input.name}`,
      };
      let ctaType;
      let ctaValue;
      let linkUrl;
      let instagramUserId = null;

      if (objective === CampaignObjective.LEAD_GENERATION) {
        const leadForm = await leadFormRepository.findById(
          companyId,
          input.leadFormId
        );
        if (!leadForm?.form_id) {
          throw new AppError('Formulário Meta não encontrado', {
            statusCode: 404,
            code: 'LEAD_FORM_NOT_FOUND',
          });
        }
        if (String(leadForm.page_id) !== String(page.page_id)) {
          throw new AppError('O formulário não pertence à Página selecionada', {
            statusCode: 400,
            code: 'LEAD_FORM_PAGE_MISMATCH',
          });
        }
        linkUrl = resolveLeadAdsExternalLink({
          creativeLink: creativeInput.linkUrl,
        });
        ctaType = String(creativeInput.cta || 'SIGN_UP');
        ctaValue = {
          lead_gen_form_id: String(leadForm.form_id),
          link: linkUrl,
        };
      } else if (objective === CampaignObjective.TRAFFIC) {
        linkUrl = String(creativeInput.linkUrl || '').trim();
        if (!linkUrl.startsWith('http')) {
          throw new AppError('URL do site é obrigatória', {
            statusCode: 400,
            code: 'VALIDATION_ERROR',
          });
        }
        ctaType = String(creativeInput.cta || 'LEARN_MORE');
      } else if (objective === CampaignObjective.MESSAGES) {
        const channel = String(targeting.messageChannel || '').toUpperCase();
        if (channel !== 'WHATSAPP' && channel !== 'INSTAGRAM') {
          throw new AppError(
            'O Ad Set não possui um canal de mensagens válido.',
            { statusCode: 400, code: 'AD_SET_CHANNEL_MISSING' }
          );
        }

        if (channel === 'WHATSAPP') {
          const phone = String(
            input.whatsappPhoneNumber || targeting.whatsappPhoneNumber || ''
          ).trim();
          const whatsapp =
            await metaWhatsappRepository.findByCompanyAndPhoneDigits(
              companyId,
              phone
            );
          if (!whatsapp) {
            throw new AppError(
              'O número do WhatsApp não pertence aos ativos Meta desta empresa.',
              { statusCode: 400, code: 'WHATSAPP_ACCOUNT_MISSING' }
            );
          }
          ctaType = 'WHATSAPP_MESSAGE';
          ctaValue = { whatsapp_phone_number: phone };
          linkUrl = `https://www.facebook.com/${page.page_id}`;
        } else {
          instagramUserId = await resolveInstagramUserId(
            companyId,
            page,
            pageAccessToken
          );
          ctaType = 'INSTAGRAM_MESSAGE';
          ctaValue = { app_destination: 'INSTAGRAM_DIRECT' };
          linkUrl = 'https://www.instagram.com/';
        }
      } else {
        throw new AppError('Objetivo da campanha não suportado', {
          statusCode: 400,
          code: 'CAMPAIGN_OBJECTIVE_UNSUPPORTED',
        });
      }

      const { creative, metaCreative } = await createCreativeAndPersist({
        companyId,
        adAccountId,
        accessToken,
        pageId: page.page_id,
        campaignName: campaign.name,
        creativeInput,
        ctaType,
        linkUrl,
        ctaValue,
        instagramUserId,
        defaultTitle:
          objective === CampaignObjective.MESSAGES
            ? 'Fale conosco'
            : objective === CampaignObjective.TRAFFIC
              ? 'Saiba mais'
              : 'Solicite orçamento',
        defaultBody:
          objective === CampaignObjective.MESSAGES
            ? 'Envie uma mensagem e tire suas dúvidas.'
            : objective === CampaignObjective.TRAFFIC
              ? 'Acesse nosso site e confira.'
              : 'Preencha o formulário',
      });

      const ad = await createAdAndPersist({
        companyId,
        adAccountId,
        accessToken,
        adSetId: adSet.id,
        metaAdSetId: adSet.meta_adset_id,
        creativeId: creative.id,
        metaCreativeId: metaCreative.id,
        campaignName: campaign.name,
        creativeInput,
      });

      const publicCreative = toPublicAdCreative(creative);
      const publicAd = {
        ...toPublicAd(ad),
        metaAdsetId: adSet.meta_adset_id,
        creative: publicCreative,
      };

      logger.info('Anúncio adicionado à campanha existente', {
        companyId,
        campaignId: campaign.id,
        metaCampaignId: campaign.campaign_id,
        adSetId: adSet.id,
        metaAdsetId: adSet.meta_adset_id,
        adId: ad.id,
        metaAdId: ad.meta_ad_id,
      });

      return {
        campaign: toPublicCampaign(campaign),
        adSet: toPublicAdSet(adSet),
        creative: publicCreative,
        ad: publicAd,
      };
    };

    return runIdempotentPublication({
      companyId,
      idempotencyKey,
      storedKey: idempotencyKey
        ? adPublicationKey(campaignId, idempotencyKey)
        : null,
      requestPayload: { campaignId, ...input },
      publish,
      campaignId,
    });
  },

  async createLeadAdsCampaign(companyId, input) {
    await assertCompany(companyId);

    const adAccountId = await assertAdAccount(companyId, input.adAccountId);
    const accessToken = await getUserToken(companyId);
    const { page } = await getPageWithToken(companyId, input.pageId);

    const campaignName = String(input.name || '').trim();
    if (campaignName.length < 3) {
      throw new AppError('Nome da campanha inválido', {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }

    const budgetCents = toMetaBudgetCents(input.budget ?? input.dailyBudget);
    const formInput = input.form || {};
    const audience = input.audience || {};
    const adSpecs = normalizeCampaignAds(input);

    logger.info('Ads Builder: Lead Ads', { companyId, adAccountId });
    let metaCampaign = null;
    let campaign = null;

    try {
    metaCampaign = await metaMarketingClient.createCampaign(
      adAccountId,
      accessToken,
      {
        name: campaignName,
        objective: META_OBJECTIVE_BY_PRODUCT[CampaignObjective.LEAD_GENERATION],
        status: CampaignStatus.PAUSED,
        special_ad_categories: [],
        daily_budget: budgetCents,
        is_adset_budget_sharing_enabled: false,
      }
    );

    if (!metaCampaign?.id) {
      throw new AppError('Falha ao criar campanha na Meta', {
        statusCode: 502,
        code: 'META_MARKETING_ERROR',
      });
    }

    campaign = await campaignRepository.create({
      companyId,
      adAccountId,
      campaignId: String(metaCampaign.id),
      name: campaignName,
      objective: CampaignObjective.LEAD_GENERATION,
      status: CampaignStatus.PAUSED,
      dailyBudget: Number(input.budget ?? input.dailyBudget),
    });

    const form = await this.createLeadForm(companyId, {
      pageId: page.page_id,
      name: formInput.title || formInput.name || `Formulário ${campaignName}`,
      questions: formInput.questions || [],
      fields: formInput.fields || [],
      customQuestions: formInput.customQuestions || [],
      privacyPolicyUrl: formInput.privacyPolicyUrl,
      privacyPolicyLinkText: formInput.privacyPolicyLinkText,
      followUpActionUrl:
        formInput.followUpActionUrl || formInput.privacyPolicyUrl,
      thankYouTitle: formInput.thankYouTitle,
      thankYouBody: formInput.thankYouBody,
    });

    const { targeting, cityHint } = buildTargeting(audience);
    const adSetName = String(audience.name || `Conjunto ${campaignName}`).trim();
    const bidAmountCents = resolveBidAmountCents(audience, budgetCents);

    const metaAdSet = await metaMarketingClient.createAdSet(
      adAccountId,
      accessToken,
      {
        name: adSetName,
        campaign_id: metaCampaign.id,
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'LEAD_GENERATION',
        // Obrigatório para formulário instantâneo (lead_gen_form_id no criativo)
        destination_type: 'ON_AD',
        bid_strategy: 'LOWEST_COST_WITH_BID_CAP',
        bid_amount: bidAmountCents,
        targeting,
        promoted_object: { page_id: String(page.page_id) },
        status: 'PAUSED',
      }
    );

    if (!metaAdSet?.id) {
      throw new AppError('Falha ao criar conjunto de anúncios na Meta', {
        statusCode: 502,
        code: 'META_MARKETING_ERROR',
      });
    }

    const adSet = await adSetRepository.create({
      companyId,
      campaignId: campaign.id,
      metaAdsetId: String(metaAdSet.id),
      name: adSetName,
      dailyBudget: null,
      targeting: {
        ...targeting,
        cityHint,
        pageId: String(page.page_id),
        leadFormId: form.id,
        metaLeadFormId: String(form.formId),
      },
      status: 'PAUSED',
    });

    const creatives = [];
    const ads = [];

    for (const spec of adSpecs) {
      const creativeInput = spec.creativeInput;
      const ctaType = String(
        creativeInput.cta || creativeInput.ctaType || 'SIGN_UP'
      );
      // Meta exige URL externa no criativo de Lead Ads (não pode ser facebook.com/Página)
      const externalLink = resolveLeadAdsExternalLink({
        followUpActionUrl:
          formInput.followUpActionUrl || formInput.privacyPolicyUrl,
        privacyPolicyUrl: formInput.privacyPolicyUrl,
        creativeLink: creativeInput.linkUrl || creativeInput.link,
      });
      const { creative, metaCreative } = await createCreativeAndPersist({
        companyId,
        adAccountId,
        accessToken,
        pageId: page.page_id,
        campaignName,
        creativeInput,
        ctaType,
        linkUrl: externalLink,
        ctaValue: {
          lead_gen_form_id: String(form.formId),
          link: externalLink,
        },
        defaultTitle: 'Solicite orçamento',
        defaultBody: 'Preencha o formulário',
      });

      const ad = await createAdAndPersist({
        companyId,
        adAccountId,
        accessToken,
        adSetId: adSet.id,
        metaAdSetId: metaAdSet.id,
        creativeId: creative.id,
        metaCreativeId: metaCreative.id,
        campaignName,
        creativeInput,
      });

      creatives.push(toPublicAdCreative(creative));
      ads.push(toPublicAd(ad));
    }

    return {
      campaign: toPublicCampaign(campaign),
      form,
      adSet: toPublicAdSet(adSet),
      adSets: [toPublicAdSet(adSet)],
      creative: creatives[0] || null,
      creatives,
      ad: ads[0] || null,
      ads,
    };
    } catch (error) {
      logger.error('Ads Builder Lead Ads falhou', {
        companyId,
        detail: error?.message || null,
        code: error?.code || null,
      });
      const cleanup = await cleanupFailedCampaign({
        companyId,
        campaign,
        metaCampaign,
        accessToken,
        flow: 'LEAD_GENERATION',
      });
      error.cleanupRequired = Boolean(
        error.cleanupRequired || cleanup.cleanupRequired
      );
      throw error;
    }
  },

  async createMessagesCampaign(companyId, input) {
    await assertCompany(companyId);

    const channels = (() => {
      if (Array.isArray(input.messageChannels) && input.messageChannels.length) {
        return [
          ...new Set(
            input.messageChannels.map((c) => String(c).toUpperCase())
          ),
        ].filter((c) => c === 'WHATSAPP' || c === 'INSTAGRAM');
      }
      const single = String(input.messageChannel || '').toUpperCase();
      return single === 'WHATSAPP' || single === 'INSTAGRAM' ? [single] : [];
    })();

    if (channels.length === 0) {
      throw new AppError(
        'Selecione ao menos um canal: WhatsApp e/ou Instagram.',
        { statusCode: 400, code: 'VALIDATION_ERROR' }
      );
    }

    if (channels.includes('WHATSAPP')) {
      const phone = String(input.whatsappPhoneNumber || '').trim();
      if (!phone) {
        throw new AppError('Número WhatsApp é obrigatório', {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
        });
      }
    }

    let instagramUserId = null;
    if (channels.includes('INSTAGRAM')) {
      requireInstagramAppConfig();
    }

    const adAccountId = await assertAdAccount(companyId, input.adAccountId);
    // Marketing API exige token Facebook (Login Meta). Token IG (IGAAA...) NÃO serve.
    const accessToken = await getUserToken(companyId);
    const { page, pageAccessToken } = await getPageWithToken(
      companyId,
      input.pageId
    );

    if (channels.includes('INSTAGRAM')) {
      // Resolve IG da Página selecionada (ID fresco), com fallback do sync local
      try {
        const igResponse = await metaGraphClient.getPageInstagram(
          page.page_id,
          pageAccessToken
        );
        if (igResponse?.instagram_business_account?.id) {
          instagramUserId = String(igResponse.instagram_business_account.id);
          await metaInstagramRepository.upsert({
            companyId,
            instagramId: instagramUserId,
            username: igResponse.instagram_business_account.username || null,
          });
        }
      } catch (error) {
        logger.error('Falha ao resolver Instagram da página para anúncio', {
          companyId,
          pageId: page.page_id,
          detail: error?.message || null,
        });
      }

      if (!instagramUserId) {
        const igAccounts =
          await metaInstagramRepository.findByCompanyId(companyId);
        instagramUserId = igAccounts[0]?.instagram_id
          ? String(igAccounts[0].instagram_id)
          : null;
      }

      if (!instagramUserId) {
        throw new AppError(
          'Nenhuma conta Instagram vinculada à Página selecionada. Vincule o IG à Página e sincronize em Conexão Meta.',
          {
            statusCode: 400,
            code: 'INSTAGRAM_ACCOUNT_MISSING',
          }
        );
      }

      logger.info('Ads Builder: Instagram user id', {
        companyId,
        pageId: page.page_id,
        instagramUserId,
      });
    }

    const campaignName = String(input.name || '').trim();
    if (campaignName.length < 3) {
      throw new AppError('Nome da campanha inválido', {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }

    const budgetCents = toMetaBudgetCents(input.budget ?? input.dailyBudget);
    const audience = input.audience || {};
    const normalizedAds = normalizeCampaignAds(input);

    logger.info('Ads Builder: Messages', { companyId, channels });

    let metaCampaign = null;
    let campaign = null;

    try {
      metaCampaign = await metaMarketingClient.createCampaign(
        adAccountId,
        accessToken,
        {
          name: campaignName,
          objective: META_OBJECTIVE_BY_PRODUCT[CampaignObjective.MESSAGES],
          status: CampaignStatus.PAUSED,
          special_ad_categories: [],
          daily_budget: budgetCents,
          is_adset_budget_sharing_enabled: false,
        }
      );

      if (!metaCampaign?.id) {
        throw new AppError('Falha ao criar campanha na Meta', {
          statusCode: 502,
          code: 'META_MARKETING_ERROR',
        });
      }

      campaign = await campaignRepository.create({
        companyId,
        adAccountId,
        campaignId: String(metaCampaign.id),
        name: campaignName,
        objective: CampaignObjective.MESSAGES,
        status: CampaignStatus.PAUSED,
        dailyBudget: Number(input.budget ?? input.dailyBudget),
      });

      const { targeting, cityHint } = buildTargeting(audience);
      const bidAmountCents = resolveBidAmountCents(audience, budgetCents);
      const baseAdSetName = String(
        audience.name || `Conjunto ${campaignName}`
      ).trim();

      const adSets = [];
      const creatives = [];
      const ads = [];

      const adsByChannel = new Map(channels.map((channel) => [channel, []]));
      if (Array.isArray(input.ads) && input.ads.length > 0) {
        for (const spec of normalizedAds) {
          const channel = spec.messageChannel || channels[0];
          adsByChannel.get(channel)?.push(spec);
        }
      } else {
        // Compatibilidade: o Creative singular gera um Ad para cada canal.
        for (const channel of channels) {
          adsByChannel.get(channel).push(normalizedAds[0]);
        }
      }

      for (const channel of channels) {
        const channelAdSpecs = adsByChannel.get(channel) || [];
        if (channelAdSpecs.length === 0) continue;
        const promotedObject = { page_id: String(page.page_id) };
        let destinationType = 'INSTAGRAM_DIRECT';
        let ctaType = 'INSTAGRAM_MESSAGE';
        let ctaValue = { app_destination: 'INSTAGRAM_DIRECT' };
        let linkUrl = 'https://www.instagram.com/';
        let channelInstagramUserId = null;

        if (channel === 'WHATSAPP') {
          promotedObject.whatsapp_phone_number = String(
            input.whatsappPhoneNumber
          ).trim();
          destinationType = 'WHATSAPP';
          ctaType = 'WHATSAPP_MESSAGE';
          ctaValue = {
            whatsapp_phone_number: String(input.whatsappPhoneNumber).trim(),
          };
          linkUrl = `https://www.facebook.com/${page.page_id}`;
        } else {
          channelInstagramUserId = instagramUserId;
        }

        const adSetName = `${baseAdSetName} · ${channel}`;

        const metaAdSet = await metaMarketingClient.createAdSet(
          adAccountId,
          accessToken,
          {
            name: adSetName,
            campaign_id: metaCampaign.id,
            billing_event: 'IMPRESSIONS',
            optimization_goal: 'CONVERSATIONS',
            destination_type: destinationType,
            bid_strategy: 'LOWEST_COST_WITH_BID_CAP',
            bid_amount: bidAmountCents,
            targeting,
            promoted_object: promotedObject,
            status: 'PAUSED',
          }
        );

        if (!metaAdSet?.id) {
          throw new AppError(
            `Falha ao criar conjunto de anúncios (${channel}) na Meta`,
            { statusCode: 502, code: 'META_MARKETING_ERROR' }
          );
        }

        const adSet = await adSetRepository.upsertByMetaAdsetId({
          companyId,
          campaignId: campaign.id,
          metaAdsetId: String(metaAdSet.id),
          name: adSetName,
          dailyBudget: null,
          targeting: {
            ...targeting,
            cityHint,
            messageChannel: channel,
            pageId: String(page.page_id),
            ...(channel === 'WHATSAPP'
              ? { whatsappPhoneNumber: String(input.whatsappPhoneNumber).trim() }
              : {}),
          },
          status: 'PAUSED',
        });

        adSets.push(toPublicAdSet(adSet));

        for (const spec of channelAdSpecs) {
          const creativeInput = spec.creativeInput;
          const { creative, metaCreative } = await createCreativeAndPersist({
            companyId,
            adAccountId,
            accessToken,
            pageId: page.page_id,
            campaignName: `${campaignName} ${channel}`,
            creativeInput,
            ctaType: creativeInput.cta || creativeInput.ctaType || ctaType,
            linkUrl,
            ctaValue,
            instagramUserId: channelInstagramUserId,
            defaultTitle: 'Fale conosco',
            defaultBody: 'Envie uma mensagem e tire suas dúvidas.',
          });

          const ad = await createAdAndPersist({
            companyId,
            adAccountId,
            accessToken,
            adSetId: adSet.id,
            metaAdSetId: metaAdSet.id,
            creativeId: creative.id,
            metaCreativeId: metaCreative.id,
            campaignName: `${campaignName} ${channel}`,
            creativeInput,
          });

          creatives.push(toPublicAdCreative(creative));
          ads.push(toPublicAd(ad));
        }
      }

      return {
        campaign: toPublicCampaign(campaign),
        form: null,
        adSet: adSets[0] || null,
        adSets,
        creative: creatives[0] || null,
        creatives,
        ad: ads[0] || null,
        ads,
        channels,
      };
    } catch (error) {
      logger.error('Ads Builder Messages falhou', {
        companyId,
        channels,
        detail: error?.message || null,
        code: error?.code || null,
      });

      const cleanup = await cleanupFailedCampaign({
        companyId,
        campaign,
        metaCampaign,
        accessToken,
        flow: 'MESSAGES',
      });
      error.cleanupRequired = Boolean(
        error.cleanupRequired || cleanup.cleanupRequired
      );

      throw error;
    }
  },

  async createTrafficCampaign(companyId, input) {
    await assertCompany(companyId);

    const adAccountId = await assertAdAccount(companyId, input.adAccountId);
    const accessToken = await getUserToken(companyId);
    const { page } = await getPageWithToken(companyId, input.pageId);

    const campaignName = String(input.name || '').trim();
    if (campaignName.length < 3) {
      throw new AppError('Nome da campanha inválido', {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }

    const adSpecs = normalizeCampaignAds(input);
    const linkUrl = String(
      adSpecs[0]?.creativeInput?.linkUrl || input.websiteUrl || ''
    ).trim();
    if (!linkUrl.startsWith('http')) {
      throw new AppError('URL do site é obrigatória', {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }

    const budgetCents = toMetaBudgetCents(input.budget ?? input.dailyBudget);
    const audience = input.audience || {};

    logger.info('Ads Builder: Traffic', { companyId, linkUrl });

    let metaCampaign = null;
    let campaign = null;

    try {
    metaCampaign = await metaMarketingClient.createCampaign(
      adAccountId,
      accessToken,
      {
        name: campaignName,
        objective: META_OBJECTIVE_BY_PRODUCT[CampaignObjective.TRAFFIC],
        status: CampaignStatus.PAUSED,
        special_ad_categories: [],
        daily_budget: budgetCents,
        is_adset_budget_sharing_enabled: false,
      }
    );

    if (!metaCampaign?.id) {
      throw new AppError('Falha ao criar campanha na Meta', {
        statusCode: 502,
        code: 'META_MARKETING_ERROR',
      });
    }

    campaign = await campaignRepository.create({
      companyId,
      adAccountId,
      campaignId: String(metaCampaign.id),
      name: campaignName,
      objective: CampaignObjective.TRAFFIC,
      status: CampaignStatus.PAUSED,
      dailyBudget: Number(input.budget ?? input.dailyBudget),
    });

    const { targeting, cityHint } = buildTargeting(audience);
    const bidAmountCents = resolveBidAmountCents(audience, budgetCents);
    const adSetName = String(audience.name || `Conjunto ${campaignName}`).trim();

    const metaAdSet = await metaMarketingClient.createAdSet(
      adAccountId,
      accessToken,
      {
        name: adSetName,
        campaign_id: metaCampaign.id,
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'LINK_CLICKS',
        bid_strategy: 'LOWEST_COST_WITH_BID_CAP',
        bid_amount: bidAmountCents,
        targeting,
        promoted_object: { page_id: String(page.page_id) },
        status: 'PAUSED',
      }
    );

    if (!metaAdSet?.id) {
      throw new AppError('Falha ao criar conjunto de anúncios na Meta', {
        statusCode: 502,
        code: 'META_MARKETING_ERROR',
      });
    }

    const adSet = await adSetRepository.create({
      companyId,
      campaignId: campaign.id,
      metaAdsetId: String(metaAdSet.id),
      name: adSetName,
      dailyBudget: null,
      targeting: {
        ...targeting,
        cityHint,
        websiteUrl: linkUrl,
        pageId: String(page.page_id),
      },
      status: 'PAUSED',
    });

    const creatives = [];
    const ads = [];

    for (const spec of adSpecs) {
      const creativeInput = spec.creativeInput;
      const creativeLinkUrl = String(
        creativeInput.linkUrl || input.websiteUrl || ''
      ).trim();
      const { creative, metaCreative } = await createCreativeAndPersist({
        companyId,
        adAccountId,
        accessToken,
        pageId: page.page_id,
        campaignName,
        creativeInput,
        ctaType: creativeInput.cta || creativeInput.ctaType || 'LEARN_MORE',
        linkUrl: creativeLinkUrl,
        defaultTitle: 'Saiba mais',
        defaultBody: 'Acesse nosso site e confira.',
      });

      const ad = await createAdAndPersist({
        companyId,
        adAccountId,
        accessToken,
        adSetId: adSet.id,
        metaAdSetId: metaAdSet.id,
        creativeId: creative.id,
        metaCreativeId: metaCreative.id,
        campaignName,
        creativeInput,
      });

      creatives.push(toPublicAdCreative(creative));
      ads.push(toPublicAd(ad));
    }

    return {
      campaign: toPublicCampaign(campaign),
      form: null,
      adSet: toPublicAdSet(adSet),
      adSets: [toPublicAdSet(adSet)],
      creative: creatives[0] || null,
      creatives,
      ad: ads[0] || null,
      ads,
    };
    } catch (error) {
      logger.error('Ads Builder Traffic falhou', {
        companyId,
        detail: error?.message || null,
        code: error?.code || null,
      });
      const cleanup = await cleanupFailedCampaign({
        companyId,
        campaign,
        metaCampaign,
        accessToken,
        flow: 'TRAFFIC',
      });
      error.cleanupRequired = Boolean(
        error.cleanupRequired || cleanup.cleanupRequired
      );
      throw error;
    }
  },
};
