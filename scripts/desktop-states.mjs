import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUT = 'C:/workspace/lead-capture/tests/desktop/states';
const BASE = 'http://localhost:5173';
const API = 'http://localhost:3001';
fs.mkdirSync(OUT, { recursive: true });

const login = await (
  await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'dev@localhost.com', password: 'senha12345' }),
  })
).json();

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await page.evaluate(
  ({ token, user }) => {
    localStorage.setItem('lead_capture_token', token);
    localStorage.setItem('lead_capture_user', JSON.stringify(user));
  },
  { token: login.token, user: login.user }
);

const shot = (n) => page.screenshot({ path: path.join(OUT, `${n}.png`) });

// 1. Campanhas: filtro sem resultados
await page.goto(`${BASE}/campaigns`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await page.locator('.campaigns-filter', { hasText: 'Pausadas' }).click();
await page.waitForTimeout(300);
await shot('01-campaigns-filtro-pausadas');

// 2. Campanhas: hover na linha
await page.locator('.campaigns-filter', { hasText: 'Todas' }).click();
await page.waitForTimeout(300);
await page.locator('.campaigns-table tbody tr').nth(1).hover();
await page.waitForTimeout(200);
await shot('02-campaigns-hover');

// 3. Templates: formulário de criação aberto
await page.goto(`${BASE}/whatsapp/templates`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const novoTpl = page.locator('button', { hasText: /Novo template/i }).first();
if (await novoTpl.count()) {
  await novoTpl.click();
  await page.waitForTimeout(400);
  await shot('03-templates-form');
}

// 4. FormBuilder: validação ao submeter vazio + campo extra
await page.goto(`${BASE}/forms/new`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.locator('button', { hasText: /Adicionar campo/i }).first().click();
await page.waitForTimeout(200);
await page.locator('button', { hasText: /Adicionar campo/i }).first().click();
await page.waitForTimeout(300);
await shot('04-formbuilder-campos');
await page.locator('.forms-page input').first().fill('a');
await page.waitForTimeout(400);
await shot('05-formbuilder-validacao');

// 5. Leads: filtro Qualificados
await page.goto(`${BASE}/leads`, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
await page.locator('.leads-tabs__btn').nth(2).click();
await page.waitForTimeout(500);
await shot('06-leads-qualificados');

// 6. Leads: foco de teclado no primeiro item
await page.keyboard.press('Tab');
await page.keyboard.press('Tab');
await page.keyboard.press('Tab');
await shot('07-leads-foco');

// 7. Wizard: etapa 2 e 3
await page.goto(`${BASE}/campaigns/new/leads`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await shot('08-wizard-etapa1');
const next = page.locator('button', { hasText: /Continuar/i }).first();
if (await next.count()) {
  await next.click();
  await page.waitForTimeout(900);
  await shot('09-wizard-etapa2');
}

// 8. Meta connection: rolagem completa
await page.goto(`${BASE}/meta`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(400);
await shot('10-meta-fim');

await ctx.close();
await browser.close();
console.log('STATES_DONE');
