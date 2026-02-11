"""
routes/utilisateurs.py — Les portes de l'hôtel

Routes disponibles :
- POST /utilisateurs/inscription  → Créer un compte
- POST /utilisateurs/connexion    → Se connecter
- GET  /utilisateurs/moi          → Voir mon profil (protégé)
- PUT  /utilisateurs/moi          → Modifier mon profil (protégé)
- GET  /utilisateurs/{id}         → Voir le profil public de quelqu'un
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import uuid
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
import random
import string

from database import get_db
from models import Utilisateur
from auth import hasher_mot_de_passe, verifier_mot_de_passe, creer_jeton_acces, obtenir_utilisateur_actuel
from schemas import (
    FormulaireInscription,
    FormulaireConnexion,
    ReponseJeton,
    ReponseUtilisateur,
    FormulaireModificationProfil,
    ReponseMessage
)

# Configuration email
EMAIL_CONFIG = {
    "SMTP_SERVER": os.getenv("SMTP_SERVER", "smtp.gmail.com"),
    "SMTP_PORT": int(os.getenv("SMTP_PORT", "587")),
    "EMAIL_USER": os.getenv("EMAIL_USER", ""),
    "EMAIL_PASSWORD": os.getenv("EMAIL_PASSWORD", ""),
    "FROM_EMAIL": os.getenv("FROM_EMAIL", "noreply@appimobilier.com")
}

# Base de données simulée pour les tokens de réinitialisation
reset_tokens_db = {}

def generate_reset_token():
    """Générer un token de réinitialisation sécurisé"""
    return ''.join(random.choices(string.ascii_letters + string.digits, k=32))

def send_reset_email(email: str, reset_token: str):
    """Envoyer un email de réinitialisation de mot de passe"""
    try:
        # Mode test : si pas de configuration email, simuler l'envoi
        if not EMAIL_CONFIG["EMAIL_USER"] or not EMAIL_CONFIG["EMAIL_PASSWORD"]:
            print(f"📧 MODE TEST - Email envoyé à {email}")
            print(f"🔗 Token de réinitialisation: {reset_token}")
            print(f"🔗 Lien de réinitialisation: https://votre-app.com/reset-password?token={reset_token}")
            return True
        
        # Créer le message email
        msg = MIMEMultipart()
        msg['From'] = EMAIL_CONFIG["FROM_EMAIL"]
        msg['To'] = email
        msg['Subject'] = "Réinitialisation de votre mot de passe - App Immobilier"
        
        # Corps de l'email
        reset_link = f"https://votre-app.com/reset-password?token={reset_token}"
        body = f"""
        Bonjour,
        
        Vous avez demandé la réinitialisation de votre mot de passe pour l'application App Immobilier.
        
        Cliquez sur le lien suivant pour réinitialiser votre mot de passe :
        {reset_link}
        
        Ce lien expirera dans 1 heure.
        
        Si vous n'avez pas demandé cette réinitialisation, veuillez ignorer cet email.
        
        Cordialement,
        L'équipe App Immobilier
        """
        
        msg.attach(MIMEText(body, 'plain'))
        
        # Envoyer l'email
        server = smtplib.SMTP(EMAIL_CONFIG["SMTP_SERVER"], EMAIL_CONFIG["SMTP_PORT"])
        server.starttls()
        server.login(EMAIL_CONFIG["EMAIL_USER"], EMAIL_CONFIG["EMAIL_PASSWORD"])
        server.send_message(msg)
        server.quit()
        
        return True
    except Exception as e:
        print(f"Erreur envoi email: {e}")
        # En mode test, retourner True même si l'email échoue
        if not EMAIL_CONFIG["EMAIL_USER"] or not EMAIL_CONFIG["EMAIL_PASSWORD"]:
            print(f"📧 MODE TEST - Simulation réussie pour {email}")
            return True
        return False

# Créer le routeur — toutes les routes commencent par /utilisateurs
routeur = APIRouter(prefix="/utilisateurs", tags=["Utilisateurs"])


# ============================================
# INSCRIPTION
# ============================================
@routeur.post("/inscription", response_model=ReponseMessage)
def inscription(donnees: FormulaireInscription, db: Session = Depends(get_db)):
    """
    Créer un nouveau compte utilisateur.
    """

    # Vérifier si l'email existe déjà
    email_existe = db.query(Utilisateur).filter(
        Utilisateur.email == donnees.email
    ).first()

    if email_existe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cet email est déjà utilisé."
        )

    # Vérifier si le téléphone existe déjà
    telephone_existe = db.query(Utilisateur).filter(
        Utilisateur.telephone == donnees.telephone
    ).first()

    if telephone_existe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ce numéro de téléphone est déjà utilisé."
        )

    # Valider le format du téléphone camerounais (237XXXXXXXXX)
    if not donnees.telephone.startswith("237") or len(donnees.telephone) != 12:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le téléphone doit être au format 237XXXXXXXXX (12 chiffres)."
        )

    # Vérifier la longueur du mot de passe
    if len(donnees.mot_de_passe) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le mot de passe doit contenir au moins 6 caractères."
        )

    # Créer l'utilisateur
    nouvel_utilisateur = Utilisateur(
        id_utilisateur=f"user_{uuid.uuid4().hex[:8]}",
        email=donnees.email,
        mot_de_passe=hasher_mot_de_passe(donnees.mot_de_passe),
        telephone=donnees.telephone,
        nom=donnees.nom,
        prenom=donnees.prenom,
        photo_profil_url=donnees.photo_profil_url,
        consent_geolocalisation=donnees.consent_geolocalisation or "non"
    )

    # Sauvegarder dans la BDD
    db.add(nouvel_utilisateur)
    db.commit()
    db.refresh(nouvel_utilisateur)

    return ReponseMessage(
        message="Inscription réussie ! Bienvenue sur l'application.",
        id_utilisateur=nouvel_utilisateur.id_utilisateur
    )


# ============================================
# CONNEXION
# ============================================
@routeur.post("/connexion", response_model=ReponseJeton)
def connexion(donnees: FormulaireConnexion, db: Session = Depends(get_db)):
    """
    Se connecter et recevoir un token JWT.
    """

    # Chercher l'utilisateur par email
    utilisateur = db.query(Utilisateur).filter(
        Utilisateur.email == donnees.email
    ).first()

    # Si l'email n'existe pas OU le mot de passe est faux
    if not utilisateur or not verifier_mot_de_passe(donnees.mot_de_passe, utilisateur.mot_de_passe):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect."
        )

    # Mettre à jour la dernière connexion
    utilisateur.derniere_connexion = datetime.utcnow()
    db.commit()

    # Créer le token JWT (le bracelet)
    jeton = creer_jeton_acces(donnees={"sub": utilisateur.id_utilisateur})

    return ReponseJeton(
        jeton_acces=jeton,
        type_jeton="bearer",
        utilisateur=utilisateur
    )


# ============================================
# VOIR MON PROFIL (protégé)
# ============================================
@routeur.get("/moi", response_model=ReponseUtilisateur)
def voir_mon_profil(
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel)
):
    """
    Voir les infos de l'utilisateur connecté.
    Nécessite un token JWT valide.
    """
    return utilisateur_actuel


# ============================================
# MODIFIER MON PROFIL (protégé)
# ============================================
@routeur.put("/moi", response_model=ReponseUtilisateur)
def modifier_mon_profil(
    donnees: FormulaireModificationProfil,
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel),
    db: Session = Depends(get_db)
):
    """
    Modifier les infos de l'utilisateur connecté.
    Seuls les champs envoyés sont modifiés.
    """

    # Si le téléphone change, vérifier qu'il n'est pas déjà pris
    if donnees.telephone and donnees.telephone != utilisateur_actuel.telephone:
        telephone_existe = db.query(Utilisateur).filter(
            Utilisateur.telephone == donnees.telephone
        ).first()

        if telephone_existe:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ce numéro de téléphone est déjà utilisé."
            )

        # Valider le format camerounais
        if not donnees.telephone.startswith("237") or len(donnees.telephone) != 12:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Le téléphone doit être au format 237XXXXXXXXX."
            )

    # Mettre à jour seulement les champs envoyés (non vides)
    if donnees.nom:
        utilisateur_actuel.nom = donnees.nom
    if donnees.prenom:
        utilisateur_actuel.prenom = donnees.prenom
    if donnees.telephone:
        utilisateur_actuel.telephone = donnees.telephone
    if donnees.photo_profil_url:
        utilisateur_actuel.photo_profil_url = donnees.photo_profil_url
    if donnees.consent_geolocalisation:
        utilisateur_actuel.consent_geolocalisation = donnees.consent_geolocalisation

    db.commit()
    db.refresh(utilisateur_actuel)

    return utilisateur_actuel


# ============================================
# MOT DE PASSE OUBLIÉ
# ============================================
@routeur.post("/mot-de-passe-oublie", response_model=ReponseMessage)
def mot_de_passe_oublie(donnees: dict, db: Session = Depends(get_db)):
    """
    Demander la réinitialisation du mot de passe par email.
    """
    email = donnees.get("email")
    
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="L'email est requis."
        )
    
    # Vérifier si l'utilisateur existe
    utilisateur = db.query(Utilisateur).filter(
        Utilisateur.email == email
    ).first()
    
    if not utilisateur:
        # Pour des raisons de sécurité, ne pas révéler si l'email existe ou non
        return {"message": "Si cet email existe, un lien de réinitialisation a été envoyé"}
    
    # Générer et stocker le token
    reset_token = generate_reset_token()
    reset_tokens_db[reset_token] = {
        "email": email,
        "expires_at": datetime.now() + timedelta(hours=1)
    }
    
    # Envoyer l'email
    email_sent = send_reset_email(email, reset_token)
    
    if email_sent:
        return {"message": "Un email de réinitialisation a été envoyé à votre adresse email"}
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur lors de l'envoi de l'email. Veuillez réessayer plus tard."
        )


# ============================================
# RÉINITIALISER MOT DE PASSE (avec token)
# ============================================
@routeur.post("/reinitialiser-mot-de-passe", response_model=ReponseMessage)
def reinitialiser_mot_de_passe(donnees: dict, db: Session = Depends(get_db)):
    """
    Réinitialiser le mot de passe avec un token.
    """
    token = donnees.get("token")
    nouveau_mot_de_passe = donnees.get("nouveau_mot_de_passe")
    
    if not token or not nouveau_mot_de_passe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le token et le nouveau mot de passe sont requis."
        )
    
    # Vérifier le token
    if token not in reset_tokens_db:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token invalide ou expiré."
        )
    
    token_data = reset_tokens_db[token]
    
    # Vérifier l'expiration
    if datetime.now() > token_data["expires_at"]:
        del reset_tokens_db[token]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token expiré."
        )
    
    # Trouver l'utilisateur
    utilisateur = db.query(Utilisateur).filter(
        Utilisateur.email == token_data["email"]
    ).first()
    
    if not utilisateur:
        del reset_tokens_db[token]
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur non trouvé."
        )
    
    # Mettre à jour le mot de passe
    utilisateur.mot_de_passe = hasher_mot_de_passe(nouveau_mot_de_passe)
    db.commit()
    
    # Supprimer le token utilisé
    del reset_tokens_db[token]
    
    return {"message": "Mot de passe réinitialisé avec succès"}


# ============================================
# VOIR LE PROFIL PUBLIC DE QUELQU'UN
# ============================================
@routeur.get("/{id_utilisateur}", response_model=ReponseUtilisateur)
def voir_profil_public(id_utilisateur: str, db: Session = Depends(get_db)):
    """
    Voir le profil public d'un utilisateur (pas besoin d'être connecté).
    """

    utilisateur = db.query(Utilisateur).filter(
        Utilisateur.id_utilisateur == id_utilisateur
    ).first()

    if not utilisateur:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur non trouvé."
        )

    return utilisateur
