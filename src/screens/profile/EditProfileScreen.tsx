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
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../services/api';
import { LoadingSpinner } from '../../components/LoadingSpinner';

export const EditProfileScreen = ({ navigation }: any) => {
  const { user } = useAuthStore();
  const [formData, setFormData] = useState({
    nom: user?.nom || '',
    prenom: user?.prenom || '',
    email: user?.email || '',
    telephone: user?.telephone || '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const updatePasswordField = (field: string, value: string) => {
    setPasswordData(prev => ({ ...prev, [field]: value }));
  };

  const validatePasswordForm = () => {
    if (!passwordData.currentPassword) {
      Alert.alert('Erreur', 'Veuillez entrer votre mot de passe actuel');
      return false;
    }
    if (!passwordData.newPassword) {
      Alert.alert('Erreur', 'Veuillez entrer un nouveau mot de passe');
      return false;
    }
    if (passwordData.newPassword.length < 6) {
      Alert.alert('Erreur', 'Le nouveau mot de passe doit contenir au moins 6 caractères');
      return false;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return false;
    }
    return true;
  };

  const handleChangePassword = async () => {
    if (!validatePasswordForm()) return;

    setPasswordLoading(true);
    try {
      console.log('🔐 Changement de mot de passe...');
      
      // Appeler l'API pour changer le mot de passe
      await authApi.changePassword({
        current_password: passwordData.currentPassword,
        new_password: passwordData.newPassword,
      });

      console.log('✅ Mot de passe changé avec succès');

      // Réinitialiser le formulaire de mot de passe
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setShowPasswordSection(false);

      Alert.alert('Succès', 'Mot de passe changé avec succès');
    } catch (error: any) {
      console.error('❌ Erreur changement mot de passe:', error);
      const errorMessage = error.response?.data?.detail || 'Impossible de changer le mot de passe';
      Alert.alert('Erreur', errorMessage);
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotPasswordEmail) {
      Alert.alert('Erreur', 'Veuillez entrer votre adresse email');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(forgotPasswordEmail)) {
      Alert.alert('Erreur', 'Veuillez entrer une adresse email valide');
      return;
    }

    setForgotPasswordLoading(true);
    try {
      console.log('📤 Envoi email mot de passe oublié...', forgotPasswordEmail);
      
      await authApi.forgotPassword(forgotPasswordEmail);

      console.log('✅ Email de réinitialisation envoyé');
      
      setForgotPasswordEmail('');
      setShowForgotPassword(false);

      // Naviguer vers l'écran de saisie du code
      navigation.navigate('ResetPassword', { email: forgotPasswordEmail });
    } catch (error: any) {
      console.error('❌ Erreur envoi email mot de passe oublié:', error);
      const errorMessage = error.response?.data?.detail || 'Impossible d\'envoyer l\'email de réinitialisation';
      Alert.alert('Erreur', errorMessage);
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.nom || !formData.prenom || !formData.email) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
      return;
    }

    setIsLoading(true);
    try {
      console.log('📤 Mise à jour du profil...', formData);
      
      // Appeler l'API pour mettre à jour le profil
      const updatedUser = await authApi.updateProfile({
        nom: formData.nom.trim(),
        prenom: formData.prenom.trim(),
        email: formData.email.trim(),
        telephone: formData.telephone.trim(),
      });

      console.log('✅ Profil mis à jour:', updatedUser);

      // Mettre à jour le store avec les nouvelles informations
      const { loadUser } = useAuthStore.getState();
      await loadUser();

      Alert.alert('Succès', 'Profil mis à jour avec succès', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error: any) {
      console.error('❌ Erreur mise à jour profil:', error);
      const errorMessage = error.response?.data?.detail || 'Impossible de mettre à jour le profil';
      Alert.alert('Erreur', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Mise à jour du profil..." />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 48, paddingBottom: 16, backgroundColor: '#f8fafc' }}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ marginBottom: 8 }}
        >
          <Ionicons name="arrow-back" size={28} color="#1e293b" />
        </TouchableOpacity>
        <Text style={{ color: '#1e293b', fontSize: 24, fontWeight: 'bold' }}>Modifier le profil</Text>
      </View>
      <ScrollView className="flex-1">
        <View className="px-4 py-6">
          <View className="bg-dark-card rounded-lg p-4">
            <View className="space-y-4">
              <View>
                <Text className="text-white text-sm font-medium mb-2">Nom</Text>
                <TextInput
                  className="bg-dark-card border border-dark-border rounded-lg px-4 py-3 text-white"
                  placeholder="Nom"
                  placeholderTextColor="#6b7280"
                  value={formData.nom}
                  onChangeText={(value) => updateField('nom', value)}
                />
              </View>

              <View>
                <Text className="text-white text-sm font-medium mb-2">Prénom</Text>
                <TextInput
                  className="bg-dark-card border border-dark-border rounded-lg px-4 py-3 text-white"
                  placeholder="Prénom"
                  placeholderTextColor="#6b7280"
                  value={formData.prenom}
                  onChangeText={(value) => updateField('prenom', value)}
                />
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
                <Text className="text-gray-500 text-xs mt-1">Format : 2376XXXXXXXX</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleSave}
              className="bg-primary rounded-lg py-4 mt-6"
            >
              <Text className="text-white text-center font-semibold text-base">
                Enregistrer les modifications
              </Text>
            </TouchableOpacity>
          </View>

          {/* Section Changement de mot de passe */}
          <View className="bg-dark-card rounded-lg p-4 mt-6">
            <TouchableOpacity
              onPress={() => setShowPasswordSection(!showPasswordSection)}
              className="flex-row items-center justify-between"
            >
              <Text className="text-white text-lg font-semibold">🔐 Changer le mot de passe</Text>
              <Ionicons 
                name={showPasswordSection ? "chevron-up" : "chevron-down"} 
                size={20} 
                color="#fff" 
              />
            </TouchableOpacity>

            {showPasswordSection && (
              <View className="mt-4 space-y-4">
                <View>
                  <Text className="text-white text-sm font-medium mb-2">Mot de passe actuel</Text>
                  <TextInput
                    className="bg-dark-card border border-dark-border rounded-lg px-4 py-3 text-white"
                    placeholder="Entrez votre mot de passe actuel"
                    placeholderTextColor="#6b7280"
                    value={passwordData.currentPassword}
                    onChangeText={(value) => updatePasswordField('currentPassword', value)}
                    secureTextEntry
                  />
                </View>

                <View>
                  <Text className="text-white text-sm font-medium mb-2">Nouveau mot de passe</Text>
                  <TextInput
                    className="bg-dark-card border border-dark-border rounded-lg px-4 py-3 text-white"
                    placeholder="Entrez le nouveau mot de passe (min. 6 caractères)"
                    placeholderTextColor="#6b7280"
                    value={passwordData.newPassword}
                    onChangeText={(value) => updatePasswordField('newPassword', value)}
                    secureTextEntry
                  />
                </View>

                <View>
                  <Text className="text-white text-sm font-medium mb-2">Confirmer le nouveau mot de passe</Text>
                  <TextInput
                    className="bg-dark-card border border-dark-border rounded-lg px-4 py-3 text-white"
                    placeholder="Confirmez le nouveau mot de passe"
                    placeholderTextColor="#6b7280"
                    value={passwordData.confirmPassword}
                    onChangeText={(value) => updatePasswordField('confirmPassword', value)}
                    secureTextEntry
                  />
                </View>

                <TouchableOpacity
                  onPress={handleChangePassword}
                  disabled={passwordLoading}
                  className="bg-red-600 rounded-lg py-3 mt-4"
                >
                  {passwordLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text className="text-white text-center font-semibold">
                      🔐 Changer le mot de passe
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Section Mot de passe oublié */}
          <View className="bg-dark-card rounded-lg p-4 mt-6">
            <TouchableOpacity
              onPress={() => setShowForgotPassword(!showForgotPassword)}
              className="flex-row items-center justify-between"
            >
              <Text className="text-white text-lg font-semibold">🔑 Mot de passe oublié</Text>
              <Ionicons 
                name={showForgotPassword ? "chevron-up" : "chevron-down"} 
                size={20} 
                color="#fff" 
              />
            </TouchableOpacity>

            {showForgotPassword && (
              <View className="mt-4 space-y-4">
                <Text className="text-gray-400 text-sm">
                  Entrez votre adresse email pour recevoir un lien de réinitialisation de mot de passe.
                </Text>

                <View>
                  <Text className="text-white text-sm font-medium mb-2">Adresse email</Text>
                  <TextInput
                    className="bg-dark-card border border-dark-border rounded-lg px-4 py-3 text-white"
                    placeholder="votre@email.com"
                    placeholderTextColor="#6b7280"
                    value={forgotPasswordEmail}
                    onChangeText={setForgotPasswordEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                <TouchableOpacity
                  onPress={handleForgotPassword}
                  disabled={forgotPasswordLoading}
                  className="bg-orange-600 rounded-lg py-3 mt-4"
                >
                  {forgotPasswordLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text className="text-white text-center font-semibold">
                      📧 Envoyer le lien de réinitialisation
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};
