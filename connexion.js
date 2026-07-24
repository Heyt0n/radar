// ==========================================
// GESTION DE L'ACCÈS AVEC LE MOTEUR SUPABASE
// ==========================================
let modeInscription = false;

document.addEventListener("DOMContentLoaded", async () => {
    
    // 1. VÉRIFICATION DE LA SESSION EXISTANTE
    try {
        if (typeof _supabase !== 'undefined') {
            const { data: { session } } = await _supabase.auth.getSession();
            if (session) {
                localStorage.setItem("radar_session_active", "true");
                window.location.href = "index.html";
                return;
            }
        }
    } catch (e) {
        console.warn("Vérification session ignorée :", e);
    }

    // Récupération des éléments du DOM
    const authForm = document.getElementById("auth-form");
    const authTitle = document.getElementById("auth-title");
    const authSubtitle = document.getElementById("auth-subtitle");
    const groupPseudo = document.getElementById("group-pseudo");
    const btnSubmit = document.getElementById("btn-submit");
    const btnSkip = document.getElementById("btn-skip");
    const toggleText = document.getElementById("toggle-text");

    // 2. BASCULEMENT CONNEXION <=> INSCRIPTION
    if (toggleText) {
        toggleText.addEventListener("click", (e) => {
            if (e.target && e.target.id === "toggle-link") {
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
            }
        });
    }

    // 3. ACTION PRINCIPALE : INSCRIPTION OU CONNEXION
    if (authForm) {
        authForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const email = document.getElementById("input-email").value.trim();
            const password = document.getElementById("input-password").value;

            if (modeInscription) {
                const pseudo = document.getElementById("input-pseudo").value.trim();
                btnSubmit.textContent = "Création du profil...";
                btnSubmit.disabled = true;

                // --- MODE INSCRIPTION ---
                const { data, error } = await _supabase.auth.signUp({
                    email: email,
                    password: password,
                    options: {
                        data: { display_name: pseudo }
                    }
                });

                btnSubmit.disabled = false;

                if (error) {
                    alert(`Erreur d'inscription : ${error.message}`);
                    btnSubmit.textContent = "Créer mon compte";
                    return;
                }

                localStorage.setItem("radar_pseudo", pseudo);
                alert("Compte créé avec succès ! Tu peux maintenant te connecter.");
                
                // On bascule automatiquement sur l'affichage Connexion
                document.getElementById("toggle-link").click();
                btnSubmit.textContent = "Se connecter";
                return; // STOP ICI : On ne tente pas la connexion directe
            }

            // --- MODE CONNEXION ---
            btnSubmit.textContent = "Connexion en cours...";
            btnSubmit.disabled = true;

            const { data: signInData, error: signInError } = await _supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            btnSubmit.disabled = false;

            if (signInError) {
                alert(`Erreur d'identification : ${signInError.message}`);
                btnSubmit.textContent = "Se connecter";
                return;
            }

            // Succès de la connexion
            const userPseudo = signInData.user.user_metadata?.display_name || "Opérateur";
            localStorage.setItem("radar_pseudo", userPseudo);
            localStorage.setItem("radar_session_active", "true");
            
            window.location.href = "index.html";
        });
    }

    // 4. MODE INVITÉ
    if (btnSkip) {
        btnSkip.addEventListener("click", () => {
            localStorage.setItem("radar_session_active", "true");
            localStorage.setItem("radar_pseudo", "Invité");
            window.location.href = "index.html";
        });
    }
});
