export const CompanyStatus = Object.freeze({
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
});

/**
 * @typedef {Object} Company
 * @property {number} id
 * @property {string} name
 * @property {number} owner_user_id
 * @property {'ACTIVE'|'INACTIVE'} status
 * @property {Date|string} created_at
 * @property {Date|string} updated_at
 */

/**
 * @param {Company} row
 */
export function toPublicCompany(row) {
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    status: row.status,
  };
}
