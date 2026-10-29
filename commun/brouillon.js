// ═══════════════════════════════════════════════════════════════
// Loué App — brouillon automatique (la protection anti-perte des gars)
// Garde dans le téléphone TOUT ce qui est saisi : champs, choix, photos, signatures, destinataires.
// - deux copies : tout sauf les photos dans localStorage (marche partout), tout avec photos dans IndexedDB ;
// - effacé seulement quand la fiche est rangée dans la file d'envoi (donc à l'abri) ;
// - tant que la personne n'a pas répondu à « Brouillon retrouvé », l'ancien brouillon est mis de côté, jamais écrasé ;
// - les anciens brouillons (avant la refonte) sont repris automatiquement.
// Nécessite commun/api.js (stockage IndexedDB) et commun/ui.js (messages).
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var LOUE = window.LOUE = window.LOUE || {};
  var ENV = (window.LOUE_CONFIG || {}).env || 'prod';

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
  // Copie sans les photos (Blob), pour localStorage
  function sansPhotos(v) {
    return JSON.parse(JSON.stringify(v, function (k, x) { return x instanceof Blob ? null : x; }));
  }

  // options : { cle, anciennesCles: [], capturer: () => extra, restaurer: (extra) => {}, pret: Promise (facultatif) }
  LOUE.brouillon = function (options) {
    var cle = 'brouillon_' + options.cle;
    var cleLocale = 'loue_brouillon_' + ENV + '_' + options.cle;
    var anciennes = ENV === 'prod' ? (options.anciennesCles || []) : [];
    var derniere = null, minuteur = null, actif = true, averti = false;
    var enAttente = null;   // brouillon retrouvé, en attente de la réponse de la personne

    function etat() {
      return { cle: cle, t: Date.now(), champs: champsDeLaPage(), extra: options.capturer ? options.capturer() : {} };
    }
    function empreinte(e) {
      // Les photos (Blob) ne se comparent pas en texte : on compte leur taille
      return JSON.stringify([e.champs, e.extra], function (k, v) { return v instanceof Blob ? 'blob:' + v.size : v; });
    }
    function ecrireLocal(c, e) {
      try { localStorage.setItem(c, JSON.stringify(sansPhotos(e))); return true; } catch (err) { return false; }
    }
    function sauver() {
      if (!actif) return Promise.resolve();
      var e = etat();
      var emp = empreinte(e);
      if (emp === derniere) return Promise.resolve();          // rien de neuf depuis la dernière sauvegarde
      derniere = emp;
      var okLocal = ecrireLocal(cleLocale, e);
      return mettreDeCote().then(function () { return LOUE.stockage.ecrire('brouillons', e); })
        .then(function () { return true; }, function () { return false; })
        .then(function (okBase) {
          if ((!okLocal || !okBase) && !averti && LOUE.message) {
            averti = true;
            LOUE.message(okLocal ? '⚠ Le téléphone ne peut pas garder les photos du brouillon (mémoire pleine ou navigation privée). Le texte est gardé.'
                                 : '⚠ Le téléphone ne peut pas garder le brouillon. Envoyez la fiche sans quitter la page.', 10000);
          }
        });
    }
    // La personne tape (ou envoie) sans avoir répondu à la bannière : l'ancien brouillon est mis de côté
    // sous « _precedent », jamais écrasé
    var deCote = false;
    function mettreDeCote() {
      if (!enAttente || deCote) return Promise.resolve();
      deCote = true;
      var ancien = Object.assign({}, enAttente, { cle: cle + '_precedent' });
      ecrireLocal(cleLocale + '_precedent', ancien);
      return LOUE.stockage.ecrire('brouillons', ancien).catch(function () {});
    }
    function differer() { clearTimeout(minuteur); minuteur = setTimeout(sauver, 700); }

    function lireLocal(c) {
      try { var v = JSON.parse(localStorage.getItem(c) || 'null'); return v && v.champs ? v : null; } catch (e) { return null; }
    }
    function lireAncien() {
      for (var i = 0; i < anciennes.length; i++) {
        try {
          var v = JSON.parse(localStorage.getItem(anciennes[i]) || 'null');
          if (v && (v.champs || v.t)) return { cle: cle, t: v.t || Date.now(), champs: v.champs || {}, extra: {} };
        } catch (e) {}
      }
      return null;
    }
    // garderPrecedent : un ancien brouillon jamais restauré reste disponible à la prochaine ouverture
    function effacerTout(garderPrecedent) {
      var locales = [cleLocale].concat(garderPrecedent ? [] : anciennes.concat([cleLocale + '_precedent']));
      locales.forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
      var cles = garderPrecedent ? [cle] : [cle, cle + '_precedent'];
      return Promise.all(cles.map(function (k) { return LOUE.stockage.supprimer('brouillons', k).catch(function () {}); }));
    }

    function banniere(sauve) {
      enAttente = sauve;
      var bar = document.createElement('div');
      bar.className = 'loue-brouillon no-print';
      bar.innerHTML = '<span>📝 Brouillon retrouvé (' + quand(sauve.t) + '). Le restaurer ?</span>'
        + '<button type="button" data-oui>Restaurer</button><button type="button" data-non>Repartir à zéro</button>';
      bar.querySelector('[data-oui]').onclick = function () {
        bar.remove();
        enAttente = null;
        Promise.resolve(options.pret).catch(function () {}).then(function () {
          remettreChamps(sauve.champs);
          if (options.restaurer) options.restaurer(sauve.extra || {});
          if (LOUE.message) LOUE.message('Brouillon restauré');
          sauver();
        });
      };
      bar.querySelector('[data-non]').onclick = function () {
        if (!confirm('Effacer ce brouillon ? Ce qui y était saisi (photos et signatures comprises) sera perdu.')) return;
        bar.remove(); enAttente = null;
        effacerTout().then(function () { derniere = null; sauver(); });
      };
      document.body.appendChild(bar);
    }

    // Démarrage : attendre les pré-remplissages (date…), puis prendre l'état de référence
    setTimeout(function () {
      derniere = empreinte(etat());
      document.addEventListener('input', differer, true);
      document.addEventListener('change', differer, true);
      setInterval(sauver, 4000);
      window.addEventListener('pagehide', sauver);
      document.addEventListener('loue-avant-maj', sauver);   // mise à jour de l'appli : on sauve avant de recharger
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') sauver(); });
      var lireBase = function (k) { return LOUE.stockage.lire('brouillons', k).catch(function () { return null; }); };
      Promise.all([lireBase(cle), lireBase(cle + '_precedent')]).then(function (r) {
        var sauve = r[0] || lireLocal(cleLocale) || r[1] || lireLocal(cleLocale + '_precedent') || lireAncien();
        if (sauve && (Object.keys(sauve.champs || {}).length || Object.keys(sauve.extra || {}).length)) banniere(sauve);
      });
    }, 500);

    return {
      sauverMaintenant: sauver,
      // À appeler quand la fiche est rangée dans la file d'envoi : elle ne peut plus être perdue
      effacer: function () {
        var garder = !!enAttente;   // bannière jamais répondue : l'ancien brouillon reste proposé la prochaine fois
        actif = false; clearTimeout(minuteur);
        var b = document.querySelector('.loue-brouillon'); if (b) b.remove();
        return mettreDeCote().then(function () { enAttente = null; return effacerTout(garder); });
      },
      reprendre: function () { actif = true; derniere = empreinte(etat()); },
    };
  };
})();
