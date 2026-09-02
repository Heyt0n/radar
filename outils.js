// ============================================================================
// CONFIGURATION ET FLUX
// ============================================================================
const GOOGLE_SHEETS_COMMENTAIRE_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRlZeqlhRu75u42M8mfM5TagCXgfh-rl6ZD-qDm25Q2lSlLBYSTMBIioY_JzgdDDByohc-K2EIIuiBY/pub?output=csv";

function toggleBurgerMenu() {
    const menu = document.getElementById('burgerMenu');
    const overlay = document.getElementById('menuOverlay');
    if (menu && overlay) {
        menu.classList.toggle('open');
        overlay.classList.toggle('active');
    }
}

// ============================================================================
// INITIALISATION & SÉCURITÉ
// ============================================================================
document.addEventListener("DOMContentLoaded", async () => {
    // 1. Contrôle d'accès Supabase
    const estConnecte = await verifierSessionOuvrirModal();
    if (!estConnecte) {
        return; // Stoppe si non connecté (le modal s'ouvre)
    }

    // 2. Initialisation des événements UI
    const burgerBtn = document.getElementById('burgerBtn');
    const menuOverlay = document.getElementById('menuOverlay');
    if (burgerBtn) {
        burgerBtn.addEventListener('click', toggleBurgerMenu);
        burgerBtn.addEventListener('touchend', (e) => { e.preventDefault(); toggleBurgerMenu(); }, { passive: false });
    }
    if (menuOverlay) menuOverlay.addEventListener('click', toggleBurgerMenu);

    // 3. Affichage du pseudo dans le menu
    try {
        if (typeof _supabase !== 'undefined') {
            const { data: { session } } = await _supabase.auth.getSession();
            if (session && session.user) {
                const pseudo = session.user.user_metadata?.display_name || "Opérateur";
                const badge = document.getElementById("nom-operateur");
                if (badge) badge.textContent = pseudo;
            }
        }
    } catch (e) {
        console.error("Erreur session menu outils :", e);
    }

    // 4. Lancement des données de la page Outils
    chargerBriefDuSoir();
    chargerActualitesCarburant();
});

async function verifierSessionOuvrirModal() {
    if (typeof _supabase === 'undefined') {
        ouvrirModalConnexion();
        return false;
    }
    const { data: { session } } = await _supabase.auth.getSession();
    if (!session) {
        ouvrirModalConnexion();
        return false;
    }
    return true;
}

function ouvrirModalConnexion() {
    const modal = document.getElementById("modal-auth-overlay");
    if (modal) modal.classList.remove("hidden");
}

function fermerModalConnexion() {
    const modal = document.getElementById("modal-auth-overlay");
    if (modal) modal.classList.add("hidden");
}

// ============================================================================
// MODULE BRIEF MACRO & JAUGE DYNAMIQUE (GOOGLE SHEETS CSV)
// ============================================================================
async function chargerBriefDuSoir() {
    const elementHtml = document.getElementById('sniper-comment');
    const dateLabel = document.getElementById('brief-date');
    const jaugeBarre = document.getElementById('jauge-barre');
    const jaugeValeur = document.getElementById('jauge-valeur');
    const jaugeMessage = document.getElementById('jauge-message');

    try {
        console.log("Brief : Connexion au flux Google Sheets...");
        const response = await fetch(GOOGLE_SHEETS_COMMENTAIRE_URL);
        if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
        const csvText = await response.text();

        Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const lignes = results.data;
                if (lignes && lignes.length > 0) {
                    const dernierBrief = lignes[lignes.length - 1];
                    const tonTexte = dernierBrief.Commentaire || dernierBrief.commentaire || dernierBrief["Commentaire "] || "Aucun brief disponible.";
                    const dateTxt = dernierBrief.Date || dernierBrief.date || "Dernière Note";

                    if (elementHtml) elementHtml.innerText = tonTexte;
                    if (dateLabel) dateLabel.textContent = dateTxt;

                    let valJauge = parseInt(dernierBrief.Jauge || dernierBrief.jauge || dernierBrief.Score || dernierBrief.score || 0);
                    if (isNaN(valJauge)) valJauge = 0;
                    valJauge = Math.max(0, Math.min(100, valJauge));

                    let couleur = "#22c55e"; // Vert
                    let message = "🎯 ACHETER — Prix bas / Moment opportun";

                    if (valJauge >= 35 && valJauge <= 70) {
                        couleur = "#f97316"; // Orange
                        message = "⏳ ATTENDRE — Marché neutre / En observation";
                    } else if (valJauge > 70) {
                        couleur = "#ef4444"; // Rouge
                        message = "🛑 NE PAS ACHETER — Sommet atteint / Baisse à venir";
                    }

                    if (jaugeBarre) {
                        jaugeBarre.style.width = `${valJauge}%`;
                        jaugeBarre.style.backgroundColor = couleur;
                    }
                    if (jaugeValeur) {
                        jaugeValeur.textContent = `${valJauge}/100`;
                        jaugeValeur.style.color = couleur;
                    }
                    if (jaugeMessage) {
                        jaugeMessage.textContent = message;
                        jaugeMessage.style.color = couleur;
                    }
                } else {
                    if (elementHtml) elementHtml.innerText = "Aucun commentaire disponible.";
                }
            }
        });
    } catch (e) {
        console.error("Erreur technique brief macro :", e);
        if (elementHtml) elementHtml.innerText = "Impossible de charger le brief macro actuellement.";
    }
}

