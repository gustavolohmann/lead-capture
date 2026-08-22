import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const out = 'C:/workspace/lead-capture/tests/ui-stack';
fs.mkdirSync(out, { recursive: true });

const loginRes = await fetch('http://localhost:3001/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'dev@localhost.com',
    password: 'senha12345',
  }),
});
const loginJson = await loginRes.json();
if (!loginJson?.token) {
  console.error('LOGIN_FAILED', loginJson);
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const base = 'http://localhost:5173';

await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });
await page.evaluate(
  ({ token, user }) => {
    localStorage.setItem('lead_capture_token', token);
    localStorage.setItem('lead_capture_user', JSON.stringify(user));
  },
  { token: loginJson.token, user: loginJson.user }
);

await page.goto(`${base}/campaigns`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(out, '01-campaigns.png'), fullPage: false });

// Open create modal + Escape
await page.getByRole('button', { name: /Criar campanha/i }).first().click();
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(out, '02-create-modal.png'), fullPage: false });
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
const modalGone = (await page.locator('.create-campaign-modal').count()) === 0;
console.log('ESCAPE_CLOSES_MODAL=' + modalGone);

// Focus ring check on primary button
await page.getByRole('button', { name: /Criar campanha/i }).first().focus();
await page.waitForTimeout(200);
await page.screenshot({ path: path.join(out, '03-btn-focus.png'), fullPage: false });

for (const [route, name] of [
  ['/leads', '04-leads'],
  ['/meta', '05-meta'],
  ['/forms', '06-forms'],
]) {
  await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: false });
}

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${base}/leads`, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
await page.screenshot({ path: path.join(out, '07-leads-mobile.png'), fullPage: false });
const fabBox = await page.locator('.shell-menu-fab').boundingBox();
console.log('FAB_SIZE=' + JSON.stringify(fabBox && { w: fabBox.width, h: fabBox.height }));

await browser.close();
console.log('SHOTS_OK');
