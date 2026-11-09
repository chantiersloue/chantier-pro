// ═══════════════════════════════════════════════════════════════
// Loué App — installation du mode hors-ligne et mises à jour
// - enregistre le service worker (sw.js) ;
// - une nouvelle version n'est JAMAIS activée en pleine saisie : un bandeau propose « Mettre à jour »,
//   le brouillon est sauvé, puis la page se recharge ;
// - demande au téléphone de garder les données (stockage « persistant »).
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var LOUE = window.LOUE = window.LOUE || {};

  // ── Installation sur l'écran d'accueil (lot 1.4) ──
  // iPhone / iPad (les iPad récents se présentent comme un Mac avec écran tactile)
  LOUE.estIPhone = function () {
    return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  };
  LOUE.estInstalle = function () {
    return navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  };
  // Android / PC : le navigateur propose lui-même l'installation ; on garde sa proposition pour un bouton « Installer »
  var propositionInstallation = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); propositionInstallation = e;
    document.dispatchEvent(new Event('loue-installable'));
  });
  LOUE.peutProposerInstallation = function () { return !!propositionInstallation; };
  LOUE.proposerInstallation = function () {
    if (!propositionInstallation) return Promise.resolve(false);
    var p = propositionInstallation; propositionInstallation = null;
    p.prompt();
    return p.userChoice.then(function (c) { return c && c.outcome === 'accepted'; }).catch(function () { return false; });
  };
  // Sur iPhone, dans Safari (appli pas installée), iOS peut effacer brouillons et fiches en attente après 7 jours
  // sans visite, et Safari et l'appli installée n'ont pas la même mémoire : on le dit sur chaque fiche.
  // (L'accueil affiche, lui, l'écran complet « Installer l'appli ».)
  document.addEventListener('DOMContentLoaded', function () {
    if (!LOUE.estIPhone() || LOUE.estInstalle() || document.body.hasAttribute('data-accueil')) return;
    try { if (sessionStorage.getItem('loue_avert_install')) return; } catch (e) {}
    var b = document.createElement('div');
    b.className = 'loue-avert-install no-print'; b.setAttribute('role', 'note');
    b.innerHTML = '<span>📲 Appli pas installée : sur iPhone, vos brouillons et fiches en attente peuvent être effacés. '
      + 'Ouvrez l’accueil et suivez « Installer l’appli ».</span><button type="button">OK</button>';
    b.querySelector('button').onclick = function () { b.remove(); try { sessionStorage.setItem('loue_avert_install', '1'); } catch (e) {} };
    document.body.insertBefore(b, document.body.firstChild);
  });
  // Place utilisée / disponible (pour l'écran « À propos » et avant les gros téléchargements du carnet)
  LOUE.placeTelephone = function () {
    if (!navigator.storage || !navigator.storage.estimate) return Promise.resolve(null);
    return navigator.storage.estimate().then(function (e) { return { utilise: e.usage || 0, quota: e.quota || 0 }; });
  };

  // ── Service worker (pas sur l'ordinateur de développement, sauf ?sw=1) ──
  if (!('serviceWorker' in navigator) || /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && !/[?&]sw=1/.test(location.search)) return;

  function proposer(reg) {
    if (!reg.waiting || document.getElementById('loue-maj')) return;
    var b = document.createElement('div');
    b.id = 'loue-maj'; b.className = 'loue-brouillon loue-maj no-print';
    b.innerHTML = '<span>🔄 Nouvelle version de l’appli disponible.</span><button type="button" data-oui>Mettre à jour</button><button type="button" data-non>Plus tard</button>';
    b.querySelector('[data-oui]').onclick = function () {
      b.remove();
      demande = true;
      // On sauve le brouillon avant de recharger
      document.dispatchEvent(new Event('loue-avant-maj'));
      setTimeout(function () { reg.waiting && reg.waiting.postMessage('activer'); }, 300);
    };
    b.querySelector('[data-non]').onclick = function () { b.remove(); };
    document.body.appendChild(b);
  }

  // Rechargement SEULEMENT si la personne a touché « Mettre à jour » (pas à la première installation)
  var recharge = false, demande = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (recharge || !demande) return; recharge = true; location.reload();
  });

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      proposer(reg);
      reg.addEventListener('updatefound', function () {
        var nouveau = reg.installing;
        if (!nouveau) return;
        nouveau.addEventListener('statechange', function () {
          if (nouveau.state === 'installed' && navigator.serviceWorker.controller) proposer(reg);
        });
      });
      // Vérifier les mises à jour au retour dans l'appli
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') reg.update().catch(function () {}); });
    }).catch(function () {});
    // Protection des données demandée une seule fois par téléphone (Firefox ouvre une fenêtre à chaque demande)
    var dejaDemande = false;
    try { dejaDemande = !!localStorage.getItem('loue_persist_demande'); localStorage.setItem('loue_persist_demande', '1'); } catch (e) {}
    if (!dejaDemande && navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
  });

})();
