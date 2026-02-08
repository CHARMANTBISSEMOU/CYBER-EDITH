"""
routes/paiements.py — Système de paiements via NotchPay (Mobile Money)

═══════════════════════════════════════════════════════════════
BUT DU MODULE :
═══════════════════════════════════════════════════════════════

Permettre aux utilisateurs de payer via Mobile Money (MTN / Orange)
et reverser l'argent aux propriétaires pour les loyers.

═══════════════════════════════════════════════════════════════
COMMENT ÇA MARCHE (exemple concret) :
═══════════════════════════════════════════════════════════════

1. Jean doit payer quelque chose (loyer, frais de service, etc.)
2. Notre backend crée un paiement chez NotchPay
3. NotchPay retourne un LIEN DE PAIEMENT
4. Jean clique sur le lien → page NotchPay
5. Jean choisit MTN ou Orange → entre son numéro → confirme
6. NotchPay nous notifie via WEBHOOK que le paiement est OK
7. Notre backend met à jour la BDD

Pour les LOYERS spécifiquement :
1. Jean (locataire) demande à payer son loyer
2. L'app envoie une demande de confirmation à Marie (propriétaire)
3. Marie confirme que son numéro mobile money est toujours bon
4. SEULEMENT APRÈS → Jean peut payer
5. L'argent arrive chez NotchPay → automatiquement reversé à Marie (0% commission)


Jean envoie un message    → notifier_nouveau_message() → Marie reçoit 🔔
Contrat créé              → notifier_contrat("cree")   → Locataire reçoit 🔔
Contrat accepté           → notifier_contrat("accepte") → Proprio reçoit 🔔
Contrat refusé            → notifier_contrat("refuse")  → Proprio reçoit 🔔
Détection GPS             → notifier_detection()        → Utilisateur reçoit 🔔
Loyer initié              → notifier_paiement("attente_confirm") → Proprio reçoit 🔔
Numéro confirmé           → notifier_paiement("numero_confirme") → Locataire reçoit 🔔
Loyer payé                → notifier_paiement("loyer_paye") → Locataire reçoit 🔔
                          → notifier_paiement("loyer_recu") → Proprio reçoit 🔔

═══════════════════════════════════════════════════════════════
LES TYPES DE PAIEMENT :
═══════════════════════════════════════════════════════════════

1. FRAIS DE SERVICE = 5 000 FCFA
   → L'utilisateur a trouvé un bien via l'app (détecté par GPS)

2. OPTION B GPS = 5 000 FCFA (ou 10 000 pour proprio)
   → L'utilisateur refuse le suivi GPS, il paye directement

3. PÉNALITÉ = 10 000 FCFA
   → Contestation non justifiée d'une détection GPS

4. LOYER = montant variable
   → Le locataire paye son loyer → l'argent va au propriétaire
   → 0% de commission (l'app ne prend rien sur les loyers)

═══════════════════════════════════════════════════════════════
LES 7 ROUTES :
═══════════════════════════════════════════════════════════════

POST   /paiements/initier                  → Payer frais de service, option B, pénalité
POST   /paiements/initier-loyer            → Payer un loyer (demande confirmation numéro au proprio)
PUT    /paiements/{id}/confirmer-numero     → Le proprio confirme son numéro mobile money
POST   /paiements/webhook                  → NotchPay nous notifie du résultat (automatique)
GET    /paiements/verifier/{reference}      → Vérifier manuellement le statut d'un paiement
GET    /paiements/mes-paiements             → Historique de mes paiements
GET    /paiements/revenus                   → Mes revenus reçus (pour les propriétaires)
"""

# ============================================
# LES IMPORTS
# ============================================

# FastAPI : le framework web
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

# SQLAlchemy : pour communiquer avec la BDD MySQL
from sqlalchemy.orm import Session

# datetime : pour manipuler les dates
from datetime import datetime, timezone

# requests : pour envoyer des requêtes HTTP à l'API NotchPay
# C'est comme envoyer des lettres à NotchPay et recevoir des réponses
import requests

# hashlib, hmac : pour vérifier que les webhooks viennent bien de NotchPay (sécurité)
import hashlib
import hmac

# uuid : pour générer des identifiants uniques
import uuid

# json : pour lire/écrire du JSON
import json

# os : pour lire les variables d'environnement (.env)
import os

# dotenv : pour charger le fichier .env
from dotenv import load_dotenv

# Nos fichiers : connexion BDD, modèles des tables, authentification
from database import get_db
from models import Utilisateur, Bien, ContratLoyer, Transaction, Alerte
from auth import obtenir_utilisateur_actuel
from routes.notifications import notifier_paiement

# Charger les variables d'environnement
load_dotenv()


# ============================================
# CRÉATION DU ROUTEUR
# ============================================
# Toutes les routes seront sous le préfixe "/paiements"
# Exemple : POST /paiements/initier, GET /paiements/mes-paiements, etc.

routeur = APIRouter(prefix="/paiements", tags=["Paiements (NotchPay)"])


