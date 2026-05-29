// ==========================================
// CONTROL DU MENU BURGER (COMPTE.HTML)
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

    // Chargement des préférences utilisateur sauvegardées
    const pseudoSauvegarde = localStorage.getItem('radar_pseudo');
    if (pseudoSauvegarde) {
        document.getElementById('user-pseudo').value = pseudoSauvegarde;
    }
    
    const rayonSauvegarde = localStorage.getItem('radar_rayon');
    if (rayonSauvegarde) {
        document.getElementById('user-rayon').value = rayonSauvegarde;
    }

    // Écouteur pour la soumission du formulaire
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', sauvegarderProfil);
    }

    // Écouteur pour la purge des données
    const btnPurge = document.getElementById('btn-purge');
    if (btnPurge) {
        btnPurge.addEventListener('click', purgerDonnees);
    }
});

// Sauvegarde dans le localStorage partagé
function sauvegarderProfil(event) {
    event.preventDefault();
    const pseudo = document.getElementById('user-pseudo').value.trim();
    const rayon = document.getElementById('user-rayon').value;

    localStorage.setItem('radar_pseudo', pseudo);
    localStorage.setItem('radar_rayon', rayon);

    alert("Préférences enregistrées avec succès !");
}

// Purge complète de la session
function purgerDonnees() {
    if (confirm("Êtes-vous sûr de vouloir supprimer vos favoris et configurations ? Cette action est irréversible.")) {
        localStorage.clear();
        alert("Données effacées.");
        window.location.reload();
    }
}
