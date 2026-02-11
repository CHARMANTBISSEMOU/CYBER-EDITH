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
  Modal,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'expo-camera';
import * as Location from 'expo-location';
import { bienApi } from '../../services/bienApi';
import { mediaApi } from '../../services/mediaApi';

const TYPES_BIEN = [
  { value: 'appartement', label: 'Appartement' },
  { value: 'studio', label: 'Studio' },
  { value: 'maison', label: 'Maison' },
  { value: 'chambre', label: 'Chambre' },
  { value: 'bureau', label: 'Bureau' },
  { value: 'terrain', label: 'Terrain' },
  { value: 'magasin', label: 'Magasin' },
];

export const AddBienScreen = ({ navigation }: any) => {
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  
  // Champs du formulaire
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [typeBien, setTypeBien] = useState('appartement');
  const [ville, setVille] = useState('');
  const [quartier, setQuartier] = useState('');
  const [adresseComplete, setAdresseComplete] = useState('');
  const [prixLoyer, setPrixLoyer] = useState('');
  const [prixVente, setPrixVente] = useState('');
  const [superficie, setSuperficie] = useState('');
  const [nombreChambres, setNombreChambres] = useState('');
  const [nombreSallesBain, setNombreSallesBain] = useState('');
  const [nombrePieces, setNombrePieces] = useState('');
  const [meuble, setMeuble] = useState(false);

  // États pour la localisation GPS
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [detectedVille, setDetectedVille] = useState('');
  const [detectedQuartier, setDetectedQuartier] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [mapVisible, setMapVisible] = useState(false);
  const [userExplicitlyUsedGPS, setUserExplicitlyUsedGPS] = useState(false);
  const [gpsAutoFilled, setGpsAutoFilled] = useState(false);

  // Fonctions de localisation
  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    try {
      setLocationLoading(true);
      setLocationError('');
      
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Permission de localisation refusée');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setCurrentLocation(coords);
      
      // Reverse geocoding pour obtenir ville et quartier
      await reverseGeocode(coords);
    } catch (error) {
      console.error('Erreur localisation:', error);
      setLocationError('Impossible d\'obtenir votre position');
    } finally {
      setLocationLoading(false);
    }
  };

  const reverseGeocode = async (coords: { latitude: number; longitude: number }) => {
    try {
      console.log('🔍 Tentative reverse geocoding pour:', coords);
      
      // Utiliser l'API de géocodage inversé de OpenStreetMap (gratuite)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}&accept-language=fr`,
        {
          headers: {
            'User-Agent': 'MobileApp/1.0', // Éviter le blocage
          },
        }
      );

      console.log('📡 Status réponse:', response.status);
      console.log('📡 Content-Type:', response.headers.get('content-type'));

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();
      console.log('📄 Réponse brute (premiers 200 chars):', text.substring(0, 200));

      // Vérifier si la réponse est du HTML (erreur serveur)
      if (text.trim().startsWith('<')) {
        throw new Error('L\'API retourne du HTML au lieu du JSON (serveur indisponible)');
      }

      const data = JSON.parse(text);

      if (data && data.address) {
        const address = data.address;
        const city = address.city || address.town || address.village || address.county || '';
        const suburb = address.suburb || address.neighbourhood || address.district || '';

        setDetectedVille(city);
        setDetectedQuartier(suburb);

        // Remplir automatiquement les champs si vides
        const villeWasEmpty = !ville.trim();
        const quartierWasEmpty = !quartier.trim();
        
        if (villeWasEmpty) setVille(city);
        if (quartierWasEmpty) setQuartier(suburb);

        // Marquer que le GPS a rempli automatiquement les champs
        if (villeWasEmpty || quartierWasEmpty) {
          setGpsAutoFilled(true);
          console.log('🤖 GPS a rempli automatiquement les champs');
        }

        console.log('✅ Localisation détectée:', { city, suburb, coords, autoFilled: villeWasEmpty || quartierWasEmpty });
      } else {
        throw new Error('Aucune adresse trouvée dans la réponse');
      }
    } catch (error) {
      console.error('❌ Erreur reverse geocoding:', error);
      
      // Fallback : utiliser des coordonnées par défaut pour les grandes villes camerounaises
      const fallbackLocation = getFallbackLocation(coords);
      setDetectedVille(fallbackLocation.city);
      setDetectedQuartier(fallbackLocation.quartier);
      
      const villeWasEmpty = !ville.trim();
      const quartierWasEmpty = !quartier.trim();
      
      if (villeWasEmpty) setVille(fallbackLocation.city);
      if (quartierWasEmpty) setQuartier(fallbackLocation.quartier);

      // Marquer que le GPS a rempli automatiquement les champs
      if (villeWasEmpty || quartierWasEmpty) {
        setGpsAutoFilled(true);
        console.log('🤖 GPS (fallback) a rempli automatiquement les champs');
      }

      setLocationError(`Réseau faible. Localisation estimée: ${fallbackLocation.city}, ${fallbackLocation.quartier}`);
      
      console.log('🔄 Fallback utilisé:', fallbackLocation);
    }
  };

  const getFallbackLocation = (coords: { latitude: number; longitude: number }) => {
    // Coordonnées approximatives des grandes villes camerounaises
    const cities = [
      { name: 'Douala', lat: 3.848032, lon: 11.502075, quartier: 'Bonamoussadi' },
      { name: 'Yaoundé', lat: 3.848032, lon: 11.502075, quartier: 'Bastos' },
      { name: 'Bafoussam', lat: 5.483333, lon: 10.416667, quartier: 'Centre-ville' },
      { name: 'Garoua', lat: 9.300000, lon: 13.383333, quartier: 'Centre-ville' },
      { name: 'Maroua', lat: 10.591111, lon: 14.315833, quartier: 'Centre-ville' },
      { name: 'Bamenda', lat: 5.964167, lon: 10.152500, quartier: 'Commercial Avenue' },
      { name: 'Ngaoundéré', lat: 7.316667, lon: 13.583333, quartier: 'Centre-ville' },
      { name: 'Kumba', lat: 4.633333, lon: 9.450000, quartier: 'Fiango' },
      { name: 'Limbe', lat: 4.016667, lon: 9.200000, quartier: 'Down Beach' },
      { name: 'Buea', lat: 4.150000, lon: 9.233333, quartier: 'Molyko' },
    ];

    // Trouver la ville la plus proche
    let closestCity = cities[0];
    let minDistance = Infinity;

    for (const city of cities) {
      const distance = calculateDistance(coords, { latitude: city.lat, longitude: city.lon });
      if (distance < minDistance) {
        minDistance = distance;
        closestCity = city;
      }
    }

    return {
      city: closestCity.name,
      quartier: closestCity.quartier,
    };
  };

  const calculateDistance = (point1: { latitude: number; longitude: number }, point2: { latitude: number; longitude: number }): number => {
    const R = 6371; // Rayon de la Terre en km
    const dLat = (point2.latitude - point1.latitude) * Math.PI / 180;
    const dLon = (point2.longitude - point1.longitude) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(point1.latitude * Math.PI / 180) * Math.cos(point2.latitude * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const validateLocationConsistency = () => {
    if (!currentLocation) {
      return { valid: true, message: '' }; // Pas de GPS, pas de validation
    }

    const enteredVille = ville.trim().toLowerCase();
    const enteredQuartier = quartier.trim().toLowerCase();
    const detectedVilleLower = detectedVille.toLowerCase();
    const detectedQuartierLower = detectedQuartier.toLowerCase();

    console.log('🔍 Validation localisation - DÉTAILS COMPLETS:');
    console.log('📍 GPS détecté:', { detectedVille, detectedQuartier });
    console.log('📝 Champs formulaire:', { ville, quartier });
    console.log('🔄 États GPS:', { userExplicitlyUsedGPS, gpsAutoFilled });
    console.log('📏 Comparaison:');
    console.log(`  - Ville: "${enteredVille}" vs "${detectedVilleLower}"`);
    console.log(`  - Quartier: "${enteredQuartier}" vs "${detectedQuartierLower}"`);

    // 🛡️ SÉCURITÉ: Vérifier la distance entre le lieu entré et le GPS
    const distanceValidation = validateDistanceSecurity();
    if (!distanceValidation.valid) {
      return distanceValidation;
    }

    // Si l'utilisateur a explicitement utilisé le GPS ou si le GPS a rempli automatiquement les champs, accepter directement
    if (userExplicitlyUsedGPS || gpsAutoFilled) {
      console.log('✅ Validation acceptée - GPS utilisé:', { 
        explicit: userExplicitlyUsedGPS, 
        autoFilled: gpsAutoFilled 
      });
      return { valid: true, message: '' };
    }

    // Vérifier si l'utilisateur a déjà fait une correction manuelle
    const hasManualCorrection = 
      detectedVille.toLowerCase() !== ville.toLowerCase() || 
      detectedQuartier.toLowerCase() !== quartier.toLowerCase();

    // Si l'utilisateur a fait une correction manuelle, on la accepte
    if (hasManualCorrection) {
      console.log('🎯 Correction manuelle détectée, validation acceptée');
      return { valid: true, message: '' };
    }

    // Vérifier la cohérence (tolérance de fautes de frappe)
    const villeMatch = enteredVille.includes(detectedVilleLower) || 
                      detectedVilleLower.includes(enteredVille) ||
                      calculateSimilarity(enteredVille, detectedVilleLower) > 0.7;

    const quartierMatch = enteredQuartier.includes(detectedQuartierLower) || 
                         detectedQuartierLower.includes(enteredQuartier) ||
                         calculateSimilarity(enteredQuartier, detectedQuartierLower) > 0.6;

    if (!villeMatch || !quartierMatch) {
      return {
        valid: false,
        message: `📍 Le GPS indique: ${detectedVille}, ${detectedQuartier}\n\n📝 Votre saisie: ${ville}, ${quartier}\n\n🎯 Options:\n• Utiliser la position GPS\n• Corriger manuellement dans la section "Localisation manuelle"`
      };
    }

    return { valid: true, message: '' };
  };

  const validateDistanceSecurity = () => {
    // 🛡️ CONTOURNER: Si l'utilisateur a explicitement utilisé le GPS, ne pas vérifier la distance
    if (userExplicitlyUsedGPS) {
      console.log('🛡️ Sécurité distance contournée - Utilisateur a explicitement utilisé le GPS');
      return { valid: true, message: '' };
    }

    // Obtenir les coordonnées du lieu entré
    const enteredCoords = getCoordinatesForLocation(ville.trim(), quartier.trim());

    // Calculer la distance entre GPS et lieu entré
    const distance = calculateDistance(currentLocation!, enteredCoords);
    const maxAllowedDistance = 15; // 15 km maximum pour la sécurité (adapté aux villes camerounaises)

    console.log(`🛡️ Sécurité: Distance GPS - Lieu entré: ${distance.toFixed(2)} km`);
    console.log(`🛡️ Limite de sécurité: ${distance.toFixed(2)} km / ${maxAllowedDistance} km`);

    if (distance > maxAllowedDistance) {
      return {
        valid: false,
        message: `🚨 ALERTE DE SÉCURITÉ\n\n📍 Votre position GPS: ${detectedVille}, ${detectedQuartier}\n📝 Lieu déclaré: ${ville}, ${quartier}\n\n📏 Distance: ${distance.toFixed(1)} km (max: ${maxAllowedDistance} km)\n\n⚠️ Cette distance est trop grande pour être valide.\n\n🎯 Options:\n• Utiliser la position GPS\n• Choisir un lieu plus proche de votre position\n• Contacter le support si vous êtes bien à cet endroit`
      };
    }

    return { valid: true, message: '' };
  };

  const getCoordinatesForLocation = (city: string, quarter: string): { latitude: number; longitude: number } => {
    // Base de données des coordonnées des quartiers/villes camerounaises
    const locations = [
      // Douala
      { city: 'douala', quarter: 'bonamoussadi', lat: 3.948032, lon: 11.502075 },
      { city: 'douala', quarter: 'titi-garage', lat: 4.048032, lon: 11.502075 },
      { city: 'douala', quarter: 'mfandena', lat: 4.048032, lon: 11.502075 },
      { city: 'douala', quarter: 'bonapriso', lat: 4.048032, lon: 11.502075 },
      { city: 'douala', quarter: 'bali', lat: 4.048032, lon: 11.502075 },
      { city: 'douala', quarter: 'deido', lat: 4.048032, lon: 11.502075 },
      { city: 'douala', quarter: 'akwa', lat: 4.048032, lon: 11.502075 },
      { city: 'douala', quarter: 'new-bell', lat: 4.048032, lon: 11.502075 },
      { city: 'douala', quarter: 'makepe', lat: 4.048032, lon: 11.502075 },
      { city: 'douala', quarter: 'logbaba', lat: 4.048032, lon: 11.502075 },
      
      // Yaoundé
      { city: 'yaoundé', quarter: 'bastos', lat: 3.848032, lon: 11.502075 },
      { city: 'yaoundé', quarter: 'mokolo', lat: 3.848032, lon: 11.502075 },
      { city: 'yaoundé', quarter: 'tsinga', lat: 3.848032, lon: 11.502075 },
      { city: 'yaoundé', quarter: 'melen', lat: 3.848032, lon: 11.502075 },
      { city: 'yaoundé', quarter: 'efoulan', lat: 3.848032, lon: 11.502075 },
      { city: 'yaoundé', quarter: 'kondengui', lat: 3.848032, lon: 11.502075 },
      { city: 'yaoundé', quarter: 'omnisport', lat: 3.848032, lon: 11.502075 },
      
      // Autres villes
      { city: 'bafoussam', quarter: 'centre-ville', lat: 5.483333, lon: 10.416667 },
      { city: 'garoua', quarter: 'centre-ville', lat: 9.300000, lon: 13.383333 },
      { city: 'maroua', quarter: 'centre-ville', lat: 10.591111, lon: 14.315833 },
      { city: 'bamenda', quarter: 'commercial-avenue', lat: 5.964167, lon: 10.152500 },
      { city: 'ngaoundéré', quarter: 'centre-ville', lat: 7.316667, lon: 13.583333 },
      { city: 'kumba', quarter: 'fiango', lat: 4.633333, lon: 9.450000 },
      { city: 'limbe', quarter: 'down-beach', lat: 4.016667, lon: 9.200000 },
      { city: 'buea', quarter: 'molyko', lat: 4.150000, lon: 9.233333 },
    ];

    // Rechercher la correspondance exacte
    const exactMatch = locations.find(
      loc => loc.city === city.toLowerCase() && loc.quarter === quarter.toLowerCase()
    );

    if (exactMatch) {
      return { latitude: exactMatch.lat, longitude: exactMatch.lon };
    }

    // Rechercher par ville seulement
    const cityMatch = locations.find(loc => loc.city === city.toLowerCase());
    if (cityMatch) {
      return { latitude: cityMatch.lat, longitude: cityMatch.lon };
    }

    // Rechercher par quartier seulement
    const quarterMatch = locations.find(loc => loc.quarter === quarter.toLowerCase());
    if (quarterMatch) {
      return { latitude: quarterMatch.lat, longitude: quarterMatch.lon };
    }

    // Coordonnées par défaut (Douala centre) si non trouvé
    return { latitude: 4.048032, longitude: 11.502075 };
  };

  const calculateSimilarity = (str1: string, str2: string): number => {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  };

  const levenshteinDistance = (str1: string, str2: string): number => {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  };

  const useDetectedLocation = async () => {
    console.log('🔄 Utilisateur demande de réactualiser la position GPS');
    setLocationLoading(true);
    setLocationError('');
    
    try {
      // Réactualiser la position GPS actuelle
      const freshLocation = await getCurrentLocation();
      console.log('✅ Position GPS réactualisée:', freshLocation);
      
      // Attendre un petit délai pour que les états detectedVille/detectedQuartier soient mis à jour
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Utiliser les nouvelles valeurs détectées (maintenant à jour)
      console.log('📍 Valeurs détectées après mise à jour:', { detectedVille, detectedQuartier });
      console.log('📍 Valeurs des champs avant mise à jour:', { ville, quartier });
      
      setVille(detectedVille);
      setQuartier(detectedQuartier);
      
      // Attendre encore un peu pour la mise à jour des champs
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Marquer que l'utilisateur a explicitement utilisé le GPS
      setUserExplicitlyUsedGPS(true);
      
      console.log('📍 Position GPS appliquée:', { ville: detectedVille, quartier: detectedQuartier });
      console.log('📍 Valeurs des champs après mise à jour:', { ville, quartier });
      console.log('✅ Utilisateur a explicitement utilisé le GPS - Validation acceptée');
    } catch (error) {
      console.error('❌ Erreur lors de la réactualisation GPS:', error);
      setLocationError('Impossible de réactualiser la position GPS');
    } finally {
      setLocationLoading(false);
    }
  };

  const showMapPreview = () => {
    if (currentLocation) {
      setMapVisible(true);
    }
  };

  const showMediaOptions = () => {
    console.log('📋 Affichage options médias...');
    console.log('📊 État actuel - Images:', images.length, '/5, Vidéos:', videos.length, '/2');
    
    Alert.alert(
      'Ajouter des médias',
      'Choisissez une option',
      [
        {
          text: '📸 Prendre une photo',
          onPress: () => {
            console.log('📸 Option: Prendre une photo sélectionnée');
            takePhoto();
          },
        },
        {
          text: '🎥 Enregistrer une vidéo',
          onPress: () => {
            console.log('🎥 Option: Enregistrer une vidéo sélectionnée');
            recordVideo();
          },
        },
        {
          text: '📁 Choisir depuis la galerie',
          onPress: () => {
            console.log('📁 Option: Galerie sélectionnée');
            pickFromGallery();
          },
        },
        {
          text: 'Annuler',
          style: 'cancel',
          onPress: () => {
            console.log('❌ Option: Annuler sélectionnée');
          },
        },
      ]
    );
  };

  const takePhoto = async () => {
    if (images.length >= 5) {
      Alert.alert('Limite atteinte', 'Vous ne pouvez ajouter que 5 images maximum');
      return;
    }

    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission refusée', 'Vous devez autoriser l\'accès à la caméra');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
    });

    if (!result.canceled) {
      setImages([...images, result.assets[0].uri]);
    }
  };

  const recordVideo = async () => {
    console.log('🎥 Lancement enregistrement vidéo...');
    
    if (videos.length >= 2) {
      console.log('❌ Limite vidéos atteinte:', videos.length);
      Alert.alert('Limite atteinte', 'Vous ne pouvez ajouter que 2 vidéos maximum');
      return;
    }

    try {
      console.log('📋 Demande permission caméra...');
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      console.log('📋 Permission caméra:', permissionResult.granted);

      if (!permissionResult.granted) {
        console.log('❌ Permission caméra refusée');
        Alert.alert('Permission refusée', 'Vous devez autoriser l\'accès à la caméra pour enregistrer des vidéos');
        return;
      }

      console.log('🎥 Lancement caméra vidéo...');
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        quality: 0.8,
        allowsEditing: true,
        videoMaxDuration: 60, // 1 minute maximum
      });

      console.log('🎥 Résultat caméra:', result);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const videoAsset = result.assets[0];
        console.log('🎥 Vidéo enregistrée:', videoAsset);
        
        // Vérifier la durée de la vidéo
        if (videoAsset.duration && videoAsset.duration > 60) {
          console.log('❌ Vidéo trop longue:', videoAsset.duration, 'secondes');
          Alert.alert('Vidéo trop longue', `La vidéo fait ${videoAsset.duration}s et ne doit pas dépasser 1 minute`);
          return;
        }
        
        console.log('✅ Ajout de la vidéo:', videoAsset.uri);
        setVideos([...videos, videoAsset.uri]);
        Alert.alert('Succès', 'Vidéo ajoutée avec succès !');
      } else {
        console.log('🎥 Enregistrement vidéo annulé');
      }
    } catch (error) {
      console.error('❌ Erreur enregistrement vidéo:', error);
      Alert.alert('Erreur', 'Impossible d\'enregistrer la vidéo. Veuillez réessayer.');
    }
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'Nous avons besoin de votre permission pour accéder aux médias');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All, // Accepte images et vidéos
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 10, // Limite globale pour éviter les dépassements
    });

    if (!result.canceled) {
      const newImages: string[] = [];
      const newVideos: string[] = [];
      
      for (const asset of result.assets) {
        if (asset.mimeType?.startsWith('video/')) {
          // C'est une vidéo
          if (videos.length + newVideos.length >= 2) {
            Alert.alert('Limite vidéos', 'Maximum 2 vidéos autorisées');
            break;
          }
          
          // Vérifier la durée
          if (asset.duration && asset.duration > 60) {
            Alert.alert('Vidéo trop longue', `${asset.fileName || 'Vidéo'} dépasse 1 minute`);
            continue;
          }
          
          newVideos.push(asset.uri);
        } else {
          // C'est une image
          if (images.length + newImages.length >= 5) {
            Alert.alert('Limite images', 'Maximum 5 images autorisées');
            break;
          }
          newImages.push(asset.uri);
        }
      }
      
      if (newImages.length > 0) {
        setImages([...images, ...newImages]);
      }
      if (newVideos.length > 0) {
        setVideos([...videos, ...newVideos]);
        Alert.alert('Succès', `${newVideos.length} vidéo(s) ajoutée(s)`);
      }
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const removeVideo = (index: number) => {
    setVideos(videos.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    if (!titre.trim()) {
      Alert.alert('Erreur', 'Le titre est obligatoire');
      return false;
    }
    if (!ville.trim()) {
      Alert.alert('Erreur', 'La ville est obligatoire');
      return false;
    }
    if (!quartier.trim()) {
      Alert.alert('Erreur', 'Le quartier est obligatoire');
      return false;
    }
    if (!prixLoyer && !prixVente) {
      Alert.alert('Erreur', 'Vous devez indiquer au moins un prix (loyer ou vente)');
      return false;
    }
    if (images.length === 0 && videos.length === 0) {
      Alert.alert('Erreur', 'Vous devez ajouter au moins une image ou une vidéo');
      return false;
    }

    // Validation de cohérence de localisation
    const locationValidation = validateLocationConsistency();
    if (!locationValidation.valid) {
      Alert.alert(
        '📍 Incohérence de localisation',
        locationValidation.message,
        [
          {
            text: '🎯 Utiliser GPS',
            onPress: async () => {
              await useDetectedLocation();
            },
          },
          {
            text: '✏️ Corriger manuellement',
            onPress: () => {
              // Scroller vers la section de correction manuelle
              // Mettre le focus sur le premier champ de correction
              console.log('📍 Utilisateur choisit de corriger manuellement');
            },
            style: 'default',
          },
          {
            text: '⏭️ Ignorer et continuer',
            onPress: () => {
              // Permet de continuer quand même (au cas où le GPS est vraiment faux)
              console.log('⏭️ Utilisateur ignore la validation');
            },
            style: 'cancel',
          },
        ]
      );
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);

      // 1. Créer le bien
      const bienData = {
        titre: titre.trim(),
        description: description.trim() || undefined,
        type_bien: typeBien,
        ville: ville.trim(),
        quartier: quartier.trim(),
        adresse_complete: adresseComplete.trim() || undefined,
        prix_loyer: prixLoyer ? parseInt(prixLoyer) : undefined,
        prix_vente: prixVente ? parseInt(prixVente) : undefined,
        superficie: superficie ? parseInt(superficie) : undefined,
        nombre_chambres: nombreChambres ? parseInt(nombreChambres) : undefined,
        nombre_salles_bain: nombreSallesBain ? parseInt(nombreSallesBain) : undefined,
        nombre_pieces: nombrePieces ? parseInt(nombrePieces) : undefined,
        meuble,
        // Ajouter les coordonnées GPS comme source de vérité
        latitude: currentLocation?.latitude,
        longitude: currentLocation?.longitude,
        // Garder une trace de la méthode de localisation
        location_source: currentLocation ? 'gps' : 'manual',
        detected_ville: detectedVille || null,
        detected_quartier: detectedQuartier || null,
      };

      console.log('📤 Création du bien...', bienData);
      const bienCreated = await bienApi.createBien(bienData);
      console.log('✅ Bien créé:', bienCreated);

      // 2. Upload des images et vidéos
      console.log('📤 Upload des médias...');
      
      // Upload des images
      for (const imageUri of images) {
        const formData = new FormData();
        const filename = imageUri.split('/').pop() || 'photo.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';

        formData.append('fichier', {
          uri: imageUri,
          name: filename,
          type,
        } as any);

        await mediaApi.uploadMedia(bienCreated.id_bien, formData);
      }

      // Upload des vidéos
      for (const videoUri of videos) {
        const formData = new FormData();
        const filename = videoUri.split('/').pop() || 'video.mp4';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `video/${match[1]}` : 'video/mp4';

        formData.append('fichier', {
          uri: videoUri,
          name: filename,
          type,
        } as any);

        await mediaApi.uploadMedia(bienCreated.id_bien, formData);
      }

      console.log('✅ Médias uploadés');

      Alert.alert(
        'Succès',
        'Votre bien a été publié avec succès !',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error: any) {
      console.error('❌ Erreur:', error);
      Alert.alert(
        'Erreur',
        error.response?.data?.detail || 'Une erreur est survenue lors de la publication'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
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
          Publier un bien
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
              onPress={() => setTypeBien(type.value)}
              style={{
                backgroundColor: typeBien === type.value ? '#3b82f6' : '#1e293b',
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 8,
                marginRight: 8,
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
          value={titre}
          onChangeText={setTitre}
          placeholder="Ex: Bel appartement 2 chambres"
          placeholderTextColor="#64748b"
          style={{
            backgroundColor: '#1e293b',
            color: '#fff',
            padding: 12,
            borderRadius: 8,
            marginBottom: 16,
          }}
        />

        {/* Description */}
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
          Description
        </Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Décrivez votre bien..."
          placeholderTextColor="#64748b"
          multiline
          numberOfLines={4}
          style={{
            backgroundColor: '#1e293b',
            color: '#fff',
            padding: 12,
            borderRadius: 8,
            marginBottom: 16,
            height: 100,
            textAlignVertical: 'top',
          }}
        />

        {/* Localisation */}
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 12, marginTop: 8 }}>
          📍 Localisation
        </Text>

        {/* Section de détection GPS */}
        <View style={{ backgroundColor: '#1e293b', padding: 16, borderRadius: 12, marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Ionicons name="location" size={20} color="#3b82f6" />
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 }}>
              Détection automatique
            </Text>
          </View>

          {locationLoading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#3b82f6" />
              <Text style={{ color: '#9ca3af', marginLeft: 8 }}>Détection de votre position...</Text>
            </View>
          ) : locationError ? (
            <View>
              <Text style={{ color: '#ef4444', marginBottom: 8 }}>{locationError}</Text>
              <TouchableOpacity 
                style={{ backgroundColor: '#3b82f6', padding: 8, borderRadius: 6, alignSelf: 'flex-start' }}
                onPress={getCurrentLocation}
              >
                <Text style={{ color: '#fff', fontSize: 14 }}>Réessayer</Text>
              </TouchableOpacity>
            </View>
          ) : currentLocation ? (
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={{ color: '#10b981', fontSize: 16, fontWeight: '600' }}>
                  ✅ Position GPS détectée
                </Text>
                <TouchableOpacity 
                  onPress={useDetectedLocation}
                  disabled={locationLoading}
                  style={{ padding: 4 }}
                >
                  {locationLoading ? (
                    <ActivityIndicator size="small" color="#10b981" />
                  ) : (
                    <Ionicons name="refresh" size={20} color="#10b981" />
                  )}
                </TouchableOpacity>
              </View>
              <Text style={{ color: '#9ca3af', fontSize: 14, marginBottom: 4 }}>
                📍 GPS: {detectedVille}, {detectedQuartier}
              </Text>
              <Text style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>
                💡 Dernière détection: {new Date().toLocaleTimeString('fr-FR')}
              </Text>
              <Text style={{ color: '#f59e0b', fontSize: 12, marginBottom: 8 }}>
                ⚠️ Si ce n'est pas correct, vous pouvez le corriger ci-dessous
              </Text>
              
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                <TouchableOpacity 
                  style={{ backgroundColor: '#10b981', padding: 8, borderRadius: 6, flex: 1 }}
                  onPress={useDetectedLocation}
                  disabled={locationLoading}
                >
                  {locationLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={{ color: '#fff', fontSize: 14, textAlign: 'center' }}>🔄 Utiliser GPS</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity 
                  style={{ backgroundColor: '#64748b', padding: 8, borderRadius: 6, flex: 1 }}
                  onPress={showMapPreview}
                >
                  <Text style={{ color: '#fff', fontSize: 14, textAlign: 'center' }}>Voir carte</Text>
                </TouchableOpacity>
              </View>

              <View style={{ backgroundColor: '#374151', padding: 12, borderRadius: 8 }}>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 8 }}>
                  🎯 Localisation manuelle (si GPS incorrect)
                </Text>
                <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 8 }}>
                  Les coordonnées GPS seront conservées mais vous pouvez corriger ville/quartier
                </Text>
                
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    value={detectedVille}
                    onChangeText={setDetectedVille}
                    placeholder="Ville correcte"
                    placeholderTextColor="#64748b"
                    style={{
                      backgroundColor: '#1e293b',
                      color: '#fff',
                      padding: 8,
                      borderRadius: 6,
                      flex: 1,
                      fontSize: 14,
                    }}
                  />
                  <TextInput
                    value={detectedQuartier}
                    onChangeText={setDetectedQuartier}
                    placeholder="Quartier correct"
                    placeholderTextColor="#64748b"
                    style={{
                      backgroundColor: '#1e293b',
                      color: '#fff',
                      padding: 8,
                      borderRadius: 6,
                      flex: 1,
                      fontSize: 14,
                    }}
                  />
                </View>
                
                <TouchableOpacity 
                  style={{ backgroundColor: '#3b82f6', padding: 8, borderRadius: 6, marginTop: 8, alignSelf: 'flex-start' }}
                  onPress={() => {
                    setVille(detectedVille);
                    setQuartier(detectedQuartier);
                    setLocationError('');
                    // Réinitialiser l'état GPS car l'utilisateur fait une correction manuelle
                    setUserExplicitlyUsedGPS(false);
                    setGpsAutoFilled(false);
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 14 }}>Appliquer la correction</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity 
              style={{ backgroundColor: '#3b82f6', padding: 8, borderRadius: 6, alignSelf: 'flex-start' }}
              onPress={getCurrentLocation}
            >
              <Text style={{ color: '#fff', fontSize: 14 }}>Activer la localisation GPS</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
          Ville *
        </Text>
        <TextInput
          value={ville}
          onChangeText={(text) => {
            setVille(text);
            // Réinitialiser l'état GPS si l'utilisateur tape manuellement
            setUserExplicitlyUsedGPS(false);
            setGpsAutoFilled(false);
          }}
          placeholder="Ex: Douala"
          placeholderTextColor="#64748b"
          style={{
            backgroundColor: '#1e293b',
            color: '#fff',
            padding: 12,
            borderRadius: 8,
            marginBottom: 16,
          }}
        />

        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
          Quartier *
        </Text>
        <TextInput
          value={quartier}
          onChangeText={(text) => {
            setQuartier(text);
            // Réinitialiser l'état GPS si l'utilisateur tape manuellement
            setUserExplicitlyUsedGPS(false);
            setGpsAutoFilled(false);
          }}
          placeholder="Ex: Bonamoussadi"
          placeholderTextColor="#64748b"
          style={{
            backgroundColor: '#1e293b',
            color: '#fff',
            padding: 12,
            borderRadius: 8,
            marginBottom: 16,
          }}
        />

        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
          Adresse complète
        </Text>
        <TextInput
          value={adresseComplete}
          onChangeText={setAdresseComplete}
          placeholder="Ex: Rue 123, près de..."
          placeholderTextColor="#64748b"
          style={{
            backgroundColor: '#1e293b',
            color: '#fff',
            padding: 12,
            borderRadius: 8,
            marginBottom: 16,
          }}
        />

        {/* Prix */}
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 12, marginTop: 8 }}>
          💰 Prix
        </Text>

        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
          Prix de location (FCFA/mois)
        </Text>
        <TextInput
          value={prixLoyer}
          onChangeText={setPrixLoyer}
          placeholder="Ex: 50000"
          placeholderTextColor="#64748b"
          keyboardType="numeric"
          style={{
            backgroundColor: '#1e293b',
            color: '#fff',
            padding: 12,
            borderRadius: 8,
            marginBottom: 16,
          }}
        />

        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
          Prix de vente (FCFA)
        </Text>
        <TextInput
          value={prixVente}
          onChangeText={setPrixVente}
          placeholder="Ex: 15000000"
          placeholderTextColor="#64748b"
          keyboardType="numeric"
          style={{
            backgroundColor: '#1e293b',
            color: '#fff',
            padding: 12,
            borderRadius: 8,
            marginBottom: 16,
          }}
        />

        {/* Caractéristiques */}
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 12, marginTop: 8 }}>
          📐 Caractéristiques
        </Text>

        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 8 }}>
              Superficie (m²)
            </Text>
            <TextInput
              value={superficie}
              onChangeText={setSuperficie}
              placeholder="Ex: 80"
              placeholderTextColor="#64748b"
              keyboardType="numeric"
              style={{
                backgroundColor: '#1e293b',
                color: '#fff',
                padding: 12,
                borderRadius: 8,
              }}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 8 }}>
              Chambres
            </Text>
            <TextInput
              value={nombreChambres}
              onChangeText={setNombreChambres}
              placeholder="Ex: 2"
              placeholderTextColor="#64748b"
              keyboardType="numeric"
              style={{
                backgroundColor: '#1e293b',
                color: '#fff',
                padding: 12,
                borderRadius: 8,
              }}
            />
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 8 }}>
              Salles de bain
            </Text>
            <TextInput
              value={nombreSallesBain}
              onChangeText={setNombreSallesBain}
              placeholder="Ex: 1"
              placeholderTextColor="#64748b"
              keyboardType="numeric"
              style={{
                backgroundColor: '#1e293b',
                color: '#fff',
                padding: 12,
                borderRadius: 8,
              }}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 8 }}>
              Pièces totales
            </Text>
            <TextInput
              value={nombrePieces}
              onChangeText={setNombrePieces}
              placeholder="Ex: 4"
              placeholderTextColor="#64748b"
              keyboardType="numeric"
              style={{
                backgroundColor: '#1e293b',
                color: '#fff',
                padding: 12,
                borderRadius: 8,
              }}
            />
          </View>
        </View>

        {/* Meublé */}
        <TouchableOpacity
          onPress={() => setMeuble(!meuble)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#1e293b',
            padding: 16,
            borderRadius: 8,
            marginBottom: 16,
          }}
        >
          <Ionicons
            name={meuble ? 'checkbox' : 'square-outline'}
            size={24}
            color={meuble ? '#3b82f6' : '#64748b'}
          />
          <Text style={{ color: '#fff', fontSize: 16, marginLeft: 12 }}>
            Bien meublé
          </Text>
        </TouchableOpacity>

        {/* Images */}
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 12, marginTop: 8 }}>
          📸 Photos ({images.length}/5)
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {images.map((uri, index) => (
            <View key={index} style={{ marginRight: 12, position: 'relative' }}>
              <Image
                source={{ uri }}
                style={{ width: 120, height: 120, borderRadius: 8 }}
                resizeMode="cover"
              />
              <TouchableOpacity
                onPress={() => removeImage(index)}
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  backgroundColor: '#ef4444',
                  borderRadius: 12,
                  width: 24,
                  height: 24,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Ionicons name="close" size={12} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}

          {(images.length < 5 || videos.length < 2) && (
            <TouchableOpacity
              onPress={showMediaOptions}
              style={{
                width: 120,
                height: 120,
                borderRadius: 8,
                borderWidth: 2,
                borderColor: videos.length < 2 ? '#3b82f6' : '#64748b',
                borderStyle: 'dashed',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: videos.length < 2 && images.length >= 5 ? '#1e293b' : 'transparent',
              }}
            >
              <Ionicons name="add" size={32} color={videos.length < 2 ? '#3b82f6' : '#64748b'} />
              <Text style={{ color: videos.length < 2 ? '#3b82f6' : '#64748b', fontSize: 12, marginTop: 4 }}>
                {images.length >= 5 && videos.length < 2 ? 'Ajouter vidéo' : 'Ajouter'}
              </Text>
              {images.length >= 5 && videos.length < 2 && (
                <Text style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>
                  Max 2 vidéos
                </Text>
              )}
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* Vidéos */}
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 12, marginTop: 8 }}>
          🎥 Vidéos ({videos.length}/2) - Max 1min chacune
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {videos.map((uri, index) => (
            <View key={index} style={{ marginRight: 12, position: 'relative' }}>
              <View style={{
                width: 120,
                height: 120,
                borderRadius: 8,
                backgroundColor: '#1e293b',
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 2,
                borderColor: '#3b82f6',
              }}>
                <Ionicons name="play-circle" size={40} color="#3b82f6" />
                <Text style={{ color: '#3b82f6', fontSize: 10, marginTop: 4 }}>
                  Vidéo {index + 1}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => removeVideo(index)}
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  backgroundColor: '#ef4444',
                  borderRadius: 12,
                  width: 24,
                  height: 24,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Ionicons name="close" size={12} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}

          {videos.length < 2 && (
            <TouchableOpacity
              onPress={recordVideo}
              style={{
                width: 120,
                height: 120,
                borderRadius: 8,
                borderWidth: 2,
                borderColor: '#3b82f6',
                borderStyle: 'dashed',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: '#1e293b',
              }}
            >
              <Ionicons name="videocam" size={32} color="#3b82f6" />
              <Text style={{ color: '#3b82f6', fontSize: 12, marginTop: 4 }}>
                Enregistrer
              </Text>
              <Text style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>
                Max 1min
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* Légende */}
        <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 16 }}>
          💡 Au moins une photo ou une vidéo est requise *
        </Text>

        {/* Bouton Publier */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading}
          style={{
            backgroundColor: loading ? '#6b7280' : '#10b981',
            padding: 16,
            borderRadius: 12,
            alignItems: 'center',
            marginTop: 8,
            marginBottom: 32,
          }}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
              Publier le bien
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Modal de prévisualisation de carte */}
      <Modal
        visible={mapVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setMapVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)' }}>
          <View style={{ 
            position: 'absolute', 
            top: 50, 
            left: 20, 
            right: 20, 
            zIndex: 1,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>
              Position du bien
            </Text>
            <TouchableOpacity onPress={() => setMapVisible(false)}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {currentLocation && (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
              <Image
                source={{ 
                  uri: `https://maps.googleapis.com/maps/api/staticmap?center=${currentLocation.latitude},${currentLocation.longitude}&zoom=16&size=400x400&maptype=roadmap&markers=color:red%7C${currentLocation.latitude},${currentLocation.longitude}&key=YOUR_API_KEY`
                }}
                style={{ 
                  width: '100%', 
                  height: 400, 
                  borderRadius: 12,
                  marginBottom: 20
                }}
                resizeMode="cover"
                defaultSource={{ uri: 'https://picsum.photos/seed/map-preview/400/400.jpg' }}
              />
              
              <View style={{ backgroundColor: '#1e293b', padding: 16, borderRadius: 12, width: '100%' }}>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
                  📍 Localisation détectée
                </Text>
                <Text style={{ color: '#9ca3af', marginBottom: 4 }}>
                  {detectedVille}, {detectedQuartier}
                </Text>
                <Text style={{ color: '#64748b', fontSize: 12 }}>
                  Coordonnées: {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
                </Text>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
};
