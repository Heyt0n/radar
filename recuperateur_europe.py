import requests
import json
import os

# 🎯 Configuration : Rayon étendu à 40km pour englober Freistett et le bassin frontalier
URL_MTSK_PUBLIC = "https://creativecommons.tankerkoenig.de/json/list.php?lat=48.95&lng=8.05&rad=40&type=all&apikey=00000000-0000-0000-0000-000000000002"

def collecter_zone_frontaliere_definitive():
    print("📡 Connexion au flux public MTS-K (Allemagne)...")
    try:
        # Requétrage avec un timeout de 10 secondes pour éviter les blocages réseau
        response = requests.get(URL_MTSK_PUBLIC, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            if not data.get("ok"):
                print("⚠️ Le serveur MTS-K a renvoyé une erreur de validation.")
                return

            stations_normalisees = []
            stations_brutes = data.get("stations", [])
            
            print(f"📦 Traitement de {len(stations_brutes)} stations frontalières...")

            for st in stations_brutes:
                nom_station = st.get("name", "Station Allemande").strip()
                rue = st.get("street", "").strip()
                ville = st.get("place", "").strip()
                code_postal = str(st.get("postCode", "")).strip() if st.get("postCode") else None
                
                # Extraction sécurisée des coordonnées géographiques
                try:
                    lat = float(st["lat"]) if st.get("lat") is not None else None
                    ln = float(st["lng"]) if st.get("lng") is not None else None
                except (ValueError, TypeError):
                    continue

                if lat is None or ln is None:
                    continue

                # Normalisation des prix (Filtre les valeurs aberrantes, à zéro ou les booléens)
                gz = float(st["diesel"]) if st.get("diesel") and not isinstance(st["diesel"], bool) and float(st["diesel"]) > 0 else None
                p95 = float(st["e5"]) if st.get("e5") and not isinstance(st["e5"], bool) and float(st["e5"]) > 0 else None
                e10 = float(st["e10"]) if st.get("e10") and not isinstance(st["e10"], bool) and float(st["e10"]) > 0 else None

                # Traqueur de cible pour valider le bon fonctionnement dans ton terminal
                if "freistett" in ville.lower() or "rheinau" in ville.lower() or "freistett" in nom_station.lower():
                    print(f"🎯 CIBLE TROUVÉE : {nom_station} à {ville} (Gazole: {gz}€ | E10: {e10}€)")

                stations_normalisees.append({
                    "n": nom_station,
                    "a": rue if rue else nom_station,
                    "v": ville,
                    "cp": code_postal,
                    "lt": lat,
                    "ln": ln,
                    "gz": gz,
                    "95": p95,
                    "e10": e10,
                    "98": None
                })

            # 💾 CALCUL DU CHEMIN ABSOLU (Évite les erreurs de dossiers de terminaux)
            dossier_actuel = os.path.dirname(os.path.abspath(__file__))
            chemin_fichier_final = os.path.join(dossier_actuel, "stations_allemagne.json")
            
            # Écriture propre du JSON formaté
            with open(chemin_fichier_final, "w", encoding="utf-8") as f:
                json.dump(stations_normalisees, f, ensure_ascii=False, indent=2)
            
            print(f"✅ Fichier mis à jour avec succès : {chemin_fichier_final}")
            print(f"📊 Nombre de stations prêtes : {len(stations_normalisees)}")
        else:
            print(f"❌ Impossible de joindre le serveur (Code statut: {response.status_code})")
            
    except Exception as e:
        print(f"❌ Échec critique de la synchronisation : {e}")

if __name__ == "__main__":
    collecter_zone_frontaliere_definitive()
