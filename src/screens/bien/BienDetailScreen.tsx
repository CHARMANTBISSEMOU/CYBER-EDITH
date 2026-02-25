import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { bienApi } from '../../services/bienApi';
import { mediaApi } from '../../services/mediaApi';
import { useAuthStore } from '../../store/authStore';
import { ScreenHeader } from '../../components/ScreenHeader';

const { width } = Dimensions.get('window');

const VideoPlayer = ({ uri }: { uri: string }) => {
  const videoRef = useRef<Video>(null);

  const handleFullscreen = async () => {
    try {
      if (videoRef.current) {
        await videoRef.current.presentFullscreenPlayer();
      }
    } catch (e) {
      console.log('Fullscreen non supporté:', e);
    }
  };

  return (
    <View style={{ width: '100%', height: '100%' }}>
      <Video
        ref={videoRef}
        source={{ uri }}
        style={{ width: '100%', height: '100%' }}
        resizeMode={ResizeMode.CONTAIN}
        useNativeControls
        isLooping={false}
        shouldPlay={false}
      />
      <TouchableOpacity
        onPress={handleFullscreen}
        style={{
          position: 'absolute',
          bottom: 12,
          right: 12,
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: 'rgba(0,0,0,0.6)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="expand" size={18} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

export const BienDetailScreen = ({ route, navigation }: any) => {
  const { id } = route.params;
  const [bien, setBien] = useState<any>(null);
  const [medias, setMedias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const { user } = useAuthStore();

  useEffect(() => {
    loadBienDetails();
  }, [id]);

  const loadBienDetails = async () => {
    try {
      setLoading(true);
      const bienData = await bienApi.getBienById(id);
      setBien(bienData);

      try {
        console.log('Chargement des médias pour le bien:', id);
        const mediasData = await mediaApi.getBienMedias(id);
        console.log('Réponse médias API:', mediasData);
        
        // Le backend retourne { images: [], videos: [] } séparément
        const imgs = Array.isArray(mediasData.images) ? mediasData.images : [];
        const vids = Array.isArray(mediasData.videos) ? mediasData.videos : [];
        const combined = [...imgs, ...vids];
        if (combined.length > 0) {
          console.log('Médias extraits:', combined.length, '(images:', imgs.length, ', vidéos:', vids.length, ')');
          setMedias(combined);
        } else {
          const fallback = mediasData.medias || mediasData.media || mediasData || [];
          setMedias(Array.isArray(fallback) ? fallback : []);
        }
      } catch (error) {
        console.log('Erreur chargement médias:', error);
        setMedias([]);
      }
    } catch (error: any) {
      console.error('Erreur chargement bien:', error);
      Alert.alert('Erreur', 'Impossible de charger les détails du bien');
    } finally {
      setLoading(false);
    }
  };

  const handleContact = () => {
    if (bien?.id_proprietaire) {
      const ownerName = `${bien.prenom_proprietaire || ''} ${bien.nom_proprietaire || ''}`.trim() || 'le propriétaire';
      
      Alert.alert(
        'Discuter avec le propriétaire',
        `Souhaitez-vous discuter avec ${ownerName} à propos de ce bien ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Discuter',
            onPress: () => {
              navigation.navigate('Chat', {
                id_interlocuteur: bien.id_proprietaire,
                id_bien: bien.id_bien,
                nom_interlocuteur: ownerName,
              });
            },
          },
        ]
      );
    } else {
      Alert.alert('Information', 'Impossible de contacter le propriétaire pour ce bien');
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
        <ScreenHeader title="Détails du bien" onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </View>
    );
  }

  if (!bien) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
        <ScreenHeader title="Détails du bien" onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
          <Text style={{ color: '#fff', fontSize: 18, marginTop: 16, textAlign: 'center' }}>
            Bien introuvable
          </Text>
        </View>
      </View>
    );
  }

  const isOwner = user?.id_utilisateur === bien.id_proprietaire;

  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <ScreenHeader title="Détails du bien" onBack={() => navigation.goBack()} />

      <ScrollView style={{ flex: 1 }}>
        {/* Galerie d'images */}
        {medias.length > 0 ? (
          <View>
            <ScrollView
              ref={scrollViewRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={(event) => {
                const index = Math.round(event.nativeEvent.contentOffset.x / width);
                setCurrentImageIndex(index);
              }}
              scrollEventThrottle={16}
            >
              {medias.map((media, index) => {
                const mediaUrl = media.url_image || media.url || media.media_url || media.src;
                const isVideo = media.type_media === 'video' || media.type === 'video' ||
                  (mediaUrl && (mediaUrl.endsWith('.mp4') || mediaUrl.endsWith('.mov') || mediaUrl.endsWith('.avi')));
                
                return (
                  <View key={index} style={{ width, height: 300 }}>
                    {isVideo && mediaUrl ? (
                      <VideoPlayer uri={mediaUrl} />
                    ) : mediaUrl ? (
                      <Image
                        source={{ uri: mediaUrl }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                        onError={(error) => {
                          console.log(`Erreur chargement image ${index}:`, error);
                        }}
                      />
                    ) : (
                      <View style={{ width: '100%', height: '100%', backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="image-outline" size={64} color="#64748b" />
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
            
            {/* Boutons de navigation */}
            {medias.length > 1 && (
              <>
                {currentImageIndex > 0 && (
                  <TouchableOpacity
                    style={{
                      position: 'absolute',
                      left: 10,
                      top: '50%',
                      marginTop: -20,
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: 'rgba(0,0,0,0.6)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 1,
                    }}
                    onPress={() => {
                      if (scrollViewRef.current) {
                        scrollViewRef.current.scrollTo({
                          x: (currentImageIndex - 1) * width,
                          animated: true,
                        });
                      }
                    }}
                  >
                    <Ionicons name="chevron-back" size={24} color="#fff" />
                  </TouchableOpacity>
                )}
                
                {currentImageIndex < medias.length - 1 && (
                  <TouchableOpacity
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      marginTop: -20,
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: 'rgba(0,0,0,0.6)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 1,
                    }}
                    onPress={() => {
                      if (scrollViewRef.current) {
                        scrollViewRef.current.scrollTo({
                          x: (currentImageIndex + 1) * width,
                          animated: true,
                        });
                      }
                    }}
                  >
                    <Ionicons name="chevron-forward" size={24} color="#fff" />
                  </TouchableOpacity>
                )}
              </>
            )}
            
            {/* Indicateurs de pagination */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', paddingVertical: 12, backgroundColor: 'rgba(0,0,0,0.3)', position: 'absolute', bottom: 0, width: '100%' }}>
              {medias.map((_, index) => (
                <View
                  key={index}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: currentImageIndex === index ? '#3b82f6' : '#64748b',
                    marginHorizontal: 4,
                  }}
                />
              ))}
            </View>
          </View>
        ) : (
          <View style={{ height: 300, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="image-outline" size={80} color="#64748b" />
            <Text style={{ color: '#1e293b', marginTop: 8 }}>Aucune image disponible</Text>
          </View>
        )}

        {/* Informations du bien */}
        <View style={{ padding: 16 }}>
          {/* Titre et localisation */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: '#1e293b', fontSize: 24, fontWeight: '700', marginBottom: 8 }}>
              {bien.titre}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="location" size={18} color="#3b82f6" />
              <Text style={{ color: '#64748b', marginLeft: 6, fontSize: 14 }}>
                {bien.quartier}, {bien.ville}
              </Text>
            </View>
            
            {/* Bouton Itinéraire */}
            <TouchableOpacity 
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#3b82f6',
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 8,
                alignSelf: 'flex-start',
              }}
              onPress={() => navigation.navigate('Navigation', { bien })}
            >
              <Ionicons name="navigate" size={16} color="#fff" />
              <Text style={{ color: '#fff', marginLeft: 6, fontSize: 14, fontWeight: '500' }}>
                Itinéraire
              </Text>
            </TouchableOpacity>
          </View>

          {/* Prix */}
          <View style={{ backgroundColor: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' }}>
            <Text style={{ color: '#10b981', fontSize: 28, fontWeight: '700' }}>
              {bien.prix_loyer ? `${bien.prix_loyer.toLocaleString()} FCFA/mois` : `${bien.prix_vente?.toLocaleString()} FCFA`}
            </Text>
            <Text style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
              {bien.prix_loyer ? 'Loyer mensuel' : 'Prix de vente'}
            </Text>
          </View>

          {/* Caractéristiques */}
          <View style={{ backgroundColor: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' }}>
            <Text style={{ color: '#1e293b', fontSize: 18, fontWeight: '600', marginBottom: 12 }}>
              Caractéristiques
            </Text>

            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="home-outline" size={20} color="#64748b" />
                  <Text style={{ color: '#64748b', marginLeft: 12 }}>Type</Text>
                </View>
                <Text style={{ color: '#1e293b', fontWeight: '600', textTransform: 'capitalize' }}>
                  {bien.type_bien}
                </Text>
              </View>

              {bien.superficie && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="resize-outline" size={20} color="#64748b" />
                    <Text style={{ color: '#64748b', marginLeft: 12 }}>Superficie</Text>
                  </View>
                  <Text style={{ color: '#1e293b', fontWeight: '600' }}>{bien.superficie} m²</Text>
                </View>
              )}

              {bien.nombre_chambres > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="bed-outline" size={20} color="#64748b" />
                    <Text style={{ color: '#64748b', marginLeft: 12 }}>Chambres</Text>
                  </View>
                  <Text style={{ color: '#1e293b', fontWeight: '600' }}>{bien.nombre_chambres}</Text>
                </View>
              )}

              {bien.nombre_salles_bain > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="water-outline" size={20} color="#64748b" />
                    <Text style={{ color: '#64748b', marginLeft: 12 }}>Salles de bain</Text>
                  </View>
                  <Text style={{ color: '#1e293b', fontWeight: '600' }}>{bien.nombre_salles_bain}</Text>
                </View>
              )}

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#64748b" />
                  <Text style={{ color: '#64748b', marginLeft: 12 }}>Meublé</Text>
                </View>
                <Text style={{ color: '#1e293b', fontWeight: '600' }}>{bien.meuble ? 'Oui' : 'Non'}</Text>
              </View>
            </View>
          </View>

          {/* Description */}
          {bien.description && (
            <View style={{ backgroundColor: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' }}>
              <Text style={{ color: '#1e293b', fontSize: 18, fontWeight: '600', marginBottom: 12 }}>
                Description
              </Text>
              <Text style={{ color: '#64748b', lineHeight: 22 }}>{bien.description}</Text>
            </View>
          )}

          {/* Propriétaire */}
          <View style={{ backgroundColor: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: '#e2e8f0' }}>
            <Text style={{ color: '#1e293b', fontSize: 18, fontWeight: '600', marginBottom: 12 }}>
              Propriétaire
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 48, height: 48, backgroundColor: '#3b82f6', borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>
                  {bien.prenom_proprietaire?.[0] || 'P'}{bien.nom_proprietaire?.[0] || 'P'}
                </Text>
              </View>
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ color: '#1e293b', fontSize: 16, fontWeight: '600' }}>
                  {bien.prenom_proprietaire || ''} {bien.nom_proprietaire || 'Propriétaire'}
                </Text>
                <Text style={{ color: '#64748b', fontSize: 14 }}>Propriétaire</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bouton de contact */}
      <View style={{ padding: 16, backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#e2e8f0' }}>
        {!isOwner ? (
          <TouchableOpacity
            onPress={handleContact}
            style={{
              backgroundColor: '#3b82f6',
              padding: 16,
              borderRadius: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={20} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 }}>
              💬 Discuter avec le propriétaire
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={{ gap: 12 }}>
            <TouchableOpacity
              onPress={() => navigation.navigate('EditBien', { bienId: bien.id_bien })}
              style={{
                backgroundColor: '#10b981',
                padding: 16,
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="create-outline" size={20} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 }}>
                ✏️ Modifier le bien
              </Text>
            </TouchableOpacity>
            
            <View style={{
              backgroundColor: '#334155',
              padding: 16,
              borderRadius: 12,
              alignItems: 'center',
            }}>
              <Text style={{ color: '#9ca3af', fontSize: 14, textAlign: 'center' }}>
                📝 C'est votre bien - vous ne pouvez pas discuter avec vous-même
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};
