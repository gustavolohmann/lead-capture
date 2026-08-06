import { useEffect, useState } from 'react';
import { conversationsApi } from '../../services/conversations.api.js';
import './Conversations.css';

export default function Conversations() {
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function loadConversations() {
    setLoading(true);
    setError('');
    try {
      const data = await conversationsApi.list();
      setConversations(data.conversations || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Falha ao carregar conversas.');
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages(id) {
    setSelectedId(id);
    setError('');
    try {
      const data = await conversationsApi.listMessages(id);
      setMessages(data.messages || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Falha ao carregar mensagens.');
    }
  }

  useEffect(() => {
    loadConversations();
  }, []);

  async function handleSend(event) {
    event.preventDefault();
    if (!selectedId || !draft.trim()) return;
    setSending(true);
    setError('');
    try {
      await conversationsApi.sendMessage(selectedId, draft.trim());
      setDraft('');
      await loadMessages(selectedId);
      await loadConversations();
    } catch (err) {
      setError(err?.response?.data?.message || 'Falha ao enviar mensagem.');
    } finally {
      setSending(false);
    }
  }

  const selected = conversations.find((item) => item.id === selectedId);

  return (
    <div className="conversations-page">
      <header className="conversations-page__header">
        <h1 className="text-h2">Conversas</h1>
        <p className="text-subtitle conversations-page__subtitle">
          Histórico WhatsApp / Instagram por lead.
        </p>
      </header>

      {error ? <p className="conversations-page__error">{error}</p> : null}

      <div className="conversations-layout">
        <aside className="card conversations-list">
          {loading ? <p className="text-body">Carregando...</p> : null}
          {!loading && conversations.length === 0 ? (
            <p className="text-body conversations-empty">Nenhuma conversa ainda.</p>
          ) : null}
          {conversations.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`conversations-item${selectedId === item.id ? ' is-active' : ''}`}
              onClick={() => loadMessages(item.id)}
            >
              <strong>{item.leadName || `Lead #${item.leadId}`}</strong>
              <span>
                {item.channel} · {item.status}
              </span>
            </button>
          ))}
        </aside>

        <section className="card conversations-thread">
          {!selectedId ? (
            <p className="text-body conversations-empty">
              Selecione uma conversa para ver o histórico.
            </p>
          ) : (
            <>
              <div className="conversations-thread__header">
                <h2>{selected?.leadName || `Lead #${selected?.leadId}`}</h2>
                <span>{selected?.channel}</span>
              </div>
              <div className="conversations-thread__messages">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`conversations-bubble conversations-bubble--${msg.direction.toLowerCase()}`}
                  >
                    <p>{msg.content}</p>
                    <small>{msg.status}</small>
                  </div>
                ))}
              </div>
              <form className="conversations-composer" onSubmit={handleSend}>
                <input
                  className="input"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Escreva uma mensagem..."
                />
                <button className="btn btn-primary" type="submit" disabled={sending}>
                  {sending ? 'Enviando...' : 'Enviar'}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