// ============================================================================
// MODULE ACTUALITÉS CARBURANT (FLUX RSS)
// ============================================================================
async function chargerActualitesCarburant() {
    const container = document.getElementById('news-container');
    const updateLabel = document.getElementById('last-update');
    if (!container) return;

    const requeteQuery = encodeURIComponent('prix carburant essence gazole france');
    const rssUrl = `https://news.google.com/rss/search?q=${requeteQuery}&hl=fr&gl=FR&ceid=FR:fr`;
    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error("Erreur serveur d'actualités.");
        const data = await response.json();

        if (data.status !== 'ok' || !data.items || data.items.length === 0) {
            container.innerHTML = `<p style="font-size:12px; color:var(--texte-secondaire); grid-column:1/-1; text-align:center;">Aucune actualité récente disponible.</p>`;
            return;
        }

        container.innerHTML = "";
        data.items.slice(0, 12).forEach(item => {
            const dateArticle = new Date(item.pubDate).toLocaleDateString('fr-FR', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
            });
            const sourceMatch = item.title.match(/ - ([^-]+)$/);
            const sourceNom = sourceMatch ? sourceMatch[1] : "Presse";
            const titrePropre = item.title.replace(/ - [^-]+$/, '');

            const card = document.createElement('div');
            card.className = 'news-card';
            card.innerHTML = `
                <div>
                    <span class="news-tag">⛽ ESSENCE & CARBURANT</span>
                    <h3 class="news-title">${titrePropre}</h3>
                </div>
                <div class="news-footer">
                    <span>📰 ${sourceNom} • ${dateArticle}</span>
                    <a class="news-link-btn" href="${item.link}" target="_blank" rel="noopener noreferrer">Lire ↗</a>
                </div>
            `;
            container.appendChild(card);
        });

        if (updateLabel) {
            updateLabel.textContent = `Mis à jour : ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
        }
    } catch (err) {
        console.error("Erreur actualités :", err);
        container.innerHTML = `<p style="font-size:12px; color:var(--texte-secondaire); grid-column:1/-1; text-align:center;">Échec du chargement du flux d'actualités.</p>`;
    }
}

// ============================================================================
// CALCULATEUR DE RENTABILITÉ RÉELLE DU DÉTOUR
// ============================================================================
function calculerRentabiliteDetour() {
    const elVolume = document.getElementById("calc-volume");
    const elConso = document.getElementById("calc-conso");
    const elDiffPrix = document.getElementById("calc-diff-prix");
    const elDetour = document.getElementById("calc-detour");
    const resultBox = document.getElementById("calc-result");

    if (!resultBox) return;

    const volumePlein = parseFloat(elVolume?.value || 0);
    const consoMoyenne = parseFloat(elConso?.value || 0);
    const diffPrix = parseFloat(elDiffPrix?.value || 0);
    const kmDetour = parseFloat(elDetour?.value || 0);

    if (volumePlein <= 0 || consoMoyenne <= 0) {
        alert("Veuillez remplir des valeurs de volume et de consommation valides.");
        return;
    }

    const gainBrut = volumePlein * diffPrix;
    const litresBrules = (kmDetour * consoMoyenne) / 100;
    const coutDetour = litresBrules * 1.80; // Base estimée à 1,80€/L
    const gainNet = gainBrut - coutDetour;

    resultBox.classList.remove("hidden");
    resultBox.className = "result-box";

    if (gainNet > 0) {
        resultBox.classList.add("rentable");
        resultBox.innerHTML = `
            <strong>🎯 DÉTOUR RENTABLE !</strong><br>
            • Économie brute à la pompe : <strong>+${gainBrut.toFixed(2)} €</strong><br>
            • Carburant brûlé sur le détour (${kmDetour} km) : <strong>-${coutDetour.toFixed(2)} €</strong> (${litresBrules.toFixed(2)} L)<br>
            👉 <strong>Gain net réel : +${gainNet.toFixed(2)} €</strong>
        `;
    } else {
        resultBox.classList.add("rentable");
        resultBox.classList.replace("rentable", "non-rentable");
        resultBox.innerHTML = `
            <strong>⚠️ DÉTOUR NON RENTABLE !</strong><br>
            • Économie brute à la pompe : <strong>+${gainBrut.toFixed(2)} €</strong><br>
            • Carburant brûlé sur le détour (${kmDetour} km) : <strong>-${coutDetour.toFixed(2)} €</strong> (${litresBrules.toFixed(2)} L)<br>
            👉 <strong>Perte nette : ${gainNet.toFixed(2)} €</strong> (Le trajet coûte plus cher que le gain à la pompe !).
        `;
    }
}
