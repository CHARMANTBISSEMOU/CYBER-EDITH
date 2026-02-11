import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { geoApi } from '../../services/geoApi';

export const GpsAntiCheatingScreen = ({ navigation }: any) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<any>(null);
  const [detections, setDetections] = useState<any[]>([]);
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statusRes, detectionsRes] = await Promise.all([
        geoApi.getStatut(),
        geoApi.getMesDetections(),
      ]);
      setGpsStatus(statusRes);
      setDetections(detectionsRes.detections || []);
    } catch (error: any) {
      console.error('Erreur chargement GPS:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Impossible de charger les données GPS';
      Alert.alert('Erreur GPS', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleRecordPosition = async () => {
    try {
      setRecording(true);
      
      // Demander la permission de localisation
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'Vous devez autoriser la localisation');
        return;
      }

      // Obtenir la position actuelle
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      // Enregistrer la position
      await geoApi.enregistrerPosition(
        location.coords.latitude,
        location.coords.longitude
      );

      Alert.alert('Succès', 'Position enregistrée avec succès');
      loadData();
    } catch (error: any) {
      console.error('Erreur enregistrement position:', error);
      Alert.alert('Erreur', 'Impossible d\'enregistrer la position');
    } finally {
      setRecording(false);
    }
  };

  const handleConfirmDetection = async (id: string) => {
    Alert.alert(
      'Confirmer la détection',
      'Confirmez-vous que vous étiez bien à cet endroit ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            try {
              await geoApi.confirmerDetection(id);
              Alert.alert('Succès', 'Détection confirmée');
              loadData();
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de confirmer la détection');
            }
          },
        },
      ]
    );
  };

  const handleContestDetection = async (id: string) => {
    Alert.alert(
      'Contester la détection',
      'Pourquoi contestez-vous cette détection ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Erreur GPS',
          onPress: async () => {
            try {
              await geoApi.contesterDetection(id, 'Erreur GPS');
              Alert.alert('Succès', 'Détection contestée');
              loadData();
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de contester la détection');
            }
          },
        },
        {
          text: 'Autre raison',
          onPress: async () => {
            try {
              await geoApi.contesterDetection(id, 'Autre raison');
              Alert.alert('Succès', 'Détection contestée');
              loadData();
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de contester la détection');
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (statut: string) => {
    switch (statut) {
      case 'conforme': return '#10b981';
      case 'alerte': return '#f59e0b';
      case 'non_conforme': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getDetectionStatusColor = (statut: string) => {
    switch (statut) {
      case 'en_attente': return '#f59e0b';
      case 'confirmee': return '#10b981';
      case 'contestee': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16, backgroundColor: '#1e293b' }}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700', marginTop: 16 }}>
            GPS Anti-Triche
          </Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
      {/* En-tête */}
      <View style={{ paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16, backgroundColor: '#1e293b' }}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700', marginTop: 16 }}>
          GPS Anti-Triche
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
      >
        {/* Statut GPS */}
        {gpsStatus && (
          <View style={{ backgroundColor: '#1e293b', borderRadius: 16, padding: 20, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: `${getStatusColor(gpsStatus.statut)}20`,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <Ionicons name="location" size={24} color={getStatusColor(gpsStatus.statut)} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>
                  Statut GPS
                </Text>
                <Text style={{ color: getStatusColor(gpsStatus.statut), fontSize: 14, marginTop: 4 }}>
                  {gpsStatus.statut === 'conforme' && 'Conforme'}
                  {gpsStatus.statut === 'alerte' && 'Alerte'}
                  {gpsStatus.statut === 'non_conforme' && 'Non conforme'}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
              <View>
                <Text style={{ color: '#9ca3af', fontSize: 13 }}>Positions enregistrées</Text>
                <Text style={{ color: '#fff', fontSize: 20, fontWeight: '600', marginTop: 4 }}>
                  {gpsStatus.total_positions || 0}
                </Text>
              </View>
              <View>
                <Text style={{ color: '#9ca3af', fontSize: 13 }}>Détections</Text>
                <Text style={{ color: '#fff', fontSize: 20, fontWeight: '600', marginTop: 4 }}>
                  {gpsStatus.total_detections || 0}
                </Text>
              </View>
              <View>
                <Text style={{ color: '#9ca3af', fontSize: 13 }}>En attente</Text>
                <Text style={{ color: '#f59e0b', fontSize: 20, fontWeight: '600', marginTop: 4 }}>
                  {gpsStatus.detections_en_attente || 0}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Bouton Enregistrer Position */}
        <TouchableOpacity
          onPress={handleRecordPosition}
          disabled={recording}
          style={{
            backgroundColor: '#3b82f6',
            borderRadius: 12,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
          }}
        >
          {recording ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="location-sharp" size={24} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 }}>
                Enregistrer ma position
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Liste des détections */}
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 16 }}>
          Détections récentes
        </Text>

        {detections.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <Ionicons name="checkmark-circle-outline" size={64} color="#334155" />
            <Text style={{ color: '#9ca3af', fontSize: 16, marginTop: 16, textAlign: 'center' }}>
              Aucune détection
            </Text>
          </View>
        ) : (
          detections.map((detection) => (
            <View
              key={detection.id_detection}
              style={{
                backgroundColor: '#1e293b',
                borderRadius: 12,
                padding: 16,
                marginBottom: 12,
                borderLeftWidth: 4,
                borderLeftColor: getDetectionStatusColor(detection.statut),
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
                    {detection.bien?.titre || 'Bien détecté'}
                  </Text>
                  <Text style={{ color: '#9ca3af', fontSize: 13, marginTop: 4 }}>
                    {formatDate(detection.date_detection)}
                  </Text>
                </View>
                <View
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 12,
                    backgroundColor: `${getDetectionStatusColor(detection.statut)}20`,
                  }}
                >
                  <Text style={{ color: getDetectionStatusColor(detection.statut), fontSize: 12, fontWeight: '600' }}>
                    {detection.statut === 'en_attente' && 'En attente'}
                    {detection.statut === 'confirmee' && 'Confirmée'}
                    {detection.statut === 'contestee' && 'Contestée'}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', marginBottom: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#9ca3af', fontSize: 13 }}>Frais de détection</Text>
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginTop: 4 }}>
                    {detection.frais_detection?.toLocaleString()} FCFA
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#9ca3af', fontSize: 13 }}>Distance</Text>
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginTop: 4 }}>
                    {detection.distance_metres ? `${Math.round(detection.distance_metres)}m` : 'N/A'}
                  </Text>
                </View>
              </View>

              {detection.statut === 'en_attente' && (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => handleConfirmDetection(detection.id_detection)}
                    style={{
                      flex: 1,
                      backgroundColor: '#10b981',
                      borderRadius: 8,
                      padding: 12,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
                      Confirmer
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleContestDetection(detection.id_detection)}
                    style={{
                      flex: 1,
                      backgroundColor: '#ef4444',
                      borderRadius: 8,
                      padding: 12,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
                      Contester
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {detection.raison_contestation && (
                <View style={{ marginTop: 12, padding: 12, backgroundColor: '#0f172a', borderRadius: 8 }}>
                  <Text style={{ color: '#9ca3af', fontSize: 12 }}>Raison de contestation:</Text>
                  <Text style={{ color: '#fff', fontSize: 14, marginTop: 4 }}>
                    {detection.raison_contestation}
                  </Text>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};
