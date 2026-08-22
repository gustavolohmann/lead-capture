import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUT = 'C:/workspace/lead-capture/tests/responsive/edges';
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

const widths = (process.env.W || '600,899,900,1024,1440').split(',').map(Number);
const routes = (process.env.R || 'leads,forms,conversations,campaigns').split(',');
const map = {
  leads: '/leads',
  forms: '/forms',
  conversations: '/conversations',
  campaigns: '/campaigns',
  'wizard-leads': '/campaigns/new/leads',
  'form-builder': '/forms/new',
  'meta-ads': '/meta-ads',
  meta: '/meta',
  automations: '/automations',
  'wa-templates': '/whatsapp/templates',
  login: '/login',
};

const browser = await chromium.launch({ headless: true });
for (const w of widths) {
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
  for (const r of routes) {
    await page.goto(`${BASE}${map[r]}`, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => {
      const de = document.documentElement;
      const gaps = [];
      for (const el of document.querySelectorAll('body *')) {
        const st = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        if (
          st.overflow === 'hidden' &&
          el.scrollHeight - el.clientHeight > 8 &&
          el.clientHeight > 40
        ) {
          gaps.push(
            el.tagName + '.' + (el.className?.toString?.().slice(0, 40) || '') +
              ` ${el.scrollHeight}/${el.clientHeight}`
          );
        }
        if (rect.right - de.clientWidth > 1) {
          gaps.push('OVERFLOW ' + el.tagName + '.' + (el.className?.toString?.().slice(0, 40) || ''));
        }
      }
      return { hOverflow: de.scrollWidth - de.clientWidth, gaps: gaps.slice(0, 6) };
    });
    console.log(`${w} ${r} ${JSON.stringify(m)}`);
    fs.mkdirSync(path.join(OUT, String(w)), { recursive: true });
    await page.screenshot({ path: path.join(OUT, String(w), `${r}.png`) });
  }
  await ctx.close();
}
await browser.close();
console.log('EDGES_DONE');
