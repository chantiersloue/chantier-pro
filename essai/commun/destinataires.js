// ═══════════════════════════════════════════════════════════════
// Loué App — destinataires d'une fiche (adresses choisies dans la liste ou tapées à la main)
// Retour terrain : une adresse tapée sans toucher « + Ajouter » (donc sans bulle) partait dans le vide.
// Maintenant :
// - tant que le champ contient du texte, une ligne rappelle de toucher « + Ajouter » ;
// - au moment d'envoyer, une adresse valide restée dans le champ est ajoutée toute seule ;
//   une adresse incomplète bloque l'envoi avec un message clair.
// Éléments attendus dans la page : #dest-input, #dest-sugg, #dest-chips, #dest-ajouter.
// Nécessite commun/ui.js (LOUE.esc, LOUE.message) et commun/adresses.js (limite des adresses libres).
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var LOUE = window.LOUE = window.LOUE || {};
  var FORME = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

  // options : { contacts: () => [{ nom, email }] (listes du Sheet), aChange: () => {} (brouillon) }
  LOUE.destinataires = function (options) {
    var liste = [];
    var input = document.getElementById('dest-input');
    var sugg = document.getElementById('dest-sugg');
    var puces = document.getElementById('dest-chips');
    var rappel = document.createElement('div');
    rappel.className = 'dest-rappel'; rappel.hidden = true; rappel.setAttribute('role', 'status');
    input.closest('.dest-row').insertAdjacentElement('afterend', rappel);

    function contacts() { return (options.contacts ? options.contacts() : []).filter(function (u) { return u && u.email; }); }
    function prevenir() { if (options.aChange) options.aChange(); document.dispatchEvent(new Event('change')); }
    function afficher() {
      puces.innerHTML = liste.map(function (d, i) {
        return '<span class="dest-chip">' + LOUE.esc(d) + '<button type="button" aria-label="Retirer ' + LOUE.esc(d) + '" data-retirer="' + i + '">×</button></span>';
      }).join('');
    }
    function majRappel() {
      var v = input.value.trim();
      rappel.hidden = !v;
      if (v) rappel.textContent = FORME.test(v)
        ? '👉 Touchez « + Ajouter » pour valider cette adresse (sinon elle sera ajoutée à l’envoi).'
        : '👉 Adresse pas encore complète (exemple : nom@exemple.fr), puis touchez « + Ajouter ».';
    }
    function filtrer() {
      var v = input.value.trim().toLowerCase();
      var m = v ? contacts().filter(function (u) {
        return String(u.nom || '').toLowerCase().indexOf(v) > -1 || String(u.email).toLowerCase().indexOf(v) > -1;
      }).slice(0, 8) : [];
      if (!m.length) { sugg.classList.remove('open'); return; }
      sugg.innerHTML = m.map(function (u) {
        return '<div class="dest-sugg-item" data-email="' + LOUE.esc(u.email) + '">' + LOUE.esc(u.nom || '') + ' <small>' + LOUE.esc(u.email) + '</small></div>';
      }).join('');
      sugg.classList.add('open');
    }
    // Renvoie true si l'adresse du champ a été ajoutée (ou y était déjà), false sinon
    function ajouter() {
      var val = input.value.trim();
      sugg.classList.remove('open');
      if (!val) return true;
      if (!FORME.test(val)) {
        input.classList.add('error');
        LOUE.message('Adresse mail incomplète : « ' + val + ' » (exemple : nom@exemple.fr)', 6000);
        return false;
      }
      input.classList.remove('error');
      if (liste.some(function (d) { return d.toLowerCase() === val.toLowerCase(); })) { input.value = ''; majRappel(); return true; }
      if (window.LOUE_refuserAdresseLibre && window.LOUE_refuserAdresseLibre(val, liste, contacts())) { input.value = ''; majRappel(); return false; }
      liste.push(val); afficher(); input.value = ''; majRappel();
      prevenir();
      return true;
    }

    input.addEventListener('input', function () { input.classList.remove('error'); filtrer(); majRappel(); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); ajouter(); } });
    document.getElementById('dest-ajouter').addEventListener('click', ajouter);
    sugg.addEventListener('click', function (e) {
      var item = e.target.closest('[data-email]');
      if (!item) return;
      input.value = item.getAttribute('data-email');
      ajouter();
    });
    puces.addEventListener('click', function (e) {
      var b = e.target.closest('[data-retirer]');
      if (!b) return;
      liste.splice(Number(b.getAttribute('data-retirer')), 1); afficher(); prevenir();
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('.dest-row')) sugg.classList.remove('open'); });

    return {
      liste: function () { return liste.slice(); },
      remettre: function (l) { liste = (l || []).slice(); afficher(); },
      vider: function () { liste = []; afficher(); input.value = ''; input.classList.remove('error'); majRappel(); },
      // À appeler au début de l'envoi : true si on peut envoyer
      verifierAvantEnvoi: function () {
        var val = input.value.trim();
        if (!val) return true;
        if (ajouter()) { LOUE.message('Adresse « ' + val + ' » ajoutée aux destinataires', 5000); return true; }
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        input.focus();
        return false;
      },
    };
  };
})();
