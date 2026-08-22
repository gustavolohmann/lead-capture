export const DRAFT_VERSION = 3;
export const DRAFT_OBJECTIVE = 'leads';

/** Wizard shell steps (3). Product sections still live under campaign/form/audience/ad. */
export const LEAD_WIZARD_STEPS = [
  { id: 'setup', label: 'Configuração' },
  { id: 'creative', label: 'Anúncio' },
  { id: 'review', label: 'Revisão' },
];

/** Maps validator/payload issue steps → wizard shell step id */
export const ISSUE_STEP_TO_WIZARD = {
  campaign: 'setup',
  audience: 'setup',
  form: 'creative',
  ad: 'creative',
  setup: 'setup',
  creative: 'creative',
  review: 'review',
};

export const CTA_OPTIONS = [
  { value: 'sign_up', label: 'Cadastre-se' },
  { value: 'learn_more', label: 'Saiba mais' },
  { value: 'get_quote', label: 'Solicitar orçamento' },
  { value: 'apply_now', label: 'Candidate-se' },
];

export const QUESTION_TYPES = [
  { value: 'FULL_NAME', label: 'Nome completo', needsLabel: false },
  { value: 'EMAIL', label: 'E-mail', needsLabel: false },
  { value: 'PHONE', label: 'Telefone', needsLabel: false },
  { value: 'TEXT', label: 'Texto', needsLabel: true },
  { value: 'TEXTAREA', label: 'Texto longo', needsLabel: true },
  { value: 'NUMBER', label: 'Número', needsLabel: true },
  { value: 'DATE', label: 'Data', needsLabel: false },
  { value: 'SELECT', label: 'Lista', needsLabel: true, needsOptions: true },
  { value: 'RADIO', label: 'Opção única', needsLabel: true, needsOptions: true },
  {
    value: 'CHECKBOX',
    label: 'Múltipla escolha',
    needsLabel: true,
    needsOptions: true,
  },
  { value: 'CITY', label: 'Cidade', needsLabel: false },
  { value: 'STATE', label: 'Estado', needsLabel: false },
  { value: 'POST_CODE', label: 'CEP', needsLabel: false },
  { value: 'COMPANY_NAME', label: 'Empresa', needsLabel: false },
  { value: 'JOB_TITLE', label: 'Cargo', needsLabel: false },
  { value: 'WEBSITE', label: 'Website', needsLabel: false },
  { value: 'WHATSAPP_NUMBER', label: 'WhatsApp', needsLabel: false },
  { value: 'GENDER', label: 'Gênero', needsLabel: false },
];

export const OPTION_TYPES = new Set(['SELECT', 'RADIO', 'CHECKBOX']);
export const LABEL_TYPES = new Set(
  QUESTION_TYPES.filter((t) => t.needsLabel).map((t) => t.value)
);

export function questionTypeMeta(type) {
  return QUESTION_TYPES.find((t) => t.value === type) || QUESTION_TYPES[3];
}

export function createEmptyQuestion(type = 'TEXT') {
  const meta = questionTypeMeta(type);
  return {
    type,
    label: meta.needsLabel ? '' : meta.label,
    optionsText: '',
  };
}

export function createDefaultQuestions() {
  return [
    createEmptyQuestion('FULL_NAME'),
    createEmptyQuestion('EMAIL'),
    createEmptyQuestion('PHONE'),
    { type: 'TEXT', label: 'Qual serviço deseja?', optionsText: '' },
  ];
}

export function createAdState(overrides = {}) {
  const clientKey =
    overrides.clientKey ||
    globalThis.crypto?.randomUUID?.() ||
    `ad_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  return {
    clientKey,
    name: overrides.name ?? 'Anúncio 1',
    primaryText:
      overrides.primaryText ??
      'Quer aumentar suas vendas? Receba uma avaliação gratuita.',
    title: overrides.title ?? 'Solicite orçamento',
    description: overrides.description ?? '',
    cta: overrides.cta ?? 'get_quote',
    imageMeta: overrides.imageMeta ?? null,
    hasImage: Boolean(overrides.hasImage),
  };
}

export function getCampaignAds(state = {}) {
  if (Array.isArray(state.ads) && state.ads.length > 0) return state.ads;
  return state.ad ? [createAdState(state.ad)] : [];
}

export function createInitialCampaignState() {
  return {
    campaign: {
      name: '',
      adAccountId: '',
      pageId: '',
      dailyBudget: 50,
    },
    form: {
      mode: 'new',
      existingFormId: null,
      existingFormSnapshot: null,
      title: 'Solicite orçamento',
      questions: createDefaultQuestions(),
      privacyUrl: '',
      followUpUrl: '',
    },
    audience: {
      country: 'BR',
      locations: [],
      ageMin: 25,
      ageMax: 55,
      gender: 'all',
      interests: [],
      bidLimit: 0,
    },
    ads: [createAdState()],
  };
}

export function stepIndexById(stepId) {
  const wizardId = ISSUE_STEP_TO_WIZARD[stepId] || stepId;
  return LEAD_WIZARD_STEPS.findIndex((step) => step.id === wizardId);
}

/** Product-section labels for Review “Corrigir em X” (not shell step names). */
const ISSUE_STEP_LABELS = {
  campaign: 'Campanha',
  audience: 'Público',
  form: 'Formulário',
  ad: 'Anúncio',
  setup: 'Configuração',
  creative: 'Anúncio',
  review: 'Revisão',
};

export function stepLabel(stepId) {
  if (ISSUE_STEP_LABELS[stepId]) return ISSUE_STEP_LABELS[stepId];
  const wizardId = ISSUE_STEP_TO_WIZARD[stepId] || stepId;
  return LEAD_WIZARD_STEPS.find((step) => step.id === wizardId)?.label || stepId;
}

export function formatStepProgress(stepIndex) {
  const step = LEAD_WIZARD_STEPS[stepIndex];
  if (!step) return '';
  return `Etapa ${stepIndex + 1} de ${LEAD_WIZARD_STEPS.length} · ${step.label}`;
}
