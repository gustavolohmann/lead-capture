import { useEffect, useMemo, useRef, useState } from 'react';
import { campaignsApi } from '../../services/campaigns.api.js';
import { adsBuilderApi } from '../../services/adsBuilder.api.js';
import { metaApi } from '../../services/meta.api.js';
import { createAdState } from './leadsWizardState.js';
import { ctaUiToMeta } from './leadsWizardMappers.js';
import AdStep from './steps/AdStep.jsx';
import './CampaignWizard.css';
import './AddCampaignAdModal.css';

const TRAFFIC_CTA_OPTIONS = [
  { value: 'LEARN_MORE', label: 'Saiba mais' },
  { value: 'SHOP_NOW', label: 'Comprar agora' },
  { value: 'SIGN_UP', label: 'Cadastre-se' },
  { value: 'GET_OFFER', label: 'Obter oferta' },
];

function initialAd(objective) {
  return createAdState({
    name: 'Novo anúncio',
    primaryText:
      objective === 'MESSAGES'
        ? 'Envie uma mensagem e fale com nossa equipe.'
        : objective === 'TRAFFIC'
          ? 'Acesse nosso site e conheça a oferta.'
          : 'Preencha o formulário e fale com nossa equipe.',
    title:
      objective === 'MESSAGES'
        ? 'Fale conosco'
        : objective === 'TRAFFIC'
          ? 'Saiba mais'
          : 'Solicite um orçamento',
    cta: objective === 'TRAFFIC' ? 'LEARN_MORE' : 'get_quote',
  });
}

function parseTargeting(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value) || {};
  } catch {
    return {};
  }
}

