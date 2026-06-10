import requests
import json
import time
from supabase import create_client, Client

# =========================================================================
# CONFIGURATION SUPABASE
# =========================================================================
SUPABASE_URL = "https://vyrnkiedotmwrzoigziq.supabase.co"
SUPABASE_KEY = "sb_publishable_96x0oNLDI14j_wrJdrdrRA_PfUCe..." # Pense à mettre ta clé entière ici

# Initialisation du client Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Liens officiels (Principal + Secours)
URL_PRINCIPALE = "https://files.transport.data.gouv.fr/marches-publics/prix-carburants/prix-des-carburants-en-france-flux-instantane-v2.json"
URL_SECOURS = "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/exports/json"

def telecharger_avec_retry():
    for url in [URL_PRINCIPALE, URL_SECOURS]:
        print(f"🛰️ Tentative de connexion au serveur : {url}")
        for tentative in range(3):
            try:
                headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
                response = requests.get(url, headers=headers, timeout=90)
                if response.status_code == 200:
                    print("🎯 Flux verrouillé et téléchargé avec succès !")
                    return response.json()
            except Exception as e:
                print(f"⚠️ Tentative {tentative + 1}/3 échouée... Nouvelle tentative dans 5s.")
                time.sleep(5)
    return None

def sauvegarder_si_changement(id_station, nom_station, carburant, nouveau_prix):
    """
    Vérifie le dernier prix enregistré dans Supabase pour ce carburant précis.
    Si le prix a changé ou s'il n'existe pas, on l'ajoute à l'historique.
    """
    if nouveau_prix is None:
        return

    try:
        # Récupération du tout dernier point en base pour cette station et ce carburant
        reponse = supabase.table("historique_prix") \
            .select("prix") \
            .eq("id_station", id_station) \
            .eq("carburant", carburant) \
            .order("horodatage", descending=True) \
            .limit(1) \
            .execute()

        donnees = reponse.data
        
        # Règle anti-redondance : Si la base est vide ou si le prix est différent, on injecte
        if not donnees or float(donnees[0]['prix']) != float(nouveau_prix):
            donnees_insertion = {
                "id_station": id_station,
                "nom_station": nom_station,
                "carburant": carburant,
                "prix": float(nouveau_prix)
            }
            supabase.table("historique_prix").insert(donnees_insertion).execute()
            print(f"📈 [MàJ] {nom_station} ({carburant}) : Nouveau prix détecté -> {nouveau_prix} €")
    except Exception as e:
        print(f"⚠️ Erreur lors de la synchronisation Supabase pour {id_station}: {e}")

def compresser_et_historiser():
    toutes_les_stations = telecharger_avec_retry()
    
    if not toutes_les_stations:
        print("❌ Échec critique : Impossible de joindre les serveurs de l'État.")
        return

    print(f"✅ Données reçues ({len(toutes_les_stations)} lignes). Traitement des prix...")
    stations_compressees = []

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
            
            if not any([gazole, sp95, e10, sp98]):
                continue

            nom = station.get('nom') or station.get('marque') or "Station"
            id_unique_station = f"{f_lat}_{f_lon}"

            # Module anti-redondance Supabase
            sauvegarder_si_changement(id_unique_station, nom, 'gz', gazole)
            sauvegarder_si_changement(id_unique_station, nom, '95', sp95)
            sauvegarder_si_changement(id_unique_station, nom, 'e10', e10)
            sauvegarder_si_changement(id_unique_station, nom, '98', sp98)

            # Structure locale allégée pour la carte
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

    # Mise à jour du fichier local
    fichier_sortie = "stations_france.json"
    with open(fichier_sortie, 'w', encoding='utf-8') as f:
        json.dump(stations_compressees, f, ensure_ascii=False, separators=(',', ':'))
        
    print(f"📦 Opération terminée avec succès. Fichier local actualisé ({len(stations_compressees)} stations).")

# =========================================================================
# BOUCLE D'AUTOMATISATION PRINCIPALE (M30 TRACKER)
# =========================================================================
if __name__ == "__main__":
    print("🚀 Tracker national enclenché. Scan du marché toutes les 30 minutes...")
    
    while True:
        try:
            print(f"\n⏰ [Cycle {time.strftime('%H:%M:%S')}] Lancement du scan...")
            compresser_et_historiser()
        except Exception as e:
            print(f"❌ Erreur inattendue durant le cycle : {e}")
        
        # Le script dort pendant 30 minutes (1800 secondes) puis redémarre tout seul
        print("⏳ Tout est à jour. En veille pour 30 minutes...")
        time.sleep(1800)
