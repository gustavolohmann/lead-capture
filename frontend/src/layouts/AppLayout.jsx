import { useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import NotificationBell from '../components/NotificationBell/NotificationBell.jsx';
import './AppLayout.css';

const NAV_ITEMS = [
  { to: '/meta', label: 'Conexão Meta', icon: 'settings_input_component' },
  { to: '/leads', label: 'Leads', icon: 'filter_list' },
  { to: '/forms', label: 'Formulários', icon: 'description' },
  { to: '/campaigns', label: 'Campanhas', icon: 'leaderboard' },
  { to: '/conversations', label: 'Conversas', icon: 'chat' },
  { to: '/whatsapp/templates', label: 'Templates WA', icon: 'sms' },
  { to: '/automations', label: 'Automações', icon: 'bolt' },
];

function initialsFromName(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const initials = useMemo(() => initialsFromName(user?.name), [user?.name]);

  function closeMobile() {
    setMobileOpen(false);
  }

  return (
    <div className="shell">
      {mobileOpen ? (
        <button
          type="button"
          className="shell-overlay"
          aria-label="Fechar menu"
          onClick={closeMobile}
        />
      ) : null}

      <aside className={`shell-sidebar${mobileOpen ? ' is-open' : ''}`}>
        <div className="shell-brand">
          <span className="shell-brand__logo" aria-hidden="true">
            LC
          </span>
          <div>
            <p className="shell-brand__name">Lead Capture</p>
            <p className="shell-brand__caption">SaaS Platform</p>
          </div>
        </div>

        <div className="shell-cta">
          <button
            type="button"
            className="shell-cta__btn"
            onClick={() => {
              navigate('/campaigns/new');
              closeMobile();
            }}
          >
            <span className="material-symbols-outlined shell-icon-fill">add</span>
            Nova campanha
          </button>
        </div>

        <nav className="shell-nav" aria-label="Principal">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={closeMobile}
              className={({ isActive }) =>
                `shell-nav__item${isActive ? ' is-active' : ''}`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`material-symbols-outlined${isActive ? ' shell-icon-fill' : ''}`}
                  >
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}

          <span className="shell-nav__item is-disabled" title="Em breve">
            <span className="material-symbols-outlined">settings</span>
            <span>Configurações</span>
          </span>
        </nav>

        <div className="shell-sidebar__footer">
          <div className="shell-user-card">
            <div className="shell-user-card__row">
              <div className="shell-avatar" aria-hidden="true">
                {initials}
              </div>
              <div className="shell-user-card__meta">
                <p className="shell-user-card__name">{user?.name || 'Usuário'}</p>
                <span className="shell-user-card__role">{user?.role || 'USER'}</span>
              </div>
            </div>
            <button type="button" className="shell-signout" onClick={logout}>
              <span className="material-symbols-outlined">logout</span>
              Sair
            </button>
          </div>
        </div>
      </aside>

      <div className="shell-main">
        <header className="shell-topbar">
          <button
            type="button"
            className="shell-topbar__menu"
            aria-label="Abrir menu"
            onClick={() => setMobileOpen(true)}
          >
            <span className="material-symbols-outlined">menu</span>
          </button>

          <div className="shell-topbar__search">
            <span className="material-symbols-outlined">search</span>
            <input
              type="search"
              placeholder="Buscar leads, campanhas..."
              aria-label="Buscar"
            />
          </div>

          <div className="shell-topbar__actions">
            <button type="button" className="shell-icon-btn" aria-label="Histórico">
              <span className="material-symbols-outlined">history</span>
            </button>
            <NotificationBell />
            <div className="shell-topbar__divider" />
            <button type="button" className="shell-export" disabled title="Em breve">
              <span className="material-symbols-outlined">download</span>
              Exportar
            </button>
          </div>
        </header>

        <main className="shell-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
