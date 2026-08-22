import { api } from './api.js';

export const campaignsApi = {
  async list() {
    const { data } = await api.get('/campaigns');
    return data;
  },

  async create(payload) {
    const { data } = await api.post('/campaigns', payload);
    return data;
  },

  async details(id) {
    const { data } = await api.get(`/campaigns/${id}`);
    return data;
  },

  async pause(id) {
    const { data } = await api.patch(`/campaigns/${id}/pause`);
    return data;
  },

  async activate(id) {
    const { data } = await api.patch(`/campaigns/${id}/activate`);
    return data;
  },

  async pauseAd(campaignId, adId) {
    const { data } = await api.patch(
      `/campaigns/${campaignId}/ads/${adId}/pause`
    );
    return data;
  },

  async activateAd(campaignId, adId) {
    const { data } = await api.patch(
      `/campaigns/${campaignId}/ads/${adId}/activate`
    );
    return data;
  },

  async addAd(campaignId, payload, { idempotencyKey } = {}) {
    const { data } = await api.post(
      `/campaigns/${campaignId}/ads`,
      payload,
      {
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
      }
    );
    return data;
  },
};
