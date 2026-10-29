// ═══════════════════════════════════════════════════════════════
// Loué App — service worker : garde l'appli dans le téléphone pour l'ouvrir SANS réseau.
// À CHAQUE LIVRAISON : augmenter VERSION (sinon les téléphones gardent l'ancienne version).
// En cas de gros problème : remplacer ce fichier par outils/sw-secours.js (voir ce fichier).
// Les échanges avec Apps Script ne passent JAMAIS par ce cache (fiches, listes : gérés par commun/api.js).
// ═══════════════════════════════════════════════════════════════
const VERSION = 'loue-5.0.0-1';
const A_GARDER = [
  './', 'index.html', 'quitus.html',
  'cotes.html', 'fiche-fabrication.html', 'note-reunion.html', 'bordereau-orga.html', 'bordereau-materiaux.html',
  'attestation.html', 'reception-support.html', 'absence.html',
  'commun/config.js', 'commun/api.js', 'commun/ui.js', 'commun/photos.js', 'commun/signature.js',
  'commun/brouillon.js', 'commun/adresses.js', 'commun/hors-ligne.js', 'commun/style.css',
  'modeles/quitus.js',
  'manifest.json', 'logo.png', 'apple-touch-icon.png',
];

self.addEventListener('install', ev => {
  // Chaque fichier est mis en cache séparément : un fichier manquant ne bloque pas l'installation
  ev.waitUntil(caches.open(VERSION).then(c => Promise.all(A_GARDER.map(u => c.add(u).catch(() => null)))));
});

self.addEventListener('activate', ev => {
  ev.waitUntil(caches.keys()
    .then(cles => Promise.all(cles.filter(k => k.indexOf('loue-') === 0 && k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// La page demande d'activer la nouvelle version (bandeau « Nouvelle version — toucher pour mettre à jour »)
self.addEventListener('message', ev => { if (ev.data === 'activer') self.skipWaiting(); });

// Réseau d'abord avec un délai maximal (3 s), puis le cache. Utilisé pour TOUS les fichiers de l'appli :
// avec du réseau, page et scripts sont toujours de la même version (jamais une nouvelle page avec un ancien script).
function reseauDAbord(requete, delaiMs) {
  return new Promise(resolve => {
    let fini = false;
    const depuisCache = () => caches.match(requete, { ignoreSearch: true })
      .then(r => r || (requete.mode === 'navigate' ? caches.match('index.html') : Response.error()));
    const minuteur = setTimeout(() => { if (!fini) { fini = true; resolve(depuisCache()); } }, delaiMs);
    fetch(requete).then(rep => {
      if (rep && rep.ok) caches.open(VERSION).then(c => c.put(requete, rep.clone()));
      if (!fini) { fini = true; clearTimeout(minuteur); resolve(rep); }
    }).catch(() => { if (!fini) { fini = true; clearTimeout(minuteur); resolve(depuisCache()); } });
  });
}

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;                // Apps Script, Google… : jamais en cache ici
  if (url.pathname.indexOf('/tests/') > -1 || url.pathname.indexOf('/_prive/') > -1) return;
  ev.respondWith(reseauDAbord(req, 3000));
});
