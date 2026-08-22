import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { encrypt, decrypt } from '../../utils/encryption.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { oauthStateRepository } from '../../repositories/oauthState.repository.js';
import { calendarIntegrationRepository } from '../../repositories/calendarIntegration.repository.js';
import { googleCalendarProvider } from './google.calendar.provider.js';
import { toPublicCalendarIntegration } from '../../models/calendarIntegration.model.js';

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function requireGoogleEnv() {
  if (!env.GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_ID === 'pending') {
    throw new AppError('Google Calendar não configurado no servidor.', {
      statusCode: 503,
      code: 'CALENDAR_PROVIDER_UNAVAILABLE',
    });
  }
  if (!env.GOOGLE_CLIENT_SECRET || env.GOOGLE_CLIENT_SECRET === 'pending') {
    throw new AppError('Google Calendar não configurado no servidor.', {
      statusCode: 503,
      code: 'CALENDAR_PROVIDER_UNAVAILABLE',
    });
  }
}

export const googleCalendarAuthService = {
  async startConnect({ companyId, userId }) {
    requireGoogleEnv();
    const state = crypto.randomBytes(24).toString('hex');
    // MySQL DATETIME sem timezone: gravar em UTC explícito evita state "já expirado"
    const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MS)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');

    await oauthStateRepository.create({
      companyId,
      userId,
      provider: 'GOOGLE',
      state,
      expiresAt,
    });

    const url = googleCalendarProvider.getAuthorizationUrl({ state });
    logger.info('OAuth Google Calendar iniciado', { companyId, userId });
    return { url };
  },

  async handleCallback({ code, state }) {
    requireGoogleEnv();
    if (!code || !state) {
      throw new AppError('Parâmetros OAuth inválidos', {
        statusCode: 400,
        code: 'OAUTH_INVALID_PARAMS',
      });
    }

    const oauthState = await oauthStateRepository.findValidState(state);
    if (!oauthState || oauthState.provider !== 'GOOGLE') {
      throw new AppError('State OAuth inválido ou expirado', {
        statusCode: 400,
        code: 'OAUTH_STATE_INVALID',
      });
    }

    await oauthStateRepository.markUsed(oauthState.id);

    const tokens = await googleCalendarProvider.exchangeAuthorizationCode(code);
    if (!tokens.refreshToken) {
      // Still connect if we already have a refresh token stored
      const existing = await calendarIntegrationRepository.findByUserAndProvider(
        oauthState.user_id,
        'GOOGLE'
      );
      if (!existing?.encrypted_refresh_token) {
        throw new AppError(
          'Google não retornou refresh token. Revogue o acesso do app e conecte novamente.',
          { statusCode: 400, code: 'CALENDAR_AUTH_EXPIRED' }
        );
      }
    }

    await calendarIntegrationRepository.upsertGoogle({
      companyId: oauthState.company_id,
      userId: oauthState.user_id,
      providerAccountId: tokens.providerAccountId,
      providerEmail: tokens.providerEmail,
      calendarId: tokens.calendarId,
      encryptedRefreshToken: tokens.refreshToken
        ? encrypt(tokens.refreshToken)
        : null,
      encryptedAccessToken: encrypt(tokens.accessToken),
      accessTokenExpiresAt: tokens.expiresAt,
      scopes: tokens.scopes,
      status: 'CONNECTED',
    });

    logger.info('Google Calendar conectado', {
      userId: oauthState.user_id,
      companyId: oauthState.company_id,
    });

    return {
      redirectUrl: `${env.FRONTEND_URL}/calendar?connected=1`,
    };
  },

  async getStatus(userId) {
    const row = await calendarIntegrationRepository.findByUserAndProvider(
      userId,
      'GOOGLE'
    );
    return toPublicCalendarIntegration(row);
  },

  async disconnect(userId) {
    await calendarIntegrationRepository.disconnect(userId, 'GOOGLE');
    logger.info('Google Calendar desconectado', { userId });
    return { success: true };
  },

  /**
   * Retorna access token válido, renovando com refresh token se necessário.
   */
  async getValidAccessToken(userId) {
    const row = await calendarIntegrationRepository.findConnectedByUser(userId);
    if (!row?.encrypted_refresh_token && !row?.encrypted_access_token) {
      throw new AppError('Conecte sua agenda Google para continuar.', {
        statusCode: 400,
        code: 'CALENDAR_NOT_CONNECTED',
      });
    }

    const expiresAt = row.access_token_expires_at
      ? new Date(row.access_token_expires_at).getTime()
      : 0;
    const stillValid =
      row.encrypted_access_token && expiresAt > Date.now() + 60_000;

    if (stillValid) {
      return {
        accessToken: decrypt(row.encrypted_access_token),
        calendarId: row.calendar_id || 'primary',
        integration: row,
      };
    }

    if (!row.encrypted_refresh_token) {
      await calendarIntegrationRepository.markStatus(userId, 'GOOGLE', 'ERROR');
      throw new AppError('Conexão com o Google Calendar expirada.', {
        statusCode: 401,
        code: 'CALENDAR_AUTH_EXPIRED',
      });
    }

    try {
      const refreshed = await googleCalendarProvider.refreshAccessToken(
        decrypt(row.encrypted_refresh_token)
      );
      await calendarIntegrationRepository.updateTokens(row.id, {
        encryptedAccessToken: encrypt(refreshed.accessToken),
        encryptedRefreshToken: refreshed.refreshToken
          ? encrypt(refreshed.refreshToken)
          : undefined,
        accessTokenExpiresAt: refreshed.expiresAt,
        status: 'CONNECTED',
      });
      return {
        accessToken: refreshed.accessToken,
        calendarId: row.calendar_id || 'primary',
        integration: row,
      };
    } catch (error) {
      await calendarIntegrationRepository.markStatus(userId, 'GOOGLE', 'ERROR');
      throw error;
    }
  },
};
