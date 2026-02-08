"""
routes/medias.py — Gestion des images et vidéos des biens

Routes disponibles :
- POST   /medias/{id_bien}/upload      → Upload une image ou vidéo (propriétaire seulement)
- GET    /medias/{id_bien}             → Voir tous les médias d'un bien (connecté obligatoire)
- DELETE /medias/{id_media}            → Supprimer un média (propriétaire seulement)

Fonctionnalités :
- Compression automatique des images (max 1200x1200, qualité 60%)
- Vidéos max 1 minute, compressées par Cloudinary
- Vérification par Claude API : est-ce un bien immobilier ?
- Stockage sur Cloudinary
- Limite : 5 images + 2 vidéos par bien
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from PIL import Image as PILImage
from io import BytesIO
import cloudinary
import cloudinary.uploader
import anthropic
import base64
import uuid
import json
import os

from database import get_db
from models import Utilisateur, Bien, Image
from auth import obtenir_utilisateur_actuel

# Charger les variables d'environnement
load_dotenv()

# --- Configuration Cloudinary ---
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET")
)

# --- Configuration Claude API ---
CLE_ANTHROPIC = os.getenv("ANTHROPIC_API_KEY")

# Créer le routeur
routeur = APIRouter(prefix="/medias", tags=["Médias (Images & Vidéos)"])

# --- Limites ---
MAX_IMAGES_PAR_BIEN = 5
MAX_VIDEOS_PAR_BIEN = 2
MAX_DUREE_VIDEO_SECONDES = 60
MAX_TAILLE_FICHIER_MO = 50

# --- Types acceptés ---
TYPES_IMAGE_ACCEPTES = ["image/jpeg", "image/png", "image/webp"]
TYPES_VIDEO_ACCEPTES = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/webm"]


# ============================================
# COMPRESSION D'IMAGE (Pillow)
# ============================================

def compresser_image(contenu_fichier: bytes) -> bytes:
    """
    Compresse une image :
    - Max 1200x1200 pixels (garde les proportions)
    - Qualité 60%
    - Convertit en JPEG
    """
    image = PILImage.open(BytesIO(contenu_fichier))
    
    # Convertir en RGB (nécessaire pour JPEG)
    if image.mode in ("RGBA", "LA", "P"):
        image = image.convert("RGB")
    
    # Redimensionner si trop grande
    image.thumbnail((1200, 1200), PILImage.LANCZOS)
    
    # Sauvegarder en JPEG compressé
    tampon = BytesIO()
    image.save(tampon, format="JPEG", quality=60, optimize=True)
    tampon.seek(0)
    
    return tampon.getvalue()


# ============================================
# VÉRIFICATION PAR CLAUDE API — Est-ce un bien immobilier ?
# ============================================

def verifier_image_avec_claude(contenu_image: bytes) -> dict:
    """
    Envoie l'image à Claude (vision) pour vérifier si c'est un bien immobilier.
    
    Retourne : {"valide": True/False, "raison": "explication"}
    """
    if not CLE_ANTHROPIC:
        return {"valide": True, "raison": "Vérification IA désactivée."}
    
    try:
        # Encoder en base64
        image_base64 = base64.b64encode(contenu_image).decode("utf-8")
        
        # Appeler Claude API
        client = anthropic.Anthropic(api_key=CLE_ANTHROPIC)
        
        reponse = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=200,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": image_base64
                            }
                        },
                        {
                            "type": "text",
                            "text": """Analyse cette image. Réponds UNIQUEMENT en JSON :
{"valide": true, "raison": "explication courte"}

Règles :
- valide = true si c'est une photo de bien immobilier (maison, appartement, chambre, terrain, bureau, studio, intérieur, extérieur, cuisine, salle de bain, jardin, façade, couloir, salon, balcon)
- valide = false si ce n'est PAS un bien immobilier (selfie, nourriture, animal, document, voiture, etc.)
- valide = false si l'image est inappropriée

