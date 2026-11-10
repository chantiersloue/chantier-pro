// ═══════════════════════════════════════════════════════════════
// Loué App — service worker : garde l'appli dans le téléphone pour l'ouvrir SANS réseau.
// VERSION et les numéros « ?v= » sont mis à jour AUTOMATIQUEMENT par « node outils/construire.js » :
// ne pas les modifier à la main. En cas de gros problème : remplacer ce fichier par outils/sw-secours.js.
// Les échanges avec Apps Script ne passent JAMAIS par ce cache (fiches, listes : gérés par commun/api.js).
// ═══════════════════════════════════════════════════════════════
<<<<<<< HEAD
<<<<<<< HEAD
const VERSION = 'loue-e493369d3e';
=======
const VERSION = 'loue-c376b086ee';
>>>>>>> refonte
=======
const VERSION = 'loue-5a61f72be6';
>>>>>>> refonte
const A_GARDER = [
  './', 'index.html', 'quitus.html', 'bordereau.html',
  'cotes.html', 'fiche-fabrication.html', 'note-reunion.html', 'bordereau-orga.html', 'bordereau-materiaux.html',
  'attestation.html', 'reception-support.html', 'absence.html',
  'manifest.json', 'logo.png', 'apple-touch-icon.png', 'icone-192.png', 'icone-512.png', 'icone-512-maskable.png',
  // Fichiers communs et modèles, avec leur numéro de version (liste fabriquée par outils/construire.js)
<<<<<<< HEAD
<<<<<<< HEAD
  /*COMMUNS*/ 'commun/adresses.js?v=e493369d3e', 'commun/api.js?v=e493369d3e', 'commun/brouillon.js?v=e493369d3e', 'commun/config.js?v=e493369d3e', 'commun/destinataires.js?v=e493369d3e', 'commun/hors-ligne.js?v=e493369d3e', 'commun/photos.js?v=e493369d3e', 'commun/signature.js?v=e493369d3e', 'commun/ui.js?v=e493369d3e', 'commun/fiche.css?v=e493369d3e', 'commun/style.css?v=e493369d3e', 'modeles/absence.js?v=e493369d3e', 'modeles/attestation.js?v=e493369d3e', 'modeles/bordereau.js?v=e493369d3e', 'modeles/cotes.js?v=e493369d3e', 'modeles/fabrication.js?v=e493369d3e', 'modeles/mise-en-page.js?v=e493369d3e', 'modeles/note.js?v=e493369d3e', 'modeles/quitus.js?v=e493369d3e', 'modeles/reception.js?v=e493369d3e',
=======
  /*COMMUNS*/ 'commun/adresses.js?v=c376b086ee', 'commun/api.js?v=c376b086ee', 'commun/brouillon.js?v=c376b086ee', 'commun/config.js?v=c376b086ee', 'commun/destinataires.js?v=c376b086ee', 'commun/hors-ligne.js?v=c376b086ee', 'commun/photos.js?v=c376b086ee', 'commun/signature.js?v=c376b086ee', 'commun/ui.js?v=c376b086ee', 'commun/fiche.css?v=c376b086ee', 'commun/style.css?v=c376b086ee', 'modeles/absence.js?v=c376b086ee', 'modeles/attestation.js?v=c376b086ee', 'modeles/bordereau.js?v=c376b086ee', 'modeles/cotes.js?v=c376b086ee', 'modeles/fabrication.js?v=c376b086ee', 'modeles/mise-en-page.js?v=c376b086ee', 'modeles/note.js?v=c376b086ee', 'modeles/quitus.js?v=c376b086ee', 'modeles/reception.js?v=c376b086ee',
>>>>>>> refonte
=======
  /*COMMUNS*/ 'commun/adresses.js?v=5a61f72be6', 'commun/api.js?v=5a61f72be6', 'commun/brouillon.js?v=5a61f72be6', 'commun/config.js?v=5a61f72be6', 'commun/destinataires.js?v=5a61f72be6', 'commun/hors-ligne.js?v=5a61f72be6', 'commun/photos.js?v=5a61f72be6', 'commun/signature.js?v=5a61f72be6', 'commun/ui.js?v=5a61f72be6', 'commun/fiche.css?v=5a61f72be6', 'commun/style.css?v=5a61f72be6', 'modeles/absence.js?v=5a61f72be6', 'modeles/attestation.js?v=5a61f72be6', 'modeles/bordereau.js?v=5a61f72be6', 'modeles/cotes.js?v=5a61f72be6', 'modeles/fabrication.js?v=5a61f72be6', 'modeles/mise-en-page.js?v=5a61f72be6', 'modeles/note.js?v=5a61f72be6', 'modeles/quitus.js?v=5a61f72be6', 'modeles/reception.js?v=5a61f72be6',
>>>>>>> refonte
];

// Nom du cache : version + portée. La copie d'essai (essai/) et le vrai site ont chacun le leur,
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
