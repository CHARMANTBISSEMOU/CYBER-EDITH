import api from './api';

export interface Bien {
  id_bien: string;
  titre: string;
  description?: string;
  type_bien: string;
  ville: string;
  quartier: string;
  prix_loyer?: number;
  prix_vente?: number;
  superficie?: number;
  nombre_chambres?: number;
  nombre_salles_bain?: number;
  meuble?: boolean;
  latitude?: number;
  longitude?: number;
  statut?: string;
  date_publication?: string;
}

export interface CreateBienData {
  titre: string;
  description?: string;
  type_bien: string;
  ville: string;
  quartier: string;
  adresse_complete?: string;
  prix_loyer?: number;
  prix_vente?: number;
  superficie?: number;
  nombre_chambres?: number;
  nombre_salles_bain?: number;
  nombre_pieces?: number;
  meuble?: boolean;
  latitude?: number;
  longitude?: number;
}

export interface UpdateBienData extends Partial<CreateBienData> {
  id_bien: string;
}

export interface SearchParams {
  ville?: string;
  quartier?: string;
  type_bien?: string;
  prix_min?: number;
  prix_max?: number;
  chambres_min?: number;
  meuble?: boolean;
  texte?: string;
  tri?: 'date' | 'prix_asc' | 'prix_desc' | 'superficie';
  page?: number;
  par_page?: number;
}

export const bienApi = {
  // Publier un nouveau bien
  async createBien(data: CreateBienData) {
    const response = await api.post('/biens/', data);
    return response.data;
  },

  // Liste de tous les biens publiés (pagination)
  async getAllBiens(page = 1, par_page = 10) {
    const response = await api.get('/biens/', {
      params: { page, par_page }
    });
    return response.data;
  },

  // Recherche avancée avec filtres
  async searchBiens(params: SearchParams) {
    const response = await api.get('/biens/recherche', { params });
    return response.data;
  },

  // Obtenir mes biens
  async getMyBiens(page = 1, par_page = 10) {
    const response = await api.get('/biens/mes-biens', {
      params: { page, par_page }
    });
    return response.data;
  },

  // Obtenir un bien par ID
  async getBienById(id_bien: string) {
    const response = await api.get(`/biens/${id_bien}`);
    return response.data;
  },

  // Mettre à jour un bien
  async updateBien(id_bien: string, data: UpdateBienData) {
    const response = await api.put(`/biens/${id_bien}`, data);
    return response.data;
  },

  // Supprimer un bien
  async deleteBien(id_bien: string) {
    const response = await api.delete(`/biens/${id_bien}`);
    return response.data;
  },

  // Uploader des images pour un bien
  async uploadBienImages(id_bien: string, images: FormData) {
    const response = await api.post(`/biens/${id_bien}/images`, images, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Supprimer une image d'un bien
  async deleteBienImage(id_bien: string, imageId: number) {
    const response = await api.delete(`/biens/${id_bien}/images/${imageId}`);
    return response.data;
  },

  // Marquer un bien comme favori
  async toggleFavorite(bienId: number) {
    const response = await api.post(`/biens/${bienId}/favori`);
    return response.data;
  },

  // Obtenir mes biens favoris
  async getMyFavorites() {
    const response = await api.get('/biens/mes-favoris');
    return response.data;
  },
};
