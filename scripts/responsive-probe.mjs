import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUT = 'C:/workspace/lead-capture/tests/responsive/probe';
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

const probe = () => {
  const res = { clipped: [], hscroll: [], fabCovers: null };
  for (const el of document.querySelectorAll('body *')) {
    const st = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const sig = el.tagName + '.' + (el.className?.toString?.().slice(0, 50) || '');
    if (
      el.scrollWidth - el.clientWidth > 2 &&
      (st.overflowX === 'auto' || st.overflowX === 'scroll')
    ) {
      res.hscroll.push({ sig, sw: el.scrollWidth, cw: el.clientWidth });
    }
    if (
      st.overflow === 'hidden' &&
      el.scrollHeight - el.clientHeight > 8 &&
      el.clientHeight > 40
    ) {
      res.clipped.push({ sig, sh: el.scrollHeight, ch: el.clientHeight });
    }
  }
  const fab = document.querySelector('.shell-menu-fab');
  if (fab && getComputedStyle(fab).display !== 'none') {
    const r = fab.getBoundingClientRect();
    res.fabSize = { w: Math.round(r.width), h: Math.round(r.height) };
    const hit = document.elementFromPoint(r.left - 6, r.top + r.height / 2);
    const below = document.elementsFromPoint(
      r.left + r.width / 2,
      r.top + r.height / 2
    )
      .slice(1, 4)
      .map((e) => e.tagName + '.' + (e.className?.toString?.().slice(0, 40) || ''));
    res.fabCovers = below;
    res.fabLeftNeighbor = hit
      ? hit.tagName + '.' + (hit.className?.toString?.().slice(0, 40) || '')
      : null;
  }
  return res;
};

const browser = await chromium.launch({ headless: true });

for (const vp of [
  { name: '375', width: 375, height: 812 },
  { name: '768', width: 768, height: 1024 },
]) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ({ token, user }) => {
      localStorage.setItem('lead_capture_token', token);
      localStorage.setItem('lead_capture_user', JSON.stringify(user));
    },
    { token: login.token, user: login.user }
  );

  for (const [route, name] of [
    ['/leads', 'leads'],
    ['/forms', 'forms'],
    ['/forms/new', 'form-builder'],
    ['/campaigns/new/leads', 'wizard-leads'],
    ['/conversations', 'conversations'],
    ['/meta-ads', 'meta-ads'],
    ['/whatsapp/templates', 'wa-templates'],
  ]) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(500);
    const r = await page.evaluate(probe);
    console.log(`--- ${vp.name} ${name}`);
    console.log(JSON.stringify(r));
  }

  // Sidebar open state
  await page.goto(`${BASE}/leads`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.locator('.shell-menu-fab').click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, `${vp.name}-sidebar-open.png`) });
  const navBox = await page.locator('.shell-sidebar').boundingBox();
  console.log(`--- ${vp.name} sidebar`, JSON.stringify(navBox));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const stillOpen = await page.locator('.shell-sidebar.is-open').count();
  console.log(`${vp.name} SIDEBAR_ESC_CLOSES=${stillOpen === 0}`);
  await page.locator('.shell-overlay').click({ force: true }).catch(() => {});
  await page.waitForTimeout(300);

  // Create campaign modal
  await page.goto(`${BASE}/campaigns`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.locator('.campaigns-page button', { hasText: /Nova campanha/i }).first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, `${vp.name}-create-modal.png`) });
  const modal = await page.locator('.ui-modal__panel, .create-campaign-modal').first().boundingBox();
  console.log(`--- ${vp.name} modal`, JSON.stringify(modal), 'viewportH=' + vp.height);
  const modalProbe = await page.evaluate(probe);
  console.log(JSON.stringify(modalProbe));

  // Forms row menu
  await page.goto(`${BASE}/forms`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const trigger = page.locator('.forms-menu__trigger').first();
  if (await trigger.count()) {
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, `${vp.name}-forms-menu.png`) });
    const dd = await page.locator('.forms-menu__dropdown').first().boundingBox();
    console.log(`--- ${vp.name} forms-dropdown`, JSON.stringify(dd), 'vw=' + vp.width);
  } else {
    console.log(`--- ${vp.name} forms-dropdown TRIGGER_NOT_REACHABLE`);
  }

  await ctx.close();
}

await browser.close();
console.log('PROBE_DONE');
