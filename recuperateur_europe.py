import requests
import json

# URL du flux public MTS-K avec un rayon étendu à 40km pour englober Freistett et Baden-Baden
URL_MTSK_PUBLIC = "https://stations.tankerkoenig.de/json/list.php?lat=48.95&lng=8.05&rad=40&type=all&apikey=00000000-0000-0000-0000-000000000002"

def collecter_zone_frontaliere_definitive():
    print("📡 Connexion au flux public MTS-K (Allemagne)...")
    try:
        response = requests.get(URL_MTSK_PUBLIC)
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
                
                # Extraction sécurisée des coordonnées (on évite le crash si None)
                try:
                    lat = float(st["lat"]) if st.get("lat") is not None else None
                    ln = float(st["lng"]) if st.get("lng") is not None else None
                except (ValueError, TypeError):
                    continue

                if lat is None or ln is None:
                    continue

                # Normalisation des prix (Sécurité : si la clé est absente, True/False ou <= 0, on met None)
                gz = float(st["diesel"]) if st.get("diesel") and not isinstance(st["diesel"], bool) and float(st["diesel"]) > 0 else None
                p95 = float(st["e5"]) if st.get("e5") and not isinstance(st["e5"], bool) and float(st["e5"]) > 0 else None
                e10 = float(st["e10"]) if st.get("e10") and not isinstance(st["e10"], bool) and float(st["e10"]) > 0 else None

                # Détective de zone pour ton terminal
                if "freistett" in ville.lower() or "rheinau" in ville.lower() or "freistett" in nom_station.lower():
                    print(f"🎯 CIBLE TROUVÉE : {nom_station} à {ville} (Prix Gazole: {gz}€)")

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

            # 💾 SAUVEGARDAGE STRICT : Nom exact de ton fichier d'origine
            nom_fichier_final = "stations_allemagne.json"
            with open(nom_fichier_final, "w", encoding="utf-8") as f:
                json.dump(stations_normalisees, f, ensure_ascii=False, indent=2)
            
            print(f"✅ Le fichier '{nom_fichier_final}' a été généré avec succès ({len(stations_normalisees)} stations).")
        else:
            print(f"❌ Impossible de joindre le serveur (Code: {response.status_code})")
            
    except Exception as e:
        print(f"❌ Échec critique de la synchronisation : {e}")

if __name__ == "__main__":
    collecter_zone_frontaliere_definitive()
