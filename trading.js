// ==========================================
// CAPTURE AUTOMATIQUE DES COURS LIVE (YFINANCE API)
// ==========================================

async function fetchLiveMarketData() {
    try {
        // Utilisation des flux de Yahoo Finance via un proxy AllOrigins pour éviter les blocages de sécurité
        const urlBrent = "https://api.allorigins.win/raw?url=" + encodeURIComponent("https://query1.finance.yahoo.com/v8/finance/chart/BZ=F");
        const urlFX = "https://api.allorigins.win/raw?url=" + encodeURIComponent("https://query1.finance.yahoo.com/v8/finance/chart/EURUSD=X");

        const [resBrent, resFX] = await Promise.all([fetch(urlBrent), fetch(urlFX)]);
        
        const dataBrent = await resBrent.json();
        const dataFX = await resFX.json();

        // Extraction des prix spots en temps réel
        coursBrent = dataBrent.chart.result[0].meta.regularMarketPrice;
        coursEuroDollar = dataFX.chart.result[0].meta.regularMarketPrice;

        console.log(`🎯 Flux Live Activé - Brent: ${coursBrent}$, EUR/USD: ${coursEuroDollar}`);

        // Mise à jour visuelle des labels sur ton interface
        if(document.getElementById('val-brent')) {
            document.getElementById('val-brent').innerText = coursBrent.toFixed(2) + " $";
        }
    } catch (e) {
        console.error("Échec de la synchronisation des marchés en direct, repli sur les valeurs de secours.", e);
        // Valeurs de repli si l'API externe est saturée
        coursBrent = 83.50;
        coursEuroDollar = 1.0850;
    }
}

// Remplacer l'initialisation par le déclenchement automatique
document.addEventListener("DOMContentLoaded", () => {
    chargerBriefDuSoir();
    fetchLiveMarketData(); // Lance la capture des cours dès le chargement
    
    const selectElem = document.getElementById('select-carburant');
    if (selectElem) {
        selectElem.addEventListener('change', () => {
            if (derniereStationSelectionnee) {
                analyserStationUnique(derniereStationSelectionnee);
            }
        });
    }
});
