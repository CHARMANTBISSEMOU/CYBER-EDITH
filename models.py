"""
models.py — Tous les modèles SQLAlchemy de l'application

Chaque classe = une table dans la base de données.
Les noms et types correspondent EXACTEMENT au SQL existant sur Clever Cloud.

Tables :
1.  Utilisateur      — Les comptes utilisateurs
2.  Bien             — Les biens immobiliers (maisons, studios, etc.)
3.  Image            — Les photos des biens (stockées sur Cloudinary)
4.  ContratLoyer     — Les contrats entre propriétaire et locataire
5.  PaiementLoyer    — Les paiements mensuels de loyer
6.  Geolocalisation  — Les positions GPS (utilisateurs et biens)
7.  Message          — Les messages du chat entre utilisateurs
8.  Notification     — Les notifications (loyer, paiement, badge, etc.)
9.  Alerte           — Les alertes personnalisées ("préviens-moi si...")
10. RechercheHistorique — L'historique des recherches
11. Transaction      — Les transactions financières (NotchPay)
"""

from sqlalchemy import (
    Column, String, Text, Integer, Enum, DateTime, Date,
    DECIMAL, Boolean, ForeignKey
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


# ============================================
# 1. UTILISATEUR
# ============================================
class Utilisateur(Base):
    __tablename__ = "utilisateur"

    id_utilisateur = Column(String(255), primary_key=True)
    email = Column(String(255), unique=True, nullable=False)
    mot_de_passe = Column(String(255), nullable=False)
    telephone = Column(String(20), unique=True, nullable=False)
    nom = Column(String(50), nullable=False)
    prenom = Column(String(50), nullable=False)
    photo_profil_url = Column(String(500), default=None)
    badge_certifie = Column(Boolean, default=False)
    nombre_contrats = Column(Integer, default=0)
    consent_geolocalisation = Column(
        Enum("non", "oui", name="consent_geo_enum"),
        default="non"
    )
    date_inscription = Column(DateTime, server_default=func.now(), nullable=False)
    derniere_connexion = Column(DateTime, default=None)

    # Relations — permet d'accéder aux données liées facilement
    # Ex: utilisateur.biens → liste de tous ses biens
    biens = relationship("Bien", back_populates="proprietaire", cascade="all, delete-orphan")
    alertes = relationship("Alerte", back_populates="utilisateur", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="utilisateur", cascade="all, delete-orphan")
    recherches = relationship("RechercheHistorique", back_populates="utilisateur", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="utilisateur", cascade="all, delete-orphan")
    geolocalisations = relationship("Geolocalisation", back_populates="utilisateur", cascade="all, delete-orphan")

    # Contrats en tant que propriétaire ou locataire
    contrats_proprietaire = relationship(
        "ContratLoyer",
        foreign_keys="ContratLoyer.id_proprietaire",
        back_populates="proprietaire",
        cascade="all, delete-orphan"
    )
    contrats_locataire = relationship(
        "ContratLoyer",
        foreign_keys="ContratLoyer.id_locataire",
        back_populates="locataire",
        cascade="all, delete-orphan"
    )

    # Messages envoyés et reçus
    messages_envoyes = relationship(
        "Message",
        foreign_keys="Message.expediteur_id",
        back_populates="expediteur",
        cascade="all, delete-orphan"
    )
    messages_recus = relationship(
        "Message",
        foreign_keys="Message.destinataire_id",
        back_populates="destinataire",
        cascade="all, delete-orphan"
    )


# ============================================
# 2. BIEN
# ============================================
class Bien(Base):
    __tablename__ = "bien"

    id_bien = Column(String(255), primary_key=True)
    id_proprietaire = Column(String(255), ForeignKey("utilisateur.id_utilisateur", ondelete="CASCADE"), nullable=False)
    id_geolocalisation = Column(String(255), ForeignKey("geolocalisation.id_geolocalisation", ondelete="SET NULL"), default=None)
    titre = Column(String(255), nullable=False)
    description = Column(Text, default=None)
    type_bien = Column(
        Enum("studio", "maison", "chambre", "appartement", "bureau", "terrain", name="type_bien_enum"),
        nullable=False
    )
    ville = Column(String(100), nullable=False)
    quartier = Column(String(100), nullable=False)
    adresse_complete = Column(Text, default=None)
    latitude = Column(DECIMAL(10, 8), default=None)
    longitude = Column(DECIMAL(11, 8), default=None)
    prix_loyer = Column(Integer, default=None)
    prix_vente = Column(Integer, default=None)
    superficie = Column(Integer, default=None)
    nombre_chambres = Column(Integer, default=0)
    nombre_salles_bain = Column(Integer, default=0)
    nombre_pieces = Column(Integer, default=None)
    meuble = Column(Boolean, default=False)
    statut = Column(
        Enum("en_attente", "publie", "loue", "vendu", "archive", name="statut_bien_enum"),
        default="en_attente"
    )
    date_publication = Column(DateTime, server_default=func.now())
    date_modification = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relations
    proprietaire = relationship("Utilisateur", back_populates="biens")
    geolocalisation_ref = relationship("Geolocalisation", foreign_keys=[id_geolocalisation])
    images = relationship("Image", back_populates="bien", cascade="all, delete-orphan")
    contrats = relationship("ContratLoyer", back_populates="bien", cascade="all, delete-orphan")
    geolocalisations = relationship(
        "Geolocalisation",
        foreign_keys="Geolocalisation.id_bien",
        back_populates="bien",
        cascade="all, delete-orphan"
    )


# ============================================
# 3. IMAGE
# ============================================
class Image(Base):
    __tablename__ = "image"

    id_image = Column(String(255), primary_key=True)
    id_bien = Column(String(255), ForeignKey("bien.id_bien", ondelete="CASCADE"), nullable=False)
    url_cloudinary = Column(String(500), nullable=False)
    type_media = Column(Enum("image", "video", name="type_media_enum"), default="image")
    date_upload = Column(DateTime, server_default=func.now())

    # Relations
    bien = relationship("Bien", back_populates="images")


# ============================================
# 4. CONTRAT LOYER
# ============================================
class ContratLoyer(Base):
    __tablename__ = "contrat_loyer"

    id_contrat = Column(String(255), primary_key=True)
    id_bien = Column(String(255), ForeignKey("bien.id_bien", ondelete="CASCADE"), nullable=False)
    id_proprietaire = Column(String(255), ForeignKey("utilisateur.id_utilisateur", ondelete="CASCADE"), nullable=False)
    id_locataire = Column(String(255), ForeignKey("utilisateur.id_utilisateur", ondelete="CASCADE"), nullable=False)
    montant_loyer = Column(Integer, nullable=False)
    montant_caution = Column(Integer, default=None)
    date_debut = Column(Date, nullable=False)
    date_fin = Column(Date, default=None)
    duree_mois = Column(Integer, default=12)
    jour_paiement = Column(Integer, nullable=False)
    conditions_particulieres = Column(Text, default=None)
    statut_contrat = Column(Enum("brouillon", "en_attente", "actif", "resilie", "expire", "refuse"), default="brouillon")
    pdf_url = Column(String(500), default=None)
    contenu_contrat = Column(Text, nullable=True)
    date_creation = Column(DateTime, server_default=func.now())
    date_signature = Column(DateTime, default=None)

    # Relations
    bien = relationship("Bien", back_populates="contrats")
    proprietaire = relationship("Utilisateur", foreign_keys=[id_proprietaire], back_populates="contrats_proprietaire")
    locataire = relationship("Utilisateur", foreign_keys=[id_locataire], back_populates="contrats_locataire")
    paiements = relationship("PaiementLoyer", back_populates="contrat", cascade="all, delete-orphan")


# ============================================
# 5. PAIEMENT LOYER
# ============================================
class PaiementLoyer(Base):
    __tablename__ = "paiement_loyer"

    id_paiement = Column(String(255), primary_key=True)
    id_contrat = Column(String(255), ForeignKey("contrat_loyer.id_contrat", ondelete="CASCADE"), nullable=False)
    montant = Column(Integer, nullable=False)
    date_echeance = Column(Date, nullable=False)
    date_paiement_effectif = Column(DateTime, default=None)
    transaction_id = Column(String(100), default=None)
    statut_paiement = Column(
        Enum("en_attente", "paye", "en_retard", name="statut_paiement_enum"),
        default="en_attente"
    )
    mode_paiement = Column(
        Enum("orange_money", "mtn_momo", "especes", "virement", name="mode_paiement_enum"),
        default=None
    )
    date_creation = Column(DateTime, server_default=func.now())

    # Relations
    contrat = relationship("ContratLoyer", back_populates="paiements")


# ============================================
# 6. GEOLOCALISATION
# ============================================
class Geolocalisation(Base):
    __tablename__ = "geolocalisation"

    id_geolocalisation = Column(String(255), primary_key=True)
    id_utilisateur = Column(String(255), ForeignKey("utilisateur.id_utilisateur", ondelete="CASCADE"), nullable=False)
    id_bien = Column(String(255), ForeignKey("bien.id_bien", ondelete="CASCADE"), default=None)
    latitude = Column(DECIMAL(10, 8), nullable=False)
    longitude = Column(DECIMAL(11, 8), nullable=False)
    precision_metres = Column(Integer, default=0)
    timestamp = Column(DateTime, server_default=func.now(), nullable=False)
    raison = Column(String(100), nullable=False)

    # Relations
    utilisateur = relationship("Utilisateur", back_populates="geolocalisations")
    bien = relationship("Bien", foreign_keys=[id_bien], back_populates="geolocalisations")


# ============================================
# 7. MESSAGE (Chat)
# ============================================
class Message(Base):
    __tablename__ = "message"

    id_message = Column(String(255), primary_key=True)
    expediteur_id = Column(String(255), ForeignKey("utilisateur.id_utilisateur", ondelete="CASCADE"), nullable=False)
    destinataire_id = Column(String(255), ForeignKey("utilisateur.id_utilisateur", ondelete="CASCADE"), nullable=False)
    id_bien = Column(String(50), ForeignKey("bien.id_bien"), nullable=True)
    contenu = Column(Text, nullable=False)
    date_envoi = Column(DateTime, server_default=func.now())
    lu = Column(Boolean, default=False)
    date_lecture = Column(DateTime, default=None)

    # Relations
    expediteur = relationship("Utilisateur", foreign_keys=[expediteur_id], back_populates="messages_envoyes")
    destinataire = relationship("Utilisateur", foreign_keys=[destinataire_id], back_populates="messages_recus")
    bien = relationship("Bien")


# ============================================
# 8. NOTIFICATION
# ============================================
class Notification(Base):
    __tablename__ = "notification"

    id_notification = Column(String(255), primary_key=True)
    id_utilisateur = Column(String(255), ForeignKey("utilisateur.id_utilisateur", ondelete="CASCADE"), nullable=False)
    id_contrat = Column(String(255), default=None)
    id_transaction = Column(String(255), default=None)
    type_notification = Column(
        Enum("message", "contrat", "detection", "paiement", "systeme", name="type_notif_enum"),
        default=None
    )
    titre = Column(String(255), nullable=False)
    message = Column(Text, default=None)
    lu = Column(Boolean, default=False)
    date_creation = Column(DateTime, server_default=func.now())
    date_lecture = Column(DateTime, default=None)

    # Relations
    utilisateur = relationship("Utilisateur", back_populates="notifications")


# ============================================
# 9. ALERTE
# ============================================
class Alerte(Base):
    __tablename__ = "alerte"

    id_alerte = Column(String(255), primary_key=True)
    id_utilisateur = Column(String(255), ForeignKey("utilisateur.id_utilisateur", ondelete="CASCADE"), nullable=False)
    type_bien = Column(
        Enum("studio", "maison", "chambre", "appartement", name="type_bien_alerte_enum"),
        default=None
    )
    type_alerte = Column(String(50), default=None)
    message = Column(Text, default=None)
    ville = Column(String(100), default=None)
    quartier = Column(String(100), default=None)
    prix_min = Column(Integer, default=None)
    prix_max = Column(Integer, default=None)
    chambres_min = Column(Integer, default=None)
    duree_jours = Column(Integer, default=None)
    date_creation = Column(DateTime, server_default=func.now())
    date_expiration = Column(Date, default=None)
    statut = Column(
        Enum("active", "expiree", "supprimee", "contestee", "en_attente_paiement", "resolue", name="statut_alerte_enum"),
        default="active"
    )

    # Relations
    utilisateur = relationship("Utilisateur", back_populates="alertes")


# ============================================
# 10. RECHERCHE HISTORIQUE
# ============================================
class RechercheHistorique(Base):
    __tablename__ = "recherche_historique"

    id_recherche = Column(String(255), primary_key=True)
    id_utilisateur = Column(String(255), ForeignKey("utilisateur.id_utilisateur", ondelete="CASCADE"), nullable=False)
    id_bien = Column(String(255), default=None)
    criteres_recherche = Column(Text, nullable=False)
    date_recherche = Column(DateTime, server_default=func.now())

    # Relations
    utilisateur = relationship("Utilisateur", back_populates="recherches")


# ============================================
# 11. TRANSACTION
# ============================================
class Transaction(Base):
    __tablename__ = "transaction"

    id_transaction = Column(String(255), primary_key=True)
    id_utilisateur = Column(String(255), ForeignKey("utilisateur.id_utilisateur", ondelete="CASCADE"), nullable=False)
    id_bien = Column(String(255), ForeignKey("bien.id_bien", ondelete="SET NULL"), default=None)
    montant = Column(Integer, nullable=False)
    type_transaction = Column(
        Enum("publication", "guide", "commission", "penalite", "service", "loyer", "reversement", name="type_transaction_enum"),
        nullable=False
    )
    reference_campay = Column(String(100), default=None)
    statut = Column(
        Enum("en_attente", "en_cours", "terminee", "echouee", "annulee", name="statut_transaction_enum"),
        default="en_attente"
    )
    description = Column(Text, default=None)
    date_transaction = Column(DateTime, server_default=func.now())

    # Relations
    utilisateur = relationship("Utilisateur", back_populates="transactions")
    bien = relationship("Bien")
