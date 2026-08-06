import { verifyToken } from '../utils/jwt.js';
import { userRepository } from '../repositories/user.repository.js';
import { contextService } from '../services/context.service.js';
import { AppError } from '../utils/errors.js';
import { UserStatus } from '../models/user.model.js';

export async function authMiddleware(req, _res, next) {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
      throw new AppError('Token de autenticação ausente', {
        statusCode: 401,
        code: 'UNAUTHORIZED',
      });
    }

    const token = header.slice('Bearer '.length).trim();

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      throw new AppError('Token inválido ou expirado', {
        statusCode: 401,
        code: 'UNAUTHORIZED',
      });
    }

    const user = await userRepository.findByIdWithRole(payload.sub);

    if (!user) {
      throw new AppError('Usuário não encontrado', {
        statusCode: 401,
        code: 'UNAUTHORIZED',
      });
    }

    if (user.status === UserStatus.INACTIVE) {
      throw new AppError('Usuário inativo', {
        statusCode: 401,
        code: 'USER_INACTIVE',
      });
    }

    const ctx = await contextService.buildForUser(user);

    req.user = ctx.user;
    req.company = ctx.company;
    req.context = ctx;

    return next();
  } catch (error) {
    return next(error);
  }
}
