import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { bienApi } from '../../services/bienApi';
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
