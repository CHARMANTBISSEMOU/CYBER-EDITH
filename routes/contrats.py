"""
routes/contrats.py — Gestion des contrats de location

Routes disponibles :
- POST   /contrats/initier                    → Créer un brouillon (Claude génère le 1er jet)
- POST   /contrats/{id}/personnaliser         → Discuter avec Claude pour modifier le brouillon
- POST   /contrats/{id}/valider               → Générer le PDF final → statut "en_attente"
- GET    /contrats/mes-contrats               → Tous mes contrats (propriétaire ou locataire)
- GET    /contrats/{id}                       → Détail d'un contrat
- PUT    /contrats/{id}/accepter              → Le locataire accepte le contrat
- PUT    /contrats/{id}/refuser               → Le locataire refuse le contrat
- PUT    /contrats/{id}/resilier              → Résilier un contrat actif
- GET    /contrats/{id}/pdf                   → Lien vers le PDF

Parcours :
1. Propriétaire initie → Claude rédige un brouillon
2. Propriétaire personnalise (illimité) → Claude modifie
3. Propriétaire valide → PDF généré + uploadé Cloudinary
4. Locataire accepte ou refuse
5. Badge certifié après 3 contrats
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from io import BytesIO
from datetime import datetime, timezone
import cloudinary
import cloudinary.uploader
import anthropic
import uuid
import os

from database import get_db
from models import Utilisateur, Bien, ContratLoyer
from auth import obtenir_utilisateur_actuel
from routes.notifications import notifier_contrat

# Charger les variables d'environnement
load_dotenv()

# --- Configuration ---
CLE_ANTHROPIC = os.getenv("ANTHROPIC_API_KEY")

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET")
)

# Créer le routeur
routeur = APIRouter(prefix="/contrats", tags=["Contrats de Location"])


# ============================================
# GÉNÉRATION DU CONTENU PAR CLAUDE API
# ============================================

def generer_brouillon_contrat(
    proprietaire: Utilisateur,
    locataire: Utilisateur,
    bien: Bien,
    loyer_mensuel: int,
    date_debut: str,
    date_fin: str
) -> str:
    """
    Demande à Claude de rédiger un contrat de bail
    adapté au droit camerounais.
    
    Retourne le texte du contrat.
    """
    if not CLE_ANTHROPIC:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Clé API Anthropic non configurée. Impossible de générer le contrat."
        )
    
    try:
        client = anthropic.Anthropic(api_key=CLE_ANTHROPIC)
        
        prompt = f"""Rédige un contrat de bail d'habitation complet en français, adapté au droit camerounais.

INFORMATIONS DU CONTRAT :

PROPRIÉTAIRE (BAILLEUR) :
- Nom complet : {proprietaire.prenom} {proprietaire.nom}
- Téléphone : {proprietaire.telephone}
- Email : {proprietaire.email}

LOCATAIRE (PRENEUR) :
- Nom complet : {locataire.prenom} {locataire.nom}
- Téléphone : {locataire.telephone}
- Email : {locataire.email}

BIEN IMMOBILIER :
- Type : {bien.type_bien}
- Titre : {bien.titre}
- Adresse : {bien.quartier}, {bien.ville}, Cameroun
{f"- Adresse complète : {bien.adresse_complete}" if bien.adresse_complete else ""}
{f"- Superficie : {bien.superficie} m²" if bien.superficie else ""}
{f"- Nombre de pièces : {bien.nombre_pieces}" if bien.nombre_pieces else ""}
{f"- Nombre de chambres : {bien.nombre_chambres}" if bien.nombre_chambres else ""}
- Meublé : {"Oui" if bien.meuble else "Non"}

CONDITIONS :
- Loyer mensuel : {loyer_mensuel:,} FCFA
- Date de début : {date_debut}
- Date de fin : {date_fin}

CONSIGNES DE RÉDACTION :
1. Utilise un langage juridique clair et professionnel
2. Respecte le droit camerounais sur les baux d'habitation
3. Inclus les articles suivants au minimum :
   - Objet du contrat
   - Durée du bail
   - Montant du loyer et modalités de paiement
   - Caution / dépôt de garantie
   - Obligations du bailleur
   - Obligations du locataire
   - État des lieux
   - Entretien et réparations
   - Conditions de résiliation
   - Clause de révision du loyer
   - Litiges et juridiction compétente
