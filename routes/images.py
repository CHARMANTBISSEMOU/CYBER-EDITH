from fastapi import APIRouter, HTTPException

# Créer le routeur
routeur = APIRouter(prefix="/images", tags=["Images"])


@routeur.post("/upload")
def upload_photo():
    raise HTTPException(status_code=501, detail="Endpoint non implémenté dans ce déploiement")


@routeur.post("/videos/upload")
def upload_video():
    raise HTTPException(status_code=501, detail="Endpoint non implémenté dans ce déploiement")


@routeur.get("/bien/{id_bien}")
def get_images(id_bien: str):
    raise HTTPException(status_code=501, detail="Endpoint non implémenté dans ce déploiement")


@routeur.delete("/delete/{public_id}")
def delete_image(public_id: str):
    raise HTTPException(status_code=501, detail="Endpoint non implémenté dans ce déploiement")
