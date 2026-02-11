import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '../../components/ScreenHeader';
import * as Location from 'expo-location';

export const NavigationScreen = ({ route, navigation }: any) => {
  const { bien } = route.params;
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'La permission de localisation est requise pour afficher l\'itinéraire');
        navigation.goBack();
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const userCoords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setUserLocation(userCoords);
    } catch (error) {
      console.error('Erreur de localisation:', error);
      Alert.alert('Erreur', 'Impossible d\'obtenir votre position');
    } finally {
      setLoading(false);
    }
  };

  const openGoogleMaps = () => {
    if (!userLocation || !bien.latitude || !bien.longitude) {
      Alert.alert('Erreur', 'Coordonnées du bien non disponibles');
      return;
    }

    const url = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.latitude},${userLocation.longitude}&destination=${bien.latitude},${bien.longitude}&travelmode=driving`;
    Linking.openURL(url);
  };

  const openWaze = () => {
    if (!userLocation || !bien.latitude || !bien.longitude) {
      Alert.alert('Erreur', 'Coordonnées du bien non disponibles');
      return;
    }

    const url = `https://waze.com/ul?ll=${bien.latitude},${bien.longitude}&navigate=yes`;
    Linking.openURL(url);
  };

  const openMaps = () => {
    if (!userLocation || !bien.latitude || !bien.longitude) {
      Alert.alert('Erreur', 'Coordonnées du bien non disponibles');
      return;
    }

    // Pour iOS/Android Maps natif
    const url = Platform.select({
      ios: `maps://app?daddr=${bien.latitude},${bien.longitude}`,
      android: `google.navigation:q=${bien.latitude},${bien.longitude}`,
    });

    if (url) {
      Linking.openURL(url);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={{ color: '#9ca3af', marginTop: 16 }}>Obtention de votre position...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <ScreenHeader title="Itinéraire" onBack={() => navigation.goBack()} />

      {/* Image statique de carte */}
      <View style={{ flex: 1, position: 'relative' }}>
        <Image
          source={{ 
            uri: `https://maps.googleapis.com/maps/api/staticmap?center=${bien.latitude || 3.848032},${bien.longitude || 11.502075}&zoom=15&size=600x400&maptype=roadmap&markers=color:blue%7C${bien.latitude || 3.848032},${bien.longitude || 11.502075}&key=YOUR_API_KEY`
          }}
          style={{ flex: 1, width: '100%', height: '100%' }}
          resizeMode="cover"
          defaultSource={{ uri: 'https://picsum.photos/seed/map-placeholder/600/400.jpg' }}
        />
        
        {/* Overlay avec informations */}
        <View style={styles.mapOverlay}>
          <View style={styles.locationCard}>
            <View style={styles.locationHeader}>
              <Ionicons name="home" size={24} color="#10b981" />
              <Text style={styles.locationTitle}>{bien.titre}</Text>
            </View>
            <View style={styles.locationInfo}>
              <Ionicons name="location" size={16} color="#3b82f6" />
              <Text style={styles.locationText}>{bien.quartier}, {bien.ville}</Text>
            </View>
            {userLocation && (
              <View style={styles.locationInfo}>
                <Ionicons name="person" size={16} color="#64748b" />
                <Text style={styles.locationText}>
                  Distance: ~{calculateDistance(userLocation, {
                    latitude: bien.latitude || 3.848032,
                    longitude: bien.longitude || 11.502075,
                  })} km
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Options de navigation */}
      <View style={styles.navigationOptions}>
        <TouchableOpacity style={[styles.navButton, styles.googleMaps]} onPress={openGoogleMaps}>
          <Ionicons name="map" size={24} color="#fff" />
          <Text style={styles.navButtonText}>Google Maps</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.navButton, styles.waze]} onPress={openWaze}>
          <Ionicons name="car" size={24} color="#fff" />
          <Text style={styles.navButtonText}>Waze</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.navButton, styles.maps]} onPress={openMaps}>
          <Ionicons name="navigate" size={24} color="#fff" />
          <Text style={styles.navButtonText}>Maps</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const calculateDistance = (start: { latitude: number; longitude: number }, end: { latitude: number; longitude: number }): string => {
  const R = 6371; // Rayon de la Terre en km
  const dLat = (end.latitude - start.latitude) * Math.PI / 180;
  const dLon = (end.longitude - start.longitude) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(start.latitude * Math.PI / 180) * Math.cos(end.latitude * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  return distance.toFixed(1);
};

const styles = StyleSheet.create({
  mapOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    padding: 20,
  },
  locationCard: {
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  locationTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  navigationOptions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#0f172a',
  },
  navButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  googleMaps: {
    backgroundColor: '#4285F4',
  },
  waze: {
    backgroundColor: '#33CCFF',
  },
  maps: {
    backgroundColor: '#1e293b',
  },
  navButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});