4. Ajoute les espaces pour les signatures à la fin
5. Ne mets PAS de numéro de référence (il sera ajouté automatiquement)
6. Rédige UNIQUEMENT le contenu du contrat, pas de commentaires ou explications

Rédige le contrat complet maintenant."""

        reponse = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4000,
            messages=[{"role": "user", "content": prompt}]
        )
        
        return reponse.content[0].text.strip()
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la génération du contrat par l'IA : {str(e)}"
        )


def personnaliser_contrat_avec_claude(contenu_actuel: str, demande: str) -> str:
    """
    Envoie le contrat actuel et la demande de modification à Claude.
    Claude modifie le contrat et retourne la nouvelle version complète.
    """
    if not CLE_ANTHROPIC:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Clé API Anthropic non configurée."
        )
    
    try:
        client = anthropic.Anthropic(api_key=CLE_ANTHROPIC)
        
        prompt = f"""Voici un contrat de bail existant. L'utilisateur veut le modifier.

CONTRAT ACTUEL :
{contenu_actuel}

DEMANDE DE MODIFICATION :
{demande}

CONSIGNES :
1. Applique la modification demandée au contrat
2. Garde TOUT le reste du contrat intact
3. Si la demande n'est pas claire, interprète-la au mieux dans un contexte juridique camerounais
4. Retourne le contrat COMPLET modifié (pas seulement la partie modifiée)
5. Ne mets AUCUN commentaire ou explication, UNIQUEMENT le contrat modifié

