// =========================================================================
// MODULE RADAR INTERNATIONAL - EXTENSION FRONTALIÈRE SÉCURISÉE
// =========================================================================

const INTERNATIONALE_APIS = {
    allemagne: "stations_allemagne.json",
    belgique: "stations_belgique.json" // Optionnel, prêt pour le futur
};

/**
 * Calcule la distance entre deux points géographiques (Formule de Haversine)
 */
function calculerDistanceFrontiere(lat1, lon1, lat2, lon2) {
    const R = 6371; // Rayon de la Terre en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance en km
}

/**
 * Charge et déploie les stations frontalières sur la carte selon le rayon choisi
 * @param {Object} mapInstance - L'instance de ta carte (Leaflet/Mapbox)
 * @param {number} userLat - Latitude de l'utilisateur (ou du centre de recherche)
 * @param {number} userLon - Longitude de l'utilisateur
 * @param {number} rayonKm - Rayon limite (ex: 15)
 * @param {Function} callbackCréationMarker - Ta fonction existante dans index.js qui crée un marker
 */
async function injecterStationsFrontalieres(mapInstance, userLat, userLon, rayonKm = 15, callbackCreationMarker) {
    console.log(`🌍 [Radar International] Scan transfrontalier activé dans un rayon de ${rayonKm} km...`);

    for (const [pays, url] of Object.entries(INTERNATIONALE_APIS)) {
        try {
            const response = await fetch(url);
            if (!response.ok) continue;

            const stations = await response.json();
            let stationsDetectees = 0;

            stations.forEach(station => {
                if (!station.lt || !station.ln) return;

                const distance = calculerDistanceFrontiere(
                    parseFloat(userLat), 
                    parseFloat(userLon), 
                    parseFloat(station.lt), 
                    parseFloat(station.ln)
                );

                // 🎯 FILTRE RADAR TRÈS STRICT : Uniquement si la station est dans le rayon des 15km
                if (distance <= rayonKm) {
                    stationsDetectees++;
                    
                    // Ajout d'un tag sur le nom pour que l'utilisateur repère le pays sur la carte
                    const nomAffiche = `[${pays.toUpperCase()}] ${station.n || "Station"}`;
                    
                    // On utilise la fonction de création de marker d'index.js pour garder le même design
                    // et le même bouton "Ajouter aux favoris"
                    callbackCreationMarker(station, nomAffiche, mapInstance);
                }
            });

            console.log(`✅ [Radar International] ${stationsDetectees} stations trouvées pour le vecteur : ${pays}`);

        } catch (err) {
            console.warn(`⚠️ Impossible de charger la base frontalière (${pays}) :`, err.message);
        }
    }
}

// Exportation de la fonction pour qu'elle soit accessible par index.html / index.js
window.injecterStationsFrontalieres = injecterStationsFrontalieres;
