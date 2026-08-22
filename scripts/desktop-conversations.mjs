import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUT = 'C:/workspace/lead-capture/tests/desktop/conversas';
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
for (const w of (process.env.W || '1440').split(',').map(Number)) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ({ token, user }) => {
      localStorage.setItem('lead_capture_token', token);
      localStorage.setItem('lead_capture_user', JSON.stringify(user));
    },
    { token: login.token, user: login.user }
  );

  const shot = (n) => page.screenshot({ path: path.join(OUT, `${w}-${n}.png`) });

  await page.goto(`${BASE}/conversations`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await shot('01-lista');

  await page.locator('.conversations-item').first().click();
  await page.waitForTimeout(1200);
  await shot('02-conversa-aberta');

  await page.locator('.conversations-item').nth(1).click();
  await page.waitForTimeout(1200);
  await shot('03-mensagem-longa');

  await page.locator('.conversations-filters__chip', { hasText: 'Instagram' }).click();
  await page.waitForTimeout(500);
  await shot('04-filtro-instagram');

  await page.locator('.conversations-filters__chip', { hasText: 'Não lidas' }).click();
  await page.waitForTimeout(500);
  await shot('05-filtro-nao-lidas');

  await page.locator('.conversations-filters__chip', { hasText: 'Todos' }).click();
  await page.locator('.conversations-list__items').evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await page.waitForTimeout(400);
  await shot('07-lista-fim');


  await page.locator('.conversations-search input, input.conversations-search').first().fill('zzz');
  await page.waitForTimeout(500);
  await shot('06-busca-sem-resultado');

  await ctx.close();
}
await browser.close();
console.log('CONVERSAS_DONE');
