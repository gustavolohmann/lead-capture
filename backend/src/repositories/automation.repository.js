import { db } from '../config/database.js';
import { AutomationRunStatus } from '../models/automation.model.js';

export const automationRepository = {
  async create({
    companyId,
    campaignId = null,
    name,
    triggerKey,
    channel,
    message,
    delayMinutes,
    active = true,
  }) {
    const [id] = await db('automations').insert({
      company_id: companyId,
      campaign_id: campaignId,
      name,
      trigger_key: triggerKey,
      channel,
      message,
      delay_minutes: delayMinutes,
      active: active ? 1 : 0,
    });
    return this.findById(id, companyId);
  },

  async findById(id, companyId) {
    return db('automations').where({ id, company_id: companyId }).first();
  },

  async findByCompanyId(companyId) {
    return db('automations')
      .where({ company_id: companyId })
      .orderBy('created_at', 'desc');
  },

  async findActiveByCampaign(companyId, campaignId) {
    return db('automations')
      .where({
        company_id: companyId,
        campaign_id: campaignId,
        active: 1,
      })
      .orderBy('created_at', 'desc')
      .first();
  },

  async findActiveGlobalByTrigger(companyId, triggerKey) {
    return db('automations').where({
      company_id: companyId,
      trigger_key: triggerKey,
      active: 1,
    }).whereNull('campaign_id');
  },

  async findActiveByTrigger(companyId, triggerKey) {
    return db('automations').where({
      company_id: companyId,
      trigger_key: triggerKey,
      active: 1,
    });
  },

  async update(id, companyId, patch) {
    const data = {};
    if (patch.name != null) data.name = patch.name;
    if (patch.message != null) data.message = patch.message;
    if (patch.channel != null) data.channel = patch.channel;
    if (patch.delayMinutes != null) data.delay_minutes = patch.delayMinutes;
    if (patch.active != null) data.active = patch.active ? 1 : 0;
    if (patch.campaignId !== undefined) data.campaign_id = patch.campaignId;

    await db('automations').where({ id, company_id: companyId }).update(data);
    return this.findById(id, companyId);
  },

  async updateActive(id, companyId, active) {
    return this.update(id, companyId, { active });
  },

  async createRun({
    companyId,
    automationId,
    leadId,
    scheduledAt,
    status = AutomationRunStatus.SCHEDULED,
    error = null,
  }) {
    try {
      const [id] = await db('automation_runs').insert({
        company_id: companyId,
        automation_id: automationId,
        lead_id: leadId,
        scheduled_at: scheduledAt,
        status,
        error,
      });
      return db('automation_runs').where({ id }).first();
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') {
        return null;
      }
      throw error;
    }
  },

  async findDueRuns(limit = 100) {
    return db('automation_runs as r')
      .join('automations as a', 'a.id', 'r.automation_id')
      .select(
        'r.*',
        'a.message as automation_message',
        'a.channel as automation_channel',
        'a.name as automation_name'
      )
      .where('r.status', AutomationRunStatus.SCHEDULED)
      .andWhere('r.scheduled_at', '<=', db.fn.now())
      .orderBy('r.scheduled_at', 'asc')
      .limit(limit);
  },

  async updateRunStatus(id, companyId, { status, error = null, sentAt = null }) {
    const patch = { status, error };
    if (sentAt) patch.sent_at = sentAt;
    await db('automation_runs')
      .where({ id, company_id: companyId })
      .update(patch);
    return db('automation_runs').where({ id, company_id: companyId }).first();
  },
};
