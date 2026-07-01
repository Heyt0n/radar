let mapTrajet = null;
let fluxFranceTrajetBrut = [];
let stationsSurTrajet = [];
let routePolyline = null;
let marqueursStationsTrajet = [];
let DISTANCE_MAX_ROUTE_KM = 10;
let listeFavorisIds = [];

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
    try {
        if (typeof _supabase !== 'undefined') {
            const { data: { session } } = await _supabase.auth.getSession();
            if (session && session.user) {
                const pseudo = session.user.user_metadata.display_name || "Opérateur";
                const nomOperateurBadge = document.getElementById("nom-operateur");
                if (nomOperateurBadge) nomOperateurBadge.textContent = pseudo;
                chargerFavorisUtilisateur(session.user.id);
            }
        }
    } catch (err) {
        console.error("Erreur synchro session menu trajet :", err);
    }

    initialiserCarteTrajet();
    initialiserEcouteursTrajet();
    initialiserAutocompletionSurMesure();
});

async function chargerFavorisUtilisateur(userId) {
    try {
        const { data, error } = await _supabase
            .from('profiles')
            .select('favorites')
            .eq('id', userId)
            .single();
        if (data && data.favorites) {
            listeFavorisIds = data.favorites;
        }
    } catch(e) { console.error("Erreur favoris :", e); }
}

async function basculerFavoriSupabase(stationId) {
    try {
        const { data: { session } } = await _supabase.auth.getSession();
        if (!session) {
            alert("Veuillez vous connecter pour gérer vos favoris.");
            return;
        }

        if (listeFavorisIds.includes(stationId)) {
            listeFavorisIds = listeFavorisIds.filter(id => id !== stationId);
        } else {
            listeFavorisIds.push(stationId);
        }

        await _supabase
            .from('profiles')
            .update({ favorites: listeFavorisIds })
            .eq('id', session.user.id);

        rafraichirAffichageStationsTrajet();
    } catch(err) {
        console.error(err);
    }
}

function initialiserCarteTrajet() {
    const el = document.getElementById('map-trajet');
    if (!el) return;
    mapTrajet = L.map('map-trajet', { zoomControl: false }).setView([48.71, 7.82], 9);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© CARTO © OpenStreetMap'
    }).addTo(mapTrajet);
}

function initialiserEcouteursTrajet() {
    document.getElementById('btn-calculer-trajet')?.addEventListener('click', () => {
        executerCalculTrajet();
        if (window.innerWidth <= 768) {
            document.getElementById('options-trajet').classList.add('masque-mobile');
            document.getElementById('indicateur-filtre-fleche').textContent = '▼';
        }
    });

    document.getElementById('select-carburant-trajet')?.addEventListener('change', () => {
        if (stationsSurTrajet.length > 0) rafraichirAffichageStationsTrajet();
    });

    document.getElementById('select-rayon-trajet')?.addEventListener('change', (e) => {
        DISTANCE_MAX_ROUTE_KM = parseInt(e.target.value);
        if (routePolyline) filtrerEtAfficherStations();
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

    if (inputDep) inputDep.addEventListener('input', (e) => gererSuggestionsHTML(e.target.value, 'box-suggestions-depart', inputDep));
    if (inputArr) inputArr.addEventListener('input', (e) => gererSuggestionsHTML(e.target.value, 'box-suggestions-arrivee', inputArr));
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

            if(!data || data.length === 0) {
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
                div.addEventListener('click', () => {
                    inputElement.value = affichage;
                    box.innerHTML = "";
                    box.style.display = 'none';
                });
                box.appendChild(div);
            });
            box.style.display = 'block';
        } catch (e) { console.error(e); }
    }, 300);
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

function estProcheDeLaRoute(stationLat, stationLon, pointsRoute) {
    const pas = Math.max(1, Math.floor(pointsRoute.length / 150)); 
    for (let i = 0; i < pointsRoute.length; i += pas) {
        if (getDistance(stationLat, stationLon, pointsRoute[i][0], pointsRoute[i][1]) <= DISTANCE_MAX_ROUTE_KM) return true;
    }
    return false;
}

