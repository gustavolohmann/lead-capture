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
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') return true;
  const status = error.response?.status;
  if (!status) return true;
  if (status === 429 || status >= 500) return true;
  return false;
}

function mapError(error) {
  const status = error.response?.status;
  const graph = error.response?.data?.error;

  if (graph?.code === 190 || status === 401) {
    return new AppError('Token Instagram inválido ou expirado', {
      statusCode: 401,
      code: 'INSTAGRAM_TOKEN_INVALID',
    });
  }

  if (status === 403) {
    return new AppError('Permissão Instagram negada', {
      statusCode: 403,
      code: 'INSTAGRAM_PERMISSION_DENIED',
    });
  }

  return new AppError(graph?.message || 'Erro na Instagram Messaging API', {
    statusCode: 502,
    code: 'INSTAGRAM_API_ERROR',
  });
}

async function request(method, path, { accessToken, params, data } = {}) {
  const client = axios.create({
    baseURL: `https://graph.facebook.com/${env.META_GRAPH_VERSION}`,
    timeout: 20000,
  });

  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await client.request({
        method,
        url: path,
        params: { ...(params || {}), access_token: accessToken },
        data,
      });
      return response.data;
    } catch (error) {
      lastError = error;
      const retryable = isRetryable(error);
      logger.error('Erro Instagram API', {
        method,
        path,
        attempt,
        status: error.response?.status || null,
        code: error.response?.data?.error?.code || error.code || null,
        retryable,
      });
      if (!retryable || attempt === MAX_RETRIES) throw mapError(error);
      await sleep(BASE_DELAY_MS * attempt);
    }
  }
  throw mapError(lastError);
}

export const instagramClient = {
  async sendText({ igUserId, recipientId, text, accessToken }) {
    return request('POST', `/${igUserId}/messages`, {
      accessToken,
      data: {
        recipient: { id: recipientId },
        message: { text },
      },
    });
  },
};
