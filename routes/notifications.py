"""
routes/notifications.py — Système de notifications

═══════════════════════════════════════════════════════════════
BUT DU MODULE :
═══════════════════════════════════════════════════════════════

Prévenir les utilisateurs quand quelque chose d'important se passe.
C'est comme les notifications de WhatsApp :
  → 🔴 3 notifications non lues
  → Tu cliques → tu lis → le badge disparaît

═══════════════════════════════════════════════════════════════
LES 5 TYPES DE NOTIFICATIONS :
═══════════════════════════════════════════════════════════════

1. 💬 "message"
   "Marie t'a envoyé un message à propos de l'Appartement Bonamoussadi"
   → Créée par le module messagerie quand quelqu'un envoie un message

2. 📄 "contrat"
   "Marie t'a envoyé un contrat pour l'Appartement Bonamoussadi. Accepte ou refuse."
   "Jean a accepté le contrat !"
   "Jean a refusé le contrat."
   → Créée par le module contrats quand un contrat change de statut

3. 📍 "detection"
   "Bien détecté : Appartement Bonamoussadi. Frais de service : 5 000 FCFA."
   → Créée par le module géolocalisation quand une détection est trouvée

4. 💰 "paiement"
   Pour le locataire : "Ton paiement de 75 000 FCFA a été effectué ✅"
   Pour le proprio : "Tu as reçu 75 000 FCFA de loyer de Jean ✅"
   → Créée par le module paiements quand un paiement est confirmé

5. 🔧 "systeme"
   "Bienvenue sur l'app !" ou "Ton profil a été mis à jour"
   → Créée par le système pour des infos générales

═══════════════════════════════════════════════════════════════
COMMENT LES NOTIFICATIONS SONT CRÉÉES :
═══════════════════════════════════════════════════════════════

Les notifications NE SONT PAS créées par l'utilisateur.
Elles sont créées AUTOMATIQUEMENT par les autres modules.

Ce fichier contient :
  1. Une FONCTION UTILITAIRE : creer_notification()
     → Appelée par tous les autres modules (messages, contrats, geo, paiements)
  
  2. Les ROUTES pour que l'utilisateur consulte ses notifications :
     → Voir mes notifs, compter les non-lues, marquer comme lue, etc.

═══════════════════════════════════════════════════════════════
TABLE BDD UTILISÉE : notification (existante)
═══════════════════════════════════════════════════════════════

  id_notification     → identifiant unique (ex: "notif_a1b2c3d4e5f6")
  id_utilisateur      → qui reçoit la notification
  id_contrat          → lié à un contrat (optionnel, NULL si pas de contrat)
  id_transaction      → lié à un paiement (optionnel, NULL si pas de paiement)
  type_notification   → "message", "contrat", "detection", "paiement", "systeme"
  titre               → le titre court (ex: "Nouveau message")
  message             → le message complet (ex: "Marie t'a envoyé un message...")
  lu                  → true/false (la notif a-t-elle été lue ?)
  date_creation       → quand la notif a été créée (automatique)
  date_lecture        → quand l'utilisateur l'a lue (NULL si pas encore lue)

═══════════════════════════════════════════════════════════════
LES 5 ROUTES :
═══════════════════════════════════════════════════════════════

GET    /notifications                  → Voir toutes mes notifications (paginées)
GET    /notifications/non-lues         → Compter les non-lues (pour le badge 🔴)
PUT    /notifications/{id}/lire        → Marquer UNE notification comme lue
PUT    /notifications/tout-lire        → Marquer TOUTES comme lues
DELETE /notifications/{id}             → Supprimer une notification
"""

# ============================================
# LES IMPORTS
# ============================================

# FastAPI : le framework web
from fastapi import APIRouter, Depends, HTTPException, Query, status

# SQLAlchemy : pour communiquer avec la BDD MySQL
from sqlalchemy.orm import Session

# datetime : pour gérer les dates (quand la notif est lue)
from datetime import datetime, timezone

# uuid : pour générer des identifiants uniques
import uuid

# Nos fichiers : connexion BDD, modèles, authentification
from database import get_db
from models import Utilisateur, Notification
from auth import obtenir_utilisateur_actuel


# ============================================
# CRÉATION DU ROUTEUR
# ============================================
# Toutes les routes seront sous le préfixe "/notifications"

routeur = APIRouter(prefix="/notifications", tags=["Notifications"])


