from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import images
from routes import paiements
from routes import auth  # Import de la nouvelle route auth
import config
import os
from routes import webhooks

app = FastAPI(title="API Images & Vidéos")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclure les routes
app.include_router(images.router)
app.include_router(paiements.router)
app.include_router(webhooks.router)
app.include_router(auth.router)  # Ajout de la route auth

@app.get("/")
def root():
    return {
        "message": "API Images & Vidéos",
        "routes": {
            "upload_photo": "POST /images/upload",
            "upload_video": "POST /images/videos/upload",
            "auth_login": "POST /auth/login",
            "auth_register": "POST /auth/register",
            "auth_forgot_password": "POST /auth/forgot-password",
            "auth_reset_password": "POST /auth/reset-password",
            "auth_me": "GET /auth/me",
            "docs": "/docs"
        }
    }

if __name__ == "__main__":
    import uvicorn
    print("🚀 Lancement de l'API...")
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
