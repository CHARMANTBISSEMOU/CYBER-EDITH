import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { ScreenHeader } from '../../components/ScreenHeader';
import { TermsAudioModal } from '../../components/TermsAudioModal';

export const SettingsScreen = ({ navigation }: any) => {
  const { logout } = useAuthStore();
  const [paymentMode, setPaymentMode] = useState<'service' | 'annual'>('service');
  const [language, setLanguage] = useState<'fr' | 'en'>('fr');
  const [notifications, setNotifications] = useState(true);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnexion',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  const handleListenTerms = () => {
    setShowTermsModal(true);
  };

  const handlePaymentModeChange = (mode: 'service' | 'annual') => {
    if (mode === 'annual') {
      // Naviguer vers l'écran de paiement Option B (sans GPS)
      navigation.navigate('OptionBPayment');
    } else {
      setPaymentMode(mode);
      Alert.alert(
        'Mode de paiement',
        'Vous avez choisi le paiement par service. Vous paierez 5 000 FCFA pour chaque bien trouvé via l\'app (avec GPS désactivé).',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <ScreenHeader title="Paramètres" onBack={() => navigation.goBack()} />
      
      <ScrollView style={{ flex: 1 }}>
        {/* Section Mode de paiement */}
        <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#1e293b' }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
            Mode de paiement
          </Text>
          
          <TouchableOpacity
            onPress={() => handlePaymentModeChange('service')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: paymentMode === 'service' ? '#3b82f6' : '#1e293b',
              padding: 16,
              borderRadius: 12,
              marginBottom: 12,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 }}>
                Par service
              </Text>
              <Text style={{ color: '#9ca3af', fontSize: 14 }}>
                5 000 FCFA par bien trouvé
              </Text>
            </View>
            {paymentMode === 'service' && (
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handlePaymentModeChange('annual')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: paymentMode === 'annual' ? '#3b82f6' : '#1e293b',
              padding: 16,
              borderRadius: 12,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 }}>
                Annuel
              </Text>
              <Text style={{ color: '#9ca3af', fontSize: 14 }}>
                10 000 FCFA/an (proprio) ou 5 000 FCFA/an (locataire)
              </Text>
            </View>
            {paymentMode === 'annual' && (
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
            )}
          </TouchableOpacity>
        </View>

        {/* Section Langue */}
        <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#1e293b' }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
            Langue
          </Text>
          
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              onPress={() => setLanguage('fr')}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: language === 'fr' ? '#3b82f6' : '#1e293b',
                padding: 16,
                borderRadius: 12,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginRight: 8 }}>
                🇫🇷 Français
              </Text>
              {language === 'fr' && <Ionicons name="checkmark-circle" size={20} color="#fff" />}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setLanguage('en')}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: language === 'en' ? '#3b82f6' : '#1e293b',
                padding: 16,
                borderRadius: 12,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginRight: 8 }}>
                🇬🇧 English
              </Text>
              {language === 'en' && <Ionicons name="checkmark-circle" size={20} color="#fff" />}
            </TouchableOpacity>
          </View>
        </View>

        {/* Section Notifications */}
        <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#1e293b' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 }}>
                Notifications
              </Text>
              <Text style={{ color: '#9ca3af', fontSize: 14 }}>
                Recevoir des notifications push
              </Text>
            </View>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: '#374151', true: '#3b82f6' }}
              thumbColor={notifications ? '#fff' : '#9ca3af'}
            />
          </View>
        </View>

        {/* Section Conditions d'utilisation */}
        <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#1e293b' }}>
          <TouchableOpacity
            onPress={handleListenTerms}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#1e293b',
              padding: 16,
              borderRadius: 12,
            }}
          >
            <Ionicons name="volume-high-outline" size={24} color="#3b82f6" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 }}>
                Réécouter les conditions
              </Text>
              <Text style={{ color: '#9ca3af', fontSize: 14 }}>
                Synthèse vocale des conditions d'utilisation
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {/* Section À propos */}
        <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#1e293b' }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
            À propos de l'application
          </Text>
          
          <View style={{ backgroundColor: '#1e293b', padding: 16, borderRadius: 12, marginBottom: 12 }}>
            <Text style={{ color: '#9ca3af', fontSize: 14, lineHeight: 20 }}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>🏠 Accueil :</Text> Découvrez les biens disponibles à la location ou à la vente.
            </Text>
          </View>

          <View style={{ backgroundColor: '#1e293b', padding: 16, borderRadius: 12, marginBottom: 12 }}>
            <Text style={{ color: '#9ca3af', fontSize: 14, lineHeight: 20 }}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>🔍 Recherche :</Text> Filtrez par ville, quartier, type de bien, prix, nombre de chambres, etc.
            </Text>
          </View>

          <View style={{ backgroundColor: '#1e293b', padding: 16, borderRadius: 12, marginBottom: 12 }}>
            <Text style={{ color: '#9ca3af', fontSize: 14, lineHeight: 20 }}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>💬 Messages :</Text> Discutez avec les propriétaires ou locataires potentiels.
            </Text>
          </View>

          <View style={{ backgroundColor: '#1e293b', padding: 16, borderRadius: 12, marginBottom: 12 }}>
            <Text style={{ color: '#9ca3af', fontSize: 14, lineHeight: 20 }}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>👤 Profil :</Text> Gérez vos biens, contrats, paiements et paramètres.
            </Text>
          </View>

          <View style={{ backgroundColor: '#1e293b', padding: 16, borderRadius: 12 }}>
            <Text style={{ color: '#9ca3af', fontSize: 14, lineHeight: 20 }}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>📍 Géolocalisation :</Text> Système anti-triche pour garantir l'équité. Si vous trouvez un bien via l'app, des frais de service s'appliquent.
            </Text>
          </View>
        </View>

        {/* Section Déconnexion */}
        <View style={{ padding: 16, paddingBottom: 32 }}>
          <TouchableOpacity
            onPress={handleLogout}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#dc2626',
              padding: 16,
              borderRadius: 12,
            }}
          >
            <Ionicons name="log-out-outline" size={24} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 12 }}>
              Se déconnecter
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal des conditions d'utilisation */}
      <TermsAudioModal
        visible={showTermsModal}
        onSelectOption={(option) => {
          setShowTermsModal(false);
          Alert.alert(
            'Option sélectionnée',
            option === 'A' 
              ? 'Paiement par service avec GPS activé'
              : 'Abonnement annuel sans GPS',
            [{ text: 'OK' }]
          );
        }}
      />
    </View>
  );
};
