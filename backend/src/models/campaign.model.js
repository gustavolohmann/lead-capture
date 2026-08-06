export const CampaignObjective = Object.freeze({
  LEAD_GENERATION: 'LEAD_GENERATION',
  MESSAGES: 'MESSAGES',
  TRAFFIC: 'TRAFFIC',
});

/** Objetivo do produto → objective da Marketing API */
export const META_OBJECTIVE_BY_PRODUCT = Object.freeze({
  [CampaignObjective.LEAD_GENERATION]: 'OUTCOME_LEADS',
  [CampaignObjective.MESSAGES]: 'OUTCOME_ENGAGEMENT',
  [CampaignObjective.TRAFFIC]: 'OUTCOME_TRAFFIC',
});

export const CampaignStatus = Object.freeze({
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  ARCHIVED: 'ARCHIVED',
  DELETED: 'DELETED',
});

/**
 * @typedef {Object} Campaign
 * @property {number} id
 * @property {number} company_id
 * @property {string} ad_account_id
 * @property {string|null} campaign_id
 * @property {string} name
 * @property {string} objective
 * @property {string} status
 * @property {number|string|null} daily_budget
 * @property {Date|string} created_at
 * @property {Date|string} updated_at
 */

export function toPublicCampaign(row) {
  if (!row) return null;

  return {
    id: row.id,
    adAccountId: row.ad_account_id,
    campaignId: row.campaign_id,
    name: row.name,
    objective: row.objective,
    status: row.status,
    dailyBudget:
      row.daily_budget == null ? null : Number(row.daily_budget),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
