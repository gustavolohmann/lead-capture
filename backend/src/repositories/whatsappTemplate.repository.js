import { db } from '../config/database.js';

function serializeJson(value) {
  if (value == null) return null;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export const whatsappTemplateRepository = {
  async upsertByIdentity(data) {
    await db.raw(
      `INSERT INTO whatsapp_templates (
         company_id, waba_id, meta_template_id, name, language, category,
         status, rejected_reason, rejection_info, quality_score,
         components, parameter_format
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         meta_template_id = COALESCE(VALUES(meta_template_id), meta_template_id),
         category = VALUES(category),
         status = VALUES(status),
         rejected_reason = VALUES(rejected_reason),
         rejection_info = VALUES(rejection_info),
         quality_score = VALUES(quality_score),
         components = VALUES(components),
         parameter_format = VALUES(parameter_format)`,
      [
        data.companyId,
        data.wabaId,
        data.metaTemplateId ?? null,
        data.name,
        data.language,
        data.category,
        data.status,
        data.rejectedReason ?? null,
        serializeJson(data.rejectionInfo),
        data.qualityScore ?? null,
        serializeJson(data.components || []),
        data.parameterFormat || 'POSITIONAL',
      ]
    );

    return this.findByNameLanguage(data.companyId, data.wabaId, data.name, data.language);
  },

  async findByCompanyId(companyId, { status } = {}) {
    const query = db('whatsapp_templates')
      .where({ company_id: companyId })
      .orderBy('updated_at', 'desc');

    if (status) {
      query.andWhere({ status });
    }

    return query;
  },

  async findById(companyId, id) {
    return db('whatsapp_templates')
      .where({ id, company_id: companyId })
      .first();
  },

  async findByNameLanguage(companyId, wabaId, name, language) {
    return db('whatsapp_templates')
      .where({
        company_id: companyId,
        waba_id: String(wabaId),
        name: String(name),
        language: String(language),
      })
      .first();
  },

  async findByMetaTemplateId(metaTemplateId) {
    if (!metaTemplateId) return null;
    return db('whatsapp_templates')
      .where({ meta_template_id: String(metaTemplateId) })
      .first();
  },

  async updateStatusByMetaId({
    metaTemplateId,
    name,
    language,
    wabaId,
    status,
    rejectedReason,
    rejectionInfo,
  }) {
    const query = db('whatsapp_templates');

    if (metaTemplateId) {
      query.where({ meta_template_id: String(metaTemplateId) });
    } else if (wabaId && name && language) {
      query.where({
        waba_id: String(wabaId),
        name: String(name),
        language: String(language),
      });
    } else {
      return 0;
    }

    return query.update({
      status,
      rejected_reason: rejectedReason ?? null,
      rejection_info: serializeJson(rejectionInfo),
    });
  },
};
