import requests
import json
import os

# 🎯 Configuration officielle de l'API Tankerkönig
API_KEY = "d78ad147-929f-48ec-9e96-b45d0256f48b"
# Coordonnées centrées pour englober la zone frontalière (Rayon 40km)
LATITUDE = "48.95"
LONGITUDE = "8.05"
RAYON_KM = "40"

URL_TANKERKOENIG = f"https://creativecommons.tankerkoenig.de/json/list.php?lat={LATITUDE}&lng={LONGITUDE}&rad={RAYON_KM}&type=all&apikey={API_KEY}"

def collecter_zone_frontaliere_definitive():
    print("📡 Connexion à l'API officielle Tankerkönig (Allemagne)...")
    try:
        # Requête avec timeout pour éviter les blocages sur GitHub Actions
        response = requests.get(URL_TANKERKOENIG, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            if not data.get("ok"):
                print(f"⚠️ L'API a renvoyé une erreur. Message : {data.get('message', 'Inconnu')}")
                return

            stations_normalisees = []
            stations_brutes = data.get("stations", [])
            
            print(f"📦 Traitement de {len(stations_brutes)} stations frontalières trouvées...")

            for st in stations_brutes:
                nom_station = st.get("name", "Station Allemande").strip()
                rue = st.get("street", "").strip()
                ville = st.get("place", "").strip()
                code_postal = str(st.get("postCode", "")).strip() if st.get("postCode") else None
                
                # Extraction et conversion des coordonnées
                try:
                    lat = float(st["lat"]) if st.get("lat") is not None else None
                    ln = float(st["lng"]) if st.get("lng") is not None else None
                except (ValueError, TypeError):
                    continue

                if lat is None or ln is None:
                    continue

                # Normalisation des prix (Filtre les booléens ou valeurs <= 0)
                gz = float(st["diesel"]) if st.get("diesel") and not isinstance(st["diesel"], bool) and float(st["diesel"]) > 0 else None
                p95 = float(st["e5"]) if st.get("e5") and not isinstance(st["e5"], bool) and float(st["e5"]) > 0 else None
                e10 = float(st["e10"]) if st.get("e10") and not isinstance(st["e10"], bool) and float(st["e10"]) > 0 else None

                # Tracker pour voir si tes cibles favorites remontent bien dans les logs GitHub
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
                    "98": None  # Le flux standard Tankerkönig ne sépare pas nativement le SP98 (E5 = SP95)
                })

            # 💾 Sauvegarde automatique au bon emplacement absolu
            dossier_actuel = os.path.dirname(os.path.abspath(__file__))
            chemin_fichier_final = os.path.join(dossier_actuel, "stations_allemagne.json")
            
            with open(chemin_fichier_final, "w", encoding="utf-8") as f:
                json.dump(stations_normalisees, f, ensure_ascii=False, indent=2)
            
            print(f"✅ Fichier '{chemin_fichier_final}' mis à jour avec succès.")
            print(f"📊 Nombre total de stations prêtes pour le radar : {len(stations_normalisees)}")
            
        else:
            print(f"❌ Impossible de joindre l'API (Code statut: {response.status_code})")
            
    except Exception as e:
        print(f"❌ Échec critique lors de l'exécution : {e}")

if __name__ == "__main__":
    collecter_zone_frontaliere_definitive()
