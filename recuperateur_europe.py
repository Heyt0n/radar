import requests
import json

# 🎯 Configuration pour la zone frontalière allemande (Exemple centré sur l'Alsace du Nord)
# Rayon de 30km autour d'un point central frontalier pour capter toutes les stations utiles
LAT_CENTRE = "48.95"  
LNG_CENTRE = "8.05"
RAYON = "30"
API_KEY = "00000000-0000-0000-0000-000000000002" # À remplacer par ta clé gratuite

URL_ALLEMAGNE = f"https://creativecommons.tankerkoenig.de/json/list.php?lat={LAT_CENTRE}&lng={LNG_CENTRE}&rad={RAYON}&type=all&apikey={API_KEY}"

def collecter_allemagne():
    print("📡 Connexion au vecteur Allemagne...")
    try:
        response = requests.get(URL_ALLEMAGNE)
        if response.status_code == 200:
            data = response.json()
            
            if not data.get("ok"):
                print("⚠️ L'API Tankerkönig a renvoyé une erreur.")
                return

            stations_normalisees = []
            
            # On boucle sur les stations allemandes reçues
            for st in data.get("stations", []):
                
                # 🟢 NORMALISATION ET NETTOYAGE DES EMPLACEMENTS
                # Tankerkönig sépare déjà la rue et la ville, on en profite pour injecter
                # les bonnes clés correspondantes au format français.
                nom_station = st.get("name", "Station Allemande").strip()
                rue = st.get("street", "").strip()
                ville = st.get("place", "").strip()
                code_postal = str(st.get("postCode", "")).strip() if st.get("postCode") else None

                # On convertit les coordonnées et les prix directement en FLOAT (sans guillemets)
                # S'ils sont manquants ou égaux à False, on met None (null en JSON)
                stations_normalisees.append({
                    "n": nom_station,
                    "a": rue if rue else nom_station, # Repli sur le nom si la rue est vide
                    "v": ville,
                    "cp": code_postal,
                    "lt": float(st["lat"]) if st.get("lat") is not None else None,
                    "ln": float(st["lng"]) if st.get("lng") is not None else None,
                    "gz": float(st["diesel"]) if st.get("diesel") else None,
                    "95": float(st["e5"]) if st.get("e5") else None,
                    "e10": float(st["e10"]) if st.get("e10") else None,
                    "98": None # L'API de base Tankerkönig ne renvoie pas le SP98 sur ce endpoint list
                })

            # Sauvegarde dans le fichier lu par international.js (ou script_live.js)
            # ATTENTION : J'ai gardé le nom que tu as écrit dans ton script (stations_allemagne.json)
            # Ajuste-le en "stationallemagne.json" si c'est exactement ce que ton JS attend.
            with open("stationallemagne.json", "w", encoding="utf-8") as f:
                json.dump(stations_normalisees, f, ensure_ascii=False, indent=2)
            
            print(f"✅ Extraction réussie : {len(stations_normalisees)} stations allemandes synchronisées au format commun.")
            
    except Exception as e:
        print(f"❌ Échec de la mission Allemagne : {e}")

if __name__ == "__main__":
    collecter_allemagne()
