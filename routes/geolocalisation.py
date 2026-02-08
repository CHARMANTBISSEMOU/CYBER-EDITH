"""
routes/geolocalisation.py — Système anti-triche par géolocalisation

═══════════════════════════════════════════════════════════════
BUT DU MODULE :
═══════════════════════════════════════════════════════════════

Détecter si un utilisateur a trouvé un bien immobilier GRÂCE À L'APP,
et lui demander de payer les frais de service (5 000 FCFA).

═══════════════════════════════════════════════════════════════
COMMENT ÇA MARCHE (exemple concret) :
═══════════════════════════════════════════════════════════════

1. Jean cherche "appartement Bonamoussadi" sur l'app
   → Sa recherche est sauvegardée dans la table "recherche_historique"

2. Jean trouve l'appartement de Marie, ils se mettent d'accord

3. Jean emménage dans l'appartement (dans la VRAIE VIE)

4. Le GPS de Jean détecte qu'il est à MOINS de 100m de ce bien
   qu'il avait RECHERCHÉ sur l'app

5. L'app lui dit :
   "On dirait que tu as trouvé ton logement grâce à nous !
    Merci de payer les frais de service : 5 000 FCFA"

6. Jean paye → ✅ Tout est réglé
   Jean refuse → 🚩 Pénalité 10 000 FCFA

═══════════════════════════════════════════════════════════════
LES 2 OPTIONS POUR L'UTILISATEUR :
═══════════════════════════════════════════════════════════════

Option A (GPS) : L'utilisateur accepte le suivi GPS → gratuit
  → Le téléphone envoie sa position toutes les heures
  → Le système compare avec ses recherches
  → S'il est proche d'un bien recherché → "paye 5 000 FCFA"

Option B (paiement direct) : L'utilisateur refuse le GPS
  → Il paye directement (proprio: 10 000 FCFA, autres: 5 000 FCFA/an)
  → Pas de suivi GPS

═══════════════════════════════════════════════════════════════
LES 7 ROUTES :
═══════════════════════════════════════════════════════════════

POST   /geo/enregistrer              → Le téléphone envoie la position GPS
GET    /geo/mes-positions             → L'utilisateur voit son historique de positions
GET    /geo/statut                    → Tableau de bord : est-ce que je dois de l'argent ?
POST   /geo/detection-hebdo           → ⭐ LE CŒUR : compare recherches + GPS → détecte
GET    /geo/mes-detections            → Voir mes détections (à payer, contestées, payées)
PUT    /geo/confirmer/{id}            → J'accepte de payer 5 000 FCFA
PUT    /geo/contester/{id}            → Je conteste (si non justifié → pénalité 10 000 FCFA)
"""

# ============================================
# LES IMPORTS
# ============================================

# FastAPI : le framework web (pour créer les routes)
from fastapi import APIRouter, Depends, HTTPException, Query, status

# SQLAlchemy : pour communiquer avec la base de données MySQL
from sqlalchemy.orm import Session

# datetime : pour manipuler les dates (calculer "il y a 7 jours", "il y a 35 jours")
from datetime import datetime, timezone, timedelta

# math : pour la formule de Haversine (calcul de distance GPS)
# radians = convertir degrés en radians (unité mathématique)
# cos, sin, asin, sqrt = fonctions trigonométriques pour le calcul
from math import radians, cos, sin, asin, sqrt

# uuid : pour générer des identifiants uniques (ex: "geo_a1b2c3d4e5f6")
import uuid

# json : pour lire les critères de recherche stockés en JSON dans la BDD
# Exemple : '{"ville": "douala", "quartier": "bonamoussadi"}' → dictionnaire Python
import json

# Nos fichiers : connexion BDD, modèles des tables, authentification
from database import get_db
from models import Utilisateur, Bien, Geolocalisation, RechercheHistorique, Alerte
from auth import obtenir_utilisateur_actuel
from routes.notifications import notifier_detection


# ============================================
# CRÉATION DU ROUTEUR
# ============================================
# Le routeur regroupe toutes les routes sous le préfixe "/geo"
# Exemple : POST /geo/enregistrer, GET /geo/statut, etc.

routeur = APIRouter(prefix="/geo", tags=["Géolocalisation (Anti-Triche)"])


# ============================================
# LES CONSTANTES (les réglages du système)
# ============================================

