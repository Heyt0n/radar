// ============================================================================
// 📡 RADAR CARBURANT - PARTIE 1/2 : CONFIGURATION, SESSION, CARTE & FAVORIS
// ============================================================================

let currentUser = null;
let fluxFranceBrut = [];      
let stationsGlobales = [];    
let favoris = []; 
let marqueursActifs = {}; 
let marqueurPositionReelle = null;

const DEF_LAT = 48.71;
const DEF_LON = 7.82;

let RAYON_KM = parseFloat(localStorage.getItem('radar_rayon')) || 10; 
let dernierePosition = { lat: DEF_LAT, lon: DEF_LON };
let maPositionReelle = { lat: DEF_LAT, lon: DEF_LON }; 

function toggleBurgerMenu() {
    const menu = document.getElementById('burgerMenu');
    const overlay = document.getElementById('menuOverlay');
    if (menu && overlay) {
        menu.classList.toggle('open');
        overlay.classList.toggle('active');
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    const sliderRayon = document.getElementById('user-rayon');
    const affichageRayon = document.getElementById('valeur-rayon');
    if (sliderRayon) {
        sliderRayon.value = RAYON_KM;
        if (affichageRayon) affichageRayon.textContent = `${RAYON_KM} km`;
    }

    const burgerBtn = document.querySelector('.burger-btn');
    const menuOverlay = document.getElementById('menuOverlay');

    if (burgerBtn) {
        burgerBtn.addEventListener('click', () => toggleBurgerMenu());
        burgerBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            toggleBurgerMenu();
        }, { passive: false });
    }

    if (menuOverlay) {
        menuOverlay.addEventListener('click', () => toggleBurgerMenu());
    }

    // Gestion Auth / Supabase
    try {
        if (typeof _supabase !== 'undefined') {
            const { data: { session }, error } = await _supabase.auth.getSession();

            if (!session) {
                if (localStorage.getItem("radar_session_active") !== "true") {
                    if (!window.location.pathname.includes("outils.html") && !window.location.pathname.includes("compte.html") && !window.location.pathname.includes("connexion.html")) {
                        window.location.href = "connexion.html";
                        return;
                    }
                }
                favoris = JSON.parse(localStorage.getItem('radar_favoris')) || [];
            } else {
                currentUser = session.user;
                const pseudo = currentUser.user_metadata?.display_name || currentUser.user_metadata?.pseudo || "Opérateur";

                const nomOperateurBadge = document.getElementById("nom-operateur");
                if (nomOperateurBadge) nomOperateurBadge.textContent = pseudo;

                await chargerFavorisSupabase();
            }
        } else {
            favoris = JSON.parse(localStorage.getItem('radar_favoris')) || [];
        }
    } catch (err) {
        console.error("Erreur session :", err);
        favoris = JSON.parse(localStorage.getItem('radar_favoris')) || [];
    }

    if (document.getElementById('map')) {
        initialiserCarteEtMoteur();
    }
});

