export interface User {
  id_utilisateur: string;
  email: string;
  telephone: string;
  nom: string;
  prenom: string;
  photo_profil_url?: string;
  badge_certifie: boolean;
  nombre_contrats: number;
  consent_geolocalisation: 'oui' | 'non';
  date_inscription: string;
  derniere_connexion?: string;
}

export interface LoginRequest {
  email: string;
  mot_de_passe: string;
}

export interface RegisterRequest {
  email: string;
  mot_de_passe: string;
  telephone: string;
  nom: string;
  prenom: string;
  photo_profil_url?: string;
  consent_geolocalisation?: 'oui' | 'non';
}

export interface AuthResponse {
  jeton_acces: string;
  type_jeton: string;
  utilisateur: User;
}

export interface Bien {
  id_bien: string;
  id_proprietaire: string;
  titre: string;
  description?: string;
  type_bien: 'studio' | 'maison' | 'chambre' | 'appartement' | 'bureau' | 'terrain';
  ville: string;
  quartier: string;
  adresse_complete?: string;
  latitude?: number;
  longitude?: number;
  prix_loyer?: number;
  prix_vente?: number;
  superficie?: number;
  nombre_chambres: number;
  nombre_salles_bain: number;
  nombre_pieces?: number;
  meuble: boolean;
  statut: 'en_attente' | 'publie' | 'loue' | 'vendu' | 'archive';
  date_publication?: string;
  date_modification?: string;
  nom_proprietaire?: string;
  prenom_proprietaire?: string;
  badge_certifie_proprietaire?: boolean;
}

export interface BienListResponse {
  biens: Bien[];
  total: number;
  page: number;
  par_page: number;
  pages_total: number;
}

export interface CreateBienRequest {
  titre: string;
  description?: string;
  type_bien: string;
  ville: string;
  quartier: string;
  adresse_complete?: string;
  latitude?: number;
  longitude?: number;
  prix_loyer?: number;
  prix_vente?: number;
  superficie?: number;
  nombre_chambres?: number;
  nombre_salles_bain?: number;
  nombre_pieces?: number;
  meuble?: boolean;
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

export interface Message {
  id_message: string;
  expediteur_id: string;
  destinataire_id: string;
  id_bien?: string;
  contenu: string;
  date_envoi: string;
  lu: boolean;
  date_lecture?: string;
}

export interface Conversation {
  interlocuteur: {
    id: string;
    nom: string;
    prenom: string;
    photo_profil_url?: string;
  };
  bien: {
    id: string;
    titre: string;
  };
  dernier_message: string;
  date_dernier_message: string;
  non_lus: number;
}

export interface Notification {
  id_notification: string;
  id_utilisateur: string;
  id_contrat?: string;
  id_transaction?: string;
  type_notification: 'message' | 'contrat' | 'detection' | 'paiement' | 'systeme';
  titre: string;
  message?: string;
  lu: boolean;
  date_creation: string;
  date_lecture?: string;
}

export interface Contrat {
  id_contrat: string;
  id_bien: string;
  id_proprietaire: string;
  id_locataire: string;
  montant_loyer: number;
  montant_caution?: number;
  date_debut: string;
  date_fin?: string;
  duree_mois: number;
  jour_paiement: number;
  conditions_particulieres?: string;
  statut_contrat: 'brouillon' | 'en_attente' | 'actif' | 'resilie' | 'expire' | 'refuse';
  pdf_url?: string;
  contenu_contrat?: string;
  date_creation: string;
  date_signature?: string;
}

export interface ApiError {
  detail: string | Array<{
    loc: string[];
    msg: string;
    type: string;
  }>;
}
