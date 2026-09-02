// ============================================================================
// 📡 RADAR CARBURANT - MODULE TRAJET (ITINÉRAIRE MULTI-PAYS)
// ============================================================================

let mapTrajet = null;
let fluxFranceTrajetBrut = [];
let stationsSurTrajet = [];
let routePolyline = null;
let marqueursStationsTrajet = [];
let DISTANCE_MAX_ROUTE_KM = 10;
let favorisTrajet = [];

const DEF_LAT = 48.71;
const DEF_LON = 7.82;
let dernierePositionRouteCentrale = { lat: DEF_LAT, lon: DEF_LON };

function toggleBurgerMenu() {
    const menu = document.getElementById('burgerMenu');
    const overlay = document.getElementById('menuOverlay');
    if (menu && overlay) {
        menu.classList.toggle('open');
        overlay.classList.toggle('active');
    }
}

function toggleVoletFiltres() {
    const volet = document.getElementById('options-trajet');
    const indicateur = document.getElementById('indicateur-filtre-fleche');
    if (volet) {
        volet.classList.toggle('masque-mobile');
        if (indicateur) {
            indicateur.textContent = volet.classList.contains('masque-mobile') ? '▼' : '▲';
        }
    }
}

document.addEventListener("DOMContentLoaded", async () => {
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
            const { data: { session } } = await _supabase.auth.getSession();
            if (session && session.user) {
                const pseudo = session.user.user_metadata?.display_name || session.user.user_metadata?.pseudo || "Opérateur";
                const nomOperateurBadge = document.getElementById("nom-operateur");
                if (nomOperateurBadge) nomOperateurBadge.textContent = pseudo;
                await chargerFavorisSupabaseTrajet();
            } else {
                favorisTrajet = JSON.parse(localStorage.getItem('radar_favoris')) || [];
            }
        } else {
            favorisTrajet = JSON.parse(localStorage.getItem('radar_favoris')) || [];
        }
    } catch (err) {
        console.error("Erreur synchro session trajet :", err);
        favorisTrajet = JSON.parse(localStorage.getItem('radar_favoris')) || [];
    }

    initialiserCarteTrajet();
    initialiserEcouteursTrajet();
    initialiserAutocompletionSurMesure();
    initialiserEcouteursGPS();
});

async function chargerFavorisSupabaseTrajet() {
    if (typeof _supabase === 'undefined') return;
    try {
        const { data, error } = await _supabase.from('favoris').select('*');
        if (error) throw error;
        favorisTrajet = data.map(f => ({
            id_cloud: f.id,
            nom: f.nom_station,
            lat: f.latitude,
            lon: f.longitude
        }));
    } catch (err) {
        console.error("Erreur récupération favoris Supabase :", err.message);
        favorisTrajet = JSON.parse(localStorage.getItem('radar_favoris')) || [];
    }
}

async function basculerFavoriTrajet(nom, lat, lon) {
    let currentUser = null;
    if (typeof _supabase !== 'undefined') {
        const { data: { session } } = await _supabase.auth.getSession();
        if (session) currentUser = session.user;
    }

    const index = favorisTrajet.findIndex(f => f.nom === nom);

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
        await chargerFavorisSupabaseTrajet();
    } else {
        if (index === -1) favorisTrajet.push({ nom, lat, lon });
        else favorisTrajet.splice(index, 1);
        localStorage.setItem('radar_favoris', JSON.stringify(favorisTrajet));
    }

    rafraichirAffichageStationsTrajet();
}

function initialiserCarteTrajet() {
    const el = document.getElementById('map-trajet');
    if (!el) return;

    if (mapTrajet !== null) {
        mapTrajet.remove();
        mapTrajet = null;
    }

    mapTrajet = L.map('map-trajet', { zoomControl: false }).setView([DEF_LAT, DEF_LON], 9);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(mapTrajet);

    // Application exacte du filtre CSS sombre de ton fichier principal
    if (!document.getElementById('style-carte-trajet-sombre')) {
        const styleDark = document.createElement('style');
        styleDark.id = 'style-carte-trajet-sombre';
        styleDark.innerHTML = `
            #map-trajet .leaflet-tile-pane {
                filter: invert(0.3) saturate(0.8) brightness(0.9) contrast(1.8);
            }
        `;
        document.head.appendChild(styleDark);
    }
}