Retourne le contrat modifié maintenant."""

        reponse = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4000,
            messages=[{"role": "user", "content": prompt}]
        )
        
        return reponse.content[0].text.strip()
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la personnalisation : {str(e)}"
        )


# ============================================
# GÉNÉRATION DU PDF (ReportLab)
# ============================================

def generer_pdf_contrat(
    id_contrat: str,
    contenu_contrat: str,
    proprietaire: Utilisateur,
    locataire: Utilisateur,
    bien: Bien,
    loyer_mensuel: int,
    date_debut: str,
    date_fin: str
) -> bytes:
    """
    Génère un PDF professionnel du contrat avec ReportLab.
    Retourne les bytes du PDF.
    """
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm
    )
    
    # --- Styles ---
    styles = getSampleStyleSheet()
    
    style_titre = ParagraphStyle(
        "TitreContrat",
        parent=styles["Heading1"],
        fontSize=18,
        alignment=TA_CENTER,
        spaceAfter=20,
        textColor=colors.HexColor("#1a1a2e"),
        fontName="Helvetica-Bold"
    )
    
    style_sous_titre = ParagraphStyle(
        "SousTitre",
        parent=styles["Heading2"],
        fontSize=12,
        alignment=TA_CENTER,
        spaceAfter=15,
        textColor=colors.HexColor("#16213e")
    )
    
    style_reference = ParagraphStyle(
        "Reference",
        parent=styles["Normal"],
        fontSize=10,
        alignment=TA_CENTER,
        spaceAfter=10,
        textColor=colors.grey
    )
    
    style_section = ParagraphStyle(
        "Section",
        parent=styles["Heading3"],
        fontSize=12,
        spaceAfter=8,
        spaceBefore=15,
        textColor=colors.HexColor("#1a1a2e"),
        fontName="Helvetica-Bold"
    )
    
    style_corps = ParagraphStyle(
        "CorpsTexte",
        parent=styles["Normal"],
        fontSize=10,
        alignment=TA_JUSTIFY,
        spaceAfter=6,
        leading=14
    )
    
    style_info = ParagraphStyle(
        "Info",
        parent=styles["Normal"],
        fontSize=10,
        spaceAfter=4,
        leftIndent=20
    )
    
    style_signature = ParagraphStyle(
        "Signature",
        parent=styles["Normal"],
        fontSize=10,
        spaceBefore=40,
        spaceAfter=5
    )
    
    # --- Contenu du PDF ---
    elements = []
    
    # Titre
    elements.append(Paragraph("CONTRAT DE BAIL D'HABITATION", style_titre))
    elements.append(Paragraph("République du Cameroun", style_sous_titre))
    
    # Référence et date
    date_creation = datetime.now(timezone.utc).strftime("%d/%m/%Y")
    elements.append(Paragraph(f"Référence : {id_contrat}", style_reference))
    elements.append(Paragraph(f"Date de création : {date_creation}", style_reference))
    
    # Ligne de séparation
    elements.append(Spacer(1, 10))
    
    # Tableau récapitulatif
    donnees_recap = [
        ["BAILLEUR", f"{proprietaire.prenom} {proprietaire.nom}"],
        ["Téléphone", proprietaire.telephone or "Non renseigné"],
        ["", ""],
        ["LOCATAIRE", f"{locataire.prenom} {locataire.nom}"],
        ["Téléphone", locataire.telephone or "Non renseigné"],
        ["", ""],
        ["BIEN", bien.titre],
        ["Adresse", f"{bien.quartier}, {bien.ville}"],
        ["Type", bien.type_bien],
        ["", ""],
        ["LOYER", f"{loyer_mensuel:,} FCFA / mois"],
        ["DURÉE", f"Du {date_debut} au {date_fin}"],
    ]
    
    tableau = Table(donnees_recap, colWidths=[4 * cm, 12 * cm])
    tableau.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#1a1a2e")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("LINEBELOW", (0, -1), (-1, -1), 1, colors.HexColor("#1a1a2e")),
        ("LINEABOVE", (0, 0), (-1, 0), 1, colors.HexColor("#1a1a2e")),
    ]))
    
    elements.append(tableau)
    elements.append(Spacer(1, 20))
    
    # Contenu du contrat (généré par Claude)
    # On découpe par lignes pour le formater proprement
    lignes = contenu_contrat.split("\n")
    
    for ligne in lignes:
        ligne = ligne.strip()
        if not ligne:
            elements.append(Spacer(1, 6))
            continue
        
        # Détecter les titres d'articles (commencent par "ARTICLE" ou "Article" ou sont en majuscules)
        if ligne.upper().startswith("ARTICLE") or (ligne.isupper() and len(ligne) > 5):
            elements.append(Paragraph(ligne, style_section))
        elif ligne.startswith("**") and ligne.endswith("**"):
            # Texte en gras (markdown)
            elements.append(Paragraph(ligne.replace("**", ""), style_section))
        else:
            # Remplacer les caractères spéciaux pour ReportLab
            ligne_safe = ligne.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            elements.append(Paragraph(ligne_safe, style_corps))
    
    # Zone de signatures
    elements.append(Spacer(1, 40))
    elements.append(Paragraph("─" * 60, style_corps))
    elements.append(Spacer(1, 10))
    
    signatures = [
        [f"Le Bailleur\n{proprietaire.prenom} {proprietaire.nom}", 
         "", 
         f"Le Locataire\n{locataire.prenom} {locataire.nom}"],
        ["", "", ""],
        ["Signature : _______________", "", "Signature : _______________"],
        ["", "", ""],
        ["Date : ___/___/______", "", "Date : ___/___/______"],
    ]
    
    tableau_signatures = Table(signatures, colWidths=[6 * cm, 4 * cm, 6 * cm])
    tableau_signatures.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ALIGN", (0, 0), (0, -1), "LEFT"),
        ("ALIGN", (2, 0), (2, -1), "LEFT"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
    ]))
    
    elements.append(tableau_signatures)
    
    # Pied de page
    elements.append(Spacer(1, 30))
    elements.append(Paragraph(
        "Contrat généré par App Immobilière Cameroun — Document à valeur contractuelle",
        ParagraphStyle("Pied", parent=styles["Normal"], fontSize=8, alignment=TA_CENTER, textColor=colors.grey)
    ))
    
    # Générer le PDF
    doc.build(elements)
    buffer.seek(0)
    
    return buffer.getvalue()


def uploader_pdf_cloudinary(pdf_bytes: bytes, id_contrat: str) -> str:
    """Upload le PDF sur Cloudinary et retourne l'URL."""
    try:
        resultat = cloudinary.uploader.upload(
            pdf_bytes,
            folder="app_immobiliere/contrats",
            public_id=id_contrat,
            resource_type="raw"
        )
        return resultat["secure_url"]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de l'upload du PDF : {str(e)}"
        )


# ============================================
# VÉRIFICATION BADGE CERTIFIÉ
# ============================================

