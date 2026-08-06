/**
 * @typedef {Object} MetaWhatsappAccount
 * @property {number} id
 * @property {number} company_id
 * @property {string} business_account_id
 * @property {string|null} phone_number
 * @property {Date|string} created_at
 */

export function toPublicMetaWhatsappAccount(row) {
  if (!row) return null;
  return {
    id: row.id,
    businessAccountId: row.business_account_id,
    phoneNumber: row.phone_number,
  };
}
