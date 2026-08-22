import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formsApi } from '../../services/forms.api.js';
import './Forms.css';

export default function FormPreview() {
  const { id } = useParams();
  const [form, setForm] = useState(null);
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await formsApi.getPublic(id);
        setForm(data.form);
        const initial = {};
        for (const field of data.form.fields || []) {
          initial[field.id] =
            field.type === 'CHECKBOX' ? [] : '';
        }
        setValues(initial);
      } catch (err) {
        setError(err?.response?.data?.message || 'Formulário indisponível.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  function setValue(fieldId, value) {
    setValues((current) => ({ ...current, [fieldId]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const answers = (form.fields || []).map((field) => ({
        field_id: field.id,
        value: values[field.id],
      }));
      const result = await formsApi.submit(id, answers);
      setSuccess(`Lead criado #${result.lead?.id}`);
    } catch (err) {
      setError(err?.response?.data?.message || 'Falha ao enviar.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="forms-page">
        <p className="text-body">Carregando preview...</p>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="forms-page">
        <p className="forms-page__error">{error || 'Formulário não encontrado.'}</p>
        <Link className="btn btn-secondary" to="/forms">
          Voltar
        </Link>
      </div>
    );
  }

  return (
    <div className="forms-page">
      <header className="forms-page__header">
        <div>
          <h1 className="text-h2">{form.name}</h1>
          <p className="text-subtitle forms-page__subtitle">
            {form.description || 'Preview / teste de envio'}
          </p>
        </div>
        <Link className="btn btn-secondary" to="/forms">
          Voltar
        </Link>
      </header>

      <section className="card forms-page__card">
        <form className="forms-preview" onSubmit={handleSubmit}>
          {(form.fields || []).map((field) => (
            <label key={field.id} className="field">
              <span className="field-label">
                {field.label}
                {field.required ? ' *' : ''}
              </span>

              {field.type === 'TEXTAREA' ? (
                <textarea
                  className="input forms-textarea"
                  placeholder={field.placeholder || ''}
                  value={values[field.id] || ''}
                  onChange={(e) => setValue(field.id, e.target.value)}
                  required={field.required}
                  rows={4}
                />
              ) : null}

              {['TEXT', 'EMAIL', 'PHONE', 'NUMBER', 'DATE'].includes(
                field.type
              ) ? (
                <input
                  className="input"
                  type={
                    field.type === 'EMAIL'
                      ? 'email'
                      : field.type === 'NUMBER'
                        ? 'number'
                        : field.type === 'DATE'
                          ? 'date'
                          : field.type === 'PHONE'
                            ? 'tel'
                            : 'text'
                  }
                  placeholder={field.placeholder || ''}
                  value={values[field.id] || ''}
                  onChange={(e) => setValue(field.id, e.target.value)}
                  required={field.required}
                />
              ) : null}

              {field.type === 'SELECT' ? (
                <select
                  className="input"
                  value={values[field.id] || ''}
                  onChange={(e) => setValue(field.id, e.target.value)}
                  required={field.required}
                >
                  <option value="">Selecione</option>
                  {(field.options || []).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : null}

              {field.type === 'RADIO' ? (
                <div className="forms-preview__options">
                  {(field.options || []).map((opt) => (
                    <label key={opt.value} className="wizard-check">
                      <input
                        type="radio"
                        name={`field_${field.id}`}
                        checked={values[field.id] === opt.value}
                        onChange={() => setValue(field.id, opt.value)}
                        required={field.required}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              ) : null}

              {field.type === 'CHECKBOX' ? (
                <div className="forms-preview__options">
                  {(field.options || []).map((opt) => {
                    const selected = Array.isArray(values[field.id])
                      ? values[field.id]
                      : [];
                    return (
                      <label key={opt.value} className="wizard-check">
                        <input
                          type="checkbox"
                          checked={selected.includes(opt.value)}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...selected, opt.value]
                              : selected.filter((v) => v !== opt.value);
                            setValue(field.id, next);
                          }}
                        />
                        {opt.label}
                      </label>
                    );
                  })}
                </div>
              ) : null}
            </label>
          ))}

          {error ? <p className="forms-page__error">{error}</p> : null}
          {success ? <p className="forms-page__success">{success}</p> : null}

          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Enviando...' : `${form.submitLabel || 'Enviar'} (teste)`}
          </button>
        </form>
      </section>
    </div>
  );
}