def verifier_badge_certifie(id_utilisateur: str, db: Session):
    """
    Vérifie si l'utilisateur a 3+ contrats (actif ou résilié).
    Si oui, lui attribuer le badge certifié.
    """
    nombre_contrats = db.query(ContratLoyer).filter(
        (
            (ContratLoyer.id_proprietaire == id_utilisateur) |
            (ContratLoyer.id_locataire == id_utilisateur)
        ),
        ContratLoyer.statut_contrat.in_(["actif", "resilie"])
    ).count()
    
    if nombre_contrats >= 3:
        utilisateur = db.query(Utilisateur).filter(
            Utilisateur.id_utilisateur == id_utilisateur
        ).first()
        if utilisateur and not utilisateur.badge_certifie:
            utilisateur.badge_certifie = True
            db.commit()


# ============================================
# ROUTE 1 : INITIER UN CONTRAT (brouillon)
# ============================================

@routeur.post("/initier", status_code=status.HTTP_201_CREATED)
def initier_contrat(
    id_locataire: str = Query(..., description="ID du locataire"),
    id_bien: str = Query(..., description="ID du bien"),
    loyer_mensuel: int = Query(..., gt=0, description="Loyer mensuel en FCFA"),
    date_debut: str = Query(..., description="Date de début (JJ/MM/AAAA)"),
    date_fin: str = Query(..., description="Date de fin (JJ/MM/AAAA)"),
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel),
    db: Session = Depends(get_db)
):
    """
    Initier un contrat — Claude génère le premier brouillon.
    Seul le propriétaire du bien peut créer un contrat.
    """
    
    # --- Vérifier que le bien existe ---
    bien = db.query(Bien).filter(Bien.id_bien == id_bien).first()
    if not bien:
        raise HTTPException(status_code=404, detail="Bien introuvable.")
    
    # --- Vérifier que c'est le propriétaire ---
    if bien.id_proprietaire != utilisateur_actuel.id_utilisateur:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seul le propriétaire du bien peut créer un contrat."
        )
    
    # --- Vérifier que le locataire existe ---
    locataire = db.query(Utilisateur).filter(
        Utilisateur.id_utilisateur == id_locataire
    ).first()
    if not locataire:
        raise HTTPException(status_code=404, detail="Locataire introuvable.")
    
    # --- Vérifier qu'on ne se fait pas un contrat à soi-même ---
    if id_locataire == utilisateur_actuel.id_utilisateur:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tu ne peux pas créer un contrat avec toi-même."
        )
    
    # --- Vérifier qu'il n'y a pas déjà un contrat actif pour ce bien ---
    contrat_existant = db.query(ContratLoyer).filter(
        ContratLoyer.id_bien == id_bien,
        ContratLoyer.statut_contrat.in_(["brouillon", "en_attente", "actif"])
    ).first()
    
    if contrat_existant:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Un contrat existe déjà pour ce bien (statut : {contrat_existant.statut_contrat})."
        )
    
    # --- Valider les dates ---
    try:
        date_debut_obj = datetime.strptime(date_debut, "%d/%m/%Y")
        date_fin_obj = datetime.strptime(date_fin, "%d/%m/%Y")
        if date_fin_obj <= date_debut_obj:
            raise ValueError("La date de fin doit être après la date de début.")
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Format de date invalide (utilisez JJ/MM/AAAA). {str(e)}"
        )
    
    # --- Générer le brouillon avec Claude ---
    contenu = generer_brouillon_contrat(
        proprietaire=utilisateur_actuel,
        locataire=locataire,
        bien=bien,
        loyer_mensuel=loyer_mensuel,
        date_debut=date_debut,
        date_fin=date_fin
    )
    
    # --- Sauvegarder en BDD ---
    id_contrat = f"ctr_{uuid.uuid4().hex[:12]}"
    
    
    nouveau_contrat = ContratLoyer(
        id_contrat=id_contrat,
        id_bien=id_bien,
        id_proprietaire=utilisateur_actuel.id_utilisateur,
        id_locataire=id_locataire,
        date_debut=date_debut_obj,
        date_fin=date_fin_obj,
        montant_loyer=loyer_mensuel,
        statut_contrat="brouillon",
        contenu_contrat=contenu
    )
    
    db.add(nouveau_contrat)
    db.commit()
    notifier_contrat(
        db=db,
        id_destinataire=nouveau_contrat.id_locataire,     # Jean
        nom_expediteur=f"{utilisateur_actuel.prenom} {utilisateur_actuel.nom}",
        action="cree",
        titre_bien=bien.titre if bien else None,
        id_contrat=nouveau_contrat.id_contrat
    )
    db.commit()
    db.refresh(nouveau_contrat)
    
    return {
        "message": "Brouillon du contrat généré par l'IA ! Tu peux maintenant le personnaliser.",
        "id_contrat": id_contrat,
        "statut": "brouillon",
        "contenu_contrat": contenu,
        "instructions": "Utilise POST /contrats/{id}/personnaliser pour modifier le contrat. Quand tu es satisfait, utilise POST /contrats/{id}/valider pour générer le PDF."
    }


