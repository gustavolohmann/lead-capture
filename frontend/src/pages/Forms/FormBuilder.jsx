import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { formsApi } from '../../services/forms.api.js';
import { copyFormPublicLink, getFormPublicUrl } from './formLinks.js';
import './Forms.css';

const FIELD_TYPES = [
  'TEXT',
  'EMAIL',
  'PHONE',
  'NUMBER',
  'DATE',
  'SELECT',
  'RADIO',
  'CHECKBOX',
  'TEXTAREA',
];

const FIELD_PRESETS = [
  { label: 'Texto', type: 'TEXT', fieldLabel: 'Texto', placeholder: '' },
  {
    label: 'Nome',
    type: 'TEXT',
    fieldLabel: 'Nome completo',
    placeholder: 'Digite seu nome',
    required: true,
  },
  {
    label: 'E-mail',
    type: 'EMAIL',
    fieldLabel: 'E-mail',
    placeholder: 'seu@email.com',
  },
  {
    label: 'Telefone',
    type: 'PHONE',
    fieldLabel: 'Telefone',
    placeholder: '(00) 00000-0000',
    required: true,
  },
  { label: 'Número', type: 'NUMBER', fieldLabel: 'Número', placeholder: '' },
  {
    label: 'CPF',
    type: 'TEXT',
    fieldLabel: 'CPF',
    placeholder: '000.000.000-00',
  },
  { label: 'Data', type: 'DATE', fieldLabel: 'Data', placeholder: '' },
  {
    label: 'Seleção',
    type: 'SELECT',
    fieldLabel: 'Selecione uma opção',
    placeholder: '',
    optionsText: 'Opção 1\nOpção 2',
  },
  {
    label: 'Múltipla escolha',
    type: 'RADIO',
    fieldLabel: 'Escolha uma opção',
    optionsText: 'Opção 1\nOpção 2',
  },
  {
    label: 'Texto longo',
    type: 'TEXTAREA',
    fieldLabel: 'Mensagem',
    placeholder: 'Escreva aqui...',
  },
  {
    label: 'Checkbox',
    type: 'CHECKBOX',
    fieldLabel: 'Selecione as opções',
    optionsText: 'Opção 1\nOpção 2',
  },
  {
    label: 'Campo personalizado',
    type: 'TEXT',
    fieldLabel: 'Novo campo',
    placeholder: '',
  },
];

function typeLabel(type) {
  const map = {
    TEXT: 'Texto',
    EMAIL: 'E-mail',
    PHONE: 'Telefone',
    NUMBER: 'Número',
    DATE: 'Data',
    SELECT: 'Seleção',
    RADIO: 'Múltipla escolha',
    CHECKBOX: 'Checkbox',
    TEXTAREA: 'Texto longo',
  };
  return map[type] || type;
}

function emptyField(overrides = {}) {
  return {
    type: 'TEXT',
    label: '',
    placeholder: '',
    required: false,
    optionsText: '',
    ...overrides,
  };
}

function parseOptions(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((label) => ({
      value: label
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '_'),
      label,
    }));
}

function optionsToText(options) {
  if (!Array.isArray(options)) return '';
  return options.map((o) => o.label || o.value).join('\n');
}