async function chargerFavorisSupabase() {
    if (!currentUser || typeof _supabase === 'undefined') return;
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

var map = null;

function initialiserCarteEtMoteur() {
    try {
        map = L.map('map', { zoomControl: false }).setView([DEF_LAT, DEF_LON], 11);
// 1. Charger la carte standard OpenStreetMap
const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// 2. Appliquer le filtre sombre en CSS pur
const mapContainer = map.getContainer();
mapContainer.style.background = '#111827'; // Fond pour éviter le blanc au chargement

// Injecter le style sombre sur les tuiles Leaflet
const styleDark = document.createElement('style');
styleDark.innerHTML = `
    .leaflet-tile-pane {
        filter: brightness(1.7) invert(1) contrast(0.5) hue-rotate(200deg) saturate(0.1);
    }
`;
document.head.appendChild(styleDark);


        initialiserEcouteursInterface();
        declencherGeolocalisation();
    } catch (e) {
        console.error("Erreur initialiserCarteEtMoteur :", e);
    }
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
                <div style="display: ${afficherBulle}; position: absolute; top: -6px; left: -8px; background:${couleurBulle}; width: 14px; height: 14px; border-radius: 50%; border: 1.5px solid #111827; box-shadow: 0 2px 4px rgba(0,0,0,0.3); z-index: 20;"></div>
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
    else if (adresseMinuscule.includes("api") || adresseMinuscule.includes("ip")) marque = "Api-Ip";
    else if (adresseMinuscule.includes("eni") || adresseMinuscule.includes("agip")) marque = "Eni";
    else if (adresseMinuscule.includes("q8")) marque = "Q8";

    let nomBase = (!nomBrut || nomBrut.toLowerCase() === "station" || nomBrut.length < 3) ? marque : nomBrut;
    let rueClean = adresseBrute;
    if (rueClean.toLowerCase().startsWith(nomBase.toLowerCase())) {
        rueClean = rueClean.substring(nomBase.length).trim();
        if (rueClean.startsWith("-")) rueClean = rueClean.substring(1).trim();
    }
    return rueClean ? `${nomBase} - ${rueClean}` : (ville ? `${nomBase} - ${ville}` : nomBase);
}

function formatPrix(valeur) {
    if (valeur === undefined || valeur === null || valeur === "") return null;
    if (typeof valeur === 'number') return isNaN(valeur) || valeur === 0 ? null : valeur;
    let str = String(valeur).replace(',', '.').trim();
    let num = parseFloat(str);
    return isNaN(num) || num === 0 ? null : num;
}

async function basculerFavori(nom, lat, lon) {
    const index = favoris.findIndex(f => f.nom === nom);

    if (currentUser && typeof _supabase !== 'undefined') {
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
        
        const urlGoogleMapsFav = `https://www.google.com/maps/search/?api=1&query=${f.lat},${f.lon}`;
        const cleMarqueur = `${f.lat}_${f.lon}`;

        item.innerHTML = `
            <div style="flex: 1; display: flex; justify-content: space-between; align-items: center; padding-right: 8px; min-width: 0; cursor: pointer;" id="fav-${cleMarqueur}">
                <span style="font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex: 1; font-size:11px; padding-right: 5px;" title="${nomSecuriseHTML}">${nomSecuriseHTML}</span>
                <b style="font-family:'JetBrains Mono', monospace; font-size:12px; color:var(--accent-vert); flex-shrink: 0;">${affichagePrix}</b>
            </div>
            <div style="display: flex; gap: 8px; align-items: center; flex-shrink: 0;">
                <a href="${urlGoogleMapsFav}" target="_blank" style="text-decoration:none; font-size:14px; cursor:pointer;" title="Ouvrir dans Google Maps">🗺️</a>
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

// ============================================================================
// 📡 RADAR CARBURANT - PARTIE 2/2 : AUTOCOMPLÉTION, APIS MULTI-PAYS & GEOLOC
// ============================================================================

let debounceTimerSearch = null;

function initialiserAutocompletionVille() {
    const input = document.getElementById('search-ville');
    const containerSuggestions = document.getElementById('suggestions-ville');
    if (!input || !containerSuggestions) return;

    input.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        clearTimeout(debounceTimerSearch);

        if (query.length < 2) {
            containerSuggestions.style.display = 'none';
            containerSuggestions.innerHTML = '';
            return;
        }

        debounceTimerSearch = setTimeout(async () => {
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(query)}&countrycodes=fr,de,it,be&limit=8`);
                const data = await res.json();

                containerSuggestions.innerHTML = '';

                if (data && data.length > 0) {
                    const vus = new Set();
                    const suggestionsPropres = [];

                    data.forEach(item => {
                        const addr = item.address || {};
                        const nomVille = addr.city || addr.town || addr.village || addr.municipality || item.display_name.split(',')[0].trim();
                        const cp = addr.postcode ? addr.postcode.trim() : '';

                        const libelleAffiche = cp ? `${nomVille} (${cp})` : nomVille;
                        const cleUnique = libelleAffiche.toLowerCase();

                        if (!vus.has(cleUnique)) {
                            vus.add(cleUnique);
                            suggestionsPropres.push({
                                label: libelleAffiche,
                                nomSimple: nomVille,
                                lat: parseFloat(item.lat),
                                lon: parseFloat(item.lon)
                            });
                        }
                    });

                    suggestionsPropres.forEach(item => {
                        const div = document.createElement('div');
                        div.className = 'suggestion-item';
                        div.textContent = item.label;

                        div.addEventListener('click', () => {
                            input.value = item.label; 
                            containerSuggestions.style.display = 'none';

                            if (!isNaN(item.lat) && !isNaN(item.lon) && map) {
                                map.setView([item.lat, item.lon], 12);
                                fetchLiveStations(item.lat, item.lon);
                            }
                        });

                        containerSuggestions.appendChild(div);
                    });

                    containerSuggestions.style.display = suggestionsPropres.length > 0 ? 'block' : 'none';
                } else {
                    containerSuggestions.style.display = 'none';
                }
            } catch (err) {
                console.error("Erreur autocomplétion :", err);
            }
        }, 250);
    });

    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !containerSuggestions.contains(e.target)) {
            containerSuggestions.style.display = 'none';
        }
    });
}

