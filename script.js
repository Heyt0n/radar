// ==========================================
// 1. CONFIGURATION DES SOURCES & ÉTAT GLOBAL
// ==========================================
const API_URL = "stations_france.json"; 

const DEF_LAT = 48.71;
const DEF_LON = 7.82;
const RAYON_KM = 15; 

let stationsGlobales = [];
let dernierePosition = { lat: DEF_LAT, lon: DEF_LON };
let maPositionReelle = { lat: DEF_LAT, lon: DEF_LON }; // Sauvegarde pour le bouton réinitialiser
let favoris = JSON.parse(localStorage.getItem('radar_favoris')) || [];

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
// 3. MOTEUR TACTIQUE : GESTION DES FAVORIS
// ==========================================
function basculerFavori(nom, lat, lon) {
    const index = favoris.findIndex(f => f.nom === nom);
    if (index === -1) {
        favoris.push({ nom, lat, lon });
    } else {
        favoris.splice(index, 1);
    }
    localStorage.setItem('radar_favoris', JSON.stringify(favoris));
    afficherFavoris();
}

function afficherFavoris() {
    const conteneur = document.getElementById('liste-favoris');
    if (!conteneur) return;
    
    if (favoris.length === 0) {
        conteneur.innerHTML = `<p style="font-size: 11px; color: var(--texte-secondaire); text-align: center; font-style: italic;">Aucune station en favori.</p>`;
        return;
    }
    
    conteneur.innerHTML = '';
    favoris.forEach(f => {
        const item = document.createElement('div');
        item.className = 'favori-item';
        item.style.cursor = 'pointer';
        item.style.marginBottom = '8px';
        
        // Clic sur le nom pour centrer la carte sur le favori
        item.innerHTML = `
            <div style="flex: 1;" onclick="map.setView([${f.lat}], [${f.lon}], 14); fetchLiveStations(${f.lat}, ${f.lon});">
                <span style="font-weight:600; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px;">${f.nom}</span>
            </div>
            <button onclick="event.stopPropagation(); basculerFavori('${f.nom.replace(/'/g, "\\'")}', ${f.lat}, ${f.lon});" style="background:none; border:none; color:var(--accent-rouge); cursor:pointer; font-weight:bold; font-size:14px; padding: 0 5px;">✕</button>
        `;
        conteneur.appendChild(item);
    });
}

// ==========================================
// 4. FONCTION RECHERCHE DE VILLE (GEOCODING)
// ==========================================
async function rechercherVille() {
    const input = document.getElementById('search-ville');
    if (!input || !input.value.trim()) return;
    
    const query = input.value.trim();
    try {
        console.log(`Radar : Recherche des coordonnées pour ${query}...`);
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=fr&limit=1`);
        const data = await response.json();
        
        if (data && data.length > 0) {
            const newLat = parseFloat(data[0].lat);
            const newLon = parseFloat(data[0].lon);
            
            console.log(`Cible verrouillée : ${query} (${newLat}, ${newLon})`);
            map.setView([newLat, newLon], 12);
            fetchLiveStations(newLat, newLon);
        } else {
            alert("Ville introuvable. Veuillez vérifier l'orthographe.");
        }
    } catch (e) {
        console.error("Erreur de recherche de ville :", e);
    }
}

// ==========================================
// 5. TRAITEMENT ET FILTRAGE DES STATIONS
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

        stationsGlobales.forEach(station => {
            let lat = station.lt;
            let lon = station.ln;

            if (lat && lon) {
                let distance = getDistance(centerLat, centerLon, lat, lon);

                if (distance <= RAYON_KM) {
                    const pGazole = formatPrix(station.gz);
                    const pSp95   = formatPrix(station["95"]);
                    const pE10    = formatPrix(station.e10);
                    const pSp98   = formatPrix(station["98"]);
                    
                    let prixCourant = formatPrix(station[carburantActif]);

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

                    // Détermination du bouton Étoile selon l'état actuel
                    const estFavori = favoris.some(f => f.nom === station.n);
                    const texteBoutonFavori = estFavori ? "⭐ Enlever des Favoris" : "⭐ Ajouter aux Favoris";
                    const couleurBoutonFavori = estFavori ? "#ef4444" : "#22c55e";

                    // Injection propre des fonctions d'ajout au clic dans la popup
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

                            <button onclick="basculerFavori('${station.n.replace(/'/g, "\\'")}', ${lat}, ${lon}); this.innerText='Validé !';" style="width:100%; background:${couleurBoutonFavori}; color:white; border:none; padding:8px; border-radius:6px; font-weight:bold; font-size:11px; text-transform:uppercase; cursor:pointer; margin-bottom:6px;">${texteBoutonFavori}</button>
                            <a href="${googleMapsUrl}" target="_blank" style="display:block; text-align:center; background:#3b82f6; color:white; padding:8px; border-radius:6px; text-decoration:none; font-size:11px; font-weight:bold; text-transform:uppercase;">🗺️ Itinéraire Maps</a>
                        </div>
                    `);
                }
            }
        });
    } catch (e) { console.error("Erreur filtrage carte :", e); }
}

// ==========================================
// 6. INITIALISATION DES ÉCOUTEURS
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    afficherFavoris(); // Chargement initial de la mémoire locale

    const selectElem = document.getElementById('select-carburant');
    if (selectElem) {
        selectElem.addEventListener('change', () => {
            fetchLiveStations(dernierePosition.lat, dernierePosition.lon);
        });
    }

    // Écouteurs pour la recherche
    const btnSearch = document.getElementById('btn-search');
    if (btnSearch) btnSearch.addEventListener('click', rechercherVille);
    
    const inputSearch = document.getElementById('search-ville');
    if (inputSearch) {
        inputSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') rechercherVille();
        });
    }

    // Bouton de réinitialisation (Retour au secteur d'Hœrdt / position réelle)
    const btnReset = document.getElementById('btn-reset');
    if (btnReset) {
        btnReset.addEventListener('click', () => {
            if (inputSearch) inputSearch.value = ''; // Nettoie le champ texte
            map.setView([maPositionReelle.lat, maPositionReelle.lon], 11);
            fetchLiveStations(maPositionReelle.lat, maPositionReelle.lon);
        });
    }
});

// Géolocalisation
if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const userLat = position.coords.latitude;
            const userLon = position.coords.longitude;
            maPositionReelle = { lat: userLat, lon: userLon };
            map.setView([userLat, userLon], 11);
            fetchLiveStations(userLat, userLon);
        },
        () => { fetchLiveStations(DEF_LAT, DEF_LON); }
    );
} else {
    fetchLiveStations(DEF_LAT, DEF_LON);
}

// Rendre la fonction accessible depuis les fenêtres Popups de Leaflet
window.basculerFavori = basculerFavori;
