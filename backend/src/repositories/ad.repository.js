import { db } from '../config/database.js';

export const adRepository = {
  async create({
    companyId,
    adSetId,
    creativeId,
    metaAdId,
    name,
    status = 'PAUSED',
  }) {
    const [id] = await db('ads').insert({
      company_id: companyId,
      ad_set_id: adSetId,
      creative_id: creativeId,
      meta_ad_id: metaAdId ?? null,
      name,
      status,
    });

    return this.findById(companyId, id);
  },

  async findById(companyId, id) {
    return db('ads').where({ company_id: companyId, id }).first();
  },

  async findByCompanyId(companyId) {
    return db('ads')
      .where({ company_id: companyId })
      .orderBy('created_at', 'desc');
  },

  async findByAdSetId(companyId, adSetId) {
    return db('ads')
      .where({ company_id: companyId, ad_set_id: adSetId })
      .orderBy('created_at', 'desc');
  },
};
