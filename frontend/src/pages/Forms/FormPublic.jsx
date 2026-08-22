import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { formsApi } from '../../services/forms.api.js';
import './Forms.css';

export default function FormPublic() {
  const { id } = useParams();
  const [form, setForm] = useState(null);
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await formsApi.getPublic(id);
        setForm(data.form);
        const initial = {};
        for (const field of data.form.fields || []) {
          initial[field.id] = field.type === 'CHECKBOX' ? [] : '';
        }
        setValues(initial);
      } catch (err) {
        setError(
          err?.response?.data?.message || 'Este formulário não está disponível.'
        );
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
    try {
      const answers = (form.fields || []).map((field) => ({
        field_id: field.id,
        value: values[field.id],
      }));
      await formsApi.submit(id, answers);
      setDone(true);
    } catch (err) {
      setError(err?.response?.data?.message || 'Não foi possível enviar.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="form-public">
        <p className="text-body">Carregando formulário...</p>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="form-public">
        <div className="form-public__card">
          <h1 className="form-public__title">Formulário indisponível</h1>
          <p className="form-public__error">{error}</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="form-public">
        <div className="form-public__card">
          <p className="form-public__brand">Lead Capture</p>
          <h1 className="form-public__title">Recebemos seus dados</h1>
          <p className="form-public__subtitle">
            Obrigado! Em breve entraremos em contato.
          </p>
        </div>
      </div>
    );
  }

  const ctaLabel = form.submitLabel || 'Enviar';

  return (
    <div className="form-public">
      <div className="form-public__card">
        <p className="form-public__brand">Lead Capture</p>
        <header className="form-public__header">
          <h1 className="form-public__title">{form.name}</h1>
          {form.description ? (
            <p className="form-public__subtitle">{form.description}</p>
          ) : null}
        </header>

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

          {error ? <p className="form-public__error">{error}</p> : null}

          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Enviando...' : ctaLabel}
          </button>

          <p className="form-public__secure">
            <span className="material-symbols-outlined" aria-hidden="true">
              lock
            </span>
            Seus dados estão seguros.
          </p>
        </form>
      </div>
    </div>
  );
}
