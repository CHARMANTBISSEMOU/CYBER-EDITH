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
import { paymentApi } from '../../services/paymentApi';

export const PaymentsHistoryScreen = ({ navigation }: any) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'historique' | 'revenus'>('historique');
  const [payments, setPayments] = useState<any[]>([]);
  const [revenues, setRevenues] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      if (activeTab === 'historique') {
        const response = await paymentApi.getPaymentHistory();
        setPayments(response.paiements || []);
      } else {
        const response = await paymentApi.getMyRevenue();
        setRevenues(response);
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

  const getStatusColor = (statut: string) => {
    switch (statut) {
      case 'complete': return '#10b981';
      case 'en_attente': return '#f59e0b';
      case 'echoue': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusLabel = (statut: string) => {
    switch (statut) {
      case 'complete': return 'Complété';
      case 'en_attente': return 'En attente';
      case 'echoue': return 'Échoué';
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
    const isIncoming = item.type_paiement === 'loyer_recu';
    const statusColor = getStatusColor(item.statut);

    return (
      <View
        style={{
          backgroundColor: '#1e293b',
          borderRadius: 12,
          padding: 16,
          marginBottom: 12,
          borderLeftWidth: 4,
          borderLeftColor: isIncoming ? '#10b981' : '#3b82f6',
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
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 }}>
                {item.type_paiement === 'loyer_recu' && 'Loyer reçu'}
                {item.type_paiement === 'loyer_paye' && 'Loyer payé'}
                {item.type_paiement === 'option_b' && 'Option B'}
                {item.type_paiement === 'frais_detection' && 'Frais détection'}
              </Text>
            </View>
            <Text style={{ color: '#9ca3af', fontSize: 13 }}>
              {formatDate(item.date_paiement)}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text
              style={{
                color: isIncoming ? '#10b981' : '#fff',
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

        {item.bien && (
          <View style={{ paddingTop: 12, borderTopWidth: 1, borderTopColor: '#334155' }}>
            <Text style={{ color: '#9ca3af', fontSize: 12 }}>Bien concerné</Text>
            <Text style={{ color: '#fff', fontSize: 14, marginTop: 4 }}>
              {item.bien.titre}
            </Text>
          </View>
        )}

        {item.reference_notchpay && (
          <View style={{ marginTop: 8 }}>
            <Text style={{ color: '#9ca3af', fontSize: 11 }}>
              Réf: {item.reference_notchpay}
            </Text>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16, backgroundColor: '#1e293b' }}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700', marginTop: 16 }}>
            Paiements
          </Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
      {/* En-tête */}
      <View style={{ paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16, backgroundColor: '#1e293b' }}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700', marginTop: 16 }}>
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
              backgroundColor: activeTab === 'historique' ? '#3b82f6' : '#334155',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                color: '#fff',
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
              backgroundColor: activeTab === 'revenus' ? '#3b82f6' : '#334155',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                color: '#fff',
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
          keyExtractor={(item) => item.id_paiement}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Ionicons name="wallet-outline" size={80} color="#334155" />
              <Text style={{ color: '#9ca3af', fontSize: 18, marginTop: 24, textAlign: 'center' }}>
                Aucun paiement
              </Text>
            </View>
          }
        />
      ) : (
        <View style={{ padding: 16 }}>
          {/* Carte Revenus */}
          <View style={{ backgroundColor: '#1e293b', borderRadius: 16, padding: 20, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: '#10b98120',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <Ionicons name="trending-up" size={24} color="#10b981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#9ca3af', fontSize: 13 }}>Revenus totaux</Text>
                <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700', marginTop: 4 }}>
                  {revenues?.total_revenus?.toLocaleString() || 0} FCFA
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ color: '#9ca3af', fontSize: 13 }}>Ce mois</Text>
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600', marginTop: 4 }}>
                  {revenues?.revenus_mois?.toLocaleString() || 0} FCFA
                </Text>
              </View>
              <View>
                <Text style={{ color: '#9ca3af', fontSize: 13 }}>En attente</Text>
                <Text style={{ color: '#f59e0b', fontSize: 18, fontWeight: '600', marginTop: 4 }}>
                  {revenues?.revenus_en_attente?.toLocaleString() || 0} FCFA
                </Text>
              </View>
            </View>
          </View>

          {/* Statistiques par bien */}
          {revenues?.par_bien && revenues.par_bien.length > 0 && (
            <>
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 16 }}>
                Par bien
              </Text>
              {revenues.par_bien.map((bien: any, index: number) => (
                <View
                  key={index}
                  style={{
                    backgroundColor: '#1e293b',
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 12,
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
                    {bien.titre}
                  </Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View>
                      <Text style={{ color: '#9ca3af', fontSize: 12 }}>Revenus</Text>
                      <Text style={{ color: '#10b981', fontSize: 16, fontWeight: '600', marginTop: 4 }}>
                        {bien.total_revenus?.toLocaleString()} FCFA
                      </Text>
                    </View>
                    <View>
                      <Text style={{ color: '#9ca3af', fontSize: 12 }}>Paiements</Text>
                      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginTop: 4 }}>
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
