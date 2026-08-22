import { useEffect, useMemo, useState } from 'react';
import AdStep from './AdStep.jsx';
import FormStep from './FormStep.jsx';
import { LABEL_TYPES, questionTypeMeta } from '../leadsWizardState.js';
import { ctaUiLabel } from '../leadsWizardMappers.js';

function questionSummary(question) {
  if (LABEL_TYPES.has(question.type) && question.label?.trim()) {
    return question.label.trim();
  }
  return questionTypeMeta(question.type).label;
}

function shortChipLabel(label) {
  const text = String(label || '').trim();
  if (!text) return 'Campo';

  // Prefer short friendly labels for common fields (Stitch summary chips).
  const lower = text.toLowerCase();
  if (lower.includes('e-mail') || lower.includes('email')) return 'E-mail';
  if (lower.includes('telefone') || lower.includes('whatsapp') || lower.includes('phone')) {
    return 'Telefone';
  }
  if (lower.includes('nome')) return 'Nome';
  if (lower.includes('serviço') || lower.includes('servico')) return 'Serviço';

  // Otherwise keep first meaningful token without splitting hyphenated words.
  const first = text.split(/[\s/·|]+/)[0];
  return first || text;
}

function buildFormSummary(form, localForms) {
  if (form.mode === 'existing') {
    const selected = localForms.find(
      (item) => String(item.id) === String(form.existingFormId)
    );
    const name =
      selected?.name ||
      form.existingFormSnapshot?.name ||
      'Formulário existente';
    const count = Array.isArray(selected?.fields)
      ? selected.fields.length
      : form.existingFormSnapshot?.fieldsCount ?? 0;
    return {
      title: name,
      countLabel: `${count} pergunta${count === 1 ? '' : 's'}`,
      chips: Array.isArray(selected?.fields)
        ? selected.fields
            .slice(0, 4)
            .map((field) => shortChipLabel(field.label || field.type || 'Campo'))
        : [],
    };
  }

  const questions = Array.isArray(form.questions) ? form.questions : [];
  return {
    title: form.title?.trim() || 'Novo formulário',
    countLabel: `${questions.length} pergunta${questions.length === 1 ? '' : 's'}`,
    chips: questions.slice(0, 4).map((q) => shortChipLabel(questionSummary(q))),
  };
}

const FORM_ERROR_FIELDS = new Set([
  'existingFormId',
  'title',
  'questions',
  'privacyUrl',
  'followUpUrl',
]);

