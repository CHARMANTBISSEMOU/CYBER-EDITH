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
from datetime import datetime
import uuid

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
