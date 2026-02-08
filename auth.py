"""
auth.py — Le videur de l'application

Ce fichier gère :
1. Le hashage des mots de passe (transformer en chaîne incompréhensible)
2. La vérification des mots de passe (comparer le hash)
3. La création des tokens JWT (le bracelet de festival)
4. La vérification des tokens JWT (vérifier le bracelet)
"""

from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from dotenv import load_dotenv
import os

from database import get_db
from models import Utilisateur

# Charger les variables d'environnement
load_dotenv()

# --- Configuration ---
CLE_SECRETE = os.getenv("SECRET_KEY")
ALGORITHME = os.getenv("ALGORITHM", "HS256")
DUREE_EXPIRATION_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 1440))  # 1440 min = 24h

# --- Schéma OAuth2 pour récupérer le token dans les requêtes ---
# Le frontend enverra le token dans le header : Authorization: Bearer <token>
schema_oauth2 = OAuth2PasswordBearer(tokenUrl="/utilisateurs/connexion")


# ============================================
# FONCTIONS MOT DE PASSE
# ============================================

def hasher_mot_de_passe(mot_de_passe: str) -> str:
    """
    Transforme un mot de passe en clair en hash bcrypt.
    Exemple : "monMotDePasse123" → "$2b$12$xKz8mL..."

    Utilisé lors de l'inscription.
    """
    # Convertir le mot de passe en bytes et le hacher
    mot_de_passe_bytes = mot_de_passe.encode('utf-8')
    sel = bcrypt.gensalt()
    hash_bytes = bcrypt.hashpw(mot_de_passe_bytes, sel)
    # Retourner le hash en string
    return hash_bytes.decode('utf-8')


def verifier_mot_de_passe(mot_de_passe_clair: str, mot_de_passe_hashe: str) -> bool:
    """
    Compare un mot de passe en clair avec un hash.
    Retourne True si ça correspond, False sinon.

    Utilisé lors de la connexion.
    """
    # Convertir les deux en bytes
    mot_de_passe_bytes = mot_de_passe_clair.encode('utf-8')
    hash_bytes = mot_de_passe_hashe.encode('utf-8')
    # Vérifier
    return bcrypt.checkpw(mot_de_passe_bytes, hash_bytes)


# ============================================
# FONCTIONS TOKEN JWT
# ============================================

def creer_jeton_acces(donnees: dict) -> str:
    """
    Crée un token JWT (le bracelet de festival).
    
    Le token contient :
    - Les données qu'on veut (ex: id_utilisateur)
    - Une date d'expiration (24h par défaut)
    
    Utilisé après une connexion réussie.
    """
    donnees_a_encoder = donnees.copy()
    
    # Définir la date d'expiration (maintenant + 24h)
    expiration = datetime.now(timezone.utc) + timedelta(minutes=DUREE_EXPIRATION_MINUTES)
    donnees_a_encoder.update({"exp": expiration})
    
    # Créer et retourner le token
    jeton = jwt.encode(donnees_a_encoder, CLE_SECRETE, algorithm=ALGORITHME)
    return jeton


def verifier_jeton(jeton: str) -> dict:
    """
    Vérifie si un token JWT est valide.
    
    Retourne les données du token si valide.
    Lève une erreur si invalide ou expiré.
    """
    try:
        donnees = jwt.decode(jeton, CLE_SECRETE, algorithms=[ALGORITHME])
        return donnees
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide ou expiré. Reconnecte-toi.",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ============================================
# FONCTION POUR RÉCUPÉRER L'UTILISATEUR CONNECTÉ
# ============================================

def obtenir_utilisateur_actuel(
    jeton: str = Depends(schema_oauth2),
    db: Session = Depends(get_db)
) -> Utilisateur:
    """
    Récupère l'utilisateur connecté à partir de son token JWT.
    
    Cette fonction est utilisée dans les routes protégées.
    Exemple :
        @app.get("/utilisateurs/moi")
        def mon_profil(utilisateur: Utilisateur = Depends(obtenir_utilisateur_actuel)):
            return utilisateur
    
    Si le token est invalide ou l'utilisateur n'existe plus → erreur 401.
    """
    # Vérifier le token et extraire les données
    donnees = verifier_jeton(jeton)
    id_utilisateur = donnees.get("sub")
    
    if id_utilisateur is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide : aucun utilisateur trouvé.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Chercher l'utilisateur dans la BDD
    utilisateur = db.query(Utilisateur).filter(
        Utilisateur.id_utilisateur == id_utilisateur
    ).first()
    
    if utilisateur is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Utilisateur introuvable. Le compte a peut-être été supprimé.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return utilisateur