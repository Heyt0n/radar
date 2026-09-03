// ==========================================
// GESTION DU MODAL DE CONNEXION (PC & MOBILE)
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Injecter les styles CSS responsive
    injecterStylesCSS();

    // 2. Vérifier si un lien de réinitialisation de mot de passe a été cliqué
    if (typeof _supabase !== 'undefined') {
        _supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'PASSWORD_RECOVERY') {
                const nouveauMdp = prompt("Veuillez saisir votre nouveau mot de passe :");
                if (nouveauMdp && nouveauMdp.trim().length >= 6) {
                    const { error } = await _supabase.auth.updateUser({ password: nouveauMdp.trim() });
                    if (error) {
                        alert("Erreur lors de la mise à jour : " + error.message);
                    } else {
                        alert("Votre mot de passe a été mis à jour avec succès ! Vous pouvez maintenant vous connecter.");
                        window.location.reload();
                    }
                } else if (nouveauMdp !== null) {
                    alert("Le mot de passe doit contenir au moins 6 caractères.");
                }
            }
        });
    }

    // 3. Vérifier la session Supabase
    try {
        if (typeof _supabase !== 'undefined') {
            const { data: { session } } = await _supabase.auth.getSession();
            if (session) {
                localStorage.setItem("radar_session_active", "true");
                return; // Connecté : l'utilisateur accède à la page directement
            }
        }
    } catch (e) {
        console.warn("Vérification session ignorée :", e);
    }

    // 4. Non connecté : on injecte la boîte de connexion
    creerEtAfficherModal();
});

function injecterStylesCSS() {
    if (document.getElementById("auth-styles")) return;
    const style = document.createElement("style");
    style.id = "auth-styles";
    style.textContent = `
        /* Overlay sombre sur toute la page */
        .modal-auth-overlay {
            position: fixed;
            top: 0; left: 0;
            width: 100vw; height: 100vh;
            background-color: rgba(5, 8, 15, 0.85);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 99999;
            box-sizing: border-box;
            padding: 16px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .modal-auth-overlay.hidden { display: none !important; }

        /* Carte de connexion sombre */
        .auth-card {
            background-color: #0d131f;
            border: 1px solid #1e293b;
            border-radius: 16px;
            padding: 2.5rem 2rem;
            width: 100%;
            max-width: 420px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
            color: #ffffff;
            text-align: center;
            box-sizing: border-box;
        }

        .auth-card h2 {
            font-size: 1.4rem;
            font-weight: 800;
            letter-spacing: 1.5px;
            margin: 0 0 0.4rem 0;
            color: #ffffff;
            text-transform: uppercase;
        }

        .auth-card p.subtitle {
            color: #94a3b8;
            font-size: 0.875rem;
            margin: 0 0 1.8rem 0;
        }

        .input-group {
            text-align: left;
            margin-bottom: 1.2rem;
        }

        .input-group label {
            display: block;
            font-size: 0.725rem;
            font-weight: 700;
            color: #94a3b8;
            margin-bottom: 0.4rem;
            letter-spacing: 0.8px;
            text-transform: uppercase;
        }

        .input-group input {
            width: 100%;
            padding: 0.85rem 1rem;
            background-color: #161f30;
            border: 1px solid #283548;
            border-radius: 8px;
            color: #ffffff;
            font-size: 0.95rem;
            box-sizing: border-box;
            outline: none;
            transition: border-color 0.2s, box-shadow 0.2s;
        }

        .input-group input:focus {
            border-color: #3b82f6;
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
        }

        /* Conteneur avec bouton Oeil */
        .password-wrapper {
            position: relative;
            display: flex;
            align-items: center;
        }

        .password-wrapper input {
            padding-right: 2.8rem; /* Espace pour ne pas superposer le texte avec l'icône */
        }

        .toggle-password-btn {
            position: absolute;
            right: 0.8rem;
            background: none;
            border: none;
            cursor: pointer;
            color: #94a3b8;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: color 0.2s;
        }

        .toggle-password-btn:hover {
            color: #3b82f6;
        }

        .toggle-password-btn svg {
            width: 20px;
            height: 20px;
            fill: currentColor;
        }

        .forgot-password-container {
            text-align: right;
            margin-top: 0.4rem;
            margin-bottom: 1.2rem;
        }

        .forgot-password-link {
            color: #94a3b8;
            font-size: 0.78rem;
            text-decoration: none;
            cursor: pointer;
            transition: color 0.2s;
        }

        .forgot-password-link:hover {
            color: #3b82f6;
            text-decoration: underline;
        }

        .btn-primary {
            width: 100%;
            padding: 0.85rem;
            background-color: #3b82f6;
            border: none;
            border-radius: 8px;
            color: #ffffff;
            font-weight: 700;
            font-size: 0.9rem;
            letter-spacing: 0.5px;
            cursor: pointer;
            margin-top: 0.6rem;
            text-transform: uppercase;
            transition: background-color 0.2s;
        }

        .btn-primary:hover { background-color: #2563eb; }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

        .auth-footer {
            margin-top: 1.5rem;
            font-size: 0.875rem;
            color: #94a3b8;
        }

        #toggle-link {
            color: #3b82f6;
            cursor: pointer;
            font-weight: 600;
            text-decoration: none;
        }

        #toggle-link:hover { text-decoration: underline; }
        .hidden { display: none !important; }
    `;
    document.head.appendChild(style);
}

