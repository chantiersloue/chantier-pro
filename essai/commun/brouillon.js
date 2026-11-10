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
    function lireListe() {
      // Fusion des deux copies (IndexedDB avec photos, localStorage sans) : rien n'est masqué si l'une est en retard
      return lireBase(cleListe).then(function (b) {
        var parT = {};
        (lireLocal(cleListeLocale) || []).concat((b && b.liste) || []).forEach(function (e) { if (e && e.t) parT[e.t] = e; });
        var limite = Date.now() - 30 * 24 * 3600 * 1000;
        return Object.keys(parT).map(function (k) { return parT[k]; })
          .filter(function (e) { return e.t > limite; })
          .sort(function (x, y) { return y.t - x.t; });
      });
    }
    function ecrireListe(liste) {
      liste = liste.slice(0, 5);
      try { localStorage.setItem(cleListeLocale, JSON.stringify(liste.map(sansPhotos))); } catch (e) {}
      return LOUE.stockage.ecrire('brouillons', { cle: cleListe, liste: liste }).catch(function () {});
    }
    function ajouterALaListe(e) {
      return lireListe().then(function (liste) {
        if (liste.some(function (x) { return x.t === e.t; })) return;
        liste.unshift(Object.assign({}, e, { cle: cle }));
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
        if (ancien && LOUE.message) LOUE.message('✓ Brouillon de nouveau enregistré dans le téléphone');
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
      var emp = empreinte(e);
      if (emp === derniere) return Promise.resolve();          // rien de neuf depuis la dernière sauvegarde
      derniere = emp;
      var okLocal = ecrireLocal(cleLocale, e);
      return mettreDeCote().then(function () { return LOUE.stockage.ecrire('brouillons', e); })
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
      return lireBase(cle).then(function (base) {
        var local = lireLocal(cleLocale);
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
    function effacerCourant() {
      anciennes.concat([cleLocale]).forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
      return LOUE.stockage.supprimer('brouillons', cle).catch(function () {});
    }

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
        + '<button type="button" data-oui>Restaurer</button><button type="button" data-non>Repartir à zéro</button>';
      bar.querySelector('[data-oui]').onclick = function () {
        bar.remove();
        enAttente = null;
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
        // Brouillon proposé déjà mis de côté (on avait commencé à taper) : il sort de la liste ; ce qui est à l'écran reste
        if (proposition.source === 'liste' || deCote) { retirerDeLaListe(sauve.t).then(function () { derniere = null; sauver(); }); return; }
        // Sinon la page est vierge : on efface, et l'état vierge devient la référence (rien n'est réenregistré,
        // la bannière ne reviendra pas à la prochaine ouverture)
        effacerCourant().then(function () { derniere = empreinte(etat()); });
      };
      document.body.appendChild(bar);
    }

    // Démarrage : attendre les pré-remplissages (date…), puis prendre l'état de référence
    setTimeout(function () {
      vierge = etat();
      derniere = empreinte(vierge);
      document.addEventListener('input', differer, true);
      document.addEventListener('change', differer, true);
      setInterval(sauver, 4000);
      window.addEventListener('pagehide', sauver);
      document.addEventListener('loue-avant-maj', sauver);   // mise à jour de l'appli : on sauve avant de recharger
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') sauver(); });
      Promise.all([lireCourant(), lireListe()]).then(function (r) {
        var courant = r[0], liste = r[1];
        var utiles = liste.filter(contientQuelqueChose);
        if (contientQuelqueChose(courant)) banniere({ etat: courant, source: 'courant' });
        else if (utiles.length) banniere({ etat: utiles[0], source: 'liste' });   // le plus récent des brouillons mis de côté
      });
    }, 500);

    return {
      sauverMaintenant: sauver,
      // À appeler quand la fiche est rangée dans la file d'envoi : elle ne peut plus être perdue.
      // Un brouillon proposé et jamais restauré est mis de côté : il sera reproposé à la prochaine ouverture.
      effacer: function () {
        actif = false; clearTimeout(minuteur);
        var b = document.querySelector('.loue-brouillon:not(.loue-maj)'); if (b) b.remove();   // pas le bandeau « Nouvelle version »
        return mettreDeCote().then(function () { enAttente = null; return effacerCourant(); });
      },
      reprendre: function () { actif = true; deCote = false; derniere = empreinte(etat()); },
    };
  };
})();
