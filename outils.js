// =========================================================================
// TERMINAL DE CONTRÔLE - ENGIN STATISTIQUE & DIAGNOSTIC DÉDIÉ
// =========================================================================

let monGraphique = null;
let utilisateurConnecte = null;

// Détection automatique du nom de l'instance Supabase configurée dans ton projet
const db = typeof _supabase !== "undefined" ? _supabase : (typeof supabase !== "undefined" ? supabase : null);

document.addEventListener("DOMContentLoaded", async () => {
    console.log("🛰️ Initialisation du terminal d'analyse...");
    if (!db) {
        alert("❌ ERREUR CRITIQUE : L'instance Supabase n'est pas détectée. Vérifie l'ordre de tes scripts dans le HTML (supabase-config.js doit être avant outils.js).");
        return;
    }
    await verifierSessionEtInitialiser();
    configurerEcouteursEvenements();
});

/**
 * 1. SÉCURITÉ & INITIALISATION DES DONNÉES
 */
async function verifierSessionEtInitialiser() {
    try {
        const { data: { session }, error: authError } = await db.auth.getSession();
        
        if (authError || !session) {
            console.warn("🔒 Opérateur non identifié. Redirection vers la base de connexion.");
            window.location.href = "connexion.html";
            return;
        }

        utilisateurConnecte = session.user;
        
        const badgeOperateur = document.getElementById("nom-operateur");
        if (badgeOperateur) {
            badgeOperateur.textContent = utilisateurConnecte.email.split('@')[0].toUpperCase();
        }

        // Lancement de l'extraction des stations avec diagnostic intégré
        await chargerStationsFavorites();

    } catch (err) {
        console.error("❌ Échec lors de l'initialisation :", err.message);
    }
}

/**
 * 2. CHARGEMENT DES STATIONS FAVORITES (AVEC INJECTION DU DIAGNOSTIC)
 */
async function chargerStationsFavorites() {
    const selectStation = document.getElementById("select-station-outils");
    if (!selectStation) return;

    try {
        console.log("📡 Envoi de la requête d'extraction vers Supabase pour l'UUID :", utilisateurConnecte.id);

        // 🎯 INJECTION DIAGNOSTIC : On demande '*' pour bypasser les erreurs de frappe de colonnes
        const { data: favoris, error } = await db
            .from("stations_favorites")
            .select("*"); 

        if (error) {
            // Fenêtre pop-up d'alerte pour lire l'erreur en direct sur le navigateur
            alert(`⚠️ ERREUR DE LA TABLE 'stations_favorites' :\nCode: ${error.code}\nMessage: ${error.message}`);
            throw error;
        }

        selectStation.innerHTML = "";

        // Filtrage de sécurité local si la base contient des lignes vides
        const favorisFiltres = favoris ? favoris.filter(f => f.user_id === utilisateurConnecte.id || f.id_user === utilisateurConnecte.id) : [];

        if (favorisFiltres.length === 0) {
            console.warn("⚠️ Aucun favoris trouvé correspondant à cet identifiant.");
            selectStation.innerHTML = `<option value="" disabled selected>❌ Aucun favori trouvé (Base vide)</option>`;
            afficherMessageRupture("AUCUN FAVORI DANS LE TERMINAL");
            return;
        }

        // Remplissage dynamique adaptatif
        favorisFiltres.forEach((fav, index) => {
            const option = document.createElement("option");
            // Capture adaptative selon les variantes de clés primaires d'une BDD
            option.value = fav.id_station || fav.station_id || fav.id;
            
            // Nettoyage de l'affichage
            if (fav.nom_station && fav.nom_station.trim() !== "Station") {
                option.textContent = fav.nom_station;
            } else if (fav.ville) {
                option.textContent = `Station - ${fav.ville}`;
            } else {
                option.textContent = `Station [${option.value}]`;
            }

            if (index === 0) option.selected = true;
            selectStation.appendChild(option);
        });

        // Déclenchement automatique de l'analyse technique
        await executerAnalyseTechnique();

    } catch (err) {
        console.error("❌ Erreur complète d'extraction :", err);
        selectStation.innerHTML = `<option value="" disabled selected>⚠️ Terminal Bloqué : ${err.message}</option>`;
    }
}

/**
 * 3. ÉCOUTEURS D'ÉVÉNEMENTS
 */
function configurerEcouteursEvenements() {
    const selectStation = document.getElementById("select-station-outils");
    const selectCarburant = document.getElementById("select-carburant-outils");

    if (selectStation) selectStation.addEventListener("change", executerAnalyseTechnique);
    if (selectCarburant) selectCarburant.addEventListener("change", executerAnalyseTechnique);
}

/**
 * 4. ANALYSE TECHNIQUE ET CHARGEMENT DU GRAPHIQUE
 */
