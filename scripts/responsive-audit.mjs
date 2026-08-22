import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUT = 'C:/workspace/lead-capture/tests/responsive';
const BASE = 'http://localhost:5173';
const API = 'http://localhost:3001';

const VIEWPORTS = [
  { name: '375', width: 375, height: 812 },
  { name: '428', width: 428, height: 926 },
  { name: '768', width: 768, height: 1024 },
  { name: '1280', width: 1280, height: 800 },
  { name: '1536', width: 1536, height: 900 },
];

const ROUTES = [
  ['/login', 'login', true],
  ['/meta', 'meta'],
  ['/meta-ads', 'meta-ads'],
  ['/leads', 'leads'],
  ['/campaigns', 'campaigns'],
  ['/campaigns/new/leads', 'wizard-leads'],
  ['/forms', 'forms'],
  ['/forms/new', 'form-builder'],
  ['/conversations', 'conversations'],
  ['/automations', 'automations'],
  ['/whatsapp/templates', 'wa-templates'],
];

const only = process.argv.slice(2);
const routeFilter = only.length ? only : null;

fs.mkdirSync(OUT, { recursive: true });

const loginRes = await fetch(`${API}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'dev@localhost.com', password: 'senha12345' }),
});
const loginJson = await loginRes.json();
if (!loginJson?.token) {
  console.error('LOGIN_FAILED', loginJson);
  process.exit(1);
}

const measure = () => {
  const de = document.documentElement;
  const vw = de.clientWidth;
  const offenders = [];
  const small = [];
  const seen = new Set();
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden' || st.display === 'none') continue;
    const over = Math.round(r.right - vw);
    if (over > 1 || r.left < -1) {
      const sig =
        el.tagName + '.' + (el.className?.toString?.().slice(0, 60) || '');
      if (!seen.has(sig)) {
        seen.add(sig);
        offenders.push({
          sel: sig,
          right: Math.round(r.right),
          left: Math.round(r.left),
          w: Math.round(r.width),
        });
      }
    }
    if (
      el.matches(
        'button, a[href], input:not([type=hidden]), select, textarea, [role=button]'
      )
    ) {
      if (r.width > 0 && (r.width < 40 || r.height < 40)) {
        small.push({
          sel:
            el.tagName +
            '.' +
            (el.className?.toString?.().slice(0, 40) || '') +
            ' | ' +
            (el.textContent || '').trim().slice(0, 24),
          w: Math.round(r.width),
          h: Math.round(r.height),
        });
      }
    }
  }
  return {
    vw,
    scrollW: de.scrollWidth,
    bodyScrollW: document.body.scrollWidth,
    hOverflow: de.scrollWidth - vw,
    offenders: offenders.slice(0, 12),
    small: small.slice(0, 12),
  };
};

const browser = await chromium.launch({ headless: true });
const report = [];

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ({ token, user }) => {
      localStorage.setItem('lead_capture_token', token);
      localStorage.setItem('lead_capture_user', JSON.stringify(user));
    },
    { token: loginJson.token, user: loginJson.user }
  );

  for (const [route, name, isPublic] of ROUTES) {
    if (routeFilter && !routeFilter.includes(name)) continue;
    if (isPublic) {
      await page.evaluate(() => localStorage.clear());
    }
    try {
      await page.goto(`${BASE}${route}`, {
        waitUntil: 'networkidle',
        timeout: 20000,
      });
    } catch {
      /* keep going, measure what rendered */
    }
    await page.waitForTimeout(600);
    const m = await page.evaluate(measure);
    report.push({ vp: vp.name, route: name, ...m });
    const dir = path.join(OUT, vp.name);
    fs.mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: path.join(dir, `${name}.png`) });
    if (isPublic) {
      await page.evaluate(
        ({ token, user }) => {
          localStorage.setItem('lead_capture_token', token);
          localStorage.setItem('lead_capture_user', JSON.stringify(user));
        },
        { token: loginJson.token, user: loginJson.user }
      );
    }
  }

  if (!routeFilter || routeFilter.includes('campaigns')) {
    await page.goto(`${BASE}/campaigns`, { waitUntil: 'networkidle' });
    await page.locator('.campaigns-name-button').first().click();
    await page.waitForTimeout(700);
    const m = await page.evaluate(measure);
    report.push({ vp: vp.name, route: 'campaign-expanded', ...m });
    const dir = path.join(OUT, vp.name);
    fs.mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: path.join(dir, 'campaign-expanded.png') });
  }

  if (!routeFilter || routeFilter.includes('wizard-leads')) {
    await page.evaluate(() => {
      localStorage.setItem(
        'lc_campaign_draft_leads',
        JSON.stringify({
          version: 3,
          objective: 'leads',
          updatedAt: new Date().toISOString(),
          step: 1,
          state: {
            campaign: { name: 'Campanha responsiva 1:N', dailyBudget: 50 },
            form: { mode: 'new', title: 'Formulário', questions: [] },
            audience: { country: 'BR', locations: [], ageMin: 25, ageMax: 55, gender: 'all' },
            ads: [
              {
                clientKey: 'responsive-ad-1',
                name: 'Anúncio principal',
                primaryText: 'Texto principal',
                title: 'Título',
                description: '',
                cta: 'get_quote',
                hasImage: false,
              },
            ],
          },
        })
      );
    });
    await page.goto(`${BASE}/campaigns/new/leads`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Adicionar anúncio/i }).click();
    await page.getByRole('button', { name: /Duplicar Anúncio principal/i }).click();
    await page.waitForTimeout(250);
    const m = await page.evaluate(measure);
    report.push({ vp: vp.name, route: 'wizard-leads-ads', ...m });
    const dir = path.join(OUT, vp.name);
    fs.mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: path.join(dir, 'wizard-leads-ads.png') });
  }
  await ctx.close();
}

fs.writeFileSync(
  path.join(OUT, 'report.json'),
  JSON.stringify(report, null, 2)
);

for (const r of report) {
  const flags = [];
  if (r.hOverflow > 1) flags.push(`OVERFLOW +${r.hOverflow}px`);
  if (r.small.length) flags.push(`SMALL_TARGETS ${r.small.length}`);
  console.log(
    `${r.vp.padEnd(5)} ${r.route.padEnd(14)} ${flags.length ? flags.join(' | ') : 'ok'}`
  );
}
console.log('AUDIT_DONE');
