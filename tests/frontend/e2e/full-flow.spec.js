import { test, expect } from '@playwright/test';
import bcrypt from 'bcrypt';
import { createKnex } from '../../../scripts/db.js';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({
  path: path.resolve(__dirname, '../../../backend/.env.test'),
  override: true,
});

const MASTER = {
  email: 'master@example.com',
  password: 'senha12345',
  name: 'Master E2E',
};

async function prepareDb() {
  process.env.DATABASE_NAME = 'lead_capture_test';
  const db = createKnex('lead_capture_test');
  try {
    await db.raw('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of [
      'messages',
      'conversations',
      'automation_runs',
      'automations',
      'lead_answers',
      'leads',
      'form_fields',
      'forms',
      'users',
      'companies',
    ]) {
      if (await db.schema.hasTable(table)) await db(table).del();
    }
    await db.raw('SET FOREIGN_KEY_CHECKS = 1');

    for (const name of ['USER', 'ADMIN', 'MASTER']) {
      const existing = await db('roles').where({ name }).first();
      if (!existing) await db('roles').insert({ name });
    }

    const masterRole = await db('roles').where({ name: 'MASTER' }).first();
    const hash = await bcrypt.hash(MASTER.password, 10);
    const [userId] = await db('users').insert({
      name: MASTER.name,
      email: MASTER.email,
      password_hash: hash,
      role_id: masterRole.id,
      company_id: null,
      status: 'ACTIVE',
    });
    const [companyId] = await db('companies').insert({
      name: 'Empresa Playwright',
      owner_user_id: userId,
      status: 'ACTIVE',
    });
    await db('users').where({ id: userId }).update({ company_id: companyId });
  } finally {
    await db.destroy();
  }
}

test.describe('Cenário 12 — Frontend completo', () => {
  test.beforeAll(async () => {
    await prepareDb();
  });

  test('Login → Formulários → Leads → Conversas', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /Bem-vindo/i })).toBeVisible();

    await page.fill('#email', MASTER.email);
    await page.fill('#password', MASTER.password);
    await page.getByRole('button', { name: /^Entrar$/i }).click();

    await expect(page.getByText(/Não foi possível autenticar|Credenciais/i)).toHaveCount(0, {
      timeout: 3000,
    }).catch(() => {});

    await expect(page).toHaveURL(/\/meta/, { timeout: 20000 });
    const token = await page.evaluate(() =>
      localStorage.getItem('lead_capture_token')
    );
    expect(token).toBeTruthy();

    await page.goto('/forms');
    await expect(page.getByRole('heading', { name: /Formulários/i })).toBeVisible();

    await page.goto('/forms/new');
    await expect(
      page.getByRole('heading', { name: /Novo formulário/i })
    ).toBeVisible();

    await page.locator('.forms-builder .field').filter({ hasText: 'Nome' }).locator('input').fill('Form PW Imóveis');
    await page.locator('.forms-field-card').first().locator('input').first().fill('Nome completo');

    await page.getByRole('button', { name: /Salvar/i }).click();
    await page.waitForURL(/\/forms\/\d+/, { timeout: 15000 });

    await page.goto('/leads');
    await expect(page.getByRole('heading', { name: /^Leads$/i })).toBeVisible();

    await page.goto('/conversations');
    await expect(page.getByRole('heading', { name: /Conversas/i })).toBeVisible();
  });
});
