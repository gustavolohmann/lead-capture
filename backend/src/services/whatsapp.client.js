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
    return new AppError('Token WhatsApp inválido ou expirado', {
      statusCode: 401,
      code: 'WHATSAPP_TOKEN_INVALID',
    });
  }

  if (status === 403) {
    return new AppError('Permissão WhatsApp negada', {
      statusCode: 403,
      code: 'WHATSAPP_PERMISSION_DENIED',
    });
  }

  if (graph?.code === 131030) {
    return new AppError(
      'Número do destinatário não está na lista de teste do WhatsApp. No Meta App → WhatsApp → API Setup, adicione e verifique o número (OTP) ou use um número em produção.',
      {
        statusCode: 400,
        code: 'WHATSAPP_RECIPIENT_NOT_ALLOWED',
      }
    );
  }

  if (graph?.code === 133010) {
    return new AppError(
      'Número WhatsApp não registrado na Cloud API (133010). Sincronize os ativos ou registre o número no WhatsApp Manager.',
      {
        statusCode: 400,
        code: 'WHATSAPP_ACCOUNT_NOT_REGISTERED',
      }
    );
  }

  return new AppError(graph?.message || 'Erro na WhatsApp Cloud API', {
    statusCode: 502,
    code: 'WHATSAPP_API_ERROR',
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
      logger.error('Erro WhatsApp API', {
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

export const whatsappClient = {
  async resolvePhoneNumberId(wabaId, accessToken) {
    const data = await request('GET', `/${wabaId}`, {
      accessToken,
      params: {
        fields: 'phone_numbers{id,display_phone_number}',
      },
    });
    const phones = data?.phone_numbers?.data || [];
    return phones[0]?.id || null;
  },

  async registerPhoneNumber({ phoneNumberId, pin = '000000', accessToken }) {
    return request('POST', `/${phoneNumberId}/register`, {
      accessToken,
      data: {
        messaging_product: 'whatsapp',
        pin: String(pin || '000000'),
      },
    });
  },

  async sendText({ phoneNumberId, to, body, accessToken }) {
    const payload = {
      messaging_product: 'whatsapp',
      to: String(to).replace(/\D/g, ''),
      type: 'text',
      text: { body },
    };

    return request('POST', `/${phoneNumberId}/messages`, {
      accessToken,
      data: payload,
    });
  },

  async sendTemplate({
    phoneNumberId,
    to,
    templateName,
    languageCode = 'pt_BR',
    components,
    accessToken,
  }) {
    const template = {
      name: templateName,
      language: { code: languageCode },
    };
    if (Array.isArray(components) && components.length > 0) {
      template.components = components;
    }

    return request('POST', `/${phoneNumberId}/messages`, {
      accessToken,
      data: {
        messaging_product: 'whatsapp',
        to: String(to).replace(/\D/g, ''),
        type: 'template',
        template,
      },
    });
  },

  async listMessageTemplates(wabaId, accessToken, { limit = 100 } = {}) {
    return request('GET', `/${wabaId}/message_templates`, {
      accessToken,
      params: {
        fields:
          'id,name,language,status,category,rejected_reason,quality_score,components,parameter_format',
        limit,
      },
    });
  },

  async createMessageTemplate(wabaId, accessToken, payload) {
    return request('POST', `/${wabaId}/message_templates`, {
      accessToken,
      data: payload,
    });
  },
};
