import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { metaApi } from '../../services/meta.api.js';
import { adsBuilderApi } from '../../services/adsBuilder.api.js';
import { formatBRL, formatMonthlyEstimate } from './campaignMoney.js';
import AgeRangeSlider from './steps/AgeRangeSlider.jsx';
import CampaignAdsCollection from './steps/CampaignAdsCollection.jsx';
import './CampaignWizard.css';

const STEPS = [
  { id: 'setup', label: 'Configuração' },
  { id: 'creative', label: 'Anúncio' },
  { id: 'review', label: 'Revisão' },
];

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

function createMessageAd(overrides = {}) {
  return {
    clientKey:
      overrides.clientKey ||
      globalThis.crypto?.randomUUID?.() ||
      `message-ad-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: overrides.name ?? 'Anúncio 1',
    messageChannel: overrides.messageChannel ?? 'WHATSAPP',
    title: overrides.title ?? 'Fale conosco',
    text: overrides.text ?? 'Envie uma mensagem e tire suas dúvidas agora.',
    imageBase64: overrides.imageBase64 ?? '',
    imageName: overrides.imageName ?? '',
  };
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
  const [ads, setAds] = useState(() => [createMessageAd()]);
  const [activeAdIndex, setActiveAdIndex] = useState(0);
  const idempotencyKeyRef = useRef(null);
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

  const pageName =
    pages.find((p) => p.pageId === form.pageId)?.name || form.pageId || 'Sua página';
  const selectedChannels = availableChannels.filter(
    (c) => form.messageChannels[c]
  );
  const activeAd = ads[activeAdIndex] || ads[0];

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
        const firstChannel = waOk ? 'WHATSAPP' : igOk ? 'INSTAGRAM' : null;
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
        if (firstChannel) {
          setAds((current) =>
            current.map((ad) => ({ ...ad, messageChannel: firstChannel }))
          );
        }

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

  useEffect(() => {
    idempotencyKeyRef.current = null;
  }, [form, ads]);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateAdField(key, value) {
    setAds((current) =>
      current.map((ad, index) =>
        index === activeAdIndex ? { ...ad, [key]: value } : ad
      )
    );
  }

  function toggleChannel(channel, checked) {
    const nextMessageChannels = {
      ...form.messageChannels,
      [channel]: checked,
    };
    const nextSelected = availableChannels.filter(
      (item) => nextMessageChannels[item]
    );

    setForm((current) => ({
      ...current,
      messageChannels: nextMessageChannels,
    }));

    if (nextSelected.length === 0) return;
    setAds((current) => {
      if (!checked) {
        const fallback = nextSelected[0];
        return current.map((ad) =>
          ad.messageChannel === channel
            ? { ...ad, messageChannel: fallback }
            : ad
        );
      }

      if (current.some((ad) => ad.messageChannel === channel)) return current;
      if (nextSelected.length === 1) {
        return current.map((ad) => ({ ...ad, messageChannel: channel }));
      }

      const source = current[activeAdIndex] || current[0];
      return [
        ...current,
        createMessageAd({
          ...source,
          clientKey: undefined,
          name: `Anúncio ${current.length + 1}`,
          messageChannel: channel,
        }),
      ];
    });
  }

  function addAd() {
    const next = [
      ...ads,
      createMessageAd({
        name: `Anúncio ${ads.length + 1}`,
        messageChannel: activeAd?.messageChannel || selectedChannels[0],
      }),
    ];
    setAds(next);
    setActiveAdIndex(next.length - 1);
  }

  function duplicateAd(index) {
    const source = ads[index];
    if (!source) return;
    const duplicate = createMessageAd({
      ...source,
      clientKey: undefined,
      name: `${source.name || `Anúncio ${index + 1}`} cópia`,
    });
    const next = [...ads, duplicate];
    setAds(next);
    setActiveAdIndex(next.length - 1);
  }

  function removeAd(index) {
    if (ads.length === 1) return;
    const removed = ads[index];
    const next = ads.filter((_, itemIndex) => itemIndex !== index);
    const channelWouldBeEmpty =
      removed?.messageChannel &&
      selectedChannels.includes(removed.messageChannel) &&
      !next.some((ad) => ad.messageChannel === removed.messageChannel);
    if (channelWouldBeEmpty) {
      setError(`Mantenha ao menos um anúncio no canal ${removed.messageChannel}.`);
      return;
    }
    setAds(next);
    if (activeAdIndex > index) setActiveAdIndex(activeAdIndex - 1);
    else if (activeAdIndex === index) {
      setActiveAdIndex(Math.min(index, next.length - 1));
    }
  }

  function goBackStep() {
    if (saving) return;
    setError('');
    if (step <= 0) {
      navigate('/campaigns');
      return;
    }
    setStep((s) => s - 1);
  }

  function goToStep(index) {
    if (saving) return;
    if (index < 0 || index >= STEPS.length) return;
    if (index > step) {
      for (let i = step; i < index; i += 1) {
        if (!validateStep(i)) {
          setStep(i);
          return;
        }
      }
    }
    setError('');
    setStep(index);
  }

  function validateStep(stepIndex) {
    if (stepIndex === 0) {
      if (form.name.trim().length < 3) {
        setError('Informe um nome com pelo menos 3 caracteres.');
        return false;
      }
      if (!form.adAccountId || !form.pageId) {
        setError('Selecione a página e a conta de anúncios.');
        return false;
      }
      if (!(Number(form.budget) > 0)) {
        setError('Informe um orçamento diário maior que zero.');
        return false;
      }
      if (availableChannels.length === 0) {
        setError('Nenhum canal de mensagem disponível.');
        return false;
      }
      if (selectedChannels.length === 0) {
        setError('Selecione ao menos um canal disponível.');
        return false;
      }
      if (
        selectedChannels.includes('WHATSAPP') &&
        !form.whatsappPhoneNumber.trim()
      ) {
        setError('Informe o número do WhatsApp.');
        return false;
      }
      if (!(Number(form.ageMin) >= 13 && Number(form.ageMax) <= 65)) {
        setError('A faixa de idade deve estar entre 13 e 65 anos.');
        return false;
      }
      if (Number(form.ageMin) > Number(form.ageMax)) {
        setError('A idade máxima deve ser maior ou igual à mínima.');
        return false;
      }
      return true;
    }
    if (stepIndex === 1) {
      for (const channel of selectedChannels) {
        if (!ads.some((ad) => ad.messageChannel === channel)) {
          setError(`Adicione ao menos um anúncio para o canal ${channel}.`);
          return false;
        }
      }
      for (let index = 0; index < ads.length; index += 1) {
        const ad = ads[index];
        const label = ad.name || `Anúncio ${index + 1}`;
        if (ad.name.trim().length < 2) {
          setActiveAdIndex(index);
          setError(`Informe o nome do anúncio ${index + 1}.`);
          return false;
        }
        if (!selectedChannels.includes(ad.messageChannel)) {
          setActiveAdIndex(index);
          setError(`Escolha um canal ativo para “${label}”.`);
          return false;
        }
        if (ad.title.trim().length < 2) {
          setActiveAdIndex(index);
          setError(`Informe o título de “${label}”.`);
          return false;
        }
        if (ad.text.trim().length < 2) {
          setActiveAdIndex(index);
          setError(`Escreva o texto de “${label}”.`);
          return false;
        }
        if (!ad.imageBase64) {
          setActiveAdIndex(index);
          setError(`Selecione uma imagem para “${label}”.`);
          return false;
        }
      }
      return true;
    }
    return true;
  }

  function handleContinue() {
    if (!validateStep(step)) return;
    setError('');
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function handleImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const base64 = await fileToBase64(file);
    setAds((current) =>
      current.map((ad, index) =>
        index === activeAdIndex
          ? { ...ad, imageBase64: base64, imageName: file.name }
          : ad
      )
    );
  }

  async function handleSubmit() {
    setSaving(true);
    setError('');
    setInfo('');
    try {
      const channels = availableChannels.filter(
        (c) => form.messageChannels[c]
      );

      if (channels.length === 0) {
        setError('Selecione ao menos um canal disponível.');
        setStep(0);
        setSaving(false);
        return;
      }

      const payload = {
        objective: 'MESSAGES',
        name: form.name.trim(),
        adAccountId: form.adAccountId,
        pageId: form.pageId,
        budget: Number(form.budget),
        messageChannels: channels,
        whatsappPhoneNumber: channels.includes('WHATSAPP')
          ? form.whatsappPhoneNumber.trim()
          : undefined,
        audience: {
          ageMin: Number(form.ageMin),
          ageMax: Number(form.ageMax),
          country: form.country || 'BR',
          city: form.city.trim() || undefined,
          bidAmount: Number(form.bidAmount) || 2,
        },
        ads: ads.map((ad) => ({
          clientKey: ad.clientKey,
          name: ad.name.trim(),
          messageChannel: ad.messageChannel,
          creative: {
            title: ad.title.trim(),
            text: ad.text.trim(),
            imageBase64: ad.imageBase64,
            imageName: ad.imageName || 'creative.jpg',
          },
        })),
      };
      idempotencyKeyRef.current ||=
        globalThis.crypto?.randomUUID?.() ||
        `messages-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const result = await adsBuilderApi.createFull(payload, {
        idempotencyKey: idempotencyKeyRef.current,
      });
      setInfo(
        `Campanha criada: ${result.campaign?.name} (${(result.channels || channels).join(' + ')})`
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
      if (/whatsapp|canal|instagram/i.test(String(apiMessage || ''))) setStep(0);
      else if (/lance|bid|idade|público/i.test(String(apiMessage || '')))
        setStep(0);
      else if (/imagem|criativo/i.test(String(apiMessage || ''))) setStep(1);
    } finally {
      setSaving(false);
    }
  }

  const isLastStep = step >= STEPS.length - 1;

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
                Receber mensagens
              </span>
            </nav>
            <h1 className="text-h2">Nova campanha</h1>
          </div>
        </header>

        <nav className="wizard-stepper" aria-label="Progresso da campanha">
          <p className="wizard-stepper__progress">
            Etapa {step + 1} de {STEPS.length}
          </p>
          <ol className="wizard-stepper__track">
            {STEPS.map((item, index) => {
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
              <div className="wizard-setup">
                <div>
                  <h2 className="wizard-step-title">Configure sua campanha</h2>
                </div>

                <div className="wizard-grid wizard-grid--tight">
                  <label className="field">
                    <span className="field-label">
                      Nome<span className="field-required">*</span>
                    </span>
                    <input
                      className="input"
                      value={form.name}
                      onChange={(e) => updateField('name', e.target.value)}
                      placeholder="Campanha Mensagens - Agosto"
                    />
                  </label>

                  <div className="wizard-section-label">
                    Onde o anúncio será publicado
                  </div>
                  <div className="wizard-assets-row">
                    <label className="field">
                      <span className="field-label">
                        Página do Facebook
                        <span className="field-required">*</span>
                      </span>
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
                      <span className="field-label">
                        Conta de anúncios
                        <span className="field-required">*</span>
                      </span>
                      <select
                        className="input"
                        value={form.adAccountId}
                        onChange={(e) =>
                          updateField('adAccountId', e.target.value)
                        }
                      >
                        <option value="">Selecione</option>
                        {adAccounts.map((a) => (
                          <option key={a.accountId} value={a.accountId}>
                            {a.name || a.accountId}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="wizard-budget-block">
                    <div className="wizard-section-label">Orçamento</div>
                    <label className="field">
                      <span className="field-label">
                        Quanto você quer investir por dia?
                        <span className="field-required">*</span>
                      </span>
                      <div className="wizard-budget-input">
                        <span>R$</span>
                        <input
                          className="input"
                          type="number"
                          min="1"
                          step="0.01"
                          value={form.budget}
                          onChange={(e) =>
                            updateField('budget', e.target.value)
                          }
                        />
                      </div>
                    </label>
                    <p className="wizard-hint wizard-hint--estimate">
                      ≈ {formatMonthlyEstimate(form.budget)} por mês
                    </p>
                    <p className="wizard-hint wizard-hint--meta">
                      A Meta pode distribuir seu orçamento de forma diferente
                      entre os dias para buscar melhores resultados.
                    </p>
                    <label className="field wizard-budget-bid">
                      <span className="field-label">
                        Limite de lance (opcional)
                      </span>
                      <div className="wizard-budget-input">
                        <span>R$</span>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.bidAmount}
                          onChange={(e) =>
                            updateField('bidAmount', e.target.value)
                          }
                        />
                      </div>
                      <span className="wizard-hint">
                        Defina um limite para o valor usado na disputa por novos
                        resultados.
                      </span>
                    </label>
                  </div>

                  <div className="wizard-section-label">
                    Canal de mensagens
                    <span className="field-required">*</span>
                  </div>
                  {availableChannels.length === 0 ? (
                    <p className="wizard-page__error">
                      Nenhum canal disponível. Em Conexão Meta, sincronize
                      WhatsApp (com número) e/ou Instagram vinculado à Page.
                    </p>
                  ) : (
                    <div className="field">
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
                          Marque um ou os dois. A Meta cria um conjunto por
                          canal.
                        </p>
                      ) : null}
                    </div>
                  )}

                  {canUseWhatsApp && form.messageChannels.WHATSAPP ? (
                    <label className="field">
                      <span className="field-label">
                        Número WhatsApp
                        <span className="field-required">*</span>
                      </span>
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
                            <option
                              key={w.businessAccountId}
                              value={w.phoneNumber}
                            >
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
                        .map((ig) =>
                          ig.username ? `@${ig.username}` : ig.instagramId
                        )
                        .join(', ')}
                    </p>
                  ) : null}

                  <div className="wizard-section-label">
                    Quem você quer alcançar?
                  </div>
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
                      placeholder="Curitiba"
                    />
                  </label>
                  <div className="field">
                    <span className="field-label">
                      Faixa de idade
                      <span className="field-required">*</span>
                    </span>
                    <AgeRangeSlider
                      ageMin={Number(form.ageMin)}
                      ageMax={Number(form.ageMax)}
                      onChange={({ ageMin, ageMax }) => {
                        updateField('ageMin', String(ageMin));
                        updateField('ageMax', String(ageMax));
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {!loadingAssets && step === 1 ? (
              <div className="wizard-creative wizard-creative--fit">
                <CampaignAdsCollection
                  ads={ads}
                  activeAdIndex={activeAdIndex}
                  onAdSelect={setActiveAdIndex}
                  onAdAdd={addAd}
                  onAdDuplicate={duplicateAd}
                  onAdRemove={removeAd}
                />
                <div className="wizard-creative__intro">
                  <h2 className="wizard-step-title">Crie seu anúncio</h2>
                  <p className="wizard-step-subtitle">
                    O que a pessoa vai ver antes de iniciar a conversa.
                  </p>
                </div>
                <div className="wizard-ad-layout wizard-ad-layout--stitch">
                  <section className="wizard-ad-col" aria-label="Anúncio">
                    <div className="wizard-ad-editor wizard-ad-editor--embedded">
                      <label className="field">
                        <span className="field-label">
                          Nome do anúncio<span className="field-required">*</span>
                        </span>
                        <input
                          className="input"
                          value={activeAd.name}
                          onChange={(e) => updateAdField('name', e.target.value)}
                        />
                      </label>
                      <label className="field">
                        <span className="field-label">
                          Canal<span className="field-required">*</span>
                        </span>
                        <select
                          className="input"
                          value={activeAd.messageChannel}
                          onChange={(e) =>
                            updateAdField('messageChannel', e.target.value)
                          }
                        >
                          {selectedChannels.map((channel) => (
                            <option key={channel} value={channel}>
                              {channel === 'WHATSAPP' ? 'WhatsApp' : 'Instagram'}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span className="field-label">
                          Título<span className="field-required">*</span>
                        </span>
                        <input
                          className="input"
                          value={activeAd.title}
                          onChange={(e) =>
                            updateAdField('title', e.target.value)
                          }
                        />
                      </label>
                      <label className="field">
                        <span className="field-label">
                          Texto principal
                          <span className="field-required">*</span>
                        </span>
                        <textarea
                          className="input wizard-textarea"
                          rows={3}
                          value={activeAd.text}
                          onChange={(e) =>
                            updateAdField('text', e.target.value)
                          }
                        />
                      </label>
                      <label className="field">
                        <span className="field-label">
                          Imagem<span className="field-required">*</span>
                        </span>
                        <div className="wizard-dropzone wizard-dropzone--compact">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                          />
                          <p>
                            {activeAd.imageName ||
                              'Arraste ou selecione uma imagem'}
                          </p>
                          <span>JPG ou PNG</span>
                        </div>
                      </label>
                    </div>
                  </section>
                  <aside className="wizard-preview-panel" aria-label="Prévia">
                    <div className="wizard-preview-panel__head">
                      <h3 className="wizard-preview-panel__title">Prévia</h3>
                    </div>
                    <div className="wizard-ad-preview wizard-ad-preview--panel">
                      <div className="wizard-ad-preview__head wizard-ad-preview__head--row">
                        <div
                          className="wizard-ad-preview__avatar"
                          aria-hidden="true"
                        />
                        <div className="wizard-ad-preview__identity">
                          <strong>{pageName}</strong>
                          <span>Patrocinado</span>
                        </div>
                      </div>
                      <p className="wizard-ad-preview__text">
                        {activeAd.text ||
                          'Seu texto principal aparece aqui.'}
                      </p>
                      <div className="wizard-ad-preview__media">
                        {activeAd.imageBase64 ? (
                          <img src={activeAd.imageBase64} alt="Prévia" />
                        ) : (
                          <div className="wizard-ad-preview__placeholder">
                            Sua imagem
                          </div>
                        )}
                      </div>
                      <div className="wizard-ad-preview__footer wizard-ad-preview__footer--panel">
                        <div className="wizard-ad-preview__cta-row">
                          <strong>{activeAd.title || 'Título'}</strong>
                          <span className="wizard-ad-preview__cta-label">
                            Enviar mensagem
                          </span>
                        </div>
                      </div>
                    </div>
                  </aside>
                </div>
              </div>
            ) : null}

            {!loadingAssets && step === 2 ? (
              <div className="wizard-review-layout">
                <div className="wizard-review-shell">
                  <header className="wizard-review-shell__head">
                    <h2 className="wizard-step-title">Revise e publique</h2>
                  </header>
                  <div className="wizard-review-columns">
                    <div className="wizard-review-stack">
                      <article className="wizard-review-card">
                        <div className="wizard-review-card__body">
                          <div className="wizard-review-card__eyebrow">
                            Campanha
                          </div>
                          <p className="wizard-review-card__title">
                            {form.name || '—'}
                          </p>
                          <p className="wizard-review-card__meta">{pageName}</p>
                          <p className="wizard-review-card__value">
                            {formatBRL(form.budget)}/dia · ≈{' '}
                            {formatMonthlyEstimate(form.budget)}/mês
                          </p>
                        </div>
                        <button
                          type="button"
                          className="btn btn-ghost wizard-review-card__edit"
                          onClick={() => goToStep(0)}
                        >
                          Editar
                        </button>
                      </article>

                      <article className="wizard-review-card">
                        <div className="wizard-review-card__body">
                          <div className="wizard-review-card__eyebrow">
                            Anúncios
                          </div>
                          <p className="wizard-review-card__title">
                            {ads.length}{' '}
                            {ads.length === 1 ? 'anúncio' : 'anúncios'}
                          </p>
                          <p className="wizard-review-card__meta">
                            {ads
                              .map((ad) => `${ad.name} · ${ad.messageChannel}`)
                              .join(' | ')}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="btn btn-ghost wizard-review-card__edit"
                          onClick={() => goToStep(1)}
                        >
                          Editar
                        </button>
                      </article>

                      <article className="wizard-review-card">
                        <div className="wizard-review-card__body">
                          <div className="wizard-review-card__eyebrow">
                            Canal
                          </div>
                          <p className="wizard-review-card__title">
                            {selectedChannels.join(' + ') || '—'}
                          </p>
                          {form.messageChannels.WHATSAPP ? (
                            <p className="wizard-review-card__meta">
                              {form.whatsappPhoneNumber}
                            </p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className="btn btn-ghost wizard-review-card__edit"
                          onClick={() => goToStep(0)}
                        >
                          Editar
                        </button>
                      </article>

                      <article className="wizard-review-card">
                        <div className="wizard-review-card__body">
                          <div className="wizard-review-card__eyebrow">
                            Público
                          </div>
                          <p className="wizard-review-card__title">
                            {form.city
                              ? `${form.city}, ${form.country}`
                              : form.country || 'Brasil'}
                          </p>
                          <p className="wizard-review-card__meta">
                            {form.ageMin}–{form.ageMax} anos
                          </p>
                        </div>
                        <button
                          type="button"
                          className="btn btn-ghost wizard-review-card__edit"
                          onClick={() => goToStep(0)}
                        >
                          Editar
                        </button>
                      </article>
                    </div>

                    <aside className="wizard-review-preview">
                      <div className="wizard-preview-label">
                        Prévia do anúncio
                      </div>
                      <div className="wizard-ad-preview wizard-ad-preview--review">
                        <div className="wizard-ad-preview__head wizard-ad-preview__head--row">
                          <div
                            className="wizard-ad-preview__avatar"
                            aria-hidden="true"
                          />
                          <div className="wizard-ad-preview__identity">
                            <strong>{pageName}</strong>
                            <span>Patrocinado</span>
                          </div>
                        </div>
                        <p className="wizard-ad-preview__text">
                          {activeAd.text}
                        </p>
                        <div className="wizard-ad-preview__media">
                          {activeAd.imageBase64 ? (
                            <img src={activeAd.imageBase64} alt="Prévia" />
                          ) : (
                            <div className="wizard-ad-preview__placeholder">
                              Sem imagem
                            </div>
                          )}
                        </div>
                        <div className="wizard-ad-preview__footer wizard-ad-preview__footer--panel">
                          <div className="wizard-ad-preview__cta-row">
                            <strong>{activeAd.title}</strong>
                            <span className="wizard-ad-preview__cta-label">
                              Enviar mensagem
                            </span>
                          </div>
                        </div>
                      </div>
                      <p className="wizard-hint wizard-review-preview__hint">
                        A campanha será criada pausada. Você ativa quando
                        estiver pronta.
                      </p>
                    </aside>
                  </div>
                </div>
              </div>
            ) : null}

            {error ? <p className="wizard-page__error">{error}</p> : null}
            {info ? <p className="wizard-page__info">{info}</p> : null}
          </div>
        </section>
      </div>

      <footer className="wizard-page__footer">
        <div className="wizard-page__footer-inner">
          <div className="wizard-page__footer-status">
            <span className="wizard-page__footer-hint">
              Sem rascunho automático neste objetivo
            </span>
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
                className="btn btn-primary"
                disabled={saving || loadingAssets}
                onClick={handleContinue}
              >
                {step === 0 ? 'Continuar configuração →' : 'Revisar campanha →'}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                disabled={saving || loadingAssets}
                onClick={handleSubmit}
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
