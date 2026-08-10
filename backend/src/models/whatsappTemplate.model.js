export const WhatsappTemplateStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  PAUSED: 'PAUSED',
  DISABLED: 'DISABLED',
  IN_APPEAL: 'IN_APPEAL',
  PENDING_DELETION: 'PENDING_DELETION',
  DELETED: 'DELETED',
  FLAGGED: 'FLAGGED',
};

export const WhatsappTemplateCategory = {
  MARKETING: 'MARKETING',
  UTILITY: 'UTILITY',
  AUTHENTICATION: 'AUTHENTICATION',
};

export function normalizeMetaStatus(status) {
  const value = String(status || '').toUpperCase();
  if (value === 'IN_REVIEW') return WhatsappTemplateStatus.PENDING;
  if (Object.values(WhatsappTemplateStatus).includes(value)) return value;
  return value || WhatsappTemplateStatus.PENDING;
}

export function toPublicWhatsappTemplate(row) {
  if (!row) return null;

  let components = row.components;
  if (typeof components === 'string') {
    try {
      components = JSON.parse(components);
    } catch {
      components = [];
    }
  }

  let rejectionInfo = row.rejection_info;
  if (typeof rejectionInfo === 'string') {
    try {
      rejectionInfo = JSON.parse(rejectionInfo);
    } catch {
      rejectionInfo = null;
    }
  }

  return {
    id: row.id,
    companyId: row.company_id,
    wabaId: row.waba_id,
    metaTemplateId: row.meta_template_id,
    name: row.name,
    language: row.language,
    category: row.category,
    status: row.status,
    rejectedReason: row.rejected_reason,
    rejectionInfo,
    qualityScore: row.quality_score,
    components: Array.isArray(components) ? components : [],
    parameterFormat: row.parameter_format || 'POSITIONAL',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
