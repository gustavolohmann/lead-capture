import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { metaApi } from '../../services/meta.api.js';
import { adsBuilderApi } from '../../services/adsBuilder.api.js';
import './CampaignWizard.css';

const STEPS = ['Campanha', 'Canal', 'Público', 'Anúncio', 'Revisão'];

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function hasWhatsAppNumber(accounts = []) {
  return accounts.some((w) => Boolean(w.phoneNumber));
}

export default function CampaignMessagesWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [pages, setPages] = useState([]);
  const [adAccounts, setAdAccounts] = useState([]);
  const [whatsappAccounts, setWhatsappAccounts] = useState([]);
  const [instagramAccounts, setInstagramAccounts] = useState([]);
  const [form, setForm] = useState({
    name: '',
    adAccountId: '',
    pageId: '',
    budget: '50',
    messageChannels: { WHATSAPP: false, INSTAGRAM: false },
    whatsappPhoneNumber: '',
    ageMin: '25',
    ageMax: '55',
    country: 'BR',
    city: '',
    bidAmount: '2',
    creativeTitle: 'Fale conosco',
    creativeText: 'Envie uma mensagem e tire suas dúvidas agora.',
    imageBase64: '',
    imageName: '',
  });

  const canUseWhatsApp = useMemo(
    () => hasWhatsAppNumber(whatsappAccounts),
    [whatsappAccounts]
  );
  const canUseInstagram = useMemo(
    () => instagramAccounts.length > 0,
    [instagramAccounts]
  );
  const availableChannels = useMemo(() => {
    const list = [];
    if (canUseWhatsApp) list.push('WHATSAPP');
    if (canUseInstagram) list.push('INSTAGRAM');
    return list;
  }, [canUseWhatsApp, canUseInstagram]);

  useEffect(() => {
    async function load() {
      setLoadingAssets(true);
      try {
        const assets = await metaApi.getAssets();
        const nextPages = assets.pages || [];
        const nextAccounts = assets.adAccounts || [];
        const nextWa = assets.whatsappAccounts || [];
        const nextIg = assets.instagramAccounts || [];
        const waOk = hasWhatsAppNumber(nextWa);
        const igOk = nextIg.length > 0;

        setPages(nextPages);
        setAdAccounts(nextAccounts);
        setWhatsappAccounts(nextWa);
        setInstagramAccounts(nextIg);
        setForm((current) => ({
          ...current,
          pageId: current.pageId || nextPages[0]?.pageId || '',
          adAccountId: current.adAccountId || nextAccounts[0]?.accountId || '',
          whatsappPhoneNumber:
            current.whatsappPhoneNumber ||
            nextWa.find((w) => w.phoneNumber)?.phoneNumber ||
            '',
          messageChannels: {
            WHATSAPP: waOk,
            INSTAGRAM: igOk && !waOk ? true : false,
          },
        }));

        if (!waOk && !igOk) {
          setError(
            'Nenhum canal de mensagem disponível. Sincronize WhatsApp e/ou Instagram em Conexão Meta.'
          );
        }
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

  function toggleChannel(channel, checked) {
    setForm((current) => {
      const next = {
        ...current.messageChannels,
        [channel]: checked,
      };
      // Se desmarcar o último canal disponível, não permite ficar zerado
      // se ainda houver outro disponível — o Continuar valida.
      return { ...current, messageChannels: next };
    });
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
      if (availableChannels.length === 0) return false;
      const selected = availableChannels.filter(
        (c) => form.messageChannels[c]
      );
      if (selected.length === 0) return false;
      if (selected.includes('WHATSAPP')) {
        return Boolean(form.whatsappPhoneNumber.trim());
      }
      return true;
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
      const selectedChannels = availableChannels.filter(
        (c) => form.messageChannels[c]
      );

      if (selectedChannels.length === 0) {
        setError('Selecione ao menos um canal disponível.');
        setStep(1);
        setSaving(false);
        return;
      }

      const result = await adsBuilderApi.createFull({
        objective: 'MESSAGES',
        name: form.name.trim(),
        adAccountId: form.adAccountId,
        pageId: form.pageId,
        budget: Number(form.budget),
        messageChannels: selectedChannels,
        whatsappPhoneNumber: selectedChannels.includes('WHATSAPP')
          ? form.whatsappPhoneNumber.trim()
          : undefined,
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
          imageBase64: form.imageBase64,
          imageName: form.imageName || 'creative.jpg',
        },
      });
      setInfo(
        `Campanha criada: ${result.campaign?.name} (${(result.channels || selectedChannels).join(' + ')})`
      );
      setTimeout(() => navigate('/campaigns'), 1200);
    } catch (err) {
      const apiMessage = err?.response?.data?.message;
      const apiCode = err?.response?.data?.code;
      setError(
        apiMessage
          ? `${apiMessage}${apiCode ? ` (${apiCode})` : ''}`
          : 'Falha ao criar campanha de mensagens.'
      );
      if (/whatsapp|canal|instagram/i.test(String(apiMessage || ''))) setStep(1);
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
          <h1 className="text-h2">Receber mensagens</h1>
          <p className="text-subtitle wizard-page__subtitle">
            WhatsApp ou Instagram Direct — conversa direta com o lead.
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
            {availableChannels.length === 0 ? (
              <p className="wizard-page__error">
                Nenhum canal disponível. Em Conexão Meta, sincronize WhatsApp
                (com número) e/ou Instagram vinculado à Page.
              </p>
            ) : (
              <div className="field">
                <span className="field-label">
                  {availableChannels.length === 1
                    ? 'Canal disponível'
                    : 'Canais (pode marcar os dois)'}
                </span>
                <div className="wizard-checks">
                  {canUseWhatsApp ? (
                    <label className="wizard-check">
                      <input
                        type="checkbox"
                        checked={Boolean(form.messageChannels.WHATSAPP)}
                        onChange={(e) =>
                          toggleChannel('WHATSAPP', e.target.checked)
                        }
                      />
                      WhatsApp
                    </label>
                  ) : null}
                  {canUseInstagram ? (
                    <label className="wizard-check">
                      <input
                        type="checkbox"
                        checked={Boolean(form.messageChannels.INSTAGRAM)}
                        onChange={(e) =>
                          toggleChannel('INSTAGRAM', e.target.checked)
                        }
                      />
                      Instagram Direct
                    </label>
                  ) : null}
                </div>
                {availableChannels.length > 1 ? (
                  <p className="wizard-hint">
                    Marque um ou os dois. A Meta cria um conjunto por canal.
                  </p>
                ) : null}
                {!canUseInstagram ? (
                  <p className="wizard-hint">
                    Instagram não aparece porque não há conta sincronizada nesta
                    empresa.
                  </p>
                ) : null}
                {!canUseWhatsApp ? (
                  <p className="wizard-hint">
                    WhatsApp não aparece porque não há número sincronizado.
                  </p>
                ) : null}
              </div>
            )}
            {canUseWhatsApp && form.messageChannels.WHATSAPP ? (
              <label className="field">
                <span className="field-label">Número WhatsApp</span>
                <select
                  className="input"
                  value={form.whatsappPhoneNumber}
                  onChange={(e) =>
                    updateField('whatsappPhoneNumber', e.target.value)
                  }
                >
                  <option value="">Selecione</option>
                  {whatsappAccounts
                    .filter((w) => w.phoneNumber)
                    .map((w) => (
                      <option key={w.businessAccountId} value={w.phoneNumber}>
                        {w.phoneNumber}
                      </option>
                    ))}
                </select>
                <input
                  className="input"
                  style={{ marginTop: 8 }}
                  placeholder="+55..."
                  value={form.whatsappPhoneNumber}
                  onChange={(e) =>
                    updateField('whatsappPhoneNumber', e.target.value)
                  }
                />
              </label>
            ) : null}
            {canUseInstagram && form.messageChannels.INSTAGRAM ? (
              <p className="wizard-hint">
                Instagram:{' '}
                {instagramAccounts
                  .map((ig) => (ig.username ? `@${ig.username}` : ig.instagramId))
                  .join(', ')}
              </p>
            ) : null}
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
              <strong>Canais:</strong>{' '}
              {availableChannels
                .filter((c) => form.messageChannels[c])
                .join(' + ') || '—'}
              {form.messageChannels.WHATSAPP
                ? ` · ${form.whatsappPhoneNumber}`
                : ''}
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
