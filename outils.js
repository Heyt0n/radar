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
// INITIALISATION
// ============================================================================
document.addEventListener("DOMContentLoaded", async () => {
    // Écouteurs pour le menu burger
    const burgerBtn = document.getElementById('burgerBtn');
    const menuOverlay = document.getElementById('menuOverlay');

    if (burgerBtn) {
        burgerBtn.addEventListener('click', toggleBurgerMenu);
        burgerBtn.addEventListener('touchend', (e) => { e.preventDefault(); toggleBurgerMenu(); }, { passive: false });
    }
    if (menuOverlay) menuOverlay.addEventListener('click', toggleBurgerMenu);

    // Synchronisation de la session utilisateur Supabase
    try {
        if (typeof _supabase !== 'undefined') {
            const { data: { session } } = await _supabase.auth.getSession();
            if (session && session.user) {
                const pseudo = session.user.user_metadata.display_name || "Opérateur";
                const badge = document.getElementById("nom-operateur");
                if (badge) badge.textContent = pseudo;
            }
        }
    } catch (e) {
        console.error("Erreur session menu outils :", e);
    }

    // Lancement simultané du Brief Macro et du flux d'Actualités
    chargerBriefDuSoir();
    chargerActualitesCarburant();
});

// ============================================================================
// MODULE BRIEF MACRO (LECTURE GOOGLE SHEETS CSV)
// ============================================================================
async function chargerBriefDuSoir() {
    const elementHtml = document.getElementById('sniper-comment');
    const dateLabel = document.getElementById('brief-date');

    try {
        const response = await fetch(GOOGLE_SHEETS_COMMENTAIRE_URL);
        if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);

        const csvText = await response.text();

        Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const lignes = results.data;

                if (lignes && lignes.length > 0) {
                    // Extraction de la toute dernière ligne enregistrée dans le Sheet
                    const dernierBrief = lignes[lignes.length - 1];

                    // Extraction du texte et de la date optionnelle
                    const tonTexte = dernierBrief.Commentaire || dernierBrief.commentaire || dernierBrief["Commentaire "] || "Aucun brief disponible pour le moment.";
                    const dateTxt = dernierBrief.Date || dernierBrief.date || "Dernière Note";

                    if (elementHtml) {
                        elementHtml.innerText = tonTexte;
                    }
                    if (dateLabel) {
                        dateLabel.textContent = dateTxt;
                    }
                } else {
                    if (elementHtml) elementHtml.innerText = "Aucun commentaire publié pour le moment.";
                }
            }
        });
    } catch (e) {
        console.error("Erreur technique brief macro :", e);
        if (elementHtml) elementHtml.innerText = "Impossible de charger le brief macro actuel.";
    }
}

// ============================================================================
// MODULE ACTUALITÉS CARBURANT (FLUX RSS EN DIRECT)
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
