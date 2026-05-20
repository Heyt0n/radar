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
// 3. CHARGEMENT ULTRA-RAPIDE EN ÉCOSYSTEME
// ==========================================
async function loadLocalRadar() {
    try {
        console.log("Radar : Lecture du fichier local data67.json...");
        
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Impossible de lire le fichier JSON local');
        
        const stations = await response.json();
        console.log(`Radar : Écosystème synchronisé. ${stations.length} stations chargées.`);

        // Nettoyage de sécurité
        map.eachLayer((layer) => {
            if (layer instanceof L.Marker) map.removeLayer(layer);
        });

        stations.forEach(station => {
            // Lecture des coordonnées fiables du fichier
            let lat = station.geom?.lat || (station.latitude ? parseFloat(station.latitude) / 100000 : null);
            let lon = station.geom?.lon || (station.longitude ? parseFloat(station.longitude) / 100000 : null);

            if (lat && lon) {
                const nom = station.nom || "Station Service";
                const ville = station.ville || "";
                const gazole = station.gazole_prix ? station.gazole_prix.toFixed(3) + " €" : "N.C";
                const e10 = station.e10_prix ? station.e10_prix.toFixed(3) + " €" : "N.C";
                const sp98 = station.sp98_prix ? station.sp98_prix.toFixed(3) + " €" : "N.C";

                const marker = L.marker([lat, lon]).addTo(map);
                
                marker.bindPopup(`
                    <div style="background:#1f2937; color:white; padding:10px; border-radius:12px; font-family:sans-serif; min-width:200px;">
                        <h4 style="margin:0 0 4px 0; color:#22c55e; font-weight:900; font-size:13px; text-transform:uppercase;">${nom}</h4>
                        <p style="margin:0 0 10px 0; font-size:11px; color:#9ca3af; font-style:italic;">${ville}</p>
                        <div style="border-top:1px solid #374151; padding-top:8px; font-size:12px; font-family:monospace;">
                            <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>Gazole :</span><b>${gazole}</b></div>
                            <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>SP95-E10 :</span><b>${e10}</b></div>
                            <div style="display:flex; justify-content:space-between;"><span>SP98 :</span><b>${sp98}</b></div>
                        </div>
                    </div>
                `);
            }
        });

    } catch (e) {
        console.error("Erreur écosystème :", e);
    }
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
