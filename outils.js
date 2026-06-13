// Enregistrement manuel et explicite du plugin de zoom auprès de Chart.js
if (typeof ChartZoomHub === 'undefined' && window['chartjs-plugin-zoom']) {
    Chart.register(window['chartjs-plugin-zoom']);
}

document.addEventListener("DOMContentLoaded", async () => {
    let instanceGraphique = null;
    let stationsGlobales = [];
    const API_URL = "stations_france.json";

    // Éléments du DOM
    const nomOperateurBadge = document.getElementById("nom-operateur");
    const selectStation = document.getElementById("select-station-outils");
    const selectCarburant = document.getElementById("select-carburant-outils"); // 🎯 Nouveau sélecteur
    const graphiqueElem = document.getElementById("graphiquePrevisionnel");
    const briefingTexte = document.getElementById("briefing-texte");
    
    if (!graphiqueElem || !selectStation || !selectCarburant) return;
    const ctx = graphiqueElem.getContext("2d");

    // Optimisation mobile tactile
    graphiqueElem.style.touchAction = "none";
    graphiqueElem.style.userSelect = "none";
    graphiqueElem.style.webkitUserSelect = "none";

    // ==========================================
    // 1. GESTION DU MENU BURGER (PC & Mobile)
    // ==========================================
    const burgerBtn = document.querySelector('.burger-btn');
    if (burgerBtn) {
        burgerBtn.addEventListener('click', () => toggleBurgerMenu());
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
    function genererBriefingAnalyste(nomStation, prixActuel, typeCarburant) {
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

        briefingTexte.innerHTML = `<strong>Rapport de situation :</strong> ${analyse} <br><span style='color: #4b5563; font-size: 11px; display: block; margin-top: 8px;'>Cours pivot détecté (${typeCarburant.toUpperCase()}) : ${prixActuel} € • Modélisation mise à jour toutes les 30 minutes.</span>`;
    }

    // ==========================================
    // 3. CHARGEMENT DES FAVORIS
    // ==========================================
    async function initialiserDonnees() {
        try {
            selectStation.innerHTML = '<option value="" selected disabled>-- Alignement des bases... --</option>';

            try {
                const response = await fetch(API_URL);
                if (response.ok) stationsGlobales = await response.json();
            } catch (jsonErr) {
                console.warn("⚠️ Fichier stations_france.json non accessible.");
            }

            const { data: favoris, error } = await _supabase
                .from("favoris")
                .select("*")
                .eq("user_id", session.user.id);

            if (error) throw error;

            if (favoris && favoris.length > 0) {
                selectStation.innerHTML = ''; 
                
                favoris.forEach(fav => {
                    const idSecteurCalcule = `${fav.latitude}_${fav.longitude}`;

                    const option = document.createElement("option");
                    option.value = idSecteurCalcule; 
                    option.dataset.nom = fav.nom_station || "Station Carburant";
                    option.dataset.idUnique = idSecteurCalcule; 
                    option.dataset.lat = fav.latitude;
                    option.dataset.lon = fav.longitude;
                    
                    option.textContent = `${fav.nom_station || "Station"}`;
                    selectStation.appendChild(option);
                });

                selectStation.selectedIndex = 0;
                declencherMiseAJour();

            } else {
                selectStation.innerHTML = '<option value="" disabled>Aucun favori enregistré</option>';
            }
        } catch (err) {
            console.error("[Erreur] Initialisation impossible :", err.message);
        }
    }

    function extrairePrixDuLiveJson(lat, lon, nomStation, codeCarburant) {
        let prixSecours = 1.750;
        if (stationsGlobales.length === 0) return prixSecours;

        const stationLive = stationsGlobales.find(s => 
            (s.lt && Math.abs(parseFloat(s.lt) - parseFloat(lat)) < 0.005 && Math.abs(parseFloat(s.ln) - parseFloat(lon)) < 0.005) ||
            (s.n && s.n.trim() === nomStation.trim())
        );

        if (stationLive) {
            let prixTrouve = stationLive[codeCarburant];
            if (prixTrouve) return parseFloat(prixTrouve);
        }
        return prixSecours;
    }

    // ==========================================
    // 4. EXTRACTION HISTORIQUE REEL
    // ==========================================
    async function extraireHistoriqueReel(idStation, codeCarburant) {
        let historique = { labels: [], prix: [] };
        console.log(`📡 [Supabase] Extraction historique_prix pour : ID="${idStation}" | Carburant="${codeCarburant}"`);
        
        try {
            let { data: points, error } = await _supabase
                .from("historique_prix")
                .select("prix, horodatage")
                .eq("id_station", idStation)
                .eq("carburant", codeCarburant)
                .order("horodatage", { ascending: true });

            if (!error && (!points || points.length === 0)) {
                const segments = idStation.split('_');
                if (segments.length === 2) {
                    const latTronquee = parseFloat(segments[0]).toFixed(3);
                    const lonTronquee = parseFloat(segments[1]).toFixed(3);
                    console.log(`🔍 Plan B : Scan flou appliqué sur [${latTronquee} / ${lonTronquee}] pour carburant : ${codeCarburant}`);

                    let reponseFloue = await _supabase
                        .from("historique_prix")
                        .select("prix, horodatage")
                        .ilike("id_station", `%${latTronquee}%`)
                        .ilike("id_station", `%${lonTronquee}%`)
                        .eq("carburant", codeCarburant)
                        .order("horodatage", { ascending: true });
                    
                    if (!reponseFloue.error) points = reponseFloue.data;
                }
            }

            if (points && points.length > 0) {
                points.forEach(p => {
                    let datePoint = new Date(p.horodatage);
                    historique.labels.push(formaterLabelM30(datePoint));
                    historique.prix.push(parseFloat(p.prix).toFixed(3));
                });
                console.log(`✅ [Supabase] ${points.length} points historiques récupérés.`);
            }
        } catch (err) {
            console.error("⚠️ Exception critique historique :", err.message);
        }
        return historique;
    }

    // ==========================================
    // 5. FONCTION PRÉDICTION STABILISÉE ET LISSÉE (MODIFIÉE) 🧠🎯
    // ==========================================
    function calculerProjectionFuture(vraiPrixActuel, nomStation, historiquePrix = []) {
        let projection = { labels: [], prix: [] };
        let momentActuel = new Date();
        let minutes = momentActuel.getMinutes();
        momentActuel.setMinutes(minutes < 30 ? 0 : 30, 0, 0);

        // 🟢 CALCUL DE LA VOLATILITÉ RÉELLE DE L'HISTORIQUE POUR ADAPTER L'AMPLITUDE
        let facteurAjustement = 0.002; // Valeur de sécurité par défaut trèèès calme
        if (historiquePrix.length > 1) {
            const prixNumeriques = historiquePrix.map(p => parseFloat(p));
            const prixMin = Math.min(...prixNumeriques);
            const prixMax = Math.max(...prixNumeriques);
            const volatiliteReelle = prixMax - prixMin;
            
            // Si le prix n'a quasiment pas bougé (historique plat), on force un lissage extrême
            facteurAjustement = volatiliteReelle < 0.005 ? 0.001 : volatiliteReelle * 0.35;
        }

        const pasMinutes = 30;
        const totalHeuresEtude = 48; // Fenêtre d'anticipation macro-économique

        for (let offset = pasMinutes; offset <= (totalHeuresEtude * 60); offset += pasMinutes) {
            let heureBoucle = new Date(momentActuel.getTime() + (offset * 60 * 1000));
            
            // Simulation d'onde sinusoïdale amortie indexée sur notre facteur de volatilité réelle
            const indexEtape = offset / pasMinutes;
            const ondeDouce = Math.sin(indexEtape * 0.4) * Math.cos(indexEtape * 0.2);
            
            let prixPredit = parseFloat(vraiPrixActuel) + (ondeDouce * facteurAjustement);

            projection.labels.push(formaterLabelM30(heureBoucle));
            projection.prix.push(prixPredit.toFixed(3));
        }
        return projection;
    }

    function formaterLabelM30(date) {
        let options = { weekday: 'short' };
        let nomJour = date.toLocaleDateString('fr-FR', options).replace('.', '');
        nomJour = nomJour.charAt(0).toUpperCase() + nomJour.slice(1);
        let min = date.getMinutes().toString().padStart(2, '0');
        return `${nomJour} ${date.getHours()}h${min}`;
    }

    // ==========================================
    // 6. RETICULE EN CROIX (CROSSHAIR)
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
    // 7. CONSTRUCTEUR / MISE A JOUR DU GRAPHIQUE (AMPLITUDE MACRO 10 CTS)
    // ==========================================
    function mettreAJourGraphique(labels, donneesReel, donneesPrediction) {
        if (instanceGraphique) instanceGraphique.destroy();

        const indexMaintenant = labels.indexOf("Maintenant");
        let indexMinInitial = 0;
        let indexMaxInitial = labels.length - 1;

        if (indexMaintenant !== -1) {
            indexMinInitial = Math.max(0, indexMaintenant - 12);
            indexMaxInitial = Math.min(labels.length - 1, indexMaintenant + 24);
        }

        // 🟢 DECENTRHAGE SMART : Calcul du prix médian pour fixer les barrières Y
        // On cherche le dernier prix valide disponible (réel ou dynamique) pour centrer notre vision
        const prixValides = [...donneesReel, ...donneesPrediction].filter(p => p !== null && !isNaN(p));
        const prixPivot = prixValides.length > 0 ? parseFloat(prixValides[prixValides.length - 1]) : 1.750;

        // On crée une amplitude fixe de 10 centimes (0.10 €) centrée sur le cours pivot
        // Ex: si le prix vaut 1.742 €, l'axe ira de 1.692 € à 1.792 €
        const yMinAxe = prixPivot - 0.05;
        const yMaxAxe = prixPivot + 0.05;

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
                        pointRadius: 2,
                        pointHoverRadius: 5,
                        tension: 0.1,
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
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: true, labels: { color: '#9ca3af', font: { family: 'Plus Jakarta Sans', size: 11 } } },
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
                        ticks: { color: '#9ca3af', font: { family: 'Plus Jakarta Sans', size: 9 }, maxTicksLimit: 10, maxRotation: 0 }
                    },
                    y: {
                        // 🎯 APPLICATION DES BORNES MACRO
                        min: yMinAxe,
                        max: yMaxAxe,
                        grid: { color: '#1f2937' },
                        ticks: { 
                            color: '#9ca3af', 
                            font: { family: 'Plus Jakarta Sans' }, 
                            stepSize: 0.02, // Une ligne de grille tous les 2 centimes pour garder l'axe propre
                            callback: (val) => parseFloat(val).toFixed(3) + ' €' 
                        }
                    }
                }
            },
            plugins: [pluginCrosshair]
        });
    }
    // ==========================================
    // 8. INTERSECTEUR DE MISE A JOUR CENTRALISÉ
    // ==========================================
    async function declencherMiseAJour() {
        const option = selectStation.options[selectStation.selectedIndex];
        if (!option || option.value === "") return;

        const nomStation = option.dataset.nom || "Station";
        const idStation = option.dataset.idUnique;
        const lat = option.dataset.lat;
        const lon = option.dataset.lon;
        
        const carburantSelectionne = selectCarburant.value;
        const prixDynamique = extrairePrixDuLiveJson(lat, lon, nomStation, carburantSelectionne);

        genererBriefingAnalyste(nomStation, prixDynamique, carburantSelectionne);

        // A. Extraction historique réelle depuis la table 'favoris' originelle
        const historique = await extraireHistoriqueReel(idStation, carburantSelectionne);

        // B. Anticipation algorithmique future lissée intelligemment (on lui passe l'historique en paramètre)
        const anticipation = calculerProjectionFuture(prixDynamique, nomStation, historique.prix);

        // C. Assemblage de l'axe temporel
        let labelsGlobaux = [...historique.labels, "Maintenant", ...anticipation.labels];
        
        let datasetReel = [...historique.prix, parseFloat(prixDynamique).toFixed(3)];
        while(datasetReel.length < labelsGlobaux.length) { datasetReel.push(null); }

        let datasetPrevision = [];
        while(datasetPrevision.length < historique.labels.length) { datasetPrevision.push(null); }
        datasetPrevision.push(parseFloat(prixDynamique).toFixed(3));
        datasetPrevision.push(...anticipation.prix);

        mettreAJourGraphique(labelsGlobaux, datasetReel, datasetPrevision);
    }

    selectStation.addEventListener("change", declencherMiseAJour);
    selectCarburant.addEventListener("change", declencherMiseAJour);

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
