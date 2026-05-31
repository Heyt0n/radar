// ==========================================
// GESTION DE L'ACCÈS AVEC LE MOTEUR SUPABASE
// ==========================================
let modeInscription = false;

document.addEventListener("DOMContentLoaded", async () => {
    
    // 1. VÉRIFICATION DE LA VRAIE SESSION LIVE
    // Supabase va vérifier si l'utilisateur est déjà connecté en ligne
    const { data: { session } } = await _supabase.auth.getSession();
    
    if (session) {
        // Si une session active existe, on valide en local et on redirige sans attendre
        localStorage.setItem("radar_session_active", "true");
        window.location.href = "index.html";
        return;
    }

    // Récupération des éléments du DOM
    const authForm = document.getElementById("auth-form");
    const authTitle = document.getElementById("auth-title");
    const authSubtitle = document.getElementById("auth-subtitle");
    const groupPseudo = document.getElementById("group-pseudo");
    const btnSubmit = document.getElementById("btn-submit");
    const btnSkip = document.getElementById("btn-skip");
    const toggleLink = document.getElementById("toggle-link");
    const toggleText = document.getElementById("toggle-text");

    // 2. BASCULEMENT CONNEXION <=> INSCRIPTION
    if (toggleLink) {
        toggleLink.addEventListener("click", function handleToggle() {
            modeInscription = !modeInscription;

            if (modeInscription) {
                authTitle.textContent = "Inscription";
                authSubtitle.textContent = "Créez votre profil d'opérateur en ligne";
                btnSubmit.textContent = "Créer mon compte";
                groupPseudo.classList.remove("hidden");
                document.getElementById("input-pseudo").required = true;
                toggleText.innerHTML = `Déjà inscrit ? <span id="toggle-link">Se connecter</span>`;
            } else {
                authTitle.textContent = "Connexion";
                authSubtitle.textContent = "Accédez à votre terminal de ciblage";
                btnSubmit.textContent = "Se connecter";
                groupPseudo.classList.add("hidden");
                document.getElementById("input-pseudo").required = false;
                toggleText.innerHTML = `Pas encore de compte ? <span id="toggle-link">Créer un profil</span>`;
            }
            // Réattacher proprement l'événement sur le nouveau lien généré
            document.getElementById("toggle-link").addEventListener("click", handleToggle);
        });
    }

    // 3. ACTION PRINCIPALE : CONNEXION OU INSCRIPTION REELLE
    authForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("input-email").value.trim();
        const password = document.getElementById("input-password").value;

        if (modeInscription) {
            const pseudo = document.getElementById("input-pseudo").value.trim();
            
            // INSCRIPTION SUR SUPABASE
            const { data, error } = await _supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: { display_name: pseudo } // On stocke le pseudo dans les métadonnées Supabase
                }
            });

            if (error) {
                alert(`Erreur d'inscription : ${error.message}`);
                return;
            }

            localStorage.setItem("radar_pseudo", pseudo);
            alert("Compte créé avec succès dans le Cloud ! Connexion en cours...");
        }

        // CONNEXION SUR SUPABASE
        const { data: signInData, error: signInError } = await _supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (signInError) {
            alert(`Erreur d'identification : ${signInError.message}`);
            return;
        }

        // Si la connexion réussit : on active les verrous locaux et on fonce sur la carte
        const userPseudo = signInData.user.user_metadata.display_name || "Opérateur";
        localStorage.setItem("radar_pseudo", userPseudo);
        localStorage.setItem("radar_session_active", "true");
        
        window.location.href = "index.html";
    });

    // 4. MODE INVITÉ (PASSER L'ÉTAPE)
    btnSkip.addEventListener("click", () => {
        localStorage.setItem("radar_session_active", "true");
        localStorage.setItem("radar_pseudo", "Invité");
        window.location.href = "index.html";
    });
});
