document.addEventListener("DOMContentLoaded", async () => {
    let instanceGraphique = null;

    // Éléments HTML
    const nomOperateurBadge = document.getElementById("nom-operateur");
    const selectStation = document.getElementById("select-station-outils");
    const graphiqueElem = document.getElementById("graphiquePrevisionnel");
    
    if (!graphiqueElem) return;
    const ctx = graphiqueElem.getContext("2d");
    if (!selectStation) return;

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
    // 2. RÉCUPÉRATION DES STATIONS FAVORITES
    // ==========================================
    async function chargerStationsFavorites() {
        try {
            selectStation.innerHTML = '<option value="" selected disabled>-- Sélectionne une station cible --</option>';

            const { data: favoris, error } = await _supabase
                .from("stations_favorites")
                .select("*")
                .eq("user_id", session.user.id);

            if (error) throw error;

            if (favoris && favoris.length > 0) {
                favoris.forEach(fav => {
                    const option = document.createElement("option");
                    option.value = fav.id_station || fav.nom_station; 
                    option.dataset.prixActuel = fav.dernier_prix || 1.850; 
                    option.dataset.nom = fav.nom_station || "Station Carburant";
                    
                    option.textContent = `${fav.nom_station || "Station"} (${fav.ville || "Inconnue"})`;
                    selectStation.appendChild(option);
                });
                console.log(`${favoris.length} stations injectées dans le sélecteur.`);
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
    // 3. MOTEUR MATHÉMATIQUE : GENERATEUR DE SIGNATURE UNIQUE (HASH)
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
        let heureActuelle = new Date();
        const nomMinuscule = nomStation.toLowerCase();

        // Profil A : Grandes Surfaces
        const profilGrandesSurfaces = {
            0: -0.005, 1: -0.005, 2: -0.005, 3: -0.005, 4: -0.002, 5: 0.000,
            6: 0.002,  7: 0.004,  8: 0.004,  9: 0.002,  10: 0.001, 11: 0.003,
            12: 0.005, 13: 0.004, 14: 0.002, 15: 0.002, 16: 0.004, 17: 0.006,
            18: 0.005, 19: 0.002, 20: 0.000, 21: -0.002, 22: -0.004, 23: -0.005
        };

        // Profil B : Pétroliers (Plus volatiles)
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

        // Configuration de l'horizon : 5 jours = 120 heures.
        // Pour éviter d'avoir 120 points serrés sur le graphique, on prend une mesure toutes les 4 heures.
        const totalHeures = 120;
        const intervalleHeures = 4;

        for (let i = 0; i <= totalHeures; i += intervalleHeures) {
            let heureFuture = new Date(heureActuelle.getTime() + (i * 60 * 60 * 1000));
            let h = heureFuture.getHours();
            let jourIndex = Math.floor(i / 24); // Idéal pour calculer une dérive par jour

            // 1. Cycle de base selon l'heure
            let coefficientBase = profilActif[h] || 0;
            
            // 2. Micro-signature horaire unique de la station
            let signatureUnique = genererFluctuationUnique(idStation, `h_${h}`) * 0.004;

            // 3. Tendance macro sur 5 jours (simule une dérive de marché propre à la station)
            // Utilise l'ID et l'index du jour pour que la trajectoire globale reste cohérente à chaque clic
            let tendanceMacro = genererFluctuationUnique(idStation, `jour_${jourIndex}`) * 0.015;

            // Calcul final du prix projeté
            let prixPredit = parseFloat(prixActuel) + coefficientBase + signatureUnique + tendanceMacro;

            // Formatage propre du label : "Lun. 08h"
            let optionsJours = { weekday: 'short' };
            let nomJour = heureFuture.toLocaleDateString('fr-FR', optionsJours);
            // On nettoie le point éventuel ajouté par le format français (ex: "lun.")
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
                    backgroundColor: 'rgba(59, 130, 246, 0.03)',
                    borderWidth: 2.5,
                    pointBackgroundColor: '#22c55e',
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    tension: 0.35, // Courbe adoucie sur 5 jours
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
                            font: { family: 'Plus Jakarta Sans', size: 11 },
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

    // Écouteur de changement sur le sélecteur de stations
    selectStation.addEventListener("change", (e) => {
        const optionSelectionnee = e.target.options[e.target.selectedIndex];
        
        if (!optionSelectionnee || optionSelectionnee.value === "") return;

        const prixBrut = optionSelectionnee.dataset.prixActuel || 1.850;
        const nomStation = optionSelectionnee.dataset.nom || "Station";
        const idStation = optionSelectionnee.value;

        console.log(`🎯 Analyse longue portée activée : ${nomStation}`);

        // Déclenchement de l'algorithme 5 jours
        const previsions = genererCourbePredictive5Jours(prixBrut, nomStation, idStation);

        try {
            mettreAJourGraphique(previsions.labels, previsions.data, nomStation);
            console.log("📊 Graphique horizon J+5 généré avec succès.");
        } catch (chartError) {
            console.error("Erreur Chart.js :", chartError.message);
        }
    });

    await chargerStationsFavorites();
});
