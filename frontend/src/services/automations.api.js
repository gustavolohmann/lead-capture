import { api } from './api.js';

export const automationsApi = {
  async list() {
    const { data } = await api.get('/automations');
    return data;
  },

  async create(payload) {
    const { data } = await api.post('/automations', payload);
    return data;
  },

  async setActive(id, active) {
    const { data } = await api.patch(`/automations/${id}`, { active });
    return data;
  },
};
