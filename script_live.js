// =========================================================================
// RADAR CARBURANT - MOTEUR LIVE HYBRIDE (script-live.js)
// FONCTIONS : FLUX DIRECT, FILTRAGE PAR RAYON, GRADIENT LOCAL & LOOK CYBER
// =========================================================================

const URL_FLUX = "stations_france.json";
const INTERVALLE_RAFRAICHISSEMENT = 5 * 60 * 1000; // Fréquence de vérification : 5 minutes

let carte = null;
let coucheMarqueurs = null;

// Coordonnées de ton centre opérationnel (Alsace / Hœrdt / Gambsheim)
let maLatitude = 48.583;
let maLongitude = 7.747;

// ==========================================
// 1. INITIALISATION DU SYSTÈME GÉOGRAPHIQUE
// ==========================================
function initialiserCarte() {
    console.log("🚀 Initialisation de la carte tactique...");
    
    // Positionnement initial
    carte = L.map('map').setView([maLatitude, maLongitude], 11); 
    
    // Cartographie en thème sombre premium
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(carte);

    // Initialisation de la couche dynamique pour accueillir les marqueurs
    coucheMarqueurs = L.layerGroup().addTo(carte);

    // Détection et liaison avec ton sélecteur de rayon dans le HTML
    const selectRayon = document.getElementById("select-rayon") || document.getElementById("rayon-recherche");
    if (selectRayon) {
        selectRayon.addEventListener("change", () => {
            console.log(`🔄 Périmètre modifié : ${selectRayon.value} km. Recalcul des positions en cours...`);
            chargerFluxDirect();
        });
    }
}

// ==========================================
// 2. FORMULE MATHÉMATIQUE DE BALISTIQUE (HAVERSINE)
// ==========================================
// Calcule la distance au dixième de kilomètre près entre ton QG et une cible
function calculerDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Rayon moyen de la Terre en kilomètres
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; 
}

// ==========================================
// 3. CALCULATEUR CHROMATIQUE DE CONTRASTE (GRADIENT HSL)
// ==========================================
// Attribue une couleur au texte du prix en fonction de sa compétitivité dans ton rayon
function calculerCouleurTexte(prix, prixMin, prixMax) {
    const p = parseFloat(prix);
    const min = parseFloat(prixMin);
    const max = parseFloat(prixMax);

    if (max === min || isNaN(p)) return "hsl(120, 90%, 50%)"; // Vert brillant par défaut

    // Normalisation du score entre 0 (le moins cher) et 1 (le plus cher)
    let score = (p - min) / (max - min);
    if (score < 0) score = 0;
    if (score > 1) score = 1;

    // Déplacement sur la roue chromatique HSL : 120 (Vert pur) -> 60 (Jaune) -> 0 (Rouge vif)
    const teinte = (1 - score) * 120;
    return `hsl(${teinte}, 100%, 55%)`; // Luminosité augmentée pour détacher le texte du fond sombre
}