# ============================================
# ROUTE 2 : PERSONNALISER LE CONTRAT (discuter avec Claude)
# ============================================

@routeur.post("/{id_contrat}/personnaliser")
def personnaliser_contrat(
    id_contrat: str,
    demande: str = Query(..., min_length=5, max_length=1000, description="Ta demande de modification (ex: 'Ajoute une clause animaux interdits')"),
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel),
    db: Session = Depends(get_db)
):
    """
    Personnaliser le contrat en discutant avec Claude.
    Illimité tant que le contrat est en brouillon.
    
    Exemples de demandes :
    - "Ajoute une clause animaux domestiques interdits"
    - "Le loyer doit être payé avant le 5 de chaque mois"
    - "Ajoute une caution de 2 mois de loyer"
    - "Remplace la clause de résiliation par un préavis de 2 mois"
    """
    
    # --- Vérifier que le contrat existe ---
    contrat = db.query(ContratLoyer).filter(
        ContratLoyer.id_contrat == id_contrat
    ).first()
    
    if not contrat:
        raise HTTPException(status_code=404, detail="Contrat introuvable.")
    
    # --- Vérifier que c'est le propriétaire ---
    if contrat.id_proprietaire != utilisateur_actuel.id_utilisateur:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seul le propriétaire peut personnaliser le contrat."
        )
    
    # --- Vérifier que c'est un brouillon ---
    if contrat.statut_contrat != "brouillon":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ce contrat n'est plus un brouillon (statut : {contrat.statut_contrat}). Tu ne peux plus le modifier."
        )
    
    # --- Envoyer à Claude pour modification ---
    nouveau_contenu = personnaliser_contrat_avec_claude(
        contenu_actuel=contrat.contenu_contrat,
        demande=demande
    )
    
    # --- Mettre à jour en BDD ---
    contrat.contenu_contrat = nouveau_contenu
    db.commit()
    
    return {
        "message": "Contrat modifié avec succès !",
        "id_contrat": id_contrat,
        "demande": demande,
        "contenu_contrat": nouveau_contenu,
        "instructions": "Continue à personnaliser ou utilise POST /contrats/{id}/valider quand tu es satisfait."
    }


# ============================================
# ROUTE 3 : VALIDER LE CONTRAT (générer le PDF)
# ============================================

