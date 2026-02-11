import React, { useState, useEffect } from 'react';
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
import { notificationApi } from '../../services/notificationApi';

export const NotificationsScreen = ({ navigation }: any) => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadNotifications();
    
    // Polling toutes les 30 secondes pour les notifications non lues
    const interval = setInterval(() => {
      loadUnreadCount();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await notificationApi.getNotifications();
      setNotifications(response.notifications || []);
      loadUnreadCount();
    } catch (error: any) {
      console.error('Erreur chargement notifications:', error);
      if (!silent) {
        Alert.alert('Erreur', 'Impossible de charger les notifications');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const response = await notificationApi.getUnreadCount();
      setUnreadCount(response.total_non_lues || 0);
    } catch (error) {
      console.log('Erreur comptage non lues:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications(true);
    setRefreshing(false);
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationApi.markAsRead(id);
      setNotifications(notifications.map(n => 
        n.id_notification === id ? { ...n, lu: true } : n
      ));
      loadUnreadCount();
    } catch (error) {
      console.error('Erreur marquage lu:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications(notifications.map(n => ({ ...n, lu: true })));
      setUnreadCount(0);
      Alert.alert('Succès', 'Toutes les notifications ont été marquées comme lues');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de marquer toutes les notifications comme lues');
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert(
      'Supprimer',
      'Voulez-vous supprimer cette notification ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await notificationApi.deleteNotification(id);
              setNotifications(notifications.filter(n => n.id_notification !== id));
              loadUnreadCount();
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de supprimer la notification');
            }
          },
        },
      ]
    );
  };

  const getIconByType = (type: string) => {
    switch (type) {
      case 'message': return 'chatbubble';
      case 'contrat': return 'document-text';
      case 'detection': return 'location';
      case 'paiement': return 'cash';
      case 'systeme': return 'information-circle';
      default: return 'notifications';
    }
  };

  const getColorByType = (type: string) => {
    switch (type) {
      case 'message': return '#3b82f6';
      case 'contrat': return '#8b5cf6';
      case 'detection': return '#f59e0b';
      case 'paiement': return '#10b981';
      case 'systeme': return '#64748b';
      default: return '#6b7280';
    }
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

  const renderNotification = ({ item }: any) => {
    const iconColor = getColorByType(item.type_notification);
    
    return (
      <TouchableOpacity
        onPress={() => !item.lu && handleMarkAsRead(item.id_notification)}
        onLongPress={() => handleDelete(item.id_notification)}
        style={{
          backgroundColor: item.lu ? '#1e293b' : '#1e3a5f',
          borderRadius: 12,
          padding: 16,
          marginBottom: 12,
          flexDirection: 'row',
          alignItems: 'flex-start',
          borderLeftWidth: 4,
          borderLeftColor: iconColor,
        }}
      >
        {/* Icône */}
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: `${iconColor}20`,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}
        >
          <Ionicons name={getIconByType(item.type_notification)} size={24} color={iconColor} />
        </View>

        {/* Contenu */}
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 4 }}>
            {item.message}
          </Text>
          <Text style={{ color: '#9ca3af', fontSize: 13 }}>
            {formatDate(item.date_creation)}
          </Text>
        </View>

        {/* Badge non lu */}
        {!item.lu && (
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: '#3b82f6',
              marginLeft: 8,
            }}
          />
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16, backgroundColor: '#1e293b' }}>
          <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700' }}>Notifications</Text>
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
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700' }}>Notifications</Text>
            {unreadCount > 0 && (
              <Text style={{ color: '#9ca3af', fontSize: 14, marginTop: 4 }}>
                {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
              </Text>
            )}
          </View>
          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={handleMarkAllAsRead}
              style={{
                backgroundColor: '#3b82f6',
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
                Tout lire
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Liste des notifications */}
      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id_notification}
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
            <Ionicons name="notifications-outline" size={80} color="#334155" />
            <Text style={{ color: '#9ca3af', fontSize: 18, marginTop: 24, textAlign: 'center' }}>
              Aucune notification
            </Text>
            <Text style={{ color: '#64748b', fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 }}>
              Vous serez notifié des événements importants
            </Text>
          </View>
        }
      />
    </View>
  );
};
