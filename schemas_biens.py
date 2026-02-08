"""
schemas_biens.py — Les formulaires pour les biens immobiliers

Définit la forme des données :
- Ce que l'utilisateur envoie pour publier/modifier un bien
- Ce que l'API renvoie quand on demande un bien
- Les filtres de recherche
"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


# ============================================
# PUBLICATION D'UN BIEN
# ============================================

class FormulairePublicationBien(BaseModel):
    """Ce que l'utilisateur envoie pour publier un bien."""
    titre: str                                    # "Bel appartement à Bonamoussadi"
    description: Optional[str] = None             # Description libre
    type_bien: str                                # studio, maison, chambre, appartement, bureau, terrain
    ville: str                                    # Douala, Yaoundé, etc.
    quartier: str                                 # Bonamoussadi, Bastos, etc.
    adresse_complete: Optional[str] = None        # Adresse détaillée
    latitude: Optional[float] = None              # Coordonnées GPS (remplies auto si adresse donnée)
    longitude: Optional[float] = None
    prix_loyer: Optional[int] = None              # Prix du loyer mensuel en FCFA
    prix_vente: Optional[int] = None              # Prix de vente en FCFA
    superficie: Optional[int] = None              # En m²
    nombre_chambres: Optional[int] = 0
    nombre_salles_bain: Optional[int] = 0
    nombre_pieces: Optional[int] = None
    meuble: Optional[bool] = False                # Meublé ou non


# ============================================
# MODIFICATION D'UN BIEN
# ============================================

class FormulaireModificationBien(BaseModel):
    """Ce que l'utilisateur peut modifier. Tous les champs sont optionnels."""
    titre: Optional[str] = None
    description: Optional[str] = None
    type_bien: Optional[str] = None
    ville: Optional[str] = None
    quartier: Optional[str] = None
    adresse_complete: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    prix_loyer: Optional[int] = None
    prix_vente: Optional[int] = None
    superficie: Optional[int] = None
    nombre_chambres: Optional[int] = None
    nombre_salles_bain: Optional[int] = None
    nombre_pieces: Optional[int] = None
    meuble: Optional[bool] = None


# ============================================
# RÉPONSES API
# ============================================

class ReponseBien(BaseModel):
    """Ce que l'API renvoie quand on demande un bien."""
    id_bien: str
    id_proprietaire: str
    titre: str
    description: Optional[str] = None
    type_bien: str
    ville: str
    quartier: str
    adresse_complete: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    prix_loyer: Optional[int] = None
    prix_vente: Optional[int] = None
    superficie: Optional[int] = None
    nombre_chambres: int = 0
    nombre_salles_bain: int = 0
    nombre_pieces: Optional[int] = None
    meuble: bool = False
    statut: str = "en_attente"
    date_publication: Optional[datetime] = None
    date_modification: Optional[datetime] = None

    # Infos du propriétaire (pour afficher le nom sur l'annonce)
    nom_proprietaire: Optional[str] = None
    prenom_proprietaire: Optional[str] = None
    badge_certifie_proprietaire: Optional[bool] = False

    class Config:
        from_attributes = True


class ReponseListeBiens(BaseModel):
    """Réponse pour une liste de biens avec pagination."""
    biens: list[ReponseBien]
    total: int                    # Nombre total de résultats
    page: int                     # Page actuelle
    par_page: int                 # Nombre de résultats par page
    pages_total: int              # Nombre total de pages


# ============================================
# FILTRES DE RECHERCHE
# ============================================
# Ces filtres sont passés en paramètres de l'URL (query params)
# Pas besoin de schéma Pydantic, on les gère directement dans la route
