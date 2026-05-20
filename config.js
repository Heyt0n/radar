// ==========================================
// 1. CONFIGURATION DES SOURCES (TEMPS RÉEL API)
// ==========================================

// COPIE TON LIEN DE SPREADSHEET ICI (Fichier > Partager > Publier au format CSV)
const GOOGLE_SHEETS_CSV_URL = "VOTRE_URL_PUBLIEE_AU_FORMAT_CSV"; 
const sheetURL = "https://api.allorigins.win/raw?url=" + encodeURIComponent(GOOGLE_SHEETS_CSV_URL);

// URL chirurgicale utilisant l'API v2.1 officielle filtrée sur le 67
const API_URL = "https://api.allorigins.win/raw?url=" + encodeURIComponent("https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records?where=cp%20like%20%2767*%27&limit=100");


// ==========================================
// 2. INITIALISATION DE LA CARTE (STYLE SOMBRE)
// ==========================================
var map = L.map('map', { zoomControl: false }).setView([48.71, 7.82], 11);

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; CARTO &copy; OpenStreetMap'
}).addTo(map);


// ==========================================
// 3. MOTEUR CARTOGRAPHIE : DEPLOYEUR TACTIQUE
// ==========================================

async function fetchLiveStations() {
    try {
        console.log("Radar : Connexion en cours aux serveurs data.economie.gouv.fr...");
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Serveur injoignable');
        
        const data = await response.json();
        // L'API v2.1 range toujours ses lignes dans le tableau "results"
        const stations = data.results || []; 
        
        console.log(`Radar : ${stations.length} lignes brutes récupérées du serveur.`);

        // Nettoyage complet des anciens marqueurs
        map.eachLayer((layer) => {
            if (layer instanceof L.Marker) map.removeLayer(layer);
        });

        let compteur = 0;

        stations.forEach(station => {
            // 1. Détection polyvalente des coordonnées géographiques (selon la version de l'API)
            let latitude = null;
            let longitude = null;

            if (station.geom) {
                latitude = station.geom.lat;
                longitude = station.geom.lon;
            } else if (station.latitude && station.longitude) {
                latitude = station.latitude;
                longitude = station.longitude;
            }

            // Si on a des coordonnées valides, on extrait les prix et on déploie
            if (latitude && longitude) {
                compteur++;

                // Extraction sécurisée des prix (formatage automatique à 3 décimales)
                const gazole = station.gazole_prix ? parseFloat(station.gazole_prix).toFixed(3) + " €" : "N.C";
                const sp95 = station.sp95_prix ? parseFloat(station.sp95_prix).toFixed(3) + " €" : "N.C";
                const e10 = station.e10_prix ? parseFloat(station.e10_prix).toFixed(3) + " €" : "N.C";
                const sp98 = station.sp98_prix ? parseFloat(station.sp98_prix).toFixed(3) + " €" : "N.C";
                
                // Récupération de l'identité de la station
                const nom = station.nom || station.marque || "Station Service";
                const adresse = station.adresse || "";
                const ville = station.ville || "";

                // Création du marqueur sur la carte
                const marker = L.marker([latitude, longitude]).addTo(map);
                
                marker.bindPopup(`
                    <div style="background:#1f2937; color:white; padding:12px; border-radius:12px; font-family:sans-serif; min-width:220px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.5);">
                        <h4 style="margin:0 0 4px 0; color:#22c55e; font-weight:900; font-size:13px; text-transform:uppercase; letter-spacing:0.5px;">${nom}</h4>
                        <p style="margin:0 0 10px 0; font-size:11px; color:#9ca3af; font-style:italic; line-height:1.2;">${adresse}<br><b>${ville}</b></p>
                        
                        <div style="border-top:1px solid #374151; padding-top:8px; font-size:13px; font-family:monospace;">
                            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                                <span style="color:#9ca3af;">Gazole :</span> 
                                <span style="font-weight:bold; color:#ffffff;">${gazole}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                                <span style="color:#9ca3af;">SP95-E10 :</span> 
                                <span style="font-weight:bold; color:#ffffff;">${e10}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                                <span style="color:#9ca3af;">SP95 :</span> 
                                <span style="font-weight:bold; color:#ffffff;">${sp95}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between;">
                                <span style="color:#9ca3af;">SP98 :</span> 
                                <span style="font-weight:bold; color:#ffffff;">${sp98}</span>
                            </div>
                        </div>
                    </div>
                `);
            }
        });

        console.log(`Radar : Alignement réussi. ${compteur} stations actives sur le 67.`);
    } catch (e) {
        console.error("Erreur critique d'alignement radar :", e);
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

// Initialisation immédiate
fetchLiveStations();
loadExpertData();

// Rafraîchissements programmés en tâche de fond
setInterval(fetchLiveStations, 21600000); // 6 heures
setInterval(loadExpertData, 300000);       // 5 minutes
