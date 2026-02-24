from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# URL de connexion Clever Cloud
DATABASE_URL = "mysql+pymysql://ubqfrg1jt1rcrrbd:lwsrLlQHZ2N4GBZrRyp4@ba6oqh14fw458rq0atuj-mysql.services.clever-cloud.com:3306/ba6oqh14fw458rq0atuj"

# Créer l'engine
engine = create_engine(DATABASE_URL, echo=True)

# Session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base pour les modèles
Base = declarative_base()

# ============================================
# FONCTION : Obtenir une session BDD
# ============================================
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ============================================
# FONCTION : Créer les tables (si elles n'existent pas)
# ============================================
def create_tables():
    # Important: importer les modèles pour qu'ils soient enregistrés sur Base.metadata
    import models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    print("✅ Tables créées avec succès !")

if __name__ == "__main__":
    create_tables()