# ============================================
# LES CONSTANTES ET CONFIGURATION
# ============================================

# Les clés API NotchPay (récupérées depuis le fichier .env)
# Public Key : pour initialiser les paiements (collecter l'argent)
NOTCHPAY_PUBLIC_KEY = os.getenv("NOTCHPAY_PUBLIC_KEY")

# Private Key : pour envoyer de l'argent (Transfer API) et vérifier les webhooks
NOTCHPAY_PRIVATE_KEY = os.getenv("NOTCHPAY_PRIVATE_KEY")

# Hash Key : pour vérifier que les webhooks viennent bien de NotchPay
NOTCHPAY_HASH_KEY = os.getenv("NOTCHPAY_HASH_KEY")

# L'URL de base de l'API NotchPay
NOTCHPAY_BASE_URL = "https://api.notchpay.co"

# Les montants fixes
FRAIS_SERVICE_FCFA = 5_000              # Frais quand on a trouvé un bien via l'app
OPTION_B_PROPRIO_FCFA = 10_000          # Option B GPS pour les propriétaires
OPTION_B_AUTRES_FCFA = 5_000            # Option B GPS pour les autres
PENALITE_FCFA = 10_000                  # Pénalité contestation non justifiée

# Commission sur les loyers : 0% (l'app ne prend rien)
COMMISSION_LOYER_POURCENT = 0


# ============================================
# FONCTIONS UTILITAIRES NOTCHPAY
# ============================================

def initialiser_paiement_notchpay(
    montant: int,
    email: str,
    telephone: str,
    description: str,
    reference: str,
    callback_url: str = None
) -> dict:
    """
    Créer un paiement chez NotchPay.
    
    C'est comme envoyer une lettre à NotchPay :
    "Bonjour, Jean doit payer 5 000 FCFA. Voici ses infos."
    
    NotchPay répond :
    "OK, voici le lien de paiement : https://pay.notchpay.co/..."
    
    CE QUI SE PASSE :
    1. On envoie les infos du paiement à NotchPay (montant, email, téléphone)
    2. NotchPay crée la transaction et retourne :
       - reference : le numéro de suivi (ex: "trx.1OFePHll...")
       - authorization_url : le lien où Jean va payer
       - status : "pending" (en attente)
    """
    
    # Vérifier que la clé est configurée
    if not NOTCHPAY_PUBLIC_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Clé NotchPay non configurée. Ajoute NOTCHPAY_PUBLIC_KEY dans le .env"
        )
    
    # Préparer les données à envoyer à NotchPay
    donnees = {
        "amount": montant,
        "currency": "XAF",           # Franc CFA (monnaie du Cameroun)
        "customer": {
            "email": email,
            "phone": telephone
        },
        "description": description,
        "reference": reference
    }
    
    # Ajouter le callback URL si fourni
    # (l'URL où NotchPay redirige l'utilisateur après paiement)
    if callback_url:
        donnees["callback"] = callback_url
    
    # Les headers (en-têtes) de la requête
    # Authorization = notre clé publique NotchPay
    headers = {
        "Authorization": NOTCHPAY_PUBLIC_KEY,
        "Content-Type": "application/json"
    }
    
    try:
        # Envoyer la requête POST à NotchPay
        # C'est comme envoyer la lettre et attendre la réponse
        reponse = requests.post(
            f"{NOTCHPAY_BASE_URL}/payments",
            json=donnees,
            headers=headers,
            timeout=30  # Attendre max 30 secondes
        )
        
        # Lire la réponse de NotchPay
        resultat = reponse.json()
        
        # Vérifier si NotchPay a accepté
        if reponse.status_code in [200, 201]:
            return resultat
        else:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Erreur NotchPay : {resultat.get('message', 'Erreur inconnue')}"
            )
    
    except requests.exceptions.Timeout:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="NotchPay ne répond pas. Réessaye dans quelques minutes."
        )
    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Impossible de contacter NotchPay : {str(e)}"
        )


def verifier_paiement_notchpay(reference: str) -> dict:
    """
    Demander à NotchPay le statut d'un paiement.
    
    C'est comme appeler NotchPay : 
    "Bonjour, le paiement trx.1OFePHll, il est passé ?"
    
    NotchPay répond :
    "Oui, status = complete" ou "Non, status = pending"
    """
    
    headers = {
        "Authorization": NOTCHPAY_PUBLIC_KEY,
        "Content-Type": "application/json"
    }
    
    try:
        reponse = requests.get(
            f"{NOTCHPAY_BASE_URL}/payments/{reference}",
            headers=headers,
            timeout=30
        )
        
        return reponse.json()
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Impossible de vérifier le paiement : {str(e)}"
        )


