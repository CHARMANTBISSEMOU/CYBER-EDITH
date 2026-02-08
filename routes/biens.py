"""
routes/biens.py — Gestion des biens immobiliers

Routes disponibles :
- POST   /biens                → Publier un bien (connecté obligatoire)
- GET    /biens                → Liste des biens publiés (connecté obligatoire)
- GET    /biens/recherche      → Recherche avancée avec filtres (connecté obligatoire)
- GET    /biens/mes-biens      → Mes propres biens (connecté obligatoire)
- GET    /biens/{id}           → Détail d'un bien (connecté obligatoire)
- PUT    /biens/{id}           → Modifier mon bien (propriétaire seulement)
- DELETE /biens/{id}           → Supprimer mon bien (propriétaire seulement, si pas de contrat actif)

Sécurité :
- TOUTES les routes nécessitent un compte (token JWT)
- Seul le propriétaire peut modifier/supprimer son bien
- Suppression interdite si un contrat actif existe
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid
import requests
import json

from database import get_db
from models import Utilisateur, Bien, ContratLoyer, RechercheHistorique
from auth import obtenir_utilisateur_actuel
from schemas_biens import (
    FormulairePublicationBien,
    FormulaireModificationBien,
    ReponseBien,
    ReponseListeBiens
)

# Créer le routeur — toutes les routes commencent par /biens
routeur = APIRouter(prefix="/biens", tags=["Biens Immobiliers"])


# ============================================
# TYPES DE BIENS VALIDES (doivent correspondre à la BDD)
# ============================================
TYPES_BIEN_VALIDES = ["studio", "maison", "chambre", "appartement", "bureau", "terrain"]


# ============================================
# GÉOCODAGE — Convertir une adresse en coordonnées GPS
# ============================================

def geocoder_adresse(ville: str, quartier: str, adresse: str = None) -> dict:
    """
    Utilise OpenStreetMap Nominatim (gratuit) pour convertir
    une adresse en coordonnées GPS (latitude, longitude).
    
    Exemple : "Bonamoussadi, Douala, Cameroun" → {"latitude": 4.0816, "longitude": 9.7678}
    
    Retourne None si l'adresse n'est pas trouvée.
    """
    try:
        # Construire la requête de recherche
        recherche = f"{quartier}, {ville}, Cameroun"
        if adresse:
            recherche = f"{adresse}, {quartier}, {ville}, Cameroun"
        
        # Appeler l'API Nominatim (gratuit, pas de clé nécessaire)
        reponse = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={
                "q": recherche,
                "format": "json",
                "limit": 1,
                "countrycodes": "cm"  # Limiter au Cameroun
            },
            headers={
                "User-Agent": "AppImmobiliere/1.0"  # Obligatoire pour Nominatim
            },
            timeout=5  # 5 secondes max
        )
        
        resultats = reponse.json()
        
        if resultats:
            return {
                "latitude": float(resultats[0]["lat"]),
                "longitude": float(resultats[0]["lon"])
            }
        
        return None
    
    except Exception:
        # Si l'API est indisponible, on continue sans coordonnées
        return None


# ============================================
# NETTOYAGE HISTORIQUE — Supprimer les recherches de plus de 35 jours
# ============================================

def nettoyer_historique_recherches(db: Session):
    """
    Supprime les recherches de plus de 35 jours.
    Appelée à chaque recherche pour garder la BDD propre.
    """
    date_limite = datetime.now(timezone.utc) - timedelta(days=35)
    db.query(RechercheHistorique).filter(
        RechercheHistorique.date_recherche < date_limite
    ).delete()
    db.commit()


# ============================================
# FONCTION UTILITAIRE — Convertir un bien en réponse avec infos propriétaire
# ============================================

def bien_vers_reponse(bien: Bien) -> dict:
    """
    Convertit un objet Bien SQLAlchemy en dictionnaire de réponse,
    en ajoutant les infos du propriétaire.
    """
    return {
        "id_bien": bien.id_bien,
        "id_proprietaire": bien.id_proprietaire,
        "titre": bien.titre,
        "description": bien.description,
        "type_bien": bien.type_bien,
        "ville": bien.ville,
        "quartier": bien.quartier,
        "adresse_complete": bien.adresse_complete,
        "latitude": float(bien.latitude) if bien.latitude else None,
        "longitude": float(bien.longitude) if bien.longitude else None,
        "prix_loyer": bien.prix_loyer,
        "prix_vente": bien.prix_vente,
        "superficie": bien.superficie,
        "nombre_chambres": bien.nombre_chambres or 0,
        "nombre_salles_bain": bien.nombre_salles_bain or 0,
        "nombre_pieces": bien.nombre_pieces,
        "meuble": bool(bien.meuble),
        "statut": bien.statut,
        "date_publication": bien.date_publication,
        "date_modification": bien.date_modification,
        "nom_proprietaire": bien.proprietaire.nom if bien.proprietaire else None,
        "prenom_proprietaire": bien.proprietaire.prenom if bien.proprietaire else None,
        "badge_certifie_proprietaire": bool(bien.proprietaire.badge_certifie) if bien.proprietaire else False,
    }


# ============================================
# ROUTE 1 : PUBLIER UN BIEN
# ============================================

@routeur.post("/", response_model=ReponseBien, status_code=status.HTTP_201_CREATED)
def publier_bien(
    formulaire: FormulairePublicationBien,
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel),
    db: Session = Depends(get_db)
):
    """
    Publier un nouveau bien immobilier.
    
    Ce qui se passe :
    1. Vérifier que le type de bien est valide
    2. Vérifier qu'au moins un prix est fourni (loyer ou vente)
    3. Si pas de coordonnées GPS → essayer de géocoder l'adresse automatiquement
    4. Vérifier les champs obligatoires → si OK, statut = "publie"
    5. Sauvegarder en BDD
    """
    
    # Vérifier le type de bien
    if formulaire.type_bien not in TYPES_BIEN_VALIDES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Type de bien invalide. Types acceptés : {', '.join(TYPES_BIEN_VALIDES)}"
        )
    
    # Vérifier qu'au moins un prix est fourni
    if not formulaire.prix_loyer and not formulaire.prix_vente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tu dois indiquer au moins un prix (loyer ou vente)."
        )
    
    # Géocodage automatique si pas de coordonnées GPS
    latitude = formulaire.latitude
    longitude = formulaire.longitude
    
    if not latitude or not longitude:
        coordonnees = geocoder_adresse(
            ville=formulaire.ville,
            quartier=formulaire.quartier,
            adresse=formulaire.adresse_complete
        )
        if coordonnees:
            latitude = coordonnees["latitude"]
            longitude = coordonnees["longitude"]
    
    # Déterminer le statut initial
    # Si tous les champs importants sont remplis → publié directement
    # Sinon → en attente
    champs_ok = all([
        formulaire.titre,
        formulaire.type_bien,
        formulaire.ville,
        formulaire.quartier,
        formulaire.prix_loyer or formulaire.prix_vente
    ])
    statut_initial = "publie" if champs_ok else "en_attente"
    
    # Créer le bien
    nouveau_bien = Bien(
        id_bien=f"bien_{uuid.uuid4().hex[:12]}",
        id_proprietaire=utilisateur_actuel.id_utilisateur,
        titre=formulaire.titre,
        description=formulaire.description,
        type_bien=formulaire.type_bien,
        ville=formulaire.ville,
        quartier=formulaire.quartier,
        adresse_complete=formulaire.adresse_complete,
        latitude=latitude,
        longitude=longitude,
        prix_loyer=formulaire.prix_loyer,
        prix_vente=formulaire.prix_vente,
        superficie=formulaire.superficie,
        nombre_chambres=formulaire.nombre_chambres,
        nombre_salles_bain=formulaire.nombre_salles_bain,
        nombre_pieces=formulaire.nombre_pieces,
        meuble=formulaire.meuble,
        statut=statut_initial
    )
    
    # Sauvegarder
    db.add(nouveau_bien)
    db.commit()
    db.refresh(nouveau_bien)
    
    return bien_vers_reponse(nouveau_bien)


# ============================================
# ROUTE 2 : LISTE DES BIENS PUBLIÉS (avec pagination)
# ============================================

@routeur.get("/", response_model=ReponseListeBiens)
def liste_biens(
    page: int = Query(1, ge=1, description="Numéro de la page"),
    par_page: int = Query(10, ge=1, le=50, description="Nombre de biens par page"),
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel),
    db: Session = Depends(get_db)
):
    """
    Voir la liste de tous les biens publiés.
    
    Pagination : ?page=1&par_page=10
    Par défaut : page 1, 10 biens par page, max 50.
    """
    
    # Compter le total de biens publiés
    total = db.query(Bien).filter(Bien.statut == "publie").count()
    
    # Calculer le décalage pour la pagination
    decalage = (page - 1) * par_page
    
    # Récupérer les biens de cette page (les plus récents en premier)
    biens = db.query(Bien).filter(
        Bien.statut == "publie"
    ).order_by(
        Bien.date_publication.desc()
    ).offset(decalage).limit(par_page).all()
    
    # Calculer le nombre total de pages
    pages_total = (total + par_page - 1) // par_page  # Arrondi supérieur
    
    return {
        "biens": [bien_vers_reponse(b) for b in biens],
        "total": total,
        "page": page,
        "par_page": par_page,
        "pages_total": pages_total
    }


# ============================================
# ROUTE 3 : RECHERCHE AVANCÉE AVEC FILTRES
# ============================================

@routeur.get("/recherche", response_model=ReponseListeBiens)
def rechercher_biens(
    # --- Filtres ---
    ville: Optional[str] = Query(None, description="Filtrer par ville"),
    quartier: Optional[str] = Query(None, description="Filtrer par quartier"),
    type_bien: Optional[str] = Query(None, description="Filtrer par type (studio, maison, etc.)"),
    prix_min: Optional[int] = Query(None, ge=0, description="Prix minimum en FCFA"),
    prix_max: Optional[int] = Query(None, ge=0, description="Prix maximum en FCFA"),
    chambres_min: Optional[int] = Query(None, ge=0, description="Nombre minimum de chambres"),
    meuble: Optional[bool] = Query(None, description="Meublé (true) ou non (false)"),
    texte: Optional[str] = Query(None, description="Recherche dans le titre et la description"),
    # --- Tri ---
    tri: Optional[str] = Query("date", description="Trier par : date, prix_asc, prix_desc, superficie"),
    # --- Pagination ---
    page: int = Query(1, ge=1),
    par_page: int = Query(10, ge=1, le=50),
    # --- Auth ---
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel),
    db: Session = Depends(get_db)
):
    """
    Recherche avancée avec filtres multiples.
    
    Exemples d'utilisation :
    - /biens/recherche?ville=Douala&type_bien=studio
    - /biens/recherche?prix_max=80000&chambres_min=2
    - /biens/recherche?texte=piscine&tri=prix_asc
    
    Chaque recherche est sauvegardée dans l'historique (supprimé après 35 jours).
    """
    
    # Nettoyer les vieilles recherches (plus de 35 jours)
    nettoyer_historique_recherches(db)
    
    # Commencer la requête — seulement les biens publiés
    requete = db.query(Bien).filter(Bien.statut == "publie")
    
    # Appliquer les filtres un par un
    if ville:
        requete = requete.filter(Bien.ville.ilike(f"%{ville}%"))
    
    if quartier:
        requete = requete.filter(Bien.quartier.ilike(f"%{quartier}%"))
    
    if type_bien:
        if type_bien not in TYPES_BIEN_VALIDES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Type de bien invalide. Types acceptés : {', '.join(TYPES_BIEN_VALIDES)}"
            )
        requete = requete.filter(Bien.type_bien == type_bien)
    
    if prix_min is not None:
        requete = requete.filter(
            or_(
                Bien.prix_loyer >= prix_min,
                Bien.prix_vente >= prix_min
            )
        )
    
    if prix_max is not None:
        requete = requete.filter(
            or_(
                Bien.prix_loyer <= prix_max,
                Bien.prix_vente <= prix_max
            )
        )
    
    if chambres_min is not None:
        requete = requete.filter(Bien.nombre_chambres >= chambres_min)
    
    if meuble is not None:
        requete = requete.filter(Bien.meuble == meuble)
    
    if texte:
        requete = requete.filter(
            or_(
                Bien.titre.ilike(f"%{texte}%"),
                Bien.description.ilike(f"%{texte}%")
            )
        )
    
    # Appliquer le tri
    if tri == "prix_asc":
        requete = requete.order_by(Bien.prix_loyer.asc())
    elif tri == "prix_desc":
        requete = requete.order_by(Bien.prix_loyer.desc())
    elif tri == "superficie":
        requete = requete.order_by(Bien.superficie.desc())
    else:  # par défaut : date (les plus récents en premier)
        requete = requete.order_by(Bien.date_publication.desc())
    
    # Compter le total AVANT pagination
    total = requete.count()
    
    # Pagination
    decalage = (page - 1) * par_page
    biens = requete.offset(decalage).limit(par_page).all()
    pages_total = (total + par_page - 1) // par_page
    
    # Sauvegarder la recherche dans l'historique
    criteres = {
        "ville": ville, "quartier": quartier, "type_bien": type_bien,
        "prix_min": prix_min, "prix_max": prix_max,
        "chambres_min": chambres_min, "meuble": meuble, "texte": texte
    }
    # Garder seulement les filtres non-vides
    criteres_utilises = {k: v for k, v in criteres.items() if v is not None}
    
    if criteres_utilises:  # Sauvegarder seulement si au moins un filtre utilisé
        historique = RechercheHistorique(
            id_recherche=f"rech_{uuid.uuid4().hex[:12]}",
            id_utilisateur=utilisateur_actuel.id_utilisateur,
            criteres_recherche=json.dumps(criteres_utilises, ensure_ascii=False)
        )
        db.add(historique)
        db.commit()
    
    return {
        "biens": [bien_vers_reponse(b) for b in biens],
        "total": total,
        "page": page,
        "par_page": par_page,
        "pages_total": pages_total
    }


# ============================================
# ROUTE 4 : MES PROPRES BIENS
# ============================================

@routeur.get("/mes-biens", response_model=ReponseListeBiens)
def mes_biens(
    page: int = Query(1, ge=1),
    par_page: int = Query(10, ge=1, le=50),
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel),
    db: Session = Depends(get_db)
):
    """
    Voir tous MES biens (tous statuts : en_attente, publie, loue, vendu, archive).
    """
    
    total = db.query(Bien).filter(
        Bien.id_proprietaire == utilisateur_actuel.id_utilisateur
    ).count()
    
    decalage = (page - 1) * par_page
    
    biens = db.query(Bien).filter(
        Bien.id_proprietaire == utilisateur_actuel.id_utilisateur
    ).order_by(
        Bien.date_publication.desc()
    ).offset(decalage).limit(par_page).all()
    
    pages_total = (total + par_page - 1) // par_page
    
    return {
        "biens": [bien_vers_reponse(b) for b in biens],
        "total": total,
        "page": page,
        "par_page": par_page,
        "pages_total": pages_total
    }


# ============================================
# ROUTE 5 : DÉTAIL D'UN BIEN
# ============================================

@routeur.get("/{id_bien}", response_model=ReponseBien)
def detail_bien(
    id_bien: str,
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel),
    db: Session = Depends(get_db)
):
    """
    Voir tous les détails d'un bien.
    """
    
    bien = db.query(Bien).filter(Bien.id_bien == id_bien).first()
    
    if not bien:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bien introuvable."
        )
    
    return bien_vers_reponse(bien)


# ============================================
# ROUTE 6 : MODIFIER MON BIEN (propriétaire seulement)
# ============================================

@routeur.put("/{id_bien}", response_model=ReponseBien)
def modifier_bien(
    id_bien: str,
    modifications: FormulaireModificationBien,
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel),
    db: Session = Depends(get_db)
):
    """
    Modifier un bien. Seul le propriétaire peut le faire.
    On ne modifie que les champs envoyés.
    """
    
    # Chercher le bien
    bien = db.query(Bien).filter(Bien.id_bien == id_bien).first()
    
    if not bien:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bien introuvable."
        )
    
    # Vérifier que c'est bien le propriétaire
    if bien.id_proprietaire != utilisateur_actuel.id_utilisateur:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu ne peux modifier que tes propres biens."
        )
    
    # Vérifier le type de bien si modifié
    if modifications.type_bien and modifications.type_bien not in TYPES_BIEN_VALIDES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Type de bien invalide. Types acceptés : {', '.join(TYPES_BIEN_VALIDES)}"
        )
    
    # Appliquer les modifications (seulement les champs non-vides)
    if modifications.titre is not None:
        bien.titre = modifications.titre
    if modifications.description is not None:
        bien.description = modifications.description
    if modifications.type_bien is not None:
        bien.type_bien = modifications.type_bien
    if modifications.ville is not None:
        bien.ville = modifications.ville
    if modifications.quartier is not None:
        bien.quartier = modifications.quartier
    if modifications.adresse_complete is not None:
        bien.adresse_complete = modifications.adresse_complete
    if modifications.latitude is not None:
        bien.latitude = modifications.latitude
    if modifications.longitude is not None:
        bien.longitude = modifications.longitude
    if modifications.prix_loyer is not None:
        bien.prix_loyer = modifications.prix_loyer
    if modifications.prix_vente is not None:
        bien.prix_vente = modifications.prix_vente
    if modifications.superficie is not None:
        bien.superficie = modifications.superficie
    if modifications.nombre_chambres is not None:
        bien.nombre_chambres = modifications.nombre_chambres
    if modifications.nombre_salles_bain is not None:
        bien.nombre_salles_bain = modifications.nombre_salles_bain
    if modifications.nombre_pieces is not None:
        bien.nombre_pieces = modifications.nombre_pieces
    if modifications.meuble is not None:
        bien.meuble = modifications.meuble
    
    # Si la ville ou le quartier change, re-géocoder
    if modifications.ville or modifications.quartier:
        coordonnees = geocoder_adresse(
            ville=bien.ville,
            quartier=bien.quartier,
            adresse=bien.adresse_complete
        )
        if coordonnees:
            bien.latitude = coordonnees["latitude"]
            bien.longitude = coordonnees["longitude"]
    
    # Sauvegarder
    db.commit()
    db.refresh(bien)
    
    return bien_vers_reponse(bien)


# ============================================
# ROUTE 7 : SUPPRIMER MON BIEN (propriétaire seulement)
# ============================================

@routeur.delete("/{id_bien}")
def supprimer_bien(
    id_bien: str,
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel),
    db: Session = Depends(get_db)
):
    """
    Supprimer un bien. Seul le propriétaire peut le faire.
    
    RÈGLE IMPORTANTE :
    - Si le bien a un contrat ACTIF → suppression INTERDITE
    - Si pas de contrat actif → suppression TOTALE de la BDD
    """
    
    # Chercher le bien
    bien = db.query(Bien).filter(Bien.id_bien == id_bien).first()
    
    if not bien:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bien introuvable."
        )
    
    # Vérifier que c'est bien le propriétaire
    if bien.id_proprietaire != utilisateur_actuel.id_utilisateur:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu ne peux supprimer que tes propres biens."
        )
    
    # Vérifier s'il y a un contrat actif
    contrat_actif = db.query(ContratLoyer).filter(
        ContratLoyer.id_bien == id_bien,
        ContratLoyer.statut_contrat == "actif"
    ).first()
    
    if contrat_actif:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Impossible de supprimer ce bien : un contrat est encore actif. Résilie d'abord le contrat."
        )
    
    # Suppression totale (CASCADE supprimera aussi les images, contrats terminés, etc.)
    db.delete(bien)
    db.commit()
    
    return {"message": "Bien supprimé avec succès."}
