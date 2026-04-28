// Service Worker — Loué App
const CACHE = 'loue-app-v1';
const ASSETS = [
  '/chantier-pro/',
  '/chantier-pro/index.html',
  '/chantier-pro/cotes.html',
  '/chantier-pro/fiche-fabrication.html',
  '/chantier-pro/note-reunion.html',
  '/chantier-pro/bordereau-orga.html',
  '/chantier-pro/bordereau-materiaux.html',
  '/chantier-pro/quitus.html',
  '/chantier-pro/manifest.json',
  '/chantier-pro/apple-touch-icon.png',
  '/chantier-pro/icon-192.png',
  '/chantier-pro/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Network first pour les requêtes Apps Script
  if(e.request.url.includes('script.google.com')) return;
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
