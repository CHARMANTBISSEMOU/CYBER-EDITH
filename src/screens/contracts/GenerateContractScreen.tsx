import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { bienApi } from '../../services/bienApi';
import { messageApi } from '../../services/messageApi';
import { contratApi } from '../../services/contratApi';
import { generateContractLocal, ContractData } from '../../services/contractGenerator';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../../store/authStore';
import { localNotificationService } from '../../utils/localNotifications';

const STEPS = ['Type', 'Bien', 'Partie', 'Détails', 'Aperçu'];

export const GenerateContractScreen = ({ navigation }: any) => {
  const { user } = useAuthStore();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [biens, setBiens] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const scrollRef = useRef<ScrollView>(null);

  // Données du contrat
  const [contractType, setContractType] = useState<'location' | 'vente' | null>(null);
  const [selectedBien, setSelectedBien] = useState<any>(null);
  const [selectedLocataire, setSelectedLocataire] = useState<any>(null);
  const [generatedContract, setGeneratedContract] = useState('');
  const [signed, setSigned] = useState(false);

  const getTodayFormatted = () => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const [form, setForm] = useState({
    nom_bailleur: '',
    nom_locataire: '',
    montant: '',
    caution: '',
    date_debut: getTodayFormatted(),
    duree_mois: '12',
    conditions: '',
  });

  useEffect(() => {
    (async () => {
      try {
        const [biensRes, convRes] = await Promise.all([
          bienApi.getMyBiens(),
          messageApi.getConversations(),
        ]);
        // Charger les contrats locaux actifs pour filtrer les biens occupés
        let activeBienIds = new Set<string>();
        try {
          const stored = await AsyncStorage.getItem('local_contracts');
          if (stored) {
            const localContracts = JSON.parse(stored);
            localContracts.forEach((c: any) => {
              if (c.statut === 'actif' && c.id_bien) activeBienIds.add(c.id_bien);
            });
          }
        } catch (e) {}

        const allBiens = biensRes.biens || [];
        setBiens(allBiens.filter((b: any) => !activeBienIds.has(b.id_bien)));
        setConversations(convRes.conversations || []);
      } catch (e) {
        console.error('Erreur chargement:', e);
      } finally {
        setDataLoading(false);
      }
    })();
  }, []);

  const locatairesPourBien = selectedBien
    ? conversations.filter((c: any) => c.id_bien === selectedBien.id_bien)
    : [];

  // ── Navigation entre étapes ──
  const canGoNext = () => {
    if (step === 0) return !!contractType;
    if (step === 1) return !!selectedBien;
    if (step === 2) return !!selectedLocataire && !!form.nom_locataire.trim();
    if (step === 3) return !!form.nom_bailleur && !!form.nom_locataire && !!form.montant;
    return true;
  };

  const handleNext = async () => {
    if (step === 3) {
      await handleGenerate();
    } else {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step === 0) {
      navigation.goBack();
    } else {
      setStep(step - 1);
    }
  };

  // ── Pré-remplir le nom du locataire dès sa sélection ──
  useEffect(() => {
    if (selectedLocataire) {
      const nomLoc = `${selectedLocataire.prenom_interlocuteur || ''} ${selectedLocataire.nom_interlocuteur || ''}`.trim();
      if (nomLoc && !form.nom_locataire) setForm(f => ({ ...f, nom_locataire: nomLoc }));
    }
  }, [selectedLocataire]);

  useEffect(() => {
    if (selectedBien && step === 3) {
      if (selectedBien.prix) setForm(f => ({ ...f, montant: String(selectedBien.prix) }));
    }
  }, [selectedBien, step]);

  // ── Génération du contrat (template local) ──
  const handleGenerate = async () => {
    setLoading(true);
    const input: ContractData = {
      type: contractType!,
      bien: {
        titre: selectedBien.titre || '',
        adresse: selectedBien.adresse || '',
        type: selectedBien.type_bien || 'Bien immobilier',
      },
      bailleur_vendeur: form.nom_bailleur,
      locataire_acheteur: form.nom_locataire,
      montant: parseInt(form.montant) || 0,
      caution: parseInt(form.caution) || 0,
      date_debut: form.date_debut,
      duree_mois: parseInt(form.duree_mois) || 12,
      conditions_speciales: form.conditions,
    };

    const text = generateContractLocal(input);
    setGeneratedContract(text);
    setSigned(false);
    setStep(4);
    setLoading(false);
  };

  // ── Envoi au locataire ──
  const handleSendToTenant = async () => {
    if (!signed) {
      Alert.alert('Signature requise', 'Veuillez d\'abord signer le contrat avant de l\'envoyer.');
      return;
    }
    setLoading(true);
    const dureeMois = parseInt(form.duree_mois) || 12;
    const montant = parseInt(form.montant) || 0;
    const bienTitre = selectedBien.titre || 'Bien immobilier';
    const locataireNom = `${(selectedLocataire.prenom_interlocuteur || '')} ${(selectedLocataire.nom_interlocuteur || '')}`.trim();

    try {
      // 1. Créer le contrat sur le backend (visible pour les 2 parties)
      let backendContractId: string | null = null;
      try {
        // Calculer date_fin à partir de date_debut + duree_mois
        const parts = form.date_debut.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        let dateFin = form.date_debut;
        if (parts) {
          const d = new Date(parseInt(parts[3]), parseInt(parts[2]) - 1, parseInt(parts[1]));
          d.setMonth(d.getMonth() + dureeMois);
          dateFin = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        }

        const backendRes = await contratApi.initierContrat(
          selectedLocataire.id_interlocuteur,
          selectedBien.id_bien,
          montant,
          form.date_debut,
          dateFin,
        );
        backendContractId = backendRes?.id_contrat || backendRes?.contrat?.id_contrat || null;
        console.log('📋 Contrat créé sur le backend ✅', backendContractId);
      } catch (backendErr: any) {
        console.warn('� Erreur création backend (fallback local):', backendErr?.response?.status, backendErr?.response?.data);
      }

      // 2. Envoyer un message COURT de notification (pas le texte complet du contrat)
      const typeLabel = contractType === 'location' ? 'LOCATION' : 'VENTE';
      const shortMsg = `📄 CONTRAT DE ${typeLabel}\n\nUn contrat pour "${bienTitre}" vous a été envoyé.\nMontant : ${montant.toLocaleString()} FCFA/mois\nDurée : ${dureeMois} mois\n\nConsultez vos contrats pour accepter ou refuser.`;

      try {
        await messageApi.sendMessage(
          selectedLocataire.id_interlocuteur,
          selectedBien.id_bien,
          shortMsg,
          user?.id_utilisateur,
        );
        console.log('📋 Message notification envoyé ✅');
      } catch (msgErr) {
        console.warn('📋 Erreur envoi message (non bloquant):', msgErr);
      }

      // 3. Sauvegarder localement en backup
      const localContract = {
        id_contrat: backendContractId || `local_${Date.now()}`,
        id_proprietaire: user?.id_utilisateur || '',
        titre_bien: bienTitre,
        nom_locataire: form.nom_locataire,
        nom_proprietaire: form.nom_bailleur,
        montant_loyer: montant,
        caution: parseInt(form.caution) || 0,
        date_debut: form.date_debut,
        duree_mois: dureeMois,
        statut: 'en_attente',
        type: contractType,
        contenu: generatedContract,
        id_bien: selectedBien.id_bien,
        id_locataire: selectedLocataire.id_interlocuteur,
        date_creation: new Date().toISOString(),
        signe_bailleur: true,
        signe_locataire: false,
      };

      try {
        const existing = await AsyncStorage.getItem('local_contracts');
        const contracts = existing ? JSON.parse(existing) : [];
        contracts.unshift(localContract);
        await AsyncStorage.setItem('local_contracts', JSON.stringify(contracts));
        console.log('📋 Contrat sauvegardé localement ✅', localContract.titre_bien, '| Total:', contracts.length);
      } catch (storageErr) {
        console.warn('📋 Erreur sauvegarde locale ❌:', storageErr);
      }

      // Notification locale (visible dans la cloche)
      await localNotificationService.add('contrat', `📄 Nouveau contrat envoyé à ${locataireNom} pour "${bienTitre}". En attente d'acceptation.`);

      Alert.alert(
        'Contrat envoyé !',
        `Le contrat a été envoyé à ${locataireNom}.\nIl apparaîtra dans ses contrats et notifications.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (e: any) {
      console.error('Erreur envoi contrat:', e);
      Alert.alert('Erreur', 'Impossible d\'envoyer le contrat. Réessayez.');
    }
    setLoading(false);
  };

  // ── PDF ──
  const handlePDF = async () => {
    try {
      const html = getContractHTML(generatedContract);
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri);
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de générer le PDF');
    }
  };

  const getEndDate = (start: string, months: number) => {
    const m = start.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return '';
    const d = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
    d.setMonth(d.getMonth() + months);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  if (dataLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  // ══════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════
  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      {/* Header */}
      <View style={{ paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
        <TouchableOpacity onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={{ fontSize: 22, fontWeight: '800', color: '#1e293b', marginTop: 8 }}>
          {step < 4 ? 'Nouveau contrat' : 'Aperçu du contrat'}
        </Text>

        {/* Progress bar */}
        {step < 4 && (
          <View style={{ flexDirection: 'row', marginTop: 12, gap: 4 }}>
            {STEPS.slice(0, 4).map((s, i) => (
              <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? '#2563eb' : '#e2e8f0' }} />
            ))}
          </View>
        )}
      </View>

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>

        {/* ─── STEP 0 : Type de contrat ─── */}
        {step === 0 && (
          <View>
            <Text style={styles.stepTitle}>Quel type de contrat ?</Text>
            <TouchableOpacity
              onPress={() => setContractType('location')}
              style={[styles.typeCard, contractType === 'location' && styles.typeCardActive]}
            >
              <View style={[styles.typeIcon, { backgroundColor: contractType === 'location' ? '#dbeafe' : '#f1f5f9' }]}>
                <Ionicons name="key-outline" size={28} color={contractType === 'location' ? '#2563eb' : '#94a3b8'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.typeTitle, contractType === 'location' && { color: '#2563eb' }]}>Location</Text>
                <Text style={styles.typeDesc}>Maison, appartement, terrain, studio...</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setContractType('vente')}
              style={[styles.typeCard, contractType === 'vente' && styles.typeCardActive]}
            >
              <View style={[styles.typeIcon, { backgroundColor: contractType === 'vente' ? '#dbeafe' : '#f1f5f9' }]}>
                <Ionicons name="cart-outline" size={28} color={contractType === 'vente' ? '#2563eb' : '#94a3b8'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.typeTitle, contractType === 'vente' && { color: '#2563eb' }]}>Vente</Text>
                <Text style={styles.typeDesc}>Vente de terrain, maison, immeuble...</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* ─── STEP 1 : Sélection du bien ─── */}
        {step === 1 && (
          <View>
            <Text style={styles.stepTitle}>Sélectionnez le bien</Text>
            {biens.map((item, index) => (
              <TouchableOpacity
                key={item.id_bien || `b-${index}`}
                onPress={() => setSelectedBien(item)}
                style={[styles.listItem, selectedBien?.id_bien === item.id_bien && styles.listItemActive]}
              >
                <View style={[styles.listIcon, { backgroundColor: selectedBien?.id_bien === item.id_bien ? '#dbeafe' : '#f1f5f9' }]}>
                  <Ionicons
                    name={(item.type_bien === 'terrain' ? 'map-outline' : 'home-outline') as any}
                    size={22}
                    color={selectedBien?.id_bien === item.id_bien ? '#2563eb' : '#94a3b8'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listTitle}>{item.titre}</Text>
                  {item.adresse && <Text style={styles.listSub}>{item.adresse}</Text>}
                </View>
                {item.prix ? (
                  <Text style={{ color: '#2563eb', fontWeight: '700', fontSize: 14 }}>{item.prix.toLocaleString()} F</Text>
                ) : null}
              </TouchableOpacity>
            ))}
            {biens.length === 0 && (
              <View style={{ alignItems: 'center', paddingTop: 40 }}>
                <Ionicons name="home-outline" size={48} color="#e2e8f0" />
                <Text style={{ color: '#94a3b8', marginTop: 12 }}>Aucun bien disponible</Text>
              </View>
            )}
          </View>
        )}

        {/* ─── STEP 2 : Sélection du locataire/acheteur ─── */}
        {step === 2 && (
          <View>
            <Text style={styles.stepTitle}>
              {contractType === 'location' ? 'Sélectionnez le locataire' : "Sélectionnez l'acheteur"}
            </Text>
            {locatairesPourBien.map((item, index) => {
              const nom = `${item.prenom_interlocuteur || ''} ${item.nom_interlocuteur || ''}`.trim();
              return (
                <TouchableOpacity
                  key={item.id_interlocuteur || `l-${index}`}
                  onPress={() => setSelectedLocataire(item)}
                  style={[styles.listItem, selectedLocataire?.id_interlocuteur === item.id_interlocuteur && styles.listItemActive]}
                >
                  <View style={[styles.listIcon, { borderRadius: 20, backgroundColor: selectedLocataire?.id_interlocuteur === item.id_interlocuteur ? '#dbeafe' : '#f1f5f9' }]}>
                    <Ionicons name="person" size={20} color={selectedLocataire?.id_interlocuteur === item.id_interlocuteur ? '#2563eb' : '#94a3b8'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listTitle}>{nom || 'Inconnu'}</Text>
                    {item.titre_bien && <Text style={styles.listSub}>{item.titre_bien}</Text>}
                  </View>
                </TouchableOpacity>
              );
            })}
            {locatairesPourBien.length === 0 && (
              <View style={{ alignItems: 'center', paddingTop: 40 }}>
                <Ionicons name="people-outline" size={48} color="#e2e8f0" />
                <Text style={{ color: '#94a3b8', marginTop: 12, textAlign: 'center' }}>
                  Aucune conversation pour ce bien
                </Text>
                <Text style={{ color: '#cbd5e1', marginTop: 6, textAlign: 'center', fontSize: 13 }}>
                  Vous devez d'abord avoir échangé avec un intéressé
                </Text>
              </View>
            )}

            {selectedLocataire && (
              <View style={{ marginTop: 20, backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                  <Ionicons name="alert-circle-outline" size={18} color="#f59e0b" />
                  <Text style={{ color: '#92400e', fontSize: 13, marginLeft: 8, flex: 1 }}>
                    Le nom sur l'app peut être différent du vrai nom. Confirmez le nom complet réel pour le contrat.
                  </Text>
                </View>
                <Text style={styles.label}>Nom complet réel du {contractType === 'location' ? 'locataire' : "l'acheteur"} *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Nom et prénom tels qu'ils apparaîtront sur le contrat"
                  placeholderTextColor="#94a3b8"
                  value={form.nom_locataire}
                  onChangeText={v => setForm({ ...form, nom_locataire: v })}
                />
              </View>
            )}
          </View>
        )}

        {/* ─── STEP 3 : Détails ─── */}
        {step === 3 && (
          <View>
            <Text style={styles.stepTitle}>Informations du contrat</Text>

            <View style={styles.formCard}>
              <Text style={styles.formSection}>Les parties</Text>

              <Text style={styles.label}>{contractType === 'location' ? 'Nom complet du Bailleur *' : 'Nom complet du Vendeur *'}</Text>
              <TextInput style={styles.input} placeholder="Nom et prénom" placeholderTextColor="#94a3b8"
                value={form.nom_bailleur} onChangeText={v => setForm({ ...form, nom_bailleur: v })} />

              <Text style={styles.label}>{contractType === 'location' ? 'Nom complet du Locataire *' : "Nom complet de l'Acheteur *"}</Text>
              <TextInput style={styles.input} placeholder="Nom et prénom" placeholderTextColor="#94a3b8"
                value={form.nom_locataire} onChangeText={v => setForm({ ...form, nom_locataire: v })} />

              <Text style={[styles.formSection, { marginTop: 20 }]}>Financier</Text>

              <Text style={styles.label}>{contractType === 'location' ? 'Loyer mensuel (FCFA) *' : 'Prix de vente (FCFA) *'}</Text>
              <TextInput style={styles.input} placeholder="Ex: 150000" placeholderTextColor="#94a3b8"
                keyboardType="numeric" value={form.montant}
                onChangeText={v => setForm({ ...form, montant: v.replace(/[^0-9]/g, '') })} />

              {contractType === 'location' && (
                <>
                  <Text style={styles.label}>Caution (FCFA)</Text>
                  <TextInput style={styles.input} placeholder="Ex: 200000" placeholderTextColor="#94a3b8"
                    keyboardType="numeric" value={form.caution}
                    onChangeText={v => setForm({ ...form, caution: v.replace(/[^0-9]/g, '') })} />

                  <Text style={[styles.formSection, { marginTop: 20 }]}>Durée</Text>

                  <Text style={styles.label}>Durée (mois) *</Text>
                  <TextInput style={styles.input} placeholder="Ex: 1, 6, 12..." placeholderTextColor="#94a3b8"
                    keyboardType="numeric" value={form.duree_mois}
                    onChangeText={v => setForm({ ...form, duree_mois: v.replace(/[^0-9]/g, '') })} />

                  <Text style={styles.label}>Date de début (JJ/MM/AAAA)</Text>
                  <TextInput style={styles.input} placeholder="25/02/2026" placeholderTextColor="#94a3b8"
                    value={form.date_debut} onChangeText={v => setForm({ ...form, date_debut: v })} />
                </>
              )}

              <Text style={[styles.formSection, { marginTop: 20 }]}>Autre</Text>
              <Text style={styles.label}>Conditions particulières</Text>
              <TextInput style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                placeholder="Ex: Animaux autorisés, parking inclus..." placeholderTextColor="#94a3b8"
                multiline value={form.conditions}
                onChangeText={v => setForm({ ...form, conditions: v })} />
            </View>
          </View>
        )}

        {/* ─── STEP 4 : Aperçu + IA + Signature ─── */}
        {step === 4 && (
          <View>
            {/* Aperçu format papier */}
            <View style={styles.paper}>
              <View style={styles.paperHeader}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#2563eb', letterSpacing: 1 }}>APP IMMOBILIER</Text>
                <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Plateforme de gestion immobilière</Text>
              </View>
              <Text style={styles.paperText}>{generatedContract}</Text>

              {/* Signature */}
              <View style={{ marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0' }}>
                {signed ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                    <Text style={{ color: '#10b981', fontWeight: '700', marginLeft: 6, fontSize: 14 }}>
                      Signé par le Bailleur
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert(
                        'Signature numérique',
                        'En cliquant "Signer", vous confirmez avoir lu et approuvé ce contrat.',
                        [
                          { text: 'Annuler', style: 'cancel' },
                          { text: 'Lu, approuvé et signé', onPress: () => setSigned(true) },
                        ]
                      );
                    }}
                    style={styles.signButton}
                  >
                    <Ionicons name="create" size={18} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Lu, approuvé et signé</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Modifier les informations */}
            <TouchableOpacity
              onPress={() => { setSigned(false); setStep(3); }}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#f59e0b', backgroundColor: '#fffbeb', marginTop: 12 }}
            >
              <Ionicons name="create-outline" size={20} color="#f59e0b" />
              <Text style={{ color: '#92400e', fontSize: 15, fontWeight: '700', marginLeft: 8 }}>Modifier les informations</Text>
            </TouchableOpacity>

            {/* Actions */}
            <View style={{ gap: 10, marginTop: 16 }}>
              <TouchableOpacity onPress={handlePDF} style={styles.actionBtn}>
                <Ionicons name="download-outline" size={20} color="#2563eb" />
                <Text style={{ color: '#2563eb', fontSize: 15, fontWeight: '700', marginLeft: 8 }}>Télécharger PDF</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSendToTenant}
                disabled={loading}
                style={[styles.primaryBtn, !signed && { opacity: 0.5 }]}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="paper-plane" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                      Envoyer au {contractType === 'location' ? 'locataire' : "à l'acheteur"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bouton Suivant (steps 0-3) */}
      {step < 4 && (
        <View style={{ padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e2e8f0' }}>
          <TouchableOpacity
            onPress={handleNext}
            disabled={!canGoNext() || loading}
            style={[styles.primaryBtn, (!canGoNext() || loading) && { opacity: 0.5 }]}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                {step === 3 ? 'Générer le contrat' : 'Suivant'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

// ── Styles ──
const styles = {
  stepTitle: { fontSize: 20, fontWeight: '700' as const, color: '#1e293b', marginBottom: 20 },

  typeCard: {
    backgroundColor: '#fff', padding: 20, borderRadius: 14,
    borderWidth: 1.5, borderColor: '#e2e8f0',
    flexDirection: 'row' as const, alignItems: 'center' as const, marginBottom: 12,
  },
  typeCardActive: { borderColor: '#2563eb', backgroundColor: '#f0f7ff' },
  typeIcon: {
    width: 56, height: 56, borderRadius: 14,
    alignItems: 'center' as const, justifyContent: 'center' as const, marginRight: 16,
  },
  typeTitle: { fontSize: 18, fontWeight: '700' as const, color: '#1e293b' },
  typeDesc: { fontSize: 13, color: '#64748b', marginTop: 2 },

  listItem: {
    backgroundColor: '#fff', padding: 16, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#e2e8f0',
    flexDirection: 'row' as const, alignItems: 'center' as const, marginBottom: 10,
  },
  listItemActive: { borderColor: '#2563eb', backgroundColor: '#f0f7ff' },
  listIcon: {
    width: 44, height: 44, borderRadius: 10,
    alignItems: 'center' as const, justifyContent: 'center' as const, marginRight: 14,
  },
  listTitle: { fontSize: 16, fontWeight: '600' as const, color: '#1e293b' },
  listSub: { fontSize: 13, color: '#64748b', marginTop: 2 },

  formCard: { backgroundColor: '#fff', borderRadius: 14, padding: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  formSection: { fontSize: 13, fontWeight: '700' as const, color: '#2563eb', letterSpacing: 1, marginBottom: 10 },
  label: { fontSize: 14, fontWeight: '600' as const, color: '#475569', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10,
    padding: 12, fontSize: 15, backgroundColor: '#f8fafc', color: '#1e293b', marginBottom: 14,
  },

  paper: {
    backgroundColor: '#fff', borderRadius: 4, padding: 24,
    borderWidth: 1, borderColor: '#d1d5db',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },
  paperHeader: {
    alignItems: 'center' as const, paddingBottom: 14, marginBottom: 16,
    borderBottomWidth: 2, borderBottomColor: '#2563eb',
  },
  paperText: { fontSize: 13, lineHeight: 21, color: '#1e293b' },

  signButton: {
    backgroundColor: '#2563eb', padding: 14, borderRadius: 10,
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
  },

  actionBtn: {
    backgroundColor: '#fff', padding: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#2563eb',
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  primaryBtn: {
    backgroundColor: '#2563eb', padding: 16, borderRadius: 14,
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
  },
};

// ── HTML pour le PDF ──
function getContractHTML(content: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      body { font-family: Georgia, serif; margin: 0; padding: 40px; color: #1a1a1a; line-height: 1.7; }
      .header { text-align: center; padding-bottom: 16px; border-bottom: 3px double #2563eb; margin-bottom: 24px; }
      .app-name { font-size: 20px; font-weight: bold; color: #2563eb; letter-spacing: 2px; }
      .sub { font-size: 10px; color: #888; }
      pre { white-space: pre-wrap; font-family: Georgia, serif; font-size: 13px; }
      .footer { text-align: center; margin-top: 30px; padding-top: 12px; border-top: 1px solid #ccc; font-size: 9px; color: #aaa; }
    </style></head><body>
    <div class="header">
      <div class="app-name">APP IMMOBILIER</div>
      <div class="sub">Plateforme de gestion immobilière</div>
    </div>
    <pre>${content}</pre>
    <div class="footer">Document généré par App Immobilier</div>
  </body></html>`;
}
