import { useEffect, useMemo, useRef, useState } from 'react';
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

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/**
 * Na lista, só a hora faz a fila parecer fora de ordem quando há conversas de
 * dias diferentes. Hoje mostra a hora; antes disso, o dia.
 */
function formatListTime(value) {
  if (!value) return '';
  try {
    const date = new Date(value);
    const days = Math.round(
      (startOfDay(new Date()) - startOfDay(date)) / 86400000
    );
    if (days <= 0) return formatTime(date);
    if (days === 1) return 'Ontem';
    if (days < 7) {
      return date
        .toLocaleDateString('pt-BR', { weekday: 'short' })
        .replace('.', '');
    }
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  } catch {
    return '';
  }
}

function formatMessageTime(value) {
  if (!value) return '';
  try {
    const date = new Date(value);
    const isToday = startOfDay(date).getTime() === startOfDay(new Date()).getTime();
    if (isToday) return formatTime(date);
    return `${date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    })} ${formatTime(date)}`;
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

function initialsFromName(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function channelClass(channel) {
  const value = String(channel || '').toUpperCase();
  if (value === 'WHATSAPP') return 'is-whatsapp';
  if (value === 'INSTAGRAM') return 'is-instagram';
  if (value === 'MESSENGER') return 'is-messenger';
  return 'is-default';
}

function channelLabel(channel) {
  const value = String(channel || '').toUpperCase();
  if (value === 'WHATSAPP') return 'WhatsApp';
  if (value === 'INSTAGRAM') return 'Instagram';
  if (value === 'MESSENGER') return 'Messenger';
  return channel || 'Canal';
}

function conversationStatusLabel(status) {
  const key = String(status || '').toUpperCase();
  const map = {
    OPEN: 'Aberta',
    CLOSED: 'Encerrada',
    PENDING: 'Pendente',
    ARCHIVED: 'Arquivada',
  };
  return map[key] || null;
}

function messageStatusLabel(status) {
  const key = String(status || '').toUpperCase();
  const map = {
    PENDING: 'Pendente',
    SENT: 'Enviada',
    DELIVERED: 'Entregue',
    READ: 'Lida',
    FAILED: 'Falhou',
    ERROR: 'Falhou',
  };
  return map[key] || null;
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
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState('ALL');
  const selectedIdRef = useRef(null);
  const handledMessageEventRef = useRef(null);
  const handledConversationEventRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedId]);

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

  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return conversations.filter((item) => {
      const channel = String(item.channel || '').toUpperCase();
      if (channelFilter === 'UNREAD' && !(item.unreadCount > 0)) return false;
      if (
        channelFilter !== 'ALL' &&
        channelFilter !== 'UNREAD' &&
        channel !== channelFilter
      ) {
        return false;
      }
      if (!query) return true;
      const haystack = [
        item.leadName,
        item.leadId,
        item.channel,
        item.lastMessagePreview,
        item.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [conversations, searchQuery, channelFilter]);

  const hasActiveFilter = channelFilter !== 'ALL' || searchQuery.trim() !== '';
  const selected = conversations.find((item) => item.id === selectedId);
  const selectedName = selected?.leadName || (selected ? `Lead #${selected.leadId}` : '');

  return (
    <div className="conversations-page">
      <header className="page-header conversations-page__header">
        <div className="page-header__copy">
          <h1 className="page-header__title">Conversas</h1>
          <p className="page-header__subtitle">
            Atenda WhatsApp, Instagram e Messenger em um só lugar.
          </p>
        </div>
      </header>

      {error ? <p className="conversations-page__error">{error}</p> : null}

      <div
        className={`conversations-layout${selectedId ? '' : ' conversations-layout--no-selection'}`}
      >
        <aside className="conversations-list">
          <div className="conversations-list__toolbar">
            <label className="conversations-search">
              <span className="material-symbols-outlined" aria-hidden="true">
                search
              </span>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar conversas..."
                aria-label="Buscar conversas"
              />
            </label>
            <div className="conversations-filters" role="group" aria-label="Filtrar canal">
              {[
                { id: 'ALL', label: 'Todos' },
                { id: 'WHATSAPP', label: 'WhatsApp' },
                { id: 'INSTAGRAM', label: 'Instagram' },
                { id: 'MESSENGER', label: 'Messenger' },
                { id: 'UNREAD', label: 'Não lidas' },
              ].map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  className={`conversations-filters__chip${
                    channelFilter === filter.id ? ' is-active' : ''
                  }`}
                  onClick={() => setChannelFilter(filter.id)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className="conversations-list__items">
            {loading ? (
              <p className="conversations-empty">Carregando conversas...</p>
            ) : null}
            {!loading && filteredConversations.length === 0 ? (
              <p className="conversations-empty">
                {hasActiveFilter
                  ? 'Nenhuma conversa encontrada com esses filtros. Ajuste a busca ou volte para Todos.'
                  : 'Nenhuma conversa ainda. Conecte WhatsApp ou Instagram e responda leads por aqui.'}
              </p>
            ) : null}
            {filteredConversations.map((item) => {
              const name = item.leadName || `Lead #${item.leadId}`;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`conversations-item${
                    selectedId === item.id ? ' is-active' : ''
                  }`}
                  onClick={() => handleSelectConversation(item.id)}
                >
                  <div
                    className={`conversations-item__avatar ${channelClass(item.channel)}`}
                    aria-hidden="true"
                  >
                    {initialsFromName(name)}
                  </div>
                  <div className="conversations-item__body">
                    <div className="conversations-item__top">
                      <strong>{name}</strong>
                      <span className="conversations-item__time">
                        {formatListTime(item.lastMessageAt || item.updatedAt)}
                      </span>
                    </div>
                    <span className="conversations-item__preview">
                      {item.lastMessagePreview ||
                        [
                          channelLabel(item.channel),
                          conversationStatusLabel(item.status),
                        ]
                          .filter(Boolean)
                          .join(' · ') ||
                        'Sem mensagens'}
                    </span>
                    <div className="conversations-item__meta">
                      <span
                        className={`conversations-channel-badge ${channelClass(item.channel)}`}
                      >
                        {channelLabel(item.channel)}
                      </span>
                      {item.unreadCount > 0 ? (
                        <span className="conversations-item__unread">
                          {item.unreadCount}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="conversations-thread">
          {!selectedId ? (
            <div className="conversations-thread__empty">
              <span className="material-symbols-outlined" aria-hidden="true">
                forum
              </span>
              <p>Selecione uma conversa para ver o histórico.</p>
            </div>
          ) : (
            <>
              <div className="conversations-thread__header">
                <div className="conversations-thread__identity">
                  <div
                    className={`conversations-item__avatar ${channelClass(selected?.channel)}`}
                    aria-hidden="true"
                  >
                    {initialsFromName(selectedName)}
                  </div>
                  <div>
                    <h2>{selectedName}</h2>
                    <span
                      className={`conversations-channel-badge ${channelClass(selected?.channel)}`}
                    >
                      {channelLabel(selected?.channel)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="conversations-thread__messages">
                {messages.length === 0 ? (
                  <p className="conversations-empty">
                    Nenhuma mensagem nesta conversa. Escreva abaixo para iniciar.
                  </p>
                ) : null}
                {messages.map((msg) => (
                  <div
                    key={messageKey(msg)}
                    className={`conversations-bubble conversations-bubble--${String(
                      msg.direction || ''
                    ).toLowerCase()}`}
                  >
                    <p>{msg.content}</p>
                    <small>
                      {[
                        messageStatusLabel(msg.status),
                        formatMessageTime(msg.createdAt),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </small>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <form className="conversations-composer" onSubmit={handleSend}>
                <textarea
                  className="conversations-composer__input"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Escreva uma mensagem..."
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (!sending && draft.trim()) {
                        e.currentTarget.form?.requestSubmit();
                      }
                    }
                  }}
                />
                <button
                  className="btn btn-primary conversations-composer__send"
                  type="submit"
                  disabled={sending || !draft.trim()}
                >
                  {sending ? 'Enviando mensagem...' : 'Enviar mensagem'}
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
