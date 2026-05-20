// ==========================================
// 1. CONFIGURATION DES SOURCES (TÉLÉCOMMANDE)
// ==========================================

// COPIE TON LIEN DE SPREADSHEET ICI (Fichier > Partager > Publier au format CSV)
const GOOGLE_SHEETS_CSV_URL = "VOTRE_URL_PUBLIEE_AU_FORMAT_CSV"; 
const sheetURL = "https://api.allorigins.win/raw?url=" + encodeURIComponent(GOOGLE_SHEETS_CSV_URL);


// ==========================================
// 2. INITIALISATION DE LA CARTE (STYLE SOMBRE)
// ==========================================
var map = L.map('map', { zoomControl: false }).setView([48.71, 7.82], 12);

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; CARTO &copy; OpenStreetMap'
}).addTo(map);


// ==========================================
// 3. MOTEUR CARTOGRAPHIE : DECRYPTAGE DU FLUX
// ==========================================

// On écoute le bouton d'importation HTML
document.getElementById('json-file-input').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) return;

    console.log("Radar : Fichier injecté. Analyse du flux temps réel...");
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const stations = JSON.parse(e.target.result);
            console.log("Radar : Décompression réussie. Filtrage automatique sur le Bas-Rhin (67)...");
            
            // Nettoyage des anciens marqueurs si tu recharges le fichier plus tard
            map.eachLayer((layer) => {
                if (layer instanceof L.Marker) {
                    map.removeLayer(layer);
                }
            });

            let stationsComptees = 0;

            stations.forEach(station => {
                // Filtre : Uniquement le 67 pour cibler ton secteur d'analyse
                if (station.cp && station.cp.startsWith("67")) {
                    
                    // Extraction des prix réels calculés à 3 décimales
                    const gazole = station.gazole_prix ? station.gazole_prix.toFixed(3) + " €" : "N.C";
                    const sp95 = station.sp95_prix ? station.sp95_prix.toFixed(3) + " €" : "N.C";
                    const e10 = station.e10_prix ? station.e10_prix.toFixed(3) + " €" : "N.C";
                    const sp98 = station.sp98_prix ? station.sp98_prix.toFixed(3) + " €" : "N.C";
                    
                    const nomStation = station.nom || "Station Service";
                    const adresse = station.adresse || "";
                    const ville = station.ville || "";

                    // Positionnement des coordonnées géographiques réelles
                    if (station.geom && station.geom.lat && station.geom.lon) {
                        stationsComptees++;
                        const marker = L.marker([station.geom.lat, station.geom.lon]).addTo(map);
                        
                        marker.bindPopup(`
                            <div style="background:#1f2937; color:white; padding:10px; border-radius:12px; font-family:sans-serif; min-width:220px;">
                                <h4 style="margin:0 0 4px 0; color:#22c55e; font-weight:900; font-size:13px; text-transform:uppercase;">${nomStation}</h4>
                                <p style="margin:0 0 10px 0; font-size:11px; color:#9ca3af; font-style:italic;">${adresse} (${ville})</p>
                                
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
                }
            });
            console.log(`Radar : Alignement terminé. ${stationsComptees} stations déployées sur le 67.`);
        } catch (err) {
            console.error("Erreur lors de la lecture du fichier JSON :", err);
            alert("Erreur de décodage du fichier. Assure-toi d'avoir choisi le bon fichier .json");
        }
    };
    
    reader.readAsText(file);
});


// ==========================================
// 4. MOTEUR TRADING : LECTURE DE TON GOOGLE SHEETS
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
                
                document.getElementById('sniper-comment').innerText = lastUpdate.Commentaire || "Aucun commentaire.";
                document.getElementById('val-brent').innerText = (lastUpdate.brent || "--") + " $";
                document.getElementById('val-marge').innerText = lastUpdate.Marge || "--";
                
                const marge = parseFloat(lastUpdate.Marge);
                const display = document.getElementById('timer-display');
                const icon = document.getElementById('status-icon');
                
                if(!isNaN(marge) && marge < 0.55) {
                    display.innerText = "ACHETER";
                    display.style.color = "#22c55e";
                    if(icon) icon.innerText = "✅";
                } else {
                    display.innerText = "ATTENDRE";
                    display.style.color = "#ef4444";
                    if(icon) icon.innerText = "⏳";
                }
            }
        });
    } catch (e) { 
        console.error("Erreur Sheets :", e); 
    }
}

// Lancement automatique du panneau trading au démarrage
loadExpertData();