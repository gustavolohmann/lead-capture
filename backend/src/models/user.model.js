export const UserStatus = Object.freeze({
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
});

/**
 * @typedef {Object} User
 * @property {number} id
 * @property {string} name
 * @property {string} email
 * @property {string} password_hash
 * @property {number} role_id
 * @property {number|null} company_id
 * @property {'ACTIVE'|'INACTIVE'} status
 * @property {Date|string} created_at
 * @property {Date|string} updated_at
 */

/**
 * @param {User & { role_name?: string }} row
 * @param {{ id: number, name: string } | null} [company]
 */
export function toPublicUser(row, company = null) {
  return {
    id: row.id,
    name: row.name,
    role: row.role_name,
    companyId: company?.id ?? row.company_id ?? null,
    companyName: company?.name ?? null,
  };
}
