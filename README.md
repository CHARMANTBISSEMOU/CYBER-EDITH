# 🏠 App Immobilière — Backend API

> **Développé pour le projet tutoré KEYCE**
> **Auteur : BISSEMOU CHARLES CHARMANT**

---

## 📋 Description du projet

API REST complète pour une application mobile de gestion immobilière au Cameroun.
Le backend gère l'ensemble des fonctionnalités : authentification, gestion des biens,
contrats de location (générés par IA), messagerie en temps réel, paiements mobiles
via NotchPay, et un système anti-triche par géolocalisation GPS.

---

## 🛠 Stack Technique

| Technologie | Rôle |
|---|---|
| **FastAPI** (Python) | Framework web / API REST |
| **SQLAlchemy** | ORM pour la base de données |
| **MySQL** (Clever Cloud) | Base de données relationnelle |
| **Cloudinary** | Stockage des images, vidéos et PDF |
| **Claude API** (Anthropic) | Génération et personnalisation des contrats + vérification d'images |
| **NotchPay** | Paiements Mobile Money (MTN, Orange Money) |
| **ReportLab** | Génération de PDF (contrats, factures) |
| **JWT** (python-jose) | Authentification par tokens |
| **bcrypt** | Hashage des mots de passe |
| **WebSocket** | Messagerie en temps réel |

---

## 📁 Architecture du projet

```
├── main.py                  # Point d'entrée — FastAPI app + CORS + inclusion des routes
├── database.py              # Connexion MySQL (Clever Cloud) + SessionLocal + create_tables()
├── models.py                # 11 modèles SQLAlchemy (tables de la BDD)
├── auth.py                  # Authentification : JWT, hashage bcrypt, middleware protégé
├── schemas.py               # Schémas Pydantic — utilisateurs (inscription, connexion, profil)
├── schemas_biens.py         # Schémas Pydantic — biens (publication, modification, recherche)
├── notchpay_config.py       # Configuration des clés API NotchPay
├── notchpay_routes.py       # Routes de paiement NotchPay (initier, vérifier, webhook, historique)
├── requirements.txt         # Dépendances Python
├── .env                     # Variables d'environnement (clés API, BDD, SMTP)
│
├── routes/
│   ├── utilisateurs.py      # Inscription, connexion, profil, mot de passe oublié
│   ├── biens.py             # CRUD biens + recherche avancée + géocodage auto
│   ├── medias.py            # Upload images/vidéos + compression + vérification IA
│   ├── contrats.py          # Contrats générés par Claude IA + PDF + cycle de vie complet
│   ├── messages.py          # Messagerie REST + WebSocket temps réel
│   ├── notifications.py     # Notifications (contrat, message, paiement, détection GPS)
│   ├── geolocalisation.py   # Système anti-triche GPS (détection, alertes, pénalités)
│   ├── paiements.py         # Gestion complète des paiements et abonnements
│   ├── webhooks.py          # Webhooks externes
│   └── images.py            # Routes legacy (images Cloudinary)
```

---

## 📊 Modèle de données (11 tables)

| # | Table | Description |
|---|---|---|
| 1 | **Utilisateur** | Comptes utilisateurs (email, téléphone, badge certifié, consentement GPS) |
| 2 | **Bien** | Biens immobiliers (studio, maison, appartement, bureau, terrain, chambre) |
| 3 | **Image** | Médias des biens (images + vidéos stockées sur Cloudinary) |
| 4 | **ContratLoyer** | Contrats de location (brouillon → en_attente → actif → résilié) |
| 5 | **PaiementLoyer** | Paiements mensuels de loyer (Orange Money, MTN MoMo, espèces, virement) |
| 6 | **Geolocalisation** | Positions GPS des utilisateurs et biens (système anti-triche) |
| 7 | **Message** | Messages du chat entre utilisateurs (avec indicateur lu/non-lu) |
| 8 | **Notification** | Notifications (contrat, message, paiement, détection, système) |
| 9 | **Alerte** | Alertes personnalisées ("préviens-moi si un studio est dispo à Bonamoussadi") |
| 10 | **RechercheHistorique** | Historique des recherches (auto-nettoyé après 35 jours) |
| 11 | **Transaction** | Transactions financières NotchPay (publication, service, commission, pénalité) |

---

## 🔐 Authentification

- **Inscription** : validation email, téléphone camerounais (237XXXXXXXXX), mot de passe ≥ 6 caractères
- **Connexion** : email + mot de passe → token JWT (24h)
- **Routes protégées** : `Depends(obtenir_utilisateur_actuel)` vérifie le token Bearer
- **Mot de passe oublié** : code à 4 chiffres envoyé par email (expire en 15 min)
- **Hashage** : bcrypt (sel aléatoire)

---

## 🏘 Gestion des biens

