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
// MODULE BRIEF MACRO & JAUGE DYNAMIQUE (GOOGLE SHEETS CSV)
// ============================================================================
async function chargerBriefDuSoir() {
    const elementHtml = document.getElementById('sniper-comment');
    const dateLabel = document.getElementById('brief-date');
    const jaugeBarre = document.getElementById('jauge-barre');
    const jaugeValeur = document.getElementById('jauge-valeur');
    const jaugeMessage = document.getElementById('jauge-message');

    try {
        console.log("Brief : Tentative de connexion au flux Google Sheets...");
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

                    const tonTexte = dernierBrief.Commentaire || dernierBrief.commentaire || dernierBrief["Commentaire "] || "Aucun brief disponible pour le moment.";
                    const dateTxt = dernierBrief.Date || dernierBrief.date || "Dernière Note";

                    if (elementHtml) elementHtml.innerText = tonTexte;
                    if (dateLabel) dateLabel.textContent = dateTxt;

                    let valJauge = parseInt(dernierBrief.Jauge || dernierBrief.jauge || dernierBrief.Score || dernierBrief.score || 0);
                    if (isNaN(valJauge)) valJauge = 0;
                    if (valJauge < 0) valJauge = 0;
                    if (valJauge > 100) valJauge = 100;

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

                    console.log("🛰️ Brief & Jauge injectés avec succès :", valJauge, tonTexte);
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

// ============================================================================
// CALCULATEUR DE RENTABILITÉ RÉELLE DU DÉTOUR
// ============================================================================
function calculerRentabiliteDetour() {
    console.log("👉 Calcul de rentabilité déclenché");

    const elVolume = document.getElementById("calc-volume");
    const elConso = document.getElementById("calc-conso");
    const elDiffPrix = document.getElementById("calc-diff-prix");
    const elDetour = document.getElementById("calc-detour");
    const resultBox = document.getElementById("calc-result");

    if (!resultBox) {
        alert("Erreur : zone de résultat introuvable.");
        return;
    }

    const volumePlein = parseFloat(elVolume ? elVolume.value : 0) || 0;
    const consoMoyenne = parseFloat(elConso ? elConso.value : 0) || 0;
    const diffPrix = parseFloat(elDiffPrix ? elDiffPrix.value : 0) || 0;
    const kmDetour = parseFloat(elDetour ? elDetour.value : 0) || 0;

    if (volumePlein <= 0 || consoMoyenne <= 0) {
        alert("Veuillez remplir des valeurs de volume et de consommation valides.");
        return;
    }

    // 1. Gain brut à la pompe
    const gainBrut = volumePlein * diffPrix;

    // 2. Carburant brûlé sur le détour (Aller-Retour)
    const litresBrules = (kmDetour * consoMoyenne) / 100;
    const coutDetour = litresBrules * 1.80; // Base d'estimation à 1,80€/L

    // 3. Gain Net Réel
    const gainNet = gainBrut - coutDetour;

    // Affichage
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
        resultBox.classList.add("non-rentable");
        resultBox.innerHTML = `
            <strong>⚠️ DÉTOUR NON RENTABLE !</strong><br>
            • Économie brute à la pompe : <strong>+${gainBrut.toFixed(2)} €</strong><br>
            • Carburant brûlé sur le détour (${kmDetour} km) : <strong>-${coutDetour.toFixed(2)} €</strong> (${litresBrules.toFixed(2)} L)<br>
            👉 <strong>Perte nette : ${gainNet.toFixed(2)} €</strong> (Le trajet coûte plus cher que le gain à la pompe !).
        `;
    }
}
