import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { Button, Card, Input } from '../components/ui';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../constants/designTokens';
import { Ionicons } from '@expo/vector-icons';

export const DesignDemoScreen = () => {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background.secondary }}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background.secondary} />
      
      <ScrollView contentContainerStyle={{ padding: SPACING.lg }}>
        {/* Header */}
        <View style={{ marginBottom: SPACING.xl }}>
          <Text style={{
            fontSize: TYPOGRAPHY.fontSize['3xl'],
            fontWeight: '700' as const,
            color: COLORS.text.primary,
            marginBottom: SPACING.sm,
            fontFamily: TYPOGRAPHY.fontFamily.primary,
          }}>
            Design System Demo
          </Text>
          <Text style={{
            fontSize: TYPOGRAPHY.fontSize.base,
            color: COLORS.text.secondary,
            fontFamily: TYPOGRAPHY.fontFamily.primary,
          }}>
            Voici les nouveaux composants UI modernes
          </Text>
        </View>

        {/* Buttons Section */}
        <Card variant="elevated" style={{ marginBottom: SPACING.lg }}>
          <Text style={{
            fontSize: TYPOGRAPHY.fontSize.lg,
            fontWeight: '600' as const,
            color: COLORS.text.primary,
            marginBottom: SPACING.md,
            fontFamily: TYPOGRAPHY.fontFamily.primary,
          }}>
            Buttons
          </Text>
          
          <View style={{ gap: SPACING.md }}>
            <Button title="Primary Button" variant="primary" onPress={() => console.log('Primary pressed')} />
            <Button title="Secondary Button" variant="secondary" onPress={() => console.log('Secondary pressed')} />
            <Button title="Outline Button" variant="outline" onPress={() => console.log('Outline pressed')} />
            <Button title="Ghost Button" variant="ghost" onPress={() => console.log('Ghost pressed')} />
            <Button title="Loading Button" loading onPress={() => console.log('Loading pressed')} />
            <Button title="Disabled Button" disabled onPress={() => console.log('Disabled pressed')} />
          </View>
        </Card>

        {/* Inputs Section */}
        <Card variant="elevated" style={{ marginBottom: SPACING.lg }}>
          <Text style={{
            fontSize: TYPOGRAPHY.fontSize.lg,
            fontWeight: '600' as const,
            color: COLORS.text.primary,
            marginBottom: SPACING.md,
            fontFamily: TYPOGRAPHY.fontFamily.primary,
          }}>
            Inputs
          </Text>
          
          <View style={{ gap: SPACING.md }}>
            <Input
              label="Email"
              placeholder="Entrez votre email"
              leftIcon={<Ionicons name="mail" size={20} color={COLORS.neutral[400]} />}
            />
            
            <Input
              label="Mot de passe"
              placeholder="Entrez votre mot de passe"
              secureTextEntry
              leftIcon={<Ionicons name="lock-closed" size={20} color={COLORS.neutral[400]} />}
            />
            
            <Input
              label="Avec erreur"
              placeholder="Champ invalide"
              error="Ce champ est requis"
              leftIcon={<Ionicons name="alert-circle" size={20} color={COLORS.error[500]} />}
            />
            
            <Input
              label="Désactivé"
              placeholder="Non modifiable"
              editable={false}
              leftIcon={<Ionicons name="lock-closed" size={20} color={COLORS.neutral[400]} />}
            />
          </View>
        </Card>

        {/* Cards Section */}
        <Card variant="elevated" style={{ marginBottom: SPACING.lg }}>
          <Text style={{
            fontSize: TYPOGRAPHY.fontSize.lg,
            fontWeight: '600' as const,
            color: COLORS.text.primary,
            marginBottom: SPACING.md,
            fontFamily: TYPOGRAPHY.fontFamily.primary,
          }}>
            Cards
          </Text>
          
          <View style={{ gap: SPACING.md }}>
            <Card variant="default">
              <Text style={{
                fontSize: TYPOGRAPHY.fontSize.base,
                color: COLORS.text.primary,
                fontFamily: TYPOGRAPHY.fontFamily.primary,
              }}>
                Default Card
              </Text>
            </Card>
            
            <Card variant="elevated">
              <Text style={{
                fontSize: TYPOGRAPHY.fontSize.base,
                color: COLORS.text.primary,
                fontFamily: TYPOGRAPHY.fontFamily.primary,
              }}>
                Elevated Card
              </Text>
            </Card>
            
            <Card variant="outlined">
              <Text style={{
                fontSize: TYPOGRAPHY.fontSize.base,
                color: COLORS.text.primary,
                fontFamily: TYPOGRAPHY.fontFamily.primary,
              }}>
                Outlined Card
              </Text>
            </Card>
          </View>
        </Card>

        {/* Colors Section */}
        <Card variant="elevated" style={{ marginBottom: SPACING.lg }}>
          <Text style={{
            fontSize: TYPOGRAPHY.fontSize.lg,
            fontWeight: '600' as const,
            color: COLORS.text.primary,
            marginBottom: SPACING.md,
            fontFamily: TYPOGRAPHY.fontFamily.primary,
          }}>
            Color Palette
          </Text>
          
          <View style={{ gap: SPACING.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}>
              <View style={{ 
                width: 40, 
                height: 40, 
                backgroundColor: COLORS.primary[600], 
                borderRadius: BORDER_RADIUS.md 
              }} />
              <Text style={{ fontFamily: TYPOGRAPHY.fontFamily.primary }}>Primary Blue</Text>
            </View>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}>
              <View style={{ 
                width: 40, 
                height: 40, 
                backgroundColor: COLORS.accent[500], 
                borderRadius: BORDER_RADIUS.md 
              }} />
              <Text style={{ fontFamily: TYPOGRAPHY.fontFamily.primary }}>Accent Orange</Text>
            </View>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}>
              <View style={{ 
                width: 40, 
                height: 40, 
                backgroundColor: COLORS.success[500], 
                borderRadius: BORDER_RADIUS.md 
              }} />
              <Text style={{ fontFamily: TYPOGRAPHY.fontFamily.primary }}>Success Green</Text>
            </View>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}>
              <View style={{ 
                width: 40, 
                height: 40, 
                backgroundColor: COLORS.error[500], 
                borderRadius: BORDER_RADIUS.md 
              }} />
              <Text style={{ fontFamily: TYPOGRAPHY.fontFamily.primary }}>Error Red</Text>
            </View>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};
