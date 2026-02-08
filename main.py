"""
main.py — Le point d'entrée de l'application

C'est le fichier qui démarre tout.
Commande pour lancer : uvicorn main:app --reload

Après le lancement, tu peux tester sur :
- http://localhost:8000/docs  → Interface Swagger (tester les routes visuellement)
- http://localhost:8000/      → Message d'accueil
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Importer les routes
from routes.utilisateurs import routeur as routeur_utilisateurs
from routes.biens import routeur as routeur_biens
from routes.medias import routeur as routeur_medias
from routes.messages import routeur as routeur_messages
from routes.contrats import routeur as routeur_contrats
from routes.geolocalisation import routeur as routeur_geo
from routes.paiements import routeur as routeur_paiements
from routes.notifications import routeur as routeur_notifications
# Créer l'application FastAPI
app = FastAPI(
    title="App Immobilière API",
    description="API backend pour l'application immobilière camerounaise",
    version="1.0.0"
)

# --- Configuration CORS ---
# Permet au frontend (qui tourne sur un autre port) de communiquer avec le backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En production, mettre les vrais domaines
    allow_credentials=True,
    allow_methods=["*"],   # GET, POST, PUT, DELETE, etc.
    allow_headers=["*"],   # Tous les headers (dont Authorization pour le JWT)
)

# --- Enregistrer les routes ---
app.include_router(routeur_utilisateurs)
app.include_router(routeur_biens)
app.include_router(routeur_medias)
app.include_router(routeur_messages)
app.include_router(routeur_contrats)
app.include_router(routeur_geo)
app.include_router(routeur_paiements)
app.include_router(routeur_notifications)



# --- Route d'accueil ---
@app.get("/", tags=["Accueil"])
def accueil():
    """Page d'accueil de l'API — juste pour vérifier que le serveur tourne."""
    return {
        "message": "Bienvenue sur l'API App Immobilière ! 🏠",
        "documentation": "Va sur /docs pour voir toutes les routes disponibles.",
        "version": "1.0.0"
    }
