#!/usr/bin/env python3
"""
Script de test pour l'API NotchPay
"""

import requests
import json

# Configuration
BASE_URL = "http://localhost:8000"  # URL de votre API locale

def test_initier_paiement():
    """Tester l'initialisation d'un paiement"""
    print("🧪 Test: Initialisation paiement")
    
    data = {
        "montant": 5000,
        "email": "test@example.com",
        "telephone": "237677777777",
        "description": "Test publication bien",
        "type_transaction": "publication",
        "id_bien": "bien_test_123",
        "id_utilisateur": "user_test_456"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/notchpay/initier", json=data)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
        return response.json()
    except Exception as e:
        print(f"❌ Erreur: {e}")
        return None

def test_verifier_paiement(reference):
    """Tester la vérification d'un paiement"""
    print(f"\n🧪 Test: Vérification paiement {reference}")
    
    try:
        response = requests.get(f"{BASE_URL}/notchpay/verifier/{reference}")
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
        return response.json()
    except Exception as e:
        print(f"❌ Erreur: {e}")
        return None

def test_historique_utilisateur():
    """Tester l'historique des paiements utilisateur"""
    print("\n🧪 Test: Historique utilisateur")
    
    try:
        response = requests.get(f"{BASE_URL}/notchpay/utilisateur/user_test_456")
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
        return response.json()
    except Exception as e:
        print(f"❌ Erreur: {e}")
        return None

def test_health_check():
    """Tester le health check"""
    print("\n🧪 Test: Health Check")
    
    try:
        response = requests.get(f"{BASE_URL}/health")
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
        return response.json()
    except Exception as e:
        print(f"❌ Erreur: {e}")
        return None

def main():
    """Fonction principale de test"""
    print("🚀 Démarrage des tests API NotchPay")
    print("=" * 50)
    
    # Test 1: Health check
    test_health_check()
    
    # Test 2: Initialisation paiement
    paiement_result = test_initier_paiement()
    
    if paiement_result and paiement_result.get("success"):
        reference = paiement_result["data"]["reference_notchpay"]
        
        # Test 3: Vérification paiement
        test_verifier_paiement(reference)
    
    # Test 4: Historique utilisateur
    test_historique_utilisateur()
    
    print("\n" + "=" * 50)
    print("✅ Tests terminés !")

if __name__ == "__main__":
    main()
