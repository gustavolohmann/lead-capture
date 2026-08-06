import { db } from '../config/database.js';

export const metaPageRepository = {
  async upsert({ companyId, pageId, name, accessTokenEncrypted }) {
    await db.raw(
      `INSERT INTO meta_pages (company_id, page_id, name, access_token_encrypted)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         access_token_encrypted = VALUES(access_token_encrypted),
         updated_at = CURRENT_TIMESTAMP`,
      [companyId, pageId, name, accessTokenEncrypted]
    );

    return this.findByPageId(companyId, pageId);
  },

  async findByCompanyId(companyId) {
    return db('meta_pages').where({ company_id: companyId }).orderBy('name', 'asc');
  },

  async findByPageId(companyId, pageId) {
    return db('meta_pages')
      .where({ company_id: companyId, page_id: pageId })
      .first();
  },

  async findByExternalPageId(pageId) {
    return db('meta_pages').where({ page_id: pageId }).first();
  },

  async deleteByCompanyId(companyId) {
    return db('meta_pages').where({ company_id: companyId }).del();
  },
};
