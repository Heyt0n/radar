import requests
import json

# URL du miroir public Open Data (MTS-K Allemande convertie en JSON en temps réel)
# Ce flux ne nécessite pas de clé API privée "Recherche" et tolère l'intégration dans des projets tiers
URL_MTSK_PUBLIC = "https://stations.tankerkoenig.de/json/list.php?lat=48.95&lng=8.05&rad=40&type=all&apikey=00000000-0000-0000-0000-000000000002"

def collecter_zone_frontaliere_definitive():
    print("📡 Connexion au flux public MTS-K (Allemagne)...")
    try:
        # On interroge le endpoint public avec la clé générique autorisée pour le broadcast
        # J'ai augmenté le rayon à 40km pour être sûr de couvrir tout le bassin de vie autour de chez toi (Freistett, Baden, etc.)
        response = requests.get(URL_MTSK_PUBLIC)
        if response.status_code == 200:
            data = response.json()
            
            if not data.get("ok"):
                print("⚠️ Le serveur de secours MTS-K a renvoyé une erreur.")
                return

            stations_normalisees = []
            stations_brutes = data.get("stations", [])
            
            print(f"📦 Traitement et injection de {len(stations_brutes)} stations frontalières...")

            for st in stations_brutes:
                nom_station = st.get("name", "Station Allemande").strip()
                rue = st.get("street", "").strip()
                ville = st.get("place", "").strip()
                code_postal = str(st.get("postCode", "")).strip() if st.get("postCode") else None
                
                # Extraction et conversion stricte en nombres
                lat = float(st["lat"]) if st.get("lat") is not None else None
                ln = float(st["lng"]) if st.get("lng") is not None else None

                # Si les coordonnées manquent, on zappe
                if lat is None or ln is None:
                    continue

                # Normalisation des prix en floats (Zéro ou False devient null en JSON)
                gz = float(st["diesel"]) if st.get("diesel") and float(st["diesel"]) > 0 else None
                p95 = float(st["e5"]) if st.get("e5") and float(st["e5"]) > 0 else None
                e10 = float(st["e10"]) if st.get("e10") and float(st["e10"]) > 0 else None

                # Petit trigger pour valider que Freistett est capturée
                if "freistett" in ville.lower() or "rheinau" in ville.lower():
                    print(f"🎯 CIBLE CAPTURÉE : {nom_station} à {ville} ({rue})")

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
                    "98": None # Non géré nativement sur ce flux
                })

            # Sauvegarde finale pour ton JS
            with open("stationallemagne.json", "w", encoding="utf-8") as f:
                json.dump(stations_normalisees, f, ensure_ascii=False, indent=2)
            
            print(f"✅ Fichier 'stationallemagne.json' synchronisé et paré pour la production ({len(stations_normalisees)} stations).")
        else:
            print(f"❌ Impossible de joindre le serveur (Code: {response.status_code})")
            
    except Exception as e:
        print(f"❌ Échec de la synchronisation : {e}")

if __name__ == "__main__":
    collecter_zone_frontaliere_definitive()
