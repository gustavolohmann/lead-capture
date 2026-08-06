import { db } from '../config/database.js';

export const metaWhatsappRepository = {
  async upsert({
    companyId,
    businessAccountId,
    phoneNumber,
    phoneNumberId,
  }) {
    await db.raw(
      `INSERT INTO meta_whatsapp_accounts (
         company_id, business_account_id, phone_number, phone_number_id
       )
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         phone_number = VALUES(phone_number),
         phone_number_id = COALESCE(VALUES(phone_number_id), phone_number_id)`,
      [
        companyId,
        businessAccountId,
        phoneNumber ?? null,
        phoneNumberId ?? null,
      ]
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

  async findByPhoneNumberId(phoneNumberId) {
    if (!phoneNumberId) return null;
    return db('meta_whatsapp_accounts')
      .where({ phone_number_id: String(phoneNumberId) })
      .first();
  },

  async findByBusinessAccountId(businessAccountId) {
    if (!businessAccountId) return null;
    return db('meta_whatsapp_accounts')
      .where({ business_account_id: String(businessAccountId) })
      .first();
  },
};
