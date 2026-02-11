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

def generate_reset_code():
    """Générer un code de réinitialisation de 4 chiffres"""
    return ''.join(random.choices(string.digits, k=4))

def send_reset_email(email: str, reset_code: str):
    """Envoyer un email avec un code de réinitialisation de 4 chiffres"""
    try:
        # Logs de diagnostic
        print(f"🔧 CONFIGURATION SMTP:")
        print(f"   - SERVER: {EMAIL_CONFIG['SMTP_SERVER']}")
        print(f"   - PORT: {EMAIL_CONFIG['SMTP_PORT']}")
        print(f"   - USER: {EMAIL_CONFIG['EMAIL_USER']}")
        print(f"   - PASSWORD: {'***' if EMAIL_CONFIG['EMAIL_PASSWORD'] else 'EMPTY'}")
        
        # Mode test : si pas de configuration email, simuler l'envoi
        if not EMAIL_CONFIG["EMAIL_USER"] or not EMAIL_CONFIG["EMAIL_PASSWORD"]:
            print(f"📧 MODE TEST - Email envoyé à {email}")
            print(f"� CODE DE RÉINITIALISATION: {reset_code}")
            return True
        
        # Créer le message email
        msg = MIMEMultipart()
        msg['From'] = EMAIL_CONFIG["FROM_EMAIL"]
        msg['To'] = email
        msg['Subject'] = "Code de réinitialisation - App Immobilier"
        
        # Corps de l'email avec code de 4 chiffres
        body = f"""
        Bonjour,
        
        Vous avez demandé la réinitialisation de votre mot de passe pour l'application App Immobilier.
        
        Voici votre code de réinitialisation :
        
        🔑 {reset_code} 🔑
        
        Ce code expirera dans 15 minutes.
        
        Entrez ce code dans l'application pour définir votre nouveau mot de passe.
        
        Si vous n'avez pas demandé cette réinitialisation, veuillez ignorer cet email.
        
        Cordialement,
        L'équipe App Immobilier
        """
        
        # Log pour test
        print(f"� CODE DE RÉINITIALISATION: {reset_code}")
        print(f"� Email envoyé à: {email}")
        
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
    
    # Gérer le changement de mot de passe
    if 'mot_de_passe_actuel' in donnees and 'mot_de_passe' in donnees:
        if donnees['mot_de_passe_actuel'] and donnees['mot_de_passe']:
            print(f"🔐 Tentative changement mot de passe pour {utilisateur_actuel.email}")
            print(f"🔐 Mot de passe actuel reçu: {donnees['mot_de_passe_actuel'][:3]}***")
            print(f"🔐 Nouveau mot de passe reçu: {donnees['mot_de_passe'][:3]}***")
            
            # Vérifier que le mot de passe actuel est correct
            print(f"🔍 Vérification mot de passe pour {utilisateur_actuel.email}")
            print(f"🔍 Hash en base: {utilisateur_actuel.mot_de_passe[:20]}...")
            
            mot_de_passe_valide = verifier_mot_de_passe(donnees['mot_de_passe_actuel'], utilisateur_actuel.mot_de_passe)
            print(f"🔍 Résultat vérification: {mot_de_passe_valide}")
            
            if not mot_de_passe_valide:
                print(f"❌ Mot de passe actuel incorrect pour {utilisateur_actuel.email}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Le mot de passe actuel est incorrect."
                )
            
            # Mettre à jour le mot de passe
            utilisateur_actuel.mot_de_passe = hacher_mot_de_passe(donnees['mot_de_passe'])
            print(f"✅ Mot de passe mis à jour avec succès pour l'utilisateur {utilisateur_actuel.email}")

    db.commit()
    db.refresh(utilisateur_actuel)

    return utilisateur_actuel


