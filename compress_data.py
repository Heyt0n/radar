import requests
import json
import time
from supabase import create_client, Client

# =========================================================================
# CONFIGURATION SUPABASE
# =========================================================================
SUPABASE_URL = "https://vyrnkiedotmwrzoigziq.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5cm5raWVkb3Rtd3J6b2lnemlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwOTM3NDIsImV4cCI6MjA5NTY2OTc0Mn0.VBfkO9_NGZ2JnYzvf-EztGxS2CYIF-WX9WPicHhYBUo" 

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

URL_PRINCIPALE = "https://files.transport.data.gouv.fr/marches-publics/prix-carburants/prix-des-carburants-en-france-flux-instantane-v2.json"
URL_SECOURS = "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/exports/json"

def telecharger_avec_retry():
    for url in [URL_PRINCIPALE, URL_SECOURS]:
        print(f"🛰️ Connexion au serveur : {url}")
        for tentative in range(3):
            try:
                headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
                response = requests.get(url, headers=headers, timeout=90)
                if response.status_code == 200:
                    data = response.json()
                    if data: # Si la liste n'est pas vide []
                        print("🎯 Flux national verrouillé avec succès !")
                        return data
            except Exception as e:
                print(f"⚠️ Tentative {tentative + 1}/3 échouée... Nouvelle tentative dans 5s.")
                time.sleep(5)
    return None

def compresser_et_historiser():
    toutes_les_stations = telecharger_avec_retry()
    
    if not toutes_les_stations:
        print("❌ Échec : Flux indisponible ou vide [] pour le moment.")
        return

    print(f"✅ Données reçues ({len(toutes_les_stations)} stations). Traitement en mémoire...")
    stations_compressees = []
    lot_insertions = [] # 📦 Notre panier pour envoyer tout d'un coup

    for station in toutes_les_stations:
        geom = station.get('geom', {})
        lat = geom.get('lat') or station.get('latitude')
        lon = geom.get('lon') or station.get('longitude')
        
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

            nom = station.get('nom') or station.get('marque') or "Station"
            id_unique_station = f"{f_lat}_{f_lon}"

            # Préparation des données pour Supabase (Sans faire d'appel internet immédiat)
            carburants = [('gz', gazole), ('95', sp95), ('e10', e10), ('98', sp98)]
            for code, prix in carburants:
                if prix is not None:
                    lot_insertions.append({
                        "id_station": str(id_unique_station),
                        "nom_station": str(nom),
                        "carburant": str(code),
                        "prix": float(prix)
                    })

            # Structure légère pour ton fichier carte JSON
            station_propre = {
                "n": nom,
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

    # 🔥 EXPÉDITION CHIRURGICALE EN BLOC VERS SUPABASE
    if lot_insertions:
        print(f"📈 Envoi massif de {len(lot_insertions)} lignes de prix vers Supabase...")
        try:
            # On insère tout par paquets de 2000 lignes pour ne pas saturer l'API
            pourcentage = 2000
            for i in range(0, len(lot_insertions), pourcentage):
                paquet = lot_insertions[i:i + pourcentage]
                supabase.table("historique_prix").insert(paquet).execute()
            print("⚡ Supabase mise à jour en bloc avec succès !")
        except Exception as e:
            print(f"⚠️ Erreur lors de l'envoi massif : {e}")

    # Sauvegarde locale du JSON pour l'application
    fichier_sortie = "stations_france.json"
    with open(fichier_sortie, 'w', encoding='utf-8') as f:
        json.dump(stations_compressees, f, ensure_ascii=False, separators=(',', ':'))
        
    print(f"📦 Fichier carte actualisé ({len(stations_compressees)} stations).")

if __name__ == "__main__":
    print(f"🚀 [Flux {time.strftime('%H:%M:%S')}] Déclenchement du scan rapide...")
    try:
        compresser_et_historiser()
        print("🎯 Cycle terminé.")
    except Exception as e:
        print(f"❌ Échec : {e}")
