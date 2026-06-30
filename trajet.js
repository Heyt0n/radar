// ============================================================================
// 🗺️ RADAR CARBURANT - MOTEUR D'ITINÉRAIRE TACTIQUE
// ============================================================================

let mapTrajet = null;
let fluxFranceTrajetBrut = [];
let routeLine = null; // Stockera le tracé de la route

const DEF_LAT = 48.71;
const DEF_LON = 7.82;

document.addEventListener("DOMContentLoaded", () => {
    initialiserCarteTrajet();
    initialiserEcouteursTrajet();
});

function initialiserCarteTrajet() {
    mapTrajet = L.map('map-trajet', { zoomControl: false }).setView([DEF_LAT, DEF_LON], 9);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© CARTO © OpenStreetMap'
    }).addTo(mapTrajet);
    
    console.log("📍 Carte Itinéraire initialisée.");
}

function initialiserEcouteursTrajet() {
    document.getElementById('btn-calculer-trajet')?.addEventListener('click', executerCalculTrajet);
    
    // Déclenchement par la touche "Entrée"
    document.getElementById('trajet-arrivee')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') executerCalculTrajet();
    });
}

function toggleBurgerMenu() {
    document.getElementById('burgerMenu')?.classList.toggle('open');
    document.getElementById('menuOverlay')?.classList.toggle('active');
}

async function executerCalculTrajet() {
    const depart = document.getElementById('trajet-depart').value.trim();
    const arrivee = document.getElementById('trajet-arrivee').value.trim();
    const statut = document.getElementById('trajet-statut');

    if (!depart || !arrivee) {
        alert("Veuillez saisir une ville de départ ET d'arrivée.");
        return;
    }

    statut.textContent = "⚡ Calcul du meilleur itinéraire...";
    console.log(`Calcul itinéraire entre : ${depart} ➡️ ${arrivee}`);
    
    // Prochaine étape : Géocodage des villes, requêtes OSRM et filtrage mathématique des stations !
}