def transferer_argent_notchpay(
    montant: int,
    telephone: str,
    nom: str,
    email: str,
    description: str,
    reference: str,
    canal: str = "cm.mtn"
) -> dict:
    """
    Envoyer de l'argent à quelqu'un via NotchPay (Transfer API).
    
    Utilisé pour reverser le loyer au propriétaire.
    
    Exemple :
    Jean paye 75 000 FCFA de loyer → l'argent arrive chez NotchPay
    → On utilise cette fonction pour envoyer 75 000 FCFA au numéro de Marie
    
    PARAMÈTRES :
    - montant : combien envoyer (en FCFA)
    - telephone : numéro mobile money du propriétaire (ex: "+237691234567")
    - canal : "cm.mtn" pour MTN, "cm.orange" pour Orange
    """
    
    if not NOTCHPAY_PRIVATE_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Clé privée NotchPay non configurée. Ajoute NOTCHPAY_PRIVATE_KEY dans le .env"
        )
    
    donnees = {
        "amount": montant,
        "currency": "XAF",
        "recipient": {
            "name": nom,
            "email": email,
            "phone": telephone,
            "account_number": telephone.replace("+", ""),  # Enlever le "+" du numéro
            "channel": canal
        },
        "description": description,
        "reference": reference
    }
    
    # Pour les transferts, on utilise la CLÉ PRIVÉE (pas la publique)
    headers = {
        "Authorization": NOTCHPAY_PUBLIC_KEY,
        "X-Grant": NOTCHPAY_PRIVATE_KEY,
        "Content-Type": "application/json"
    }
    
    try:
        reponse = requests.post(
            f"{NOTCHPAY_BASE_URL}/transfers",
            json=donnees,
            headers=headers,
            timeout=30
        )
        
        resultat = reponse.json()
        
        if reponse.status_code in [200, 201]:
            return resultat
        else:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Erreur transfert NotchPay : {resultat.get('message', 'Erreur inconnue')}"
            )
    
    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Impossible d'effectuer le transfert : {str(e)}"
        )


def verifier_signature_webhook(corps_brut: bytes, signature: str) -> bool:
    """
    Vérifier que le webhook vient bien de NotchPay et pas d'un imposteur.
    
    NotchPay signe chaque webhook avec notre Hash Key.
    On recalcule la signature et on compare.
    Si c'est pareil → c'est bien NotchPay ✅
    Si c'est différent → c'est un imposteur 🚩
    """
    if not NOTCHPAY_HASH_KEY:
        return True  # Si pas de hash key configurée, on accepte (à améliorer)
    
    # Recalculer la signature avec notre clé
    signature_calculee = hmac.new(
        NOTCHPAY_HASH_KEY.encode("utf-8"),
        corps_brut,
        hashlib.sha256
    ).hexdigest()
    
    # Comparer les deux signatures
    return hmac.compare_digest(signature_calculee, signature)


# ============================================
# ROUTE 1 : INITIER UN PAIEMENT (frais de service, option B, pénalité)
# ============================================
# QUI L'APPELLE ? L'utilisateur qui doit payer quelque chose
# (PAS pour les loyers → utiliser /initier-loyer)
#
# CE QUI SE PASSE :
#   1. Jean doit payer 5 000 FCFA de frais de service
#   2. Il appelle POST /paiements/initier avec type="frais_service"
#   3. Notre backend crée un paiement chez NotchPay
#   4. NotchPay retourne un lien de paiement
#   5. Jean clique sur le lien → paye avec MTN/Orange
#   6. On sauvegarde la transaction dans notre BDD

