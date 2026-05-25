// ==========================================
// MOTEUR TRADING, MARGE & BRIEF MACRO
// ==========================================

// Colle ici le lien CSV de ton Google Sheets où tu écris ton commentaire du soir
const GOOGLE_SHEETS_COMMENTAIRE_URL = "VOTRE_URL_PUBLIEE_AU_FORMAT_CSV";

// Valeurs de marché (ajustables manuellement ici si tu veux)
let coursBrent = 83.50;      
let coursEuroDollar = 1.0850; 

// 1. Chargement de ton commentaire global écrit à la main
async function chargerBriefDuSoir() {
    try {
        if (!GOOGLE_SHEETS_COMMENTAIRE_URL || GOOGLE_SHEETS_COMMENTAIRE_URL.includes("VOTRE_URL")) return;
        
        const proxyURL = "https://api.allorigins.win/raw?url=" + encodeURIComponent(GOOGLE_SHEETS_COMMENTAIRE_URL);
        const response = await fetch(proxyURL);
        const csvText = await response.text();
        
        Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const lignes = results.data;
                if (lignes.length > 0) {
                    // On prend ton tout dernier commentaire en bas du tableau
                    const dernierBrief = lignes[lignes.length - 1];
                    const tonTexte = dernierBrief.Commentaire || dernierBrief.commentaire || "Aucun brief macro disponible ce soir.";
                    
                    if(document.getElementById('sniper-comment')) {
                        document.getElementById('sniper-comment').innerText = tonTexte;
                    }
                }
            }
        });
    } catch (e) {
        console.error("Erreur de chargement du brief macro :", e);
    }
}

// 2. Calcul automatique de la jauge de marge par station au clic
function analyserStationUnique(nomStation, prixCarburant) {
    const displayMarge = document.getElementById('val-marge');
    const displayStatut = document.getElementById('timer-display'); // Bouton ACHETER / ATTENDRE
    
    if (isNaN(prixCarburant)) return;

    // Formule tactique affinée (Fret + TICPE + TVA)
    const prixBrentLitreEUR = (coursBrent / 159) / coursEuroDollar;
    const prixBrutArriveRaffinerie = prixBrentLitreEUR + 0.08;
    const prixStationHT = (prixCarburant / 1.20) - 0.61; 
    const margeBruteCentimes = (prixStationHT - prixBrutArriveRaffinerie) * 100;

    // Affichage de la marge de la station
    if (displayMarge) displayMarge.innerText = margeBruteCentimes.toFixed(1) + " cts/L";

    // Ajustement de la jauge d'action
    if (displayStatut) {
        if (margeBruteCentimes <= 12) {
            displayStatut.innerText = "ACHETER";
            displayStatut.style.color = "#22c55e";
        } else if (margeBruteCentimes > 12 && margeBruteCentimes <= 22) {
            displayStatut.innerText = "NEUTRE";
            displayStatut.style.color = "#f59e0b";
        } else {
            displayStatut.innerText = "ATTENDRE";
            displayStatut.style.color = "#ef4444";
        }
    }
}

// Lancement global
chargerBriefDuSoir();
if(document.getElementById('val-brent')) document.getElementById('val-brent').innerText = coursBrent.toFixed(2) + " $";
