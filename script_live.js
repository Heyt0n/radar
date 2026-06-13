// 0. INITIALISATION ET ETAT GLOBAL //

let currentUser = null;
let stationsGlobales = [];
let favoris = []; 
let marqueursActifs = {}; 

const API_URL = "stations_france.json"; 
const DEF_LAT = 48.71;
const DEF_LON = 7.82;

let RAYON_KM = parseFloat(localStorage.getItem('radar_rayon')) || 15; 
let dernierePosition = { lat: DEF_LAT, lon: DEF_LON };
let maPositionReelle = { lat: DEF_LAT, lon: DEF_LON }; 

document.addEventListener("DOMContentLoaded", async () => {
    try {
        const { data: { session }, error } = await _supabase.auth.getSession();

        if (!session) {
            if (localStorage.getItem("radar_session_active") !== "true") {
                if (!window.location.pathname.includes("outils.html") && !window.location.pathname.includes("compte.html")) {
                    window.location.href = "connexion.html";
                    return;
                }
            }
            favoris = JSON.parse(localStorage.getItem('radar_favoris')) || [];
        } else {
            currentUser = session.user;
            const pseudo = currentUser.user_metadata.display_name || "Opérateur";
            
            const nomOperateurBadge = document.getElementById("nom-operateur");
            if (nomOperateurBadge) nomOperateurBadge.textContent = pseudo;

            await chargerFavorisSupabase();
        }
    } catch (err) {
        console.error("Erreur session :", err);
        favoris = JSON.parse(localStorage.getItem('radar_favoris')) || [];
    }

    if (document.getElementById('map')) {
        initialiserCarteEtMoteur();
    } else {
        initialiserEcouteursInterfaceOutils();
    }
});

async function chargerFavorisSupabase() {
    if (!currentUser) return;
    try {
        const { data, error } = await _supabase.from('favoris').select('*');
        if (error) throw error;
        favoris = data.map(f => ({
            id_cloud: f.id, 
            nom: f.nom_station,
            lat: f.latitude,
            lon: f.longitude
        }));
    } catch (err) {
        console.error("Erreur récupération Cloud :", err.message);
        favoris = JSON.parse(localStorage.getItem('radar_favoris')) || [];
    }
}

// ==========================================
// 2. CONFIGURATION DE LA CARTE LEAFLET
// ==========================================
var map = null;

function initialiserCarteEtMoteur() {
    map = L.map('map', { zoomControl: false }).setView([DEF_LAT, DEF_LON], 11);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© CARTO © OpenStreetMap'
    }).addTo(map);

    initialiserEcouteursInterface();
    declencherGeolocalisation();
}

function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

function creerIconeMarqueur(couleur, estFavori, couleurBulle) {
    const afficherBulle = couleurBulle ? 'block' : 'none';
    return L.divIcon({
        html: `
            <div style="position: relative; width: 25px; height: 41px;">
                <div style="display: ${afficherBulle}; position: absolute; top: -6px; left: -8px; background: ${couleurBulle}; width: 14px; height: 14px; border-radius: 50%; border: 1.5px solid #111827; box-shadow: 0 2px 4px rgba(0,0,0,0.3); z-index: 20;"></div>
                <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${couleur}.png" style="width: 25px; height: 41px; display: block; position: absolute; top: 0; left: 0; z-index: 10;">
                ${estFavori ? `<div style="position: absolute; top: -6px; right: -8px; background: #f97316; color: white; font-size: 10px; padding: 2px; border-radius: 50%; border: 1px solid #111827; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.3); z-index: 20;">⭐</div>` : ''}
            </div>
        `,
        className: 'custom-hybrid-pin',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34]
    });
}

