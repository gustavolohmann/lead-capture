import { api } from './api.js';

export const campaignAutomationsApi = {
  async list(campaignId) {
    const { data } = await api.get(`/campaigns/${campaignId}/automations`);
    return data;
  },

  async create(campaignId, payload) {
    const { data } = await api.post(
      `/campaigns/${campaignId}/automations`,
      payload
    );
    return data;
  },

  async update(automationId, payload) {
    const { data } = await api.put(`/automations/${automationId}`, payload);
    return data;
  },

  async getById(automationId) {
    const { data } = await api.get(`/automations/${automationId}`);
    return data;
  },

  async test(automationId) {
    const { data } = await api.post(`/automations/${automationId}/test`);
    return data;
  },
};