# ============================================
# CHANGER MOT DE PASSE (protégé)
# ============================================
@routeur.put("/changer-mot-de-passe", response_model=ReponseMessage)
def changer_mot_de_passe(
    donnees: dict,
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel),
    db: Session = Depends(get_db)
):
    """
    Changer le mot de passe de l'utilisateur connecté.
    """
    mot_de_passe_actuel = donnees.get("mot_de_passe_actuel")
    nouveau_mot_de_passe = donnees.get("mot_de_passe")
    
    if not mot_de_passe_actuel or not nouveau_mot_de_passe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le mot de passe actuel et le nouveau mot de passe sont requis."
        )
    
    print(f"🔐 Tentative changement mot de passe pour {utilisateur_actuel.email}")
    print(f"🔐 Mot de passe actuel reçu: {mot_de_passe_actuel[:3]}***")
    print(f"🔐 Nouveau mot de passe reçu: {nouveau_mot_de_passe[:3]}***")
    
    # Vérifier que le mot de passe actuel est correct
    print(f"🔍 Vérification mot de passe pour {utilisateur_actuel.email}")
    print(f"🔍 Hash en base: {utilisateur_actuel.mot_de_passe[:20]}...")
    
    mot_de_passe_valide = verifier_mot_de_passe(mot_de_passe_actuel, utilisateur_actuel.mot_de_passe)
    print(f"🔍 Résultat vérification: {mot_de_passe_valide}")
    
    if not mot_de_passe_valide:
        print(f"❌ Mot de passe actuel incorrect pour {utilisateur_actuel.email}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le mot de passe actuel est incorrect."
        )
    
    # Mettre à jour le mot de passe
    utilisateur_actuel.mot_de_passe = hacher_mot_de_passe(nouveau_mot_de_passe)
    db.commit()
    
    print(f"✅ Mot de passe mis à jour avec succès pour l'utilisateur {utilisateur_actuel.email}")
    
    return {"message": "Mot de passe changé avec succès"}


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
    
    # Générer et stocker le code de 4 chiffres
    reset_code = generate_reset_code()
    reset_tokens_db[reset_code] = {
        "email": email,
        "expires_at": datetime.now() + timedelta(minutes=15)
    }
    
    # Envoyer l'email
    email_sent = send_reset_email(email, reset_code)
    
    if email_sent:
        return {"message": "Un email de réinitialisation a été envoyé à votre adresse email"}
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur lors de l'envoi de l'email. Veuillez réessayer plus tard."
        )


# ============================================
# VÉRIFIER CODE ET RÉINITIALISER MOT DE PASSE
# ============================================
@routeur.post("/verifier-code-et-reinitialiser", response_model=ReponseMessage)
def verifier_code_et_reinitialiser(donnees: dict, db: Session = Depends(get_db)):
    """
    Vérifier le code de 4 chiffres et réinitialiser le mot de passe.
    """
    email = donnees.get("email")
    code = donnees.get("code")
    nouveau_mot_de_passe = donnees.get("nouveau_mot_de_passe")
    
    if not email or not code or not nouveau_mot_de_passe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="L'email, le code et le nouveau mot de passe sont requis."
        )
    
    # Vérifier le code
    if code not in reset_tokens_db:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Code invalide ou expiré."
        )
    
    code_data = reset_tokens_db[code]
    
    # Vérifier que l'email correspond
    if code_data["email"] != email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Code invalide pour cet email."
        )
    
    # Vérifier l'expiration
    if datetime.now() > code_data["expires_at"]:
        del reset_tokens_db[code]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Code expiré."
        )
    
    # Trouver l'utilisateur
    utilisateur = db.query(Utilisateur).filter(
        Utilisateur.email == email
    ).first()
    
    if not utilisateur:
        del reset_tokens_db[code]
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur non trouvé."
        )
    
    # Mettre à jour le mot de passe
    utilisateur.mot_de_passe = hasher_mot_de_passe(nouveau_mot_de_passe)
    db.commit()
    
    # Supprimer le code utilisé
    del reset_tokens_db[code]
    
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
