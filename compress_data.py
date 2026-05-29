import requests
import json
import time

# Liens officiels (Principal + Secours)
URL_PRINCIPALE = "https://files.transport.data.gouv.fr/marches-publics/prix-carburants/prix-des-carburants-en-france-flux-instantane-v2.json"
URL_SECOURS = "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/exports/json"

def telecharger_avec_retry():
    for url in [URL_PRINCIPALE, URL_SECOURS]:
        print(f"🛰️ Tentative de connexion au serveur : {url}")
        for tentative in range(3):
            try:
                # On augmente le timeout à 90 secondes et on se fait passer pour un navigateur normal (User-Agent)
                headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
                response = requests.get(url, headers=headers, timeout=90)
                if response.status_code == 200:
                    print("🎯 Flux verrouillé et téléchargé avec succès !")
                    return response.json()
            except Exception as e:
                print(f"⚠️ Tentative {tentative + 1}/3 échouée sur ce lien... Nouvelle tentative dans 5s.")
                time.sleep(5)
    return None

def compresser_flux_national():
    toutes_les_stations = telecharger_avec_retry()
    
    if not toutes_les_stations:
        print("❌ Échec critique : Impossible de joindre les serveurs de l'État après plusieurs tentatives.")
        return

    print(f"✅ Données reçues ({len(toutes_les_stations)} lignes). Début de la compression...")
    stations_compressees = []

    for station in toutes_les_stations:
        # Gestion des deux structures possibles de l'API (v1 ou v2)
        geom = station.get('geom', {})
        lat = geom.get('lat') or station.get('latitude')
        lon = geom.get('lon') or station.get('longitude')
        
        # Si les coordonnées sont sous forme de texte collé (ex: 4896609), on corrige le tir
        if lat and lon:
            try:
                f_lat = float(lat)
                f_lon = float(lon)
                if f_lat > 180: f_lat /= 100000
                if f_lon > 180: f_lon /= 100000
            except:
                continue

            gazole = station.get('gazole_prix')
            sp95 = station.get('sp95_prix')
            e10 = station.get('e10_prix')
            sp98 = station.get('sp98_prix')
            
            if not any([gazole, sp95, e10, sp98]):
                continue

            station_propre = {
                "n": station.get('nom') or station.get('marque') or "Station",
                "a": station.get('adresse') or "",
                "v": station.get('ville') or "",
                "cp": station.get('cp') or "",
                "lt": f_lat,
                "ln": f_lon,
                "gz": float(gazole) if gazole else None,
                "95": float(sp95) if sp95 else None,
                "e10": float(e10) if e10 else None,
                "98": float(sp98) if sp98 else None
            }
            stations_compressees.append(station_propre)

    fichier_sortie = "stations_france.json"
    with open(fichier_sortie, 'w', encoding='utf-8') as f:
        json.dump(stations_compressees, f, ensure_ascii=False, separators=(',', ':'))
        
    print(f"📦 Opération réussie. {len(stations_compressees)} stations enregistrées dans stations_france.json.")

if __name__ == "__main__":
    compresser_flux_national()
