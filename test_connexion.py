"""
test_connexion.py — Lance ce fichier pour vérifier que tout marche
Commande : python test_connexion.py
"""

from database import engine,SessionLocal
from sqlalchemy import text

print("🔄 Test de connexion à Clever Cloud...")

try:
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
        print("✅ Connexion réussie !")

        tables = conn.execute(text("SHOW TABLES"))
        table_list = [row[0] for row in tables]
        print(f"✅ {len(table_list)} tables : {', '.join(table_list)}")

        count = conn.execute(text("SELECT COUNT(*) FROM utilisateur"))
        print(f"✅ {count.scalar()} utilisateur(s) dans la BDD")

    print("\n🎉 TOUT EST BON ! Tu peux continuer.")

except Exception as e:
    print(f"❌ Erreur : {e}")
    print("\n💡 Vérifie que :")
    print("   1. Le fichier .env est dans le même dossier")
    print("   2. L'URL de connexion est correcte")
    print("   3. Tu as installé les dépendances : pip install -r requirements.txt")