@routeur.post("/initier", status_code=status.HTTP_201_CREATED)
def initier_paiement(
    type_paiement: str = Query(
        ..., 
        description="Type de paiement : frais_service, option_b, penalite"
    ),
    id_detection: str = Query(
        None, 
        description="ID de la détection GPS (pour frais_service et penalite)"
    ),
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel),
    db: Session = Depends(get_db)
):
    """
    Initier un paiement pour frais de service, option B GPS, ou pénalité.
    
    TYPES :
    - frais_service : 5 000 FCFA (bien trouvé via l'app)
    - option_b : 5 000 FCFA (ou 10 000 pour proprio) - refus GPS
    - penalite : 10 000 FCFA (contestation non justifiée)
    """
    
    mon_id = utilisateur_actuel.id_utilisateur
    
    # --- Déterminer le montant selon le type ---
    if type_paiement == "frais_service":
        montant = FRAIS_SERVICE_FCFA
        description = "Frais de service - Bien trouvé via App Immobilière"
        
        # Vérifier que la détection existe
        if not id_detection:
            raise HTTPException(status_code=400, detail="ID de détection requis pour les frais de service.")
        
        alerte = db.query(Alerte).filter(
            Alerte.id_alerte == id_detection,
            Alerte.id_utilisateur == mon_id
        ).first()
        
        if not alerte:
            raise HTTPException(status_code=404, detail="Détection introuvable.")
        
        if alerte.statut not in ["active", "en_attente_paiement"]:
            raise HTTPException(status_code=400, detail=f"Cette détection n'est pas en attente de paiement (statut : {alerte.statut}).")
    
    elif type_paiement == "option_b":
        # Les propriétaires payent 10 000, les autres 5 000
        # On vérifie s'il a des biens (= propriétaire)
        est_proprio = db.query(Bien).filter(Bien.id_proprietaire == mon_id).first()
        montant = OPTION_B_PROPRIO_FCFA if est_proprio else OPTION_B_AUTRES_FCFA
        description = f"Option B GPS - Paiement direct ({montant:,} FCFA)"
    
    elif type_paiement == "penalite":
        montant = PENALITE_FCFA
        description = "Pénalité - Contestation non justifiée"
        
        if not id_detection:
            raise HTTPException(status_code=400, detail="ID de détection requis pour la pénalité.")
    
    else:
        raise HTTPException(
            status_code=400, 
            detail="Type de paiement invalide. Valeurs : frais_service, option_b, penalite"
        )
    
    # --- Créer une référence unique pour ce paiement ---
    # Format : "pay_" + 12 caractères aléatoires
    reference = f"pay_{uuid.uuid4().hex[:12]}"
    
    # --- Appeler NotchPay pour créer le paiement ---
    resultat_notchpay = initialiser_paiement_notchpay(
        montant=montant,
        email=utilisateur_actuel.email,
        telephone=utilisateur_actuel.telephone or "",
        description=description,
        reference=reference
    )
    
    # --- Sauvegarder la transaction dans notre BDD ---
    nouvelle_transaction = Transaction(
        id_transaction=reference,
        id_utilisateur=mon_id,
        type_transaction="service",       # C'est un paiement de service (pas un loyer)
        montant=montant,
        reference_campay=reference,
        statut="en_cours",    # En attente du paiement
        description=description
    )
    
    db.add(nouvelle_transaction)
    
    # Si c'est un frais de service, mettre à jour l'alerte
    if type_paiement in ["frais_service", "penalite"] and id_detection:
        alerte = db.query(Alerte).filter(Alerte.id_alerte == id_detection).first()
        if alerte:
            alerte.statut = "en_attente_paiement"
    
    db.commit()
    
    # --- Retourner le lien de paiement ---
    return {
        "message": f"Paiement de {montant:,} FCFA initialisé. Clique sur le lien pour payer.",
        "id_transaction": reference,
        "montant": montant,
        "type": type_paiement,
        "statut": "en_cours",
        "lien_paiement": resultat_notchpay.get("authorization_url"),
        "reference_notchpay": resultat_notchpay.get("transaction", {}).get("reference", reference),
        "instructions": "Clique sur le lien de paiement → choisis MTN ou Orange → entre ton numéro → confirme."
    }


# ============================================
# ROUTE 2 : INITIER UN PAIEMENT DE LOYER
# ============================================
# QUI L'APPELLE ? Le locataire qui veut payer son loyer.
#
# CE QUI SE PASSE :
#   1. Jean (locataire) veut payer 75 000 FCFA de loyer
#   2. L'app NE LANCE PAS le paiement tout de suite
#   3. L'app envoie une demande à Marie (propriétaire) :
#      "Confirme que ton numéro mobile money est toujours bon"
#   4. Marie confirme → SEULEMENT LÀ le paiement se lance
#   5. Jean paye → l'argent va à Marie
#
# POURQUOI ?
#   Si Marie a changé de numéro, l'argent irait dans l'ancienne puce !
#   Avec cette vérification, on évite ce problème.

