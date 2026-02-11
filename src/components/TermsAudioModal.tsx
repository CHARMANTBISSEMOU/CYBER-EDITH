import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import * as Speech from 'expo-speech';
import { Ionicons } from '@expo/vector-icons';

interface TermsAudioModalProps {
  visible: boolean;
  onSelectOption: (option: 'A' | 'B') => void;
}

const TERMS_TEXT = `Bienvenue. Avant de commencer, écoutez attentivement nos conditions en quelques secondes. L'application vous propose deux choix. L'option A : vous payez après chaque service rendu. Cette option inclut le suivi GPS en temps réel de votre position pour garantir la qualité du service. L'option B : vous choisissez un abonnement annuel fixe. Cette option respecte votre totale vie privée sans aucun suivi GPS. Pour continuer, choisissez votre option.`;

export const TermsAudioModal: React.FC<TermsAudioModalProps> = ({
  visible,
  onSelectOption,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasFinished, setHasFinished] = useState(false);
  const [buttonsEnabled, setButtonsEnabled] = useState(false);
  const [countdown, setCountdown] = useState(20);

  useEffect(() => {
    if (visible && !hasFinished) {
      startAudioAndTimer();
    }

    return () => {
      Speech.stop();
    };
  }, [visible]);

  const startAudioAndTimer = async () => {
    setIsPlaying(true);
    setButtonsEnabled(false);
    setCountdown(20);

    Speech.speak(TERMS_TEXT, {
      language: 'fr-FR',
      pitch: 1.0,
      rate: 0.9,
      onDone: () => {
        setIsPlaying(false);
        setHasFinished(true);
        setButtonsEnabled(true);
      },
      onError: () => {
        setIsPlaying(false);
        setHasFinished(true);
        setButtonsEnabled(true);
      },
    });

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setButtonsEnabled(true);
          setHasFinished(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSelectOption = (option: 'A' | 'B') => {
    if (buttonsEnabled) {
      Speech.stop();
      onSelectOption(option);
    }
  };

  const replayAudio = () => {
    Speech.stop();
    setHasFinished(false);
    startAudioAndTimer();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={() => {}}
    >
      <View className="flex-1 bg-dark-bg">
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <View className="flex-1 px-6 pt-16 pb-8">
            <View className="items-center mb-8">
              <View className="w-20 h-20 bg-primary rounded-full items-center justify-center mb-4">
                <Ionicons name="volume-high" size={40} color="#fff" />
              </View>
              <Text className="text-white text-2xl font-bold text-center mb-2">
                Conditions d'Utilisation
              </Text>
              {isPlaying && (
                <View className="flex-row items-center mt-2">
                  <ActivityIndicator size="small" color="#3b82f6" />
                  <Text className="text-primary ml-2">Lecture en cours...</Text>
                </View>
              )}
              {!buttonsEnabled && countdown > 0 && (
                <Text className="text-gray-400 mt-2">
                  Boutons disponibles dans {countdown}s
                </Text>
              )}
            </View>

            <View className="bg-dark-card rounded-xl p-6 mb-6">
              <Text className="text-white text-base leading-7 text-justify">
                {TERMS_TEXT}
              </Text>
            </View>

            {hasFinished && (
              <TouchableOpacity
                onPress={replayAudio}
                className="flex-row items-center justify-center mb-6 py-3"
              >
                <Ionicons name="refresh" size={20} color="#3b82f6" />
                <Text className="text-primary ml-2 font-medium">
                  Réécouter les conditions
                </Text>
              </TouchableOpacity>
            )}

            <View className="space-y-4 mt-auto">
              <TouchableOpacity
                onPress={() => handleSelectOption('A')}
                disabled={!buttonsEnabled}
                className={`rounded-xl p-5 border-2 ${
                  buttonsEnabled
                    ? 'bg-primary border-primary'
                    : 'bg-gray-700 border-gray-600'
                }`}
              >
                <View className="flex-row items-center mb-2">
                  <View className="w-10 h-10 bg-white/20 rounded-full items-center justify-center mr-3">
                    <Text className="text-white font-bold text-lg">A</Text>
                  </View>
                  <Text
                    className={`text-lg font-bold flex-1 ${
                      buttonsEnabled ? 'text-white' : 'text-gray-500'
                    }`}
                  >
                    Paiement à l'acte + GPS
                  </Text>
                  <Ionicons
                    name="location"
                    size={24}
                    color={buttonsEnabled ? '#fff' : '#6b7280'}
                  />
                </View>
                <Text
                  className={`text-sm ${
                    buttonsEnabled ? 'text-white/80' : 'text-gray-500'
                  }`}
                >
                  Payez après chaque service rendu. Suivi GPS en temps réel pour
                  garantir la qualité du service.
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleSelectOption('B')}
                disabled={!buttonsEnabled}
                className={`rounded-xl p-5 border-2 ${
                  buttonsEnabled
                    ? 'bg-green-600 border-green-600'
                    : 'bg-gray-700 border-gray-600'
                }`}
              >
                <View className="flex-row items-center mb-2">
                  <View className="w-10 h-10 bg-white/20 rounded-full items-center justify-center mr-3">
                    <Text className="text-white font-bold text-lg">B</Text>
                  </View>
                  <Text
                    className={`text-lg font-bold flex-1 ${
                      buttonsEnabled ? 'text-white' : 'text-gray-500'
                    }`}
                  >
                    Abonnement annuel + Privé
                  </Text>
                  <Ionicons
                    name="shield-checkmark"
                    size={24}
                    color={buttonsEnabled ? '#fff' : '#6b7280'}
                  />
                </View>
                <Text
                  className={`text-sm ${
                    buttonsEnabled ? 'text-white/80' : 'text-gray-500'
                  }`}
                >
                  Abonnement annuel fixe. Respect total de votre vie privée sans
                  aucun suivi GPS.
                </Text>
              </TouchableOpacity>
            </View>

            {!buttonsEnabled && (
              <View className="mt-6 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <View className="flex-row items-center">
                  <Ionicons name="information-circle" size={20} color="#eab308" />
                  <Text className="text-yellow-500 ml-2 text-sm">
                    Veuillez écouter les conditions avant de continuer
                  </Text>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};
