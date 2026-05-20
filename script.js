// ==========================================
// 1. CONFIGURATION DU FLUX LOCAL ET SANS PROXY
// ==========================================

const GOOGLE_SHEETS_CSV_URL = "VOTRE_URL_PUBLIEE_AU_FORMAT_CSV"; 
const sheetURL = "https://api.allorigins.win/raw?url=" + encodeURIComponent(GOOGLE_SHEETS_CSV_URL);

// On cible DIRECTEMENT le fichier qu'on vient de créer dans ton dépôt
const API_URL = "prix-carburants-compact.json";


// ==========================================
// 2. INITIALISATION DE LA CARTE (CENTRE SECTEUR)
// ==========================================
var map = L.map('map', { zoomControl: false }).setView([48.70, 7.78], 11); // Centré sur zone Hoerdt / Haguenau

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap'
}).addTo(map);


// ==========================================
// 3. CHARGEMENT AVEC FILTRE DE PÉRIMÈTRE (RAYON 50 KM)
// ==========================================
async function loadLocalRadar() {
    try {
        console.log("Radar : Initialisation du filtre de proximité...");
        
        // Cible centrale de ton secteur (Coordonnées de ton point d'observation)
        const centreSecteur = L.latLng(48.70, 7.78); 
        const RAYON_MAX_METRES = 50000; // 50 KM exprimés en mètres

        const response = await fetch(API_URL);
        const stations = await response.json();

        // Nettoyage de la carte
        map.eachLayer((layer) => {
            if (layer instanceof L.Marker) map.removeLayer(layer);
        });

        let stationsAffichees = 0;

        stations.forEach(station => {
            // Lecture des coordonnées du fichier national
            let lat = station.geom?.lat || (station.latitude ? parseFloat(station.latitude) / 100000 : null);
            let lon = station.geom?.lon || (station.longitude ? parseFloat(station.longitude) / 100000 : null);

            if (lat && lon) {
                const positionStation = L.latLng(lat, lon);
                
                // CALCUL DE LA DISTANCE CHIRURGICALE
                const distance = map.distance(centreSecteur, positionStation);

                // SI LA CIBLE EST DANS LE RAYON DES 50 KM, ON DÉPLOIE LE MARQUEUR
                if (distance <= RAYON_MAX_METRES) {
                    stationsAffichees++;

                    const nom = station.nom || station.marque || "Station Service";
                    const ville = station.ville || "";
                    const adresse = station.adresse || "";
                    
                    const gazole = station.gazole_prix ? parseFloat(station.gazole_prix).toFixed(3) + " €" : "N.C";
                    const e10 = station.e10_prix ? parseFloat(station.e10_prix).toFixed(3) + " €" : "N.C";
                    const sp98 = station.sp98_prix ? parseFloat(station.sp98_prix).toFixed(3) + " €" : "N.C";

                    const marker = L.marker([lat, lon]).addTo(map);
                    
                    marker.bindPopup(`
                        <div style="background:#1f2937; color:white; padding:12px; border-radius:12px; font-family:sans-serif; min-width:210px;">
                            <h4 style="margin:0 0 4px 0; color:#22c55e; font-weight:900; font-size:13px; text-transform:uppercase;">${nom}</h4>
                            <p style="margin:0 0 10px 0; font-size:11px; color:#9ca3af; font-style:italic;">${adresse} (${ville})</p>
                            <p style="margin:-5px 0 10px 0; font-size:10px; color:#3b82f6; font-weight:bold;">📍 À ${(distance/1000).toFixed(1)} km de votre base</p>
                            <div style="border-top:1px solid #374151; padding-top:8px; font-size:13px; font-family:monospace;">
                                <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>Gazole :</span><b>${gazole}</b></div>
                                <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>SP95-E10 :</span><b>${e10}</b></div>
                                <div style="display:flex; justify-content:space-between;"><span>SP98 :</span><b>${sp98}</b></div>
                            </div>
                        </div>
                    `);
                }
            }
        });

        console.log(`Radar : Périmètre verrouillé. ${stationsAffichees} stations déployées dans un rayon de 50km.`);
    } catch (e) {
        console.error("Erreur filtre proximité :", e);
    }

// ==========================================
// 4. TRADING GOOGLE SHEETS
// ==========================================
async function loadExpertData() {
    try {
        if (GOOGLE_SHEETS_CSV_URL === "VOTRE_URL_PUBLIEE_AU_FORMAT_CSV") return;
        const response = await fetch(sheetURL);
        const csvData = await response.text();
        Papa.parse(csvData, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const rows = results.data;
                if (rows.length === 0) return;
                const lastUpdate = rows[rows.length - 1]; 
                if(document.getElementById('sniper-comment')) document.getElementById('sniper-comment').innerText = lastUpdate.Commentaire || "Aucun commentaire.";
                if(document.getElementById('val-brent')) document.getElementById('val-brent').innerText = (lastUpdate.brent || "--") + " $";
                if(document.getElementById('val-marge')) document.getElementById('val-marge').innerText = lastUpdate.Marge || "--";
                
                const marge = parseFloat(lastUpdate.Marge);
                const display = document.getElementById('timer-display');
                if(display && !isNaN(marge)) {
                    if(marge < 0.55) {
                        display.innerText = "ACHETER";
                        display.style.color = "#22c55e";
                    } else {
                        display.innerText = "ATTENDRE";
                        display.style.color = "#ef4444";
                    }
                }
            }
        });
    } catch (e) { console.error("Erreur Sheets :", e); }
}

// Lancement automatique
loadLocalRadar();
loadExpertData();

// Rafraîchissement automatique du Sheets de trading toutes les 5 minutes
setInterval(loadExpertData, 300000);
testAffichageBrut();
