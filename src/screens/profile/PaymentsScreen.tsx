import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '../../components/ScreenHeader';

interface Payment {
  id: number;
  type: string;
  montant: number;
  date_paiement: string;
  statut: string;
  methode_paiement: string;
  description: string;
}

export const PaymentsScreen = ({ navigation }: any) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    try {
      // TODO: Appeler l'API GET /paiements-loyer/mes-paiements
      // const response = await api.get('/paiements-loyer/mes-paiements');
      // setPayments(response.data);
      
      // Simulation de données pour l'instant
      setTimeout(() => {
        setPayments([]);
        setLoading(false);
      }, 500);
    } catch (error) {
      console.error('Erreur chargement paiements:', error);
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paye': return '#10b981';
      case 'en_attente': return '#f59e0b';
      case 'echoue': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'paye': return 'Payé';
      case 'en_attente': return 'En attente';
      case 'echoue': return 'Échoué';
      default: return status;
    }
  };

  const getPaymentIcon = (type: string) => {
    switch (type) {
      case 'loyer': return 'home-outline';
      case 'service': return 'location-outline';
      case 'abonnement': return 'calendar-outline';
      default: return 'cash-outline';
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <ScreenHeader title="Paiements" onBack={() => navigation.goBack()} />
      
      <ScrollView style={{ flex: 1 }}>
        <View style={{ padding: 16 }}>
          {/* Bouton Nouveau paiement */}
          <TouchableOpacity
            style={{
              backgroundColor: '#3b82f6',
              padding: 16,
              borderRadius: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
            onPress={() => {
              // TODO: Navigation vers écran de paiement NotchPay
            }}
          >
            <Ionicons name="add-circle-outline" size={24} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 }}>
              Effectuer un paiement
            </Text>
          </TouchableOpacity>

          {/* Liste des paiements */}
          {payments.length === 0 ? (
            <View style={{ backgroundColor: '#1e293b', padding: 32, borderRadius: 12, alignItems: 'center' }}>
              <Ionicons name="card-outline" size={64} color="#6b7280" />
              <Text style={{ color: '#9ca3af', fontSize: 16, marginTop: 16, textAlign: 'center' }}>
                Aucun paiement pour le moment
              </Text>
              <Text style={{ color: '#6b7280', fontSize: 14, marginTop: 8, textAlign: 'center' }}>
                Votre historique de paiements apparaîtra ici
              </Text>
            </View>
          ) : (
            payments.map((payment) => (
              <View
                key={payment.id}
                style={{
                  backgroundColor: '#1e293b',
                  padding: 16,
                  borderRadius: 12,
                  marginBottom: 12,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={{
                      backgroundColor: '#334155',
                      padding: 10,
                      borderRadius: 8,
                      marginRight: 12,
                    }}>
                      <Ionicons name={getPaymentIcon(payment.type)} size={24} color="#3b82f6" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 }}>
                        {payment.description}
                      </Text>
                      <Text style={{ color: '#9ca3af', fontSize: 14 }}>
                        {payment.methode_paiement}
                      </Text>
                    </View>
                  </View>
                  <View style={{
                    backgroundColor: getStatusColor(payment.statut),
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                    borderRadius: 12,
                  }}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
                      {getStatusText(payment.statut)}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="calendar-outline" size={16} color="#9ca3af" />
                    <Text style={{ color: '#9ca3af', fontSize: 14, marginLeft: 8 }}>
                      {new Date(payment.date_paiement).toLocaleDateString('fr-FR')}
                    </Text>
                  </View>
                  <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>
                    {payment.montant.toLocaleString()} FCFA
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
};
