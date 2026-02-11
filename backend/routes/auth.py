from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
import jwt
from datetime import datetime, timedelta
import hashlib
import random
import string

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Modèles Pydantic
class UserLogin(BaseModel):
    email: str
    password: str

class UserRegister(BaseModel):
    nom: str
    prenom: str
    email: EmailStr
    telephone: str
    password: str

class UserResponse(BaseModel):
    id: int
    nom: str
    prenom: str
    email: str
    telephone: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

# Configuration email (à adapter selon vos besoins)
EMAIL_CONFIG = {
    "SMTP_SERVER": os.getenv("SMTP_SERVER", "smtp.gmail.com"),
    "SMTP_PORT": int(os.getenv("SMTP_PORT", "587")),
    "EMAIL_USER": os.getenv("EMAIL_USER", ""),
    "EMAIL_PASSWORD": os.getenv("EMAIL_PASSWORD", ""),
    "FROM_EMAIL": os.getenv("FROM_EMAIL", "noreply@appimobilier.com")
}

# Base de données simulée (à remplacer par votre vraie DB)
users_db = {}
reset_tokens_db = {}

def generate_reset_token():
    """Générer un token de réinitialisation sécurisé"""
    return ''.join(random.choices(string.ascii_letters + string.digits, k=32))

def send_reset_email(email: str, reset_token: str):
    """Envoyer un email de réinitialisation de mot de passe"""
    try:
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
        return False

@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    """Endpoint pour demander la réinitialisation du mot de passe"""
    email = request.email
    
    # Vérifier si l'utilisateur existe (simulé)
    user_exists = email in [user.get("email", "") for user in users_db.values()]
    
    if not user_exists:
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
            status_code=500, 
            detail="Erreur lors de l'envoi de l'email. Veuillez réessayer plus tard."
        )

@router.post("/reset-password")
async def reset_password(token: str, new_password: str):
    """Endpoint pour réinitialiser le mot de passe avec un token"""
    # Vérifier le token
    if token not in reset_tokens_db:
        raise HTTPException(status_code=400, detail="Token invalide ou expiré")
    
    token_data = reset_tokens_db[token]
    
    # Vérifier l'expiration
    if datetime.now() > token_data["expires_at"]:
        del reset_tokens_db[token]
        raise HTTPException(status_code=400, detail="Token expiré")
    
    # Mettre à jour le mot de passe (simulé)
    user_email = token_data["email"]
    for user_id, user_data in users_db.items():
        if user_data.get("email") == user_email:
            # Hasher le nouveau mot de passe
            hashed_password = hashlib.sha256(new_password.encode()).hexdigest()
            users_db[user_id]["password"] = hashed_password
            break
    
    # Supprimer le token utilisé
    del reset_tokens_db[token]
    
    return {"message": "Mot de passe réinitialisé avec succès"}

@router.post("/login")
async def login(credentials: UserLogin):
    """Endpoint de connexion"""
    email = credentials.email
    password = credentials.email
    
    # Hasher le mot de passe
    hashed_password = hashlib.sha256(password.encode()).hexdigest()
    
    # Vérifier les identifiants (simulé)
    for user_id, user_data in users_db.items():
        if user_data.get("email") == email and user_data.get("password") == hashed_password:
            # Générer un token JWT
            token = jwt.encode(
                {
                    "user_id": user_id,
                    "email": email,
                    "exp": datetime.now() + timedelta(days=7)
                },
                "votre_secret_key",  # À remplacer par votre clé secrète
                algorithm="HS256"
            )
            return {
                "access_token": token,
                "token_type": "bearer",
                "user": {
                    "id": user_id,
                    "nom": user_data.get("nom"),
                    "prenom": user_data.get("prenom"),
                    "email": user_data.get("email"),
                    "telephone": user_data.get("telephone")
                }
            }
    
    raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")

@router.post("/register")
async def register(user_data: UserRegister):
    """Endpoint d'inscription"""
    # Vérifier si l'email existe déjà
    existing_user = next(
        (user for user in users_db.values() if user.get("email") == user_data.email),
        None
    )
    
    if existing_user:
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
    
    # Hasher le mot de passe
    hashed_password = hashlib.sha256(user_data.password.encode()).hexdigest()
    
    # Créer le nouvel utilisateur (simulé)
    user_id = len(users_db) + 1
    users_db[user_id] = {
        "id": user_id,
        "nom": user_data.nom,
        "prenom": user_data.prenom,
        "email": user_data.email,
        "telephone": user_data.telephone,
        "password": hashed_password,
        "created_at": datetime.now()
    }
    
    return {"message": "Utilisateur créé avec succès", "user_id": user_id}

@router.get("/me")
async def get_current_user():
    """Endpoint pour obtenir les infos de l'utilisateur connecté"""
    # Simuler un utilisateur connecté (à remplacer par votre auth middleware)
    return {
        "id": 1,
        "nom": "Utilisateur",
        "prenom": "Test",
        "email": "test@example.com",
        "telephone": "237600000000"
    }

@router.put("/me")
async def update_profile(updates: dict):
    """Endpoint pour mettre à jour le profil utilisateur"""
    # Simuler la mise à jour (à adapter selon votre logique)
    return {"message": "Profil mis à jour avec succès"}

@router.put("/me/password")
async def change_password(request: ChangePasswordRequest):
    """Endpoint pour changer le mot de passe"""
    # Simuler le changement de mot de passe
    return {"message": "Mot de passe changé avec succès"}