function creerEtAfficherModal() {
    let overlay = document.getElementById("modal-auth-overlay");
    
    if (!overlay) {
        const modalHTML = `
            <div id="modal-auth-overlay" class="modal-auth-overlay">
              <div class="auth-card">
                <h2 id="auth-title">CONNEXION</h2>
                <p id="auth-subtitle" class="subtitle">Accédez à votre terminal de ciblage</p>
                
                <form id="auth-form" onsubmit="return false;">
                  <div id="group-pseudo" class="input-group hidden">
                    <label for="input-pseudo">PSEUDO</label>
                    <input type="text" id="input-pseudo" placeholder="Ex: Chasseur01">
                  </div>
                  
                  <div class="input-group">
                    <label for="input-email">ADRESSE EMAIL</label>
                    <input type="email" id="input-email" required placeholder="operateur@radar.com">
                  </div>
                  
                  <div class="input-group">
                    <label for="input-password">MOT DE PASSE</label>
                    <div class="password-wrapper">
                      <input type="password" id="input-password" required placeholder="••••••••">
                      <button type="button" id="btn-toggle-password" class="toggle-password-btn" aria-label="Afficher le mot de passe">
                        <!-- Icône Oeil Ouvert (par défaut) -->
                        <svg id="eye-icon-open" viewBox="0 0 24 24">
                          <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                        </svg>
                        <!-- Icône Oeil Barré (masquée au départ) -->
                        <svg id="eye-icon-closed" class="hidden" viewBox="0 0 24 24">
                          <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.44-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.17c0-1.66-1.34-3-3-3l-.17.02z"/>
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div id="forgot-password-box" class="forgot-password-container">
                    <span id="btn-forgot-password" class="forgot-password-link">Mot de passe oublié ?</span>
                  </div>
                  
                  <button type="submit" id="btn-submit" class="btn-primary">SE CONNECTER</button>
                </form>
                
                <p id="toggle-text" class="auth-footer">
                  Pas encore de compte ? <span id="toggle-link">Créer un profil</span>
                </p>
              </div>
            </div>
        `;
        document.body.insertAdjacentHTML("beforeend", modalHTML);
    } else {
        overlay.classList.remove("hidden");
    }

    attacherEvenementsModal();
}

