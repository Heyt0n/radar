// =========================================================================
// RADAR CARBURANT - MOTEUR DE FLUX DIRECT & GRADIENT DYNAMIQUE (script-live.js)
// =========================================================================

const URL_FLUX = "stations_france.json";
const INTERVALLE_RAFRAICHISSEMENT = 5 * 60 * 1000; // Le JS vérifie s'il y a du neuf toutes les 5 minutes

let carte = null;
let coucheMarqueurs = null;

// Initialisation de la carte Leaflet
function initialiserCarte() {
    // Centré par défaut sur tes coordonnées (Alsace / Gambsheim)
    carte = L.map('map').setView([48.583, 7.747], 11); 
    
    // Thème sombre premium
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(carte);

    coucheMarqueurs = L.layerGroup().addTo(carte);
}

// ==========================================
// MOTEUR DE COULEUR : LE GRADIENT TACTIQUE
// ==========================================
function calculerCouleurGradient(prix, prixMin, prixMax) {
    const p = parseFloat(prix);
    const min = parseFloat(prixMin);
    const max = parseFloat(prixMax);

    if (max === min || isNaN(p)) return "hsl(120, 85%, 45%)"; // Vert émeraude par défaut si bug

    // Normalisation du score entre 0 (le moins cher = Vert) et 1 (le plus cher = Rouge)
    let score = (p - min) / (max - min);
    if (score < 0) score = 0;
    if (score > 1) score = 1;

    // Teinte de la roue chromatique HSL : 120 (Vert) -> 60 (Jaune) -> 0 (Rouge)
    const teinte = (1 - score) * 120;
    return `hsl(${teinte}, 95%, 45%)`;
}

// ==========================================
// SYNCHRONISATION ET AFFICHAGE DYNAMIQUE
// ==========================================
async function chargerFluxDirect() {
    console.log("📡 Recherche d'une mise à jour du flux sur GitHub...");
    
    try {
        // Astuce anti-cache : ajoute un timestamp pour intercepter direct le fichier mis à jour par Python
        const antiCache = new Date().getTime();
        const reponse = await fetch(`${URL_FLUX}?v=${antiCache}`);
        
        if (!reponse.ok) throw new Error("Impossible de lire le fichier JSON.");
        
        const stations = await reponse.json();
        
        // 1. Extraction des prix réels pour calibrer dynamiquement le dégradé (basé sur le Gazole "gz")
        let tousLesPrix = stations
            .map(s => parseFloat(s.gz)) 
            .filter(prix => !isNaN(prix) && prix > 0);

        if (tousLesPrix.length === 0) {
            console.warn("⚠️ Aucun prix valide trouvé dans le flux pour calibrer le dégradé.");
            return;
        }

        const prixMin = Math.min(...tousLesPrix);
        const prixMax = Math.max(...tousLesPrix);

        console.log(`📊 Bornes du marché synchronisées - Min: ${prixMin}€ | Max: ${prixMax}€`);

        // 2. Nettoyage complet des anciens marqueurs sur la carte
        coucheMarqueurs.clearLayers();

        // 3. Déploiement des nouveaux pins tactiques avec leur couleur en dégradé
        stations.forEach(station => {
            // Lecture des clés ultra-compressées de ton script Python (lt, ln, gz)
            if (!station.lt || !station.ln || !station.gz) return;

            const prixCible = station.gz;
            const couleurPin = calculerCouleurGradient(prixCible, prixMin, prixMax);

            // Création du badge HTML customisé pour afficher le prix en couleur
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
            
            // Configuration de la popup sombre avec tes clés (n = nom, a = adresse, v = ville)
            marqueur.bindPopup(`
                <div style="color: #fff; font-family: 'Plus Jakarta Sans', sans-serif; padding: 4px; min-width: 200px;">
                    <b style="font-size: 14px; color: #f3f4f6; display: block; margin-bottom: 4px;">${station.n}</b>
                    <span style="color: #9ca3af; font-size: 12px; display: block; margin-bottom: 8px;">${station.a} (${station.v})</span>
                    <div style="font-size: 14px; color: #3b82f6; border-top: 1px solid #1f2937; padding-top: 6px; font-weight: bold;">
                        Gazole : <span style="color: #22c55e; font-size: 16px;">${parseFloat(prixCible).toFixed(3)} €</span>
                    </div>
                </div>
            `, { className: 'dark-popup' });

            coucheMarqueurs.addLayer(marqueur);
        });

        console.log(`✅ Carte mise à jour : ${stations.length} stations déployées.`);

    } catch (erreur) {
        console.error("❌ Erreur lors du chargement du flux direct :", erreur.message);
    }
}

// Lancement au chargement de la page
document.addEventListener("DOMContentLoaded", () => {
    initialiserCarte();
    chargerFluxDirect();

    // Lancement de la surveillance en arrière-plan
    setInterval(chargerFluxDirect, INTERVALLE_RAFRAICHISSEMENT);
});
