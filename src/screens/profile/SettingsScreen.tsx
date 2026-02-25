import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { useLanguageStore } from '../../store/languageStore';
import { useTranslation } from '../../i18n/useTranslation';
import { ScreenHeader } from '../../components/ScreenHeader';
import { TermsAudioModal } from '../../components/TermsAudioModal';

export const SettingsScreen = ({ navigation }: any) => {
  const { logout } = useAuthStore();
  const { language, setLanguage } = useLanguageStore();
  const { t } = useTranslation();
  const [paymentMode, setPaymentMode] = useState<'service' | 'annual'>('service');
  const [notifications, setNotifications] = useState(true);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      t('settingsLogoutTitle'),
      t('settingsLogoutConfirm'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('settingsLogout'),
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
    <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <ScreenHeader title={t('settingsTitle')} onBack={() => navigation.goBack()} />
      
      <ScrollView style={{ flex: 1 }}>
        {/* Section Mode de paiement */}
        <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
          <Text style={{ color: '#1e293b', fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
            {t('settingsPaymentMode')}
          </Text>
          
          <TouchableOpacity
            onPress={() => handlePaymentModeChange('service')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: paymentMode === 'service' ? '#3b82f6' : '#f8fafc',
              padding: 16,
              borderRadius: 12,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: '#e2e8f0',
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#1e293b', fontSize: 16, fontWeight: '600', marginBottom: 4 }}>
                {t('settingsPerService')}
              </Text>
              <Text style={{ color: '#64748b', fontSize: 14 }}>
                {t('settingsPerServiceDesc')}
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
              backgroundColor: paymentMode === 'annual' ? '#3b82f6' : '#f8fafc',
              padding: 16,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#e2e8f0',
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#1e293b', fontSize: 16, fontWeight: '600', marginBottom: 4 }}>
                {t('settingsAnnual')}
              </Text>
              <Text style={{ color: '#64748b', fontSize: 14 }}>
                {t('settingsAnnualDesc')}
              </Text>
            </View>
            {paymentMode === 'annual' && (
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
            )}
          </TouchableOpacity>
        </View>

        {/* Section Langue */}
        <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
          <Text style={{ color: '#1e293b', fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
            {t('settingsLanguage')}
          </Text>
          
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              onPress={() => setLanguage('fr')}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: language === 'fr' ? '#3b82f6' : '#f8fafc',
                padding: 16,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#e2e8f0',
              }}
            >
              <Text style={{ color: '#1e293b', fontSize: 16, fontWeight: '600', marginRight: 8 }}>
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
                backgroundColor: language === 'en' ? '#3b82f6' : '#f8fafc',
                padding: 16,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#e2e8f0',
              }}
            >
              <Text style={{ color: '#1e293b', fontSize: 16, fontWeight: '600', marginRight: 8 }}>
                🇬🇧 English
              </Text>
              {language === 'en' && <Ionicons name="checkmark-circle" size={20} color="#fff" />}
            </TouchableOpacity>
          </View>
        </View>

        {/* Section Notifications */}
        <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#1e293b', fontSize: 16, fontWeight: '600', marginBottom: 4 }}>
                {t('settingsNotifications')}
              </Text>
              <Text style={{ color: '#64748b', fontSize: 14 }}>
                {t('settingsNotificationsDesc')}
              </Text>
            </View>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: '#e2e8f0', true: '#3b82f6' }}
              thumbColor={notifications ? '#fff' : '#94a3b8'}
            />
          </View>
        </View>

        {/* Section Conditions d'utilisation */}
        <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
          <TouchableOpacity
            onPress={handleListenTerms}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#f8fafc',
              padding: 16,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#e2e8f0',
            }}
          >
            <Ionicons name="volume-high-outline" size={24} color="#3b82f6" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: '#1e293b', fontSize: 16, fontWeight: '600', marginBottom: 4 }}>
                {t('settingsListenTerms')}
              </Text>
              <Text style={{ color: '#64748b', fontSize: 14 }}>
                {t('settingsListenTermsDesc')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#64748b" />
          </TouchableOpacity>
        </View>

        {/* Section À propos */}
        <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
          <Text style={{ color: '#1e293b', fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
            {t('settingsAbout')}
          </Text>
          
          <View style={{ backgroundColor: '#f8fafc', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' }}>
            <Text style={{ color: '#64748b', fontSize: 14, lineHeight: 20 }}>
              <Text style={{ color: '#1e293b', fontWeight: '600' }}>🏠 Accueil :</Text> Découvrez les biens disponibles à la location ou à la vente.
            </Text>
          </View>

          <View style={{ backgroundColor: '#f8fafc', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' }}>
            <Text style={{ color: '#64748b', fontSize: 14, lineHeight: 20 }}>
              <Text style={{ color: '#1e293b', fontWeight: '600' }}>🔍 Recherche :</Text> Filtrez par ville, quartier, type de bien, prix, nombre de chambres, etc.
            </Text>
          </View>

          <View style={{ backgroundColor: '#f8fafc', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' }}>
            <Text style={{ color: '#64748b', fontSize: 14, lineHeight: 20 }}>
              <Text style={{ color: '#1e293b', fontWeight: '600' }}>💬 Messages :</Text> Discutez avec les propriétaires ou locataires potentiels.
            </Text>
          </View>

          <View style={{ backgroundColor: '#f8fafc', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' }}>
            <Text style={{ color: '#64748b', fontSize: 14, lineHeight: 20 }}>
              <Text style={{ color: '#1e293b', fontWeight: '600' }}>👤 Profil :</Text> Gérez vos biens, contrats, paiements et paramètres.
            </Text>
          </View>

          <View style={{ backgroundColor: '#f8fafc', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' }}>
            <Text style={{ color: '#64748b', fontSize: 14, lineHeight: 20 }}>
              <Text style={{ color: '#1e293b', fontWeight: '600' }}>📍 Géolocalisation :</Text> Système anti-triche pour garantir l'équité. Si vous trouvez un bien via l'app, des frais de service s'appliquent.
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
              backgroundColor: '#fef2f2',
              padding: 16,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#e2e8f0',
            }}
          >
            <Ionicons name="log-out-outline" size={24} color="#ef4444" />
            <Text style={{ color: '#ef4444', fontSize: 16, fontWeight: '600', marginLeft: 12 }}>
              {t('settingsLogout')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal des conditions d'utilisation */}
      <TermsAudioModal
        visible={showTermsModal}
        onSelectOption={() => {
          setShowTermsModal(false);
        }}
      />
    </View>
  );
};
