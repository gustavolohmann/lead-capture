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

  if (
    graph?.code === 31 ||
    graph?.error_subcode === 3858385 ||
    /autentique sua conta|pending action|authenticate your account/i.test(
      String(detail || '')
    )
  ) {
    return new AppError(
      detail ||
        'A Meta bloqueou a criação de anúncios: autentique sua conta no Gerenciador de Anúncios e tente de novo.',
      {
        statusCode: 403,
        code: 'META_AD_ACCOUNT_AUTH_REQUIRED',
      }
    );
  }

  if (graph?.code === 10 || graph?.code === 200 || status === 403) {
    return new AppError(detail || 'Permissão Meta negada para Marketing API', {
      statusCode: 403,
      code: 'META_PERMISSION_DENIED',
    });
  }

  // 1885183: criativo criado por app em Development — precisa estar Live/Public
  if (graph?.error_subcode === 1885183) {
    return new AppError(
      detail ||
        'O app Meta ainda está em modo desenvolvimento. Publique o app (Live) e tente novamente.',
      {
        statusCode: 400,
        code: 'META_APP_NOT_LIVE',
      }
    );
  }

  if (graph?.code === 100 || graph?.error_subcode === 33) {
    const message = String(detail || graph?.message || '');
    const isFormName =
      /nome do formulário já existe|form.*already exists|duplicate/i.test(
        message
      );
    const isWhatsappUnlinked =
      /whatsapp phone number is not linked|não está vinculado|not linked to your account/i.test(
        message
      );
    const isInstagramId =
      /instagram_actor_id|instagram_user_id|valid Instagram account id/i.test(
        message
      );
    const isWelcomeTooLong =
      /welcome message should not exceed|welcome message.*300/i.test(message);
    return new AppError(
      isInstagramId
        ? 'ID do Instagram inválido para anúncios. Vincule o IG à Página e sincronize em Conexão Meta.'
        : isWelcomeTooLong
          ? 'Mensagem de boas-vindas do Instagram deve ter no máximo 300 caracteres.'
          : message || 'Conta de anúncio ou campanha inválida',
      {
        statusCode: 400,
        code: isWhatsappUnlinked
          ? 'META_WHATSAPP_NOT_LINKED'
          : isFormName
            ? 'META_LEAD_FORM_NAME_EXISTS'
            : isInstagramId
              ? 'META_INSTAGRAM_ID_INVALID'
              : isWelcomeTooLong
                ? 'META_WELCOME_MESSAGE_TOO_LONG'
                : detail?.includes('FollowUpActionURL')
                  ? 'META_LEAD_FORM_INVALID'
                  : 'META_INVALID_AD_ACCOUNT',
      }
    );
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
  const maxAttempts =
    Number(options.maxAttempts) ||
    (String(method).toUpperCase() === 'GET' ? MAX_RETRIES : 1);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await client.request({
        method,
        url: path,
        params: options.params,
        data: options.data,
        headers: options.headers,
      });
      // Alguns erros Meta voltam 200 com { error: ... }
      if (response?.data?.error) {
        const wrapped = {
          response: {
            status: 400,
            data: response.data,
          },
        };
        throw mapMarketingError(wrapped);
      }
      return response.data;
    } catch (error) {
      if (error instanceof AppError) throw error;

      lastError = error;

      const retryable = isRetryable(error);
      const graphError = error.response?.data?.error;
      logger.error('Erro Marketing API', {
        method,
        path,
        attempt,
        status: error.response?.status || null,
        code: graphError?.code || error.code || null,
        subcode: graphError?.error_subcode || null,
        message: graphError?.message || null,
        userTitle: graphError?.error_user_title || null,
        userMsg: graphError?.error_user_msg || null,
        retryable,
      });

      if (!retryable || attempt === maxAttempts) {
        const mapped = mapMarketingError(error);
        if (options.nonIdempotent && retryable) {
          mapped.ambiguous = true;
          mapped.cleanupRequired = true;
        }
        throw mapped;
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
    const path = `/${actId}/campaigns`;
    const baseParams = {
      access_token: accessToken,
      fields: 'id,name,objective,status,effective_status,daily_budget,created_time,updated_time',
      limit: 500,
    };
    const rows = [];
    let after = null;
    let pages = 0;
    while (pages < 50) {
      const params = after ? { ...baseParams, after } : baseParams;
      const response = await request('GET', path, { params });
      const batch = Array.isArray(response?.data) ? response.data : [];
      rows.push(...batch);
      const nextAfter = response?.paging?.cursors?.after;
      if (!nextAfter || batch.length === 0 || nextAfter === after) break;
      after = nextAfter;
      pages += 1;
    }
    return { data: rows };
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
      nonIdempotent: true,
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
      maxAttempts: MAX_RETRIES,
    });
  },

  async updateAdStatus(adId, accessToken, status) {
    return request('POST', `/${adId}`, {
      params: {
        access_token: accessToken,
      },
      data: toFormBody({ status }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      maxAttempts: MAX_RETRIES,
    });
  },

  async deleteCampaign(campaignId, accessToken) {
    return request('DELETE', `/${campaignId}`, {
      params: {
        access_token: accessToken,
      },
      maxAttempts: MAX_RETRIES,
    });
  },

  async deleteAd(adId, accessToken) {
    return request('DELETE', `/${adId}`, {
      params: { access_token: accessToken },
      maxAttempts: MAX_RETRIES,
    });
  },

  async deleteAdCreative(creativeId, accessToken) {
    return request('DELETE', `/${creativeId}`, {
      params: { access_token: accessToken },
      maxAttempts: MAX_RETRIES,
    });
  },

  async createLeadForm(pageId, pageAccessToken, payload) {
    return request('POST', `/${pageId}/leadgen_forms`, {
      nonIdempotent: true,
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
      nonIdempotent: true,
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
      nonIdempotent: true,
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

  async createAdCreative(adAccountId, accessToken, payload, options = {}) {
    const actId = normalizeActId(adAccountId);
    const params = {
      access_token: accessToken,
    };
    if (options.appId) {
      params.app_id = String(options.appId);
    }
    if (options.appSecretProof) {
      params.appsecret_proof = String(options.appSecretProof);
    }
    return request('POST', `/${actId}/adcreatives`, {
      nonIdempotent: true,
      params,
      data: toFormBody(payload),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  },

  async createAd(adAccountId, accessToken, payload, options = {}) {
    const actId = normalizeActId(adAccountId);
    const params = {
      access_token: accessToken,
    };
    if (options.appId) {
      params.app_id = String(options.appId);
    }
    if (options.appSecretProof) {
      params.appsecret_proof = String(options.appSecretProof);
    }
    return request('POST', `/${actId}/ads`, {
      nonIdempotent: true,
      params,
      data: toFormBody(payload),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  },

  /**
   * Fetch Insights with cursor pagination (never follows paging.next URLs that embed tokens).
   */
  async getInsights(adAccountId, accessToken, options = {}) {
    const actId = normalizeActId(adAccountId);
    const maxPages = Math.min(Number(options.maxPages) || 25, 50);
    const limit = Math.min(Number(options.limit) || 100, 500);
    const path = `/${actId}/insights`;

    const baseParams = {
      access_token: accessToken,
      fields: options.fields,
      level: options.level,
      limit,
    };

    if (options.datePreset) {
      baseParams.date_preset = options.datePreset;
    }
    if (options.timeRange) {
      baseParams.time_range = JSON.stringify(options.timeRange);
    }
    if (options.filtering?.length) {
      baseParams.filtering = JSON.stringify(options.filtering);
    }
    if (options.timeIncrement) {
      baseParams.time_increment = options.timeIncrement;
    }

    const rows = [];
    let after = null;
    let pages = 0;

    while (pages < maxPages) {
      const params = after ? { ...baseParams, after } : { ...baseParams };
      const data = await request('GET', path, { params });
      const batch = Array.isArray(data?.data) ? data.data : [];
      rows.push(...batch);

      const nextAfter = data?.paging?.cursors?.after;
      if (!nextAfter || batch.length === 0) break;
      // Stop if Meta returns the same cursor (loop guard)
      if (after && nextAfter === after) break;
      after = nextAfter;
      pages += 1;
    }

    return rows;
  },

  async listAdSets(adAccountId, accessToken, options = {}) {
    const actId = normalizeActId(adAccountId);
    const params = {
      access_token: accessToken,
      fields: options.fields || 'id,name,campaign_id,status,effective_status',
      limit: Math.min(Number(options.limit) || 100, 500),
    };
    if (options.filtering?.length) {
      params.filtering = JSON.stringify(options.filtering);
    }

    const rows = [];
    let after = null;
    let pages = 0;
    const maxPages = Math.min(Number(options.maxPages) || 25, 50);
    const path = `/${actId}/adsets`;

    while (pages < maxPages) {
      const pageParams = after ? { ...params, after } : { ...params };
      const data = await request('GET', path, { params: pageParams });
      const batch = Array.isArray(data?.data) ? data.data : [];
      rows.push(...batch);
      const nextAfter = data?.paging?.cursors?.after;
      if (!nextAfter || batch.length === 0) break;
      if (after && nextAfter === after) break;
      after = nextAfter;
      pages += 1;
    }
    return rows;
  },

  async listAds(adAccountId, accessToken, options = {}) {
    const actId = normalizeActId(adAccountId);
    const params = {
      access_token: accessToken,
      fields:
        options.fields ||
        'id,name,adset_id,campaign_id,status,effective_status,creative{id,name,title,body,image_hash,call_to_action_type}',
      limit: Math.min(Number(options.limit) || 100, 500),
    };
    if (options.filtering?.length) {
      params.filtering = JSON.stringify(options.filtering);
    }

    const rows = [];
    let after = null;
    let pages = 0;
    const maxPages = Math.min(Number(options.maxPages) || 25, 50);
    const path = `/${actId}/ads`;

    while (pages < maxPages) {
      const pageParams = after ? { ...params, after } : { ...params };
      const data = await request('GET', path, { params: pageParams });
      const batch = Array.isArray(data?.data) ? data.data : [];
      rows.push(...batch);
      const nextAfter = data?.paging?.cursors?.after;
      if (!nextAfter || batch.length === 0) break;
      if (after && nextAfter === after) break;
      after = nextAfter;
      pages += 1;
    }
    return rows;
  },
};
