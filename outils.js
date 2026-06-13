// Enregistrement manuel et explicite du plugin de zoom auprès de Chart.js
if (typeof ChartZoomHub === 'undefined' && window['chartjs-plugin-zoom']) {
    Chart.register(window['chartjs-plugin-zoom']);
}

document.addEventListener("DOMContentLoaded", async () => {
    let instanceGraphique = null;
    let stationsGlobales = [];
    const API_URL = "stations_france.json"; // ⚠️ Vérifie bien les majuscules sur GitHub !

    // Éléments du DOM
    const nomOperateurBadge = document.getElementById("nom-operateur");
    const selectStation = document.getElementById("select-station-outils");
    const graphiqueElem = document.getElementById("graphiquePrevisionnel");
    const briefingTexte = document.getElementById("briefing-texte");
    
    if (!graphiqueElem || !selectStation) return;
    const ctx = graphiqueElem.getContext("2d");

    // Optimisation mobile tactile
    graphiqueElem.style.touchAction = "none";
    graphiqueElem.style.userSelect = "none";
    graphiqueElem.style.webkitUserSelect = "none";

    // ==========================================
    // 1. GESTION DU MENU BURGER (CORRIGÉ POUR PC & MOBILE)
    // ==========================================
    const burgerBtn = document.querySelector('.burger-btn');
    if (burgerBtn) {
        // Au clic souris (PC)
        burgerBtn.addEventListener('click', () => {
            toggleBurgerMenu();
        });
        // Au toucher tactile (Mobile)
        burgerBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            toggleBurgerMenu();
        }, { passive: false });
    }

    // ==========================================
    // 2. SÉCURITÉ ACCÈS & INITIALISATION OPERATEUR
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
    // MODULE : ANALYSTE DE MARCHÉ (BRIEFING)
    // ==========================================
    function genererBriefingAnalyste(nomStation, prixActuel) {
        if (!briefingTexte) return;
        const nomMinuscule = nomStation.toLowerCase();
        let analyse = "";

        if (nomMinuscule.match(/(leclerc|carrefour|intermar|auchan|super u|u utile|systeme u)/)) {
            analyse = `La station <strong>${nomStation}</strong> opère sur un modèle à fort volume et marges compressées. La volatilité intra-day reste bloquée par les barrières psychologiques des grandes surfaces. <strong>Stratégie conseillée :</strong> Ravitaillement optimal en fin de soirée avant les réalignements algorithmiques matinaux.`;
        } else if (nomMinuscule.match(/(total|elan|shell|bp|esso)/)) {
            analyse = `Nous constatons une sensibilité accrue aux fluctuations des marchés Spot (Rotterdam) sur l'actif <strong>${nomStation}</strong>. Les spreads sont plus larges, offrant de fortes opportunités de baisse en milieu de semaine (cycles de déstockage).`;
        } else {
            analyse = `Analyse structurelle en cours pour l'actif <strong>${nomStation}</strong>. Le support immédiat est consolidé à ${prixActuel} €. La tendance à court terme reste corrélée aux flux logistiques régionaux.`;
        }

        briefingTexte.innerHTML = `<strong>Rapport de situation :</strong> ${analyse} <br><span style='color: #4b5563; font-size: 11px; display: block; margin-top: 8px;'>Cours pivot détecté : ${prixActuel} € • Modélisation mise à jour toutes les 30 minutes.</span>`;
    }

    // ==========================================
    // 3. ENCLENCHEMENT DE L'HISTORIQUE ET DES FAVORIS
    // ==========================================
    async function initialiserDonnees() {
        try {
            selectStation.innerHTML = '<option value="" selected disabled>-- Alignement des bases... --</option>';

            // Sécurisation du fetch local (Si 404, on n'arrête pas le script)
            try {
                const response = await fetch(API_URL);
                if (response.ok) {
                    stationsGlobales = await response.json();
                } else {
                    console.warn(`⚠️ Fichier ${API_URL} introuvable (404). Utilisation des valeurs de secours.`);
                }
            } catch (jsonErr) {
                console.warn("⚠️ Impossible de lire les prix en direct locaux :", jsonErr.message);
            }

            // Lecture de la table "favoris"
            const { data: favoris, error } = await _supabase
                .from("favoris")
                .select("*")
                .eq("user_id", session.user.id);

            if (error) throw error;

            if (favoris && favoris.length > 0) {
                selectStation.innerHTML = ''; 
                
                favoris.forEach(fav => {
                    // Recherche du prix actuel dans le fichier JSON s'il a pu être chargé
                    let vraiPrix = 1.750;
                    if (stationsGlobales.length > 0) {
                        const stationLive = stationsGlobales.find(s => 
                            (s.lt && Math.abs(parseFloat(s.lt) - parseFloat(fav.latitude)) < 0.005 && Math.abs(parseFloat(s.ln) - parseFloat(fav.longitude)) < 0.005) ||
                            (s.n && s.n.trim() === fav.nom_station.trim())
                        );
                        if (stationLive) {
                            vraiPrix = parseFloat(stationLive.gz || stationLive.e10 || stationLive["95"] || 1.750);
                        }
                    }

                    // Formatage strict de l'identifiant textuel (latitude_longitude)
                    const latStr = String(fav.latitude).trim();
                    const lonStr = String(fav.longitude).trim();
                    const idSecteurCalcule = `${latStr}_${lonStr}`;

                    const option = document.createElement("option");
                    option.value = idSecteurCalcule; 
                    option.dataset.prixActuel = vraiPrix; 
                    option.dataset.nom = fav.nom_station || "Station Carburant";
                    option.dataset.idUnique = idSecteurCalcule; 
                    
                    option.textContent = `${fav.nom_station || "Station"}`;
                    selectStation.appendChild(option);
                });

                console.log(`[Moteur] ${favoris.length} cibles synchronisées.`);

                selectStation.selectedIndex = 0;
                const declencheurAuto = new Event('change');
                selectStation.dispatchEvent(declencheurAuto);

            } else {
                selectStation.innerHTML = '<option value="" disabled>Aucun favori enregistré</option>';
                if (briefingTexte) briefingTexte.textContent = "Aucun actif en mémoire. Veuillez ajouter des favoris via le Radar Tactique pour générer les briefings.";
            }
        } catch (err) {
            console.error("[Erreur] Initialisation impossible :", err.message);
            selectStation.innerHTML = '<option value="" disabled>Erreur d\'alignement</option>';
        }
    }

    // ==========================================
    // 4. MOTEUR DE TRAJECTOIRE RÉELLE & PROJECTION (CONNECTÉ SUPABASE)
    // ==========================================
    async function genererTrajectoireM30(vraiPrixActuel, nomStation, idStation) {
        let labelsDates = [];
        let donneesReel = [];
        let donneesPrediction = [];
        
        let momentActuel = new Date();
        let minutes = momentActuel.getMinutes();
        momentActuel.setMinutes(minutes < 30 ? 0 : 30, 0, 0);

        console.log(`📡 Extraction historique pour la cible : ${idStation}`);
        try {
            // Extraction directe de la table historique_prix
            const { data: historiqueSupabase, error } = await _supabase
                .from("historique_prix")
                .select("prix, horodatage")
                .eq("id_station", idStation)
                .order("horodatage", { ascending: true });

            if (error) {
                console.error("❌ Erreur Supabase lors du fetch historique :", error.message);
            }

            if (!error && historiqueSupabase && historiqueSupabase.length > 0) {
                historiqueSupabase.forEach(point => {
                    let datePoint = new Date(point.horodatage);
                    labelsDates.push(formaterLabelM30(datePoint));
                    donneesReel.push(parseFloat(point.prix).toFixed(3));
                    donneesPrediction.push(null);
                });
                console.log(`📊 Synchronisation réussie : ${historiqueSupabase.length} points injectés.`);
            } else {
                console.log(`ℹ️ Aucune ligne trouvée pour la clé : "${idStation}"`);
            }
        } catch (err) {
            console.error("⚠️ Exception critique lors de la requête :", err.message);
        }

        // ALIGNEMENT DU POINT PIVOT ACTUEL
        labelsDates.push("Maintenant");
        donneesReel.push(parseFloat(vraiPrixActuel).toFixed(3));
        donneesPrediction.push(parseFloat(vraiPrixActuel).toFixed(3));

        // PROJECTION FUTURE (FORECAST ALGORITHMIQUE)
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
        const pasMinutes = 30;
        const totalHeuresEtude = 48;

        for (let offset = pasMinutes; offset <= (totalHeuresEtude * 60); offset += pasMinutes) {
            let heureBoucle = new Date(momentActuel.getTime() + (offset * 60 * 1000));
            let h = heureBoucle.getHours();
            let coefHeure = profilActif[h] || 0;

            let prixPredit = parseFloat(vraiPrixActuel) + coefHeure;

            labelsDates.push(formaterLabelM30(heureBoucle));
            donneesReel.push(null);
            donneesPrediction.push(prixPredit.toFixed(3));
        }

        return { labels: labelsDates, reel: donneesReel, prev: donneesPrediction };
    }

    function formaterLabelM30(date) {
        let options = { weekday: 'short' };
        let nomJour = date.toLocaleDateString('fr-FR', options).replace('.', '');
        nomJour = nomJour.charAt(0).toUpperCase() + nomJour.slice(1);
        let min = date.getMinutes().toString().padStart(2, '0');
        return `${nomJour} ${date.getHours()}h${min}`;
    }

    // ==========================================
    // 5. RETICULE EN CROIX (CROSSHAIR PLUGIN)
    // ==========================================
    const pluginCrosshair = {
        id: 'crosshair',
        afterDraw: (chart) => {
            if (!chart.tooltip?._active?.length) return;
            const activePoint = chart.tooltip._active[0];
            const { ctx, chartArea: { top, bottom, left, right } } = chart;
            const x = activePoint.element.x;
            const y = activePoint.element.y;

            ctx.save();
            ctx.beginPath();
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = '#4b5563';

            ctx.moveTo(x, top); ctx.lineTo(x, bottom);
            ctx.moveTo(left, y); ctx.lineTo(right, y);
            
            ctx.stroke();
            ctx.restore();
        }
    };

    // ==========================================
    // 6. CONSTRUCTEUR DU GRAPH TRADINGVIEW-STYLE
    // ==========================================
    function mettreAJourGraphique(labels, donneesReel, donneesPrediction, nomStation) {
        if (instanceGraphique) {
            instanceGraphique.destroy();
        }

        const indexMaintenant = labels.indexOf("Maintenant");
        let indexMinInitial = 0;
        let indexMaxInitial = labels.length - 1;

        if (indexMaintenant !== -1) {
            indexMinInitial = Math.max(0, indexMaintenant - 24);
            indexMaxInitial = Math.min(labels.length - 1, indexMaintenant + 24);
        }

        instanceGraphique = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: `Historique Réel`,
                        data: donneesReel,
                        borderColor: '#22c55e',
                        backgroundColor: 'transparent',
                        borderWidth: 2.5,
                        pointRadius: 0,
                        pointHoverRadius: 5,
                        tension: 0.15,
                        spanGaps: false
                    },
                    {
                        label: `Projection Algorithmique`,
                        data: donneesPrediction,
                        borderColor: '#3b82f6',
                        backgroundColor: 'transparent',
                        borderWidth: 2.5,
                        borderDash: [6, 4],
                        pointRadius: 0,
                        pointHoverRadius: 5,
                        tension: 0.15,
                        spanGaps: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                events: ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove', 'touchend'],
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        display: true,
                        labels: { color: '#9ca3af', font: { family: 'Plus Jakarta Sans', size: 11 } }
                    },
                    zoom: {
                        pan: { enabled: true, mode: 'x', threshold: 5 },
                        zoom: { wheel: { enabled: true, speed: 0.05 }, pinch: { enabled: true }, mode: 'x' }
                    }
                },
                scales: {
                    x: {
                        min: indexMinInitial,
                        max: indexMaxInitial,
                        grid: { color: '#1f2937' },
                        ticks: { color: '#9ca3af', font: { family: 'Plus Jakarta Sans', size: 9 }, maxTicksLimit: 8, maxRotation: 0 }
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
            },
            plugins: [pluginCrosshair]
        });
    }

    // Gestionnaire d'événements lié au sélecteur
    selectStation.addEventListener("change", async (e) => {
        const optionSelectionnee = e.target.options[e.target.selectedIndex];
        if (!optionSelectionnee || optionSelectionnee.value === "") return;

        const prixBrut = optionSelectionnee.dataset.prixActuel;
        const nomStation = optionSelectionnee.dataset.nom || "Station";
        const idStation = optionSelectionnee.dataset.idUnique;

        // Mise à jour du texte d'analyse
        genererBriefingAnalyste(nomStation, prixBrut);

        // Tracé avec chargement en temps réel
        const tragictoire = await genererTrajectoireM30(prixBrut, nomStation, idStation);
        mettreAJourGraphique(tragictoire.labels, tragictoire.reel, tragictoire.prev, nomStation);
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
