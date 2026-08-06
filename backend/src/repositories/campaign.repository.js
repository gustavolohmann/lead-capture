import { db } from '../config/database.js';
import { CampaignObjective, CampaignStatus } from '../models/campaign.model.js';

export const campaignRepository = {
  async create({
    companyId,
    adAccountId,
    campaignId,
    name,
    objective = CampaignObjective.LEAD_GENERATION,
    status = CampaignStatus.PAUSED,
    dailyBudget,
  }) {
    const [id] = await db('campaigns').insert({
      company_id: companyId,
      ad_account_id: adAccountId,
      campaign_id: campaignId ?? null,
      name,
      objective,
      status,
      daily_budget: dailyBudget ?? null,
    });

    return this.findById(companyId, id);
  },

  async findById(companyId, id) {
    return db('campaigns').where({ company_id: companyId, id }).first();
  },

  async findByCompanyId(companyId) {
    return db('campaigns')
      .where({ company_id: companyId })
      .orderBy('created_at', 'desc');
  },

  async findByMetaCampaignId(companyId, campaignId) {
    return db('campaigns')
      .where({ company_id: companyId, campaign_id: campaignId })
      .first();
  },

  async updateStatus(companyId, id, status) {
    await db('campaigns')
      .where({ company_id: companyId, id })
      .update({ status });

    return this.findById(companyId, id);
  },

  async deleteCascade(companyId, id) {
    const adSets = await db('ad_sets')
      .where({ company_id: companyId, campaign_id: id })
      .select('id');
    const adSetIds = adSets.map((row) => row.id);

    if (adSetIds.length > 0) {
      const ads = await db('ads')
        .where({ company_id: companyId })
        .whereIn('ad_set_id', adSetIds)
        .select('id', 'creative_id');
      const creativeIds = [
        ...new Set(ads.map((row) => row.creative_id).filter(Boolean)),
      ];

      await db('ads')
        .where({ company_id: companyId })
        .whereIn('ad_set_id', adSetIds)
        .del();

      if (creativeIds.length > 0) {
        await db('ad_creatives')
          .where({ company_id: companyId })
          .whereIn('id', creativeIds)
          .del();
      }

      await db('ad_sets')
        .where({ company_id: companyId, campaign_id: id })
        .del();
    }

    await db('campaigns').where({ company_id: companyId, id }).del();
  },

  async upsert({
    companyId,
    adAccountId,
    campaignId,
    name,
    objective,
    status,
    dailyBudget,
  }) {
    await db.raw(
      `INSERT INTO campaigns
        (company_id, ad_account_id, campaign_id, name, objective, status, daily_budget)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         ad_account_id = VALUES(ad_account_id),
         name = VALUES(name),
         objective = VALUES(objective),
         status = VALUES(status),
         daily_budget = VALUES(daily_budget),
         updated_at = CURRENT_TIMESTAMP`,
      [
        companyId,
        adAccountId,
        campaignId,
        name,
        objective || CampaignObjective.LEAD_GENERATION,
        status || CampaignStatus.PAUSED,
        dailyBudget ?? null,
      ]
    );

    return this.findByMetaCampaignId(companyId, campaignId);
  },
};
