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
    return db('campaigns as c')
      .where({ 'c.company_id': companyId })
      .select('c.*')
      .select(
        db.raw(
          `(SELECT COUNT(*)
              FROM ads a
              JOIN ad_sets s ON s.id = a.ad_set_id
             WHERE s.campaign_id = c.id
               AND s.company_id = c.company_id
               AND a.company_id = c.company_id) AS ad_count`
        )
      )
      .orderBy('c.created_at', 'desc');
  },

  async findHierarchy(companyId, id) {
    const campaign = await this.findById(companyId, id);
    if (!campaign) return null;

    const [adSets, ads] = await Promise.all([
      db('ad_sets')
        .where({ company_id: companyId, campaign_id: id })
        .orderBy('created_at', 'asc'),
      db('ads as a')
        .join('ad_sets as s', 's.id', 'a.ad_set_id')
        .leftJoin('ad_creatives as c', 'c.id', 'a.creative_id')
        .where({
          'a.company_id': companyId,
          's.company_id': companyId,
          's.campaign_id': id,
        })
        .select(
          'a.id',
          'a.company_id',
          'a.ad_set_id',
          'a.creative_id',
          'a.meta_ad_id',
          'a.name',
          'a.status',
          'a.created_at',
          'a.updated_at',
          's.meta_adset_id',
          'c.meta_creative_id',
          'c.name as creative_name',
          'c.title as creative_title',
          'c.body as creative_body',
          'c.image_hash as creative_image_hash',
          'c.cta_type as creative_cta_type',
          'c.status as creative_status'
        )
        .orderBy('a.created_at', 'asc'),
    ]);

    return { campaign, adSets, ads };
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
    return db.transaction(async (trx) => {
      const adSets = await trx('ad_sets')
        .where({ company_id: companyId, campaign_id: id })
        .select('id');
      const adSetIds = adSets.map((row) => row.id);

      if (adSetIds.length > 0) {
        const ads = await trx('ads')
          .where({ company_id: companyId })
          .whereIn('ad_set_id', adSetIds)
          .select('id', 'creative_id');
        const creativeIds = [
          ...new Set(ads.map((row) => row.creative_id).filter(Boolean)),
        ];

        await trx('ads')
          .where({ company_id: companyId })
          .whereIn('ad_set_id', adSetIds)
          .del();

        if (creativeIds.length > 0) {
          const stillReferenced = await trx('ads')
            .where({ company_id: companyId })
            .whereIn('creative_id', creativeIds)
            .select('creative_id');
          const referencedIds = new Set(
            stillReferenced.map((row) => Number(row.creative_id))
          );
          const unusedCreativeIds = creativeIds.filter(
            (creativeId) => !referencedIds.has(Number(creativeId))
          );

          if (unusedCreativeIds.length > 0) {
            await trx('ad_creatives')
              .where({ company_id: companyId })
              .whereIn('id', unusedCreativeIds)
              .del();
          }
        }

        await trx('ad_sets')
          .where({ company_id: companyId, campaign_id: id })
          .del();
      }

      return trx('campaigns').where({ company_id: companyId, id }).del();
    });
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
