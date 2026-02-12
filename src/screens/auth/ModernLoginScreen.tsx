import React, { useState } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  StatusBar,
  ImageBackground,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Input } from '../../components/ui';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../../constants/designTokens';

export const ModernLoginScreen = ({ navigation }: any) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    setIsLoading(true);
    try {
      // Simuler une connexion
      await new Promise(resolve => setTimeout(resolve, 2000));
      Alert.alert('Succès', 'Connexion réussie!');
      navigation.navigate('HomeTabs');
    } catch (error) {
      Alert.alert('Erreur', 'Échec de la connexion');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ImageBackground
      source={{ uri: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80' }}
      style={{ flex: 1 }}
      resizeMode="cover"
    >
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary[600]} />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Section */}
          <View style={{ 
            flex: 1,
            justifyContent: 'center',
            paddingHorizontal: SPACING.lg,
            paddingTop: SPACING.xxl,
          }}>
            
            {/* Logo/Brand Section */}
            <View style={{ alignItems: 'center', marginBottom: SPACING.xxl }}>
              <View style={{
                width: 80,
                height: 80,
                backgroundColor: COLORS.background.primary,
                borderRadius: BORDER_RADIUS['2xl'],
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: SPACING.md,
                ...SHADOWS.lg,
              }}>
                <Ionicons name="home" size={40} color={COLORS.primary[600]} />
              </View>
              
              <Text style={{
                fontSize: TYPOGRAPHY.fontSize['3xl'],
                fontWeight: '700' as const,
                color: COLORS.text.inverse,
                marginBottom: SPACING.xs,
                fontFamily: TYPOGRAPHY.fontFamily.primary,
              }}>
                Bienvenue
              </Text>
              
              <Text style={{
                fontSize: TYPOGRAPHY.fontSize.base,
                color: COLORS.text.inverse,
                opacity: 0.9,
                textAlign: 'center',
                fontFamily: TYPOGRAPHY.fontFamily.primary,
              }}>
                Connectez-vous pour accéder à votre espace immobilier
              </Text>
            </View>

            {/* Login Form Card */}
            <Card variant="elevated" style={{ marginBottom: SPACING.lg }}>
              <View style={{ marginBottom: SPACING.lg }}>
                <Text style={{
                  fontSize: TYPOGRAPHY.fontSize.lg,
                  fontWeight: '600' as const,
                  color: COLORS.text.primary,
                  marginBottom: SPACING.md,
                  fontFamily: TYPOGRAPHY.fontFamily.primary,
                }}>
                  Connexion
                </Text>
              </View>

              {/* Email Input */}
              <Input
                label="Adresse email"
                placeholder="exemple@email.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                leftIcon={<Ionicons name="mail" size={20} color={COLORS.neutral[400]} />}
                style={{ marginBottom: SPACING.md }}
              />

              {/* Password Input */}
              <Input
                label="Mot de passe"
                placeholder="Entrez votre mot de passe"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                leftIcon={<Ionicons name="lock-closed" size={20} color={COLORS.neutral[400]} />}
                rightIcon={
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons 
                      name={showPassword ? "eye-off" : "eye"} 
                      size={20} 
                      color={COLORS.neutral[400]} 
                    />
                  </TouchableOpacity>
                }
                style={{ marginBottom: SPACING.lg }}
              />

              {/* Forgot Password Link */}
              <View style={{ alignItems: 'flex-end', marginBottom: SPACING.lg }}>
                <TouchableOpacity onPress={() => navigation.navigate('ResetPassword')}>
                  <Text style={{
                    fontSize: TYPOGRAPHY.fontSize.sm,
                    color: COLORS.primary[600],
                    fontWeight: '500' as const,
                    fontFamily: TYPOGRAPHY.fontFamily.primary,
                  }}>
                    Mot de passe oublié?
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Login Button */}
              <Button
                title="Se connecter"
                onPress={handleLogin}
                loading={isLoading}
                fullWidth
                size="lg"
              />
            </Card>

            {/* Register Link */}
            <View style={{ alignItems: 'center' }}>
              <Text style={{
                fontSize: TYPOGRAPHY.fontSize.base,
                color: COLORS.text.inverse,
                fontFamily: TYPOGRAPHY.fontFamily.primary,
              }}>
                Vous n'avez pas de compte?{' '}
                <Text 
                  style={{ 
                    color: COLORS.accent[400], 
                    fontWeight: '600' as const 
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
    </ImageBackground>
  );
};
