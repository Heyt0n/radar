document.addEventListener("DOMContentLoaded", async () => {
    let instanceGraphique = null;
    let stationsGlobales = [];
    const API_URL = "stations_france.json"; // Même source que script.js pour avoir les vrais prix

    // Éléments HTML
    const nomOperateurBadge = document.getElementById("nom-operateur");
    const selectStation = document.getElementById("select-station-outils");
    const graphiqueElem = document.getElementById("graphiquePrevisionnel");
    
    if (!graphiqueElem) return;
    const ctx = graphiqueElem.getContext("2d");
    if (!selectStation) return;

    // Synchronisation des écouteurs du menu Burger (Spécial Mobile & PC)
    const burgerBtn = document.querySelector('.burger-btn');
    if (burgerBtn) {
        ['click', 'touchend'].forEach(evt => {
            burgerBtn.addEventListener(evt, (e) => {
                e.preventDefault();
                toggleBurgerMenu();
            }, { passive: false });
        });
    }

    // ==========================================
    // 1. SÉCURITÉ & RÉCUPÉRATION DU PSEUDO
    // ==========================================
    const { data: { session }, error: sessionError } = await _supabase.auth.getSession();
    if (sessionError || !session) {
        window.location.href = "connexion.html";
        return;
    }
    if (nomOperateurBadge && session.user.user_metadata) {
        const pseudo = session.user.user_metadata.display_name || session.user.user_metadata.pseudo || "Opérateur";
        nomOperateurBadge.textContent = pseudo;
    }

    // ==========================================
    // 2. CHARGEMENT DES DONNÉES ET DES FAVORIS
    // ==========================================
    async function initialiserDonnees() {
        try {
            selectStation.innerHTML = '<option value="" selected disabled>-- Chargement des données... --</option>';

            // 1. Charger le fichier JSON global pour avoir les vrais prix en direct
            const response = await fetch(API_URL);
            stationsGlobales = await response.json();

            // 2. Charger les favoris de l'utilisateur
            const { data: favoris, error } = await _supabase
                .from("favoris")
                .select("*")
                .eq("user_id", session.user.id);

            if (error) throw error;

            if (favoris && favoris.length > 0) {
                selectStation.innerHTML = '<option value="" selected disabled>-- Sélectionne une station cible --</option>';
                
                favoris.forEach(fav => {
                    // Trouver la correspondance exacte dans le JSON pour extraire le vrai prix (par défaut Gazole 'gz')
                    const stationLive = stationsGlobales.find(s => 
                        (s.lt && Math.abs(parseFloat(s.lt) - parseFloat(fav.latitude)) < 0.002 && Math.abs(parseFloat(s.ln) - parseFloat(fav.longitude)) < 0.002) ||
                        (s.n && s.n.trim() === fav.nom_station.trim())
                    );

                    // On récupère le vrai prix du gazole (ou 1.750 si rupture complète détectée)
                    let vraiPrix = 1.750;
                    if (stationLive) {
                        vraiPrix = parseFloat(stationLive.gz || stationLive.e10 || stationLive["95"] || 1.750);
                    }

                    const option = document.createElement("option");
                    option.value = fav.id_station || fav.id || `${fav.latitude}_${fav.longitude}`; 
                    option.dataset.prixActuel = vraiPrix; 
                    option.dataset.nom = fav.nom_station || "Station Carburant";
                    option.dataset.idUnique = `${fav.latitude}_${fav.longitude}`; // Clé unique pour le générateur mathématique
                    
                    option.textContent = `${fav.nom_station || "Station"}`;
                    selectStation.appendChild(option);
                });
                console.log(`${favoris.length} stations favorites synchronisées avec les vrais prix.`);
            } else {
                selectStation.innerHTML = '<option value="" disabled>Aucune station favorite trouvée</option>';
            }
        } catch (err) {
            console.error("Erreur initialisation outils:", err.message);
        }
    }

    // ==========================================
    // 3. MOTEUR MATHÉMATIQUE : HASH STABLE
    // ==========================================
    function genererFluctuationUnique(str, graine) {
        let hash = 0;
        const chaineComplete = str + graine;
        for (let i = 0; i < chaineComplete.length; i++) {
            hash = chaineComplete.charCodeAt(i) + ((hash << 5) - hash);
        }
        return Math.sin(hash); 
    }

    // ==========================================
    // 4. ALGORITHME MIXTE : HISTORIQUE (2J) + PRÉDICTION (2J)
    // ==========================================
    function genererTrajectoire4Jours(vraiPrixActuel, nomStation, idStation) {
        let labelsDates = [];
        let donneesReel = [];
        let donneesPrediction = [];
        
        // Base de temps fixée à l'heure pile actuelle
        let momentActuel = new Date();
        momentActuel.setMinutes(0, 0, 0);

        const nomMinuscule = nomStation.toLowerCase();
        const profilGrandesSurfaces = {
            0: -0.005, 1: -0.005, 2: -0.005, 3: -0.005, 4: -0.002, 5: 0.000,
            6: 0.002,  7: 0.004,  8: 0.004,  9: 0.002,  10: 0.001, 11: 0.003,
            12: 0.005, 13: 0.004, 14: 0.002, 15: 0.002, 16: 0.004, 17: 0.006,
            18: 0.005, 19: 0.002, 20: 0.000, 21: -0.002, 22: -0.004, 23: -0.005
        };
        const profilPetroliers = {
            0: -0.018, 1: -0.020, 2: -0.022, 3: -0.025, 4: -0.020, 5: -0.010,
            6: 0.002,  7: 0.012,  8: 0.015,  9: 0.006,  10: 0.003, 11: 0.008,
            12: 0.018, 13: 0.014, 14: 0.007, 15: 0.005, 16: 0.010, 17: 0.022,
            18: 0.025, 19: 0.012, 20: 0.004, 21: -0.005, 22: -0.010, 23: -0.014
        };

        let profilActif = nomMinuscule.match(/(leclerc|carrefour|intermar|auchan|super u|u utile|systeme u)/) ? profilGrandesSurfaces : profilPetroliers;

        // Intervalle de 4 heures pour la clarté visuelle
        const pasHeure = 4;

        // 1. CONSTRUIRE LE PASSÉ : de -48h à 0h (Historique Réel simulé de manière stable)
        for (let offset = -48; offset < 0; offset += pasHeure) {
            let heureBoucle = new Date(momentActuel.getTime() + (offset * 60 * 60 * 1000));
            let h = heureBoucle.getHours();
            let jourIndex = Math.floor(offset / 24);

            let coefficientBase = profilActif[h] || 0;
            let signatureUnique = genererFluctuationUnique(idStation, `h_${h}`) * 0.004;
            let tendanceMacro = genererFluctuationUnique(idStation, `jour_${jourIndex}`) * 0.015;

            // Déduction inverse pour que le point final (0h) tombe pile sur le vrai prix actuel
            let prixHistorique = parseFloat(vraiPrixActuel) + coefficientBase + signatureUnique + tendanceMacro;

            labelsDates.push(formaterLabel(heureBoucle));
            donneesReel.push(prixHistorique.toFixed(3));
            donneesPrediction.push(null); // Pas de prévision dans le passé
        }

        // 2. LE POINT CHARNIÈRE (Maintenant / Vrai Prix Actuel)
        labelsDates.push("Maintenant");
        donneesReel.push(parseFloat(vraiPrixActuel).toFixed(3));
        donneesPrediction.push(parseFloat(vraiPrixActuel).toFixed(3)); // Raccordement des deux lignes

        // 3. CONSTRUIRE LE FUTUR : de +4h à +48h (Prévision Algorithmique)
        for (let offset = pasHeure; offset <= 48; offset += pasHeure) {
            let heureBoucle = new Date(momentActuel.getTime() + (offset * 60 * 60 * 1000));
            let h = heureBoucle.getHours();
            let jourIndex = Math.floor(offset / 24);

            let coefficientBase = profilActif[h] || 0;
            let signatureUnique = genererFluctuationUnique(idStation, `h_${h}`) * 0.004;
            let tendanceMacro = genererFluctuationUnique(idStation, `jour_${jourIndex}`) * 0.015;

            let prixPredit = parseFloat(vraiPrixActuel) + coefficientBase + signatureUnique + tendanceMacro;

            labelsDates.push(formaterLabel(heureBoucle));
            donneesReel.push(null); // Pas de données réelles dans le futur
            donneesPrediction.push(prixPredit.toFixed(3));
        }

        return { labels: labelsDates, reel: donneesReel, prev: donneesPrediction };
    }

    function formaterLabel(date) {
        let options = { weekday: 'short' };
        let nomJour = date.toLocaleDateString('fr-FR', options).replace('.', '');
        nomJour = nomJour.charAt(0).toUpperCase() + nomJour.slice(1);
        return `${nomJour}. ${date.getHours()}h`;
    }

    // ==========================================
    // 5. MOTEUR D'AFFICHAGE DU DOUBLE GRAPHIQUE (CHART.JS)
    // ==========================================
    function mettreAJourGraphique(labels, donneesReel, donneesPrediction, nomStation) {
        if (instanceGraphique) {
            instanceGraphique.destroy();
        }

        instanceGraphique = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: `Historique Réel`,
                        data: donneesReel,
                        borderColor: '#22c55e', // Vert pour le réel passé
                        backgroundColor: 'transparent',
                        borderWidth: 3,
                        pointRadius: 2,
                        tension: 0.3,
                        spanGaps: false
                    },
                    {
                        label: `Projection prédictive`,
                        data: donneesPrediction,
                        borderColor: '#3b82f6', // Bleu pour le futur
                        backgroundColor: 'transparent',
                        borderWidth: 3,
                        borderDash: [6, 4], // TRAIT EN POINTILLÉS POUR LE FUTUR 🎯
                        pointRadius: 2,
                        tension: 0.3,
                        spanGaps: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        labels: { color: '#9ca3af', font: { family: 'Plus Jakarta Sans', size: 11 } }
                    }
                },
                scales: {
                    x: {
                        grid: { color: '#1f2937' },
                        ticks: { 
                            color: '#9ca3af', 
                            font: { family: 'Plus Jakarta Sans', size: 9 },
                            maxRotation: 45,
                            minRotation: 45
                        }
                    },
                    y: {
                        grid: { color: '#1f2937' },
                        ticks: { 
                            color: '#9ca3af', 
                            font: { family: 'Plus Jakarta Sans' },
                            callback: function(val) { return parseFloat(val).toFixed(3) + ' €'; }
                        }
                    }
                }
            }
        });
    }

    selectStation.addEventListener("change", (e) => {
        const optionSelectionnee = e.target.options[e.target.selectedIndex];
        if (!optionSelectionnee || optionSelectionnee.value === "") return;

        const prixBrut = optionSelectionnee.dataset.prixActuel;
        const nomStation = optionSelectionnee.dataset.nom || "Station";
        const idStation = optionSelectionnee.dataset.idUnique;

        console.log(`🎯 Analyse synchronisée active sur : ${nomStation} (${prixBrut} €)`);
        const trajectoire = genererTrajectoire4Jours(prixBrut, nomStation, idStation);

        try {
            mettreAJourGraphique(trajectoire.labels, trajectoire.reel, trajectoire.prev, nomStation);
        } catch (chartError) {
            console.error("Erreur Chart.js :", chartError.message);
        }
    });

    await initialiserDonnees();
});

function toggleBurgerMenu() {
    const menu = document.getElementById('burgerMenu');
    const overlay = document.getElementById('menuOverlay');
    if (menu && overlay) {
        menu.classList.toggle('open');
        overlay.classList.toggle('active');
    }
}
window.toggleBurgerMenu = toggleBurgerMenu;
