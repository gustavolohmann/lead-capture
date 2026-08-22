import { describe, test, expect, beforeEach, afterAll } from 'vitest';
import crypto from 'node:crypto';
import {
  resetTestData,
  seedMasterUser,
  seedSecondCompanyUser,
  seedMetaFixtures,
  TEST_MASTER,
  TEST_USER_B,
  db,
} from './helpers/fixtures.js';
import { api, auth, loginAs } from './helpers/http.js';
import { automationService } from '../../../backend/src/services/automation.service.js';
import { automationRepository } from '../../../backend/src/repositories/automation.repository.js';
import { env } from '../../../backend/src/config/env.js';

function signWebhook(rawBody) {
  const digest = crypto
    .createHmac('sha256', env.META_APP_SECRET)
    .update(rawBody)
    .digest('hex');
  return `sha256=${digest}`;
}

describe('E2E Lead Capture SaaS', () => {
  beforeEach(async () => {
    await resetTestData();
  });

  afterAll(async () => {
    await db.destroy();
  });

  test('Cenário 1 — Login completo', async () => {
    await seedMasterUser({ withCompany: true });

    const res = await loginAs(TEST_MASTER.email, TEST_MASTER.password);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.role).toBe('MASTER');
    expect(res.body.user.companyId).toEqual(expect.any(Number));
  });

  test('Cenário 2 — Criação automática da Company', async () => {
    await seedMasterUser({ withCompany: false });

    const res = await loginAs(TEST_MASTER.email, TEST_MASTER.password);

    expect(res.status).toBe(200);
    expect(res.body.user.companyId).toEqual(expect.any(Number));
    expect(res.body.user.companyName).toMatch(/Empresa/);
  });

  test('Cenário 3 — Criar formulário dinâmico', async () => {
    const { companyId } = await seedMasterUser({ withCompany: true });
    const login = await loginAs(TEST_MASTER.email, TEST_MASTER.password);

    const payload = {
      name: 'Formulário Imobiliário',
      description: 'Captura compradores',
      fields: [
        { type: 'TEXT', label: 'Nome completo', required: true },
        { type: 'PHONE', label: 'WhatsApp', required: true },
        {
          type: 'SELECT',
          label: 'Tipo de imóvel',
          options: [
            { value: 'apartamento', label: 'Apartamento' },
            { value: 'casa', label: 'Casa' },
          ],
        },
      ],
    };

    const res = await api()
      .post('/forms')
      .set(auth(login.body.token))
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.form.name).toBe('Formulário Imobiliário');
    expect(res.body.form.fields).toHaveLength(3);

    const listed = await api()
      .get('/forms')
      .set(auth(login.body.token));
    expect(listed.body.forms.some((f) => f.id === res.body.form.id)).toBe(true);
    expect(companyId).toBeTruthy();
  });

  test('Cenário 4 — Publicação do formulário', async () => {
    await seedMasterUser({ withCompany: true });
    const login = await loginAs(TEST_MASTER.email, TEST_MASTER.password);

    const created = await api()
      .post('/forms')
      .set(auth(login.body.token))
      .send({
        name: 'Formulário Imobiliário',
        fields: [
          { type: 'TEXT', label: 'Nome completo', required: true },
          { type: 'PHONE', label: 'WhatsApp', required: true },
          {
            type: 'SELECT',
            label: 'Tipo de imóvel',
            options: [
              { value: 'apartamento', label: 'Apartamento' },
              { value: 'casa', label: 'Casa' },
            ],
          },
        ],
      });

    const pub = await api().get(`/forms/${created.body.form.id}/public`);

    expect(pub.status).toBe(200);
    expect(pub.body.form.fields.map((f) => f.label)).toEqual([
      'Nome completo',
      'WhatsApp',
      'Tipo de imóvel',
    ]);
  });

  test('Cenário 5 — Envio de lead pelo formulário', async () => {
    await seedMasterUser({ withCompany: true });
    const login = await loginAs(TEST_MASTER.email, TEST_MASTER.password);

    const created = await api()
      .post('/forms')
      .set(auth(login.body.token))
      .send({
        name: 'Formulário Imobiliário',
        fields: [
          { type: 'TEXT', label: 'Nome completo', required: true },
          { type: 'PHONE', label: 'WhatsApp', required: true },
          {
            type: 'SELECT',
            label: 'Tipo de imóvel',
            options: [
              { value: 'apartamento', label: 'Apartamento' },
              { value: 'casa', label: 'Casa' },
            ],
          },
        ],
      });

    const fields = created.body.form.fields;
    const submit = await api()
      .post(`/forms/${created.body.form.id}/submit`)
      .send({
        answers: [
          { field_id: fields[0].id, value: 'João Silva' },
          { field_id: fields[1].id, value: '41999999999' },
          { field_id: fields[2].id, value: 'apartamento' },
        ],
      });

    expect(submit.status).toBe(201);
    expect(submit.body.lead.name).toBe('João Silva');
    expect(submit.body.answers.length).toBeGreaterThanOrEqual(3);

    const leads = await api().get('/leads').set(auth(login.body.token));
    expect(leads.body.leads.some((l) => l.name === 'João Silva')).toBe(true);
  });

  test('Cenário 6+7 — Automação NEW_LEAD + runner', async () => {
    const { companyId } = await seedMasterUser({ withCompany: true });
    await seedMetaFixtures(companyId);
    const login = await loginAs(TEST_MASTER.email, TEST_MASTER.password);

    const auto = await api()
      .post('/automations')
      .set(auth(login.body.token))
      .send({
        name: 'Primeiro contato',
        trigger: 'NEW_LEAD',
        channel: 'WHATSAPP',
        message: 'Olá {{name}}',
        delayMinutes: 0,
        active: true,
      });

    expect(auto.status).toBe(201);

    const form = await api()
      .post('/forms')
      .set(auth(login.body.token))
      .send({
        name: 'Lead Auto',
        fields: [
          { type: 'TEXT', label: 'Nome completo', required: true },
          { type: 'PHONE', label: 'WhatsApp', required: true },
        ],
      });

    const fields = form.body.form.fields;
    const submit = await api()
      .post(`/forms/${form.body.form.id}/submit`)
      .send({
        answers: [
          { field_id: fields[0].id, value: 'Maria Auto' },
          { field_id: fields[1].id, value: '41988887777' },
        ],
      });

    expect(submit.status).toBe(201);

    // Aguarda evento assíncrono agendar o run
    let due = [];
    for (let i = 0; i < 40; i += 1) {
      due = await automationRepository.findDueRuns(20);
      if (due.length >= 1) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(due.length).toBeGreaterThanOrEqual(1);
    expect(due[0].status).toBe('SCHEDULED');

    for (const run of due) {
      await automationService.processDueRun(run);
    }

    const conv = await api()
      .get('/conversations')
      .set(auth(login.body.token));

    expect(conv.status).toBe(200);
    expect(conv.body.conversations?.length || 0).toBeGreaterThanOrEqual(1);

    const conversationId = conv.body.conversations[0].id;
    const messages = await api()
      .get(`/conversations/${conversationId}/messages`)
      .set(auth(login.body.token));

    expect(messages.status).toBe(200);
    expect(messages.body.messages?.length || 0).toBeGreaterThanOrEqual(1);
  });

  test('Cenário 8 — Isolamento multi-tenant', async () => {
    const a = await seedMasterUser({ withCompany: true });
    await seedSecondCompanyUser();

    const loginA = await loginAs(TEST_MASTER.email, TEST_MASTER.password);
    const loginB = await loginAs(TEST_USER_B.email, TEST_USER_B.password);

    const form = await api()
      .post('/forms')
      .set(auth(loginA.body.token))
      .send({
        name: 'Form A',
        fields: [
          { type: 'TEXT', label: 'Nome completo', required: true },
          { type: 'PHONE', label: 'WhatsApp', required: true },
        ],
      });

    const fields = form.body.form.fields;
    await api()
      .post(`/forms/${form.body.form.id}/submit`)
      .send({
        answers: [
          { field_id: fields[0].id, value: 'Lead Empresa A' },
          { field_id: fields[1].id, value: '41911112222' },
        ],
      });

    const leadsB = await api().get('/leads').set(auth(loginB.body.token));
    expect(leadsB.status).toBe(200);
    expect(
      leadsB.body.leads.some((l) => l.name === 'Lead Empresa A')
    ).toBe(false);

    const leadsA = await api().get('/leads').set(auth(loginA.body.token));
    expect(leadsA.body.leads.some((l) => l.name === 'Lead Empresa A')).toBe(
      true
    );
    expect(a.companyId).not.toBe(loginB.body.user.companyId);
  });

  test('Cenário 9 — Campanhas (META_MOCK_MODE)', async () => {
    const { companyId } = await seedMasterUser({ withCompany: true });
    await seedMetaFixtures(companyId);
    const login = await loginAs(TEST_MASTER.email, TEST_MASTER.password);

    const list = await api().get('/campaigns').set(auth(login.body.token));
    expect(list.status).toBe(200);

    const created = await api()
      .post('/campaigns')
      .set(auth(login.body.token))
      .send({
        name: 'Campanha Imóveis',
        adAccountId: 'act_123456',
        dailyBudget: 50,
      });

    expect(created.status).toBe(201);
    expect(created.body.campaign.name).toBe('Campanha Imóveis');
    expect(created.body.campaign.campaignId).toMatch(/^mock_campaign_/);
  });

  test('Cenário 10 — Meta OAuth Mock', async () => {
    await seedMasterUser({ withCompany: true });
    const login = await loginAs(TEST_MASTER.email, TEST_MASTER.password);

    const connect = await api()
      .get('/meta/connect')
      .set(auth(login.body.token));

    expect(connect.status).toBe(200);
    expect(connect.body.url).toContain('meta.mock.local');

    const state = new URL(connect.body.url).searchParams.get('state');
    const callback = await api()
      .get('/meta/callback')
      .query({ code: 'mock_code', state });

    expect(callback.status).toBe(302);
    expect(callback.headers.location).toContain('/meta?connected=1');

    const status = await api()
      .get('/meta/status')
      .set(auth(login.body.token));
    expect(status.body.connected).toBe(true);
  });

  test('Cenário 11 — Webhook Lead Ads + anti-duplicata', async () => {
    const { companyId } = await seedMasterUser({ withCompany: true });
    await seedMetaFixtures(companyId);
    const login = await loginAs(TEST_MASTER.email, TEST_MASTER.password);

    const payload = {
      entry: [
        {
          id: 'entry1',
          changes: [
            {
              field: 'leadgen',
              value: {
                leadgen_id: '12345',
                page_id: '999',
                form_id: 'form_1',
              },
            },
          ],
        },
      ],
    };
    const raw = JSON.stringify(payload);

    const first = await api()
      .post('/webhooks/meta/leads')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', signWebhook(raw))
      .send(raw);

    expect(first.status).toBe(200);
    expect(first.body.processed).toBeGreaterThanOrEqual(1);

    const leads = await api().get('/leads').set(auth(login.body.token));
    expect(leads.body.leads.some((l) => l.metaLeadId === '12345')).toBe(true);

    const second = await api()
      .post('/webhooks/meta/leads')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', signWebhook(raw))
      .send(raw);

    expect(second.status).toBe(200);
    const leadsAfter = await api().get('/leads').set(auth(login.body.token));
    const same = leadsAfter.body.leads.filter((l) => l.metaLeadId === '12345');
    expect(same).toHaveLength(1);
  });

  describe('Negativos', () => {
    test('Adicionar anúncio exige autenticação e isola Campaign/Ad Set por tenant', async () => {
      const { companyId } = await seedMasterUser({ withCompany: true });
      await seedSecondCompanyUser();
      const loginA = await loginAs(TEST_MASTER.email, TEST_MASTER.password);
      const loginB = await loginAs(TEST_USER_B.email, TEST_USER_B.password);

      const [campaignA] = await db('campaigns').insert({
        company_id: companyId,
        ad_account_id: 'act_123456',
        campaign_id: 'meta_campaign_add_ad_a',
        name: 'Campanha A',
        objective: 'TRAFFIC',
        status: 'PAUSED',
      });
      const [campaignOther] = await db('campaigns').insert({
        company_id: companyId,
        ad_account_id: 'act_123456',
        campaign_id: 'meta_campaign_add_ad_other',
        name: 'Campanha Outra',
        objective: 'TRAFFIC',
        status: 'PAUSED',
      });
      const [foreignAdSet] = await db('ad_sets').insert({
        company_id: companyId,
        campaign_id: campaignOther,
        meta_adset_id: 'meta_adset_other_campaign',
        name: 'Ad Set de outra campanha',
        status: 'PAUSED',
      });

      const payload = {
        adSetId: foreignAdSet,
        pageId: '999',
        name: 'Novo anúncio',
        creative: {
          title: 'Título',
          text: 'Texto principal',
          imageBase64: `data:image/jpeg;base64,${'a'.repeat(48)}`,
          linkUrl: 'https://example.com',
        },
      };

      const unauthenticated = await api()
        .post(`/campaigns/${campaignA}/ads`)
        .send(payload);
      expect(unauthenticated.status).toBe(401);

      const crossedAdSet = await api()
        .post(`/campaigns/${campaignA}/ads`)
        .set(auth(loginA.body.token))
        .set('Idempotency-Key', 'e2e-crossed-adset')
        .send(payload);
      expect(crossedAdSet.status).toBe(404);
      expect(crossedAdSet.body.code).toBe('AD_SET_NOT_FOUND');

      const otherTenant = await api()
        .post(`/campaigns/${campaignA}/ads`)
        .set(auth(loginB.body.token))
        .set('Idempotency-Key', 'e2e-other-tenant')
        .send(payload);
      expect(otherTenant.status).toBe(404);
      expect(otherTenant.body.code).toBe('CAMPAIGN_NOT_FOUND');

      const missingCampaign = await api()
        .post('/campaigns/999999/ads')
        .set(auth(loginA.body.token))
        .set('Idempotency-Key', 'e2e-missing-campaign')
        .send(payload);
      expect(missingCampaign.status).toBe(404);
      expect(missingCampaign.body.code).toBe('CAMPAIGN_NOT_FOUND');
    });

    test('Login errado → 401', async () => {
      await seedMasterUser({ withCompany: true });
      const res = await loginAs(TEST_MASTER.email, 'senha_errada_x');
      expect(res.status).toBe(401);
    });

    test('Token inválido → 401', async () => {
      const res = await api()
        .get('/leads')
        .set(auth('token.invalido.aqui'));
      expect(res.status).toBe(401);
    });

    test('Campo obrigatório vazio → 400', async () => {
      await seedMasterUser({ withCompany: true });
      const login = await loginAs(TEST_MASTER.email, TEST_MASTER.password);
      const form = await api()
        .post('/forms')
        .set(auth(login.body.token))
        .send({
          name: 'Form Required',
          fields: [{ type: 'TEXT', label: 'Nome completo', required: true }],
        });

      const submit = await api()
        .post(`/forms/${form.body.form.id}/submit`)
        .send({ answers: [] });

      expect(submit.status).toBe(400);
    });
  });
});
