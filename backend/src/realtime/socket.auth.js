import { verifyToken } from '../utils/jwt.js';
import { userRepository } from '../repositories/user.repository.js';
import { contextService } from '../services/context.service.js';
import { UserStatus } from '../models/user.model.js';
import { logger } from '../utils/logger.js';

/**
 * Middleware Socket.IO: autentica via JWT do handshake.
 * companyId / userId nunca vêm do cliente — só do token validado.
 */
export async function socketAuth(socket, next) {
  try {
    const token =
      socket.handshake?.auth?.token ||
      extractBearer(socket.handshake?.headers?.authorization);

    if (!token) {
      logger.warn('socket.auth.failed', { reason: 'missing_token' });
      return next(new Error('UNAUTHORIZED'));
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      logger.warn('socket.auth.failed', { reason: 'invalid_token' });
      return next(new Error('UNAUTHORIZED'));
    }

    const user = await userRepository.findByIdWithRole(payload.sub);
    if (!user || user.status === UserStatus.INACTIVE) {
      logger.warn('socket.auth.failed', { reason: 'user_invalid' });
      return next(new Error('UNAUTHORIZED'));
    }

    const ctx = await contextService.buildForUser(user);
    socket.user = ctx.user;
    socket.company = ctx.company;
    return next();
  } catch (error) {
    logger.warn('socket.auth.failed', {
      reason: 'unexpected',
      detail: error.message,
    });
    return next(new Error('UNAUTHORIZED'));
  }
}

function extractBearer(header) {
  if (!header || typeof header !== 'string') return null;
  if (!header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
}
