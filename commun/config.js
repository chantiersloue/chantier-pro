// ═══════════════════════════════════════════════════════════════
// Loué App — configuration
// C'EST LE SEUL ENDROIT où l'adresse (URL) Apps Script est écrite.
// Après un NOUVEAU déploiement Apps Script : remplacer l'URL ci-dessous (c'est Claude qui le fait, avec
// « node outils/construire.js », puis une demande de fusion). Les téléphones redemandent toujours ce fichier
// au réseau d'abord : la nouvelle adresse leur arrive à l'ouverture suivante.
// ═══════════════════════════════════════════════════════════════
(function () {
  var URL_PRODUCTION = 'https://script.google.com/macros/s/AKfycbzBZgrVjXEGITq69xJ4sOeis-QlNNIcaHObnSQlOca8D4ZlNolH-hyiUcw6bbwyRM-x/exec';
  // Copie de test (Sheet « ChantierPro TEST ») : s'active en ouvrant l'appli avec ?env=test, se coupe avec ?env=prod
  var URL_TEST = 'https://script.google.com/macros/s/AKfycby2f8c3dSG8ZNHNFOf3xFmd-75jytlBBK-Ji87YpqhDU8V8nMjYSB66VhnRGepRykMZTg/exec';

  var VERSION_APPLI = '8.0';   // lot 3 (notes de chantier) ; 7.0 : lot 7 (signalements) ; 6.0 : lot 2 (comptes)

  function lire(cle) { try { return localStorage.getItem(cle); } catch (e) { return null; } }
  function ecrire(cle, v) { try { if (v === null) localStorage.removeItem(cle); else localStorage.setItem(cle, v); } catch (e) {} }

  var demande = null;
  try { demande = new URLSearchParams(location.search).get('env'); } catch (e) {}
  if (demande === 'test') ecrire('loue_env', 'test');
  if (demande === 'prod') ecrire('loue_env', null);

  var enTest = lire('loue_env') === 'test';
  window.LOUE_CONFIG = {
    env: enTest ? 'test' : 'prod',
    // Adresse volontairement invalide si le test n'est pas réglé : l'envoi échoue au lieu de partir ailleurs
    url: enTest ? (URL_TEST || 'https://url-test-non-reglee.invalid/') : URL_PRODUCTION,
    version: VERSION_APPLI,
  };

  // Développement uniquement (ordinateur, jamais GitHub Pages) : faux serveur local, ?api=http://127.0.0.1:8790/exec
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
    var api = null;
    try { api = new URLSearchParams(location.search).get('api'); } catch (e) {}
    if (api && /^http:\/\/127\.0\.0\.1:\d+\/exec$/.test(api)) { try { sessionStorage.setItem('loue_api', api); } catch (e) {} }
    var locale = null;
    try { locale = sessionStorage.getItem('loue_api'); } catch (e) {}
    if (locale) { window.LOUE_CONFIG.env = 'local'; window.LOUE_CONFIG.url = locale; }
  }

  // Mode test : bandeau rouge permanent, pour ne jamais confondre avec la vraie appli
  if (window.LOUE_CONFIG.env !== 'prod') {
    document.addEventListener('DOMContentLoaded', function () {
      var b = document.createElement('div');
      b.textContent = window.LOUE_CONFIG.env === 'local'
        ? 'MODE LOCAL (développement) — faux serveur sur l’ordinateur'
        : URL_TEST
          ? 'MODE TEST — copie TEST — pour revenir : ajouter ?env=prod à l’adresse'
          : 'MODE TEST demandé mais aucune URL de test n’est réglée — rien ne sera envoyé';
      document.body.classList.add('loue-test');
      b.setAttribute('style', 'position:fixed;left:0;right:0;top:0;height:40px;overflow:hidden;z-index:9999;background:#B32E2E;color:#fff;' +
        'font:700 12px/1.25 sans-serif;padding:6px 10px;text-align:center;pointer-events:none');
      document.body.appendChild(b);
    });
  }
})();
