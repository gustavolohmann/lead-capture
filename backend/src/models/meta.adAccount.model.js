/**
 * @typedef {Object} MetaAdAccount
 * @property {number} id
 * @property {number} company_id
 * @property {string} account_id
 * @property {string|null} name
 * @property {string|null} status
 * @property {Date|string} created_at
 * @property {Date|string} updated_at
 */

export function toPublicMetaAdAccount(row) {
  if (!row) return null;
  return {
    id: row.id,
    accountId: row.account_id,
    name: row.name,
    status: row.status,
  };
}
