# App Immobilière - Application Mobile

Application mobile React Native (Expo) pour la plateforme immobilière camerounaise.

## 🚀 Technologies

- **React Native** avec **Expo** (Managed Workflow)
- **TypeScript** pour le typage fort
- **NativeWind** (Tailwind CSS) pour le styling
- **Axios** pour les appels API
- **Zustand** pour la gestion d'état
- **React Navigation** pour la navigation

## 📋 Prérequis

- Node.js (v16 ou supérieur)
- npm ou yarn
- Expo CLI (`npm install -g expo-cli`)
- Application Expo Go sur votre téléphone (iOS ou Android)

## 🛠️ Installation

1. Installer les dépendances :
```bash
npm install
```

2. Lancer l'application :
```bash
npm start
```

3. Scanner le QR code avec :
   - **iOS** : Application Appareil Photo
   - **Android** : Application Expo Go

## 📱 Fonctionnalités

### Authentification
- ✅ Inscription avec validation
- ✅ Connexion sécurisée
- ✅ Gestion du token JWT
- ✅ Consentement GPS

### Biens Immobiliers
- ✅ Liste des biens disponibles
- ✅ Recherche avancée avec filtres
- ✅ Détails complets d'un bien
- ✅ Affichage des caractéristiques
- ✅ Contact propriétaire

### Messagerie
- ✅ Liste des conversations
- ✅ Notifications de nouveaux messages
- ✅ Historique des échanges

### Profil
- ✅ Affichage du profil utilisateur
- ✅ Badge certifié
- ✅ Statistiques (contrats, GPS)
- ✅ Déconnexion

## 🎨 Design

L'application utilise un thème **sombre et moderne** avec :
- Couleur primaire : Bleu (#3b82f6)
- Fond : Slate foncé (#0f172a)
- Cartes : Slate (#1e293b)
- Bordures : Slate (#334155)

## 📡 API Backend

L'application se connecte à l'API backend déployée sur :
```
https://app-3ea4c029-f791-4428-9269-edfcdffd064d.cleverapps.io
```

Documentation Swagger disponible sur `/docs`

## 🔐 Sécurité

- Token JWT stocké de manière sécurisée avec `expo-secure-store`
- Intercepteurs Axios pour l'authentification automatique
- Gestion des erreurs 401 (déconnexion automatique)

## 📂 Structure du Projet

```
mobile-app/
├── src/
│   ├── components/        # Composants réutilisables
│   │   ├── LoadingSpinner.tsx
│   │   └── ErrorMessage.tsx
│   ├── navigation/        # Configuration navigation
│   │   └── AppNavigator.tsx
│   ├── screens/          # Écrans de l'app
│   │   ├── auth/         # Connexion/Inscription
│   │   ├── home/         # Accueil
│   │   ├── bien/         # Détails & Recherche
│   │   ├── messages/     # Messagerie
│   │   └── profile/      # Profil
│   ├── services/         # Services API
│   │   └── api.ts
│   ├── store/           # Gestion d'état Zustand
│   │   ├── authStore.ts
│   │   └── bienStore.ts
│   └── types/           # Types TypeScript
│       └── index.ts
├── App.tsx              # Point d'entrée
├── app.json            # Configuration Expo
├── package.json
└── tailwind.config.js  # Configuration NativeWind
```

## 🧪 Scripts Disponibles

```bash
npm start          # Démarrer le serveur Expo
npm run android    # Lancer sur Android
npm run ios        # Lancer sur iOS
npm run web        # Lancer sur le web
```

## 🐛 Débogage

Pour déboguer l'application :
1. Secouer le téléphone pour ouvrir le menu développeur
2. Activer "Remote JS Debugging"
3. Ouvrir la console Chrome (localhost:19000/debugger-ui)

## 📝 Notes Importantes

- Les erreurs TypeScript actuelles sont normales avant l'installation des dépendances
- L'application nécessite une connexion internet pour fonctionner
- Le GPS doit être activé pour certaines fonctionnalités

## 🤝 Contribution

1. Créer une branche (`git checkout -b feature/nouvelle-fonctionnalite`)
2. Commit les changements (`git commit -m 'Ajout nouvelle fonctionnalité'`)
3. Push vers la branche (`git push origin feature/nouvelle-fonctionnalite`)
4. Créer une Pull Request

## 📄 Licence

Ce projet est privé et confidentiel.

## 👥 Auteurs

BISSEMOU CHARLES CHARMANT 

