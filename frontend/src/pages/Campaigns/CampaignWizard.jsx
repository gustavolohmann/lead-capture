import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { metaApi } from '../../services/meta.api.js';
import { adsBuilderApi } from '../../services/adsBuilder.api.js';
import { formsApi } from '../../services/forms.api.js';
import {
  LEAD_WIZARD_STEPS,
  createAdState,
  createInitialCampaignState,
  getCampaignAds,
  stepIndexById,
} from './leadsWizardState.js';
import {
  validateStep,
  collectBlockingIssues,
} from './leadsWizardValidators.js';
import {
  buildCreateFullPayload,
  WizardPayloadError,
} from './leadsWizardMappers.js';
import {
  getDraft,
  setDraft,
  clearDraft,
} from './campaignDraft.js';
import SetupStep from './steps/SetupStep.jsx';
import CreativeStep from './steps/CreativeStep.jsx';
import ReviewStep from './steps/ReviewStep.jsx';
import './CampaignWizard.css';

const AUTOSAVE_MS = 800;

function createIdempotencyKey() {
  return (
    globalThis.crypto?.randomUUID?.() ||
    `campaign_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`
  );
}

function issuesToFieldMap(issues) {
  const map = {};
  for (const item of issues) {
    if (item.field && !map[item.field]) {
      map[item.field] = item.message;
    }
  }
  return map;
}

