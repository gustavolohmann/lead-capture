import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { conversationsApi } from '../../services/conversations.api.js';
import { useSocket } from '../../hooks/useSocket.js';
import ConversationUserInfo from '../../components/ConversationUserInfo/ConversationUserInfo.jsx';
import './Conversations.css';

function messageKey(msg) {
  return msg?.id ?? msg?.externalMessageId ?? null;
}

function upsertMessage(list, incoming) {
  const key = messageKey(incoming);
  if (key == null) return list;
  if (list.some((item) => messageKey(item) === key)) return list;
  return [...list, incoming];
}

function formatTime(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function toThreadMessage(payloadMessage) {
  return {
    id: payloadMessage.id,
    conversationId: payloadMessage.conversationId,
    direction: payloadMessage.direction,
    content: payloadMessage.content,
    externalMessageId: payloadMessage.externalMessageId ?? null,
    status: payloadMessage.status,
    createdAt: payloadMessage.createdAt,
  };
}

export default function Conversations() {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    lastMessageEvent,
    lastConversationEvent,
    joinConversation,
    leaveConversation,
    refreshUnread,
  } = useSocket();

  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [contact, setContact] = useState(null);
  const [contactLoading, setContactLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const selectedIdRef = useRef(null);
  const handledMessageEventRef = useRef(null);
  const handledConversationEventRef = useRef(null);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  async function loadConversations() {
    setLoading(true);
    setError('');
    try {
      const data = await conversationsApi.list();
      setConversations(
        (data.conversations || []).map((item) => ({
          ...item,
          unreadCount: item.unreadCount || 0,
        }))
      );
    } catch (err) {
      setError(err?.response?.data?.message || 'Falha ao carregar conversas.');
    } finally {
      setLoading(false);
    }
  }

  async function openConversation(id) {
    const conversationId = Number(id);
    if (!Number.isFinite(conversationId)) return;

    if (selectedIdRef.current && selectedIdRef.current !== conversationId) {
      leaveConversation(selectedIdRef.current);
    }

    setSelectedId(conversationId);
    setError('');
    setContactLoading(true);
    joinConversation(conversationId);

    setConversations((prev) =>
      prev.map((item) =>
        item.id === conversationId ? { ...item, unreadCount: 0 } : item
      )
    );

    try {
      const [messagesRes, contactRes] = await Promise.all([
        conversationsApi.listMessages(conversationId),
        conversationsApi.getContact(conversationId),
      ]);
      setMessages(messagesRes.messages || []);
      setContact(contactRes.contact || null);
      await refreshUnread();
    } catch (err) {
      setError(err?.response?.data?.message || 'Falha ao carregar mensagens.');
    } finally {
      setContactLoading(false);
    }
  }

  useEffect(() => {
    loadConversations();
    return () => {
      if (selectedIdRef.current) {
        leaveConversation(selectedIdRef.current);
      }
    };
  }, [leaveConversation]);

  useEffect(() => {
    const queryId = Number(searchParams.get('c'));
    if (Number.isFinite(queryId) && queryId > 0 && queryId !== selectedId) {
      openConversation(queryId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (!lastMessageEvent?.receivedAt) return;
    if (handledMessageEventRef.current === lastMessageEvent.receivedAt) return;
    handledMessageEventRef.current = lastMessageEvent.receivedAt;

    const payload = lastMessageEvent.message;
    if (!payload?.id || !payload?.conversationId) return;

    const isOpen =
      Number(selectedIdRef.current) === Number(payload.conversationId);

    if (isOpen) {
      setMessages((prev) => upsertMessage(prev, toThreadMessage(payload)));
    }

    setConversations((prev) => {
      const exists = prev.some((item) => item.id === payload.conversationId);
      if (!exists) {
        loadConversations();
        return prev;
      }

      return prev
        .map((item) => {
          if (item.id !== payload.conversationId) return item;
          return {
            ...item,
            lastMessagePreview: payload.content,
            lastMessageAt: payload.createdAt,
            lastMessageDirection: payload.direction,
            unreadCount:
              !isOpen && payload.direction === 'INBOUND'
                ? Number(item.unreadCount || 0) + 1
                : item.unreadCount || 0,
            updatedAt: payload.createdAt,
          };
        })
        .sort(
          (a, b) =>
            new Date(b.lastMessageAt || b.updatedAt || 0) -
            new Date(a.lastMessageAt || a.updatedAt || 0)
        );
    });
  }, [lastMessageEvent]);

  useEffect(() => {
    if (!lastConversationEvent?.receivedAt) return;
    if (handledConversationEventRef.current === lastConversationEvent.receivedAt) {
      return;
    }
    handledConversationEventRef.current = lastConversationEvent.receivedAt;

    const conversation = lastConversationEvent.conversation;
    if (!conversation?.id) return;

    setConversations((prev) => {
      if (!prev.some((item) => item.id === conversation.id)) return prev;
      return prev
        .map((item) =>
          item.id === conversation.id
            ? {
                ...item,
                lastMessagePreview:
                  conversation.lastMessagePreview ?? item.lastMessagePreview,
                lastMessageAt: conversation.lastMessageAt ?? item.lastMessageAt,
                lastMessageDirection:
                  conversation.lastMessageDirection ?? item.lastMessageDirection,
              }
            : item
        )
        .sort(
          (a, b) =>
            new Date(b.lastMessageAt || b.updatedAt || 0) -
            new Date(a.lastMessageAt || a.updatedAt || 0)
        );
    });
  }, [lastConversationEvent]);

  async function handleSend(event) {
    event.preventDefault();
    if (!selectedId || !draft.trim()) return;
    setSending(true);
    setError('');
    try {
      const res = await conversationsApi.sendMessage(selectedId, draft.trim());
      setDraft('');
      if (res?.message) {
        setMessages((prev) => upsertMessage(prev, res.message));
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Falha ao enviar mensagem.');
    } finally {
      setSending(false);
    }
  }

  function handleSelectConversation(id) {
    setSearchParams({ c: String(id) });
    openConversation(id);
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
              onClick={() => handleSelectConversation(item.id)}
            >
              <div className="conversations-item__top">
                <strong>{item.leadName || `Lead #${item.leadId}`}</strong>
                <span className="conversations-item__time">
                  {formatTime(item.lastMessageAt || item.updatedAt)}
                </span>
              </div>
              <span className="conversations-item__preview">
                {item.lastMessagePreview || `${item.channel} · ${item.status}`}
              </span>
              <div className="conversations-item__meta">
                <span>{item.channel}</span>
                {item.unreadCount > 0 ? (
                  <span className="conversations-item__unread">
                    {item.unreadCount}
                  </span>
                ) : null}
              </div>
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
                    key={messageKey(msg)}
                    className={`conversations-bubble conversations-bubble--${String(msg.direction || '').toLowerCase()}`}
                  >
                    <p>{msg.content}</p>
                    <small>
                      {msg.status}
                      {msg.createdAt ? ` · ${formatTime(msg.createdAt)}` : ''}
                    </small>
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

        <ConversationUserInfo contact={contact} loading={contactLoading} />
      </div>
    </div>
  );
}
