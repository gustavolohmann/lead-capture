import {
  DRAFT_OBJECTIVE,
  DRAFT_VERSION,
  createAdState,
  createInitialCampaignState,
} from './leadsWizardState.js';

export const DRAFT_STORAGE_KEY = 'lc_campaign_draft_leads';

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function sanitizeDraftState(state) {
  const base = createInitialCampaignState();
  const source = isPlainObject(state) ? state : {};

  const sourceAds = Array.isArray(source.ads)
    ? source.ads
    : isPlainObject(source.ad)
      ? [source.ad]
      : base.ads;
  const ads = sourceAds.map((ad, index) =>
    createAdState({
      ...(isPlainObject(ad) ? ad : {}),
      name: ad?.name || `Anúncio ${index + 1}`,
      // Never persist File / blob URLs — only meta flags
      imageMeta: ad?.imageMeta
        ? {
            name: ad.imageMeta.name || '',
            size: ad.imageMeta.size || 0,
            type: ad.imageMeta.type || '',
          }
        : null,
      hasImage: Boolean(ad?.hasImage),
    })
  );

  return {
    campaign: {
      ...base.campaign,
      ...(isPlainObject(source.campaign) ? source.campaign : {}),
    },
    form: {
      ...base.form,
      ...(isPlainObject(source.form) ? source.form : {}),
      questions: Array.isArray(source.form?.questions)
        ? source.form.questions
        : base.form.questions,
    },
    audience: {
      ...base.audience,
      ...(isPlainObject(source.audience) ? source.audience : {}),
      locations: Array.isArray(source.audience?.locations)
        ? source.audience.locations
        : [],
      interests: Array.isArray(source.audience?.interests)
        ? source.audience.interests
        : [],
    },
    ads: ads.length > 0 ? ads : base.ads,
  };
}

export function setDraft({ step = 0, state }) {
  const payload = {
    version: DRAFT_VERSION,
    objective: DRAFT_OBJECTIVE,
    updatedAt: new Date().toISOString(),
    step: Number(step) || 0,
    state: sanitizeDraftState(state),
  };
  localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
  return payload;
}

export function getDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isPlainObject(parsed)) {
      clearDraft();
      return null;
    }
    if (![2, DRAFT_VERSION].includes(parsed.version)) {
      clearDraft();
      return null;
    }
    if (parsed.objective && parsed.objective !== DRAFT_OBJECTIVE) {
      clearDraft();
      return null;
    }
    if (!isPlainObject(parsed.state)) {
      clearDraft();
      return null;
    }
    return {
      version: DRAFT_VERSION,
      objective: DRAFT_OBJECTIVE,
      updatedAt: parsed.updatedAt || null,
      step: Number.isFinite(Number(parsed.step)) ? Number(parsed.step) : 0,
      state: sanitizeDraftState(parsed.state),
    };
  } catch {
    clearDraft();
    return null;
  }
}

export function clearDraft() {
  localStorage.removeItem(DRAFT_STORAGE_KEY);
}

export function formatDraftAge(updatedAt) {
  if (!updatedAt) return '';
  const then = new Date(updatedAt).getTime();
  if (!Number.isFinite(then)) return '';
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 1) return 'agora';
  if (minutes === 1) return 'há 1 minuto';
  if (minutes < 60) return `há ${minutes} minutos`;
  const hours = Math.round(minutes / 60);
  if (hours === 1) return 'há 1 hora';
  if (hours < 48) return `há ${hours} horas`;
  return `há ${Math.round(hours / 24)} dias`;
}
