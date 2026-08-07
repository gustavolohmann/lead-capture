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

  async findByMetaCreativeId(companyId, metaCreativeId) {
    if (!metaCreativeId) return null;
    return db('ad_creatives')
      .where({
        company_id: companyId,
        meta_creative_id: String(metaCreativeId),
      })
      .first();
  },

  async upsertByMetaCreativeId({
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
    const existing = await this.findByMetaCreativeId(
      companyId,
      metaCreativeId
    );
    if (existing) {
      await db('ad_creatives')
        .where({ id: existing.id, company_id: companyId })
        .update({
          ad_account_id: adAccountId,
          name,
          title: title ?? null,
          body: body ?? null,
          image_hash: imageHash ?? null,
          cta_type: ctaType ?? null,
          status,
        });
      return this.findById(companyId, existing.id);
    }

    return this.create({
      companyId,
      adAccountId,
      metaCreativeId,
      name,
      title,
      body,
      imageHash,
      ctaType,
      status,
    });
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
