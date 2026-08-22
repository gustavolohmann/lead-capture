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

  async findByMetaAdId(companyId, metaAdId) {
    if (!metaAdId) return null;
    return db('ads')
      .where({ company_id: companyId, meta_ad_id: String(metaAdId) })
      .first();
  },

  async upsertByMetaAdId({
    companyId,
    adSetId,
    creativeId,
    metaAdId,
    name,
    status = 'PAUSED',
  }) {
    const existing = await this.findByMetaAdId(companyId, metaAdId);
    if (existing) {
      await db('ads')
        .where({ id: existing.id, company_id: companyId })
        .update({
          ad_set_id: adSetId,
          creative_id: creativeId,
          name,
          status,
        });
      return this.findById(companyId, existing.id);
    }

    return this.create({
      companyId,
      adSetId,
      creativeId,
      metaAdId,
      name,
      status,
    });
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

  async findByCampaignAndId(companyId, campaignId, id) {
    return db('ads as a')
      .join('ad_sets as s', 's.id', 'a.ad_set_id')
      .where({
        'a.company_id': companyId,
        's.company_id': companyId,
        's.campaign_id': campaignId,
        'a.id': id,
      })
      .select('a.*')
      .first();
  },

  async updateStatus(companyId, id, status) {
    await db('ads').where({ company_id: companyId, id }).update({ status });
    return this.findById(companyId, id);
  },

  async deleteByMetaAdId(companyId, metaAdId) {
    if (!metaAdId) return 0;
    return db('ads')
      .where({ company_id: companyId, meta_ad_id: String(metaAdId) })
      .del();
  },
};
