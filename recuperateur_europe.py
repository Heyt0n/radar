import requests
import json

# 🎯 Configuration pour la zone frontalière allemande (Exemple centré sur l'Alsace du Nord)
# Rayon de 30km autour d'un point central frontalier pour capter toutes les stations utiles
LAT_CENTRE = "48.95"  
LNG_CENTRE = "8.05"
RAYON = "30"
API_KEY = "TON_API_KEY_TANKERKOENIG" # À remplacer par ta clé gratuite

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
                # 🟢 NORMALISATION : On utilise EXACTEMENT tes clés françaises
                stations_normalisees.append({
                    "n": st.get("name", "Station Allemande"),
                    "lt": str(st.get("lat")),
                    "ln": str(st.get("lng")),
                    "gz": str(st.get("diesel")) if st.get("diesel") else None,
                    "95": str(st.get("e5")) if st.get("e5") else None,
                    "e10": str(st.get("e10")) if st.get("e10") else None
                })

            # Sauvegarde dans le fichier lu par international.js
            with open("stations_allemagne.json", "w", encoding="utf-8") as f:
                json.dump(stations_normalisees, f, ensure_ascii=False, indent=2)
            
            print(f"✅ Extraction réussie : {len(stations_normalisees)} stations allemandes synchronisées.")
            
    except Exception as e:
        print(f"❌ Échec de la mission Allemagne : {e}")

if __name__ == "__main__":
    collecter_allemagne()
