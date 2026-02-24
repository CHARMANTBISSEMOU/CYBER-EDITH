from fastapi import APIRouter, HTTPException, Depends, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import requests
import uuid
import hashlib
import hmac
import json
import os
import smtplib
from io import BytesIO
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
import sys
sys.path.append('..')

from database import get_db
from models import Transaction, Bien, Utilisateur
from auth import obtenir_utilisateur_actuel
from notchpay_config import (
    NOTCHPAY_PUBLIC_KEY,
    NOTCHPAY_PRIVATE_KEY, 
    NOTCHPAY_HASH_KEY, 
    NOTCHPAY_BASE_URL, 
    NOTCHPAY_WEBHOOK_URL
)

router = APIRouter(prefix="/notchpay", tags=["NotchPay"])


EMAIL_CONFIG = {
    "SMTP_SERVER": os.getenv("SMTP_SERVER", "smtp.gmail.com"),
    "SMTP_PORT": int(os.getenv("SMTP_PORT", "587")),
    "EMAIL_USER": os.getenv("EMAIL_USER", ""),
    "EMAIL_PASSWORD": os.getenv("EMAIL_PASSWORD", ""),
    "FROM_EMAIL": os.getenv("FROM_EMAIL", "noreply@appimobilier.com"),
}


def _generate_invoice_pdf_bytes(
    reference: str,
    montant: int,
    email: str,
    nom_client: str,
    description: str,
    id_transaction: str,
):
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    c.setFont("Helvetica-Bold", 18)
    c.drawString(40, height - 60, "FACTURE DE PAIEMENT")

    c.setFont("Helvetica", 11)
    y = height - 110
    lines = [
        f"Référence NotchPay: {reference}",
        f"Transaction ID: {id_transaction}",
        f"Montant: {montant} FCFA",
        f"Client: {nom_client}",
        f"Email: {email}",
        f"Description: {description}",
    ]
    for line in lines:
        c.drawString(40, y, line)
        y -= 18

    c.setFont("Helvetica", 10)
    c.drawString(40, 60, "Merci pour votre paiement.")
    c.showPage()
    c.save()

    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes


def _send_invoice_email(to_email: str, pdf_bytes: bytes, filename: str, subject: str, body: str):
    try:
        if not EMAIL_CONFIG["EMAIL_USER"] or not EMAIL_CONFIG["EMAIL_PASSWORD"]:
            print(f"📧 MODE TEST - Facture simulée vers {to_email} (pas de SMTP configuré)")
            return True

        msg = MIMEMultipart()
        msg["From"] = EMAIL_CONFIG["FROM_EMAIL"]
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))

        attachment = MIMEApplication(pdf_bytes, _subtype="pdf")
        attachment.add_header("Content-Disposition", "attachment", filename=filename)
        msg.attach(attachment)

        server = smtplib.SMTP(EMAIL_CONFIG["SMTP_SERVER"], EMAIL_CONFIG["SMTP_PORT"])
        server.starttls()
        server.login(EMAIL_CONFIG["EMAIL_USER"], EMAIL_CONFIG["EMAIL_PASSWORD"])
        server.send_message(msg)
        server.quit()
        return True
    except Exception as e:
        print(f"Erreur envoi facture email: {e}")
        if not EMAIL_CONFIG["EMAIL_USER"] or not EMAIL_CONFIG["EMAIL_PASSWORD"]:
            print(f"📧 MODE TEST - Simulation réussie pour {to_email}")
            return True
        return False


# ============================================
# MODÈLE DE DONNÉES
# ============================================
class NotchPayPaiementRequest(BaseModel):
    montant: int          # Montant en FCFA
    email: str          # Email du client
    telephone: str       # Numéro de téléphone
    description: str     # Description du paiement
    type_transaction: str # publication, guide, commission, abonnement
    id_bien: Optional[str] = None
    currency: str = "XAF"  # Devise par défaut

    class Config:
        extra = "ignore"


