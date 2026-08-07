import { db } from '../config/database.js';

const userSelect = [
  'u.id',
  'u.name',
  'u.email',
  'u.password_hash',
  'u.role_id',
  'u.company_id',
  'u.status',
  'u.created_at',
  'u.updated_at',
  'r.name as role_name',
];

export const userRepository = {
  async findByEmailWithRole(email) {
    return db('users as u')
      .leftJoin('roles as r', 'r.id', 'u.role_id')
      .select(userSelect)
      .where('u.email', email)
      .first();
  },

  async findByIdWithRole(id) {
    return db('users as u')
      .leftJoin('roles as r', 'r.id', 'u.role_id')
      .select(userSelect)
      .where('u.id', id)
      .first();
  },

  async updateCompanyId(userId, companyId) {
    await db('users').where({ id: userId }).update({
      company_id: companyId,
    });
  },

  async findActiveByCompanyId(companyId) {
    return db('users as u')
      .leftJoin('roles as r', 'r.id', 'u.role_id')
      .select(userSelect)
      .where({ 'u.company_id': companyId, 'u.status': 'ACTIVE' });
  },
};
