// ==========================================
// 1. CONFIGURATION DES SOURCES & ETAT
// ==========================================
const API_URL = "stations_france.json"; 

const DEF_LAT = 48.71;
const DEF_LON = 7.82;
const RAYON_KM = 15; 

// On stocke les stations en mémoire globale pour pouvoir rafraîchir au changement de menu
let stationsGlobales = [];
let dernierePosition = { lat: DEF_LAT, lon: DEF_LON };

// ==========================================
// 2. INITIALISATION DE LA CARTE
// ==========================================
var map = L.map('map', { zoomControl: false }).setView([DEF_LAT, DEF_LON], 11);

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© CARTO © OpenStreetMap'
}).addTo(map);

function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Fonction pour créer des icônes Leaflet colorées personnalisées
function creerIconeMarqueur(couleur) {
    return new L.Icon({
        iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${couleur}.png`,
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });
}

// ==========================================
// 3. CHARGEMENT ET FILTRAGE DYNAMIQUE
// ==========================================
async function fetchLiveStations(centerLat, centerLon) {
    try {
        dernierePosition = { lat: centerLat, lon: centerLon };
        
        if (stationsGlobales.length === 0) {
            console.log("Radar : Acquisition du flux national...");
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error('Fichier stations_france.json introuvable');
            stationsGlobales = await response.json();
        }

        // Récupération du type de carburant sélectionné dans le menu HTML (gz, e10, 95 ou 98)
        const selectElem = document.getElementById('select-carburant');
        const carburantCible = selectElem ? selectElem.value : 'gz';

        // Nettoyage des marqueurs
        map.eachLayer((layer) => {
            if (layer instanceof L.Marker) map.removeLayer(layer);
        });

        const formatPrix = (valeur) => {
            if (valeur === undefined || valeur === null || isNaN(valeur) || valeur === 0) return null;
            return parseFloat(valeur);
        };

        // --- BALISSAGE DES PRIX MIN / MAX DANS TON RAYON ---
        let prixMin = Infinity;
        let prixMax = -Infinity;

        stationsGlobales.forEach(station => {
            if (station.lt && station.ln) {
                let distance = getDistance(centerLat, centerLon, station.lt, station.ln);
                if (distance <= RAYON_KM) {
                    let prix = formatPrix(station[carburantCible]);
                    if (prix) {
                        if (prix < prixMin) prixMin = prix;
                        if (prix > prixMax) prixMax = prix;
                    }
                }
            }
        });

        let compteur = 0;

        // --- DEUXIÈME PASSAGE : DESSIN DES CIBLES AVEC LEUR COULEUR ---
        stationsGlobales.forEach(station => {
            let lat = station.lt;
            let lon = station.ln;

            if (lat && lon) {
                let distance = getDistance(centerLat, centerLon, lat, lon);

                if (distance <= RAYON_KM) {
                    compteur++;

                    const pGazole = formatPrix(station.gz);
                    const pSp95   = formatPrix(station["95"]);
                    const pE10    = formatPrix(station.e10);
                    const pSp98   = formatPrix(station["98"]);
                    
                    let prixCourant = formatPrix(station[carburantCible]);

                    // Choix tactique de la couleur du marqueur
                    let couleurMarker = 'blue'; // Par défaut : bleu
                    if (prixCourant && prixMin !== Infinity && prixMax !== -Infinity && prixMin !== prixMax) {
                        if (prixCourant === prixMin) couleurMarker = 'green'; // Le moins cher du secteur
                        else if (prixCourant === prixMax) couleurMarker = 'red'; // Le plus cher à éviter
                    }

                    // Lien URL Google Maps corrigé et esthétique
                    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&query=${encodeURIComponent(station.n)}`;

                    const marker = L.marker([lat, lon], { icon: creerIconeMarqueur(couleurMarker) }).addTo(map);
                    
                    marker.on('click', function() {
                        if (station.gz && typeof analyserStationUnique === "function") {
                            analyserStationUnique(station.n, station.gz);
                        }
                    });

                    marker.bindPopup(`
                        <div style="background:#1f2937; color:white; padding:12px; border-radius:12px; font-family:sans-serif; min-width:220px;">
                            <h4 style="margin:0 0 2px 0; color:#22c55e; text-transform:uppercase; font-size:13px; font-weight:bold;">${station.n}</h4>
                            <p style="margin:0 0 4px 0; font-size:11px; color:#9ca3af;">${station.a} (${station.v})</p>
                            <p style="margin:0 0 10px 0; font-size:11px; color:#3b82f6; font-weight:bold;">📍 À ${distance.toFixed(1)} km</p>
                            
                            <div style="border-top:1px solid #374151; padding-top:8px; font-size:13px; font-family:monospace; margin-bottom:12px;">
                                <div style="display:flex; justify-content:space-between; margin-bottom:5px; ${carburantCible === 'gz' ? 'background:#374151; padding:2px; border-radius:4px;' : ''}"><span>Gazole :</span><b>${pGazole ? pGazole.toFixed(3)+' €' : 'N.C'}</b></div>
                                <div style="display:flex; justify-content:space-between; margin-bottom:5px; ${carburantCible === 'e10' ? 'background:#374151; padding:2px; border-radius:4px;' : ''}"><span>SP95-E10 :</span><b>${pE10 ? pE10.toFixed(3)+' €' : 'N.C'}</b></div>
                                <div style="display:flex; justify-content:space-between; margin-bottom:5px; ${carburantCible === '95' ? 'background:#374151; padding:2px; border-radius:4px;' : ''}"><span>SP95 :</span><b>${pSp95 ? pSp95.toFixed(3)+' €' : 'N.C'}</b></div>
                                <div style="display:flex; justify-content:space-between; ${carburantCible === '98' ? 'background:#374151; padding:2px; border-radius:4px;' : ''}"><span>SP98 :</span><b>${pSp98 ? pSp98.toFixed(3)+' €' : 'N.C'}</b></div>
                            </div>

                            <a href="${googleMapsUrl}" target="_blank" style="display:block; text-align:center; background:#3b82f6; color:white; padding:8px; border-radius:6px; text-decoration:none; font-size:11px; font-weight:bold; text-transform:uppercase;">🗺️ Itinéraire Maps</a>
                        </div>
                    `);
                }
            }
        });

        console.log(`Radar : Filtrage appliqué pour [${carburantCible}]. ${compteur} stations cartographiées.`);
    } catch (e) {
        console.error("Erreur filtrage carte :", e);
    }
}

// Écouteur sur le menu déroulant : recalcul automatique au changement de carburant
document.addEventListener("DOMContentLoaded", () => {
    const selectElem = document.getElementById('select-carburant');
    if (selectElem) {
        selectElem.addEventListener('change', () => {
            fetchLiveStations(dernierePosition.lat, dernierePosition.lon);
        });
    }
});

// Déclenchement initial basé sur la géolocalisation
if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const userLat = position.coords.latitude;
            const userLon = position.coords.longitude;
            map.setView([userLat, userLon], 11);
            fetchLiveStations(userLat, userLon);
        },
        () => { fetchLiveStations(DEF_LAT, DEF_LON); }
    );
} else {
    fetchLiveStations(DEF_LAT, DEF_LON);
}
