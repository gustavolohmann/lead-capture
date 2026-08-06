import { useEffect, useState } from 'react';
import { automationsApi } from '../../services/automations.api.js';
import './Automations.css';

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
      <header className="automations-page__header">
        <h1 className="text-h2">Automações</h1>
        <p className="text-subtitle automations-page__subtitle">
          Follow-up automático no trigger NEW_LEAD.
        </p>
      </header>

      <section className="card automations-page__card">
        <h2 className="automations-page__section">Nova automação</h2>
        <form className="automations-form" onSubmit={handleCreate}>
          <label className="field">
            <span className="field-label">Nome</span>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
              required
              minLength={3}
            />
          </label>

          <label className="field">
            <span className="field-label">Canal</span>
            <select
              className="input"
              value={form.channel}
              onChange={(e) =>
                setForm((c) => ({ ...c, channel: e.target.value }))
              }
            >
              <option value="AUTO">AUTO (WhatsApp → Instagram → skip)</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="INSTAGRAM">Instagram</option>
            </select>
          </label>

          <label className="field">
            <span className="field-label">Delay (minutos)</span>
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
          </label>

          <p className="automations-hint">
            Variáveis: {'{{name}}'}, {'{{email}}'}, {'{{phone}}'} · Trigger: NEW_LEAD
          </p>

          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Salvando...' : 'Criar automação'}
          </button>
        </form>
      </section>

      <section className="card automations-page__card">
        <h2 className="automations-page__section">Lista</h2>
        {loading ? <p className="text-body">Carregando...</p> : null}
        {error ? <p className="automations-page__error">{error}</p> : null}
        {info ? <p className="automations-page__info">{info}</p> : null}

        {!loading && items.length === 0 ? (
          <p className="text-body automations-empty">Nenhuma automação.</p>
        ) : null}

        {items.length > 0 ? (
          <table className="automations-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Canal</th>
                <th>Delay</th>
                <th>Status</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.channel}</td>
                  <td>{item.delayMinutes} min</td>
                  <td>{item.active ? 'ATIVA' : 'INATIVA'}</td>
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
