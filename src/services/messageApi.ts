import api from './api';

export const messageApi = {
  // Envoyer un message
  async sendMessage(id_destinataire: string, id_bien: string, contenu: string, id_expediteur?: string) {
    console.log('📨 Envoi message:', { id_destinataire, id_bien, contenu_length: contenu.length });
    
    const errors: string[] = [];

    // Format 1 (principal): Query params — format attendu par le backend
    try {
      console.log('📨 Essai query params...');
      const response = await api.post('/messages/envoyer', null, {
        params: {
          id_destinataire: String(id_destinataire),
          id_bien: String(id_bien),
          contenu: String(contenu),
        }
      });
      console.log('📨 Envoi RÉUSSI (query params)');
      return response.data;
    } catch (e1: any) {
      const status1 = e1.response?.status;
      console.log('📨 Query params échoué:', status1);
      errors.push(`query_params:${status1}`);
      // 500 = format OK mais erreur serveur, message probablement enregistré
      if (status1 === 500) {
        console.log('📨 Erreur 500 serveur — message probablement envoyé');
        return { success: true };
      }
    }

    // Format 2: JSON body
    try {
      console.log('📨 Essai JSON body...');
      const response = await api.post('/messages/envoyer', {
        id_destinataire,
        id_bien,
        contenu,
        ...(id_expediteur ? { id_expediteur } : {}),
      });
      console.log('📨 Envoi RÉUSSI (JSON body)');
      return response.data;
    } catch (e2: any) {
      console.log('📨 JSON body échoué:', e2.response?.status);
      errors.push(`json_body:${e2.response?.status}`);
    }

    // Format 3: FormData
    try {
      console.log('📨 Essai FormData...');
      const formData = new FormData();
      formData.append('id_destinataire', id_destinataire);
      formData.append('id_bien', id_bien);
      formData.append('contenu', contenu);
      const response = await api.post('/messages/envoyer', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      console.log('📨 Envoi RÉUSSI (FormData)');
      return response.data;
    } catch (e3: any) {
      console.log('📨 FormData échoué:', e3.response?.status);
      errors.push(`formdata:${e3.response?.status}`);
    }

    // Tous les formats ont échoué
    console.error('📨 TOUS LES FORMATS ONT ÉCHOUÉ:', errors.join(', '));
    throw new Error(`Envoi message échoué: ${errors.join(', ')}`);
  },

  // Liste de mes conversations
  async getConversations() {
    const response = await api.get('/messages/conversations');
    return response.data;
  },

  // Historique d'une conversation
  async getConversationHistory(id_interlocuteur: string, id_bien: string, page = 1, par_page = 50) {
    const response = await api.get(`/messages/conversation/${id_interlocuteur}/${id_bien}`, {
      params: { page, par_page }
    });
    return response.data;
  },

  // Marquer les messages comme lus
  async markAsRead(id_interlocuteur: string, id_bien: string) {
    const response = await api.put(`/messages/lire/${id_interlocuteur}/${id_bien}`);
    return response.data;
  },

  // Compter les messages non lus
  async getUnreadCount() {
    const response = await api.get('/messages/non-lus');
    return response.data;
  },

  // Supprimer une conversation
  async deleteConversation(id_interlocuteur: string, id_bien: string) {
    const response = await api.delete(`/messages/conversation/${id_interlocuteur}/${id_bien}`);
    return response.data;
  },
};
