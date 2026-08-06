import { db } from '../config/database.js';

export const metaConnectionRepository = {
  async create(data) {
    const [id] = await db('meta_connections').insert({
      company_id: data.companyId,
      business_id: data.businessId ?? null,
      access_token_encrypted: data.accessTokenEncrypted,
      token_type: data.tokenType ?? null,
      expires_at: data.expiresAt ?? null,
      scopes: data.scopes ?? null,
    });

    return this.findById(id);
  },

  async findById(id) {
    return db('meta_connections').where({ id }).first();
  },

  async findByCompanyId(companyId) {
    return db('meta_connections').where({ company_id: companyId }).first();
  },

  async exists(companyId) {
    const row = await db('meta_connections')
      .where({ company_id: companyId })
      .first('id');
    return Boolean(row);
  },

  async update(companyId, data) {
    await db('meta_connections')
      .where({ company_id: companyId })
      .update({
        business_id: data.businessId ?? null,
        access_token_encrypted: data.accessTokenEncrypted,
        token_type: data.tokenType ?? null,
        expires_at: data.expiresAt ?? null,
        scopes: data.scopes ?? null,
      });

    return this.findByCompanyId(companyId);
  },

  async upsertByCompanyId(data) {
    const existing = await this.findByCompanyId(data.companyId);
    if (existing) {
      return this.update(data.companyId, data);
    }
    return this.create(data);
  },

  async deleteByCompanyId(companyId) {
    return db('meta_connections').where({ company_id: companyId }).del();
  },
};
