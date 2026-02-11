import React, { useState } from 'react';
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
import { contratApi } from '../../services/contratApi';

export const CreateContractScreen = ({ navigation }: any) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    id_bien: '',
    id_locataire: '',
    date_debut: '',
    duree_mois: '12',
    montant_loyer: '',
    charges_mensuelles: '',
    caution: '',
    conditions_speciales: '',
  });

  const handleCreateContract = async () => {
    if (!formData.id_bien || !formData.id_locataire || !formData.date_debut || !formData.montant_loyer) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      setLoading(true);
      const date_fin = new Date(formData.date_debut);
      date_fin.setMonth(date_fin.getMonth() + parseInt(formData.duree_mois || '12'));
      
      const response = await contratApi.initierContrat(
        formData.id_locataire,
        formData.id_bien,
        parseFloat(formData.montant_loyer),
        formData.date_debut,
        date_fin.toISOString().split('T')[0]
      );
      
      Alert.alert(
        'Succès',
        'Contrat initié avec succès. Vous pouvez maintenant le personnaliser.',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('ContractDetail', { id: response.id_contrat }),
          },
        ]
      );
    } catch (error: any) {
      console.error('Erreur création contrat:', error);
      Alert.alert('Erreur', 'Impossible de créer le contrat');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#0f172a' }}>
      {/* En-tête */}
      <View style={{ padding: 16, paddingTop: 60, backgroundColor: '#1e293b' }}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700', marginTop: 16 }}>
          Créer un contrat
        </Text>
        <Text style={{ color: '#9ca3af', fontSize: 14, marginTop: 4 }}>
          Remplissez les informations du contrat
        </Text>
      </View>

      {/* Formulaire */}
      <View style={{ padding: 16 }}>
        {/* ID Bien */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
            ID du bien *
          </Text>
          <TextInput
            style={{
              backgroundColor: '#1e293b',
              color: '#fff',
              borderRadius: 8,
              paddingHorizontal: 16,
              paddingVertical: 12,
              fontSize: 16,
            }}
            placeholder="ID du bien"
            placeholderTextColor="#6b7280"
            value={formData.id_bien}
            onChangeText={(text) => setFormData({ ...formData, id_bien: text })}
          />
        </View>

        {/* ID Locataire */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
            ID du locataire *
          </Text>
          <TextInput
            style={{
              backgroundColor: '#1e293b',
              color: '#fff',
              borderRadius: 8,
              paddingHorizontal: 16,
              paddingVertical: 12,
              fontSize: 16,
            }}
            placeholder="ID du locataire"
            placeholderTextColor="#6b7280"
            value={formData.id_locataire}
            onChangeText={(text) => setFormData({ ...formData, id_locataire: text })}
          />
        </View>

        {/* Date début */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
            Date de début *
          </Text>
          <TextInput
            style={{
              backgroundColor: '#1e293b',
              color: '#fff',
              borderRadius: 8,
              paddingHorizontal: 16,
              paddingVertical: 12,
              fontSize: 16,
            }}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#6b7280"
            value={formData.date_debut}
            onChangeText={(text) => setFormData({ ...formData, date_debut: text })}
          />
        </View>

        {/* Durée */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
            Durée (mois)
          </Text>
          <TextInput
            style={{
              backgroundColor: '#1e293b',
              color: '#fff',
              borderRadius: 8,
              paddingHorizontal: 16,
              paddingVertical: 12,
              fontSize: 16,
            }}
            placeholder="12"
            placeholderTextColor="#6b7280"
            value={formData.duree_mois}
            onChangeText={(text) => setFormData({ ...formData, duree_mois: text })}
            keyboardType="numeric"
          />
        </View>

        {/* Montant loyer */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
            Montant du loyer *
          </Text>
          <TextInput
            style={{
              backgroundColor: '#1e293b',
              color: '#fff',
              borderRadius: 8,
              paddingHorizontal: 16,
              paddingVertical: 12,
              fontSize: 16,
            }}
            placeholder="Montant en FCFA"
            placeholderTextColor="#6b7280"
            value={formData.montant_loyer}
            onChangeText={(text) => setFormData({ ...formData, montant_loyer: text })}
            keyboardType="numeric"
          />
        </View>

        {/* Charges */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
            Charges mensuelles
          </Text>
          <TextInput
            style={{
              backgroundColor: '#1e293b',
              color: '#fff',
              borderRadius: 8,
              paddingHorizontal: 16,
              paddingVertical: 12,
              fontSize: 16,
            }}
            placeholder="Montant des charges"
            placeholderTextColor="#6b7280"
            value={formData.charges_mensuelles}
            onChangeText={(text) => setFormData({ ...formData, charges_mensuelles: text })}
            keyboardType="numeric"
          />
        </View>

        {/* Caution */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
            Caution
          </Text>
          <TextInput
            style={{
              backgroundColor: '#1e293b',
              color: '#fff',
              borderRadius: 8,
              paddingHorizontal: 16,
              paddingVertical: 12,
              fontSize: 16,
            }}
            placeholder="Montant de la caution"
            placeholderTextColor="#6b7280"
            value={formData.caution}
            onChangeText={(text) => setFormData({ ...formData, caution: text })}
            keyboardType="numeric"
          />
        </View>

        {/* Conditions spéciales */}
        <View style={{ marginBottom: 32 }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
            Conditions spéciales
          </Text>
          <TextInput
            style={{
              backgroundColor: '#1e293b',
              color: '#fff',
              borderRadius: 8,
              paddingHorizontal: 16,
              paddingVertical: 12,
              fontSize: 16,
              height: 100,
              textAlignVertical: 'top',
            }}
            placeholder="Conditions spéciales du contrat..."
            placeholderTextColor="#6b7280"
            value={formData.conditions_speciales}
            onChangeText={(text) => setFormData({ ...formData, conditions_speciales: text })}
            multiline
          />
        </View>

        {/* Bouton créer */}
        <TouchableOpacity
          onPress={handleCreateContract}
          disabled={loading}
          style={{
            backgroundColor: loading ? '#334155' : '#3b82f6',
            borderRadius: 12,
            paddingVertical: 16,
            alignItems: 'center',
            marginBottom: 32,
          }}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
              Créer le contrat
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};
