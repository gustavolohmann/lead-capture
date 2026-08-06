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