export default function CreativeStep({
  state,
  ads = [],
  activeAdIndex = 0,
  pages,
  localForms,
  fieldErrors,
  imagePreviewUrl,
  imageNeedsReselect,
  imageError,
  onAdChange,
  onAdSelect,
  onAdAdd,
  onAdDuplicate,
  onAdRemove,
  onFormChange,
  onImageSelect,
}) {
  const pageName =
    pages.find((p) => p.pageId === state.campaign.pageId)?.name || '';
  const { ad, form } = state;
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState('mobile');

  const summary = useMemo(
    () => buildFormSummary(form, localForms),
    [form, localForms]
  );

  const hasFormErrors = useMemo(
    () =>
      Object.keys(fieldErrors || {}).some((key) => FORM_ERROR_FIELDS.has(key)),
    [fieldErrors]
  );

  useEffect(() => {
    if (hasFormErrors) setFormModalOpen(true);
  }, [hasFormErrors]);

  useEffect(() => {
    if (!formModalOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKeyDown(event) {
      if (event.key === 'Escape') setFormModalOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [formModalOpen]);

  return (
    <div className="wizard-creative wizard-creative--fit">
      <section className="wizard-ads-collection" aria-label="Anúncios da campanha">
        <div className="wizard-ads-collection__head">
          <div>
            <h2>Anúncios</h2>
            <p>
              {ads.length} {ads.length === 1 ? 'anúncio configurado' : 'anúncios configurados'}
            </p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onAdAdd}>
            + Adicionar anúncio
          </button>
        </div>
        <div className="wizard-ads-collection__list" role="tablist" aria-label="Selecionar anúncio">
          {ads.map((item, index) => (
            <div
              key={item.clientKey}
              className={`wizard-ad-tab${activeAdIndex === index ? ' is-active' : ''}`}
            >
              <button
                type="button"
                className="wizard-ad-tab__select"
                role="tab"
                aria-selected={activeAdIndex === index}
                onClick={() => onAdSelect(index)}
              >
                <span className="wizard-ad-tab__number">{index + 1}</span>
                <span className="wizard-ad-tab__copy">
                  <strong>{item.name || `Anúncio ${index + 1}`}</strong>
                  <span>{item.title || 'Sem título'}</span>
                </span>
              </button>
              <div className="wizard-ad-tab__actions">
                <button
                  type="button"
                  aria-label={`Duplicar ${item.name || `anúncio ${index + 1}`}`}
                  title="Duplicar"
                  onClick={() => onAdDuplicate(index)}
                >
                  ⎘
                </button>
                <button
                  type="button"
                  aria-label={`Remover ${item.name || `anúncio ${index + 1}`}`}
                  title={ads.length === 1 ? 'A campanha precisa de um anúncio' : 'Remover'}
                  disabled={ads.length === 1}
                  onClick={() => onAdRemove(index)}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="wizard-ad-layout wizard-ad-layout--stitch">
        <section className="wizard-ad-col" aria-label="Anúncio">
          <div className="wizard-creative__intro">
            <h2 className="wizard-step-title">Crie seu anúncio</h2>
            <p className="wizard-step-subtitle">
              Defina a mensagem principal e o título que irão atrair a atenção
              do seu público-alvo.
            </p>
          </div>

          <AdStep
            state={state}
            pageName={pageName}
            imagePreviewUrl={imagePreviewUrl}
            imageNeedsReselect={imageNeedsReselect}
            imageError={imageError}
            fieldErrors={fieldErrors}
            onChange={onAdChange}
            onImageSelect={onImageSelect}
            showPreview={false}
            embedded
          />

          <section
            className={`wizard-form-summary${hasFormErrors ? ' is-invalid' : ''}`}
            aria-label="Formulário"
          >
            <div className="wizard-form-summary__head">
              <span className="wizard-form-summary__eyebrow">
                Formulário<span className="field-required">*</span>
              </span>
              <span className="wizard-form-summary__count">
                {summary.countLabel}
              </span>
            </div>

            <h3 className="wizard-form-summary__title">{summary.title}</h3>

            <p className="wizard-form-summary__fields-label">
              Campos capturados:
            </p>
            {summary.chips.length > 0 ? (
              <div className="wizard-form-summary__chips">
                {summary.chips.map((chip, index) => (
                  <span
                    key={`${chip}-${index}`}
                    className="wizard-form-summary__chip"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            ) : (
              <p className="wizard-form-summary__empty">
                Nenhuma pergunta configurada ainda.
              </p>
            )}

            {hasFormErrors ? (
              <p className="wizard-form-summary__error">
                Há pendências no formulário. Edite para continuar.
              </p>
            ) : null}

            <div className="wizard-form-summary__footer">
              <button
                type="button"
                className="wizard-form-summary__edit"
                onClick={() => setFormModalOpen(true)}
              >
                Editar formulário
              </button>
            </div>
          </section>
        </section>

        <aside className="wizard-preview-panel" aria-label="Prévia">
          <div className="wizard-preview-panel__head">
            <h3 className="wizard-preview-panel__title">Prévia</h3>
            <div className="wizard-preview-panel__toggles" role="group">
              <button
                type="button"
                className={`wizard-preview-panel__toggle${
                  previewMode === 'mobile' ? ' is-active' : ''
                }`}
                aria-pressed={previewMode === 'mobile'}
                aria-label="Prévia mobile"
                onClick={() => setPreviewMode('mobile')}
              >
                ▢
              </button>
              <button
                type="button"
                className={`wizard-preview-panel__toggle${
                  previewMode === 'desktop' ? ' is-active' : ''
                }`}
                aria-pressed={previewMode === 'desktop'}
                aria-label="Prévia desktop"
                onClick={() => setPreviewMode('desktop')}
              >
                ▣
              </button>
            </div>
          </div>

          <div
            className={`wizard-ad-preview wizard-ad-preview--panel${
              previewMode === 'desktop' ? ' is-desktop' : ''
            }`}
          >
            <div className="wizard-ad-preview__head wizard-ad-preview__head--row">
              <div className="wizard-ad-preview__avatar" aria-hidden="true" />
              <div className="wizard-ad-preview__identity">
                <strong>{pageName || 'Sua página'}</strong>
                <span>Patrocinado</span>
              </div>
            </div>
            <p className="wizard-ad-preview__text">
              {ad.primaryText || 'Seu texto principal aparece aqui.'}
            </p>
            <div className="wizard-ad-preview__media">
              {imagePreviewUrl ? (
                <img src={imagePreviewUrl} alt="Prévia do anúncio" />
              ) : (
                <div className="wizard-ad-preview__placeholder">Sua imagem</div>
              )}
            </div>
            <div className="wizard-ad-preview__footer wizard-ad-preview__footer--panel">
              <span className="wizard-ad-preview__form-label">Formulário</span>
              <div className="wizard-ad-preview__cta-row">
                <strong>{ad.title || 'Título'}</strong>
                <button
                  type="button"
                  className="wizard-ad-preview__cta"
                  tabIndex={-1}
                >
                  {ctaUiLabel(ad.cta)}
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {formModalOpen ? (
        <div className="wizard-form-modal" role="presentation">
          <button
            type="button"
            className="wizard-form-modal__backdrop"
            aria-label="Fechar"
            onClick={() => setFormModalOpen(false)}
          />
          <div
            className="wizard-form-modal__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wizard-form-modal-title"
          >
            <header className="wizard-form-modal__header">
              <div>
                <h3 id="wizard-form-modal-title">Editar formulário</h3>
                <p>Defina as perguntas e a privacidade do lead.</p>
              </div>
              <button
                type="button"
                className="wizard-form-modal__close"
                aria-label="Fechar"
                onClick={() => setFormModalOpen(false)}
              >
                ×
              </button>
            </header>

            <div className="wizard-form-modal__body">
              <FormStep
                state={state}
                localForms={localForms}
                fieldErrors={fieldErrors}
                onChange={onFormChange}
                inModal
              />
            </div>

            <footer className="wizard-form-modal__footer">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setFormModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setFormModalOpen(false)}
              >
                Salvar formulário
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
