import { useEffect, useState } from 'react';
import { automationsApi } from '../../services/automations.api.js';
import './Automations.css';

const CHANNEL_LABEL = {
  AUTO: 'Automático',
  WHATSAPP: 'WhatsApp',
  INSTAGRAM: 'Instagram',
};

const EMPTY_FORM = {
  name: '',
  channel: 'AUTO',
  delayMinutes: '5',
  message:
    'Olá {{name}}, recebemos seu interesse. Em breve nossa equipe fala com você.',
};

export default function Automations() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await automationsApi.list();
      setItems(data.automations || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Falha ao carregar automações.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setInfo('');
    try {
      await automationsApi.create({
        name: form.name,
        trigger: 'NEW_LEAD',
        channel: form.channel,
        delayMinutes: Number(form.delayMinutes),
        message: form.message,
        active: true,
      });
      setInfo('Automação criada.');
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Falha ao criar automação.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item) {
    setError('');
    try {
      await automationsApi.setActive(item.id, !item.active);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Falha ao atualizar automação.');
    }
  }

  return (
    <div className="automations-page">
      <header className="page-header automations-page__header">
        <div className="page-header__copy">
          <h1 className="page-header__title">Automações</h1>
          <p className="page-header__subtitle">
            Follow-up automático quando um lead novo chega.
          </p>
        </div>
      </header>

      <section className="card automations-page__card">
        <h2 className="automations-page__section">Nova automação</h2>
        <form className="automations-form" onSubmit={handleCreate}>
          <label className="field automations-form__name">
            <span className="field-label">Nome da automação</span>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
              required
              minLength={3}
            />
          </label>

          <div className="automations-form__row">
            <label className="field">
              <span className="field-label">Canal de envio</span>
              <select
                className="input"
                value={form.channel}
                onChange={(e) =>
                  setForm((c) => ({ ...c, channel: e.target.value }))
                }
              >
                <option value="AUTO">
                  Automático (WhatsApp, depois Instagram)
                </option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="INSTAGRAM">Instagram</option>
              </select>
            </label>

            <label className="field">
              <span className="field-label">Enviar depois de (minutos)</span>
              <input
                className="input"
                type="number"
                min="0"
                value={form.delayMinutes}
                onChange={(e) =>
                  setForm((c) => ({ ...c, delayMinutes: e.target.value }))
                }
                required
              />
            </label>
          </div>

          <label className="field">
            <span className="field-label">Mensagem</span>
            <textarea
              className="input automations-textarea"
              value={form.message}
              onChange={(e) =>
                setForm((c) => ({ ...c, message: e.target.value }))
              }
              required
              rows={4}
            />
            <span className="automations-hint">
              Variáveis: {'{{name}}'}, {'{{email}}'}, {'{{phone}}'} · Disparo:
              lead novo
            </span>
          </label>

          <div className="automations-form__footer">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Criar automação'}
            </button>
          </div>
        </form>
      </section>

      <section className="card automations-page__card">
        <h2 className="automations-page__section">Automações ativas</h2>
        {loading ? <p className="text-body">Carregando automações...</p> : null}
        {error ? <p className="automations-page__error">{error}</p> : null}
        {info ? <p className="automations-page__info">{info}</p> : null}

        {!loading && items.length === 0 ? (
          <div className="ui-empty automations-empty">
            <p className="ui-empty__title">Nenhuma automação ativa</p>
            <p className="ui-empty__text">
              Crie a primeira acima para enviar follow-up automático quando um
              lead novo chegar.
            </p>
          </div>
        ) : null}

        {items.length > 0 ? (
          <table className="automations-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Canal</th>
                <th>Atraso</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.name}</strong>
                  </td>
                  <td>{CHANNEL_LABEL[item.channel] || item.channel}</td>
                  <td>{item.delayMinutes} min</td>
                  <td>
                    <span
                      className={`badge ${item.active ? 'badge-success' : 'badge-neutral'}`}
                    >
                      {item.active ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => toggleActive(item)}
                    >
                      {item.active ? 'Desativar' : 'Ativar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
    </div>
  );
}
