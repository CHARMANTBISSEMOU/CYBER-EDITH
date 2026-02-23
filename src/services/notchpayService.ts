import AsyncStorage from '@react-native-async-storage/async-storage';
import { notchpayApi } from './api';

export const notchpayService = {
  /**
   * Initier un paiement pour publication de bien
   */
  initierPublicationBien: async (bienId: string, montant: number = 5000) => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      
      if (!user) {
        throw new Error('Utilisateur non connecté');
      }

      const response = await notchpayApi.initierPaiement({
        montant,
        email: user.email,
        telephone: user.telephone,
        description: `Publication bien - ${bienId}`,
        type_transaction: 'publication',
        id_bien: bienId,
        id_utilisateur: user.id_utilisateur,
        currency: 'XAF'
      });

      if (response.success) {
        // Sauvegarder la transaction en attente
        await AsyncStorage.setItem('pending_payment', JSON.stringify(response.data));
        return response.data;
      } else {
        throw new Error(response.message || 'Erreur lors de l\'initialisation du paiement');
      }
    } catch (error) {
      console.error('Erreur paiement publication:', error);
      throw error;
    }
  },

  /**
   * Initier un paiement pour l'abonnement annuel
   */
  initierAbonnementAnnuel: async (montant: number = 10000) => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      
      if (!user) {
        throw new Error('Utilisateur non connecté');
      }

      const response = await notchpayApi.initierPaiement({
        montant,
        email: user.email,
        telephone: user.telephone,
        description: 'Abonnement annuel - Propriétaire',
        type_transaction: 'abonnement',
        id_utilisateur: user.id_utilisateur,
        currency: 'XAF'
      });

      if (response.success) {
        await AsyncStorage.setItem('pending_payment', JSON.stringify(response.data));
        return response.data;
      } else {
        throw new Error(response.message || 'Erreur lors de l\'initialisation de l\'abonnement');
      }
    } catch (error) {
      console.error('Erreur abonnement:', error);
      throw error;
    }
  },

  /**
   * Initier un paiement pour l'abonnement mensuel (locataire)
   */
  initierAbonnementMensuel: async (montant: number = 5000) => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      
      if (!user) {
        throw new Error('Utilisateur non connecté');
      }

      const response = await notchpayApi.initierPaiement({
        montant,
        email: user.email,
        telephone: user.telephone,
        description: 'Abonnement mensuel - Locataire',
        type_transaction: 'abonnement',
        id_utilisateur: user.id_utilisateur,
        currency: 'XAF'
      });

      if (response.success) {
        await AsyncStorage.setItem('pending_payment', JSON.stringify(response.data));
        return response.data;
      } else {
        throw new Error(response.message || 'Erreur lors de l\'initialisation de l\'abonnement');
      }
    } catch (error) {
      console.error('Erreur abonnement mensuel:', error);
      throw error;
    }
  },

  /**
   * Vérifier le statut d'un paiement
   */
  verifierStatutPaiement: async (reference: string) => {
    try {
      const response = await notchpayApi.verifierPaiement(reference);
      return response.data;
    } catch (error) {
      console.error('Erreur vérification statut:', error);
      throw error;
    }
  },

  /**
   * Récupérer l'historique complet des paiements
   */
  getHistoriqueComplet: async () => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      
      if (!user) {
        throw new Error('Utilisateur non connecté');
      }

      const response = await notchpayApi.getHistoriqueUtilisateur(user.id_utilisateur);
      return response.data || [];
    } catch (error) {
      console.error('Erreur historique paiements:', error);
      throw error;
    }
  },

  /**
   * Nettoyer les paiements en attente
   */
  nettoyerPaiementsEnAttente: async () => {
    try {
      await AsyncStorage.removeItem('pending_payment');
      console.log('🧹 Paiements en attente nettoyés');
    } catch (error) {
      console.error('Erreur nettoyage paiements:', error);
    }
  },

  /**
   * Vérifier s'il y a un paiement en attente
   */
  getPaiementEnAttente: async () => {
    try {
      const pendingPayment = await AsyncStorage.getItem('pending_payment');
      return pendingPayment ? JSON.parse(pendingPayment) : null;
    } catch (error) {
      console.error('Erreur récupération paiement en attente:', error);
      return null;
    }
  },

  /**
   * Marquer un paiement comme complété
   */
  marquerPaiementComplété: async (reference: string) => {
    try {
      const pendingPayment = await AsyncStorage.getItem('pending_payment');
      if (pendingPayment) {
        const payment = JSON.parse(pendingPayment);
        if (payment.reference_notchpay === reference) {
          await AsyncStorage.removeItem('pending_payment');
          console.log('✅ Paiement marqué comme complété:', reference);
        }
      }
    } catch (error) {
      console.error('Erreur marquage paiement complété:', error);
    }
  }
};
