import { db } from '../config/database.js';

export const metaWhatsappRepository = {
  async upsert({ companyId, businessAccountId, phoneNumber }) {
    await db.raw(
      `INSERT INTO meta_whatsapp_accounts (company_id, business_account_id, phone_number)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         phone_number = VALUES(phone_number)`,
      [companyId, businessAccountId, phoneNumber ?? null]
    );

    return db('meta_whatsapp_accounts')
      .where({
        company_id: companyId,
        business_account_id: businessAccountId,
      })
      .first();
  },

  async findByCompanyId(companyId) {
    return db('meta_whatsapp_accounts')
      .where({ company_id: companyId })
      .orderBy('phone_number', 'asc');
  },
};
