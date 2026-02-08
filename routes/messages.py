"""
routes/messages.py — Messagerie entre utilisateurs

Routes REST :
- POST   /messages/envoyer                         → Envoyer un message (via une annonce)
- GET    /messages/conversations                    → Liste de mes conversations
- GET    /messages/conversation/{id_user}/{id_bien} → Historique avec un utilisateur pour un bien
- PUT    /messages/lire/{id_user}/{id_bien}         → Marquer comme lus
- GET    /messages/non-lus                          → Compter mes messages non-lus

WebSocket :
- WS     /messages/ws/{token}                       → Connexion temps réel pour recevoir les messages instantanément

Règles :
- Une conversation démarre UNIQUEMENT via une annonce (id_bien obligatoire)
- On ne peut pas s'envoyer un message à soi-même
- Seuls les utilisateurs connectés peuvent envoyer/recevoir des messages
"""

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func, case
from datetime import datetime, timezone
import uuid
import json

from database import get_db, SessionLocal
from models import Utilisateur, Bien, Message
from auth import obtenir_utilisateur_actuel, verifier_jeton
from routes.notifications import notifier_nouveau_message

# Créer le routeur
routeur = APIRouter(prefix="/messages", tags=["Messagerie"])


# ============================================
# GESTIONNAIRE DE CONNEXIONS WEBSOCKET
# ============================================

class GestionnaireConnexions:
    """
    Gère les connexions WebSocket actives.
    
    Quand un utilisateur se connecte en WebSocket, on garde sa connexion en mémoire.
    Quand quelqu'un lui envoie un message, on lui envoie en temps réel.
    """
    
    def __init__(self):
        # Dictionnaire : {id_utilisateur: connexion_websocket}
        self.connexions_actives: dict[str, WebSocket] = {}
    
    async def connecter(self, id_utilisateur: str, websocket: WebSocket):
        """Accepter et enregistrer une nouvelle connexion."""
        await websocket.accept()
        self.connexions_actives[id_utilisateur] = websocket
    
    def deconnecter(self, id_utilisateur: str):
        """Supprimer une connexion quand l'utilisateur se déconnecte."""
        if id_utilisateur in self.connexions_actives:
            del self.connexions_actives[id_utilisateur]
    
    async def envoyer_message_personnel(self, id_destinataire: str, donnees: dict):
        """
        Envoyer un message en temps réel à un utilisateur connecté.
        Si l'utilisateur n'est pas connecté en WebSocket, le message
        sera récupéré via REST quand il se connectera.
        """
        if id_destinataire in self.connexions_actives:
            try:
                websocket = self.connexions_actives[id_destinataire]
                await websocket.send_json(donnees)
            except Exception:
                # Si l'envoi échoue, retirer la connexion morte
                self.deconnecter(id_destinataire)
    
    def est_connecte(self, id_utilisateur: str) -> bool:
        """Vérifie si un utilisateur est connecté en WebSocket."""
        return id_utilisateur in self.connexions_actives


# Instance globale du gestionnaire
gestionnaire = GestionnaireConnexions()


# ============================================
# ROUTE 1 : ENVOYER UN MESSAGE
# ============================================

@routeur.post("/envoyer", status_code=status.HTTP_201_CREATED)
async def envoyer_message(
    id_destinataire: str = Query(..., description="ID de l'utilisateur à qui envoyer"),
    id_bien: str = Query(..., description="ID du bien concerné par la conversation"),
    contenu: str = Query(..., min_length=1, max_length=2000, description="Contenu du message"),
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel),
    db: Session = Depends(get_db)
):
    """
    Envoyer un message à un utilisateur à propos d'un bien.
    
    La conversation est identifiée par le trio :
    (expéditeur, destinataire, bien)
    """
    
    # --- Vérifier qu'on ne s'envoie pas un message à soi-même ---
    if id_destinataire == utilisateur_actuel.id_utilisateur:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tu ne peux pas t'envoyer un message à toi-même."
        )
    
    # --- Vérifier que le destinataire existe ---
    destinataire = db.query(Utilisateur).filter(
        Utilisateur.id_utilisateur == id_destinataire
    ).first()
    
    if not destinataire:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Destinataire introuvable."
        )
    
    # --- Vérifier que le bien existe ---
    bien = db.query(Bien).filter(Bien.id_bien == id_bien).first()
    
    if not bien:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bien introuvable."
        )
    
    # --- Créer le message ---
    nouveau_message = Message(
        id_message=f"msg_{uuid.uuid4().hex[:12]}",
        expediteur_id=utilisateur_actuel.id_utilisateur,
        destinataire_id=id_destinataire,
        id_bien=id_bien,
        contenu=contenu,
        lu=False
    )
    
    db.add(nouveau_message)
    db.commit()
    notifier_nouveau_message(
        db=db,
        id_destinataire=id_destinataire,   # Marie
        nom_expediteur=f"{utilisateur_actuel.prenom} {utilisateur_actuel.nom}",
        titre_bien=bien.titre if bien else None
    )
    db.commit()
    db.refresh(nouveau_message)
    
    # --- Envoyer en temps réel via WebSocket ---
    donnees_temps_reel = {
        "type": "nouveau_message",
        "id_message": nouveau_message.id_message,
        "id_expediteur": utilisateur_actuel.id_utilisateur,
        "nom_expediteur": f"{utilisateur_actuel.prenom} {utilisateur_actuel.nom}",
        "id_bien": id_bien,
        "titre_bien": bien.titre,
        "contenu": contenu,
        "date_envoi": str(nouveau_message.date_envoi)
    }
    
    await gestionnaire.envoyer_message_personnel(id_destinataire, donnees_temps_reel)
    
    return {
        "message": "Message envoyé !",
        "id_message": nouveau_message.id_message,
        "destinataire": f"{destinataire.prenom} {destinataire.nom}",
        "bien": bien.titre,
        "contenu": contenu,
        "date_envoi": str(nouveau_message.date_envoi),
        "destinataire_en_ligne": gestionnaire.est_connecte(id_destinataire)
    }


