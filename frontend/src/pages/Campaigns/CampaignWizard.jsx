import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { metaApi } from '../../services/meta.api.js';
import { adsBuilderApi } from '../../services/adsBuilder.api.js';
import './CampaignWizard.css';

const STEPS = [
  'Campanha',
  'Formulário',
  'Público',
  'Anúncio',
  'Revisão',
];

const QUESTION_TYPES = [
  { value: 'FULL_NAME', label: 'Nome completo', needsLabel: false },
  { value: 'EMAIL', label: 'Email', needsLabel: false },
  { value: 'PHONE', label: 'Telefone', needsLabel: false },
  { value: 'TEXT', label: 'Texto', needsLabel: true },
  { value: 'TEXTAREA', label: 'Texto longo', needsLabel: true },
  { value: 'NUMBER', label: 'Número', needsLabel: true },
  { value: 'DATE', label: 'Data', needsLabel: false },
  {
    value: 'SELECT',
    label: 'Lista (SELECT)',
    needsLabel: true,
    needsOptions: true,
  },
  {
    value: 'RADIO',
    label: 'Opção única (RADIO)',
    needsLabel: true,
    needsOptions: true,
  },
  {
    value: 'CHECKBOX',
    label: 'Múltipla (CHECKBOX)',
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

const OPTION_TYPES = new Set(['SELECT', 'RADIO', 'CHECKBOX']);
const LABEL_TYPES = new Set(
  QUESTION_TYPES.filter((t) => t.needsLabel).map((t) => t.value)
);

function questionTypeMeta(type) {
  return QUESTION_TYPES.find((t) => t.value === type) || QUESTION_TYPES[3];
}

function createEmptyQuestion(type = 'TEXT') {
  const meta = questionTypeMeta(type);
  return {
    type,
    label: meta.needsLabel ? '' : meta.label,
    optionsText: '',
  };
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

const EMPTY_FORM = {
  name: '',
  adAccountId: '',
  pageId: '',
  budget: '50',
  formTitle: 'Solicite orçamento',
  questions: [
    createEmptyQuestion('FULL_NAME'),
    createEmptyQuestion('EMAIL'),
    createEmptyQuestion('PHONE'),
    {
      type: 'TEXT',
      label: 'Qual serviço deseja?',
      optionsText: '',
    },
  ],
  privacyPolicyUrl: 'https://example.com/privacidade',
  followUpActionUrl: 'https://example.com/obrigado',
  ageMin: '25',
  ageMax: '55',
  country: 'BR',
  city: '',
  bidAmount: '2',
  creativeTitle: 'Solicite orçamento',
  creativeText: 'Quer aumentar suas vendas? Receba uma avaliação gratuita.',
  creativeDescription: '',
  cta: 'SIGN_UP',
  imageBase64: '',
  imageName: '',
};

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function CampaignWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [pages, setPages] = useState([]);
  const [adAccounts, setAdAccounts] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    async function load() {
      setLoadingAssets(true);
      setError('');
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
            'Conecte a Meta e sincronize ativos antes de criar a campanha.'
        );
      } finally {
        setLoadingAssets(false);
      }
    }
    load();
  }, []);

  const questionsSummary = useMemo(() => {
    return form.questions.map((q) => {
      const typeLabel = questionTypeMeta(q.type).label;
      if (LABEL_TYPES.has(q.type) && q.label?.trim()) {
        return `${q.label.trim()} (${typeLabel})`;
      }
      return typeLabel;
    });
  }, [form.questions]);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateQuestion(index, patch) {
    setForm((current) => {
      const next = current.questions.map((question, i) => {
        if (i !== index) return question;
        const merged = { ...question, ...patch };
        if (patch.type) {
          const meta = questionTypeMeta(patch.type);
          if (!meta.needsLabel) {
            merged.label = meta.label;
          } else if (!LABEL_TYPES.has(question.type)) {
            merged.label = '';
          }
          if (!OPTION_TYPES.has(patch.type)) {
            merged.optionsText = '';
          }
        }
        return merged;
      });
      return { ...current, questions: next };
    });
  }

  function moveQuestion(index, delta) {
    setForm((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.questions.length) return current;
      const next = [...current.questions];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return { ...current, questions: next };
    });
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
      return (
        form.formTitle.trim().length >= 3 &&
        form.questions.length > 0 &&
        form.questions.length <= 15 &&
        form.questions.every(isQuestionValid) &&
        String(form.privacyPolicyUrl).startsWith('http') &&
        String(form.followUpActionUrl).startsWith('http')
      );
    }
    if (step === 2) {
      return Number(form.ageMin) >= 13 && Number(form.ageMax) <= 65;
    }
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
    if (!file.type.startsWith('image/')) {
      setError('Selecione uma imagem válida.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Imagem deve ter no máximo 5MB.');
      return;
    }
    setError('');
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
      const payload = {
        name: form.name.trim(),
        objective: 'LEAD_GENERATION',
        adAccountId: form.adAccountId,
        pageId: form.pageId,
        budget: Number(form.budget),
        form: {
          title: form.formTitle.trim(),
          questions: form.questions.map((q) => ({
            type: q.type,
            label: String(q.label || '').trim() || undefined,
            options: OPTION_TYPES.has(q.type)
              ? String(q.optionsText || '')
                  .split(/\r?\n/)
                  .map((line) => line.trim())
                  .filter(Boolean)
              : undefined,
          })),
          privacyPolicyUrl: form.privacyPolicyUrl.trim(),
          followUpActionUrl:
            form.followUpActionUrl.trim() || form.privacyPolicyUrl.trim(),
        },
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
          description: form.creativeDescription.trim() || undefined,
          cta: form.cta,
          imageBase64: form.imageBase64,
          imageName: form.imageName || 'creative.jpg',
        },
      };

      const result = await adsBuilderApi.createFull(payload);
      setInfo(
        `Campanha completa criada: ${result.campaign?.name} (form ${result.form?.formId})`
      );
      setTimeout(() => navigate('/campaigns'), 1200);
    } catch (err) {
      const apiMessage = err?.response?.data?.message;
      const apiCode = err?.response?.data?.code;
      setError(
        apiMessage
          ? `${apiMessage}${apiCode ? ` (${apiCode})` : ''}`
          : 'Falha ao criar campanha completa.'
      );

      if (
        apiCode === 'META_LEAD_FORM_NAME_EXISTS' ||
        /nome do formulário já existe/i.test(String(apiMessage || ''))
      ) {
        setStep(1);
      } else if (
        /privacidade|FollowUp|follow.up|formulário|form|pergunta/i.test(
          String(apiMessage || '')
        )
      ) {
        setStep(1);
      } else if (/imagem|creative|criativo|cta/i.test(String(apiMessage || ''))) {
        setStep(3);
      } else if (
        /lance|bid|público|targeting|idade|age/i.test(String(apiMessage || ''))
      ) {
        setStep(2);
      } else if (
        /campanha|budget|orçamento|página|page|ad account/i.test(
          String(apiMessage || '')
        )
      ) {
        setStep(0);
      }
    } finally {
      setSaving(false);
    }
  }

  function goBackStep() {
    if (saving) return;
    setError('');
    setInfo('');
    if (step <= 0) {
      navigate('/campaigns/new');
      return;
    }
    setStep((current) => current - 1);
  }

  function goToStep(index) {
    if (saving) return;
    if (index < 0 || index > step) return;
    setError('');
    setInfo('');
    setStep(index);
  }

  return (
    <div className="wizard-page">
      <header className="wizard-page__header">
        <div>
          <h1 className="text-h2">Criar campanha Lead Ads</h1>
          <p className="text-subtitle wizard-page__subtitle">
            Formulário, público e anúncio — tudo no seu painel, sem Facebook Ads.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={saving}
          onClick={goBackStep}
        >
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
              onClick={() => goToStep(index)}
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
                placeholder="Campanha Barbearia"
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
                {adAccounts.map((account) => (
                  <option key={account.accountId} value={account.accountId}>
                    {account.name || account.accountId}
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
                {pages.map((page) => (
                  <option key={page.pageId} value={page.pageId}>
                    {page.name}
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
            <p className="wizard-hint">
              Objetivo fixo: <strong>LEAD_GENERATION</strong> (OUTCOME_LEADS)
            </p>
          </div>
        ) : null}

        {!loadingAssets && step === 1 ? (
          <div className="wizard-grid">
            <label className="field">
              <span className="field-label">Título do formulário</span>
              <input
                className="input"
                value={form.formTitle}
                onChange={(e) => updateField('formTitle', e.target.value)}
              />
            </label>

            <div className="field">
              <div className="wizard-questions-header">
                <span className="field-label">Campos / perguntas</span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={form.questions.length >= 15}
                  onClick={() =>
                    updateField('questions', [
                      ...form.questions,
                      createEmptyQuestion('TEXT'),
                    ])
                  }
                >
                  + Adicionar
                </button>
              </div>
              <p className="wizard-hint" style={{ marginBottom: 8 }}>
                Mesmos tipos do FormBuilder. Limite Meta: 15 campos.
              </p>
              <div className="wizard-questions">
                {form.questions.map((question, index) => {
                  const needsLabel = LABEL_TYPES.has(question.type);
                  const needsOptions = OPTION_TYPES.has(question.type);
                  return (
                    <div key={index} className="wizard-question-card">
                      <div className="wizard-question-row">
                        <select
                          className="input wizard-question-type"
                          value={question.type}
                          onChange={(e) =>
                            updateQuestion(index, { type: e.target.value })
                          }
                        >
                          {QUESTION_TYPES.map((type) => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                        {needsLabel ? (
                          <input
                            className="input"
                            value={question.label}
                            onChange={(e) =>
                              updateQuestion(index, { label: e.target.value })
                            }
                            placeholder={`Pergunta ${index + 1}`}
                          />
                        ) : (
                          <span className="wizard-question-fixed">
                            {questionTypeMeta(question.type).label}
                          </span>
                        )}
                      </div>
                      {needsOptions ? (
                        <label className="field" style={{ marginTop: 8 }}>
                          <span className="field-label">
                            Opções (uma por linha, mín. 2)
                          </span>
                          <textarea
                            className="input wizard-textarea"
                            value={question.optionsText}
                            onChange={(e) =>
                              updateQuestion(index, {
                                optionsText: e.target.value,
                              })
                            }
                            placeholder={'Consulta\nCirurgia\nRetorno'}
                            rows={3}
                          />
                        </label>
                      ) : null}
                      <div className="wizard-question-actions">
                        <button
                          type="button"
                          className="btn btn-ghost"
                          disabled={index === 0}
                          onClick={() => moveQuestion(index, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          disabled={index === form.questions.length - 1}
                          onClick={() => moveQuestion(index, 1)}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          disabled={form.questions.length <= 1}
                          onClick={() =>
                            updateField(
                              'questions',
                              form.questions.filter((_, i) => i !== index)
                            )
                          }
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <label className="field">
              <span className="field-label">URL política de privacidade</span>
              <input
                className="input"
                value={form.privacyPolicyUrl}
                onChange={(e) => updateField('privacyPolicyUrl', e.target.value)}
                placeholder="https://seusite.com/privacidade"
              />
            </label>
            <label className="field">
              <span className="field-label">URL pós-envio (Follow-up)</span>
              <input
                className="input"
                value={form.followUpActionUrl}
                onChange={(e) =>
                  updateField('followUpActionUrl', e.target.value)
                }
                placeholder="https://seusite.com/obrigado"
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
              <span className="field-label">Cidade (opcional, referência)</span>
              <input
                className="input"
                value={form.city}
                onChange={(e) => updateField('city', e.target.value)}
                placeholder="Curitiba"
              />
            </label>
            <label className="field">
              <span className="field-label">Idade mínima</span>
              <input
                className="input"
                type="number"
                min="13"
                max="65"
                value={form.ageMin}
                onChange={(e) => updateField('ageMin', e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">Idade máxima</span>
              <input
                className="input"
                type="number"
                min="13"
                max="65"
                value={form.ageMax}
                onChange={(e) => updateField('ageMax', e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">Limite de lance (R$)</span>
              <input
                className="input"
                type="number"
                min="0.5"
                step="0.01"
                value={form.bidAmount}
                onChange={(e) => updateField('bidAmount', e.target.value)}
              />
            </label>
            <p className="wizard-hint">
              Interesses avançados (IDs Meta) entram numa próxima iteração.
              Targeting atual: país + idade. Lance = teto por resultado (Lead).
            </p>
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
              <span className="field-label">Texto principal</span>
              <textarea
                className="input wizard-textarea"
                value={form.creativeText}
                onChange={(e) => updateField('creativeText', e.target.value)}
                rows={4}
              />
            </label>
            <label className="field">
              <span className="field-label">Descrição (opcional)</span>
              <input
                className="input"
                value={form.creativeDescription}
                onChange={(e) =>
                  updateField('creativeDescription', e.target.value)
                }
              />
            </label>
            <label className="field">
              <span className="field-label">CTA</span>
              <select
                className="input"
                value={form.cta}
                onChange={(e) => updateField('cta', e.target.value)}
              >
                <option value="SIGN_UP">SIGN_UP</option>
                <option value="GET_QUOTE">GET_QUOTE</option>
                <option value="LEARN_MORE">LEARN_MORE</option>
                <option value="APPLY_NOW">APPLY_NOW</option>
              </select>
            </label>
            <label className="field">
              <span className="field-label">Imagem do anúncio</span>
              <input
                className="input"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
              />
            </label>
            {form.imageBase64 ? (
              <img
                className="wizard-preview"
                src={form.imageBase64}
                alt="Prévia do criativo"
              />
            ) : null}
          </div>
        ) : null}

        {!loadingAssets && step === 4 ? (
          <div className="wizard-review">
            <p>
              <strong>Campanha:</strong> {form.name} · R$ {form.budget}/dia
            </p>
            <p>
              <strong>Página:</strong>{' '}
              {pages.find((p) => p.pageId === form.pageId)?.name || form.pageId}
            </p>
            <p>
              <strong>Formulário:</strong> {form.formTitle}
            </p>
            <p>
              <strong>Campos:</strong> {questionsSummary.join(' · ')}
            </p>
            <p>
              <strong>Público:</strong> {form.country}
              {form.city ? ` / ${form.city}` : ''} · {form.ageMin}-{form.ageMax}{' '}
              anos
            </p>
            <p>
              <strong>Anúncio:</strong> {form.creativeTitle} · CTA {form.cta}
            </p>
            <p className="wizard-hint">
              Tudo será criado na Meta como <strong>PAUSED</strong>. Você ativa
              depois em Campanhas ou no Ads Manager.
            </p>
          </div>
        ) : null}

        {error ? <p className="wizard-page__error">{error}</p> : null}
        {info ? <p className="wizard-page__info">{info}</p> : null}
        {error && step > 0 ? (
          <p className="wizard-hint">
            Corrija o campo neste passo ou use <strong>Voltar</strong> para
            ajustar etapas anteriores.
          </p>
        ) : null}

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
              onClick={() => setStep((current) => current + 1)}
            >
              Continuar
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              disabled={saving || loadingAssets}
              onClick={handleSubmit}
            >
              {saving ? 'Enviando para Meta...' : 'Criar campanha completa'}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
