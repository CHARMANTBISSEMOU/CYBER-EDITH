"""
schemas.py — Les formulaires de l'application

Ce fichier définit la FORME des données :
- Ce que l'utilisateur doit envoyer (ex: pour s'inscrire)
- Ce que l'API renvoie (ex: les infos du profil)

C'est comme des formulaires papier : on définit les champs obligatoires,
les champs optionnels, et le format attendu.
"""

from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


# ============================================
# UTILISATEUR — Formulaires
# ============================================

class FormulaireInscription(BaseModel):
    """Ce que l'utilisateur envoie pour s'inscrire."""
    email: EmailStr                          # Email valide obligatoire
    mot_de_passe: str                        # Mot de passe obligatoire
    telephone: str                           # Format 237XXXXXXXXX
    nom: str                                 # Nom de famille
    prenom: str                              # Prénom
    photo_profil_url: Optional[str] = None   # URL de la photo de profil (optionnel)
    consent_geolocalisation: Optional[str] = "non"  # "oui" ou "non"


class FormulaireConnexion(BaseModel):
    """Ce que l'utilisateur envoie pour se connecter."""
    email: EmailStr
    mot_de_passe: str


class FormulaireModificationProfil(BaseModel):
    """Ce que l'utilisateur peut modifier dans son profil. Tous les champs sont optionnels."""
    nom: Optional[str] = None
    prenom: Optional[str] = None
    telephone: Optional[str] = None
    photo_profil_url: Optional[str] = None
    consent_geolocalisation: Optional[str] = None


class ReponseUtilisateur(BaseModel):
    """Ce que l'API renvoie quand on demande un profil utilisateur."""
    id_utilisateur: str
    email: str
    telephone: str
    nom: str
    prenom: str
    photo_profil_url: Optional[str] = None
    badge_certifie: bool = False
    nombre_contrats: int = 0
    consent_geolocalisation: str = "non"
    date_inscription: datetime
    derniere_connexion: Optional[datetime] = None

    class Config:
        from_attributes = True  # Permet de convertir un objet SQLAlchemy en réponse


class ReponseProfilPublic(BaseModel):
    """Ce que l'API renvoie pour un profil PUBLIC (sans email ni téléphone)."""
    id_utilisateur: str
    nom: str
    prenom: str
    photo_profil_url: Optional[str] = None
    badge_certifie: bool = False
    nombre_contrats: int = 0
    date_inscription: datetime

    class Config:
        from_attributes = True


class ReponseJeton(BaseModel):
    """Ce que l'API renvoie après une connexion réussie."""
    jeton_acces: str
    type_jeton: str = "bearer"
    utilisateur: ReponseUtilisateur


class ReponseMessage(BaseModel):
    """Réponse simple avec juste un message."""
    message: str
    id_utilisateur: Optional[str] = None
