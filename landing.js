document.addEventListener("DOMContentLoaded", () => {
    // Gestionnaire d'action pour suivre ou animer l'entrée dans l'application principale
    const enterButtons = document.querySelectorAll('.id-btn-enter');

    enterButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            // Optionnel : Tu peux ajouter un effet de transition ou de fondu ici avant de changer de page
            console.log("Navigation vers le radar principal (index.html)...");
        });
    });

    // Effet d'apparition progressif (Fade-in) des éléments de la page d'accueil
    const heroContent = document.querySelector('.hero-content');
    const heroVisual = document.querySelector('.hero-visual');

    if (heroContent && heroVisual) {
        heroContent.style.opacity = "0";
        heroContent.style.transform = "translateX(-20px)";
        heroContent.style.transition = "all 0.8s ease-out";

        heroVisual.style.opacity = "0";
        heroVisual.style.transform = "translateY(20px)";
        heroVisual.style.transition = "all 0.8s ease-out 0.2s";

        // Déclenchement de l'animation juste après le chargement
        setTimeout(() => {
            heroContent.style.opacity = "1";
            heroContent.style.transform = "translateX(0)";
        }, 100);

        setTimeout(() => {
            heroVisual.style.opacity = "1";
            heroVisual.style.transform = "translateY(0)";
        }, 200);
    }
});
