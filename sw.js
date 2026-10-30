// ═══════════════════════════════════════════════════════════════
// Loué App — service worker : garde l'appli dans le téléphone pour l'ouvrir SANS réseau.
// VERSION et les numéros « ?v= » sont mis à jour AUTOMATIQUEMENT par « node outils/construire.js » :
// ne pas les modifier à la main. En cas de gros problème : remplacer ce fichier par outils/sw-secours.js.
// Les échanges avec Apps Script ne passent JAMAIS par ce cache (fiches, listes : gérés par commun/api.js).
// ═══════════════════════════════════════════════════════════════
const VERSION = 'loue-42e0f120d5';
const A_GARDER = [
  './', 'index.html', 'quitus.html', 'bordereau.html',
  'cotes.html', 'fiche-fabrication.html', 'note-reunion.html', 'bordereau-orga.html', 'bordereau-materiaux.html',
  'attestation.html', 'reception-support.html', 'absence.html',
  'manifest.json', 'logo.png', 'apple-touch-icon.png',
  // Fichiers communs et modèles, avec leur numéro de version (liste fabriquée par outils/construire.js)
  /*COMMUNS*/ 'commun/adresses.js?v=42e0f120d5', 'commun/api.js?v=42e0f120d5', 'commun/brouillon.js?v=42e0f120d5', 'commun/config.js?v=42e0f120d5', 'commun/hors-ligne.js?v=42e0f120d5', 'commun/photos.js?v=42e0f120d5', 'commun/signature.js?v=42e0f120d5', 'commun/ui.js?v=42e0f120d5', 'commun/fiche.css?v=42e0f120d5', 'commun/style.css?v=42e0f120d5', 'modeles/bordereau.js?v=42e0f120d5', 'modeles/cotes.js?v=42e0f120d5', 'modeles/fabrication.js?v=42e0f120d5', 'modeles/quitus.js?v=42e0f120d5',
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

function garder(requete, rep) {
  if (rep && rep.ok) { const copie = rep.clone(); caches.open(VERSION).then(c => c.put(requete, copie)); }
  return rep;
}

// Pages : réseau d'abord ; au bout de 3 s, la copie du téléphone SI elle existe, sinon on continue d'attendre le réseau
function pageReseauDAbord(requete) {
  const reseau = fetch(requete).then(rep => garder(requete, rep));
  const copie = () => caches.match(requete, { ignoreSearch: true }).then(r => r || caches.match('index.html'));
  return new Promise(resolve => {
    let fini = false;
    const minuteur = setTimeout(() => {
      caches.match(requete, { ignoreSearch: true }).then(r => { if (r && !fini) { fini = true; resolve(r); } });
    }, 3000);
    reseau.then(rep => { if (!fini) { fini = true; clearTimeout(minuteur); resolve(rep); } })
      .catch(() => { if (!fini) { fini = true; clearTimeout(minuteur); resolve(copie()); } });
  });
}

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;                // Apps Script, Google… : jamais en cache ici
  if (url.pathname.indexOf('/tests/') > -1 || url.pathname.indexOf('/_prive/') > -1) return;
  if (req.mode === 'navigate' || /\.html$/.test(url.pathname) || url.pathname.endsWith('/')) {
    ev.respondWith(pageReseauDAbord(req));
    return;
  }
  // Fichier versionné (« ?v=… ») : la copie EXACTE de cette version si le téléphone l'a, sinon le réseau.
  // Une page reçoit donc toujours les scripts de SA version, même sur un réseau faible.
  if (url.searchParams.has('v')) {
    ev.respondWith(caches.match(req).then(r => r || fetch(req).then(rep => garder(req, rep))));
    return;
  }
  // Autres fichiers (images…) : réseau, sinon la copie du téléphone
  ev.respondWith(fetch(req).then(rep => garder(req, rep)).catch(() => caches.match(req, { ignoreSearch: true })));
});
