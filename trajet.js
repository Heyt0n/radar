// ============================================================================
// 🗺️ RADAR CARBURANT - LOGIQUE TRAJET & SUGGESTIONS HTML
// ============================================================================

let mapTrajet = null;
let fluxFranceTrajetBrut = [];
let stationsSurTrajet = [];
let routePolyline = null;
let marqueursStationsTrajet = [];
let DISTANCE_MAX_ROUTE_KM = 10;

document.addEventListener("DOMContentLoaded", () => {
    chargerMenuCommun(); // Charge le menu burger externe
    initialiserCarteTrajet();
    initialiserEcouteursTrajet();
    initialiserAutocompletionSurMesure();
});

// --- CHARGEMENT DU MENU BURGER MUTUALISÉ ---
async function chargerMenuCommun() {
    try {
        const reponse = await fetch('menu.html');
        if (reponse.ok) {
            const htmlMenu = await reponse.text();
            document.getElementById('conteneur-menu-commun').innerHTML = htmlMenu;
        }
    } catch (err) {
        console.error("Impossible de charger le menu commun :", err);
    }
}

function toggleBurgerMenu() {
    document.getElementById('burgerMenu')?.classList.toggle('open');
    document.getElementById('menuOverlay')?.classList.toggle('active');
}

// --- CONFIGURATION INITIALE DE LA MAP ---
function initialiserCarteTrajet() {
    mapTrajet = L.map('map-trajet', { zoomControl: false }).setView([48.71, 7.82], 9);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© CARTO © OpenStreetMap'
    }).addTo(mapTrajet);
}

function initialiserEcouteursTrajet() {
    document.getElementById('btn-calculer-trajet')?.addEventListener('click', executerCalculTrajet);
    
    document.getElementById('select-carburant-trajet')?.addEventListener('change', () => {
        if (stationsSurTrajet.length > 0) rafraichirAffichageStationsTrajet();
    });

    document.getElementById('select-rayon-trajet')?.addEventListener('change', (e) => {
        DISTANCE_MAX_ROUTE_KM = parseInt(e.target.value);
        if (routePolyline) {
            filtrerEtAfficherStations();
            mapTrajet.invalidateSize();
        }
    });

    document.getElementById('select-affichage-trajet')?.addEventListener('change', () => {
        if (stationsSurTrajet.length > 0) rafraichirAffichageStationsTrajet();
    });

    // Fermer les suggestions si on clique n'importe où ailleurs sur la page
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.wrapper-input')) {
            document.getElementById('box-suggestions-depart').style.display = 'none';
            document.getElementById('box-suggestions-arrivee').style.display = 'none';
        }
    });
}

// --- AUTOCOMPLÉTION GRAPHIQUE SOUS L'INPUT ---
function initialiserAutocompletionSurMesure() {
    const inputDep = document.getElementById('trajet-depart');
    const inputArr = document.getElementById('trajet-arrivee');

    if (inputDep) {
        inputDep.addEventListener('input', (e) => gererSuggestionsHTML(e.target.value, 'box-suggestions-depart', inputDep));
    }
    if (inputArr) {
        inputArr.addEventListener('input', (e) => gererSuggestionsHTML(e.target.value, 'box-suggestions-arrivee', inputArr));
    }
}

let timeoutSuggestion;
function gererSuggestionsHTML(valeur, idBox, inputElement) {
    const box = document.getElementById(idBox);
    if (!box) return;

    if (valeur.trim().length < 3) {
        box.innerHTML = "";
        box.style.display = 'none';
        return;
    }

    clearTimeout(timeoutSuggestion);
    timeoutSuggestion = setTimeout(async () => {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(valeur)}&countrycodes=fr,de&limit=5&addressdetails=1`);
            const data = await res.json();
            
            box.innerHTML = "";
            
            if(data.length === 0) {
                box.style.display = 'none';
                return;
            }

            data.forEach(item => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                
                const villeNom = item.display_name.split(',')[0];
                const codePostal = item.address?.postcode || '';
                const affichage = codePostal ? `${villeNom} (${codePostal})` : villeNom;
                
                div.textContent = affichage;
                
                // Au clic sur la suggestion
                div.addEventListener('click', () => {
                    inputElement.value = affichage;
                    box.innerHTML = "";
                    box.style.display = 'none';
                });
                
                box.appendChild(div);
            });

            box.style.display = 'block';
        } catch (e) {
            console.error("Erreur suggestions :", e);
        }
    }, 300);
}

// --- ALGORITHMES GÉOMÉTRIQUES ---
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
        if (getDistance(stationLat, stationLon, pointsRoute[i][0], pointsRoute[i][1]) <= DISTANCE_MAX_ROUTE_KM) {
            return true;
        }
    }
    return false;
}

// --- CALCUL DE L'ITINÉRAIRE ---
async function executerCalculTrajet() {
    const depart = document.getElementById('trajet-depart').value.trim();
    const arrivee = document.getElementById('trajet-arrivee').value.trim();
    const statut = document.getElementById('trajet-statut');

    if (!depart || !arrivee) {
        alert("Veuillez renseigner un départ et une arrivée.");
        return;
    }

    try {
        statut.textContent = "⚡ Localisation...";
        statut.style.color = "#eab308";

        const coordsDep = await obtenirCoordonnees(depart);
        const coordsArr = await obtenirCoordonnees(arrivee);

        if (!coordsDep || !coordsArr) {
            statut.textContent = "❌ Ville introuvable.";
            statut.style.color = "#ef4444";
            return;
        }

        statut.textContent = "🗺️ Tracé de la route...";

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
            statut.textContent = "❌ Aucun trajet trouvé.";
            statut.style.color = "#ef4444";
            return;
        }

        const geojsonPoints = dataRoute.routes[0].geometry.coordinates;
        const pointsRouteLeaflet = geojsonPoints.map(p => [p[1], p[0]]);

        if (routePolyline) mapTrajet.removeLayer(routePolyline);
        routePolyline = L.polyline(pointsRouteLeaflet, { color: '#2563eb', weight: 6, opacity: 0.85 }).addTo(mapTrajet);
        
        mapTrajet.invalidateSize();
        mapTrajet.fitBounds(routePolyline.getBounds(), { padding: [40, 40] });

        statut.textContent = "🛰️ Analyse de la zone...";

        if (fluxFranceTrajetBrut.length === 0) {
            const resFR = await fetch('./stations_france.json');
            fluxFranceTrajetBrut = await resFR.json();
        }

        filtrerEtAfficherStations();

    } catch (err) {
        console.error(err);
        statut.textContent = "❌ Erreur de liaison.";
        statut.style.color = "#ef4444";
    }
}

async function obtenirCoordonnees(nomVille) {
    const requeteClean = nomVille.split('(')[0].trim();
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(requeteClean)}&countrycodes=fr,de&limit=1`);
    const data = await res.json();
    return (data && data.length > 0) ? [parseFloat(data[0].lat), parseFloat(data[0].lon)] : null;
}

