/**
 * @typedef {Object} MetaPage
 * @property {number} id
 * @property {number} company_id
 * @property {string} page_id
 * @property {string} name
 * @property {string|null} access_token_encrypted
 * @property {Date|string} created_at
 * @property {Date|string} updated_at
 */

export function toPublicMetaPage(row) {
  if (!row) return null;
  return {
    id: row.id,
    pageId: row.page_id,
    name: row.name,
  };
}
