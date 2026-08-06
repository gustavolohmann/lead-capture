import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
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

function emptyField() {
  return {
    type: 'TEXT',
    label: '',
    placeholder: '',
    required: false,
    optionsText: '',
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

export default function FormBuilder() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState([emptyField()]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    async function load() {
      setLoading(true);
      try {
        const data = await formsApi.getById(id);
        const form = data.form;
        setName(form.name || '');
        setDescription(form.description || '');
        setFields(
          (form.fields || []).map((field) => ({
            type: field.type,
            label: field.label,
            placeholder: field.placeholder || '',
            required: Boolean(field.required),
            optionsText: optionsToText(field.options),
          }))
        );
      } catch (err) {
        setError(err?.response?.data?.message || 'Falha ao carregar formulário.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, isEdit]);

  function updateField(index, patch) {
    setFields((current) =>
      current.map((field, i) => (i === index ? { ...field, ...patch } : field))
    );
  }

  function addField() {
    setFields((current) => [...current, emptyField()]);
  }

  function removeField(index) {
    setFields((current) => current.filter((_, i) => i !== index));
  }

  function moveField(index, direction) {
    setFields((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      const tmp = next[index];
      next[index] = next[target];
      next[target] = tmp;
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        fields: fields.map((field, position) => {
          const needsOptions = ['SELECT', 'RADIO', 'CHECKBOX'].includes(
            field.type
          );
          return {
            type: field.type,
            label: field.label.trim(),
            placeholder: field.placeholder.trim() || null,
            required: Boolean(field.required),
            position,
            options: needsOptions ? parseOptions(field.optionsText) : null,
          };
        }),
      };

      if (isEdit) {
        await formsApi.update(id, payload);
      } else {
        const created = await formsApi.create(payload);
        navigate(`/forms/${created.form.id}`, { replace: true });
        return;
      }
      navigate('/forms');
    } catch (err) {
      setError(err?.response?.data?.message || 'Falha ao salvar formulário.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="forms-page">
        <p className="text-body">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="forms-page">
      <header className="forms-page__header">
        <div>
          <h1 className="text-h2">
            {isEdit ? 'Editar formulário' : 'Novo formulário'}
          </h1>
          <p className="text-subtitle forms-page__subtitle">
            Campos 100% personalizados por empresa.
          </p>
        </div>
        <div className="forms-builder__header-actions">
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
              {copied ? 'Link copiado!' : 'Copiar link público'}
            </button>
          ) : null}
          <Link className="btn btn-secondary" to="/forms">
            Voltar
          </Link>
        </div>
      </header>

      {isEdit ? (
        <p className="forms-page__public-url">
          Link público:{' '}
          <a href={getFormPublicUrl(id)} target="_blank" rel="noreferrer">
            {getFormPublicUrl(id)}
          </a>
        </p>
      ) : null}

      <section className="card forms-page__card forms-builder">
        <label className="field">
          <span className="field-label">Nome</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Formulário Seguro Auto"
          />
        </label>
        <label className="field">
          <span className="field-label">Descrição</span>
          <input
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Captura de leads do segmento..."
          />
        </label>

        <div className="forms-builder__fields-header">
          <h2 className="forms-page__section-title">Campos</h2>
          <button type="button" className="btn btn-secondary" onClick={addField}>
            + Adicionar campo
          </button>
        </div>

        {fields.map((field, index) => {
          const needsOptions = ['SELECT', 'RADIO', 'CHECKBOX'].includes(
            field.type
          );
          return (
            <div key={index} className="forms-field-card">
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
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="forms-field-card__row">
                <label className="field">
                  <span className="field-label">Placeholder</span>
                  <input
                    className="input"
                    value={field.placeholder}
                    onChange={(e) =>
                      updateField(index, { placeholder: e.target.value })
                    }
                  />
                </label>
                <label className="wizard-check forms-field-card__required">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) =>
                      updateField(index, { required: e.target.checked })
                    }
                  />
                  Obrigatório
                </label>
              </div>

              {needsOptions ? (
                <label className="field">
                  <span className="field-label">Opções (uma por linha)</span>
                  <textarea
                    className="input forms-textarea"
                    value={field.optionsText}
                    onChange={(e) =>
                      updateField(index, { optionsText: e.target.value })
                    }
                    placeholder={'Auto\nVida\nResidencial'}
                    rows={4}
                  />
                </label>
              ) : null}

              <div className="forms-field-card__actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => moveField(index, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => moveField(index, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => removeField(index)}
                  disabled={fields.length <= 1}
                >
                  Remover
                </button>
              </div>
            </div>
          );
        })}

        {error ? <p className="forms-page__error">{error}</p> : null}

        <div className="forms-builder__footer">
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving || name.trim().length < 3}
            onClick={handleSave}
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </section>
    </div>
  );
}
