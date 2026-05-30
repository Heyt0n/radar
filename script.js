// ==========================================
// 0. SÉCURITÉ : VÉRIFICATION DE LA SESSION
// ==========================================
if (localStorage.getItem("radar_session_active") !== "true") {
    // Si l'opérateur n'est pas identifié, interception immédiate et redirection
    window.location.href = "connexion.html";
}


// ==========================================
// 1. CONFIGURATION DES SOURCES & ÉTAT GLOBAL
// ==========================================
const API_URL = "stations_france.json"; 

const DEF_LAT = 48.71;
const DEF_LON = 7.82;

// AVANT : const RAYON_KM = 15;
// MAINTENANT : On récupère le rayon du compte, s'il n'existe pas on met 15 par défaut
let RAYON_KM = parseFloat(localStorage.getItem('radar_rayon')) || 15; 

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

// Génération de l'icône avec le système de "Demi-Ping" (Badge favori sans écraser la couleur du prix)
function creerIconeMarqueur(couleur, estFavori) {
    if (estFavori) {
        // Si c'est un favori, on utilise un DivIcon pour superposer l'icône couleur et le badge ⭐
        return L.divIcon({
            html: `
                <div style="position: relative; width: 25px; height: 41px;">
                    <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${couleur}.png" style="width: 25px; height: 41px; display: block;">
                    <div style="position: absolute; top: -6px; right: -8px; background: #f97316; color: white; font-size: 10px; padding: 2px; border-radius: 50%; border: 1px solid #111827; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.5);">⭐</div>
                </div>
            `,
            className: '',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34]
        });
    }

    // Marqueur standard si pas en favori
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
    let nomBrut = (station.n || "").trim();
    let ville = (station.v || "").trim();
    let adresseBrute = (station.a || "").trim();
    
    let marque = "Station";
    let adresseMinuscule = adresseBrute.toLowerCase();
    
    // Détection de l'enseigne dans l'adresse si le nom est manquant ou générique
    if (adresseMinuscule.includes("total")) marque = "Total";
    else if (adresseMinuscule.includes("leclerc")) marque = "E.Leclerc";
    else if (adresseMinuscule.includes("carrefour")) marque = "Carrefour";
    else if (adresseMinuscule.includes("intermarche")) marque = "Intermarché";
    else if (adresseMinuscule.includes("systeme u") || adresseMinuscule.includes("super u") || adresseMinuscule.includes("u utile")) marque = "Super U";
    else if (adresseMinuscule.includes("auchan")) marque = "Auchan";
    else if (adresseMinuscule.includes("esso")) marque = "Esso";
    else if (adresseMinuscule.includes("avanti")) marque = "Avanti";
    else if (adresseMinuscule.includes("bp ")) marque = "BP";

    // Si le nom du JSON est exploitable, on l'utilise comme base, sinon on prend la marque identifiée
    let nomBase = (!nomBrut || nomBrut.toLowerCase() === "station" || nomBrut.length < 3) ? marque : nomBrut;
    
    // Formatage de l'adresse pour enlever l'enseigne répétée et garder uniquement la rue
    let rueClean = adresseBrute;
    if (rueClean.toLowerCase().startsWith(nomBase.toLowerCase())) {
        rueClean = rueClean.substring(nomBase.length).trim();
        if (rueClean.startsWith("-")) rueClean = rueClean.substring(1).trim();
    }

    // Construction d'une identité unique textuelle (Enseigne - Rue, Ville)
    let identiteUnique = nomBase;
    if (rueClean) {
        identiteUnique += ` - ${rueClean}`;
    } else if (ville) {
        identiteUnique += ` - ${ville}`;
    }
    
    return identiteUnique;
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
    
    // Synchronisation instantanée
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
            <div style="flex: 1; display: flex; justify-content: space-between; align-items: center; padding-right: 8px; min-width: 0;" onclick="map.setView([${f.lat}], ${f.lon}, 14); fetchLiveStations(${f.lat}, ${f.lon});">
                <span style="font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex: 1; font-size:11px; padding-right: 5px;" title="${f.nom}">${f.nom}</span>
                <b style="font-family:'JetBrains Mono', monospace; font-size:12px; color:var(--accent-vert); flex-shrink: 0;"></b style="font-family:'JetBrains>${affichagePrix}</b>
            </div>
            <button onclick="event.stopPropagation(); basculerFavori('${f.nom.replace(/'/g, "\\'")}', ${f.lat}, ${f.lon});" style="background:none; border:none; color:#ef4444; cursor:pointer; font-weight:bold; font-size:14px; padding: 0 5px; flex-shrink: 0;">✕</button>
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

        // Nettoyage complet
        map.eachLayer((layer) => {
            if (layer instanceof L.Marker || layer instanceof L.DivIcon) map.removeLayer(layer);
        });

        let prixMin = Infinity;
        let prixMax = -Infinity;

        // Étape 1 : Calcul des spreads de prix de la zone active
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

        // Étape 2 : Projection des cibles sur la carte
        stationsGlobales.forEach(station => {
            let lat = station.lt;
            let lon = station.ln;

            if (lat && lon) {
                let distance = getDistance(centerLat, centerLon, lat, lon);
                let vraiNomStation = extraireVraiNom(station);
                
                const estFavori = favoris.some(f => f.nom === vraiNomStation);

                if (distance <= RAYON_KM || estFavori) {
                    const pGazole = formatPrix(station.gz);
                    const pSp95   = formatPrix(station["95"]);
                    const pE10    = formatPrix(station.e10);
                    const pSp98   = formatPrix(station["98"]);
                    let prixCourant = formatPrix(station[carburantActif]);

                    // Choix dynamique de la couleur selon le positionnement de prix
                    let couleurMarker = 'blue'; 
                    if (prixCourant && prixMin !== Infinity && prixMax !== -Infinity && prixMin !== prixMax) {
                        if (prixCourant === prixMin) couleurMarker = 'green'; 
                        else if (prixCourant === prixMax) couleurMarker = 'red'; 
                    }

                    const requeteRecherche = encodeURIComponent(`${vraiNomStation}`);
const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${requeteRecherche}&query_place_id=${lat},${lon}`;
                    
                    // Injection de l'icône avec le statut favori (Pour l'affichage du badge demi-ping)
                    const marker = L.marker([lat, lon], { icon: creerIconeMarqueur(couleurMarker, estFavori) }).addTo(map);

                    const afficherLignePrix = (label, prix, code) => {
                        const styleHighlight = (carburantActif === code) ? 'background:#374151; padding:2px 5px; border-radius:4px; font-weight:bold; color:#22c55e;' : '';
                        return `<div style="display:flex; justify-content:space-between; margin-bottom:5px; ${styleHighlight}"><span>${label} :</span><b>${prix ? prix.toFixed(3) + ' €' : 'Rupture'}</b></div>`;
                    };

                    const texteBoutonFavori = estFavori ? "⭐ Enlever des Favoris" : "⭐ Ajouter aux Favoris";
                    const couleurBoutonFavori = estFavori ? "#ef4444" : "#22c55e";

                    marker.bindPopup(`
                        <div style="background:#1f2937; color:white; padding:12px; border-radius:12px; font-family:sans-serif; min-width:240px;">
                            <h4 style="margin:0 0 2px 0; color:#eab308; text-transform:uppercase; font-size:12px; font-weight:bold; line-height:1.4;">${vraiNomStation}</h4>
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
window.toggleBurgerMenu = toggleBurgerMenu;
