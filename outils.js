// ============================================================================
// CONTROLE DU MENU BURGER
// ============================================================================
function toggleBurgerMenu() {
    const menu = document.getElementById('burgerMenu');
    const overlay = document.getElementById('menuOverlay');
    if (menu && overlay) {
        menu.classList.toggle('open');
        overlay.classList.toggle('active');
    }
}

// ============================================================================
// MOTEUR D'ACTUALITÉS CARBURANT (RSS FEED)
// ============================================================================
document.addEventListener("DOMContentLoaded", async () => {
    // Écouteurs menu burger
    const burgerBtn = document.getElementById('burgerBtn');
    const menuOverlay = document.getElementById('menuOverlay');

    if (burgerBtn) {
        burgerBtn.addEventListener('click', toggleBurgerMenu);
        burgerBtn.addEventListener('touchend', (e) => { e.preventDefault(); toggleBurgerMenu(); }, { passive: false });
    }
    if (menuOverlay) menuOverlay.addEventListener('click', toggleBurgerMenu);

    // Synchro nom opérateur
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

    // Chargement du flux d'actualités
    chargerActualitesCarburant();
});

async function chargerActualitesCarburant() {
    const container = document.getElementById('news-container');
    const updateLabel = document.getElementById('last-update');
    if (!container) return;

    // Requête vers Google News RSS via le relai JSON gratuit rss2json
    const requeteQuery = encodeURIComponent('prix carburant essence gazole france');
    const rssUrl = `https://news.google.com/rss/search?q=${requeteQuery}&hl=fr&gl=FR&ceid=FR:fr`;
    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error("Impossible de joindre le flux d'actualités.");

        const data = await response.json();

        if (data.status !== 'ok' || !data.items || data.items.length === 0) {
            container.innerHTML = `<p style="font-size:12px; color:var(--texte-secondaire); grid-column:1/-1; text-align:center;">Aucune actualité récente trouvée.</p>`;
            return;
        }

        container.innerHTML = "";

        data.items.slice(0, 12).forEach(item => {
            const dateArticle = new Date(item.pubDate).toLocaleDateString('fr-FR', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
            });

            // Nettoyage de la source (ex: "Le Figaro", "BFMTV")
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
        console.error("Erreur chargement news :", err);
        container.innerHTML = `<p style="font-size:12px; color:var(--accent-rouge); grid-column:1/-1; text-align:center;">Échec du chargement du flux d'actualités.</p>`;
    }
}
