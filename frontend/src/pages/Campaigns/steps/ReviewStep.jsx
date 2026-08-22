import { formatBRL, formatMonthlyEstimate } from '../campaignMoney.js';
import { ctaUiLabel } from '../leadsWizardMappers.js';
import {
  LABEL_TYPES,
  questionTypeMeta,
  stepIndexById,
  stepLabel,
} from '../leadsWizardState.js';

function genderLabel(gender) {
  if (gender === 'male') return 'Homens';
  if (gender === 'female') return 'Mulheres';
  return 'Todos';
}

function questionSummary(question) {
  if (LABEL_TYPES.has(question.type) && question.label?.trim()) {
    return question.label.trim();
  }
  return questionTypeMeta(question.type).label;
}

function shortChipLabel(label) {
  const text = String(label || '').trim();
  if (!text) return 'Campo';
  const lower = text.toLowerCase();
  if (lower.includes('e-mail') || lower.includes('email')) return 'E-mail';
  if (lower.includes('telefone') || lower.includes('whatsapp') || lower.includes('phone')) {
    return 'Telefone';
  }
  if (lower.includes('nome')) return 'Nome';
  if (lower.includes('serviço') || lower.includes('servico')) return 'Serviço';
  const first = text.split(/[\s/·|]+/)[0];
  return first || text;
}

function buildFormChips(form, localForms = []) {
  if (form.mode === 'existing') {
    const selected = localForms.find(
      (item) => String(item.id) === String(form.existingFormId)
    );
    if (Array.isArray(selected?.fields)) {
      return selected.fields
        .slice(0, 4)
        .map((field) => shortChipLabel(field.label || field.type || 'Campo'));
    }
    return [];
  }
  return (Array.isArray(form.questions) ? form.questions : [])
    .slice(0, 4)
    .map((q) => shortChipLabel(questionSummary(q)));
}

export default function ReviewStep({
  state,
  ads = [],
  pages,
  localForms = [],
  imagePreviewUrl,
  issues = [],
  onEditStep,
}) {
  const pageName =
    pages.find((p) => p.pageId === state.campaign.pageId)?.name ||
    state.campaign.pageId;

  const formTitle =
    state.form.mode === 'existing'
      ? state.form.existingFormSnapshot?.name || 'Formulário existente'
      : state.form.title;

  const fieldsCount =
    state.form.mode === 'existing'
      ? state.form.existingFormSnapshot?.fieldsCount ?? '—'
      : state.form.questions.length;

  const locations =
    state.audience.locations.map((l) => l.label).join(', ') || 'Brasil';

  const formChips = buildFormChips(state.form, localForms);

  return (
    <div className="wizard-review-layout">
      {issues.length > 0 ? (
        <div className="wizard-pending">
          <strong>Pendências antes de publicar</strong>
          <ul>
            {issues.map((item, index) => (
              <li key={`${item.step}-${item.field}-${index}`}>
                <span>{item.message}</span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => onEditStep(stepIndexById(item.step))}
                >
                  Corrigir em {stepLabel(item.step)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="wizard-review-shell">
        <header className="wizard-review-shell__head">
          <h2 className="wizard-step-title">Revise e publique</h2>
        </header>

        <div className="wizard-review-columns">
          <div className="wizard-review-stack">
            <article className="wizard-review-card">
              <div className="wizard-review-card__body">
                <div className="wizard-review-card__eyebrow">Campanha</div>
                <p className="wizard-review-card__title">
                  {state.campaign.name || '—'}
                </p>
                <p className="wizard-review-card__meta">{pageName}</p>
                <p className="wizard-review-card__value">
                  {formatBRL(state.campaign.dailyBudget)}/dia · ≈{' '}
                  {formatMonthlyEstimate(state.campaign.dailyBudget)}/mês
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost wizard-review-card__edit"
                onClick={() => onEditStep(0)}
              >
                Editar
              </button>
            </article>

            <article className="wizard-review-card">
              <div className="wizard-review-card__body">
                <div className="wizard-review-card__eyebrow">Anúncios</div>
                <p className="wizard-review-card__title">
                  {ads.length} {ads.length === 1 ? 'anúncio' : 'anúncios'}
                </p>
                <div className="wizard-review-card__chips">
                  {ads.map((ad, index) => (
                    <span className="wizard-review-card__chip" key={ad.clientKey}>
                      {ad.name || `Anúncio ${index + 1}`}
                    </span>
                  ))}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost wizard-review-card__edit"
                onClick={() => onEditStep(1)}
              >
                Editar
              </button>
            </article>

            <article className="wizard-review-card">
              <div className="wizard-review-card__body">
                <div className="wizard-review-card__eyebrow">Público</div>
                <p className="wizard-review-card__title">{locations}</p>
                <p className="wizard-review-card__meta">
                  {state.audience.ageMin}–{state.audience.ageMax} anos ·{' '}
                  {genderLabel(state.audience.gender)}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost wizard-review-card__edit"
                onClick={() => onEditStep(0)}
              >
                Editar
              </button>
            </article>

            <article className="wizard-review-card">
              <div className="wizard-review-card__body">
                <div className="wizard-review-card__eyebrow">Formulário</div>
                <p className="wizard-review-card__title">{formTitle || '—'}</p>
                <p className="wizard-review-card__meta">
                  {fieldsCount} perguntas
                </p>
                {formChips.length > 0 ? (
                  <div className="wizard-review-card__chips">
                    {formChips.map((chip, index) => (
                      <span
                        key={`${chip}-${index}`}
                        className="wizard-review-card__chip"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                className="btn btn-ghost wizard-review-card__edit"
                onClick={() => onEditStep(1)}
              >
                Editar
              </button>
            </article>
          </div>

          <aside className="wizard-review-preview">
            <div className="wizard-preview-label">Prévia do anúncio</div>
            <div className="wizard-ad-preview wizard-ad-preview--review">
              <div className="wizard-ad-preview__head wizard-ad-preview__head--row">
                <div className="wizard-ad-preview__avatar" aria-hidden="true" />
                <div className="wizard-ad-preview__identity">
                  <strong>{pageName || 'Sua página'}</strong>
                  <span>Patrocinado</span>
                </div>
              </div>
              <p className="wizard-ad-preview__text">
                {state.ad.primaryText || 'Seu texto principal aparece aqui.'}
              </p>
              <div className="wizard-ad-preview__media">
                {imagePreviewUrl ? (
                  <img src={imagePreviewUrl} alt="Prévia" />
                ) : (
                  <div className="wizard-ad-preview__placeholder">Sem imagem</div>
                )}
              </div>
              <div className="wizard-ad-preview__footer wizard-ad-preview__footer--panel">
                <span className="wizard-ad-preview__form-label">Formulário</span>
                <div className="wizard-ad-preview__cta-row">
                  <strong>{state.ad.title || formTitle || 'Título'}</strong>
                  <span className="wizard-ad-preview__cta-label">
                    {ctaUiLabel(state.ad.cta)}
                  </span>
                </div>
              </div>
            </div>
            <p className="wizard-hint wizard-review-preview__hint">
              A campanha será criada pausada. Você ativa quando estiver pronta.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
