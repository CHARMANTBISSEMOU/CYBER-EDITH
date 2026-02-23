from sqlalchemy import create_engine, Column, String, DateTime, Integer, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import uuid

# URL de connexion Clever Cloud
DATABASE_URL = "mysql+pymysql://ubqfrg1jt1rcrrbd:lwsrLlQHZ2N4GBZrRyp4@ba6oqh14fw458rq0atuj-mysql.services.clever-cloud.com:3306/ba6oqh14fw458rq0atuj"

# Créer l'engine
engine = create_engine(DATABASE_URL, echo=True)

# Session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base pour les modèles
Base = declarative_base()

# ============================================
# MODÈLE IMAGE
# ============================================
class Image(Base):
    __tablename__ = "image"
    
    id_image = Column(String(255), primary_key=True, default=lambda: str(uuid.uuid4()))
    id_bien = Column(String(255), nullable=False)
    url_cloudinary = Column(String(500), nullable=False)
    date_upload = Column(DateTime, default=datetime.now)

# ============================================
# MODÈLE TRANSACTION (MIS À JOUR POUR NOTCHPAY)
# ============================================
class Transaction(Base):
    __tablename__ = "transaction"
    
    id_transaction = Column(String(255), primary_key=True, default=lambda: str(uuid.uuid4()))
    id_utilisateur = Column(String(255), nullable=False)
    id_bien = Column(String(255), nullable=False)
    montant = Column(Integer, nullable=False)
    type_transaction = Column(String(50), nullable=False)  # publication, guide, commission, abonnement
    
    # Champs pour NotchPay
    reference_notchpay = Column(String(100), nullable=False)
    email_client = Column(String(255), nullable=True)
    telephone_client = Column(String(20), nullable=True)
    
    # Anciens champs (gardés pour compatibilité)
    reference_campay = Column(String(100), nullable=True)
    
    statut = Column(String(20), default="en_attente")  # en_attente, succès, échoué, annulé
    description = Column(String(500))
    date_transaction = Column(DateTime, default=datetime.now)
    
    # Nouveaux champs pour une meilleure gestion
    methode_paiement = Column(String(50), nullable=True)  # mobile_money, carte, etc.
    devise = Column(String(10), default="XAF")
    frais_transaction = Column(Integer, default=0)  # Frais de transaction
    
    # Champs pour les abonnements
    date_debut_abonnement = Column(DateTime, nullable=True)
    date_fin_abonnement = Column(DateTime, nullable=True)
    est_recurrent = Column(String(10), default="non")  # oui/non

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
    Base.metadata.create_all(bind=engine)
    print("✅ Tables créées avec succès !")

if __name__ == "__main__":
    create_tables()
