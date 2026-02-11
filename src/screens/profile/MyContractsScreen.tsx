import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '../../components/ScreenHeader';

interface Contract {
  id: number;
  bien_titre: string;
  type_contrat: string;
  date_debut: string;
  date_fin: string;
  montant_loyer: number;
  statut: string;
}

export const MyContractsScreen = ({ navigation }: any) => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContracts();
  }, []);

  const loadContracts = async () => {
    try {
      // TODO: Appeler l'API GET /contrats-loyer/mes-contrats
      // const response = await api.get('/contrats-loyer/mes-contrats');
      // setContracts(response.data);
      
      // Simulation de données pour l'instant
      setTimeout(() => {
        setContracts([]);
        setLoading(false);
      }, 500);
    } catch (error) {
      console.error('Erreur chargement contrats:', error);
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'actif': return '#10b981';
      case 'expire': return '#ef4444';
      case 'en_attente': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'actif': return 'Actif';
      case 'expire': return 'Expiré';
      case 'en_attente': return 'En attente';
      default: return status;
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
      <ScreenHeader title="Mes contrats" onBack={() => navigation.goBack()} />
      
      <ScrollView style={{ flex: 1 }}>
        <View style={{ padding: 16 }}>
          {contracts.length === 0 ? (
            <View style={{ backgroundColor: '#1e293b', padding: 32, borderRadius: 12, alignItems: 'center' }}>
              <Ionicons name="document-text-outline" size={64} color="#6b7280" />
              <Text style={{ color: '#9ca3af', fontSize: 16, marginTop: 16, textAlign: 'center' }}>
                Aucun contrat pour le moment
              </Text>
              <Text style={{ color: '#6b7280', fontSize: 14, marginTop: 8, textAlign: 'center' }}>
                Vos contrats de location apparaîtront ici
              </Text>
            </View>
          ) : (
            contracts.map((contract) => (
              <TouchableOpacity
                key={contract.id}
                style={{
                  backgroundColor: '#1e293b',
                  padding: 16,
                  borderRadius: 12,
                  marginBottom: 12,
                }}
                onPress={() => {
                  // TODO: Navigation vers détails du contrat
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 }}>
                      {contract.bien_titre}
                    </Text>
                    <Text style={{ color: '#9ca3af', fontSize: 14 }}>
                      {contract.type_contrat}
                    </Text>
                  </View>
                  <View style={{
                    backgroundColor: getStatusColor(contract.statut),
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                    borderRadius: 12,
                  }}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
                      {getStatusText(contract.statut)}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Ionicons name="calendar-outline" size={16} color="#9ca3af" />
                  <Text style={{ color: '#9ca3af', fontSize: 14, marginLeft: 8 }}>
                    Du {new Date(contract.date_debut).toLocaleDateString('fr-FR')} au {new Date(contract.date_fin).toLocaleDateString('fr-FR')}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="cash-outline" size={16} color="#9ca3af" />
                  <Text style={{ color: '#9ca3af', fontSize: 14, marginLeft: 8 }}>
                    {contract.montant_loyer.toLocaleString()} FCFA/mois
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
};