@routeur.post("/initier-loyer", status_code=status.HTTP_201_CREATED)
def initier_paiement_loyer(
    id_contrat: str = Query(..., description="ID du contrat de location"),
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel),
    db: Session = Depends(get_db)
):
    """
    Le locataire initie un paiement de loyer.
    Le propriétaire doit d'abord confirmer son numéro mobile money.
    """
    
    mon_id = utilisateur_actuel.id_utilisateur
    
    # --- Vérifier que le contrat existe ---
    contrat = db.query(ContratLoyer).filter(
        ContratLoyer.id_contrat == id_contrat
    ).first()
    
    if not contrat:
        raise HTTPException(status_code=404, detail="Contrat introuvable.")
    
    # --- Vérifier que c'est le locataire qui paye ---
    if contrat.id_locataire != mon_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seul le locataire peut payer le loyer."
        )
    
    # --- Vérifier que le contrat est actif ---
    if contrat.statut_contrat != "actif":
        raise HTTPException(
            status_code=400,
            detail=f"Le contrat n'est pas actif (statut : {contrat.statut_contrat})."
        )
    
    # --- Récupérer les infos du propriétaire ---
    proprietaire = db.query(Utilisateur).filter(
        Utilisateur.id_utilisateur == contrat.id_proprietaire
    ).first()
    
    if not proprietaire:
        raise HTTPException(status_code=404, detail="Propriétaire introuvable.")
    
    # --- Vérifier que le propriétaire a un numéro de téléphone ---
    if not proprietaire.telephone:
        raise HTTPException(
            status_code=400,
            detail="Le propriétaire n'a pas de numéro de téléphone dans son profil. Il doit d'abord en ajouter un."
        )
    
    # --- Récupérer le bien ---
    bien = db.query(Bien).filter(Bien.id_bien == contrat.id_bien).first()
    
    # --- Créer la transaction en statut "en_attente_confirmation" ---
    # Le paiement n'est PAS encore lancé !
    # On attend que le propriétaire confirme son numéro
    reference = f"loyer_{uuid.uuid4().hex[:12]}"
    
    nouvelle_transaction = Transaction(
        id_transaction=reference,
        id_utilisateur=mon_id,
        type_transaction="loyer",
        montant=contrat.montant_loyer,
        reference_campay=reference,
        statut="en_attente",    # En attente de la confirmation du proprio
        description=f"Loyer - {bien.titre if bien else 'Bien'} - {contrat.montant_loyer:,} FCFA"
    )
    
    db.add(nouvelle_transaction)
    db.commit()
    
    # --- Masquer partiellement le numéro du propriétaire ---
    # "691234567" → "6XX XXX X67" (pour la sécurité)
    tel = proprietaire.telephone
    if len(tel) >= 6:
        tel_masque = tel[:1] + "X" * (len(tel) - 3) + tel[-2:]
    else:
        tel_masque = "XXX"
    notifier_paiement(
        db=db,
        id_destinataire=contrat.id_proprietaire,    # Marie
        montant=contrat.montant_loyer,
        type_info="attente_confirm",
        nom_autre_partie=f"{utilisateur_actuel.prenom} {utilisateur_actuel.nom}",
        id_transaction=reference
    )
    db.commit()
    return {
        "message": "Paiement de loyer en attente. Le propriétaire doit d'abord confirmer son numéro mobile money.",
        "id_transaction": reference,
        "montant": contrat.montant_loyer,
        "proprietaire": f"{proprietaire.prenom} {proprietaire.nom}",
        "numero_masque": tel_masque,
        "bien": bien.titre if bien else "Bien",
        "statut": "en_attente_confirmation",
        "id_contrat": id_contrat,
        "instructions": (
            f"Le propriétaire ({proprietaire.prenom} {proprietaire.nom}) doit confirmer "
            f"que le numéro {tel_masque} est toujours actif. "
            f"Utilise PUT /paiements/{reference}/confirmer-numero"
        )
    }


# ============================================
# ROUTE 3 : CONFIRMER LE NUMÉRO MOBILE MONEY (propriétaire)
# ============================================
# QUI L'APPELLE ? Le propriétaire (Marie) pour confirmer
# que son numéro est toujours bon.
#
# CE QUI SE PASSE :
#   1. Marie reçoit la demande "Confirme ton numéro"
#   2. Marie appelle cette route avec confirmation = "oui"
#   3. Le paiement est lancé chez NotchPay
#   4. Jean reçoit le lien de paiement
#
# SI LE NUMÉRO A CHANGÉ :
#   Marie appelle PUT /utilisateurs/modifier-profil pour changer son numéro
#   Puis elle confirme avec le nouveau numéro

