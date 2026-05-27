// ==========================================
// 1. CONFIGURATION DES SOURCES & ÉTAT GLOBAL
// ==========================================
const API_URL = "stations_france.json"; 

// Colle ici le lien CSV de ton Google Sheets où tu écris ton brief tous les soirs
const GOOGLE_SHEETS_COMMENTAIRE_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRlZeqlhRu75u42M8mfM5TagCXgfh-rl6ZD-qDm25Q2lSlLBYSTMBIioY_JzgdDDByohc-K2EIIuiBY/pub?output=csv"; 

const DEF_LAT = 48.71;
const DEF_LON = 7.82;
const RAYON_KM = 15; 

let stationsGlobales = [];
let dernierePosition = { lat: DEF_LAT, lon: DEF_LON };

// ==========================================
// 2. INITIALISATION DE LA CARTE (THEME SOMBRE)
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
// 3. CHARGEMENT DE TON BRIEF MACRO PERSO
// ==========================================
async function chargerBriefDuSoir() {
    try {
        if (!GOOGLE_SHEETS_COMMENTAIRE_URL || GOOGLE_SHEETS_COMMENTAIRE_URL.includes("VOTRE_URL")) return;
        
        const proxyURL = "https://api.allorigins.win/raw?url=" + encodeURIComponent(GOOGLE_SHEETS_COMMENTAIRE_URL);
        const response = await fetch(proxyURL);
        const csvText = await response.text();
        
        Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const lignes = results.data;
                if (lignes.length > 0) {
                    // On récupère la toute dernière ligne en bas de ton tableau Excel/Sheets
                    const dernierBrief = lignes[lignes.length - 1];
                    const tonTexte = dernierBrief.Commentaire || dernierBrief.commentaire || "Aucun brief disponible pour le moment.";
                    
                    // Injection directe dans ton panneau HTML
                    if(document.getElementById('sniper-comment')) {
                        document.getElementById('sniper-comment').innerText = tonTexte;
                    }
                }
            }
        });
    } catch (e) {
        console.error("Erreur chargement Brief Sheets :", e);
    }
}

// ==========================================
// 4. TRAITEMENT ET FILTRAGE DES STATIONS
// ==========================================
async function fetchLiveStations(centerLat, centerLon) {
    try {
        dernierePosition = { lat: centerLat, lon: centerLon };
        
        if (stationsGlobales.length === 0) {
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error('Fichier introuvable');
            stationsGlobales = await response.json();
        }

        const selectElem = document.getElementById('select-carburant');
        const carburantActif = selectElem ? selectElem.value : 'gz';

        map.eachLayer((layer) => {
            if (layer instanceof L.Marker) map.removeLayer(layer);
        });

        const formatPrix = (valeur) => {
            if (valeur === undefined || valeur === null || isNaN(valeur) || valeur === 0) return null;
            return parseFloat(valeur);
        };

        // SCAN DU PRIX MIN ET MAX DE TA ZONE DE 15KM
        let prixMin = Infinity;
        let prixMax = -Infinity;

        stationsGlobales.forEach(station => {
            if (station.lt && station.ln) {
                let distance = getDistance(centerLat, centerLon, station.lt, station.ln);
                if (distance <= RAYON_KM) {
                    let prix = formatPrix(station[carburantActif]);
                    if (prix) {
                        if (prix < prixMin) prixMin = prix;
                        if (prix > prixMax) prixMax = prix;
                    }
                }
            }
        });

        let compteur = 0;

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
                    
                    let prixCourant = formatPrix(station[carburantActif]);

                    // Code couleur automatique
                    let couleurMarker = 'blue'; 
                    if (prixCourant && prixMin !== Infinity && prixMax !== -Infinity && prixMin !== prixMax) {
                        if (prixCourant === prixMin) couleurMarker = 'green'; 
                        else if (prixCourant === prixMax) couleurMarker = 'red'; 
                    }

                    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}&query_place_id=${encodeURIComponent(station.n)}`;

                    const marker = L.marker([lat, lon], { icon: creerIconeMarqueur(couleurMarker) }).addTo(map);

                    const afficherLignePrix = (label, prix, code) => {
                        const styleHighlight = (carburantActif === code) ? 'background:#374151; padding:2px 5px; border-radius:4px; font-weight:bold; color:#22c55e;' : '';
                        return `<div style="display:flex; justify-content:space-between; margin-bottom:5px; ${styleHighlight}"><span>${label} :</span><b>${prix ? prix.toFixed(3) + ' €' : 'Rupture'}</b></div>`;
                    };

                    marker.bindPopup(`
                        <div style="background:#1f2937; color:white; padding:12px; border-radius:12px; font-family:sans-serif; min-width:220px;">
                            <h4 style="margin:0 0 2px 0; color:#22c55e; text-transform:uppercase; font-size:13px; font-weight:bold;">${station.n}</h4>
                            <p style="margin:0 0 4px 0; font-size:11px; color:#9ca3af;">${station.a} (${station.v})</p>
                            <p style="margin:0 0 10px 0; font-size:11px; color:#3b82f6; font-weight:bold;">📍 À ${distance.toFixed(1)} km</p>
                            
                            <div style="border-top:1px solid #374151; padding-top:8px; font-size:13px; font-family:monospace; margin-bottom:12px;">
                                ${afficherLignePrix('Gazole', pGazole, 'gz')}
                                ${afficherLignePrix('SP95-E10', pE10, 'e10')}
                                ${afficherLignePrix('SP95', pSp95, '95')}
                                ${afficherLignePrix('SP98', pSp98, '98')}
                            </div>

                            <a href="${googleMapsUrl}" target="_blank" style="display:block; text-align:center; background:#3b82f6; color:white; padding:8px; border-radius:6px; text-decoration:none; font-size:11px; font-weight:bold; text-transform:uppercase;">🗺️ Itinéraire Maps</a>
                        </div>
                    `);
                }
            }
        });

        console.log(`Radar : ${compteur} stations cartographiées.`);
    } catch (e) {
        console.error("Erreur filtrage carte :", e);
    }
}

// ==========================================
// 5. INITIALISATION DES ÉCOUTEURS
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    chargerBriefDuSoir(); // On charge ton texte dès l'ouverture de l'application
    
    const selectElem = document.getElementById('select-carburant');
    if (selectElem) {
        selectElem.addEventListener('change', () => {
            fetchLiveStations(dernierePosition.lat, dernierePosition.lon);
        });
    }
});

// Géolocalisation
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
    fetchLiveStations(DEF_LAT, DEF_LON);
}
