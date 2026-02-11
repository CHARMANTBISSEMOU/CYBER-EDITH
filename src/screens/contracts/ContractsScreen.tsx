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
import { ScreenHeader } from '../../components/ScreenHeader';
import { contratApi } from '../../services/contratApi';

export const ContractsScreen = ({ navigation }: any) => {
  const [contrats, setContrats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadContrats();
  }, []);

  const loadContrats = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await contratApi.getMesContrats();
      setContrats(response.contrats || []);
    } catch (error: any) {
      console.error('Erreur chargement contrats:', error);
      if (!silent) {
        Alert.alert('Erreur', 'Impossible de charger les contrats');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadContrats(true);
    setRefreshing(false);
  };

  const getStatusColor = (statut: string) => {
    switch (statut) {
      case 'brouillon': return '#f59e0b';
      case 'en_attente': return '#3b82f6';
      case 'actif': return '#10b981';
      case 'refuse': return '#ef4444';
      case 'resilie': return '#6b7280';
      default: return '#64748b';
    }
  };

  const getStatusLabel = (statut: string) => {
    switch (statut) {
      case 'brouillon': return 'Brouillon';
      case 'en_attente': return 'En attente';
      case 'actif': return 'Actif';
      case 'refuse': return 'Refusé';
      case 'resilie': return 'Résilié';
      default: return statut;
    }
  };

  const handleContratPress = (contrat: any) => {
    navigation.navigate('ContractDetail', { id_contrat: contrat.id_contrat });
  };

  const renderContrat = ({ item }: any) => (
    <TouchableOpacity
      onPress={() => handleContratPress(item)}
      style={{
        backgroundColor: '#1e293b',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
      }}
    >
      {/* En-tête */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
            {item.titre_bien}
          </Text>
          <Text style={{ color: '#9ca3af', fontSize: 14, marginTop: 4 }}>
            {item.nom_locataire || item.nom_proprietaire}
          </Text>
        </View>
        <View
          style={{
            backgroundColor: getStatusColor(item.statut),
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 6,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
            {getStatusLabel(item.statut)}
          </Text>
        </View>
      </View>

      {/* Informations */}
      <View style={{ gap: 8 }}>
        {item.montant_loyer && (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="cash-outline" size={16} color="#64748b" />
            <Text style={{ color: '#9ca3af', fontSize: 14, marginLeft: 8 }}>
              {item.montant_loyer.toLocaleString()} FCFA/mois
            </Text>
          </View>
        )}
        
        {item.date_debut && (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="calendar-outline" size={16} color="#64748b" />
            <Text style={{ color: '#9ca3af', fontSize: 14, marginLeft: 8 }}>
              Début : {new Date(item.date_debut).toLocaleDateString('fr-FR')}
            </Text>
          </View>
        )}

        {item.duree_mois && (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="time-outline" size={16} color="#64748b" />
            <Text style={{ color: '#9ca3af', fontSize: 14, marginLeft: 8 }}>
              Durée : {item.duree_mois} mois
            </Text>
          </View>
        )}
      </View>

      {/* Actions rapides */}
      {item.statut === 'en_attente' && item.role === 'locataire' && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#334155' }}>
          <TouchableOpacity
            onPress={() => handleContratPress(item)}
            style={{
              flex: 1,
              backgroundColor: '#10b981',
              padding: 10,
              borderRadius: 8,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Accepter</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleContratPress(item)}
            style={{
              flex: 1,
              backgroundColor: '#ef4444',
              padding: 10,
              borderRadius: 8,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Refuser</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
        <ScreenHeader title="Mes contrats" onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <ScreenHeader title="Mes contrats" onBack={() => navigation.goBack()} />

      <FlatList
        data={contrats}
        renderItem={renderContrat}
        keyExtractor={(item) => item.id_contrat}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3b82f6"
          />
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Ionicons name="document-text-outline" size={80} color="#334155" />
            <Text style={{ color: '#9ca3af', fontSize: 18, marginTop: 24, textAlign: 'center' }}>
              Aucun contrat
            </Text>
            <Text style={{ color: '#64748b', fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 }}>
              Vos contrats de location apparaîtront ici
            </Text>
          </View>
        }
      />

      {/* Bouton flottant pour créer un contrat */}
      <TouchableOpacity
        onPress={() => navigation.navigate('CreateContract')}
        style={{
          position: 'absolute',
          bottom: 24,
          right: 24,
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: '#3b82f6',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};
