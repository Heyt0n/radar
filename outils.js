document.addEventListener("DOMContentLoaded", async () => {
    let instanceGraphique = null;

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
        // Gère le clic classique ET le tap tactile sans conflit
        ['click', 'touchend'].forEach(evt => {
            burgerBtn.addEventListener(evt, (e) => {
                e.preventDefault(); // Évite le double déclenchement sur smartphone
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
    // 2. RÉCUPÉRATION DES STATIONS FAVORITES (PRIX HARMONISÉS)
    // ==========================================
    async function chargerStationsFavorites() {
        try {
            selectStation.innerHTML = '<option value="" selected disabled>-- Sélectionne une station cible --</option>';

            const { data: favoris, error } = await _supabase
                .from("favoris")
                .select("*")
                .eq("user_id", session.user.id);

            if (error) throw error;

            if (favoris && favoris.length > 0) {
                favoris.forEach(fav => {
                    const option = document.createElement("option");
                    option.value = fav.id_station || fav.id || `${fav.latitude}_${fav.longitude}`; 
                    
                    // Force une base de prix identique stricte entre appareils si absent de la DB
                    const prixBaseStable = fav.dernier_prix ? parseFloat(fav.dernier_prix) : 1.755;
                    option.dataset.prixActuel = prixBaseStable; 
                    option.dataset.nom = fav.nom_station || "Station Carburant";
                    
                    option.textContent = `${fav.nom_station || "Station"}`;
                    selectStation.appendChild(option);
                });
                console.log(`${favoris.length} stations injectées.`);
            } else {
                const option = document.createElement("option");
                option.textContent = "Aucune station favorite trouvée";
                option.disabled = true;
                selectStation.appendChild(option);
            }
        } catch (err) {
            console.error("Erreur chargement favoris tools:", err.message);
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
    // 4. L'ALGORITHME DE PRÉDICTION AVANCÉ (HORIZON 5 JOURS)
    // ==========================================
    function genererCourbePredictive5Jours(prixActuel, nomStation, idStation) {
        let pointsGraphique = [];
        let labelsDates = [];
        
        // Fixer l'heure de départ à la minute 0 pour éviter des micro-écarts de calcul entre deux rafraîchissements Ordi/Mobile
        let heureActuelle = new Date();
        heureActuelle.setMinutes(0, 0, 0);

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

        let profilActif = profilPetroliers;
        if (nomMinuscule.includes("leclerc") || nomMinuscule.includes("carrefour") || 
            nomMinuscule.includes("intermar") || nomMinuscule.includes("auchan") || 
            nomMinuscule.includes("super u") || nomMinuscule.includes("u utile") || nomMinuscule.includes("systeme u")) {
            profilActif = profilGrandesSurfaces;
        }

        const totalHeures = 120;
        const intervalleHeures = 4;

        for (let i = 0; i <= totalHeures; i += intervalleHeures) {
            let heureFuture = new Date(heureActuelle.getTime() + (i * 60 * 60 * 1000));
            let h = heureFuture.getHours();
            let jourIndex = Math.floor(i / 24);

            let coefficientBase = profilActif[h] || 0;
            let signatureUnique = genererFluctuationUnique(idStation, `h_${h}`) * 0.004;
            let tendanceMacro = genererFluctuationUnique(idStation, `jour_${jourIndex}`) * 0.015;

            let prixPredit = parseFloat(prixActuel) + coefficientBase + signatureUnique + tendanceMacro;

            let optionsJours = { weekday: 'short' };
            let nomJour = heureFuture.toLocaleDateString('fr-FR', optionsJours);
            nomJour = nomJour.replace('.', '');
            nomJour = nomJour.charAt(0).toUpperCase() + nomJour.slice(1);
            
            let labelDate = `${nomJour} ${h}h`;
            
            labelsDates.push(labelDate);
            pointsGraphique.push(prixPredit.toFixed(3));
        }

        return { labels: labelsDates, data: pointsGraphique };
    }

    // ==========================================
    // 5. MOTEUR D'AFFICHAGE (CHART.JS)
    // ==========================================
    function mettreAJourGraphique(labels, data, nomStation) {
        if (instanceGraphique) {
            instanceGraphique.destroy();
        }

        instanceGraphique = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: `Projection 5 jours (${nomStation})`,
                    data: data,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.05)',
                    borderWidth: 2.5,
                    pointBackgroundColor: '#22c55e',
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    tension: 0.35,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        grid: { color: '#1f2937' },
                        ticks: { 
                            color: '#9ca3af', 
                            font: { family: 'Plus Jakarta Sans', size: 10 },
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
        const idStation = optionSelectionnee.value;

        console.log(`🎯 Analyse longue portée activée : ${nomStation}`);
        const previsions = genererCourbePredictive5Jours(prixBrut, nomStation, idStation);

        try {
            mettreAJourGraphique(previsions.labels, previsions.data, nomStation);
        } catch (chartError) {
            console.error("Erreur Chart.js :", chartError.message);
        }
    });

    await chargerStationsFavorites();
});

// Fonction globale d'ouverture/fermeture du menu
function toggleBurgerMenu() {
    const menu = document.getElementById('burgerMenu');
    const overlay = document.getElementById('menuOverlay');
    
    if (menu && overlay) {
        menu.classList.toggle('open');
        overlay.classList.toggle('active');
    }
}
window.toggleBurgerMenu = toggleBurgerMenu;
