import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const out = 'C:/workspace/lead-capture/tests/ui-polish';
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
const base = 'http://localhost:5174';

await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });
await page.evaluate(
  ({ token, user }) => {
    localStorage.setItem('lead_capture_token', token);
    localStorage.setItem('lead_capture_user', JSON.stringify(user));
  },
  { token: loginJson.token, user: loginJson.user }
);

await page.goto(`${base}/meta`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(out, '02-shell-meta.png'), fullPage: false });

const routes = [
  ['/leads', '03-leads'],
  ['/campaigns', '04-campaigns'],
  ['/conversations', '05-conversations'],
  ['/meta-ads', '06-meta-ads'],
  ['/forms', '07-forms'],
];

for (const [route, name] of routes) {
  await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: false });
}

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${base}/leads`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.screenshot({ path: path.join(out, '08-leads-mobile.png'), fullPage: false });

await browser.close();
console.log('SHOTS_OK');
