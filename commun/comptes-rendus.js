// ═══════════════════════════════════════════════════════════════
// Loué App — comptes rendus (lot 8c) : les POINTS d'une note de réunion, repris d'une réunion à l'autre
// Nécessite commun/config.js et commun/api.js.
//
// Le serveur donne, pour le chantier affiché, la liste des points ouverts (et des points clos par les 3 derniers
// comptes rendus). Ce fichier la LIT et la GARDE dans le téléphone, pour qu'elle serve sans réseau.
// Ce qui est gardé l'est dans une base À PART (« loue_cr_… ») : la base des fiches et des brouillons n'est pas modifiée.
// Tout y est rangé par compte, jamais rendu à quelqu'un d'autre, effacé à la déconnexion et quand le serveur dit que
// l'accès au chantier est retiré.
// L'écriture, elle, passe par la file d'attente commune : la note de réunion (type « note ») porte les GESTES de la
// personne sur chaque point (« rien », « complete », « clos », « rouvert », « nouveau »), jamais l'état des points.
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var LOUE = window.LOUE = window.LOUE || {};
  var CONFIG = window.LOUE_CONFIG || {};
  var NOM_BASE = 'loue_cr_' + (CONFIG.env || 'prod');
  var CR = LOUE.comptesRendus = {};
  CR.MAX_TEXTE = 2000;      // caractères par point
  CR.MAX_NOUVEAUX = 40;     // nouveaux points par note
  var UN_JOUR = 24 * 3600 * 1000;

  function moi() { var c = LOUE.compte && LOUE.compte(); return c ? c.profil.id : ''; }
  function cleChantier(nom) { return String(nom || '').trim().toLowerCase(); }

  // ── Base à part : un seul magasin « cache », entrées { cle, compte, chantier, date, valeur } ──
  var basePromesse = null;
  function base() {
    if (basePromesse) return basePromesse;
    basePromesse = new Promise(function (ok, ko) {
      if (!window.indexedDB) return ko(new Error('Stockage du téléphone indisponible'));
      var fini = false, req;
      var minuteur = setTimeout(function () { if (!fini) { fini = true; ko(new Error('Stockage du téléphone occupé')); } }, 5000);
      try { req = indexedDB.open(NOM_BASE, 1); } catch (e) { clearTimeout(minuteur); return ko(e); }
      req.onupgradeneeded = function () { if (!req.result.objectStoreNames.contains('cache')) req.result.createObjectStore('cache', { keyPath: 'cle' }); };
      req.onsuccess = function () {
        clearTimeout(minuteur);
        var db = req.result;
        db.onversionchange = function () { db.close(); basePromesse = null; };
        if (fini) { db.close(); return; }
        fini = true; ok(db);
      };
      req.onerror = function () { clearTimeout(minuteur); if (!fini) { fini = true; ko(req.error || new Error('Stockage du téléphone indisponible')); } };
    }).catch(function (err) { basePromesse = null; throw err; });
    return basePromesse;
  }
  function magasin(mode, action) {
    return base().then(function (db) {
      return new Promise(function (ok, ko) {
        var tx = db.transaction('cache', mode), res = action(tx.objectStore('cache'));
        tx.oncomplete = function () { ok(res && typeof IDBRequest !== 'undefined' && res instanceof IDBRequest ? res.result : res); };
        tx.onerror = tx.onabort = function () { ko(tx.error || new Error('Stockage du téléphone indisponible')); };
      });
    });
  }
  // Une entrée n'est rendue qu'au compte qui l'a rangée
  function lireEntree(chantier) {
    var id = moi();
    if (!id) return Promise.resolve(null);
    return magasin('readonly', function (s) { return s.get(id + '|' + cleChantier(chantier)); })
      .then(function (e) { return e && e.compte === id ? e : null; }).catch(function () { return null; });
  }
  function ecrireEntree(chantier, valeur) {
    var id = moi();
    if (!id || !cleChantier(chantier)) return Promise.resolve(false);
    return magasin('readwrite', function (s) { return s.put({ cle: id + '|' + cleChantier(chantier), compte: id, chantier: String(chantier).trim(), date: Date.now(), valeur: valeur }); })
      .then(function () { return true; }).catch(function () { return false; });
  }
  function effacerEntree(chantier) {
    var id = moi();
    if (!id) return Promise.resolve();
    return magasin('readwrite', function (s) { return s.delete(id + '|' + cleChantier(chantier)); }).catch(function () {});
  }
  // Ménage : les listes gardées d'un autre compte sont effacées (toutes, si personne n'est connecté)
  CR.nettoyerTelephone = function () {
    var id = moi();
    return magasin('readwrite', function (s) {
      var req = s.openCursor();
      req.onsuccess = function () {
        var c = req.result; if (!c) return;
        if (!id || c.value.compte !== id) c.delete();
        c.continue();
      };
    }).catch(function () {});
  };
  if (LOUE.surEvenement) LOUE.surEvenement(function (ev) { if (ev.type === 'compte') CR.nettoyerTelephone(); });

  // ── Texte d'un point : retours à la ligne gardés, caractères invisibles retirés, 2 000 caractères au plus ──
  // (la même règle que le serveur : crTexte_ dans apps-script/ComptesRendus.gs)
  var SEPARATEURS = new RegExp('\\r\\n?|[' + String.fromCharCode(0x2028) + String.fromCharCode(0x2029) + ']', 'g');
  CR.nettoyer = function (t) {
    return String(t === undefined || t === null ? '' : t).replace(SEPARATEURS, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]+/g, ' ')
      .replace(/[ ]{2,}/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, CR.MAX_TEXTE).trim();
  };
  CR.nouvelId = function () { return LOUE.nouvelId('pt'); };

  // Liste reçue du serveur → forme sûre : { base, date, ouverts: [{ id, t, d }], clos: [{ id, t, d, k }] }
  function listePropre(d) {
    d = d || {};
    var point = function (p) { return p && typeof p.id === 'string' && typeof p.t === 'string'; };
    return { base: typeof d.base === 'string' ? d.base : '', date: typeof d.date === 'string' ? d.date : '',
      ouverts: (Array.isArray(d.ouverts) ? d.ouverts : []).filter(point).map(function (p) { return { id: p.id, t: p.t, d: String(p.d || '') }; }),
      clos: (Array.isArray(d.clos) ? d.clos : []).filter(point).map(function (p) { return { id: p.id, t: p.t, d: String(p.d || ''), k: String(p.k || '') }; }),
      mailsRestants: typeof d.mailsRestants === 'number' ? d.mailsRestants : null };
  }

  // ── Lecture ──
  var dernierEnvoi = 0;                 // heure du dernier envoi de note confirmé par le serveur
  var ecritures = Promise.resolve();    // écritures de la liste gardée, l'une après l'autre
  // → { liste, date, depuisLeTelephone }. Erreurs : { interdit } (pas accès à ce chantier), { ancienServeur } (serveur pas
  // encore à jour), { connexion }, { indisponible } (onglet du bureau à réparer), ou erreur de réseau SANS liste gardée.
  CR.lire = function (chantier) {
    var qui = moi(), depart = Date.now();
    if (!qui) return Promise.reject(Object.assign(new Error('Connectez-vous pour voir les points ouverts'), { connexion: true }));
    return LOUE.appeler({ action: 'compteRendu', chantier: String(chantier || '') }, 15000).then(function (rep) {
      if (LOUE.estRefusDeConnexion(rep)) throw Object.assign(new Error(rep.message || 'Connexion nécessaire'), { connexion: true, serveur: true });
      if (rep.code === 'INTERDIT') { effacerEntree(chantier); throw Object.assign(new Error(rep.message || 'Chantier interdit'), { interdit: true, serveur: true }); }
      if (rep.code === 'ACTION_INCONNUE') throw Object.assign(new Error('le serveur n’est pas encore à jour'), { ancienServeur: true, serveur: true });
      if (!rep.ok) throw Object.assign(new Error(rep.message || 'Points indisponibles'), { indisponible: true, serveur: true });
      var liste = listePropre(rep.data);
      // gardée seulement si aucune note n'est partie depuis le départ de la demande (une réponse partie avant l'envoi et
      // arrivée après ne doit pas remplacer la liste gardée par une liste sans cette note)
      if (qui === moi() && depart > dernierEnvoi) ecritures = ecritures.then(function () { return ecrireEntree(chantier, liste); });
      return { liste: liste, date: Date.now(), depuisLeTelephone: false };
    }).catch(function (err) {
      if (err && err.serveur) throw err;
      return CR.gardee(chantier).then(function (g) { if (g) return g; throw err; });   // pas de réseau : la dernière liste de CE compte
    });
  };
  // La dernière liste gardée dans le téléphone pour ce chantier (ou null)
  CR.gardee = function (chantier) {
    return ecritures.then(function () { return lireEntree(chantier); })
      .then(function (e) { return e && e.valeur ? { liste: listePropre(e.valeur), date: e.date, depuisLeTelephone: true } : null; });
  };
  CR.garder = function (chantier, liste) {
    ecritures = ecritures.then(function () { return ecrireEntree(chantier, listePropre(liste)); });
    return ecritures;
  };
  // Les chantiers déjà gardés depuis plus d'un jour sont rafraîchis, 5 au plus par ouverture de page (réseau faible)
  CR.rafraichirAnciennes = function (sauf) {
    var id = moi();
    if (!id || navigator.onLine === false) return Promise.resolve(0);
    return magasin('readonly', function (s) { return s.getAll(); }).then(function (toutes) {
      var vieilles = (toutes || []).filter(function (e) { return e.compte === id && e.chantier && cleChantier(e.chantier) !== cleChantier(sauf) && Date.now() - e.date > UN_JOUR; })
        .sort(function (a, b) { return a.date - b.date; }).slice(0, 5);
      var chaine = Promise.resolve();
      vieilles.forEach(function (e) { chaine = chaine.then(function () { return CR.lire(e.chantier).catch(function () {}); }); });
      return chaine.then(function () { return vieilles.length; });
    }).catch(function () { return 0; });
  };

  // ── Notes de réunion encore dans la file d'envoi, pour CE compte et ce chantier (de la plus ancienne à la plus récente) ──
  CR.enAttente = function (chantier) {
    var id = moi(), cle = cleChantier(chantier);
    if (!LOUE.stockage || !cle) return Promise.resolve([]);
    return LOUE.stockage.tout('file').then(function (liste) {
      return liste.filter(function (e) {
        return e.type === 'note' && (!e.env || e.env === CONFIG.env) && (e.saisiPar || '') === id && e.donnees && cleChantier(e.donnees.chantier) === cle;
      }).sort(function (a, b) { return a.cree - b.cree; });
    }).catch(function () { return []; });
  };
  // Ce que deviendra la liste quand une note en attente sera arrivée : ses gestes rejoués sur une copie de la liste.
  // (Version courte de la règle du serveur : c'est LUI qui fait foi ; ici on ne fait que montrer la suite probable.)
  // Chaque point touché par la note porte « attente » = la date de cette note.
  CR.simuler = function (liste, note) {
    var l = listePropre(liste), d = (note && note.donnees) || {}, date = String(d.date || '');
    var gestes = d.points && Array.isArray(d.points.gestes) ? d.points.gestes : [];
    (liste.ouverts || []).forEach(function (p, i) { if (p.attente && l.ouverts[i]) l.ouverts[i].attente = p.attente; });
    (liste.clos || []).forEach(function (p, i) { if (p.attente && l.clos[i]) l.clos[i].attente = p.attente; });
    var chercher = function (t, id) { for (var i = 0; i < t.length; i++) if (t[i].id === id) return i; return -1; };
    gestes.forEach(function (g) {
      if (!g || typeof g.id !== 'string') return;
      var t = CR.nettoyer(g.t), io = chercher(l.ouverts, g.id), ic = chercher(l.clos, g.id);
      var texteNeuf = !!t && (g.g === 'complete' || g.m === true);
      if (io < 0 && ic < 0) {
        if (!t) return;
        if (g.g === 'clos' || (g.g === 'nouveau' && g.regle)) l.clos.push({ id: g.id, t: t, d: date, k: date, attente: date });
        else l.ouverts.push({ id: g.id, t: t, d: date, attente: date });
        return;
      }
      if (io > -1) {
        var p = l.ouverts[io];
        if (texteNeuf && t !== p.t) { p.t = t; p.attente = date; }
        if (g.g === 'clos') { l.ouverts.splice(io, 1); l.clos.push({ id: p.id, t: p.t, d: p.d, k: date, attente: date }); }
        return;
      }
      if (g.g === 'rouvert') {
        var c = l.clos[ic];
        if (texteNeuf) c.t = t;
        l.clos.splice(ic, 1); l.ouverts.push({ id: c.id, t: c.t, d: c.d, attente: date });
      }
    });
    l.base = note && note.id ? String(note.id) : l.base;
    l.date = date || l.date;
    return l;
  };

  // ── Une note de réunion vient d'être confirmée par le serveur : la liste GARDÉE du chantier est mise à jour, quelle que
  //    soit la page ouverte (la file peut partir depuis l'accueil). Hors réseau, on retrouve ainsi ce qu'on vient d'envoyer. ──
  if (LOUE.surEvenement) LOUE.surEvenement(function (ev) {
    var a = ev.element;
    if (ev.type !== 'envoyee' || !a || a.type !== 'note' || !a.donnees || (a.saisiPar || '') !== moi() || !moi()) return;
    dernierEnvoi = Date.now();
    var chantier = a.donnees.chantier, recue = ev.reponse && ev.reponse.data && ev.reponse.data.points;
    ecritures = ecritures.then(function () {
      if (recue) return ecrireEntree(chantier, listePropre(recue));      // la liste exacte, donnée par le serveur
      // Réponse sans liste (« déjà reçue » après une réponse perdue, ancien serveur) : suite probable, d'après la liste gardée
      return lireEntree(chantier).then(function (e) {
        if (!e || !e.valeur || !a.donnees.points) return null;
        var l = CR.simuler(e.valeur, a);
        l.ouverts.concat(l.clos).forEach(function (p) { delete p.attente; });
        return ecrireEntree(chantier, l);
      });
    }).catch(function () {}).then(function () { LOUE.signaler({ type: 'compte-rendu', chantier: chantier }); });
  });
})();
