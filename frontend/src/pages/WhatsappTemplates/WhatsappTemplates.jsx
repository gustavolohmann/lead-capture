import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { whatsappTemplatesApi } from '../../services/whatsappTemplates.api.js';
import './WhatsappTemplates.css';

const EMPTY_FORM = {
  name: '',
  language: 'pt_BR',
  category: 'UTILITY',
  headerText: '',
  bodyText: 'Olá {{1}}, recebemos seu interesse. Podemos falar agora?',
  bodyExamples: 'João',
  footerText: 'Lead Capture',
  buttonText: '',
};

const STATUS_LABEL = {
  PENDING: 'Em análise',
  APPROVED: 'Aprovado',
  REJECTED: 'Rejeitado',
  PAUSED: 'Pausado',
  DISABLED: 'Desativado',
  FLAGGED: 'Sinalizado',
  IN_APPEAL: 'Em apelação',
};

function statusClass(status) {
  if (status === 'APPROVED') return 'tpl-badge tpl-badge--ok';
  if (status === 'REJECTED') return 'tpl-badge tpl-badge--err';
  if (status === 'PENDING') return 'tpl-badge tpl-badge--pending';
  return 'tpl-badge';
}

function bodyPreview(template) {
  const body = (template.components || []).find(
    (c) => String(c.type).toUpperCase() === 'BODY'
  );
  return body?.text || '—';
}

