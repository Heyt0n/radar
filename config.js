// ==========================================
// 1. CONFIGURATION DES SOURCES (TEMPS RÉEL)
// ==========================================

// COPIE TON LIEN DE SPREADSHEET ICI (Fichier > Partager > Publier au format CSV)
const GOOGLE_SHEETS_CSV_URL = "VOTRE_URL_PUBLIEE_AU_FORMAT_CSV"; 
const sheetURL = "https://api.allorigins.win/raw?url=" + encodeURIComponent(GOOGLE_SHEETS_CSV_URL);

// URL du flux officiel de l'État en direct (via un proxy pour éviter les blocages)
const API_URL = "https://api.allorigins.win/raw?url=" + encodeURIComponent("https://files.transport.data.gouv.fr/marches-publics/prix-carburants/prix-des-carburants-en-france-flux-instantane-v2.json");


// ==========================================
// 2. INITIALISATION DE LA CARTE (STYLE SOMBRE)
// ==========================================
var map = L.map('map', { zoomControl: false }).setView([48.71, 7.82], 12);

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; CARTO &copy; OpenStreetMap'
}).addTo(map);


// ==========================================
// 3. MOTEUR CARTOGRAPHIE : LE RADAR AUTOMATIQUE
// ==========================================

async function fetchLiveStations() {
    try {
        console.log("Radar : Scan du flux national en cours...");
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Échec du scan');
        const stations = await response.json();
        
        // Nettoyage des anciens marqueurs
        map.eachLayer((layer) => {
            if (layer instanceof L.Marker) map.removeLayer(layer);
        });

        let compteur = 0;

        stations.forEach(station => {
            // Filtrage chirurgical sur le Bas-Rhin (67)
            if (station.cp && station.cp.startsWith("67")) {
                
                const gazole = station.gazole_prix ? station.gazole_prix.toFixed(3) + " €" : "N.C";
                const sp95 = station.sp95_prix ? station.sp95_prix.toFixed(3) + " €" : "N.C";
                const e10 = station.e10_prix ? station.e10_prix.toFixed(3) + " €" : "N.C";
                const sp98 = station.sp98_prix ? station.sp98_prix.toFixed(3) + " €" : "N.C";
                
                if (station.geom && station.geom.lat && station.geom.lon) {
                    compteur++;
                    const marker = L.marker([station.geom.lat, station.geom.lon]).addTo(map);
                    
                    marker.bindPopup(`
                        <div style="background:#1f2937; color:white; padding:10px; border-radius:12px; font-family:sans-serif; min-width:220px;">
                            <h4 style="margin:0 0 4px 0; color:#22c55e; font-weight:900; font-size:13px; text-transform:uppercase;">${station.nom || "Station"}</h4>
                            <p style="margin:0 0 10px 0; font-size:11px; color:#9ca3af; font-style:italic;">${station.adresse || ""} (${station.ville || ""})</p>
                            <div style="border-top:1px solid #374151; padding-top:8px; font-size:13px; font-family:monospace;">
                                <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>Gazole :</span><b>${gazole}</b></div>
                                <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>SP95-E10 :</span><b>${e10}</b></div>
                                <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>SP95 :</span><b>${sp95}</b></div>
                                <div style="display:flex; justify-content:space-between;"><span>SP98 :</span><b>${sp98}</b></div>
                            </div>
                        </div>
                    `);
                }
            }
        });
        console.log(`Radar : ${compteur} stations du 67 synchronisées au centime près.`);
    } catch (e) {
        console.error("Erreur radar :", e);
    }
}

// ==========================================
// 4. MOTEUR TRADING (GOOGLE SHEETS)
// ==========================================
async function loadExpertData() {
    try {
        if (GOOGLE_SHEETS_CSV_URL === "VOTRE_URL_PUBLIEE_AU_FORMAT_CSV") {
            console.log("Radar : En attente du lien Google Sheets.");
            return;
        }
        const response = await fetch(sheetURL);
        if (!response.ok) throw new Error('Erreur Sheets');
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
                const icon = document.getElementById('status-icon');
                
                if(display && !isNaN(marge)) {
                    if(marge < 0.55) {
                        display.innerText = "ACHETER";
                        display.style.color = "#22c55e";
                        if(icon) icon.innerText = "✅";
                    } else {
                        display.innerText = "ATTENDRE";
                        display.style.color = "#ef4444";
                        if(icon) icon.innerText = "⏳";
                    }
                }
            }
        });
    } catch (e) { console.error("Erreur Sheets :", e); }
}

// Lancement automatique au chargement du site
fetchLiveStations();
loadExpertData();

// Boucles de rafraîchissement automatique
setInterval(fetchLiveStations, 21600000); // Toutes les 6 heures pour le carburant
setInterval(loadExpertData, 300000);       // Toutes les 5 minutes pour ton Sheets trading
loadExpertData();
