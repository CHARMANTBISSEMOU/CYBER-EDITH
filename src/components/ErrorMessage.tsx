import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, onRetry }) => {
  return (
    <View className="flex-1 justify-center items-center bg-dark-bg px-6">
      <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
      <Text className="text-white text-lg font-semibold mt-4 text-center">{message}</Text>
      {onRetry && (
        <TouchableOpacity
          onPress={onRetry}
          className="bg-primary mt-6 px-6 py-3 rounded-lg"
        >
          <Text className="text-white font-semibold">Réessayer</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};