@routeur.post("/{id_contrat}/valider")
def valider_contrat(
    id_contrat: str,
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel),
    db: Session = Depends(get_db)
):
    """
    Valider le contrat — générer le PDF et l'uploader sur Cloudinary.
    Le statut passe de "brouillon" à "en_attente" (le locataire doit accepter).
    """
    
    # --- Vérifier le contrat ---
    contrat = db.query(ContratLoyer).filter(
        ContratLoyer.id_contrat == id_contrat
    ).first()
    
    if not contrat:
        raise HTTPException(status_code=404, detail="Contrat introuvable.")
    
    if contrat.id_proprietaire != utilisateur_actuel.id_utilisateur:
        raise HTTPException(status_code=403, detail="Seul le propriétaire peut valider.")
    
    if contrat.statut_contrat != "brouillon":
        raise HTTPException(
            status_code=400,
            detail=f"Ce contrat ne peut pas être validé (statut : {contrat.statut_contrat})."
        )
    
    # --- Récupérer les infos nécessaires pour le PDF ---
    proprietaire = db.query(Utilisateur).filter(
        Utilisateur.id_utilisateur == contrat.id_proprietaire
    ).first()
    
    locataire = db.query(Utilisateur).filter(
        Utilisateur.id_utilisateur == contrat.id_locataire
    ).first()
    
    bien = db.query(Bien).filter(
        Bien.id_bien == contrat.id_bien
    ).first()
    
    # --- Générer le PDF ---
    pdf_bytes = generer_pdf_contrat(
        id_contrat=id_contrat,
        contenu_contrat=contrat.contenu_contrat,
        proprietaire=proprietaire,
        locataire=locataire,
        bien=bien,
        loyer_mensuel=contrat.montant_loyer,
        date_debut=contrat.date_debut.strftime("%d/%m/%Y"),
        date_fin=contrat.date_fin.strftime("%d/%m/%Y")
    )
    
    # --- Uploader sur Cloudinary ---
    url_pdf = uploader_pdf_cloudinary(pdf_bytes, id_contrat)
    
    # --- Mettre à jour le contrat ---
    contrat.pdf_url = url_pdf
    contrat.statut_contrat = "en_attente"
    db.commit()
    
    return {
        "message": "Contrat validé ! Le PDF a été généré. En attente de l'acceptation du locataire.",
        "id_contrat": id_contrat,
        "statut": "en_attente",
        "pdf_url": url_pdf,
        "locataire": f"{locataire.prenom} {locataire.nom}"
    }


# ============================================
# ROUTE 4 : MES CONTRATS
# ============================================

@routeur.get("/mes-contrats")
def mes_contrats(
    statut: str = Query(None, description="Filtrer par statut : brouillon, en_attente, actif, resilie, expire, refuse"),
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel),
    db: Session = Depends(get_db)
):
    """
    Voir tous mes contrats (en tant que propriétaire ou locataire).
    """
    
    requete = db.query(ContratLoyer).filter(
        (ContratLoyer.id_proprietaire == utilisateur_actuel.id_utilisateur) |
        (ContratLoyer.id_locataire == utilisateur_actuel.id_utilisateur)
    )
    
    if statut:
        requete = requete.filter(ContratLoyer.statut_contrat == statut)
    
    contrats = requete.order_by(ContratLoyer.date_creation.desc()).all()
    
    resultats = []
    for contrat in contrats:
        # Récupérer les noms
        proprietaire = db.query(Utilisateur).filter(
            Utilisateur.id_utilisateur == contrat.id_proprietaire
        ).first()
        locataire = db.query(Utilisateur).filter(
            Utilisateur.id_utilisateur == contrat.id_locataire
        ).first()
        bien = db.query(Bien).filter(
            Bien.id_bien == contrat.id_bien
        ).first()
        
        resultats.append({
            "id_contrat": contrat.id_contrat,
            "bien": bien.titre if bien else "Bien supprimé",
            "proprietaire": f"{proprietaire.prenom} {proprietaire.nom}" if proprietaire else "Inconnu",
            "locataire": f"{locataire.prenom} {locataire.nom}" if locataire else "Inconnu",
            "loyer_mensuel": contrat.montant_loyer,
            "date_debut": str(contrat.date_debut),
            "date_fin": str(contrat.date_fin),
            "statut": contrat.statut_contrat,
            "pdf_url": contrat.pdf_url,
            "je_suis": "proprietaire" if contrat.id_proprietaire == utilisateur_actuel.id_utilisateur else "locataire",
            "date_creation": str(contrat.date_creation)
        })
    
    return {
        "contrats": resultats,
        "total": len(resultats)
    }


# ============================================
# ROUTE 5 : DÉTAIL D'UN CONTRAT
# ============================================

