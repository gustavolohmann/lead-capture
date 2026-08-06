/**
 * @typedef {Object} MetaConnection
 * @property {number} id
 * @property {number} company_id
 * @property {string|null} business_id
 * @property {string} access_token_encrypted
 * @property {string|null} token_type
 * @property {Date|string|null} expires_at
 * @property {string|null} scopes
 * @property {Date|string} created_at
 * @property {Date|string} updated_at
 */

export function toPublicMetaConnection(row) {
  if (!row) return null;

  return {
    connected: true,
    businessId: row.business_id,
    tokenType: row.token_type,
    expiresAt: row.expires_at,
  };
}
