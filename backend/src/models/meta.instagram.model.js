/**
 * @typedef {Object} MetaInstagramAccount
 * @property {number} id
 * @property {number} company_id
 * @property {string} instagram_id
 * @property {string|null} username
 * @property {Date|string} created_at
 */

export function toPublicMetaInstagramAccount(row) {
  if (!row) return null;
  return {
    id: row.id,
    instagramId: row.instagram_id,
    username: row.username,
  };
}
