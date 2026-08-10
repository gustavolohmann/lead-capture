import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { whatsappTemplatesApi } from '../../services/whatsappTemplates.api.js';
import './Automation.css';

export const STEP_TYPES = [
  { value: 'SEND_WHATSAPP', label: 'Enviar WhatsApp' },
  { value: 'SEND_INSTAGRAM', label: 'Enviar Instagram' },
  { value: 'WAIT', label: 'Esperar' },
  { value: 'CONDITION', label: 'Condição' },
  { value: 'ASSIGN_USER', label: 'Atribuir usuário' },
];

function defaultConfigForType(type) {
  if (type === 'WAIT') return { minutes: 30 };
  if (type === 'CONDITION') {
    return { field: 'answered', operator: 'equals', value: true };
  }
  if (type === 'ASSIGN_USER') return { userId: null };
  if (type === 'SEND_WHATSAPP') {
    return {
      message: 'Olá {{name}}',
      templateName: '',
      templateLanguage: 'pt_BR',
    };
  }
  return { message: 'Olá {{name}}' };
}

export function StepCard({
  step,
  index,
  total,
  onChange,
  onRemove,
  onMove,
  approvedTemplates = [],
}) {
  const typeMeta = STEP_TYPES.find((t) => t.value === step.type);

  return (
    <article className="flow-step-card">
      <div className="flow-step-card__drag" aria-hidden="true">
        <span className="material-symbols-outlined">drag_indicator</span>
      </div>

      <div className="flow-step-card__body">
        <div className="flow-step-card__header">
          <h4 className="flow-step-card__title">
            <span className="flow-step-card__badge">{index + 1}</span>
            {typeMeta?.label || step.type}
          </h4>
          <div className="flow-step-card__actions">
            <button
              type="button"
              className="flow-icon-btn"
              disabled={index === 0}
              onClick={() => onMove(-1)}
              aria-label="Mover para cima"
            >
              <span className="material-symbols-outlined">arrow_upward</span>
            </button>
            <button
              type="button"
              className="flow-icon-btn"
              disabled={index === total - 1}
              onClick={() => onMove(1)}
              aria-label="Mover para baixo"
            >
              <span className="material-symbols-outlined">arrow_downward</span>
            </button>
            <button
              type="button"
              className="flow-remove-btn"
              onClick={onRemove}
            >
              Remover
            </button>
          </div>
        </div>

        <div className="flow-step-card__fields">
          <label className="flow-field">
            <span className="flow-field__label">Tipo</span>
            <select
              className="flow-field__control flow-field__control--muted"
              value={step.type}
              onChange={(e) =>
                onChange({
                  type: e.target.value,
                  config: defaultConfigForType(e.target.value),
                })
              }
            >
              {STEP_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>

          {step.type === 'SEND_WHATSAPP' ? (
            <>
              <label className="flow-field">
                <span className="flow-field__label">
                  Template WhatsApp (1º contato / fora de 24h)
                </span>
                <select
                  className="flow-field__control"
                  value={step.config?.templateName || ''}
                  onChange={(e) => {
                    const name = e.target.value;
                    const selected = approvedTemplates.find(
                      (t) => t.name === name
                    );
                    onChange({
                      ...step,
                      config: {
                        ...step.config,
                        templateName: name,
                        templateLanguage:
                          selected?.language ||
                          step.config?.templateLanguage ||
                          'pt_BR',
                      },
                    });
                  }}
                >
                  <option value="">Sem template (só texto livre)</option>
                  {approvedTemplates.map((tpl) => (
                    <option key={tpl.id} value={tpl.name}>
                      {tpl.name} ({tpl.language})
                    </option>
                  ))}
                </select>
              </label>
              {step.config?.templateName ? (
                <label className="flow-field">
                  <span className="flow-field__label">Idioma do template</span>
                  <input
                    className="flow-field__control"
                    type="text"
                    value={step.config?.templateLanguage || 'pt_BR'}
                    onChange={(e) =>
                      onChange({
                        ...step,
                        config: {
                          ...step.config,
                          templateLanguage: e.target.value.trim() || 'pt_BR',
                        },
                      })
                    }
                  />
                </label>
              ) : null}
              <label className="flow-field">
                <span className="flow-field__label">
                  Mensagem (texto livre / fallback)
                </span>
                <textarea
                  className="flow-field__control"
                  rows={2}
                  value={step.config?.message || ''}
                  onChange={(e) =>
                    onChange({
                      ...step,
                      config: { ...step.config, message: e.target.value },
                    })
                  }
                />
              </label>
              <p className="flow-hint">
                Só templates <strong>aprovados</strong> aparecem aqui. Gerencie
                em{' '}
                <Link to="/whatsapp/templates">Templates WA</Link>. Fora da
                janela de 24h, o template é enviado no lugar do texto livre.
              </p>
            </>
          ) : null}

          {step.type === 'SEND_INSTAGRAM' ? (
            <label className="flow-field">
              <span className="flow-field__label">Mensagem</span>
              <textarea
                className="flow-field__control"
                rows={2}
                value={step.config?.message || ''}
                onChange={(e) =>
                  onChange({
                    ...step,
                    config: { ...step.config, message: e.target.value },
                  })
                }
              />
            </label>
          ) : null}

          {step.type === 'WAIT' ? (
            <label className="flow-field">
              <span className="flow-field__label">Minutos</span>
              <input
                className="flow-field__control"
                type="number"
                min={1}
                value={step.config?.minutes ?? 30}
                onChange={(e) =>
                  onChange({
                    ...step,
                    config: {
                      ...step.config,
                      minutes: Number(e.target.value) || 1,
                    },
                  })
                }
              />
            </label>
          ) : null}

          {step.type === 'CONDITION' ? (
            <p className="flow-hint">
              Condição MVP: field=answered (lead respondeu na conversa).
            </p>
          ) : null}

          {step.type === 'ASSIGN_USER' ? (
            <p className="flow-hint">
              MVP: marca o lead como CONTACTED (assignee completo depois).
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function FlowBuilder({ steps, onChange }) {
  const [approvedTemplates, setApprovedTemplates] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function loadTemplates() {
      try {
        const data = await whatsappTemplatesApi.list({ approvedOnly: true });
        if (!cancelled) setApprovedTemplates(data.templates || []);
      } catch {
        if (!cancelled) setApprovedTemplates([]);
      }
    }
    loadTemplates();
    return () => {
      cancelled = true;
    };
  }, []);

  function updateStep(index, patch) {
    const next = steps.map((step, i) =>
      i === index ? { ...step, ...patch } : step
    );
    onChange(next);
  }

  function addStep(atIndex) {
    const item = {
      type: 'SEND_WHATSAPP',
      config: { message: 'Olá {{name}}' },
    };
    if (atIndex == null) {
      onChange([...steps, item]);
      return;
    }
    const next = [...steps];
    next.splice(atIndex, 0, item);
    onChange(next);
  }

  function removeStep(index) {
    onChange(steps.filter((_, i) => i !== index));
  }

  function moveStep(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    onChange(next);
  }

  return (
    <div className="flow-builder">
      {steps.map((step, index) => (
        <div key={`step-${index}`}>
          <button
            type="button"
            className="flow-add-between"
            onClick={() => addStep(index)}
          >
            + Passo
          </button>
          <StepCard
            step={step}
            index={index}
            total={steps.length}
            approvedTemplates={approvedTemplates}
            onChange={(patch) => updateStep(index, patch)}
            onRemove={() => removeStep(index)}
            onMove={(delta) => moveStep(index, delta)}
          />
        </div>
      ))}
      <button
        type="button"
        className="flow-add-between"
        onClick={() => addStep(null)}
      >
        + Passo
      </button>
    </div>
  );
}