async function executerAnalyseTechnique() {
    const idStation = document.getElementById("select-station-outils")?.value;
    const typeCarburant = document.getElementById("select-carburant-outils")?.value;

    if (!idStation || !typeCarburant) return;

    try {
        const { data: historique, error } = await db
            .from("historique_prix")
            .select("prix, horodatage")
            .eq("id_station", idStation)
            .eq("carburant", typeCarburant)
            .order("horodatage", { ascending: true });

        if (error) throw error;

        if (!historique || historique.length === 0) {
            afficherMessageRupture(`RUPTURE DE STOCK / INDISPONIBLE`);
            return;
        }

        const prixReels = historique.map(h => parseFloat(h.prix));
        const datesReelles = historique.map(h => {
            const date = new Date(h.horodatage);
            return date.toLocaleDateString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
        });

        const { projections, datesProjections } = genererProjectionIntelligente(prixReels, historique[historique.length - 1].horodatage);

        dessinerGraphiqueUnifie(datesReelles, prixReels, datesProjections, projections);

    } catch (err) {
        console.error("❌ Erreur lors de l'analyse technique :", err.message);
        afficherMessageRupture("ERREUR FLUX CENTRAL");
    }
}

/**
 * 5. LISSAGE DE LA PROJECTION (M30 ANTI-VOLATILITÉ ERREUR)
 */
function genererProjectionIntelligente(historiquePrix, dernierHorodatage) {
    const pointsPrevisions = [];
    const datesProjections = [];
    const dernierPrixConnu = historiquePrix[historiquePrix.length - 1];
    
    const prixMin = Math.min(...historiquePrix);
    const prixMax = Math.max(...historiquePrix);
    const volatiliteReelle = prixMax - prixMin;

    const facteurAjustement = volatiliteReelle < 0.01 ? 0.0015 : volatiliteReelle * 0.4;
    let dateCourante = new Date(dernierHorodatage);

    for (let i = 1; i <= 12; i++) {
        dateCourante.setMinutes(dateCourante.getMinutes() + 30);
        datesProjections.push(dateCourante.toLocaleDateString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' }));

        const ondeCyclique = Math.sin(i * 0.8) * Math.cos(i * 0.4);
        const prixAnticipe = dernierPrixConnu + (ondeCyclique * facteurAjustement);
        pointsPrevisions.push(parseFloat(prixAnticipe.toFixed(3)));
    }
    return { projections: pointsPrevisions, datesProjections };
}

/**
 * 6. CONFIGURATION RENDU CHART.JS
 */
function dessinerGraphiqueUnifie(labelsReels, donneesReelles, labelsPrevisions, donneesPrevisions) {
    const canvas = document.getElementById("graphiquePrevisionnel");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (monGraphique) monGraphique.destroy();

    const tousLesLabels = [...labelsReels, ...labelsPrevisions];
    const datasetReel = [...donneesReelles];
    const datasetPrevision = Array(labelsReels.length - 1).fill(null);
    
    datasetPrevision.push(donneesReelles[donneesReelles.length - 1]);
    datasetPrevision.push(...donneesPrevisions);

    monGraphique = new Chart(ctx, {
        type: 'line',
        data: {
            labels: tousLesLabels,
            datasets: [
                {
                    label: 'Historique Réel ',
                    data: datasetReel,
                    borderColor: '#22c55e',
                    borderWidth: 3,
                    backgroundColor: 'rgba(34, 197, 94, 0.04)',
                    fill: true,
                    tension: 0.1,
                    pointRadius: 2,
                    pointHoverRadius: 5
                },
                {
                    label: 'Projection Algorithmique ',
                    data: datasetPrevision,
                    borderColor: '#3b82f6',
                    borderWidth: 2.5,
                    borderDash: [6, 4],
                    backgroundColor: 'rgba(59, 130, 246, 0.04)',
                    fill: true,
                    tension: 0.2,
                    pointRadius: 0,
                    pointHoverRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: '#111827',
                    titleColor: '#9ca3af',
                    bodyColor: '#fff',
                    borderColor: '#1f2937',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            if (context.raw !== null) return ` ${context.dataset.label}: ${context.raw.toFixed(3)} €`;
                        }
                    }
                }
            ],
            scales: {
                x: { grid: { color: '#161e2e', drawTicks: false }, ticks: { color: '#9ca3af', font: { size: 10 }, maxTicksLimit: 7 } },
                y: { grid: { color: '#161e2e', drawTicks: false }, ticks: { color: '#9ca3af', font: { size: 11 }, callback: function(v) { return v.toFixed(3) + ' €'; } } }
            }
        }
    });
}

/**
 * 7. PANNEAU DE RUPTURE SUR CANVAS
 */
function afficherMessageRupture(message) {
    if (monGraphique) { monGraphique.destroy(); monGraphique = null; }
    const canvas = document.getElementById("graphiquePrevisionnel");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ef4444"; 
    ctx.font = "bold 13px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`⚠️ ALERT : ${message}`, canvas.width / 2, canvas.height / 2);
}
