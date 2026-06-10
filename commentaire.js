// ==========================================/
// RADAR CARBURANT - MODULE BRIEF MACRO (V2)
// ==========================================

// Intégration directe de ton flux Google Sheets officiel
const GOOGLE_SHEETS_COMMENTAIRE_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRlZeqlhRu75u42M8mfM5TagCXgfh-rl6ZD-qDm25Q2lSlLBYSTMBIioY_JzgdDDByohc-K2EIIuiBY/pub?output=csv";

async function chargerBriefDuSoir() {
    try {
        console.log("Brief : Tentative de connexion au flux Google Sheets...");
        
        // Requête directe sur ton lien CSV publié
        const response = await fetch(GOOGLE_SHEETS_COMMENTAIRE_URL);
        if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
        
        const csvText = await response.text();
        
        // Analyse du fichier CSV reçu via PapaParse
        Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const lignes = results.data;
                console.log("Données CSV reçues :", lignes); // Visible dans la console F12 pour vérification

                if (lignes && lignes.length > 0) {
                    // Extraction de la dernière ligne en bas du tableau (ton brief le plus récent)
                    const dernierBrief = lignes[lignes.length - 1];
                    
                    // Sécurité pour capter le texte peu importe les petites fautes de frappe dans le titre de la colonne
                    const tonTexte = dernierBrief.Commentaire || dernierBrief.commentaire || dernierBrief["Commentaire "] || "Aucun brief disponible pour le moment.";
                    
                    // Injection dans ton interface HTML
                    const elementHtml = document.getElementById('sniper-comment');
                    if (elementHtml) {
                        elementHtml.innerText = tonTexte;
                        console.log("🛰️ Brief macro injecté avec succès :", tonTexte);
                    } else {
                        console.error("Erreur : L'élément HTML avec l'id 'sniper-comment' est introuvable sur ta page.");
                    }
                } else {
                    console.warn("Le fichier CSV est accessible mais semble vide.");
                }
            }
        });
    } catch (e) {
        console.error("Erreur technique lors du traitement du brief :", e);
    }
}

// Déclenchement automatique dès que la page est chargée
document.addEventListener("DOMContentLoaded", chargerBriefDuSoir);
