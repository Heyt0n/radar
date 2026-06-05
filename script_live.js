// =========================================================================
// RADAR CARBURANT - MOTEUR LIVE TACTIQUE (script-live.js)
// INTERFACE : ÉPINGLES ORIGINELLES, MACARON PRIX À GAUCHE & POPUP SOMBRE
// =========================================================================

const URL_FLUX = "stations_france.json";
const INTERVALLE_RAFRAICHISSEMENT = 5 * 60 * 1000; // 5 minutes

let carte = null;
let coucheMarqueurs = null;

// Coordonnées de ton centre opérationnel (Alsace)
let maLatitude = 48.583;
let maLongitude = 7.747;

// ==========================================
// 1. INITIALISATION DE LA CARTOGRAPHIE
// ==========================================
function initialiserCarte() {
    console.log("🚀 Alignement de la carte avec les objectifs visuels...");
    
    carte = L.map('map').setView([maLatitude, maLongitude], 11); 
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(carte);

    coucheMarqueurs = L.layerGroup().addTo(carte);

    // Écouteur pour adapter la zone si le rayon change
    const selectRayon = document.getElementById("select-rayon") || document.getElementById("rayon-recherche");
    if (selectRayon) {
        selectRayon.addEventListener("change", () => {
            console.log(`🔄 Périmètre ajusté : ${selectRayon.value} km.`);
            chargerFluxDirect();
        });
    }
}

// ==========================================
// 2. FORMULE GÉODÉSIQUE (HAVERSINE)
// ==========================================
function calculerDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))); 
}

// ==========================================
// 3. CALCULATEUR DYNAMIQUE DU VOYANT PRIX
// ==========================================
function calculerCouleurMacaron(prix, prixMin, prixMax) {
    const p = parseFloat(prix);
    const min = parseFloat(prixMin);
    const max = parseFloat(prixMax);

    if (max === min || isNaN(p)) return "hsl(120, 100%, 50%)";

    let score = (p - min) / (max - min);
    if (score < 0) score = 0;
    if (score > 1) score = 1;

    // Dégradé : 120 (Vert) -> 60 (Jaune) -> 0 (Rouge)
    const teinte = (1 - score) * 120;
    return `hsl(${teinte}, 100%, 50%)`;
}

// ==========================================
// 4. CHARGEMENT DU FLUX & DÉPLOIEMENT DES CIBLES
// ==========================================
async function chargerFluxDirect() {
    console.log("📡 Scan réseau : Analyse et filtrage du flux carburant...");
    
    try {
        const selectRayon = document.getElementById("select-rayon") || document.getElementById("rayon-recherche");
        const rayonMaximum = selectRayon ? parseFloat(selectRayon.value) : 15;

        const antiCache = new Date().getTime();
        const reponse = await fetch(`${URL_FLUX}?v=${antiCache}`);
        
        if (!reponse.ok) throw new Error("Erreur lors de la capture du JSON.");
        
        const toutesLesStations = await reponse.json();
        
        // Isolation des cibles dans ton rayon d'action
        const stationsDansLeRayon = toutesLesStations.filter(station => {
            if (!station.lt || !station.ln || !station.gz) return false;
            
            const distance = calculerDistance(maLatitude, maLongitude, station.lt, station.ln);
            station.distanceCalculee = distance;
            
            return distance <= rayonMaximum;
        });

        if (stationsDansLeRayon.length === 0) {
            coucheMarqueurs.clearLayers();
            return;
        }

        // Calibrage thermique de la zone locale
        let prixSecteur = stationsDansLeRayon.map(s => parseFloat(s.gz));
        const prixMin = Math.min(...prixSecteur);
        const prixMax = Math.max(...prixSecteur);

        coucheMarqueurs.clearLayers();

        // Rendu graphique sur la carte
        stationsDansLeRayon.forEach(station => {
            const prixCible = station.gz;
            const couleurMacaron = calculerCouleurMacaron(prixCible, prixMin, prixMax);
            const estLeMoinsCher = (parseFloat(prixCible) === prixMin);

            // Création de l'Épingle d'Origine avec Macaron de prix ancré à GAUCHE
            const iconeCyber = L.divIcon({
                className: 'custom-hybrid-pin',
                html: `
                    <div style="position: relative; width: 24px; height: 32px;">
                        
                        <div class="${estLeMoinsCher ? 'pulse-target' : ''}" style="
                            position: absolute;
                            width: 24px;
                            height: 24px;
                            background-color: #3b82f6;
                            border: 2px solid #ffffff;
                            border-radius: 50% 50% 50% 0;
                            transform: rotate(-45deg);
                            box-shadow: 0 0 10px #3b82f6;
                            left: 0;
                            top: 0;
                            z-index: 2;">
                            
                            <div style="
                                position: absolute;
                                width: 8px;
                                height: 8px;
                                background-color: #ffffff;
                                border-radius: 50%;
                                top: 50%;
                                left: 50%;
                                transform: translate(-50%, -50%) rotate(45deg);">
                            </div>
                        </div>

                        <div style="
                            position: absolute;
                            left: -6px;
                            top: 2px;
                            width: 9px;
                            height: 9px;
                            background-color: ${couleurMacaron};
                            border: 1.5px solid #ffffff;
                            border-radius: 50%;
                            box-shadow: 0 0 8px ${couleurMacaron};
                            z-index: 3;">
                        </div>

                    </div>
                `,
                iconSize: [24, 32],
                iconAnchor: [12, 32] // Point de fixation précis sur la pointe basse de la goutte
            });

            const marqueur = L.marker([station.lt, station.ln], { icon: iconeCyber });
            
            // Structure de ton infobulle (Popup)
            marqueur.bindPopup(`
                <div style="color: #fff; font-family: 'Plus Jakarta Sans', sans-serif; padding: 4px; min-width: 210px;">
                    <b style="font-size: 14px; color: #f3f4f6; display: block; margin-bottom: 2px;">${station.n}</b>
                    <span style="color: #3b82f6; font-weight: 600; font-size: 11px; display: block; margin-bottom: 6px;">📍 À ${station.distanceCalculee.toFixed(1)} km de ton QG</span>
                    <span style="color: #9ca3af; font-size: 11px; display: block; margin-bottom: 8px; line-height: 1.3;">${station.a} (${station.v})</span>
                    
                    <div style="font-size: 13px; color: #9ca3af; border-top: 1px solid #1f2937; padding-top: 8px; font-weight: bold; display: flex; justify-content: space-between; align-items: center;">
                        <span>Gazole :</span> 
                        <span style="color: ${couleurMacaron}; font-size: 16px; font-weight: 800;">
                            ${parseFloat(prixCible).toFixed(3)} €
                        </span>
                    </div>
                </div>
            `, { className: 'dark-popup' });

            coucheMarqueurs.addLayer(marqueur);
        });

        console.log(`✅ Objectif atteint : ${stationsDansLeRayon.length} épingles cyber ajustées avec macaron gauche.`);

    } catch (erreur) {
        console.error("❌ Panne lors du rendu de la carte :", erreur.message);
    }
}

// ==========================================
// 5. ENCLENCHEMENT DU SYSTEME
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    initialiserCarte();
    chargerFluxDirect();
    setInterval(chargerFluxDirect, INTERVALLE_RAFRAICHISSEMENT);
});
