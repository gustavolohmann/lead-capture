export const LeadStatus = Object.freeze({
  NEW: 'NEW',
  CONTACTED: 'CONTACTED',
  QUALIFIED: 'QUALIFIED',
  CONVERTED: 'CONVERTED',
  LOST: 'LOST',
});

export const LeadSource = Object.freeze({
  META_LEAD_ADS: 'META_LEAD_ADS',
  FORM: 'FORM',
});

const DEFAULT_FIELD_LABELS = {
  full_name: 'Nome completo',
  first_name: 'Nome',
  last_name: 'Sobrenome',
  email: 'Email',
  work_email: 'Email profissional',
  phone_number: 'Telefone',
  phone: 'Telefone',
  company_name: 'Empresa',
  job_title: 'Cargo',
  city: 'Cidade',
  state: 'Estado',
  post_code: 'CEP',
  zip: 'CEP',
  country: 'País',
  whatsapp_number: 'WhatsApp',
  gender: 'Gênero',
  date_of_birth: 'Data de nascimento',
  dob: 'Data de nascimento',
  date_time: 'Data',
  website: 'Website',
};

function parseRawData(rawData) {
  if (!rawData) return null;
  if (typeof rawData === 'object') return rawData;
  try {
    return JSON.parse(rawData);
  } catch {
    return null;
  }
}

/**
 * Extrai perguntas/respostas do payload Meta (field_data) ou de answers embutidos.
 */
export function extractLeadAnswers(rawData) {
  const data = parseRawData(rawData);
  if (!data) return [];

  if (Array.isArray(data.answers) && data.answers.length > 0) {
    return data.answers.map((item) => ({
      key: String(item.key || item.field || item.label || ''),
      label: String(item.label || item.key || 'Campo'),
      value:
        item.value == null
          ? ''
          : Array.isArray(item.value)
            ? item.value.join(', ')
            : String(item.value),
    }));
  }

  const fieldData = Array.isArray(data.field_data) ? data.field_data : [];
  const labels = data.question_labels || {};

  return fieldData.map((field) => {
    const key = String(field?.name || '');
    const values = Array.isArray(field?.values) ? field.values : [];
    return {
      key,
      label: labels[key] || DEFAULT_FIELD_LABELS[key] || key,
      value: values.map(String).join(', '),
    };
  });
}

/**
 * Monta rótulo legível de origem para listagem e filtro.
 */
export function buildLeadOrigin({
  source,
  formName,
  campaignName,
  adName,
  isOrganic,
} = {}) {
  if (source === LeadSource.FORM) {
    return formName ? `Formulário · ${formName}` : 'Formulário';
  }

  const parts = ['Lead Ads'];
  if (isOrganic) parts.push('Orgânico');
  if (campaignName) parts.push(campaignName);
  else if (adName) parts.push(adName);
  return parts.join(' · ');
}

export function toPublicLead(row) {
  if (!row) return null;

  const source = row.source || LeadSource.META_LEAD_ADS;
  const tracking = {
    source,
    origin:
      row.origin ||
      buildLeadOrigin({
        source,
        formName: row.form_name,
        campaignName: row.campaign_name,
        adName: row.ad_name,
        isOrganic: Boolean(row.is_organic),
      }),
    formId: row.form_id ?? null,
    formName: row.form_name ?? null,
    companyFormId: row.company_form_id ?? null,
    campaignId: row.campaign_id ?? null,
    campaignName: row.campaign_name ?? null,
    adsetId: row.adset_id ?? null,
    adsetName: row.adset_name ?? null,
    adId: row.ad_id ?? null,
    adName: row.ad_name ?? null,
    platform: row.platform ?? null,
    isOrganic: Boolean(row.is_organic),
    pageId: row.page_id ?? null,
    metaLeadId: row.meta_lead_id ?? null,
  };

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    status: row.status,
    source,
    origin: tracking.origin,
    tracking,
    answers: extractLeadAnswers(row.raw_data),
    createdAt: row.created_at,
    // compat com UI antiga
    pageId: row.page_id,
    formId: row.form_id,
    companyFormId: row.company_form_id ?? null,
    metaLeadId: row.meta_lead_id,
  };
}
