# Fichier auth.py corrigé pour résoudre l'erreur d'import

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

class PasswordReset(BaseModel):
    email: str

class PasswordResetConfirm(BaseModel):
    email: str
    code: str
    new_password: str

# Base de données simulée (en production, utilisez une vraie BDD)
users_db = {}
reset_codes = {}

# Configuration JWT
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "votre_cle_secrete_très_longue_et_complexe")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Fonctions d'authentification
def hasher_mot_de_passe(password: str) -> str:
    """Hasher un mot de passe avec SHA-256"""
    return hashlib.sha256(password.encode()).hexdigest()

def verifier_mot_de_passe(password: str, hashed_password: str) -> bool:
    """Vérifier si un mot de passe correspond au hash"""
    return hasher_mot_de_passe(password) == hashed_password

def creer_jeton_acces(data: dict, expires_delta: Optional[timedelta] = None):
    """Créer un token JWT"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def generer_code_reset():
    """Générer un code de réinitialisation de 6 chiffres"""
    return ''.join(random.choices(string.digits, k=6))

def obtenir_utilisateur_actuel(token: str = Depends(...)):
    """Obtenir l'utilisateur actuel à partir du token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Token invalide")
        
        # Trouver l'utilisateur dans la base de données
        for user_id, user_data in users_db.items():
            if user_data.get("email") == email:
                return user_data
        
        raise HTTPException(status_code=401, detail="Utilisateur non trouvé")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token invalide")

# Routes d'authentification
@router.post("/register", response_model=UserResponse)
async def register(user_data: UserRegister):
    """Inscription d'un nouvel utilisateur"""
    
    # Vérifier si l'email existe déjà
    for user_id, user_data in users_db.items():
        if user_data.get("email") == user_data.email:
            raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
    
    # Hasher le mot de passe
    hashed_password = hasher_mot_de_passe(user_data.password)
    
    # Créer le nouvel utilisateur
    user_id = len(users_db) + 1
    users_db[user_id] = {
        "id": user_id,
        "nom": user_data.nom,
        "prenom": user_data.prenom,
        "email": user_data.email,
        "telephone": user_data.telephone,
        "password": hashed_password,
        "created_at": datetime.utcnow()
    }
    
    return UserResponse(
        id=user_id,
        nom=user_data.nom,
        prenom=user_data.prenom,
        email=user_data.email,
        telephone=user_data.telephone
    )

@router.post("/login")
async def login(credentials: UserLogin):
    """Connexion d'un utilisateur"""
    
    # Vérifier les identifiants
    user_found = None
    for user_id, user_data in users_db.items():
        if user_data.get("email") == credentials.email:
            if verifier_mot_de_passe(credentials.password, user_data.get("password", "")):
                user_found = user_data
            break
    
    if not user_found:
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    
    # Créer le token JWT
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = creer_jeton_acces(
        data={"sub": user_found["email"]}, 
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user_found["id"],
            "nom": user_found["nom"],
            "prenom": user_found["prenom"],
            "email": user_found["email"],
            "telephone": user_found["telephone"]
        }
    }

@router.post("/reset-password")
async def reset_password(request: PasswordReset):
    """Demander une réinitialisation de mot de passe"""
    
    # Vérifier si l'email existe
    user_found = None
    for user_id, user_data in users_db.items():
        if user_data.get("email") == request.email:
            user_found = user_data
            break
    
    if not user_found:
        raise HTTPException(status_code=404, detail="Email non trouvé")
    
    # Générer et sauvegarder le code de réinitialisation
    reset_code = generer_code_reset()
    reset_codes[request.email] = {
        "code": reset_code,
        "expires_at": datetime.utcnow() + timedelta(minutes=10)
    }
    
    # Envoyer l'email (simulé)
    print(f"Code de réinitialisation pour {request.email}: {reset_code}")
    
    return {"message": "Code de réinitialisation envoyé par email"}

@router.post("/confirm-reset-password")
async def confirm_reset_password(request: PasswordResetConfirm):
    """Confirmer la réinitialisation de mot de passe"""
    
    # Vérifier le code
    if request.email not in reset_codes:
        raise HTTPException(status_code=400, detail="Code invalide ou expiré")
    
    reset_data = reset_codes[request.email]
    if datetime.utcnow() > reset_data["expires_at"]:
        del reset_codes[request.email]
        raise HTTPException(status_code=400, detail="Code expiré")
    
    if reset_data["code"] != request.code:
        raise HTTPException(status_code=400, detail="Code incorrect")
    
    # Mettre à jour le mot de passe
    for user_id, user_data in users_db.items():
        if user_data.get("email") == request.email:
            # Hasher le nouveau mot de passe
            hashed_password = hasher_mot_de_passe(request.new_password)
            users_db[user_id]["password"] = hashed_password
            break
    
    # Nettoyer le code de réinitialisation
    del reset_codes[request.email]
    
    return {"message": "Mot de passe réinitialisé avec succès"}

@router.get("/me")
async def get_current_user(current_user: dict = Depends(obtenir_utilisateur_actuel)):
    """Obtenir les informations de l'utilisateur actuel"""
    return {
        "id": current_user["id"],
        "nom": current_user["nom"],
        "prenom": current_user["prenom"],
        "email": current_user["email"],
        "telephone": current_user["telephone"]
    }
