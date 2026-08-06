import { companyService } from './company.service.js';
import { AppError } from '../utils/errors.js';

/**
 * Contexto autenticado da request.
 * Centraliza user + company para evolução futura (permissões / multi-company).
 */
export const contextService = {
  /**
   * @param {{ id: number, name: string, email: string, role: string, company_id?: number|null, status: string }} user
   */
  async buildForUser(user) {
    if (!user) {
      throw new AppError('Usuário não autenticado', {
        statusCode: 401,
        code: 'UNAUTHORIZED',
      });
    }

    const company = await companyService.ensureCompanyForUser(user);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role_name || user.role,
        status: user.status,
        companyId: company.id,
      },
      company: {
        id: company.id,
        name: company.name,
        status: company.status,
      },
      // Preparado para RBAC futuro
      permissions: [],
    };
  },

  requireCompanyId(ctx) {
    const companyId = ctx?.company?.id ?? ctx?.user?.companyId;
    if (!companyId) {
      throw new AppError('Empresa não encontrada para o usuário', {
        statusCode: 400,
        code: 'COMPANY_REQUIRED',
      });
    }
    return companyId;
  },
};