function extraireVraiNom(station) {
    let nomBrut = (station.n || "").trim();
    let ville = (station.v || "").trim();
    let adresseBrute = (station.a || "").trim();
    let marque = "Station";
    let adresseMinuscule = adresseBrute.toLowerCase();
    
    if (adresseMinuscule.includes("total")) marque = "Total";
    else if (adresseMinuscule.includes("leclerc")) marque = "E.Leclerc";
    else if (adresseMinuscule.includes("carrefour")) marque = "Carrefour";
    else if (adresseMinuscule.includes("intermarche")) marque = "Intermarché";
    else if (adresseMinuscule.includes("systeme u") || adresseMinuscule.includes("super u") || adresseMinuscule.includes("u utile")) marque = "Super U";
    else if (adresseMinuscule.includes("auchan")) marque = "Auchan";
    else if (adresseMinuscule.includes("esso")) marque = "Esso";
    else if (adresseMinuscule.includes("avanti")) marque = "Avanti";
    else if (adresseMinuscule.includes("bp ")) marque = "BP";

    let nomBase = (!nomBrut || nomBrut.toLowerCase() === "station" || nomBrut.length < 3) ? marque : nomBrut;
    let rueClean = adresseBrute;
    if (rueClean.toLowerCase().startsWith(nomBase.toLowerCase())) {
        rueClean = rueClean.substring(nomBase.length).trim();
        if (rueClean.startsWith("-")) rueClean = rueClean.substring(1).trim();
    }
    return rueClean ? `${nomBase} - ${rueClean}` : (ville ? `${nomBase} - ${ville}` : nomBase);
}

function formatPrix(valeur) {
    if (valeur === undefined || valeur === null || isNaN(valeur) || valeur === 0) return null;
    return parseFloat(valeur);
}

// ==========================================
// 3. GESTION DES FAVORIS
// ==========================================
async function basculerFavori(nom, lat, lon) {
    const index = favoris.findIndex(f => f.nom === nom);

    if (currentUser) {
        if (index === -1) {
            const { error } = await _supabase
                .from('favoris')
                .insert([{ user_id: currentUser.id, nom_station: nom, latitude: lat, longitude: lon }]);
            if (error) { alert(`Erreur Cloud : ${error.message}`); return; }
        } else {
            const { error } = await _supabase
                .from('favoris')
                .delete()
                .eq('user_id', currentUser.id)
                .eq('nom_station', nom);
            if (error) { alert(`Erreur Cloud : ${error.message}`); return; }
        }
        await chargerFavorisSupabase();
    } else {
        if (index === -1) favoris.push({ nom, lat, lon });
        else favoris.splice(index, 1);
        localStorage.setItem('radar_favoris', JSON.stringify(favoris));
    }
    if (map) fetchLiveStations(dernierePosition.lat, dernierePosition.lon);
}

function afficherFavoris() {
    const conteneur = document.getElementById('liste-favoris');
    if (!conteneur) return;
    
    if (favoris.length === 0) {
        conteneur.innerHTML = `<p style="font-size: 11px; color: var(--texte-secondaire); text-align: center; font-style: italic;">Aucune station en favori.</p>`;
        return;
    }
    
    const carburantActif = document.getElementById('select-carburant')?.value || 'gz';
    conteneur.innerHTML = '';
    
    favoris.forEach(f => {
        const stationDataLive = stationsGlobales.find(s => Math.abs(parseFloat(s.lt) - f.lat) < 0.005 && Math.abs(parseFloat(s.ln) - f.lon) < 0.005) || 
                                stationsGlobales.find(s => extraireVraiNom(s) === f.nom);
        
        let affichagePrix = "Rupture";
        if (stationDataLive) {
            let prix = formatPrix(stationDataLive[carburantActif]);
            if (prix) affichagePrix = `${prix.toFixed(3)} €`;
        }
        
        const item = document.createElement('div');
        item.className = 'favori-item';
        item.style.marginBottom = '8px';
        
        const nomSecuriseHTML = f.nom.replace(/"/g, '"').replace(/'/g, "'");
        const nomSecuriseJS = f.nom.replace(/'/g, "\\'").replace(/"/g, '\\"');
        const cleMarqueur = `${f.lat}_${f.lon}`;

        item.innerHTML = `
            <div style="flex: 1; display: flex; justify-content: space-between; align-items: center; padding-right: 8px; min-width: 0; cursor: pointer;" 
                 id="fav-${cleMarqueur}">
                <span style="font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex: 1; font-size:11px; padding-right: 5px;" title="${nomSecuriseHTML}">${nomSecuriseHTML}</span>
                <b style="font-family:'JetBrains Mono', monospace; font-size:12px; color:var(--accent-vert); flex-shrink: 0;">${affichagePrix}</b>
            </div>
            <div style="display: flex; gap: 8px; align-items: center; flex-shrink: 0;">
                <a href="https://maps.google.com/?q=${f.lat},${f.lon}" target="_blank" style="text-decoration:none; font-size:14px; cursor:pointer;" title="Ouvrir dans Google Maps">🗺️</a>
                <button id="del-${cleMarqueur}" style="background:none; border:none; color:#ef4444; cursor:pointer; font-weight:bold; font-size:14px; padding: 0 4px;">✕</button>
            </div>
        `;
        
        conteneur.appendChild(item);

        document.getElementById(`fav-${cleMarqueur}`).addEventListener('click', () => {
            if (!map) return;
            map.setView([f.lat, f.lon], 14); 
            if (marqueursActifs[cleMarqueur]) {
                marqueursActifs[cleMarqueur].openPopup();
            } else {
                fetchLiveStations(f.lat, f.lon).then(() => {
                    if (marqueursActifs[cleMarqueur]) marqueursActifs[cleMarqueur].openPopup();
                });
            }
        });

        document.getElementById(`del-${cleMarqueur}`).addEventListener('click', (e) => {
            e.stopPropagation();
            basculerFavori(nomSecuriseJS, f.lat, f.lon);
        });
    });
}

