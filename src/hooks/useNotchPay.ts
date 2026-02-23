import { useState, useEffect } from 'react';
import { notchpayService } from '../services/notchpayService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Alert } from 'react-native';

export const useNotchPay = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Vérifier les paiements en attente au démarrage
   */
  useEffect(() => {
    const verifierPaiementsEnAttente = async () => {
      try {
        const pendingPayment = await notchpayService.getPaiementEnAttente();
        
        if (pendingPayment) {
          console.log('🔄 Paiement en attente trouvé:', pendingPayment);
          
          // Vérifier le statut actuel
          const statut = await notchpayService.verifierStatutPaiement(
            pendingPayment.reference_notchpay
          );
          
          if (statut.statut === 'succès') {
            // Marquer comme complété et nettoyer
            await notchpayService.marquerPaiementComplété(
              pendingPayment.reference_notchpay
            );
            Alert.alert(
              'Paiement réussi',
              'Votre paiement a été traité avec succès !'
            );
          } else if (statut.statut === 'échoué') {
            // Nettoyer le paiement en attente
            await notchpayService.nettoyerPaiementsEnAttente();
            Alert.alert(
              'Paiement échoué',
              'Votre paiement a échoué. Veuillez réessayer.'
            );
          }
          // Si en_attente, on ne fait rien
        }
      } catch (error) {
        console.error('Erreur vérification paiements en attente:', error);
      }
    };

    verifierPaiementsEnAttente();
  }, []);

  /**
   * Initier un paiement avec gestion d'erreur
   */
  const initierPaiement = async (
    type: 'publication' | 'abonnement_annuel' | 'abonnement_mensuel',
    options?: any
  ) => {
    try {
      setLoading(true);
      setError(null);

      let response;
      
      switch (type) {
        case 'publication':
          response = await notchpayService.initierPublicationBien(
            options?.bienId,
            options?.montant
          );
          break;
          
        case 'abonnement_annuel':
          response = await notchpayService.initierAbonnementAnnuel(
            options?.montant
          );
          break;
          
        case 'abonnement_mensuel':
          response = await notchpayService.initierAbonnementMensuel(
            options?.montant
          );
          break;
          
        default:
          throw new Error('Type de paiement non supporté');
      }

      // Ouvrir l'URL de paiement si disponible
      if (response.payment_url) {
        const canOpen = await Linking.canOpenURL(response.payment_url);
        if (canOpen) {
          await Linking.openURL(response.payment_url);
          
          Alert.alert(
            'Paiement en cours',
            'Vous allez être redirigé vers NotchPay pour effectuer le paiement. Revenez dans l\'app après avoir payé.',
            [
              {
                text: 'OK',
                onPress: () => {}
              }
            ]
          );
        } else {
          throw new Error('Impossible d\'ouvrir le lien de paiement');
        }
      }

      return response;
    } catch (err: any) {
      setError(err.message || 'Erreur lors du paiement');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Rafraîchir l'historique des paiements
   */
  const rafraichirHistorique = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const historique = await notchpayService.getHistoriqueComplet();
      return historique;
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Nettoyer les erreurs
   */
  const clearError = () => {
    setError(null);
  };

  return {
    loading,
    error,
    initierPaiement,
    rafraichirHistorique,
    clearError,
    nettoyerPaiementsEnAttente: notchpayService.nettoyerPaiementsEnAttente,
    getPaiementEnAttente: notchpayService.getPaiementEnAttente,
  };
};
