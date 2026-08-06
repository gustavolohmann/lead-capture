import { companyService } from './company.service.js';
import { campaignRepository } from '../repositories/campaign.repository.js';
import { automationRepository } from '../repositories/automation.repository.js';
import { automationStepRepository } from '../repositories/automationStep.repository.js';
import { leadRepository } from '../repositories/lead.repository.js';
import { AppError } from '../utils/errors.js';
import {
  AutomationChannel,
  AutomationStepType,
  AutomationTrigger,
  toPublicAutomation,
  toPublicAutomationStep,
} from '../models/automation.model.js';
import { automationExecutorService } from './automation.executor.service.js';

const ALLOWED_STEPS = new Set(Object.values(AutomationStepType));

async function assertCompany(companyId) {
  const company = await companyService.getById(companyId);
  if (!company) {
    throw new AppError('Empresa não encontrada', {
      statusCode: 404,
      code: 'COMPANY_NOT_FOUND',
    });
  }
  return company;
}

async function assertCampaign(companyId, campaignId) {
  const campaign = await campaignRepository.findById(companyId, campaignId);
  if (!campaign) {
    throw new AppError('Campanha não encontrada', {
      statusCode: 404,
      code: 'CAMPAIGN_NOT_FOUND',
    });
  }
  return campaign;
}

function normalizeSteps(steps = []) {
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new AppError('Informe ao menos uma etapa no fluxo', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  return steps.map((step, index) => {
    const type = String(step.type || '').toUpperCase();
    if (!ALLOWED_STEPS.has(type)) {
      throw new AppError(`Tipo de etapa inválido: ${step.type}`, {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }

    const config = step.config || {};
    if (
      (type === AutomationStepType.SEND_WHATSAPP ||
        type === AutomationStepType.SEND_INSTAGRAM) &&
      !String(config.message || '').trim()
    ) {
      throw new AppError('Etapa de mensagem precisa de config.message', {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }
    if (
      type === AutomationStepType.WAIT &&
      !(Number(config.minutes) > 0 || Number(config.seconds) > 0)
    ) {
      throw new AppError('Etapa WAIT precisa de minutes > 0', {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }

    return {
      type,
      position: index,
      config,
    };
  });
}

async function withSteps(automation) {
  if (!automation) return null;
  const steps = await automationStepRepository.findByAutomationId(automation.id);
  return {
    ...toPublicAutomation(automation),
    steps: steps.map(toPublicAutomationStep),
  };
}

export const automationFlowService = {
  async listByCampaign(companyId, campaignId) {
    await assertCompany(companyId);
    await assertCampaign(companyId, Number(campaignId));

    const rows = await automationRepository.findByCompanyId(companyId);
    const filtered = rows.filter(
      (row) => Number(row.campaign_id) === Number(campaignId)
    );

    const result = [];
    for (const row of filtered) {
      result.push(await withSteps(row));
    }
    return result;
  },

  async createForCampaign(companyId, campaignId, input) {
    await assertCompany(companyId);
    const campaign = await assertCampaign(companyId, Number(campaignId));
    const steps = normalizeSteps(input.steps);

    const existing = await automationRepository.findActiveByCampaign(
      companyId,
      campaign.id
    );
    if (existing) {
      throw new AppError('Esta campanha já possui uma automação ativa', {
        statusCode: 409,
        code: 'AUTOMATION_EXISTS',
      });
    }

    const firstMessage =
      steps.find(
        (s) =>
          s.type === AutomationStepType.SEND_WHATSAPP ||
          s.type === AutomationStepType.SEND_INSTAGRAM
      )?.config?.message || 'Follow-up';

    const automation = await automationRepository.create({
      companyId,
      campaignId: campaign.id,
      name: String(input.name || `Automação ${campaign.name}`).trim(),
      triggerKey: AutomationTrigger.NEW_LEAD,
      channel: AutomationChannel.AUTO,
      message: firstMessage,
      delayMinutes: 0,
      active: input.active !== false,
    });

    await automationStepRepository.replaceAll(automation.id, steps);
    return withSteps(automation);
  },

  async updateAutomation(companyId, automationId, input) {
    await assertCompany(companyId);
    const automation = await automationRepository.findById(
      automationId,
      companyId
    );
    if (!automation) {
      throw new AppError('Automação não encontrada', {
        statusCode: 404,
        code: 'AUTOMATION_NOT_FOUND',
      });
    }

    if (automation.campaign_id) {
      await assertCampaign(companyId, automation.campaign_id);
    }

    const patch = {};
    if (input.name != null) patch.name = String(input.name).trim();
    if (input.active != null) patch.active = Boolean(input.active);

    let updated = automation;
    if (Object.keys(patch).length) {
      updated = await automationRepository.update(
        automationId,
        companyId,
        patch
      );
    }

    if (input.steps) {
      const steps = normalizeSteps(input.steps);
      await automationStepRepository.replaceAll(automationId, steps);
      const firstMessage = steps.find(
        (s) =>
          s.type === AutomationStepType.SEND_WHATSAPP ||
          s.type === AutomationStepType.SEND_INSTAGRAM
      )?.config?.message;
      if (firstMessage) {
        updated = await automationRepository.update(automationId, companyId, {
          message: firstMessage,
        });
      }
    }

    return withSteps(updated);
  },

  async getById(companyId, automationId) {
    await assertCompany(companyId);
    const automation = await automationRepository.findById(
      automationId,
      companyId
    );
    if (!automation) {
      throw new AppError('Automação não encontrada', {
        statusCode: 404,
        code: 'AUTOMATION_NOT_FOUND',
      });
    }
    return withSteps(automation);
  },

  async testAutomation(companyId, automationId) {
    await assertCompany(companyId);
    const automation = await automationRepository.findById(
      automationId,
      companyId
    );
    if (!automation) {
      throw new AppError('Automação não encontrada', {
        statusCode: 404,
        code: 'AUTOMATION_NOT_FOUND',
      });
    }

    const lead = await leadRepository.create({
      companyId,
      pageId: null,
      formId: null,
      metaLeadId: `test_auto_${automationId}_${Date.now()}`,
      name: 'Lead Teste Automação',
      email: 'teste.automacao@example.com',
      phone: '+5541999990000',
      source: 'FORM',
      campaignId: null,
      campaignName: automation.campaign_id
        ? `Campanha local #${automation.campaign_id}`
        : null,
      rawData: { _test: true, automationId },
    });

    const execution = await automationExecutorService.startExecution({
      companyId,
      automation,
      lead,
    });

    return {
      lead: { id: lead.id, name: lead.name },
      execution,
    };
  },
};
