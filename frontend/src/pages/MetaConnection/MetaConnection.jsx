import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { metaApi } from '../../services/meta.api.js';
import './MetaConnection.css';

const EMPTY_ASSETS = {
  pages: [],
  adAccounts: [],
  instagramAccounts: [],
  whatsappAccounts: [],
};

export default function MetaConnection() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState({ connected: false, businessId: null });
  const [assets, setAssets] = useState(EMPTY_ASSETS);
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
        const assetsData = await metaApi.getAssets();
        setAssets({
          pages: assetsData.pages || [],
          adAccounts: assetsData.adAccounts || [],
          instagramAccounts: assetsData.instagramAccounts || [],
          whatsappAccounts: assetsData.whatsappAccounts || [],
        });
      } else {
        setAssets(EMPTY_ASSETS);
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
    }
    if (oauthError) {
      setError(message || `Falha no OAuth Meta: ${oauthError}`);
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
    setDisconnecting(true);
    setError('');
    setInfo('');
    try {
      await metaApi.disconnect();
      setStatus({ connected: false, businessId: null });
      setAssets(EMPTY_ASSETS);
      setInfo('Meta desconectada. Conecte novamente para renovar as permissões.');
    } catch (err) {
      setError(
        err?.response?.data?.message || 'Não foi possível desconectar a Meta.'
      );
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="meta-page">
      <header className="meta-page__header">
        <h1 className="text-h2">Conexão Meta</h1>
        <p className="text-subtitle meta-page__subtitle">
          Conecte sua conta do Facebook Business para capturar leads.
        </p>
      </header>

      <section className="card meta-page__card">
        {loading ? (
          <p className="text-body">Carregando status...</p>
        ) : status.connected ? (
          <div className="meta-page__connected">
            <p className="meta-page__badge">Meta conectado</p>
            <p className="text-body">
              Business ID: <strong>{status.businessId || '—'}</strong>
            </p>

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
                {connecting ? 'Redirecionando...' : 'Reconectar Meta'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleDisconnect}
                disabled={disconnecting || syncing || connecting}
              >
                {disconnecting ? 'Desconectando...' : 'Desconectar'}
              </button>
            </div>

            <div className="meta-page__assets">
              <h3 className="meta-page__assets-title">Ativos encontrados</h3>

              <AssetGroup title="Facebook Pages">
                {assets.pages.length === 0 ? (
                  <li className="meta-page__empty">Nenhuma página</li>
                ) : (
                  assets.pages.map((page) => (
                    <li key={page.pageId}>{page.name}</li>
                  ))
                )}
              </AssetGroup>

              <AssetGroup title="Contas de anúncio">
                {assets.adAccounts.length === 0 ? (
                  <li className="meta-page__empty">Nenhuma conta</li>
                ) : (
                  assets.adAccounts.map((account) => (
                    <li key={account.accountId}>
                      {account.name || account.accountId}
                      {account.status ? ` (${account.status})` : ''}
                    </li>
                  ))
                )}
              </AssetGroup>

              <AssetGroup title="Instagram">
                {assets.instagramAccounts.length === 0 ? (
                  <li className="meta-page__empty">Nenhuma conta</li>
                ) : (
                  assets.instagramAccounts.map((ig) => (
                    <li key={ig.instagramId}>
                      {ig.username ? `@${ig.username}` : ig.instagramId}
                    </li>
                  ))
                )}
              </AssetGroup>

              <AssetGroup title="WhatsApp">
                {assets.whatsappAccounts.length === 0 ? (
                  <li className="meta-page__empty">Nenhuma conta</li>
                ) : (
                  assets.whatsappAccounts.map((wa) => (
                    <li key={wa.businessAccountId}>
                      {wa.phoneNumber || wa.businessAccountId}
                    </li>
                  ))
                )}
              </AssetGroup>
            </div>
          </div>
        ) : (
          <div className="meta-page__disconnected">
            <h2 className="text-h2" style={{ fontSize: '20px' }}>
              Conecte sua conta Meta
            </h2>
            <p className="text-body meta-page__help">
              Autorize o Lead Capture a acessar suas páginas e formulários de lead ads.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConnect}
              disabled={connecting}
            >
              {connecting ? 'Redirecionando...' : 'Conectar Facebook'}
            </button>
          </div>
        )}

        {info ? <p className="meta-page__info">{info}</p> : null}
        {error ? <p className="meta-page__error">{error}</p> : null}
      </section>
    </div>
  );
}

function AssetGroup({ title, children }) {
  return (
    <div className="meta-page__group">
      <h4 className="meta-page__group-title">{title}</h4>
      <ul className="meta-page__list">{children}</ul>
    </div>
  );
}