# ============================================
# FONCTION UTILITAIRE : CRÉER UNE NOTIFICATION
# ============================================
# C'est LA fonction clé du module.
# Elle est appelée par TOUS les autres modules pour créer des notifications.
#
# EXEMPLES D'UTILISATION (dans les autres modules) :
#
# Dans le module messagerie (quand Jean envoie un message à Marie) :
#   from routes.notifications import creer_notification
#   creer_notification(
#       db=db,
#       id_utilisateur=marie.id_utilisateur,   ← Marie reçoit la notif
#       type_notif="message",
#       titre="Nouveau message",
#       message="Jean t'a envoyé un message à propos de Appartement Bonamoussadi"
#   )
#
# Dans le module contrats (quand un contrat est créé) :
#   creer_notification(
#       db=db,
#       id_utilisateur=jean.id_utilisateur,    ← Jean reçoit la notif
#       type_notif="contrat",
#       titre="Nouveau contrat",
#       message="Marie t'a envoyé un contrat. Accepte ou refuse.",
#       id_contrat="ctr_abc123"                ← lié au contrat
#   )
#
# Dans le module paiements (quand un loyer est payé) :
#   creer_notification(
#       db=db,
#       id_utilisateur=marie.id_utilisateur,   ← Marie reçoit la notif
#       type_notif="paiement",
#       titre="Loyer reçu",
#       message="Tu as reçu 75 000 FCFA de loyer de Jean",
#       id_transaction="loyer_abc123"          ← lié au paiement
#   )

def creer_notification(
    db: Session,
    id_utilisateur: str,
    type_notif: str,
    titre: str,
    message: str,
    id_contrat: str = None,
    id_transaction: str = None
):
    """
    Créer une notification pour un utilisateur.
    
    PARAMÈTRES :
    - db              : la session de base de données
    - id_utilisateur  : QUI reçoit la notification
    - type_notif      : "message", "contrat", "detection", "paiement", "systeme"
    - titre           : le titre court (ex: "Nouveau message")
    - message         : le texte complet (ex: "Marie t'a envoyé un message...")
    - id_contrat      : optionnel, l'ID du contrat concerné
    - id_transaction  : optionnel, l'ID de la transaction concernée
    
    RETOURNE : la notification créée
    """
    
    # Créer la notification
    nouvelle_notification = Notification(
        id_notification=f"notif_{uuid.uuid4().hex[:12]}",
        id_utilisateur=id_utilisateur,
        type_notification=type_notif,
        titre=titre,
        message=message,
        id_contrat=id_contrat,
        id_transaction=id_transaction,
        lu=False,                # Pas encore lue
        date_lecture=None         # Pas encore de date de lecture
    )
    
    # Sauvegarder dans la BDD
    db.add(nouvelle_notification)
    # On ne fait PAS db.commit() ici !
    # C'est le module appelant qui fera le commit
    # (pour que tout soit dans la même transaction)
    
    return nouvelle_notification


# ============================================
# FONCTIONS UTILITAIRES POUR LES AUTRES MODULES
# ============================================
# Ces fonctions simplifient la création de notifications
# pour les cas les plus courants.

def notifier_nouveau_message(
    db: Session,
    id_destinataire: str,
    nom_expediteur: str,
    titre_bien: str = None
):
    """
    Créer une notification "Nouveau message reçu".
    
    Appelée par le module messagerie quand quelqu'un envoie un message.
    
    EXEMPLE :
      Jean envoie un message à Marie
      → Marie reçoit : "💬 Jean t'a envoyé un message"
    """
    contenu = f"{nom_expediteur} t'a envoyé un message"
    if titre_bien:
        contenu += f" à propos de {titre_bien}"
    
    return creer_notification(
        db=db,
        id_utilisateur=id_destinataire,
        type_notif="message",
        titre="Nouveau message",
        message=contenu
    )


