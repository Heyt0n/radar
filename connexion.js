// ==========================================
// GESTION DU MODAL DE CONNEXION (PC & MOBILE)
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Injecter les styles CSS responsive
    injecterStylesCSS();

    // 2. Vérifier la session Supabase
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

    // 3. Non connecté : on injecte la boîte de connexion
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

        .btn-secondary {
            width: 100%;
            padding: 0.85rem;
            background-color: transparent;
            border: 1px solid #283548;
            border-radius: 8px;
            color: #94a3b8;
            font-weight: 600;
            font-size: 0.85rem;
            letter-spacing: 0.5px;
            cursor: pointer;
            margin-top: 0.75rem;
            text-transform: uppercase;
            transition: background-color 0.2s, color 0.2s;
        }

        .btn-secondary:hover {
            background-color: #161f30;
            color: #ffffff;
        }

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
    // Si la modal existe déjà dans le DOM HTML, on s'assure juste qu'elle est visible
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
                    <input type="password" id="input-password" required placeholder="••••••••">
                  </div>
                  
                  <button type="submit" id="btn-submit" class="btn-primary">SE CONNECTER</button>
                  <button type="button" id="btn-guest" class="btn-secondary">PASSER L'ÉTAPE (INVITÉ)</button>
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

    // Bouton Invité
    const btnGuest = document.getElementById("btn-guest");
    if (btnGuest) {
        btnGuest.onclick = () => {
            const overlay = document.getElementById("modal-auth-overlay");
            if (overlay) overlay.classList.add("hidden");
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

                if (modeInscription) {
                    if (authTitle) authTitle.textContent = "INSCRIPTION";
                    if (authSubtitle) authSubtitle.textContent = "Créez votre profil d'opérateur";
                    if (btnSubmit) btnSubmit.textContent = "CRÉER MON COMPTE";
                    if (groupPseudo) groupPseudo.classList.remove("hidden");
                    const inputPseudo = document.getElementById("input-pseudo");
                    if (inputPseudo) inputPseudo.required = true;
                    toggleText.innerHTML = `Déjà un compte ? <span id="toggle-link">Se connecter</span>`;
                } else {
                    if (authTitle) authTitle.textContent = "CONNEXION";
                    if (authSubtitle) authSubtitle.textContent = "Accédez à votre terminal de ciblage";
                    if (btnSubmit) btnSubmit.textContent = "SE CONNECTER";
                    if (groupPseudo) groupPseudo.classList.add("hidden");
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

                    alert("Compte créé avec succès ! Tu peux maintenant te connecter.");
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