# ============================================
# ROUTE 2 : LISTE DE MES CONVERSATIONS
# ============================================

@routeur.get("/conversations")
def mes_conversations(
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel),
    db: Session = Depends(get_db)
):
    """
    Liste toutes mes conversations groupées par (interlocuteur, bien).
    
    Pour chaque conversation, on retourne :
    - L'interlocuteur (nom, prénom)
    - Le bien concerné (titre)
    - Le dernier message
    - Le nombre de messages non-lus
    """
    
    mon_id = utilisateur_actuel.id_utilisateur
    
    # Récupérer tous mes messages (envoyés et reçus)
    tous_messages = db.query(Message).filter(
        or_(
            Message.expediteur_id == mon_id,
            Message.destinataire_id == mon_id
        )
    ).order_by(Message.date_envoi.desc()).all()
    
    # Regrouper par (interlocuteur, bien)
    conversations = {}
    
    for msg in tous_messages:
        # Identifier l'interlocuteur
        if msg.expediteur_id == mon_id:
            id_interlocuteur = msg.destinataire_id
        else:
            id_interlocuteur = msg.expediteur_id
        
        # Clé unique de conversation : interlocuteur + bien
        cle = f"{id_interlocuteur}_{msg.id_bien}"
        
        if cle not in conversations:
            # Récupérer les infos de l'interlocuteur
            interlocuteur = db.query(Utilisateur).filter(
                Utilisateur.id_utilisateur == id_interlocuteur
            ).first()
            
            # Récupérer les infos du bien
            bien = db.query(Bien).filter(
                Bien.id_bien == msg.id_bien
            ).first()
            
            # Compter les messages non-lus dans cette conversation
            non_lus = db.query(Message).filter(
                Message.expediteur_id == id_interlocuteur,
                Message.destinataire_id == mon_id,
                Message.id_bien == msg.id_bien,
                Message.lu == False
            ).count()
            
            conversations[cle] = {
                "id_interlocuteur": id_interlocuteur,
                "nom_interlocuteur": interlocuteur.nom if interlocuteur else "Inconnu",
                "prenom_interlocuteur": interlocuteur.prenom if interlocuteur else "",
                "photo_interlocuteur": interlocuteur.photo_profil_url if interlocuteur else None,
                "id_bien": msg.id_bien,
                "titre_bien": bien.titre if bien else "Bien supprimé",
                "dernier_message": msg.contenu,
                "date_dernier_message": str(msg.date_envoi),
                "envoye_par_moi": msg.expediteur_id == mon_id,
                "non_lus": non_lus,
                "en_ligne": gestionnaire.est_connecte(id_interlocuteur)
            }
    
    # Trier par date du dernier message (les plus récents en premier)
    liste_conversations = sorted(
        conversations.values(),
        key=lambda c: c["date_dernier_message"],
        reverse=True
    )
    
    # Compter le total de non-lus
    total_non_lus = sum(c["non_lus"] for c in liste_conversations)
    
    return {
        "conversations": liste_conversations,
        "nombre_conversations": len(liste_conversations),
        "total_non_lus": total_non_lus
    }


# ============================================
# ROUTE 3 : HISTORIQUE D'UNE CONVERSATION
# ============================================

