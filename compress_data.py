import requests
import json

# URL officielle du flux instantané complet de l'État
URL_FLUX_ETAT = "https://files.transport.data.gouv.fr/marches-publics/prix-carburants/prix-des-carburants-en-france-flux-instantane-v2.json"

def compresser_flux_national():
    print("🛰️ Récupération du flux national complet (Brut)...")
    try:
        # Timeout de 60s car le fichier de l'État est très lourd
        response = requests.get(URL_FLUX_ETAT, timeout=60)
        response.raise_for_status()
        toutes_les_stations = response.json()
        print(f"✅ Fichier reçu. Stations détectées : {len(toutes_les_stations)}")
    except Exception as e:
        print(f"❌ Échec de la liaison avec le serveur d'État : {e}")
        return

    stations_compressees = []

    print("⚡ Nettoyage et compression en cours...")
    for station in toutes_les_stations:
        # Extraction sécurisée des coordonnées géographiques
        geom = station.get('geom', {})
        lat = geom.get('lat') or station.get('latitude')
        lon = geom.get('lon') or station.get('longitude')
        
        # On ne garde la station que si elle est correctement géolocalisée
        if lat and lon:
            # Extraction et formatage direct des prix au centime près
            gazole = station.get('gazole_prix')
            sp95 = station.get('sp95_prix')
            e10 = station.get('e10_prix')
            sp98 = station.get('sp98_prix')
            
            # Optionnel : On évite de charger des stations fantômes qui n'ont aucun prix disponible
            if not any([gazole, sp95, e10, sp98]):
                continue

            station_propre = {
                "n": station.get('nom') or station.get('marque') or "Station",
                "a": station.get('adresse') or "",
                "v": station.get('ville') or "",
                "cp": station.get('cp') or "",
                "lt": float(lat),
                "ln": float(lon),
                "gz": float(gazole) if gazole else None,
                "95": float(sp95) if sp95 else None,
                "e10": float(e10) if e10 else None,
                "98": float(sp98) if sp98 else None
            }
            stations_compressees.append(station_propre)

    # Sauvegarde du fichier compressé de la France entière
    fichier_sortie = "stations_france.json"
    with open(fichier_sortie, 'w', encoding='utf-8') as f:
        # On l'enregistre de façon compacte (sans espaces inutiles) pour gagner un max de poids
        json.dump(stations_compressees, f, ensure_ascii=False, separators=(',', ':'))
        
    print(f"🎯 Compression terminée avec succès !")
    print(f"📦 {len(stations_compressees)} stations packagées pour le site web.")
    print(f"💾 Fichier prêt : {fichier_sortie}")

if __name__ == "__main__":
    compresser_flux_national()
