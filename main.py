from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import images, utilisateurs, biens, contrats, geolocalisation, medias, messages, notifications, paiements, webhooks
import notchpay_routes  # Import des routes NotchPay
import config
import os
from database_updated import create_tables
from datetime import datetime

app = FastAPI(
    title="API Immobilier - NotchPay",
    description="API de gestion immobilière avec paiements NotchPay",
    version="2.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En production, spécifier vos domaines
    allow_methods=["*"],
    allow_headers=["*"],
)

# Créer les tables au démarrage
create_tables()

# Inclure les routes
app.include_router(images.router)
app.include_router(utilisateurs.router)
app.include_router(biens.router)
app.include_router(contrats.router)
app.include_router(geolocalisation.router)
app.include_router(medias.router)
app.include_router(messages.router)
app.include_router(notifications.router)
app.include_router(paiements.router)
app.include_router(webhooks.router)
app.include_router(notchpay_routes.router)  # Routes NotchPay

@app.get("/")
def root():
    return {
        "message": "API Immobilier - NotchPay",
        "version": "2.0.0",
        "routes": {
            "images": {
                "upload_photo": "POST /images/upload",
                "upload_video": "POST /images/videos/upload",
                "get_images": "GET /images/bien/{id_bien}",
                "delete_image": "DELETE /images/delete/{public_id}"
            },
            "paiements": {
                "initier": "POST /notchpay/initier",
                "verifier": "GET /notchpay/verifier/{reference}",
                "webhook": "POST /notchpay/webhook",
                "historique_utilisateur": "GET /notchpay/utilisateur/{id_utilisateur}",
                "paiements_bien": "GET /notchpay/bien/{id_bien}"
            },
            "docs": "/docs"
        }
    }

@app.get("/health")
def health_check():
    """
    Vérifier si l'API fonctionne
    """
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "2.0.0"
    }

if __name__ == "__main__":
    import uvicorn
    from datetime import datetime
    
    print("🚀 Lancement de l'API avec NotchPay...")
    print("📚 Documentation disponible sur: http://localhost:8000/docs")
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
