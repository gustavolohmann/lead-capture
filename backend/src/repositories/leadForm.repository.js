import { db } from '../config/database.js';

function serializeJson(value) {
  if (value == null) return null;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export const leadFormRepository = {
  async create({ companyId, pageId, formId, name, status = 'ACTIVE', questions }) {
    const [id] = await db('lead_forms').insert({
      company_id: companyId,
      page_id: pageId,
      form_id: formId ?? null,
      name,
      status,
      questions: serializeJson(questions),
    });

    return this.findById(companyId, id);
  },

  async findById(companyId, id) {
    return db('lead_forms').where({ company_id: companyId, id }).first();
  },

  async findByCompanyId(companyId) {
    return db('lead_forms')
      .where({ company_id: companyId })
      .orderBy('created_at', 'desc');
  },

  async findByMetaFormId(companyId, formId) {
    return db('lead_forms')
      .where({ company_id: companyId, form_id: formId })
      .first();
  },
};
