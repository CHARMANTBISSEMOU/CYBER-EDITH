import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { contratApi } from '../../services/contratApi';
import { bienApi } from '../../services/bienApi';
import { messageApi } from '../../services/messageApi';

export const CreateContractScreen = ({ navigation }: any) => {
  const [loading, setLoading] = useState(false);
  const [selectBienVisible, setSelectBienVisible] = useState(false);
  const [selectLocataireVisible, setSelectLocataireVisible] = useState(false);
  const [biens, setBiens] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const getTodayFormatted = () => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const [formData, setFormData] = useState({
    id_bien: '',
    id_locataire: '',
    date_debut: getTodayFormatted(),
    duree_mois: '12',
    montant_loyer: '',
    charges_mensuelles: '',
    caution: '',
    conditions_speciales: '',
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [biensRes, convRes] = await Promise.all([
          bienApi.getMyBiens(),
          messageApi.getConversations(),
        ]);
        setBiens(biensRes.biens || []);
        setConversations(convRes.conversations || []);
      } catch (error) {
        console.error('Erreur chargement données contrat:', error);
      }
    };

    loadData();
  }, []);

  const locatairesPourBien = formData.id_bien
    ? conversations.filter((c: any) => c.id_bien === formData.id_bien)
    : [];

  const handleCreateContract = async () => {
    if (!formData.id_bien || !formData.id_locataire || !formData.date_debut || !formData.montant_loyer) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      setLoading(true);
      
      // Valider et parser la date au format JJ/MM/AAAA
      const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
      const match = formData.date_debut.match(dateRegex);
      
      if (!match) {
        Alert.alert('Erreur', 'Format de date invalide. Utilisez le format JJ/MM/AAAA (ex: 24/02/2026)');
        setLoading(false);
        return;
      }
      
      const [, day, month, year] = match;
      const dateDebut = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      
      if (isNaN(dateDebut.getTime())) {
        Alert.alert('Erreur', 'Date invalide');
        setLoading(false);
        return;
      }
      
      // Calculer la date de fin
      const dateFin = new Date(dateDebut);
      dateFin.setMonth(dateFin.getMonth() + parseInt(formData.duree_mois || '12'));
      
      // Formater les dates au format JJ/MM/AAAA pour l'API
      const date_debut_formatted = formData.date_debut;
      const date_fin_formatted = `${String(dateFin.getDate()).padStart(2, '0')}/${String(dateFin.getMonth() + 1).padStart(2, '0')}/${dateFin.getFullYear()}`;
      
      const response = await contratApi.initierContrat(
        formData.id_locataire,
        formData.id_bien,
        parseFloat(formData.montant_loyer),
        date_debut_formatted,
        date_fin_formatted
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
      if (error?.response?.data) {
        try {
          console.error(
            'Erreur création contrat (détail):',
            JSON.stringify(error.response.data, null, 2)
          );
        } catch {
          console.error('Erreur création contrat:', error.response.data);
        }
      } else {
        console.error('Erreur création contrat (sans response.data):', error);
      }

      const rawDetail = error?.response?.data?.detail;
      let message: string | undefined;

      if (typeof rawDetail === 'string') {
        message = rawDetail;
      } else if (Array.isArray(rawDetail) && rawDetail.length > 0) {
        // pydantic-like errors: take first msg
        const first = rawDetail[0];
        if (first?.msg) {
          message = first.msg;
        }
      }

      if (!message) {
        message =
          error?.response?.data?.message ||
          'Impossible de créer le contrat (erreur de validation côté serveur).';
      }

      Alert.alert('Erreur', message);
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
        {/* Sélection du bien */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
            Bien concerné *
          </Text>
          <TouchableOpacity
            onPress={() => setSelectBienVisible(true)}
            style={{
              backgroundColor: '#1e293b',
              borderRadius: 8,
              paddingHorizontal: 16,
              paddingVertical: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text
              style={{
                color: formData.id_bien ? '#fff' : '#6b7280',
                fontSize: 16,
                flex: 1,
              }}
              numberOfLines={1}
            >
              {formData.id_bien
                ? (() => {
                    const bien = biens.find((b: any) => b.id_bien === formData.id_bien);
                    return bien ? `${bien.titre} • ${bien.ville}` : `Bien #${formData.id_bien}`;
                  })()
                : 'Sélectionner un bien parmi vos annonces'}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {/* Sélection du locataire */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
            Locataire *
          </Text>
          <TouchableOpacity
            onPress={() => {
              if (!formData.id_bien) {
                Alert.alert('Information', 'Veuillez d\'abord choisir un bien.');
                return;
              }
              if (locatairesPourBien.length === 0) {
                Alert.alert(
                  'Aucun locataire trouvé',
                  'Aucune conversation n\'a été trouvée pour ce bien. Le locataire doit d\'abord vous contacter depuis la fiche du bien.'
                );
                return;
              }
              setSelectLocataireVisible(true);
            }}
            style={{
              backgroundColor: '#1e293b',
              borderRadius: 8,
              paddingHorizontal: 16,
              paddingVertical: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text
              style={{
                color: formData.id_locataire ? '#fff' : '#6b7280',
                fontSize: 16,
                flex: 1,
              }}
              numberOfLines={1}
            >
              {formData.id_locataire
                ? (() => {
                    const conv = locatairesPourBien.find(
                      (c: any) => c.id_interlocuteur === formData.id_locataire
                    );
                    return conv
                      ? `${conv.nom_interlocuteur} • ${conv.titre_bien || ''}`
                      : `Locataire #${formData.id_locataire}`;
                  })()
                : 'Sélectionner un locataire parmi vos conversations'}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#9ca3af" />
          </TouchableOpacity>
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
      {/* Modal sélection bien */}
      <Modal
        visible={selectBienVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectBienVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(15,23,42,0.9)',
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              backgroundColor: '#020617',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              maxHeight: '70%',
              paddingBottom: 24,
            }}
          >
            <View
              style={{
                paddingHorizontal: 16,
                paddingTop: 16,
                paddingBottom: 8,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>
                Sélectionner un bien
              </Text>
              <TouchableOpacity onPress={() => setSelectBienVisible(false)}>
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={biens}
              keyExtractor={(item) => item.id_bien}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setFormData((prev) => ({
                      ...prev,
                      id_bien: item.id_bien,
                      montant_loyer:
                        prev.montant_loyer || (item.prix_loyer ? String(item.prix_loyer) : ''),
                    }));
                    setSelectBienVisible(false);
                  }}
                  style={{
                    backgroundColor: '#0f172a',
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
                    {item.titre}
                  </Text>
                  <Text style={{ color: '#9ca3af', marginTop: 2 }}>
                    {item.type_bien} • {item.ville}
                  </Text>
                  {item.prix_loyer && (
                    <Text style={{ color: '#10b981', marginTop: 4, fontWeight: '600' }}>
                      {item.prix_loyer.toLocaleString()} FCFA/mois
                    </Text>
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={{ padding: 16 }}>
                  <Text style={{ color: '#9ca3af', textAlign: 'center' }}>
                    Vous n'avez pas encore de biens publiés.
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Modal sélection locataire */}
      <Modal
        visible={selectLocataireVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectLocataireVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(15,23,42,0.9)',
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              backgroundColor: '#020617',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              maxHeight: '70%',
              paddingBottom: 24,
            }}
          >
            <View
              style={{
                paddingHorizontal: 16,
                paddingTop: 16,
                paddingBottom: 8,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>
                Sélectionner un locataire
              </Text>
              <TouchableOpacity onPress={() => setSelectLocataireVisible(false)}>
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={locatairesPourBien}
              keyExtractor={(item, index) =>
                `${item.id_interlocuteur}-${item.id_bien}-${index}`
              }
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setFormData((prev) => ({
                      ...prev,
                      id_locataire: item.id_interlocuteur,
                    }));
                    setSelectLocataireVisible(false);
                  }}
                  style={{
                    backgroundColor: '#0f172a',
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
                    {item.nom_interlocuteur}
                  </Text>
                  {item.titre_bien && (
                    <Text style={{ color: '#9ca3af', marginTop: 2 }}>{item.titre_bien}</Text>
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={{ padding: 16 }}>
                  <Text style={{ color: '#9ca3af', textAlign: 'center' }}>
                    Aucune conversation trouvée pour ce bien.
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};
