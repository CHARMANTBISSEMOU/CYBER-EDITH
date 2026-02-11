import api from './api';

export const mediaApi = {
  // Upload images ou vidéos pour un bien (max 5 images, 2 vidéos)
  async uploadMedia(id_bien: string, file: FormData) {
    const response = await api.post(`/medias/${id_bien}/upload`, file, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Voir tous les médias d'un bien
  async getBienMedias(id_bien: string) {
    const response = await api.get(`/medias/${id_bien}`);
    return response.data;
  },

  // Supprimer un média
  async deleteMedia(id_media: string) {
    const response = await api.delete(`/medias/${id_media}`);
    return response.data;
  },
};