@routeur.get("/{id_contrat}")
def detail_contrat(
    id_contrat: str,
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel),
    db: Session = Depends(get_db)
):
    """
    Voir le détail d'un contrat. Accessible uniquement aux deux parties.
    """
    
    contrat = db.query(ContratLoyer).filter(
        ContratLoyer.id_contrat == id_contrat
    ).first()
    
    if not contrat:
        raise HTTPException(status_code=404, detail="Contrat introuvable.")
    
    # Vérifier que l'utilisateur est concerné
    mon_id = utilisateur_actuel.id_utilisateur
    if contrat.id_proprietaire != mon_id and contrat.id_locataire != mon_id:
        raise HTTPException(status_code=403, detail="Tu n'es pas concerné par ce contrat.")
    
    proprietaire = db.query(Utilisateur).filter(
        Utilisateur.id_utilisateur == contrat.id_proprietaire
    ).first()
    locataire = db.query(Utilisateur).filter(
        Utilisateur.id_utilisateur == contrat.id_locataire
    ).first()
    bien = db.query(Bien).filter(
        Bien.id_bien == contrat.id_bien
    ).first()
    
    return {
        "id_contrat": contrat.id_contrat,
        "statut": contrat.statut_contrat,
        "bien": {
            "id": bien.id_bien if bien else None,
            "titre": bien.titre if bien else "Bien supprimé",
            "adresse": f"{bien.quartier}, {bien.ville}" if bien else None
        },
        "proprietaire": {
            "id": proprietaire.id_utilisateur,
            "nom": f"{proprietaire.prenom} {proprietaire.nom}",
            "telephone": proprietaire.telephone
        } if proprietaire else None,
        "locataire": {
            "id": locataire.id_utilisateur,
            "nom": f"{locataire.prenom} {locataire.nom}",
            "telephone": locataire.telephone
        } if locataire else None,
        "loyer_mensuel": contrat.montant_loyer,
        "date_debut": str(contrat.date_debut),
        "date_fin": str(contrat.date_fin),
        "contenu_contrat": contrat.contenu_contrat if contrat.statut_contrat == "brouillon" else None,
        "pdf_url": contrat.pdf_url,
        "date_creation": str(contrat.date_creation),
        "je_suis": "proprietaire" if contrat.id_proprietaire == mon_id else "locataire"
    }


# ============================================
# ROUTE 6 : ACCEPTER LE CONTRAT (locataire seulement)
# ============================================

@routeur.put("/{id_contrat}/accepter")
def accepter_contrat(
    id_contrat: str,
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel),
    db: Session = Depends(get_db)
):
    """
    Le locataire accepte le contrat.
    Le bien passe automatiquement en statut "loue".
    """
    
    contrat = db.query(ContratLoyer).filter(
        ContratLoyer.id_contrat == id_contrat
    ).first()
    
    if not contrat:
        raise HTTPException(status_code=404, detail="Contrat introuvable.")
    
    if contrat.id_locataire != utilisateur_actuel.id_utilisateur:
        raise HTTPException(status_code=403, detail="Seul le locataire peut accepter le contrat.")
    
    if contrat.statut_contrat != "en_attente":
        raise HTTPException(
            status_code=400,
            detail=f"Ce contrat ne peut pas être accepté (statut : {contrat.statut_contrat})."
        )
    
    # Accepter le contrat
    contrat.statut_contrat = "actif"
    
    # Passer le bien en "loue"
    bien = db.query(Bien).filter(Bien.id_bien == contrat.id_bien).first()
    if bien:
        bien.statut = "loue"
    
    db.commit()
    
    # Vérifier le badge certifié pour les deux parties
    verifier_badge_certifie(contrat.id_proprietaire, db)
    verifier_badge_certifie(contrat.id_locataire, db)
    notifier_contrat(
        db=db,
        id_destinataire=contrat.id_proprietaire,  # Marie
        nom_expediteur=f"{utilisateur_actuel.prenom} {utilisateur_actuel.nom}",
        action="accepte",
        titre_bien=bien.titre if bien else None,
        id_contrat=contrat.id_contrat
    )
    db.commit()
    
    return {
        "message": "Contrat accepté ! Le bail est maintenant actif.",
        "id_contrat": id_contrat,
        "statut": "actif",
        "pdf_url": contrat.pdf_url
    }


# ============================================
# ROUTE 7 : REFUSER LE CONTRAT (locataire seulement)
# ============================================

