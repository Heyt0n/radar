// ==========================================
// 1. CONFIGURATION DES SOURCES
// ==========================================
const GOOGLE_SHEETS_CSV_URL = "VOTRE_URL_PUBLIEE_AU_FORMAT_CSV"; 
const sheetURL = "https://api.allorigins.win/raw?url=" + encodeURIComponent(GOOGLE_SHEETS_CSV_URL);

// Ton propre fichier national compressé généré par Python
const API_URL = "stations_france.json"; 

// Position par défaut si l'utilisateur refuse la géolocalisation (Secteur Hœrdt / Haguenau)
const DEF_LAT = 48.71;
const DEF_LON = 7.82;
const RAYON_KM = 15; // Ton filtre de 15km

// ==========================================
// 2. INITIALISATION DE LA CARTE
// ==========================================
var map = L.map('map', { zoomControl: false }).setView([DEF_LAT, DEF_LON], 11);

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; CARTO &copy; OpenStreetMap'
}).addTo(map);

// Fonction de calcul de distance (Haversine) côté navigateur
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = math = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// ==========================================
// 3. CHARGEMENT ET FILTRAGE DES STATIONS
// ==========================================
async function fetchLiveStations(centerLat, centerLon) {
    try {
        console.log("Radar : Lecture du fichier compressé national...");
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Fichier introuvable');
        
        const stations = await response.json();
        console.log(`Radar : ${stations.length} stations chargées depuis le fichier local.`);

        // Nettoyage des anciens marqueurs
        map.eachLayer((layer) => {
            if (layer instanceof L.Marker) map.removeLayer(layer);
        });

        let compteur = 0;

        stations.forEach(station => {
            // Lecture des clés courtes générées par ton Python (lt = latitude, ln = longitude)
            let lat = station.lt;
            let lon = station.ln;

            if (lat && lon) {
                // Calcul de la distance par rapport au centre (géolocalisé ou par défaut)
                let distance = getDistance(centerLat, centerLon, lat, lon);

                if (distance <= RAYON_KM) {
                    compteur++;

                    // Décodage des clés courtes de prix (gz, e10, 95, 98)
                    const gazole = station.gz ? parseFloat(station.gz).toFixed(3) + " €" : "N.C";
                    const sp95 = station["95"] ? parseFloat(station["95"]).toFixed(3) + " €" : "N.C";
                    const e10 = station.e10 ? parseFloat(station.e10).toFixed(3) + " €" : "N.C";
                    const sp98 = station["98"] ? parseFloat(station["98"]).toFixed(3) + " €" : "N.C";

                    const marker = L.marker([lat, lon]).addTo(map);
                    marker.bindPopup(`
                        <div style="background:#1f2937; color:white; padding:12px; border-radius:12px; font-family:sans-serif; min-width:200px;">
                            <h4 style="margin:0 0 4px 0; color:#22c55e; text-transform:uppercase; font-size:13px;">${station.n}</h4>
                            <p style="margin:0 0 10px 0; font-size:11px; color:#9ca3af;">${station.a} (${station.v})</p>
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

        console.log(`Radar : Tactique OK. ${compteur} stations affichées dans un rayon de ${RAYON_KM}km.`);
    } catch (e) {
        console.error("Erreur filtrage carte :", e);
    }
}

// Déclenchement basé sur la géolocalisation de l'appareil
if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
        (position) => {
            // L'utilisateur accepte la position : on centre la carte sur lui
            const userLat = position.coords.latitude;
            const userLon = position.coords.longitude;
            map.setView([userLat, userLon], 11);
            fetchLiveStations(userLat, userLon);
        },
        () => {
            // Refus ou erreur : on prend les coordonnées par défaut (Hœrdt)
            fetchLiveStations(DEF_LAT, DEF_LON);
        }
    );
} else {
    fetchLiveStations(DEF_LAT, DEF_LON);
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

loadExpertData();
setInterval(loadExpertData, 300000); // Rafraîchissement trading toutes les 5 min
