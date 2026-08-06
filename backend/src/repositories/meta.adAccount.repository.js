import { db } from '../config/database.js';

export const metaAdAccountRepository = {
  async upsert({ companyId, accountId, name, status }) {
    await db.raw(
      `INSERT INTO meta_ad_accounts (company_id, account_id, name, status)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         status = VALUES(status),
         updated_at = CURRENT_TIMESTAMP`,
      [companyId, accountId, name ?? null, status ?? null]
    );

    return db('meta_ad_accounts')
      .where({ company_id: companyId, account_id: accountId })
      .first();
  },

  async findByCompanyId(companyId) {
    return db('meta_ad_accounts')
      .where({ company_id: companyId })
      .orderBy('name', 'asc');
  },

  async findByCompanyAndAccountId(companyId, accountId) {
    return db('meta_ad_accounts')
      .where({ company_id: companyId, account_id: accountId })
      .first();
  },
};
