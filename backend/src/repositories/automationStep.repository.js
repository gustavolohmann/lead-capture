import { db } from '../config/database.js';

export const automationStepRepository = {
  async replaceAll(automationId, steps = []) {
    await db('automation_steps').where({ automation_id: automationId }).del();
    if (!steps.length) return [];

    const rows = steps.map((step, index) => ({
      automation_id: automationId,
      type: step.type,
      position: step.position ?? index,
      config: JSON.stringify(step.config || {}),
    }));

    await db('automation_steps').insert(rows);
    return this.findByAutomationId(automationId);
  },

  async findByAutomationId(automationId) {
    return db('automation_steps')
      .where({ automation_id: automationId })
      .orderBy('position', 'asc')
      .orderBy('id', 'asc');
  },

  async findByAutomationAndPosition(automationId, position) {
    return db('automation_steps')
      .where({ automation_id: automationId, position })
      .first();
  },
};
