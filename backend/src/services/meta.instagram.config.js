import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

export function getInstagramAppConfig() {
  const appId = String(env.META_INSTAGRAM_APP_ID || '').trim();
  const appSecret = String(env.META_INSTAGRAM_APP_SECRET || '').trim();
  const accessToken = String(env.META_INSTAGRAM_ACCESS_TOKEN || '').trim();
  return { appId, appSecret, accessToken };
}

/** Token IG do env (prioridade) para mensagens/criativos Instagram. */
export function getInstagramAccessToken(fallbackToken = null) {
  const { accessToken } = getInstagramAppConfig();
  return accessToken || fallbackToken || null;
}

export function requireInstagramAccessToken(fallbackToken = null) {
  const token = getInstagramAccessToken(fallbackToken);
  if (!token) {
    throw new AppError(
      'META_INSTAGRAM_ACCESS_TOKEN não configurado e sem token Meta de fallback.',
      {
        statusCode: 500,
        code: 'INSTAGRAM_TOKEN_MISSING',
      }
    );
  }
  return token;
}

export function requireInstagramAppConfig() {
  const { appId, appSecret } = getInstagramAppConfig();
  if (!appId || !appSecret || appId === 'pending' || appSecret === 'pending') {
    throw new AppError(
      'META_INSTAGRAM_APP_ID e META_INSTAGRAM_APP_SECRET são obrigatórios para Instagram.',
      {
        statusCode: 500,
        code: 'INSTAGRAM_APP_MISCONFIGURED',
      }
    );
  }
  return { appId, appSecret };
}

/** Secret usado na assinatura do webhook Instagram (fallback: app Facebook). */
export function getInstagramWebhookSecret() {
  const { appSecret } = getInstagramAppConfig();
  return appSecret || env.META_APP_SECRET;
}

export function buildInstagramAppSecretProof(accessToken) {
  const { appSecret } = requireInstagramAppConfig();
  return crypto
    .createHmac('sha256', appSecret)
    .update(String(accessToken || ''))
    .digest('hex');
}

/**
 * Token do Login Facebook (META_APP_ID) — proof correto para Marketing API.
 * O App ID do Instagram ainda é enviado como app_id nas chamadas IG.
 */
export function buildFacebookAppSecretProof(accessToken) {
  return crypto
    .createHmac('sha256', env.META_APP_SECRET)
    .update(String(accessToken || ''))
    .digest('hex');
}
