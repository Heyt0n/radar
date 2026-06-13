import requests
import json

# 🎯 CONFIGURATION CENTRALISÉE
PAYS_CONFIG = {
    "france": {
        "url_api": "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-temps-reel/exports/json",
        "fichier_sortie": "stations_france.json",
        "format": "FR"
    },
    "allemagne": {
        "url_api": "https://creativecommons.tankerkoenig.de/json/list.php?lat=48.91&lng=8.14&rad=25&type=all&apikey=TON_API_KEY",
        "fichier_sortie": "stations_allemagne.json",
        "format": "DE"
    }
}

def collecter_donnees():
    for pays, config in PAYS_CONFIG.items():
        print(f"📡 Extraction du vecteur : {pays}...")
        try:
            response = requests.get(config["url_api"])
            if response.status_code == 200:
                donnees_brutes = response.json()
                
                # 🟢 LE SECRET : Normaliser le format ici !
                donnees_normalisees = normaliser_donnees(donnees_brutes, config["format"])
                
                # Sauvegarde du fichier JSON correspondant
                with open(config["fichier_sortie"], "w", encoding="utf-8") as f:
                    json.dump(donnees_normalisees, f, ensure_ascii=False, indent=2)
                print(f"✅ Fichier {config['fichier_sortie']} mis à jour.")
        except Exception as e:
            print(f"⚠️ Échec sur le pays {pays} : {e}")

def normaliser_donnees(donnees, format_pays):
    stations_propres = []
    
    if format_pays == "FR":
        # Ta logique de parsing actuelle pour la France
        pass
        
    elif format_pays == "DE":
        # Ta logique pour convertir les clés allemandes (id, name, lat, lng)
        # vers tes clés standards uniques ('n', 'lt', 'ln', 'gz', '95')
        for st in donnees.get("stations", []):
            stations_propres.append({
                "n": st.get("name"),
                "lt": st.get("lat"),
                "ln": st.get("lng"),
                "gz": st.get("diesel"),
                "95": st.get("e5")
            })
            
    return stations_propres

if __name__ == "__main__":
    collecter_donnees()
