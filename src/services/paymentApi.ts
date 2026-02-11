import api from './api';

export interface PaymentInitResponse {
  authorization_url?: string;
  reference?: string;
  message?: string;
  id_transaction?: string;
}

export const paymentApi = {
  // Initialiser un paiement (frais_service, option_b, ou penalite)
  async initPayment(type_paiement: 'frais_service' | 'option_b' | 'penalite', id_detection?: string) {
    const params: any = { type_paiement };
    if (id_detection) {
      params.id_detection = id_detection;
    }
    const response = await api.post('/paiements/initier', null, { params });
    return response.data;
  },

  // Initialiser un paiement de loyer
  async initRentPayment(id_contrat: string) {
    const response = await api.post('/paiements/initier-loyer', null, {
      params: { id_contrat }
    });
    return response.data;
  },

  // Confirmer le numéro mobile money du propriétaire
  async confirmPhoneNumber(id_transaction: string, confirmation: 'oui' | 'non', nouveau_numero?: string) {
    const params: any = { confirmation };
    if (nouveau_numero) {
      params.nouveau_numero = nouveau_numero;
    }
    const response = await api.put(`/paiements/${id_transaction}/confirmer-numero`, null, { params });
    return response.data;
  },

  // Vérifier le statut d'un paiement
  async verifyPayment(id_transaction: string) {
    const response = await api.get(`/paiements/verifier/${id_transaction}`);
    return response.data;
  },

  // Obtenir l'historique des paiements
  async getPaymentHistory(type_transaction?: string, statut?: string) {
    const params: any = {};
    if (type_transaction) params.type_transaction = type_transaction;
    if (statut) params.statut = statut;
    const response = await api.get('/paiements/mes-paiements', { params });
    return response.data;
  },

  // Obtenir mes revenus (pour les propriétaires)
  async getMyRevenue() {
    const response = await api.get('/paiements/revenus');
    return response.data;
  },
};
