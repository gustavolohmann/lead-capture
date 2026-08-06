import { describe, test, expect, beforeEach, afterAll } from 'vitest';
import {
  resetTestData,
  seedMasterUser,
  seedMetaFixtures,
  TEST_MASTER,
  db,
} from './helpers/fixtures.js';
import { api, auth, loginAs } from './helpers/http.js';
import { automationExecutorService } from '../../../backend/src/services/automation.executor.service.js';
import { automationExecutionRepository } from '../../../backend/src/repositories/automationExecution.repository.js';
import { leadRepository } from '../../../backend/src/repositories/lead.repository.js';
import { campaignRepository } from '../../../backend/src/repositories/campaign.repository.js';
import { encrypt } from '../../../backend/src/utils/encryption.js';

async function createLocalCampaign(companyId, metaCampaignId, name) {
  return campaignRepository.create({
    companyId,
    adAccountId: 'act_123456',
    campaignId: metaCampaignId,
    name,
    dailyBudget: 50,
  });
}

describe('E2E Automação por campanha', () => {
  beforeEach(async () => {
    await resetTestData();
  });

  afterAll(async () => {
    await db.destroy();
  });

  test('Cenário 1 — Campanha A executa fluxo A', async () => {
    const { companyId } = await seedMasterUser({ withCompany: true });
    await seedMetaFixtures(companyId);
    const login = await loginAs(TEST_MASTER.email, TEST_MASTER.password);

    const campaign = await createLocalCampaign(
      companyId,
      'meta_camp_A',
      'Apartamento Curitiba'
    );

    const created = await api()
      .post(`/campaigns/${campaign.id}/automations`)
      .set(auth(login.body.token))
      .send({
        name: 'Qualificação comprador',
        steps: [
          {
            type: 'SEND_WHATSAPP',
            config: { message: 'Olá {{name}} da campanha A' },
          },
        ],
      });

    expect(created.status).toBe(201);

    const lead = await leadRepository.create({
      companyId,
      metaLeadId: `lead_a_${Date.now()}`,
      name: 'Lead A',
      phone: '+5541999111111',
      campaignId: 'meta_camp_A',
      campaignName: 'Apartamento Curitiba',
      source: 'META_LEAD_ADS',
    });

    const execution = await automationExecutorService.onLeadCreated({
      companyId,
      leadId: lead.id,
    });

    expect(execution).toBeTruthy();
    expect(execution.automationId).toBe(created.body.automation.id);
    expect(['RUNNING', 'WAITING', 'COMPLETED', 'FAILED']).toContain(
      execution.status
    );
  });

  test('Cenário 2 — Lead da campanha A não roda automação B', async () => {
    const { companyId } = await seedMasterUser({ withCompany: true });
    await seedMetaFixtures(companyId);
    const login = await loginAs(TEST_MASTER.email, TEST_MASTER.password);

    const campA = await createLocalCampaign(companyId, 'meta_camp_A', 'Camp A');
    const campB = await createLocalCampaign(companyId, 'meta_camp_B', 'Camp B');

    await api()
      .post(`/campaigns/${campA.id}/automations`)
      .set(auth(login.body.token))
      .send({
        name: 'Auto A',
        steps: [{ type: 'SEND_WHATSAPP', config: { message: 'A' } }],
      });

    const autoB = await api()
      .post(`/campaigns/${campB.id}/automations`)
      .set(auth(login.body.token))
      .send({
        name: 'Auto B',
        steps: [{ type: 'SEND_WHATSAPP', config: { message: 'B' } }],
      });

    const lead = await leadRepository.create({
      companyId,
      metaLeadId: `lead_iso_${Date.now()}`,
      name: 'Lead A',
      phone: '+5541999222222',
      campaignId: 'meta_camp_A',
      source: 'META_LEAD_ADS',
    });

    const execution = await automationExecutorService.onLeadCreated({
      companyId,
      leadId: lead.id,
    });

    expect(execution.automationId).not.toBe(autoB.body.automation.id);
  });

  test('Cenário 3 — Lead sem campanha não quebra', async () => {
    const { companyId } = await seedMasterUser({ withCompany: true });
    const lead = await leadRepository.create({
      companyId,
      metaLeadId: `lead_nocamp_${Date.now()}`,
      name: 'Lead Form',
      phone: '+5541999333333',
      source: 'FORM',
    });

    const execution = await automationExecutorService.onLeadCreated({
      companyId,
      leadId: lead.id,
    });

    expect(execution).toBeNull();
  });

  test('Cenário 4 — Step WhatsApp falha → FAILED', async () => {
    const { companyId } = await seedMasterUser({ withCompany: true });
    // sem seedMetaFixtures → sem WA account
    await db('meta_connections').insert({
      company_id: companyId,
      business_id: 'x',
      access_token_encrypted: encrypt('token'),
      token_type: 'bearer',
    });
    await db('meta_ad_accounts').insert({
      company_id: companyId,
      account_id: 'act_123456',
      name: 'Acc',
    });

    const login = await loginAs(TEST_MASTER.email, TEST_MASTER.password);
    const campaign = await createLocalCampaign(
      companyId,
      'meta_fail',
      'Camp Fail'
    );

    const created = await api()
      .post(`/campaigns/${campaign.id}/automations`)
      .set(auth(login.body.token))
      .send({
        name: 'Auto Fail',
        steps: [{ type: 'SEND_WHATSAPP', config: { message: 'Oi' } }],
      });

    const lead = await leadRepository.create({
      companyId,
      metaLeadId: `lead_fail_${Date.now()}`,
      name: 'Lead Fail',
      phone: '+5541999444444',
      campaignId: 'meta_fail',
      source: 'META_LEAD_ADS',
    });

    const execution = await automationExecutorService.onLeadCreated({
      companyId,
      leadId: lead.id,
    });

    expect(execution.status).toBe('FAILED');
    expect(created.body.automation.id).toBe(execution.automationId);
  });

  test('Cenário 5 — Duplicação não cria duas execuções', async () => {
    const { companyId } = await seedMasterUser({ withCompany: true });
    await seedMetaFixtures(companyId);
    const login = await loginAs(TEST_MASTER.email, TEST_MASTER.password);
    const campaign = await createLocalCampaign(
      companyId,
      'meta_dup',
      'Camp Dup'
    );

    await api()
      .post(`/campaigns/${campaign.id}/automations`)
      .set(auth(login.body.token))
      .send({
        name: 'Auto Dup',
        steps: [{ type: 'WAIT', config: { minutes: 1 } }],
      });

    const lead = await leadRepository.create({
      companyId,
      metaLeadId: `lead_dup_${Date.now()}`,
      name: 'Lead Dup',
      phone: '+5541999555555',
      campaignId: 'meta_dup',
      source: 'META_LEAD_ADS',
    });

    const first = await automationExecutorService.onLeadCreated({
      companyId,
      leadId: lead.id,
    });
    const second = await automationExecutorService.onLeadCreated({
      companyId,
      leadId: lead.id,
    });

    expect(first.id).toBe(second.id);

    const rows = await db('automation_executions').where({
      company_id: companyId,
      lead_id: lead.id,
    });
    expect(rows).toHaveLength(1);
    expect(automationExecutionRepository).toBeTruthy();
  });
});
