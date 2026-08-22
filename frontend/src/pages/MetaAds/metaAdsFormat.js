import { formatBRL } from '../Campaigns/campaignMoney.js';

export function formatNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR');
}

export function formatPercent(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
}

export function formatRoas(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}x`;
}

export function formatMetric(key, value) {
  switch (key) {
    case 'spend':
    case 'cpc':
    case 'cpm':
    case 'cpa':
      return formatBRL(value);
    case 'ctr':
      return formatPercent(value);
    case 'roas':
      return formatRoas(value);
    case 'impressions':
    case 'reach':
    case 'clicks':
    case 'conversions':
      return formatNumber(value);
    default:
      return value == null ? '—' : String(value);
  }
}

export function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

export function rangeFromPreset(preset) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const until = toIsoDate(today);

  function daysAgo(n) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - n);
    return toIsoDate(d);
  }

  switch (preset) {
    case 'today':
      return { since: until, until };
    case 'yesterday': {
      const y = daysAgo(1);
      return { since: y, until: y };
    }
    case 'last_7d':
      return { since: daysAgo(6), until };
    case 'last_14d':
      return { since: daysAgo(13), until };
    case 'last_30d':
      return { since: daysAgo(29), until };
    case 'this_month': {
      const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
      return { since: toIsoDate(start), until };
    }
    case 'last_month': {
      const start = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1)
      );
      const end = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0)
      );
      return { since: toIsoDate(start), until: toIsoDate(end) };
    }
    default:
      return { since: daysAgo(29), until };
  }
}

export function previousRange(since, until) {
  const start = new Date(`${since}T00:00:00.000Z`);
  const end = new Date(`${until}T00:00:00.000Z`);
  const days = Math.round((end - start) / 86400000) + 1;
  const prevUntil = new Date(start);
  prevUntil.setUTCDate(prevUntil.getUTCDate() - 1);
  const prevSince = new Date(prevUntil);
  prevSince.setUTCDate(prevSince.getUTCDate() - (days - 1));
  return {
    previousSince: toIsoDate(prevSince),
    previousUntil: toIsoDate(prevUntil),
  };
}

/** @type {Record<string, { label: string; higherIsBetter: boolean; tip: string }>} */
export const METRIC_META = {
  spend: {
    label: 'Gasto',
    higherIsBetter: false,
    tip: 'Valor investido em anúncios no período.',
  },
  impressions: {
    label: 'Impressões',
    higherIsBetter: true,
    tip: 'Quantas vezes o anúncio foi exibido.',
  },
  reach: {
    label: 'Alcance',
    higherIsBetter: true,
    tip: 'Pessoas únicas que viram o anúncio.',
  },
  clicks: {
    label: 'Cliques',
    higherIsBetter: true,
    tip: 'Total de cliques no anúncio.',
  },
  ctr: {
    label: 'CTR',
    higherIsBetter: true,
    tip: 'Taxa de cliques em relação às impressões.',
  },
  cpc: {
    label: 'CPC',
    higherIsBetter: false,
    tip: 'Custo médio por clique.',
  },
  cpm: {
    label: 'CPM',
    higherIsBetter: false,
    tip: 'Custo a cada mil impressões.',
  },
  conversions: {
    label: 'Conversões',
    higherIsBetter: true,
    tip: 'Resultados de conversão no período.',
  },
  cpa: {
    label: 'CPA',
    higherIsBetter: false,
    tip: 'Custo médio por conversão.',
  },
  roas: {
    label: 'ROAS',
    higherIsBetter: true,
    tip: 'Retorno sobre o investimento em anúncios.',
  },
};

export const SUMMARY_CARD_KEYS = [
  'spend',
  'ctr',
  'cpc',
  'cpm',
  'conversions',
  'cpa',
  'roas',
  'clicks',
];

export const CHART_METRIC_KEYS = [
  'spend',
  'ctr',
  'cpc',
  'cpm',
  'cpa',
  'roas',
  'conversions',
];

export function variationTone(metricKey, percentageChange) {
  const n = Number(percentageChange);
  if (!Number.isFinite(n) || n === 0) return 'neutral';
  const meta = METRIC_META[metricKey];
  const up = n > 0;
  const good = meta?.higherIsBetter ? up : !up;
  return good ? 'good' : 'bad';
}

export function formatVariation(percentageChange) {
  const n = Number(percentageChange);
  if (!Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

export function rowName(row, level) {
  if (level === 'ad') return row.adName || row.adId || 'Anúncio';
  if (level === 'adset') return row.adsetName || row.adsetId || 'Conjunto';
  if (level === 'campaign')
    return row.campaignName || row.campaignId || 'Campanha';
  return row.campaignName || row.adName || row.adsetName || 'Conta';
}

export function rowId(row, level) {
  if (level === 'ad') return row.adId;
  if (level === 'adset') return row.adsetId;
  if (level === 'campaign') return row.campaignId;
  return row.campaignId || row.adsetId || row.adId;
}
