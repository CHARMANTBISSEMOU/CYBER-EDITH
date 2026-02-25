import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Linking, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '../../components/ScreenHeader';
import { notchpayApi } from '../../services/api';
import api from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const OptionBPaymentScreen = ({ navigation }: any) => {
  const [loading, setLoading] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<5000 | 10000>(5000);
  
  const computeSubscription = async () => {
    const start = new Date();
    const end = new Date(start);
    end.setFullYear(end.getFullYear() + 1);

    await AsyncStorage.setItem(
      'option_b_subscription',
      JSON.stringify({
        amount: selectedAmount,
        type: selectedAmount === 10000 ? 'publier' : 'rechercher',
        valid_from: start.toISOString(),
        valid_to: end.toISOString(),
      })
    );

    await AsyncStorage.setItem('gps_enabled', 'false');
  };

  const verifierEtActiverAbonnement = async (reference: string) => {
    const res = await notchpayApi.verifierPaiement(reference);
    const statut = res?.data?.status || res?.data?.data?.status;

    if (statut === 'complete' || statut === 'successful' || statut === 'success') {
      await computeSubscription();
      Alert.alert(
        'Abonnement activé',
        'Votre paiement a été confirmé. Votre abonnement est maintenant actif.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
      return;
    }

    Alert.alert(
      'Paiement non confirmé',
      `Statut actuel: ${statut || 'inconnu'}. Réessayez dans quelques minutes.`,
      [{ text: 'OK' }]
    );
  };

  const handlePayment = async () => {
    try {
      setLoading(true);

      // Vérifier si l'utilisateur est connecté
      const token = await AsyncStorage.getItem('auth_token');
      console.log('🔑 Token présent:', token ? 'OUI ✅' : 'NON ❌');
      
      if (!token) {
        Alert.alert(
          'Non connecté',
          'Vous devez être connecté pour effectuer un paiement. Veuillez vous reconnecter.',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('Login')
            }
          ]
        );
        return;
      }

      console.log('🔄 Initialisation du paiement Option B...');
      console.log('🔑 Token (premiers 20 car):', token.substring(0, 20) + '...');
      
      // Test : vérifier que l'API fonctionne en appelant le profil
      try {
        const { data: profile } = await api.get('/utilisateurs/moi');
        console.log('✅ API fonctionne, utilisateur:', profile.nom, profile.prenom);
      } catch (testError: any) {
        console.error('❌ Test API échoué:', testError.response?.status);
      }
      
      // Initialiser le paiement Option B (refus GPS)
      console.log('📞 Appel API: POST /notchpay/initier');
      
      // Récupérer les infos utilisateur
      const userStr = await AsyncStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      
      const paymentResponse = await notchpayApi.initierPaiement({
        montant: selectedAmount,
        email: user?.email || 'user@example.com',
        telephone: user?.telephone || '237677777777',
        description:
          selectedAmount === 10000
            ? 'Abonnement annuel - Publier des biens'
            : 'Abonnement annuel - Rechercher des biens',
        type_transaction: 'option_b',
        id_bien: undefined
      });

      console.log('✅ Réponse API:', JSON.stringify(paymentResponse, null, 2));

      const paymentUrl = paymentResponse?.data?.authorization_url || paymentResponse?.data?.payment_url;
      const paymentReference = paymentResponse?.data?.reference_notchpay || paymentResponse?.data?.reference;

      if (paymentResponse.success && paymentUrl) {
        // Sauvegarder l'ID de transaction
        if (paymentResponse.data.id_transaction) {
          await AsyncStorage.setItem('pending_payment_id', paymentResponse.data.id_transaction);
          console.log('💾 ID transaction sauvegardé:', paymentResponse.data.id_transaction);
        }

        if (paymentReference) {
          await AsyncStorage.setItem('pending_notchpay_reference', String(paymentReference));
        }

        // Ouvrir l'URL de paiement NotchPay
        const canOpen = await Linking.canOpenURL(paymentUrl);
        if (canOpen) {
          console.log('🌐 Ouverture de NotchPay:', paymentUrl);
          await Linking.openURL(paymentUrl);
          
          Alert.alert(
            'Paiement en cours',
            'Vous allez être redirigé vers NotchPay pour effectuer le paiement. Revenez dans l\'app après avoir payé.',
            [
              {
                text: 'J\'ai payé',
                onPress: async () => {
                  if (paymentReference) {
                    await verifierEtActiverAbonnement(String(paymentReference));
                  } else {
                    Alert.alert('Erreur', 'Référence de paiement manquante.');
                  }
                }
              },
              {
                text: 'Plus tard',
                style: 'cancel',
                onPress: () => navigation.goBack()
              }
            ]
          );
        } else {
          Alert.alert('Erreur', 'Impossible d\'ouvrir le lien de paiement');
        }
      } else {
        console.log('ℹ️ Pas d\'URL de paiement, message:', paymentResponse.message);
        Alert.alert('Info', paymentResponse.message || 'Paiement initialisé');
      }
    } catch (error: any) {
      console.error('❌ Erreur paiement complète:', error);
      console.error('❌ Détails erreur:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          params: error.config?.params,
          headers: error.config?.headers,
        }
      });
      
      const errorMessage = error.response?.data?.detail 
        || error.response?.data?.message 
        || error.message 
        || 'Une erreur est survenue lors de l\'initialisation du paiement';
      
      Alert.alert(
        'Erreur de paiement',
        `${errorMessage}\n\nCode: ${error.response?.status || 'inconnu'}`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <ScreenHeader 
        title="Paiement Option B" 
        onBack={() => navigation.goBack()} 
      />
      
      <ScrollView style={{ flex: 1 }}>
        <View style={{ padding: 16 }}>
          {/* Explication Option B */}
          <View style={{ backgroundColor: '#1e293b', padding: 16, borderRadius: 12, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Ionicons name="information-circle" size={24} color="#3b82f6" />
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600', marginLeft: 8 }}>
                Option B - Sans GPS
              </Text>
            </View>
            <Text style={{ color: '#9ca3af', fontSize: 14, lineHeight: 22, marginBottom: 12 }}>
              Vous avez choisi de ne pas activer le suivi GPS. Avec cette option, vous devez payer un montant annuel pour utiliser l'application.
            </Text>
            <View style={{ backgroundColor: '#334155', padding: 12, borderRadius: 8 }}>
              <Text style={{ color: '#fbbf24', fontSize: 14, fontWeight: '600', marginBottom: 4 }}>
                💰 Montant à payer
              </Text>
              <Text style={{ color: '#fff', fontSize: 24, fontWeight: '700' }}>
                {selectedAmount.toLocaleString()} FCFA
              </Text>
              <Text style={{ color: '#9ca3af', fontSize: 13, marginTop: 4 }}>
                Paiement annuel
              </Text>
            </View>
          </View>

          <View style={{ backgroundColor: '#1e293b', padding: 16, borderRadius: 12, marginBottom: 16 }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 12 }}>
              Choisir votre abonnement
            </Text>

            <TouchableOpacity
              onPress={() => setSelectedAmount(10000)}
              style={{
                backgroundColor: selectedAmount === 10000 ? '#2563eb' : '#334155',
                padding: 12,
                borderRadius: 10,
                marginBottom: 10,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>10 000 FCFA / an</Text>
              <Text style={{ color: '#e2e8f0', marginTop: 4 }}>Publier des biens</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setSelectedAmount(5000)}
              style={{
                backgroundColor: selectedAmount === 5000 ? '#2563eb' : '#334155',
                padding: 12,
                borderRadius: 10,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>5 000 FCFA / an</Text>
              <Text style={{ color: '#e2e8f0', marginTop: 4 }}>Rechercher des biens</Text>
            </TouchableOpacity>
          </View>

          {/* Avantages */}
          <View style={{ backgroundColor: '#1e293b', padding: 16, borderRadius: 12, marginBottom: 16 }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 12 }}>
              ✅ Ce que vous obtenez
            </Text>
            <Text style={{ color: '#9ca3af', fontSize: 14, lineHeight: 22 }}>
              • Recherche illimitée de biens{'\n'}
              • Contact direct avec les propriétaires{'\n'}
              • Gestion de vos favoris{'\n'}
              • Aucun suivi GPS{'\n'}
              • Vie privée totalement respectée
            </Text>
          </View>

          {/* Informations importantes */}
          <View style={{ backgroundColor: '#1e293b', padding: 16, borderRadius: 12, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Ionicons name="shield-checkmark" size={24} color="#10b981" />
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 }}>
                Informations importantes
              </Text>
            </View>
            <Text style={{ color: '#9ca3af', fontSize: 14, lineHeight: 20 }}>
              • Paiement sécurisé via NotchPay{'\n'}
              • Valable 1 an à partir du paiement{'\n'}
              • Pas de renouvellement automatique{'\n'}
              • Vous pouvez changer d'option à tout moment
            </Text>
          </View>

          {/* Bouton de paiement */}
          <TouchableOpacity
            onPress={handlePayment}
            disabled={loading}
            style={{
              backgroundColor: loading ? '#6b7280' : '#10b981',
              padding: 16,
              borderRadius: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="card-outline" size={24} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 }}>
                  Payer {selectedAmount.toLocaleString()} FCFA
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Bouton retour */}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{
              backgroundColor: '#1e293b',
              padding: 16,
              borderRadius: 12,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#9ca3af', fontSize: 14 }}>
              Annuler
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};
