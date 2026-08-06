export const AutomationTrigger = Object.freeze({
  NEW_LEAD: 'NEW_LEAD',
});

export const AutomationChannel = Object.freeze({
  WHATSAPP: 'WHATSAPP',
  INSTAGRAM: 'INSTAGRAM',
  AUTO: 'AUTO',
});

export const AutomationRunStatus = Object.freeze({
  SCHEDULED: 'SCHEDULED',
  SENT: 'SENT',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
});

export const AutomationStepType = Object.freeze({
  SEND_WHATSAPP: 'SEND_WHATSAPP',
  SEND_INSTAGRAM: 'SEND_INSTAGRAM',
  WAIT: 'WAIT',
  CONDITION: 'CONDITION',
  ASSIGN_USER: 'ASSIGN_USER',
});

export const AutomationExecutionStatus = Object.freeze({
  RUNNING: 'RUNNING',
  WAITING: 'WAITING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
});

export function toPublicAutomation(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    campaignId: row.campaign_id ?? null,
    trigger: row.trigger_key,
    channel: row.channel,
    message: row.message,
    delayMinutes: row.delay_minutes,
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toPublicAutomationStep(row) {
  if (!row) return null;
  let config = row.config;
  if (typeof config === 'string') {
    try {
      config = JSON.parse(config);
    } catch {
      config = {};
    }
  }
  return {
    id: row.id,
    automationId: row.automation_id,
    type: row.type,
    position: row.position,
    config: config || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toPublicAutomationExecution(row) {
  if (!row) return null;
  return {
    id: row.id,
    automationId: row.automation_id,
    leadId: row.lead_id,
    currentStep: row.current_step,
    status: row.status,
    scheduledAt: row.scheduled_at,
    finishedAt: row.finished_at,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
