import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { metaGraphClient } from './meta.graph.client.js';
import { metaConnectionRepository } from '../repositories/meta.connection.repository.js';
import { oauthStateRepository } from '../repositories/oauthState.repository.js';
import { encrypt } from '../utils/encryption.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { toPublicMetaConnection } from '../models/meta.connection.model.js';

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function getOAuthScopes() {
  return String(env.META_OAUTH_SCOPES || '')
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean)
    .join(',');
}

function buildOAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: env.META_APP_ID,
    redirect_uri: env.META_REDIRECT_URI,
    state,
    scope: getOAuthScopes(),
    response_type: 'code',
  });

  return `https://www.facebook.com/${env.META_GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}

function computeExpiresAt(expiresInSeconds) {
  if (!expiresInSeconds) return null;
  return new Date(Date.now() + Number(expiresInSeconds) * 1000);
}

export const metaAuthService = {
  async startConnect(companyId) {
    const state = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MS);

    await oauthStateRepository.create({
      companyId,
      state,
      expiresAt,
    });

    if (env.META_MOCK_MODE) {
      const url = `https://meta.mock.local/oauth?state=${state}&client_id=${env.META_APP_ID}`;
      logger.info('OAuth Meta MOCK iniciado', { companyId });
      return { url };
    }

    const url = buildOAuthUrl(state);

    logger.info('OAuth Meta iniciado', { companyId });

    return { url };
  },

  async handleCallback({ code, state }) {
    if (!code || !state) {
      throw new AppError('Parâmetros OAuth inválidos', {
        statusCode: 400,
        code: 'OAUTH_INVALID_PARAMS',
      });
    }

    const oauthState = await oauthStateRepository.findValidState(state);

    if (!oauthState) {
      throw new AppError('State OAuth inválido ou expirado', {
        statusCode: 400,
        code: 'OAUTH_STATE_INVALID',
      });
    }

    await oauthStateRepository.markUsed(oauthState.id);

    const companyId = oauthState.company_id;

    if (env.META_MOCK_MODE) {
      const accessTokenEncrypted = encrypt(`mock_token_${companyId}_${Date.now()}`);
      await metaConnectionRepository.upsertByCompanyId({
        companyId,
        businessId: 'mock_business_1',
        accessTokenEncrypted,
        tokenType: 'bearer',
        expiresAt: computeExpiresAt(3600 * 24 * 60),
        scopes: getOAuthScopes(),
      });

      logger.info('OAuth Meta MOCK concluído', { companyId });
      return {
        companyId,
        businessId: 'mock_business_1',
        redirectUrl: `${env.FRONTEND_URL}/meta?connected=1`,
      };
    }

    const shortTokenResponse = await metaGraphClient.exchangeCodeForToken({
      code,
      redirectUri: env.META_REDIRECT_URI,
    });

    const shortToken = shortTokenResponse.access_token;
    if (!shortToken) {
      throw new AppError('Meta não retornou access token', {
        statusCode: 502,
        code: 'META_TOKEN_MISSING',
      });
    }

    let accessToken = shortToken;
    let expiresIn = shortTokenResponse.expires_in;
    let tokenType = shortTokenResponse.token_type || 'bearer';

    try {
      const longLived = await metaGraphClient.exchangeLongLivedToken(shortToken);
      if (longLived.access_token) {
        accessToken = longLived.access_token;
        expiresIn = longLived.expires_in ?? expiresIn;
        tokenType = longLived.token_type || tokenType;
      }
    } catch (error) {
      logger.error('Falha ao obter long-lived token; usando token curto', {
        companyId,
        code: error.code || null,
      });
    }

    const businessesResponse = await metaGraphClient.getBusinesses(accessToken);
    const business = businessesResponse?.data?.[0] || null;
    const businessId = business?.id || null;

    const accessTokenEncrypted = encrypt(accessToken);

    await metaConnectionRepository.upsertByCompanyId({
      companyId,
      businessId,
      accessTokenEncrypted,
      tokenType,
      expiresAt: computeExpiresAt(expiresIn),
      scopes: getOAuthScopes(),
    });

    logger.info('OAuth Meta concluído', { companyId, businessId });
    logger.info('Token Meta salvo (criptografado)', { companyId });

    try {
      const { metaAssetsService } = await import('./meta.assets.service.js');
      await metaAssetsService.syncAll(companyId);
    } catch (error) {
      logger.error('Sync assets pós-OAuth falhou', {
        companyId,
        code: error.code || null,
        message: error.message,
      });
    }

    return {
      companyId,
      businessId,
      redirectUrl: `${env.FRONTEND_URL}/meta?connected=1`,
    };
  },

  async getStatus(companyId) {
    const connection = await metaConnectionRepository.findByCompanyId(companyId);

    if (!connection) {
      return {
        connected: false,
        businessId: null,
      };
    }

    return toPublicMetaConnection(connection);
  },

  async disconnect(companyId) {
    const connection = await metaConnectionRepository.findByCompanyId(companyId);
    if (!connection) {
      return { connected: false };
    }

    await metaConnectionRepository.deleteByCompanyId(companyId);
    logger.info('Conexão Meta removida', { companyId });
    return { connected: false };
  },
};