@routeur.put("/{id_transaction}/confirmer-numero")
def confirmer_numero(
    id_transaction: str,
    confirmation: str = Query(
        ..., 
        description="'oui' pour confirmer que ton numéro est bon, 'non' pour annuler"
    ),
    nouveau_numero: str = Query(
        None, 
        description="Si ton numéro a changé, entre le nouveau ici (ex: +237691234567)"
    ),
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel),
    db: Session = Depends(get_db)
):
    """
    Le propriétaire confirme que son numéro mobile money est toujours actif.
    Si le numéro a changé, il peut en fournir un nouveau.
    """
    
    mon_id = utilisateur_actuel.id_utilisateur
    
    # --- Trouver la transaction ---
    transaction = db.query(Transaction).filter(
        Transaction.id_transaction == id_transaction
    ).first()
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction introuvable.")
    
    # --- Vérifier que c'est un paiement de loyer en attente ---
    if transaction.type_transaction != "loyer":
        raise HTTPException(status_code=400, detail="Cette route est réservée aux paiements de loyer.")
    
    if transaction.statut != "en_attente":
        raise HTTPException(
            status_code=400,
            detail=f"Cette transaction n'est plus en attente de confirmation (statut : {transaction.statut})."
        )
    
    # --- Vérifier que c'est bien le propriétaire ---
    # Le propriétaire = celui qui a un contrat actif lié à ce paiement de loyer
    # On retrouve le contrat via la description ou via le locataire
    locataire = db.query(Utilisateur).filter(
        Utilisateur.id_utilisateur == transaction.id_utilisateur
    ).first()
    
    # Trouver le contrat actif entre le locataire et ce propriétaire
    contrat = db.query(ContratLoyer).filter(
        ContratLoyer.id_locataire == transaction.id_utilisateur,
        ContratLoyer.id_proprietaire == mon_id,
        ContratLoyer.statut_contrat == "actif"
    ).first()
    
    if not contrat:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu n'es pas le propriétaire concerné par ce paiement."
        )
    
    # --- Si le propriétaire dit "non" → annuler le paiement ---
    if confirmation.lower() != "oui":
        transaction.statut = "annulee"
        db.commit()
        return {
            "message": "Paiement annulé par le propriétaire.",
            "id_transaction": id_transaction,
            "statut": "annulee"
        }
    
    # --- Si le propriétaire a fourni un nouveau numéro → mettre à jour son profil ---
    if nouveau_numero:
        utilisateur_actuel.telephone = nouveau_numero
        db.commit()
    
    # --- Maintenant on lance le paiement chez NotchPay ---
    # C'est le locataire qui va payer, donc on utilise SON email et téléphone
    resultat_notchpay = initialiser_paiement_notchpay(
        montant=transaction.montant,
        email=locataire.email,
        telephone=locataire.telephone or "",
        description=transaction.description,
        reference=id_transaction
    )
    
    # --- Mettre à jour la transaction ---
    transaction.statut = "en_cours"
    db.commit()
    
    # Le numéro confirmé du propriétaire (masqué partiellement)
    tel_proprio = utilisateur_actuel.telephone
    if len(tel_proprio) >= 6:
        tel_masque = tel_proprio[:1] + "X" * (len(tel_proprio) - 3) + tel_proprio[-2:]
    else:
        tel_masque = "XXX"
    notifier_paiement(
        db=db,
        id_destinataire=transaction.id_utilisateur,  # Jean
        montant=transaction.montant,
        type_info="numero_confirme",
        nom_autre_partie=f"{utilisateur_actuel.prenom} {utilisateur_actuel.nom}",
        id_transaction=id_transaction
    )
    db.commit()
    return {
        "message": f"Numéro confirmé ! Le paiement de {transaction.montant:,} FCFA est prêt.",
        "id_transaction": id_transaction,
        "montant": transaction.montant,
        "numero_confirme": tel_masque,
        "statut": "en_cours",
        "lien_paiement": resultat_notchpay.get("authorization_url"),
        "reference_notchpay": resultat_notchpay.get("transaction", {}).get("reference", id_transaction),
        "instructions": (
            f"Le locataire ({locataire.prenom} {locataire.nom}) peut maintenant payer "
            f"en cliquant sur le lien de paiement."
        )
    }


# ============================================
# ROUTE 4 : WEBHOOK NOTCHPAY (notification automatique)
# ============================================
# QUI L'APPELLE ? NotchPay automatiquement, après chaque paiement.
#
# CE QUI SE PASSE :
#   1. Jean paye 75 000 FCFA via MTN Mobile Money
#   2. NotchPay confirme que le paiement est passé
#   3. NotchPay envoie une requête POST à notre backend :
#      { "event": "payment.complete", "data": { "reference": "loyer_abc123", "status": "complete" } }
#   4. Notre backend met à jour la BDD
#   5. Si c'est un loyer → on envoie l'argent au propriétaire (Transfer API)
#
# SÉCURITÉ :
#   On vérifie la signature du webhook avec notre Hash Key
#   pour s'assurer que ça vient vraiment de NotchPay et pas d'un hacker.
#
# NOTE : Cette route n'a PAS besoin de token JWT
#   car c'est NotchPay qui l'appelle, pas un utilisateur.

