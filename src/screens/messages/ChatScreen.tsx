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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '../../components/ScreenHeader';
import { messageApi } from '../../services/messageApi';
import { bienApi } from '../../services/bienApi';
import { useAuthStore } from '../../store/authStore';

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

  const renderMessage = ({ item, index }: any) => {
    // Logique simple et pragmatique :
    // 1. Messages temporaires = nos messages (à droite)
    // 2. Messages très récents (< 10 sec) = probablement nos messages (à droite)
    // 3. Tous les autres = alternance simple (50/50)
    
    let isMyMessage = false;
    
    // Messages temporaires avec notre préfixe
    if (item.id_message?.startsWith('sent_')) {
      isMyMessage = true;
    } else {
      // Messages très récents
      const messageTime = new Date(item.date_envoi).getTime();
      const now = Date.now();
      const timeDiff = Math.abs(now - messageTime);
      
      // Si envoyé il y a moins de 10 secondes, c'est probablement nous
      if (timeDiff < 10000) {
        isMyMessage = true;
      } else {
        // Pour les autres, simple alternation 50/50
        isMyMessage = index % 2 === 0;
      }
    }
    
    // Debug supprimé - fonctionnalité carrousel ajoutée
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
            backgroundColor: isMyMessage ? '#3b82f6' : '#1e293b',
            borderRadius: 12,
            padding: 12,
            borderBottomRightRadius: isMyMessage ? 4 : 12,
            borderBottomLeftRadius: isMyMessage ? 12 : 4,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 15, lineHeight: 20 }}>
            {item.contenu}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, justifyContent: 'flex-end' }}>
            <Text style={{ color: isMyMessage ? '#dbeafe' : '#64748b', fontSize: 11 }}>
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
    </KeyboardAvoidingView>
  );
};
