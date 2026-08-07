import { db } from '../config/database.js';

export const metaInstagramRepository = {
  async upsert({ companyId, instagramId, username }) {
    await db.raw(
      `INSERT INTO meta_instagram_accounts (company_id, instagram_id, username)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         username = VALUES(username)`,
      [companyId, instagramId, username ?? null]
    );

    return db('meta_instagram_accounts')
      .where({ company_id: companyId, instagram_id: instagramId })
      .first();
  },

  async findByCompanyId(companyId) {
    return db('meta_instagram_accounts')
      .where({ company_id: companyId })
      .orderBy('username', 'asc');
  },

  async findByInstagramId(instagramId) {
    if (!instagramId) return null;
    return db('meta_instagram_accounts')
      .where({ instagram_id: String(instagramId) })
      .first();
  },
};
