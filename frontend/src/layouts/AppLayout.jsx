import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { useSocket } from '../hooks/useSocket.js';
import './AppLayout.css';

const NAV_ITEMS = [
  { to: '/meta', label: 'Conexão Meta', icon: 'settings_input_component' },
  { to: '/meta-ads', label: 'Meta Ads', icon: 'insights' },
  { to: '/forms', label: 'Formulários', icon: 'description' },
  { to: '/campaigns', label: 'Campanhas', icon: 'leaderboard' },
  { to: '/leads', label: 'Leads', icon: 'filter_list' },
  { to: '/conversations', label: 'Conversas', icon: 'chat', badge: 'conversations' },
  { to: '/whatsapp/templates', label: 'Templates WhatsApp', icon: 'sms' },
  { to: '/automations', label: 'Automações', icon: 'bolt' },
];

function initialsFromName(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function formatBadgeCount(count) {
  if (!count || count <= 0) return null;
  return count > 99 ? '99+' : String(count);
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { unreadCount, markAllNotificationsRead } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [tooltip, setTooltip] = useState(null);
  const initials = useMemo(() => initialsFromName(user?.name), [user?.name]);
  const wizardShell = location.pathname.startsWith('/campaigns/new/');
  const fixedShell = location.pathname.startsWith('/conversations');
  const conversationsBadge = formatBadgeCount(unreadCount);
  const fabRef = useRef(null);
  const drawerCloseRef = useRef(null);

  function closeMobile() {
    setMobileOpen(false);
    setTooltip(null);
  }

  useEffect(() => {
    if (!mobileOpen) return undefined;
    drawerCloseRef.current?.focus();
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        setMobileOpen(false);
        setTooltip(null);
        fabRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  function showTooltip(event, label) {
    if (window.matchMedia('(max-width: 899px)').matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltip({
      label,
      top: rect.top + rect.height / 2,
      left: rect.right + 10,
    });
  }

  function hideTooltip() {
    setTooltip(null);
  }

  async function handleNavClick(item) {
    closeMobile();
    if (item.badge === 'conversations' && unreadCount > 0) {
      try {
        await markAllNotificationsRead();
      } catch {
        // badge continua até a próxima atualização
      }
    }
  }

  return (
    <div className={`shell${wizardShell ? ' shell--wizard' : ''}`}>
      {mobileOpen ? (
        <button
          type="button"
          className="shell-overlay"
          aria-label="Fechar menu"
          onClick={closeMobile}
        />
      ) : null}

      {tooltip ? (
        <div
          className="shell-tooltip"
          style={{ top: tooltip.top, left: tooltip.left }}
          role="tooltip"
        >
          {tooltip.label}
        </div>
      ) : null}

      <button
        type="button"
        className="shell-menu-fab"
        aria-label="Abrir menu"
        aria-expanded={mobileOpen}
        ref={fabRef}
        onClick={() => setMobileOpen(true)}
      >
        <span className="material-symbols-outlined">menu</span>
      </button>

      <aside
        className={`shell-sidebar${mobileOpen ? ' is-open' : ''}`}
        aria-label="Navegação"
      >
        <button
          type="button"
          className="shell-sidebar__close"
          aria-label="Fechar menu"
          ref={drawerCloseRef}
          onClick={() => {
            closeMobile();
            fabRef.current?.focus();
          }}
        >
          <span className="material-symbols-outlined">close</span>
        </button>

        <div className="shell-brand">
          <span className="shell-brand__logo" aria-hidden="true">
            LC
          </span>
          <div className="shell-brand__text">
            <p className="shell-brand__name">Lead Capture</p>
            <p className="shell-brand__caption">Captura & conversão</p>
          </div>
        </div>

        <div className="shell-cta">
          <button
            type="button"
            className="shell-cta__btn"
            aria-label="Nova campanha"
            onMouseEnter={(e) => showTooltip(e, 'Nova campanha')}
            onMouseLeave={hideTooltip}
            onFocus={(e) => showTooltip(e, 'Nova campanha')}
            onBlur={hideTooltip}
            onClick={() => {
              navigate('/campaigns?create=1');
              closeMobile();
            }}
          >
            <span className="material-symbols-outlined shell-icon-fill">add</span>
            <span className="shell-cta__label">Nova campanha</span>
          </button>
        </div>

        <nav className="shell-nav" aria-label="Principal">
          {NAV_ITEMS.map((item) => {
            const showConversationsBadge =
              item.badge === 'conversations' && conversationsBadge;
            const tooltipLabel = showConversationsBadge
              ? `${item.label} (${conversationsBadge})`
              : item.label;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => handleNavClick(item)}
                aria-label={tooltipLabel}
                onMouseEnter={(e) => showTooltip(e, tooltipLabel)}
                onMouseLeave={hideTooltip}
                onFocus={(e) => showTooltip(e, tooltipLabel)}
                onBlur={hideTooltip}
                className={({ isActive }) =>
                  `shell-nav__item${isActive ? ' is-active' : ''}`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="shell-nav__icon-wrap">
                      <span
                        className={`material-symbols-outlined${isActive ? ' shell-icon-fill' : ''}`}
                      >
                        {item.icon}
                      </span>
                      {showConversationsBadge ? (
                        <span className="shell-nav__badge" aria-hidden="true">
                          {conversationsBadge}
                        </span>
                      ) : null}
                    </span>
                    <span className="shell-nav__label">{item.label}</span>
                    {showConversationsBadge ? (
                      <span className="shell-nav__badge shell-nav__badge--inline">
                        {conversationsBadge}
                      </span>
                    ) : null}
                  </>
                )}
              </NavLink>
            );
          })}

          <button
            type="button"
            className="shell-nav__item is-disabled"
            disabled
            aria-label="Configurações (em breve)"
            onMouseEnter={(e) => showTooltip(e, 'Configurações · Em breve')}
            onMouseLeave={hideTooltip}
            onFocus={(e) => showTooltip(e, 'Configurações · Em breve')}
            onBlur={hideTooltip}
          >
            <span className="material-symbols-outlined">settings</span>
            <span className="shell-nav__label">Configurações</span>
          </button>
        </nav>

        <div className="shell-sidebar__footer">
          <div className="shell-user-card">
            <div
              className="shell-user-card__row"
              onMouseEnter={(e) => showTooltip(e, user?.name || 'Usuário')}
              onMouseLeave={hideTooltip}
            >
              <div className="shell-avatar" aria-hidden="true">
                {initials}
              </div>
              <div className="shell-user-card__meta">
                <p className="shell-user-card__name">{user?.name || 'Usuário'}</p>
                <span className="shell-user-card__role">{user?.role || 'USER'}</span>
              </div>
            </div>
            <button
              type="button"
              className="shell-signout"
              aria-label="Sair"
              onMouseEnter={(e) => showTooltip(e, 'Sair')}
              onMouseLeave={hideTooltip}
              onFocus={(e) => showTooltip(e, 'Sair')}
              onBlur={hideTooltip}
              onClick={logout}
            >
              <span className="material-symbols-outlined">logout</span>
              <span className="shell-signout__label">Sair</span>
            </button>
          </div>
        </div>
      </aside>

      <div
        className={`shell-main${wizardShell ? ' shell-main--wizard' : ''}${
          fixedShell ? ' shell-main--fixed' : ''
        }`}
      >
        <main
          className={`shell-content${wizardShell ? ' shell-content--wizard' : ''}${
            fixedShell ? ' shell-content--fixed' : ''
          }`}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
