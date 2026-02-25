import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { bienApi } from '../../services/bienApi';
import { mediaApi } from '../../services/mediaApi';
import * as ImagePicker from 'expo-image-picker';
import type { Bien } from '../../types';

interface EditBienScreenProps {
  route: {
    params: {
      bienId: string;
    };
  };
  navigation: any;
}

export const EditBienScreen = ({ route, navigation }: EditBienScreenProps) => {
  const { bienId } = route.params;
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [bien, setBien] = useState<Bien | null>(null);
  const [medias, setMedias] = useState<any[]>([]);
  const [deletingMediaId, setDeletingMediaId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Formulaire
  const [formData, setFormData] = useState({
    titre: '',
    description: '',
    type_bien: 'appartement',
    ville: '',
    quartier: '',
    adresse_complete: '',
    prix_loyer: '',
    prix_vente: '',
    superficie: '',
    nombre_chambres: '',
    nombre_salles_bain: '',
    nombre_pieces: '',
    meuble: false,
  });

  const TYPES_BIEN = [
    { value: 'appartement', label: 'Appartement' },
    { value: 'studio', label: 'Studio' },
    { value: 'maison', label: 'Maison' },
    { value: 'chambre', label: 'Chambre' },
    { value: 'bureau', label: 'Bureau' },
    { value: 'terrain', label: 'Terrain' },
    { value: 'magasin', label: 'Magasin' },
  ];

  useEffect(() => {
    loadBienDetails();
  }, []);

  const loadBienDetails = async () => {
    try {
      console.log('📤 Chargement détails du bien:', bienId);
      const bienData = await bienApi.getBienById(bienId);
      console.log('✅ Bien chargé:', bienData);
      
      setBien(bienData);

      // Charger les médias du bien
      try {
        const mediasData = await mediaApi.getBienMedias(bienId);
        const images = Array.isArray(mediasData.images) ? mediasData.images : [];
        const videos = Array.isArray(mediasData.videos) ? mediasData.videos : [];
        const combined = [...images, ...videos];
        if (combined.length === 0) {
          const fallback = mediasData.medias || mediasData.media || mediasData || [];
          setMedias(Array.isArray(fallback) ? fallback : []);
        } else {
          setMedias(combined);
        }
      } catch (e) {
        console.log('Pas de médias pour ce bien');
      }

      // Remplir le formulaire avec les données existantes
      setFormData({
        titre: bienData.titre || '',
        description: bienData.description || '',
        type_bien: bienData.type_bien || 'appartement',
        ville: bienData.ville || '',
        quartier: bienData.quartier || '',
        adresse_complete: bienData.adresse_complete || '',
        prix_loyer: bienData.prix_loyer ? bienData.prix_loyer.toString() : '',
        prix_vente: bienData.prix_vente ? bienData.prix_vente.toString() : '',
        superficie: bienData.superficie ? bienData.superficie.toString() : '',
        nombre_chambres: bienData.nombre_chambres ? bienData.nombre_chambres.toString() : '',
        nombre_salles_bain: bienData.nombre_salles_bain ? bienData.nombre_salles_bain.toString() : '',
        nombre_pieces: bienData.nombre_pieces ? bienData.nombre_pieces.toString() : '',
        meuble: bienData.meuble || false,
      });
    } catch (error: any) {
      console.error('❌ Erreur chargement bien:', error);
      Alert.alert('Erreur', 'Impossible de charger les détails du bien');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    if (!formData.titre.trim()) {
      Alert.alert('Erreur', 'Le titre est obligatoire');
      return false;
    }
    if (!formData.ville.trim()) {
      Alert.alert('Erreur', 'La ville est obligatoire');
      return false;
    }
    if (!formData.quartier.trim()) {
      Alert.alert('Erreur', 'Le quartier est obligatoire');
      return false;
    }
    if (!formData.prix_loyer && !formData.prix_vente) {
      Alert.alert('Erreur', 'Vous devez indiquer au moins un prix (loyer ou vente)');
      return false;
    }
    return true;
  };

  const handleDeleteMedia = (mediaId: string, index: number) => {
    Alert.alert(
      'Supprimer l\'image',
      'Voulez-vous vraiment supprimer cette image ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingMediaId(mediaId);
              await mediaApi.deleteMedia(mediaId);
              setMedias(prev => prev.filter((_, i) => i !== index));
            } catch (e: any) {
              console.error('Erreur suppression média:', e);
              Alert.alert('Erreur', 'Impossible de supprimer l\'image');
            } finally {
              setDeletingMediaId(null);
            }
          },
        },
      ]
    );
  };

  const reloadMedias = async () => {
    try {
      const mediasData = await mediaApi.getBienMedias(bienId);
      // Le backend retourne { images: [], videos: [] } séparément
      const images = Array.isArray(mediasData.images) ? mediasData.images : [];
      const videos = Array.isArray(mediasData.videos) ? mediasData.videos : [];
      const combined = [...images, ...videos];
      // Fallback si structure différente
      if (combined.length === 0) {
        const fallback = mediasData.medias || mediasData.media || mediasData || [];
        setMedias(Array.isArray(fallback) ? fallback : []);
      } else {
        setMedias(combined);
      }
    } catch (e) {}
  };

  const handlePickMedia = async (type: 'image' | 'video') => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'Autorisez l\'accès à la galerie.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: type === 'image'
          ? ImagePicker.MediaTypeOptions.Images
          : ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: type === 'image',
        quality: type === 'image' ? 0.8 : 1,
        videoMaxDuration: 60,
      });

      if (result.canceled || !result.assets?.[0]) return;

      setUploading(true);
      const asset = result.assets[0];
      const isVideo = asset.type === 'video' || type === 'video';
      const mimeType = asset.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg');
      const fileName = asset.fileName || (isVideo ? `video_${Date.now()}.mp4` : `image_${Date.now()}.jpg`);

      console.log('📤 Upload média:', { type, isVideo, mimeType, fileName, uri: asset.uri });

      const formDataUpload = new FormData();
      formDataUpload.append('fichier', {
        uri: asset.uri,
        type: mimeType,
        name: fileName,
      } as any);
      formDataUpload.append('type_media', isVideo ? 'video' : 'image');

      await mediaApi.uploadMedia(bienId, formDataUpload);
      await reloadMedias();

      Alert.alert('Succès', `${isVideo ? 'Vidéo' : 'Image'} ajoutée avec succès`);
    } catch (e: any) {
      console.error('Erreur upload média:', e);
      if (e.response) {
        console.error('📤 Réponse 422:', JSON.stringify(e.response.data, null, 2));
        console.error('📤 Status:', e.response.status);
      }
      Alert.alert('Erreur', e.response?.data?.detail || 'Impossible d\'ajouter le média');
    } finally {
      setUploading(false);
    }
  };

  const handleUpdate = async () => {
    if (!validateForm()) return;

    setUpdating(true);
    try {
      console.log('📤 Mise à jour du bien...', bienId, formData);
      
      // Préparer les données pour l'API
      const updates: any = {
        titre: formData.titre.trim(),
        description: formData.description.trim(),
        type_bien: formData.type_bien,
        ville: formData.ville.trim(),
        quartier: formData.quartier.trim(),
        adresse_complete: formData.adresse_complete.trim(),
        meuble: formData.meuble,
      };

      // Ajouter les prix numériques
      if (formData.prix_loyer) {
        updates.prix_loyer = parseFloat(formData.prix_loyer);
      }
      if (formData.prix_vente) {
        updates.prix_vente = parseFloat(formData.prix_vente);
      }

      // Ajouter les autres champs numériques
      if (formData.superficie) {
        updates.superficie = parseFloat(formData.superficie);
      }
      if (formData.nombre_chambres) {
        updates.nombre_chambres = parseInt(formData.nombre_chambres);
      }
      if (formData.nombre_salles_bain) {
        updates.nombre_salles_bain = parseInt(formData.nombre_salles_bain);
      }
      if (formData.nombre_pieces) {
        updates.nombre_pieces = parseInt(formData.nombre_pieces);
      }

      const updatedBien = await bienApi.updateBien(bienId, updates);
      console.log('✅ Bien mis à jour:', updatedBien);

      Alert.alert(
        'Succès',
        'Bien mis à jour avec succès',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error: any) {
      console.error('❌ Erreur mise à jour bien:', error);
      const errorMessage = error.response?.data?.detail || 'Impossible de mettre à jour le bien';
      Alert.alert('Erreur', errorMessage);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={{ color: '#fff', marginTop: 16 }}>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        paddingTop: 50,
        backgroundColor: '#1e293b',
        borderBottomWidth: 1,
        borderBottomColor: '#374151',
      }}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={{
          color: '#fff',
          fontSize: 18,
          fontWeight: '600',
          marginLeft: 16,
        }}>
          Modifier le bien
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        {/* Type de bien */}
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
          Type de bien *
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {TYPES_BIEN.map((type) => (
            <TouchableOpacity
              key={type.value}
              onPress={() => updateField('type_bien', type.value)}
              style={{
                backgroundColor: formData.type_bien === type.value ? '#3b82f6' : '#1e293b',
                padding: 12,
                borderRadius: 8,
                marginRight: 8,
                borderWidth: 1,
                borderColor: formData.type_bien === type.value ? '#3b82f6' : '#374151',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 14 }}>{type.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Titre */}
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
          Titre *
        </Text>
        <TextInput
          value={formData.titre}
          onChangeText={(value) => updateField('titre', value)}
          placeholder="Ex: Bel appartement 2 chambres"
          placeholderTextColor="#64748b"
          style={{
            backgroundColor: '#1e293b',
            color: '#fff',
            padding: 12,
            borderRadius: 8,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: '#374151',
          }}
        />

        {/* Description */}
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
          Description
        </Text>
        <TextInput
          value={formData.description}
          onChangeText={(value) => updateField('description', value)}
          placeholder="Décrivez votre bien..."
          placeholderTextColor="#64748b"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          style={{
            backgroundColor: '#1e293b',
            color: '#fff',
            padding: 12,
            borderRadius: 8,
            marginBottom: 16,
            height: 100,
            borderWidth: 1,
            borderColor: '#374151',
          }}
        />

        {/* Localisation */}
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
          📍 Localisation *
        </Text>
        <TextInput
          value={formData.ville}
          onChangeText={(value) => updateField('ville', value)}
          placeholder="Ex: Douala"
          placeholderTextColor="#64748b"
          style={{
            backgroundColor: '#1e293b',
            color: '#fff',
            padding: 12,
            borderRadius: 8,
            marginBottom: 8,
            borderWidth: 1,
            borderColor: '#374151',
          }}
        />
        <TextInput
          value={formData.quartier}
          onChangeText={(value) => updateField('quartier', value)}
          placeholder="Ex: Bonamoussadi"
          placeholderTextColor="#64748b"
          style={{
            backgroundColor: '#1e293b',
            color: '#fff',
            padding: 12,
            borderRadius: 8,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: '#374151',
          }}
        />

        {/* Adresse complète */}
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
          Adresse complète
        </Text>
        <TextInput
          value={formData.adresse_complete}
          onChangeText={(value) => updateField('adresse_complete', value)}
          placeholder="Adresse détaillée (optionnel)"
          placeholderTextColor="#64748b"
          style={{
            backgroundColor: '#1e293b',
            color: '#fff',
            padding: 12,
            borderRadius: 8,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: '#374151',
          }}
        />

        {/* Prix */}
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
          💰 Prix
        </Text>
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#9ca3af', fontSize: 14, marginBottom: 4 }}>Loyer (FCFA/mois)</Text>
            <TextInput
              value={formData.prix_loyer}
              onChangeText={(value) => updateField('prix_loyer', value)}
              placeholder="0"
              placeholderTextColor="#64748b"
              keyboardType="numeric"
              style={{
                backgroundColor: '#1e293b',
                color: '#fff',
                padding: 12,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#374151',
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#9ca3af', fontSize: 14, marginBottom: 4 }}>Vente (FCFA)</Text>
            <TextInput
              value={formData.prix_vente}
              onChangeText={(value) => updateField('prix_vente', value)}
              placeholder="0"
              placeholderTextColor="#64748b"
              keyboardType="numeric"
              style={{
                backgroundColor: '#1e293b',
                color: '#fff',
                padding: 12,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#374151',
              }}
            />
          </View>
        </View>

        {/* Caractéristiques */}
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
          📏 Caractéristiques
        </Text>
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#9ca3af', fontSize: 14, marginBottom: 4 }}>Superficie (m²)</Text>
            <TextInput
              value={formData.superficie}
              onChangeText={(value) => updateField('superficie', value)}
              placeholder="0"
              placeholderTextColor="#64748b"
              keyboardType="numeric"
              style={{
                backgroundColor: '#1e293b',
                color: '#fff',
                padding: 12,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#374151',
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#9ca3af', fontSize: 14, marginBottom: 4 }}>Pièces</Text>
            <TextInput
              value={formData.nombre_pieces}
              onChangeText={(value) => updateField('nombre_pieces', value)}
              placeholder="0"
              placeholderTextColor="#64748b"
              keyboardType="numeric"
              style={{
                backgroundColor: '#1e293b',
                color: '#fff',
                padding: 12,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#374151',
              }}
            />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#9ca3af', fontSize: 14, marginBottom: 4 }}>Chambres</Text>
            <TextInput
              value={formData.nombre_chambres}
              onChangeText={(value) => updateField('nombre_chambres', value)}
              placeholder="0"
              placeholderTextColor="#64748b"
              keyboardType="numeric"
              style={{
                backgroundColor: '#1e293b',
                color: '#fff',
                padding: 12,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#374151',
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#9ca3af', fontSize: 14, marginBottom: 4 }}>Salles de bain</Text>
            <TextInput
              value={formData.nombre_salles_bain}
              onChangeText={(value) => updateField('nombre_salles_bain', value)}
              placeholder="0"
              placeholderTextColor="#64748b"
              keyboardType="numeric"
              style={{
                backgroundColor: '#1e293b',
                color: '#fff',
                padding: 12,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#374151',
              }}
            />
          </View>
        </View>

        {/* Meublé */}
        <TouchableOpacity
          onPress={() => updateField('meuble', !formData.meuble)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#1e293b',
            padding: 16,
            borderRadius: 8,
            marginBottom: 24,
            borderWidth: 1,
            borderColor: '#374151',
          }}
        >
          <Ionicons
            name={formData.meuble ? 'checkbox' : 'square-outline'}
            size={24}
            color={formData.meuble ? '#3b82f6' : '#64748b'}
          />
          <Text style={{ color: '#fff', fontSize: 16, marginLeft: 12 }}>
            Bien meublé
          </Text>
        </TouchableOpacity>

        {/* Gestion des médias (images + vidéos) */}
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
          🖼️ Images
        </Text>

        {(() => {
          const images = medias.filter((m: any) => {
            const t = m.type_media || m.type || '';
            return t !== 'video' && !t.startsWith('video/');
          });
          return images.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {images.map((media: any) => {
                const imageUrl = media.url_image || media.url || media.media_url || media.src;
                const mediaId = media.id_media || media.id;
                const globalIndex = medias.indexOf(media);
                return (
                  <View key={mediaId || globalIndex} style={{ marginRight: 10, position: 'relative' }}>
                    {imageUrl ? (
                      <Image
                        source={{ uri: imageUrl }}
                        style={{ width: 110, height: 110, borderRadius: 10 }}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={{ width: 110, height: 110, borderRadius: 10, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="image-outline" size={30} color="#64748b" />
                      </View>
                    )}
                    <TouchableOpacity
                      onPress={() => handleDeleteMedia(mediaId, globalIndex)}
                      disabled={deletingMediaId === mediaId}
                      style={{
                        position: 'absolute', top: 4, right: 4,
                        width: 28, height: 28, borderRadius: 14,
                        backgroundColor: 'rgba(239,68,68,0.9)',
                        alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {deletingMediaId === mediaId ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Ionicons name="trash" size={14} color="#fff" />
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          ) : (
            <View style={{ backgroundColor: '#1e293b', borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#374151' }}>
              <Ionicons name="image-outline" size={30} color="#64748b" />
              <Text style={{ color: '#64748b', marginTop: 6, fontSize: 12 }}>Aucune image</Text>
            </View>
          );
        })()}

        <TouchableOpacity
          onPress={() => handlePickMedia('image')}
          disabled={uploading}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#1e293b',
            padding: 12,
            borderRadius: 10,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: '#3b82f6',
            borderStyle: 'dashed',
          }}
        >
          {uploading ? (
            <ActivityIndicator size="small" color="#3b82f6" />
          ) : (
            <>
              <Ionicons name="image-outline" size={18} color="#3b82f6" />
              <Text style={{ color: '#3b82f6', fontSize: 14, fontWeight: '600', marginLeft: 8 }}>Ajouter une image</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Vidéos */}
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
          🎬 Vidéos
        </Text>

        {(() => {
          const videos = medias.filter((m: any) => {
            const t = m.type_media || m.type || '';
            return t === 'video' || t.startsWith('video/');
          });
          return videos.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {videos.map((media: any) => {
                const mediaId = media.id_media || media.id;
                const globalIndex = medias.indexOf(media);
                const videoName = media.nom || media.name || media.filename || 'Vidéo';
                return (
                  <View key={mediaId || globalIndex} style={{ marginRight: 10, position: 'relative' }}>
                    <View style={{ width: 140, height: 90, borderRadius: 10, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="videocam" size={32} color="#3b82f6" />
                      <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }} numberOfLines={1}>{videoName}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDeleteMedia(mediaId, globalIndex)}
                      disabled={deletingMediaId === mediaId}
                      style={{
                        position: 'absolute', top: 4, right: 4,
                        width: 28, height: 28, borderRadius: 14,
                        backgroundColor: 'rgba(239,68,68,0.9)',
                        alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {deletingMediaId === mediaId ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Ionicons name="trash" size={14} color="#fff" />
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          ) : (
            <View style={{ backgroundColor: '#1e293b', borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#374151' }}>
              <Ionicons name="videocam-outline" size={30} color="#64748b" />
              <Text style={{ color: '#64748b', marginTop: 6, fontSize: 12 }}>Aucune vidéo</Text>
            </View>
          );
        })()}

        <TouchableOpacity
          onPress={() => handlePickMedia('video')}
          disabled={uploading}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#1e293b',
            padding: 12,
            borderRadius: 10,
            marginBottom: 24,
            borderWidth: 1,
            borderColor: '#8b5cf6',
            borderStyle: 'dashed',
          }}
        >
          {uploading ? (
            <ActivityIndicator size="small" color="#8b5cf6" />
          ) : (
            <>
              <Ionicons name="videocam-outline" size={18} color="#8b5cf6" />
              <Text style={{ color: '#8b5cf6', fontSize: 14, fontWeight: '600', marginLeft: 8 }}>Ajouter une vidéo</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Bouton de mise à jour */}
        <TouchableOpacity
          onPress={handleUpdate}
          disabled={updating}
          style={{
            backgroundColor: updating ? '#6b7280' : '#10b981',
            padding: 16,
            borderRadius: 12,
            alignItems: 'center',
            marginTop: 8,
          }}
        >
          {updating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
              💾 Enregistrer les modifications
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};
