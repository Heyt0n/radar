// ==========================================
// 1. CONFIGURATION DES SOURCES & ÉTAT GLOBAL
// ==========================================
const API_URL = "stations_france.json"; 

const DEF_LAT = 48.71;
const DEF_LON = 7.82;
const RAYON_KM = 15; 

let stationsGlobales = [];
let dernierePosition = { lat: DEF_LAT, lon: DEF_LON };
let maPositionReelle = { lat: DEF_LAT, lon: DEF_LON }; 
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

function extraireVraiNom(station) {
    let nomBrut = station.n || "";
    let ville = station.v || "";
    
    if (!nomBrut || nomBrut.toLowerCase().trim() === "station" || nomBrut.length < 3) {
        let marque = "Station";
        let adresse = (station.a || "").toLowerCase();
        
        if (adresse.includes("total")) marque = "Total";
        else if (adresse.includes("leclerc")) marque = "E.Leclerc";
        else if (adresse.includes("carrefour")) marque = "Carrefour";
        else if (adresse.includes("intermarche")) marque = "Intermarché";
        else if (adresse.includes("systeme u") || adresse.includes("super u")) marque = "Super U";
        else if (adresse.includes("auchan")) marque = "Auchan";
        else if (adresse.includes("esso")) marque = "Esso";
        else if (adresse.includes("avanti")) marque = "Avanti";
        else if (adresse.includes("bp ")) marque = "BP";
        
        return ville ? `${marque} - ${ville}` : `${marque} Indépendante`;
    }
    
    if (ville && !nomBrut.toLowerCase().includes(ville.toLowerCase())) {
        return `${nomBrut} - ${ville}`;
    }
    
    return nomBrut;
}

function formatPrix(valeur) {
    if (valeur === undefined || valeur === null || isNaN(valeur) || valeur === 0) return null;
    return parseFloat(valeur);
}

// ==========================================
// 3. MOTEUR TACTIQUE : GESTION DES FAVORIS MULTI-ZONES
// ==========================================
function basculerFavori(nom, lat, lon) {
    const index = favoris.findIndex(f => f.nom === nom);
    if (index === -1) {
        favoris.push({ nom, lat, lon });
    } else {
        favoris.splice(index, 1);
    }
    localStorage.setItem('radar_favoris', JSON.stringify(favoris));
    
    // Crucial : On rafraîchit la carte ET le panneau pour appliquer le changement visuel immédiatement
    fetchLiveStations(dernierePosition.lat, dernierePosition.lon);
}

function afficherFavoris() {
    const conteneur = document.getElementById('liste-favoris');
    if (!conteneur) return;
    
    if (favoris.length === 0) {
        conteneur.innerHTML = `<p style="font-size: 11px; color: var(--texte-secondaire); text-align: center; font-style: italic;">Aucune station en favori.</p>`;
        return;
    }
    
    const selectElem = document.getElementById('select-carburant');
    const carburantActif = selectElem ? selectElem.value : 'gz';
    
    conteneur.innerHTML = '';
    
    favoris.forEach(f => {
        const stationDataLive = stationsGlobales.find(s => latCentree(s.lt, f.lat) && lonCentree(s.ln, f.lon)) || 
                                stationsGlobales.find(s => extraireVraiNom(s) === f.nom);
        
        let affichagePrix = "Rupture";
        if (stationDataLive) {
            let prix = formatPrix(stationDataLive[carburantActif]);
            if (prix) affichagePrix = `${prix.toFixed(3)} €`;
        }
        
        const item = document.createElement('div');
        item.className = 'favori-item';
        item.style.cursor = 'pointer';
        item.style.marginBottom = '8px';
        
        item.innerHTML = `
            <div style="flex: 1; display: flex; justify-content: space-between; align-items: center; padding-right: 8px;" onclick="map.setView([${f.lat}], [${f.lon}], 14); fetchLiveStations(${f.lat}, ${f.lon});">
                <span style="font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:160px; font-size:11px;">${f.nom}</span>
                <b style="font-family:'JetBrains Mono', monospace; font-size:12px; color:var(--accent-vert);">${affichagePrix}</b>
            </div>
            <button onclick="event.stopPropagation(); basculerFavori('${f.nom.replace(/'/g, "\\'")}', ${f.lat}, ${f.lon});" style="background:none; border:none; color:var(--accent-rouge); cursor:pointer; font-weight:bold; font-size:14px; padding: 0 5px;">✕</button>
        `;
        conteneur.appendChild(item);
    });
}

function latCentree(l1, l2) { return Math.abs(parseFloat(l1) - parseFloat(l2)) < 0.005; }
function lonCentree(l1, l2) { return Math.abs(parseFloat(l1) - parseFloat(l2)) < 0.005; }

