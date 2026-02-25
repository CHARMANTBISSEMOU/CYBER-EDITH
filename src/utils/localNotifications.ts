import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'local_notifications';

export interface LocalNotification {
  id_notification: string;
  type_notification: 'contrat' | 'message' | 'systeme';
  message: string;
  date_creation: string;
  lu: boolean;
}

export const localNotificationService = {
  async add(type: LocalNotification['type_notification'], message: string) {
    try {
      const existing = await AsyncStorage.getItem(STORAGE_KEY);
      const notifications: LocalNotification[] = existing ? JSON.parse(existing) : [];
      const newNotif: LocalNotification = {
        id_notification: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type_notification: type,
        message,
        date_creation: new Date().toISOString(),
        lu: false,
      };
      notifications.unshift(newNotif);
      // Garder max 100 notifications locales
      if (notifications.length > 100) notifications.length = 100;
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
      return newNotif;
    } catch (e) {
      console.warn('Erreur ajout notification locale:', e);
    }
  },

  async getAll(): Promise<LocalNotification[]> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  },

  async getUnreadCount(): Promise<number> {
    const all = await this.getAll();
    return all.filter(n => !n.lu).length;
  },

  async markAsRead(id: string) {
    try {
      const all = await this.getAll();
      const updated = all.map(n => n.id_notification === id ? { ...n, lu: true } : n);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  },

  async markAllAsRead() {
    try {
      const all = await this.getAll();
      const updated = all.map(n => ({ ...n, lu: true }));
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  },

  async delete(id: string) {
    try {
      const all = await this.getAll();
      const updated = all.filter(n => n.id_notification !== id);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  },
};
