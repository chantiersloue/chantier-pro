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
  if (!('serviceWorker' in navigator) || /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && !/[?&]sw=1/.test(location.search)) return;

  function proposer(reg) {
    if (!reg.waiting || document.getElementById('loue-maj')) return;
    var b = document.createElement('div');
    b.id = 'loue-maj'; b.className = 'loue-brouillon no-print';
    b.innerHTML = '<span>🔄 Nouvelle version de l’appli disponible.</span><button type="button" data-oui>Mettre à jour</button><button type="button" data-non>Plus tard</button>';
    b.querySelector('[data-oui]').onclick = function () {
      b.remove();
      // On sauve le brouillon avant de recharger
      document.dispatchEvent(new Event('loue-avant-maj'));
      setTimeout(function () { reg.waiting && reg.waiting.postMessage('activer'); }, 300);
    };
    b.querySelector('[data-non]').onclick = function () { b.remove(); };
    document.body.appendChild(b);
  }

  var recharge = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (recharge) return; recharge = true; location.reload();
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
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
  });

  // Place utilisée / disponible (pour l'écran « À propos » et avant les gros téléchargements du carnet)
  LOUE.placeTelephone = function () {
    if (!navigator.storage || !navigator.storage.estimate) return Promise.resolve(null);
    return navigator.storage.estimate().then(function (e) { return { utilise: e.usage || 0, quota: e.quota || 0 }; });
  };
})();