function initialiserEcouteursInterface() {
    afficherFavoris(); 
    initialiserAutocompletionVille();

    const sliderRayon = document.getElementById('user-rayon');
    const affichageRayon = document.getElementById('valeur-rayon');

    if (sliderRayon) {
        let antiMitrailleuseTimeout;

        sliderRayon.addEventListener('input', (e) => {
            RAYON_KM = Number(e.target.value);
            if (affichageRayon) affichageRayon.textContent = `${RAYON_KM} km`;
            localStorage.setItem('radar_rayon', RAYON_KM);

            clearTimeout(antiMitrailleuseTimeout);
            antiMitrailleuseTimeout = setTimeout(() => {
                fetchLiveStations(dernierePosition.lat, dernierePosition.lon);
            }, 250);
        });
    }

    document.getElementById('select-carburant')?.addEventListener('change', () => fetchLiveStations(dernierePosition.lat, dernierePosition.lon));
    
    document.getElementById('btn-reset')?.addEventListener('click', () => {
        const input = document.getElementById('search-ville'); 
        if (input) input.value = '';
        if (map) {
            map.setView([maPositionReelle.lat, maPositionReelle.lon], 11);
            fetchLiveStations(maPositionReelle.lat, maPositionReelle.lon);
        }
    });
}

async function recupererStationsItalieUnrestricted(centerLat, centerLon, rayonKm) {
    let lat = parseFloat(centerLat);
    let lon = parseFloat(centerLon);
    let rad = parseFloat(rayonKm);

    if (isNaN(lat) || isNaN(lon) || isNaN(rad) || rad <= 0) return [];
    if (lat < 35 || lat > 47 || lon < 6 || lon > 19) return [];

    try {
        const rayonMetres = Math.round(rad * 1000);
        const overpassUrl = `https://overpass-api.de/api/interpreter?data=[out:json];node(around:${rayonMetres},${lat},${lon})[amenity=fuel];out;`;
        
        const resIT = await fetch(overpassUrl);
        if (resIT.ok) {
            const data = await resIT.json();
            if (data && data.elements) {
                return data.elements.map(st => {
                    const tags = st.tags || {};
                    return {
                        n: tags.name || tags.brand || "Station Italie",
                        a: tags["addr:street"] ? `${tags["addr:street"]} ${tags["addr:housenumber"] || ""}` : "Adresse non renseignée",
                        v: tags["addr:city"] || "",
                        cp: tags["addr:postcode"] || "",
                        lt: parseFloat(st.lat),
                        ln: parseFloat(st.lon),
                        gz: null, 95: null, e10: null, 98: null
                    };
                });
            }
        }
    } catch (e) {
        console.warn("⚠️ Échec Overpass Italie :", e);
    }
    return [];
}

async function recupererBrutMultiPays(centerLat, centerLon) {
    let stationsTrouveesFR = [];
    let stationsTrouveesDE = [];
    let stationsTrouveesIT = [];
    stationsGlobales = []; 

    // 1. FRANCE
    try {
        if (fluxFranceBrut.length === 0) {
            const resFR = await fetch('./stations_france.json');
            if (!resFR.ok) throw new Error(`Impossible de charger stations_france.json (${resFR.status})`);
            fluxFranceBrut = await resFR.json();
        }

        fluxFranceBrut.forEach(station => {
            if (station.lt && station.ln) {
                if (getDistance(centerLat, centerLon, station.lt, station.ln) <= RAYON_KM) {
                    stationsTrouveesFR.push(station);
                }
            }
        });
    } catch (err) {
        console.error("⚠️ Flux France indisponible :", err.message);
    }

    // 2. ALLEMAGNE (Edge Function : prix-allemagne)
    try {
        const rayonSecuriseDE = Math.min(RAYON_KM, 25);

        if (typeof _supabase !== 'undefined') {
            const { data: dataDE, error } = await _supabase.functions.invoke('prix-allemagne', {
                body: { lat: centerLat, lon: centerLon, rad: rayonSecuriseDE }
            });

            if (error) {
                console.error("❌ Erreur retournée par Supabase Edge Function (prix-allemagne) :", error);
            } else if (dataDE && dataDE.ok && dataDE.stations) {
                stationsTrouveesDE = dataDE.stations.map(st => ({
                    n: st.name || "Station Allemande",
                    a: st.street || st.name,
                    v: st.place || "",
                    cp: st.postCode || "",
                    lt: parseFloat(st.lat),
                    ln: parseFloat(st.lng),
                    gz: st.diesel && st.diesel > 0 ? st.diesel : null,
                    95: st.e5 && st.e5 > 0 ? st.e5 : null,
                    e10: st.e10 && st.e10 > 0 ? st.e10 : null,
                    98: null
                }));
            }
        }
    } catch (err) {
        console.error("⚠️ Échec API Allemagne :", err);
    }

    // 3. ITALIE
    try {
        stationsTrouveesIT = await recupererStationsItalieUnrestricted(centerLat, centerLon, RAYON_KM);
    } catch (err) {
        console.error("⚠️ Échec Flux Italie :", err);
    }

    stationsGlobales = [...stationsTrouveesFR, ...stationsTrouveesDE, ...stationsTrouveesIT];
}

