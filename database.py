"""
database.py — Connexion à la base de données MySQL (Clever Cloud)

Comment ça marche (en simple) :
1. On lit l'URL de connexion depuis le fichier .env
2. On crée un "moteur" SQLAlchemy qui sait parler à MySQL
3. On crée une "usine à sessions" — chaque requête HTTP aura sa propre session
4. La fonction get_db() donne une session à chaque route et la ferme après
"""

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import os

# Charger les variables d'environnement depuis .env
load_dotenv()

# Récupérer l'URL de connexion
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL manquante dans le fichier .env")

# Créer le moteur SQLAlchemy
# pool_recycle=3600 : reconnecter toutes les heures (Clever Cloud coupe les connexions inactives)
# echo=False : ne pas afficher toutes les requêtes SQL dans le terminal (mettre True pour debug)
engine = create_engine(
    DATABASE_URL,
    pool_recycle=3600,
    pool_pre_ping=True,
    echo=False
)

# Usine à sessions — chaque requête HTTP aura sa propre session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base déclarative — tous les modèles héritent de ça
Base = declarative_base()


def get_db():
    """
    Générateur de session pour FastAPI.
    
    Utilisation dans les routes :
        @app.get("/users")
        def get_users(db: Session = Depends(get_db)):
            ...
    
    La session est automatiquement fermée après chaque requête.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
