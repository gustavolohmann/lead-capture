import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

export function getInstagramAppConfig() {
  const appId = String(env.META_INSTAGRAM_APP_ID || '').trim();
  const appSecret = String(env.META_INSTAGRAM_APP_SECRET || '').trim();
  return { appId, appSecret };
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
