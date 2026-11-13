// ═══════════════════════════════════════════════════════════════
// Loué App — service worker : garde l'appli dans le téléphone pour l'ouvrir SANS réseau.
// VERSION et les numéros « ?v= » sont mis à jour AUTOMATIQUEMENT par « node outils/construire.js » :
// ne pas les modifier à la main. En cas de gros problème : remplacer ce fichier par outils/sw-secours.js.
// Les échanges avec Apps Script ne passent JAMAIS par ce cache (fiches, listes : gérés par commun/api.js).
// ═══════════════════════════════════════════════════════════════
const VERSION = 'loue-f0d35a5ec4';
const A_GARDER = [
  './', 'index.html', 'quitus.html', 'bordereau.html',
  'cotes.html', 'fiche-fabrication.html', 'note-reunion.html', 'bordereau-orga.html', 'bordereau-materiaux.html',
  'attestation.html', 'reception-support.html', 'absence.html', 'signaler.html', 'signalements.html', 'notes.html', 'carnet.html',
  'manifest.json', 'logo.png', 'apple-touch-icon.png', 'icone-192.png', 'icone-512.png', 'icone-512-maskable.png',
  // Fichiers communs et modèles, avec leur numéro de version (liste fabriquée par outils/construire.js)
  /*COMMUNS*/ 'commun/adresses.js?v=f0d35a5ec4', 'commun/api.js?v=f0d35a5ec4', 'commun/brouillon.js?v=f0d35a5ec4', 'commun/carnet.js?v=f0d35a5ec4', 'commun/config.js?v=f0d35a5ec4', 'commun/destinataires.js?v=f0d35a5ec4', 'commun/hors-ligne.js?v=f0d35a5ec4', 'commun/notes.js?v=f0d35a5ec4', 'commun/photos.js?v=f0d35a5ec4', 'commun/signature.js?v=f0d35a5ec4', 'commun/ui.js?v=f0d35a5ec4', 'commun/fiche.css?v=f0d35a5ec4', 'commun/style.css?v=f0d35a5ec4', 'modeles/absence.js?v=f0d35a5ec4', 'modeles/attestation.js?v=f0d35a5ec4', 'modeles/bordereau.js?v=f0d35a5ec4', 'modeles/cotes.js?v=f0d35a5ec4', 'modeles/fabrication.js?v=f0d35a5ec4', 'modeles/mise-en-page.js?v=f0d35a5ec4', 'modeles/note.js?v=f0d35a5ec4', 'modeles/quitus.js?v=f0d35a5ec4', 'modeles/reception.js?v=f0d35a5ec4', 'modeles/signalement.js?v=f0d35a5ec4',
];

// Nom du cache : version + portée. Deux sites installés sur le même téléphone ont chacun le leur,
// et l'un n'efface jamais celui de l'autre sur le même téléphone.
const CACHE = VERSION + '@' + self.registration.scope;

self.addEventListener('install', ev => {
  // « reload » : on va chercher le fichier sur GitHub, pas la copie que le navigateur garde 10 minutes
  // (sinon la nouvelle version pourrait enregistrer une ANCIENNE page).
  // Une page, un script commun ou un modèle qui ne vient pas (réseau faible) fait ÉCHOUER l'installation :
  // le navigateur réessaiera plus tard, et l'ancienne version reste en place, complète. Seules les images sont facultatives.
  const facultatif = u => /\.(png|json)$/.test(u);
  ev.waitUntil(caches.open(CACHE).then(c => Promise.all(A_GARDER.map(u =>
    fetch(new Request(u, { cache: 'reload' })).then(rep => {
      if (rep.ok) return c.put(u, rep);
      if (!facultatif(u)) throw new Error(u + ' : ' + rep.status);
    }).catch(err => { if (!facultatif(u)) throw err; })))));
});

self.addEventListener('activate', ev => {
  ev.waitUntil(caches.keys()
    // Seulement les anciennes versions de CETTE portée (et les caches d'avant ce nommage, sans « @ »)
    .then(cles => Promise.all(cles.filter(k => k.indexOf('loue-') === 0 && k !== CACHE &&
      (k.indexOf('@') < 0 || k.slice(k.indexOf('@') + 1) === self.registration.scope)).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// La page demande d'activer la nouvelle version (bandeau « Nouvelle version — toucher pour mettre à jour »)
self.addEventListener('message', ev => { if (ev.data === 'activer') self.skipWaiting(); });

function garder(requete, rep) {
  if (rep && rep.ok && !rep.redirected) { const copie = rep.clone(); caches.open(CACHE).then(c => c.put(requete, copie)); }
  return rep;
}

// Pages : réseau d'abord ; au bout de 3 s, la copie du téléphone SI elle existe, sinon on continue d'attendre le réseau
function pageReseauDAbord(requete) {
  // « no-cache » : le navigateur redemande à GitHub si la page a changé (réponse très courte si elle n'a pas changé).
  // Sans cela, une page publiée pouvait rester à l'ancienne version jusqu'à 10 minutes après une fusion.
  const reseau = fetch(new Request(requete, { cache: 'no-cache' })).then(rep => garder(requete, rep));
  const copie = () => caches.match(requete, { ignoreSearch: true, cacheName: CACHE }).then(r => r || caches.match('index.html', { cacheName: CACHE }));
  return new Promise(resolve => {
    let fini = false;
    const minuteur = setTimeout(() => {
      caches.match(requete, { ignoreSearch: true, cacheName: CACHE }).then(r => { if (r && !fini) { fini = true; resolve(r); } });
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
  // config.js contient l'adresse du serveur, qui change à chaque nouveau déploiement Apps Script :
  // toujours redemandé au réseau d'abord (la copie du téléphone au bout de 3 s, ou sans réseau)
  if (/\/commun\/config\.js$/.test(url.pathname)) {
    ev.respondWith(pageReseauDAbord(req));
    return;
  }
  // Fichier versionné (« ?v=… ») : la copie EXACTE de cette version si le téléphone l'a, sinon le réseau.
  // Une page reçoit donc toujours les scripts de SA version, même sur un réseau faible.
  if (url.searchParams.has('v')) {
    ev.respondWith(caches.match(req, { cacheName: CACHE }).then(r => r || fetch(req).then(rep => garder(req, rep))));
    return;
  }
  // Autres fichiers (images…) : réseau, sinon la copie du téléphone
  ev.respondWith(fetch(req).then(rep => garder(req, rep)).catch(() => caches.match(req, { ignoreSearch: true, cacheName: CACHE })));
});
