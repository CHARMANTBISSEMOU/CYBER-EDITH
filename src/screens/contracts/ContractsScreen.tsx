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
import { ScreenHeader } from '../../components/ScreenHeader';
import { contratApi } from '../../services/contratApi';
import { messageApi } from '../../services/messageApi';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../../store/authStore';
import { localNotificationService } from '../../utils/localNotifications';

export const ContractsScreen = ({ navigation }: any) => {
  const { user } = useAuthStore();
  const [contrats, setContrats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadContrats();
    // Recharger quand l'écran reprend le focus
    const unsubscribe = navigation.addListener('focus', () => loadContrats(true));
    return unsubscribe;
  }, [navigation]);

  const loadContrats = async (silent = false) => {
    if (!silent) setLoading(true);

    let backendContrats: any[] = [];
    let localContrats: any[] = [];

    // Charger les contrats backend
    try {
      const response = await contratApi.getMesContrats();
      backendContrats = response.contrats || [];
      console.log('📋 Backend contrats:', backendContrats.length);
    } catch (e) {
      console.warn('📋 Backend contrats indisponible');
    }

    // Charger les contrats locaux
    try {
      const stored = await AsyncStorage.getItem('local_contracts');
      if (stored) {
        localContrats = JSON.parse(stored);
        console.log('📋 Contrats locaux:', localContrats.length, localContrats.map((c: any) => c.titre_bien));
      }
    } catch (e) {
      console.warn('📋 Erreur lecture contrats locaux:', e);
    }

    // Fusionner : backend d'abord, puis locaux (éviter doublons par id_bien + id_locataire)
    const backendIds = new Set(backendContrats.map((c: any) => `${c.id_bien}_${c.id_locataire}`));
    const uniqueLocal = localContrats.filter((c: any) => !backendIds.has(`${c.id_bien}_${c.id_locataire}`));
    const all = [...backendContrats, ...uniqueLocal];
    console.log('📋 Total contrats à afficher:', all.length);
    setContrats(all);
    if (!silent) setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadContrats(true);
    setRefreshing(false);
  };

  const getStatusColor = (statut: string) => {
    switch (statut) {
      case 'brouillon': return '#f59e0b';
      case 'en_attente': return '#3b82f6';
      case 'actif': return '#10b981';
      case 'refuse': return '#ef4444';
      case 'resilie': return '#6b7280';
      default: return '#64748b';
    }
  };

  const getStatusLabel = (statut: string) => {
    switch (statut) {
      case 'brouillon': return 'Brouillon';
      case 'en_attente': return 'En attente';
      case 'actif': return 'Actif';
      case 'refuse': return 'Refusé';
      case 'resilie': return 'Résilié';
      default: return statut;
    }
  };

  const handleCancelContract = (contrat: any) => {
    Alert.alert(
      'Annuler le contrat',
      `Voulez-vous vraiment annuler le contrat pour "${contrat.titre_bien || 'ce bien'}" ?\n\nL'autre partie sera notifiée.`,
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            // 1. Notifier l'autre partie via la messagerie
            const otherPartyId = contrat.id_locataire;
            const bienId = contrat.id_bien;
            if (otherPartyId && bienId) {
              try {
                const cancelMsg = `❌ CONTRAT ANNULÉ\n\nLe contrat pour "${contrat.titre_bien || 'le bien'}" a été annulé.\nDate : ${new Date().toLocaleDateString('fr-FR')}\n\nLe bien est de nouveau disponible.`;
                await messageApi.sendMessage(otherPartyId, bienId, cancelMsg);
                console.log('📋 Notification annulation envoyée');
              } catch (e) {
                console.warn('📋 Erreur envoi notification annulation:', e);
              }
            }

            // 2. Supprimer le contrat local
            if (contrat.id_contrat?.startsWith('local_')) {
              try {
                const stored = await AsyncStorage.getItem('local_contracts');
                if (stored) {
                  const contracts = JSON.parse(stored);
                  const updated = contracts.filter((c: any) => c.id_contrat !== contrat.id_contrat);
                  await AsyncStorage.setItem('local_contracts', JSON.stringify(updated));
                }
              } catch (e) {
                console.warn('Erreur suppression contrat local:', e);
              }
            } else {
              // 3. Tenter la résiliation backend
              try { await contratApi.resilierContrat(contrat.id_contrat, 'Annulé par le propriétaire'); } catch (e) {}
            }

            // Notification locale (visible dans la cloche)
            await localNotificationService.add('contrat', `❌ Contrat annulé pour "${contrat.titre_bien || 'le bien'}". Le bien est de nouveau disponible.`);

            await loadContrats(true);
            Alert.alert('Contrat annulé', 'Le contrat a été annulé et l\'autre partie a été notifiée.');
          },
        },
      ]
    );
  };

  const isOwner = (contrat: any) => {
    return contrat.id_proprietaire && user?.id_utilisateur && contrat.id_proprietaire === user.id_utilisateur;
  };

  const isTenant = (contrat: any) => {
    if (!user?.id_utilisateur) return false;
    // Backend contracts: id_locataire matches
    if (contrat.id_locataire === user.id_utilisateur) return true;
    // If not owner, assume tenant
    if (contrat.id_proprietaire && contrat.id_proprietaire !== user.id_utilisateur) return true;
    return false;
  };

  const handleAcceptContract = async (contrat: any) => {
    Alert.alert(
      'Accepter le contrat',
      `Voulez-vous accepter le contrat pour "${contrat.titre_bien || contrat.bien?.titre || 'ce bien'}" ?`,
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, accepter',
          onPress: async () => {
            try {
              // Backend contract
              if (contrat.id_contrat && !contrat.id_contrat.startsWith('local_')) {
                await contratApi.accepterContrat(contrat.id_contrat);
              }
              // Local contract: update status
              try {
                const stored = await AsyncStorage.getItem('local_contracts');
                if (stored) {
                  const contracts = JSON.parse(stored);
                  const updated = contracts.map((c: any) =>
                    c.id_contrat === contrat.id_contrat ? { ...c, statut: 'actif', signe_locataire: true } : c
                  );
                  await AsyncStorage.setItem('local_contracts', JSON.stringify(updated));
                }
              } catch (e) {}

              // Envoyer un message de confirmation
              const bienTitre = contrat.titre_bien || contrat.bien?.titre || 'le bien';
              const bienId = contrat.id_bien || contrat.bien?.id_bien;
              const ownerId = contrat.id_proprietaire;
              if (ownerId && bienId) {
                try {
                  const msg = `✅ CONTRAT ACCEPTÉ\n\nLe contrat pour "${bienTitre}" a été accepté.\nDate : ${new Date().toLocaleDateString('fr-FR')}`;
                  await messageApi.sendMessage(ownerId, bienId, msg, user?.id_utilisateur);
                } catch (e) {}
              }

              // Notification locale (visible dans la cloche)
              await localNotificationService.add('contrat', `✅ Contrat accepté pour "${bienTitre}". Le contrat est maintenant actif.`);

              await loadContrats(true);
              Alert.alert('Contrat accepté', 'Le contrat a été accepté avec succès.');
            } catch (e: any) {
              console.error('Erreur acceptation:', e);
              Alert.alert('Erreur', 'Impossible d\'accepter le contrat.');
            }
          },
        },
      ]
    );
  };

  const handleRefuseContract = async (contrat: any) => {
    Alert.alert(
      'Refuser le contrat',
      `Voulez-vous refuser le contrat pour "${contrat.titre_bien || contrat.bien?.titre || 'ce bien'}" ?`,
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, refuser',
          style: 'destructive',
          onPress: async () => {
            try {
              // Backend contract
              if (contrat.id_contrat && !contrat.id_contrat.startsWith('local_')) {
                await contratApi.refuserContrat(contrat.id_contrat, 'Refusé par le locataire');
              }
              // Local contract: update status
              try {
                const stored = await AsyncStorage.getItem('local_contracts');
                if (stored) {
                  const contracts = JSON.parse(stored);
                  const updated = contracts.map((c: any) =>
                    c.id_contrat === contrat.id_contrat ? { ...c, statut: 'refuse' } : c
                  );
                  await AsyncStorage.setItem('local_contracts', JSON.stringify(updated));
                }
              } catch (e) {}

              // Envoyer un message de refus
              const bienTitre = contrat.titre_bien || contrat.bien?.titre || 'le bien';
              const bienId = contrat.id_bien || contrat.bien?.id_bien;
              const ownerId = contrat.id_proprietaire;
              if (ownerId && bienId) {
                try {
                  const msg = `❌ CONTRAT REFUSÉ\n\nLe contrat pour "${bienTitre}" a été refusé.\nDate : ${new Date().toLocaleDateString('fr-FR')}`;
                  await messageApi.sendMessage(ownerId, bienId, msg, user?.id_utilisateur);
                } catch (e) {}
              }

              // Notification locale (visible dans la cloche)
              await localNotificationService.add('contrat', `❌ Contrat refusé pour "${bienTitre}".`);

              await loadContrats(true);
              Alert.alert('Contrat refusé', 'Le contrat a été refusé.');
            } catch (e: any) {
              console.error('Erreur refus:', e);
              Alert.alert('Erreur', 'Impossible de refuser le contrat.');
            }
          },
        },
      ]
    );
  };

  const handleContratPress = (contrat: any) => {
    const statut = contrat.statut;
    const titre = contrat.titre_bien || contrat.bien?.titre || 'Contrat';
    const montant = contrat.montant_loyer || contrat.loyer_mensuel || 0;
    const locataire = contrat.nom_locataire || '-';
    const isPending = statut === 'en_attente' || statut === 'brouillon';

    // Build action buttons
    const buttons: any[] = [{ text: 'Fermer', style: 'cancel' }];

    // Tenant can accept/refuse pending contracts
    if (isPending && isTenant(contrat)) {
      buttons.push({ text: '✅ Accepter', onPress: () => handleAcceptContract(contrat) });
      buttons.push({ text: '❌ Refuser', style: 'destructive', onPress: () => handleRefuseContract(contrat) });
    }

    // Owner can cancel any contract
    if (isOwner(contrat)) {
      buttons.push({ text: 'Annuler le contrat', style: 'destructive', onPress: () => handleCancelContract(contrat) });
    }

    // Navigate to detail for backend contracts
    if (contrat.id_contrat && !contrat.id_contrat.startsWith('local_')) {
      buttons.push({ text: 'Voir détails', onPress: () => navigation.navigate('ContractDetail', { id_contrat: contrat.id_contrat }) });
    }

    Alert.alert(
      titre,
      `Statut : ${getStatusLabel(statut)}\nLocataire : ${locataire}\nMontant : ${montant.toLocaleString()} FCFA`,
      buttons,
    );
  };

  const getStatusIcon = (statut: string) => {
    switch (statut) {
      case 'brouillon': return 'create-outline';
      case 'en_attente': return 'time-outline';
      case 'actif': return 'checkmark-circle-outline';
      case 'refuse': return 'close-circle-outline';
      case 'resilie': return 'ban-outline';
      default: return 'document-outline';
    }
  };

  const renderContrat = ({ item }: any) => {
    const statusColor = getStatusColor(item.statut);
    const nom = item.nom_locataire || item.nom_proprietaire || '';

    return (
      <TouchableOpacity
        onPress={() => handleContratPress(item)}
        style={{
          backgroundColor: '#1e293b',
          borderRadius: 14,
          marginBottom: 10,
          overflow: 'hidden',
          borderLeftWidth: 4,
          borderLeftColor: statusColor,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}>
          {/* Icône type */}
          <View style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
            <Ionicons name="document-text" size={22} color={statusColor} />
          </View>

          {/* Infos principales */}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                {item.titre_bien || 'Contrat'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: `${statusColor}20`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                <Ionicons name={getStatusIcon(item.statut) as any} size={12} color={statusColor} />
                <Text style={{ color: statusColor, fontSize: 11, fontWeight: '600', marginLeft: 4 }}>
                  {getStatusLabel(item.statut)}
                </Text>
              </View>
            </View>

            {nom ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Ionicons name="person-outline" size={13} color="#64748b" />
                <Text style={{ color: '#94a3b8', fontSize: 13, marginLeft: 5 }} numberOfLines={1}>{nom}</Text>
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {(item.montant_loyer || item.loyer_mensuel) ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="cash-outline" size={13} color="#64748b" />
                  <Text style={{ color: '#3b82f6', fontSize: 13, fontWeight: '600', marginLeft: 4 }}>
                    {(item.montant_loyer || item.loyer_mensuel).toLocaleString()} F
                  </Text>
                </View>
              ) : null}
              {item.date_debut ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="calendar-outline" size={13} color="#64748b" />
                  <Text style={{ color: '#94a3b8', fontSize: 12, marginLeft: 4 }}>
                    {new Date(item.date_debut).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </Text>
                </View>
              ) : null}
              {item.duree_mois ? (
                <Text style={{ color: '#64748b', fontSize: 12 }}>{item.duree_mois} mois</Text>
              ) : null}
            </View>

            {/* Badge action requise pour le locataire */}
            {(item.statut === 'en_attente' || item.statut === 'brouillon') && isTenant(item) && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, backgroundColor: '#f59e0b20', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, alignSelf: 'flex-start' }}>
                <Ionicons name="alert-circle" size={14} color="#f59e0b" />
                <Text style={{ color: '#f59e0b', fontSize: 12, fontWeight: '700', marginLeft: 5 }}>
                  Action requise — Appuyez pour répondre
                </Text>
              </View>
            )}
          </View>

          <Ionicons name="chevron-forward" size={18} color="#475569" style={{ marginLeft: 8 }} />
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
        <ScreenHeader title="Mes contrats" onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <ScreenHeader title="Mes contrats" onBack={() => navigation.goBack()} />

      <FlatList
        data={contrats}
        renderItem={renderContrat}
        keyExtractor={(item) => item.id_contrat}
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
            <Ionicons name="document-text-outline" size={80} color="#334155" />
            <Text style={{ color: '#9ca3af', fontSize: 18, marginTop: 24, textAlign: 'center' }}>
              Aucun contrat
            </Text>
            <Text style={{ color: '#64748b', fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 }}>
              Vos contrats de location apparaîtront ici
            </Text>
          </View>
        }
      />

      {/* Bouton flottant pour créer un contrat */}
      <TouchableOpacity
        onPress={() => navigation.navigate('CreateContract')}
        style={{
          position: 'absolute',
          bottom: 24,
          right: 24,
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: '#3b82f6',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};