def notifier_contrat(
    db: Session,
    id_destinataire: str,
    nom_expediteur: str,
    action: str,
    titre_bien: str = None,
    id_contrat: str = None
):
    """
    Créer une notification liée à un contrat.
    
    ACTIONS possibles :
    - "cree"    → "Marie t'a envoyé un contrat"
    - "accepte" → "Jean a accepté le contrat"
    - "refuse"  → "Jean a refusé le contrat"
    - "resilie" → "Jean a résilié le contrat"
    
    EXEMPLE :
      Marie crée un contrat pour Jean
      → Jean reçoit : "📄 Marie t'a envoyé un contrat pour Appartement Bonamoussadi"
    """
    
    # Construire le titre et le message selon l'action
    if action == "cree":
        titre = "Nouveau contrat"
        contenu = f"{nom_expediteur} t'a envoyé un contrat"
        if titre_bien:
            contenu += f" pour {titre_bien}"
        contenu += ". Accepte ou refuse."
    
    elif action == "accepte":
        titre = "Contrat accepté ✅"
        contenu = f"{nom_expediteur} a accepté le contrat"
        if titre_bien:
            contenu += f" pour {titre_bien}"
    
    elif action == "refuse":
        titre = "Contrat refusé ❌"
        contenu = f"{nom_expediteur} a refusé le contrat"
        if titre_bien:
            contenu += f" pour {titre_bien}"
    
    elif action == "resilie":
        titre = "Contrat résilié"
        contenu = f"{nom_expediteur} a résilié le contrat"
        if titre_bien:
            contenu += f" pour {titre_bien}"
    
    else:
        titre = "Mise à jour contrat"
        contenu = f"Le contrat a été mis à jour par {nom_expediteur}"
    
    return creer_notification(
        db=db,
        id_utilisateur=id_destinataire,
        type_notif="contrat",
        titre=titre,
        message=contenu,
        id_contrat=id_contrat
    )


def notifier_detection(
    db: Session,
    id_utilisateur: str,
    titre_bien: str,
    quartier: str,
    ville: str,
    montant: int
):
    """
    Créer une notification de détection GPS.
    
    Appelée par le module géolocalisation lors de la détection hebdomadaire.
    
    EXEMPLE :
      Jean est détecté près de l'Appartement Bonamoussadi
      → Jean reçoit : "📍 Bien détecté : Appartement Bonamoussadi. Frais : 5 000 FCFA"
    """
    return creer_notification(
        db=db,
        id_utilisateur=id_utilisateur,
        type_notif="detection",
        titre="Bien détecté",
        message=(
            f"Vous avez été détecté près du bien '{titre_bien}' "
            f"({quartier}, {ville}). "
            f"Frais de service : {montant:,} FCFA."
        )
    )


def notifier_paiement(
    db: Session,
    id_destinataire: str,
    montant: int,
    type_info: str,
    nom_autre_partie: str = None,
    id_transaction: str = None
):
    """
    Créer une notification liée à un paiement.
    
    TYPES D'INFO possibles :
    - "loyer_paye"      → "Ton paiement de 75 000 FCFA a été effectué"
    - "loyer_recu"      → "Tu as reçu 75 000 FCFA de loyer de Jean"
    - "attente_confirm"  → "Jean veut payer son loyer. Confirme ton numéro"
    - "numero_confirme"  → "Marie a confirmé son numéro. Tu peux payer"
    - "frais_service"   → "Tu as payé 5 000 FCFA de frais de service"
    - "penalite"        → "Pénalité de 10 000 FCFA appliquée"
    
    EXEMPLES :
      Jean paye son loyer
      → Jean reçoit : "💰 Ton paiement de 75 000 FCFA a été effectué"
      → Marie reçoit : "💰 Tu as reçu 75 000 FCFA de loyer de Jean"
    """
    
    if type_info == "loyer_paye":
        titre = "Loyer payé ✅"
        contenu = f"Ton paiement de {montant:,} FCFA a été effectué avec succès."
    
    elif type_info == "loyer_recu":
        titre = "Loyer reçu ✅"
        contenu = f"Tu as reçu {montant:,} FCFA de loyer"
        if nom_autre_partie:
            contenu += f" de {nom_autre_partie}"
    
    elif type_info == "attente_confirm":
        titre = "Confirmation requise ⏳"
        contenu = f"{nom_autre_partie} veut payer son loyer de {montant:,} FCFA. Confirme ton numéro mobile money."
    
    elif type_info == "numero_confirme":
        titre = "Numéro confirmé ✅"
        contenu = f"{nom_autre_partie} a confirmé son numéro. Tu peux maintenant payer {montant:,} FCFA."
    
    elif type_info == "frais_service":
        titre = "Frais de service payés ✅"
        contenu = f"Tu as payé {montant:,} FCFA de frais de service."
    
    elif type_info == "penalite":
        titre = "Pénalité appliquée ⚠️"
        contenu = f"Une pénalité de {montant:,} FCFA a été appliquée suite à une contestation non justifiée."
    
    else:
        titre = "Paiement"
        contenu = f"Transaction de {montant:,} FCFA traitée."
    
    return creer_notification(
        db=db,
        id_utilisateur=id_destinataire,
        type_notif="paiement",
        titre=titre,
        message=contenu,
        id_transaction=id_transaction
    )