function createIdempotencyKey() {
  return (
    globalThis.crypto?.randomUUID?.() ||
    `campaign-ad-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
  );
}

function isHttpUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AddCampaignAdModal({ campaign, onClose, onCreated }) {
  const objective = String(campaign?.objective || '').toUpperCase();
  const [ad, setAd] = useState(() => initialAd(objective));
  const [adSetId, setAdSetId] = useState('');
  const [pageId, setPageId] = useState('');
  const [leadFormId, setLeadFormId] = useState('');
  const [linkUrl, setLinkUrl] = useState('https://');
  const [whatsappPhoneNumber, setWhatsappPhoneNumber] = useState('');
  const [assets, setAssets] = useState({
    pages: [],
    whatsappAccounts: [],
  });
  const [leadForms, setLeadForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const idempotencyKeyRef = useRef(null);

  const adSets = campaign?.adSets || [];
  const selectedAdSet = useMemo(
    () => adSets.find((item) => String(item.id) === String(adSetId)) || null,
    [adSets, adSetId]
  );
  const targeting = useMemo(
    () => parseTargeting(selectedAdSet?.targeting),
    [selectedAdSet]
  );
  const messageChannel = String(targeting.messageChannel || '').toUpperCase();
  const lockedPageId = String(targeting.pageId || '');
  const availableLeadForms = useMemo(
    () =>
      leadForms.filter(
        (form) => !pageId || String(form.pageId) === String(pageId)
      ),
    [leadForms, pageId]
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [nextAssets, formsResponse] = await Promise.all([
          metaApi.getAssets(),
          objective === 'LEAD_GENERATION'
            ? adsBuilderApi.listLeadForms()
            : Promise.resolve({ forms: [] }),
        ]);
        if (cancelled) return;
        setAssets(nextAssets);
        setLeadForms(formsResponse.forms || []);

        const firstAdSet = adSets.find((item) => item.metaAdsetId) || null;
        const firstTargeting = parseTargeting(firstAdSet?.targeting);
        const nextPageId =
          firstTargeting.pageId || nextAssets.pages?.[0]?.pageId || '';
        setAdSetId(firstAdSet?.id ? String(firstAdSet.id) : '');
        setPageId(String(nextPageId));
        setLinkUrl(
          String(firstTargeting.websiteUrl || 'https://')
        );
        setWhatsappPhoneNumber(
          String(
            firstTargeting.whatsappPhoneNumber ||
              nextAssets.whatsappAccounts?.[0]?.phoneNumber ||
              ''
          )
        );
        const forms = formsResponse.forms || [];
        const preferredForm = forms.find(
          (form) =>
            String(form.id) === String(firstTargeting.leadFormId || '') &&
            String(form.pageId) === String(nextPageId)
        );
        const firstForm =
          preferredForm ||
          forms.find((form) => String(form.pageId) === String(nextPageId));
        setLeadFormId(firstForm?.id ? String(firstForm.id) : '');
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError?.response?.data?.message ||
              'Não foi possível carregar os ativos necessários.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [campaign?.id, objective]);

  function changed(callback) {
    idempotencyKeyRef.current = null;
    setError('');
    callback();
  }

  function patchAd(partial) {
    changed(() => setAd((current) => ({ ...current, ...partial })));
  }

  async function handleImageSelect(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFieldErrors((current) => ({
        ...current,
        image: 'Selecione uma imagem JPG ou PNG.',
      }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFieldErrors((current) => ({
        ...current,
        image: 'A imagem deve ter no máximo 5MB.',
      }));
      return;
    }
    try {
      const imageBase64 = await fileToBase64(file);
      changed(() => {
        setAd((current) => ({
          ...current,
          imageBase64,
          imageMeta: { name: file.name, size: file.size, type: file.type },
          hasImage: true,
        }));
        setFieldErrors((current) => ({ ...current, image: '' }));
      });
    } catch {
      setFieldErrors((current) => ({
        ...current,
        image: 'Não foi possível ler a imagem selecionada.',
      }));
    }
  }

  function selectAdSet(value) {
    changed(() => {
      setAdSetId(value);
      const next = adSets.find((item) => String(item.id) === String(value));
      const nextTargeting = parseTargeting(next?.targeting);
      if (nextTargeting.pageId) setPageId(String(nextTargeting.pageId));
      if (nextTargeting.websiteUrl) setLinkUrl(String(nextTargeting.websiteUrl));
      if (nextTargeting.whatsappPhoneNumber) {
        setWhatsappPhoneNumber(String(nextTargeting.whatsappPhoneNumber));
      }
      if (nextTargeting.leadFormId) {
        setLeadFormId(String(nextTargeting.leadFormId));
      }
    });
  }

  function validate() {
    const issues = {};
    if (!adSetId) issues.adSetId = 'Selecione um Ad Set.';
    if (!pageId) issues.pageId = 'Selecione uma Página.';
    if (!String(ad.name || '').trim()) issues.name = 'Informe o nome do anúncio.';
    if (String(ad.primaryText || '').trim().length < 2) {
      issues.primaryText = 'Informe o texto principal.';
    }
    if (String(ad.title || '').trim().length < 2) {
      issues.title = 'Informe o título.';
    }
    if (!ad.imageBase64) issues.image = 'Selecione uma imagem.';
    if (objective === 'LEAD_GENERATION') {
      if (!leadFormId) issues.leadFormId = 'Selecione um formulário Meta.';
      if (!isHttpUrl(linkUrl)) issues.linkUrl = 'Informe uma URL válida.';
    }
    if (objective === 'TRAFFIC' && !isHttpUrl(linkUrl)) {
      issues.linkUrl = 'Informe uma URL válida.';
    }
    if (objective === 'MESSAGES' && messageChannel === 'WHATSAPP') {
      if (!whatsappPhoneNumber) {
        issues.whatsappPhoneNumber = 'Selecione um número do WhatsApp.';
      }
    }
    setFieldErrors(issues);
    return Object.keys(issues).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setError('');
    try {
      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current = createIdempotencyKey();
      }
      const payload = {
        adSetId: Number(adSetId),
        pageId,
        name: String(ad.name).trim(),
        ...(objective === 'LEAD_GENERATION'
          ? { leadFormId: Number(leadFormId) }
          : {}),
        ...(objective === 'MESSAGES' && messageChannel === 'WHATSAPP'
          ? { whatsappPhoneNumber }
          : {}),
        creative: {
          title: String(ad.title).trim(),
          text: String(ad.primaryText).trim(),
          description: String(ad.description || '').trim() || undefined,
          imageBase64: ad.imageBase64,
          imageName: ad.imageMeta?.name || 'creative.jpg',
          ...(objective !== 'MESSAGES'
            ? {
                cta:
                  objective === 'LEAD_GENERATION'
                    ? ctaUiToMeta(ad.cta)
                    : ad.cta,
              }
            : {}),
          ...(objective === 'LEAD_GENERATION' || objective === 'TRAFFIC'
            ? { linkUrl: String(linkUrl).trim() }
            : {}),
        },
      };
      const result = await campaignsApi.addAd(campaign.id, payload, {
        idempotencyKey: idempotencyKeyRef.current,
      });
      onCreated(result.ad);
    } catch (submitError) {
      setError(
        submitError?.response?.data?.message ||
          'Não foi possível criar o anúncio. Seus dados foram preservados.'
      );
    } finally {
      setSaving(false);
    }
  }

  const ctaOptions =
    objective === 'TRAFFIC' ? TRAFFIC_CTA_OPTIONS : undefined;

  return (
    <div className="campaign-ad-modal" role="presentation">
      <button
        type="button"
        className="campaign-ad-modal__backdrop"
        aria-label="Fechar"
        disabled={saving}
        onClick={onClose}
      />
      <form
        className="campaign-ad-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-campaign-ad-title"
        onSubmit={handleSubmit}
      >
        <header className="campaign-ad-modal__header">
          <div>
            <h2 id="add-campaign-ad-title">Adicionar anúncio</h2>
            <p>{campaign.name}</p>
          </div>
          <button
            type="button"
            className="campaign-ad-modal__close"
            aria-label="Fechar"
            disabled={saving}
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="campaign-ad-modal__body">
          {loading ? <p className="text-body">Carregando ativos...</p> : null}
          {!loading ? (
            <>
              <div className="campaign-ad-modal__context">
                <label className={`field${fieldErrors.adSetId ? ' is-invalid' : ''}`}>
                  <span className="field-label">Ad Set<span className="field-required">*</span></span>
                  <select
                    className="input"
                    value={adSetId}
                    onChange={(event) => selectAdSet(event.target.value)}
                  >
                    <option value="">Selecione</option>
                    {adSets.filter((item) => item.metaAdsetId).map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                  {fieldErrors.adSetId ? <span className="field-error">{fieldErrors.adSetId}</span> : null}
                </label>

                <label className={`field${fieldErrors.pageId ? ' is-invalid' : ''}`}>
                  <span className="field-label">Página<span className="field-required">*</span></span>
                  <select
                    className="input"
                    value={pageId}
                    disabled={Boolean(lockedPageId)}
                    onChange={(event) => changed(() => setPageId(event.target.value))}
                  >
                    <option value="">Selecione</option>
                    {(assets.pages || []).map((page) => (
                      <option key={page.pageId} value={page.pageId}>{page.name}</option>
                    ))}
                  </select>
                  {fieldErrors.pageId ? <span className="field-error">{fieldErrors.pageId}</span> : null}
                </label>

                {objective === 'LEAD_GENERATION' ? (
                  <label className={`field${fieldErrors.leadFormId ? ' is-invalid' : ''}`}>
                    <span className="field-label">Formulário Meta<span className="field-required">*</span></span>
                    <select
                      className="input"
                      value={leadFormId}
                      onChange={(event) => changed(() => setLeadFormId(event.target.value))}
                    >
                      <option value="">Selecione</option>
                      {availableLeadForms.map((form) => (
                        <option key={form.id} value={form.id}>{form.name}</option>
                      ))}
                    </select>
                    {fieldErrors.leadFormId ? <span className="field-error">{fieldErrors.leadFormId}</span> : null}
                  </label>
                ) : null}

                {objective === 'MESSAGES' ? (
                  <div className="campaign-ad-modal__channel">
                    <span>Canal do Ad Set</span>
                    <strong>{messageChannel === 'WHATSAPP' ? 'WhatsApp' : messageChannel === 'INSTAGRAM' ? 'Instagram' : 'Não identificado'}</strong>
                  </div>
                ) : null}

                {objective === 'MESSAGES' && messageChannel === 'WHATSAPP' ? (
                  <label className={`field${fieldErrors.whatsappPhoneNumber ? ' is-invalid' : ''}`}>
                    <span className="field-label">WhatsApp<span className="field-required">*</span></span>
                    <select
                      className="input"
                      value={whatsappPhoneNumber}
                      onChange={(event) => changed(() => setWhatsappPhoneNumber(event.target.value))}
                    >
                      <option value="">Selecione</option>
                      {(assets.whatsappAccounts || []).map((account) => (
                        <option key={account.id} value={account.phoneNumber}>{account.phoneNumber}</option>
                      ))}
                    </select>
                    {fieldErrors.whatsappPhoneNumber ? <span className="field-error">{fieldErrors.whatsappPhoneNumber}</span> : null}
                  </label>
                ) : null}
              </div>

              <AdStep
                state={{ ad }}
                imagePreviewUrl={ad.imageBase64 || ''}
                imageNeedsReselect={false}
                imageError={fieldErrors.image || ''}
                fieldErrors={fieldErrors}
                onChange={patchAd}
                onImageSelect={handleImageSelect}
                showPreview={false}
                embedded
                ctaOptions={ctaOptions}
                showCta={objective !== 'MESSAGES'}
              />

              {objective === 'LEAD_GENERATION' || objective === 'TRAFFIC' ? (
                <label className={`field${fieldErrors.linkUrl ? ' is-invalid' : ''}`}>
                  <span className="field-label">URL de destino<span className="field-required">*</span></span>
                  <input
                    className="input"
                    type="url"
                    value={linkUrl}
                    onChange={(event) => changed(() => setLinkUrl(event.target.value))}
                    placeholder="https://exemplo.com"
                  />
                  {fieldErrors.linkUrl ? <span className="field-error">{fieldErrors.linkUrl}</span> : null}
                </label>
              ) : null}
            </>
          ) : null}

          {error ? <p className="campaigns-page__error" role="alert">{error}</p> : null}
        </div>

        <footer className="campaign-ad-modal__footer">
          <button type="button" className="btn btn-secondary" disabled={saving} onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || loading || adSets.length === 0}>
            {saving ? 'Criando anúncio...' : 'Criar anúncio'}
          </button>
        </footer>
      </form>
    </div>
  );
}
