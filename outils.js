document.addEventListener("DOMContentLoaded", async () => {
    let instanceGraphique = null;

    // Éléments HTML
    const nomOperateurBadge = document.getElementById("nom-operateur");
    const selectStation = document.getElementById("select-station-outils");
    const graphiqueElem = document.getElementById("graphiquePrevisionnel");
    
    if (!graphiqueElem) {
        console.error("Élément 'graphiquePrevisionnel' introuvable dans le HTML.");
        return;
    }
    const ctx = graphiqueElem.getContext("2d");

    if (!selectStation) {
        console.error("Élément 'select-station-outils' introuvable.");
        return;
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
    // 2. RÉCUPÉRATION DES STATIONS FAVORITES SINCE CLOUD
    // ==========================================
    async function chargerStationsFavorites() {
        try {
            // Option neutre par défaut
            selectStation.innerHTML = '<option value="" selected disabled>-- Sélectionne une station cible --</option>';

            const { data: favoris, error } = await _supabase
                .from("stations_favorites")
                .select("*")
                .eq("user_id", session.user.id);

            if (error) throw error;

            if (favoris && favoris.length > 0) {
                favoris.forEach(fav => {
                    const option = document.createElement("option");
                    
                    // SÉCURITÉ REPRISE DE VALEUR : si id_station est vide, on prend le nom comme identifiant
                    option.value = fav.id_station || fav.nom_station; 
                    
                    // Stockage des données critiques
                    option.dataset.prixActuel = fav.dernier_prix || 1.850; 
                    option.dataset.nom = fav.nom_station || "Station Carburant";
                    
                    option.textContent = `${fav.nom_station || "Station"} (${fav.ville || "Inconnue"})`;
                    selectStation.appendChild(option);
                });
                console.log(`${favoris.length} stations injectées avec succès dans le sélecteur.`);
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
    // 3. L'ALGORITHME DE PRÉDICTION HORAIRE (LABORATOIRE)
    // ==========================================
    function genererCourbePredictive(prixActuel, stationId) {
        let pointsGraphique = [];
        let labelsHeures = [];
        let heureActuelle = new Date();

        const profilHoraireEnseigne = {
            0: -0.015, 1: -0.015, 2: -0.018, 3: -0.020, 4: -0.022, 5: -0.010,
            6: 0.000,  7: 0.005,  8: 0.008,  9: 0.004,  10: 0.002, 11: 0.005,
            12: 0.012, 13: 0.010, 14: 0.005, 15: 0.003, 16: 0.006, 17: 0.014,
            18: 0.018, 19: 0.010, 20: 0.002, 21: -0.005, 22: -0.010, 23: -0.012
        };

        for (let i = 0; i < 24; i++) {
            let heureFuture = new Date(heureActuelle.getTime() + (i * 60 * 60 * 1000));
            let h = heureFuture.getHours();

            let coefficient = profilHoraireEnseigne[h] || 0;
            let prixPredit = parseFloat(prixActuel) + coefficient;

            let labelHeure = heureFuture.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            
            labelsHeures.push(labelHeure);
            pointsGraphique.push(prixPredit.toFixed(3));
        }

        return { labels: labelsHeures, data: pointsGraphique };
    }

    // ==========================================
    // 4. MOTEUR D'AFFICHAGE ET DESIGN DU GRAPHIQUE (CHART.JS)
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
                    label: `Estimation du prix (${nomStation})`,
                    data: data,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.05)',
                    borderWidth: 3,
                    pointBackgroundColor: '#22c55e',
                    pointRadius: 4,
                    tension: 0.4,
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
                        ticks: { color: '#9ca3af', font: { family: 'Plus Jakarta Sans' } }
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
        
        // Sécurité assouplie : On vérifie juste qu'une option existe
        if (!optionSelectionnee || optionSelectionnee.value === "") {
            console.log("Sélection neutre ou vide détectée.");
            return;
        }

        const prixBrut = optionSelectionnee.dataset.prixActuel || 1.850;
        const nomStation = optionSelectionnee.dataset.nom || "Station";
        const idStation = optionSelectionnee.value;

        console.log(`🎯 Cible activée : ${nomStation} | Prix base : ${prixBrut} €`);

        // Calcul des prévisions
        const previsions = genererCourbePredictive(prixBrut, idStation);

        // Tracé du graphique
        try {
            mettreAJourGraphique(previsions.labels, previsions.data, nomStation);
            console.log("📊 Graphique généré avec succès !");
        } catch (chartError) {
            console.error("Erreur Chart.js :", chartError.message);
        }
    });

    // Initialisation
    await chargerStationsFavorites();
});