// ==========================================
// 4. MOTEUR DE RECHERCHE ET REQUETES API
// ==========================================
async function rechercherVille() {
    const input = document.getElementById('search-ville');
    if (!input || !input.value.trim()) return;
    
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(input.value.trim())}&countrycodes=fr,de,be&limit=1`);
        const data = await response.json();
        if (data && data.length > 0) {
            const newLat = parseFloat(data[0].lat);
            const newLon = parseFloat(data[0].lon);
            if (map) {
                map.setView([newLat, newLon], 12);
                fetchLiveStations(newLat, newLon);
            }
        } else {
            alert("Location introuvable.");
        }
    } catch (e) { console.error("Erreur Ville :", e); }
}

async function fetchLiveStations(centerLat, centerLon) {
    if (!map) return;
    try {
        dernierePosition = { lat: centerLat, lon: centerLon };
        
        if (stationsGlobales.length === 0) {
            const response = await fetch(API_URL);
            stationsGlobales = await response.json();
        }

        const carburantActif = document.getElementById('select-carburant')?.value || 'gz';

        // Nettoyage de la carte
        map.eachLayer((layer) => { if (layer instanceof L.Marker) map.removeLayer(layer); });
        marqueursActifs = {}; 

        // 1. Calcul du min/max prix sur le réseau national pour le gradient des bulles
        let prixMin = Infinity, prixMax = -Infinity;
        stationsGlobales.forEach(station => {
            if (station.lt && station.ln && getDistance(centerLat, centerLon, station.lt, station.ln) <= RAYON_KM) {
                let prix = formatPrix(station[carburantActif]);
                if (prix) {
                    if (prix < prixMin) prixMin = prix;
                    if (prix > prixMax) prixMax = prix;
                }
            }
        });

        // 2. Fonction de rendu réutilisable (pour la France ET l'international)
        const dessinerMarqueurStation = (station, nomAffiche) => {
            let lat = parseFloat(station.lt);
            let lon = parseFloat(station.ln);
            if (isNaN(lat) || isNaN(lon)) return;

            let distance = getDistance(centerLat, centerLon, lat, lon);
            const estFavori = favoris.some(f => f.nom === nomAffiche);

            let prixCourant = formatPrix(station[carburantActif]);
            let couleurMarker = 'blue'; 
            if (prixCourant && prixMin !== Infinity && prixMax !== -Infinity && prixMin !== prixMax) {
                if (prixCourant === prixMin) couleurMarker = 'green'; 
                else if (prixCourant === prixMax) couleurMarker = 'red'; 
            }

            let couleurBulle = null;
            if (prixCourant && prixMin !== Infinity && prixMax !== -Infinity && prixMin !== prixMax) {
                let score = (prixCourant - prixMin) / (prixMax - prixMin);
                couleurBulle = `hsl(${(1 - Math.max(0, Math.min(1, score))) * 120}, 100%, 50%)`;
            }

            const marker = L.marker([lat, lon], { icon: creerIconeMarqueur(couleurMarker, estFavori, couleurBulle) }).addTo(map);
            marqueursActifs[`${lat}_${lon}`] = marker;

            const linePrix = (label, prix, code) => {
                const style = (carburantActif === code) ? 'background:#374151; padding:2px 5px; border-radius:4px; font-weight:bold; color:#22c55e;' : '';
                return `<div style="display:flex; justify-content:space-between; margin-bottom:5px; ${style}"><span>${label} :</span><b>${prix ? prix.toFixed(3) + ' €' : 'Rupture'}</b></div>`;
            };

            const nomSecuriseJS = nomAffiche.replace(/'/g, "\\'").replace(/"/g, '\\"');

            marker.bindPopup(`
                <div style="background:#1f2937; color:white; padding:12px; border-radius:12px; min-width:240px;">
                    <h4 style="margin:0 0 2px 0; color:#eab308; text-transform:uppercase; font-size:12px; font-weight:bold;">${nomAffiche}</h4>
                    <p style="margin:0 0 10px 0; font-size:11px; color:#3b82f6; font-weight:bold;">📍 À ${distance.toFixed(1)} km</p>
                    <div style="font-size:13px; font-family:monospace; margin-bottom:12px;">
                        ${linePrix('Gazole', formatPrix(station.gz), 'gz')}
                        ${linePrix('SP95-E10', formatPrix(station.e10), 'e10')}
                        ${linePrix('SP95', formatPrix(station["95"]), '95')}
                        ${linePrix('SP98', formatPrix(station["98"]), '98')}
                    </div>
                    <div style="display:flex; flex-direction:column; gap:6px;">
                        <button onclick="basculerFavori('${nomSecuriseJS}', ${lat}, ${lon});" style="width:100%; background:${estFavori ? "#ef4444" : "#22c55e"}; color:white; border:none; padding:8px; border-radius:6px; font-weight:bold; font-size:11px; cursor:pointer;">${estFavori ? "❌ Supprimer" : "⭐ Épingler"}</button>
                        <a href="https://maps.google.com/?q=${lat},${lon}" target="_blank" style="width:100%; background:var(--accent-bleu); color:white; text-align:center; text-decoration:none; padding:8px; border-radius:6px; font-weight:bold; font-size:11px; box-sizing:border-box;">🧭 Itinéraire Google Maps</a>
                    </div>
                </div>
            `);
        };

        // 3. Déploiement des stations nationales (France)
        stationsGlobales.forEach(station => {
            if (station.lt && station.ln) {
                let distance = getDistance(centerLat, centerLon, station.lt, station.ln);
                let vraiNomStation = extraireVraiNom(station);
                const estFavori = favoris.some(f => f.nom === vraiNomStation);

                if (distance <= RAYON_KM || estFavori) {
                    dessinerMarqueurStation(station, vraiNomStation);
                }
            }
        });

        // 4. ⚡ PONTAGE INTERNATIONAL SÉCURISÉ
        // On exécute l'injection transfrontalière uniquement si le script international.js est chargé
        if (typeof injecterStationsFrontalieres === "function") {
            await injecterStationsFrontalieres(map, centerLat, centerLon, RAYON_KM, (stationEtrangere, nomModifie) => {
                // Utilisation directe du moteur graphique unifié
                dessinerMarqueurStation(stationEtrangere, nomModifie);
            });
        }

        afficherFavoris();
    } catch (e) { console.error("Erreur rendering :", e); }
}

// ==========================================
// 5. INTERFACE ET GEOLOCALISATION
// ==========================================
function initialiserEcouteursInterface() {
    afficherFavoris(); 
    document.getElementById('select-carburant')?.addEventListener('change', () => fetchLiveStations(dernierePosition.lat, dernierePosition.lon));
    document.getElementById('btn-search')?.addEventListener('click', rechercherVille);
    document.getElementById('search-ville')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') rechercherVille(); });
    document.getElementById('btn-reset')?.addEventListener('click', () => {
        const input = document.getElementById('search-ville'); if (input) input.value = '';
        if (map) {
            map.setView([maPositionReelle.lat, maPositionReelle.lon], 11);
            fetchLiveStations(maPositionReelle.lat, maPositionReelle.lon);
        }
    });
}

function initialiserEcouteursInterfaceOutils() {
    console.log("Interface outils synchronisée.");
}

function declencherGeolocalisation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                maPositionReelle = { lat: pos.coords.latitude, lon: pos.coords.longitude };
                if (map) {
                    map.setView([pos.coords.latitude, pos.coords.longitude], 11);
                    fetchLiveStations(pos.coords.latitude, pos.coords.longitude);
                }
            },
            () => { if (map) fetchLiveStations(DEF_LAT, DEF_LON); }
        );
    } else { if (map) fetchLiveStations(DEF_LAT, DEF_LON); }
}

function toggleBurgerMenu() {
    document.getElementById('burgerMenu')?.classList.toggle('open');
    document.getElementById('menuOverlay')?.classList.toggle('active');
}

window.basculerFavori = basculerFavori;
window.toggleBurgerMenu = toggleBurgerMenu;