@routeur.get("/conversation/{id_interlocuteur}/{id_bien}")
def historique_conversation(
    id_interlocuteur: str,
    id_bien: str,
    page: int = Query(1, ge=1),
    par_page: int = Query(50, ge=1, le=100),
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel),
    db: Session = Depends(get_db)
):
    """
    Historique des messages avec un utilisateur pour un bien précis.
    Paginé : 50 messages par page par défaut.
    Les messages sont triés du plus ancien au plus récent.
    """
    
    mon_id = utilisateur_actuel.id_utilisateur
    
    # Vérifier que l'interlocuteur existe
    interlocuteur = db.query(Utilisateur).filter(
        Utilisateur.id_utilisateur == id_interlocuteur
    ).first()
    
    if not interlocuteur:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur introuvable."
        )
    
    # Récupérer tous les messages de cette conversation
    requete = db.query(Message).filter(
        Message.id_bien == id_bien,
        or_(
            and_(Message.expediteur_id == mon_id, Message.destinataire_id == id_interlocuteur),
            and_(Message.expediteur_id == id_interlocuteur, Message.destinataire_id == mon_id)
        )
    )
    
    # Total
    total = requete.count()
    
    # Pagination (messages les plus anciens en premier pour lire dans l'ordre)
    decalage = (page - 1) * par_page
    messages = requete.order_by(Message.date_envoi.asc()).offset(decalage).limit(par_page).all()
    
    # Formater les messages
    liste_messages = []
    for msg in messages:
        liste_messages.append({
            "id_message": msg.id_message,
            "contenu": msg.contenu,
            "envoye_par_moi": msg.expediteur_id == mon_id,
            "date_envoi": str(msg.date_envoi),
            "lu": bool(msg.lu)
        })
    
    pages_total = (total + par_page - 1) // par_page
    
    return {
        "interlocuteur": {
            "id": interlocuteur.id_utilisateur,
            "nom": interlocuteur.nom,
            "prenom": interlocuteur.prenom,
            "photo": interlocuteur.photo_profil_url,
            "en_ligne": gestionnaire.est_connecte(id_interlocuteur)
        },
        "id_bien": id_bien,
        "messages": liste_messages,
        "total": total,
        "page": page,
        "par_page": par_page,
        "pages_total": pages_total
    }


# ============================================
# ROUTE 4 : MARQUER LES MESSAGES COMME LUS
# ============================================

@routeur.put("/lire/{id_interlocuteur}/{id_bien}")
def marquer_comme_lu(
    id_interlocuteur: str,
    id_bien: str,
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel),
    db: Session = Depends(get_db)
):
    """
    Marquer tous les messages d'une conversation comme lus.
    Ne marque que les messages REÇUS (pas ceux qu'on a envoyés).
    """
    
    mon_id = utilisateur_actuel.id_utilisateur
    
    # Mettre à jour les messages reçus non-lus
    nombre_mis_a_jour = db.query(Message).filter(
        Message.expediteur_id == id_interlocuteur,
        Message.destinataire_id == mon_id,
        Message.id_bien == id_bien,
        Message.lu == False
    ).update({"lu": True})
    
    db.commit()
    
    return {
        "message": f"{nombre_mis_a_jour} message(s) marqué(s) comme lu(s).",
        "messages_lus": nombre_mis_a_jour
    }


# ============================================
# ROUTE 5 : COMPTER LES MESSAGES NON-LUS
# ============================================

@routeur.get("/non-lus")
def compter_non_lus(
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel),
    db: Session = Depends(get_db)
):
    """
    Compter le nombre total de messages non-lus.
    Utile pour afficher le badge 🔴 sur l'icône de messagerie.
    """
    
    total_non_lus = db.query(Message).filter(
        Message.destinataire_id == utilisateur_actuel.id_utilisateur,
        Message.lu == False
    ).count()
    
    return {
        "non_lus": total_non_lus
    }


# ============================================
# WEBSOCKET : CONNEXION TEMPS RÉEL
# ============================================