function initialiserEcouteursTrajet() {
    document.getElementById('btn-calculer-trajet')?.addEventListener('click', () => {
        executerCalculTrajet();
        if (window.innerWidth <= 768) {
            document.getElementById('options-trajet')?.classList.add('masque-mobile');
            const ind = document.getElementById('indicateur-filtre-fleche');
            if (ind) ind.textContent = '▼';
        }
    });

    document.getElementById('select-carburant-trajet')?.addEventListener('change', () => {
        if (stationsSurTrajet.length > 0) rafraichirAffichageStationsTrajet();
    });

    document.getElementById('select-rayon-trajet')?.addEventListener('change', (e) => {
        DISTANCE_MAX_ROUTE_KM = parseInt(e.target.value);
        if (routePolyline) filtrerEtAfficherStationsUnifie();
    });

    document.getElementById('select-affichage-trajet')?.addEventListener('change', () => {
        if (stationsSurTrajet.length > 0) rafraichirAffichageStationsTrajet();
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.wrapper-input')) {
            const boxDep = document.getElementById('box-suggestions-depart');
            const boxArr = document.getElementById('box-suggestions-arrivee');
            if (boxDep) boxDep.style.display = 'none';
            if (boxArr) boxArr.style.display = 'none';
        }
    });
}

function initialiserAutocompletionSurMesure() {
    const inputDep = document.getElementById('trajet-depart');
    const inputArr = document.getElementById('trajet-arrivee');

    if (inputDep) {
        inputDep.addEventListener('input', (e) => {
            inputDep.removeAttribute('data-lat');
            inputDep.removeAttribute('data-lon');
            gererSuggestionsHTML(e.target.value, 'box-suggestions-depart', inputDep);
        });
    }
    if (inputArr) {
        inputArr.addEventListener('input', (e) => {
            inputArr.removeAttribute('data-lat');
            inputArr.removeAttribute('data-lon');
            gererSuggestionsHTML(e.target.value, 'box-suggestions-arrivee', inputArr);
        });
    }
}

let timeoutSuggestion;
function gererSuggestionsHTML(valeur, idBox, inputElement) {
    const box = document.getElementById(idBox);
    if (!box) return;

    if (valeur.trim().length < 2) {
        box.innerHTML = "";
        box.style.display = 'none';
        return;
    }

    clearTimeout(timeoutSuggestion);
    timeoutSuggestion = setTimeout(async () => {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(valeur)}&countrycodes=fr,de,it,be&limit=5`);
            const data = await res.json();
            box.innerHTML = "";

            if (!data || data.length === 0) {
                box.style.display = 'none';
                return;
            }

            data.forEach(item => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                const addr = item.address || {};
                const villeNom = addr.city || addr.town || addr.village || addr.municipality || item.display_name.split(',')[0].trim();
                const codePostal = addr.postcode ? addr.postcode.trim() : '';
                const affichage = codePostal ? `${villeNom} (${codePostal})` : villeNom;

                div.textContent = affichage;
                div.addEventListener('click', () => {
                    inputElement.value = affichage;
                    inputElement.setAttribute('data-lat', item.lat);
                    inputElement.setAttribute('data-lon', item.lon);
                    box.innerHTML = "";
                    box.style.display = 'none';
                });
                box.appendChild(div);
            });
            box.style.display = 'block';
        } catch (e) { console.error(e); }
    }, 250);
}

// ============================================================================
// GÉOLOCALISATION GPS TACTIQUE
// ============================================================================
function obtenirPositionGPS() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("La géolocalisation n'est pas supportée par cet appareil."));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => resolve({ lat: position.coords.latitude, lon: position.coords.longitude }),
            (error) => {
                let msg = "Impossible de récupérer votre position GPS.";
                if (error.code === error.PERMISSION_DENIED) msg = "Accès GPS refusé.";
                else if (error.code === error.POSITION_UNAVAILABLE) msg = "Signal GPS indisponible.";
                else if (error.code === error.TIMEOUT) msg = "Délai GPS dépassé.";
                reject(new Error(msg));
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    });
}

async function convertirGPSEnAdresse(lat, lon) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`, {
            headers: { 'Accept-Language': 'fr' }
        });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (data && data.address) {
            const route = data.address.road || data.address.pedestrian;
            const ville = data.address.city || data.address.town || data.address.village || "";
            if (route) return route + (ville ? ` (${ville})` : "");
            return ville || "Ma Position GPS";
        }
        return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    } catch (err) {
        return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    }
}

