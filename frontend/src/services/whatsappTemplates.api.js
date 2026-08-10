import { api } from './api.js';

export const whatsappTemplatesApi = {
  async list(params = {}) {
    const { data } = await api.get('/whatsapp/templates', { params });
    return data;
  },

  async sync(wabaId) {
    const { data } = await api.post('/whatsapp/templates/sync', {
      wabaId: wabaId || undefined,
    });
    return data;
  },

  async create(payload) {
    const { data } = await api.post('/whatsapp/templates', payload);
    return data;
  },
};
