import { automationRepository } from '../repositories/automation.repository.js';
import { leadRepository } from '../repositories/lead.repository.js';
import { metaWhatsappRepository } from '../repositories/meta.whatsapp.repository.js';
import { metaInstagramRepository } from '../repositories/meta.instagram.repository.js';
import { messagingService } from './messaging.service.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';
import {
  AutomationChannel,
  AutomationRunStatus,
  AutomationTrigger,
  toPublicAutomation,
} from '../models/automation.model.js';
import { ConversationChannel } from '../models/conversation.model.js';

function renderTemplate(template, lead) {
  return String(template)
    .replaceAll('{{name}}', lead.name || '')
    .replaceAll('{{email}}', lead.email || '')
    .replaceAll('{{phone}}', lead.phone || '');
}

function normalizePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  return digits || null;
}

async function resolveChannel(companyId, lead, preferredChannel) {
  const waAccounts = await metaWhatsappRepository.findByCompanyId(companyId);
  const igAccounts = await metaInstagramRepository.findByCompanyId(companyId);
  const phone = normalizePhone(lead.phone);

  const canWhatsapp = Boolean(phone && waAccounts.length > 0);
  const canInstagram = Boolean(
    igAccounts.length > 0 && lead.instagram_user_id // rarely present on lead ads
  );

  if (preferredChannel === AutomationChannel.WHATSAPP) {
    if (!canWhatsapp) return null;
    return {
      channel: ConversationChannel.WHATSAPP,
      externalUserId: phone,
    };
  }

  if (preferredChannel === AutomationChannel.INSTAGRAM) {
    if (!canInstagram) return null;
    return {
      channel: ConversationChannel.INSTAGRAM,
      externalUserId: lead.instagram_user_id,
    };
  }

  // AUTO
  if (canWhatsapp) {
    return {
      channel: ConversationChannel.WHATSAPP,
      externalUserId: phone,
    };
  }

  if (canInstagram) {
    return {
      channel: ConversationChannel.INSTAGRAM,
      externalUserId: lead.instagram_user_id,
    };
  }

  return null;
}

export const automationService = {
  async list(companyId) {
    const rows = await automationRepository.findByCompanyId(companyId);
    return rows.map(toPublicAutomation);
  },

  async create(companyId, payload) {
    const row = await automationRepository.create({
      companyId,
      name: payload.name,
      triggerKey: payload.trigger || AutomationTrigger.NEW_LEAD,
      channel: payload.channel || AutomationChannel.AUTO,
      message: payload.message,
      delayMinutes: Number(payload.delayMinutes ?? 0),
      active: payload.active !== false,
    });
    return toPublicAutomation(row);
  },

  async setActive(companyId, id, active) {
    const row = await automationRepository.updateActive(id, companyId, active);
    if (!row) {
      throw new AppError('Automação não encontrada', {
        statusCode: 404,
        code: 'AUTOMATION_NOT_FOUND',
      });
    }
    return toPublicAutomation(row);
  },

  /**
   * Agenda follow-ups NEW_LEAD.
   * 1) Fluxo por campanha (steps) quando lead tem campaign_id Meta resolvível
   * 2) Legado global (automation_runs) para automações sem campaign_id
   */
  async onLeadCreated({ companyId, leadId }) {
    try {
      const { automationExecutorService } = await import(
        './automation.executor.service.js'
      );
      await automationExecutorService.onLeadCreated({ companyId, leadId });
    } catch (error) {
      logger.error('Fluxo de campanha falhou (não bloqueia legado)', {
        companyId,
        leadId,
        message: error.message,
      });
    }

    try {
      const lead = await leadRepository.findById(companyId, leadId);
      if (!lead) {
        logger.error('Automation: lead não encontrado', { companyId, leadId });
        return;
      }

      const automations = await automationRepository.findActiveGlobalByTrigger(
        companyId,
        AutomationTrigger.NEW_LEAD
      );

      for (const automation of automations) {
        const delayMs =
          Math.max(0, Number(automation.delay_minutes || 0)) * 60_000;
        const scheduledAt = new Date(Date.now() + delayMs);

        const run = await automationRepository.createRun({
          companyId,
          automationId: automation.id,
          leadId,
          scheduledAt,
          status: AutomationRunStatus.SCHEDULED,
        });

        if (!run) {
          logger.info('Automation run já existia (duplicado evitado)', {
            companyId,
            automationId: automation.id,
            leadId,
          });
        }
      }
    } catch (error) {
      logger.error('Falha ao agendar automação pós-lead', {
        companyId,
        leadId,
        message: error.message,
      });
    }
  },

  async processDueRun(run) {
    const companyId = run.company_id;
    const lead = await leadRepository.findById(companyId, run.lead_id);

    if (!lead) {
      await automationRepository.updateRunStatus(run.id, companyId, {
        status: AutomationRunStatus.SKIPPED,
        error: 'LEAD_NOT_FOUND',
      });
      return;
    }

    const resolved = await resolveChannel(
      companyId,
      lead,
      run.automation_channel
    );

    if (!resolved) {
      await automationRepository.updateRunStatus(run.id, companyId, {
        status: AutomationRunStatus.SKIPPED,
        error: 'NO_AVAILABLE_CHANNEL',
      });
      logger.info('Automation SKIPPED: sem canal', {
        companyId,
        leadId: lead.id,
        runId: run.id,
      });
      return;
    }

    try {
      const conversation = await messagingService.createOrGetConversation({
        companyId,
        leadId: lead.id,
        channel: resolved.channel,
        externalUserId: resolved.externalUserId,
      });

      const content = renderTemplate(run.automation_message, lead);

      await messagingService.sendOutbound({
        companyId,
        conversation,
        lead,
        content,
      });

      await automationRepository.updateRunStatus(run.id, companyId, {
        status: AutomationRunStatus.SENT,
        sentAt: new Date(),
      });
    } catch (error) {
      await automationRepository.updateRunStatus(run.id, companyId, {
        status: AutomationRunStatus.FAILED,
        error: error.code || error.message || 'SEND_FAILED',
      });
      logger.error('Automation FAILED', {
        companyId,
        runId: run.id,
        code: error.code || null,
        message: error.message,
      });
    }
  },
};
