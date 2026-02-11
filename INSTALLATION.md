# 🚀 Guide d'Installation - App Immobilière Mobile

## ✅ Problème Résolu : Erreur npm install

**Le problème était** : Il manquait une virgule dans le fichier `package.json` à la ligne 26.

**Solution appliquée** : Le fichier a été corrigé et `expo-speech` a été ajouté pour la synthèse vocale.

---

## 📋 Étapes d'Installation

### 1. Installer les dépendances

```bash
cd mobile-app
npm install
```

Si vous rencontrez des erreurs, essayez :

```bash
npm install --legacy-peer-deps
```

Ou avec yarn :

```bash
yarn install
```

### 2. Lancer l'application

```bash
npm start
```

Ou avec Expo CLI :

```bash
npx expo start
```

### 3. Scanner le QR Code

- **iOS** : Utilisez l'application Appareil Photo
- **Android** : Utilisez l'application Expo Go

---

## 🎙️ Nouvelle Fonctionnalité : Modal Audio des Conditions

### Fonctionnement

Au premier lancement de l'application, **avant** de pouvoir se connecter ou s'inscrire :

1. **Un modal s'affiche automatiquement** (impossible à fermer sans écouter)
2. **Synthèse vocale automatique** lit les conditions en français
3. **Le texte s'affiche** à l'écran pendant la lecture
4. **Deux options sont présentées** :
   - **Option A** : Paiement à l'acte + Suivi GPS
   - **Option B** : Abonnement annuel + Vie privée (sans GPS)
5. **Les boutons sont désactivés** pendant 20 secondes ou jusqu'à la fin de la lecture
6. **L'utilisateur doit choisir** une option pour continuer
7. **Le choix est sauvegardé** localement (ne s'affiche plus après)

### Composants Créés

- **`src/components/TermsAudioModal.tsx`** : Modal avec synthèse vocale
- **Intégration dans** `src/screens/auth/LoginScreen.tsx`

### Technologies Utilisées

- **expo-speech** : Synthèse vocale (Text-to-Speech)
- **AsyncStorage** : Sauvegarde du choix utilisateur
- **React Native Modal** : Affichage plein écran non-fermable

---

## 📦 Dépendances Installées

```json
{
  "expo": "~50.0.0",
  "expo-speech": "~11.7.0",
  "expo-secure-store": "~12.8.1",
  "react-native": "0.73.0",
  "@react-navigation/native": "^6.1.9",
  "axios": "^1.6.5",
  "zustand": "^4.5.0",
  "nativewind": "^2.0.11"
}
```

---

## 🧪 Tester la Fonctionnalité Audio

### Pour réinitialiser et revoir le modal :

1. Ouvrir l'application
2. Secouer le téléphone pour ouvrir le menu développeur
3. Sélectionner "Debug" → "Clear AsyncStorage"
4. Recharger l'application

Ou via code :

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

// Supprimer les données sauvegardées
await AsyncStorage.removeItem('termsAccepted');
await AsyncStorage.removeItem('selectedOption');
```

---

## 🎨 Personnalisation

### Modifier le texte audio

Éditez le fichier `src/components/TermsAudioModal.tsx` :

```typescript
const TERMS_TEXT = `Votre nouveau texte ici...`;
```

### Modifier la durée du timer

Changez la valeur initiale du countdown (ligne 27) :

```typescript
const [countdown, setCountdown] = useState(30); // 30 secondes au lieu de 20
```

### Modifier la langue de la synthèse vocale

Dans la fonction `Speech.speak()` :

```typescript
Speech.speak(TERMS_TEXT, {
  language: 'en-US', // Anglais
  // ou 'es-ES' pour espagnol
  pitch: 1.0,
  rate: 0.9,
});
```

---

## 🐛 Résolution de Problèmes

### Erreur : "Cannot find module 'expo-speech'"

```bash
npx expo install expo-speech
```

### La synthèse vocale ne fonctionne pas

- Vérifiez que le volume du téléphone est activé
- Sur iOS, désactivez le mode silencieux
- Testez sur un appareil physique (pas toujours supporté sur simulateur)

### Le modal ne s'affiche pas

Vérifiez dans AsyncStorage :

```javascript
const termsAccepted = await AsyncStorage.getItem('termsAccepted');
console.log('Terms accepted:', termsAccepted);
```

---

## 📱 Compatibilité

- ✅ **iOS** : iPhone 6s et supérieur
- ✅ **Android** : API 21+ (Android 5.0+)
- ✅ **Synthèse vocale** : Supportée sur tous les appareils modernes

---

## 🔐 Sécurité & Confidentialité

- Le choix de l'utilisateur (Option A ou B) est stocké **localement** sur l'appareil
- **Option A** : Active le suivi GPS (nécessite permission utilisateur)
- **Option B** : Aucun suivi GPS, respect total de la vie privée
- Les données ne sont **jamais** envoyées au serveur sans consentement

---

## 📞 Support

En cas de problème :

1. Vérifiez que toutes les dépendances sont installées
2. Supprimez `node_modules` et réinstallez : `rm -rf node_modules && npm install`
3. Nettoyez le cache Expo : `npx expo start -c`

---

## ✨ Prochaines Étapes

1. ✅ Installation des dépendances
2. ✅ Test du modal audio
3. 🔄 Intégration du choix GPS dans l'inscription
4. 🔄 Connexion au backend pour sauvegarder le choix
5. 🔄 Implémentation du système de paiement

**L'application est maintenant prête à être testée !** 🎉
