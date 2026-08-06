import { db } from '../config/database.js';
import { AutomationExecutionStatus } from '../models/automation.model.js';

export const automationExecutionRepository = {
  async create({
    companyId,
    automationId,
    leadId,
    currentStep = 0,
    status = AutomationExecutionStatus.RUNNING,
    scheduledAt = null,
  }) {
    try {
      const [id] = await db('automation_executions').insert({
        company_id: companyId,
        automation_id: automationId,
        lead_id: leadId,
        current_step: currentStep,
        status,
        scheduled_at: scheduledAt,
      });
      return this.findById(companyId, id);
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') {
        return null;
      }
      throw error;
    }
  },

  async findById(companyId, id) {
    return db('automation_executions')
      .where({ company_id: companyId, id })
      .first();
  },

  async findByAutomationAndLead(companyId, automationId, leadId) {
    return db('automation_executions')
      .where({
        company_id: companyId,
        automation_id: automationId,
        lead_id: leadId,
      })
      .first();
  },

  async update(companyId, id, patch) {
    const data = {};
    if (patch.currentStep != null) data.current_step = patch.currentStep;
    if (patch.status != null) data.status = patch.status;
    if (patch.scheduledAt !== undefined) data.scheduled_at = patch.scheduledAt;
    if (patch.finishedAt !== undefined) data.finished_at = patch.finishedAt;
    if (patch.error !== undefined) data.error = patch.error;

    await db('automation_executions')
      .where({ company_id: companyId, id })
      .update(data);

    return this.findById(companyId, id);
  },

  async findDueWaiting(limit = 100) {
    return db('automation_executions')
      .where({ status: AutomationExecutionStatus.WAITING })
      .andWhere('scheduled_at', '<=', db.fn.now())
      .orderBy('scheduled_at', 'asc')
      .limit(limit);
  },
};
