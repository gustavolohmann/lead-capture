import { api } from './api.js';

export const leadsApi = {
  async list() {
    const { data } = await api.get('/leads');
    return data;
  },

  async getById(id) {
    const { data } = await api.get(`/leads/${id}`);
    return data;
  },
};
