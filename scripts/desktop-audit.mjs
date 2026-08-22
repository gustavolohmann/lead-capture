import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUT = 'C:/workspace/lead-capture/tests/desktop';
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

const widths = (process.env.W || '1440').split(',').map(Number);
const ROUTES = [
  ['/meta', 'meta'],
  ['/meta-ads', 'meta-ads'],
  ['/leads', 'leads'],
  ['/campaigns', 'campaigns'],
  ['/forms', 'forms'],
  ['/forms/new', 'form-builder'],
  ['/conversations', 'conversations'],
  ['/automations', 'automations'],
  ['/whatsapp/templates', 'wa-templates'],
  ['/campaigns/new/leads', 'wizard-leads'],
];

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

  const dir = path.join(OUT, String(w));
  fs.mkdirSync(dir, { recursive: true });

  for (const [route, name] of ROUTES) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: false });
    const m = await page.evaluate(() => {
      const main = document.querySelector('.shell-content');
      const first = main?.firstElementChild;
      const r = first?.getBoundingClientRect();
      return {
        contentW: main ? Math.round(main.clientWidth) : null,
        pageW: r ? Math.round(r.width) : null,
        pageRight: r ? Math.round(main.clientWidth - (r.right - r.left)) : null,
      };
    });
    console.log(`${w} ${name} ${JSON.stringify(m)}`);
  }

  // Interactive states
  await page.goto(`${BASE}/campaigns`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.locator('.campaigns-page button', { hasText: /Nova campanha/i }).first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(dir, 'state-create-modal.png') });
  await page.keyboard.press('Escape');

  await page.goto(`${BASE}/forms`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const trg = page.locator('.forms-menu__trigger').first();
  if (await trg.count()) {
    await trg.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(dir, 'state-forms-dropdown.png') });
  }

  // Sidebar tooltip on hover
  await page.goto(`${BASE}/leads`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.locator('.shell-nav__item').nth(3).hover();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(dir, 'state-nav-tooltip.png') });

  // Leads: long-content lead + filter with no results
  await page.locator('.leads-tabs__btn').nth(1).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(dir, 'state-leads-filter.png') });

  // Campaigns 1:N: expanded hierarchy and multi-ad editor state.
  await page.goto(`${BASE}/campaigns`, { waitUntil: 'networkidle' });
  await page.locator('.campaigns-name-button').first().click();
  await page.waitForTimeout(900);
  const expandedCampaigns = await page.locator('.campaign-details').count();
  await page.screenshot({ path: path.join(dir, 'state-campaign-expanded.png') });

  await page.evaluate(() => {
    localStorage.setItem(
      'lc_campaign_draft_leads',
      JSON.stringify({
        version: 3,
        objective: 'leads',
        updatedAt: new Date().toISOString(),
        step: 1,
        state: {
          campaign: { name: 'Campanha QA 1:N', dailyBudget: 50 },
          form: { mode: 'new', title: 'Formulário QA', questions: [] },
          audience: { country: 'BR', locations: [], ageMin: 25, ageMax: 55, gender: 'all' },
          ads: [
            {
              clientKey: 'audit-ad-1',
              name: 'Anúncio principal',
              primaryText: 'Texto principal do anúncio',
              title: 'Título do anúncio',
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
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(dir, 'state-wizard-multiple-ads.png') });

  const leadAdTabs = await page.locator('[role="tablist"] [role="tab"]').count();

  await page.goto(`${BASE}/campaigns/new/traffic`, { waitUntil: 'networkidle' });
  await page.getByLabel(/^Nome\s*\*/i).fill('Campanha Tráfego QA 1:N');
  await page.getByLabel(/URL do site/i).fill('https://example.com/oferta');
  await page.getByRole('button', { name: /Continuar configuração/i }).click();
  await page.getByRole('button', { name: /Adicionar anúncio/i }).click();
  await page.getByRole('button', { name: /Duplicar Anúncio 1/i }).click();
  await page.waitForTimeout(300);
  const trafficAdTabs = await page.locator('[role="tablist"] [role="tab"]').count();
  await page.screenshot({ path: path.join(dir, 'state-traffic-multiple-ads.png') });

  await page.goto(`${BASE}/campaigns/new/messages`, { waitUntil: 'networkidle' });
  await page.getByLabel(/^Nome\s*\*/i).fill('Campanha Mensagens QA 1:N');
  await page.getByRole('button', { name: /Continuar configuração/i }).click();
  const messagesOnCreativeStep = await page
    .getByRole('button', { name: /Adicionar anúncio/i })
    .count();
  let messageAdTabs = 0;
  if (messagesOnCreativeStep) {
    await page.getByRole('button', { name: /Adicionar anúncio/i }).click();
    await page.getByRole('button', { name: /Duplicar Anúncio 1/i }).click();
    await page.waitForTimeout(300);
    messageAdTabs = await page.locator('[role="tablist"] [role="tab"]').count();
  }
  await page.screenshot({ path: path.join(dir, 'state-messages-multiple-ads.png') });

  console.log(
    `${w} campaign-1n ${JSON.stringify({
      expanded: expandedCampaigns,
      leadAdTabs,
      trafficAdTabs,
      messageAdTabs,
    })}`
  );

  await ctx.close();
}
await browser.close();
console.log('DESKTOP_DONE');