function filtrerEtAfficherStations() {
    const statut = document.getElementById('trajet-statut');
    const pointsRouteLeaflet = routePolyline.getLatLngs().map(latlng => [latlng.lat, latlng.lng]);

    stationsSurTrajet = fluxFranceTrajetBrut.filter(station => {
        if (!station.lt || !station.ln) return false;
        return estProcheDeLaRoute(station.lt, station.ln, pointsRouteLeaflet);
    });

    if (statut) {
        statut.textContent = `🎯 ${stationsSurTrajet.length} détectées.`;
        statut.style.color = "#22c55e";
    }

    rafraichirAffichageStationsTrajet();
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
        let p = parseFloat(s[carburantActif]);
        if (p && p > 0) {
            if (p < prixMin) prixMin = p;
            if (p > prixMax) prixMax = p;
        }
    });

    let stationsAffichables = [...stationsSurTrajet].sort((a, b) => {
        let prixA = parseFloat(a[carburantActif]) || Infinity;
        let prixB = parseFloat(b[carburantActif]) || Infinity;
        return prixA - prixB;
    });

    if (modeAffichage === 'top10') {
        stationsAffichables = stationsAffichables.slice(0, 10);
    } else if (modeAffichage === 'top20') {
        stationsAffichables = stationsAffichables.slice(0, 20);
    }

    if (stationsAffichables.length === 0) {
        conteneurListe.innerHTML = `<p style="font-size:12px; color:#6b7280; text-align:center;">Aucune station.</p>`;
        return;
    }

    stationsAffichables.forEach(station => {
        let lat = parseFloat(station.lt);
        let lon = parseFloat(station.ln);
        let prix = parseFloat(station[carburantActif]);
        let affichagePrix = (prix && prix > 0) ? `${prix.toFixed(3)} €` : "Rupture";

        let nomStation = (station.n || "Station").trim();
        let adresse = (station.a || "").trim();

        let couleurMarker = 'blue';
        let couleurBulle = null;
        if (prix && prixMin !== Infinity && prixMax !== -Infinity && prixMin !== prixMax) {
            if (prix === prixMin) couleurMarker = 'green';
            else if (prix === prixMax) couleurMarker = 'red';

            let score = (prix - prixMin) / (prixMax - prixMin);
            couleurBulle = `hsl(${(1 - score) * 120}, 100%, 50%)`;
        }

        const iconeHTML = L.divIcon({
            html: `
                <div style="position: relative; width: 25px; height: 41px;">
                    ${couleurBulle ? `<div style="position: absolute; top: -6px; left: -8px; background: ${couleurBulle}; width: 14px; height: 14px; border-radius: 50%; border: 1.5px solid #111827; z-index: 20;"></div>` : ''}
                    <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${couleurMarker}.png" style="width: 25px; height: 41px; display: block;">
                </div>
            `,
            className: 'custom-route-pin',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34]
        });

        const marker = L.marker([lat, lon], { icon: iconeHTML }).addTo(mapTrajet);
        marker.bindPopup(`<b>${nomStation}</b><br>${adresse}<br><b style="color:#22c55e;">${affichagePrix}</b>`);
        marqueursStationsTrajet.push(marker);

        const item = document.createElement('div');
        item.style.background = "#1f2937";
        item.style.padding = "10px";
        item.style.borderRadius = "8px";
        item.style.cursor = "pointer";
        item.style.display = "flex";
        item.style.justifyContent = "space-between";
        item.style.alignItems = "center";
        
        if (prix === prixMin && prixMin !== Infinity) {
            item.style.border = "1px solid #22c55e";
        }

        item.innerHTML = `
            <div style="flex: 1; min-width: 0; padding-right:8px;">
                <div style="font-weight:bold; font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#eab308;">${nomStation}</div>
                <div style="font-size:10px; color:#9ca3af; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">📍 ${adresse}</div>
            </div>
            <div style="font-family:monospace; font-size:13px; font-weight:bold; color:${prix === prixMin ? '#22c55e' : '#ffffff'}">${affichagePrix}</div>
        `;

        item.addEventListener('click', () => {
            mapTrajet.setView([lat, lon], 14);
            marker.openPopup();
        });

        conteneurListe.appendChild(item);
    });
}
