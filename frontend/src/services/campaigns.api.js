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

  async pause(id) {
    const { data } = await api.patch(`/campaigns/${id}/pause`);
    return data;
  },

  async activate(id) {
    const { data } = await api.patch(`/campaigns/${id}/activate`);
    return data;
  },
};
