// ==========================================
// 1. CONFIGURATION DES SOURCES
// ==========================================
const API_URL = "stations_france.json"; 

// Position par défaut si l'utilisateur refuse la géolocalisation (Secteur Hœrdt / Haguenau)
const DEF_LAT = 48.71;
const DEF_LON = 7.82;
const RAYON_KM = 15; // Filtre de zone à 15km

// ==========================================
// 2. INITIALISATION DE LA CARTE
// ==========================================
var map = L.map('map', { zoomControl: false }).setView([DEF_LAT, DEF_LON], 11);

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; CARTO &copy; OpenStreetMap'
}).addTo(map);

// Fonction de calcul de distance (Haversine) - SÉCURISÉE ET CORRIGÉE
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Rayon de la Terre en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// ==========================================
// 3. CHARGEMENT ET FILTRAGE DES STATIONS
// ==========================================
async function fetchLiveStations(centerLat, centerLon) {
    try {
        console.log("Radar : Lecture du fichier compressé national...");
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Fichier stations_france.json introuvable');
        
        const stations = await response.json();
        console.log(`Radar : ${stations.length} stations chargées depuis le fichier local.`);

        // Nettoyage des anciens marqueurs
        map.eachLayer((layer) => {
            if (layer instanceof L.Marker) map.removeLayer(layer);
        });

        // Sécurisation du formatage des prix (gère proprement les ruptures de stock)
        const formatPrix = (valeur) => {
            if (valeur === undefined || valeur === null || isNaN(valeur) || valeur === 0) return "N.C";
            return parseFloat(valeur).toFixed(3) + " €";
        };

        let compteur = 0;
        let prixLePlusEleve = 0;
        let stationLaPlusChereNom = "Aucune";

        // Premier passage rapide : Détection de la station la plus chère du secteur (sur le Gazole)
        stations.forEach(station => {
            let lat = station.lt;
            let lon = station.ln;
            if (lat && lon) {
                let distance = getDistance(centerLat, centerLon, lat, lon);
                if (distance <= RAYON_KM && station.gz) {
                    if (station.gz > prixLePlusEleve) {
                        prixLePlusEleve = station.gz;
                        stationLaPlusChereNom = `${station.n} (${station.v})`;
                    }
                }
            }
        });

        // Affichage de la pire station dans les logs (en attendant ton intégration HTML)
        console.log(`⚠️ Alerte Secteur - Station la plus chère détectée : ${stationLaPlusChereNom} à ${prixLePlusEleve.toFixed(3)} €`);

        // Deuxième passage : Affichage des stations cibles
        stations.forEach(station => {
            let lat = station.lt;
            let lon = station.ln;

            if (lat && lon) {
                let distance = getDistance(centerLat, centerLon, lat, lon);

                if (distance <= RAYON_KM) {
                    compteur++;

                    const gazole = formatPrix(station.gz);
                    const sp95   = formatPrix(station["95"]);
                    const e10    = formatPrix(station.e10);
                    const sp98   = formatPrix(station["98"]);

                    // Génération du lien de routage GPS vers Google Maps
                    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;

                    const marker = L.marker([lat, lon]).addTo(map);
                    
                    // Liaison tactique avec ton fichier trading.js au clic sur la station
                    marker.on('click', function() {
                        if (station.gz && typeof analyserStationUnique === "function") {
                            analyserStationUnique(station.n, station.gz);
                        }
                    });

                    // Design de la popup avec indicateur de distance et bouton itinéraire
                    marker.bindPopup(`
                        <div style="background:#1f2937; color:white; padding:12px; border-radius:12px; font-family:sans-serif; min-width:220px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.5);">
                            <h4 style="margin:0 0 2px 0; color:#22c55e; text-transform:uppercase; font-size:13px; font-weight:bold;">${station.n}</h4>
                            <p style="margin:0 0 4px 0; font-size:11px; color:#9ca3af;">${station.a} (${station.v})</p>
                            <p style="margin:0 0 10px 0; font-size:11px; color:#3b82f6; font-weight:bold;">📍 À ${distance.toFixed(1)} km</p>
                            
                            <div style="border-top:1px solid #374151; padding-top:8px; font-size:13px; font-family:monospace; margin-bottom:12px;">
                                <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>Gazole :</span><b>${gazole}</b></div>
                                <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>SP95-E10 :</span><b>${e10}</b></div>
                                <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>SP95 :</span><b>${sp95}</b></div>
                                <div style="display:flex; justify-content:space-between;"><span>SP98 :</span><b>${sp98}</b></div>
                            </div>

                            <a href="${googleMapsUrl}" target="_blank" style="display:block; text-align:center; background:#3b82f6; color:white; padding:8px; border-radius:6px; text-decoration:none; font-size:11px; font-weight:bold; text-transform:uppercase; transition: background 0.2s;">🗺️ Itinéraire Google Maps</a>
                        </div>
                    `);
                }
            }
        });

        console.log(`Radar : Tactique OK. ${compteur} stations affichées dans un rayon de ${RAYON_KM}km.`);
    } catch (e) {
        console.error("Erreur filtrage carte :", e);
    }
}

// Déclenchement basé sur la géolocalisation de l'appareil
if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const userLat = position.coords.latitude;
            const userLon = position.coords.longitude;
            map.setView([userLat, userLon], 11);
            fetchLiveStations(userLat, userLon);
        },
        () => {
            fetchLiveStations(DEF_LAT, DEF_LON);
        }
    );
} else {
    fetchLiveStations(DEF_LAT, DEF_LON);
}
