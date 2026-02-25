import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  Dimensions,
  ScrollView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '../../components/ScreenHeader';
import { messageApi } from '../../services/messageApi';
import { bienApi } from '../../services/bienApi';
import { useAuthStore } from '../../store/authStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const ChatScreen = ({ route, navigation }: any) => {
  const { id_interlocuteur, id_bien, nom_interlocuteur } = route.params;
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sentMessageTimestamps, setSentMessageTimestamps] = useState<number[]>([]); // Suivre les timestamps de nos messages
  const [bienDetails, setBienDetails] = useState<any>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [refuseModalVisible, setRefuseModalVisible] = useState(false);
  const [refuseReason, setRefuseReason] = useState('');
  const [contractStatus, setContractStatus] = useState<'pending' | 'accepted' | 'refused' | 'cancelled'>('pending');
  const [contractActionLoading, setContractActionLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadMessages();
    loadBienDetails();
    markAsRead();
    
    // Désactiver le polling pour éviter d'écraser nos messages temporaires
    // const interval = setInterval(() => {
    //   loadMessages(true);
    // }, 10000);

    return () => {}; // Pas de cleanup nécessaire
  }, []);

  const loadMessages = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await messageApi.getConversationHistory(id_interlocuteur, id_bien);
      const messages = response.messages || [];
      
      // Trier les messages par date (plus récent en bas)
      // Pas de logs pour éviter la pollution
      
      // Log la structure du premier message pour identifier les champs
      if (messages.length > 0) {
        console.log('📩 CLÉS message[0]:', Object.keys(messages[0]));
        console.log('📩 message[0]:', JSON.stringify(messages[0], null, 2));
        console.log('📩 Mon ID:', user?.id_utilisateur);
        console.log('📩 id_interlocuteur:', id_interlocuteur);
      }

      const sortedMessages = messages.sort((a: any, b: any) => {
        const dateA = a.date_envoi ? new Date(a.date_envoi).getTime() : 0;
        const dateB = b.date_envoi ? new Date(b.date_envoi).getTime() : 0;
        return dateA - dateB; // Plus ancien d'abord, plus récent à la fin
      });
      setMessages(sortedMessages);
    } catch (error: any) {
      if (!silent) {
        Alert.alert('Erreur', 'Impossible de charger les messages');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadBienDetails = async () => {
    try {
      const response = await bienApi.getBienById(id_bien);
      setBienDetails(response);
    } catch (error) {
      console.log('Erreur chargement détails bien:', error);
      // Ne pas afficher d'erreur, continuer sans les images
    }
  };

  const markAsRead = async () => {
    try {
      await messageApi.markAsRead(id_interlocuteur, id_bien);
    } catch (error) {
      // Erreur silencieuse pour le marquage lu
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    const messageText = newMessage.trim();
    const originalMessage = messageText;
    setNewMessage('');

    try {
      setSending(true);
      await messageApi.sendMessage(id_interlocuteur, id_bien, messageText, user?.id_utilisateur);
      
      // S'assurer que le champ est bien vide après envoi réussi
      setNewMessage('');
      
      // Enregistrer le timestamp de notre message envoyé
      const timestamp = Date.now();
      setSentMessageTimestamps(prev => [...prev, timestamp]);
      
      const tempMessage = {
        id_message: `sent_${timestamp}`,
        contenu: messageText,
        id_expediteur: user?.id_utilisateur,
        date_envoi: new Date(timestamp).toISOString(),
        lu: false,
      };
      setMessages([...messages, tempMessage]);
      
      // Ne pas recharger automatiquement pour garder nos messages avec le bon préfixe
      // setTimeout(() => loadMessages(true), 500);
    } catch (error: any) {
      // Pour les erreurs 422, le message est souvent quand même envoyé
      // On vide le champ par défaut et on ne restaure que si c'est une vraie erreur
      if (error.response?.status !== 422) {
        // Seulement pour les autres erreurs (500, réseau, etc.)
        Alert.alert(
          'Erreur d\'envoi', 
          'Impossible d\'envoyer le message. Veuillez réessayer.'
        );
        setNewMessage(originalMessage); // Restaurer seulement si erreur réelle
      }
      // Pour erreur 422 : ne rien faire (le champ reste vide, message envoyé)
    } finally {
      setSending(false);
    }
  };

  // Détecter si c'est un message contrat
  const isContractMessage = (contenu: string) => contenu?.startsWith('📄 CONTRAT DE');
  const isContractAccepted = (contenu: string) => contenu?.startsWith('✅ CONTRAT ACCEPTÉ');
  const isContractRefused = (contenu: string) => contenu?.startsWith('❌ CONTRAT REFUSÉ');
  const isContractCancelled = (contenu: string) => contenu?.startsWith('❌ CONTRAT ANNULÉ');

  // Vérifier le statut du contrat dans les messages
  useEffect(() => {
    const hasCancelled = messages.some((m: any) => isContractCancelled(m.contenu));
    const hasAccepted = messages.some((m: any) => isContractAccepted(m.contenu));
    const hasRefused = messages.some((m: any) => isContractRefused(m.contenu));
    if (hasCancelled) setContractStatus('cancelled');
    else if (hasAccepted) setContractStatus('accepted');
    else if (hasRefused) setContractStatus('refused');
    else setContractStatus('pending');
  }, [messages]);

  // Mettre à jour le statut du contrat local
  const updateLocalContractStatus = async (newStatus: string) => {
    try {
      const stored = await AsyncStorage.getItem('local_contracts');
      if (!stored) return;
      const contracts = JSON.parse(stored);
      const updated = contracts.map((c: any) => {
        if (c.id_bien === id_bien && c.id_locataire === id_interlocuteur) {
          return { ...c, statut: newStatus, signe_locataire: newStatus === 'actif' };
        }
        return c;
      });
      await AsyncStorage.setItem('local_contracts', JSON.stringify(updated));
    } catch (e) {
      console.warn('Erreur maj contrat local:', e);
    }
  };

  // Accepter le contrat
  const handleAcceptContract = async () => {
    Alert.alert(
      'Accepter le contrat',
      'En acceptant, vous confirmez avoir lu et approuvé toutes les conditions du contrat.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Lu, approuvé et signé',
          onPress: async () => {
            setContractActionLoading(true);
            try {
              const msg = `✅ CONTRAT ACCEPTÉ\n\nLe contrat a été accepté et signé par ${nom_interlocuteur || 'le locataire'}.\nDate : ${new Date().toLocaleDateString('fr-FR')}\n\nCe contrat est désormais en vigueur.`;
              await messageApi.sendMessage(id_interlocuteur, id_bien, msg, user?.id_utilisateur);
              const tempMsg = {
                id_message: `sent_${Date.now()}`,
                contenu: msg,
                id_expediteur: user?.id_utilisateur,
                date_envoi: new Date().toISOString(),
                lu: false,
              };
              setMessages(prev => [...prev, tempMsg]);
              setContractStatus('accepted');
              await updateLocalContractStatus('actif');
              Alert.alert('Contrat signé !', 'Le propriétaire sera notifié de votre acceptation.');
            } catch (e) {
              Alert.alert('Erreur', "Impossible d'envoyer l'acceptation. Réessayez.");
            }
            setContractActionLoading(false);
          },
        },
      ]
    );
  };

  // Refuser le contrat
  const handleRefuseContract = async () => {
    if (!refuseReason.trim()) {
      Alert.alert('Raison requise', 'Veuillez préciser la raison du refus.');
      return;
    }
    setContractActionLoading(true);
    try {
      const msg = `❌ CONTRAT REFUSÉ\n\nLe contrat a été refusé par ${nom_interlocuteur || 'le locataire'}.\nDate : ${new Date().toLocaleDateString('fr-FR')}\n\nRaison du refus :\n${refuseReason.trim()}`;
      await messageApi.sendMessage(id_interlocuteur, id_bien, msg, user?.id_utilisateur);
      const tempMsg = {
        id_message: `sent_${Date.now()}`,
        contenu: msg,
        id_expediteur: user?.id_utilisateur,
        date_envoi: new Date().toISOString(),
        lu: false,
      };
      setMessages(prev => [...prev, tempMsg]);
      setContractStatus('refused');
      await updateLocalContractStatus('refuse');
      setRefuseModalVisible(false);
      setRefuseReason('');
      Alert.alert('Contrat refusé', 'Le propriétaire sera notifié avec votre raison.');
    } catch (e) {
      Alert.alert('Erreur', "Impossible d'envoyer le refus. Réessayez.");
    }
    setContractActionLoading(false);
  };

  // Rendu d'un message contrat
  const renderContractBubble = (item: any) => {
    const messageDate = new Date(item.date_envoi);
    const timeString = messageDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    // Détecter si c'est moi qui ai envoyé ce contrat (je suis le propriétaire)
    const isSender = item.id_message?.startsWith('sent_') || item.id_expediteur === user?.id_utilisateur;

    // Extraire le corps du contrat (sans le préfixe emoji)
    const contractText = item.contenu.replace(/^📄 CONTRAT DE (LOCATION|VENTE)\n\n/, '');

    return (
      <View style={{ marginBottom: 16, paddingHorizontal: 12 }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' }}>
          {/* En-tête */}
          <View style={{ backgroundColor: '#2563eb', padding: 14, flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="document-text" size={22} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginLeft: 10, flex: 1 }}>Contrat</Text>
            <Text style={{ color: '#dbeafe', fontSize: 11 }}>{timeString}</Text>
          </View>

          {/* Corps */}
          <View style={{ padding: 16, maxHeight: 300 }}>
            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
              <Text style={{ color: '#1e293b', fontSize: 13, lineHeight: 20 }}>{contractText}</Text>
            </ScrollView>
          </View>

          {/* Statut / Actions */}
          <View style={{ borderTopWidth: 1, borderTopColor: '#e2e8f0', padding: 14 }}>
            {contractStatus === 'accepted' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                <Text style={{ color: '#10b981', fontWeight: '700', marginLeft: 8, fontSize: 14 }}>Contrat accepté et signé</Text>
              </View>
            ) : contractStatus === 'refused' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="close-circle" size={20} color="#ef4444" />
                <Text style={{ color: '#ef4444', fontWeight: '700', marginLeft: 8, fontSize: 14 }}>Contrat refusé</Text>
              </View>
            ) : contractStatus === 'cancelled' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="ban-outline" size={20} color="#6b7280" />
                <Text style={{ color: '#6b7280', fontWeight: '700', marginLeft: 8, fontSize: 14 }}>Contrat annulé</Text>
              </View>
            ) : isSender ? (
              <View style={{ alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="time-outline" size={18} color="#f59e0b" />
                  <Text style={{ color: '#f59e0b', fontWeight: '600', marginLeft: 8, fontSize: 14 }}>En attente de réponse du locataire</Text>
                </View>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Contracts')}
                  style={{ marginTop: 10, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: '#3b82f610' }}
                >
                  <Text style={{ color: '#3b82f6', fontSize: 13, fontWeight: '600' }}>Voir mes contrats</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => setRefuseModalVisible(true)}
                    disabled={contractActionLoading}
                    style={{ flex: 1, padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#ef4444', alignItems: 'center' }}
                  >
                    <Text style={{ color: '#ef4444', fontWeight: '700', fontSize: 14 }}>Refuser</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleAcceptContract}
                    disabled={contractActionLoading}
                    style={{ flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#10b981', alignItems: 'center' }}
                  >
                    {contractActionLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Accepter</Text>
                    )}
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Contracts')}
                  style={{ marginTop: 10, padding: 10, borderRadius: 8, backgroundColor: '#3b82f610', alignItems: 'center' }}
                >
                  <Text style={{ color: '#3b82f6', fontSize: 13, fontWeight: '600' }}>Voir dans mes contrats</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  // Rendu d'un message statut contrat (accepté/refusé/annulé)
  const renderContractStatusBubble = (item: any, type: 'accepted' | 'refused' | 'cancelled') => {
    const colors = {
      accepted: { bg: '#ecfdf5', border: '#a7f3d0', icon: '#10b981', title: '#065f46', text: '#047857' },
      refused:  { bg: '#fef2f2', border: '#fecaca', icon: '#ef4444', title: '#991b1b', text: '#b91c1c' },
      cancelled: { bg: '#f3f4f6', border: '#d1d5db', icon: '#6b7280', title: '#374151', text: '#4b5563' },
    }[type];
    const icons = { accepted: 'checkmark-circle', refused: 'close-circle', cancelled: 'ban-outline' }[type] as any;
    const labels = { accepted: 'Contrat accepté', refused: 'Contrat refusé', cancelled: 'Contrat annulé' }[type];

    return (
      <View style={{ marginBottom: 12, paddingHorizontal: 16, alignItems: 'center' }}>
        <View style={{
          backgroundColor: colors.bg, borderRadius: 12, padding: 14, maxWidth: '90%',
          borderWidth: 1, borderColor: colors.border,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <Ionicons name={icons} size={20} color={colors.icon} />
            <Text style={{ fontWeight: '700', fontSize: 14, marginLeft: 8, color: colors.title }}>
              {labels}
            </Text>
          </View>
          <Text style={{ color: colors.text, fontSize: 13, lineHeight: 19 }}>
            {item.contenu.replace(/^(✅ CONTRAT ACCEPTÉ|❌ CONTRAT REFUSÉ|❌ CONTRAT ANNULÉ)\n\n/, '')}
          </Text>
        </View>
      </View>
    );
  };

  const renderMessage = ({ item, index }: any) => {
    // Messages spéciaux : contrat
    if (isContractMessage(item.contenu)) {
      return renderContractBubble(item);
    }
    if (isContractAccepted(item.contenu)) {
      return renderContractStatusBubble(item, 'accepted');
    }
    if (isContractRefused(item.contenu)) {
      return renderContractStatusBubble(item, 'refused');
    }
    if (isContractCancelled(item.contenu)) {
      return renderContractStatusBubble(item, 'cancelled');
    }

    // Déterminer si c'est notre message
    const isMyMessage = item.id_message?.startsWith('sent_') || item.envoye_par_moi === true;

    const messageDate = new Date(item.date_envoi);
    const timeString = messageDate.toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    return (
      <View
        style={{
          flexDirection: 'row',
          justifyContent: isMyMessage ? 'flex-end' : 'flex-start',
          marginBottom: 12,
          paddingHorizontal: 16,
        }}
      >
        <View
          style={{
            maxWidth: '75%',
            backgroundColor: isMyMessage ? '#3b82f6' : '#e5e7eb',
            borderRadius: 12,
            padding: 12,
            borderBottomRightRadius: isMyMessage ? 4 : 12,
            borderBottomLeftRadius: isMyMessage ? 12 : 4,
          }}
        >
          <Text style={{ color: isMyMessage ? '#fff' : '#1e293b', fontSize: 15, lineHeight: 20 }}>
            {item.contenu}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, justifyContent: 'flex-end' }}>
            <Text style={{ color: isMyMessage ? '#dbeafe' : '#6b7280', fontSize: 11 }}>
              {timeString}
            </Text>
            {isMyMessage && (
              <Ionicons 
                name={item.lu ? 'checkmark-done' : 'checkmark'} 
                size={14} 
                color="#dbeafe" 
                style={{ marginLeft: 4 }}
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  // Fonctions pour le carrousel d'images
  const scrollToImage = (index: number) => {
    if (scrollViewRef.current) {
      const screenWidth = Dimensions.get('window').width;
      scrollViewRef.current.scrollTo({
        x: index * screenWidth,
        y: 0,
        animated: true,
      });
      setCurrentImageIndex(index);
    }
  };

  const handleScroll = (event: any) => {
    const screenWidth = Dimensions.get('window').width;
    const contentOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffset / screenWidth);
    setCurrentImageIndex(index);
  };

  const renderImageCarousel = () => {
    if (!bienDetails || !bienDetails.images || bienDetails.images.length === 0) {
      return null;
    }

    const screenWidth = Dimensions.get('window').width;
    const images = bienDetails.images;

    return (
      <View style={{ height: 250, backgroundColor: '#1e293b' }}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          style={{ flex: 1 }}
        >
          {images.map((image: any, index: number) => (
            <View key={index} style={{ width: screenWidth, height: 250 }}>
              <Image
                source={{ 
                  uri: image.url_image || image.url || `https://picsum.photos/seed/bien${index}/400/250.jpg` 
                }}
                style={{ 
                  width: screenWidth, 
                  height: 250,
                  resizeMode: 'cover'
                }}
                defaultSource={{ uri: 'https://picsum.photos/seed/placeholder/400/250.jpg' }}
              />
              {bienDetails.titre && (
                <View style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  padding: 12,
                }}>
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>
                    {bienDetails.titre}
                  </Text>
                  {bienDetails.prix_loyer && (
                    <Text style={{ color: '#3b82f6', fontSize: 14, marginTop: 4 }}>
                      {bienDetails.prix_loyer.toLocaleString('fr-FR')} FCFA/mois
                    </Text>
                  )}
                  {bienDetails.prix_vente && (
                    <Text style={{ color: '#10b981', fontSize: 14, marginTop: 4 }}>
                      {bienDetails.prix_vente.toLocaleString('fr-FR')} FCFA
                    </Text>
                  )}
                </View>
              )}
            </View>
          ))}
        </ScrollView>
        
        {/* Indicateurs de pagination */}
        {images.length > 1 && (
          <View style={{
            position: 'absolute',
            top: 10,
            right: 10,
            flexDirection: 'row',
            gap: 6,
          }}>
            {images.map((_: any, index: number) => (
              <View
                key={index}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: index === currentImageIndex ? '#3b82f6' : 'rgba(255,255,255,0.5)',
                }}
              />
            ))}
          </View>
        )}
        
        {/* Boutons de navigation */}
        {images.length > 1 && (
          <>
            {currentImageIndex > 0 && (
              <TouchableOpacity
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  marginTop: -20,
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={() => scrollToImage(currentImageIndex - 1)}
              >
                <Ionicons name="chevron-back" size={24} color="#fff" />
              </TouchableOpacity>
            )}
            
            {currentImageIndex < images.length - 1 && (
              <TouchableOpacity
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  marginTop: -20,
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={() => scrollToImage(currentImageIndex + 1)}
              >
                <Ionicons name="chevron-forward" size={24} color="#fff" />
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
        <ScreenHeader 
          title={nom_interlocuteur || 'Chat'} 
          onBack={() => navigation.goBack()} 
        />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#0f172a' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScreenHeader 
        title={nom_interlocuteur || 'Chat'} 
        onBack={() => navigation.goBack()} 
      />

      {renderImageCarousel()}

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id_message}
        contentContainerStyle={{ paddingVertical: 16 }}
        onContentSizeChange={() => {
          // Scroll en bas quand de nouveaux messages arrivent
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }}
        onLayout={() => {
          // Scroll en bas au chargement initial
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 40 }}>
            <Ionicons name="chatbubbles-outline" size={64} color="#64748b" />
            <Text style={{ color: '#9ca3af', fontSize: 16, marginTop: 16 }}>
              Aucun message
            </Text>
            <Text style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
              Envoyez le premier message
            </Text>
          </View>
        }
      />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 12,
          backgroundColor: '#1e293b',
          borderTopWidth: 1,
          borderTopColor: '#334155',
          gap: 8,
        }}
      >
        <TextInput
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Écrivez un message..."
          placeholderTextColor="#64748b"
          multiline
          maxLength={500}
          style={{
            flex: 1,
            backgroundColor: '#0f172a',
            color: '#fff',
            borderRadius: 20,
            paddingHorizontal: 16,
            paddingVertical: 10,
            maxHeight: 100,
            fontSize: 15,
          }}
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity
          onPress={sendMessage}
          disabled={!newMessage.trim() || sending}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: newMessage.trim() && !sending ? '#3b82f6' : '#334155',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
      {/* Modal de refus de contrat */}
      <Modal visible={refuseModalVisible} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Ionicons name="close-circle" size={24} color="#ef4444" />
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#1e293b', marginLeft: 10 }}>Refuser le contrat</Text>
            </View>

            <Text style={{ fontSize: 14, color: '#64748b', marginBottom: 12 }}>
              Précisez la raison de votre refus. Le propriétaire recevra votre message.
            </Text>

            <TextInput
              value={refuseReason}
              onChangeText={setRefuseReason}
              placeholder="Ex: Le loyer est trop élevé, je souhaite négocier..."
              placeholderTextColor="#94a3b8"
              multiline
              style={{
                borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12,
                padding: 14, fontSize: 15, minHeight: 100, textAlignVertical: 'top',
                color: '#1e293b', backgroundColor: '#f8fafc', marginBottom: 16,
              }}
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => { setRefuseModalVisible(false); setRefuseReason(''); }}
                style={{ flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' }}
              >
                <Text style={{ color: '#64748b', fontWeight: '600', fontSize: 15 }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleRefuseContract}
                disabled={contractActionLoading || !refuseReason.trim()}
                style={{
                  flex: 1, padding: 14, borderRadius: 12, alignItems: 'center',
                  backgroundColor: refuseReason.trim() ? '#ef4444' : '#fca5a5',
                }}
              >
                {contractActionLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Envoyer le refus</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};
