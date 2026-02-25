import api from './api';

export const contratApi = {
  // Initier un contrat (Claude génère le brouillon)
  async initierContrat(
    id_locataire: string,
    id_bien: string,
    loyer_mensuel: number,
    date_debut: string,
    date_fin: string
  ) {
    const params = {
      id_locataire,
      id_bien,
      loyer_mensuel: Number(loyer_mensuel),
      date_debut,
      date_fin,
    };

    console.log('▶️ initierContrat params (query)', params);

    const response = await api.post('/contrats/initier', null, { params });

    console.log('✅ initierContrat response', response.data);
    return response.data;
  },

  // Personnaliser le contrat avec Claude
  async personnaliserContrat(id_contrat: string, demande: string) {
    const response = await api.post(`/contrats/${id_contrat}/personnaliser`, null, {
      params: { demande }
    });
    return response.data;
  },

  // Valider le contrat et générer le PDF
  async validerContrat(id_contrat: string) {
    const response = await api.post(`/contrats/${id_contrat}/valider`);
    return response.data;
  },

  // Mes contrats (filtre optionnel par statut)
  async getMesContrats(statut?: string) {
    const response = await api.get('/contrats/mes-contrats', {
      params: statut ? { statut } : {}
    });
    return response.data;
  },

  // Détails d'un contrat
  async getContratDetails(id_contrat: string) {
    const response = await api.get(`/contrats/${id_contrat}`);
    return response.data;
  },

  // Alias pour getContratDetails
  async getContrat(id_contrat: string) {
    return this.getContratDetails(id_contrat);
  },

  // Accepter un contrat (locataire)
  async accepterContrat(id_contrat: string) {
    const response = await api.put(`/contrats/${id_contrat}/accepter`);
    return response.data;
  },

  // Refuser un contrat (locataire)
  async refuserContrat(id_contrat: string, raison?: string) {
    const response = await api.put(`/contrats/${id_contrat}/refuser`, null, {
      params: raison ? { raison } : {}
    });
    return response.data;
  },

  // Résilier un contrat
  async resilierContrat(id_contrat: string, raison: string) {
    const response = await api.put(`/contrats/${id_contrat}/resilier`, null, {
      params: { raison }
    });
    return response.data;
  },

  // Télécharger le PDF du contrat
  async getContratPDF(id_contrat: string) {
    const response = await api.get(`/contrats/${id_contrat}/pdf`);
    return response.data;
  },
};
