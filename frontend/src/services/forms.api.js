import { api } from './api.js';

export const formsApi = {
  async list() {
    const { data } = await api.get('/forms');
    return data;
  },

  async getById(id) {
    const { data } = await api.get(`/forms/${id}`);
    return data;
  },

  async create(payload) {
    const { data } = await api.post('/forms', payload);
    return data;
  },

  async update(id, payload) {
    const { data } = await api.put(`/forms/${id}`, payload);
    return data;
  },

  async remove(id) {
    const { data } = await api.delete(`/forms/${id}`);
    return data;
  },

  async getPublic(id) {
    const { data } = await api.get(`/forms/${id}/public`);
    return data;
  },

  async submit(id, answers) {
    const { data } = await api.post(`/forms/${id}/submit`, { answers });
    return data;
  },
};