// ==========================================
// 4. FONCTION RECHERCHE DE VILLE (GEOCODING)
// ==========================================
async function rechercherVille() {
    const input = document.getElementById('search-ville');
    if (!input || !input.value.trim()) return;
    
    const query = input.value.trim();
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=fr&limit=1`);
        const data = await response.json();
        
        if (data && data.length > 0) {
            const newLat = parseFloat(data[0].lat);
            const newLon = parseFloat(data[0].lon);
            
            map.setView([newLat, newLon], 12);
            fetchLiveStations(newLat, newLon);
        } else {
            alert("Ville introuvable. Veuillez vérifier l'orthographe.");
        }
    } catch (e) { console.error("Erreur de recherche de ville :", e); }
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

        // Nettoyage de la carte avant re-génération
        map.eachLayer((layer) => {
            if (layer instanceof L.Marker) map.removeLayer(layer);
        });

        // Calcul du prix min/max uniquement dans la zone active (15 km)
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

        // Affichage des stations
        stationsGlobales.forEach(station => {
            let lat = station.lt;
            let lon = station.ln;

            if (lat && lon) {
                let distance = getDistance(centerLat, centerLon, lat, lon);
                let vraiNomStation = extraireVraiNom(station);
                
                // Détection : Est-ce que cette station fait partie de mes favoris ?
                const estFavori = favoris.some(f => f.nom === vraiNomStation);

                // CONDITION : On l'affiche si elle est dans le rayon de 15km OU si c'est un favori permanent
                if (distance <= RAYON_KM || estFavori) {
                    const pGazole = formatPrix(station.gz);
                    const pSp95   = formatPrix(station["95"]);
                    const pE10    = formatPrix(station.e10);
                    const pSp98   = formatPrix(station["98"]);
                    let prixCourant = formatPrix(station[carburantActif]);

                    // Choix de la couleur : Si c'est un favori hors-zone ou dans la zone, on met une icône OR (jaune)
                    let couleurMarker = 'blue'; 
                    if (estFavori) {
                        couleurMarker = 'orange'; // Couleur Or/Orange pour identifier tes cibles favorites
                    } else if (prixCourant && prixMin !== Infinity && prixMax !== -Infinity && prixMin !== prixMax) {
                        if (prixCourant === prixMin) couleurMarker = 'green'; 
                        else if (prixCourant === prixMax) couleurMarker = 'red'; 
                    }

                    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}&query_place_id=${encodeURIComponent(vraiNomStation)}`;
                    const marker = L.marker([lat, lon], { icon: creerIconeMarqueur(couleurMarker) }).addTo(map);

                    const afficherLignePrix = (label, prix, code) => {
                        const styleHighlight = (carburantActif === code) ? 'background:#374151; padding:2px 5px; border-radius:4px; font-weight:bold; color:#22c55e;' : '';
                        return `<div style="display:flex; justify-content:space-between; margin-bottom:5px; ${styleHighlight}"><span>${label} :</span><b>${prix ? prix.toFixed(3) + ' €' : 'Rupture'}</b></div>`;
                    };

                    const texteBoutonFavori = estFavori ? "⭐ Enlever des Favoris" : "⭐ Ajouter aux Favoris";
                    const couleurBoutonFavori = estFavori ? "#ef4444" : "#22c55e";

                    marker.bindPopup(`
                        <div style="background:#1f2937; color:white; padding:12px; border-radius:12px; font-family:sans-serif; min-width:220px;">
                            <h4 style="margin:0 0 2px 0; color:#eab308; text-transform:uppercase; font-size:13px; font-weight:bold;">${estFavori ? '⭐ ' : ''}${vraiNomStation}</h4>
                            <p style="margin:0 0 4px 0; font-size:11px; color:#9ca3af;">${station.a || ''} (${station.v || ''})</p>
                            <p style="margin:0 0 10px 0; font-size:11px; color:#3b82f6; font-weight:bold;">📍 À ${distance.toFixed(1)} km de ta recherche</p>
                            
                            <div style="border-top:1px solid #374151; padding-top:8px; font-size:13px; font-family:monospace; margin-bottom:12px;">
                                ${afficherLignePrix('Gazole', pGazole, 'gz')}
                                ${afficherLignePrix('SP95-E10', pE10, 'e10')}
                                ${afficherLignePrix('SP95', pSp95, '95')}
                                ${afficherLignePrix('SP98', pSp98, '98')}
                            </div>

                            <button onclick="basculerFavori('${vraiNomStation.replace(/'/g, "\\'")}', ${lat}, ${lon});" style="width:100%; background:${couleurBoutonFavori}; color:white; border:none; padding:8px; border-radius:6px; font-weight:bold; font-size:11px; text-transform:uppercase; cursor:pointer; margin-bottom:6px;">${texteBoutonFavori}</button>
                            <a href="${googleMapsUrl}" target="_blank" style="display:block; text-align:center; background:#3b82f6; color:white; padding:8px; border-radius:6px; text-decoration:none; font-size:11px; font-weight:bold; text-transform:uppercase;">🗺️ Itinéraire Maps</a>
                        </div>
                    `);
                }
            }
        });
        
        afficherFavoris();
    } catch (e) { console.error("Erreur filtrage carte :", e); }
}

// ==========================================
// 6. INITIALISATION DES ÉCOUTEURS
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    afficherFavoris(); 

    const selectElem = document.getElementById('select-carburant');
    if (selectElem) {
        selectElem.addEventListener('change', () => {
            fetchLiveStations(dernierePosition.lat, dernierePosition.lon);
        });
    }

    const btnSearch = document.getElementById('btn-search');
    if (btnSearch) btnSearch.addEventListener('click', rechercherVille);
    
    const inputSearch = document.getElementById('search-ville');
    if (inputSearch) {
        inputSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') rechercherVille();
        });
    }

    const btnReset = document.getElementById('btn-reset');
    if (btnReset) {
        btnReset.addEventListener('click', () => {
            if (inputSearch) inputSearch.value = ''; 
            map.setView([maPositionReelle.lat, maPositionReelle.lon], 11);
            fetchLiveStations(maPositionReelle.lat, maPositionReelle.lon);
        });
    }
});

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

window.basculerFavori = basculerFavori;

// ==========================================
// 7. CONTRÔLE DU VOLET MENU BURGER COULISSANT
// ==========================================
function toggleBurgerMenu() {
    const menu = document.getElementById('burgerMenu');
    const overlay = document.getElementById('menuOverlay');
    
    if (menu && overlay) {
        menu.classList.toggle('open');
        overlay.classList.toggle('active');
    }
}
// Rend la fonction disponible pour le clic sur le bouton HTML
window.toggleBurgerMenu = toggleBurgerMenu;