# Si l'utilisateur est à moins de 100 mètres d'un bien → on considère qu'il y habite
RAYON_DETECTION_METRES = 100

# On regarde les recherches des 35 derniers jours
# (au-delà de 35 jours, les recherches sont supprimées automatiquement par le module biens)
JOURS_ANALYSE = 35

# Ce que l'utilisateur doit payer s'il a trouvé un bien grâce à l'app
FRAIS_SERVICE_FCFA = 5_000

# S'il refuse de payer après une détection confirmée
PENALITE_REFUS_FCFA = 10_000

# Option B : paiement direct pour les propriétaires (pas de GPS)
PAIEMENT_DIRECT_PROPRIO_FCFA = 10_000

# Option B : paiement direct pour les autres (pas de GPS)
PAIEMENT_DIRECT_AUTRES_FCFA = 5_000


# ============================================
# FORMULE DE HAVERSINE
# ============================================
# C'est une formule mathématique qui calcule la distance
# entre 2 points sur la surface de la Terre.
#
# C'est la même chose que quand Uber calcule
# la distance entre toi et le chauffeur.
#
# Exemple :
#   Téléphone de Jean : (4.0510, 9.7679) → Bonamoussadi
#   Appartement trouvé : (4.0516, 9.7678) → Bonamoussadi aussi
#   Distance = 67 mètres → Jean est à côté → DÉTECTÉ !
#
# Autre exemple :
#   Jean est à Yaoundé : (3.8480, 11.5021)
#   Appartement à Douala : (4.0516, 9.7678)
#   Distance = 253 000 mètres (253 km) → Jean est très loin → PAS détecté

