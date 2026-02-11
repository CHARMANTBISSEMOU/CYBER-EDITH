import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { LoadingSpinner } from '../../components/LoadingSpinner';

export const RegisterScreen = ({ navigation }: any) => {
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
    mot_de_passe: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [acceptGPS, setAcceptGPS] = useState(false);

  const { register, isLoading, error, clearError } = useAuthStore();

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleRegister = async () => {
    const { nom, prenom, email, telephone, mot_de_passe, confirmPassword } = formData;

    if (!nom || !prenom || !email || !telephone || !mot_de_passe) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Erreur', 'Veuillez entrer une adresse email valide');
      return;
    }

    const phoneRegex = /^2376[0-9]{8}$/;
    const cleanPhone = telephone.replace(/\s/g, '');
    if (!phoneRegex.test(cleanPhone)) {
      Alert.alert('Erreur', 'Le numéro doit être au format 2376XXXXXXXX (12 chiffres, ex: 237612345678)');
      return;
    }

    if (mot_de_passe !== confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }

    if (mot_de_passe.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    try {
      clearError();
      await register({
        nom,
        prenom,
        email,
        telephone: telephone.replace(/\s/g, ''),
        mot_de_passe,
        consent_geolocalisation: acceptGPS ? 'oui' : 'non',
      });
      
      Alert.alert(
        'Inscription réussie',
        'Votre compte a été créé avec succès. Vous pouvez maintenant vous connecter.',
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
      );
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || error || 'Une erreur est survenue lors de l\'inscription';
      Alert.alert('Erreur d\'inscription', errorMsg);
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Création du compte..." />;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-dark-bg"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 px-6 py-12">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="mb-6"
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          <Text className="text-white text-3xl font-bold mb-2">Créer un compte</Text>
          <Text className="text-gray-400 text-base mb-8">
            Rejoignez-nous pour trouver votre logement
          </Text>

          <View className="space-y-4">
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="text-white text-sm font-medium mb-2">Nom</Text>
                <TextInput
                  className="bg-dark-card border border-dark-border rounded-lg px-4 py-3 text-white"
                  placeholder="Nom"
                  placeholderTextColor="#6b7280"
                  value={formData.nom}
                  onChangeText={(value) => updateField('nom', value)}
                />
              </View>
              <View className="flex-1">
                <Text className="text-white text-sm font-medium mb-2">Prénom</Text>
                <TextInput
                  className="bg-dark-card border border-dark-border rounded-lg px-4 py-3 text-white"
                  placeholder="Prénom"
                  placeholderTextColor="#6b7280"
                  value={formData.prenom}
                  onChangeText={(value) => updateField('prenom', value)}
                />
              </View>
            </View>

            <View>
              <Text className="text-white text-sm font-medium mb-2">Email</Text>
              <TextInput
                className="bg-dark-card border border-dark-border rounded-lg px-4 py-3 text-white"
                placeholder="votre@email.com"
                placeholderTextColor="#6b7280"
                value={formData.email}
                onChangeText={(value) => updateField('email', value)}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View>
              <Text className="text-white text-sm font-medium mb-2">Téléphone</Text>
              <TextInput
                className="bg-dark-card border border-dark-border rounded-lg px-4 py-3 text-white"
                placeholder="2376XXXXXXXX"
                placeholderTextColor="#6b7280"
                value={formData.telephone}
                onChangeText={(value) => updateField('telephone', value)}
                keyboardType="phone-pad"
              />
              <Text className="text-gray-500 text-xs mt-1">Format: 237612345678 (12 chiffres avec indicatif pays)</Text>
            </View>

            <View>
              <Text className="text-white text-sm font-medium mb-2">Mot de passe</Text>
              <View className="flex-row items-center bg-dark-card border border-dark-border rounded-lg px-4 py-3">
                <TextInput
                  className="flex-1 text-white"
                  placeholder="••••••••"
                  placeholderTextColor="#6b7280"
                  value={formData.mot_de_passe}
                  onChangeText={(value) => updateField('mot_de_passe', value)}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="#9ca3af"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View>
              <Text className="text-white text-sm font-medium mb-2">Confirmer le mot de passe</Text>
              <TextInput
                className="bg-dark-card border border-dark-border rounded-lg px-4 py-3 text-white"
                placeholder="••••••••"
                placeholderTextColor="#6b7280"
                value={formData.confirmPassword}
                onChangeText={(value) => updateField('confirmPassword', value)}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity
              onPress={() => setAcceptGPS(!acceptGPS)}
              className="flex-row items-center mt-4"
            >
              <View className={`w-6 h-6 rounded border-2 mr-3 items-center justify-center ${
                acceptGPS ? 'bg-primary border-primary' : 'border-gray-400'
              }`}>
                {acceptGPS && <Ionicons name="checkmark" size={16} color="#fff" />}
              </View>
              <Text className="text-gray-300 flex-1">
                J'accepte le suivi GPS (recommandé pour éviter les frais)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleRegister}
              className="bg-primary rounded-lg py-4 mt-6"
              disabled={isLoading}
            >
              <Text className="text-white text-center font-semibold text-base">
                S'inscrire
              </Text>
            </TouchableOpacity>

            <View className="flex-row justify-center items-center mt-6">
              <Text className="text-gray-400">Déjà un compte ? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text className="text-primary font-semibold">Se connecter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
