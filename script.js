// ==========================================
// 1. CONFIGURATION
// ==========================================
const GOOGLE_SHEETS_CSV_URL = "VOTRE_URL_PUBLIEE_AU_FORMAT_CSV"; 
const sheetURL = "https://api.allorigins.win/raw?url=" + encodeURIComponent(GOOGLE_SHEETS_CSV_URL);

// Centre par défaut (Bas-Rhin) si le GPS est désactivé
const LAT_DEFAULT = 48.72;
const LON_DEFAULT = 7.78;

var map = L.map('map', { zoomControl: false }).setView([LAT_DEFAULT, LON_DEFAULT], 11);

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap'
}).addTo(map);

// ==========================================
// 2. MOTEUR DE SELECTION DE REGION VIA GEOLOC
// ==========================================
function initRadar() {
    if (navigator.geolocation) {
        console.log("Radar : Acquisition du signal GPS de l'appareil...");
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLat = position.coords.latitude;
                const userLon = position.coords.longitude;
                
                // Recadrage automatique de la carte sur l'utilisateur
                map.setView([userLat, userLon], 11);
                
                // Déduction de la région cible (Filtre intelligent)
                let fichierRegion = determinerFichierRegion(userLat, userLon);
                loadRegionalData(fichierRegion);
            },
            (error) => {
                console.warn("Radar : Signal GPS non détecté ou refusé. Repli sur la base.");
                loadRegionalData("region-grand-est.json"); // Repli automatique sur ta zone
            }
        );
    } else {
        loadRegionalData("region-grand-est.json");
    }
}

// Fonction tactique pour attribuer le bon fichier selon les coordonnées
function determinerFichierRegion(lat, lon) {
    // Si les coordonnées correspondent grossièrement au Grand Est / Alsace
    if (lat > 47.0 && lat < 50.0 && lon > 5.0 && lon < 9.0) {
        return "region-grand-est.json";
    }
    
    // Tu pourras rajouter d'autres blocs ici :
    // if (lat > 48.0 && lat < 49.0 && lon > -5.0 && lon < -1.0) return "region-bretagne.json";
    
    return "region-grand-est.json"; // Fichier par défaut
}

// ==========================================
// 3. CHARGEMENT ULTRA-RAPIDE DU JSON RÉGIONAL
// ==========================================
async function loadRegionalData(fichierTarget) {
    try {
        console.log(`Radar : Chargement du fichier ciblé -> ${fichierTarget}`);
        
        const response = await fetch(fichierTarget);
        if (!response.ok) throw new Error("Fichier régional introuvable");
        
        const stations = await response.json();
        console.log(`Radar : ${stations.length} stations locales détectées.`);

        // Nettoyage de la carte
        map.eachLayer((layer) => {
            if (layer instanceof L.Marker) map.removeLayer(layer);
        });

        stations.forEach(station => {
            // Lecture standardisée des coordonnées du fichier compacté
            let lat = station.geom?.lat || (station.latitude ? parseFloat(station.latitude) / 100000 : null);
            let lon = station.geom?.lon || (station.longitude ? parseFloat(station.longitude) / 100000 : null);

            if (lat && lon && !isNaN(lat) && !isNaN(lon)) {
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
                        <div style="border-top:1px solid #374151; padding-top:8px; font-size:13px; font-family:monospace;">
                            <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>Gazole :</span><b>${gazole}</b></div>
                            <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>SP95-E10 :</span><b>${e10}</b></div>
                            <div style="display:flex; justify-content:space-between;"><span>SP98 :</span><b>${sp98}</b></div>
                        </div>
                    </div>
                `);
            }
        });
        console.log("Radar : Déploiement local terminé. Toutes les stations sont opérationnelles.");
    } catch (e) {
        console.error("Erreur de chargement des cibles :", e);
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

// Initialisation globale du système
initRadar();
loadExpertData();
setInterval(loadExpertData, 300000);
