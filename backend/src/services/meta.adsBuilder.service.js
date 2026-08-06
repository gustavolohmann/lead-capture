import { companyService } from './company.service.js';
import { metaMarketingClient } from './meta.marketing.client.js';
import { metaConnectionRepository } from '../repositories/meta.connection.repository.js';
import { metaPageRepository } from '../repositories/meta.page.repository.js';
import { metaAdAccountRepository } from '../repositories/meta.adAccount.repository.js';
import { leadFormRepository } from '../repositories/leadForm.repository.js';
import { adSetRepository } from '../repositories/adSet.repository.js';
import { adCreativeRepository } from '../repositories/adCreative.repository.js';
import { adRepository } from '../repositories/ad.repository.js';
import { campaignRepository } from '../repositories/campaign.repository.js';
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

  const creativePayload = {
    name: creativeName,
    object_story_spec: {
      page_id: String(pageId),
      link_data: {
        image_hash: imageHash,
        link: linkUrl,
        message: body,
        name: title,
        description:
          String(creativeInput.description || '').trim() || undefined,
        call_to_action: callToAction,
      },
    },
  };

  const metaCreative = await metaMarketingClient.createAdCreative(
    adAccountId,
    accessToken,
    creativePayload
  );

  if (!metaCreative?.id) {
    throw new AppError('Falha ao criar criativo na Meta', {
      statusCode: 502,
      code: 'META_MARKETING_ERROR',
    });
  }

  const creative = await adCreativeRepository.create({
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
  const metaAd = await metaMarketingClient.createAd(adAccountId, accessToken, {
    name: adName,
    adset_id: metaAdSetId,
    creative: { creative_id: metaCreativeId },
    status: 'PAUSED',
  });

  if (!metaAd?.id) {
    throw new AppError('Falha ao criar anúncio na Meta', {
      statusCode: 502,
      code: 'META_MARKETING_ERROR',
    });
  }

  const ad = await adRepository.create({
    companyId,
    adSetId,
    creativeId,
    metaAdId: String(metaAd.id),
    name: adName,
    status: 'PAUSED',
  });

  return ad;
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

  async createFullCampaign(companyId, input) {
    const objective = input.objective || CampaignObjective.LEAD_GENERATION;

    if (objective === CampaignObjective.MESSAGES) {
      return this.createMessagesCampaign(companyId, input);
    }
    if (objective === CampaignObjective.TRAFFIC) {
      return this.createTrafficCampaign(companyId, input);
    }
    return this.createLeadAdsCampaign(companyId, input);
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
    const creativeInput = input.creative || {};

    logger.info('Ads Builder: Lead Ads', { companyId, adAccountId });
    const metaCampaign = await metaMarketingClient.createCampaign(
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

    const campaign = await campaignRepository.create({
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
      targeting: { ...targeting, cityHint },
      status: 'PAUSED',
    });

    const ctaType = String(creativeInput.cta || creativeInput.ctaType || 'SIGN_UP');
    const { creative, metaCreative } = await createCreativeAndPersist({
      companyId,
      adAccountId,
      accessToken,
      pageId: page.page_id,
      campaignName,
      creativeInput,
      ctaType,
      linkUrl: `https://www.facebook.com/${page.page_id}`,
      ctaValue: { lead_gen_form_id: String(form.formId) },
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

    return {
      campaign: toPublicCampaign(campaign),
      form,
      adSet: toPublicAdSet(adSet),
      creative: toPublicAdCreative(creative),
      ad: toPublicAd(ad),
    };
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
    const audience = input.audience || {};
    const creativeInput = input.creative || {};

    logger.info('Ads Builder: Messages', { companyId, channels });

    const metaCampaign = await metaMarketingClient.createCampaign(
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

    const campaign = await campaignRepository.create({
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

    for (const channel of channels) {
      const promotedObject = { page_id: String(page.page_id) };
      let destinationType = 'INSTAGRAM_DIRECT';
      let ctaType = 'MESSAGE_PAGE';

      if (channel === 'WHATSAPP') {
        promotedObject.whatsapp_phone_number = String(
          input.whatsappPhoneNumber
        ).trim();
        destinationType = 'WHATSAPP';
        ctaType = 'WHATSAPP_MESSAGE';
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

      const adSet = await adSetRepository.create({
        companyId,
        campaignId: campaign.id,
        metaAdsetId: String(metaAdSet.id),
        name: adSetName,
        dailyBudget: null,
        targeting: { ...targeting, cityHint, messageChannel: channel },
        status: 'PAUSED',
      });

      const { creative, metaCreative } = await createCreativeAndPersist({
        companyId,
        adAccountId,
        accessToken,
        pageId: page.page_id,
        campaignName: `${campaignName} ${channel}`,
        creativeInput,
        ctaType: creativeInput.cta || creativeInput.ctaType || ctaType,
        linkUrl: `https://www.facebook.com/${page.page_id}`,
        ctaValue:
          channel === 'WHATSAPP'
            ? {
                whatsapp_phone_number: String(input.whatsappPhoneNumber).trim(),
              }
            : undefined,
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

      adSets.push(toPublicAdSet(adSet));
      creatives.push(toPublicAdCreative(creative));
      ads.push(toPublicAd(ad));
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

    const linkUrl = String(
      input.creative?.linkUrl || input.websiteUrl || ''
    ).trim();
    if (!linkUrl.startsWith('http')) {
      throw new AppError('URL do site é obrigatória', {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }

    const budgetCents = toMetaBudgetCents(input.budget ?? input.dailyBudget);
    const audience = input.audience || {};
    const creativeInput = input.creative || {};

    logger.info('Ads Builder: Traffic', { companyId, linkUrl });

    const metaCampaign = await metaMarketingClient.createCampaign(
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

    const campaign = await campaignRepository.create({
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
      targeting: { ...targeting, cityHint, websiteUrl: linkUrl },
      status: 'PAUSED',
    });

    const { creative, metaCreative } = await createCreativeAndPersist({
      companyId,
      adAccountId,
      accessToken,
      pageId: page.page_id,
      campaignName,
      creativeInput,
      ctaType: creativeInput.cta || creativeInput.ctaType || 'LEARN_MORE',
      linkUrl,
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

    return {
      campaign: toPublicCampaign(campaign),
      form: null,
      adSet: toPublicAdSet(adSet),
      creative: toPublicAdCreative(creative),
      ad: toPublicAd(ad),
    };
  },
};
