import { db } from '../config/database.js';

export const oauthStateRepository = {
  async create({ companyId, state, expiresAt }) {
    const [id] = await db('oauth_states').insert({
      company_id: companyId,
      state,
      expires_at: expiresAt,
    });

    return db('oauth_states').where({ id }).first();
  },

  async findValidState(state) {
    return db('oauth_states')
      .where({ state })
      .whereNull('used_at')
      .where('expires_at', '>', db.fn.now())
      .first();
  },

  async markUsed(id) {
    await db('oauth_states').where({ id }).update({
      used_at: db.fn.now(),
    });
  },
};
