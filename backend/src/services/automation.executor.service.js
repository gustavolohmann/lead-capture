import { automationRepository } from '../repositories/automation.repository.js';
import { automationStepRepository } from '../repositories/automationStep.repository.js';
import { automationExecutionRepository } from '../repositories/automationExecution.repository.js';
import { leadRepository } from '../repositories/lead.repository.js';
import { campaignRepository } from '../repositories/campaign.repository.js';
import { messageRepository } from '../repositories/message.repository.js';
import { conversationRepository } from '../repositories/conversation.repository.js';
import { messagingService } from './messaging.service.js';
import { logger } from '../utils/logger.js';
import {
  AutomationExecutionStatus,
  AutomationStepType,
  toPublicAutomationExecution,
} from '../models/automation.model.js';
import { ConversationChannel } from '../models/conversation.model.js';
import { MessageDirection } from '../models/message.model.js';

function renderTemplate(template, lead) {
  return String(template || '')
    .replaceAll('{{name}}', lead.name || '')
    .replaceAll('{{email}}', lead.email || '')
    .replaceAll('{{phone}}', lead.phone || '');
}

function normalizePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  return digits || null;
}

function parseConfig(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export const automationExecutorService = {
  /**
   * Entrada do lead: resolve campanha Meta → local → automação da campanha.
   * Sem campanha / sem automação: no-op (não quebra webhook).
   */
  async onLeadCreated({ companyId, leadId }) {
    try {
      const lead = await leadRepository.findById(companyId, leadId);
      if (!lead) return null;

      const metaCampaignId = lead.campaign_id ? String(lead.campaign_id) : null;
      if (!metaCampaignId) {
        logger.info('Lead sem campaign_id — fluxo de campanha ignorado', {
          companyId,
          leadId,
        });
        return null;
      }

      const campaign = await campaignRepository.findByMetaCampaignId(
        companyId,
        metaCampaignId
      );
      if (!campaign) {
        logger.info('Campanha local não encontrada para Meta ID', {
          companyId,
          leadId,
          metaCampaignId,
        });
        return null;
      }

      const automation = await automationRepository.findActiveByCampaign(
        companyId,
        campaign.id
      );
      if (!automation) {
        logger.info('Campanha sem automação ativa', {
          companyId,
          campaignId: campaign.id,
          leadId,
        });
        return null;
      }

      return this.startExecution({ companyId, automation, lead });
    } catch (error) {
      logger.error('Falha ao iniciar fluxo da campanha', {
        companyId,
        leadId,
        message: error.message,
      });
      return null;
    }
  },

  async startExecution({ companyId, automation, lead }) {
    const existing = await automationExecutionRepository.findByAutomationAndLead(
      companyId,
      automation.id,
      lead.id
    );
    if (existing) {
      logger.info('Execução já existe (duplicata evitida)', {
        companyId,
        automationId: automation.id,
        leadId: lead.id,
      });
      return toPublicAutomationExecution(existing);
    }

    const execution = await automationExecutionRepository.create({
      companyId,
      automationId: automation.id,
      leadId: lead.id,
      currentStep: 0,
      status: AutomationExecutionStatus.RUNNING,
      scheduledAt: null,
    });

    if (!execution) {
      const again = await automationExecutionRepository.findByAutomationAndLead(
        companyId,
        automation.id,
        lead.id
      );
      return toPublicAutomationExecution(again);
    }

    await this.processExecution(companyId, execution.id);
    const fresh = await automationExecutionRepository.findById(
      companyId,
      execution.id
    );
    return toPublicAutomationExecution(fresh);
  },

  async processDueExecutions(limit = 100) {
    const due = await automationExecutionRepository.findDueWaiting(limit);
    for (const execution of due) {
      await this.processExecution(execution.company_id, execution.id);
    }
  },

  async processExecution(companyId, executionId) {
    const execution = await automationExecutionRepository.findById(
      companyId,
      executionId
    );
    if (!execution) return null;

    if (
      execution.status === AutomationExecutionStatus.COMPLETED ||
      execution.status === AutomationExecutionStatus.FAILED ||
      execution.status === AutomationExecutionStatus.CANCELLED
    ) {
      return execution;
    }

    const steps = await automationStepRepository.findByAutomationId(
      execution.automation_id
    );
    if (!steps.length) {
      return automationExecutionRepository.update(companyId, executionId, {
        status: AutomationExecutionStatus.FAILED,
        error: 'NO_STEPS',
        finishedAt: new Date(),
      });
    }

    let stepIndex = Number(execution.current_step || 0);
    let current = execution;

    while (stepIndex < steps.length) {
      const step = steps[stepIndex];
      const config = parseConfig(step.config);

      try {
        const result = await this.executeStep({
          companyId,
          execution: current,
          step,
          config,
        });

        if (result.status === 'WAIT') {
          return automationExecutionRepository.update(companyId, executionId, {
            currentStep: stepIndex,
            status: AutomationExecutionStatus.WAITING,
            scheduledAt: result.scheduledAt,
            error: null,
          });
        }

        stepIndex += 1;
        current = await automationExecutionRepository.update(
          companyId,
          executionId,
          {
            currentStep: stepIndex,
            status: AutomationExecutionStatus.RUNNING,
            scheduledAt: null,
            error: null,
          }
        );
      } catch (error) {
        logger.error('Step de automação falhou', {
          companyId,
          executionId,
          stepType: step.type,
          message: error.message,
        });
        return automationExecutionRepository.update(companyId, executionId, {
          currentStep: stepIndex,
          status: AutomationExecutionStatus.FAILED,
          error: error.code || error.message || 'STEP_FAILED',
          finishedAt: new Date(),
        });
      }
    }

    return automationExecutionRepository.update(companyId, executionId, {
      currentStep: steps.length,
      status: AutomationExecutionStatus.COMPLETED,
      finishedAt: new Date(),
      scheduledAt: null,
      error: null,
    });
  },

  async executeStep({ companyId, execution, step, config }) {
    const lead = await leadRepository.findById(companyId, execution.lead_id);
    if (!lead) {
      const err = new Error('LEAD_NOT_FOUND');
      err.code = 'LEAD_NOT_FOUND';
      throw err;
    }

    switch (step.type) {
      case AutomationStepType.WAIT: {
        const minutes = Number(config.minutes || 0);
        const seconds = Number(config.seconds || 0);
        const ms = Math.max(0, minutes * 60_000 + seconds * 1000);
        return {
          status: 'WAIT',
          scheduledAt: new Date(Date.now() + Math.max(ms, 1000)),
        };
      }

      case AutomationStepType.SEND_WHATSAPP: {
        await this.sendMessage({
          companyId,
          lead,
          channel: ConversationChannel.WHATSAPP,
          externalUserId: normalizePhone(lead.phone),
          content: renderTemplate(config.message || '', lead),
          templateName: config.templateName || null,
          templateLanguage: config.templateLanguage || 'pt_BR',
          templateBodyParams: config.templateBodyParams || null,
        });
        return { status: 'OK' };
      }

      case AutomationStepType.SEND_INSTAGRAM: {
        await this.sendMessage({
          companyId,
          lead,
          channel: ConversationChannel.INSTAGRAM,
          externalUserId: lead.instagram_user_id,
          content: renderTemplate(config.message, lead),
        });
        return { status: 'OK' };
      }

      case AutomationStepType.CONDITION: {
        const ok = await this.evaluateCondition({
          companyId,
          lead,
          config,
        });
        if (!ok) {
          const err = new Error('CONDITION_NOT_MET');
          err.code = 'CONDITION_NOT_MET';
          throw err;
        }
        return { status: 'OK' };
      }

      case AutomationStepType.ASSIGN_USER: {
        await leadRepository.updateStatus(companyId, lead.id, 'CONTACTED');
        logger.info('ASSIGN_USER executado', {
          companyId,
          leadId: lead.id,
          userId: config.userId || null,
        });
        return { status: 'OK' };
      }

      default: {
        const err = new Error(`UNKNOWN_STEP:${step.type}`);
        err.code = 'UNKNOWN_STEP';
        throw err;
      }
    }
  },

  async sendMessage({
    companyId,
    lead,
    channel,
    externalUserId,
    content,
    templateName,
    templateLanguage,
    templateBodyParams,
  }) {
    if (!externalUserId) {
      const err = new Error(
        channel === ConversationChannel.WHATSAPP
          ? 'WHATSAPP_PHONE_MISSING'
          : 'INSTAGRAM_RECIPIENT_MISSING'
      );
      err.code = err.message;
      throw err;
    }

    const conversation = await messagingService.createOrGetConversation({
      companyId,
      leadId: lead.id,
      channel,
      externalUserId: String(externalUserId),
    });

    await messagingService.sendOutbound({
      companyId,
      conversation,
      lead,
      content,
      templateName,
      templateLanguage,
      templateBodyParams,
    });
  },

  async evaluateCondition({ companyId, lead, config }) {
    const field = String(config.field || '').toLowerCase();
    const operator = String(config.operator || 'equals').toLowerCase();
    const expected = config.value;

    if (field === 'answered') {
      const conversations = await conversationRepository.findByCompanyId(
        companyId
      );
      const mine = conversations.filter((c) => Number(c.lead_id) === Number(lead.id));
      for (const conversation of mine) {
        const messages = await messageRepository.findByConversationId(
          conversation.id,
          companyId
        );
        const hasInbound = messages.some(
          (m) => m.direction === MessageDirection.INBOUND
        );
        if (operator === 'equals' && expected === true && hasInbound) return true;
        if (operator === 'equals' && expected === false && !hasInbound) return true;
      }
      if (operator === 'equals' && expected === false) return true;
      return false;
    }

    // default: passa
    return true;
  },
};
