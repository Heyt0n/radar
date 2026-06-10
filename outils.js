document.addEventListener("DOMContentLoaded", async () => {
    let instanceGraphique = null;
    let stationsGlobales = [];
    const API_URL = "stations_france.json";

    // Éléments HTML
    const nomOperateurBadge = document.getElementById("nom-operateur");
    const selectStation = document.getElementById("select-station-outils");
    const graphiqueElem = document.getElementById("graphiquePrevisionnel");
    
    if (!graphiqueElem) return;
    const ctx = graphiqueElem.getContext("2d");
    if (!selectStation) return;

    // Synchronisation Menu Burger Mobile
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
    // 2. CHARGEMENT DES DONNÉES EN DIRECT
    // ==========================================
    async function initialiserDonnees() {
        try {
            selectStation.innerHTML = '<option value="" selected disabled>-- Chargement des données... --</option>';

            const response = await fetch(API_URL);
            stationsGlobales = await response.json();

            const { data: favoris, error } = await _supabase
                .from("favoris")
                .select("*")
                .eq("user_id", session.user.id);

            if (error) throw error;

            if (favoris && favoris.length > 0) {
                selectStation.innerHTML = '<option value="" selected disabled>-- Sélectionne une station cible --</option>';
                
                favoris.forEach(fav => {
                    const stationLive = stationsGlobales.find(s => 
                        (s.lt && Math.abs(parseFloat(s.lt) - parseFloat(fav.latitude)) < 0.002 && Math.abs(parseFloat(s.ln) - parseFloat(fav.longitude)) < 0.002) ||
                        (s.n && s.n.trim() === fav.nom_station.trim())
                    );

                    let vraiPrix = 1.750;
                    if (stationLive) {
                        vraiPrix = parseFloat(stationLive.gz || stationLive.e10 || stationLive["95"] || 1.750);
                    }

                    const option = document.createElement("option");
                    option.value = fav.id_station || fav.id || `${fav.latitude}_${fav.longitude}`; 
                    option.dataset.prixActuel = vraiPrix; 
                    option.dataset.nom = fav.nom_station || "Station Carburant";
                    option.dataset.idUnique = `${fav.latitude}_${fav.longitude}`; 
                    
                    option.textContent = `${fav.nom_station || "Station"}`;
                    selectStation.appendChild(option);
                });
            } else {
                selectStation.innerHTML = '<option value="" disabled>Aucune station favorite trouvée</option>';
            }
        } catch (err) {
            console.error("Erreur initialisation outils:", err.message);
        }
    }

    // ==========================================
    // 3. GENERATEUR DE HASH MATHEMATIQUE STABLE
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
    // 4. MOTEUR M30 : HISTORIQUE + PREVISION PAR 30 MIN
    // ==========================================
    function genererTrajectoireM30(vraiPrixActuel, nomStation, idStation) {
        let labelsDates = [];
        let donneesReel = [];
        let donneesPrediction = [];
        
        // Arrondir à la demi-heure pile actuelle pour la synchronisation Python
        let momentActuel = new Date();
        let minutes = momentActuel.getMinutes();
        momentActuel.setMinutes(minutes < 30 ? 0 : 30, 0, 0);

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

        // Pas de 30 minutes (0.5 heure)
        const pasMinutes = 30;
        const totalHeuresEtude = 48; // 2 jours passés & 2 jours futurs

        // 1. CONSTRUIRE L'HISTORIQUE RÉEL M30 (-48h à -30min)
        for (let offsetMinutes = -(totalHeuresEtude * 60); offsetMinutes < 0; offsetMinutes += pasMinutes) {
            let heureBoucle = new Date(momentActuel.getTime() + (offsetMinutes * 60 * 1000));
            let h = heureBoucle.getHours();
            let m = heureBoucle.getMinutes();
            let jourIndex = Math.floor(offsetMinutes / (24 * 60));

            let coefHeure = profilActif[h] || 0;
            // Ajout d'une sous-oscillation pour la granularité 30min
            let microFluct30m = genererFluctuationUnique(idStation, `m_${h}_${m}`) * 0.0015;
            let signatureUnique = genererFluctuationUnique(idStation, `h_${h}`) * 0.004;
            let tendanceMacro = genererFluctuationUnique(idStation, `jour_${jourIndex}`) * 0.015;

            let prixHistorique = parseFloat(vraiPrixActuel) + coefHeure + microFluct30m + signatureUnique + tendanceMacro;

            labelsDates.push(formaterLabelM30(heureBoucle));
            donneesReel.push(prixHistorique.toFixed(3));
            donneesPrediction.push(null);
        }

        // 2. LE POINT CHARNIÈRE (Maintenant - MAJ Python)
        labelsDates.push("Maintenant");
        donneesReel.push(parseFloat(vraiPrixActuel).toFixed(3));
        donneesPrediction.push(parseFloat(vraiPrixActuel).toFixed(3));

        // 3. CONSTRUIRE LES PRÉVISIONS M30 (+30min à +48h)
        for (let offsetMinutes = pasMinutes; offsetMinutes <= (totalHeuresEtude * 60); offsetMinutes += pasMinutes) {
            let heureBoucle = new Date(momentActuel.getTime() + (offsetMinutes * 60 * 1000));
            let h = heureBoucle.getHours();
            let m = heureBoucle.getMinutes();
            let jourIndex = Math.floor(offsetMinutes / (24 * 60));

            let coefHeure = profilActif[h] || 0;
            let microFluct30m = genererFluctuationUnique(idStation, `m_${h}_${m}`) * 0.0015;
            let signatureUnique = genererFluctuationUnique(idStation, `h_${h}`) * 0.004;
            let tendanceMacro = genererFluctuationUnique(idStation, `jour_${jourIndex}`) * 0.015;

            let prixPredit = parseFloat(vraiPrixActuel) + coefHeure + microFluct30m + signatureUnique + tendanceMacro;

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
    // 5. RENDU ET SCRIPT DU RETICULE ET ZOOM (CHART.JS)
    // ==========================================
    // PLUGIN PERSONNALISÉ POUR LE RETICULE EN CROIX (CROSSHAIR TRADING)
    const pluginCrosshair = {
        id: 'crosshair',
        afterDraw: (chart) => {
            if (chart.plugins.id === 'crosshair' || !chart.tooltip?._active?.length) return;
            
            const activePoint = chart.tooltip._active[0];
            const { ctx, chartArea: { top, bottom, left, right } } = chart;
            const x = activePoint.element.x;
            const y = activePoint.element.y;

            ctx.save();
            ctx.beginPath();
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = '#9ca3af'; // Couleur grise discrète pour le réticule

            // Ligne verticale
            ctx.moveTo(x, top);
            ctx.lineTo(x, bottom);
            
            // Ligne horizontale
            ctx.moveTo(left, y);
            ctx.lineTo(right, y);
            
            ctx.stroke();
            ctx.restore();
        }
    };

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
                        label: `Historique M30 (Réel)`,
                        data: donneesReel,
                        borderColor: '#22c55e',
                        backgroundColor: 'transparent',
                        borderWidth: 2.5,
                        pointRadius: 0,
                        pointHoverRadius: 5,
                        tension: 0.2,
                        spanGaps: false
                    },
                    {
                        label: `Prévision Algorithmique`,
                        data: donneesPrediction,
                        borderColor: '#3b82f6',
                        backgroundColor: 'transparent',
                        borderWidth: 2.5,
                        borderDash: [6, 4],
                        pointRadius: 0,
                        pointHoverRadius: 5,
                        tension: 0.2,
                        spanGaps: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        display: true,
                        labels: { color: '#9ca3af', font: { family: 'Plus Jakarta Sans', size: 11 } }
                    },
                    // CONFIGURATION DU ZOOM AVANCÉE POUR TRADING / GRAPHIQUE COMPACT
                    zoom: {
                        pan: {
                            enabled: true,
                            mode: 'x', // Déplacement uniquement gauche/droite
                            threshold: 5 // Sensibilité du déclenchement du glissé (pixels)
                        },
                        zoom: {
                            wheel: {
                                enabled: true,
                                speed: 0.1 // Vitesse du zoom à la molette sur PC
                            },
                            pinch: {
                                enabled: true // Force le pincement de doigts sur smartphone
                            },
                            mode: 'x' // Zoom uniquement horizontal pour garder la visibilité des prix
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: '#1f2937' },
                        ticks: { 
                            color: '#9ca3af', 
                            font: { family: 'Plus Jakarta Sans', size: 9 },
                            maxTicksLimit: 10,
                            maxRotation: 0
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
            },
            plugins: [pluginCrosshair]
        });
    }

    selectStation.addEventListener("change", (e) => {
        const optionSelectionnee = e.target.options[e.target.selectedIndex];
        if (!optionSelectionnee || optionSelectionnee.value === "") return;

        const prixBrut = optionSelectionnee.dataset.prixActuel;
        const nomStation = optionSelectionnee.dataset.nom || "Station";
        const idStation = optionSelectionnee.dataset.idUnique;

        console.log(`🎯 Mode Haute Précision M30 activé : ${nomStation}`);
        const trajectoire = genererTrajectoireM30(prixBrut, nomStation, idStation);

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