@routeur.post("/webhook")
async def webhook_notchpay(
    requete: Request,
    db: Session = Depends(get_db)
):
    """
    NotchPay nous notifie qu'un paiement a été effectué.
    Cette route est appelée automatiquement par NotchPay.
    """
    
    # --- Lire le corps de la requête (les données envoyées par NotchPay) ---
    corps_brut = await requete.body()
    
    # --- Vérifier la signature (sécurité) ---
    # NotchPay envoie un header "x-notch-signature" avec chaque webhook
    signature = requete.headers.get("x-notch-signature", "")
    
    if NOTCHPAY_HASH_KEY and signature:
        if not verifier_signature_webhook(corps_brut, signature):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Signature webhook invalide. Ce n'est pas NotchPay."
            )
    
    # --- Lire les données JSON ---
    try:
        donnees = json.loads(corps_brut)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="JSON invalide.")
    
    # --- Extraire les infos du paiement ---
    # NotchPay envoie différents formats selon la version de l'API
    evenement = donnees.get("event", "")
    data = donnees.get("data", donnees)
    
    reference = data.get("reference", "")
    statut_notchpay = data.get("status", "")
    
    if not reference:
        return {"message": "Pas de référence, webhook ignoré."}
    
    # --- Trouver la transaction dans notre BDD ---
    transaction = db.query(Transaction).filter(
        Transaction.id_transaction == reference
    ).first()
    
    if not transaction:
        return {"message": f"Transaction {reference} non trouvée dans notre BDD."}
    
    # --- Traiter selon le statut ---
    
    # ═══ PAIEMENT RÉUSSI ═══
    if statut_notchpay == "complete":
        
        transaction.statut = "terminee"
        
        # --- Si c'est un LOYER → envoyer l'argent au propriétaire ---
        if transaction.type_transaction == "loyer":
            
            # Trouver le contrat actif du locataire
            contrat = db.query(ContratLoyer).filter(
                ContratLoyer.id_locataire == transaction.id_utilisateur,
                ContratLoyer.statut_contrat == "actif",
                ContratLoyer.montant_loyer == transaction.montant
            ).first()
            
            if contrat:
                # Trouver le propriétaire et le locataire
                proprietaire = db.query(Utilisateur).filter(
                    Utilisateur.id_utilisateur == contrat.id_proprietaire
                ).first()
                locataire = db.query(Utilisateur).filter(
                    Utilisateur.id_utilisateur == transaction.id_utilisateur
                ).first()
                
                if proprietaire and proprietaire.telephone:
                    # Calculer le montant à reverser (0% commission)
                    montant_proprio = transaction.montant  # 0% commission = tout va au proprio
                    
                    # Générer une référence pour le transfert
                    ref_transfert = f"trf_{uuid.uuid4().hex[:12]}"
                    
                    # Essayer d'envoyer l'argent au propriétaire
                    try:
                        transferer_argent_notchpay(
                            montant=montant_proprio,
                            telephone=proprietaire.telephone,
                            nom=f"{proprietaire.prenom} {proprietaire.nom}",
                            email=proprietaire.email,
                            description=f"Reversement loyer - {transaction.description}",
                            reference=ref_transfert
                        )
                        
                        # Sauvegarder le transfert dans la BDD
                        transfert = Transaction(
                            id_transaction=ref_transfert,
                            id_utilisateur=contrat.id_proprietaire,
                            type_transaction="reversement",
                            montant=montant_proprio,
                            reference_campay=ref_transfert,
                            statut="terminee",
                            description=f"Reversement loyer de {transaction.description}"
                        )
                        db.add(transfert)
                        notifier_paiement(
                            db=db,
                            id_destinataire=transaction.id_utilisateur,
                            montant=transaction.montant,
                            type_info="loyer_paye",
                            id_transaction=reference
                        )
                        notifier_paiement(
                            db=db,
                            id_destinataire=contrat.id_proprietaire,
                            montant=transaction.montant,
                            type_info="loyer_recu",
                            nom_autre_partie=f"{locataire.prenom} {locataire.nom}",
                            id_transaction=reference
                        )
                        
                    except Exception as e:
                        # Si le transfert échoue, on crée une alerte pour traitement manuel
                        alerte_erreur = Alerte(
                            id_alerte=f"alt_{uuid.uuid4().hex[:12]}",
                            id_utilisateur=contrat.id_proprietaire,
                            type_alerte="erreur_transfert",
                            message=(
                                f"Le loyer de {transaction.montant:,} FCFA a été payé par le locataire "
                                f"mais le transfert vers votre numéro a échoué. "
                                f"Erreur : {str(e)}. Contactez le support."
                            ),
                            statut="active"
                        )
                        db.add(alerte_erreur)
        
        # --- Si c'est un FRAIS DE SERVICE → marquer la détection comme résolue ---
        elif transaction.type_transaction == "service":
            # Chercher l'alerte de détection liée
            alertes = db.query(Alerte).filter(
                Alerte.id_utilisateur == transaction.id_utilisateur,
                Alerte.type_alerte == "detection_bien",
                Alerte.statut == "en_attente_paiement"
            ).all()
            
            for alerte in alertes:
                alerte.statut = "resolue"
    
    # ═══ PAIEMENT ÉCHOUÉ ═══
    elif statut_notchpay in ["failed", "cancelled", "expired"]:
        transaction.statut = "echouee"
    
    # Sauvegarder tout dans la BDD
    db.commit()
    
    # Répondre à NotchPay (ils attendent un 200 OK)
    return {"message": "Webhook traité avec succès."}


# ============================================
# ROUTE 5 : VÉRIFIER MANUELLEMENT UN PAIEMENT
# ============================================
# QUI L'APPELLE ? L'utilisateur qui veut vérifier si son paiement est passé.
#
# POURQUOI ? Parfois le webhook peut être lent ou échouer.
# Cette route permet de vérifier directement chez NotchPay.
#
# CE QUI SE PASSE :
#   1. Jean demande : "Mon paiement pay_abc123, il est passé ?"
#   2. Notre backend demande à NotchPay : "Le paiement pay_abc123, c'est bon ?"
#   3. NotchPay répond : "Oui, status = complete"
#   4. On met à jour notre BDD si besoin

