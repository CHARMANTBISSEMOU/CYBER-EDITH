import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notchpayApi } from '../../services/api';
import { authApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

export const PaymentsHistoryScreen = ({ navigation }: any) => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'historique' | 'revenus'>('historique');
  const [payments, setPayments] = useState<any[]>([]);
  const [revenues, setRevenues] = useState<any>(null);
  const [subscription, setSubscription] = useState<any | null>(null);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadSubscription = async () => {
    try {
      const subStr = await AsyncStorage.getItem('option_b_subscription');
      setSubscription(subStr ? JSON.parse(subStr) : null);
    } catch {
      setSubscription(null);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      await loadSubscription();
      if (activeTab === 'historique') {
        let userId = user?.id_utilisateur;

        if (!userId) {
          try {
            const profile = await authApi.getProfile();
            userId = profile?.id_utilisateur;
          } catch (e) {
            console.log('⚠️ Impossible de récupérer le profil pour l\'historique paiements');
          }
        }

        if (!userId) {
          console.log('⚠️ Aucun id_utilisateur disponible → historique vide');
          setPayments([]);
          return;
        }

        console.log('📥 Chargement historique paiements pour:', userId);
        const response = await notchpayApi.getHistoriqueUtilisateur(userId);
        const allPayments = response.data || [];
        const filtered = allPayments.filter((p: any) => p?.statut !== 'en_attente');
        setPayments(filtered);
      } else {
        // TODO: Implémenter getMyRevenue avec NotchPay
        setRevenues(null);
      }
    } catch (error: any) {
      console.error('Erreur chargement paiements:', error);
      Alert.alert('Erreur', 'Impossible de charger les données');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const isSubscriptionActive = (() => {
    if (!subscription?.valid_to) return false;
    return new Date(subscription.valid_to).getTime() > Date.now();
  })();

  const formatShortDate = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const subscriptionLabel = (() => {
    if (!subscription) return null;
    const amount = subscription.amount;
    const type = subscription.type;
    const typeLabel = type === 'publier' ? 'Publier des biens' : type === 'rechercher' ? 'Rechercher des biens' : type;
    return `${amount?.toLocaleString?.() || amount} FCFA / an — ${typeLabel}`;
  })();

  const getStatusColor = (statut: string) => {
    switch (statut) {
      case 'succès':
      case 'reussi':
        return '#10b981';
      case 'en_attente': return '#f59e0b';
      case 'échoué':
      case 'echoue':
        return '#ef4444';
      case 'annule':
      case 'annulé':
        return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getStatusLabel = (statut: string) => {
    switch (statut) {
      case 'succès':
      case 'reussi':
        return 'Réussi';
      case 'en_attente': return 'En attente';
      case 'échoué':
      case 'echoue':
        return 'Échoué';
      case 'annule':
      case 'annulé':
        return 'Annulé';
      default: return statut;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderPayment = ({ item }: any) => {
    const isIncoming = item.type_transaction === 'loyer_recu';
    const statusColor = getStatusColor(item.statut);

    const typeLabel =
      (item.type_transaction === 'publication' && 'Publication bien') ||
      (item.type_transaction === 'guide' && 'Guide visite') ||
      (item.type_transaction === 'commission' && 'Commission') ||
      (item.type_transaction === 'penalite' && 'Pénalité') ||
      (item.type_transaction === 'abonnement' && 'Abonnement') ||
      item.description ||
      item.type_transaction;

    return (
      <View
        style={{
          backgroundColor: '#f8fafc',
          borderRadius: 12,
          padding: 16,
          marginBottom: 12,
          borderLeftWidth: 4,
          borderLeftColor: isIncoming ? '#10b981' : '#3b82f6',
          borderWidth: 1,
          borderColor: '#e2e8f0',
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Ionicons
                name={isIncoming ? 'arrow-down-circle' : 'arrow-up-circle'}
                size={20}
                color={isIncoming ? '#10b981' : '#3b82f6'}
              />
              <Text style={{ color: '#1e293b', fontSize: 16, fontWeight: '600', marginLeft: 8 }}>
                {typeLabel}
              </Text>
            </View>
            <Text style={{ color: '#64748b', fontSize: 13 }}>
              {formatDate(item.date_transaction)}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text
              style={{
                color: isIncoming ? '#10b981' : '#1e293b',
                fontSize: 18,
                fontWeight: '700',
              }}
            >
              {isIncoming ? '+' : '-'}{item.montant?.toLocaleString()} FCFA
            </Text>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
                backgroundColor: `${statusColor}20`,
                marginTop: 4,
              }}
            >
              <Text style={{ color: statusColor, fontSize: 11, fontWeight: '600' }}>
                {getStatusLabel(item.statut)}
              </Text>
            </View>
          </View>
        </View>

        {item.id_bien && item.id_bien !== 'bien_test' && (
          <View style={{ paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0' }}>
            <Text style={{ color: '#64748b', fontSize: 12 }}>Bien concerné</Text>
            <Text style={{ color: '#1e293b', fontSize: 14, marginTop: 4 }}>
              {item.id_bien}
            </Text>
          </View>
        )}

        {item.reference_notchpay && (
          <View style={{ marginTop: 8 }}>
            <Text style={{ color: '#94a3b8', fontSize: 11 }}>
              Réf: {item.reference_notchpay}
            </Text>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16, backgroundColor: '#f8fafc' }}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#1e293b" />
          </TouchableOpacity>
          <Text style={{ color: '#1e293b', fontSize: 28, fontWeight: '700', marginTop: 16 }}>
            Paiements
          </Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>

        <View style={{ marginTop: 16, backgroundColor: '#ffffff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e2e8f0' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ color: '#1e293b', fontSize: 14, fontWeight: '700' }}>Abonnement Option B</Text>
              {subscription ? (
                <>
                  <Text style={{ color: isSubscriptionActive ? '#10b981' : '#64748b', marginTop: 6, fontSize: 13, fontWeight: '600' }}>
                    {isSubscriptionActive ? 'Actif' : 'Inactif'}
                  </Text>
                  <Text style={{ color: '#64748b', marginTop: 4, fontSize: 12 }}>{subscriptionLabel}</Text>
                  <Text style={{ color: '#94a3b8', marginTop: 4, fontSize: 12 }}>
                    Valide du {formatShortDate(subscription.valid_from)} au {formatShortDate(subscription.valid_to)}
                  </Text>
                </>
              ) : (
                <Text style={{ color: '#64748b', marginTop: 6, fontSize: 12 }}>Aucun abonnement enregistré sur ce téléphone.</Text>
              )}
            </View>

            <TouchableOpacity
              onPress={() => navigation.navigate('OptionBPayment')}
              style={{ backgroundColor: '#3b82f6', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>{isSubscriptionActive ? 'Renouveler' : 'S\'abonner'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
      {/* En-tête */}
      <View style={{ paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16, backgroundColor: '#f8fafc' }}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={{ color: '#1e293b', fontSize: 28, fontWeight: '700', marginTop: 16 }}>
          Paiements
        </Text>

        {/* Tabs */}
        <View style={{ flexDirection: 'row', marginTop: 16, gap: 8 }}>
          <TouchableOpacity
            onPress={() => setActiveTab('historique')}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: 8,
              backgroundColor: activeTab === 'historique' ? '#3b82f6' : '#f1f5f9',
              borderWidth: 1,
              borderColor: '#e2e8f0',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                color: activeTab === 'historique' ? '#fff' : '#64748b',
                fontSize: 14,
                fontWeight: activeTab === 'historique' ? '600' : '400',
              }}
            >
              Historique
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('revenus')}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: 8,
              backgroundColor: activeTab === 'revenus' ? '#3b82f6' : '#f1f5f9',
              borderWidth: 1,
              borderColor: '#e2e8f0',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                color: activeTab === 'revenus' ? '#fff' : '#64748b',
                fontSize: 14,
                fontWeight: activeTab === 'revenus' ? '600' : '400',
              }}
            >
              Revenus
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Contenu */}
      {activeTab === 'historique' ? (
        <FlatList
          data={payments}
          renderItem={renderPayment}
          keyExtractor={(item) => String(item.id_transaction || item.reference_notchpay || item.date_transaction)}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Ionicons name="wallet-outline" size={80} color="#94a3b8" />
              <Text style={{ color: '#64748b', fontSize: 18, marginTop: 24, textAlign: 'center' }}>
                Aucun paiement terminé
              </Text>
            </View>
          }
        />
      ) : (
        <View style={{ padding: 16 }}>
          {/* Carte Revenus */}
          <View style={{ backgroundColor: '#f8fafc', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: '#dcfce7',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <Ionicons name="trending-up" size={24} color="#10b981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#64748b', fontSize: 13 }}>Revenus totaux</Text>
                <Text style={{ color: '#1e293b', fontSize: 28, fontWeight: '700', marginTop: 4 }}>
                  {revenues?.total_revenus?.toLocaleString() || 0} FCFA
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ color: '#64748b', fontSize: 13 }}>Ce mois</Text>
                <Text style={{ color: '#1e293b', fontSize: 18, fontWeight: '600', marginTop: 4 }}>
                  {revenues?.revenus_mois?.toLocaleString() || 0} FCFA
                </Text>
              </View>
              <View>
                <Text style={{ color: '#64748b', fontSize: 13 }}>En attente</Text>
                <Text style={{ color: '#f59e0b', fontSize: 18, fontWeight: '600', marginTop: 4 }}>
                  {revenues?.revenus_en_attente?.toLocaleString() || 0} FCFA
                </Text>
              </View>
            </View>
          </View>

          {/* Statistiques par bien */}
          {revenues?.par_bien && revenues.par_bien.length > 0 && (
            <>
              <Text style={{ color: '#1e293b', fontSize: 20, fontWeight: '700', marginBottom: 16 }}>
                Par bien
              </Text>
              {revenues.par_bien.map((bien: any, index: number) => (
                <View
                  key={index}
                  style={{
                    backgroundColor: '#f8fafc',
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: '#e2e8f0',
                  }}
                >
                  <Text style={{ color: '#1e293b', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
                    {bien.titre}
                  </Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View>
                      <Text style={{ color: '#64748b', fontSize: 12 }}>Revenus</Text>
                      <Text style={{ color: '#10b981', fontSize: 16, fontWeight: '600', marginTop: 4 }}>
                        {bien.total_revenus?.toLocaleString()} FCFA
                      </Text>
                    </View>
                    <View>
                      <Text style={{ color: '#64748b', fontSize: 12 }}>Paiements</Text>
                      <Text style={{ color: '#1e293b', fontSize: 16, fontWeight: '600', marginTop: 4 }}>
                        {bien.nombre_paiements}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}
        </View>
      )}
    </View>
  );
};
