import { userRepository } from '../repositories/user.repository.js';
import { companyService } from './company.service.js';
import { comparePassword } from '../utils/password.js';
import { signToken } from '../utils/jwt.js';
import { AppError } from '../utils/errors.js';
import { UserStatus, toPublicUser } from '../models/user.model.js';
import { logger } from '../utils/logger.js';

export const authService = {
  async login({ email, password }) {
    const user = await userRepository.findByEmailWithRole(email);

    if (!user) {
      throw new AppError('Credenciais inválidas', {
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
      });
    }

    if (user.status === UserStatus.INACTIVE) {
      throw new AppError('Usuário inativo', {
        statusCode: 401,
        code: 'USER_INACTIVE',
      });
    }

    const passwordMatches = await comparePassword(password, user.password_hash);

    if (!passwordMatches) {
      throw new AppError('Credenciais inválidas', {
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
      });
    }

    const company = await companyService.ensureCompanyForUser(user);

    const token = signToken({
      sub: user.id,
      role: user.role_name,
      companyId: company.id,
    });

    logger.info('Login realizado', {
      userId: user.id,
      companyId: company.id,
    });

    return {
      token,
      user: toPublicUser({ ...user, company_id: company.id }, company),
    };
  },
};
