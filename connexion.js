// ==========================================
// GESTION DU MODAL DE CONNEXION DYNAMIQUE
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Injection automatique du CSS pour le modal
    injecterStylesCSS();

    // 2. Vérification de la session Supabase
    try {
        if (typeof _supabase !== 'undefined') {
            const { data: { session } } = await _supabase.auth.getSession();
            if (session) {
                localStorage.setItem("radar_session_active", "true");
                return; // Connecté : on ne fait rien, l'utilisateur accède à la page
            }
        }
    } catch (e) {
        console.warn("Vérification session ignorée :", e);
    }

    // 3. Non connecté : on injecte et affiche la fenêtre de connexion
    creerEtAfficherModal();
});

function injecterStylesCSS() {
    if (document.getElementById("auth-styles")) return;
    const style = document.createElement("style");
    style.id = "auth-styles";
    style.textContent = `
        .modal-auth-overlay {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background-color: rgba(10, 14, 23, 0.95);
            display: flex; align-items: center; justify-content: center;
            z-index: 99999; font-family: sans-serif;
        }
        .modal-auth-overlay.hidden { display: none !important; }
        .auth-card {
            background-color: #111827; border: 1px solid #1f2937;
            border-radius: 12px; padding: 2rem; width: 90%; max-width: 380px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5); color: #ffffff; text-align: center;
        }
        .auth-card h2 { font-size: 1.2rem; font-weight: 700; letter-spacing: 1px; margin-bottom: 0.2rem; }
        .auth-card p { color: #9ca3af; font-size: 0.85rem; margin-bottom: 1.2rem; }
        .input-group { text-align: left; margin-bottom: 0.9rem; }
        .input-group label { display: block; font-size: 0.7rem; font-weight: 600; color: #9ca3af; margin-bottom: 0.3rem; letter-spacing: 0.5px; }
        .input-group input {
            width: 100%; padding: 0.65rem; background-color: #1f2937;
            border: 1px solid #374151; border-radius: 6px; color: #fff; font-size: 0.85rem; box-sizing: border-box;
        }
        .btn-primary {
            width: 100%; padding: 0.7rem; background-color: #3b82f6; border: none;
            border-radius: 6px; color: white; font-weight: 600; cursor: pointer; margin-top: 0.5rem;
        }
        .btn-secondary {
            width: 100%; padding: 0.7rem; background-color: transparent; border: 1px solid #374151;
            border-radius: 6px; color: #9ca3af; font-weight: 500; cursor: pointer; margin-top: 0.6rem;
        }
        .auth-footer { margin-top: 1rem !important; font-size: 0.8rem !important; }
        #toggle-link { color: #3b82f6; cursor: pointer; font-weight: 600; }
        .hidden { display: none !important; }
    `;
    document.head.appendChild(style);
}

function creerEtAfficherModal() {
    if (document.getElementById("modal-auth-overlay")) return;

    const modalHTML = `
        <div id="modal-auth-overlay" class="modal-auth-overlay">
          <div class="auth-card">
            <h2 id="auth-title">CONNEXION</h2>
            <p id="auth-subtitle">Accédez à votre terminal de ciblage</p>
            
            <form id="auth-form">
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
    attacherEvenementsModal();
}

function attacherEvenementsModal() {
    let modeInscription = false;

    // Bouton Invité : Ferme la fenêtre pour laisser voir la page
    document.getElementById("btn-guest").addEventListener("click", () => {
        document.getElementById("modal-auth-overlay").classList.add("hidden");
    });

    // Bascule Inscription / Connexion
    document.getElementById("toggle-text").addEventListener("click", (e) => {
        if (e.target && e.target.id === "toggle-link") {
            modeInscription = !modeInscription;
            const authTitle = document.getElementById("auth-title");
            const authSubtitle = document.getElementById("auth-subtitle");
            const groupPseudo = document.getElementById("group-pseudo");
            const btnSubmit = document.getElementById("btn-submit");

            if (modeInscription) {
                authTitle.textContent = "INSCRIPTION";
                authSubtitle.textContent = "Créez votre profil d'opérateur";
                btnSubmit.textContent = "CRÉER MON COMPTE";
                groupPseudo.classList.remove("hidden");
                document.getElementById("input-pseudo").required = true;
                document.getElementById("toggle-text").innerHTML = `Déjà un compte ? <span id="toggle-link">Se connecter</span>`;
            } else {
                authTitle.textContent = "CONNEXION";
                authSubtitle.textContent = "Accédez à votre terminal de ciblage";
                btnSubmit.textContent = "SE CONNECTER";
                groupPseudo.classList.add("hidden");
                document.getElementById("input-pseudo").required = false;
                document.getElementById("toggle-text").innerHTML = `Pas encore de compte ? <span id="toggle-link">Créer un profil</span>`;
            }
        }
    });

    // Soumission du formulaire
    document.getElementById("auth-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("input-email").value.trim();
        const password = document.getElementById("input-password").value;
        const btnSubmit = document.getElementById("btn-submit");

        btnSubmit.disabled = true;

        if (modeInscription) {
            const pseudo = document.getElementById("input-pseudo").value.trim();
            const { error } = await _supabase.auth.signUp({
                email, password, options: { data: { display_name: pseudo } }
            });
            btnSubmit.disabled = false;
            if (error) return alert(`Erreur : ${error.message}`);
            alert("Compte créé ! Tu peux te connecter.");
            document.getElementById("toggle-link").click();
            return;
        }

        // Connexion
        const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
        btnSubmit.disabled = false;

        if (error) return alert(`Erreur : ${error.message}`);

        // Succès : masque l'overlay et reste sur la page en cours
        document.getElementById("modal-auth-overlay").classList.add("hidden");
        window.location.reload();
    });
}
