import { db } from '../config/database.js';

export const adCreativeRepository = {
  async create({
    companyId,
    adAccountId,
    metaCreativeId,
    name,
    title,
    body,
    imageHash,
    ctaType,
    status = 'ACTIVE',
  }) {
    const [id] = await db('ad_creatives').insert({
      company_id: companyId,
      ad_account_id: adAccountId,
      meta_creative_id: metaCreativeId ?? null,
      name,
      title: title ?? null,
      body: body ?? null,
      image_hash: imageHash ?? null,
      cta_type: ctaType ?? null,
      status,
    });

    return this.findById(companyId, id);
  },

  async findById(companyId, id) {
    return db('ad_creatives').where({ company_id: companyId, id }).first();
  },

  async findByCompanyId(companyId) {
    return db('ad_creatives')
      .where({ company_id: companyId })
      .orderBy('created_at', 'desc');
  },
};