- **Publication** : titre, type, ville, quartier, prix (loyer/vente), superficie, chambres, meublé
- **Géocodage automatique** : OpenStreetMap Nominatim convertit l'adresse en GPS
- **Recherche avancée** : filtres multiples (ville, quartier, type, prix min/max, chambres, texte libre)
- **Tri** : par date, prix croissant/décroissant, superficie
- **Pagination** : configurable (1-50 résultats par page)
- **Protection** : seul le propriétaire peut modifier/supprimer ; suppression interdite si contrat actif

---

## 📸 Médias (Images & Vidéos)

- **Images** : JPEG, PNG, WebP — compression auto (max 1200x1200, qualité 60%)
- **Vidéos** : MP4, MOV, AVI, WebM — max 1 minute, 50 Mo
- **Vérification IA** : Claude Vision vérifie que l'image est bien un bien immobilier
- **Limites** : 5 images + 2 vidéos par bien
- **Stockage** : Cloudinary (suppression cascade en BDD et cloud)

---

## 📝 Contrats de location (IA)

Cycle de vie complet avec génération par **Claude API (Anthropic)** :

1. **Initier** → Claude rédige un brouillon adapté au droit camerounais
2. **Personnaliser** → Discussion illimitée avec Claude pour modifier le contrat
3. **Valider** → PDF professionnel généré (ReportLab) + uploadé sur Cloudinary
4. **Accepter/Refuser** → Le locataire accepte ou refuse le contrat
5. **Résilier** → Résiliation possible par les deux parties
6. **Badge certifié** → Attribué automatiquement après 3 contrats

---

## 💬 Messagerie

- **REST** : envoyer, lister conversations, historique, marquer comme lu
- **WebSocket** : réception instantanée des messages en temps réel
- **Règle** : une conversation démarre uniquement via une annonce (id_bien obligatoire)
- **Notifications** : notification push créée automatiquement à chaque nouveau message

---

## 📍 Système Anti-Triche GPS

Mécanisme de détection automatique :

1. L'utilisateur recherche un bien sur l'app → recherche sauvegardée
2. Il visite/emménage dans le bien (vie réelle)
3. Le GPS détecte qu'il est à **moins de 100m** d'un bien recherché
4. Alerte créée → **5 000 FCFA** de frais de service demandés
5. Refus de paiement → **pénalité de 10 000 FCFA**

Deux options pour l'utilisateur :
- **Option A (GPS)** : accepte le suivi → position envoyée toutes les heures → paye 5 000 FCFA si détection
- **Option B (abonnement)** : refuse le GPS → paye l'abonnement annuel (10 000 FCFA propriétaire / 5 000 FCFA visiteur)

---

## 💰 Paiements (NotchPay)

- **Initier** un paiement Mobile Money (MTN, Orange Money)
- **Vérifier** le statut d'un paiement
- **Webhook** : réception automatique des confirmations NotchPay
- **Facture PDF** : générée et envoyée par email après paiement réussi
- **Historique** : par utilisateur ou par bien

### Tarification
| Formule | Propriétaire | Visiteur/Locataire |
|---|---|---|
| Abonnement annuel | 10 000 FCFA/an | 5 000 FCFA/an (pas de publication) |
| Paiement par service | 5 000 FCFA/service | 5 000 FCFA/service |

---

## 🚀 Installation et lancement

```bash
# 1. Cloner le repo
git clone https://github.com/CHARMANTBISSEMOU/CYBER-EDITH.git
cd CYBER-EDITH

# 2. Installer les dépendances
pip install -r requirements.txt

# 3. Configurer le .env (clés API, BDD, SMTP)
cp .env.example .env

# 4. Lancer le serveur
python main.py
# ou
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

📚 Documentation Swagger disponible sur : `http://localhost:8000/docs`

---

## 🔑 Variables d'environnement requises

```env
# Base de données MySQL
DATABASE_URL=mysql+pymysql://user:password@host:port/database

# JWT
SECRET_KEY=votre_cle_secrete
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Cloudinary (stockage médias)
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx

# Anthropic (Claude IA)
ANTHROPIC_API_KEY=sk-ant-xxx

# NotchPay (paiements)
NOTCHPAY_PUBLIC_KEY=pk.xxx
NOTCHPAY_PRIVATE_KEY=sk.xxx
NOTCHPAY_HASH_KEY=hsk.xxx

# Email (SMTP)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
EMAIL_USER=votre@email.com
EMAIL_PASSWORD=votre_mot_de_passe_app
```

---

## 📱 Application Mobile (Frontend)

Le frontend React Native (Expo) est disponible sur la branche `backup-mobile-app-25feb2026`.

**Stack frontend** : React Native + TypeScript + Expo + Zustand + expo-av + expo-speech

**Fonctionnalités frontend** :
- Interface bilingue FR/EN (i18n complet)
- Conditions d'utilisation avec synthèse vocale (TTS)
- Upload images/vidéos avec lecteur vidéo fullscreen
- Messagerie en temps réel
- Gestion des contrats avec prévisualisation PDF
- Système de géolocalisation GPS
- Paiements NotchPay intégrés

---

## 👤 Auteur

**BISSEMOU CHARLES CHARMANT**
Projet tutoré — KEYCE

---
