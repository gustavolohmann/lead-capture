import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { metaApi } from '../../services/meta.api.js';
import { adsBuilderApi } from '../../services/adsBuilder.api.js';
import './MetaConnection.css';

const EMPTY_ASSETS = {
  pages: [],
  adAccounts: [],
  instagramAccounts: [],
  whatsappAccounts: [],
};

const LAST_SYNC_KEY = 'lead_capture_meta_last_sync';

function formatDateTime(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('pt-BR');
  } catch {
    return '—';
  }
}

function readLastSync() {
  try {
    return localStorage.getItem(LAST_SYNC_KEY) || null;
  } catch {
    return null;
  }
}

function writeLastSync(iso) {
  try {
    localStorage.setItem(LAST_SYNC_KEY, iso);
  } catch {
    // ignore
  }
}

export default function MetaConnection() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState({ connected: false, businessId: null });
  const [assets, setAssets] = useState(EMPTY_ASSETS);
  const [formsCount, setFormsCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState(() => readLastSync());
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const statusData = await metaApi.getStatus();
      const nextStatus = {
        connected: Boolean(statusData.connected),
        businessId: statusData.businessId || null,
      };
      setStatus(nextStatus);

      if (nextStatus.connected) {
        const [assetsData, formsData] = await Promise.all([
          metaApi.getAssets(),
          adsBuilderApi.listLeadForms().catch(() => ({ forms: [] })),
        ]);
        setAssets({
          pages: assetsData.pages || [],
          adAccounts: assetsData.adAccounts || [],
          instagramAccounts: assetsData.instagramAccounts || [],
          whatsappAccounts: assetsData.whatsappAccounts || [],
        });
        setFormsCount(
          Array.isArray(formsData?.forms)
            ? formsData.forms.length
            : Array.isArray(formsData)
              ? formsData.length
              : 0
        );
      } else {
        setAssets(EMPTY_ASSETS);
        setFormsCount(0);
      }
    } catch (err) {
      setError(
        err?.response?.data?.message || 'Não foi possível carregar dados Meta.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const connected = searchParams.get('connected');
    const oauthError = searchParams.get('error');
    const message = searchParams.get('message');

    if (connected === '1') {
      setInfo('Conta Meta conectada com sucesso.');
      const now = new Date().toISOString();
      writeLastSync(now);
      setLastSyncedAt(now);
    }
    if (oauthError) {
      setError(
        message ||
          'Não foi possível conectar à Meta. Tente novamente ou verifique as permissões da conta.'
      );
    }

    if (connected || oauthError) {
      const next = new URLSearchParams(searchParams);
      next.delete('connected');
      next.delete('error');
      next.delete('message');
      next.delete('error_description');
      setSearchParams(next, { replace: true });
    }

    loadAll();
  }, [loadAll, searchParams, setSearchParams]);

  async function handleConnect() {
    setConnecting(true);
    setError('');
    try {
      const data = await metaApi.getConnectUrl();
      if (!data.url) {
        throw new Error('URL OAuth não retornada');
      }
      window.location.href = data.url;
    } catch (err) {
      setError(
        err?.response?.data?.message || 'Não foi possível iniciar a conexão Meta.'
      );
      setConnecting(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setError('');
    setInfo('');
    try {
      const result = await metaApi.syncAssets();
      const synced = result.synced || {};
      const now = new Date().toISOString();
      writeLastSync(now);
      setLastSyncedAt(now);
      setInfo(
        `Sincronizado: ${synced.pages || 0} páginas, ${synced.adAccounts || 0} ads, ${synced.instagramAccounts || 0} Instagram, ${synced.whatsappAccounts || 0} WhatsApp.`
      );
      await loadAll();
    } catch (err) {
      setError(
        err?.response?.data?.message || 'Falha ao sincronizar ativos Meta.'
      );
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    const ok = window.confirm(
      'Desconectar a Meta? Campanhas e sincronização de ativos ficam indisponíveis até reconectar.'
    );
    if (!ok) return;
    setDisconnecting(true);
    setError('');
    setInfo('');
    try {
      await metaApi.disconnect();
      setStatus({ connected: false, businessId: null });
      setAssets(EMPTY_ASSETS);
      setFormsCount(0);
      setInfo('Meta desconectada. Conecte novamente para renovar as permissões.');
    } catch (err) {
      setError(
        err?.response?.data?.message || 'Não foi possível desconectar a Meta.'
      );
    } finally {
      setDisconnecting(false);
    }
  }

  const connectionState = loading
    ? 'loading'
    : connecting
      ? 'connecting'
      : error && !status.connected
        ? 'error'
        : status.connected
          ? 'connected'
          : 'disconnected';

  return (
    <div className="meta-page">
      <header className="page-header meta-page__header">
        <div className="page-header__copy">
          <h1 className="page-header__title">Conexão Meta</h1>
          <p className="page-header__subtitle">
            Capture automaticamente os leads dos seus formulários do Facebook e
            Instagram.
          </p>
        </div>
      </header>

      {info ? <p className="meta-page__banner meta-page__banner--ok">{info}</p> : null}
      {error ? (
        <p className="meta-page__banner meta-page__banner--error">{error}</p>
      ) : null}

      <section
        className={`meta-page__hero meta-page__hero--${connectionState}`}
        aria-live="polite"
      >
        {connectionState === 'loading' ? (
          <p className="meta-page__hint">Carregando status da integração...</p>
        ) : null}

        {connectionState === 'connecting' ? (
          <div className="meta-page__connecting">
            <div className="meta-page__spinner" aria-hidden="true" />
            <h2>Conectando à Meta...</h2>
            <p>
              Você será redirecionado para autorizar o acesso. Não feche esta
              janela.
            </p>
          </div>
        ) : null}

        {connectionState === 'disconnected' || connectionState === 'error' ? (
          <div className="meta-page__onboarding">
            <div className="meta-page__onboarding-main">
              <div className="meta-page__brand-mark" aria-hidden="true">
                <span className="material-symbols-outlined">hub</span>
              </div>
              <h2>Conecte sua conta da Meta</h2>
              <p>
                Conecte sua conta Business para importar páginas, campanhas e
                formulários de Lead Ads.
              </p>

              <ol className="meta-page__steps">
                <li>
                  <span>1</span>
                  Conecte sua conta
                </li>
                <li>
                  <span>2</span>
                  Selecione suas páginas
                </li>
                <li>
                  <span>3</span>
                  Escolha os formulários
                </li>
              </ol>

              <button
                type="button"
                className="btn btn-primary meta-page__cta"
                onClick={handleConnect}
                disabled={connecting}
              >
                Conectar conta da Meta
              </button>
              <p className="meta-page__redirect-note">
                Você será redirecionado para a Meta para autorizar o acesso.
              </p>
              <p className="meta-page__secure">
                <span className="material-symbols-outlined" aria-hidden="true">
                  lock
                </span>
                A conexão é realizada diretamente pela Meta. Sua senha não é
                armazenada.
              </p>
            </div>
          </div>
        ) : null}

        {connectionState === 'connected' ? (
          <div className="meta-page__connected">
            <div className="meta-page__connected-top">
              <div>
                <span className="meta-page__badge">Meta conectada ✓</span>
                <p className="meta-page__business">
                  Conta Business ID:{' '}
                  <strong>{status.businessId || '—'}</strong>
                </p>
                <p className="meta-page__sync-meta">
                  Última sincronização: {formatDateTime(lastSyncedAt)}
                </p>
              </div>
              <div className="meta-page__actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSync}
                  disabled={syncing || connecting || disconnecting}
                >
                  {syncing ? 'Sincronizando...' : 'Sincronizar ativos'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleConnect}
                  disabled={connecting || syncing || disconnecting}
                >
                  {connecting ? 'Redirecionando...' : 'Gerenciar conexão'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleDisconnect}
                  disabled={disconnecting || syncing || connecting}
                >
                  {disconnecting ? 'Desconectando...' : 'Desconectar Meta'}
                </button>
              </div>
            </div>

            <div className="meta-page__kpis">
              <div className="meta-page__kpi">
                <strong>{assets.pages.length}</strong>
                <span>Páginas vinculadas</span>
              </div>
              <div className="meta-page__kpi">
                <strong>{formsCount}</strong>
                <span>Formulários encontrados</span>
              </div>
              <div className="meta-page__kpi">
                <strong>{assets.adAccounts.length}</strong>
                <span>Contas de anúncio</span>
              </div>
              <div className="meta-page__kpi">
                <strong>
                  {assets.instagramAccounts.length + assets.whatsappAccounts.length}
                </strong>
                <span>Canais de mensagem</span>
              </div>
            </div>

            <div className="meta-page__assets">
              <div className="meta-page__assets-head">
                <h3>Ativos sincronizados</h3>
                <Link className="meta-page__link" to="/forms">
                  Ver formulários
                </Link>
              </div>
              <div className="meta-page__grid">
                <AssetGroup
                  title="Páginas do Facebook"
                  icon="web"
                  empty="Nenhuma página sincronizada"
                >
                  {assets.pages.map((page) => (
                    <li key={page.pageId}>
                      <strong>{page.name}</strong>
                      <span>{page.pageId}</span>
                    </li>
                  ))}
                </AssetGroup>
                <AssetGroup
                  title="Contas de anúncio"
                  icon="campaign"
                  empty="Nenhuma conta sincronizada"
                >
                  {assets.adAccounts.map((account) => (
                    <li key={account.accountId}>
                      <strong>{account.name || account.accountId}</strong>
                      <span>
                        {account.accountId}
                        {account.status ? ` · ${account.status}` : ''}
                      </span>
                    </li>
                  ))}
                </AssetGroup>
                <AssetGroup
                  title="Instagram"
                  icon="photo_camera"
                  empty="Nenhuma conta sincronizada"
                >
                  {assets.instagramAccounts.map((ig) => (
                    <li key={ig.instagramId}>
                      <strong>
                        {ig.username ? `@${ig.username}` : ig.instagramId}
                      </strong>
                      <span>{ig.instagramId}</span>
                    </li>
                  ))}
                </AssetGroup>
                <AssetGroup
                  title="WhatsApp"
                  icon="chat"
                  empty="Nenhuma conta sincronizada"
                >
                  {assets.whatsappAccounts.map((wa) => (
                    <li key={wa.businessAccountId}>
                      <strong>{wa.phoneNumber || wa.businessAccountId}</strong>
                      <span>{wa.businessAccountId}</span>
                    </li>
                  ))}
                </AssetGroup>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {(connectionState === 'disconnected' || connectionState === 'error') && (
        <section className="meta-page__howto" aria-labelledby="meta-howto-title">
          <h2 id="meta-howto-title">Como funciona?</h2>
          <div className="meta-page__howto-grid">
            <article className="meta-page__howto-card">
              <span className="material-symbols-outlined" aria-hidden="true">
                link
              </span>
              <h3>Conecte sua conta</h3>
              <p>
                Autorize o Lead Capture na Meta para acessar Páginas, anúncios e
                formulários da sua empresa.
              </p>
            </article>
            <article className="meta-page__howto-card">
              <span className="material-symbols-outlined" aria-hidden="true">
                description
              </span>
              <h3>Selecione os formulários</h3>
              <p>
                Após conectar, sincronize os ativos e use formulários Lead Ads nas
                campanhas do painel.
              </p>
            </article>
            <article className="meta-page__howto-card">
              <span className="material-symbols-outlined" aria-hidden="true">
                filter_list
              </span>
              <h3>Receba os leads automaticamente</h3>
              <p>
                Os leads entram no CRM, podem ser associados a campanhas e
                seguir para Conversas e automações.
              </p>
            </article>
          </div>
        </section>
      )}
    </div>
  );
}

function AssetGroup({ title, icon, empty, children }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : [];
  return (
    <div className="meta-page__group">
      <div className="meta-page__group-head">
        <span className="material-symbols-outlined" aria-hidden="true">
          {icon}
        </span>
        <h4>{title}</h4>
      </div>
      <ul className="meta-page__list">
        {items.length === 0 ? (
          <li className="meta-page__empty">{empty}</li>
        ) : (
          items
        )}
      </ul>
    </div>
  );
}
