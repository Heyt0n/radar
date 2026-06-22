const CACHE_NAME = 'radar-carburant-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './script_live.js',
  './manifest.json'
];

// Installation du Service Worker et mise en cache de l'interface
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Stratégie de cache : Réseau d'abord pour les prix, Cache pour l'interface
self.addEventListener('fetch', (e) => {
  // On laisse le réseau gérer les requêtes d'API (Allemagne et fichier JSON) en priorité
  if (e.request.url.includes('stations_france.json') || e.request.url.includes('tankerkoenig')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
  } else {
    // Pour l'interface (HTML/CSS), on charge du cache pour que ce soit instantané
    e.respondWith(
      caches.match(e.request).then((response) => {
        return response || fetch(e.request);
      })
    );
  }
});