def calculer_distance_metres(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Prend 4 nombres (latitude et longitude de 2 points)
    et retourne la distance en mètres entre ces 2 points.
    """
    
    # Le rayon de la Terre en mètres (6 371 kilomètres)
    R = 6_371_000
    
    # Convertir les degrés en radians (nécessaire pour les fonctions sin/cos)
    # C'est comme convertir des km en mètres, mais pour les angles
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    
    # Calculer la différence entre les 2 points
    dlat = lat2 - lat1  # différence de latitude
    dlon = lon2 - lon1  # différence de longitude
    
    # La formule de Haversine (mathématiques de la Terre ronde)
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    c = 2 * asin(sqrt(a))
    
    # Distance finale en mètres, arrondie à 2 décimales
    return round(R * c, 2)


# ============================================
# ROUTE 1 : ENREGISTRER MA POSITION
# ============================================
# QUI L'APPELLE ? Le téléphone de l'utilisateur, automatiquement toutes les heures.
# L'utilisateur ne voit rien, c'est en arrière-plan.
#
# CE QUI SE PASSE :
#   1. Le téléphone de Jean envoie : latitude=4.0510, longitude=9.7679
#   2. On vérifie : Jean a accepté le GPS ? (consent = "oui")
#   3. Si OUI → on sauvegarde dans la table "geolocalisation"
#   4. Si NON → erreur "Active le GPS ou paye l'Option B"

@routeur.post("/enregistrer", status_code=status.HTTP_201_CREATED)
def enregistrer_position(
    latitude: float = Query(..., description="Latitude GPS du téléphone"),
    longitude: float = Query(..., description="Longitude GPS du téléphone"),
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel),
    db: Session = Depends(get_db)
):
    """
    Le frontend envoie la position GPS de l'utilisateur.
    Appelé automatiquement et régulièrement (toutes les heures par exemple).
    L'utilisateur doit avoir accepté le suivi GPS (consent_geolocalisation = "oui").
    """
    
    # --- Vérification 1 : L'utilisateur a-t-il accepté le GPS ? ---
    # On regarde la colonne "consent_geolocalisation" dans la table "utilisateur"
    # Si c'est "non" → on refuse d'enregistrer sa position
    if utilisateur_actuel.consent_geolocalisation != "oui":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu n'as pas activé le suivi GPS. Active-le dans ton profil ou choisis l'option de paiement direct."
        )
    
    # --- Vérification 2 : Les coordonnées sont-elles valides ? ---
    # Latitude : entre -90 (pôle Sud) et 90 (pôle Nord)
    # Longitude : entre -180 (Ouest) et 180 (Est)
    # Douala, Cameroun : environ (4.05, 9.77) → c'est bien dans la plage
    if not (-90 <= latitude <= 90) or not (-180 <= longitude <= 180):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Coordonnées GPS invalides."
        )
    
    # --- Enregistrer la position dans la table "geolocalisation" ---
    # On crée une nouvelle ligne dans la BDD avec :
    # - Un identifiant unique (ex: "geo_a1b2c3d4e5f6")
    # - L'ID de l'utilisateur (pour savoir à qui appartient cette position)
    # - La latitude et longitude
    # - La raison = "surveillance" (c'est un enregistrement automatique)
    # - La date est automatiquement mise par la BDD (timestamp)
    nouvelle_position = Geolocalisation(
        id_geolocalisation=f"geo_{uuid.uuid4().hex[:12]}",
        id_utilisateur=utilisateur_actuel.id_utilisateur,
        latitude=latitude,
        longitude=longitude,
        precision_metres=0,
        raison="surveillance"
    )
    
    # Sauvegarder dans la BDD
    db.add(nouvelle_position)
    db.commit()
    db.refresh(nouvelle_position)
    
    # Retourner la confirmation
    return {
        "message": "Position enregistrée.",
        "id_geo": nouvelle_position.id_geolocalisation,
        "latitude": latitude,
        "longitude": longitude,
        "date": str(nouvelle_position.timestamp)
    }


# ============================================
# ROUTE 2 : MES POSITIONS (historique)
# ============================================
# QUI L'APPELLE ? L'utilisateur qui veut voir ses positions enregistrées.
#
# CE QUI SE PASSE :
#   Jean demande : "Montre mes positions des 7 derniers jours"
#   Le système retourne la liste :
#     - Lundi 10h : (4.0510, 9.7679)
#     - Lundi 14h : (4.0512, 9.7680)
#     - Mardi 9h : (4.0508, 9.7681)
#     Total : 3 positions

@routeur.get("/mes-positions")
def mes_positions(
    jours: int = Query(7, ge=1, le=35, description="Nombre de jours d'historique (1 à 35)"),
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel),
    db: Session = Depends(get_db)
):
    """Voir mon historique de positions GPS."""
    
    # Calculer la date limite
    # Si jours=7, on regarde depuis il y a 7 jours
    # Exemple : aujourd'hui = 7 février → date_limite = 31 janvier
    date_limite = datetime.now(timezone.utc) - timedelta(days=jours)
    
    # Chercher toutes mes positions depuis cette date
    # SQL équivalent : SELECT * FROM geolocalisation
    #                  WHERE id_utilisateur = Jean
    #                  AND timestamp >= 31 janvier
    #                  ORDER BY timestamp DESC (les plus récentes d'abord)
    positions = db.query(Geolocalisation).filter(
        Geolocalisation.id_utilisateur == utilisateur_actuel.id_utilisateur,
        Geolocalisation.timestamp >= date_limite
    ).order_by(
        Geolocalisation.timestamp.desc()
    ).all()
    
    # Construire la liste de résultats
    resultats = []
    for pos in positions:
        resultats.append({
            "id_geo": pos.id_geolocalisation,
            "latitude": float(pos.latitude) if pos.latitude else None,
            "longitude": float(pos.longitude) if pos.longitude else None,
            "date": str(pos.timestamp)
        })
    
    return {
        "positions": resultats,
        "total": len(resultats),
        "periode": f"{jours} derniers jours"
    }


# ============================================
# ROUTE 3 : MON STATUT ANTI-TRICHE
# ============================================
# QUI L'APPELLE ? L'utilisateur qui veut voir son tableau de bord.
#
# CE QUI SE PASSE :
#   Le système rassemble TOUT sur Jean :
#   1. GPS activé ? → Oui
#   2. Positions cette semaine ? → 15
#   3. Détections actives (biens trouvés via l'app, pas encore payé) ? → 1
#   4. Montant dû ? → 5 000 FCFA
#
#   Si Jean n'a rien à payer :
#     statut_global = "✅ Rien à signaler"
#
#   Si Jean doit de l'argent :
#     statut_global = "💰 1 bien détecté — 5 000 FCFA à payer"

@routeur.get("/statut")
def mon_statut(
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel),
    db: Session = Depends(get_db)
):
    """
    Mon statut dans le système anti-triche.
    Montre si je dois de l'argent, combien, et pourquoi.
    """
    
    mon_id = utilisateur_actuel.id_utilisateur
    
    # 1. Est-ce que le GPS est activé ?
    gps_actif = utilisateur_actuel.consent_geolocalisation == "oui"
    
    # 2. Combien de positions enregistrées cette semaine ?
    date_7j = datetime.now(timezone.utc) - timedelta(days=7)
    nombre_positions = db.query(Geolocalisation).filter(
        Geolocalisation.id_utilisateur == mon_id,
        Geolocalisation.timestamp >= date_7j
    ).count()
    
    # 3. Détections actives (biens trouvés via l'app, pas encore payé)
    # SQL : SELECT * FROM alerte
    #        WHERE id_utilisateur = Jean
    #        AND type_alerte = 'detection_bien'
    #        AND statut = 'active'
    alertes_actives = db.query(Alerte).filter(
        Alerte.id_utilisateur == mon_id,
        Alerte.statut == "active",
        Alerte.type_alerte == "detection_bien"
    ).all()
    
    # 4. Compteurs pour les autres statuts
    alertes_contestees = db.query(Alerte).filter(
        Alerte.id_utilisateur == mon_id,
        Alerte.statut == "contestee"
    ).count()
    
    alertes_resolues = db.query(Alerte).filter(
        Alerte.id_utilisateur == mon_id,
        Alerte.statut == "resolue"
    ).count()
    
    # 5. Montant total dû = nombre de détections actives × 5 000 FCFA
    # Exemple : 2 détections → 2 × 5 000 = 10 000 FCFA
    montant_du = len(alertes_actives) * FRAIS_SERVICE_FCFA
    
    # 6. Déterminer le statut global (le message principal)
    if not gps_actif:
        statut_global = "⚠️ GPS désactivé — option de paiement direct requise"
    elif len(alertes_actives) > 0:
        statut_global = f"💰 {len(alertes_actives)} bien(s) détecté(s) — {montant_du:,} FCFA à payer"
    elif nombre_positions == 0:
        statut_global = "🟡 GPS activé mais aucune position cette semaine"
    else:
        statut_global = "✅ Rien à signaler"
    
    # 7. Lister les détections à payer (pour que Jean sache exactement quoi)
    detections = []
    for alerte in alertes_actives:
        detections.append({
            "id_detection": alerte.id_alerte,
            "message": alerte.message,
            "montant_a_payer": FRAIS_SERVICE_FCFA,
            "date": str(alerte.date_creation)
        })
    
    return {
        "statut_global": statut_global,
        "gps_actif": gps_actif,
        "positions_cette_semaine": nombre_positions,
        "detections_a_payer": detections,
        "montant_total_du": montant_du,
        "detections_contestees": alertes_contestees,
        "detections_payees": alertes_resolues,
        "frais_service": FRAIS_SERVICE_FCFA,
        "penalite_refus": PENALITE_REFUS_FCFA
    }


# ============================================
# ROUTE 4 : DÉTECTION HEBDOMADAIRE
# ⭐ C'EST LE CŒUR DU SYSTÈME ANTI-TRICHE ⭐
# ============================================
#
# QUI L'APPELLE ? Un CRON job automatique chaque semaine (en production).
# Pour tester, toi manuellement sur /docs.
#
# CE QUI SE PASSE (exemple avec Jean) :
#
# ═══ ÉTAPE 1 : Récupérer les utilisateurs avec GPS activé ═══
#   → Jean, Marie, Paul, Sarah...
#
# ═══ ÉTAPE 2 : Pour Jean → ses RECHERCHES des 35 derniers jours ═══
#   Jean a cherché :
#     - "appartement Bonamoussadi Douala"
#     - "studio Akwa Douala"
#   → villes = {douala}, quartiers = {bonamoussadi, akwa}
#
# ═══ ÉTAPE 3 : Trouver les BIENS dans ces zones ═══
#   → 8 biens à Bonamoussadi et Akwa trouvés en BDD
#
# ═══ ÉTAPE 4 : Les POSITIONS GPS de Jean (7 derniers jours) ═══
#   → 15 positions enregistrées par son téléphone
#
# ═══ ÉTAPE 5 : COMPARER positions ↔ biens ═══
#   Position de Jean (4.0510, 9.7679)
#     vs Bien "Bel appart Bonamoussadi" (4.0516, 9.7678)
#     → Distance = 67 mètres
#     → 67m < 100m → 🎯 DÉTECTÉ !
#
#   L'app conclut :
#   "Jean a RECHERCHÉ des biens à Bonamoussadi.
#    Jean EST MAINTENANT à 67m de cet appartement.
#    Donc il a trouvé ce logement grâce à nous → PAYE 5 000 FCFA"
#
# ═══ ÉTAPE 6 : Créer l'alerte dans la table "alerte" ═══
#   type = "detection_bien", statut = "active"
#   Jean verra ça dans /geo/statut et /geo/mes-detections

@routeur.post("/detection-hebdo")
def detection_hebdomadaire(
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel),
    db: Session = Depends(get_db)
):
    """
    Lancer la détection hebdomadaire.
    Compare les RECHERCHES de chaque utilisateur avec ses POSITIONS GPS.
    Si un utilisateur est proche d'un bien qu'il a recherché → détection → frais de service.
    """
    
    # Les dates limites pour nos requêtes
    # On regarde les positions des 7 derniers jours
    date_positions = datetime.now(timezone.utc) - timedelta(days=7)
    # On regarde les recherches des 35 derniers jours
    date_recherches = datetime.now(timezone.utc) - timedelta(days=JOURS_ANALYSE)
    
    # ═══ ÉTAPE 1 : Récupérer tous les utilisateurs avec GPS activé ═══
    # SQL : SELECT * FROM utilisateur WHERE consent_geolocalisation = 'oui'
    utilisateurs_gps = db.query(Utilisateur).filter(
        Utilisateur.consent_geolocalisation == "oui"
    ).all()
    
    # Le rapport qu'on retournera à la fin (pour savoir ce qui s'est passé)
    rapport = {
        "utilisateurs_verifies": 0,
        "detections_creees": 0,
        "details": []
    }
    
    # ═══ BOUCLE : Pour chaque utilisateur avec GPS activé ═══
    for utilisateur in utilisateurs_gps:
        uid = utilisateur.id_utilisateur
        rapport["utilisateurs_verifies"] += 1
        
        # ═══ ÉTAPE 2 : Récupérer ses RECHERCHES (35 derniers jours) ═══
        # SQL : SELECT * FROM recherche_historique
        #        WHERE id_utilisateur = Jean
        #        AND date_recherche >= il y a 35 jours
        recherches = db.query(RechercheHistorique).filter(
            RechercheHistorique.id_utilisateur == uid,
            RechercheHistorique.date_recherche >= date_recherches
        ).all()
        
        # Si Jean n'a fait aucune recherche → rien à vérifier, on passe au suivant
        if not recherches:
            continue
        
        # ═══ ÉTAPE 3 : Extraire les villes et quartiers recherchés ═══
        # Les critères de recherche sont stockés en JSON dans la colonne "criteres_recherche"
        # Exemple en BDD : '{"ville": "douala", "quartier": "bonamoussadi", "type_bien": "appartement"}'
        # On utilise json.loads() pour transformer ce texte en dictionnaire Python
        #
        # On utilise des "sets" (ensembles) pour éviter les doublons
        # Si Jean a cherché 3 fois "douala", on ne garde qu'une seule fois
        villes_recherchees = set()      # ex: {"douala"}
        quartiers_recherches = set()    # ex: {"bonamoussadi", "akwa"}
        
        for rech in recherches:
            try:
                # Transformer le JSON en dictionnaire Python
                # '{"ville": "douala"}' → {"ville": "douala"}
                criteres = json.loads(rech.criteres_recherche)
                
                # Si Jean a recherché une ville → l'ajouter à la liste
                if criteres.get("ville"):
                    villes_recherchees.add(criteres["ville"].lower())
                
                # Si Jean a recherché un quartier → l'ajouter à la liste
                if criteres.get("quartier"):
                    quartiers_recherches.add(criteres["quartier"].lower())
                    
            except (json.JSONDecodeError, AttributeError):
                # Si le JSON est mal formaté → on ignore cette recherche
                continue
        
        # Si aucune ville ni quartier n'a été trouvé → on ne peut pas comparer
        if not villes_recherchees and not quartiers_recherches:
            continue
        
        # ═══ ÉTAPE 4 : Trouver les BIENS dans ces zones ═══
        # On cherche en BDD tous les biens qui correspondent aux zones recherchées
        # SQL : SELECT * FROM bien
        #        WHERE statut IN ('publie', 'loue')
        #        AND (ville LIKE '%douala%' OR quartier LIKE '%bonamoussadi%' OR quartier LIKE '%akwa%')
        from sqlalchemy import or_, func
        
        requete_biens = db.query(Bien).filter(
            Bien.statut.in_(["publie", "loue"])
        )
        
        # Construire les conditions de recherche
        # Pour chaque ville et quartier recherché, on ajoute un "OR"
        conditions = []
        for ville in villes_recherchees:
            # func.lower() = convertir en minuscules pour comparer sans problème de casse
            # .contains() = recherche partielle (comme LIKE '%douala%')
            conditions.append(func.lower(Bien.ville).contains(ville))
        
        for quartier in quartiers_recherches:
            conditions.append(func.lower(Bien.quartier).contains(quartier))
        
        # Appliquer les conditions avec OR (ville = douala OU quartier = bonamoussadi OU ...)
        if conditions:
            requete_biens = requete_biens.filter(or_(*conditions))
        
        biens_correspondants = requete_biens.all()
        
        # Aucun bien dans ces zones → rien à vérifier
        if not biens_correspondants:
            continue
        
        # ═══ ÉTAPE 5 : Récupérer les POSITIONS GPS de Jean (7 derniers jours) ═══
        # SQL : SELECT * FROM geolocalisation
        #        WHERE id_utilisateur = Jean
        #        AND timestamp >= il y a 7 jours
        positions = db.query(Geolocalisation).filter(
            Geolocalisation.id_utilisateur == uid,
            Geolocalisation.timestamp >= date_positions
        ).all()
        
        # Pas de positions enregistrées → on ne peut pas vérifier
        if not positions:
            continue
        
        # ═══ ÉTAPE 6 : COMPARER positions ↔ biens recherchés ═══
        # C'est ICI que la magie opère !
        #
        # Pour chaque bien trouvé à l'étape 4 :
        #   Pour chaque position GPS de Jean :
        #     → Calculer la distance avec Haversine
        #     → Si distance < 100m → DÉTECTION !
        
        for bien in biens_correspondants:
            
            # --- Ignorer les biens sans coordonnées GPS ---
            # Si le bien n'a pas de latitude/longitude, on ne peut pas calculer la distance
            if not bien.latitude or not bien.longitude:
                continue
            
            # --- Ignorer si c'est SON PROPRE bien ---
            # Jean ne va pas payer pour être à côté de son propre appartement !
            if bien.id_proprietaire == uid:
                continue
            
            # --- Vérifier qu'on n'a pas DÉJÀ créé une détection pour ce bien ---
            # Si on a déjà dit à Jean "tu es proche de ce bien", pas besoin de le redire
            # On vérifie en cherchant dans la table "alerte" si le message contient l'ID du bien
            detection_existante = db.query(Alerte).filter(
                Alerte.id_utilisateur == uid,
                Alerte.type_alerte == "detection_bien",
                Alerte.message.contains(bien.id_bien)
            ).first()
            
            if detection_existante:
                continue  # Déjà détecté → on passe au bien suivant
            
            # --- Comparer chaque position de Jean avec ce bien ---
            for pos in positions:
                # Vérifier que la position a des coordonnées
                if not pos.latitude or not pos.longitude:
                    continue
                
                # Calculer la distance entre la position de Jean et le bien
                # Exemple :
                #   Jean : (4.0510, 9.7679)
                #   Bien : (4.0516, 9.7678)
                #   Distance = 67 mètres
                distance = calculer_distance_metres(
                    float(pos.latitude), float(pos.longitude),
                    float(bien.latitude), float(bien.longitude)
                )
                
                # Si la distance est inférieure ou égale à 100 mètres → DÉTECTION !
                if distance <= RAYON_DETECTION_METRES:
                    
                    # 🎯 DÉTECTION ! Jean est à côté d'un bien qu'il a recherché !
                    #
                    # On crée une alerte dans la table "alerte" :
                    # - type_alerte = "detection_bien" (c'est une détection de bien)
                    # - statut = "active" (en attente de paiement)
                    # - Le message contient toutes les infos + l'ID du bien
                    nouvelle_alerte = Alerte(
                        id_alerte=f"det_{uuid.uuid4().hex[:12]}",
                        id_utilisateur=uid,
                        type_alerte="detection_bien",
                        message=(
                            f"Bien détecté : {bien.titre} ({bien.quartier}, {bien.ville}). "
                            f"Distance : {distance:.0f}m. ID bien : {bien.id_bien}. "
                            f"Vous avez recherché des biens dans cette zone et vous y êtes maintenant. "
                            f"Frais de service : {FRAIS_SERVICE_FCFA:,} FCFA."
                        ),
                        statut="active"
                    )
                    db.add(nouvelle_alerte)
                    notifier_detection(
                        db=db,
                        id_utilisateur=uid,
                        titre_bien=bien.titre,
                        quartier=bien.quartier,
                        ville=bien.ville,
                        montant=FRAIS_SERVICE_FCFA
                    )
                    
                    # Ajouter au rapport
                    rapport["detections_creees"] += 1
                    rapport["details"].append({
                        "utilisateur": f"{utilisateur.prenom} {utilisateur.nom}",
                        "bien_detecte": bien.titre,
                        "adresse": f"{bien.quartier}, {bien.ville}",
                        "distance_metres": distance,
                        "montant_a_payer": FRAIS_SERVICE_FCFA
                    })
                    
                    # "break" = arrêter la boucle des positions pour ce bien
                    # Une seule détection par bien suffit, pas besoin de vérifier les autres positions
                    break
    
    # Sauvegarder toutes les alertes créées dans la BDD
    db.commit()
    
    # Retourner le rapport complet
    return {
        "message": "Détection hebdomadaire terminée.",
        "date": str(datetime.now(timezone.utc)),
        "rapport": rapport
    }


# ============================================
# ROUTE 5 : MES DÉTECTIONS
# ============================================
# QUI L'APPELLE ? L'utilisateur qui veut voir ses détections.
#
# CE QUI SE PASSE :
#   On classe les détections en 3 catégories :
#
#   ACTIVES (pas encore payé) :
#     → "Bel appart Bonamoussadi — 5 000 FCFA à payer"
#
#   CONTESTÉES (Jean a dit "c'est pas grâce à l'app") :
#     → "Studio Akwa — contesté le 05/02"
#
#   RÉSOLUES (payé) :
#     → "Maison Logbessou — payé le 03/02"

@routeur.get("/mes-detections")
def mes_detections(
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel),
    db: Session = Depends(get_db)
):
    """Voir toutes les détections me concernant (à payer, contestées, payées)."""
    
    mon_id = utilisateur_actuel.id_utilisateur
    
    # Récupérer toutes mes alertes de type "detection_bien"
    # SQL : SELECT * FROM alerte
    #        WHERE id_utilisateur = Jean
    #        AND type_alerte = 'detection_bien'
    #        ORDER BY date_creation DESC
    alertes = db.query(Alerte).filter(
        Alerte.id_utilisateur == mon_id,
        Alerte.type_alerte == "detection_bien"
    ).order_by(
        Alerte.date_creation.desc()
    ).all()
    
    # Classer les alertes en 3 catégories
    actives = []         # Pas encore payé
    contestees = []      # L'utilisateur conteste
    resolues = []        # Payé
    
    for alerte in alertes:
        donnees = {
            "id_detection": alerte.id_alerte,
            "message": alerte.message,
            "date": str(alerte.date_creation),
            "statut": alerte.statut
        }
        
        if alerte.statut == "active":
            donnees["montant_a_payer"] = FRAIS_SERVICE_FCFA
            donnees["action"] = "Utilise PUT /geo/confirmer/{id} pour accepter ou PUT /geo/contester/{id} pour contester"
            actives.append(donnees)
        
        elif alerte.statut == "contestee":
            contestees.append(donnees)
        
        elif alerte.statut == "resolue":
            resolues.append(donnees)
    
    return {
        "actives": actives,
        "contestees": contestees,
        "resolues": resolues,
        "montant_total_du": len(actives) * FRAIS_SERVICE_FCFA,
        "total_detections": len(alertes)
    }


# ============================================
# ROUTE 6 : CONFIRMER UNE DÉTECTION (accepter de payer)
# ============================================
# QUI L'APPELLE ? L'utilisateur qui accepte de payer.
#
# CE QUI SE PASSE :
#   1. Jean dit : "OK, je confirme la détection det_xyz789"
#   2. On vérifie que c'est bien sa détection et qu'elle est active
#   3. On change le statut en "en_attente_paiement"
#   4. Jean devra ensuite payer via le module Paiements (NotchPay)

@routeur.put("/confirmer/{id_detection}")
def confirmer_detection(
    id_detection: str,
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel),
    db: Session = Depends(get_db)
):
    """
    L'utilisateur confirme qu'il a trouvé le bien grâce à l'app.
    Il accepte de payer les frais de service.
    Le paiement sera effectué via le module Paiements (NotchPay).
    """
    
    # Chercher l'alerte dans la BDD
    # On vérifie que c'est bien l'alerte de cet utilisateur (sécurité)
    alerte = db.query(Alerte).filter(
        Alerte.id_alerte == id_detection,
        Alerte.id_utilisateur == utilisateur_actuel.id_utilisateur
    ).first()
    
    # Si l'alerte n'existe pas ou ne lui appartient pas
    if not alerte:
        raise HTTPException(status_code=404, detail="Détection introuvable.")
    
    # Vérifier que l'alerte est encore "active" (pas déjà payée ou contestée)
    if alerte.statut != "active":
        raise HTTPException(
            status_code=400,
            detail=f"Cette détection ne peut pas être confirmée (statut : {alerte.statut})."
        )
    
    # Changer le statut de l'alerte : "active" → "en_attente_paiement"
    # Le paiement réel se fera dans le module NotchPay
    alerte.statut = "en_attente_paiement"
    db.commit()
    
    return {
        "message": f"Détection confirmée. Merci de procéder au paiement de {FRAIS_SERVICE_FCFA:,} FCFA.",
        "id_detection": id_detection,
        "montant": FRAIS_SERVICE_FCFA,
        "statut": "en_attente_paiement",
        "instructions": "Utilise le module Paiements pour effectuer le paiement."
    }


# ============================================
# ROUTE 7 : CONTESTER UNE DÉTECTION
# ============================================
# QUI L'APPELLE ? L'utilisateur qui conteste la détection.
#
# CE QUI SE PASSE :
#   1. Jean dit : "Je conteste ! Je rendais juste visite à un ami"
#   2. On vérifie que c'est bien sa détection et qu'elle est active
#   3. On change le statut en "contestee"
#   4. On ajoute sa raison au message de l'alerte
#   5. La contestation sera examinée
#   6. Si non justifiée → pénalité de 10 000 FCFA
#
# EXEMPLES DE CONTESTATION :
#   - "Je rendais visite à un ami dans ce quartier"
#   - "J'habite déjà ici depuis avant l'utilisation de l'app"
#   - "C'était un passage, je n'y habite pas"

@routeur.put("/contester/{id_detection}")
def contester_detection(
    id_detection: str,
    raison: str = Query(
        ..., 
        min_length=10, 
        max_length=500, 
        description="Explique pourquoi tu contestes (ex: 'Je rendais visite à un ami')"
    ),
    utilisateur_actuel: Utilisateur = Depends(obtenir_utilisateur_actuel),
    db: Session = Depends(get_db)
):
    """
    L'utilisateur conteste une détection.
    Si la contestation n'est pas justifiée → pénalité de 10 000 FCFA.
    """
    
    # Chercher l'alerte dans la BDD (sécurité : vérifier que c'est la sienne)
    alerte = db.query(Alerte).filter(
        Alerte.id_alerte == id_detection,
        Alerte.id_utilisateur == utilisateur_actuel.id_utilisateur
    ).first()
    
    if not alerte:
        raise HTTPException(status_code=404, detail="Détection introuvable.")
    
    # Vérifier que l'alerte est encore "active"
    if alerte.statut != "active":
        raise HTTPException(
            status_code=400,
            detail=f"Cette détection ne peut pas être contestée (statut : {alerte.statut})."
        )
    
    # Changer le statut : "active" → "contestee"
    alerte.statut = "contestee"
    
    # Ajouter la raison de la contestation au message existant
    # Comme ça on garde la détection originale + la raison du refus
    alerte.message = alerte.message + f" | CONTESTATION : {raison}"
    
    db.commit()
    
    return {
        "message": "Détection contestée. Ta contestation sera examinée.",
        "id_detection": id_detection,
        "raison": raison,
        "statut": "contestee",
        "avertissement": f"Si la contestation n'est pas justifiée, une pénalité de {PENALITE_REFUS_FCFA:,} FCFA sera appliquée."
    }
