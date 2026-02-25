import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { contratApi } from '../../services/contratApi';
import { useTranslation } from '../../i18n/useTranslation';

export const ProfileScreen = ({ navigation }: any) => {
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();
  const [gpsEnabled, setGpsEnabled] = useState<boolean | null>(null);
  const [subscription, setSubscription] = useState<any | null>(null);
  const [contractCount, setContractCount] = useState(0);

  useEffect(() => {
    const loadLocalSettings = async () => {
      try {
        const gps = await AsyncStorage.getItem('gps_enabled');
        setGpsEnabled(gps === 'true');

        const sub = await AsyncStorage.getItem('option_b_subscription');
        setSubscription(sub ? JSON.parse(sub) : null);
      } catch {
        setGpsEnabled(null);
        setSubscription(null);
      }
    };

    const unsubscribe = navigation.addListener('focus', () => {
      loadLocalSettings();
      loadContractCount();
    });
    loadLocalSettings();
    loadContractCount();
    return unsubscribe;
  }, [navigation]);

  const loadContractCount = async () => {
    try {
      let count = 0;
      // Contrats backend
      try {
        const res = await contratApi.getMesContrats();
        const backendList = res.contrats || res || [];
        if (Array.isArray(backendList)) count += backendList.length;
      } catch (e) {}
      // Contrats locaux
      try {
        const stored = await AsyncStorage.getItem('local_contracts');
        if (stored) {
          const local = JSON.parse(stored);
          count += local.length;
        }
      } catch (e) {}
      setContractCount(count);
    } catch (e) {}
  };

  const formatShortDate = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const isSubscriptionActive = (() => {
    if (!subscription?.valid_to) return false;
    return new Date(subscription.valid_to).getTime() > Date.now();
  })();

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

  const menuItems = [
    {
      icon: 'person-outline',
      title: t('profileEditProfile'),
      onPress: () => navigation.navigate('EditProfile'),
    },
    {
      icon: 'home-outline',
      title: t('profileMyProperties'),
      onPress: () => navigation.navigate('MyProperties'),
    },
    {
      icon: 'document-text-outline',
      title: t('profileMyContracts'),
      onPress: () => navigation.navigate('Contracts'),
    },
    {
      icon: 'card-outline',
      title: t('profilePayments'),
      onPress: () => navigation.navigate('PaymentsHistory'),
    },
    {
      icon: 'settings-outline',
      title: t('profileSettings'),
      onPress: () => navigation.navigate('Settings'),
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <ScrollView style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 48, paddingBottom: 24, backgroundColor: '#f8fafc' }}>
          <View style={{ alignItems: 'center' }}>
            <View style={{ width: 96, height: 96, backgroundColor: '#3b82f6', borderRadius: 48, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 32 }}>
                {user?.prenom?.[0]}{user?.nom?.[0]}
              </Text>
            </View>
            <Text style={{ color: '#1e293b', fontSize: 24, fontWeight: '700' }}>
              {user?.prenom} {user?.nom}
            </Text>
            <Text style={{ color: '#64748b', marginTop: 4 }}>{user?.email}</Text>
            
            {user?.badge_certifie && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, backgroundColor: '#dbeafe', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}>
                <Ionicons name="checkmark-circle" size={18} color="#3b82f6" />
                <Text style={{ color: '#3b82f6', marginLeft: 8, fontWeight: '500' }}>Compte certifié</Text>
              </View>
            )}

            {isSubscriptionActive && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, backgroundColor: '#dcfce7', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}>
                <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                <Text style={{ color: '#10b981', marginLeft: 8, fontWeight: '500' }}>
                  abonnement valide du {formatShortDate(subscription.valid_from)} au {formatShortDate(subscription.valid_to)}
                </Text>
              </View>
            )}

            <View style={{ flexDirection: 'row', marginTop: 24, gap: 24 }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: '#1e293b', fontSize: 24, fontWeight: '700' }}>{contractCount}</Text>
                <Text style={{ color: '#64748b', fontSize: 12 }}>Contrats</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: '#1e293b', fontSize: 24, fontWeight: '700' }}>
                  {isSubscriptionActive ? '✗' : gpsEnabled ? '✓' : '✗'}
                </Text>
                <Text style={{ color: '#64748b', fontSize: 12 }}>GPS</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, paddingVertical: 24 }}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              onPress={item.onPress}
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' }}
            >
              <View style={{ width: 40, height: 40, backgroundColor: '#dbeafe', borderRadius: 20, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name={item.icon as any} size={20} color="#3b82f6" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: '#1e293b', fontSize: 16, fontWeight: '600' }}>{item.title}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          onPress={handleLogout}
          style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef2f2', borderRadius: 12, padding: 16, marginTop: 16, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e2e8f0' }}
        >
          <View style={{ width: 40, height: 40, backgroundColor: '#fee2e2', borderRadius: 20, justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          </View>
          <Text style={{ color: '#ef4444', marginLeft: 16, flex: 1, fontWeight: '500' }}>Déconnexion</Text>
        </TouchableOpacity>

        <View style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
          <Text style={{ color: '#94a3b8', textAlign: 'center', fontSize: 12 }}>
            Version 1.0.0
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};
