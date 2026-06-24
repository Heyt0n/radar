// ==========================================
// CONTROLE DU MENU BURGER (COMPTE.HTML)
// ==========================================
function toggleBurgerMenu() {
    const menu = document.getElementById('burgerMenu');
    const overlay = document.getElementById('menuOverlay');
    if (menu && overlay) {
        menu.classList.toggle('open');
        overlay.classList.toggle('active');
    }
}

// ==========================================
// GESTION DES DONNÉES DU COMPTE
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    // Écouteurs pour le menu burger
    const burgerBtn = document.getElementById('burgerBtn');
    const menuOverlay = document.getElementById('menuOverlay');
    
    if (burgerBtn) burgerBtn.addEventListener('click', toggleBurgerMenu);
    if (menuOverlay) menuOverlay.addEventListener('click', toggleBurgerMenu);

    // Synchronisation du nombre de favoris depuis index.html
    const favoris = JSON.parse(localStorage.getItem('radar_favoris')) || [];
    const badgeCount = document.getElementById('favoris-count');
    if (badgeCount) {
        badgeCount.textContent = `${favoris.length} Cible${favoris.length > 1 ? 's' : ''}`;
    }

    // Chargement du pseudo sauvegardé localement
    const pseudoSauvegarde = localStorage.getItem('radar_pseudo');
    if (pseudoSauvegarde && document.getElementById('user-pseudo')) {
        document.getElementById('user-pseudo').value = pseudoSauvegarde;
    }

    // Écouteur pour la soumission du formulaire
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', sauvegarderProfil);
    }
});

// Sauvegarde du pseudo local
function sauvegarderProfil(event) {
    event.preventDefault();
    const pseudo = document.getElementById('user-pseudo').value.trim();
    localStorage.setItem('radar_pseudo', pseudo);
    alert("Pseudo enregistré avec succès !");
}

// ==========================================
// SÉCURITÉ & CONNEXION SUPABASE
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
    
    // 1. VÉRIFICATION DE LA SESSION ACTIVE
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
        console.log("Aucune session active trouvée. Redirection...");
        window.location.href = "connexion.html";
        return;
    }

    // Affichage dynamique du Pseudo Supabase
    const nomUtilisateur = document.getElementById("nom-utilisateur-compte");
    if (nomUtilisateur && session.user.user_metadata) {
        nomUtilisateur.textContent = session.user.user_metadata.pseudo || "Opérateur Connecté";
    }

    // Traitement et affichage de la date de création du compte
    const dateElement = document.getElementById("account-created");
    if (dateElement && session.user.created_at) {
        const rawDate = new Date(session.user.created_at);
        // Formatage propre : JJ/MM/AAAA
        const formattedDate = rawDate.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        dateElement.textContent = formattedDate;
    }

    // 2. LOGIQUE DE DÉCONNEXION RÉELLE
    const btnDeconnexion = document.getElementById("btn-deconnexion");
    if (btnDeconnexion) {
        btnDeconnexion.addEventListener("click", async (e) => {
            e.preventDefault();
            
            try {
                // Déconnexion complète du serveur d'authentification Supabase
                const { error } = await supabase.auth.signOut();
                if (error) throw error;

                alert("Déconnexion réussie. Fermeture de la session tactique.");
                window.location.href = "connexion.html"; 
                
            } catch (err) {
                console.error("Erreur lors de la déconnexion :", err.message);
                alert("Erreur système lors de la déconnexion : " + err.message);
            }
        });
    }
});
