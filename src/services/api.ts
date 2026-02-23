import axios, { AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  User,
  Bien,
  BienListResponse,
  CreateBienRequest,
  SearchParams,
  Conversation,
  Notification,
  Contrat,
  ApiError,
} from '../types';

const API_BASE_URL = 'https://app-3ea4c029-f791-4428-9269-edfcdffd064d.cleverapps.io';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    if (error.response?.status === 401) {
      console.log('🔐 Token expiré ou invalide - Déconnexion automatique');
      
      // Supprimer le token d'authentification
      await AsyncStorage.removeItem('auth_token');
      
      // Le store d'authentification détectera automatiquement le token manquant
      // et se réinitialisera lors de la prochaine utilisation
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: async (credentials: LoginRequest): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>('/utilisateurs/connexion', credentials);
    await AsyncStorage.setItem('auth_token', data.jeton_acces);
    return data;
  },

  // Fonction pour vérifier si le token est valide
  verifyToken: async (): Promise<boolean> => {
    try {
      await api.get('/utilisateurs/moi');
      return true;
    } catch (error: any) {
      if (error.response?.status === 401) {
        return false;
      }
      throw error;
    }
  },

  // Fonction pour rafraîchir le token si nécessaire
  refreshTokenIfNeeded: async (): Promise<boolean> => {
    const isValid = await authApi.verifyToken();
    if (!isValid) {
      console.log('🔄 Token invalide, tentative de reconnexion...');
      // Ici vous pourriez implémenter un refresh token
      // Pour l'instant, on retourne false pour forcer la reconnexion manuelle
      return false;
    }
    return true;
  },

  register: async (userData: RegisterRequest): Promise<{ message: string; id_utilisateur?: string }> => {
    const { data } = await api.post('/utilisateurs/inscription', userData);
    return data;
  },

  getProfile: async (): Promise<User> => {
    const { data } = await api.get<User>('/utilisateurs/moi');
    return data;
  },

  updateProfile: async (updates: Partial<User>): Promise<User> => {
    const { data } = await api.put<User>('/utilisateurs/moi', updates);
    return data;
  },

  changePassword: async (passwordData: { current_password: string; new_password: string }): Promise<void> => {
    await api.put('/utilisateurs/changer-mot-de-passe', {
      mot_de_passe_actuel: passwordData.current_password,
      mot_de_passe: passwordData.new_password,
    });
  },

  forgotPassword: async (email: string): Promise<void> => {
    await api.post('/utilisateurs/mot-de-passe-oublie', { email });
  },

  verifyCodeAndReset: async (data: { email: string; code: string; nouveau_mot_de_passe: string }): Promise<void> => {
    await api.post('/utilisateurs/verifier-code-et-reinitialiser', data);
  },

  logout: async (): Promise<void> => {
    await AsyncStorage.removeItem('auth_token');
  },
};

