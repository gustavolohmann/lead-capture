import { api } from './api.js';

export const notificationsApi = {
  async unreadCount() {
    const { data } = await api.get('/notifications/unread-count');
    return data;
  },

  async listUnread() {
    const { data } = await api.get('/notifications');
    return data;
  },

  async markRead(id) {
    const { data } = await api.patch(`/notifications/${id}/read`);
    return data;
  },

  async markAllRead() {
    const { data } = await api.patch('/notifications/read-all');
    return data;
  },
};
