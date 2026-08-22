/**
 * Pure helpers for Meta Ads Insights normalization.
 * No HTTP, no tokens — safe to unit test.
 */

export const DEFAULT_PURCHASE_ACTIONS = ['purchase', 'omni_purchase'];
export const DEFAULT_LEAD_ACTIONS = ['lead', 'onsite_conversion.lead_grouped'];

export function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Find first matching action_type value. Does not sum across types
 * (avoids double-counting omni_purchase + purchase).
 */
export function findActionValue(actions, actionTypes = []) {
  if (!Array.isArray(actions) || actionTypes.length === 0) return null;
  const wanted = new Set(actionTypes.map(String));
  for (const item of actions) {
    if (!item || !wanted.has(String(item.action_type))) continue;
    const value = toNumber(item.value);
    if (value != null) return value;
  }
  return null;
}

export function findActionValueSumDistinct(actions, actionTypes = []) {
  // Prefer first match only — alias for findActionValue (no double count)
  return findActionValue(actions, actionTypes);
}

export function extractRoas(purchaseRoas) {
  if (!Array.isArray(purchaseRoas) || purchaseRoas.length === 0) return null;
  // Prefer purchase ROAS entry when present
  const preferred =
    purchaseRoas.find((item) =>
      ['purchase', 'omni_purchase'].includes(String(item?.action_type || ''))
    ) || purchaseRoas[0];
  return toNumber(preferred?.value);
}

export function extractPurchaseRevenue(actionValues, actionTypes = DEFAULT_PURCHASE_ACTIONS) {
  return findActionValue(actionValues, actionTypes);
}

export function safeDivide(numerator, denominator) {
  const n = toNumber(numerator);
  const d = toNumber(denominator);
  if (n == null || d == null || d === 0) return null;
  return n / d;
}

export function computeCtr({ clicks, impressions, apiCtr }) {
  const fromApi = toNumber(apiCtr);
  if (fromApi != null) return fromApi;
  const c = toNumber(clicks);
  const i = toNumber(impressions);
  if (c == null || i == null || i === 0) return null;
  return (c / i) * 100;
}

export function computeCpc({ spend, clicks, apiCpc }) {
  const fromApi = toNumber(apiCpc);
  if (fromApi != null) return fromApi;
  return safeDivide(spend, clicks);
}

export function computeCpm({ spend, impressions, apiCpm }) {
  const fromApi = toNumber(apiCpm);
  if (fromApi != null) return fromApi;
  const s = toNumber(spend);
  const i = toNumber(impressions);
  if (s == null || i == null || i === 0) return null;
  return (s / i) * 1000;
}

export function computeCpa({ spend, conversions, costPerActionType, actionTypes }) {
  const fromMeta = findActionValue(costPerActionType, actionTypes);
  if (fromMeta != null) return fromMeta;
  return safeDivide(spend, conversions);
}

export function computeRoas({ spend, revenue, purchaseRoas }) {
  const fromApi = extractRoas(purchaseRoas);
  if (fromApi != null) return fromApi;
  return safeDivide(revenue, spend);
}

/**
 * Normalize a raw Meta Insights row into a frontend-friendly object.
 */
export function normalizeMetaInsight(item = {}, options = {}) {
  const conversionTypes =
    options.conversionActionTypes || DEFAULT_PURCHASE_ACTIONS;

  const spend = toNumber(item.spend) ?? 0;
  const impressions = toNumber(item.impressions) ?? 0;
  const reach = toNumber(item.reach) ?? 0;
  const clicks = toNumber(item.clicks) ?? 0;
  const frequency =
    toNumber(item.frequency) ?? safeDivide(impressions, reach);

  const conversions = findActionValue(item.actions, conversionTypes) ?? 0;
  const purchases = findActionValue(item.actions, DEFAULT_PURCHASE_ACTIONS);
  const revenue = extractPurchaseRevenue(item.action_values, conversionTypes);

  const ctr = computeCtr({
    clicks,
    impressions,
    apiCtr: item.ctr,
  });
  const cpc = computeCpc({ spend, clicks, apiCpc: item.cpc });
  const cpm = computeCpm({ spend, impressions, apiCpm: item.cpm });
  const cpa = computeCpa({
    spend,
    conversions,
    costPerActionType: item.cost_per_action_type,
    actionTypes: conversionTypes,
  });
  const roas = computeRoas({
    spend,
    revenue,
    purchaseRoas: item.purchase_roas,
  });

  return {
    campaignId: item.campaign_id || null,
    campaignName: item.campaign_name || null,
    adsetId: item.adset_id || null,
    adsetName: item.adset_name || null,
    adId: item.ad_id || null,
    adName: item.ad_name || null,
    dateStart: item.date_start || null,
    dateStop: item.date_stop || null,
    spend,
    impressions,
    reach,
    frequency,
    clicks,
    ctr,
    cpc,
    cpm,
    conversions,
    purchases: purchases ?? null,
    revenue: revenue ?? null,
    cpa,
    roas,
    actions: Array.isArray(item.actions) ? item.actions : [],
    costPerActionType: Array.isArray(item.cost_per_action_type)
      ? item.cost_per_action_type
      : [],
  };
}