// ==========================================
// 4. SYNCHRONISATION DU FLUX INSTANTANÉ
// ==========================================
async function chargerFluxDirect() {
    console.log("📡 Scan réseau : Capture de la dernière version du flux de compression...");
    
    try {
        // Détermination du rayon d'action actuel (15 km par défaut)
        const selectRayon = document.getElementById("select-rayon") || document.getElementById("rayon-recherche");
        const rayonMaximum = selectRayon ? parseFloat(selectRayon.value) : 15;

        // Cassage systématique du cache navigateur pour récupérer le travail du script Python
        const antiCache = new Date().getTime();
        const reponse = await fetch(`${URL_FLUX}?v=${antiCache}`);
        
        if (!reponse.ok) throw new Error("Échec de récupération du fichier source JSON.");
        
        const toutesLesStations = await reponse.json();
        
        // FILTRAGE : Isolement exclusif des stations correspondantes au périmètre
        const stationsFiltrees = toutesLesStations.filter(station => {
            if (!station.lt || !station.ln || !station.gz) return false;
            
            const distance = calculerDistance(maLatitude, maLongitude, station.lt, station.ln);
            station.distanceCalculee = distance; // Sauvegarde de la distance pour la popup
            
            return distance <= rayonMaximum;
        });

        // Si la zone est vide
        if (stationsFiltrees.length === 0) {
            console.warn(`⚠️ Aucune donnée disponible dans un rayon de ${rayonMaximum} km.`);
            coucheMarqueurs.clearLayers();
            return;
        }

        // ANALYSE DE LA VOLATILITÉ LOCALE : Extraction des extrêmes de prix sur la zone isolée
        let listePrixSecteur = stationsFiltrees.map(s => parseFloat(s.gz));
        const prixMin = Math.min(...listePrixSecteur);
        const prixMax = Math.max(...listePrixSecteur);

        console.log(`🎯 Périmètre [${rayonMaximum} km] verrouillé. Stations détectées : ${stationsFiltrees.length} | Min : ${prixMin.toFixed(3)}€ | Max : ${prixMax.toFixed(3)}€`);

        // Purge de l'affichage précédent
        coucheMarqueurs.clearLayers();

        // INJECTION DES MARQUEURS HYBRIDES
        stationsFiltrees.forEach(station => {
            const prixCible = station.gz;
            const estLeMoinsCher = (parseFloat(prixCible) === prixMin);
            
            // Calcul de la teinte du prix en direct
            const couleurPrix = calculerCouleurTexte(prixCible, prixMin, prixMax);

            // Architecture HTML/CSS du Pin de Fusion Premium
            const iconeHybride = L.divIcon({
                className: 'custom-hybrid-pin',
                html: `
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative;">
                        <div style="
                            background: rgba(17, 24, 39, 0.95); 
                            backdrop-filter: blur(4px);
                            border: 1px solid #1e293b; 
                            padding: 2px 6px; 
                            border-radius: 4px; 
                            color: ${couleurPrix}; 
                            font-weight: 800; 
                            font-size: 11px;
                            box-shadow: 0 4px 12px rgba(0,0,0,0.6);
                            font-family: 'Plus Jakarta Sans', sans-serif;
                            white-space: nowrap;
                            margin-bottom: 3px;
                            transition: all 0.2s ease;">
                            ${parseFloat(prixCible).toFixed(2)}
                        </div>
                        
                        <div class="${estLeMoinsCher ? 'pulse-target' : ''}" style="
                            width: 10px; 
                            height: 10px; 
                            background-color: #3b82f6; 
                            border: 2px solid #ffffff; 
                            border-radius: 50%;
                            box-shadow: 0 0 10px #3b82f6, 0 0 20px #3b82f6;
                            transition: all 0.3s ease;">
                        </div>
                    </div>
                `,
                iconSize: [50, 40],
                iconAnchor: [25, 33] // Alignement de l'ancre géolocalisée directement sur le point central
            });

            const marqueur = L.marker([station.lt, station.ln], { icon: iconeHybride });
            
            // Conception de l'infobulle (Popup) au format tactique
            marqueur.bindPopup(`
                <div style="color: #fff; font-family: 'Plus Jakarta Sans', sans-serif; padding: 4px; min-width: 210px;">
                    <b style="font-size: 14px; color: #f3f4f6; display: block; margin-bottom: 2px;">${station.n}</b>
                    <span style="color: #3b82f6; font-weight: 600; font-size: 11px; display: block; margin-bottom: 6px;">📍 À ${station.distanceCalculee.toFixed(1)} km de ton QG</span>
                    <span style="color: #9ca3af; font-size: 11px; display: block; margin-bottom: 8px; line-height: 1.3;">${station.a} (${station.v})</span>
                    
                    <div style="font-size: 13px; color: #9ca3af; border-top: 1px solid #1f2937; padding-top: 6px; font-weight: bold; display: flex; justify-content: space-between; align-items: center;">
                        <span>Gazole :</span> 
                        <span style="color: ${couleurPrix}; font-size: 16px; font-weight: 800;">${parseFloat(prixCible).toFixed(3)} €</span>
                    </div>
                </div>
            `, { className: 'dark-popup' });

            coucheMarqueurs.addLayer(marqueur);
        });

        console.log(`✅ Déploiement achevé. Écosystème synchronisé.`);

    } catch (erreur) {
        console.error("❌ Panne critique du moteur de flux direct :", erreur.message);
    }
}

// ==========================================
// 5. POINT D'ENTRÉE DU SCRIPT
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    initialiserCarte();
    chargerFluxDirect();

    // Enclenchement de la boucle d'écoute du cache toutes les 5 minutes
    setInterval(chargerFluxDirect, INTERVALLE_RAFRAICHISSEMENT);
});
