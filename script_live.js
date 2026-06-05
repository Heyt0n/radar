// =========================================================================
// RADAR CARBURANT - MOTEUR LIVE TARGET FUSION (script-live.js)
// FONCTIONS : PINS BLEUS + PASTILLE LED COULEUR SATELLITE EN PERMANENCE
// =========================================================================

const URL_FLUX = "stations_france.json";
const INTERVALLE_RAFRAICHISSEMENT = 5 * 60 * 1000; // Rafraîchissement toutes les 5 minutes

let carte = null;
let coucheMarqueurs = null;

// Coordonnées de ton centre opérationnel (Alsace)
let maLatitude = 48.583;
let maLongitude = 7.747;

// ==========================================
// 1. INITIALISATION DE LA CARTE TACTIQUE
// ==========================================
function initialiserCarte() {
    console.log("🚀 Initialisation du système de cartographie hybride...");
    
    carte = L.map('map').setView([maLatitude, maLongitude], 11); 
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(carte);

    coucheMarqueurs = L.layerGroup().addTo(carte);

    // Liaison avec le sélecteur de rayon HTML
    const selectRayon = document.getElementById("select-rayon") || document.getElementById("rayon-recherche");
    if (selectRayon) {
        selectRayon.addEventListener("change", () => {
            console.log(`🔄 Rayon modifié : ${selectRayon.value} km. Recalcul...`);
            chargerFluxDirect();
        });
    }
}

// ==========================================
// 2. FORMULE MATHÉMATIQUE DE DISTANCE
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
// 3. CALCULATEUR COULEUR MACARON (LED)
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
// 4. CHARGEMENT DU FLUX ET RENDU HYBRIDE
// ==========================================
async function chargerFluxDirect() {
    console.log("📡 Scan réseau : Synchronisation des cibles...");
    
    try {
        const selectRayon = document.getElementById("select-rayon") || document.getElementById("rayon-recherche");
        const rayonMaximum = selectRayon ? parseFloat(selectRayon.value) : 15;

        const antiCache = new Date().getTime();
        const reponse = await fetch(`${URL_FLUX}?v=${antiCache}`);
        
        if (!reponse.ok) throw new Error("Erreur de chargement du JSON.");
        
        const toutesLesStations = await reponse.json();
        
        // Filtrage par rapport à ton rayon d'action
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

        // Déploiement géolocalisé
        stationsDansLeRayon.forEach(station => {
            const prixCible = station.gz;
            const couleurMacaron = calculerCouleurMacaron(prixCible, prixMin, prixMax);
            const estLeMoinsCher = (parseFloat(prixCible) === prixMin);

            // Construction du Marqueur Double : Point Bleu Cyber + Macaron Couleur Constante
            const iconeDoublePoint = L.divIcon({
                className: 'custom-hybrid-pin',
                html: `
                    <div style="position: relative; width: 12px; height: 12px; display: flex; align-items: center; justify-content: center;">
                        
                        <div class="${estLeMoinsCher ? 'pulse-target' : ''}" style="
                            width: 10px; 
                            height: 10px; 
                            background-color: #3b82f6; 
                            border: 2px solid #ffffff; 
                            border-radius: 50%;
                            box-shadow: 0 0 8px #3b82f6, 0 0 15px #3b82f6;
                            z-index: 2;">
                        </div>

                        <div style="
                            position: absolute;
                            top: -5px;
                            right: -5px;
                            width: 7px;
                            height: 7px;
                            background-color: ${couleurMacaron};
                            border: 1px solid #ffffff60;
                            border-radius: 50%;
                            box-shadow: 0 0 6px ${couleurMacaron};
                            z-index: 3;">
                        </div>

                    </div>
                `,
                iconSize: [12, 12],
                iconAnchor: [6, 6] // Ancre centrée parfaitement sur le point bleu
            });

            const marqueur = L.marker([station.lt, station.ln], { icon: iconeDoublePoint });
            
            // Contenu de la Popup au clic
            marqueur.bindPopup(`
                <div style="color: #fff; font-family: 'Plus Jakarta Sans', sans-serif; padding: 4px; min-width: 210px;">
                    <b style="font-size: 14px; color: #f3f4f6; display: block; margin-bottom: 2px;">${station.n}</b>
                    <span style="color: #3b82f6; font-weight: 600; font-size: 11px; display: block; margin-bottom: 6px;">📍 À ${station.distanceCalculee.toFixed(1)} km de toi</span>
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

        console.log(`✅ Carte mise à jour : ${stationsDansLeRayon.length} doubles-points synchronisés.`);

    } catch (erreur) {
        console.error("❌ Erreur de rendu du flux direct :", erreur.message);
    }
}

// ==========================================
// 5. INITIALISATION AUTOMATIQUE
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    initialiserCarte();
    chargerFluxDirect();
    setInterval(chargerFluxDirect, INTERVALLE_RAFRAICHISSEMENT);
});
