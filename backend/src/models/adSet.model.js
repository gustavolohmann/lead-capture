export function toPublicAdSet(row) {
  if (!row) return null;

  let targeting = row.targeting;
  if (typeof targeting === 'string') {
    try {
      targeting = JSON.parse(targeting);
    } catch {
      targeting = null;
    }
  }

  return {
    id: row.id,
    campaignId: row.campaign_id,
    metaAdsetId: row.meta_adset_id,
    name: row.name,
    dailyBudget: row.daily_budget == null ? null : Number(row.daily_budget),
    targeting,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
