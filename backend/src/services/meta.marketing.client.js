import axios from 'axios';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 400;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(error) {
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return true;
  }

  const status = error.response?.status;
  if (!status) return true;
  if (status === 429) return true;
  if (status >= 500) return true;
  return false;
}

function mapMarketingError(error) {
  const status = error.response?.status;
  const graph = error.response?.data?.error;
  const detail =
    graph?.error_user_msg ||
    graph?.error_user_title ||
    graph?.message ||
    null;

  if (graph?.code === 190 || status === 401) {
    return new AppError(detail || 'Token Meta inválido ou expirado', {
      statusCode: 401,
      code: 'META_TOKEN_INVALID',
    });
  }

  if (graph?.code === 10 || graph?.code === 200 || status === 403) {
    return new AppError(detail || 'Permissão Meta negada para Marketing API', {
      statusCode: 403,
      code: 'META_PERMISSION_DENIED',
    });
  }

  if (graph?.code === 100 || graph?.error_subcode === 33) {
    const isFormName =
      /nome do formulário já existe|form.*already exists|duplicate/i.test(
        String(detail || '')
      );
    return new AppError(detail || 'Conta de anúncio ou campanha inválida', {
      statusCode: 400,
      code: isFormName
        ? 'META_LEAD_FORM_NAME_EXISTS'
        : detail?.includes('FollowUpActionURL')
          ? 'META_LEAD_FORM_INVALID'
          : 'META_INVALID_AD_ACCOUNT',
    });
  }

  return new AppError(detail || 'Erro na Marketing API', {
    statusCode: 502,
    code: 'META_MARKETING_ERROR',
  });
}

function createClient() {
  return axios.create({
    baseURL: `https://graph.facebook.com/${env.META_GRAPH_VERSION}`,
    timeout: 25000,
  });
}

async function request(method, path, options = {}) {
  const client = createClient();
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await client.request({
        method,
        url: path,
        params: options.params,
        data: options.data,
        headers: options.headers,
      });
      return response.data;
    } catch (error) {
      lastError = error;

      const retryable = isRetryable(error);
      logger.error('Erro Marketing API', {
        method,
        path,
        attempt,
        status: error.response?.status || null,
        code: error.response?.data?.error?.code || error.code || null,
        subcode: error.response?.data?.error?.error_subcode || null,
        message: error.response?.data?.error?.message || null,
        retryable,
      });

      if (!retryable || attempt === MAX_RETRIES) {
        throw mapMarketingError(error);
      }

      await sleep(BASE_DELAY_MS * attempt);
    }
  }

  throw mapMarketingError(lastError);
}

function normalizeActId(adAccountId) {
  const id = String(adAccountId || '');
  return id.startsWith('act_') ? id : `act_${id}`;
}

function toFormBody(payload) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(payload || {})) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
      body.set(key, JSON.stringify(value));
    } else if (typeof value === 'boolean') {
      body.set(key, value ? '1' : '0');
    } else {
      body.set(key, String(value));
    }
  }
  return body;
}

/**
 * Client exclusivo da Marketing API.
 * Sem regra de negócio.
 */
export const metaMarketingClient = {
  async listCampaigns(adAccountId, accessToken) {
    const actId = normalizeActId(adAccountId);
    return request('GET', `/${actId}/campaigns`, {
      params: {
        access_token: accessToken,
        fields: 'id,name,objective,status,daily_budget,created_time,updated_time',
        limit: 100,
      },
    });
  },

  async createCampaign(adAccountId, accessToken, payload) {
    const actId = normalizeActId(adAccountId);
    return request('POST', `/${actId}/campaigns`, {
      params: {
        access_token: accessToken,
      },
      data: toFormBody({
        name: payload.name,
        objective: payload.objective,
        status: payload.status,
        special_ad_categories: payload.special_ad_categories ?? [],
        daily_budget: payload.daily_budget,
        is_adset_budget_sharing_enabled:
          payload.is_adset_budget_sharing_enabled ?? false,
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  },

  async updateCampaignStatus(campaignId, accessToken, status) {
    return request('POST', `/${campaignId}`, {
      params: {
        access_token: accessToken,
      },
      data: toFormBody({ status }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  },

  async createLeadForm(pageId, pageAccessToken, payload) {
    return request('POST', `/${pageId}/leadgen_forms`, {
      params: {
        access_token: pageAccessToken,
      },
      data: toFormBody(payload),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  },

  async createAdSet(adAccountId, accessToken, payload) {
    const actId = normalizeActId(adAccountId);
    return request('POST', `/${actId}/adsets`, {
      params: {
        access_token: accessToken,
      },
      data: toFormBody(payload),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  },

  async uploadAdImage(adAccountId, accessToken, { bytesBase64, name }) {
    const actId = normalizeActId(adAccountId);
    return request('POST', `/${actId}/adimages`, {
      params: {
        access_token: accessToken,
      },
      data: toFormBody({
        bytes: bytesBase64,
        name: name || 'creative.jpg',
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  },

  async createAdCreative(adAccountId, accessToken, payload) {
    const actId = normalizeActId(adAccountId);
    return request('POST', `/${actId}/adcreatives`, {
      params: {
        access_token: accessToken,
      },
      data: toFormBody(payload),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  },

  async createAd(adAccountId, accessToken, payload) {
    const actId = normalizeActId(adAccountId);
    return request('POST', `/${actId}/ads`, {
      params: {
        access_token: accessToken,
      },
      data: toFormBody(payload),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  },
};
