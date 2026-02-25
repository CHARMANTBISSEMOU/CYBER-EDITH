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
import { mediaApi } from '../../services/mediaApi';
import { getActiveContractsMap, ActiveContractInfo } from '../../utils/contractUtils';
import { notificationApi } from '../../services/notificationApi';
import { localNotificationService } from '../../utils/localNotifications';
import { useTranslation } from '../../i18n/useTranslation';

export const HomeScreen = ({ navigation }: any) => {
  const { t } = useTranslation();
  const [biens, setBiens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeContracts, setActiveContracts] = useState<Map<string, ActiveContractInfo>>(new Map());
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [bienImages, setBienImages] = useState<Record<string, string>>({});

  useEffect(() => {
    loadBiens();
    getActiveContractsMap().then(setActiveContracts);
    loadUnreadNotifCount();

    const unsubscribe = navigation.addListener('focus', () => {
      loadUnreadNotifCount();
    });
    return unsubscribe;
  }, [navigation]);

  const loadUnreadNotifCount = async () => {
    try {
      let backendCount = 0;
      try {
        const res = await notificationApi.getUnreadCount();
        backendCount = res.total_non_lues || res.non_lues || 0;
      } catch (e) {}
      const localCount = await localNotificationService.getUnreadCount();
      setUnreadNotifCount(backendCount + localCount);
    } catch (e) {}
  };

  const loadBiens = async () => {
    try {
      setLoading(true);
      const response = await bienApi.getAllBiens(1, 20);
      const biensList = response.biens || [];
      setBiens(biensList);
      loadBienImages(biensList);
    } catch (error: any) {
      console.error('Erreur chargement biens:', error);
      Alert.alert('Erreur', 'Impossible de charger les biens');
    } finally {
      setLoading(false);
    }
  };

  const loadBienImages = async (biensList: any[]) => {
    const images: Record<string, string> = {};
    await Promise.all(
      biensList.map(async (bien: any) => {
        try {
          const mediasData = await mediaApi.getBienMedias(bien.id_bien);
          const mediasArray = mediasData.medias || mediasData.media || mediasData.images || mediasData || [];
          if (Array.isArray(mediasArray) && mediasArray.length > 0) {
            const first = mediasArray[0];
            const url = first.url_image || first.url || first.media_url || first.src;
            if (url) images[bien.id_bien] = url;
          }
        } catch (e) {}
      })
    );
    setBienImages(images);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBiens();
    setRefreshing(false);
  };

  const getBienImage = (item: any) => {
    // D'abord vérifier le cache des médias chargés via mediaApi
    if (bienImages[item.id_bien]) return bienImages[item.id_bien];
    // Fallback sur les champs de l'objet bien
    if (item.image_principale) return item.image_principale;
    if (item.images && item.images.length > 0) {
      const img = item.images[0];
      return typeof img === 'string' ? img : img.url_image || img.url || null;
    }
    return null;
  };

  const renderBienCard = ({ item }: any) => {
    const imageUrl = getBienImage(item);
    return (
    <TouchableOpacity
      onPress={() => navigation.navigate('BienDetail', { id: item.id_bien })}
      style={{
        backgroundColor: '#f8fafc',
        borderRadius: 14,
        marginBottom: 14,
        overflow: 'hidden',
        flexDirection: 'row',
        height: 140,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
      }}
    >
      {/* Image */}
      <View style={{ width: 120, height: 140 }}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={{ width: 120, height: 140 }}
            resizeMode="cover"
          />
        ) : (
          <View style={{ width: 120, height: 140, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="image-outline" size={36} color="#94a3b8" />
          </View>
        )}
      </View>

      {/* Informations */}
      <View style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'space-between' }}>
        {/* Titre */}
        <Text style={{ color: '#1e293b', fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
          {item.titre}
        </Text>

        {/* Localisation */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="location-outline" size={13} color="#64748b" />
          <Text style={{ color: '#64748b', fontSize: 12, marginLeft: 3 }} numberOfLines={1}>
            {item.quartier}, {item.ville}
          </Text>
        </View>

        {/* Badges : type + disponibilité */}
        <View style={{ flexDirection: 'row', gap: 5, flexWrap: 'wrap' }}>
          {item.type_bien && (
            <View style={{ backgroundColor: '#3b82f615', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5 }}>
              <Text style={{ color: '#3b82f6', fontSize: 10, fontWeight: '600' }}>{item.type_bien}</Text>
            </View>
          )}
          {activeContracts.has(item.id_bien) ? (
            <View style={{ backgroundColor: '#f59e0b15', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5 }}>
              <Text style={{ color: '#f59e0b', fontSize: 10, fontWeight: '600' }}>
                {activeContracts.get(item.id_bien)!.label}
              </Text>
            </View>
          ) : (
            <View style={{ backgroundColor: '#10b98115', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5 }}>
              <Text style={{ color: '#10b981', fontSize: 10, fontWeight: '600' }}>Disponible</Text>
            </View>
          )}
        </View>

        {/* Prix */}
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text style={{ color: '#10b981', fontSize: 16, fontWeight: '700' }}>
            {item.prix_loyer
              ? `${item.prix_loyer.toLocaleString()} F`
              : item.prix_vente
              ? `${item.prix_vente.toLocaleString()} F`
              : ''}
          </Text>
          {item.prix_loyer ? (
            <Text style={{ color: '#64748b', fontSize: 11, marginLeft: 2 }}>/mois</Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
    );
  };

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
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <Image
              source={require('../../assets/logoapp.png')}
              style={{ width: 40, height: 40, borderRadius: 8, marginRight: 10 }}
              resizeMode="contain"
            />
            <View>
              <Text style={{ color: '#1e293b', fontSize: 28, fontWeight: '700', marginBottom: 4 }}>
                {t('homeDiscover')}
              </Text>
              <Text style={{ color: '#64748b', fontSize: 14 }}>
                {t('loginSubtitle')}
              </Text>
            </View>
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
              {unreadNotifCount > 0 && (
                <View style={{
                  position: 'absolute', top: 2, right: 2,
                  backgroundColor: '#ef4444', borderRadius: 9, minWidth: 18, height: 18,
                  alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
                }}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
                    {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
                  </Text>
                </View>
              )}
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