async function appliquerMaPosition(inputId, btnElement) {
    const inputElement = document.getElementById(inputId);
    if (!inputElement) return;

    const originalText = btnElement.textContent;
    btnElement.textContent = "⏳";
    btnElement.style.opacity = "0.7";
    inputElement.value = "Calcul GPS tactique...";

    try {
        const coords = await obtenirPositionGPS();
        inputElement.setAttribute('data-lat', coords.lat);
        inputElement.setAttribute('data-lon', coords.lon);

        const adresseCalculee = await convertirGPSEnAdresse(coords.lat, coords.lon);
        inputElement.value = adresseCalculee;
        btnElement.textContent = "✅";
    } catch (err) {
        console.error(err);
        alert(err.message);
        inputElement.value = "";
        btnElement.textContent = "❌";
    } finally {
        setTimeout(() => {
            btnElement.textContent = originalText;
            btnElement.style.opacity = "1";
        }, 1500);
    }
}

function initialiserEcouteursGPS() {
    const btnGeoDep = document.getElementById('btn-gps-depart');
    const btnGeoArr = document.getElementById('btn-gps-arrivee');

    if (btnGeoDep) {
        btnGeoDep.addEventListener('click', () => appliquerMaPosition('trajet-depart', btnGeoDep));
        btnGeoDep.addEventListener('touchend', (e) => {
            e.preventDefault();
            appliquerMaPosition('trajet-depart', btnGeoDep);
        }, { passive: false });
    }
    if (btnGeoArr) {
        btnGeoArr.addEventListener('click', () => appliquerMaPosition('trajet-arrivee', btnGeoArr));
        btnGeoArr.addEventListener('touchend', (e) => {
            e.preventDefault();
            appliquerMaPosition('trajet-arrivee', btnGeoArr);
        }, { passive: false });
    }
}

// ============================================================================
// CALCUL D'ITINÉRAIRE & DÉTECTION MULTI-PAYS
// ============================================================================
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

function estProcheDeLaRoute(stationLat, stationLon, pointsRoute) {
    const pas = Math.max(1, Math.floor(pointsRoute.length / 150));
    for (let i = 0; i < pointsRoute.length; i += pas) {
        if (getDistance(stationLat, stationLon, pointsRoute[i][0], pointsRoute[i][1]) <= DISTANCE_MAX_ROUTE_KM) return true;
    }
    return false;
}

