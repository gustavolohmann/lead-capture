import { companyRepository } from '../repositories/company.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { toPublicCompany } from '../models/company.model.js';
import { logger } from '../utils/logger.js';

function defaultCompanyName(userName) {
  const base = (userName || 'Usuário').trim();
  return `${base} — Empresa`;
}

export const companyService = {
  async getById(companyId) {
    return companyRepository.findById(companyId);
  },

  async getByOwnerUserId(userId) {
    return companyRepository.findByOwnerUserId(userId);
  },

  /**
   * Garante 1 company por usuário nesta fase.
   * Se o usuário ainda não tiver company_id, cria e vincula.
   */
  async ensureCompanyForUser(user) {
    if (user.company_id) {
      const existing = await companyRepository.findById(user.company_id);
      if (existing) {
        return existing;
      }
    }

    const owned = await companyRepository.findByOwnerUserId(user.id);
    if (owned) {
      await userRepository.updateCompanyId(user.id, owned.id);
      logger.info('Usuário vinculado a company existente', {
        userId: user.id,
        companyId: owned.id,
      });
      return owned;
    }

    const company = await companyRepository.create({
      name: defaultCompanyName(user.name),
      ownerUserId: user.id,
    });

    await userRepository.updateCompanyId(user.id, company.id);

    logger.info('Company inicial criada para usuário', {
      userId: user.id,
      companyId: company.id,
    });

    return company;
  },

  toPublic(company) {
    return toPublicCompany(company);
  },
};
