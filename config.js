// ==========================================
// 1. CONFIGURATION DES SOURCES (API TEMPS RÉEL)
// ==========================================

const GOOGLE_SHEETS_CSV_URL = "VOTRE_URL_PUBLIEE_AU_FORMAT_CSV"; 
const sheetURL = "https://api.allorigins.win/raw?url=" + encodeURIComponent(GOOGLE_SHEETS_CSV_URL);

// URL de l'API officielle filtrée chirurgicalement sur le Bas-Rhin (cp qui commence par 67)
const API_URL = "https://api.allorigins.win/raw?url=" + encodeURIComponent("https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records?where=cp%20like%20%2767*%27&limit=100");


// ==========================================
// 2. INITIALISATION DE LA CARTE (BAS-RHIN)
// ==========================================
var map = L.map('map', { zoomControl: false }).setView([48.60, 7.75], 10); // Centré sur Strasbourg/Bas-Rhin

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; CARTO &copy; OpenStreetMap'
}).addTo(map);


// ==========================================
// 3. MOTEUR RADAR : DECRYPTAGE DU FLUX EN DIRECT
// ==========================================

async function fetchLiveStations() {
    try {
        console.log("Radar : Interrogation des serveurs de l'État pour le 67...");
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Échec de connexion API');
        
        const data = await response.json();
        const stations = data.results || [];
        console.log(`Radar : ${stations.length} stations détectées dans le flux.`);

        // Nettoyage des anciens marqueurs
        map.eachLayer((layer) => {
            if (layer instanceof L.Marker) map.removeLayer(layer);
        });

        let compteurMarqueurs = 0;

        stations.forEach(station => {
            // Extraction et correction du positionnement géographique (Division par 100 000 pour corriger le bug de l'API)
            let lat = station.latitude ? parseFloat(station.latitude) / 100000 : null;
            let lon = station.longitude ? parseFloat(station.longitude) / 100000 : null;

            if (lat && lon) {
                compteurMarqueurs++;

                // Initialisation des variables de prix
                let gazole = "N.C", sp95 = "N.C", e10 = "N.C", sp98 = "N.C";

                // Extraction chirurgicale des prix depuis la structure textuelle imbriquée de l'API
                if (station.prix) {
                    try {
                        // Si la donnée arrive sous forme de chaîne de texte, on la décompresse en tableau
                        let listePrix = typeof station.prix === 'string' ? JSON.parse(station.prix) : station.prix;
                        
                        listePrix.forEach(p => {
                            let nomCarburant = p["@nom"];
                            let valeurCarburant = p["@valeur"] ? parseFloat(p["@valeur"]).toFixed(3) + " €" : "N.C";

                            if (nomCarburant === "Gazole") gazole = valeurCarburant;
                            if (nomCarburant === "SP95") sp95 = valeurCarburant;
                            if (nomCarburant === "E10") e10 = valeurCarburant;
                            if (nomCarburant === "SP98") sp98 = valeurCarburant;
                        });
                    } catch (err) {
                        console.error("Erreur décodage prix station: ", station.id, err);
                    }
                }

                // Récupération des infos textuelles de la station
                const nomStation = station.nom || station.marque || "Station Service";
                const adresse = station.adresse || "";
                const ville = station.ville || "";

                // Déploiement du marqueur sur la carte
                const marker = L.marker([lat, lon]).addTo(map);
                
                marker.bindPopup(`
                    <div style="background:#1f2937; color:white; padding:12px; border-radius:12px; font-family:sans-serif; min-width:220px;">
                        <h4 style="margin:0 0 4px 0; color:#22c55e; font-weight:900; font-size:13px; text-transform:uppercase;">${nomStation}</h4>
                        <p style="margin:0 0 10px 0; font-size:11px; color:#9ca3af; font-style:italic;">${adresse} (${ville})</p>
                        
                        <div style="border-top:1px solid #374151; padding-top:8px; font-size:13px; font-family:monospace;">
                            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                                <span style="color:#9ca3af;">Gazole :</span> 
                                <span style="font-weight:bold; color:#ffffff;">${gazole}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                                <span style="color:#9ca3af;">SP95-E10 :</span> 
 * <span style="font-weight:bold; color:#ffffff;">${e10}</span>
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

        console.log(`Radar : Alignement réussi. ${compteurMarqueurs} stations déployées sur la carte.`);
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

// Lancement automatique
fetchLiveStations();
loadExpertData();

// Boucles de rafraîchissement
setInterval(fetchLiveStations, 21600000); // 6 heures
setInterval(loadExpertData, 300000);       // 5 minutes
