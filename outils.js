document.addEventListener("DOMContentLoaded", async () => {
    let instanceGraphique = null;

    // Éléments HTML
    const nomOperateurBadge = document.getElementById("nom-operateur");
    const selectStation = document.getElementById("select-station-outils");
    const ctx = document.getElementById("graphiquePrevisionnel").getContext("2d");

    // ==========================================
    // 1. SÉCURITÉ & RÉCUPÉRATION DU PSEUDO
    // ==========================================
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
        console.log("Session absente. Redirection...");
        window.location.href = "connexion.html";
        return;
    }

    // Affichage du pseudo dans le menu burger
    if (nomOperateurBadge && session.user.user_metadata) {
        nomOperateurBadge.textContent = session.user.user_metadata.pseudo || "Opérateur";
    }

    // ==========================================
    // 2. RÉCUPÉRATION DES STATIONS FAVORITES SINCE SUPABASE
    // ==========================================
    async function chargerStationsFavorites() {
        try {
            // Remplace "stations_favorites" par le vrai nom de ta table si nécessaire
            const { data: favoris, error } = await supabase
                .from("stations_favorites")
                .select("*")
                .eq("user_id", session.user.id);

            if (error) throw error;

            if (favoris && favoris.length > 0) {
                favoris.forEach(fav => {
                    const option = document.createElement("option");
                    option.value = fav.id_station; // L'ID unique de la station
                    // On stocke le prix actuel directement dans l'attribut data pour notre formule
                    option.dataset.prixActuel = fav.dernier_prix || 1.850; 
                    option.dataset.nom = fav.nom_station || "Station Carburant";
                    option.textContent = `${fav.nom_station || "Station"} (${fav.ville || "Inconnue"})`;
                    selectStation.appendChild(option);
                });
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

        // Profil comportemental type (En attendant d'analyser l'historique massif)
        // Modélise les variations centimes d'euros selon l'heure (H24)
        // Exemple : Baisse en fin de nuit, hausse légère aux heures de pointe de midi et 18h
        const profilHoraireEnseigne = {
            0: -0.015, 1: -0.015, 2: -0.018, 3: -0.020, 4: -0.022, 5: -0.010,
            6: 0.000,  7: 0.005,  8: 0.008,  9: 0.004,  10: 0.002, 11: 0.005,
            12: 0.012, 13: 0.010, 14: 0.005, 15: 0.003, 16: 0.006, 17: 0.014,
            18: 0.018, 19: 0.010, 20: 0.002, 21: -0.005, 22: -0.010, 23: -0.012
        };

        // On boucle sur les 24 prochaines heures
        for (let i = 0; i < 24; i++) {
            let heureFuture = new Date(heureActuelle.getTime() + (i * 60 * 60 * 1000));
            let h = heureFuture.getHours();

            // Formule mathématique simplifiée : Prix de départ + coefficient de l'heure
            let coefficient = profilHoraireEnseigne[h] || 0;
            let prixPredit = parseFloat(prixActuel) + coefficient;

            // Formatage de l'heure pour l'affichage du bas (ex: "08:00")
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
        // Si un graphique existe déjà, on le détruit avant de recréer le nouveau
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
                    borderColor: '#3b82f6', // Bleu tactique
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 3,
                    pointBackgroundColor: '#22c55e', // Points verts pour l'effet radar
                    pointRadius: 4,
                    tension: 0.4, // Donne de belles courbes fluides
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false } // On masque la légende pour garder ça épuré
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
                            // Force l'affichage à 3 décimales (ex: 1.845)
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
        
        if (!optionSelectionnee.value) return;

        const prixBrut = optionSelectionnee.dataset.prixActuel;
        const nomStation = optionSelectionnee.dataset.nom;
        const idStation = optionSelectionnee.value;

        // Déclenchement de l'algorithme prédictif
        const previsions = genererCourbePredictive(prixBrut, idStation);

        // Mise à jour visuelle immédiate
        mettreAJourGraphique(previsions.labels, previsions.data, nomStation);
    });

    // Initialisation
    await chargerStationsFavorites();
});
