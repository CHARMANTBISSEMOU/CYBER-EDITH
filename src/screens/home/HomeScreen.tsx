import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { bienApi } from '../../services/bienApi';

export const HomeScreen = ({ navigation }: any) => {
  const [biens, setBiens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadBiens();
  }, []);

  const loadBiens = async () => {
    try {
      setLoading(true);
      const response = await bienApi.getAllBiens(1, 20);
      setBiens(response.biens || []);
    } catch (error: any) {
      console.error('Erreur chargement biens:', error);
      Alert.alert('Erreur', 'Impossible de charger les biens');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBiens();
    setRefreshing(false);
  };

  const renderBienCard = ({ item }: any) => (
    <TouchableOpacity
      onPress={() => navigation.navigate('BienDetail', { id: item.id_bien })}
      style={{
        backgroundColor: '#f8fafc',
        borderRadius: 16,
        marginBottom: 16,
        overflow: 'hidden',
        flexDirection: 'row',
        height: 140,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      }}
    >
      {/* Image */}
      <View style={{ width: 140, height: 140 }}>
        {item.image_principale ? (
          <Image
            source={{ uri: item.image_principale }}
            style={{ width: 140, height: 140 }}
            resizeMode="cover"
          />
        ) : (
          <View style={{ width: 140, height: 140, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="image-outline" size={40} color="#64748b" />
          </View>
        )}
      </View>

      {/* Informations */}
      <View style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}>
        {/* Titre */}
        <View>
          <Text style={{ color: '#1e293b', fontSize: 18, fontWeight: '700' }} numberOfLines={2}>
            {item.titre}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
            <Ionicons name="location-outline" size={16} color="#64748b" />
            <Text style={{ color: '#64748b', fontSize: 13, marginLeft: 4 }} numberOfLines={1}>
              {item.quartier}, {item.ville}
            </Text>
          </View>
          {item.type_bien && (
            <View style={{
              backgroundColor: '#3b82f620',
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 6,
              alignSelf: 'flex-start',
              marginTop: 8,
            }}>
              <Text style={{ color: '#3b82f6', fontSize: 11, fontWeight: '600' }}>
                {item.type_bien}
              </Text>
            </View>
          )}
        </View>

        {/* Caractéristiques et prix */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            {item.nombre_chambres > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="bed-outline" size={16} color="#64748b" />
                <Text style={{ color: '#64748b', fontSize: 13, marginLeft: 4 }}>
                  {item.nombre_chambres}
                </Text>
              </View>
            )}
            {item.superficie && (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="resize-outline" size={16} color="#64748b" />
                <Text style={{ color: '#64748b', fontSize: 13, marginLeft: 4 }}>
                  {item.superficie}m²
                </Text>
              </View>
            )}
          </View>

          {/* Prix */}
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: '#10b981', fontSize: 18, fontWeight: '700' }}>
              {item.prix_loyer 
                ? `${item.prix_loyer.toLocaleString()} F`
                : item.prix_vente 
                ? `${item.prix_vente.toLocaleString()} F`
                : 'N/A'
              }
            </Text>
            <Text style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>
              {item.prix_loyer ? '/mois' : ''}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const handleContactOwner = async (bien: any) => {
    if (bien.telephone_proprietaire) {
      Alert.alert(
        'Contacter le propriétaire',
        `Souhaitez-vous appeler ${bien.proprietaire} au ${bien.telephone_proprietaire}?`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Appeler',
            onPress: () => Linking.openURL(`tel:${bien.telephone_proprietaire}`),
          },
        ]
      );
    } else {
      Alert.alert('Information', 'Aucun numéro de téléphone disponible pour ce bien');
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
      {/* En-tête */}
      <View style={{ padding: 16, paddingTop: 60, backgroundColor: '#ffffff' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#1e293b', fontSize: 28, fontWeight: '700', marginBottom: 4 }}>
              Découvrir
            </Text>
            <Text style={{ color: '#64748b', fontSize: 14 }}>
              Trouvez votre prochain logement
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Search')}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: '#f1f5f9',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="search" size={20} color="#1e293b" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('Notifications')}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: '#f1f5f9',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="notifications" size={20} color="#1e293b" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Liste des biens */}
      <FlatList
        data={biens}
        renderItem={({ item }) => (
          <View>
            {renderBienCard({ item })}
            {item.telephone_proprietaire && (
              <TouchableOpacity
                onPress={() => handleContactOwner(item)}
                style={{
                  backgroundColor: '#10b981',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="call" size={16} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600', marginLeft: 8 }}>
                  Contacter le propriétaire
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        keyExtractor={(item) => item.id_bien}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3b82f6"
          />
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 40 }}>
            <Ionicons name="home-outline" size={64} color="#64748b" />
            <Text style={{ color: '#64748b', fontSize: 16, marginTop: 16 }}>
              Aucun bien disponible
            </Text>
          </View>
        }
      />
    </View>
  );
};
