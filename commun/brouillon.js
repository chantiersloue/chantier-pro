// ═══════════════════════════════════════════════════════════════
// Loué App — brouillon automatique (la protection anti-perte des gars)
// Garde dans le téléphone TOUT ce qui est saisi : champs, choix, photos, signatures, destinataires.
// Le brouillon n'est effacé que quand la fiche est rangée dans la file d'envoi (donc à l'abri).
// Les anciens brouillons (avant la refonte, dans localStorage) sont repris automatiquement.
// Nécessite commun/api.js (stockage IndexedDB).
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var LOUE = window.LOUE = window.LOUE || {};

  function champsDeLaPage() {
    var champs = {};
    document.querySelectorAll('input[id], select[id], textarea[id]').forEach(function (el) {
      if (el.type === 'file' || el.type === 'password' || el.readOnly || el.disabled || el.dataset.brouillon === 'non') return;
      champs[el.id] = (el.type === 'checkbox' || el.type === 'radio') ? { c: el.checked } : { v: el.value };
    });
    document.querySelectorAll('[contenteditable="true"][id]').forEach(function (el) { champs[el.id] = { h: el.innerHTML }; });
    return champs;
  }
  function remettreChamps(champs) {
    Object.keys(champs || {}).forEach(function (id) {
      var el = document.getElementById(id), o = champs[id];
      if (!el) return;
      if (o.h !== undefined) { el.innerHTML = o.h; return; }
      if (o.c !== undefined) el.checked = o.c;
      else {
        // Liste déroulante pas encore remplie (réseau lent) : on ajoute la valeur pour ne pas la perdre
        if (el.tagName === 'SELECT' && o.v && !Array.prototype.some.call(el.options, function (x) { return x.value === o.v; })) {
          var op = document.createElement('option'); op.value = o.v; op.textContent = o.v; el.appendChild(op);
        }
        el.value = o.v;
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }
  function quand(t) {
    var d = new Date(t || Date.now()), p = function (n) { return ('0' + n).slice(-2); };
    return p(d.getDate()) + '/' + p(d.getMonth() + 1) + ' à ' + p(d.getHours()) + 'h' + p(d.getMinutes());
  }

  // options : { cle, anciennesCles: [], capturer: () => extra, restaurer: (extra) => {}, pret: Promise }
  LOUE.brouillon = function (options) {
    var cle = 'brouillon_' + options.cle;
    var reference = null, minuteur = null, actif = true;

    function etat() {
      return { cle: cle, t: Date.now(), champs: champsDeLaPage(), extra: options.capturer ? options.capturer() : {} };
    }
    function empreinte(e) {
      // Les photos (Blob) ne se comparent pas en texte : on compte leur nombre et leur taille
      return JSON.stringify([e.champs, e.extra], function (k, v) { return v instanceof Blob ? 'blob:' + v.size : v; });
    }
    function sauver() {
      if (!actif) return Promise.resolve();
      var e = etat();
      if (empreinte(e) === reference) return Promise.resolve();   // rien de neuf depuis l'ouverture
      return LOUE.stockage.ecrire('brouillons', e).catch(function () {});
    }
    function differer() { clearTimeout(minuteur); minuteur = setTimeout(sauver, 700); }

    function lireAncien() {
      for (var i = 0; i < (options.anciennesCles || []).length; i++) {
        try {
          var brut = localStorage.getItem(options.anciennesCles[i]);
          var v = brut && JSON.parse(brut);
          if (v && (v.champs || v.t)) return { cle: cle, t: v.t || Date.now(), champs: v.champs || {}, extra: {} };
        } catch (e) {}
      }
      return null;
    }
    function effacerTout() {
      (options.anciennesCles || []).forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
      return LOUE.stockage.supprimer('brouillons', cle).catch(function () {});
    }

    function banniere(sauve) {
      var bar = document.createElement('div');
      bar.className = 'loue-brouillon no-print';
      bar.innerHTML = '<span>📝 Brouillon retrouvé (' + quand(sauve.t) + '). Le restaurer ?</span>'
        + '<button type="button" data-oui>Restaurer</button><button type="button" data-non>Repartir à zéro</button>';
      bar.querySelector('[data-oui]').onclick = function () {
        bar.remove();
        Promise.resolve(options.pret).catch(function () {}).then(function () {
          remettreChamps(sauve.champs);
          if (options.restaurer) options.restaurer(sauve.extra || {});
          LOUE.message('Brouillon restauré');
        });
      };
      bar.querySelector('[data-non]').onclick = function () { bar.remove(); effacerTout(); };
      document.body.appendChild(bar);
    }

    // Démarrage : attendre les pré-remplissages (date…), puis prendre l'état de référence
    setTimeout(function () {
      reference = empreinte(etat());
      document.addEventListener('input', differer, true);
      document.addEventListener('change', differer, true);
      setInterval(sauver, 4000);
      window.addEventListener('pagehide', sauver);
      document.addEventListener('loue-avant-maj', sauver);   // mise à jour de l'appli : on sauve avant de recharger
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') sauver(); });
      LOUE.stockage.lire('brouillons', cle).catch(function () { return null; }).then(function (sauve) {
        sauve = sauve || lireAncien();
        if (sauve && (Object.keys(sauve.champs || {}).length || Object.keys(sauve.extra || {}).length)) banniere(sauve);
      });
    }, 500);

    return {
      sauverMaintenant: sauver,
      // À appeler quand la fiche est rangée dans la file d'envoi : elle ne peut plus être perdue
      effacer: function () { actif = false; clearTimeout(minuteur); return effacerTout(); },
      reprendre: function () { actif = true; reference = empreinte(etat()); },
    };
  };
})();
