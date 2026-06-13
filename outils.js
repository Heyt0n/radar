// =========================================================================
// TERMINAL DE CONTRÔLE - ENGIN STATISTIQUE & PRÉVISIONNEL AUTOMATISÉ
// =========================================================================

// Variables globales pour piloter l'interface et le graphique
let monGraphique = null;
let utilisateurConnecte = null;

// Initialisation au chargement complet du DOM
document.addEventListener("DOMContentLoaded", async () => {
    console.log("🛰️ Initialisation du terminal d'analyse...");
    await verifierSessionEtInitialiser();
    configurerEcouteursEvenements();
});

/**
 * 1. SÉCURITÉ & INITIALISATION DES DONNÉES
 */
async function verifierSessionEtInitialiser() {
    try {
        // Récupération de la session utilisateur via Supabase
        const { data: { session }, error: authError } = await _supabase.auth.getSession();
        
        if (authError || !session) {
            console.warn("🔒 Opérateur non identifié. Redirection vers la base de connexion.");
            window.location.href = "connexion.html";
            return;
        }

        utilisateurConnecte = session.user;
        
        // Mise à jour du badge de l'opérateur dans le header
        const badgeOperateur = document.getElementById("nom-operateur");
        if (badgeOperateur) {
            badgeOperateur.textContent = utilisateurConnecte.email.split('@')[0].toUpperCase();
        }

        // Chargement de la liste des stations favorites de l'utilisateur
        await chargerStationsFavorites();

    } catch (err) {
        console.error("❌ Échec critique lors de l'initialisation :", err.message);
    }
}

/**
 * 2. CHARGEMENT DES STATIONS FAVORITES (SUPABASE)
 */
async function chargerStationsFavorites() {
    const selectStation = document.getElementById("select-station-outils");
    if (!selectStation) return;

    try {
        // 🎯 TARGETING ALIGNÉ : Requête sur la bonne table 'stations_favorites'
        const { data: favoris, error } = await _supabase
            .from("stations_favorites")
            .select("id_station, nom_station, ville")
            .eq("user_id", utilisateurConnecte.id);

        if (error) throw error;

        // Vidage du sélecteur
        selectStation.innerHTML = "";

        if (!favoris || favoris.length === 0) {
            selectStation.innerHTML = `<option value="" disabled selected>❌ Aucun favori enregistré</option>`;
            afficherMessageRupture("AUCUN FAVORI ENREGISTRÉ");
            return;
        }

        // Remplissage du sélecteur avec les favoris réels
        favoris.forEach((fav, index) => {
            const option = document.createElement("option");
            option.value = fav.id_station;
            
            // 🧠 SÉCURITÉ AFFICHAGE : Évite d'afficher "Station" en boucle si le nom est générique
            if (fav.nom_station && fav.nom_station.trim() !== "Station") {
                option.textContent = fav.nom_station;
            } else if (fav.ville) {
                option.textContent = `Station - ${fav.ville}`;
            } else {
                option.textContent = `Station - ${fav.id_station}`;
            }

            if (index === 0) option.selected = true; // Sélectionne la première cible par défaut
            selectStation.appendChild(option);
        });

        // Premier déclenchement de l'analyse technique
        await executerAnalyseTechnique();

    } catch (err) {
        console.error("❌ Erreur de liaison avec la table 'stations_favorites' :", err.message);
        selectStation.innerHTML = `<option value="" disabled selected>⚠️ Erreur de chargement</option>`;
    }
}

/**
 * 3. ÉCOUTEURS D'ÉVÉNEMENTS (CHANGEMENT DE FILTRES)
 */
function configurerEcouteursEvenements() {
    const selectStation = document.getElementById("select-station-outils");
    const selectCarburant = document.getElementById("select-carburant-outils");

    if (selectStation) {
        selectStation.addEventListener("change", executerAnalyseTechnique);
    }
    if (selectCarburant) {
        selectCarburant.addEventListener("change", executerAnalyseTechnique);
    }
}

/**
 * 4. COLLECTE ET INTERPRÉTATION DES DONNÉES DE MARCHÉ
 */
async function executerAnalyseTechnique() {
    const idStation = document.getElementById("select-station-outils")?.value;
    const typeCarburant = document.getElementById("select-carburant-outils")?.value;

    if (!idStation || !typeCarburant) return;

    console.log(`🎯 Alignement des mires : Station [${idStation}] | Vecteur [${typeCarburant}]`);

    try {
        // Extraction de l'historique des prix réel depuis la table dédiée
        const { data: historique, error } = await _supabase
            .from("historique_prix")
            .select("prix, horodatage")
            .eq("id_station", idStation)
            .eq("carburant", typeCarburant)
            .order("horodatage", { ascending: true });

        if (error) throw error;

        // 🛡️ SÉCURITÉ RUPTURE DE STOCK : Si le tableau est vide (carburant non vendu ou en rupture)
        if (!historique || historique.length === 0) {
            console.warn(`⚠️ Aucune donnée pour le carburant ${typeCarburant} dans cette station.`);
            afficherMessageRupture(`RUPTURE DE STOCK / INDISPONIBLE`);
            return;
        }

        // Extraction des tableaux de valeurs
        const prixReels = historique.map(h => parseFloat(h.prix));
        const datesReelles = historique.map(h => {
            const date = new Date(h.horodatage);
            return date.toLocaleDateString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
        });

        // Génération de la projection prévisionnelle intra-day via notre algorithme lissé
        const { projections, datesProjections } = genererProjectionIntelligente(prixReels, historique[historique.length - 1].horodatage);

        // Rendu final sur l'interface graphique TradingView Style
        dessinerGraphiqueUnifie(datesReelles, prixReels, datesProjections, projections);

    } catch (err) {
        console.error("❌ Erreur lors de l'analyse technique :", err.message);
        afficherMessageRupture("ERREUR FLUX CENTRAL");
    }
}

