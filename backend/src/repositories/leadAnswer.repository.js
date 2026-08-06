import { db } from '../config/database.js';

export const leadAnswerRepository = {
  async createMany(leadId, answers = []) {
    if (!answers.length) return [];

    const rows = answers.map((answer) => ({
      lead_id: leadId,
      form_field_id: answer.formFieldId,
      value:
        answer.value == null
          ? null
          : Array.isArray(answer.value)
            ? JSON.stringify(answer.value)
            : String(answer.value),
    }));

    await db('lead_answers').insert(rows);
    return this.findByLeadId(leadId);
  },

  async findByLeadId(leadId) {
    return db('lead_answers')
      .where({ lead_id: leadId })
      .orderBy('id', 'asc');
  },
};