export default function WhatsappTemplates() {
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await whatsappTemplatesApi.list();
      setTemplates(data.templates || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Falha ao carregar templates.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const preview = useMemo(() => {
    return {
      header: form.headerText || null,
      body: form.bodyText,
      footer: form.footerText || null,
      button: form.buttonText || null,
    };
  }, [form]);

  async function handleSync() {
    setSyncing(true);
    setError('');
    setInfo('');
    try {
      const data = await whatsappTemplatesApi.sync();
      setTemplates(data.templates || []);
      setInfo(`Sincronizado com a Meta (${data.synced || 0} templates).`);
    } catch (err) {
      setError(err?.response?.data?.message || 'Falha ao sincronizar.');
    } finally {
      setSyncing(false);
    }
  }

  async function handleCreate(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setInfo('');
    try {
      const examples = String(form.bodyExamples || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = {
        name: form.name.trim().toLowerCase(),
        language: form.language.trim() || 'pt_BR',
        category: form.category,
        header: form.headerText.trim()
          ? { format: 'TEXT', text: form.headerText.trim() }
          : null,
        body: {
          text: form.bodyText.trim(),
          examples,
        },
        footer: form.footerText.trim()
          ? { text: form.footerText.trim() }
          : null,
        buttons: form.buttonText.trim()
          ? [{ type: 'QUICK_REPLY', text: form.buttonText.trim() }]
          : [],
      };

      await whatsappTemplatesApi.create(payload);
      setInfo('Template enviado para aprovação na Meta.');
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Falha ao criar template.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="tpl-page">
      <header className="tpl-page__header">
        <div>
          <h1 className="text-h2">Templates WhatsApp</h1>
          <p className="text-subtitle tpl-page__subtitle">
            Crie templates no formato da Meta, envie para aprovação e use no
            follow-up. Variáveis: {'{{1}}'}, {'{{2}}'}, etc.
          </p>
        </div>
        <div className="tpl-page__actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? 'Sincronizando...' : 'Sincronizar com Meta'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? 'Fechar formulário' : 'Novo template'}
          </button>
        </div>
      </header>

      {error ? <p className="tpl-page__error">{error}</p> : null}
      {info ? <p className="tpl-page__success">{info}</p> : null}

      {showForm ? (
        <section className="tpl-builder card">
          <form className="tpl-builder__form" onSubmit={handleCreate}>
            <h2 className="tpl-builder__title">Criar template (Meta)</h2>

            <div className="tpl-builder__grid">
              <label className="field">
                <span className="field-label">Nome *</span>
                <input
                  className="input"
                  required
                  pattern="[a-z0-9_]+"
                  placeholder="lead_followup"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value.toLowerCase() }))
                  }
                />
              </label>

              <label className="field">
                <span className="field-label">Idioma *</span>
                <input
                  className="input"
                  required
                  value={form.language}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, language: e.target.value }))
                  }
                />
              </label>

              <label className="field">
                <span className="field-label">Categoria *</span>
                <select
                  className="input"
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category: e.target.value }))
                  }
                >
                  <option value="UTILITY">UTILITY</option>
                  <option value="MARKETING">MARKETING</option>
                  <option value="AUTHENTICATION">AUTHENTICATION</option>
                </select>
              </label>
            </div>

            <label className="field">
              <span className="field-label">Cabeçalho (opcional)</span>
              <input
                className="input"
                maxLength={60}
                value={form.headerText}
                onChange={(e) =>
                  setForm((f) => ({ ...f, headerText: e.target.value }))
                }
              />
            </label>

            <label className="field">
              <span className="field-label">Corpo *</span>
              <textarea
                className="input"
                required
                rows={4}
                value={form.bodyText}
                onChange={(e) =>
                  setForm((f) => ({ ...f, bodyText: e.target.value }))
                }
              />
            </label>

            <label className="field">
              <span className="field-label">
                Exemplos das variáveis (separados por vírgula)
              </span>
              <input
                className="input"
                placeholder="João, produto X"
                value={form.bodyExamples}
                onChange={(e) =>
                  setForm((f) => ({ ...f, bodyExamples: e.target.value }))
                }
              />
            </label>

            <label className="field">
              <span className="field-label">Rodapé (opcional)</span>
              <input
                className="input"
                maxLength={60}
                value={form.footerText}
                onChange={(e) =>
                  setForm((f) => ({ ...f, footerText: e.target.value }))
                }
              />
            </label>

            <label className="field">
              <span className="field-label">Botão resposta rápida (opcional)</span>
              <input
                className="input"
                maxLength={25}
                value={form.buttonText}
                onChange={(e) =>
                  setForm((f) => ({ ...f, buttonText: e.target.value }))
                }
              />
            </label>

            <div className="tpl-preview" aria-live="polite">
              <p className="tpl-preview__label">Prévia (estilo WhatsApp)</p>
              <div className="tpl-preview__bubble">
                {preview.header ? (
                  <strong className="tpl-preview__header">{preview.header}</strong>
                ) : null}
                <p className="tpl-preview__body">{preview.body}</p>
                {preview.footer ? (
                  <span className="tpl-preview__footer">{preview.footer}</span>
                ) : null}
                {preview.button ? (
                  <button type="button" className="tpl-preview__btn" disabled>
                    {preview.button}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="tpl-builder__submit">
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? 'Enviando...' : 'Enviar para aprovação'}
              </button>
              <Link className="btn btn-secondary" to="/campaigns">
                Ir para campanhas / follow-up
              </Link>
            </div>
          </form>
        </section>
      ) : null}

      <section className="card tpl-list">
        {loading ? (
          <p className="text-body">Carregando...</p>
        ) : templates.length === 0 ? (
          <div className="tpl-empty">
            <p>Nenhum template ainda.</p>
            <p className="text-subtitle">
              Crie um novo ou sincronize os já existentes na Meta.
            </p>
          </div>
        ) : (
          <div className="tpl-table-wrap">
            <table className="tpl-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Idioma</th>
                  <th>Categoria</th>
                  <th>Status</th>
                  <th>Rejeição</th>
                  <th>Corpo</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((tpl) => (
                  <tr key={tpl.id}>
                    <td>
                      <strong>{tpl.name}</strong>
                    </td>
                    <td>{tpl.language}</td>
                    <td>{tpl.category}</td>
                    <td>
                      <span className={statusClass(tpl.status)}>
                        {STATUS_LABEL[tpl.status] || tpl.status}
                      </span>
                    </td>
                    <td>
                      {tpl.status === 'REJECTED' ? (
                        <div className="tpl-reject">
                          <strong>{tpl.rejectedReason || 'UNKNOWN'}</strong>
                          {tpl.rejectionInfo?.reason ? (
                            <p>{tpl.rejectionInfo.reason}</p>
                          ) : null}
                          {tpl.rejectionInfo?.recommendation ? (
                            <p className="tpl-reject__rec">
                              {tpl.rejectionInfo.recommendation}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="tpl-table__body">{bodyPreview(tpl)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