# ============================================
# ROUTE 1 : VOIR TOUTES MES NOTIFICATIONS
# ============================================
# QUI L'APPELLE ? L'utilisateur qui ouvre la page "Notifications".
#
# CE QUI SE PASSE :
#   On retourne toutes ses notifications, les plus récentes d'abord.
#   Avec pagination : page 1, 2, 3... (20 notifs par page)
#
# EXEMPLE DE RÉPONSE :
#   {
#     "notifications": [
#       { "titre": "Nouveau message", "message": "Marie t'a...", "lu": false },
#       { "titre": "Loyer reçu", "message": "Tu as reçu 75 000...", "lu": true }
#     ],
#     "non_lues": 1,
#     "total": 2,
#     "page": 1
#   }

@routeur.get("")
def mes_notifications(
    page: int = Query(1, ge=1, description="Numéro de la page (commence à 1)"),
    limite: int = Query(20, ge=1, le=50, description="Nombre de notifications par page"),
    type_notif: str = Query(None, description="Filtrer par type : message, contrat, detection, paiement, systeme"),
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel),
    db: Session = Depends(get_db)
):
    """Voir toutes mes notifications avec pagination."""
    
    mon_id = utilisateur_actuel.id_utilisateur
    
    # --- Construire la requête ---
    # SQL : SELECT * FROM notification WHERE id_utilisateur = Jean
    requete = db.query(Notification).filter(
        Notification.id_utilisateur == mon_id
    )
    
    # Appliquer le filtre par type si demandé
    # Exemple : type_notif = "message" → seulement les notifs de messages
    if type_notif:
        requete = requete.filter(Notification.type_notification == type_notif)
    
    # Compter le total (avant pagination)
    total = requete.count()
    
    # Compter les non-lues
    non_lues = db.query(Notification).filter(
        Notification.id_utilisateur == mon_id,
        Notification.lu == False
    ).count()
    
    # Appliquer la pagination
    # Page 1 → on saute 0 résultats, on prend 20
    # Page 2 → on saute 20 résultats, on prend 20
    # Page 3 → on saute 40 résultats, on prend 20
    decalage = (page - 1) * limite
    
    notifications = requete.order_by(
        Notification.date_creation.desc()  # Les plus récentes d'abord
    ).offset(decalage).limit(limite).all()
    
    # Construire la liste de résultats
    resultats = []
    for notif in notifications:
        resultats.append({
            "id_notification": notif.id_notification,
            "type": notif.type_notification,
            "titre": notif.titre,
            "message": notif.message,
            "lu": notif.lu,
            "id_contrat": notif.id_contrat,
            "id_transaction": notif.id_transaction,
            "date_creation": str(notif.date_creation),
            "date_lecture": str(notif.date_lecture) if notif.date_lecture else None
        })
    
    return {
        "notifications": resultats,
        "non_lues": non_lues,
        "total": total,
        "page": page,
        "pages_total": (total + limite - 1) // limite  # Arrondi vers le haut
    }


# ============================================
# ROUTE 2 : COMPTER LES NON-LUES (pour le badge 🔴)
# ============================================
# QUI L'APPELLE ? Le frontend, régulièrement (toutes les 30 secondes par ex)
# pour afficher le badge rouge avec le nombre de notifications non lues.
#
# CE QUI SE PASSE :
#   → Le frontend demande : "Combien de notifs non lues ?"
#   → Le backend répond : 3
#   → Le frontend affiche : 🔴 3
#
# C'est une route LÉGÈRE (juste un COUNT) pour ne pas surcharger le serveur

@routeur.get("/non-lues")
def compter_non_lues(
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel),
    db: Session = Depends(get_db)
):
    """Compter le nombre de notifications non lues (pour le badge 🔴)."""
    
    mon_id = utilisateur_actuel.id_utilisateur
    
    # SQL : SELECT COUNT(*) FROM notification
    #        WHERE id_utilisateur = Jean AND lu = false
    total_non_lues = db.query(Notification).filter(
        Notification.id_utilisateur == mon_id,
        Notification.lu == False
    ).count()
    
    # Compter par type (pour afficher des badges par catégorie)
    # Exemple : 💬 2 messages, 📄 1 contrat
    messages_non_lus = db.query(Notification).filter(
        Notification.id_utilisateur == mon_id,
        Notification.lu == False,
        Notification.type_notification == "message"
    ).count()
    
    contrats_non_lus = db.query(Notification).filter(
        Notification.id_utilisateur == mon_id,
        Notification.lu == False,
        Notification.type_notification == "contrat"
    ).count()
    
    detections_non_lues = db.query(Notification).filter(
        Notification.id_utilisateur == mon_id,
        Notification.lu == False,
        Notification.type_notification == "detection"
    ).count()
    
    paiements_non_lus = db.query(Notification).filter(
        Notification.id_utilisateur == mon_id,
        Notification.lu == False,
        Notification.type_notification == "paiement"
    ).count()
    
    return {
        "total_non_lues": total_non_lues,
        "par_type": {
            "messages": messages_non_lus,
            "contrats": contrats_non_lus,
            "detections": detections_non_lues,
            "paiements": paiements_non_lus
        }
    }


