import { api } from './api.js';

export const adsBuilderApi = {
  async createFull(payload, { idempotencyKey } = {}) {
    const { data } = await api.post('/campaigns/full', payload, {
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
    });
    return data;
  },

  async listLeadForms() {
    const { data } = await api.get('/lead-forms');
    return data;
  },

  async createLeadForm(payload) {
    const { data } = await api.post('/lead-forms', payload);
    return data;
  },
};
