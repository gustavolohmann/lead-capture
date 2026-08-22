import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { metaApi } from '../../services/meta.api.js';
import { metaAdsApi } from '../../services/metaAds.api.js';
import { campaignStatusMeta } from '../Campaigns/campaignStatusMeta.js';
import {
  CHART_METRIC_KEYS,
  METRIC_META,
  SUMMARY_CARD_KEYS,
  formatMetric,
  formatVariation,
  previousRange,
  rangeFromPreset,
  rowId,
  rowName,
  variationTone,
} from './metaAdsFormat.js';
import './MetaAds.css';

const PERIOD_OPTIONS = [
  { value: 'today', label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' },
  { value: 'last_7d', label: 'Últimos 7 dias' },
  { value: 'last_14d', label: 'Últimos 14 dias' },
  { value: 'last_30d', label: 'Últimos 30 dias' },
  { value: 'this_month', label: 'Este mês' },
  { value: 'last_month', label: 'Mês passado' },
  { value: 'custom', label: 'Personalizado' },
];

const LEVEL_OPTIONS = [
  { value: 'account', label: 'Conta' },
  { value: 'campaign', label: 'Campanha' },
  { value: 'adset', label: 'Conjunto' },
  { value: 'ad', label: 'Anúncio' },
];

const TABLE_SORT_KEYS = [
  'spend',
  'impressions',
  'reach',
  'clicks',
  'ctr',
  'cpc',
  'cpm',
  'conversions',
  'cpa',
  'roas',
];

function LineChart({ series, metricKey }) {
  const points = Array.isArray(series) ? series : [];
  if (!points.length) {
    return (
      <div className="meta-ads-line-chart__empty">
        Sem dados de série temporal para o período.
      </div>
    );
  }

  const width = 640;
  const height = 220;
  const pad = { top: 16, right: 16, bottom: 28, left: 48 };
  const values = points.map((p) => Number(p.value) || 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const coords = points.map((p, i) => {
    const x =
      pad.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
    const y = pad.top + innerH - ((Number(p.value) || 0) - min) / span * innerH;
    return { x, y, label: p.label, value: p.value };
  });

  const path = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ');

  const ticks = [0, Math.floor(coords.length / 2), coords.length - 1].filter(
    (v, i, arr) => v >= 0 && arr.indexOf(v) === i
  );

  return (
    <div className="meta-ads-line-chart" role="img" aria-label={`Gráfico de ${METRIC_META[metricKey]?.label || metricKey}`}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <line
          x1={pad.left}
          y1={pad.top}
          x2={pad.left}
          y2={height - pad.bottom}
          stroke="#e2e8f0"
        />
        <line
          x1={pad.left}
          y1={height - pad.bottom}
          x2={width - pad.right}
          y2={height - pad.bottom}
          stroke="#e2e8f0"
        />
        <path d={path} fill="none" stroke="var(--primary)" strokeWidth="2.5" />
        {coords.map((c) => (
          <circle key={`${c.label}-${c.x}`} cx={c.x} cy={c.y} r="3" fill="var(--primary)">
            <title>
              {c.label}: {formatMetric(metricKey, c.value)}
            </title>
          </circle>
        ))}
        {ticks.map((idx) => (
          <text
            key={idx}
            x={coords[idx].x}
            y={height - 8}
            textAnchor="middle"
            fontSize="11"
            fill="#64748b"
          >
            {coords[idx].label}
          </text>
        ))}
        <text
          x={pad.left - 8}
          y={pad.top + 4}
          textAnchor="end"
          fontSize="10"
          fill="#64748b"
        >
          {formatMetric(metricKey, max)}
        </text>
        <text
          x={pad.left - 8}
          y={height - pad.bottom}
          textAnchor="end"
          fontSize="10"
          fill="#64748b"
        >
          {formatMetric(metricKey, min)}
        </text>
      </svg>
    </div>
  );
}

function BarList({ rows, metricKey, nameKey = 'name' }) {
  if (!rows.length) {
    return (
      <div className="meta-ads-line-chart__empty">
        Sem dados para comparação.
      </div>
    );
  }
  const max = Math.max(...rows.map((r) => Number(r[metricKey]) || 0), 0.0001);
  return (
    <div className="meta-ads-bars">
      {rows.map((row) => {
        const value = Number(row[metricKey]) || 0;
        const pct = Math.max(2, (value / max) * 100);
        return (
          <div className="meta-ads-bar-row" key={row.id || row[nameKey]}>
            <div className="meta-ads-bar-row__name" title={row[nameKey]}>
              {row[nameKey]}
            </div>
            <div className="meta-ads-bar-row__track" aria-hidden="true">
              <div
                className="meta-ads-bar-row__fill"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="meta-ads-bar-row__value">
              {formatMetric(metricKey, value)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function MetaAds() {
  const [adAccounts, setAdAccounts] = useState([]);
  const [adAccountId, setAdAccountId] = useState('');
  const [period, setPeriod] = useState('last_30d');
  const [customSince, setCustomSince] = useState('');
  const [customUntil, setCustomUntil] = useState('');
  const [level, setLevel] = useState('campaign');
  const [campaignId, setCampaignId] = useState('');
  const [adsetId, setAdsetId] = useState('');
  const [compare, setCompare] = useState(false);
  const [chartMetric, setChartMetric] = useState('spend');
  const [compareMetric, setCompareMetric] = useState('spend');
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [sortKey, setSortKey] = useState('spend');
  const [sortDir, setSortDir] = useState('desc');

  const [campaignOptions, setCampaignOptions] = useState([]);
  const [adsetOptions, setAdsetOptions] = useState([]);
  const [statusById, setStatusById] = useState({});

  const [summary, setSummary] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [rows, setRows] = useState([]);
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);
  const [crumb, setCrumb] = useState([]);

  const requestIdRef = useRef(0);

  // Sem conexão ativa, repetir a requisição não resolve: o caminho é conectar.
  const needsMetaConnection =
    /conex(ã|a)o meta|não possui conexão|token/i.test(error) ||
    (!!error && adAccounts.length === 0);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const assets = await metaApi.getAssets();
        if (cancelled) return;
        const accounts = assets.adAccounts || [];
        setAdAccounts(accounts);
        if (accounts[0]?.accountId) {
          setAdAccountId(String(accounts[0].accountId));
        } else {
          setLoading(false);
        }
      } catch (err) {
        if (cancelled) return;
        setError(
          err?.response?.data?.message ||
            'Não foi possível carregar as contas de anúncio.'
        );
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const periodParams = useMemo(() => {
    if (period === 'custom') {
      if (!customSince || !customUntil) return null;
      return { since: customSince, until: customUntil };
    }
    return { datePreset: period };
  }, [period, customSince, customUntil]);

  const resolvedRange = useMemo(() => {
    if (period === 'custom') {
      if (!customSince || !customUntil) return null;
      return { since: customSince, until: customUntil };
    }
    return rangeFromPreset(period);
  }, [period, customSince, customUntil]);

  async function loadEntityOptions(accountId, campId) {
    if (!accountId) return;
    try {
      const campaignsRes = await metaAdsApi.listCampaigns({
        adAccountId: accountId,
      });
      const campaigns = campaignsRes.campaigns || [];
      setCampaignOptions(campaigns);
      const statusMap = {};
      for (const c of campaigns) {
        statusMap[c.id] = c.effectiveStatus || c.status;
      }
      setStatusById((prev) => ({ ...prev, ...statusMap }));

      if (campId) {
        const adsetsRes = await metaAdsApi.listAdSets({
          adAccountId: accountId,
          campaignId: campId,
        });
        const adsets = adsetsRes.adsets || [];
        setAdsetOptions(adsets);
        const adsetStatus = {};
        for (const a of adsets) {
          adsetStatus[a.id] = a.effectiveStatus || a.status;
        }
        setStatusById((prev) => ({ ...prev, ...adsetStatus }));
      } else {
        setAdsetOptions([]);
      }
    } catch {
      /* filtros opcionais */
    }
  }

  async function loadDashboard({ soft = false } = {}) {
    if (!adAccountId || !periodParams) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const reqId = ++requestIdRef.current;
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError('');

    const base = {
      adAccountId,
      level,
      ...periodParams,
      ...(campaignId ? { campaignId } : {}),
      ...(adsetId ? { adsetId } : {}),
    };

    try {
      await loadEntityOptions(adAccountId, campaignId || undefined);

      const [insightsRes, seriesRes, compareRes] = await Promise.all([
        metaAdsApi.getInsights(base),
        metaAdsApi
          .getInsights({
            ...base,
            level: campaignId || adsetId ? level : 'account',
            timeIncrement: 1,
          })
          .catch(() => null),
        compare && resolvedRange
          ? metaAdsApi
              .compare({
                adAccountId,
                level: 'account',
                since: resolvedRange.since,
                until: resolvedRange.until,
                ...previousRange(resolvedRange.since, resolvedRange.until),
                ...(campaignId ? { campaignId } : {}),
                ...(adsetId ? { adsetId } : {}),
              })
              .catch(() => null)
          : Promise.resolve(null),
      ]);

      if (reqId !== requestIdRef.current) return;

      setSummary(insightsRes.summary || null);
      setRows(Array.isArray(insightsRes.data) ? insightsRes.data : []);
      setComparison(compareRes?.comparison || null);

      const daily = Array.isArray(seriesRes?.data) ? seriesRes.data : [];
      const byDate = new Map();
      for (const row of daily) {
        const key = row.dateStart || 'unknown';
        const prev = byDate.get(key) || {
          spend: 0,
          impressions: 0,
          reach: 0,
          clicks: 0,
          conversions: 0,
        };
        prev.spend += Number(row.spend) || 0;
        prev.impressions += Number(row.impressions) || 0;
        prev.reach += Number(row.reach) || 0;
        prev.clicks += Number(row.clicks) || 0;
        prev.conversions += Number(row.conversions) || 0;
        byDate.set(key, prev);
      }
      const chartRows = [...byDate.entries()]
        .filter(([k]) => k !== 'unknown')
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, agg]) => {
          const impressions = agg.impressions || 0;
          const clicks = agg.clicks || 0;
          const spend = agg.spend || 0;
          const conversions = agg.conversions || 0;
          return {
            label: date.slice(5).replace('-', '/'),
            date,
            spend,
            impressions,
            reach: agg.reach,
            clicks,
            conversions,
            ctr: impressions ? (clicks / impressions) * 100 : 0,
            cpc: clicks ? spend / clicks : 0,
            cpm: impressions ? (spend / impressions) * 1000 : 0,
            cpa: conversions ? spend / conversions : 0,
            roas: 0,
          };
        });
      setSeries(chartRows);
      setUpdatedAt(new Date());
    } catch (err) {
      if (reqId !== requestIdRef.current) return;
      setSummary(null);
      setRows([]);
      setSeries([]);
      setComparison(null);
      setError(
        err?.response?.data?.message ||
          'Não foi possível carregar as métricas do Meta Ads.'
      );
    } finally {
      if (reqId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filtros controlam o fetch
  }, [adAccountId, periodParams, level, campaignId, adsetId, compare]);

  const chartSeries = useMemo(
    () =>
      series.map((p) => ({
        label: p.label,
        value: p[chartMetric],
      })),
    [series, chartMetric]
  );

  const filteredRows = useMemo(() => {
    let list = rows;
    if (searchDebounced) {
      const q = searchDebounced.toLowerCase();
      list = list.filter((row) =>
        String(rowName(row, level)).toLowerCase().includes(q)
      );
    }
    const sorted = [...list].sort((a, b) => {
      const av = Number(a[sortKey]) || 0;
      const bv = Number(b[sortKey]) || 0;
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return sorted;
  }, [rows, searchDebounced, sortKey, sortDir, level]);

  const comparisonBars = useMemo(() => {
    const source =
      level === 'account'
        ? rows
        : rows.map((r) => ({
            id: rowId(r, level),
            name: rowName(r, level),
            ...r,
          }));
    return [...source]
      .map((r) => ({
        id: rowId(r, level) || r.campaignId || r.name,
        name: rowName(r, level),
        spend: Number(r.spend) || 0,
        ctr: Number(r.ctr) || 0,
        cpa: Number(r.cpa) || 0,
        roas: Number(r.roas) || 0,
      }))
      .sort((a, b) => (b[compareMetric] || 0) - (a[compareMetric] || 0))
      .slice(0, 8);
  }, [rows, level, compareMetric]);

  const spendDistribution = useMemo(() => {
    const total = comparisonBars.reduce((acc, r) => acc + (r.spend || 0), 0);
    if (!total) return [];
    return comparisonBars.slice(0, 5).map((r) => ({
      ...r,
      pct: (r.spend / total) * 100,
    }));
  }, [comparisonBars]);

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'cpa' || key === 'cpc' || key === 'cpm' ? 'asc' : 'desc');
    }
  }

  function onLevelChange(next) {
    setLevel(next);
    if (next === 'account') {
      setCampaignId('');
      setAdsetId('');
      setCrumb([]);
    } else if (next === 'campaign') {
      setAdsetId('');
      if (!campaignId) setCrumb([]);
    }
  }

  function drillInto(row) {
    if (level === 'campaign') {
      const id = row.campaignId;
      if (!id) return;
      setCampaignId(id);
      setAdsetId('');
      setLevel('adset');
      setCrumb([
        { label: row.campaignName || 'Campanha', campaignId: id },
      ]);
    } else if (level === 'adset') {
      const id = row.adsetId;
      if (!id) return;
      setAdsetId(id);
      setLevel('ad');
      setCrumb((prev) => [
        ...prev.filter((c) => c.campaignId),
        {
          label: row.adsetName || 'Conjunto',
          campaignId: row.campaignId || campaignId,
          adsetId: id,
        },
      ]);
    }
  }

  function resetCrumbToRoot() {
    setCampaignId('');
    setAdsetId('');
    setLevel('campaign');
    setCrumb([]);
  }

  function goCrumb(index) {
    if (index < 0) {
      resetCrumbToRoot();
      return;
    }
    const item = crumb[index];
    if (!item) return;
    if (item.adsetId) {
      setCampaignId(item.campaignId || '');
      setAdsetId(item.adsetId);
      setLevel('ad');
      setCrumb(crumb.slice(0, index + 1));
    } else {
      setCampaignId(item.campaignId || '');
      setAdsetId('');
      setLevel('adset');
      setCrumb(crumb.slice(0, index + 1));
    }
  }

  const searchPlaceholder =
    level === 'ad'
      ? 'Buscar anúncio...'
      : level === 'adset'
        ? 'Buscar conjunto...'
        : 'Buscar campanha...';

  const tableTitle =
    level === 'ad'
      ? 'Anúncios'
      : level === 'adset'
        ? 'Conjuntos de anúncios'
        : level === 'account'
          ? 'Resumo da conta'
          : 'Campanhas';

  const updatedLabel = updatedAt
    ? `Última atualização: ${updatedAt.toLocaleDateString('pt-BR')} às ${updatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    : null;

  if (!loading && !adAccounts.length && !error) {
    return (
      <div className="meta-ads-page">
        <header className="page-header meta-ads-page__header">
          <div className="page-header__copy">
            <h1 className="page-header__title">Meta Ads</h1>
            <p className="page-header__subtitle">
              Acompanhe o desempenho das suas campanhas, conjuntos e anúncios.
            </p>
          </div>
        </header>
        <section className="card meta-ads-empty">
          <h3>Nenhuma conta de anúncio encontrada</h3>
          <p>
            Conecte e sincronize seus ativos Meta para visualizar as métricas.
          </p>
          <Link className="btn btn-primary" to="/meta">
            Ir para Conexão Meta
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="meta-ads-page">
      <header className="page-header meta-ads-page__header">
        <div className="page-header__copy">
          <h1 className="page-header__title">Meta Ads</h1>
          <p className="page-header__subtitle">
            Acompanhe o desempenho das suas campanhas, conjuntos e anúncios.
          </p>
        </div>
        <div className="page-header__actions meta-ads-page__header-actions">
          {updatedLabel ? (
            <span className="meta-ads-page__updated">{updatedLabel}</span>
          ) : null}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => loadDashboard({ soft: true })}
            disabled={loading || refreshing || !adAccountId}
          >
            {refreshing ? 'Atualizando…' : 'Atualizar'}
          </button>
        </div>
      </header>

      {(crumb.length > 0 || campaignId) && (
        <nav className="meta-ads-page__crumb" aria-label="Hierarquia Meta Ads">
          <button type="button" onClick={resetCrumbToRoot}>
            Meta Ads
          </button>
          {crumb.map((item, index) => (
            <span key={`${item.label}-${index}`}>
              <span aria-hidden="true">/</span>{' '}
              <button type="button" onClick={() => goCrumb(index)}>
                {item.label}
              </button>
            </span>
          ))}
        </nav>
      )}

      <section className="card meta-ads-filters">
        <div className="meta-ads-filters__row">
          <label className="field">
            <span className="field-label">Período</span>
            <select
              className="input"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              {PERIOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          {period === 'custom' ? (
            <>
              <label className="field">
                <span className="field-label">Data inicial</span>
                <input
                  className="input"
                  type="date"
                  value={customSince}
                  onChange={(e) => setCustomSince(e.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">Data final</span>
                <input
                  className="input"
                  type="date"
                  value={customUntil}
                  onChange={(e) => setCustomUntil(e.target.value)}
                />
              </label>
            </>
          ) : null}

          <label className="field">
            <span className="field-label">Conta</span>
            <select
              className="input"
              value={adAccountId}
              onChange={(e) => {
                setAdAccountId(e.target.value);
                setCampaignId('');
                setAdsetId('');
                setCrumb([]);
              }}
            >
              {adAccounts.map((acc) => (
                <option key={acc.accountId} value={acc.accountId}>
                  {acc.name || acc.accountId}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field-label">Nível</span>
            <select
              className="input"
              value={level}
              onChange={(e) => onLevelChange(e.target.value)}
            >
              {LEVEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          {level !== 'account' ? (
            <label className="field">
              <span className="field-label">Campanha</span>
              <select
                className="input"
                value={campaignId}
                onChange={(e) => {
                  const next = e.target.value;
                  setCampaignId(next);
                  setAdsetId('');
                  if (next) {
                    const camp = campaignOptions.find((c) => c.id === next);
                    setCrumb([
                      { label: camp?.name || 'Campanha', campaignId: next },
                    ]);
                    if (level === 'campaign') setLevel('adset');
                  } else {
                    setCrumb([]);
                  }
                }}
                disabled={level === 'campaign' && !campaignId ? false : false}
              >
                <option value="">Todas</option>
                {campaignOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {level === 'adset' || level === 'ad' ? (
            <label className="field">
              <span className="field-label">Conjunto</span>
              <select
                className="input"
                value={adsetId}
                onChange={(e) => {
                  const next = e.target.value;
                  setAdsetId(next);
                  if (next) {
                    const adset = adsetOptions.find((a) => a.id === next);
                    setCrumb((prev) => {
                      const base = prev.filter((c) => c.campaignId && !c.adsetId);
                      if (!base.length && campaignId) {
                        const camp = campaignOptions.find(
                          (c) => c.id === campaignId
                        );
                        base.push({
                          label: camp?.name || 'Campanha',
                          campaignId,
                        });
                      }
                      return [
                        ...base,
                        {
                          label: adset?.name || 'Conjunto',
                          campaignId: campaignId || adset?.campaignId,
                          adsetId: next,
                        },
                      ];
                    });
                    setLevel('ad');
                  }
                }}
                disabled={!campaignId && level === 'ad'}
              >
                <option value="">Todos</option>
                {adsetOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="meta-ads-filters__compare">
            <label>
              <input
                type="checkbox"
                checked={compare}
                onChange={(e) => setCompare(e.target.checked)}
              />
              Comparar com período anterior
            </label>
          </div>
        </div>
      </section>

      {error ? (
        <section className="card meta-ads-error" role="alert">
          <h3>Não foi possível carregar as métricas do Meta Ads.</h3>
          <p>{error}</p>
          <div className="meta-ads-error__actions">
            {needsMetaConnection ? (
              <Link className="btn btn-primary" to="/meta">
                Conectar conta da Meta
              </Link>
            ) : null}
            <button
              type="button"
              className={`btn ${needsMetaConnection ? 'btn-secondary' : 'btn-primary'}`}
              onClick={() => loadDashboard()}
            >
              Tentar novamente
            </button>
          </div>
        </section>
      ) : null}

      {loading ? (
        <div className="meta-ads-skeleton" aria-busy="true" aria-label="Carregando métricas">
          <div className="meta-ads-skeleton__row">
            <div className="meta-ads-skeleton__block" />
            <div className="meta-ads-skeleton__block" />
            <div className="meta-ads-skeleton__block" />
            <div className="meta-ads-skeleton__block" />
          </div>
          <div className="meta-ads-skeleton__row">
            <div className="meta-ads-skeleton__block" />
            <div className="meta-ads-skeleton__block" />
            <div className="meta-ads-skeleton__block" />
            <div className="meta-ads-skeleton__block" />
          </div>
          <div className="meta-ads-skeleton__block meta-ads-skeleton__wide" />
        </div>
      ) : null}

      {!loading && !error && summary ? (
        <>
          <section className="meta-ads-kpis" aria-label="Resumo de métricas">
            {SUMMARY_CARD_KEYS.map((key) => {
              const meta = METRIC_META[key];
              const cmp = comparison?.[key];
              const value = summary[key];
              const tone = cmp
                ? variationTone(key, cmp.percentageChange)
                : 'neutral';
              return (
                <article className="meta-ads-kpi" key={key}>
                  <div className="meta-ads-kpi__label">
                    <span>{meta.label}</span>
                    <button
                      type="button"
                      className="meta-ads-kpi__help"
                      title={meta.tip}
                      aria-label={meta.tip}
                    >
                      <span className="material-symbols-outlined" aria-hidden="true">
                        help
                      </span>
                    </button>
                  </div>
                  <div className="meta-ads-kpi__value">
                    {formatMetric(key, value)}
                  </div>
                  {compare && cmp ? (
                    <>
                      <div className={`meta-ads-kpi__delta is-${tone}`}>
                        {formatVariation(cmp.percentageChange)} vs período anterior
                      </div>
                      <div className="meta-ads-kpi__prev">
                        Anterior: {formatMetric(key, cmp.previous)}
                      </div>
                    </>
                  ) : null}
                </article>
              );
            })}
          </section>

          <section className="meta-ads-charts">
            <article className="card meta-ads-chart-card">
              <div className="meta-ads-chart-card__head">
                <div>
                  <h2>Performance ao longo do tempo</h2>
                  <p>Evolução diária no período selecionado.</p>
                </div>
                <div className="meta-ads-metric-tabs" role="tablist" aria-label="Métrica do gráfico">
                  {CHART_METRIC_KEYS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={chartMetric === key}
                      className={chartMetric === key ? 'is-active' : undefined}
                      onClick={() => setChartMetric(key)}
                    >
                      {METRIC_META[key].label}
                    </button>
                  ))}
                </div>
              </div>
              <LineChart series={chartSeries} metricKey={chartMetric} />
            </article>

            <article className="card meta-ads-chart-card">
              <div className="meta-ads-chart-card__head">
                <div>
                  <h2>
                    {METRIC_META[compareMetric]?.label || 'Métrica'} por{' '}
                    {level === 'ad'
                      ? 'anúncio'
                      : level === 'adset'
                        ? 'conjunto'
                        : 'campanha'}
                  </h2>
                  <p>Comparação dos principais itens do nível atual.</p>
                </div>
                <div className="meta-ads-metric-tabs" role="tablist">
                  {['spend', 'ctr', 'cpa', 'roas'].map((key) => (
                    <button
                      key={key}
                      type="button"
                      className={compareMetric === key ? 'is-active' : undefined}
                      onClick={() => setCompareMetric(key)}
                    >
                      {METRIC_META[key].label}
                    </button>
                  ))}
                </div>
              </div>
              <BarList rows={comparisonBars} metricKey={compareMetric} />
              {spendDistribution.length > 0 && compareMetric === 'spend' ? (
                <div className="meta-ads-bars" style={{ marginTop: 8 }}>
                  <p className="text-subtitle" style={{ margin: '8px 0 0' }}>
                    Distribuição de gasto
                  </p>
                  {spendDistribution.map((row) => (
                    <div className="meta-ads-bar-row" key={`dist-${row.id}`}>
                      <div className="meta-ads-bar-row__name">{row.name}</div>
                      <div className="meta-ads-bar-row__track" aria-hidden="true">
                        <div
                          className="meta-ads-bar-row__fill"
                          style={{ width: `${Math.max(2, row.pct)}%` }}
                        />
                      </div>
                      <div className="meta-ads-bar-row__value">
                        {row.pct.toLocaleString('pt-BR', {
                          maximumFractionDigits: 0,
                        })}
                        %
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          </section>

          <section className="card meta-ads-table-card">
            <div className="meta-ads-table-toolbar">
              <h2>{tableTitle}</h2>
              {level !== 'account' ? (
                <label className="field">
                  <span className="sr-only">{searchPlaceholder}</span>
                  <input
                    className="input"
                    type="search"
                    placeholder={searchPlaceholder}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label={searchPlaceholder}
                  />
                </label>
              ) : null}
            </div>

            {!filteredRows.length ? (
              <div className="meta-ads-empty">
                <h3>Nenhum dado encontrado para o período selecionado.</h3>
                <p>Ajuste o período ou o nível de visualização e tente novamente.</p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setPeriod('last_30d')}
                >
                  Alterar período
                </button>
              </div>
            ) : (
              <div className="meta-ads-table-wrap">
                <table className="meta-ads-table">
                  <thead>
                    <tr>
                      <th scope="col">Nome</th>
                      <th scope="col">Status</th>
                      {TABLE_SORT_KEYS.map((key) => (
                        <th scope="col" key={key}>
                          <button type="button" onClick={() => toggleSort(key)}>
                            {METRIC_META[key].label}
                            {sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => {
                      const id = rowId(row, level);
                      const statusRaw =
                        statusById[id] ||
                        statusById[row.campaignId] ||
                        statusById[row.adsetId] ||
                        statusById[row.adId];
                      const status = campaignStatusMeta(statusRaw);
                      const clickable = level === 'campaign' || level === 'adset';
                      return (
                        <tr
                          key={id || `${rowName(row, level)}-${row.spend}`}
                          className={clickable ? 'is-clickable' : undefined}
                          onClick={() => clickable && drillInto(row)}
                          onKeyDown={(e) => {
                            if (!clickable) return;
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              drillInto(row);
                            }
                          }}
                          tabIndex={clickable ? 0 : undefined}
                          title={
                            clickable
                              ? level === 'campaign'
                                ? 'Ver conjuntos desta campanha'
                                : 'Ver anúncios deste conjunto'
                              : undefined
                          }
                        >
                          <td className="meta-ads-table__name">
                            {rowName(row, level)}
                          </td>
                          <td>
                            <span
                              className={`meta-ads-status is-${status.tone}`}
                            >
                              {status.label}
                            </span>
                          </td>
                          {TABLE_SORT_KEYS.map((key) => (
                            <td key={key}>{formatMetric(key, row[key])}</td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}

      {!loading && !error && !summary && periodParams ? (
        <section className="card meta-ads-empty">
          <h3>Nenhum dado encontrado para o período selecionado.</h3>
          <p>Tente outro período ou verifique se a conta possui anúncios ativos.</p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setPeriod('last_30d')}
          >
            Alterar período
          </button>
        </section>
      ) : null}

      {period === 'custom' && !periodParams ? (
        <section className="card meta-ads-empty">
          <h3>Selecione o período personalizado</h3>
          <p>Informe a data inicial e a data final para carregar as métricas.</p>
        </section>
      ) : null}
    </div>
  );
}
