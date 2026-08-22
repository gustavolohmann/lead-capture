import { api } from './api.js';

export const metaAdsApi = {
  async getInsights(params) {
    const { data } = await api.get('/meta-ads/insights', { params });
    return data;
  },

  async getSummary(params) {
    const { data } = await api.get('/meta-ads/summary', { params });
    return data;
  },

  async listCampaigns(params) {
    const { data } = await api.get('/meta-ads/campaigns', { params });
    return data;
  },

  async listAdSets(params) {
    const { data } = await api.get('/meta-ads/adsets', { params });
    return data;
  },

  async listAds(params) {
    const { data } = await api.get('/meta-ads/ads', { params });
    return data;
  },

  async compare(params) {
    const { data } = await api.get('/meta-ads/comparison', { params });
    return data;
  },
};
