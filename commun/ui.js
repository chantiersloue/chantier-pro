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

  // ── Connexion SANS quitter la page (envoi direct : le téléphone n'a pas pu garder la fiche, la quitter la perdrait) ──
  // Renvoie une promesse : true si la personne est connectée, false si elle a annulé.
  LOUE.demanderConnexion = function (raison) {
    return new Promise(function (fini) {
      var ancien = document.getElementById('loue-connexion'); if (ancien) ancien.remove();
      var f = document.createElement('div'); f.id = 'loue-connexion'; f.className = 'loue-file';
      var champ = 'style="display:block;width:100%;box-sizing:border-box;padding:12px;font-size:16px;margin:6px 0;border:1px solid #bbb;border-radius:8px"';
      f.innerHTML = '<div class="loue-file-tete"><b>Connexion</b></div>'
        + '<p data-raison style="margin:8px 0"></p>'
        + '<div data-etape1><input data-id ' + champ + ' placeholder="Identifiant" autocomplete="username" autocapitalize="none">'
        + '<input data-mdp type="password" ' + champ + ' placeholder="Mot de passe" autocomplete="current-password"></div>'
        + '<div data-etape2 hidden><p style="margin:8px 0">Mot de passe provisoire : choisissez le vôtre (8 caractères au moins).</p>'
        + '<input data-n1 type="password" ' + champ + ' placeholder="Nouveau mot de passe" autocomplete="new-password">'
        + '<input data-n2 type="password" ' + champ + ' placeholder="Le même, une 2e fois" autocomplete="new-password"></div>'
        + '<p data-erreur style="color:#B32E2E;margin:6px 0"></p>'
        + '<button type="button" class="loue-btn" data-ok>Se connecter et envoyer</button> '
        + '<button type="button" data-annuler>Annuler</button>';
      var $ = function (s) { return f.querySelector('[' + s + ']'); };
      $('data-raison').textContent = raison || 'Connectez-vous ici, sans quitter la page : la fiche partira juste après.';
      $('data-id').value = LOUE.dernierIdentifiant ? LOUE.dernierIdentifiant() : '';
      var provisoire = null;
      var fermer = function (ok) { f.remove(); fini(ok); };
      $('data-annuler').onclick = function () { fermer(false); };
      $('data-ok').onclick = function () {
        var id = $('data-id').value.trim().toLowerCase(), b = $('data-ok');
        var erreur = function (t) { $('data-erreur').textContent = t; };
        var apres = function (rep) {
          if (rep.ok) { fermer(true); return; }
          if (rep.code === 'NOUVEAU_MDP') { provisoire = $('data-mdp').value; $('data-etape1').hidden = true; $('data-etape2').hidden = false; erreur(''); return; }
          erreur(rep.message || 'Connexion refusée.');
        };
        b.disabled = true;
        var envoi;
        if (provisoire === null) {
          if (!id || !$('data-mdp').value) { erreur('Tapez votre identifiant et votre mot de passe.'); b.disabled = false; return; }
          envoi = LOUE.connexion(id, $('data-mdp').value);
        } else {
          var n1 = $('data-n1').value;
          if (n1.length < 8) { erreur('Le mot de passe doit faire au moins 8 caractères.'); b.disabled = false; return; }
          if (n1 !== $('data-n2').value) { erreur('Les deux mots de passe ne sont pas pareils.'); b.disabled = false; return; }
          envoi = LOUE.changerMotDePasse(id, provisoire, n1);
        }
        envoi.then(apres).catch(function () { erreur('Pas de réseau : réessayez quand le téléphone capte (gardez la page ouverte).'); })
          .then(function () { b.disabled = false; });
      };
      document.body.appendChild(f);
      ($('data-id').value ? $('data-mdp') : $('data-id')).focus();
    });
  };

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