/**
 * Aggregate totals. CTR/CPC/CPM/CPA/ROAS from totals — never averages of row rates.
 */
export function summarizeInsights(rows = [], options = {}) {
  const conversionTypes =
    options.conversionActionTypes || DEFAULT_PURCHASE_ACTIONS;

  let spend = 0;
  let impressions = 0;
  let reach = 0;
  let clicks = 0;
  let conversions = 0;
  let revenue = 0;
  let hasRevenue = false;

  for (const row of rows) {
    const item =
      row && Object.prototype.hasOwnProperty.call(row, 'campaign_id')
        ? normalizeMetaInsight(row, { conversionActionTypes: conversionTypes })
        : row;

    spend += toNumber(item.spend) || 0;
    impressions += toNumber(item.impressions) || 0;
    reach += toNumber(item.reach) || 0;
    clicks += toNumber(item.clicks) || 0;
    conversions += toNumber(item.conversions) || 0;
    if (item.revenue != null) {
      revenue += toNumber(item.revenue) || 0;
      hasRevenue = true;
    }
  }

  // Reach representa pessoas únicas e não pode ser somado entre entidades.
  // Ele só é confiável aqui quando a Meta devolveu uma única linha agregada.
  const aggregateReach = rows.length === 1 ? reach : null;

  return {
    spend,
    impressions,
    reach: aggregateReach,
    frequency:
      aggregateReach && aggregateReach > 0
        ? impressions / aggregateReach
        : null,
    clicks,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
    cpc: clicks > 0 ? spend / clicks : null,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : null,
    conversions,
    cpa: conversions > 0 ? spend / conversions : null,
    roas: hasRevenue && spend > 0 ? revenue / spend : null,
  };
}

export function percentChange(current, previous) {
  const c = toNumber(current);
  const p = toNumber(previous);
  if (c == null || p == null) return null;
  if (p === 0) {
    if (c === 0) return 0;
    return null;
  }
  return ((c - p) / Math.abs(p)) * 100;
}

export function compareMetric(current, previous) {
  const c = toNumber(current);
  const p = toNumber(previous);
  return {
    current: c,
    previous: p,
    difference: c != null && p != null ? c - p : null,
    percentageChange: percentChange(c, p),
  };
}

export function compareSummaries(currentSummary, previousSummary) {
  const keys = [
    'spend',
    'impressions',
    'reach',
    'frequency',
    'clicks',
    'ctr',
    'cpc',
    'cpm',
    'conversions',
    'cpa',
    'roas',
  ];
  const out = {};
  for (const key of keys) {
    out[key] = compareMetric(currentSummary?.[key], previousSummary?.[key]);
  }
  return out;
}

export const DATE_PRESETS = new Set([
  'today',
  'yesterday',
  'last_7d',
  'last_14d',
  'last_28d',
  'last_30d',
  'this_month',
  'last_month',
  'this_quarter',
  'last_quarter',
  'this_year',
  'last_year',
  'maximum',
]);

export const INSIGHT_LEVELS = new Set(['account', 'campaign', 'adset', 'ad']);

export function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function buildInsightFields() {
  return [
    'campaign_id',
    'campaign_name',
    'adset_id',
    'adset_name',
    'ad_id',
    'ad_name',
    'spend',
    'impressions',
    'reach',
    'frequency',
    'clicks',
    'ctr',
    'cpc',
    'cpm',
    'actions',
    'action_values',
    'cost_per_action_type',
    'purchase_roas',
    'date_start',
    'date_stop',
  ].join(',');
}
