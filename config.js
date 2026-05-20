// ==========================================
// 1. CONFIGURATION DES SOURCES (ZÉRO CLIC)
// ==========================================

const GOOGLE_SHEETS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRW60ydSoi-Sv1xYticG_zs5hZiyATy5kwKXxW2HjawyLk0-pAJCAZ97N2-k2bBKHyQXQRdI3Xtj6pF/pubhtml"; 
const sheetURL = "https://api.allorigins.win/raw?url=" + encodeURIComponent(GOOGLE_SHEETS_CSV_URL);

// Flux JSON pré-filtré et compressé uniquement pour le 67 (Temps réel sans bouton)
const API_URL = "https://api.allorigins.win/raw?url=" + encodeURIComponent("https://raw.githubusercontent.com/dfm-carburants/flux-instantane-filtre/main/67.json");


// ==========================================
// 2. INITIALISATION DE LA CARTE
// ==========================================
var map = L.map('map', { zoomControl: false }).setView([48.65, 7.72], 11);

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; CARTO &copy; OpenStreetMap'
}).addTo(map);


// ==========================================
// 3. MOTEUR CARTOGRAPHIE AUTOMATIQUE
// ==========================================

async function fetchLiveStations() {
    try {
        console.log("Radar : Connexion au flux JSON automatique du 67...");
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Flux indisponible');
        
        const stations = await response.json();
        console.log(`Radar : ${stations.length} stations chargées avec succès.`);

        // Nettoyage des anciens marqueurs
        map.eachLayer((layer) => {
            if (layer instanceof L.Marker) map.removeLayer(layer);
        });

        let compteur = 0;

        stations.forEach(station => {
            // Lecture directe de la structure classique du fichier JSON
            let lat = station.geom?.lat || station.latitude;
            let lon = station.geom?.lon || station.longitude;

            if (lat && lon) {
                compteur++;

                // Formatage propre des prix à 3 décimales
                const gazole = station.gazole_prix ? parseFloat(station.gazole_prix).toFixed(3) + " €" : "N.C";
                const sp95 = station.sp95_prix ? parseFloat(station.sp95_prix).toFixed(3) + " €" : "N.C";
                const e10 = station.e10_prix ? parseFloat(station.e10_prix).toFixed(3) + " €" : "N.C";
                const sp98 = station.sp98_prix ? parseFloat(station.sp98_prix).toFixed(3) + " €" : "N.C";

                const nom = station.nom || "Station Service";
                const adresse = station.adresse || "";
                const ville = station.ville || "";

                const marker = L.marker([lat, lon]).addTo(map);
                
                marker.bindPopup(`
                    <div style="background:#1f2937; color:white; padding:12px; border-radius:12px; font-family:sans-serif; min-width:220px;">
                        <h4 style="margin:0 0 4px 0; color:#22c55e; font-weight:900; font-size:13px; text-transform:uppercase;">${nom}</h4>
                        <p style="margin:0 0 10px 0; font-size:11px; color:#9ca3af; font-style:italic;">${adresse} (${ville})</p>
                        
                        <div style="border-top:1px solid #374151; padding-top:8px; font-size:13px; font-family:monospace;">
                            <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>Gazole :</span><b>${gazole}</b></div>
                            <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>SP95-E10 :</span><b>${e10}</b></div>
                            <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>SP95 :</span><b>${sp95}</b></div>
                            <div style="display:flex; justify-content:space-between;"><span>SP98 :</span><b>${sp98}</b></div>
                        </div>
                    </div>
                `);
            }
        });

        console.log(`Radar : ${compteur} marqueurs déployés tactiquement.`);
    } catch (e) {
        console.error("Erreur lecture flux JSON :", e);
    }
}

// ==========================================
// 4. MOTEUR TRADING (GOOGLE SHEETS)
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

// Initialisation au chargement
fetchLiveStations();
loadExpertData();

// Rafraîchissements (6h pour l'essence, 5min pour le trading)
setInterval(fetchLiveStations, 21600000);
setInterval(loadExpertData, 300000);
