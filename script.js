// ==========================================
// 1. CONFIGURATION ET LIENS DES FLUX
// ==========================================
const GOOGLE_SHEETS_CSV_URL = "VOTRE_URL_PUBLIEE_AU_FORMAT_CSV"; 
const sheetURL = "https://api.allorigins.win/raw?url=" + encodeURIComponent(GOOGLE_SHEETS_CSV_URL);

// METS ICI LE NOM EXACT DE TON FICHIER DE DONNÉES SUR GITHUB
const API_URL = "prix-carburants-compact.json"; 


// ==========================================
// 2. INITIALISATION DU RADAR (CENTRÉ SUR TON SECTEUR)
// ==========================================
const LAT_BASE = 48.72;
const LON_BASE = 7.78;

var map = L.map('map', { zoomControl: false }).setView([LAT_BASE, LON_BASE], 11);

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap'
}).addTo(map);


// ==========================================
// 3. MOTEUR RADAR : FILTRE TACTIQUE RAYON 50 KM
// ==========================================
async function loadLocalRadar() {
    try {
        console.log("Radar : Analyse du fichier national en cours...");
        
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error("Impossible d'accéder au fichier JSON");
        
        const stations = await response.json();
        console.log(`Radar : ${stations.length} cibles lues. Application du filtre (50 km)...`);

        // Nettoyage complet de la carte
        map.eachLayer((layer) => {
            if (layer instanceof L.Marker) map.removeLayer(layer);
        });

        const centreBase = [LAT_BASE, LON_BASE];
        const RAYON_MAX_METRES = 50000; // 50 kilomètres
        let compteurCibles = 0;

        stations.forEach(station => {
            let lat = null;
            let lon = null;

            if (station.geom && station.geom.lat) {
                lat = parseFloat(station.geom.lat);
                lon = parseFloat(station.geom.lon);
            } else if (station.latitude && station.longitude) {
                lat = parseFloat(station.latitude) / 100000;
                lon = parseFloat(station.longitude) / 100000;
            }

            if (lat && !isNaN(lat) && lon && !isNaN(lon)) {
                const positionStation = [lat, lon];
                const distanceMetres = map.distance(centreBase, positionStation);

                if (distanceMetres <= RAYON_MAX_METRES) {
                    compteurCibles++;

                    const nom = station.nom || station.marque || "Station Service";
                    const ville = station.ville || "";
                    const adresse = station.adresse || "";
                    
                    const gazole = station.gazole_prix ? parseFloat(station.gazole_prix).toFixed(3) + " €" : "N.C";
                    const e10 = station.e10_prix ? parseFloat(station.e10_prix).toFixed(3) + " €" : "N.C";
                    const sp98 = station.sp98_prix ? parseFloat(station.sp98_prix).toFixed(3) + " €" : "N.C";
                    
                    const distanceKm = (distanceMetres / 1000).toFixed(1);

                    const marker = L.marker([lat, lon]).addTo(map);
                    
                    marker.bindPopup(`
                        <div style="background:#1f2937; color:white; padding:12px; border-radius:12px; font-family:sans-serif; min-width:210px;">
                            <h4 style="margin:0 0 4px 0; color:#22c55e; font-weight:900; font-size:13px; text-transform:uppercase;">${nom}</h4>
                            <p style="margin:0 0 4px 0; font-size:11px; color:#9ca3af; font-style:italic;">${adresse} (${ville})</p>
                            <p style="margin:0 0 10px 0; font-size:11px; color:#3b82f6; font-weight:bold;">📍 Portée : ${distanceKm} km</p>
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

        console.log(`Radar : Filtrage réussi ! ${compteurCibles} stations détectées à moins de 50km.`);
    } catch (e) {
        console.error("Erreur critique d'analyse radar :", e);
    }
}

// ==========================================
// 4. MOTEUR ANALYSE DE MARCHÉ (GOOGLE SHEETS)
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

// Lancement automatique au démarrage du système
loadLocalRadar();
loadExpertData();

// Tâche de fond : Rafraîchissement des indicateurs de marché (5 min)
setInterval(loadExpertData, 300000);
