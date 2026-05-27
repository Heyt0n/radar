// ==========================================
// RADAR CARBURANT - MODULE BRIEF MACRO
// ==========================================

// 1. Colle ici ton lien Google Sheets publié au format CSV (.csv)
const GOOGLE_SHEETS_COMMENTAIRE_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRlZeqlhRu75u42M8mfM5TagCXgfh-rl6ZD-qDm25Q2lSlLBYSTMBIioY_JzgdDDByohc-K2EIIuiBY/pub?output=csv";

async function chargerBriefDuSoir() {
    try {
        // Sécurité si l'URL n'est pas encore remplie
        if (!GOOGLE_SHEETS_COMMENTAIRE_URL || GOOGLE_SHEETS_COMMENTAIRE_URL.includes("https://docs.google.com/spreadsheets/d/e/2PACX-1vRlZeqlhRu75u42M8mfM5TagCXgfh-rl6ZD-qDm25Q2lSlLBYSTMBIioY_JzgdDDByohc-K2EIIuiBY/pub?output=csv")) {
            console.log("Brief : URL Google Sheets non configurée.");
            return;
        }

        // Utilisation du proxy pour éviter les blocages de sécurité (CORS)
        const proxyURL = "https://api.allorigins.win/raw?url=" + encodeURIComponent(GOOGLE_SHEETS_COMMENTAIRE_URL);
        const response = await fetch(proxyURL);
        const csvText = await response.text();
        
        // Analyse du fichier CSV reçu
        Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const lignes = results.data;
                if (lignes.length > 0) {
                    // On prend la ligne la plus récente (tout en bas de la colonne)
                    const dernierBrief = lignes[lignes.length - 1];
                    
                    // On lit ce qu'il y a sous l'entête "Commentaire"
                    const tonTexte = dernierBrief.Commentaire || dernierBrief.commentaire || "Aucun brief disponible ce soir.";
                    
                    // Injection directe dans la zone de ton panneau HTML
                    const elementHtml = document.getElementById('sniper-comment');
                    if (elementHtml) {
                        elementHtml.innerText = tonTexte;
                        console.log("Brief macro chargé avec succès !");
                    } else {
                        console.error("Erreur : Impossible de trouver l'élément HTML avec l'id 'sniper-comment'.");
                    }
                }
            }
        });
    } catch (e) {
        console.error("Erreur technique lors du chargement du brief :", e);
    }
}

// Lancement automatique au chargement de la page
document.addEventListener("DOMContentLoaded", chargerBriefDuSoir);
