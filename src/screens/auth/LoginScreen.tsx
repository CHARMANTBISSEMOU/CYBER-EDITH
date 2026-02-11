import React, { useState, useEffect } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { TermsAudioModal } from '../../components/TermsAudioModal';

export const LoginScreen = ({ navigation }: any) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [selectedOption, setSelectedOption] = useState<'A' | 'B' | null>(null);
  
  const { login, isLoading, error, clearError } = useAuthStore();

  useEffect(() => {
    checkTermsAcceptance();
  }, []);

  const checkTermsAcceptance = async () => {
    try {
      const termsAccepted = await AsyncStorage.getItem('termsAccepted');
      if (!termsAccepted) {
        setShowTermsModal(true);
      }
    } catch (err) {
      console.error('Error checking terms:', err);
    }
  };

  const handleTermsSelection = async (option: 'A' | 'B') => {
    setSelectedOption(option);
    await AsyncStorage.setItem('termsAccepted', 'true');
    await AsyncStorage.setItem('selectedOption', option);
    setShowTermsModal(false);
    
    Alert.alert(
      'Option sélectionnée',
      option === 'A' 
        ? 'Vous avez choisi le paiement à l\'acte avec suivi GPS.'
        : 'Vous avez choisi l\'abonnement annuel sans suivi GPS.',
      [{ text: 'OK' }]
    );
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Erreur', 'Veuillez entrer une adresse email valide');
      return;
    }

    try {
      clearError();
      await login({ email, mot_de_passe: password });
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || error || 'Email ou mot de passe incorrect';
      Alert.alert('Erreur de connexion', errorMsg);
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Connexion en cours..." />;
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
        <View className="flex-1 justify-center px-6 py-12">
          <View className="items-center mb-12">
            <Ionicons name="home" size={64} color="#3b82f6" />
            <Text className="text-white text-3xl font-bold mt-4">App Immobilière</Text>
            <Text className="text-gray-400 text-base mt-2">Trouvez votre logement idéal</Text>
          </View>

          <View className="space-y-4">
            <View>
              <Text className="text-white text-sm font-medium mb-2">Email</Text>
              <View className="flex-row items-center bg-dark-card border border-dark-border rounded-lg px-4 py-3">
                <Ionicons name="mail-outline" size={20} color="#9ca3af" />
                <TextInput
                  className="flex-1 text-white ml-3"
                  placeholder="votre@email.com"
                  placeholderTextColor="#6b7280"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View>
              <Text className="text-white text-sm font-medium mb-2">Mot de passe</Text>
              <View className="flex-row items-center bg-dark-card border border-dark-border rounded-lg px-4 py-3">
                <Ionicons name="lock-closed-outline" size={20} color="#9ca3af" />
                <TextInput
                  className="flex-1 text-white ml-3"
                  placeholder="••••••••"
                  placeholderTextColor="#6b7280"
                  value={password}
                  onChangeText={setPassword}
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

            <TouchableOpacity
              onPress={handleLogin}
              className="bg-primary rounded-lg py-4 mt-6"
              disabled={isLoading}
            >
              <Text className="text-white text-center font-semibold text-base">
                Se connecter
              </Text>
            </TouchableOpacity>

            <View className="flex-row justify-center items-center mt-6">
              <Text className="text-gray-400">Pas encore de compte ? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text className="text-primary font-semibold">S'inscrire</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      <TermsAudioModal
        visible={showTermsModal}
        onSelectOption={handleTermsSelection}
      />
    </KeyboardAvoidingView>
  );
};
