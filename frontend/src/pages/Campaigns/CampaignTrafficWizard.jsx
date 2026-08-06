import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { metaApi } from '../../services/meta.api.js';
import { adsBuilderApi } from '../../services/adsBuilder.api.js';
import './CampaignWizard.css';

const STEPS = ['Campanha', 'Destino', 'Público', 'Anúncio', 'Revisão'];

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function CampaignTrafficWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [pages, setPages] = useState([]);
  const [adAccounts, setAdAccounts] = useState([]);
  const [form, setForm] = useState({
    name: '',
    adAccountId: '',
    pageId: '',
    budget: '50',
    linkUrl: 'https://',
    ageMin: '25',
    ageMax: '55',
    country: 'BR',
    city: '',
    bidAmount: '2',
    creativeTitle: 'Saiba mais',
    creativeText: 'Acesse nosso site e confira a oferta.',
    cta: 'LEARN_MORE',
    imageBase64: '',
    imageName: '',
  });

  useEffect(() => {
    async function load() {
      setLoadingAssets(true);
      try {
        const assets = await metaApi.getAssets();
        const nextPages = assets.pages || [];
        const nextAccounts = assets.adAccounts || [];
        setPages(nextPages);
        setAdAccounts(nextAccounts);
        setForm((current) => ({
          ...current,
          pageId: current.pageId || nextPages[0]?.pageId || '',
          adAccountId: current.adAccountId || nextAccounts[0]?.accountId || '',
        }));
      } catch (err) {
        setError(
          err?.response?.data?.message ||
            'Conecte a Meta e sincronize ativos antes.'
        );
      } finally {
        setLoadingAssets(false);
      }
    }
    load();
  }, []);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function goBackStep() {
    if (saving) return;
    setError('');
    if (step <= 0) {
      navigate('/campaigns/new');
      return;
    }
    setStep((s) => s - 1);
  }

  function canGoNext() {
    if (step === 0) {
      return (
        form.name.trim().length >= 3 &&
        form.adAccountId &&
        form.pageId &&
        Number(form.budget) > 0
      );
    }
    if (step === 1) {
      try {
        const url = new URL(form.linkUrl);
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        return false;
      }
    }
    if (step === 2) return Number(form.ageMin) >= 13 && Number(form.ageMax) <= 65;
    if (step === 3) {
      return (
        form.creativeTitle.trim().length >= 2 &&
        form.creativeText.trim().length >= 2 &&
        Boolean(form.imageBase64)
      );
    }
    return true;
  }

  async function handleImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const base64 = await fileToBase64(file);
    setForm((current) => ({
      ...current,
      imageBase64: base64,
      imageName: file.name,
    }));
  }

  async function handleSubmit() {
    setSaving(true);
    setError('');
    setInfo('');
    try {
      const result = await adsBuilderApi.createFull({
        objective: 'TRAFFIC',
        name: form.name.trim(),
        adAccountId: form.adAccountId,
        pageId: form.pageId,
        budget: Number(form.budget),
        audience: {
          ageMin: Number(form.ageMin),
          ageMax: Number(form.ageMax),
          country: form.country || 'BR',
          city: form.city.trim() || undefined,
          bidAmount: Number(form.bidAmount) || 2,
        },
        creative: {
          title: form.creativeTitle.trim(),
          text: form.creativeText.trim(),
          cta: form.cta,
          linkUrl: form.linkUrl.trim(),
          imageBase64: form.imageBase64,
          imageName: form.imageName || 'creative.jpg',
        },
      });
      setInfo(`Campanha de tráfego criada: ${result.campaign?.name}`);
      setTimeout(() => navigate('/campaigns'), 1200);
    } catch (err) {
      const apiMessage = err?.response?.data?.message;
      const apiCode = err?.response?.data?.code;
      setError(
        apiMessage
          ? `${apiMessage}${apiCode ? ` (${apiCode})` : ''}`
          : 'Falha ao criar campanha de tráfego.'
      );
      if (/url|link|site/i.test(String(apiMessage || ''))) setStep(1);
      else if (/lance|bid|idade|público/i.test(String(apiMessage || ''))) setStep(2);
      else if (/imagem|criativo/i.test(String(apiMessage || ''))) setStep(3);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="wizard-page">
      <header className="wizard-page__header">
        <div>
          <h1 className="text-h2">Gerar tráfego</h1>
          <p className="text-subtitle wizard-page__subtitle">
            Leve o público para o seu website ou landing page.
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={goBackStep}>
          {step === 0 ? 'Objetivos' : 'Voltar'}
        </button>
      </header>

      <ol className="wizard-steps">
        {STEPS.map((label, index) => (
          <li key={label}>
            <button
              type="button"
              className={
                index === step
                  ? 'wizard-steps__item is-active'
                  : index < step
                    ? 'wizard-steps__item is-done'
                    : 'wizard-steps__item'
              }
              disabled={saving || index > step}
              onClick={() => index <= step && setStep(index)}
            >
              <span>{index + 1}</span>
              {label}
            </button>
          </li>
        ))}
      </ol>

      <section className="card wizard-page__card">
        {loadingAssets ? <p className="text-body">Carregando ativos...</p> : null}

        {!loadingAssets && step === 0 ? (
          <div className="wizard-grid">
            <label className="field">
              <span className="field-label">Nome da campanha</span>
              <input
                className="input"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">Conta de anúncio</span>
              <select
                className="input"
                value={form.adAccountId}
                onChange={(e) => updateField('adAccountId', e.target.value)}
              >
                <option value="">Selecione</option>
                {adAccounts.map((a) => (
                  <option key={a.accountId} value={a.accountId}>
                    {a.name || a.accountId}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Página Facebook</span>
              <select
                className="input"
                value={form.pageId}
                onChange={(e) => updateField('pageId', e.target.value)}
              >
                <option value="">Selecione</option>
                {pages.map((p) => (
                  <option key={p.pageId} value={p.pageId}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Orçamento diário (R$)</span>
              <input
                className="input"
                type="number"
                min="1"
                step="0.01"
                value={form.budget}
                onChange={(e) => updateField('budget', e.target.value)}
              />
            </label>
          </div>
        ) : null}

        {!loadingAssets && step === 1 ? (
          <div className="wizard-grid">
            <label className="field">
              <span className="field-label">URL do site</span>
              <input
                className="input"
                value={form.linkUrl}
                onChange={(e) => updateField('linkUrl', e.target.value)}
                placeholder="https://seusite.com/oferta"
              />
            </label>
          </div>
        ) : null}

        {!loadingAssets && step === 2 ? (
          <div className="wizard-grid">
            <label className="field">
              <span className="field-label">País</span>
              <input
                className="input"
                value={form.country}
                onChange={(e) => updateField('country', e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">Cidade (opcional)</span>
              <input
                className="input"
                value={form.city}
                onChange={(e) => updateField('city', e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">Idade mín.</span>
              <input
                className="input"
                type="number"
                value={form.ageMin}
                onChange={(e) => updateField('ageMin', e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">Idade máx.</span>
              <input
                className="input"
                type="number"
                value={form.ageMax}
                onChange={(e) => updateField('ageMax', e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">Limite de lance (R$)</span>
              <input
                className="input"
                type="number"
                step="0.01"
                value={form.bidAmount}
                onChange={(e) => updateField('bidAmount', e.target.value)}
              />
            </label>
          </div>
        ) : null}

        {!loadingAssets && step === 3 ? (
          <div className="wizard-grid">
            <label className="field">
              <span className="field-label">Título</span>
              <input
                className="input"
                value={form.creativeTitle}
                onChange={(e) => updateField('creativeTitle', e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">Texto</span>
              <textarea
                className="input wizard-textarea"
                value={form.creativeText}
                onChange={(e) => updateField('creativeText', e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">CTA</span>
              <select
                className="input"
                value={form.cta}
                onChange={(e) => updateField('cta', e.target.value)}
              >
                <option value="LEARN_MORE">LEARN_MORE</option>
                <option value="SHOP_NOW">SHOP_NOW</option>
                <option value="SIGN_UP">SIGN_UP</option>
                <option value="GET_OFFER">GET_OFFER</option>
              </select>
            </label>
            <label className="field">
              <span className="field-label">Imagem</span>
              <input type="file" accept="image/*" onChange={handleImageChange} />
            </label>
            {form.imageBase64 ? (
              <img className="wizard-preview" src={form.imageBase64} alt="" />
            ) : null}
          </div>
        ) : null}

        {!loadingAssets && step === 4 ? (
          <div className="wizard-review">
            <p>
              <strong>Campanha:</strong> {form.name} · R$ {form.budget}/dia
            </p>
            <p>
              <strong>Destino:</strong> {form.linkUrl}
            </p>
            <p>
              <strong>Público:</strong> {form.country} · {form.ageMin}-
              {form.ageMax}
            </p>
            <p className="wizard-hint">Criado como PAUSED na Meta.</p>
          </div>
        ) : null}

        {error ? <p className="wizard-page__error">{error}</p> : null}
        {info ? <p className="wizard-page__info">{info}</p> : null}

        <div className="wizard-actions">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={saving}
            onClick={goBackStep}
          >
            {step === 0 ? 'Objetivos' : 'Voltar'}
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canGoNext() || saving || loadingAssets}
              onClick={() => setStep((s) => s + 1)}
            >
              Continuar
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              disabled={saving}
              onClick={handleSubmit}
            >
              {saving ? 'Enviando...' : 'Criar campanha'}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
