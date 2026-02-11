import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authApi } from '../../services/api';

export const ResetPasswordScreen = ({ route, navigation }: any) => {
  const { email } = route.params;
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = () => {
    if (!code || code.length !== 4) {
      Alert.alert('Erreur', 'Veuillez entrer un code à 4 chiffres');
      return false;
    }

    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Erreur', 'Le nouveau mot de passe doit contenir au moins 6 caractères');
      return false;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return false;
    }

    return true;
  };

  const handleResetPassword = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      console.log('🔐 Vérification du code et réinitialisation...');
      
      await authApi.verifyCodeAndReset({
        email: email,
        code: code,
        nouveau_mot_de_passe: newPassword,
      });

      console.log('✅ Mot de passe réinitialisé avec succès');
      Alert.alert(
        'Succès',
        'Votre mot de passe a été réinitialisé avec succès',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Login'),
          },
        ]
      );
    } catch (error: any) {
      console.error('❌ Erreur réinitialisation mot de passe:', error);
      const errorMessage = error.response?.data?.detail || 'Impossible de réinitialiser le mot de passe';
      Alert.alert('Erreur', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    try {
      console.log('📤 Renvoi du code...');
      await authApi.forgotPassword(email);
      Alert.alert('Succès', 'Un nouveau code a été envoyé à votre adresse email');
    } catch (error: any) {
      console.error('❌ Erreur renvoi code:', error);
      Alert.alert('Erreur', 'Impossible de renvoyer le code');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-dark-bg"
    >
      <View className="flex-1 justify-center px-6">
        {/* Header */}
        <View className="items-center mb-8">
          <View className="w-20 h-20 bg-blue-600 rounded-full items-center justify-center mb-4">
            <Ionicons name="lock-open" size={40} color="#fff" />
          </View>
          <Text className="text-white text-2xl font-bold text-center">
            Réinitialiser le mot de passe
          </Text>
          <Text className="text-gray-400 text-center mt-2">
            Entrez le code reçu par email
          </Text>
        </View>

        {/* Email affiché */}
        <View className="bg-dark-card rounded-lg p-4 mb-6">
          <Text className="text-gray-400 text-sm mb-1">Email</Text>
          <Text className="text-white font-medium">{email}</Text>
        </View>

        {/* Code à 4 chiffres */}
        <View className="mb-6">
          <Text className="text-white text-sm font-medium mb-2">Code de vérification</Text>
          <TextInput
            className="bg-dark-card border border-dark-border rounded-lg px-4 py-3 text-white text-center text-xl"
            placeholder="0000"
            placeholderTextColor="#6b7280"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={4}
            secureTextEntry={false}
          />
          <Text className="text-gray-500 text-xs mt-1 text-center">
            Entrez le code à 4 chiffres reçu par email
          </Text>
        </View>

        {/* Nouveau mot de passe */}
        <View className="mb-4">
          <Text className="text-white text-sm font-medium mb-2">Nouveau mot de passe</Text>
          <TextInput
            className="bg-dark-card border border-dark-border rounded-lg px-4 py-3 text-white"
            placeholder="Minimum 6 caractères"
            placeholderTextColor="#6b7280"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
          />
        </View>

        {/* Confirmer mot de passe */}
        <View className="mb-6">
          <Text className="text-white text-sm font-medium mb-2">Confirmer le mot de passe</Text>
          <TextInput
            className="bg-dark-card border border-dark-border rounded-lg px-4 py-3 text-white"
            placeholder="Confirmez votre mot de passe"
            placeholderTextColor="#6b7280"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />
        </View>

        {/* Bouton de réinitialisation */}
        <TouchableOpacity
          onPress={handleResetPassword}
          disabled={isLoading}
          className="bg-blue-600 rounded-lg py-4 mb-4"
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text className="text-white text-center font-semibold">
              Réinitialiser le mot de passe
            </Text>
          )}
        </TouchableOpacity>

        {/* Renvoyer le code */}
        <TouchableOpacity onPress={handleResendCode} className="items-center">
          <Text className="text-blue-400 text-sm">
            Je n'ai pas reçu de code → Renvoyer
          </Text>
        </TouchableOpacity>

        {/* Retour */}
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="items-center mt-6"
        >
          <Text className="text-gray-400 text-sm">
            ← Retour
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};
