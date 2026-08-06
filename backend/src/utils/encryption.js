import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from './errors.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey() {
  const raw = env.TOKEN_ENCRYPTION_KEY;

  // Aceita 64 hex chars (32 bytes) ou string que vira SHA-256
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }

  return crypto.createHash('sha256').update(raw).digest();
}

/**
 * AES-256-GCM
 * Formato persistido: iv:authTag:ciphertext (hex)
 */
export function encrypt(value) {
  if (value == null || value === '') {
    throw new AppError('Valor para criptografia inválido', {
      statusCode: 500,
      code: 'ENCRYPTION_ERROR',
    });
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(String(value), 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(payload) {
  if (!payload || typeof payload !== 'string') {
    throw new AppError('Payload criptografado inválido', {
      statusCode: 500,
      code: 'DECRYPTION_ERROR',
    });
  }

  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new AppError('Formato do token criptografado inválido', {
      statusCode: 500,
      code: 'DECRYPTION_ERROR',
    });
  }

  const [ivHex, authTagHex, dataHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(dataHex, 'hex');

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch {
    throw new AppError('Falha ao descriptografar token', {
      statusCode: 500,
      code: 'DECRYPTION_ERROR',
    });
  }
}
