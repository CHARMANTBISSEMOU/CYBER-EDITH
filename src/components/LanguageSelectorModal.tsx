import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Language } from '../store/languageStore';

interface LanguageSelectorModalProps {
  visible: boolean;
  onSelect: (lang: Language) => void;
}

export const LanguageSelectorModal: React.FC<LanguageSelectorModalProps> = ({
  visible,
  onSelect,
}) => {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={() => {}}
    >
      <View style={{ flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <Image
          source={require('../assets/logoapp.png')}
          style={{ width: 90, height: 90, borderRadius: 20, marginBottom: 24 }}
          resizeMode="contain"
        />

        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 4 }}>
          Choisissez votre langue
        </Text>
        <Text style={{ color: '#94a3b8', fontSize: 16, textAlign: 'center', marginBottom: 40 }}>
          Choose your language
        </Text>

        <TouchableOpacity
          onPress={() => onSelect('fr')}
          style={{
            width: '100%',
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#1e293b',
            padding: 20,
            borderRadius: 16,
            marginBottom: 16,
            borderWidth: 2,
            borderColor: '#3b82f6',
          }}
        >
          <Text style={{ fontSize: 32, marginRight: 16 }}>🇫🇷</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>Français</Text>
            <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 2 }}>Continuer en français</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#3b82f6" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onSelect('en')}
          style={{
            width: '100%',
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#1e293b',
            padding: 20,
            borderRadius: 16,
            borderWidth: 2,
            borderColor: '#10b981',
          }}
        >
          <Text style={{ fontSize: 32, marginRight: 16 }}>🇬🇧</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>English</Text>
            <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 2 }}>Continue in English</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#10b981" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
};
