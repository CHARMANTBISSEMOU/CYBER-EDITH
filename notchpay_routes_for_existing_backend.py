from fastapi import APIRouter, HTTPException, Depends, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
import requests
import uuid
import hashlib
import hmac
import json
import sys
sys.path.append('..')

# Configuration NotchPay (à copier dans votre backend)
NOTCHPAY_PRIVATE_KEY = "sk.tnkTfRl9X3C8n1tfoijmxNtOJPBDG22fxcaC245RvLF3Q6mmx0rm2Isf9V2jutMPeedb6i3KhReufzczxOaUAbUgBAfImxgvsMbmhByzaf7ihvsIvxzD2ImpAe50x"
NOTCHPAY_HASH_KEY = "hsk.ZZ32NZ8lRn5coP8Gz6d8skCBAv2Jwf4sXMMQe1Q7D9076TTA8MpVT3KHxPdoC2U5K4W6nJTpPuVSN4sI4Aw4JFcG8HOgQ0IUUD8mDZUS4Y1V3ZVM24Jq97CL47lbG"
NOTCHPAY_BASE_URL = "https://api.notchpay.co"
NOTCHPAY_WEBHOOK_URL = "https://votre-backend.com/webhooks/notchpay"

router = APIRouter(prefix="/notchpay", tags=["NotchPay"])

# Importez votre modèle Transaction existant
try:
    from database import get_db, Transaction
except ImportError:
    # Si le modèle n'existe pas, utilisez celui-ci
    from sqlalchemy import Column, String, Integer, DateTime
    from sqlalchemy.ext.declarative import declarative_base
    Base = declarative_base()
    
    class Transaction(Base):
        __tablename__ = "transaction"
        id_transaction = Column(String(255), primary_key=True)
        id_utilisateur = Column(String(255), nullable=False)
        id_bien = Column(String(255), nullable=False)
        montant = Column(Integer, nullable=False)
        type_transaction = Column(String(50), nullable=False)
        reference_notchpay = Column(String(100), nullable=False)
        statut = Column(String(20), default="en_attente")
        description = Column(String(500))
        email_client = Column(String(255), nullable=True)
        telephone_client = Column(String(20), nullable=True)

class NotchPayPaiementRequest(BaseModel):
    montant: int
    email: str
    telephone: str
    description: str
    type_transaction: str
    id_bien: str = "bien_test"
    id_utilisateur: str = "user_test"
    currency: str = "XAF"

@router.post("/initier")
async def initier_paiement(
    paiement: NotchPayPaiementRequest,
    db: Session = Depends(get_db)
):
    """Initier un paiement avec NotchPay"""
    try:
        print(f"💰 Initiation paiement NotchPay: {paiement.montant} FCFA")
        
        reference = str(uuid.uuid4())[:16]
        
        headers = {
            "Authorization": f"Bearer {NOTCHPAY_PRIVATE_KEY}",
            "Content-Type": "application/json"
        }
        
        data = {
            "amount": paiement.montant,
            "currency": paiement.currency,
            "email": paiement.email,
            "phone": paiement.telephone,
            "description": paiement.description,
            "reference": reference,
            "callback_url": NOTCHPAY_WEBHOOK_URL,
            "return_url": "https://votre-app.com/paiement/succes",
            "cancel_url": "https://votre-app.com/paiement/annule"
        }
        
        print(f"📤 Envoi vers NotchPay...")
        response = requests.post(
            f"{NOTCHPAY_BASE_URL}/payment",
            headers=headers,
            json=data
        )
        
        if response.status_code != 200:
            print(f"❌ Erreur NotchPay: {response.status_code} - {response.text}")
            raise HTTPException(status_code=500, detail="Erreur lors de l'initialisation du paiement")
        
        notchpay_result = response.json()
        print(f"📥 Réponse NotchPay: {notchpay_result}")
        
        # Sauvegarder en BDD
        print("💾 Sauvegarde en BDD...")
        new_transaction = Transaction(
            id_transaction=str(uuid.uuid4()),
            id_utilisateur=paiement.id_utilisateur,
            id_bien=paiement.id_bien,
            montant=paiement.montant,
            type_transaction=paiement.type_transaction,
            reference_notchpay=notchpay_result.get("reference", reference),
            statut="en_attente",
            description=paiement.description,
            email_client=paiement.email,
            telephone_client=paiement.telephone
        )
        db.add(new_transaction)
        db.commit()
        db.refresh(new_transaction)
        
        print(f"✅ Transaction sauvegardée !\n")
        
        return {
            "success": True,
            "message": "Paiement initié avec succès",
            "data": {
                "id_transaction": new_transaction.id_transaction,
                "reference_notchpay": new_transaction.reference_notchpay,
                "statut": "en_attente",
                "montant": paiement.montant,
                "payment_url": notchpay_result.get("payment_url"),
                "reference": reference
            }
        }
        
    except Exception as e:
        print(f"❌ Erreur: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/verifier/{reference}")
async def verifier_paiement(reference: str):
    """Vérifier le statut d'un paiement"""
    try:
        headers = {
            "Authorization": f"Bearer {NOTCHPAY_PRIVATE_KEY}",
        }
        
        print(f"🔍 Vérification: {reference}")
        response = requests.get(
            f"{NOTCHPAY_BASE_URL}/payment/{reference}",
            headers=headers
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=404, detail="Paiement non trouvé")
        
        result = response.json()
        print(f"📥 Statut: {result}")
        
        return {
            "success": True,
            "data": result
        }
        
    except Exception as e:
        print(f"❌ Erreur: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/utilisateur/{id_utilisateur}")
async def get_paiements_utilisateur(id_utilisateur: str, db: Session = Depends(get_db)):
    """Récupérer l'historique des paiements d'un utilisateur"""
    try:
        transactions = db.query(Transaction).filter(
            Transaction.id_utilisateur == id_utilisateur
        ).order_by(Transaction.date_transaction.desc()).all()
        
        return {
            "success": True,
            "count": len(transactions),
            "data": [
                {
                    "id_transaction": t.id_transaction,
                    "reference_notchpay": t.reference_notchpay,
                    "montant": t.montant,
                    "type_transaction": t.type_transaction,
                    "statut": t.statut,
                    "description": t.description,
                    "date_transaction": t.date_transaction.isoformat() if t.date_transaction else None
                }
                for t in transactions
            ]
        }
        
    except Exception as e:
        print(f"❌ Erreur: {e}")
        raise HTTPException(status_code=500, detail=str(e))
