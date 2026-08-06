import { db } from '../config/database.js';

export const companyRepository = {
  async findById(id) {
    return db('companies').where({ id }).first();
  },

  async findByOwnerUserId(ownerUserId) {
    return db('companies').where({ owner_user_id: ownerUserId }).first();
  },

  async create({ name, ownerUserId, status = 'ACTIVE' }) {
    const [id] = await db('companies').insert({
      name,
      owner_user_id: ownerUserId,
      status,
    });

    return this.findById(id);
  },
};
