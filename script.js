// ==========================================
// 1. CONFIGURATION DES FLUX
// ==========================================
const GOOGLE_SHEETS_CSV_URL = "VOTRE_URL_PUBLIEE_AU_FORMAT_CSV"; 
const sheetURL = "https://api.allorigins.win/raw?url=" + encodeURIComponent(GOOGLE_SHEETS_CSV_URL);

// Fichier de données nationales (Léger)
const API_URL = "prix-carburants-compact.json"; 

// Position de repli par défaut (Haguenau/Hoerdt) si le GPS est désactivé
const LAT_BASE = 48.72;
const LON_BASE = 7.78;

// Initialisation de la carte en mode Dark
var map = L.map('map', { zoomControl: false }).setView([LAT_BASE, LON_BASE], 11);

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap'
}).addTo(map);

// ==========================================
// 2. RECONNAISSANCE GPS & RECADRAGE TACTIQUE
// ==========================================
function localiserUtilisateur() {
    if (navigator.geolocation) {
        console.log("Radar : Demande d'accès au signal GPS...");
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const gpsLat = position.coords.latitude;
                const gpsLon = position.coords.longitude;
                console.log(`GPS Verrouillé : [${gpsLat}, ${gpsLon}]`);
                
                // On centre la carte sur la position réelle de l'appareil
                map.setView([gpsLat, gpsLon], 11);
                
                // On lance le radar autour du point GPS trouvé
                chargerRadarMoteur(gpsLat, gpsLon);
            },
            (error) => {
                console.warn("GPS : Signal refusé ou indisponible. Repli sur les coordonnées de base.");
                chargerRadarMoteur(LAT_BASE, LON_BASE);
            }
        );
    } else {
        console.warn("GPS : Navigateur incompatible. Repli sur les coordonnées de base.");
        chargerRadarMoteur(LAT_BASE, LON_BASE);
    }
}

// ==========================================
// 3. MOTEUR RADAR : FILTRAGE PHYSIQUE (RAYON 50 KM)
// ==========================================
async function chargerRadarMoteur(centreLat, centreLon) {
    try {
        console.log("Radar : Scan du fichier national...");
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error("Impossible de lire le fichier de données");
        
        const stations = await response.json();
        console.log(`Radar : ${stations.length} cibles en mémoire. Application du filtre radial (50 km)...`);

        // Nettoyage des anciens marqueurs
        map.eachLayer((layer) => {
            if (layer instanceof L.Marker) map.removeLayer(layer);
        });

        const centreCible = [centreLat, centreLon];
        const RAYON_MAX_METRES = 15000; // 50 km
        let detectees = 0;

        stations.forEach(station => {
            // Lecture des coordonnées natives du fichier
            let lat = station.geom?.lat;
            let lon = station.geom?.lon;

            if (lat && lon) {
                const positionStation = [lat, lon];
                
                // Calcul de distance Leaflet ultra-stable
                const distanceMetres = map.distance(centreCible, positionStation);

                // Si la cible est dans le rayon de 50km, on l'affiche
                if (distanceMetres <= RAYON_MAX_METRES) {
                    detectees++;

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
                            <p style="margin:0 0 10px 0; font-size:11px; color:#3b82f6; font-weight:bold;">📍 Distance : ${distanceKm} km</p>
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

        console.log(`Radar : Filtrage terminé. ${detectees} stations affichées dans ton secteur.`);
    } catch (e) {
        console.error("Erreur critique Moteur Radar :", e);
    }
}

// ==========================================
// 4. ANALYSE INDICATEURS DE MARCHÉ
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

// Lancement de la séquence de démarrage
localiserUtilisateur();
loadExpertData();
setInterval(loadExpertData, 300000);