@routeur.put("/{id_contrat}/refuser")
def refuser_contrat(
    id_contrat: str,
    raison: str = Query(None, description="Raison du refus (optionnel)"),
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel),
    db: Session = Depends(get_db)
):
    """
    Le locataire refuse le contrat.
    """
    
    contrat = db.query(ContratLoyer).filter(
        ContratLoyer.id_contrat == id_contrat
    ).first()
    
    if not contrat:
        raise HTTPException(status_code=404, detail="Contrat introuvable.")
    
    if contrat.id_locataire != utilisateur_actuel.id_utilisateur:
        raise HTTPException(status_code=403, detail="Seul le locataire peut refuser le contrat.")
    
    if contrat.statut_contrat != "en_attente":
        raise HTTPException(
            status_code=400,
            detail=f"Ce contrat ne peut pas être refusé (statut : {contrat.statut_contrat})."
        )
    
    contrat.statut_contrat = "refuse"
    bien = db.query(Bien).filter(Bien.id_bien == contrat.id_bien).first()
    db.commit()
    notifier_contrat(
        db=db,
        id_destinataire=contrat.id_proprietaire,
        nom_expediteur=f"{utilisateur_actuel.prenom} {utilisateur_actuel.nom}",
        action="refuse",
        titre_bien=bien.titre if bien else None,
        id_contrat=contrat.id_contrat
    )
    db.commit()
        
    return {
        "message": "Contrat refusé.",
        "id_contrat": id_contrat,
        "statut": "refuse",
        "raison": raison
    }


# ============================================
# ROUTE 8 : RÉSILIER LE CONTRAT (les deux parties)
# ============================================

@routeur.put("/{id_contrat}/resilier")
def resilier_contrat(
    id_contrat: str,
    raison: str = Query(..., min_length=10, description="Raison de la résiliation"),
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel),
    db: Session = Depends(get_db)
):
    """
    Résilier un contrat actif. Les deux parties peuvent le faire.
    Le bien revient en statut "publie".
    """
    
    contrat = db.query(ContratLoyer).filter(
        ContratLoyer.id_contrat == id_contrat
    ).first()
    
    if not contrat:
        raise HTTPException(status_code=404, detail="Contrat introuvable.")
    
    mon_id = utilisateur_actuel.id_utilisateur
    if contrat.id_proprietaire != mon_id and contrat.id_locataire != mon_id:
        raise HTTPException(status_code=403, detail="Tu n'es pas concerné par ce contrat.")
    
    if contrat.statut_contrat != "actif":
        raise HTTPException(
            status_code=400,
            detail=f"Seul un contrat actif peut être résilié (statut actuel : {contrat.statut_contrat})."
        )
    
    # Résilier
    contrat.statut_contrat = "resilie"
    
    # Remettre le bien en "publie"
    bien = db.query(Bien).filter(Bien.id_bien == contrat.id_bien).first()
    if bien:
        bien.statut = "publie"
    
    db.commit()
    
    # Vérifier le badge certifié
    verifier_badge_certifie(contrat.id_proprietaire, db)
    verifier_badge_certifie(contrat.id_locataire, db)
    
    resilie_par = "proprietaire" if contrat.id_proprietaire == mon_id else "locataire"
    autre_partie_id = contrat.id_locataire if contrat.id_proprietaire == mon_id else contrat.id_proprietaire
    notifier_contrat(
        db=db,
        id_destinataire=autre_partie_id,
        nom_expediteur=f"{utilisateur_actuel.prenom} {utilisateur_actuel.nom}",
        action="resilie",
        titre_bien=bien.titre if bien else None,
        id_contrat=contrat.id_contrat
    )
    db.commit()
    
    return {
        "message": f"Contrat résilié par le {resilie_par}.",
        "id_contrat": id_contrat,
        "statut": "resilie",
        "raison": raison
    }


# ============================================
# ROUTE 9 : LIEN VERS LE PDF
# ============================================

@routeur.get("/{id_contrat}/pdf")
def telecharger_pdf(
    id_contrat: str,
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel),
    db: Session = Depends(get_db)
):
    """
    Obtenir le lien de téléchargement du PDF du contrat.
    """
    
    contrat = db.query(ContratLoyer).filter(
        ContratLoyer.id_contrat == id_contrat
    ).first()
    
    if not contrat:
        raise HTTPException(status_code=404, detail="Contrat introuvable.")
    
    mon_id = utilisateur_actuel.id_utilisateur
    if contrat.id_proprietaire != mon_id and contrat.id_locataire != mon_id:
        raise HTTPException(status_code=403, detail="Tu n'es pas concerné par ce contrat.")
    
    if not contrat.pdf_url:
        raise HTTPException(
            status_code=400,
            detail="Le PDF n'a pas encore été généré. Le contrat est encore en brouillon."
        )
    
    return {
        "id_contrat": id_contrat,
        "pdf_url": contrat.pdf_url,
        "statut": contrat.statut_contrat
    }
