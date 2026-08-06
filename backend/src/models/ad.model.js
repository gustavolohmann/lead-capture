export function toPublicAd(row) {
  if (!row) return null;

  return {
    id: row.id,
    adSetId: row.ad_set_id,
    creativeId: row.creative_id,
    metaAdId: row.meta_ad_id,
    name: row.name,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
