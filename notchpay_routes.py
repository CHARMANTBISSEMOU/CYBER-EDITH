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

from database import get_db, Transaction
from notchpay_config import (
    NOTCHPAY_PRIVATE_KEY, 
    NOTCHPAY_HASH_KEY, 
    NOTCHPAY_BASE_URL, 
    NOTCHPAY_WEBHOOK_URL
)

router = APIRouter(prefix="/notchpay", tags=["NotchPay"])


# ============================================
# MODÈLE DE DONNÉES
# ============================================
class NotchPayPaiementRequest(BaseModel):
    montant: int          # Montant en FCFA
    email: str          # Email du client
    telephone: str       # Numéro de téléphone
    description: str     # Description du paiement
    type_transaction: str # publication, guide, commission, abonnement
    id_bien: str = "bien_test"
    id_utilisateur: str = "user_test"
    currency: str = "XAF"  # Devise par défaut


# ============================================
# ROUTE : Initier un paiement NotchPay
# ============================================
@router.post("/initier")
async def initier_paiement(
    paiement: NotchPayPaiementRequest,
    db: Session = Depends(get_db)
):
    """
    Initier un paiement avec NotchPay
    
    NotchPay supporte :
    - Mobile Money (MTN, Orange, etc.)
    - Cartes bancaires
    - Autres moyens de paiement
    """
    try:
        print(f"💰 Initiation paiement NotchPay: {paiement.montant} FCFA")
        
        # Générer référence unique
        reference = str(uuid.uuid4())[:16]
        
        # Préparer les données pour NotchPay
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
                "payment_url": notchpay_result.get("payment_url"),  # URL pour rediriger le client
                "reference": reference
            }
        }
        
    except Exception as e:
        print(f"❌ Erreur: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# ROUTE : Vérifier statut paiement
# ============================================
@router.get("/verifier/{reference}")
async def verifier_paiement(reference: str):
    """
    Vérifier le statut d'un paiement avec la référence NotchPay
    """
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


# ============================================
# ROUTE : Webhook NotchPay
# ============================================
@router.post("/webhook")
async def notchpay_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Webhook NotchPay pour recevoir les notifications de paiement
    """
    try:
        # 1. Récupérer le corps de la requête
        body = await request.body()
        body_str = body.decode('utf-8')
        
        # 2. Récupérer la signature NotchPay
        signature = request.headers.get("X-NotchPay-Signature")
        if not signature:
            print("❌ Signature manquante")
            raise HTTPException(status_code=400, detail="Signature manquante")
        
        # 3. Vérifier la signature
        expected_signature = hmac.new(
            NOTCHPAY_HASH_KEY.encode('utf-8'),
            body_str.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        if not hmac.compare_digest(signature, expected_signature):
            print("❌ Signature invalide")
            raise HTTPException(status_code=401, detail="Signature invalide")
        
        # 4. Parser les données
        data = json.loads(body_str)
        print(f"📥 Webhook NotchPay reçu: {data}")
        
        # 5. Extraire les informations
        reference = data.get("reference")
        status = data.get("status")
        montant = data.get("amount")
        email = data.get("email")
        telephone = data.get("phone")
        
        print(f"   Reference: {reference}")
        print(f"   Status: {status}")
        print(f"   Montant: {montant}")
        print(f"   Email: {email}")
        print(f"   Téléphone: {telephone}")
        
        # 6. Mettre à jour la transaction en BDD
        transaction = db.query(Transaction).filter(
            Transaction.reference_notchpay == reference
        ).first()
        
        if not transaction:
            print(f"❌ Transaction non trouvée: {reference}")
            return {"success": False, "message": "Transaction non trouvée"}
        
        # 7. Mettre à jour le statut
        if status == "successful":
            transaction.statut = "succès"
            print("✅ Paiement réussi !")
            
            # TODO: Ajouter la logique métier ici
            # - Activer le bien
            # - Créer le contrat
            # - Envoyer une confirmation
            
        elif status == "failed":
            transaction.statut = "échoué"
            print("❌ Paiement échoué !")
            
        elif status == "cancelled":
            transaction.statut = "annulé"
            print("🚫 Paiement annulé !")
        
        db.commit()
        print(f"✅ Transaction mise à jour en BDD !")
        
        # 8. Retourner 200 OK à NotchPay
        return {
            "success": True,
            "message": "Webhook traité avec succès"
        }
        
    except Exception as e:
        print(f"❌ Erreur webhook: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# ROUTE : Historique des paiements utilisateur
# ============================================
@router.get("/utilisateur/{id_utilisateur}")
async def get_paiements_utilisateur(id_utilisateur: str, db: Session = Depends(get_db)):
    """
    Récupérer l'historique des paiements d'un utilisateur
    """
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
                    "date_transaction": t.date_transaction.isoformat()
                }
                for t in transactions
            ]
        }
        
    except Exception as e:
        print(f"❌ Erreur: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# ROUTE : Paiements par bien
# ============================================
@router.get("/bien/{id_bien}")
async def get_paiements_bien(id_bien: str, db: Session = Depends(get_db)):
    """
    Récupérer tous les paiements liés à un bien
    """
    try:
        transactions = db.query(Transaction).filter(
            Transaction.id_bien == id_bien
        ).order_by(Transaction.date_transaction.desc()).all()
        
        return {
            "success": True,
            "count": len(transactions),
            "data": [
                {
                    "id_transaction": t.id_transaction,
                    "id_utilisateur": t.id_utilisateur,
                    "reference_notchpay": t.reference_notchpay,
                    "montant": t.montant,
                    "type_transaction": t.type_transaction,
                    "statut": t.statut,
                    "description": t.description,
                    "date_transaction": t.date_transaction.isoformat()
                }
                for t in transactions
            ]
        }
        
    except Exception as e:
        print(f"❌ Erreur: {e}")
        raise HTTPException(status_code=500, detail=str(e))