/**
 * 5. ALGORITHME PRÉVISIONNEL ET DE LISSAGE ADAPTATIF (MATRICE M30)
 */
function genererProjectionIntelligente(historiquePrix, dernierHorodatage) {
    const pointsPrevisions = [];
    const datesProjections = [];
    
    const dernierPrixConnu = historiquePrix[historiquePrix.length - 1];
    
    // Calcul de la volatilité réelle historique (Écart max - min sur la période)
    const prixMin = Math.min(...historiquePrix);
    const prixMax = Math.max(...historiquePrix);
    const volatiliteReelle = prixMax - prixMin;

    // 🧠 RÈGLE INTELLIGENTE : Si le prix n'a pas bougé (inférieur à 0.01€ de variation), 
    // on impose un facteur d'atténuation drastique pour aplatir les vagues de projection erratiques.
    const facteurAjustement = volatiliteReelle < 0.01 ? 0.0015 : volatiliteReelle * 0.4;

    let dateCourante = new Date(dernierHorodatage);

    // Génération de 12 points de prévision (intervalles de 30 minutes sur un horizon de 6h)
    for (let i = 1; i <= 12; i++) {
        // Avancement du temps de 30 minutes à chaque itération
        dateCourante.setMinutes(dateCourante.getMinutes() + 30);
        const labelDate = dateCourante.toLocaleDateString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
        datesProjections.push(labelDate);

        // Modélisation cyclique stabilisée : calcul d'une onde amortie et bridée
        const ondeCyclique = Math.sin(i * 0.8) * Math.cos(i * 0.4);
        
        // Calcul du prix anticipé indexé directement sur la volatilité réelle constatée
        const prixAnticipe = dernierPrixConnu + (ondeCyclique * facteurAjustement);
        pointsPrevisions.push(parseFloat(prixAnticipe.toFixed(3)));
    }

    return { projections: pointsPrevisions, datesProjections };
}

/**
 * 6. CONSTRUCTION ET RENDU DE CHART.JS
 */
function dessinerGraphiqueUnifie(labelsReels, donneesReelles, labelsPrevisions, donneesPrevisions) {
    const canvas = document.getElementById("graphiquePrevisionnel");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    // Destruction de l'instance précédente pour réinitialiser le canvas proprement
    if (monGraphique) {
        monGraphique.destroy();
    }

    // Fusion des repères temporels pour une frise chronologique continue
    const tousLesLabels = [...labelsReels, ...labelsPrevisions];

    // Alignement parfait des tableaux de données pour lier proprement l'historique et la projection
    const datasetReel = [...donneesReelles];
    const datasetPrevision = Array(labelsReels.length - 1).fill(null);
    
    // Le point de jonction lie la fin de l'historique réel au premier point prévisionnel
    datasetPrevision.push(donneesReelles[donneesReelles.length - 1]);
    datasetPrevision.push(...donneesPrevisions);

    // Configuration et instanciation de Chart.js
    monGraphique = new Chart(ctx, {
        type: 'line',
        data: {
            labels: tousLesLabels,
            datasets: [
                {
                    label: 'Historique Réel ',
                    data: datasetReel,
                    borderColor: '#22c55e', // Vert tactique
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
                    borderColor: '#3b82f6', // Bleu prévisionnel
                    borderWidth: 2.5,
                    borderDash: [6, 4], // Pointillés distinctifs
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
                legend: { display: false }, // Géré par notre bloc légende HTML personnalisé
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
                            if (context.raw !== null) {
                                return ` ${context.dataset.label}: ${context.raw.toFixed(3)} €`;
                            }
                        }
                    }
                }
            ],
            scales: {
                x: {
                    grid: { color: '#161e2e', drawTicks: false },
                    ticks: { color: '#9ca3af', font: { size: 10 }, maxTicksLimit: 7 }
                },
                y: {
                    grid: { color: '#161e2e', drawTicks: false },
                    ticks: { 
                        color: '#9ca3af', 
                        font: { size: 11 },
                        callback: function(value) { return value.toFixed(3) + ' €'; }
                    }
                }
            }
        }
    });
}

/**
 * 7. INTERCEPTATION - PANNEAU DE RUPTURE DE STOCK (TEXTE ROUGE ALERTE)
 */
function afficherMessageRupture(message) {
    if (monGraphique) {
        monGraphique.destroy();
        monGraphique = null;
    }

    const canvas = document.getElementById("graphiquePrevisionnel");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    
    // Effacement total de la grille graphique
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dessin du calque textuel d'alerte centré au milieu du tableau
    ctx.fillStyle = "#ef4444"; 
    ctx.font = "bold 13px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`⚠️ ALERT : ${message}`, canvas.width / 2, canvas.height / 2);
}
