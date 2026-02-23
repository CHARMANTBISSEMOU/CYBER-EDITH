from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import images
import sys
sys.path.append('.')
import notchpay_routes_for_existing_backend

app = FastAPI(
    title="API Immobilier - NotchPay",
    description="API de gestion immobilière avec paiements NotchPay",
    version="2.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclure les routes
app.include_router(images.router)
app.include_router(notchpay_routes_for_existing_backend.router)

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
                "historique_utilisateur": "GET /notchpay/utilisateur/{id_utilisateur}",
                "paiements_bien": "GET /notchpay/bien/{id_bien}"
            },
            "docs": "/docs"
        }
    }

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "timestamp": "2024-02-23T15:00:00Z",
        "version": "2.0.0"
    }

if __name__ == "__main__":
    import uvicorn
    print("🚀 Lancement de l'API avec NotchPay...")
    print("📚 Documentation disponible sur: http://localhost:8000/docs")
    uvicorn.run(app, host="0.0.0.0", port=8000)
