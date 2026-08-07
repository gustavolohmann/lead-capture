import { db } from '../config/database.js';

function serializeJson(value) {
  if (value == null) return null;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export const adSetRepository = {
  async create({
    companyId,
    campaignId,
    metaAdsetId,
    name,
    dailyBudget,
    targeting,
    status = 'PAUSED',
  }) {
    const [id] = await db('ad_sets').insert({
      company_id: companyId,
      campaign_id: campaignId,
      meta_adset_id: metaAdsetId ?? null,
      name,
      daily_budget: dailyBudget ?? null,
      targeting: serializeJson(targeting),
      status,
    });

    return this.findById(companyId, id);
  },

  async findById(companyId, id) {
    return db('ad_sets').where({ company_id: companyId, id }).first();
  },

  async findByMetaAdsetId(companyId, metaAdsetId) {
    if (!metaAdsetId) return null;
    return db('ad_sets')
      .where({
        company_id: companyId,
        meta_adset_id: String(metaAdsetId),
      })
      .first();
  },

  async upsertByMetaAdsetId({
    companyId,
    campaignId,
    metaAdsetId,
    name,
    dailyBudget,
    targeting,
    status = 'PAUSED',
  }) {
    const existing = await this.findByMetaAdsetId(companyId, metaAdsetId);
    if (existing) {
      await db('ad_sets')
        .where({ id: existing.id, company_id: companyId })
        .update({
          campaign_id: campaignId,
          name,
          daily_budget: dailyBudget ?? null,
          targeting: serializeJson(targeting),
          status,
        });
      return this.findById(companyId, existing.id);
    }

    return this.create({
      companyId,
      campaignId,
      metaAdsetId,
      name,
      dailyBudget,
      targeting,
      status,
    });
  },

  async findByCampaignId(companyId, campaignId) {
    return db('ad_sets')
      .where({ company_id: companyId, campaign_id: campaignId })
      .orderBy('created_at', 'desc');
  },

  async findByCompanyId(companyId) {
    return db('ad_sets')
      .where({ company_id: companyId })
      .orderBy('created_at', 'desc');
  },
};
