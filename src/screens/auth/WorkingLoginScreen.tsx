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
  StatusBar,
  SafeAreaView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SimpleButton, SimpleCard, SimpleInput } from '../../components/ui';
import { COLORS, SPACING, TYPOGRAPHY } from '../../constants/designTokens';
import { useAuthStore } from '../../store/authStore';

export const WorkingLoginScreen = ({ navigation }: any) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading } = useAuthStore();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    try {
      await login({ email, mot_de_passe: password });
      navigation.navigate('HomeTabs');
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Échec de la connexion';
      Alert.alert('Erreur', errorMessage);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background.secondary }}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background.secondary} />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            {/* Header */}
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{
                width: 48,
                height: 48,
                backgroundColor: COLORS.background.primary,
                borderRadius: 8,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 8,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 2,
                overflow: 'hidden',
              }}>
                <Image 
                  source={require('../../assets/logoapp.png')} 
                  style={{ 
                    width: '100%', 
                    height: '100%',
                    resizeMode: 'contain',
                  }}
                />
              </View>
              
              <Text style={{
                fontSize: 16,
                fontWeight: '700',
                color: COLORS.text.primary,
                marginBottom: 2,
                fontFamily: TYPOGRAPHY.fontFamily.primary,
                textAlign: 'center',
              }}>
                Bienvenue
              </Text>
              
              <Text style={{
                fontSize: 10,
                color: COLORS.text.secondary,
                textAlign: 'center',
                fontFamily: TYPOGRAPHY.fontFamily.primary,
              }}>
                Connectez-vous pour accéder à votre espace
              </Text>
            </View>

            {/* Login Form */}
            <SimpleCard variant="elevated" style={{ marginBottom: 12 }}>
              <Text style={{
                fontSize: 14,
                fontWeight: '600',
                color: COLORS.text.primary,
                marginBottom: 12,
                fontFamily: TYPOGRAPHY.fontFamily.primary,
              }}>
                Connexion
              </Text>

              <SimpleInput
                label="Email"
                placeholder="Entrez votre email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <SimpleInput
                label="Mot de passe"
                placeholder="Entrez votre mot de passe"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              <View style={{ alignItems: 'flex-end', marginBottom: 12 }}>
                <TouchableOpacity onPress={() => navigation.navigate('ResetPassword')}>
                  <Text style={{
                    fontSize: 10,
                    color: COLORS.primary[600],
                    fontWeight: '500',
                    fontFamily: TYPOGRAPHY.fontFamily.primary,
                  }}>
                    Mot de passe oublié?
                  </Text>
                </TouchableOpacity>
              </View>

              <SimpleButton
                title="Se connecter"
                onPress={handleLogin}
                loading={isLoading}
                fullWidth
                size="sm"
              />
            </SimpleCard>

            {/* Register Link */}
            <View style={{ alignItems: 'center' }}>
              <Text style={{
                fontSize: 10,
                color: COLORS.text.primary,
                fontFamily: TYPOGRAPHY.fontFamily.primary,
              }}>
                Pas de compte?{' '}
                <Text 
                  style={{ 
                    color: COLORS.accent[500], 
                    fontWeight: '600' 
                  }}
                  onPress={() => navigation.navigate('Register')}
                >
                  S'inscrire
                </Text>
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};
