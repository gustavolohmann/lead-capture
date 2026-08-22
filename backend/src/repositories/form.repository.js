import { db } from '../config/database.js';
import { FormStatus } from '../models/form.model.js';

export const formRepository = {
  async create({
    companyId,
    name,
    description,
    submitLabel,
    status = FormStatus.ACTIVE,
  }) {
    const [id] = await db('forms').insert({
      company_id: companyId,
      name,
      description: description ?? null,
      submit_label: submitLabel ?? null,
      status,
    });
    return this.findById(companyId, id);
  },

  async findById(companyId, id) {
    return db('forms').where({ company_id: companyId, id }).first();
  },

  async findByIdAnyCompany(id) {
    return db('forms').where({ id }).first();
  },

  async findByCompanyId(companyId) {
    return db('forms')
      .where({ company_id: companyId })
      .orderBy('created_at', 'desc');
  },

  async update(companyId, id, data) {
    const patch = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.description !== undefined) patch.description = data.description;
    if (data.submitLabel !== undefined) patch.submit_label = data.submitLabel;
    if (data.status !== undefined) patch.status = data.status;

    if (Object.keys(patch).length === 0) {
      return this.findById(companyId, id);
    }

    await db('forms').where({ company_id: companyId, id }).update(patch);
    return this.findById(companyId, id);
  },

  async delete(companyId, id) {
    return db('forms').where({ company_id: companyId, id }).del();
  },
};
