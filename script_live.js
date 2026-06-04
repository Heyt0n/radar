// =========================================================================
// RADAR CARBURANT - MOTEUR LIVE AVEC GRADIENT & RAYON TACTIQUE (script-live.js)
// =========================================================================

const URL_FLUX = "stations_france.json";
const INTERVALLE_RAFRAICHISSEMENT = 5 * 60 * 1000; // 5 minutes

let carte = null;
let coucheMarqueurs = null;

// Position de référence par défaut (ex: ton QG à Gambsheim / Hœrdt)
// Note : Si tu utilises la géolocalisation de l'utilisateur, tu mettras à jour ces variables
let maLatitude = 48.583;
let maLongitude = 7.747;

function initialiserCarte() {
    carte = L.map('map').setView([maLatitude, maLongitude], 11); 
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(carte);

    coucheMarqueurs = L.layerGroup().addTo(carte);

    // Écouteur pour rafraîchir la carte si l'utilisateur change le rayon dans le HTML
    const selectRayon = document.getElementById("select-rayon") || document.getElementById("rayon-recherche");
    if (selectRayon) {
        selectRayon.addEventListener("change", () => {
            console.log(`🔄 Rayon modifié : ${selectRayon.value} km. Recalcul de la zone...`);
            chargerFluxDirect();
        });
    }
}

// ==========================================
// OUTIL MATHÉMATIQUE : FORMULE DE HAVERSINE
// ==========================================
// Calcule la distance exacte en km entre deux points géographiques
function calculerDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Rayon de la Terre en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance en kilomètres
}

// ==========================================
// MOTEUR DE COULEUR : LE GRADIENT TACTIQUE
// ==========================================
function calculerCouleurGradient(prix, prixMin, prixMax) {
    const p = parseFloat(prix);
    const min = parseFloat(prixMin);
    const max = parseFloat(prixMax);

    if (max === min || isNaN(p)) return "hsl(120, 85%, 45%)";

    let score = (p - min) / (max - min);
    if (score < 0) score = 0;
    if (score > 1) score = 1;

    const teinte = (1 - score) * 120; // Vert (120) -> Jaune -> Rouge (0)
    return `hsl(${teinte}, 95%, 45%)`;
}

// ==========================================
// SYNCHRONISATION ET FILTRAGE DE ZONE
// ==========================================
async function chargerFluxDirect() {
    console.log("📡 Scan du périmètre et recherche du flux...");
    
    try {
        // Récupération dynamique du rayon sélectionné dans ton HTML (15km par défaut si introuvable)
        const selectRayon = document.getElementById("select-rayon") || document.getElementById("rayon-recherche");
        const rayonMaximum = selectRayon ? parseFloat(selectRayon.value) : 15;

        const antiCache = new Date().getTime();
        const reponse = await fetch(`${URL_FLUX}?v=${antiCache}`);
        
        if (!reponse.ok) throw new Error("Impossible de lire le fichier JSON.");
        
        const toutesLesStations = await reponse.json();
        
        // 1. FILTRAGE CHIRURGICAL : On ne garde que les stations dans le rayon cible
        const stationsDansLeRayon = toutesLesStations.filter(station => {
            if (!station.lt || !station.ln || !station.gz) return false;
            
            // Calcul de la distance entre ton point de référence et la station
            const distance = calculerDistance(maLatitude, maLongitude, station.lt, station.ln);
            station.distanceCalculee = distance; // On stocke l'info pour la popup
            
            return distance <= rayonMaximum;
        });

        if (stationsDansLeRayon.length === 0) {
            console.warn(`⚠️ Aucune station détectée dans un rayon de ${rayonMaximum} km.`);
            coucheMarqueurs.clearLayers();
            return;
        }

        // 2. EXTRACTION DES PRIX DE ZONE (Le gradient se calibre uniquement sur ton secteur !)
        let prixDuSecteur = stationsDansLeRayon.map(s => parseFloat(s.gz));
        const prixMin = Math.min(...prixDuSecteur);
        const prixMax = Math.max(...prixDuSecteur);

        console.log(`🎯 [Rayon ${rayonMaximum}km] : ${stationsDansLeRayon.length} stations détectées. Min: ${prixMin}€ | Max: ${prixMax}€`);

        // 3. NETTOYAGE COMPLET DES ANCIENS PINS
        coucheMarqueurs.clearLayers();

        // 4. DEPLOIEMENT TACTIQUE
        stationsDansLeRayon.forEach(station => {
            const prixCible = station.gz;
            const couleurPin = calculerCouleurGradient(prixCible, prixMin, prixMax);

            const iconeCustom = L.divIcon({
                className: 'custom-gradient-pin',
                html: `<div style="
                    background-color: ${couleurPin}; 
                    width: 44px; 
                    height: 24px; 
                    border-radius: 5px; 
                    border: 1px solid #ffffff40;
                    color: white; 
                    font-weight: bold; 
                    font-size: 11px;
                    display: flex; 
                    align-items: center; 
                    justify-content: center;
                    box-shadow: 0 3px 8px rgba(0,0,0,0.6);
                    font-family: 'Plus Jakarta Sans', sans-serif;">
                    ${parseFloat(prixCible).toFixed(2)}
                </div>`,
                iconSize: [44, 24],
                iconAnchor: [22, 12]
            });

            const marqueur = L.marker([station.lt, station.ln], { icon: iconeCustom });
            
            marqueur.bindPopup(`
                <div style="color: #fff; font-family: 'Plus Jakarta Sans', sans-serif; padding: 4px; min-width: 200px;">
                    <b style="font-size: 14px; color: #f3f4f6; display: block; margin-bottom: 2px;">${station.n}</b>
                    <span style="color: #9ca3af; font-size: 11px; display: block; margin-bottom: 6px;">📍 À ${station.distanceCalculee.toFixed(1)} km de toi</span>
                    <span style="color: #71717a; font-size: 12px; display: block; margin-bottom: 8px;">${station.a} (${station.v})</span>
                    <div style="font-size: 14px; color: #3b82f6; border-top: 1px solid #1f2937; padding-top: 6px; font-weight: bold;">
                        Gazole : <span style="color: #22c55e; font-size: 16px;">${parseFloat(prixCible).toFixed(3)} €</span>
                    </div>
                </div>
            `, { className: 'dark-popup' });

            coucheMarqueurs.addLayer(marqueur);
        });

    } catch (erreur) {
        console.error("❌ Erreur lors du filtrage par rayon :", erreur.message);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    initialiserCarte();
    chargerFluxDirect();

    setInterval(chargerFluxDirect, INTERVALLE_RAFRAICHISSEMENT);
});
