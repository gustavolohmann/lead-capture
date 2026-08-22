import bcrypt from 'bcrypt';
import { db } from '../../../../backend/src/config/database.js';
import { encrypt } from '../../../../backend/src/utils/encryption.js';

export const TEST_MASTER = {
  name: 'Master E2E',
  email: 'master@example.com',
  password: 'senha12345',
};

export const TEST_USER_B = {
  name: 'User Empresa B',
  email: 'userb@example.com',
  password: 'senha12345',
};

async function ensureRoles() {
  for (const name of ['USER', 'ADMIN', 'MASTER']) {
    const existing = await db('roles').where({ name }).first();
    if (!existing) await db('roles').insert({ name });
  }
}

export async function resetTestData() {
  if (process.env.DATABASE_NAME !== 'lead_capture_test') {
    throw new Error('resetTestData só pode rodar em lead_capture_test');
  }

  await db.raw('SET FOREIGN_KEY_CHECKS = 0');
  const tables = [
    'campaign_publications',
    'notifications',
    'messages',
    'conversations',
    'automation_executions',
    'automation_steps',
    'automation_runs',
    'automations',
    'lead_answers',
    'leads',
    'form_fields',
    'forms',
    'ads',
    'ad_creatives',
    'ad_sets',
    'campaigns',
    'lead_forms',
    'webhook_events',
    'oauth_states',
    'meta_whatsapp_accounts',
    'meta_instagram_accounts',
    'meta_ad_accounts',
    'meta_pages',
    'meta_connections',
    'users',
    'companies',
  ];
  for (const table of tables) {
    const exists = await db.schema.hasTable(table);
    if (exists) await db(table).del();
  }
  await db.raw('SET FOREIGN_KEY_CHECKS = 1');
  await ensureRoles();
}

export async function seedMasterUser({ withCompany = false } = {}) {
  await ensureRoles();
  const masterRole = await db('roles').where({ name: 'MASTER' }).first();
  const hash = await bcrypt.hash(TEST_MASTER.password, 10);

  const [userId] = await db('users').insert({
    name: TEST_MASTER.name,
    email: TEST_MASTER.email,
    password_hash: hash,
    role_id: masterRole.id,
    company_id: null,
    status: 'ACTIVE',
  });

  let companyId = null;
  if (withCompany) {
    const [cid] = await db('companies').insert({
      name: 'Empresa Master E2E',
      owner_user_id: userId,
      status: 'ACTIVE',
    });
    companyId = cid;
    await db('users').where({ id: userId }).update({ company_id: companyId });
  }

  return { userId, companyId };
}

export async function seedSecondCompanyUser() {
  await ensureRoles();
  const userRole = await db('roles').where({ name: 'USER' }).first();
  const hash = await bcrypt.hash(TEST_USER_B.password, 10);

  const [userId] = await db('users').insert({
    name: TEST_USER_B.name,
    email: TEST_USER_B.email,
    password_hash: hash,
    role_id: userRole.id,
    company_id: null,
    status: 'ACTIVE',
  });

  const [companyId] = await db('companies').insert({
    name: 'Empresa B E2E',
    owner_user_id: userId,
    status: 'ACTIVE',
  });

  await db('users').where({ id: userId }).update({ company_id: companyId });
  return { userId, companyId };
}

/** Fixture de integração Meta (somente setup de teste). */
export async function seedMetaFixtures(companyId) {
  await db('meta_connections').insert({
    company_id: companyId,
    business_id: 'mock_business_1',
    access_token_encrypted: encrypt(`mock_user_token_${companyId}`),
    token_type: 'bearer',
    expires_at: new Date(Date.now() + 86400000 * 30),
    scopes: 'ads_management,pages_show_list',
  });

  await db('meta_pages').insert({
    company_id: companyId,
    page_id: '999',
    name: 'Página E2E',
    access_token_encrypted: encrypt(`mock_page_token_${companyId}`),
  });

  await db('meta_ad_accounts').insert({
    company_id: companyId,
    account_id: 'act_123456',
    name: 'Ad Account E2E',
    status: 'ACTIVE',
  });

  await db('meta_whatsapp_accounts').insert({
    company_id: companyId,
    business_account_id: `waba_e2e_${companyId}`,
    phone_number: '+5541999999999',
    phone_number_id: `phone_${companyId}`,
  });

  return {
    pageId: '999',
    adAccountId: 'act_123456',
    wabaId: `waba_e2e_${companyId}`,
    phoneNumberId: `phone_${companyId}`,
  };
}

export { db };
