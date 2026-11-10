// ═══════════════════════════════════════════════════════════════
// SERVICE WORKER DE SECOURS — à n'utiliser qu'en cas de gros problème avec l'appli hors-ligne.
// Mode d'emploi : sur GitHub, remplacer le contenu de « sw.js » (à la racine) par CE fichier, et valider.
// À la prochaine ouverture de l'appli, chaque téléphone supprime ses copies et redevient un site normal
// (il faut alors du réseau pour ouvrir l'appli). Les fiches en attente et les brouillons NE sont PAS effacés.
// Pour revenir au fonctionnement normal : remettre le vrai sw.js.
// ═══════════════════════════════════════════════════════════════
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', ev => {
  ev.waitUntil(caches.keys()
    .then(cles => Promise.all(cles.filter(k => k.indexOf('loue-') === 0).map(k => caches.delete(k))))
    .then(() => self.registration.unregister())
    .then(() => self.clients.matchAll({ type: 'window' }))
    .then(fenetres => fenetres.forEach(f => f.navigate(f.url))));
});