@routeur.get("/verifier/{id_transaction}")
def verifier_paiement(
    id_transaction: str,
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel),
    db: Session = Depends(get_db)
):
    """
    Vérifier manuellement le statut d'un paiement chez NotchPay.
    Utile si le webhook n'a pas fonctionné.
    """
    
    # --- Trouver la transaction dans notre BDD ---
    transaction = db.query(Transaction).filter(
        Transaction.id_transaction == id_transaction,
        Transaction.id_utilisateur == utilisateur_actuel.id_utilisateur
    ).first()
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction introuvable.")
    
    # --- Demander à NotchPay le statut ---
    resultat = verifier_paiement_notchpay(id_transaction)
    
    # --- Extraire le statut ---
    statut_notchpay = resultat.get("transaction", {}).get("status", "unknown")
    
    # --- Mettre à jour notre BDD si le statut a changé ---
    ancien_statut = transaction.statut
    
    if statut_notchpay == "complete" and transaction.statut != "terminee":
        transaction.statut = "terminee"
        db.commit()
        
    elif statut_notchpay in ["failed", "cancelled", "expired"]:
        transaction.statut = "echouee"
        db.commit()
    
    return {
        "id_transaction": id_transaction,
        "statut_notchpay": statut_notchpay,
        "statut_bdd": transaction.statut,
        "montant": transaction.montant,
        "type": transaction.type_transaction,
        "mis_a_jour": ancien_statut != transaction.statut,
        "description": transaction.description
    }


# ============================================
# ROUTE 6 : MES PAIEMENTS (historique)
# ============================================
# QUI L'APPELLE ? L'utilisateur qui veut voir tous ses paiements.
#
# CE QUI SE PASSE :
#   On retourne la liste de toutes ses transactions :
#   - Loyers payés
#   - Frais de service
#   - Option B GPS
#   - Pénalités

@routeur.get("/mes-paiements")
def mes_paiements(
    type_transaction: str = Query(None, description="Filtrer : loyer, service, reversement"),
    statut: str = Query(None, description="Filtrer : en_attente, en_cours, terminee, echouee, annulee"),
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel),
    db: Session = Depends(get_db)
):
    """Voir l'historique de tous mes paiements."""
    
    mon_id = utilisateur_actuel.id_utilisateur
    
    # Construire la requête
    # SQL : SELECT * FROM transaction WHERE id_utilisateur = Jean
    requete = db.query(Transaction).filter(
        Transaction.id_utilisateur == mon_id
    )
    
    # Appliquer les filtres si demandés
    if type_transaction:
        requete = requete.filter(Transaction.type_transaction == type_transaction)
    
    if statut:
        requete = requete.filter(Transaction.statut == statut)
    
    # Trier par date (les plus récentes d'abord)
    transactions = requete.order_by(Transaction.date_transaction.desc()).all()
    
    # Construire la liste de résultats
    resultats = []
    for trans in transactions:
        resultats.append({
            "id_transaction": trans.id_transaction,
            "type": trans.type_transaction,
            "montant": trans.montant,
            "statut": trans.statut,
            "description": trans.description,
            "date": str(trans.date_transaction)
        })
    
    # Calculer les totaux
    total_paye = sum(t.montant for t in transactions if t.statut == "terminee")
    total_en_cours = sum(t.montant for t in transactions if t.statut == "en_cours")
    
    return {
        "paiements": resultats,
        "total": len(resultats),
        "total_paye": total_paye,
        "total_en_cours": total_en_cours
    }


# ============================================
# ROUTE 7 : MES REVENUS (pour les propriétaires)
# ============================================
# QUI L'APPELLE ? Le propriétaire qui veut voir combien il a reçu.
#
# CE QUI SE PASSE :
#   On cherche toutes les transactions de type "reversement"
#   pour cet utilisateur (= l'argent qu'il a reçu des locataires)
#
# EXEMPLE :
#   Marie a reçu :
#     - 75 000 FCFA le 01/02 (loyer Jean)
#     - 75 000 FCFA le 01/01 (loyer Jean)
#   Total reçu : 150 000 FCFA

@routeur.get("/revenus")
def mes_revenus(
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel),
    db: Session = Depends(get_db)
):
    """Voir mes revenus reçus (loyers reversés par l'app)."""
    
    mon_id = utilisateur_actuel.id_utilisateur
    
    # Chercher tous les reversements reçus
    # SQL : SELECT * FROM transaction
    #        WHERE id_utilisateur = Marie
    #        AND type_transaction = 'reversement'
    #        ORDER BY date_transaction DESC
    reversements = db.query(Transaction).filter(
        Transaction.id_utilisateur == mon_id,
        Transaction.type_transaction == "reversement"
    ).order_by(
        Transaction.date_transaction.desc()
    ).all()
    
    resultats = []
    for rev in reversements:
        resultats.append({
            "id_transaction": rev.id_transaction,
            "montant": rev.montant,
            "statut": rev.statut,
            "description": rev.description,
            "date": str(rev.date_transaction)
        })
    
    # Calculer le total reçu
    total_recu = sum(r.montant for r in reversements if r.statut == "terminee")
    total_en_attente = sum(r.montant for r in reversements if r.statut in ["en_cours", "en_attente"])
    
    return {
        "revenus": resultats,
        "total_reversements": len(resultats),
        "total_recu": total_recu,
        "total_en_attente": total_en_attente,
        "commission_app": f"{COMMISSION_LOYER_POURCENT}%",
        "message": f"Tu as reçu {total_recu:,} FCFA au total."
    }
