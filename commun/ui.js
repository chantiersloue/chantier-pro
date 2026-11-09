// ═══════════════════════════════════════════════════════════════
// Loué App — affichage commun : textes sûrs, messages, indicateur d'envoi
// Nécessite commun/api.js
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var LOUE = window.LOUE = window.LOUE || {};

  // Rend un texte inoffensif avant de l'insérer dans la page (un « < » ou un « " » tapé ne casse plus rien)
  LOUE.esc = function (s) {
    return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  // Message en bas de l'écran
  LOUE.message = function (texte, duree) {
    var t = document.getElementById('loue-message');
    if (!t) {
      t = document.createElement('div'); t.id = 'loue-message'; t.setAttribute('role', 'status');
      document.body.appendChild(t);
    }
    t.textContent = texte;
    t.className = 'loue-message visible';
    clearTimeout(t._minuteur);
    t._minuteur = setTimeout(function () { t.className = 'loue-message'; }, duree || 4000);
  };

  // ── Indicateur d'envoi, toujours visible : « ✓ Tout est envoyé » / « ⏳ 2 fiches en attente » ──
  // Si la page a prévu une place dans sa barre du haut (#loue-envoi-place), l'indicateur s'y met en version courte
  function indicateur() {
    var b = document.getElementById('loue-envoi');
    if (b) return b;
    var place = document.getElementById('loue-envoi-place');
    b = document.createElement('button');
    b.id = 'loue-envoi'; b.type = 'button'; b.className = 'loue-envoi ok';
    b.setAttribute('aria-live', 'polite');
    b.dataset.compact = place ? '1' : '';
    b.addEventListener('click', function () { afficherFile(); });
    (place || document.body).appendChild(b);
    return b;
  }
  var derniereListe = [];
  function majIndicateur(liste) {
    derniereListe = liste;
    var b = indicateur();
    var attente = liste.filter(function (e) { return e.etat !== 'erreur'; }).length;
    var erreurs = liste.length - attente;
    var compact = b.dataset.compact === '1';
    var long;
    if (!liste.length) {
      long = 'Tout est envoyé';
      b.className = 'loue-envoi ok' + (compact ? ' compact' : '');
      b.textContent = compact ? '✓' : '✓ ' + long;
    } else {
      long = (erreurs ? erreurs + ' fiche(s) à vérifier' : '') + (erreurs && attente ? ', ' : '') + (attente ? attente + ' fiche(s) en attente' : '');
      b.className = 'loue-envoi ' + (erreurs ? 'erreur' : 'attente') + (compact ? ' compact' : '');
      b.textContent = compact ? (erreurs ? '⚠ ' + erreurs : '⏳ ' + attente) : (erreurs ? '⚠ ' : '⏳ ') + long + ' — toucher';
    }
    b.setAttribute('aria-label', long + '. Toucher pour voir le détail.');
    b.title = long;
  }

  // Liste détaillée de la file, avec « Envoyer maintenant »
  function afficherFile() {
    var f = document.getElementById('loue-file');
    if (f) { f.remove(); return; }
    f = document.createElement('div'); f.id = 'loue-file'; f.className = 'loue-file';
    var lignes = derniereListe.map(function (e) {
      var d = new Date(e.cree);
      var heure = ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + ' ' + ('0' + d.getHours()).slice(-2) + 'h' + ('0' + d.getMinutes()).slice(-2);
      return '<li class="' + (e.etat === 'erreur' ? 'erreur' : '') + '"><b>' + LOUE.esc(e.libelle) + '</b> — ' + LOUE.esc(e.donnees.chantier || '') +
        '<br><small>' + heure + ' · ' + LOUE.esc(e.etat === 'erreur' ? 'À vérifier : ' + e.message : (e.message || 'en attente de réseau')) + '</small>' +
        (e.etat === 'erreur' ? '<br><button type="button" data-reessayer="' + LOUE.esc(e.id) + '">Réessayer</button> '
          + '<button type="button" data-abandonner="' + LOUE.esc(e.id) + '">Abandonner</button>' : '') + '</li>';
    }).join('');
    f.innerHTML = '<div class="loue-file-tete"><b>Fiches pas encore envoyées</b><button type="button" data-fermer>Fermer</button></div>' +
      (lignes ? '<ul>' + lignes + '</ul><button type="button" class="loue-btn" data-envoyer>Envoyer maintenant</button>'
              : '<p>Tout est envoyé.</p>') +
      '<p class="loue-file-aide">Les fiches restent dans le téléphone tant que le bureau ne les a pas reçues. Elles partent toutes seules dès que le réseau revient.</p>';
    f.addEventListener('click', function (ev) {
      var c = ev.target;
      if (c.hasAttribute('data-fermer')) f.remove();
      if (c.hasAttribute('data-envoyer')) {
        var aEnvoyer = derniereListe.filter(function (e) { return e.etat !== 'erreur'; }).length;
        LOUE.message(aEnvoyer ? 'Envoi en cours…' : 'Les fiches « à vérifier » ne partent qu’avec « Réessayer »', 6000);
        LOUE.viderFile(true); f.remove();
      }
      if (c.getAttribute('data-reessayer')) { LOUE.reessayer(c.getAttribute('data-reessayer')); f.remove(); }
      if (c.getAttribute('data-abandonner') && confirm('Abandonner définitivement cette fiche ? Elle ne sera jamais envoyée.')) {
        LOUE.abandonner(c.getAttribute('data-abandonner')); f.remove();
      }
    });
    document.body.appendChild(f);
  }

  if (LOUE.surEvenement) {
    LOUE.surEvenement(function (ev) {
      if (ev.type === 'file') majIndicateur(ev.liste);
      if (ev.type === 'envoyee') {
        var d = (ev.reponse && ev.reponse.data) || {};
        var sansMail = d.envoyes === 0 && !d.reportes && ev.reponse.code !== 'DEJA_RECU';
        LOUE.message((sansMail ? '⚠ Fiche « ' + ev.element.libelle + ' » enregistrée, mais aucun mail n’est parti'
          : '✓ Fiche « ' + ev.element.libelle + ' » envoyée') + (ev.reponse && ev.reponse.message ? ' — ' + ev.reponse.message : ''), sansMail ? 10000 : 6000);
      }
      if (ev.type === 'erreur') LOUE.message('⚠ Fiche « ' + ev.element.libelle + ' » refusée : ' + ev.element.message, 8000);
      if (ev.type === 'stockage') LOUE.message('⚠ Le téléphone ne peut pas garder les fiches : ' + (ev.message || 'stockage indisponible'), 8000);
    });
  }
  document.addEventListener('DOMContentLoaded', function () { indicateur(); if (LOUE.annoncerFile) LOUE.annoncerFile(); });
})();