export default function CampaignWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [state, setState] = useState(() => createInitialCampaignState());
  const [pages, setPages] = useState([]);
  const [adAccounts, setAdAccounts] = useState([]);
  const [localForms, setLocalForms] = useState([]);
  const [formsLoaded, setFormsLoaded] = useState(false);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [activeAdIndex, setActiveAdIndex] = useState(0);
  const [imageFiles, setImageFiles] = useState({});
  const [imagePreviewUrls, setImagePreviewUrls] = useState({});
  const [imageErrors, setImageErrors] = useState({});
  const [draftReady, setDraftReady] = useState(false);

  const stateRef = useRef(state);
  const stepRef = useRef(step);
  const autosaveTimer = useRef(null);
  const skipAutosave = useRef(true);
  const publicationKeyRef = useRef(null);
  const previewUrlsRef = useRef(imagePreviewUrls);

  stateRef.current = state;
  stepRef.current = step;
  previewUrlsRef.current = imagePreviewUrls;

  const ads = getCampaignAds(state);
  const activeAd = ads[Math.min(activeAdIndex, ads.length - 1)] || ads[0];
  const activeAdKey = activeAd?.clientKey || '';
  const activeState = { ...state, ad: activeAd };
  const imageFile = imageFiles[activeAdKey] || null;
  const imagePreviewUrl = imagePreviewUrls[activeAdKey] || '';
  const imageError = imageErrors[activeAdKey] || '';
  const imageNeedsReselect = Boolean(activeAd?.hasImage && !imageFile);

  const localFormsById = useMemo(() => {
    const map = {};
    for (const form of localForms) {
      map[String(form.id)] = form;
    }
    return map;
  }, [localForms]);

  const session = useMemo(
    () => ({
      imageFile,
      imageFiles,
      localFormsById,
      formsLoaded,
    }),
    [imageFile, imageFiles, localFormsById, formsLoaded]
  );

  const blockingIssues = useMemo(
    () => collectBlockingIssues(state, session),
    [state, session]
  );

  // Restore draft once
  useEffect(() => {
    const draft = getDraft();
    if (draft) {
      setState(draft.state);
      setStep(Math.min(draft.step, LEAD_WIZARD_STEPS.length - 1));
      setActiveAdIndex(0);
    }
    setDraftReady(true);
    // allow autosave after first paint
    const t = setTimeout(() => {
      skipAutosave.current = false;
    }, 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    async function load() {
      setLoadingAssets(true);
      setError('');
      try {
        const [assets, formsData] = await Promise.all([
          metaApi.getAssets(),
          formsApi.list().catch(() => ({ forms: [] })),
        ]);
        const nextPages = assets.pages || [];
        const nextAccounts = assets.adAccounts || [];
        setPages(nextPages);
        setAdAccounts(nextAccounts);
        setLocalForms(formsData.forms || []);
        setFormsLoaded(true);

        setState((current) => {
          const next = { ...current, campaign: { ...current.campaign } };
          if (!next.campaign.pageId && nextPages.length === 1) {
            next.campaign.pageId = nextPages[0].pageId;
          }
          if (!next.campaign.adAccountId && nextAccounts.length === 1) {
            next.campaign.adAccountId = nextAccounts[0].accountId;
          }
          return next;
        });
      } catch (err) {
        setError(
          err?.response?.data?.message ||
            'Conecte a Meta e sincronize ativos antes de criar a campanha.'
        );
      } finally {
        setLoadingAssets(false);
      }
    }
    load();
  }, []);

  // Autosave
  useEffect(() => {
    if (!draftReady || skipAutosave.current) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      setDraft({ step: stepRef.current, state: stateRef.current });
    }, AUTOSAVE_MS);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [state, step, draftReady]);

  // beforeunload only when at least one image File is in memory
  useEffect(() => {
    if (Object.keys(imageFiles).length === 0) return undefined;
    function onBeforeUnload(event) {
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [imageFiles]);

  useEffect(() => {
    return () => {
      Object.values(previewUrlsRef.current).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, []);

  function patchSection(section, partial) {
    setState((current) => ({
      ...current,
      [section]: { ...current[section], ...partial },
    }));
    setFieldErrors({});
    setError('');
    setInfo('');
    publicationKeyRef.current = null;
  }

  function patchActiveAd(partial) {
    setState((current) => ({
      ...current,
      ads: getCampaignAds(current).map((ad, index) =>
        index === activeAdIndex ? { ...ad, ...partial } : ad
      ),
    }));
    setFieldErrors({});
    setError('');
    setInfo('');
    publicationKeyRef.current = null;
  }

  function flushSaveDraft() {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    setDraft({ step, state });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1600);
  }

  function handleImageSelect(file) {
    setImageErrors((current) => ({ ...current, [activeAdKey]: '' }));
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setImageErrors((current) => ({
        ...current,
        [activeAdKey]: 'Selecione uma imagem válida (JPG ou PNG).',
      }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageErrors((current) => ({
        ...current,
        [activeAdKey]: 'Imagem deve ter no máximo 5MB.',
      }));
      return;
    }
    const previousUrl = imagePreviewUrls[activeAdKey];
    if (previousUrl) URL.revokeObjectURL(previousUrl);
    const url = URL.createObjectURL(file);
    setImageFiles((current) => ({ ...current, [activeAdKey]: file }));
    setImagePreviewUrls((current) => ({ ...current, [activeAdKey]: url }));
    patchActiveAd({
      hasImage: true,
      imageMeta: { name: file.name, size: file.size, type: file.type },
    });
  }

  function addAd() {
    const next = createAdState({ name: `Anúncio ${ads.length + 1}` });
    setState((current) => ({
      ...current,
      ads: [...getCampaignAds(current), next],
    }));
    setActiveAdIndex(ads.length);
    publicationKeyRef.current = null;
  }

  function duplicateAd(index) {
    const source = ads[index];
    if (!source) return;
    const duplicate = createAdState({
      ...source,
      clientKey: undefined,
      name: `${source.name || `Anúncio ${index + 1}`} cópia`,
    });
    setState((current) => ({
      ...current,
      ads: [...getCampaignAds(current), duplicate],
    }));
    const sourceFile = imageFiles[source.clientKey];
    if (sourceFile) {
      setImageFiles((current) => ({
        ...current,
        [duplicate.clientKey]: sourceFile,
      }));
      setImagePreviewUrls((current) => ({
        ...current,
        [duplicate.clientKey]: URL.createObjectURL(sourceFile),
      }));
    }
    setActiveAdIndex(ads.length);
    publicationKeyRef.current = null;
  }

  function removeAd(index) {
    if (ads.length <= 1) return;
    const removed = ads[index];
    const removedUrl = imagePreviewUrls[removed.clientKey];
    if (removedUrl) URL.revokeObjectURL(removedUrl);
    setState((current) => ({
      ...current,
      ads: getCampaignAds(current).filter((_, itemIndex) => itemIndex !== index),
    }));
    setImageFiles((current) => {
      const next = { ...current };
      delete next[removed.clientKey];
      return next;
    });
    setImagePreviewUrls((current) => {
      const next = { ...current };
      delete next[removed.clientKey];
      return next;
    });
    setActiveAdIndex((current) => Math.max(0, Math.min(current, ads.length - 2)));
    publicationKeyRef.current = null;
  }

  function goBackStep() {
    if (saving) return;
    setError('');
    setInfo('');
    setFieldErrors({});
    if (step <= 0) {
      navigate('/campaigns');
      return;
    }
    setStep((current) => current - 1);
  }

  function goToStep(index) {
    if (saving) return;
    if (index < 0 || index >= LEAD_WIZARD_STEPS.length) return;

    if (index > step) {
      for (let i = step; i < index; i += 1) {
        const result = validateStep(LEAD_WIZARD_STEPS[i].id, state, session);
        if (!result.valid) {
          setFieldErrors(issuesToFieldMap(result.issues));
          setError(
            result.issues[0]?.message ||
              'Complete os campos obrigatórios desta etapa para continuar.'
          );
          setStep(i);
          return;
        }
      }
    }

    setError('');
    setInfo('');
    setFieldErrors({});
    setStep(index);
  }

  function handleContinue() {
    const stepId = LEAD_WIZARD_STEPS[step].id;
    const result = validateStep(stepId, state, session);
    if (!result.valid) {
      setFieldErrors(issuesToFieldMap(result.issues));
      setError(
        result.issues[0]?.message ||
          'Complete os campos obrigatórios desta etapa para continuar.'
      );
      return;
    }
    setFieldErrors({});
    setError('');
    setStep((current) => Math.min(current + 1, LEAD_WIZARD_STEPS.length - 1));
  }

  async function handlePublish() {
    setSaving(true);
    setError('');
    setInfo('');

    try {
      // Refresh forms before final validation when using existing
      let formsMap = localFormsById;
      if (state.form.mode === 'existing') {
        const formsData = await formsApi.list();
        const forms = formsData.forms || [];
        setLocalForms(forms);
        setFormsLoaded(true);
        formsMap = {};
        for (const form of forms) formsMap[String(form.id)] = form;
      }

      const sessionNow = {
        imageFile,
        imageFiles,
        localFormsById: formsMap,
        formsLoaded: true,
      };
      const issues = collectBlockingIssues(state, sessionNow);
      if (issues.length > 0) {
        setFieldErrors(issuesToFieldMap(issues));
        setError(issues[0].message);
        setSaving(false);
        return;
      }

      const payload = await buildCreateFullPayload(state, sessionNow);
      if (!publicationKeyRef.current) {
        publicationKeyRef.current = createIdempotencyKey();
      }
      const result = await adsBuilderApi.createFull(payload, {
        idempotencyKey: publicationKeyRef.current,
      });
      clearDraft();
      setInfo(
        `Campanha publicada (pausada): ${result.campaign?.name || state.campaign.name}`
      );
      setTimeout(() => navigate('/campaigns'), 1200);
    } catch (err) {
      if (err instanceof WizardPayloadError) {
        setError(err.message);
        if (err.step) {
          const idx = stepIndexById(err.step);
          if (idx >= 0) setStep(idx);
        }
        setSaving(false);
        return;
      }

      const apiMessage = err?.response?.data?.message;
      const apiCode = err?.response?.data?.code;
      setError(
        apiMessage
          ? `${apiMessage}${apiCode ? ` (${apiCode})` : ''}`
          : 'Falha ao publicar campanha.'
      );

      const msg = String(apiMessage || '');
      if (
        apiCode === 'META_LEAD_FORM_NAME_EXISTS' ||
        /formulário|form|privacidade|pergunta|imagem|creative|criativo|cta/i.test(
          msg
        )
      ) {
        setStep(1);
      } else if (
        /lance|bid|público|targeting|idade|age|campanha|budget|orçamento|página|page|ad account/i.test(
          msg
        )
      ) {
        setStep(0);
      }
    } finally {
      setSaving(false);
    }
  }

  const continueLabel =
    step === 0
      ? 'Continuar configuração →'
      : step === 1
        ? 'Revisar campanha →'
        : 'Continuar configuração →';
  const isLastStep = step >= LEAD_WIZARD_STEPS.length - 1;
  const stepTotal = LEAD_WIZARD_STEPS.length;

  return (
    <div className="wizard-page">
      <div className="wizard-page__main">
        <header className="wizard-page__header">
          <div>
            <nav className="wizard-page__breadcrumb" aria-label="Navegação">
              <Link to="/campaigns" className="wizard-page__breadcrumb-link">
                Campanhas
              </Link>
              <span className="wizard-page__breadcrumb-sep" aria-hidden="true">
                /
              </span>
              <span className="wizard-page__breadcrumb-current">
                Nova campanha
              </span>
            </nav>
            <h1 className="text-h2">Nova campanha</h1>
          </div>
        </header>

        <nav className="wizard-stepper" aria-label="Progresso da campanha">
          <p className="wizard-stepper__progress">
            Etapa {step + 1} de {stepTotal}
          </p>
          <ol className="wizard-stepper__track">
            {LEAD_WIZARD_STEPS.map((item, index) => {
              const done = index < step;
              const active = index === step;
              return (
                <li
                  key={item.id}
                  className={
                    active
                      ? 'wizard-stepper__step is-active'
                      : done
                        ? 'wizard-stepper__step is-done'
                        : 'wizard-stepper__step'
                  }
                >
                  <button
                    type="button"
                    className="wizard-stepper__button"
                    disabled={saving}
                    onClick={() => goToStep(index)}
                    aria-current={active ? 'step' : undefined}
                  >
                    <span className="wizard-stepper__dot" aria-hidden="true">
                      {done ? '✓' : index + 1}
                    </span>
                    <span className="wizard-stepper__label">{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <section className="card wizard-page__card">
          <div className="wizard-page__body">
            {loadingAssets ? (
              <p className="text-body">Carregando ativos...</p>
            ) : null}

            {!loadingAssets && step === 0 ? (
              <SetupStep
                state={state}
                pages={pages}
                adAccounts={adAccounts}
                fieldErrors={fieldErrors}
                onCampaignChange={(partial) => patchSection('campaign', partial)}
                onAudienceChange={(partial) => patchSection('audience', partial)}
              />
            ) : null}

            {!loadingAssets && step === 1 ? (
              <CreativeStep
                state={activeState}
                ads={ads}
                activeAdIndex={activeAdIndex}
                pages={pages}
                localForms={localForms}
                fieldErrors={fieldErrors}
                imagePreviewUrl={imagePreviewUrl}
                imageNeedsReselect={imageNeedsReselect}
                imageError={imageError}
                onAdChange={patchActiveAd}
                onAdSelect={setActiveAdIndex}
                onAdAdd={addAd}
                onAdDuplicate={duplicateAd}
                onAdRemove={removeAd}
                onFormChange={(partial) => patchSection('form', partial)}
                onImageSelect={handleImageSelect}
              />
            ) : null}

            {!loadingAssets && step === 2 ? (
              <ReviewStep
                state={{ ...state, ad: ads[0] }}
                ads={ads}
                pages={pages}
                localForms={localForms}
                imagePreviewUrl={imagePreviewUrls[ads[0]?.clientKey] || ''}
                issues={blockingIssues}
                onEditStep={goToStep}
              />
            ) : null}

            {error ? <p className="wizard-page__error">{error}</p> : null}
            {info ? <p className="wizard-page__info">{info}</p> : null}
          </div>
        </section>
      </div>

      <footer className="wizard-page__footer">
        <div className="wizard-page__footer-inner">
          <div className="wizard-page__footer-status">
            {savedFlash ? (
              <span className="wizard-saved">Alterações salvas ✓</span>
            ) : (
              <span className="wizard-page__footer-hint">Rascunho automático</span>
            )}
          </div>
          <div className="wizard-page__footer-actions">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={saving}
              onClick={() => navigate('/campaigns')}
            >
              Cancelar
            </button>
            {step > 0 ? (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={saving}
                onClick={goBackStep}
              >
                ← Voltar
              </button>
            ) : null}
            {!isLastStep ? (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={saving || loadingAssets}
                onClick={flushSaveDraft}
              >
                Salvar rascunho
              </button>
            ) : null}
            {!isLastStep ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={saving || loadingAssets}
                onClick={handleContinue}
              >
                {continueLabel}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                disabled={saving || loadingAssets || blockingIssues.length > 0}
                onClick={handlePublish}
              >
                {saving ? 'Publicando...' : 'Publicar campanha'}
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