function attacherEvenementsModal() {
    let modeInscription = false;

    // Basculer la visibilité du mot de passe
    const btnTogglePassword = document.getElementById("btn-toggle-password");
    if (btnTogglePassword) {
        btnTogglePassword.onclick = () => {
            const passwordInput = document.getElementById("input-password");
            const eyeOpen = document.getElementById("eye-icon-open");
            const eyeClosed = document.getElementById("eye-icon-closed");

            if (passwordInput && eyeOpen && eyeClosed) {
                const estMasque = passwordInput.type === "password";
                passwordInput.type = estMasque ? "text" : "password";

                // Basculer l'affichage des icônes SVG
                eyeOpen.classList.toggle("hidden", estMasque);
                eyeClosed.classList.toggle("hidden", !estMasque);
            }
        };
    }

    // Mot de passe oublié
    const btnForgot = document.getElementById("btn-forgot-password");
    if (btnForgot) {
        btnForgot.onclick = async () => {
            const emailInput = document.getElementById("input-email");
            let email = emailInput ? emailInput.value.trim() : "";

            if (!email) {
                email = prompt("Veuillez saisir votre adresse e-mail pour recevoir le lien de réinitialisation :");
            }

            if (!email || !email.trim()) return;

            try {
                const { error } = await _supabase.auth.resetPasswordForEmail(email.trim(), {
                    redirectTo: window.location.origin + window.location.pathname
                });

                if (error) throw error;

                alert("📩 Un e-mail de réinitialisation vient de vous être envoyé. Vérifiez votre boîte de réception !");
            } catch (err) {
                alert("Erreur lors de l'envoi : " + (err.message || "Impossible de traiter la demande."));
            }
        };
    }

    // Bascule Connexion / Inscription
    const toggleText = document.getElementById("toggle-text");
    if (toggleText) {
        toggleText.onclick = (e) => {
            if (e.target && e.target.id === "toggle-link") {
                modeInscription = !modeInscription;
                const authTitle = document.getElementById("auth-title");
                const authSubtitle = document.getElementById("auth-subtitle");
                const groupPseudo = document.getElementById("group-pseudo");
                const btnSubmit = document.getElementById("btn-submit");
                const forgotBox = document.getElementById("forgot-password-box");

                if (modeInscription) {
                    if (authTitle) authTitle.textContent = "INSCRIPTION";
                    if (authSubtitle) authSubtitle.textContent = "Créez votre profil d'opérateur";
                    if (btnSubmit) btnSubmit.textContent = "CRÉER MON COMPTE";
                    if (groupPseudo) groupPseudo.classList.remove("hidden");
                    if (forgotBox) forgotBox.classList.add("hidden");
                    
                    const inputPseudo = document.getElementById("input-pseudo");
                    if (inputPseudo) inputPseudo.required = true;
                    toggleText.innerHTML = `Déjà un compte ? <span id="toggle-link">Se connecter</span>`;
                } else {
                    if (authTitle) authTitle.textContent = "CONNEXION";
                    if (authSubtitle) authSubtitle.textContent = "Accédez à votre terminal de ciblage";
                    if (btnSubmit) btnSubmit.textContent = "SE CONNECTER";
                    if (groupPseudo) groupPseudo.classList.add("hidden");
                    if (forgotBox) forgotBox.classList.remove("hidden");
                    
                    const inputPseudo = document.getElementById("input-pseudo");
                    if (inputPseudo) inputPseudo.required = false;
                    toggleText.innerHTML = `Pas encore de compte ? <span id="toggle-link">Créer un profil</span>`;
                }
            }
        };
    }

    // Soumission du Formulaire
    const authForm = document.getElementById("auth-form");
    if (authForm) {
        authForm.onsubmit = async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const emailInput = document.getElementById("input-email");
            const passwordInput = document.getElementById("input-password");
            const btnSubmit = document.getElementById("btn-submit");

            if (!emailInput || !passwordInput) return;

            const email = emailInput.value.trim();
            const password = passwordInput.value;

            if (!email || !password) {
                alert("Veuillez remplir tous les champs.");
                return;
            }

            if (btnSubmit) {
                btnSubmit.disabled = true;
                btnSubmit.textContent = "PATIENTEZ...";
            }

            try {
                if (modeInscription) {
                    const pseudoInput = document.getElementById("input-pseudo");
                    const pseudo = pseudoInput ? pseudoInput.value.trim() : "Opérateur";

                    const { data, error } = await _supabase.auth.signUp({
                        email: email,
                        password: password,
                        options: { data: { display_name: pseudo } }
                    });

                    if (error) throw error;

                    if (data.user && !data.session) {
                        alert("📧 Compte créé ! Un e-mail de confirmation vous a été envoyé. Veuillez valider votre adresse avant de vous connecter.");
                    } else {
                        alert("Compte créé avec succès ! Tu peux maintenant te connecter.");
                    }

                    const toggleLink = document.getElementById("toggle-link");
                    if (toggleLink) toggleLink.click();

                } else {
                    // MODE CONNEXION
                    const { data, error } = await _supabase.auth.signInWithPassword({
                        email: email,
                        password: password
                    });

                    if (error) throw error;

                    // Succès : Masquer la modal et rafraîchir
                    const overlay = document.getElementById("modal-auth-overlay");
                    if (overlay) overlay.classList.add("hidden");
                    window.location.reload();
                }
            } catch (err) {
                alert("Erreur : " + (err.message || "Impossible de se connecter"));
            } finally {
                if (btnSubmit) {
                    btnSubmit.disabled = false;
                    btnSubmit.textContent = modeInscription ? "CRÉER MON COMPTE" : "SE CONNECTER";
                }
            }
        };
    }
}
