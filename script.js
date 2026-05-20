// ==========================================
// 1. CONFIGURATION DU FLUX INTEGRAL (SANS FILTRE)
// ==========================================

// URL brute d'un miroir de l'État qui autorise le direct sans blocage CORS
const API_URL = "https://corsproxy.io/?url=" + encodeURIComponent("https://files.transport.data.gouv.fr/marches-publics/prix-carburants/prix-des-carburants-en-france-flux-instantane-v2.json");

// ==========================================
// 2. INITIALISATION DE LA CARTE (CENTRE DE LA FRANCE POUR LE TEST)
// ==========================================
var map = L.map('map', { zoomControl: false }).setView([46.603354, 1.888334], 6); // Vue globale France

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap'
}).addTo(map);

// ==========================================
// 3. AFFICHAGE BRUT SANS AUCUNE REDUCTION
// ==========================================
async function testAffichageBrut() {
    try {
        console.log("Radar : Téléchargement du fichier national brut en cours (Patience, fichier lourd)...");
        
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Erreur de chargement du fichier brut');
        
        const stations = await response.json();
        console.log(`Radar : Fichier reçu ! ${stations.length} stations chargées dans la mémoire.`);

        let compteur = 0;

        stations.forEach(station => {
            // Extraction directe de la structure d'origine
            let lat = station.geom?.lat || (station.latitude ? parseFloat(station.latitude) : null);
            let lon = station.geom?.lon || (station.longitude ? parseFloat(station.longitude) : null);

            // On affiche TOUT ce qui a des coordonnées, sans filtrer sur le 67
            if (lat && lon && compteur < 500) { // On limite à 500 au premier démarrage pour pas que ton PC freeze
                compteur++;
                
                const nom = station.nom || "Station";
                const gazole = station.gazole_prix ? station.gazole_prix + " €" : "N.C";

                const marker = L.marker([lat, lon]).addTo(map);
                marker.bindPopup(`<b>${nom}</b><br>Gazole : ${gazole}`);
            }
        });

        console.log(`Radar : ${compteur} premiers points déployés sur la carte de France.`);

    } catch (e) {
        console.error("Erreur sur le brut :", e);
    }
}

// Lancement du protocole de test
testAffichageBrut();
