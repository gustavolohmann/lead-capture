import { db } from '../config/database.js';

function serializeJson(value) {
  if (value == null) return null;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export const formFieldRepository = {
  async createMany(formId, fields = []) {
    if (!fields.length) return [];

    const rows = fields.map((field, index) => ({
      form_id: formId,
      type: field.type,
      label: field.label,
      placeholder: field.placeholder ?? null,
      required: field.required ? 1 : 0,
      position: field.position ?? index,
      options: serializeJson(field.options),
      validation: serializeJson(field.validation),
    }));

    await db('form_fields').insert(rows);
    return this.findByFormId(formId);
  },

  async findByFormId(formId) {
    return db('form_fields')
      .where({ form_id: formId })
      .orderBy('position', 'asc')
      .orderBy('id', 'asc');
  },

  async findById(formId, fieldId) {
    return db('form_fields')
      .where({ form_id: formId, id: fieldId })
      .first();
  },

  async deleteByFormId(formId) {
    return db('form_fields').where({ form_id: formId }).del();
  },

  async replaceForForm(formId, fields = []) {
    await this.deleteByFormId(formId);
    return this.createMany(formId, fields);
  },
};
