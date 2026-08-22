import { describe, expect, it } from 'vitest';
import {
  compareMetric,
  compareSummaries,
  computeCpa,
  computeCpc,
  computeCpm,
  computeCtr,
  computeRoas,
  findActionValue,
  normalizeMetaInsight,
  percentChange,
  summarizeInsights,
  toNumber,
} from '../meta.insights.normalize.js';

describe('meta.insights.normalize', () => {
  describe('toNumber', () => {
    it('parses numeric strings', () => {
      expect(toNumber('1250.50')).toBe(1250.5);
      expect(toNumber(10)).toBe(10);
    });

    it('returns null for invalid values', () => {
      expect(toNumber('')).toBeNull();
      expect(toNumber(null)).toBeNull();
      expect(toNumber('abc')).toBeNull();
    });
  });

  describe('findActionValue', () => {
    const actions = [
      { action_type: 'link_click', value: '100' },
      { action_type: 'purchase', value: '40' },
      { action_type: 'omni_purchase', value: '42' },
      { action_type: 'lead', value: '12' },
    ];

    it('returns first matching action type without double counting', () => {
      expect(findActionValue(actions, ['purchase', 'omni_purchase'])).toBe(40);
    });

    it('returns null for missing action type', () => {
      expect(findActionValue(actions, ['complete_registration'])).toBeNull();
    });

    it('handles empty actions', () => {
      expect(findActionValue([], ['purchase'])).toBeNull();
      expect(findActionValue(null, ['purchase'])).toBeNull();
    });
  });

  describe('rates', () => {
    it('uses Meta CTR when present', () => {
      expect(
        computeCtr({ clicks: 10, impressions: 1000, apiCtr: '2.5' })
      ).toBe(2.5);
    });

    it('computes CTR when api value missing', () => {
      expect(computeCtr({ clicks: 50, impressions: 2000 })).toBe(2.5);
    });

    it('returns null CPC when clicks = 0', () => {
      expect(computeCpc({ spend: 100, clicks: 0 })).toBeNull();
    });

    it('returns null CPM when impressions = 0', () => {
      expect(computeCpm({ spend: 100, impressions: 0 })).toBeNull();
    });

    it('computes CPC and CPM', () => {
      expect(computeCpc({ spend: 100, clicks: 50 })).toBe(2);
      expect(computeCpm({ spend: 100, impressions: 1000 })).toBe(100);
    });
  });

  describe('CPA / ROAS', () => {
    it('CPA from spend/conversions', () => {
      expect(computeCpa({ spend: 1000, conversions: 50 })).toBe(20);
    });

    it('CPA null when conversions = 0', () => {
      expect(computeCpa({ spend: 1000, conversions: 0 })).toBeNull();
    });

    it('prefers cost_per_action_type when available', () => {
      expect(
        computeCpa({
          spend: 1000,
          conversions: 50,
          costPerActionType: [{ action_type: 'purchase', value: '18.5' }],
          actionTypes: ['purchase'],
        })
      ).toBe(18.5);
    });

    it('ROAS null when spend = 0', () => {
      expect(computeRoas({ spend: 0, revenue: 100 })).toBeNull();
    });

    it('ROAS from purchase_roas', () => {
      expect(
        computeRoas({
          spend: 100,
          purchaseRoas: [{ action_type: 'purchase', value: '4.5' }],
        })
      ).toBe(4.5);
    });
  });

  describe('normalizeMetaInsight', () => {
    it('normalizes a Meta row', () => {
      const row = normalizeMetaInsight({
        campaign_id: '123',
        campaign_name: 'Campanha A',
        spend: '2100.00',
        impressions: '310000',
        reach: '220000',
        clicks: '8200',
        ctr: '2.645',
        cpc: '0.256',
        cpm: '6.774',
        actions: [
          { action_type: 'purchase', value: '150' },
          { action_type: 'link_click', value: '8000' },
        ],
        action_values: [{ action_type: 'purchase', value: '11130' }],
        purchase_roas: [{ action_type: 'purchase', value: '5.3' }],
      });

      expect(row.campaignId).toBe('123');
      expect(row.spend).toBe(2100);
      expect(row.impressions).toBe(310000);
      expect(row.clicks).toBe(8200);
      expect(row.conversions).toBe(150);
      expect(row.cpa).toBeCloseTo(14);
      expect(row.roas).toBe(5.3);
      expect(typeof row.spend).toBe('number');
    });

    it('zeros conversions when actions empty', () => {
      const row = normalizeMetaInsight({
        spend: '10',
        impressions: '100',
        clicks: '5',
        actions: [],
      });
      expect(row.conversions).toBe(0);
      expect(row.cpa).toBeNull();
    });
  });

  describe('summarizeInsights', () => {
    it('computes rates from totals not averages', () => {
      const summary = summarizeInsights([
        {
          spend: 100,
          impressions: 1000,
          reach: 800,
          clicks: 10,
          conversions: 2,
          revenue: 200,
          ctr: 99,
          cpc: 99,
          cpm: 99,
          cpa: 99,
          roas: 99,
        },
        {
          spend: 300,
          impressions: 3000,
          reach: 2000,
          clicks: 30,
          conversions: 6,
          revenue: 900,
          ctr: 1,
          cpc: 1,
          cpm: 1,
          cpa: 1,
          roas: 1,
        },
      ]);

      expect(summary.spend).toBe(400);
      expect(summary.impressions).toBe(4000);
      expect(summary.reach).toBeNull();
      expect(summary.clicks).toBe(40);
      expect(summary.conversions).toBe(8);
      expect(summary.ctr).toBe(1); // 40/4000*100
      expect(summary.cpc).toBe(10); // 400/40
      expect(summary.cpm).toBe(100); // 400/4000*1000
      expect(summary.cpa).toBe(50); // 400/8
      expect(summary.roas).toBe(2.75); // 1100/400
    });

    it('mantém reach e calcula frequency para uma linha agregada', () => {
      const summary = summarizeInsights([
        { spend: 10, impressions: 1000, reach: 400, clicks: 10, conversions: 1 },
      ]);
      expect(summary.reach).toBe(400);
      expect(summary.frequency).toBe(2.5);
    });
  });

  describe('comparison', () => {
    it('computes percentage change', () => {
      expect(percentChange(2.5, 2)).toBe(25);
      expect(percentChange(18, 24)).toBe(-25);
    });

    it('handles previous = 0', () => {
      expect(percentChange(0, 0)).toBe(0);
      expect(percentChange(10, 0)).toBeNull();
      expect(compareMetric(10, 0).percentageChange).toBeNull();
    });

    it('compares full summaries', () => {
      const comparison = compareSummaries(
        { spend: 100, ctr: 2.5, cpa: 18 },
        { spend: 80, ctr: 2, cpa: 24 }
      );
      expect(comparison.spend.difference).toBe(20);
      expect(comparison.ctr.percentageChange).toBe(25);
      expect(comparison.cpa.percentageChange).toBe(-25);
    });
  });
});
