import { api } from './api.js';

export const conversationsApi = {
  async list() {
    const { data } = await api.get('/conversations');
    return data;
  },

  async listMessages(id) {
    const { data } = await api.get(`/conversations/${id}/messages`);
    return data;
  },

  async sendMessage(id, message) {
    const { data } = await api.post(`/conversations/${id}/messages`, {
      message,
    });
    return data;
  },
};
