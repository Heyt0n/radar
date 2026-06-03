document.addEventListener("DOMContentLoaded", async () => {
    let instanceGraphique = null;

    // Éléments HTML
    const nomOperateurBadge = document.getElementById("nom-operateur");
    const selectStation = document.getElementById("select-station-outils");
    const graphiqueElem = document.getElementById("graphiquePrevisionnel");
    
    // Sécurité : Si le canvas du graphique n'existe pas sur cette page, on stoppe proprement
    if (!graphiqueElem) {
        console.error("Élément 'graphiquePrevisionnel' introuvable dans le HTML.");
        return;
    }
    const ctx = graphiqueElem.getContext("2d");

    // Sécurité : Si le sélecteur n'existe pas, on stoppe pour éviter de faire planter le reste
    if (!selectStation) {
        console.error("Élément 'select-station-outils' introuvable dans le HTML. Vérifie ton ID !");
        return;
    }

    // ==========================================
    // 1. SÉCURITÉ & RÉCUPÉRATION DU PSEUDO (Synchronisé via _supabase)
    // ==========================================
    const { data: { session }, error: sessionError } = await _supabase.auth.getSession();

    if (sessionError || !session) {
        console.log("Session cloud absente. Redirection vers la page de connexion...");
        window.location.href = "connexion.html";
        return;
    }

    // Affichage du pseudo dans le menu ou sur l'interface
    if (nomOperateurBadge && session.user.user_metadata) {
        const pseudo = session.user.user_metadata.display_name || session.user.user_metadata.pseudo || "Opérateur";
        nomOperateurBadge.textContent = pseudo;
    }

    // ==========================================
    // 2. RÉCUPÉRATION DES STATIONS FAVORITES SINCE CLOUD
    // ==========================================
    async function chargerStationsFavorites() {
        try {
            // Nettoyage préalable du sélecteur
            selectStation.innerHTML = '<option value="" selected disabled>-- Sélectionne une station cible --</option>';

            const { data: favoris, error } = await _supabase
                .from("stations_favorites") // Cible la nouvelle table parfaitement configurée
                .select("*")
                .eq("user_id", session.user.id);

            if (error) throw error;

            if (favoris && favoris.length > 0) {
                favoris.forEach(fav => {
                    const option = document.createElement("option");
                    option.value = fav.id_station; // L'ID unique de la station
                    
                    // On stocke les métadonnées directement dans l'option pour l'algorithme
                    option.dataset.prixActuel = fav.dernier_prix || 1.850; 
                    option.dataset.nom = fav.nom_station || "Station Carburant";
                    
                    option.textContent = `${fav.nom_station || "Station"} (${fav.ville || "Inconnue"})`;
                    selectStation.appendChild(option);
                });
                console.log(`${favoris.length} stations chargées dans le menu outils.`);
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

        // Profil comportemental type : modélise les spreads de prix selon l'heure (H24)
        const profilHoraireEnseigne = {
            0: -0.015, 1: -0.015, 2: -0.018, 3: -0.020, 4: -0.022, 5: -0.010,
            6: 0.000,  7: 0.005,  8: 0.008,  9: 0.004,  10: 0.002, 11: 0.005,
            12: 0.012, 13: 0.010, 14: 0.005, 15: 0.003, 16: 0.006, 17: 0.014,
            18: 0.018, 19: 0.010, 20: 0.002, 21: -0.005, 22: -0.010, 23: -0.012
        };

        // Boucle prévisionnelle sur les 24 prochaines heures
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
                    borderColor: '#3b82f6', // Bleu tactique
                    backgroundColor: 'rgba(59, 130, 246, 0.05)',
                    borderWidth: 3,
                    pointBackgroundColor: '#22c55e', // Points "pings" radars verts
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
        
        if (!optionSelectionnee || !optionSelectionnee.value) return;

        const prixBrut = optionSelectionnee.dataset.prixActuel;
        const nomStation = optionSelectionnee.dataset.nom;
        const idStation = optionSelectionnee.value;

        // Déclenchement de la simulation prédictive
        const previsions = genererCourbePredictive(prixBrut, idStation);

        // Rendu graphique immédiat
        mettreAJourGraphique(previsions.labels, previsions.data, nomStation);
    });

    // Initialisation synchrone de la base de données
    await chargerStationsFavorites();
});
