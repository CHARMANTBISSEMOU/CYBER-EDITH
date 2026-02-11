import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '../../components/ScreenHeader';
import { contratApi } from '../../services/contratApi';
import { useAuthStore } from '../../store/authStore';

export const ContractDetailScreen = ({ route, navigation }: any) => {
  const { id_contrat } = route.params;
  const { user } = useAuthStore();
  const [contrat, setContrat] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [contenu, setContenu] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadContrat();
  }, [id_contrat]);

  const loadContrat = async () => {
    try {
      setLoading(true);
      const response = await contratApi.getContrat(id_contrat);
      setContrat(response);
      setContenu(response.contenu || '');
    } catch (error: any) {
      console.error('Erreur chargement contrat:', error);
      Alert.alert('Erreur', 'Impossible de charger le contrat');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handlePersonnaliser = async () => {
    if (!contenu.trim()) {
      Alert.alert('Erreur', 'Le contenu ne peut pas être vide');
      return;
    }

    try {
      setActionLoading(true);
      await contratApi.personnaliserContrat(id_contrat, contenu);
      Alert.alert('Succès', 'Contrat personnalisé avec succès');
      setEditing(false);
      loadContrat();
    } catch (error: any) {
      Alert.alert('Erreur', error.response?.data?.detail || 'Impossible de personnaliser le contrat');
    } finally {
      setActionLoading(false);
    }
  };

  const handleValider = () => {
    Alert.alert(
      'Valider le contrat',
      'Êtes-vous sûr de vouloir valider ce contrat ? Un PDF sera généré et envoyé au locataire.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Valider',
          onPress: async () => {
            try {
              setActionLoading(true);
              await contratApi.validerContrat(id_contrat);
              Alert.alert('Succès', 'Contrat validé et PDF généré');
              loadContrat();
            } catch (error: any) {
              Alert.alert('Erreur', error.response?.data?.detail || 'Impossible de valider le contrat');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleAccepter = () => {
    Alert.alert(
      'Accepter le contrat',
      'Êtes-vous sûr de vouloir accepter ce contrat de location ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Accepter',
          style: 'default',
          onPress: async () => {
            try {
              setActionLoading(true);
              await contratApi.accepterContrat(id_contrat);
              Alert.alert('Succès', 'Contrat accepté ! Il est maintenant actif.');
              loadContrat();
            } catch (error: any) {
              Alert.alert('Erreur', error.response?.data?.detail || 'Impossible d\'accepter le contrat');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleRefuser = () => {
    Alert.alert(
      'Refuser le contrat',
      'Êtes-vous sûr de vouloir refuser ce contrat ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Refuser',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              await contratApi.refuserContrat(id_contrat);
              Alert.alert('Contrat refusé', 'Le propriétaire en sera informé.');
              navigation.goBack();
            } catch (error: any) {
              Alert.alert('Erreur', error.response?.data?.detail || 'Impossible de refuser le contrat');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleResilier = () => {
    Alert.alert(
      'Résilier le contrat',
      'Êtes-vous sûr de vouloir résilier ce contrat actif ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Résilier',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              await contratApi.resilierContrat(id_contrat);
              Alert.alert('Succès', 'Contrat résilié');
              loadContrat();
            } catch (error: any) {
              Alert.alert('Erreur', error.response?.data?.detail || 'Impossible de résilier le contrat');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleDownloadPDF = async () => {
    try {
      const response = await contratApi.getContratPDF(id_contrat);
      if (response.url_pdf) {
        Linking.openURL(response.url_pdf);
      }
    } catch (error: any) {
      Alert.alert('Erreur', 'Impossible de télécharger le PDF');
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
        <ScreenHeader title="Détails du contrat" onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </View>
    );
  }

  if (!contrat) return null;

  const isProprietaire = contrat.role === 'proprietaire';
  const isLocataire = contrat.role === 'locataire';
  const canEdit = isProprietaire && contrat.statut === 'brouillon';
  const canValidate = isProprietaire && contrat.statut === 'brouillon';
  const canAccept = isLocataire && contrat.statut === 'en_attente';
  const canRefuse = isLocataire && contrat.statut === 'en_attente';
  const canResilier = contrat.statut === 'actif';

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <ScreenHeader title="Détails du contrat" onBack={() => navigation.goBack()} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        {/* Informations du contrat */}
        <View style={{ backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 12 }}>
            {contrat.titre_bien}
          </Text>

          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: '#9ca3af' }}>Statut</Text>
              <Text style={{ color: '#fff', fontWeight: '600' }}>{contrat.statut}</Text>
            </View>

            {contrat.montant_loyer && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: '#9ca3af' }}>Loyer mensuel</Text>
                <Text style={{ color: '#10b981', fontWeight: '700' }}>
                  {contrat.montant_loyer.toLocaleString()} FCFA
                </Text>
              </View>
            )}

            {contrat.date_debut && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: '#9ca3af' }}>Date de début</Text>
                <Text style={{ color: '#fff' }}>
                  {new Date(contrat.date_debut).toLocaleDateString('fr-FR')}
                </Text>
              </View>
            )}

            {contrat.duree_mois && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: '#9ca3af' }}>Durée</Text>
                <Text style={{ color: '#fff' }}>{contrat.duree_mois} mois</Text>
              </View>
            )}
          </View>
        </View>

        {/* Contenu du contrat */}
        <View style={{ backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>Contenu du contrat</Text>
            {canEdit && !editing && (
              <TouchableOpacity onPress={() => setEditing(true)}>
                <Ionicons name="create-outline" size={24} color="#3b82f6" />
              </TouchableOpacity>
            )}
          </View>

          {editing ? (
            <View>
              <TextInput
                value={contenu}
                onChangeText={setContenu}
                multiline
                numberOfLines={15}
                style={{
                  backgroundColor: '#0f172a',
                  color: '#fff',
                  borderRadius: 8,
                  padding: 12,
                  minHeight: 300,
                  textAlignVertical: 'top',
                  fontSize: 14,
                  lineHeight: 20,
                }}
                placeholder="Contenu du contrat..."
                placeholderTextColor="#64748b"
              />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <TouchableOpacity
                  onPress={() => {
                    setEditing(false);
                    setContenu(contrat.contenu || '');
                  }}
                  style={{
                    flex: 1,
                    backgroundColor: '#334155',
                    padding: 12,
                    borderRadius: 8,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '600' }}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handlePersonnaliser}
                  disabled={actionLoading}
                  style={{
                    flex: 1,
                    backgroundColor: '#3b82f6',
                    padding: 12,
                    borderRadius: 8,
                    alignItems: 'center',
                  }}
                >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: '600' }}>Enregistrer</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <Text style={{ color: '#9ca3af', fontSize: 14, lineHeight: 22 }}>
              {contrat.contenu || 'Aucun contenu disponible'}
            </Text>
          )}
        </View>

        {/* Bouton PDF */}
        {contrat.url_pdf && (
          <TouchableOpacity
            onPress={handleDownloadPDF}
            style={{
              backgroundColor: '#1e293b',
              borderRadius: 12,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <Ionicons name="document-text" size={24} color="#3b82f6" />
            <Text style={{ color: '#3b82f6', fontSize: 16, fontWeight: '600', marginLeft: 8 }}>
              Télécharger le PDF
            </Text>
          </TouchableOpacity>
        )}

        {/* Actions */}
        <View style={{ gap: 12, marginBottom: 24 }}>
          {canValidate && (
            <TouchableOpacity
              onPress={handleValider}
              disabled={actionLoading}
              style={{
                backgroundColor: '#10b981',
                padding: 16,
                borderRadius: 12,
                alignItems: 'center',
              }}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
                  Valider et générer le PDF
                </Text>
              )}
            </TouchableOpacity>
          )}

          {canAccept && (
            <TouchableOpacity
              onPress={handleAccepter}
              disabled={actionLoading}
              style={{
                backgroundColor: '#10b981',
                padding: 16,
                borderRadius: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
                Accepter le contrat
              </Text>
            </TouchableOpacity>
          )}

          {canRefuse && (
            <TouchableOpacity
              onPress={handleRefuser}
              disabled={actionLoading}
              style={{
                backgroundColor: '#ef4444',
                padding: 16,
                borderRadius: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
                Refuser le contrat
              </Text>
            </TouchableOpacity>
          )}

          {canResilier && (
            <TouchableOpacity
              onPress={handleResilier}
              disabled={actionLoading}
              style={{
                backgroundColor: '#ef4444',
                padding: 16,
                borderRadius: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
                Résilier le contrat
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
};
