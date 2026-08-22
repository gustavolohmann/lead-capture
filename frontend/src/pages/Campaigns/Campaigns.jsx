import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { campaignsApi } from '../../services/campaigns.api.js';
import { metaAdsApi } from '../../services/metaAds.api.js';
import { formatBRL } from './campaignMoney.js';
import { campaignStatusMeta } from './campaignStatusMeta.js';
import { formatMetric } from '../MetaAds/metaAdsFormat.js';
import { clearDraft, getDraft } from './campaignDraft.js';
import DraftResumeBanner from './DraftResumeBanner.jsx';
import CreateCampaignModal from './CreateCampaignModal.jsx';
import AddCampaignAdModal from './AddCampaignAdModal.jsx';
import './Campaigns.css';
import './CreateCampaignModal.css';

const FILTERS = [
  { id: 'all', label: 'Todas' },
  { id: 'ACTIVE', label: 'Ativas' },
  { id: 'PAUSED', label: 'Pausadas' },
];

const CAMPAIGN_METRICS = ['spend', 'impressions', 'clicks', 'ctr', 'cpc', 'conversions'];

export default function Campaigns() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [bannerKey, setBannerKey] = useState(0);
  const [objectiveOpen, setObjectiveOpen] = useState(false);
  const [draftConflictOpen, setDraftConflictOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [detailsById, setDetailsById] = useState({});
  const [detailsLoadingId, setDetailsLoadingId] = useState(null);
  const [adActionId, setAdActionId] = useState(null);
  const [addAdCampaign, setAddAdCampaign] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const campaignsData = await campaignsApi.list();
      setCampaigns(campaignsData.campaigns || []);
    } catch (err) {
      setError(
        err?.response?.data?.message || 'Não foi possível carregar campanhas.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (searchParams.get('create') !== '1') return;
    const next = new URLSearchParams(searchParams);
    next.delete('create');
    setSearchParams(next, { replace: true });
    if (getDraft()) {
      setDraftConflictOpen(true);
    } else {
      setObjectiveOpen(true);
    }
  }, [searchParams, setSearchParams]);

  const filtered = useMemo(() => {
    if (filter === 'all') return campaigns;
    return campaigns.filter(
      (c) => String(c.status || '').toUpperCase() === filter
    );
  }, [campaigns, filter]);

  function requestCreate() {
    if (getDraft()) {
      setDraftConflictOpen(true);
      return;
    }
    setObjectiveOpen(true);
  }

  function continueDraft() {
    setDraftConflictOpen(false);
    setObjectiveOpen(false);
    navigate('/campaigns/new/leads');
  }

  function discardAndCreate() {
    clearDraft();
    setBannerKey((k) => k + 1);
    setDraftConflictOpen(false);
    setObjectiveOpen(true);
  }

  function selectObjective(item) {
    setObjectiveOpen(false);
    navigate(item.path);
  }

  async function handlePause(id) {
    setActionId(id);
    setError('');
    try {
      await campaignsApi.pause(id);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Falha ao pausar campanha.');
    } finally {
      setActionId(null);
    }
  }

  async function handleActivate(id) {
    setActionId(id);
    setError('');
    try {
      await campaignsApi.activate(id);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Falha ao ativar campanha.');
    } finally {
      setActionId(null);
    }
  }

  async function loadDetails(campaign) {
    if (expandedId === campaign.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(campaign.id);

    setDetailsLoadingId(campaign.id);
    try {
      const detailsResponse = await campaignsApi.details(campaign.id);
      const details = detailsResponse.campaign;
      const isLocalDemo = Boolean(details?.isLocalDemo || campaign.isLocalDemo);
      let campaignMetrics = null;
      let adMetricRows = [];
      let metricsError = null;

      if (!isLocalDemo && details?.adAccountId && details?.campaignId) {
        const base = {
          adAccountId: details.adAccountId,
          campaignId: details.campaignId,
          datePreset: 'last_30d',
          ...(details.objective === 'LEAD_GENERATION'
            ? { conversionType: 'lead' }
            : {}),
        };
        const [campaignResult, adsResult] = await Promise.allSettled([
          metaAdsApi.getInsights({ ...base, level: 'campaign' }),
          metaAdsApi.getInsights({ ...base, level: 'ad' }),
        ]);
        if (campaignResult.status === 'fulfilled') {
          campaignMetrics = campaignResult.value.summary || null;
        } else {
          metricsError =
            campaignResult.reason?.response?.data?.message ||
            'Métricas indisponíveis no momento.';
        }
        if (adsResult.status === 'fulfilled') {
          adMetricRows = Array.isArray(adsResult.value.data)
            ? adsResult.value.data
            : [];
        } else if (!metricsError) {
          metricsError =
            adsResult.reason?.response?.data?.message ||
            'Métricas dos anúncios indisponíveis.';
        }
      }

      const metricsByMetaAdId = Object.fromEntries(
        adMetricRows.filter((row) => row.adId).map((row) => [String(row.adId), row])
      );
      setDetailsById((current) => ({
        ...current,
        [campaign.id]: {
          ...details,
          isLocalDemo,
          campaignMetrics,
          metricsByMetaAdId,
          metricsError,
        },
      }));
    } catch (err) {
      setDetailsById((current) => ({
        ...current,
        [campaign.id]: {
          loadError:
            err?.response?.data?.message ||
            'Não foi possível carregar os anúncios desta campanha.',
        },
      }));
    } finally {
      setDetailsLoadingId(null);
    }
  }

  async function handleAdStatus(campaignId, ad) {
    setAdActionId(ad.id);
    setError('');
    try {
      const active = String(ad.status || '').toUpperCase() === 'ACTIVE';
      if (active) await campaignsApi.pauseAd(campaignId, ad.id);
      else await campaignsApi.activateAd(campaignId, ad.id);
      setDetailsById((current) => {
        const details = current[campaignId];
        if (!details?.ads) return current;
        const status = active ? 'PAUSED' : 'ACTIVE';
        const ads = details.ads.map((item) =>
          item.id === ad.id ? { ...item, status } : item
        );
        const adSets = (details.adSets || []).map((adSet) => ({
          ...adSet,
          ads: (adSet.ads || []).map((item) =>
            item.id === ad.id ? { ...item, status } : item
          ),
        }));
        return { ...current, [campaignId]: { ...details, ads, adSets } };
      });
    } catch (err) {
      setError(err?.response?.data?.message || 'Falha ao atualizar o anúncio.');
    } finally {
      setAdActionId(null);
    }
  }

  function handleAdCreated(ad) {
    if (!addAdCampaign || !ad) return;
    const campaignId = addAdCampaign.id;
    setDetailsById((current) => {
      const details = current[campaignId];
      if (!details) return current;
      return {
        ...current,
        [campaignId]: {
          ...details,
          adCount: Number(details.adCount || 0) + 1,
          ads: [...(details.ads || []), ad],
          adSets: (details.adSets || []).map((adSet) =>
            Number(adSet.id) === Number(ad.adSetId)
              ? { ...adSet, ads: [...(adSet.ads || []), ad] }
              : adSet
          ),
        },
      };
    });
    setCampaigns((current) =>
      current.map((campaign) =>
        campaign.id === campaignId
          ? { ...campaign, adCount: Number(campaign.adCount || 0) + 1 }
          : campaign
      )
    );
    setSuccessMessage(`Anúncio “${ad.name}” criado e adicionado à campanha.`);
    setAddAdCampaign(null);
  }

  return (
    <div className="campaigns-page">
      <header className="page-header campaigns-page__header">
        <div className="page-header__copy">
          <h1 className="page-header__title">Campanhas</h1>
          <p className="page-header__subtitle">
            Gerencie e acompanhe suas campanhas.
          </p>
        </div>
        <div className="page-header__actions">
          <button type="button" className="btn btn-primary" onClick={requestCreate}>
            Nova campanha
          </button>
        </div>
      </header>

      <DraftResumeBanner
        key={bannerKey}
        onContinue={continueDraft}
        onDiscard={() => setBannerKey((k) => k + 1)}
      />

      <section className="card campaigns-page__card">
        <div className="campaigns-page__toolbar">
          <div
            className="campaigns-filters"
            role="tablist"
            aria-label="Filtrar campanhas por status"
          >
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={filter === item.id}
                className={`campaigns-filter${filter === item.id ? ' is-active' : ''}`}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          {!loading && filtered.length > 0 ? (
            <p className="campaigns-page__count">
              {filtered.length}
              {filtered.length === 1 ? ' campanha' : ' campanhas'}
            </p>
          ) : null}
        </div>

        {loading ? <p className="text-body">Carregando campanhas...</p> : null}
        {error ? <p className="campaigns-page__error">{error}</p> : null}
        {successMessage ? (
          <p className="campaigns-page__success" role="status">
            {successMessage}
          </p>
        ) : null}

        {!loading && filtered.length === 0 ? (
          <div className="campaigns-page__empty-box">
            <p className="text-body campaigns-page__empty">
              Nenhuma campanha neste filtro. Crie uma campanha ou troque o
              filtro.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={requestCreate}
            >
              Nova campanha
            </button>
          </div>
        ) : null}

        {!loading && filtered.length > 0 ? (
          <div className="campaigns-table-wrap">
            <table className="campaigns-table">
              <thead>
                <tr>
                  <th>Campanha</th>
                  <th>Status</th>
                  <th>Anúncios</th>
                  <th className="campaigns-table__col--budget">Orçamento</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((campaign) => {
                  const status = campaignStatusMeta(campaign.status);
                  const expanded = expandedId === campaign.id;
                  const details = detailsById[campaign.id];
                  return (
                    <Fragment key={campaign.id}>
                    <tr>
                      <td className="campaigns-table__cell--name">
                        <button
                          type="button"
                          className="campaigns-name-button"
                          aria-expanded={expanded}
                          onClick={() => loadDetails(campaign)}
                        >
                          <span aria-hidden="true">{expanded ? '−' : '+'}</span>
                          <strong>{campaign.name}</strong>
                        </button>
                      </td>
                      <td data-label="Status">
                        <span
                          className={`campaigns-status campaigns-status--${status.tone}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td data-label="Anúncios">
                        {campaign.adCount || 0}
                      </td>
                      <td
                        data-label="Orçamento"
                        className="campaigns-table__col--budget"
                      >
                        {campaign.dailyBudget != null
                          ? `${formatBRL(campaign.dailyBudget)}/dia`
                          : '—'}
                      </td>
                      <td className="campaigns-table__cell--actions">
                        <div className="campaigns-actions">
                          <Link
                            className="btn btn-ghost"
                            to={`/campaigns/${campaign.id}/automation`}
                          >
                            Automação
                          </Link>
                          {String(campaign.status).toUpperCase() === 'ACTIVE' ? (
                            <button
                              type="button"
                              className="btn btn-secondary"
                              disabled={actionId === campaign.id || campaign.isLocalDemo}
                              title={campaign.isLocalDemo ? 'Ações na Meta estão desativadas para demonstrações locais.' : undefined}
                              onClick={() => handlePause(campaign.id)}
                            >
                              {campaign.isLocalDemo ? 'Demo local' : 'Pausar'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-secondary"
                              disabled={actionId === campaign.id || campaign.isLocalDemo}
                              title={campaign.isLocalDemo ? 'Ações na Meta estão desativadas para demonstrações locais.' : undefined}
                              onClick={() => handleActivate(campaign.id)}
                            >
                              {campaign.isLocalDemo ? 'Demo local' : 'Ativar'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expanded ? (
                      <tr className="campaigns-detail-row">
                        <td colSpan={5}>
                          {detailsLoadingId === campaign.id ? (
                            <p className="text-body">Carregando anúncios e métricas...</p>
                          ) : details?.loadError ? (
                            <p className="campaigns-page__error">{details.loadError}</p>
                          ) : details ? (
                            <div className="campaign-details">
                              <div className="campaign-details__head">
                                <div>
                                  <h3>Desempenho da campanha</h3>
                                  <p>{details.isLocalDemo ? 'Hierarquia persistida localmente' : 'Últimos 30 dias · dados da Meta'}</p>
                                </div>
                                <div className="campaign-details__head-actions">
                                  <span>{details.adCount || 0} anúncio(s)</span>
                                  {!details.isLocalDemo ? (
                                    <button
                                      type="button"
                                      className="btn btn-primary"
                                      disabled={!(details.adSets || []).some((item) => item.metaAdsetId)}
                                      title={
                                        (details.adSets || []).some((item) => item.metaAdsetId)
                                          ? undefined
                                          : 'A campanha ainda não possui um Ad Set Meta sincronizado.'
                                      }
                                      onClick={() => {
                                        setSuccessMessage('');
                                        setAddAdCampaign(details);
                                      }}
                                    >
                                      + Adicionar anúncio
                                    </button>
                                  ) : null}
                                </div>
                              </div>

                              {details.isLocalDemo ? (
                                <p className="campaign-details__notice">
                                  Demonstração local: métricas e ações remotas da Meta estão desativadas.
                                </p>
                              ) : details.metricsError ? (
                                <p className="campaign-details__notice">
                                  {details.metricsError} Os anúncios locais continuam disponíveis abaixo.
                                </p>
                              ) : null}

                              {details.campaignMetrics ? (
                                <div className="campaign-details__metrics">
                                  {CAMPAIGN_METRICS.map((key) => (
                                    <div key={key}>
                                      <span>{key === 'spend' ? 'Gasto' : key === 'impressions' ? 'Impressões' : key === 'clicks' ? 'Cliques' : key.toUpperCase()}</span>
                                      <strong>{formatMetric(key, details.campaignMetrics[key])}</strong>
                                    </div>
                                  ))}
                                </div>
                              ) : null}

                              <div className="campaign-details__ads">
                                {(details.ads || []).length === 0 ? (
                                  <p className="text-body">
                                    Nenhum anúncio local associado. Campanhas sincronizadas anteriormente podem ainda não ter a hierarquia importada.
                                  </p>
                                ) : (
                                  details.ads.map((ad) => {
                                    const adStatus = campaignStatusMeta(ad.status);
                                    const metrics = details.metricsByMetaAdId?.[String(ad.metaAdId)];
                                    return (
                                      <article className="campaign-ad-card" key={ad.id}>
                                        <div className="campaign-ad-card__head">
                                          <div>
                                            <h4>{ad.name}</h4>
                                            <p>{ad.creative?.title || 'Creative sem título'}</p>
                                          </div>
                                          <span className={`campaigns-status campaigns-status--${adStatus.tone}`}>
                                            {adStatus.label}
                                          </span>
                                        </div>
                                        {!details.isLocalDemo ? (
                                          <div className="campaign-ad-card__metrics">
                                            {CAMPAIGN_METRICS.map((key) => (
                                              <div key={key}>
                                                <span>{key === 'spend' ? 'Gasto' : key === 'impressions' ? 'Impressões' : key === 'clicks' ? 'Cliques' : key.toUpperCase()}</span>
                                                <strong>{formatMetric(key, metrics?.[key])}</strong>
                                              </div>
                                            ))}
                                          </div>
                                        ) : null}
                                        <button
                                          type="button"
                                          className="btn btn-secondary"
                                          disabled={adActionId === ad.id || !ad.metaAdId || details.isLocalDemo}
                                          title={details.isLocalDemo ? 'Ações na Meta estão desativadas para demonstrações locais.' : undefined}
                                          onClick={() => handleAdStatus(campaign.id, ad)}
                                        >
                                          {details.isLocalDemo
                                            ? 'Demo local'
                                            : String(ad.status).toUpperCase() === 'ACTIVE'
                                              ? 'Pausar anúncio'
                                              : 'Ativar anúncio'}
                                        </button>
                                      </article>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <CreateCampaignModal
        open={objectiveOpen}
        onClose={() => setObjectiveOpen(false)}
        onSelect={selectObjective}
      />

      {addAdCampaign ? (
        <AddCampaignAdModal
          campaign={addAdCampaign}
          onClose={() => setAddAdCampaign(null)}
          onCreated={handleAdCreated}
        />
      ) : null}

      {draftConflictOpen ? (
        <div className="create-campaign-conflict" role="presentation">
          <button
            type="button"
            className="create-campaign-conflict__backdrop"
            aria-label="Fechar"
            onClick={() => setDraftConflictOpen(false)}
          />
          <div
            className="create-campaign-conflict__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="draft-conflict-title"
          >
            <h2 id="draft-conflict-title">
              Você já tem uma campanha em andamento.
            </h2>
            <p>
              Deseja continuar o rascunho ou descartá-lo e começar uma nova?
            </p>
            <div className="create-campaign-conflict__actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={continueDraft}
              >
                Continuar campanha
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={discardAndCreate}
              >
                Descartar rascunho e criar nova
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setDraftConflictOpen(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
