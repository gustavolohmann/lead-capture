export function toPublicAdCreative(row) {
  if (!row) return null;

  return {
    id: row.id,
    adAccountId: row.ad_account_id,
    metaCreativeId: row.meta_creative_id,
    name: row.name,
    title: row.title,
    body: row.body,
    imageHash: row.image_hash,
    ctaType: row.cta_type,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