export const bienApi = {
  getAll: async (page = 1, par_page = 10): Promise<BienListResponse> => {
    const { data } = await api.get<BienListResponse>('/biens/', {
      params: { page, par_page },
    });
    return data;
  },

  search: async (params: SearchParams): Promise<BienListResponse> => {
    const { data } = await api.get<BienListResponse>('/biens/recherche', { params });
    return data;
  },

  getById: async (id: string): Promise<Bien> => {
    const { data } = await api.get<Bien>(`/biens/${id}`);
    return data;
  },

  getMesBiens: async (page = 1, par_page = 10): Promise<BienListResponse> => {
    const { data } = await api.get<BienListResponse>('/biens/mes-biens', {
      params: { page, par_page },
    });
    return data;
  },

  create: async (bienData: CreateBienRequest): Promise<Bien> => {
    const { data } = await api.post<Bien>('/biens/', bienData);
    return data;
  },

  update: async (id: string, updates: Partial<CreateBienRequest>): Promise<Bien> => {
    const { data } = await api.put<Bien>(`/biens/${id}`, updates);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/biens/${id}`);
  },
};

export const messageApi = {
  getConversations: async (): Promise<Conversation[]> => {
    const { data } = await api.get('/messages/conversations');
    return data;
  },

  getConversation: async (
    id_interlocuteur: string,
    id_bien: string,
    page = 1,
    par_page = 50
  ): Promise<any> => {
    const { data } = await api.get(`/messages/conversation/${id_interlocuteur}/${id_bien}`, {
      params: { page, par_page },
    });
    return data;
  },

  send: async (id_destinataire: string, id_bien: string, contenu: string): Promise<any> => {
    const { data } = await api.post('/messages/envoyer', null, {
      params: { id_destinataire, id_bien, contenu },
    });
    return data;
  },

  markAsRead: async (id_interlocuteur: string, id_bien: string): Promise<void> => {
    await api.put(`/messages/lire/${id_interlocuteur}/${id_bien}`);
  },

  getUnreadCount: async (): Promise<{ non_lus: number }> => {
    const { data } = await api.get('/messages/non-lus');
    return data;
  },
};

export const notificationApi = {
  getAll: async (page = 1, limite = 20, type_notif?: string): Promise<any> => {
    const { data } = await api.get('/notifications', {
      params: { page, limite, type_notif },
    });
    return data;
  },

  getUnreadCount: async (): Promise<{ non_lues: number }> => {
    const { data } = await api.get('/notifications/non-lues');
    return data;
  },

  markAsRead: async (id: string): Promise<void> => {
    await api.put(`/notifications/${id}/lire`);
  },

  markAllAsRead: async (): Promise<void> => {
    await api.put('/notifications/tout-lire');
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/notifications/${id}`);
  },
};

export const contratApi = {
  getMesContrats: async (statut?: string): Promise<Contrat[]> => {
    const { data } = await api.get('/contrats/mes-contrats', {
      params: { statut },
    });
    return data;
  },

  getById: async (id: string): Promise<Contrat> => {
    const { data } = await api.get(`/contrats/${id}`);
    return data;
  },

  initier: async (
    id_locataire: string,
    id_bien: string,
    loyer_mensuel: number,
    date_debut: string,
    date_fin: string
  ): Promise<any> => {
    const { data } = await api.post('/contrats/initier', null, {
      params: { id_locataire, id_bien, loyer_mensuel, date_debut, date_fin },
    });
    return data;
  },

  accepter: async (id: string): Promise<any> => {
    const { data } = await api.put(`/contrats/${id}/accepter`);
    return data;
  },

  refuser: async (id: string, raison?: string): Promise<any> => {
    const { data } = await api.put(`/contrats/${id}/refuser`, null, {
      params: { raison },
    });
    return data;
  },
};

export const geoApi = {
  enregistrerPosition: async (latitude: number, longitude: number): Promise<void> => {
    await api.post('/geo/enregistrer', null, {
      params: { latitude, longitude },
    });
  },

  getMesPositions: async (jours = 7): Promise<any> => {
    const { data } = await api.get('/geo/mes-positions', {
      params: { jours },
    });
    return data;
  },

  getStatut: async (): Promise<any> => {
    const { data } = await api.get('/geo/statut');
    return data;
  },
};

export const notchpayApi = {
  initierPaiement: async (paiementData: {
    montant: number;
    email: string;
    telephone: string;
    description: string;
    type_transaction: string;
    id_bien?: string;
    id_utilisateur?: string;
    currency?: string;
  }): Promise<any> => {
    const { data } = await api.post('/notchpay/initier', paiementData);
    return data;
  },

  verifierPaiement: async (reference: string): Promise<any> => {
    const { data } = await api.get(`/notchpay/verifier/${reference}`);
    return data;
  },

  getHistoriqueUtilisateur: async (id_utilisateur: string): Promise<any> => {
    const { data } = await api.get(`/notchpay/utilisateur/${id_utilisateur}`);
    return data;
  },

  getPaiementsBien: async (id_bien: string): Promise<any> => {
    const { data } = await api.get(`/notchpay/bien/${id_bien}`);
    return data;
  },
};

export default api;