@routeur.websocket("/ws/{token}")
async def websocket_messagerie(
    websocket: WebSocket,
    token: str
):
    """
    Connexion WebSocket pour recevoir les messages en temps réel.
    
    Le frontend se connecte avec le token JWT dans l'URL :
    ws://localhost:8000/messages/ws/MON_TOKEN_JWT
    
    Quand quelqu'un envoie un message, le destinataire le reçoit
    instantanément via cette connexion WebSocket.
    
    Le frontend peut aussi envoyer des messages via WebSocket :
    {
        "action": "envoyer",
        "id_destinataire": "user_xxx",
        "id_bien": "bien_xxx",
        "contenu": "Bonjour !"
    }
    """
    
    # --- Vérifier le token JWT ---
    try:
        donnees = verifier_jeton(token)
        id_utilisateur = donnees.get("sub")
        if not id_utilisateur:
            await websocket.close(code=4001, reason="Token invalide.")
            return
    except Exception:
        await websocket.close(code=4001, reason="Token invalide ou expiré.")
        return
    
    # --- Connecter l'utilisateur ---
    await gestionnaire.connecter(id_utilisateur, websocket)
    
    try:
        while True:
            # Attendre les messages du client
            donnees_brutes = await websocket.receive_text()
            
            try:
                donnees = json.loads(donnees_brutes)
                action = donnees.get("action")
                
                if action == "envoyer":
                    # Envoyer un message via WebSocket
                    id_destinataire = donnees.get("id_destinataire")
                    id_bien = donnees.get("id_bien")
                    contenu = donnees.get("contenu", "").strip()
                    
                    if not id_destinataire or not id_bien or not contenu:
                        await websocket.send_json({
                            "type": "erreur",
                            "detail": "Champs requis : id_destinataire, id_bien, contenu"
                        })
                        continue
                    
                    if len(contenu) > 2000:
                        await websocket.send_json({
                            "type": "erreur",
                            "detail": "Message trop long (max 2000 caractères)."
                        })
                        continue
                    
                    if id_destinataire == id_utilisateur:
                        await websocket.send_json({
                            "type": "erreur",
                            "detail": "Tu ne peux pas t'envoyer un message à toi-même."
                        })
                        continue
                    
                    # Sauvegarder en BDD
                    db = SessionLocal()
                    try:
                        # Vérifier destinataire et bien
                        destinataire = db.query(Utilisateur).filter(
                            Utilisateur.id_utilisateur == id_destinataire
                        ).first()
                        
                        bien = db.query(Bien).filter(
                            Bien.id_bien == id_bien
                        ).first()
                        
                        if not destinataire:
                            await websocket.send_json({
                                "type": "erreur",
                                "detail": "Destinataire introuvable."
                            })
                            continue
                        
                        if not bien:
                            await websocket.send_json({
                                "type": "erreur",
                                "detail": "Bien introuvable."
                            })
                            continue
                        
                        # Récupérer le nom de l'expéditeur
                        expediteur = db.query(Utilisateur).filter(
                            Utilisateur.id_utilisateur == id_utilisateur
                        ).first()
                        
                        # Créer le message
                        nouveau_msg = Message(
                            id_message=f"msg_{uuid.uuid4().hex[:12]}",
                            expediteur_id=id_utilisateur,
                            destinataire_id=id_destinataire,
                            id_bien=id_bien,
                            contenu=contenu,
                            lu=False
                        )
                        
                        db.add(nouveau_msg)
                        db.commit()
                        db.refresh(nouveau_msg)
                        
                        # Préparer les données à envoyer
                        donnees_message = {
                            "type": "nouveau_message",
                            "id_message": nouveau_msg.id_message,
                            "id_expediteur": id_utilisateur,
                            "nom_expediteur": f"{expediteur.prenom} {expediteur.nom}" if expediteur else "Inconnu",
                            "id_bien": id_bien,
                            "titre_bien": bien.titre,
                            "contenu": contenu,
                            "date_envoi": str(nouveau_msg.date_envoi)
                        }
                        
                        # Envoyer au destinataire (temps réel)
                        await gestionnaire.envoyer_message_personnel(id_destinataire, donnees_message)
                        
                        # Confirmer à l'expéditeur
                        await websocket.send_json({
                            "type": "confirmation",
                            "id_message": nouveau_msg.id_message,
                            "contenu": contenu,
                            "date_envoi": str(nouveau_msg.date_envoi),
                            "destinataire_en_ligne": gestionnaire.est_connecte(id_destinataire)
                        })
                    
                    finally:
                        db.close()
                
                elif action == "ping":
                    # Garder la connexion vivante
                    await websocket.send_json({"type": "pong"})
                
                else:
                    await websocket.send_json({
                        "type": "erreur",
                        "detail": f"Action inconnue : {action}. Actions possibles : envoyer, ping"
                    })
            
            except json.JSONDecodeError:
                await websocket.send_json({
                    "type": "erreur",
                    "detail": "Format invalide. Envoie du JSON."
                })
    
    except WebSocketDisconnect:
        # L'utilisateur s'est déconnecté
        gestionnaire.deconnecter(id_utilisateur)
    except Exception:
        gestionnaire.deconnecter(id_utilisateur)
