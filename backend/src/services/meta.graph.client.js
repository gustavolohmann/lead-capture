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

function mapGraphError(error) {
  const status = error.response?.status;
  const graph = error.response?.data?.error;

  if (graph?.code === 190 || status === 401) {
    return new AppError('Token Meta inválido ou expirado', {
      statusCode: 401,
      code: 'META_TOKEN_INVALID',
    });
  }

  if (graph?.code === 10 || graph?.code === 200 || status === 403) {
    return new AppError('Permissão Meta negada', {
      statusCode: 403,
      code: 'META_PERMISSION_DENIED',
    });
  }

  return new AppError(graph?.message || 'Erro na Graph API', {
    statusCode: 502,
    code: 'META_GRAPH_ERROR',
  });
}

function createClient() {
  return axios.create({
    baseURL: `https://graph.facebook.com/${env.META_GRAPH_VERSION}`,
    timeout: 20000,
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
      logger.error('Erro Graph API', {
        method,
        path,
        attempt,
        status: error.response?.status || null,
        code: error.response?.data?.error?.code || error.code || null,
        retryable,
      });

      if (!retryable || attempt === MAX_RETRIES) {
        throw mapGraphError(error);
      }

      await sleep(BASE_DELAY_MS * attempt);
    }
  }

  throw mapGraphError(lastError);
}

export const metaGraphClient = {
  get(path, params = {}) {
    return request('GET', path, { params });
  },

  post(path, data = {}, params = {}) {
    return request('POST', path, { data, params });
  },

  /**
   * OAuth token endpoint (form/query style da Meta).
   */
  async exchangeCodeForToken({ code, redirectUri }) {
    return request('GET', '/oauth/access_token', {
      params: {
        client_id: env.META_APP_ID,
        client_secret: env.META_APP_SECRET,
        redirect_uri: redirectUri,
        code,
      },
    });
  },

  async exchangeLongLivedToken(shortLivedToken) {
    return request('GET', '/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: env.META_APP_ID,
        client_secret: env.META_APP_SECRET,
        fb_exchange_token: shortLivedToken,
      },
    });
  },

  async getBusinesses(accessToken) {
    return request('GET', '/me/businesses', {
      params: {
        access_token: accessToken,
        fields: 'id,name',
      },
    });
  },

  async getPages(accessToken) {
    return request('GET', '/me/accounts', {
      params: {
        access_token: accessToken,
        fields: 'id,name,access_token',
        limit: 100,
      },
    });
  },

  async getAdAccounts(accessToken) {
    return request('GET', '/me/adaccounts', {
      params: {
        access_token: accessToken,
        fields: 'id,name,account_status',
        limit: 100,
      },
    });
  },

  async getPageInstagram(pageId, pageAccessToken) {
    return request('GET', `/${pageId}`, {
      params: {
        access_token: pageAccessToken,
        fields: 'instagram_business_account{id,username}',
      },
    });
  },

  async getOwnedWhatsappAccounts(businessId, accessToken) {
    return request('GET', `/${businessId}/owned_whatsapp_business_accounts`, {
      params: {
        access_token: accessToken,
        fields:
          'id,name,phone_numbers{id,display_phone_number,verified_name}',
        limit: 100,
      },
    });
  },

  async getClientWhatsappAccounts(businessId, accessToken) {
    return request('GET', `/${businessId}/client_whatsapp_business_accounts`, {
      params: {
        access_token: accessToken,
        fields:
          'id,name,phone_numbers{id,display_phone_number,verified_name}',
        limit: 100,
      },
    });
  },

  async getLead(leadgenId, pageAccessToken) {
    return request('GET', `/${leadgenId}`, {
      params: {
        access_token: pageAccessToken,
        fields:
          'id,created_time,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,is_organic,platform,field_data',
      },
    });
  },
};
