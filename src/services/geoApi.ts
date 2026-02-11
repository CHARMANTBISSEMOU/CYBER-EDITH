import api from './api';

export const geoApi = {
  // Enregistrer ma position GPS (automatique toutes les heures)
  async enregistrerPosition(latitude: number, longitude: number) {
    const response = await api.post('/geo/enregistrer', null, {
      params: { latitude, longitude }
    });
    return response.data;
  },

  // Mon historique de positions GPS
  async getMesPositions(jours = 7) {
    const response = await api.get('/geo/mes-positions', {
      params: { jours }
    });
    return response.data;
  },

  // Mon statut anti-triche (montant dû, etc.)
  async getStatut() {
    const response = await api.get('/geo/statut');
    return response.data;
  },

  // Lancer la détection hebdomadaire (admin)
  async lancerDetectionHebdo() {
    const response = await api.post('/geo/detection-hebdo');
    return response.data;
  },

  // Mes détections (à payer, contestées, payées)
  async getMesDetections() {
    const response = await api.get('/geo/mes-detections');
    return response.data;
  },

  // Confirmer une détection (j'accepte de payer 5000F)
  async confirmerDetection(id_detection: string) {
    const response = await api.put(`/geo/confirmer/${id_detection}`);
    return response.data;
  },

  // Contester une détection
  async contesterDetection(id_detection: string, raison: string) {
    const response = await api.put(`/geo/contester/${id_detection}`, null, {
      params: { raison }
    });
    return response.data;
  },
};
