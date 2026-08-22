import { getCampaignAds, OPTION_TYPES } from './leadsWizardState.js';

export class WizardPayloadError extends Error {
  constructor(message, { step, field } = {}) {
    super(message);
    this.name = 'WizardPayloadError';
    this.step = step;
    this.field = field;
  }
}

const CTA_UI_TO_META = {
  sign_up: 'SIGN_UP',
  learn_more: 'LEARN_MORE',
  get_quote: 'GET_QUOTE',
  apply_now: 'APPLY_NOW',
};

const CTA_META_TO_UI_LABEL = {
  SIGN_UP: 'Cadastre-se',
  LEARN_MORE: 'Saiba mais',
  GET_QUOTE: 'Solicitar orçamento',
  APPLY_NOW: 'Candidate-se',
};

export function ctaUiToMeta(cta) {
  const key = String(cta || '').trim().toLowerCase();
  return CTA_UI_TO_META[key] || 'LEARN_MORE';
}

export function ctaUiLabel(cta) {
  const meta = ctaUiToMeta(cta);
  return CTA_META_TO_UI_LABEL[meta] || 'Saiba mais';
}

export function audienceToApi(audience = {}) {
  const ageMin = Number(audience.ageMin);
  const ageMax = Number(audience.ageMax);
  const locations = Array.isArray(audience.locations) ? audience.locations : [];
  const first = locations[0];
  const city =
    (first && (first.city || first.label)) ||
    undefined;

  const payload = {
    ageMin: Number.isFinite(ageMin) ? ageMin : 18,
    ageMax: Number.isFinite(ageMax) ? ageMax : 65,
    country: String(audience.country || 'BR').toUpperCase() || 'BR',
  };

  if (city && String(city).trim()) {
    payload.city = String(city).trim();
  }

  if (audience.gender === 'male') {
    payload.genders = [1];
  } else if (audience.gender === 'female') {
    payload.genders = [2];
  }

  if (audience.bidLimit != null && audience.bidLimit !== '') {
    const bid = Number(audience.bidLimit);
    if (Number.isFinite(bid) && bid > 0) {
      payload.bidAmount = bid;
    }
  }

  const interests = (Array.isArray(audience.interests) ? audience.interests : [])
    .map((item) => {
      const id = item?.metaId || item?.id;
      if (!id) return null;
      return { id: String(id), name: item.name || item.label || undefined };
    })
    .filter(Boolean);

  if (interests.length > 0) {
    payload.interests = interests;
  }

  return payload;
}

function mapLocalFieldToQuestion(field) {
  const type = String(field?.type || 'TEXT').toUpperCase();
  const label = String(field?.label || '').trim();
  const options = Array.isArray(field?.options)
    ? field.options.map((o) => String(o?.label || o).trim()).filter(Boolean)
    : undefined;

  return {
    type,
    label: label || undefined,
    options: OPTION_TYPES.has(type) ? options : undefined,
  };
}

export function localFormToQuestions(localForm) {
  const fields = Array.isArray(localForm?.fields) ? localForm.fields : [];
  return fields.map(mapLocalFieldToQuestion);
}

export function formStateToQuestions(form, localFormsById = {}) {
  if (form?.mode === 'existing') {
    const id = String(form.existingFormId || '');
    const localForm = localFormsById[id];
    if (!localForm) {
      throw new WizardPayloadError(
        form.existingFormSnapshot?.name
          ? `O formulário “${form.existingFormSnapshot.name}” não está mais disponível. Escolha outro formulário.`
          : 'O formulário selecionado não está mais disponível.',
        { step: 'form', field: 'existingFormId' }
      );
    }
    const questions = localFormToQuestions(localForm);
    if (questions.length < 1) {
      throw new WizardPayloadError(
        'O formulário selecionado não possui campos.',
        { step: 'form', field: 'existingFormId' }
      );
    }
    return {
      title: String(localForm.name || form.existingFormSnapshot?.name || 'Formulário').trim(),
      questions,
    };
  }

  const questions = (Array.isArray(form?.questions) ? form.questions : []).map(
    (q) => ({
      type: q.type,
      label: String(q.label || '').trim() || undefined,
      options: OPTION_TYPES.has(q.type)
        ? String(q.optionsText || '')
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
        : undefined,
    })
  );

  return {
    title: String(form?.title || '').trim(),
    questions,
  };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      resolve(String(reader.result || event?.target?.result || ''));
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Única porta de saída para POST /campaigns/full.
 * Lança WizardPayloadError se faltar dependência (não gera payload parcial).
 */
export async function buildCreateFullPayload(state, session = {}) {
  const { imageFile, imageFiles = {}, localFormsById = {} } = session;
  const ads = getCampaignAds(state);
  if (ads.length === 0) {
    throw new WizardPayloadError('Adicione pelo menos um anúncio.', {
      step: 'ad',
      field: 'ads',
    });
  }

  const formMapped = formStateToQuestions(state.form, localFormsById);
  const mappedAds = [];
  for (let index = 0; index < ads.length; index += 1) {
    const ad = ads[index];
    const file = imageFiles[ad.clientKey] || (index === 0 ? imageFile : null);
    if (!file) {
      throw new WizardPayloadError(
        `Selecione a imagem do anúncio ${index + 1}.`,
        { step: 'ad', field: 'image' }
      );
    }
    const imageBase64 = await fileToBase64(file);
    if (!imageBase64 || imageBase64.length < 32) {
      throw new WizardPayloadError(
        `Não foi possível ler a imagem do anúncio ${index + 1}.`,
        { step: 'ad', field: 'image' }
      );
    }
    mappedAds.push({
      clientKey: ad.clientKey,
      name: String(ad.name || `Anúncio ${index + 1}`).trim(),
      creative: {
        title: String(ad.title || '').trim(),
        text: String(ad.primaryText || '').trim(),
        description: String(ad.description || '').trim() || undefined,
        cta: ctaUiToMeta(ad.cta),
        imageBase64,
        imageName: file.name || ad.imageMeta?.name || 'creative.jpg',
      },
    });
  }

  const privacyUrl = String(state.form?.privacyUrl || '').trim();
  const followUpUrl =
    String(state.form?.followUpUrl || '').trim() || privacyUrl;

  return {
    name: String(state.campaign?.name || '').trim(),
    objective: 'LEAD_GENERATION',
    adAccountId: state.campaign?.adAccountId,
    pageId: state.campaign?.pageId,
    budget: Number(state.campaign?.dailyBudget),
    form: {
      title: formMapped.title,
      questions: formMapped.questions,
      privacyPolicyUrl: privacyUrl,
      followUpActionUrl: followUpUrl,
    },
    audience: audienceToApi(state.audience),
    ads: mappedAds,
  };
}