Réponds UNIQUEMENT le JSON."""
                        }
                    ]
                }
            ]
        )
        
        # Parser la réponse JSON
        texte = reponse.content[0].text.strip()
        resultat = json.loads(texte)
        
        return {
            "valide": resultat.get("valide", False),
            "raison": resultat.get("raison", "Analyse impossible.")
        }
    
    except Exception as e:
        # En cas d'erreur, on accepte (mieux que bloquer l'utilisateur)
        return {"valide": True, "raison": f"Vérification IA temporairement indisponible."}


# ============================================
# ROUTE 1 : UPLOAD UN MÉDIA
# ============================================

@routeur.post("/{id_bien}/upload", status_code=status.HTTP_201_CREATED)
async def upload_media(
    id_bien: str,
    fichier: UploadFile = File(..., description="Image (JPEG, PNG, WebP) ou Vidéo (MP4, MOV, AVI, WebM)"),
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel),
    db: Session = Depends(get_db)
):
    """
    Upload une image ou vidéo pour un bien immobilier.
    
    Processus :
    1. Vérifier propriétaire + type de fichier + limites
    2. Image → compression Pillow + vérification Claude + Cloudinary
    3. Vidéo → vérification durée + Cloudinary (compression auto)
    4. Sauvegarder URL en BDD
    """
    
    # --- Vérifier que le bien existe ---
    bien = db.query(Bien).filter(Bien.id_bien == id_bien).first()
    if not bien:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bien introuvable."
        )
    
    # --- Vérifier que c'est le propriétaire ---
    if bien.id_proprietaire != utilisateur_actuel.id_utilisateur:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu ne peux ajouter des médias qu'à tes propres biens."
        )
    
    # --- Vérifier le type de fichier ---
    type_fichier = fichier.content_type
    est_image = type_fichier in TYPES_IMAGE_ACCEPTES
    est_video = type_fichier in TYPES_VIDEO_ACCEPTES
    
    if not est_image and not est_video:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Type non accepté : {type_fichier}. Images : JPEG, PNG, WebP. Vidéos : MP4, MOV, AVI, WebM."
        )
    
    # --- Vérifier les limites ---
    nb_images = db.query(Image).filter(Image.id_bien == id_bien, Image.type_media == "image").count()
    nb_videos = db.query(Image).filter(Image.id_bien == id_bien, Image.type_media == "video").count()
    
    if est_image and nb_images >= MAX_IMAGES_PAR_BIEN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Limite atteinte : maximum {MAX_IMAGES_PAR_BIEN} images par bien. ({nb_images}/{MAX_IMAGES_PAR_BIEN})"
        )
    
    if est_video and nb_videos >= MAX_VIDEOS_PAR_BIEN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Limite atteinte : maximum {MAX_VIDEOS_PAR_BIEN} vidéos par bien. ({nb_videos}/{MAX_VIDEOS_PAR_BIEN})"
        )
    
    # --- Lire le fichier ---
    contenu = await fichier.read()
    
    # --- Vérifier la taille ---
    taille_mo = len(contenu) / (1024 * 1024)
    if taille_mo > MAX_TAILLE_FICHIER_MO:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Fichier trop lourd : {taille_mo:.1f} Mo. Maximum : {MAX_TAILLE_FICHIER_MO} Mo."
        )
    
    # --- Traitement IMAGE ---
    verification_ia = None
    
    if est_image:
        # 1. Compresser
        contenu_compresse = compresser_image(contenu)
        
        # 2. Vérifier avec Claude API
        verification_ia = verifier_image_avec_claude(contenu_compresse)
        if not verification_ia["valide"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Image refusée par l'IA : {verification_ia['raison']}"
            )
        
        # 3. Upload sur Cloudinary
        try:
            resultat = cloudinary.uploader.upload(
                contenu_compresse,
                folder=f"app_immobiliere/biens/{id_bien}",
                resource_type="image"
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erreur Cloudinary : {str(e)}"
            )
        
        type_media = "image"
    
    # --- Traitement VIDÉO ---
    else:
        # 1. Upload sur Cloudinary (il compresse automatiquement)
        try:
            resultat = cloudinary.uploader.upload(
                contenu,
                folder=f"app_immobiliere/biens/{id_bien}",
                resource_type="video"
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erreur Cloudinary : {str(e)}"
            )
        
        # 2. Vérifier la durée (Cloudinary nous donne cette info)
        duree = resultat.get("duration", 0)
        if duree > MAX_DUREE_VIDEO_SECONDES:
            # Supprimer la vidéo de Cloudinary (trop longue)
            try:
                cloudinary.uploader.destroy(resultat["public_id"], resource_type="video")
            except Exception:
                pass
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Vidéo trop longue : {int(duree)} secondes. Maximum : {MAX_DUREE_VIDEO_SECONDES} secondes (1 minute)."
            )
        
        type_media = "video"
    
    # --- Sauvegarder en BDD ---
    nouveau_media = Image(
        id_image=f"media_{uuid.uuid4().hex[:12]}",
        id_bien=id_bien,
        url_cloudinary=resultat["secure_url"],
        type_media=type_media
    )
    
    db.add(nouveau_media)
    db.commit()
    db.refresh(nouveau_media)
    
    # --- Réponse ---
    reponse = {
        "message": f"{'Image' if est_image else 'Vidéo'} uploadée avec succès !",
        "id_media": nouveau_media.id_image,
        "url": nouveau_media.url_cloudinary,
        "type_media": type_media,
        "taille_originale_mo": round(taille_mo, 2)
    }
    
    if verification_ia:
        reponse["verification_ia"] = verification_ia["raison"]
    
    if est_video:
        reponse["duree_secondes"] = int(resultat.get("duration", 0))
    
    return reponse


# ============================================
# ROUTE 2 : VOIR TOUS LES MÉDIAS D'UN BIEN
# ============================================

@routeur.get("/{id_bien}")
def voir_medias(
    id_bien: str,
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel),
    db: Session = Depends(get_db)
):
    """
    Voir toutes les images et vidéos d'un bien.
    """
    
    bien = db.query(Bien).filter(Bien.id_bien == id_bien).first()
    if not bien:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bien introuvable."
        )
    
    medias = db.query(Image).filter(Image.id_bien == id_bien).all()
    
    images = []
    videos = []
    
    for media in medias:
        donnees = {
            "id_media": media.id_image,
            "url": media.url_cloudinary,
            "type_media": media.type_media,
            "date_upload": str(media.date_upload) if media.date_upload else None
        }
        if media.type_media == "video":
            videos.append(donnees)
        else:
            images.append(donnees)
    
    return {
        "id_bien": id_bien,
        "images": images,
        "videos": videos,
        "nombre_images": f"{len(images)}/{MAX_IMAGES_PAR_BIEN}",
        "nombre_videos": f"{len(videos)}/{MAX_VIDEOS_PAR_BIEN}"
    }


# ============================================
# ROUTE 3 : SUPPRIMER UN MÉDIA
# ============================================

@routeur.delete("/{id_media}")
def supprimer_media(
    id_media: str,
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel),
    db: Session = Depends(get_db)
):
    """
    Supprimer un média (image ou vidéo).
    Seul le propriétaire du bien peut supprimer.
    Supprime aussi de Cloudinary.
    """
    
    # Chercher le média
    media = db.query(Image).filter(Image.id_image == id_media).first()
    if not media:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Média introuvable."
        )
    
    # Vérifier que c'est le propriétaire
    bien = db.query(Bien).filter(Bien.id_bien == media.id_bien).first()
    if not bien or bien.id_proprietaire != utilisateur_actuel.id_utilisateur:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu ne peux supprimer que les médias de tes propres biens."
        )
    
    # Supprimer de Cloudinary
    try:
        # Extraire le public_id depuis l'URL
        # Format URL : https://res.cloudinary.com/xxx/image/upload/v123/app_immobiliere/biens/id/fichier.jpg
        url = media.url_cloudinary
        partie_apres_upload = url.split("/upload/")[1]  # "v123/app_immobiliere/biens/id/fichier.jpg"
        # Enlever le numéro de version "v123/"
        parties = partie_apres_upload.split("/", 1)
        if parties[0].startswith("v") and parties[0][1:].isdigit():
            chemin = parties[1]
        else:
            chemin = partie_apres_upload
        # Enlever l'extension
        public_id = chemin.rsplit(".", 1)[0]
        
        type_ressource = "video" if media.type_media == "video" else "image"
        cloudinary.uploader.destroy(public_id, resource_type=type_ressource)
    except Exception:
        pass  # Pas grave si ça échoue, on supprime quand même de la BDD
    
    # Supprimer de la BDD
    nom_type = "Vidéo" if media.type_media == "video" else "Image"
    db.delete(media)
    db.commit()
    
    return {"message": f"{nom_type} supprimée avec succès."}
