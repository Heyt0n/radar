// ==========================================
// CONFIGURATION ET ÉTAT DE LA PAGE
// ==========================================
let modeInscription = false;

document.addEventListener("DOMContentLoaded", () => {
    // 1. ANCHOR : Sécurité et Redirection automatique
    // Si l'utilisateur est déjà connecté ou a déjà choisi le mode invité, on l'envoie sur la carte
    const sessionActive = localStorage.getItem("radar_session_active");
    if (sessionActive === "true") {
        window.location.href = "index.html";
        return; // Stoppe le script ici
    }

    // Éléments du DOM
    const authForm = document.getElementById("auth-form");
    const authTitle = document.getElementById("auth-title");
    const authSubtitle = document.getElementById("auth-subtitle");
    const groupPseudo = document.getElementById("group-pseudo");
    const btnSubmit = document.getElementById("btn-submit");
    const btnSkip = document.getElementById("btn-skip");
    const toggleLink = document.getElementById("toggle-link");
    const toggleText = document.getElementById("toggle-text");

    // 2. GESTION DU BASCULEMENT (CONNEXION <=> INSCRIPTION)
    toggleLink.addEventListener("click", () => {
        modeInscription = !modeInscription;

        if (modeInscription) {
            authTitle.textContent = "Inscription";
            authSubtitle.textContent = "Créez votre profil d'opérateur local";
            btnSubmit.textContent = "Créer mon compte";
            groupPseudo.classList.remove("hidden");
            document.getElementById("input-pseudo").required = true;
            toggleText.innerHTML = `Déjà inscrit ? <span id='toggle-link'>Se connecter</span>`;
        } else {
            authTitle.textContent = "Connexion";
            authSubtitle.textContent = "Accédez à votre terminal de ciblage";
            btnSubmit.textContent = "Se connecter";
            groupPseudo.classList.add("hidden");
            document.getElementById("input-pseudo").required = false;
            toggleText.innerHTML = `Pas encore de compte ? <span id='toggle-link'>Créer un profil</span>`;
        }

        // Réattacher l'écouteur sur le nouveau lien généré dynamiquement
        document.getElementById("toggle-link").addEventListener("click", arguments.callee);
    });

    // 3. LOGIQUE DE SOUMISSION (SIMULATION POUR INSTANT)
    authForm.addEventListener("submit", (e) => {
        e.preventDefault();

        const email = document.getElementById("input-email").value.trim();
        const password = document.getElementById("input-password").value;
        
        if (modeInscription) {
            const pseudo = document.getElementById("input-pseudo").value.trim();
            // Simulation d'inscription : on enregistre son pseudo directement dans le profil
            localStorage.setItem("radar_pseudo", pseudo);
            alert(`Profil ${pseudo} créé avec succès en local !`);
        }

        // On active la session pour qu'il n'ait plus jamais à repasser par ici
        localStorage.setItem("radar_session_active", "true");
        window.location.href = "index.html";
    });

    // 4. BOUTON SKIP / MODE INVITÉ
    btnSkip.addEventListener("click", () => {
        // On marque la session active même en invité pour ne plus afficher cette page
        localStorage.setItem("radar_session_active", "true");
        localStorage.setItem("radar_pseudo", "Invité");
        window.location.href = "index.html";
    });
});
