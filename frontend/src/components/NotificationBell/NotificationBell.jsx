import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../hooks/useSocket.js';
import './NotificationBell.css';

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

export default function NotificationBell() {
  const navigate = useNavigate();
  const {
    unreadCount,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
  } = useSocket();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    function onDocClick(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  async function handleOpenNotification(item) {
    try {
      await markNotificationRead(item.id);
    } catch {
      // segue navegação mesmo se o mark-read falhar
    }
    setOpen(false);
    if (item.conversationId) {
      navigate(`/conversations?c=${item.conversationId}`);
    } else {
      navigate('/conversations');
    }
  }

  return (
    <div className="notification-bell" ref={rootRef}>
      <button
        type="button"
        className="shell-icon-btn shell-icon-btn--notify"
        aria-label="Notificações"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="material-symbols-outlined">notifications</span>
        {unreadCount > 0 ? (
          <span className="notification-bell__badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="notification-bell__panel" role="menu">
          <div className="notification-bell__header">
            <strong>Notificações</strong>
            {unreadCount > 0 ? (
              <button
                type="button"
                className="notification-bell__mark-all"
                onClick={() => markAllNotificationsRead()}
              >
                Marcar todas
              </button>
            ) : null}
          </div>

          {notifications.length === 0 ? (
            <p className="notification-bell__empty">Nenhuma notificação nova.</p>
          ) : (
            <ul className="notification-bell__list">
              {notifications.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="notification-bell__item"
                    onClick={() => handleOpenNotification(item)}
                  >
                    <span className="notification-bell__title">
                      {item.title || 'Nova mensagem'}
                    </span>
                    <span className="notification-bell__preview">
                      {item.preview || item.message || ''}
                    </span>
                    <span className="notification-bell__time">
                      {formatTime(item.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
