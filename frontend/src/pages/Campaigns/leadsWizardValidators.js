import {
  LABEL_TYPES,
  OPTION_TYPES,
  LEAD_WIZARD_STEPS,
  getCampaignAds,
} from './leadsWizardState.js';

function issue(step, field, message) {
  return { step, field, message };
}

function isHttpsUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isQuestionValid(q) {
  if (!q?.type) return false;
  if (LABEL_TYPES.has(q.type)) {
    if (String(q.label || '').trim().length < 2) return false;
  }
  if (OPTION_TYPES.has(q.type)) {
    const options = String(q.optionsText || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (options.length < 2) return false;
  }
  return true;
}

export function validateCampaignStep(state) {
  const issues = [];
  const campaign = state.campaign || {};

  if (String(campaign.name || '').trim().length < 3) {
    issues.push(
      issue('campaign', 'name', 'Informe um nome com pelo menos 3 caracteres.')
    );
  }
  if (!String(campaign.adAccountId || '').trim()) {
    issues.push(
      issue('campaign', 'adAccountId', 'Selecione uma conta de anúncios.')
    );
  }
  if (!String(campaign.pageId || '').trim()) {
    issues.push(issue('campaign', 'pageId', 'Selecione uma página do Facebook.'));
  }
  if (!(Number(campaign.dailyBudget) > 0)) {
    issues.push(
      issue(
        'campaign',
        'dailyBudget',
        'Informe um orçamento diário maior que zero.'
      )
    );
  }

  return { valid: issues.length === 0, issues };
}

export function validateFormStep(state, session = {}) {
  const issues = [];
  const form = state.form || {};
  const localFormsById = session.localFormsById || {};

  if (form.mode === 'existing') {
    if (!form.existingFormId) {
      issues.push(
        issue('form', 'existingFormId', 'Escolha um formulário existente.')
      );
    } else if (
      session.formsLoaded &&
      !localFormsById[String(form.existingFormId)]
    ) {
      const name = form.existingFormSnapshot?.name || 'selecionado';
      issues.push(
        issue(
          'form',
          'existingFormId',
          `O formulário “${name}” não está mais disponível. Escolha outro formulário.`
        )
      );
    }
  } else {
    if (String(form.title || '').trim().length < 3) {
      issues.push(
        issue('form', 'title', 'Informe um título com pelo menos 3 caracteres.')
      );
    }
    const questions = Array.isArray(form.questions) ? form.questions : [];
    if (questions.length < 1) {
      issues.push(
        issue('form', 'questions', 'Adicione pelo menos uma pergunta.')
      );
    } else if (questions.length > 15) {
      issues.push(
        issue('form', 'questions', 'O formulário pode ter no máximo 15 campos.')
      );
    } else if (!questions.every(isQuestionValid)) {
      issues.push(
        issue(
          'form',
          'questions',
          'Revise as perguntas: labels e opções incompletas.'
        )
      );
    }
  }

  if (!isHttpsUrl(form.privacyUrl)) {
    issues.push(
      issue(
        'form',
        'privacyUrl',
        'Informe a política de privacidade com URL https://.'
      )
    );
  }

  if (form.followUpUrl && String(form.followUpUrl).trim()) {
    if (!isHttpsUrl(form.followUpUrl)) {
      issues.push(
        issue(
          'form',
          'followUpUrl',
          'A URL pós-envio deve começar com https://.'
        )
      );
    }
  }

  return { valid: issues.length === 0, issues };
}

export function validateAudienceStep(state) {
  const issues = [];
  const audience = state.audience || {};
  const ageMin = Number(audience.ageMin);
  const ageMax = Number(audience.ageMax);

  if (!Number.isFinite(ageMin) || ageMin < 13 || ageMin > 65) {
    issues.push(
      issue('audience', 'ageMin', 'Idade mínima deve estar entre 13 e 65.')
    );
  }
  if (!Number.isFinite(ageMax) || ageMax < 13 || ageMax > 65) {
    issues.push(
      issue('audience', 'ageMax', 'Idade máxima deve estar entre 13 e 65.')
    );
  }
  if (Number.isFinite(ageMin) && Number.isFinite(ageMax) && ageMin > ageMax) {
    issues.push(
      issue('audience', 'ageMax', 'A idade máxima deve ser maior ou igual à mínima.')
    );
  }

  const locations = Array.isArray(audience.locations) ? audience.locations : [];
  if (locations.length === 0) {
    issues.push(
      issue(
        'audience',
        'locations',
        'Adicione pelo menos uma localização.'
      )
    );
  }

  if (audience.bidLimit != null && audience.bidLimit !== '') {
    const bid = Number(audience.bidLimit);
    // 0 = Meta otimiza automaticamente (mesmo comportamento de vazio)
    if (bid !== 0 && !(bid > 0)) {
      issues.push(
        issue(
          'audience',
          'bidLimit',
          'O limite de lance deve ser maior que zero.'
        )
      );
    }
  }

  return { valid: issues.length === 0, issues };
}

export function validateAdStep(state, session = {}) {
  const issues = [];
  const ads = getCampaignAds(state);
  if (ads.length === 0) {
    return {
      valid: false,
      issues: [issue('ad', 'ads', 'Adicione pelo menos um anúncio.')],
    };
  }

  ads.forEach((ad, index) => {
    const label = `Anúncio ${index + 1}`;
    if (String(ad.name || '').trim().length < 1) {
      issues.push(issue('ad', 'name', `${label}: informe um nome.`));
    }
    if (String(ad.primaryText || '').trim().length < 2) {
      issues.push(
        issue('ad', 'primaryText', `${label}: escreva o texto principal.`)
      );
    }
    if (String(ad.title || '').trim().length < 2) {
      issues.push(issue('ad', 'title', `${label}: informe o título.`));
    }
    if (!String(ad.cta || '').trim()) {
      issues.push(issue('ad', 'cta', `${label}: escolha o texto do botão.`));
    }

    const imageFile =
      session.imageFiles?.[ad.clientKey] ||
      (index === 0 ? session.imageFile : null);
    if (!imageFile && ad.hasImage) {
      issues.push(
        issue(
          'ad',
          'image',
          `${label}: a imagem do rascunho precisa ser selecionada novamente.`
        )
      );
    } else if (!imageFile) {
      issues.push(issue('ad', 'image', `${label}: selecione uma imagem.`));
    }
  });

  return { valid: issues.length === 0, issues };
}

const STEP_VALIDATORS = {
  campaign: (state) => validateCampaignStep(state),
  form: (state, session) => validateFormStep(state, session),
  audience: (state) => validateAudienceStep(state),
  ad: (state, session) => validateAdStep(state, session),
  setup: (state, session) => {
    const a = validateCampaignStep(state);
    const b = validateAudienceStep(state, session);
    const issues = [...a.issues, ...b.issues];
    return { valid: issues.length === 0, issues };
  },
  creative: (state, session) => {
    const a = validateFormStep(state, session);
    const b = validateAdStep(state, session);
    const issues = [...a.issues, ...b.issues];
    return { valid: issues.length === 0, issues };
  },
  review: () => ({ valid: true, issues: [] }),
};

export function validateStep(stepId, state, session = {}) {
  const fn = STEP_VALIDATORS[stepId];
  if (!fn) return { valid: true, issues: [] };
  return fn(state, session);
}

export function collectBlockingIssues(state, session = {}) {
  const issues = [];
  for (const step of LEAD_WIZARD_STEPS) {
    if (step.id === 'review') continue;
    const result = validateStep(step.id, state, session);
    issues.push(...result.issues);
  }
  return issues;
}
