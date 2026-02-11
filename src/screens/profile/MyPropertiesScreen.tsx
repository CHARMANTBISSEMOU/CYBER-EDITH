import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '../../components/ScreenHeader';
import { bienApi } from '../../services/bienApi';

export const MyPropertiesScreen = ({ navigation }: any) => {
  const [biens, setBiens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadBiens();
  }, []);

  const loadBiens = async () => {
    try {
      setLoading(true);
      const response = await bienApi.getMyBiens();
      setBiens(response.biens || []);
    } catch (error: any) {
      console.error('Erreur chargement biens:', error);
      Alert.alert('Erreur', 'Impossible de charger vos biens');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBiens();
    setRefreshing(false);
  };

  const handleDelete = (bien: any) => {
    Alert.alert(
      'Supprimer le bien',
      `Êtes-vous sûr de vouloir supprimer "${bien.titre}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await bienApi.deleteBien(bien.id_bien);
              Alert.alert('Succès', 'Le bien a été supprimé');
              loadBiens();
            } catch (error: any) {
              Alert.alert('Erreur', error.response?.data?.detail || 'Impossible de supprimer le bien');
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (statut: string) => {
    switch (statut) {
      case 'publie': return '#10b981';
      case 'loue': return '#3b82f6';
      case 'vendu': return '#8b5cf6';
      case 'archive': return '#6b7280';
      default: return '#f59e0b';
    }
  };

  const getStatusLabel = (statut: string) => {
    switch (statut) {
      case 'publie': return 'Publié';
      case 'loue': return 'Loué';
      case 'vendu': return 'Vendu';
      case 'archive': return 'Archivé';
      case 'en_attente': return 'En attente';
      default: return statut;
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
        <ScreenHeader title="Mes biens" onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <ScreenHeader title="Mes biens" onBack={() => navigation.goBack()} />

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
      >
        {/* Bouton Ajouter un bien */}
        <View style={{ padding: 16 }}>
          <TouchableOpacity
            onPress={() => navigation.navigate('AddBien')}
            style={{
              backgroundColor: '#10b981',
              padding: 16,
              borderRadius: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="add-circle" size={24} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 }}>
              Publier un bien
            </Text>
          </TouchableOpacity>
        </View>

        {/* Liste des biens */}
        {biens.length === 0 ? (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <Ionicons name="home-outline" size={64} color="#64748b" />
            <Text style={{ color: '#9ca3af', fontSize: 16, marginTop: 16, textAlign: 'center' }}>
              Vous n'avez pas encore publié de bien
            </Text>
            <Text style={{ color: '#64748b', fontSize: 14, marginTop: 8, textAlign: 'center' }}>
              Cliquez sur "Publier un bien" pour commencer
            </Text>
          </View>
        ) : (
          <View style={{ padding: 16, paddingTop: 0 }}>
            {biens.map((bien) => (
              <View
                key={bien.id_bien}
                style={{
                  backgroundColor: '#1e293b',
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 16,
                }}
              >
                {/* En-tête */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>
                      {bien.titre}
                    </Text>
                    <Text style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
                      {bien.type_bien} • {bien.ville}
                    </Text>
                  </View>
                  <View
                    style={{
                      backgroundColor: getStatusColor(bien.statut),
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 6,
                      height: 32,
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
                      {getStatusLabel(bien.statut)}
                    </Text>
                  </View>
                </View>

                {/* Informations */}
                <View style={{ marginBottom: 12 }}>
                  {bien.prix_loyer && (
                    <Text style={{ color: '#10b981', fontSize: 16, fontWeight: '600' }}>
                      {bien.prix_loyer.toLocaleString()} FCFA/mois
                    </Text>
                  )}
                  {bien.prix_vente && (
                    <Text style={{ color: '#3b82f6', fontSize: 16, fontWeight: '600' }}>
                      {bien.prix_vente.toLocaleString()} FCFA
                    </Text>
                  )}
                  {bien.superficie && (
                    <Text style={{ color: '#9ca3af', fontSize: 14, marginTop: 4 }}>
                      {bien.superficie} m²
                    </Text>
                  )}
                  {bien.nombre_chambres > 0 && (
                    <Text style={{ color: '#9ca3af', fontSize: 14 }}>
                      {bien.nombre_chambres} chambre{bien.nombre_chambres > 1 ? 's' : ''}
                    </Text>
                  )}
                </View>

                {/* Actions */}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('BienDetail', { id: bien.id_bien })}
                    style={{
                      flex: 1,
                      backgroundColor: '#334155',
                      padding: 12,
                      borderRadius: 8,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="eye-outline" size={20} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 14, marginLeft: 6 }}>Voir</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleDelete(bien)}
                    style={{
                      backgroundColor: '#ef4444',
                      padding: 12,
                      borderRadius: 8,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: 16,
                    }}
                  >
                    <Ionicons name="trash-outline" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};
