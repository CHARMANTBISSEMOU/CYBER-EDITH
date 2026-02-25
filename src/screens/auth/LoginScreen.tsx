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
  ActivityIndicator,
  Image,
  StyleSheet,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { useLanguageStore } from '../../store/languageStore';
import { useTranslation } from '../../i18n/useTranslation';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { TermsAudioModal } from '../../components/TermsAudioModal';
import { LanguageSelectorModal } from '../../components/LanguageSelectorModal';
import { authApi } from '../../services/api';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    width: 120,
    height: 120,
    resizeMode: 'contain',
  },
  title: {
    color: '#1e293b',
    fontSize: 28,
    fontWeight: '700',
    marginTop: 16,
  },
  subtitle: {
    color: '#64748b',
    fontSize: 14,
    marginTop: 4,
  },
  form: {
    width: '100%',
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    color: '#1e293b',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  input: {
    flex: 1,
    color: '#1e293b',
    marginLeft: 12,
  },
  button: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  registerText: {
    color: '#64748b',
    fontSize: 14,
  },
  registerLink: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '600',
  },
  forgotPasswordContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  forgotPasswordButton: {
    alignItems: 'center',
  },
  forgotPasswordText: {
    color: '#f97316',
    fontSize: 16,
    fontWeight: '600',
  },
  forgotPasswordForm: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  forgotPasswordDescription: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  forgotPasswordButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export const LoginScreen = ({ navigation }: any) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [selectedOption, setSelectedOption] = useState<'A' | 'B' | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);

  const { login, isLoading, error, clearError } = useAuthStore();
  const { setLanguage, loadLanguage } = useLanguageStore();
  const { t } = useTranslation();

  useEffect(() => {
    loadLanguage();
    checkTermsAcceptance();
  }, []);

  const checkTermsAcceptance = async () => {
    try {
      const termsAccepted = await AsyncStorage.getItem('termsAccepted');
      if (!termsAccepted) {
        setShowLanguageSelector(true);
      }
    } catch (err) {
      console.error('Error checking terms:', err);
    }
  };

  const handleLanguageSelected = async (lang: 'fr' | 'en') => {
    await setLanguage(lang);
    setShowLanguageSelector(false);
    setShowTermsModal(true);
  };

  const handleTermsSelection = async (option: 'A' | 'B') => {
    setSelectedOption(option);
    await AsyncStorage.setItem('termsAccepted', 'true');
    setShowTermsModal(false);
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
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Image 
              source={require('../../assets/logoapp.png')} 
              style={styles.logo}
            />
            <Text style={styles.title}>App Immobilière</Text>
            <Text style={styles.subtitle}>Trouvez votre logement idéal</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color="#9ca3af" />
                <TextInput
                  style={styles.input}
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

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mot de passe</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#9ca3af" />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••••"
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
              style={styles.button}
              disabled={isLoading}
            >
              <Text style={styles.buttonText}>
                Se connecter
              </Text>
            </TouchableOpacity>

            <View style={styles.registerContainer}>
              <Text style={styles.registerText}>Pas encore de compte ? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={styles.registerLink}>S'inscrire</Text>
              </TouchableOpacity>
            </View>

            {/* Mot de passe oublié */}
            <View style={styles.forgotPasswordContainer}>
              <TouchableOpacity 
                onPress={() => setShowForgotPassword(!showForgotPassword)}
                style={styles.forgotPasswordButton}
              >
                <Text style={styles.forgotPasswordText}>🔑 Mot de passe oublié ?</Text>
              </TouchableOpacity>

              {showForgotPassword && (
                <View style={styles.forgotPasswordForm}>
                  <Text style={styles.forgotPasswordDescription}>
                    Entrez votre adresse email pour recevoir un lien de réinitialisation
                  </Text>
                  
                  <View style={styles.inputContainer}>
                    <Ionicons name="mail-outline" size={20} color="#9ca3af" />
                    <TextInput
                      style={styles.input}
                      placeholder="votre@email.com"
                      placeholderTextColor="#6b7280"
                      value={forgotPasswordEmail}
                      onChangeText={setForgotPasswordEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>

                  <TouchableOpacity
                    onPress={handleForgotPassword}
                    disabled={forgotPasswordLoading}
                    style={styles.forgotPasswordButton}
                  >
                    {forgotPasswordLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="mail" size={18} color="#fff" />
                        <Text style={styles.forgotPasswordButtonText}>
                          Envoyer le lien de réinitialisation
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      <LanguageSelectorModal
        visible={showLanguageSelector}
        onSelect={handleLanguageSelected}
      />

      <TermsAudioModal
        visible={showTermsModal}
        onSelectOption={handleTermsSelection}
      />
    </KeyboardAvoidingView>
  );
};