# ============================================
# ROUTE : Initier un paiement NotchPay
# ============================================
@router.post("/initier")
async def initier_paiement(
    paiement: NotchPayPaiementRequest,
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel),
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

        if not NOTCHPAY_PUBLIC_KEY:
            raise HTTPException(status_code=500, detail="NOTCHPAY_PUBLIC_KEY manquante")
        
        # Générer référence unique
        reference = str(uuid.uuid4())[:16]
        
        # Préparer les données pour NotchPay
        headers = {
            "Authorization": NOTCHPAY_PUBLIC_KEY,
            "Content-Type": "application/json"
        }
        
        data = {
            "amount": paiement.montant,
            "currency": paiement.currency,
            "customer": {
                "email": paiement.email,
                "phone": paiement.telephone,
            },
            "description": paiement.description,
            "reference": reference,
        }

        if NOTCHPAY_WEBHOOK_URL:
            data["callback"] = NOTCHPAY_WEBHOOK_URL
        
        print(f"📤 Envoi vers NotchPay...")
        response = requests.post(
            f"{NOTCHPAY_BASE_URL}/payments",
            headers=headers,
            json=data,
            timeout=30,
        )
        
        if response.status_code not in (200, 201):
            print(f"❌ Erreur NotchPay: {response.status_code} - {response.text}")
            raise HTTPException(
                status_code=502,
                detail=f"NotchPay error: HTTP {response.status_code} - {response.text}"
            )
        
        notchpay_result = response.json()
        print(f"📥 Réponse NotchPay: {notchpay_result}")
        
        # Sauvegarder en BDD
        print("💾 Sauvegarde en BDD...")

        type_transaction = paiement.type_transaction
        types_supportes = {
            "publication",
            "guide",
            "commission",
            "penalite",
        }
        if type_transaction not in types_supportes:
            type_transaction = "publication"

        id_bien = paiement.id_bien
        if id_bien:
            bien = db.query(Bien).filter(Bien.id_bien == id_bien).first()
            if not bien:
                id_bien = None

        new_transaction = Transaction(
            id_transaction=str(uuid.uuid4()),
            id_utilisateur=utilisateur_actuel.id_utilisateur,
            id_bien=id_bien,
            montant=paiement.montant,
            type_transaction=type_transaction,
            reference_campay=notchpay_result.get("reference", reference),
            statut="en_attente",
            description=paiement.description
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
                "reference_notchpay": new_transaction.reference_campay,
                "statut": "en_attente",
                "montant": paiement.montant,
                "authorization_url": notchpay_result.get("authorization_url"),
                "reference": reference
            }
        }
        
    except Exception as e:
        print(f"❌ Erreur: {e}")
        db.rollback()
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=f"Erreur interne init paiement: {str(e)}")


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
            "Authorization": NOTCHPAY_PUBLIC_KEY,
        }
        
        print(f"🔍 Vérification: {reference}")
        response = requests.get(
            f"{NOTCHPAY_BASE_URL}/payments/{reference}",
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
            Transaction.reference_campay == reference
        ).first()
        
        if not transaction:
            print(f"❌ Transaction non trouvée: {reference}")
            return {"success": False, "message": "Transaction non trouvée"}
        
        # 7. Mettre à jour le statut
        if status == "successful":
            transaction.statut = "reussi"
            print("✅ Paiement réussi !")

            try:
                utilisateur = db.query(Utilisateur).filter(
                    Utilisateur.id_utilisateur == transaction.id_utilisateur
                ).first()

                to_email = (utilisateur.email if utilisateur and getattr(utilisateur, "email", None) else None) or email
                nom_client = (
                    f"{utilisateur.prenom} {utilisateur.nom}".strip()
                    if utilisateur and getattr(utilisateur, "prenom", None) and getattr(utilisateur, "nom", None)
                    else "Client"
                )

                if to_email:
                    pdf_bytes = _generate_invoice_pdf_bytes(
                        reference=reference,
                        montant=int(montant) if montant is not None else int(transaction.montant),
                        email=to_email,
                        nom_client=nom_client,
                        description=transaction.description or "Paiement",
                        id_transaction=transaction.id_transaction,
                    )
                    filename = f"facture_{reference}.pdf"
                    subject = "Votre facture de paiement"
                    body = (
                        "Bonjour,\n\n"
                        "Veuillez trouver en pièce jointe votre facture de paiement.\n\n"
                        "Cordialement,\n"
                        "App Immobilier"
                    )
                    _send_invoice_email(to_email, pdf_bytes, filename, subject, body)
            except Exception as e:
                print(f"Erreur génération/envoi facture: {e}")
            
            # TODO: Ajouter la logique métier ici
            # - Activer le bien
            # - Créer le contrat
            # - Envoyer une confirmation
            
        elif status == "failed":
            transaction.statut = "echoue"
            print("❌ Paiement échoué !")
            
        elif status == "cancelled":
            transaction.statut = "annule"
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
                    "reference_notchpay": t.reference_campay,
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
                    "reference_notchpay": t.reference_campay,
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
