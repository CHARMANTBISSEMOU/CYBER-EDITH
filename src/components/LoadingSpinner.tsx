import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';

interface LoadingSpinnerProps {
  message?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message = 'Chargement...' }) => {
  return (
    <View className="flex-1 justify-center items-center bg-dark-bg">
      <ActivityIndicator size="large" color="#3b82f6" />
      <Text className="text-white mt-4 text-base">{message}</Text>
    </View>
  );
};