async function fetchLiveStations(centerLat, centerLon) {
    if (!map) return;
    try {
        dernierePosition = { lat: centerLat, lon: centerLon };
        await recupererBrutMultiPays(centerLat, centerLon);

        const carburantActif = document.getElementById('select-carburant')?.value || 'gz';

        map.eachLayer((layer) => { 
            if (layer instanceof L.Marker && layer !== marqueurPositionReelle) {
                map.removeLayer(layer); 
            }
        });
        marqueursActifs = {}; 

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

        stationsGlobales.forEach(station => {
            let lat = parseFloat(station.lt);
            let lon = parseFloat(station.ln);
            if (isNaN(lat) || isNaN(lon)) return;

            let nomAffiche = extraireVraiNom(station);
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
                return `<div style="display:flex; justify-content:space-between; margin-bottom:5px; ${style}"><span>${label} :</span><b>${prix ? prix.toFixed(3) + ' €' : 'Non renseigné'}</b></div>`;
            };

            const nomSecuriseJS = nomAffiche.replace(/'/g, "\\'").replace(/"/g, '\\"');
            const urlGoogleMaps = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;

            marker.bindPopup(`
                <div style="background:#1f2937; color:white; padding:12px; border-radius:12px; min-width:240px;">
                    <h4 style="margin:0 0 2px 0; color:#eab308; text-transform:uppercase; font-size:13px;">${nomAffiche}</h4>
                    <p style="margin:0 0 8px 0; font-size:11px; color:#9ca3af;">${station.a || ''} ${station.v || ''}</p>
                    <div style="font-size:12px; font-family:'JetBrains Mono', monospace; margin-bottom:10px;">
                        ${linePrix('Gazole', formatPrix(station.gz), 'gz')}
                        ${linePrix('SP95-E10', formatPrix(station.e10), 'e10')}
                        ${linePrix('SP95', formatPrix(station['95']), '95')}
                        ${linePrix('SP98', formatPrix(station['98']), '98')}
                    </div>
                    <div style="display:flex; gap:6px;">
                        <button onclick="basculerFavori('${nomSecuriseJS}', ${lat}, ${lon})" style="flex:1; background:${estFavori ? '#ef4444' : '#22c55e'}; color:white; border:none; padding:6px; border-radius:6px; font-weight:bold; cursor:pointer; font-size:11px;">
                            ${estFavori ? 'Retirer' : '⭐ Favori'}
                        </button>
                        <a href="${urlGoogleMaps}" target="_blank" style="background:#3b82f6; color:white; text-decoration:none; padding:6px 10px; border-radius:6px; font-weight:bold; font-size:11px; display:flex; align-items:center;">🗺️ Y aller</a>
                    </div>
                </div>
            `);
        });

        afficherFavoris();
    } catch (e) {
        console.error("Erreur fetchLiveStations :", e);
    }
}

function declencherGeolocalisation() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition((pos) => {
            maPositionReelle = { lat: pos.coords.latitude, lon: pos.coords.longitude };
            dernierePosition = { ...maPositionReelle };

            if (map) {
                if (marqueurPositionReelle) map.removeLayer(marqueurPositionReelle);
                marqueurPositionReelle = L.circleMarker([maPositionReelle.lat, maPositionReelle.lon], {
                    radius: 8, fillColor: "#3b82f6", color: "#ffffff", weight: 2, opacity: 1, fillOpacity: 0.9
                }).addTo(map).bindPopup("<b>Ma Position Actuelle</b>");

                map.setView([maPositionReelle.lat, maPositionReelle.lon], 11);
                fetchLiveStations(maPositionReelle.lat, maPositionReelle.lon);
            }
        }, (err) => {
            console.warn("Géolocalisation refusée/impossible, position par défaut.");
            fetchLiveStations(DEF_LAT, DEF_LON);
        }, { enableHighAccuracy: true, timeout: 10000 });
    } else {
        fetchLiveStations(DEF_LAT, DEF_LON);
    }
}
