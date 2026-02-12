import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { SimpleButton, SimpleCard, SimpleInput } from '../components/ui';
import { COLORS, SPACING, TYPOGRAPHY } from '../constants/designTokens';

export const SimpleDesignDemo = () => {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background.secondary }}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background.secondary} />
      
      <ScrollView contentContainerStyle={{ padding: SPACING.lg }}>
        {/* Header */}
        <View style={{ marginBottom: SPACING.xl }}>
          <Text style={{
            fontSize: 30,
            fontWeight: '700',
            color: COLORS.text.primary,
            marginBottom: SPACING.sm,
            fontFamily: TYPOGRAPHY.fontFamily.primary,
          }}>
            Nouveau Design System
          </Text>
          <Text style={{
            fontSize: 16,
            color: COLORS.text.secondary,
            fontFamily: TYPOGRAPHY.fontFamily.primary,
          }}>
            Composants UI modernes et fonctionnels
          </Text>
        </View>

        {/* Buttons Section */}
        <SimpleCard variant="elevated" style={{ marginBottom: SPACING.lg }}>
          <Text style={{
            fontSize: 18,
            fontWeight: '600',
            color: COLORS.text.primary,
            marginBottom: SPACING.md,
            fontFamily: TYPOGRAPHY.fontFamily.primary,
          }}>
            Buttons
          </Text>
          
          <View style={{ gap: SPACING.md }}>
            <SimpleButton title="Bouton Primaire" variant="primary" onPress={() => console.log('Primary')} />
            <SimpleButton title="Bouton Secondaire" variant="secondary" onPress={() => console.log('Secondary')} />
            <SimpleButton title="Bouton Outline" variant="outline" onPress={() => console.log('Outline')} />
            <SimpleButton title="Chargement..." loading onPress={() => console.log('Loading')} />
            <SimpleButton title="Désactivé" disabled onPress={() => console.log('Disabled')} />
          </View>
        </SimpleCard>

        {/* Inputs Section */}
        <SimpleCard variant="elevated" style={{ marginBottom: SPACING.lg }}>
          <Text style={{
            fontSize: 18,
            fontWeight: '600',
            color: COLORS.text.primary,
            marginBottom: SPACING.md,
            fontFamily: TYPOGRAPHY.fontFamily.primary,
          }}>
            Champs de saisie
          </Text>
          
          <View style={{ gap: SPACING.md }}>
            <SimpleInput
              label="Email"
              placeholder="Entrez votre email"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            
            <SimpleInput
              label="Mot de passe"
              placeholder="Entrez votre mot de passe"
              secureTextEntry
            />
            
            <SimpleInput
              label="Avec erreur"
              placeholder="Ce champ est invalide"
              error="Veuillez remplir ce champ"
            />
            
            <SimpleInput
              label="Texte d'aide"
              placeholder="Information supplémentaire"
              helperText="Ceci est un texte d'aide"
            />
          </View>
        </SimpleCard>

        {/* Cards Section */}
        <SimpleCard variant="elevated" style={{ marginBottom: SPACING.lg }}>
          <Text style={{
            fontSize: 18,
            fontWeight: '600',
            color: COLORS.text.primary,
            marginBottom: SPACING.md,
            fontFamily: TYPOGRAPHY.fontFamily.primary,
          }}>
            Cards
          </Text>
          
          <View style={{ gap: SPACING.md }}>
            <SimpleCard variant="default">
              <Text style={{
                fontSize: 16,
                color: COLORS.text.primary,
                fontFamily: TYPOGRAPHY.fontFamily.primary,
              }}>
                Card par défaut
              </Text>
            </SimpleCard>
            
            <SimpleCard variant="elevated">
              <Text style={{
                fontSize: 16,
                color: COLORS.text.primary,
                fontFamily: TYPOGRAPHY.fontFamily.primary,
              }}>
                Card avec élévation
              </Text>
            </SimpleCard>
            
            <SimpleCard variant="outlined">
              <Text style={{
                fontSize: 16,
                color: COLORS.text.primary,
                fontFamily: TYPOGRAPHY.fontFamily.primary,
              }}>
                Card avec contour
              </Text>
            </SimpleCard>
          </View>
        </SimpleCard>

        {/* Colors Demo */}
        <SimpleCard variant="elevated" style={{ marginBottom: SPACING.lg }}>
          <Text style={{
            fontSize: 18,
            fontWeight: '600',
            color: COLORS.text.primary,
            marginBottom: SPACING.md,
            fontFamily: TYPOGRAPHY.fontFamily.primary,
          }}>
            Palette de couleurs
          </Text>
          
          <View style={{ gap: SPACING.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}>
              <View style={{ 
                width: 40, 
                height: 40, 
                backgroundColor: COLORS.primary[600], 
                borderRadius: 8 
              }} />
              <Text style={{ fontFamily: TYPOGRAPHY.fontFamily.primary }}>Bleu Primaire</Text>
            </View>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}>
              <View style={{ 
                width: 40, 
                height: 40, 
                backgroundColor: COLORS.accent[500], 
                borderRadius: 8 
              }} />
              <Text style={{ fontFamily: TYPOGRAPHY.fontFamily.primary }}>Orange Accent</Text>
            </View>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}>
              <View style={{ 
                width: 40, 
                height: 40, 
                backgroundColor: COLORS.success[500], 
                borderRadius: 8 
              }} />
              <Text style={{ fontFamily: TYPOGRAPHY.fontFamily.primary }}>Vert Succès</Text>
            </View>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}>
              <View style={{ 
                width: 40, 
                height: 40, 
                backgroundColor: COLORS.error[500], 
                borderRadius: 8 
              }} />
              <Text style={{ fontFamily: TYPOGRAPHY.fontFamily.primary }}>Rouge Erreur</Text>
            </View>
          </View>
        </SimpleCard>

        {/* Test Button */}
        <SimpleButton 
          title="Tester le design" 
          variant="primary" 
          fullWidth
          onPress={() => console.log('Design testé!')}
        />
      </ScrollView>
    </SafeAreaView>
  );
};
