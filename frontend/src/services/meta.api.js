import { api } from './api.js';

export const metaApi = {
  async getStatus() {
    const { data } = await api.get('/meta/status');
    return data;
  },

  async getConnectUrl() {
    const { data } = await api.get('/meta/connect');
    return data;
  },

  async disconnect() {
    const { data } = await api.delete('/meta/disconnect');
    return data;
  },

  async syncAssets() {
    const { data } = await api.post('/meta/assets/sync');
    return data;
  },

  async getAssets() {
    const { data } = await api.get('/meta/assets');
    return data;
  },
};
