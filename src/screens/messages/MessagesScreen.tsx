import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { messageApi } from '../../services/messageApi';
import { useAuthStore } from '../../store/authStore';

export const MessagesScreen = ({ navigation }: any) => {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user, isAuthenticated } = useAuthStore();

  useEffect(() => {
    loadConversations();
    
    const interval = setInterval(() => {
      loadConversations(true);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const loadConversations = async (silent = false) => {
    // Vérifier l'authentification d'abord
    if (!isAuthenticated) {
      console.log('🔐 Utilisateur non authentifié - Redirection vers login');
      if (!silent) {
        Alert.alert(
          'Session expirée',
          'Votre session a expiré. Veuillez vous reconnecter.',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('Login'),
            },
          ]
        );
      }
      return;
    }

    try {
      if (!silent) setLoading(true);
      const response = await messageApi.getConversations();
      setConversations(response.conversations || []);
    } catch (error: any) {
      console.error('Erreur chargement conversations:', error);
      
      // Gérer spécifiquement les erreurs 401
      if (error.response?.status === 401) {
        console.log('🔐 Erreur 401 - Session expirée');
        if (!silent) {
          Alert.alert(
            'Session expirée',
            'Votre session a expiré. Veuillez vous reconnecter.',
            [
              {
                text: 'OK',
                onPress: () => navigation.navigate('Login'),
              },
            ]
          );
        }
      } else if (!silent) {
        Alert.alert('Erreur', 'Impossible de charger les conversations');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadConversations(true);
    setRefreshing(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) return 'À l\'instant';
    if (hours < 24) return `Il y a ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Hier';
    if (days < 7) return `Il y a ${days}j`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const renderConversation = ({ item }: any) => (
    <TouchableOpacity
      onPress={() => navigation.navigate('Chat', {
        id_interlocuteur: item.id_interlocuteur,
        id_bien: item.id_bien,
        nom_interlocuteur: item.nom_interlocuteur,
      })}
      style={{
        backgroundColor: '#1e293b',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      {/* Avatar */}
      <View
        style={{
          width: 56,
          height: 56,
          backgroundColor: '#3b82f6',
          borderRadius: 28,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>
          {item.nom_interlocuteur?.[0] || 'U'}
        </Text>
      </View>

      {/* Contenu */}
      <View style={{ flex: 1, marginLeft: 12 }}>
        {/* Nom et date */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 }} numberOfLines={1}>
            {item.nom_interlocuteur}
          </Text>
          <Text style={{ color: '#64748b', fontSize: 12, marginLeft: 8 }}>
            {formatDate(item.date_dernier_message)}
          </Text>
        </View>

        {/* Titre du bien */}
        {item.titre_bien && (
          <Text style={{ color: '#9ca3af', fontSize: 13, marginBottom: 4 }} numberOfLines={1}>
            📍 {item.titre_bien}
          </Text>
        )}

        {/* Dernier message */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: '#64748b', fontSize: 14, flex: 1 }} numberOfLines={1}>
            {item.dernier_message}
          </Text>
          
          {/* Badge non lus */}
          {item.messages_non_lus > 0 && (
            <View
              style={{
                backgroundColor: '#3b82f6',
                borderRadius: 12,
                minWidth: 24,
                height: 24,
                paddingHorizontal: 8,
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: 8,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                {item.messages_non_lus > 99 ? '99+' : item.messages_non_lus}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16, backgroundColor: '#1e293b' }}>
          <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700' }}>Messages</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
      {/* En-tête */}
      <View style={{ paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16, backgroundColor: '#1e293b' }}>
        <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700' }}>Messages</Text>
        {conversations.length > 0 && (
          <Text style={{ color: '#9ca3af', fontSize: 14, marginTop: 4 }}>
            {conversations.length} conversation{conversations.length > 1 ? 's' : ''}
          </Text>
        )}
      </View>

      {/* Liste des conversations */}
      <FlatList
        data={conversations}
        renderItem={renderConversation}
        keyExtractor={(item, index) => `${item.id_interlocuteur}-${item.id_bien}-${index}`}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3b82f6"
          />
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Ionicons name="chatbubbles-outline" size={80} color="#334155" />
            <Text style={{ color: '#9ca3af', fontSize: 18, marginTop: 24, textAlign: 'center' }}>
              Aucune conversation
            </Text>
            <Text style={{ color: '#64748b', fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 }}>
              Contactez un propriétaire depuis un bien pour démarrer une conversation
            </Text>
          </View>
        }
      />
    </View>
  );
};
