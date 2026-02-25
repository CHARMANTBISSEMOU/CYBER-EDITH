import api from './api';

export const notificationApi = {
  async getNotifications(page = 1, limite = 20, type_notif?: string) {
    const response = await api.get('/notifications', {
      params: { page, limite, type_notif },
    });
    return response.data;
  },

  async getUnreadCount() {
    const response = await api.get('/notifications/non-lues');
    return response.data;
  },

  async markAsRead(id: string) {
    const response = await api.put(`/notifications/${id}/lire`);
    return response.data;
  },

  async markAllAsRead() {
    const response = await api.put('/notifications/tout-lire');
    return response.data;
  },

  async deleteNotification(id: string) {
    const response = await api.delete(`/notifications/${id}`);
    return response.data;
  },
};