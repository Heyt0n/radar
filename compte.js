// ============================================================================
// CONTROLE DU MENU BURGER (UNIFIÉ TACTILE & CLIC)
// ============================================================================
function toggleBurgerMenu() {
    const menu = document.getElementById('burgerMenu');
    const overlay = document.getElementById('menuOverlay');
    if (menu && overlay) {
        menu.classList.toggle('open');
        overlay.classList.toggle('active');
    }
}

// ============================================================================
// ENGINE DE GESTION DU COMPTE ET SYNCHRONISATION SUPABASE
// ============================================================================
document.addEventListener("DOMContentLoaded", async () => {
    
    // --- 1. ATTACHE DES ÉCOUTEURS DU MENU BURGER ---
    const burgerBtn = document.querySelector('.burger-btn');
    const menuOverlay = document.getElementById('menuOverlay');

    if (burgerBtn) {
        burgerBtn.addEventListener('click', toggleBurgerMenu);
        burgerBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            toggleBurgerMenu();
        }, { passive: false });
    }

    if (menuOverlay) {
        menuOverlay.addEventListener('click', toggleBurgerMenu);
    }

    // --- 2. SYNCHRONISATION DU STATUT DES FAVORIS LOCAUX ---
    let favorisLocaux = [];
    try {
        favorisLocaux = JSON.parse(localStorage.getItem('radar_favoris')) || [];
    } catch (err) {
        console.error("Erreur de parsing des favoris locaux :", err);
    }
    
    const badgeCount = document.getElementById('favoris-count');
    if (badgeCount) {
        badgeCount.textContent = `${favorisLocaux.length} Cible${favorisLocaux.length > 1 ? 's' : ''}`;
    }

    // --- 3. SÉCURITÉ, VÉRIFICATION DE LA SESSION ET INTEGRATION CLOUD ---
    try {
        // Vérification de la session active via l'instance globale _supabase
        const { data: { session }, error: sessionError } = await _supabase.auth.getSession();

        if (sessionError || !session) {
            console.log("Aucune session active trouvée. Redirection vers connexion...");
            localStorage.setItem("radar_session_active", "false");
            window.location.href = "connexion.html";
            return;
        }

        // Récupération des métadonnées utilisateur
        const metadata = session.user.user_metadata || {};
        const pseudoUtilisateur = metadata.display_name || metadata.pseudo || "Opérateur Connecté";

        // Mise à jour des badges d'affichage (Panneau latéral et Widget Central)
        const badgeOperateur = document.getElementById("nom-operateur");
        if (badgeOperateur) badgeOperateur.textContent = pseudoUtilisateur;

        const nomUtilisateurCompte = document.getElementById("nom-utilisateur-compte");
        if (nomUtilisateurCompte) nomUtilisateurCompte.textContent = pseudoUtilisateur;

        // Pré-remplissage du champ Input de configuration
        const inputPseudo = document.getElementById('user-pseudo');
        if (inputPseudo) {
            inputPseudo.value = pseudoUtilisateur;
        }

        // Récupération et formatage de la date de création de compte
        const dateElement = document.getElementById("account-created");
        if (dateElement && session.user.created_at) {
            const rawDate = new Date(session.user.created_at);
            const formattedDate = rawDate.toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
            dateElement.textContent = formattedDate;
        }

        // Si l'utilisateur est connecté, écraser le compteur local par le nombre de favoris Supabase
        const { data: cloudFavs, error: favsError } = await _supabase.from('favoris').select('id');
        if (!favsError && cloudFavs && badgeCount) {
            badgeCount.textContent = `${cloudFavs.length} Cible${cloudFavs.length > 1 ? 's' : ''}`;
        }

    } catch (globalError) {
        console.error("Erreur d'initialisation système :", globalError);
        const dateElement = document.getElementById("account-created");
        if (dateElement) dateElement.textContent = "Erreur de connexion";
    }

    // --- 4. ÉCOUTEUR DE SOUVEGARDE DES CONFIGURATIONS PROFIL ---
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', sauvegarderProfilCloud);
    }

    // --- 5. LOGIQUE DE DÉCONNEXION CLOUD ---
    const btnDeconnexion = document.getElementById("btn-deconnexion");
    if (btnDeconnexion) {
        btnDeconnexion.addEventListener("click", async (e) => {
            e.preventDefault();
            try {
                const { error } = await _supabase.auth.signOut();
                if (error) throw error;

                localStorage.setItem("radar_session_active", "false");
                alert("Déconnexion réussie. Fermeture de la session tactique.");
                window.location.href = "connexion.html"; 
            } catch (err) {
                console.error("Erreur lors de la déconnexion :", err.message);
                alert("Erreur système lors de la déconnexion : " + err.message);
            }
        });
    }
});

// ============================================================================
// SAUVEGARDE DU PSEUDO EN CLOUD (SUPABASE METADATA)
// ============================================================================
async function sauvegarderProfilCloud(event) {
    event.preventDefault();
    const inputPseudo = document.getElementById('user-pseudo');
    if (!inputPseudo) return;

    const nouveauPseudo = inputPseudo.value.trim();
    if (!nouveauPseudo) {
        alert("Le pseudo ne peut pas être vide.");
        return;
    }

    try {
        const { data, error } = await _supabase.auth.updateUser({
            data: { display_name: nouveauPseudo, pseudo: nouveauPseudo }
        });

        if (error) throw error;

        // Mise à jour synchrone immédiate dans l'interface
        const badgeOperateur = document.getElementById("nom-operateur");
        if (badgeOperateur) badgeOperateur.textContent = nouveauPseudo;

        const nomUtilisateurCompte = document.getElementById("nom-utilisateur-compte");
        if (nomUtilisateurCompte) nomUtilisateurCompte.textContent = nouveauPseudo;

        alert("Pseudo synchronisé sur le Cloud avec succès !");
    } catch (err) {
        console.error("Erreur lors de la mise à jour du profil :", err.message);
        alert("Échec de la mise à jour Cloud : " + err.message);
    }
}