async function executerCalculTrajet() {
    const inputDep = document.getElementById('trajet-depart');
    const inputArr = document.getElementById('trajet-arrivee');
    const statut = document.getElementById('trajet-statut');

    const departText = inputDep ? inputDep.value.trim() : "";
    const arriveeText = inputArr ? inputArr.value.trim() : "";

    if (!departText || !arriveeText) {
        alert("Veuillez renseigner un départ et une arrivée.");
        return;
    }

    try {
        if (statut) {
            statut.textContent = "⚡ Localisation...";
            statut.style.color = "#eab308";
        }

        let coordsDep = null;
        if (inputDep.getAttribute('data-lat') && inputDep.getAttribute('data-lon')) {
            coordsDep = [parseFloat(inputDep.getAttribute('data-lat')), parseFloat(inputDep.getAttribute('data-lon'))];
        } else {
            coordsDep = await obtenirCoordonnees(departText);
        }

        let coordsArr = null;
        if (inputArr.getAttribute('data-lat') && inputArr.getAttribute('data-lon')) {
            coordsArr = [parseFloat(inputArr.getAttribute('data-lat')), parseFloat(inputArr.getAttribute('data-lon'))];
        } else {
            coordsArr = await obtenirCoordonnees(arriveeText);
        }

        if (!coordsDep || !coordsArr) {
            if (statut) {
                statut.textContent = "❌ Localisation échouée.";
                statut.style.color = "#ef4444";
            }
            return;
        }

        dernierePositionRouteCentrale = {
            lat: (coordsDep[0] + coordsArr[0]) / 2,
            lon: (coordsDep[1] + coordsArr[1]) / 2
        };

        if (statut) statut.textContent = "🗺️ Tracé de la route...";
        let urlOSRM = `https://router.project-osrm.org/route/v1/driving/${coordsDep[1]},${coordsDep[0]};${coordsArr[1]},${coordsArr[0]}?overview=full&geometries=geojson`;
        let resRoute;

        try {
            resRoute = await fetch(urlOSRM);
            if (!resRoute.ok) throw new Error();
        } catch(e) {
            resRoute = await fetch(`https://corsproxy.io/?${encodeURIComponent(urlOSRM)}`);
        }

        const dataRoute = await resRoute.json();
        if (!dataRoute.routes || dataRoute.routes.length === 0) {
            if (statut) {
                statut.textContent = "❌ Aucun trajet trouvé.";
                statut.style.color = "#ef4444";
            }
            return;
        }

        const geojsonPoints = dataRoute.routes[0].geometry.coordinates;
        const pointsRouteLeaflet = geojsonPoints.map(p => [p[1], p[0]]);

        if (routePolyline) mapTrajet.removeLayer(routePolyline);
        routePolyline = L.polyline(pointsRouteLeaflet, { color: '#3b82f6', weight: 6, opacity: 0.85 }).addTo(mapTrajet);

        mapTrajet.invalidateSize();
        mapTrajet.fitBounds(routePolyline.getBounds(), { padding: [40, 40] });

        if (statut) statut.textContent = "🛰️ Analyse multi-pays...";

        // 1. France
        if (fluxFranceTrajetBrut.length === 0) {
            try {
                const resFR = await fetch('./stations_france.json');
                if (resFR.ok) fluxFranceTrajetBrut = await resFR.json();
            } catch(e) { console.error("Erreur flux France trajet :", e); }
        }

        // 2. Allemagne (via Supabase Edge Function: prix-allemagne)
        let allemagneNormalisee = [];
        try {
            if (typeof _supabase !== 'undefined') {
                const { data: dataDE, error } = await _supabase.functions.invoke('prix-allemagne', {
                    body: { lat: dernierePositionRouteCentrale.lat, lon: dernierePositionRouteCentrale.lon, rad: 25 }
                });

                if (!error && dataDE && dataDE.ok && dataDE.stations) {
                    allemagneNormalisee = dataDE.stations.map(st => ({
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
        } catch(e) { console.error("API Allemande trajet injoignable :", e); }

        fluxGlobalUnifie = [...fluxFranceTrajetBrut, ...allemagneNormalisee];
        filtrerEtAfficherStationsUnifie();
    } catch (err) {
        console.error(err);
        if (statut) {
            statut.textContent = "❌ Erreur.";
            statut.style.color = "#ef4444";
        }
    }
}

async function obtenirCoordonnees(nomVille) {
    const requeteClean = nomVille.split('(')[0].trim();
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(requeteClean)}&countrycodes=fr,de,it,be&limit=1`);
    const data = await res.json();
    return (data && data.length > 0) ? [parseFloat(data[0].lat), parseFloat(data[0].lon)] : null;
}

let fluxGlobalUnifie = [];

function filtrerEtAfficherStationsUnifie() {
    const statut = document.getElementById('trajet-statut');
    if (!routePolyline) return;

    const pointsRouteLeaflet = routePolyline.getLatLngs().map(latlng => [latlng.lat, latlng.lng]);

    stationsSurTrajet = fluxGlobalUnifie.filter(station => {
        if (!station.lt || !station.ln) return false;
        return estProcheDeLaRoute(station.lt, station.ln, pointsRouteLeaflet);
    });

    if (statut) {
        statut.textContent = `🎯 ${stationsSurTrajet.length} détectée(s).`;
        statut.style.color = "#22c55e";
    }
    rafraichirAffichageStationsTrajet();
}

function formatPrix(valeur) {
    if (valeur === undefined || valeur === null || valeur === "") return null;
    if (typeof valeur === 'number') return isNaN(valeur) || valeur === 0 ? null : valeur;
    let str = String(valeur).replace(',', '.').trim();
    let num = parseFloat(str);
    return isNaN(num) || num === 0 ? null : num;
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

function creerIconeMarqueurTrajet(couleur, estFavori, couleurBulle) {
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

function rafraichirAffichageStationsTrajet() {
    marqueursStationsTrajet.forEach(m => mapTrajet.removeLayer(m));
    marqueursStationsTrajet = [];

    const conteneurListe = document.getElementById('liste-stations-trajet');
    if (!conteneurListe) return;
    conteneurListe.innerHTML = "";

    const carburantActif = document.getElementById('select-carburant-trajet')?.value || 'gz';
    const modeAffichage = document.getElementById('select-affichage-trajet')?.value || 'top10';

    let prixMin = Infinity, prixMax = -Infinity;
    stationsSurTrajet.forEach(s => {
        let p = formatPrix(s[carburantActif]);
        if (p) {
            if (p < prixMin) prixMin = p;
            if (p > prixMax) prixMax = p;
        }
    });

    let stationsAffichables = [...stationsSurTrajet].sort((a, b) => {
        let prixA = formatPrix(a[carburantActif]) || Infinity;
        let prixB = formatPrix(b[carburantActif]) || Infinity;
        return prixA - prixB;
    });

    if (modeAffichage === 'top10') stationsAffichables = stationsAffichables.slice(0, 10);
    else if (modeAffichage === 'top20') stationsAffichables = stationsAffichables.slice(0, 20);

    if (stationsAffichables.length === 0) {
        conteneurListe.innerHTML = `<p style="font-size:11px; color:var(--texte-secondaire); text-align:center;">Aucune station détectée.</p>`;
        return;
    }

    stationsAffichables.forEach(station => {
        let lat = parseFloat(station.lt);
        let lon = parseFloat(station.ln);
        let prixIndex = formatPrix(station[carburantActif]);
        let affichagePrixIndex = prixIndex ? `${prixIndex.toFixed(3)} €` : "Rupture";

        let nomStation = extraireVraiNom(station);
        let adresse = (station.a || "").trim();

        let couleurMarker = 'blue';
        if (prixIndex && prixMin !== Infinity && prixMax !== -Infinity && prixMin !== prixMax) {
            if (prixIndex === prixMin) couleurMarker = 'green';
            else if (prixIndex === prixMax) couleurMarker = 'red';
        }

        let couleurBulle = null;
        if (prixIndex && prixMin !== Infinity && prixMax !== -Infinity && prixMin !== prixMax) {
            let score = (prixIndex - prixMin) / (prixMax - prixMin);
            couleurBulle = `hsl(${(1 - Math.max(0, Math.min(1, score))) * 120}, 100%, 50%)`;
        }

        const estFav = favorisTrajet.some(f => f.nom === nomStation);
        const nomSecuriseJS = nomStation.replace(/'/g, "\\'").replace(/"/g, '\\"');
        const urlGoogleMaps = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;

        const iconeHTML = creerIconeMarqueurTrajet(couleurMarker, estFav, couleurBulle);

        const linePrixPopup = (label, prix, code) => {
            const style = (carburantActif === code) ? 'background:#374151; padding:2px 5px; border-radius:4px; font-weight:bold; color:#22c55e;' : '';
            return `<div style="display:flex; justify-content:space-between; margin-bottom:5px; ${style}"><span>${label} :</span><b>${prix ? prix.toFixed(3) + ' €' : 'Non renseigné'}</b></div>`;
        };

        const popupContent = `
            <div style="background:#1f2937; color:white; padding:12px; border-radius:12px; min-width:240px;">
                <h4 style="margin:0 0 2px 0; color:#eab308; text-transform:uppercase; font-size:13px;">${nomStation}</h4>
                <p style="margin:0 0 8px 0; font-size:11px; color:#9ca3af;">${adresse} ${station.v || ''}</p>
                <div style="font-size:12px; font-family:'JetBrains Mono', monospace; margin-bottom:10px;">
                    ${linePrixPopup('Gazole', formatPrix(station.gz), 'gz')}
                    ${linePrixPopup('SP95-E10', formatPrix(station.e10), 'e10')}
                    ${linePrixPopup('SP95', formatPrix(station['95']), '95')}
                    ${linePrixPopup('SP98', formatPrix(station['98']), '98')}
                </div>
                <div style="display:flex; gap:6px;">
                    <button onclick="basculerFavoriTrajet('${nomSecuriseJS}', ${lat}, ${lon})" style="flex:1; background:${estFav ? '#ef4444' : '#22c55e'}; color:white; border:none; padding:6px; border-radius:6px; font-weight:bold; cursor:pointer; font-size:11px;">
                        ${estFav ? 'Retirer' : '⭐ Favori'}
                    </button>
                    <a href="${urlGoogleMaps}" target="_blank" style="background:#3b82f6; color:white; text-decoration:none; padding:6px 10px; border-radius:6px; font-weight:bold; font-size:11px; display:flex; align-items:center;">🗺️ Y aller</a>
                </div>
            </div>
        `;

        const marker = L.marker([lat, lon], { icon: iconeHTML }).addTo(mapTrajet);
        marker.bindPopup(popupContent, { autoPan: true, autoPanPadding: L.point(15, 60) });
        marqueursStationsTrajet.push(marker);

        const item = document.createElement('div');
        item.style.background = "#1f2937";
        item.style.padding = "12px";
        item.style.borderRadius = "8px";
        item.style.cursor = "pointer";
        item.style.display = "flex";
        item.style.justifyContent = "space-between";
        item.style.alignItems = "center";
        if (prixIndex === prixMin && prixMin !== Infinity) item.style.border = "1px solid #22c55e";

        item.innerHTML = `
            <div style="flex: 1; min-width: 0; padding-right:8px;">
                <div style="font-weight:bold; font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#eab308;">${nomStation}</div>
                <div style="font-size:10px; color:var(--texte-secondaire); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">📍 ${adresse}</div>
            </div>
            <div style="font-family:'JetBrains Mono', monospace; font-size:13px; font-weight:bold; color:${prixIndex === prixMin ? '#22c55e' : '#ffffff'}">${affichagePrixIndex}</div>
        `;

        item.addEventListener('click', () => {
            mapTrajet.setView([lat, lon], 14);
            marker.openPopup();
        });
        conteneurListe.appendChild(item);
    });
}

window.toggleBurgerMenu = toggleBurgerMenu;
window.toggleVoletFiltres = toggleVoletFiltres;
window.basculerFavoriTrajet = basculerFavoriTrajet;
