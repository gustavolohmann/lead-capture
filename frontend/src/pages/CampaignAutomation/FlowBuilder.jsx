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
  return { message: 'Olá {{name}}' };
}

export function StepCard({
  step,
  index,
  total,
  onChange,
  onRemove,
  onMove,
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

          {['SEND_WHATSAPP', 'SEND_INSTAGRAM'].includes(step.type) ? (
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
                min="1"
                value={step.config?.minutes || 30}
                onChange={(e) =>
                  onChange({
                    ...step,
                    config: {
                      ...step.config,
                      minutes: Number(e.target.value),
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
      <div className="flow-builder__header">
        <h3 className="flow-builder__title">Fluxo</h3>
        <button
          type="button"
          className="flow-add-btn"
          onClick={() => addStep()}
        >
          <span className="material-symbols-outlined">add</span>
          Adicionar etapa
        </button>
      </div>

      <div className="flow-builder__list">
        {steps.map((step, index) => (
          <div key={index} className="flow-builder__item">
            <StepCard
              step={step}
              index={index}
              total={steps.length}
              onChange={(patch) => updateStep(index, patch)}
              onRemove={() => removeStep(index)}
              onMove={(delta) => moveStep(index, delta)}
            />
            {index < steps.length - 1 ? (
              <div className="flow-divider">
                <button
                  type="button"
                  className="flow-divider__btn"
                  onClick={() => addStep(index + 1)}
                  aria-label="Inserir etapa"
                >
                  <span className="material-symbols-outlined">add</span>
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
