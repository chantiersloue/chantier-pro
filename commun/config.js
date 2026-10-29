// ═══════════════════════════════════════════════════════════════
// Loué App — configuration
// C'EST LE SEUL ENDROIT où l'adresse (URL) Apps Script est écrite.
// Après un NOUVEAU déploiement Apps Script, remplacer l'URL ci-dessous, puis uploader ce fichier sur GitHub.
// ═══════════════════════════════════════════════════════════════
(function () {
  var URL_PRODUCTION = 'https://script.google.com/macros/s/AKfycbw5M3sh6EFb0t_oXiZ7qUeQI60ePGredIz9UjjQAWSXUGoWx_M3p8QE0O7B5KqyBV8/exec';
  // Copie de test (Sheet « ChantierPro TEST ») : s'active en ouvrant l'appli avec ?env=test, se coupe avec ?env=prod
  var URL_TEST = '';

  var VERSION_APPLI = '4.1';

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

  // Mode test : bandeau rouge permanent, pour ne jamais confondre avec la vraie appli
  if (enTest) {
    document.addEventListener('DOMContentLoaded', function () {
      var b = document.createElement('div');
      b.textContent = URL_TEST
        ? 'MODE TEST — données de la copie TEST — revenir à la vraie appli : ajouter ?env=prod à l’adresse'
        : 'MODE TEST demandé mais aucune URL de test n’est réglée dans commun/config.js — rien ne sera envoyé';
      b.setAttribute('style', 'position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#B32E2E;color:#fff;' +
        'font:700 13px/1.3 sans-serif;padding:8px 12px;text-align:center;pointer-events:none');
      document.body.appendChild(b);
    });
  }
})();
