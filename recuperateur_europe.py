import requests
import json

# 🎯 URL du snapshot complet de toutes les stations d'Allemagne (fourni par Tankerkönig)
URL_DUMP_ALLEMAGNE = "https://creativecommons.tankerkoenig.de/json/jsonAllStations.php"

def collecter_toute_l_allemagne():
    print("📡 Téléchargement de la base de données globale Allemagne...")
    try:
        # On télécharge TOUTES les stations d'un coup
        response = requests.get(URL_DUMP_ALLEMAGNE)
        if response.status_code == 200:
            data = response.json()
            
            if not data.get("ok"):
                print("⚠️ L'API Tankerkönig a renvoyé une erreur ou le dump est indisponible.")
                return

            stations_normalisees = []
            stations_brutes = data.get("stations", [])
            
            print(f"📦 Traitement et normalisation de {len(stations_brutes)} stations...")

            # Le dump Tankerkönig est souvent structuré sous forme de dictionnaire { id: data }
            # ou de liste. On gère les deux cas pour être Safe :
            items = stations_brutes.values() if isinstance(stations_brutes, dict) else stations_brutes

            for st in items:
                nom_station = st.get("name", "Station Allemande").strip()
                rue = st.get("street", "").strip()
                ville = st.get("place", "").strip()
                code_postal = str(st.get("postCode", "")).strip() if st.get("postCode") else None

                # Calcul des prix si présents (dans le dump global, les clés peuvent varier 
                # ou être à zéro si la station est fermée)
                gz = float(st["diesel"]) if st.get("diesel") and float(st["diesel"]) > 0 else None
                p95 = float(st["e5"]) if st.get("e5") and float(st["e5"]) > 0 else None
                e10 = float(st["e10"]) if st.get("e10") and float(st["e10"]) > 0 else None

                # On injecte la structure commune stricte (avec de vrais floats)
                stations_normalisees.append({
                    "n": nom_station,
                    "a": rue if rue else nom_station,
                    "v": ville,
                    "cp": code_postal,
                    "lt": float(st["lat"]) if st.get("lat") is not None else None,
                    "ln": float(st["lng"]) if st.get("lng") is not None else None,
                    "gz": gz,
                    "95": p95,
                    "e10": e10,
                    "98": None # Non présent sur ce flux standard
                })

            # Sauvegarde du fichier complet pour script_live.js
            with open("stationallemagne.json", "w", encoding="utf-8") as f:
                json.dump(stations_normalisees, f, ensure_ascii=False, indent=2)
            
            print(f"🚀 Mission accomplie : {len(stations_normalisees)} stations allemandes prêtes pour le script JS !")
            
        else:
            print(f"❌ Erreur de connexion avec l'API (Status: {response.status_code})")
            
    except Exception as e:
        print(f"❌ Échec de la centralisation Allemagne : {e}")

if __name__ == "__main__":
    collecter_toute_l_allemagne()