async function executerCalculTrajet() {
    const depart = document.getElementById('trajet-depart').value.trim();
    const arrivee = document.getElementById('trajet-arrivee').value.trim();
    const statut = document.getElementById('trajet-statut');

    if (!depart || !arrivee) {
        alert("Veuillez renseigner un départ et une arrivée.");
        return;
    }

    try {
        if (statut) {
            statut.textContent = "⚡ Localisation...";
            statut.style.color = "#eab308";
        }

        const coordsDep = await obtenirCoordonnees(depart);
        const coordsArr = await obtenirCoordonnees(arrivee);

        if (!coordsDep || !coordsArr) {
            if (statut) {
                statut.textContent = "❌ Ville introuvable.";
                statut.style.color = "#ef4444";
            }
            return;
        }

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

        if (statut) statut.textContent = "🛰️ Analyse...";
        if (fluxFranceTrajetBrut.length === 0) {
            const resFR = await fetch('./stations_france.json');
            fluxFranceTrajetBrut = await resFR.json();
        }

        filtrerEtAfficherStations();
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

function formatPrix(valeur) {
    let p = parseFloat(valeur);
    return (p && p > 0) ? `${p.toFixed(3)} €` : "Rupture";
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

    if (modeAffichage === 'top10') stationsAffichables = stationsAffichables.slice(0, 10);
    else if (modeAffichage === 'top20') stationsAffichables = stationsAffichables.slice(0, 20);

    if (stationsAffichables.length === 0) {
        conteneurListe.innerHTML = `<p style="font-size:11px; color:var(--texte-secondaire); text-align:center;">Aucune station.</p>`;
        return;
    }

    stationsAffichables.forEach(station => {
        let lat = parseFloat(station.lt);
        let lon = parseFloat(station.ln);
        let prixIndex = parseFloat(station[carburantActif]);
        let affichagePrixIndex = formatPrix(prixIndex);

        let nomStation = (station.n || "Station").trim();
        let adresse = (station.a || "").trim();
        let idStation = station.id || `${lat}_${lon}`;

        let couleurMarker = 'blue';
        let couleurBulle = null;
        if (prixIndex && prixMin !== Infinity && prixMax !== -Infinity && prixMin !== prixMax) {
            if (prixIndex === prixMin) couleurMarker = 'green';
            else if (prixIndex === prixMax) couleurMarker = 'red';
            let score = (prixIndex - prixMin) / (prixMax - prixMin);
            couleurBulle = `hsl(${(1 - score) * 120}, 100%, 50%)`;
        }

        const iconeHTML = L.divIcon({
            html: `
                <div style="position: relative; width: 25px; height: 41px;">
                    ${couleurBulle ? `<div style="position: absolute; top: -6px; left: -8px; background: ${couleurBulle}; width: 14px; height: 14px; border-radius: 50%; border: 1.5px solid #111827; z-index: 20;"></div>` : ''}
                    <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${couleurMarker}.png" style="width: 25px; height: 41px; display: block;">
                </div>
            `,
            className: 'custom-hybrid-pin',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34]
        });

        const estFav = listeFavorisIds.includes(idStation);
        
        const popupContent = `
            <div class="popup-station-title">${nomStation}</div>
            <div style="font-size:10px; color:#9ca3af; margin-bottom:6px; line-height:1.2;">📍 ${adresse}</div>
            
            <div class="popup-carburant-ligne ${carburantActif === 'gz' ? 'actif' : ''}">
                <span>Gazole :</span><b>${formatPrix(station['gz'])}</b>
            </div>
            <div class="popup-carburant-ligne ${carburantActif === 'e10' ? 'actif' : ''}">
                <span>SP95-E10 :</span><b>${formatPrix(station['e10'])}</b>
            </div>
            <div class="popup-carburant-ligne ${carburantActif === '95' ? 'actif' : ''}">
                <span>SP95 :</span><b>${formatPrix(station['95'])}</b>
            </div>
            <div class="popup-carburant-ligne ${carburantActif === '98' ? 'actif' : ''}">
                <span>SP98 :</span><b>${formatPrix(station['98'])}</b>
            </div>

            <div class="popup-btn-actions">
                <button class="popup-btn popup-btn-fav ${estFav ? 'deja-fav' : ''}" onclick="basculerFavoriSupabase('${idStation}')">
                    ⭐ ${estFav ? 'Enlever' : 'Favori'}
                </button>
                <a class="popup-btn popup-btn-maps" href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}" target="_blank">
                    🗺️ Itinéraire
                </a>
            </div>
        `;

        // AJOUT SÉCURITÉ AUTOPAN : Force la carte à se décaler intelligemment vers le bas pour ne pas cacher le haut de la popup
        const marker = L.marker([lat, lon], { icon: iconeHTML }).addTo(mapTrajet);
        marker.bindPopup(popupContent, {
            autoPan: true,
            autoPanPadding: L.point(15, 60) // Sécurité de 60px par rapport au haut de l'écran mobile !
        });
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
window.basculerFavoriSupabase = basculerFavoriSupabase;
