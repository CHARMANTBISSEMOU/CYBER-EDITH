import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  BackHandler,
} from 'react-native';
import * as Speech from 'expo-speech';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '../i18n/useTranslation';
import { useLanguageStore } from '../store/languageStore';

interface TermsAudioModalProps {
  visible: boolean;
  onSelectOption: (option: 'A' | 'B') => void;
}

export const TermsAudioModal: React.FC<TermsAudioModalProps> = ({
  visible,
  onSelectOption,
}) => {
  const { t, language } = useTranslation();
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasFinished, setHasFinished] = useState(false);
  const [buttonsEnabled, setButtonsEnabled] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [bestVoice, setBestVoice] = useState<string | undefined>(undefined);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const guideSections = [
    { icon: 'search' as const, title: t('termsStep1Title'), text: t('termsStep1Text') },
    { icon: 'chatbubbles' as const, title: t('termsStep2Title'), text: t('termsStep2Text') },
    { icon: 'document-text' as const, title: t('termsStep3Title'), text: t('termsStep3Text') },
    { icon: 'notifications' as const, title: t('termsStep4Title'), text: t('termsStep4Text') },
  ];

  const conditions = [
    t('termsCond1'), t('termsCond2'), t('termsCond3'), t('termsCond4'),
    t('termsCond5'), t('termsCond6'), t('termsCond7'),
  ];

  const pricingDetails = [
    { title: t('termsPricingOwner'), price: t('termsPricingOwnerPrice'), desc: t('termsPricingOwnerDesc'), icon: 'home' as const, color: '#3b82f6' },
    { title: t('termsPricingVisitor'), price: t('termsPricingVisitorPrice'), desc: t('termsPricingVisitorDesc'), icon: 'person' as const, color: '#8b5cf6' },
    { title: t('termsPricingService'), price: t('termsPricingServicePrice'), desc: t('termsPricingServiceDesc'), icon: 'cash' as const, color: '#10b981' },
  ];

  useEffect(() => {
    const findBestVoice = async () => {
      try {
        const voices = await Speech.getAvailableVoicesAsync();
        const langPrefix = language === 'en' ? 'en' : 'fr';
        const langVoices = voices.filter(v => v.language.startsWith(langPrefix));
        const maleNames = language === 'en'
          ? ['daniel', 'james', 'david', 'male']
          : ['thomas', 'pierre', 'nicolas', 'jean', 'louis', 'antoine', 'henri', 'male'];
        const qualityKeys = ['enhanced', 'premium', 'neural', 'hq', 'wavenet'];

        let preferred = langVoices.find(v => {
          const id = v.identifier.toLowerCase();
          return maleNames.some(n => id.includes(n)) && qualityKeys.some(q => id.includes(q));
        });
        if (!preferred) {
          preferred = langVoices.find(v => {
            const id = v.identifier.toLowerCase();
            return maleNames.some(n => id.includes(n));
          });
        }
        if (!preferred) {
          preferred = langVoices.find(v => {
            const id = v.identifier.toLowerCase();
            return qualityKeys.some(q => id.includes(q));
          });
        }
        if (preferred) {
          setBestVoice(preferred.identifier);
        } else if (langVoices.length > 0) {
          setBestVoice(langVoices[0].identifier);
        }
      } catch (e) {
        console.log('Pas de voix disponibles');
      }
    };
    findBestVoice();
  }, [language]);

  useEffect(() => {
    if (visible && !hasFinished) {
      startAudioAndTimer();
    }
    return () => {
      Speech.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [visible]);

  const startAudioAndTimer = async () => {
    setIsPlaying(true);
    setButtonsEnabled(false);
    setCountdown(30);

    const speechOptions: Speech.SpeechOptions = {
      language: language === 'en' ? 'en-US' : 'fr-FR',
      pitch: 0.85,
      rate: 0.95,
      onDone: () => {
        setIsPlaying(false);
        setHasFinished(true);
        setButtonsEnabled(true);
        setCountdown(0);
      },
      onError: () => {
        setIsPlaying(false);
        setHasFinished(true);
        setButtonsEnabled(true);
        setCountdown(0);
      },
    };
    if (bestVoice) {
      speechOptions.voice = bestVoice;
    }

    Speech.speak(t('termsAudioText'), speechOptions);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
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
      if (timerRef.current) clearInterval(timerRef.current);
      onSelectOption(option);
    }
  };

  const replayAudio = () => {
    Speech.stop();
    if (timerRef.current) clearInterval(timerRef.current);
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
      <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 50, paddingBottom: 30 }}>
          {/* Header */}
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <Image
              source={require('../assets/logoapp.png')}
              style={{ width: 70, height: 70, borderRadius: 16, marginBottom: 12 }}
              resizeMode="contain"
            />
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700', textAlign: 'center' }}>
              {t('termsWelcome')}
            </Text>
            <Text style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', marginTop: 4 }}>
              {t('termsSubtitle')}
            </Text>
          </View>

          {/* Audio indicator */}
          {isPlaying && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16, backgroundColor: '#1e3a5f', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 }}>
              <ActivityIndicator size="small" color="#3b82f6" />
              <Text style={{ color: '#93c5fd', fontSize: 14, marginLeft: 10 }}>{t('termsAudioPlaying')}</Text>
            </View>
          )}
          {!buttonsEnabled && countdown > 0 && !isPlaying && (
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ color: '#94a3b8', fontSize: 13 }}>
                {t('termsCountdown')} {countdown}s
              </Text>
            </View>
          )}

          {/* Guide */}
          <Text style={{ color: '#3b82f6', fontSize: 16, fontWeight: '700', marginBottom: 12 }}>
            {t('termsHowTo')}
          </Text>
          {guideSections.map((section, idx) => (
            <View key={idx} style={{ flexDirection: 'row', marginBottom: 14, backgroundColor: '#1e293b', borderRadius: 12, padding: 14 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#3b82f620', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Ionicons name={section.icon} size={20} color="#3b82f6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 3 }}>{section.title}</Text>
                <Text style={{ color: '#94a3b8', fontSize: 13, lineHeight: 19 }}>{section.text}</Text>
              </View>
            </View>
          ))}

          {/* Conditions */}
          <Text style={{ color: '#f59e0b', fontSize: 16, fontWeight: '700', marginTop: 10, marginBottom: 12 }}>
            {t('termsConditionsTitle')}
          </Text>
          <View style={{ backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#334155' }}>
            {conditions.map((term, idx) => (
              <View key={idx} style={{ flexDirection: 'row', marginBottom: idx < conditions.length - 1 ? 12 : 0 }}>
                <Ionicons name="checkmark-circle" size={18} color="#10b981" style={{ marginTop: 1, marginRight: 10 }} />
                <Text style={{ color: '#e2e8f0', fontSize: 13, lineHeight: 19, flex: 1 }}>{term}</Text>
              </View>
            ))}
          </View>

          {/* Replay */}
          {hasFinished && (
            <TouchableOpacity
              onPress={replayAudio}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, marginBottom: 16 }}
            >
              <Ionicons name="refresh" size={18} color="#3b82f6" />
              <Text style={{ color: '#3b82f6', fontSize: 14, fontWeight: '600', marginLeft: 8 }}>{t('termsReplay')}</Text>
            </TouchableOpacity>
          )}

          {/* Pricing */}
          <Text style={{ color: '#10b981', fontSize: 16, fontWeight: '700', marginTop: 6, marginBottom: 12 }}>
            {t('termsPricing')}
          </Text>
          {pricingDetails.map((item, idx) => (
            <View key={idx} style={{ flexDirection: 'row', marginBottom: 12, backgroundColor: '#1e293b', borderRadius: 12, padding: 14, borderLeftWidth: 3, borderLeftColor: item.color }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: item.color + '20', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Ionicons name={item.icon} size={20} color={item.color} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{item.title}</Text>
                  <Text style={{ color: item.color, fontSize: 13, fontWeight: '700' }}>{item.price}</Text>
                </View>
                <Text style={{ color: '#94a3b8', fontSize: 12, lineHeight: 17 }}>{item.desc}</Text>
              </View>
            </View>
          ))}

          {/* Anti-cheat GPS */}
          <View style={{ backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginTop: 4, marginBottom: 20, borderWidth: 1, borderColor: '#ef444440' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="shield-checkmark" size={22} color="#ef4444" />
              <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: '700', marginLeft: 8 }}>{t('termsAntiCheatTitle')}</Text>
            </View>
            <Text style={{ color: '#e2e8f0', fontSize: 13, lineHeight: 19 }}>
              {t('termsAntiCheatDesc')}
            </Text>
          </View>

          {/* Accept / Refuse */}
          <TouchableOpacity
            onPress={() => handleSelectOption('A')}
            disabled={!buttonsEnabled}
            style={{
              borderRadius: 14, padding: 16,
              backgroundColor: buttonsEnabled ? '#10b981' : '#374151',
              marginBottom: 12, alignItems: 'center',
              opacity: buttonsEnabled ? 1 : 0.5,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="checkmark-circle" size={22} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginLeft: 10 }}>
                {t('termsAccept')}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              Speech.stop();
              if (timerRef.current) clearInterval(timerRef.current);
              BackHandler.exitApp();
            }}
            disabled={!buttonsEnabled}
            style={{
              borderRadius: 14, padding: 16,
              backgroundColor: 'transparent', borderWidth: 2,
              borderColor: buttonsEnabled ? '#ef4444' : '#4b5563',
              marginBottom: 16, alignItems: 'center',
              opacity: buttonsEnabled ? 1 : 0.5,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="close-circle" size={22} color={buttonsEnabled ? '#ef4444' : '#6b7280'} />
              <Text style={{ color: buttonsEnabled ? '#ef4444' : '#6b7280', fontSize: 16, fontWeight: '700', marginLeft: 10 }}>
                {t('termsRefuse')}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Warning */}
          {!buttonsEnabled && (
            <View style={{ backgroundColor: 'rgba(234,179,8,0.1)', borderWidth: 1, borderColor: 'rgba(234,179,8,0.3)', borderRadius: 10, padding: 14, flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="information-circle" size={20} color="#eab308" />
              <Text style={{ color: '#eab308', fontSize: 13, marginLeft: 10, flex: 1 }}>
                {t('termsListenFirst')}
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};
