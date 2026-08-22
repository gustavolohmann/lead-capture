import { decrypt } from '../utils/encryption.js';
import { AppError } from '../utils/errors.js';
import { companyRepository } from '../repositories/company.repository.js';
import { metaConnectionRepository } from '../repositories/meta.connection.repository.js';
import { metaAdAccountRepository } from '../repositories/meta.adAccount.repository.js';
import { metaMarketingClient } from './meta.marketing.client.js';
import {
  DATE_PRESETS,
  DEFAULT_PURCHASE_ACTIONS,
  INSIGHT_LEVELS,
  buildInsightFields,
  compareSummaries,
  isValidIsoDate,
  normalizeMetaInsight,
  summarizeInsights,
} from './meta.insights.normalize.js';

function normalizeAdAccountId(adAccountId) {
  const id = String(adAccountId || '');
  return id.startsWith('act_') ? id : `act_${id}`;
}

function assertRemoteAdAccountId(adAccountId) {
  if (normalizeAdAccountId(adAccountId) === 'act_demo_1n_local') {
    throw new AppError(
      'Esta é uma conta de demonstração local e não possui métricas na Meta.',
      {
        statusCode: 400,
        code: 'LOCAL_DEMO_ACCOUNT',
      }
    );
  }
}

async function assertCompany(companyId) {
  const company = await companyRepository.findById(companyId);
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

async function assertAdAccount(companyId, adAccountId) {
  assertRemoteAdAccountId(adAccountId);
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

function resolvePeriod(query = {}) {
  const since = query.since ? String(query.since) : null;
  const until = query.until ? String(query.until) : null;
  const datePreset = query.datePreset || query.period || null;

  if (since || until) {
    if (!since || !until) {
      throw new AppError('Informe since e until juntos (YYYY-MM-DD).', {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }
    if (!isValidIsoDate(since) || !isValidIsoDate(until)) {
      throw new AppError('Datas inválidas. Use o formato YYYY-MM-DD.', {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }
    if (since > until) {
      throw new AppError('since não pode ser posterior a until.', {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }
    return {
      period: { type: 'timeRange', value: { since, until } },
      timeRange: { since, until },
      datePreset: null,
    };
  }

  const preset = String(datePreset || 'last_30d');
  if (!DATE_PRESETS.has(preset)) {
    throw new AppError(`datePreset inválido: ${preset}`, {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  return {
    period: { type: 'datePreset', value: preset },
    timeRange: null,
    datePreset: preset,
  };
}

function buildFiltering({ campaignId, adsetId, adId } = {}) {
  const filtering = [];
  if (campaignId) {
    filtering.push({
      field: 'campaign.id',
      operator: 'IN',
      value: [String(campaignId)],
    });
  }
  if (adsetId) {
    filtering.push({
      field: 'adset.id',
      operator: 'IN',
      value: [String(adsetId)],
    });
  }
  if (adId) {
    filtering.push({
      field: 'ad.id',
      operator: 'IN',
      value: [String(adId)],
    });
  }
  return filtering;
}

function resolveConversionTypes(query = {}) {
  if (query.conversionType === 'lead') {
    return ['lead', 'onsite_conversion.lead_grouped'];
  }
  if (query.conversionType === 'purchase' || !query.conversionType) {
    return DEFAULT_PURCHASE_ACTIONS;
  }
  return String(query.conversionType)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function fetchNormalizedInsights(companyId, query = {}) {
  await assertCompany(companyId);
  const adAccountId = await assertAdAccount(companyId, query.adAccountId);
  const accessToken = await getUserToken(companyId);

  const level = String(query.level || 'campaign');
  if (!INSIGHT_LEVELS.has(level)) {
    throw new AppError(`level inválido: ${level}`, {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  const { period, timeRange, datePreset } = resolvePeriod(query);
  const conversionActionTypes = resolveConversionTypes(query);
  const filtering = buildFiltering(query);

  const rawRows = await metaMarketingClient.getInsights(
    adAccountId,
    accessToken,
    {
      level,
      fields: buildInsightFields(),
      datePreset,
      timeRange,
      filtering,
      limit: query.limit,
      maxPages: query.maxPages,
      timeIncrement: query.timeIncrement || undefined,
    }
  );

  const data = rawRows.map((row) =>
    normalizeMetaInsight(row, { conversionActionTypes })
  );
  const summary = summarizeInsights(data, { conversionActionTypes });

  return {
    level,
    adAccountId,
    period,
    summary,
    data,
    conversionActionTypes,
  };
}

export const metaInsightsService = {
  async getInsights(companyId, query) {
    if (!query?.adAccountId) {
      throw new AppError('adAccountId é obrigatório.', {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }
    return fetchNormalizedInsights(companyId, query);
  },

  async getSummary(companyId, query) {
    const result = await this.getInsights(companyId, {
      ...query,
      level: query.level || 'account',
    });
    return {
      level: result.level,
      adAccountId: result.adAccountId,
      period: result.period,
      summary: result.summary,
    };
  },

  async listCampaigns(companyId, { adAccountId } = {}) {
    await assertCompany(companyId);
    const accountId = await assertAdAccount(companyId, adAccountId);
    const accessToken = await getUserToken(companyId);
    const response = await metaMarketingClient.listCampaigns(
      accountId,
      accessToken
    );
    const rows = Array.isArray(response?.data) ? response.data : [];
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status || null,
      effectiveStatus: row.effective_status || row.status || null,
      objective: row.objective || null,
      dailyBudget: row.daily_budget != null ? Number(row.daily_budget) : null,
    }));
  },

  async listAdSets(companyId, { adAccountId, campaignId } = {}) {
    await assertCompany(companyId);
    const accountId = await assertAdAccount(companyId, adAccountId);
    const accessToken = await getUserToken(companyId);
    const filtering = [];
    if (campaignId) {
      filtering.push({
        field: 'campaign.id',
        operator: 'IN',
        value: [String(campaignId)],
      });
    }
    const rows = await metaMarketingClient.listAdSets(accountId, accessToken, {
      filtering,
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      campaignId: row.campaign_id || null,
      status: row.status || null,
      effectiveStatus: row.effective_status || row.status || null,
    }));
  },

  async listAds(companyId, { adAccountId, campaignId, adsetId } = {}) {
    await assertCompany(companyId);
    const accountId = await assertAdAccount(companyId, adAccountId);
    const accessToken = await getUserToken(companyId);
    const filtering = [];
    if (campaignId) {
      filtering.push({
        field: 'campaign.id',
        operator: 'IN',
        value: [String(campaignId)],
      });
    }
    if (adsetId) {
      filtering.push({
        field: 'adset.id',
        operator: 'IN',
        value: [String(adsetId)],
      });
    }
    const rows = await metaMarketingClient.listAds(accountId, accessToken, {
      filtering,
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      adsetId: row.adset_id || null,
      campaignId: row.campaign_id || null,
      status: row.status || null,
      effectiveStatus: row.effective_status || row.status || null,
    }));
  },

  async comparePeriods(companyId, query = {}) {
    if (!query.adAccountId) {
      throw new AppError('adAccountId é obrigatório.', {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }

    const currentSince = query.since || query.currentSince;
    const currentUntil = query.until || query.currentUntil;
    const previousSince = query.previousSince;
    const previousUntil = query.previousUntil;

    if (
      !currentSince ||
      !currentUntil ||
      !previousSince ||
      !previousUntil
    ) {
      throw new AppError(
        'Informe since, until, previousSince e previousUntil (YYYY-MM-DD).',
        { statusCode: 400, code: 'VALIDATION_ERROR' }
      );
    }

    const base = {
      adAccountId: query.adAccountId,
      level: query.level || 'account',
      campaignId: query.campaignId,
      adsetId: query.adsetId,
      adId: query.adId,
      conversionType: query.conversionType,
    };

    const [current, previous] = await Promise.all([
      fetchNormalizedInsights(companyId, {
        ...base,
        since: currentSince,
        until: currentUntil,
      }),
      fetchNormalizedInsights(companyId, {
        ...base,
        since: previousSince,
        until: previousUntil,
      }),
    ]);

    return {
      level: current.level,
      adAccountId: current.adAccountId,
      currentPeriod: current.period,
      previousPeriod: previous.period,
      current: current.summary,
      previous: previous.summary,
      comparison: compareSummaries(current.summary, previous.summary),
    };
  },
};
