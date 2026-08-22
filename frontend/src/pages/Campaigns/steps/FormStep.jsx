import { useState } from 'react';
import {
  LABEL_TYPES,
  OPTION_TYPES,
  QUESTION_TYPES,
  createEmptyQuestion,
  questionTypeMeta,
} from '../leadsWizardState.js';

function questionSummary(question) {
  if (LABEL_TYPES.has(question.type) && question.label?.trim()) {
    return question.label.trim();
  }
  return questionTypeMeta(question.type).label;
}

function questionTypeLabel(question) {
  return questionTypeMeta(question.type).label;
}

function isFixedRequired(question) {
  return !LABEL_TYPES.has(question.type);
}

export default function FormStep({
  state,
  localForms = [],
  fieldErrors = {},
  onChange,
  compact = false,
  inModal = false,
}) {
  const { form } = state;
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const showPrivacyInline = compact || inModal;

  function patch(partial) {
    onChange(partial);
  }

  function selectExisting(formId) {
    const selected = localForms.find((item) => String(item.id) === String(formId));
    patch({
      mode: 'existing',
      existingFormId: formId || null,
      existingFormSnapshot: selected
        ? {
            name: selected.name,
            fieldsCount: Array.isArray(selected.fields) ? selected.fields.length : 0,
          }
        : null,
    });
  }

  function updateQuestion(index, patchQ) {
    const next = form.questions.map((question, i) => {
      if (i !== index) return question;
      const merged = { ...question, ...patchQ };
      if (patchQ.type) {
        const meta = questionTypeMeta(patchQ.type);
        if (!meta.needsLabel) merged.label = meta.label;
        else if (!LABEL_TYPES.has(question.type)) merged.label = '';
        if (!OPTION_TYPES.has(patchQ.type)) merged.optionsText = '';
      }
      return merged;
    });
    patch({ questions: next });
  }

  function moveQuestion(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= form.questions.length) return;
    const next = [...form.questions];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    patch({ questions: next });
    setExpandedIndex(target);
  }

  function removeQuestion(index) {
    if (form.questions.length <= 1) return;
    patch({
      questions: form.questions.filter((_, i) => i !== index),
    });
    setExpandedIndex(null);
  }

  return (
    <div
      className={`wizard-grid wizard-grid--tight${
        compact || inModal ? ' wizard-form-compact' : ''
      }${inModal ? ' wizard-form-modal-body' : ''}`}
    >
      {!compact && !inModal ? (
        <div>
          <h2 className="wizard-step-title">Como deseja capturar os dados?</h2>
        </div>
      ) : null}
      {compact && !inModal ? (
        <div className="wizard-section-label">Formulário</div>
      ) : null}

      <div
        className={`wizard-mode-cards wizard-mode-cards--compact${
          inModal ? ' wizard-mode-cards--segmented' : ''
        }`}
        role="radiogroup"
        aria-label="Modo do formulário"
      >
        <button
          type="button"
          className={`wizard-mode-card${form.mode === 'new' ? ' is-active' : ''}`}
          onClick={() => patch({ mode: 'new' })}
        >
          <strong>Criar novo</strong>
        </button>
        <button
          type="button"
          className={`wizard-mode-card${form.mode === 'existing' ? ' is-active' : ''}`}
          onClick={() => patch({ mode: 'existing' })}
        >
          <strong>Usar existente</strong>
        </button>
      </div>

      {form.mode === 'existing' ? (
          <label className={`field${fieldErrors.existingFormId ? ' is-invalid' : ''}`}>
          <span className="field-label">
            Formulário<span className="field-required">*</span>
          </span>
          <select
            className="input"
            value={form.existingFormId || ''}
            onChange={(e) => selectExisting(e.target.value)}
          >
            <option value="">Selecione</option>
            {localForms.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {Array.isArray(item.fields) ? ` (${item.fields.length})` : ''}
              </option>
            ))}
          </select>
          {fieldErrors.existingFormId ? (
            <span className="field-error">{fieldErrors.existingFormId}</span>
          ) : null}
        </label>
      ) : (
        <>
          <label className={`field${fieldErrors.title ? ' is-invalid' : ''}`}>
            <span className="field-label">
              Título do formulário
              <span className="field-required">*</span>
            </span>
            <input
              className="input"
              value={form.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="Solicite seu orçamento"
            />
            {fieldErrors.title ? (
              <span className="field-error">{fieldErrors.title}</span>
            ) : null}
          </label>

          <div className={`field${fieldErrors.questions ? ' is-invalid' : ''}`}>
            <div className="wizard-questions-header">
              <span className="field-label">
                O que deseja perguntar?
                <span className="field-required">*</span>
              </span>
              <button
                type="button"
                className="wizard-questions-add"
                disabled={form.questions.length >= 15}
                onClick={() => {
                  patch({
                    questions: [...form.questions, createEmptyQuestion('TEXT')],
                  });
                  setExpandedIndex(form.questions.length);
                }}
              >
                + Adicionar
              </button>
            </div>
            {fieldErrors.questions ? (
              <span className="field-error">{fieldErrors.questions}</span>
            ) : null}

            <div className="wizard-q-list">
              {form.questions.map((question, index) => {
                const open = expandedIndex === index;
                const needsLabel = LABEL_TYPES.has(question.type);
                const needsOptions = OPTION_TYPES.has(question.type);

                if (!open) {
                  return (
                    <div key={index} className="wizard-q-row-card">
                      <button
                        type="button"
                        className="wizard-q-row-card__main"
                        onClick={() => setExpandedIndex(index)}
                      >
                        <span className="wizard-drag" aria-hidden>
                          ⋮⋮
                        </span>
                        <span className="wizard-q-row-card__copy">
                          <strong>{questionSummary(question)}</strong>
                          <em>{questionTypeLabel(question)}</em>
                        </span>
                      </button>
                      <div className="wizard-q-row-card__meta">
                        {isFixedRequired(question) ? (
                          <span className="wizard-q-row-card__required">
                            Obrigatório
                          </span>
                        ) : (
                          <span className="wizard-q-row-card__optional">
                            Opcional
                          </span>
                        )}
                        <button
                          type="button"
                          className="wizard-q-row-card__delete"
                          aria-label="Excluir pergunta"
                          disabled={form.questions.length <= 1}
                          onClick={() => removeQuestion(index)}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={index} className="wizard-q-expanded">
                    <div className="wizard-q-expanded__head">
                      <span className="wizard-drag" aria-hidden>
                        ⋮⋮
                      </span>
                      <strong>{questionSummary(question)}</strong>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={form.questions.length <= 1}
                        onClick={() => removeQuestion(index)}
                      >
                        Excluir
                      </button>
                    </div>
                    <div className="wizard-q-expanded__body">
                      <label className="field">
                        <span className="field-label">Tipo</span>
                        <select
                          className="input"
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
                      </label>
                      {needsLabel ? (
                        <label className="field">
                          <span className="field-label">Pergunta</span>
                          <input
                            className="input"
                            value={question.label}
                            onChange={(e) =>
                              updateQuestion(index, { label: e.target.value })
                            }
                          />
                        </label>
                      ) : null}
                      {needsOptions ? (
                        <label className="field">
                          <span className="field-label">Opções (uma por linha)</span>
                          <textarea
                            className="input wizard-textarea"
                            value={question.optionsText}
                            onChange={(e) =>
                              updateQuestion(index, {
                                optionsText: e.target.value,
                              })
                            }
                            rows={3}
                          />
                        </label>
                      ) : null}
                    </div>
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
                        onClick={() => setExpandedIndex(null)}
                      >
                        Fechar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      <div className="wizard-advanced">
        {showPrivacyInline ? (
          <div className="wizard-grid wizard-grid--tight">
            <div className="wizard-section-label">
              Privacidade e configurações
            </div>
            <label className={`field${fieldErrors.privacyUrl ? ' is-invalid' : ''}`}>
              <span className="field-label">
                URL da política de privacidade
                <span className="field-required">*</span>
              </span>
              <input
                className="input"
                value={form.privacyUrl}
                onChange={(e) => patch({ privacyUrl: e.target.value })}
                placeholder="https://seusite.com/privacidade"
              />
              {fieldErrors.privacyUrl ? (
                <span className="field-error">{fieldErrors.privacyUrl}</span>
              ) : null}
            </label>
            <label className={`field${fieldErrors.followUpUrl ? ' is-invalid' : ''}`}>
              <span className="field-label">URL após envio</span>
              <input
                className="input"
                value={form.followUpUrl}
                onChange={(e) => patch({ followUpUrl: e.target.value })}
                placeholder="https://seusite.com/obrigado"
              />
              {fieldErrors.followUpUrl ? (
                <span className="field-error">{fieldErrors.followUpUrl}</span>
              ) : null}
            </label>
          </div>
        ) : (
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setPrivacyOpen((v) => !v)}
            >
              {privacyOpen ? '▾' : '▸'} Privacidade e destino
            </button>
            {privacyOpen || fieldErrors.privacyUrl || fieldErrors.followUpUrl ? (
              <div className="wizard-grid wizard-grid--tight">
                <label
                  className={`field${fieldErrors.privacyUrl ? ' is-invalid' : ''}`}
                >
                  <span className="field-label">
                    Política de privacidade (https)
                    <span className="field-required">*</span>
                  </span>
                  <input
                    className="input"
                    value={form.privacyUrl}
                    onChange={(e) => patch({ privacyUrl: e.target.value })}
                    placeholder="https://seusite.com/privacidade"
                  />
                  {fieldErrors.privacyUrl ? (
                    <span className="field-error">{fieldErrors.privacyUrl}</span>
                  ) : null}
                </label>
                <label
                  className={`field${fieldErrors.followUpUrl ? ' is-invalid' : ''}`}
                >
                  <span className="field-label">
                    Para onde enviar depois do envio
                  </span>
                  <input
                    className="input"
                    value={form.followUpUrl}
                    onChange={(e) => patch({ followUpUrl: e.target.value })}
                    placeholder="https://seusite.com/obrigado"
                  />
                  {fieldErrors.followUpUrl ? (
                    <span className="field-error">{fieldErrors.followUpUrl}</span>
                  ) : null}
                </label>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
