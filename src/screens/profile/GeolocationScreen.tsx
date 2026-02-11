import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Switch, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScreenHeader } from '../../components/ScreenHeader';

export const GeolocationScreen = ({ navigation }: any) => {
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    loadGPSPreference();
  }, []);

  const loadGPSPreference = async () => {
    try {
      const saved = await AsyncStorage.getItem('gps_enabled');
      if (saved !== null) {
        const enabled = saved === 'true';
        setGpsEnabled(enabled);
        if (enabled) {
          await requestLocationPermission();
        }
      }
    } catch (error) {
      console.error('Erreur chargement préférence GPS:', error);
    } finally {
      setLoading(false);
    }
  };

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Permission de localisation refusée');
        return false;
      }
      
      const location = await Location.getCurrentPositionAsync({});
      setCurrentLocation(location);
      setLocationError(null);
      return true;
    } catch (error) {
      setLocationError('Impossible d\'obtenir la position');
      return false;
    }
  };

  const handleToggleGPS = async (value: boolean) => {
    if (value) {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        Alert.alert(
          'Permission requise',
          'L\'application a besoin d\'accéder à votre position pour activer le GPS.',
          [{ text: 'OK' }]
        );
        return;
      }
    } else {
      setCurrentLocation(null);
      setLocationError(null);
    }
    
    setGpsEnabled(value);
    await AsyncStorage.setItem('gps_enabled', value.toString());
    
    Alert.alert(
      value ? 'GPS activé' : 'GPS désactivé',
      value 
        ? 'Votre position sera suivie pour éviter les frais supplémentaires.'
        : 'Vous devrez payer des frais si vous trouvez un bien via l\'app.',
      [{ text: 'OK' }]
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <ScreenHeader title="Géolocalisation" onBack={() => navigation.goBack()} />
      
      <ScrollView style={{ flex: 1 }}>
        <View style={{ padding: 16 }}>
          {/* Toggle GPS */}
          <View style={{ 
            flexDirection: 'row', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            backgroundColor: '#1e293b', 
            padding: 16, 
            borderRadius: 12, 
            marginBottom: 16 
          }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 }}>
                Activer le GPS
              </Text>
              <Text style={{ color: '#9ca3af', fontSize: 14 }}>
                Évite les frais de service de 5 000 FCFA
              </Text>
            </View>
            <Switch
              value={gpsEnabled}
              onValueChange={handleToggleGPS}
              trackColor={{ false: '#374151', true: '#3b82f6' }}
              thumbColor={gpsEnabled ? '#fff' : '#9ca3af'}
            />
          </View>

          {/* Position actuelle */}
          {gpsEnabled && currentLocation && (
            <View style={{ backgroundColor: '#1e293b', padding: 16, borderRadius: 12, marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Ionicons name="location" size={24} color="#3b82f6" />
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 }}>
                  Position actuelle
                </Text>
              </View>
              <View style={{ marginLeft: 32 }}>
                <Text style={{ color: '#9ca3af', fontSize: 14, marginBottom: 4 }}>
                  Latitude: {currentLocation.coords.latitude.toFixed(6)}
                </Text>
                <Text style={{ color: '#9ca3af', fontSize: 14, marginBottom: 4 }}>
                  Longitude: {currentLocation.coords.longitude.toFixed(6)}
                </Text>
                <Text style={{ color: '#9ca3af', fontSize: 14 }}>
                  Précision: ±{currentLocation.coords.accuracy?.toFixed(0)}m
                </Text>
              </View>
            </View>
          )}

          {/* Erreur de localisation */}
          {gpsEnabled && locationError && (
            <View style={{ backgroundColor: '#dc2626', padding: 16, borderRadius: 12, marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="warning" size={24} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 14, marginLeft: 8, flex: 1 }}>
                  {locationError}
                </Text>
              </View>
            </View>
          )}

          {/* Informations */}
          <View style={{ backgroundColor: '#1e293b', padding: 16, borderRadius: 12 }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 12 }}>
              💡 Pourquoi activer le GPS ?
            </Text>
            
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: '#3b82f6', fontSize: 15, fontWeight: '600', marginBottom: 8 }}>
                ✅ GPS activé = GRATUIT
              </Text>
              <Text style={{ color: '#9ca3af', fontSize: 14, lineHeight: 22 }}>
                • L'app suit votre position{'\n'}
                • Vous trouvez un bien dans l'app{'\n'}
                • Vous visitez le bien{'\n'}
                • <Text style={{ color: '#10b981', fontWeight: '600' }}>→ Aucun frais à payer !</Text>
              </Text>
            </View>

            <View style={{ paddingTop: 16, borderTopWidth: 1, borderTopColor: '#334155' }}>
              <Text style={{ color: '#dc2626', fontSize: 15, fontWeight: '600', marginBottom: 8 }}>
                ❌ GPS désactivé = 5 000 FCFA
              </Text>
              <Text style={{ color: '#9ca3af', fontSize: 14, lineHeight: 22 }}>
                • Vous trouvez un bien dans l'app{'\n'}
                • Vous visitez le bien{'\n'}
                • <Text style={{ color: '#dc2626', fontWeight: '600' }}>→ Vous payez 5 000 FCFA de frais</Text>
              </Text>
            </View>

            <View style={{ marginTop: 16, padding: 12, backgroundColor: '#334155', borderRadius: 8 }}>
              <Text style={{ color: '#fbbf24', fontSize: 13, fontWeight: '600', marginBottom: 4 }}>
                ⚠️ Important
              </Text>
              <Text style={{ color: '#d1d5db', fontSize: 13, lineHeight: 18 }}>
                Le GPS permet de vérifier que vous avez bien trouvé le bien via notre application. C'est notre système anti-triche.
              </Text>
            </View>
          </View>

          {/* Note de confidentialité */}
          <View style={{ marginTop: 16, padding: 16, backgroundColor: '#1e293b', borderRadius: 12, borderLeftWidth: 4, borderLeftColor: '#3b82f6' }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <Ionicons name="shield-checkmark" size={20} color="#3b82f6" style={{ marginTop: 2 }} />
              <Text style={{ color: '#9ca3af', fontSize: 13, lineHeight: 18, marginLeft: 8, flex: 1 }}>
                Vos données de localisation sont sécurisées et utilisées uniquement pour le système anti-triche. 
                Elles sont supprimées automatiquement après 35 jours.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};
