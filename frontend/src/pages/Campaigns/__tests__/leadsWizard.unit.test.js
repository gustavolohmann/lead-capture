import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  ctaUiToMeta,
  audienceToApi,
  buildCreateFullPayload,
  WizardPayloadError,
} from '../leadsWizardMappers.js';
import { createInitialCampaignState } from '../leadsWizardState.js';
import {
  getDraft,
  setDraft,
  clearDraft,
  DRAFT_STORAGE_KEY,
} from '../campaignDraft.js';

function installMemoryLocalStorage() {
  const store = new Map();
  const localStorage = {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(String(key));
    },
    clear() {
      store.clear();
    },
  };
  vi.stubGlobal('localStorage', localStorage);
  return localStorage;
}

describe('ctaUiToMeta', () => {
  it('maps UI keys to Meta enums', () => {
    expect(ctaUiToMeta('get_quote')).toBe('GET_QUOTE');
    expect(ctaUiToMeta('sign_up')).toBe('SIGN_UP');
    expect(ctaUiToMeta('learn_more')).toBe('LEARN_MORE');
    expect(ctaUiToMeta('apply_now')).toBe('APPLY_NOW');
  });

  it('falls back to LEARN_MORE', () => {
    expect(ctaUiToMeta('unknown')).toBe('LEARN_MORE');
  });
});

describe('audienceToApi', () => {
  it('omits genders when all', () => {
    const api = audienceToApi({
      country: 'BR',
      ageMin: 25,
      ageMax: 55,
      gender: 'all',
      locations: [{ city: 'Curitiba', label: 'Curitiba, PR' }],
    });
    expect(api.genders).toBeUndefined();
    expect(api.city).toBe('Curitiba');
  });

  it('maps male/female to genders arrays', () => {
    expect(audienceToApi({ gender: 'male', ageMin: 18, ageMax: 40 }).genders).toEqual([
      1,
    ]);
    expect(
      audienceToApi({ gender: 'female', ageMin: 18, ageMax: 40 }).genders
    ).toEqual([2]);
  });
});

describe('campaignDraft', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
  });

  afterEach(() => {
    clearDraft();
    vi.unstubAllGlobals();
  });

  it('discards incompatible version', () => {
    localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({
        version: 999,
        objective: 'leads',
        step: 1,
        state: createInitialCampaignState(),
      })
    );
    expect(getDraft()).toBeNull();
    expect(localStorage.getItem(DRAFT_STORAGE_KEY)).toBeNull();
  });

  it('round-trips sanitized state', () => {
    const state = createInitialCampaignState();
    state.campaign.name = 'Barbearia';
    state.ads[0].hasImage = true;
    state.ads[0].imageMeta = { name: 'a.jpg', size: 10, type: 'image/jpeg' };
    setDraft({ step: 3, state });
    const draft = getDraft();
    expect(draft.step).toBe(3);
    expect(draft.objective).toBe('leads');
    expect(draft.state.campaign.name).toBe('Barbearia');
    expect(draft.state.ads[0].hasImage).toBe(true);
  });

  it('migra draft v2 com ad singular para ads[]', () => {
    const legacy = createInitialCampaignState();
    const ad = legacy.ads[0];
    delete legacy.ads;
    legacy.ad = { ...ad, name: 'Anúncio legado' };
    localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({ version: 2, objective: 'leads', step: 1, state: legacy })
    );

    const draft = getDraft();
    expect(draft.state.ads).toHaveLength(1);
    expect(draft.state.ads[0].name).toBe('Anúncio legado');
  });
});

describe('buildCreateFullPayload', () => {
  it('throws WizardPayloadError without imageFile', async () => {
    const state = createInitialCampaignState();
    await expect(buildCreateFullPayload(state, {})).rejects.toBeInstanceOf(
      WizardPayloadError
    );
  });

  it('builds payload with imageFile', async () => {
    const state = createInitialCampaignState();
    state.campaign.name = 'Campanha Teste';
    state.campaign.adAccountId = 'act_1';
    state.campaign.pageId = 'page_1';
    state.form.privacyUrl = 'https://example.com/privacy';
    state.ads[0].cta = 'get_quote';

    const file = new File(['fake'], 'creative.jpg', { type: 'image/jpeg' });
    const dataUrl = `data:image/jpeg;base64,${'a'.repeat(40)}`;
    vi.stubGlobal(
      'FileReader',
      class {
        result = null;
        onload = null;
        onerror = null;
        readAsDataURL() {
          this.result = dataUrl;
          queueMicrotask(() => {
            this.onload?.({ target: this });
          });
        }
      }
    );

    const payload = await buildCreateFullPayload(state, { imageFile: file });
    expect(payload.objective).toBe('LEAD_GENERATION');
    expect(payload.ads).toHaveLength(1);
    expect(payload.ads[0].creative.cta).toBe('GET_QUOTE');
    expect(payload.budget).toBe(50);
    expect(payload.form.privacyPolicyUrl).toBe('https://example.com/privacy');
    expect(payload.ads[0].creative.imageBase64).toContain('base64');
    vi.unstubAllGlobals();
  });

  it('builds two ads with their own files', async () => {
    const state = createInitialCampaignState();
    state.campaign.name = 'Campanha 1:N';
    state.campaign.adAccountId = 'act_1';
    state.campaign.pageId = 'page_1';
    state.form.privacyUrl = 'https://example.com/privacy';
    state.ads.push({
      ...state.ads[0],
      clientKey: 'ad-2',
      name: 'Anúncio 2',
      title: 'Segundo',
    });
    const first = new File(['one'], 'one.jpg', { type: 'image/jpeg' });
    const second = new File(['two'], 'two.jpg', { type: 'image/jpeg' });
    vi.stubGlobal(
      'FileReader',
      class {
        result = null;
        onload = null;
        readAsDataURL(file) {
          this.result = `data:image/jpeg;base64,${file.name}${'a'.repeat(40)}`;
          queueMicrotask(() => this.onload?.({ target: this }));
        }
      }
    );

    const payload = await buildCreateFullPayload(state, {
      imageFiles: {
        [state.ads[0].clientKey]: first,
        'ad-2': second,
      },
    });

    expect(payload.ads).toHaveLength(2);
    expect(payload.ads[0].creative.imageName).toBe('one.jpg');
    expect(payload.ads[1].creative.imageName).toBe('two.jpg');
  });

  it('throws when existing form is missing', async () => {
    const state = createInitialCampaignState();
    state.form.mode = 'existing';
    state.form.existingFormId = '99';
    state.form.existingFormSnapshot = { name: 'Seguro Auto', fieldsCount: 4 };
    state.form.privacyUrl = 'https://example.com/privacy';
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
    const dataUrl = `data:image/jpeg;base64,${'b'.repeat(40)}`;
    vi.stubGlobal(
      'FileReader',
      class {
        result = null;
        onload = null;
        onerror = null;
        readAsDataURL() {
          this.result = dataUrl;
          queueMicrotask(() => {
            this.onload?.({ target: this });
          });
        }
      }
    );

    await expect(
      buildCreateFullPayload(state, { imageFile: file, localFormsById: {} })
    ).rejects.toMatchObject({
      name: 'WizardPayloadError',
      step: 'form',
      field: 'existingFormId',
    });
    vi.unstubAllGlobals();
  });
});