# ============================================
# ROUTE 3 : MARQUER UNE NOTIFICATION COMME LUE
# ============================================
# QUI L'APPELLE ? L'utilisateur qui clique sur une notification.
#
# CE QUI SE PASSE :
#   1. Jean clique sur la notif "Nouveau message de Marie"
#   2. Le frontend appelle PUT /notifications/notif_abc123/lire
#   3. La notif passe de lu=false → lu=true
#   4. La date_lecture est enregistrée (ex: 2026-02-08 14:30)
#   5. Le badge 🔴 diminue de 1

@routeur.put("/{id_notification}/lire")
def marquer_comme_lue(
    id_notification: str,
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel),
    db: Session = Depends(get_db)
):
    """Marquer une notification comme lue."""
    
    # Chercher la notification
    # Sécurité : on vérifie que c'est bien la notif de cet utilisateur
    notif = db.query(Notification).filter(
        Notification.id_notification == id_notification,
        Notification.id_utilisateur == utilisateur_actuel.id_utilisateur
    ).first()
    
    if not notif:
        raise HTTPException(status_code=404, detail="Notification introuvable.")
    
    # Si déjà lue → rien à faire
    if notif.lu:
        return {
            "message": "Cette notification est déjà lue.",
            "id_notification": id_notification,
            "date_lecture": str(notif.date_lecture)
        }
    
    # Marquer comme lue + enregistrer la date de lecture
    notif.lu = True
    notif.date_lecture = datetime.now(timezone.utc)
    db.commit()
    
    return {
        "message": "Notification marquée comme lue.",
        "id_notification": id_notification,
        "date_lecture": str(notif.date_lecture)
    }


# ============================================
# ROUTE 4 : MARQUER TOUTES COMME LUES
# ============================================
# QUI L'APPELLE ? L'utilisateur qui clique sur "Tout marquer comme lu".
#
# CE QUI SE PASSE :
#   Toutes les notifications non lues passent à lu=true.
#   Le badge 🔴 passe à 0.

@routeur.put("/tout-lire")
def tout_marquer_comme_lu(
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel),
    db: Session = Depends(get_db)
):
    """Marquer TOUTES mes notifications comme lues."""
    
    mon_id = utilisateur_actuel.id_utilisateur
    maintenant = datetime.now(timezone.utc)
    
    # SQL : UPDATE notification
    #        SET lu = true, date_lecture = maintenant
    #        WHERE id_utilisateur = Jean AND lu = false
    nombre_mises_a_jour = db.query(Notification).filter(
        Notification.id_utilisateur == mon_id,
        Notification.lu == False
    ).update({
        Notification.lu: True,
        Notification.date_lecture: maintenant
    })
    
    db.commit()
    
    return {
        "message": f"{nombre_mises_a_jour} notification(s) marquée(s) comme lue(s).",
        "nombre_mises_a_jour": nombre_mises_a_jour
    }


# ============================================
# ROUTE 5 : SUPPRIMER UNE NOTIFICATION
# ============================================
# QUI L'APPELLE ? L'utilisateur qui swipe ou clique "Supprimer".
#
# CE QUI SE PASSE :
#   La notification est supprimée de la BDD.
#   C'est irréversible (on ne peut pas la récupérer).

@routeur.delete("/{id_notification}")
def supprimer_notification(
    id_notification: str,
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel),
    db: Session = Depends(get_db)
):
    """Supprimer une notification."""
    
    # Chercher la notification
    # Sécurité : on vérifie que c'est bien la notif de cet utilisateur
    notif = db.query(Notification).filter(
        Notification.id_notification == id_notification,
        Notification.id_utilisateur == utilisateur_actuel.id_utilisateur
    ).first()
    
    if not notif:
        raise HTTPException(status_code=404, detail="Notification introuvable.")
    
    # Supprimer la notification
    db.delete(notif)
    db.commit()
    
    return {
        "message": "Notification supprimée.",
        "id_notification": id_notification
    }
