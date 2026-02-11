import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ScreenHeaderProps {
  title: string;
  onBack: () => void;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({ title, onBack }) => {
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 48, paddingBottom: 16, backgroundColor: '#1e293b' }}>
      <TouchableOpacity
        onPress={onBack}
        style={{ marginBottom: 8 }}
      >
        <Ionicons name="arrow-back" size={28} color="#fff" />
      </TouchableOpacity>
      <Text style={{ color: '#fff', fontSize: 24, fontWeight: 'bold' }}>{title}</Text>
    </View>
  );
};
