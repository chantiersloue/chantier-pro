// ═══════════════════════════════════════════════════════════════
// Loué App — brouillon automatique (la protection anti-perte des gars)
// Garde dans le téléphone TOUT ce qui est saisi : champs, choix, photos, signatures, destinataires.
// - deux copies : tout sauf les photos dans localStorage (marche partout), tout avec photos dans IndexedDB ;
// - effacé seulement quand la fiche est rangée dans la file d'envoi (donc à l'abri) ;
// - un brouillon proposé et resté sans réponse est mis de côté (5 au plus, 30 jours), jamais écrasé ;
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
      // Lot 2 : valeur mise par l'appli (chantier choisi à l'accueil, conducteur du chantier) et pas modifiée : pas une saisie
      if (el.dataset.auto !== undefined && el.dataset.auto !== '' && el.value === el.dataset.auto) champs[el.id].a = 1;
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

  // options : { cle, anciennesCles: [], capturer: () => extra, restaurer: (extra) => {}, pret: Promise (facultatif),
  //             convertirAncien: (ancien) => { t, champs, extra } (facultatif) }
  LOUE.brouillon = function (options) {
    var cle = 'brouillon_' + options.cle;
    var cleLocale = 'loue_brouillon_' + ENV + '_' + options.cle;
    var cleListe = cle + '_mis_de_cote';               // brouillons mis de côté (jamais restaurés), 5 au plus, 30 jours
    var cleListeLocale = cleLocale + '_mis_de_cote';
    var anciennes = ENV === 'prod' ? (options.anciennesCles || []) : [];
    var derniere = null, minuteur = null, actif = true;
    var enEchec = '';       // '' : brouillon bien gardé ; 'photos' : texte seul ; 'tout' : rien n'est gardé
    var enAttente = null;   // { etat, source: 'courant' | 'liste' } : proposé dans la bannière, sans réponse pour l'instant

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
    function lireLocal(c) {
      try { return JSON.parse(localStorage.getItem(c) || 'null'); } catch (e) { return null; }
    }
    function lireBase(k) { return LOUE.stockage.lire('brouillons', k).catch(function () { return null; }); }

    // ── Liste des brouillons mis de côté ──
    // Les 30 jours comptent depuis le jour où le brouillon a été RANGÉ dans la liste (« range »), pas depuis sa dernière
    // frappe : un brouillon ancien que l'on garde aujourd'hui est gardé 30 jours (après relecture indépendante, lot 13).
    function rangeLe(e) { return e.range || e.t; }
    var baseLisible = true;     // faux : la copie complète (avec photos) n'a pas pu être lue la dernière fois
    function lireListe() {
      // Fusion des deux copies (IndexedDB avec photos, localStorage sans) : rien n'est masqué si l'une est en retard
      return LOUE.stockage.lire('brouillons', cleListe).then(function (b) { baseLisible = true; return b; }, function () { baseLisible = false; return null; }).then(function (b) {
        var parT = {};
        (lireLocal(cleListeLocale) || []).concat((b && b.liste) || []).forEach(function (e) { if (e && e.t) parT[e.t] = e; });
        var limite = Date.now() - 30 * 24 * 3600 * 1000;
        return Object.keys(parT).map(function (k) { return parT[k]; })
          .filter(function (e) { return rangeLe(e) > limite; })
          .sort(function (x, y) { return y.t - x.t; });
      });
    }
    // Lot 13 : un brouillon GARDÉ EXPRÈS (« Garder pour plus tard », marque « garde ») n'est jamais poussé dehors par les
    // brouillons mis de côté tout seuls : ceux-ci gardent leur limite de 5 (les plus anciens laissent la place), ceux-là
    // ont la leur (GARDES_MAX, tenue au moment de garder : au-delà, la page refuse au lieu d'effacer).
    var GARDES_MAX = 5;
    function borner(liste) {
      var autos = 0;
      return liste.filter(function (e) { if (e.garde) return true; autos++; return autos <= 5; });   // liste triée du plus récent au plus ancien
    }
    // Nombre de brouillons de la liste que la page sait montrer : tenu à jour à chaque écriture, pour que la ligne
    // « Brouillons gardés (n) » n'ait pas à relire la liste (photos comprises) toutes les 4 secondes
    var nbListe = 0;
    function noterListe(liste) { nbListe = vierge ? liste.filter(contientQuelqueChose).length : liste.length; }
    function ecrireListe(liste) {
      liste = borner(liste);
      noterListe(liste);
      try { localStorage.setItem(cleListeLocale, JSON.stringify(liste.map(sansPhotos))); } catch (e) {}
      return LOUE.stockage.ecrire('brouillons', { cle: cleListe, liste: liste }).catch(function () {});
    }
    // Écriture VÉRIFIÉE de la liste (avant d'effacer quoi que ce soit ailleurs) : vrai seulement si la copie complète
    // (avec photos) est rangée, ou si la copie texte l'est et qu'aucun brouillon de la liste ne contient de photo
    // La copie complète est écrite D'ABORD : si elle est refusée et qu'il y a des photos, rien n'est écrit du tout (pas de
    // copie sans photos qui ferait croire que c'est gardé).
    function ecrireListeSure(liste) {
      liste = borner(liste);
      var ecrireLocalement = function () {
        try { localStorage.setItem(cleListeLocale, JSON.stringify(liste.map(sansPhotos))); return true; } catch (e) { return false; }
      };
      var sansPhoto = liste.every(function (e) { return empreinte(e).indexOf('"blob:') < 0; });
      return LOUE.stockage.ecrire('brouillons', { cle: cleListe, liste: liste }).then(function () { ecrireLocalement(); noterListe(liste); return true; },
        function () { if (!sansPhoto) return false; var ok = ecrireLocalement(); if (ok) noterListe(liste); return ok; });
    }
    // Garde un brouillon exprès. Rend 'ok', 'plein' (déjà GARDES_MAX brouillons gardés) ou 'echec' (le téléphone refuse).
    // enPartance (facultatif) : l'heure d'un brouillon gardé qui va sortir de la liste juste après (celui qu'on reprend) ;
    // il n'est pas compté dans la limite, mais il RESTE dans la liste tant qu'il n'est pas remis dans la fiche.
    function garderExpres(e, enPartance) {
      return lireListe().then(function (liste) {
        liste = liste.filter(function (x) { return x.t !== e.t; });
        // seuls comptent les brouillons que la liste sait montrer (on peut toujours les reprendre ou les effacer)
        if (liste.filter(function (x) { return x.garde && x.t !== enPartance && contientQuelqueChose(x); }).length >= GARDES_MAX) return 'plein';
        liste.unshift(Object.assign({}, e, { cle: cle, garde: true, range: Date.now() }));
        liste.sort(function (x, y) { return y.t - x.t; });
        return ecrireListeSure(liste).then(function (ok) {
          if (!ok) return 'echec';
          // RELU avant de dire « gardé » : le brouillon doit ressortir de la liste (jamais « gardé » sur parole)
          return lireListe().then(function (relue) { return relue.some(function (x) { return x.t === e.t && x.garde; }) ? 'ok' : 'echec'; });
        });
      });
    }
    function ajouterALaListe(e) {
      return lireListe().then(function (liste) {
        if (liste.some(function (x) { return x.t === e.t; })) return;
        liste.unshift(Object.assign({}, e, { cle: cle, range: Date.now() }));
        return ecrireListe(liste);
      });
    }
    function retirerDeLaListe(t) {
      return lireListe().then(function (liste) { return ecrireListe(liste.filter(function (x) { return x.t !== t; })); });
    }

    // La personne tape (ou envoie) sans avoir répondu à la bannière : le brouillon proposé est mis de côté
    var deCote = false;
    function mettreDeCote() {
      if (!enAttente || deCote || enAttente.source !== 'courant') return Promise.resolve();
      deCote = true;
      return ajouterALaListe(enAttente.etat);
    }

    // Bandeau rouge qui reste affiché tant que le brouillon n'est pas gardé (en haut : il ne cache pas les boutons du bas)
    var TEXTES_ECHEC = {
      photos: '⚠ Photos non gardées dans le brouillon (mémoire du téléphone pleine ?). Le texte est gardé. Envoyez la fiche avant de fermer la page.',
      tout: '⚠ Brouillon NON enregistré (mémoire du téléphone pleine ?). Envoyez la fiche avant de fermer la page, sinon la saisie sera perdue.',
    };
    function signalerEchec(niveau) {
      if (niveau === enEchec) return;
      var ancien = enEchec;
      enEchec = niveau;
      var bar = document.getElementById('loue-brouillon-alerte');
      if (!niveau) {
        if (bar) bar.remove();
        var durable = document.querySelector('#loue-message.visible[data-durable]');
        if (ancien && LOUE.message && !durable) LOUE.message('✓ Brouillon de nouveau enregistré dans le téléphone');
        return;
      }
      if (!bar) {
        bar = document.createElement('div');
        bar.id = 'loue-brouillon-alerte'; bar.className = 'loue-brouillon-alerte no-print'; bar.setAttribute('role', 'alert');
        bar.innerHTML = '<span></span><button type="button">Compris</button>';
        bar.querySelector('button').onclick = function () { bar.hidden = true; };
        document.body.appendChild(bar);
      }
      bar.hidden = false;
      bar.querySelector('span').textContent = TEXTES_ECHEC[niveau];
    }
    var persistanceDemandee = false;
    function demanderPersistance(e) {
      // Demande au navigateur de ne pas effacer seul les données de l'appli quand le téléphone manque de place
      if (persistanceDemandee || !navigator.storage || !navigator.storage.persist) return;
      if (empreinte(e).indexOf('"blob:') < 0) return;            // seulement quand le brouillon contient des photos
      persistanceDemandee = true;
      navigator.storage.persisted().then(function (oui) { return oui || navigator.storage.persist(); }).catch(function () {});
    }

    function sauver() {
      if (!actif) return Promise.resolve();
      var e = etat();
      var m = marqueEnvoye(); if (m && e.t <= m) e.t = m + 1;
      var emp = empreinte(e);
      if (emp === derniere) return Promise.resolve();          // rien de neuf depuis la dernière sauvegarde
      derniere = emp;
      var okLocal = ecrireLocal(cleLocale, e);
      // Limite de 8 s : une mémoire bloquée (autre fenêtre figée) fait apparaître le bandeau rouge au lieu de rien
      var sauvegarde = new Promise(function (ok, ko) {
        var fini = false;
        var minuteur = setTimeout(function () {
          if (fini) return;
          fini = true; derniere = null;   // nouvel essai à la prochaine sauvegarde
          if (LOUE.noterIncident) LOUE.noterIncident('Sauvegarde du brouillon bloquée (plus de 8 s)');
          ko(new Error('mémoire bloquée'));
        }, 8000);
        mettreDeCote().then(function () { return LOUE.stockage.ecrire('brouillons', e); })
          .then(function (v) { if (!fini) { fini = true; clearTimeout(minuteur); ok(v); } },
                function (err) { if (!fini) { fini = true; clearTimeout(minuteur); ko(err); } });
      });
      return sauvegarde
        .then(function () { return true; }, function () { return false; })
        .then(function (okBase) {
          // La copie complète (IndexedDB) suffit ; la copie texte (localStorage) n'est qu'une sécurité de plus
          if (okBase) { signalerEchec(''); demanderPersistance(e); return; }
          derniere = null;                                       // échec : on réessaiera au prochain passage (4 s)
          signalerEchec(okLocal ? 'photos' : 'tout');
        });
    }
    function differer() { clearTimeout(minuteur); minuteur = setTimeout(sauver, 700); }

    function lireAncien() {
      for (var i = 0; i < anciennes.length; i++) {
        var v = lireLocal(anciennes[i]);
        if (!v || typeof v !== 'object') continue;
        // Format propre à une page (ex. cotes : champs « id: valeur » + lignes ; attestation : un objet à plat,
        // sans « t » ni « champs ») : la page fournit la conversion, qui renvoie null si rien n'est à reprendre
        if (options.convertirAncien) {
          var c = null;
          try { c = options.convertirAncien(v); } catch (e) { c = null; }
          if (!c) continue;
          return { cle: cle, t: c.t || Date.now(), champs: c.champs || {}, extra: c.extra || {} };
        }
        if (!(v.champs || v.t)) continue;
        return { cle: cle, t: v.t || Date.now(), champs: v.champs || {}, extra: {} };
      }
      return null;
    }
    // Brouillon courant : la copie la PLUS RÉCENTE ; si c'est celle de localStorage (sans photos),
    // on y rattache les photos de la copie IndexedDB
    function lireCourant() {
      var envoye = marqueEnvoye();
      return lireBase(cle).then(function (base) {
        if (base && envoye && (base.t || 0) <= envoye) base = null;     // fiche déjà envoyée (effacement pas terminé)
        var local = lireLocal(cleLocale);
        if (local && envoye && (local.t || 0) <= envoye) local = null;
        if (local && local.champs && (!base || (local.t || 0) > (base.t || 0))) {
          if (base && base.extra && local.extra) rattacherPhotos(local.extra, photosParId(base.extra, {}));
          return local;
        }
        return base || lireAncien();
      });
    }
    // Toutes les photos (Blob) d'un brouillon, rangées par identifiant, où qu'elles soient (listes, blocs…)
    function photosParId(v, carte) {
      if (Array.isArray(v)) v.forEach(function (x) { photosParId(x, carte); });
      else if (v && typeof v === 'object' && !(v instanceof Blob)) {
        if (v.id && v.blob instanceof Blob) carte[v.id] = v.blob;
        Object.keys(v).forEach(function (k) { photosParId(v[k], carte); });
      }
      return carte;
    }
    // Remet dans la copie texte (sans photos) chaque photo retrouvée par son identifiant dans la copie complète
    function rattacherPhotos(v, carte) {
      if (Array.isArray(v)) v.forEach(function (x) { rattacherPhotos(x, carte); });
      else if (v && typeof v === 'object') {
        if (v.id && !(v.blob instanceof Blob) && carte[v.id]) v.blob = carte[v.id];
        Object.keys(v).forEach(function (k) { if (k !== 'blob') rattacherPhotos(v[k], carte); });
      }
    }
    // Un brouillon ne vaut la peine d'être proposé que s'il contient autre chose que la page vierge
    var vierge = null;
    function contientQuelqueChose(e) {
      if (!e) return false;
      var v = vierge || { champs: {}, extra: {} };
      var champs = e.champs || {};
      var saisi = Object.keys(champs).some(function (id) {
        var o = champs[id] || {}, ref = v.champs[id] || {};
        if (o.a) return false;                                   // rempli automatiquement, pas touché
        if (o.c !== undefined) return o.c !== (ref.c === undefined ? false : ref.c);
        if (o.h !== undefined) return String(o.h).replace(/<[^>]*>|&nbsp;|\s/g, '') !== '' && o.h !== ref.h;
        return String(o.v || '').trim() !== '' && o.v !== ref.v;
      });
      var texte = function (x) { return JSON.stringify(x || {}, function (k, y) { return y instanceof Blob ? 'blob' : y; }); };
      return saisi || texte(e.extra) !== texte(v.extra);
    }
    // jusqua (facultatif) : n'efface que les copies au plus aussi récentes (une saisie plus récente, celle de la
    // fiche suivante, n'est jamais effacée par un effacement en retard)
    function effacerCourant(jusqua) {
      anciennes.forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
      var l = lireLocal(cleLocale);
      if (!jusqua || !l || (l.t || 0) <= jusqua) { try { localStorage.removeItem(cleLocale); } catch (e) {} }
      if (!jusqua) return LOUE.stockage.supprimer('brouillons', cle).catch(function () {});
      // Une seule transaction : une sauvegarde de la fiche suivante, mise en attente entre-temps, n'est jamais effacée
      return LOUE.stockage.supprimerSi('brouillons', cle, function (b) { return (b.t || 0) > jusqua; }).catch(function () {});
    }
    // Marque « fiche envoyée » : tant que l'effacement n'a pas abouti, une copie plus ancienne n'est plus proposée
    var cleEnvoye = cleLocale + '_envoye';
    function marqueEnvoye() { try { return Number(localStorage.getItem(cleEnvoye) || 0); } catch (e) { return 0; } }

    function banniere(proposition) {
      enAttente = proposition;
      var sauve = proposition.etat;
      var bar = document.createElement('div');
      bar.className = 'loue-brouillon no-print';
      // Lot 2 : le chantier du brouillon est affiché (la page a pu être ouverte depuis un AUTRE chantier)
      var chantierSauve = options.champChantier && sauve.champs && sauve.champs[options.champChantier] ? String(sauve.champs[options.champChantier].v || '').trim() : '';
      var chantierIci = options.champChantier && document.getElementById(options.champChantier) ? document.getElementById(options.champChantier).value.trim() : '';
      var autre = chantierSauve && chantierIci && chantierSauve.toLowerCase() !== chantierIci.toLowerCase();
      bar.innerHTML = '<span>📝 ' + (proposition.source === 'liste' ? 'Brouillon mis de côté' : 'Brouillon retrouvé') + ' (' + quand(sauve.t) + ')'
        + (chantierSauve ? ' — chantier <strong>' + LOUE.esc(chantierSauve) + '</strong>' + (autre ? ' (pas celui ouvert : ' + LOUE.esc(chantierIci) + ')' : '') : '')
        + '. Le restaurer ?</span>'
        + '<button type="button" data-oui>Restaurer</button><button type="button" data-garder>Garder pour plus tard</button>'
        + '<button type="button" data-non>Repartir à zéro</button>';
      // Lot 13 — « Garder pour plus tard » : le brouillon proposé est rangé dans les brouillons gardés (il n'est plus proposé à
      // chaque ouverture, il attend dans la liste) ; la page reste telle qu'elle est, pour une autre fiche
      bar.querySelector('[data-garder]').onclick = function () {
        var bouton = this;
        bouton.disabled = true;
        garderExpres(sauve).then(function (resultat) {
          bouton.disabled = false;
          // Déjà 5 brouillons gardés : la liste s'ouvre, avec l'explication, pour en reprendre ou en effacer un (le bandeau reste)
          if (resultat === 'plein') { ouvrirPanneau(TEXTE_PLEIN); return; }
          if (resultat !== 'ok') { if (LOUE.message) LOUE.message(TEXTE_REFUS, 9000); return; }
          bar.remove(); enAttente = null;
          var suite = Promise.resolve();
          // Proposé comme brouillon courant et pas encore mis de côté : il est maintenant dans la liste, il n'est plus « le courant »
          if (proposition.source === 'courant' && !deCote) suite = effacerCourant(sauve.t).then(apresEffacement);
          Promise.resolve(suite).then(function () {
            if (LOUE.message) LOUE.message('📝 Brouillon gardé. Vous le retrouverez dans « Brouillons gardés », en haut de cette fiche.', 7000);
            majPastille();
          });
        }, function () { bouton.disabled = false; if (LOUE.message) LOUE.message(TEXTE_REFUS, 9000); });
      };
      bar.querySelector('[data-oui]').onclick = function () {
        bar.remove();
        enAttente = null;
        majPastille();
        // Déjà tapé quelque chose avant de répondre : on le garde de côté au lieu de l'écraser,
        // et le brouillon restauré sort de la liste (sinon il serait reproposé après l'envoi : double envoi)
        var maintenant = etat();
        var garder = (deCote || proposition.source === 'liste') && contientQuelqueChose(maintenant);
        var avant = garder ? ajouterALaListe(maintenant) : Promise.resolve();
        if (garder && LOUE.message) LOUE.message('Ce que vous veniez de taper est mis de côté (proposé à la prochaine ouverture)', 6000);
        avant.then(function () { return (proposition.source === 'liste' || deCote) ? retirerDeLaListe(sauve.t) : null; })
          .then(function () { return options.pret; }).catch(function () {})
          .then(function () {
            remettreChamps(sauve.champs);
            if (options.restaurer) options.restaurer(sauve.extra || {});
            if (LOUE.message) LOUE.message('Brouillon restauré');
            derniere = null; sauver();
          });
      };
      bar.querySelector('[data-non]').onclick = function () {
        if (!confirm('Effacer ce brouillon ? Ce qui y était saisi (photos et signatures comprises) sera perdu.')) return;
        bar.remove(); enAttente = null;
        majPastille();
        // Brouillon proposé déjà mis de côté (on avait commencé à taper) : il sort de la liste ; ce qui est à l'écran reste
        if (proposition.source === 'liste' || deCote) { retirerDeLaListe(sauve.t).then(function () { derniere = null; sauver(); }); return; }
        // Sinon la page est vierge : on efface, et l'état vierge devient la référence (rien n'est réenregistré,
        // la bannière ne reviendra pas à la prochaine ouverture)
        effacerCourant().then(apresEffacement);
      };
      document.body.appendChild(bar);
    }
    // Le brouillon courant vient d'être effacé (ou rangé ailleurs). Si la page est vierge, cet état vierge devient la référence.
    // Mais si la personne a DÉJÀ tapé quelque chose que la sauvegarde automatique n'avait pas encore pris (elle passe 0,7 s après
    // une frappe, 4 s après un ajout de ligne), ce qui est à l'écran est enregistré tout de suite : jamais déclaré « déjà gardé »
    // alors que rien ne l'est (après relecture indépendante, lot 13).
    function apresEffacement() {
      if (contientQuelqueChose(etat())) { derniere = null; return sauver(); }
      derniere = empreinte(etat());
    }

    // ══ Lot 13 — « Garder pour plus tard » et « Brouillons gardés » ══
    // Une ligne discrète en haut de la fiche : « 📝 Brouillons gardés (2) » dès qu'il y en a (elle ouvre la liste) ; sinon
    // « 📝 Garder pour plus tard » dès que la fiche contient quelque chose. Cachée tant que le bandeau attend une réponse.
    // RIEN N'EST JAMAIS ÉCRASÉ : garder la fiche en cours ou reprendre un brouillon commence toujours par ranger, et par
    // VÉRIFIER qu'il est rangé (relu), ce qui est à l'écran ; au moindre doute, rien n'est effacé et la page le dit.
    var TEXTE_PLEIN = '⚠ Déjà ' + GARDES_MAX + ' brouillons gardés pour cette fiche : reprenez-en un ou effacez-en un d’abord.';
    var TEXTE_REFUS = '⚠ Le téléphone n’a pas pu garder ce brouillon (mémoire pleine ?). Rien n’a été effacé.';
    var cleReprise = cleLocale + '_reprendre';     // « reprendre ce brouillon » : posé juste avant de recharger la page
    var pastille = null;
    var enRoute = false;                           // un rangement est en cours (garder, reprendre) : pas de second geste par-dessus
    function limite(e) { var d = new Date(rangeLe(e) + 30 * 24 * 3600 * 1000), p = function (n) { return ('0' + n).slice(-2); }; return p(d.getDate()) + '/' + p(d.getMonth() + 1); }
    function chantierDe(e) {
      return options.champChantier && e.champs && e.champs[options.champChantier] ? String(e.champs[options.champChantier].v || '').trim() : '';
    }
    // La ligne du haut : dessinée d'après le nombre tenu en mémoire (noterListe), sans relire la liste
    function majPastille() {
      if (!vierge) return;
      if (!pastille) {
        pastille = document.createElement('button');
        pastille.type = 'button'; pastille.className = 'loue-brouillons-pastille no-print'; pastille.hidden = true;
        pastille.onclick = function () { if (pastille.dataset.mode === 'liste') ouvrirPanneau(); else garderEnCours(); };
        var ou = document.querySelector('.main') || document.body;
        ou.insertBefore(pastille, ou.firstChild);
      }
      var plein = actif && contientQuelqueChose(etat());
      pastille.dataset.mode = nbListe ? 'liste' : 'garder';
      pastille.textContent = nbListe ? '📝 Brouillons gardés (' + nbListe + ')' : '📝 Garder pour plus tard';
      pastille.hidden = !!enAttente || !actif || (!nbListe && !plein);
    }
    function fermerPanneau() { var p = document.getElementById('loue-brouillons-panneau'); if (p) p.remove(); }
    // Un refus doit se VOIR : la liste ouverte l'affiche en tête ; sinon un message (la liste fermée ne le cache pas)
    function refuser(resultat) {
      if (resultat === 'plein') { ouvrirPanneau(TEXTE_PLEIN); return; }
      fermerPanneau();
      if (LOUE.message) LOUE.message(TEXTE_REFUS, 0);
    }
    // Efface le brouillon courant (il vient d'être rangé dans la liste, relu) puis recharge la fiche. L'effacement a 3 secondes :
    // une mémoire bloquée ne laisse pas la page sans sauvegarde ; au pire le brouillon existe en double, jamais zéro fois.
    function effacerPuisRepartir(jusqua) {
      actif = false; clearTimeout(minuteur);
      var minuteur3 = null;
      return Promise.race([effacerCourant(jusqua), new Promise(function (ok) {
        minuteur3 = setTimeout(function () { if (LOUE.noterIncident) LOUE.noterIncident('Effacement du brouillon lent (plus de 3 s) avant de repartir'); ok(); }, 3000);
      })]).then(function () { clearTimeout(minuteur3); location.reload(); return true; });
    }
    // « Garder la fiche en cours pour plus tard » : rangée (vérifié), puis la fiche repart vide
    function garderEnCours() {
      if (enRoute) return Promise.resolve(false);
      var e = etat();
      if (!contientQuelqueChose(e)) { if (LOUE.message) LOUE.message('Cette fiche est vide : rien à garder.', 4000); return Promise.resolve(false); }
      if (!confirm('Garder cette fiche pour plus tard ?\n\nElle sera rangée dans « Brouillons gardés » (30 jours) et la fiche repartira vide.')) return Promise.resolve(false);
      enRoute = true;
      return garderExpres(e).then(function (resultat) {
        if (resultat !== 'ok') { enRoute = false; refuser(resultat); return false; }
        return effacerPuisRepartir(e.t);
      }, function () { enRoute = false; refuser('echec'); return false; });
    }
    // « Reprendre » un brouillon gardé : ce qui est à l'écran est d'abord gardé à son tour (écriture vérifiée), puis la fiche
    // est rechargée et le brouillon choisi y est remis (voir la reprise au démarrage)
    function reprendre(e) {
      if (enRoute) return Promise.resolve(false);
      var maintenant = etat(), aGarder = contientQuelqueChose(maintenant);
      enRoute = true;
      var avant = aGarder ? garderExpres(maintenant, e.t) : Promise.resolve('ok');
      return avant.then(function (resultat) {
        if (resultat !== 'ok') { enRoute = false; refuser(resultat); return false; }
        try { sessionStorage.setItem(cleReprise, String(e.t)); } catch (x) {}
        if (aGarder) return effacerPuisRepartir(maintenant.t);
        actif = false; clearTimeout(minuteur); location.reload();
        return true;
      }, function () { enRoute = false; refuser('echec'); return false; });
    }
    // avis (facultatif) : une phrase affichée en tête de la liste (par exemple un refus)
    function ouvrirPanneau(avis) {
      fermerPanneau();
      lireListe().then(function (liste) {
        var utiles = liste.filter(contientQuelqueChose);
        noterListe(liste);
        var fond = document.createElement('div');
        fond.id = 'loue-brouillons-panneau'; fond.className = 'loue-brouillons-fond no-print';
        fond.setAttribute('role', 'dialog'); fond.setAttribute('aria-modal', 'true'); fond.setAttribute('aria-label', 'Brouillons gardés');
        var boite = document.createElement('div'); boite.className = 'loue-brouillons-boite';
        var titre = document.createElement('h2'); titre.textContent = 'Brouillons gardés de cette fiche';
        boite.appendChild(titre);
        if (avis) { var a = document.createElement('p'); a.className = 'loue-brouillons-avis'; a.setAttribute('role', 'alert'); a.textContent = avis; boite.appendChild(a); }
        if (!baseLisible) {
          var b = document.createElement('p'); b.className = 'loue-brouillons-avis';
          b.textContent = '⚠ Le téléphone n’arrive pas à lire les photos des brouillons pour l’instant : fermez cette liste et réessayez dans un moment avant de reprendre un brouillon qui en contient.';
          boite.appendChild(b);
        }
        var fermer = function () { fond.remove(); majPastille(); };
        if (!utiles.length) { var rien = document.createElement('p'); rien.textContent = 'Aucun brouillon gardé.'; boite.appendChild(rien); }
        utiles.forEach(function (e) {
          var ligne = document.createElement('div'); ligne.className = 'loue-brouillons-ligne';
          var texte = document.createElement('div'); texte.className = 'loue-brouillons-texte';
          var quoi = document.createElement('strong'); quoi.textContent = chantierDe(e) || 'Sans chantier';
          var detail = document.createElement('span'); detail.textContent = 'du ' + quand(e.t) + ' — gardé jusqu’au ' + limite(e);
          texte.appendChild(quoi); texte.appendChild(detail);
          var b1 = document.createElement('button'); b1.type = 'button'; b1.className = 'loue-brouillons-reprendre'; b1.textContent = 'Reprendre';
          b1.onclick = function () { reprendre(e); };
          var b2 = document.createElement('button'); b2.type = 'button'; b2.className = 'loue-brouillons-effacer'; b2.textContent = 'Effacer';
          b2.onclick = function () {
            if (enRoute || !confirm('Effacer ce brouillon gardé ? Ce qui y était saisi (photos et signatures comprises) sera perdu.')) return;
            retirerDeLaListe(e.t).then(function () { ouvrirPanneau(); });
          };
          ligne.appendChild(texte); ligne.appendChild(b1); ligne.appendChild(b2);
          boite.appendChild(ligne);
        });
        var bas = document.createElement('div'); bas.className = 'loue-brouillons-bas';
        if (actif && contientQuelqueChose(etat())) {
          var g = document.createElement('button'); g.type = 'button'; g.className = 'loue-brouillons-garder'; g.textContent = 'Garder la fiche en cours pour plus tard';
          g.onclick = function () { garderEnCours(); };
          bas.appendChild(g);
        }
        var f = document.createElement('button'); f.type = 'button'; f.className = 'loue-brouillons-fermer'; f.textContent = 'Fermer';
        f.onclick = fermer;
        bas.appendChild(f);
        boite.appendChild(bas);
        fond.appendChild(boite);
        fond.addEventListener('click', function (ev) { if (ev.target === fond) fermer(); });
        document.body.appendChild(fond);
        majPastille();
      });
    }
    // Au démarrage : « reprendre ce brouillon » demandé juste avant le rechargement. Le brouillon est remis dans la fiche,
    // enregistré comme brouillon courant, et il ne sort de la liste qu'UNE FOIS cet enregistrement réussi.
    function repriseDemandee(liste) {
      var t = 0;
      try { t = Number(sessionStorage.getItem(cleReprise) || 0); sessionStorage.removeItem(cleReprise); } catch (x) {}
      if (!t) return null;
      return liste.filter(function (e) { return e.t === t; })[0] || null;
    }
    function remettre(e) {
      // La copie complète (avec photos) n'a pas pu être lue : le brouillon vu ici vient de la copie texte, SANS ses photos.
      // Il n'est pas remis dans la fiche (il en sortirait sans photos, et la bonne copie serait retirée de la liste) : il
      // reste dans « Brouillons gardés », et la page le dit.
      if (!baseLisible) {
        if (LOUE.message) LOUE.message('⚠ Le téléphone n’arrive pas à lire les brouillons gardés pour l’instant. Rien n’est perdu : rouvrez « Brouillons gardés » dans un moment.', 0);
        return Promise.resolve();
      }
      return Promise.resolve(options.pret).catch(function () {}).then(function () {
        remettreChamps(e.champs);
        if (options.restaurer) options.restaurer(e.extra || {});
        derniere = null;
        return sauver();
      }).then(function () {
        if (enEchec) { if (LOUE.message) LOUE.message('Brouillon repris. Il reste aussi dans « Brouillons gardés » (le téléphone n’a pas pu l’enregistrer ici).', 9000); return; }
        if (LOUE.message) LOUE.message('Brouillon repris');
        return retirerDeLaListe(e.t);
      });
    }
    // Une fiche présente à la fois comme brouillon courant et dans la liste (page fermée au milieu d'un rangement) : la
    // copie de la liste est retirée, pour qu'elle ne reste pas dans « Brouillons gardés » après l'envoi (risque de double envoi)
    function retirerDoublons(courant, liste) {
      if (!contientQuelqueChose(courant)) return Promise.resolve(liste);
      var meme = empreinte(courant), doubles = liste.filter(function (e) { return empreinte(e) === meme; });
      if (!doubles.length) return Promise.resolve(liste);
      return ecrireListe(liste.filter(function (e) { return doubles.indexOf(e) < 0; })).then(lireListe);
    }

    // Démarrage : attendre les pré-remplissages (date…), puis prendre l'état de référence
    setTimeout(function () {
      vierge = etat();
      derniere = empreinte(vierge);
      document.addEventListener('input', differer, true);
      document.addEventListener('change', differer, true);
      setInterval(sauver, 4000);
      setInterval(majPastille, 4000);
      window.addEventListener('pagehide', sauver);
      document.addEventListener('loue-avant-maj', sauver);   // mise à jour de l'appli : on sauve avant de recharger
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') sauver(); });
      Promise.all([lireCourant(), lireListe()]).then(function (r) {
        return retirerDoublons(r[0], r[1]).then(function (liste) { return [r[0], liste]; });
      }).then(function (r) {
        var courant = r[0], liste = r[1];
        var utiles = liste.filter(contientQuelqueChose);
        noterListe(liste);
        var aReprendre = repriseDemandee(utiles);
        if (aReprendre && !contientQuelqueChose(courant)) return remettre(aReprendre).then(majPastille, majPastille);
        // Un brouillon gardé exprès n'est pas reproposé par le bandeau : il attend dans « Brouillons gardés »
        var aProposer = utiles.filter(function (e) { return !e.garde; });
        if (contientQuelqueChose(courant)) banniere({ etat: courant, source: 'courant' });
        else if (aProposer.length) banniere({ etat: aProposer[0], source: 'liste' });   // le plus récent des brouillons mis de côté tout seuls
        majPastille();
      });
    }, 500);

    return {
      sauverMaintenant: sauver,
      // À appeler quand la fiche est rangée dans la file d'envoi : elle ne peut plus être perdue.
      // Un brouillon proposé et jamais restauré est mis de côté : il sera reproposé à la prochaine ouverture.
      effacer: function () {
        actif = false; clearTimeout(minuteur);
        var b = document.querySelector('.loue-brouillon:not(.loue-maj)'); if (b) b.remove();   // pas le bandeau « Nouvelle version »
        // La fiche est à l'abri dans la file : son brouillon ne doit plus être proposé, même si la mémoire tarde
        var marque = Date.now();
        try { localStorage.setItem(cleEnvoye, String(marque)); } catch (e) {}
        var fin = mettreDeCote().then(function () { return effacerCourant(marque); })
          .then(function () { if (marqueEnvoye() === marque) { try { localStorage.removeItem(cleEnvoye); } catch (e) {} } });
        enAttente = null;
        // Mémoire lente (autre fenêtre figée) : la page n'attend pas plus de 3 s
        var minuteur3 = null;
        return Promise.race([fin, new Promise(function (ok) {
          minuteur3 = setTimeout(function () { if (LOUE.noterIncident) LOUE.noterIncident('Effacement du brouillon lent (plus de 3 s)'); ok(); }, 3000);
        })]).then(function () { clearTimeout(minuteur3); });
      },
      reprendre: function () { actif = true; deCote = false; derniere = empreinte(etat()); },
    };
  };
})();