function LivePreview({ name, description, fields, submitLabel }) {
  return (
    <div className="forms-live-preview">
      <div className="forms-live-preview__chrome">
        <span />
        <span />
        <span />
      </div>
      <div className="forms-live-preview__card">
        <p className="forms-live-preview__brand">Lead Capture</p>
        <h3>{name.trim() || 'Nome do formulário'}</h3>
        <p>
          {description.trim() ||
            'A descrição do formulário aparece aqui para o visitante.'}
        </p>
        <div className="forms-preview">
          {fields.map((field, index) => {
            const label = field.label.trim() || `Campo ${index + 1}`;
            const needsOptions = ['SELECT', 'RADIO', 'CHECKBOX'].includes(
              field.type
            );
            const options = parseOptions(field.optionsText);
            return (
              <label key={index} className="field">
                <span className="field-label">
                  {label}
                  {field.required ? ' *' : ''}
                </span>
                {field.type === 'TEXTAREA' ? (
                  <textarea
                    className="input forms-textarea"
                    placeholder={field.placeholder || ''}
                    disabled
                    rows={3}
                  />
                ) : null}
                {['TEXT', 'EMAIL', 'PHONE', 'NUMBER', 'DATE'].includes(
                  field.type
                ) ? (
                  <input
                    className="input"
                    disabled
                    placeholder={field.placeholder || ''}
                    type="text"
                  />
                ) : null}
                {field.type === 'SELECT' ? (
                  <select className="input" disabled>
                    <option>Selecione</option>
                    {options.map((opt) => (
                      <option key={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                ) : null}
                {needsOptions && field.type !== 'SELECT' ? (
                  <div className="forms-preview__options">
                    {(options.length ? options : [{ value: 'x', label: 'Opção' }]).map(
                      (opt) => (
                        <label key={opt.value} className="wizard-check">
                          <input type={field.type === 'RADIO' ? 'radio' : 'checkbox'} disabled />
                          {opt.label}
                        </label>
                      )
                    )}
                  </div>
                ) : null}
              </label>
            );
          })}
          <button className="btn btn-primary" type="button" disabled>
            {submitLabel.trim() || 'Enviar'}
          </button>
          <p className="forms-live-preview__secure">
            Seus dados estão seguros.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function FormBuilder() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitLabel, setSubmitLabel] = useState('Enviar');
  const [fields, setFields] = useState([
    emptyField({
      label: 'Nome completo',
      placeholder: 'Digite seu nome',
      required: true,
    }),
  ]);
  const [copied, setCopied] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [expandedIndex, setExpandedIndex] = useState(0);

  useEffect(() => {
    if (!isEdit) return;
    async function load() {
      setLoading(true);
      try {
        const data = await formsApi.getById(id);
        const form = data.form;
        setName(form.name || '');
        setDescription(form.description || '');
        setSubmitLabel(form.submitLabel || 'Enviar');
        setFields(
          (form.fields || []).map((field) => ({
            type: field.type,
            label: field.label,
            placeholder: field.placeholder || '',
            required: Boolean(field.required),
            optionsText: optionsToText(field.options),
          }))
        );
        if (searchParams.get('created') === '1') {
          setShowSuccess(true);
        }
      } catch (err) {
        setError(err?.response?.data?.message || 'Falha ao carregar formulário.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, isEdit, searchParams]);

  function updateField(index, patch) {
    setFields((current) =>
      current.map((field, i) => (i === index ? { ...field, ...patch } : field))
    );
  }

  function addFieldFromPreset(preset) {
    setFields((current) => {
      const next = [
        ...current,
        emptyField({
          type: preset.type,
          label: preset.fieldLabel,
          placeholder: preset.placeholder || '',
          required: Boolean(preset.required),
          optionsText: preset.optionsText || '',
        }),
      ];
      setExpandedIndex(next.length - 1);
      return next;
    });
    setTypeMenuOpen(false);
  }

  function removeField(index) {
    setFields((current) => {
      const next = current.filter((_, i) => i !== index);
      setExpandedIndex((open) => {
        if (next.length === 0) return 0;
        if (open === index) return Math.max(0, index - 1);
        if (open > index) return open - 1;
        return open;
      });
      return next;
    });
  }

  function onDragStart(index) {
    setDragIndex(index);
  }

  function onDragOver(event, index) {
    event.preventDefault();
    if (dragIndex == null || dragIndex === index) return;
    setFields((current) => {
      const next = [...current];
      const [item] = next.splice(dragIndex, 1);
      next.splice(index, 0, item);
      return next;
    });
    setDragIndex(index);
  }

  function onDragEnd() {
    setDragIndex(null);
  }

  const payloadFields = useMemo(
    () =>
      fields.map((field, position) => {
        const needsOptions = ['SELECT', 'RADIO', 'CHECKBOX'].includes(field.type);
        return {
          type: field.type,
          label: field.label.trim(),
          placeholder: field.placeholder.trim() || null,
          required: Boolean(field.required),
          position,
          options: needsOptions ? parseOptions(field.optionsText) : null,
        };
      }),
    [fields]
  );

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        submitLabel: submitLabel.trim() || 'Enviar',
        fields: payloadFields,
      };

      if (isEdit) {
        await formsApi.update(id, payload);
        setShowSuccess(false);
        navigate('/forms');
        return;
      }

      const created = await formsApi.create(payload);
      navigate(`/forms/${created.form.id}?created=1`, { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message || 'Falha ao salvar formulário.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="forms-page">
        <p className="forms-page__hint">Carregando...</p>
      </div>
    );
  }

  if (showSuccess && isEdit) {
    const publicUrl = getFormPublicUrl(id);
    return (
      <div className="forms-page forms-page--narrow">
        <section className="forms-success">
          <div className="forms-success__icon" aria-hidden="true">
            <span className="material-symbols-outlined">check_circle</span>
          </div>
          <h1>Formulário criado com sucesso</h1>
          <p>Seu formulário já está disponível para receber leads.</p>

          <div className="forms-success__link-box">
            <span>Link público</span>
            <strong>{publicUrl}</strong>
          </div>

          <div className="forms-success__actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={async () => {
                await copyFormPublicLink(id);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? 'Link copiado!' : 'Copiar link'}
            </button>
            <a
              className="btn btn-secondary"
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
            >
              Abrir formulário
            </a>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setShowSuccess(false);
                const next = new URLSearchParams(searchParams);
                next.delete('created');
                setSearchParams(next, { replace: true });
              }}
            >
              Continuar editando
            </button>
          </div>

          <p className="forms-success__note">
            Toda nova resposta será adicionada automaticamente aos seus leads.
          </p>
          <Link className="forms-success__back" to="/forms">
            Voltar para formulários
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="forms-page forms-page--wide">
      <header className="page-header forms-page__header">
        <div className="page-header__copy">
          <h1 className="page-header__title">
            {isEdit ? 'Editar formulário' : 'Novo formulário'}
          </h1>
          <p className="page-header__subtitle">
            {isEdit
              ? 'Ajuste os campos e o texto do botão. O link público continua o mesmo.'
              : 'Monte os campos e gere um link público para capturar leads.'}
          </p>
        </div>
        <div className="page-header__actions forms-builder__header-actions">
          {isEdit ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={async () => {
                await copyFormPublicLink(id);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? 'Link copiado!' : 'Copiar link'}
            </button>
          ) : null}
          <Link className="btn btn-ghost" to="/forms">
            Voltar para formulários
          </Link>
        </div>
      </header>

      {error ? <p className="forms-page__error-banner">{error}</p> : null}

      <div className="forms-builder-layout">
        <section className="forms-builder-pane">
          <div className="forms-builder-pane__top">
            <h2>Configuração</h2>

            <label className="field">
              <span className="field-label">Nome do formulário</span>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seguro Auto"
              />
            </label>

            <label className="field">
              <span className="field-label">Descrição</span>
              <textarea
                className="input forms-textarea forms-textarea--compact"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Solicite sua cotação e entraremos em contato."
                rows={2}
              />
            </label>

            <label className="field">
              <span className="field-label">Texto do botão</span>
              <input
                className="input"
                value={submitLabel}
                onChange={(e) => setSubmitLabel(e.target.value)}
                placeholder="Solicitar cotação"
              />
            </label>
          </div>

          <div className="forms-builder-fields">
            <div className="forms-builder__fields-header">
              <h3>Campos</h3>
              <div className="forms-add-field">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setTypeMenuOpen((open) => !open)}
                >
                  + Adicionar campo
                </button>
                {typeMenuOpen ? (
                  <div className="forms-add-field__menu">
                    <p className="forms-add-field__title">
                      Qual campo deseja criar?
                    </p>
                    {FIELD_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => addFieldFromPreset(preset)}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="forms-field-list">
              {fields.map((field, index) => {
                const needsOptions = ['SELECT', 'RADIO', 'CHECKBOX'].includes(
                  field.type
                );
                const isOpen = expandedIndex === index;
                return (
                  <div
                    key={index}
                    className={`forms-field-card${
                      dragIndex === index ? ' is-dragging' : ''
                    }${isOpen ? ' is-open' : ''}`}
                    draggable
                    onDragStart={() => onDragStart(index)}
                    onDragOver={(event) => onDragOver(event, index)}
                    onDragEnd={onDragEnd}
                  >
                    <button
                      type="button"
                      className="forms-field-card__summary"
                      onClick={() =>
                        setExpandedIndex((current) =>
                          current === index ? -1 : index
                        )
                      }
                    >
                      <span
                        className="forms-field-card__drag"
                        title="Arrastar"
                        onMouseDown={(event) => event.stopPropagation()}
                      >
                        ⋮⋮
                      </span>
                      <strong>
                        {field.label.trim() || `Campo ${index + 1}`}
                      </strong>
                      <span className="forms-field-card__type">
                        {typeLabel(field.type)}
                      </span>
                      {field.required ? (
                        <span className="forms-field-card__required-tag">
                          Obrigatório
                        </span>
                      ) : null}
                      <span
                        className="material-symbols-outlined forms-field-card__chevron"
                        aria-hidden="true"
                      >
                        {isOpen ? 'expand_less' : 'chevron_right'}
                      </span>
                    </button>

                    {isOpen ? (
                      <div className="forms-field-card__body">
                        <div className="forms-field-card__row">
                          <label className="field">
                            <span className="field-label">Label</span>
                            <input
                              className="input"
                              value={field.label}
                              onChange={(e) =>
                                updateField(index, { label: e.target.value })
                              }
                              placeholder="Nome completo"
                            />
                          </label>
                          <label className="field">
                            <span className="field-label">Tipo</span>
                            <select
                              className="input"
                              value={field.type}
                              onChange={(e) =>
                                updateField(index, { type: e.target.value })
                              }
                            >
                              {FIELD_TYPES.map((type) => (
                                <option key={type} value={type}>
                                  {typeLabel(type)}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>

                        <label className="field">
                          <span className="field-label">Placeholder</span>
                          <input
                            className="input"
                            value={field.placeholder}
                            onChange={(e) =>
                              updateField(index, {
                                placeholder: e.target.value,
                              })
                            }
                          />
                        </label>

                        <div className="forms-field-card__body-actions">
                          <label className="wizard-check">
                            <input
                              type="checkbox"
                              checked={field.required}
                              onChange={(e) =>
                                updateField(index, {
                                  required: e.target.checked,
                                })
                              }
                            />
                            Campo obrigatório
                          </label>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => removeField(index)}
                            disabled={fields.length <= 1}
                          >
                            Excluir
                          </button>
                        </div>

                        {needsOptions ? (
                          <label className="field">
                            <span className="field-label">
                              Opções (uma por linha)
                            </span>
                            <textarea
                              className="input forms-textarea forms-textarea--compact"
                              value={field.optionsText}
                              onChange={(e) =>
                                updateField(index, {
                                  optionsText: e.target.value,
                                })
                              }
                              placeholder={'Opção 1\nOpção 2'}
                              rows={3}
                            />
                          </label>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="forms-builder__footer">
            <Link className="btn btn-secondary" to="/forms">
              Cancelar
            </Link>
            <button
              type="button"
              className="btn btn-primary"
              disabled={saving || name.trim().length < 3}
              onClick={handleSave}
            >
              {saving
                ? 'Salvando...'
                : isEdit
                  ? 'Salvar alterações'
                  : 'Criar formulário'}
            </button>
          </div>
        </section>

        <aside className="forms-builder-preview-pane">
          <h2>Pré-visualização</h2>
          <div className="forms-builder-preview-pane__scroll">
            <LivePreview
              name={name}
              description={description}
              fields={fields}
              submitLabel={submitLabel}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
