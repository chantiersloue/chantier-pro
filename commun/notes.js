// ═══════════════════════════════════════════════════════════════
// Loué App — notes de chantier (lot 3) : la liste des choses à faire d'un chantier
// Nécessite commun/config.js et commun/api.js.
//
// Écriture : un nouvel élément ou un geste (cocher, décocher, modifier) part par la file d'attente commune
// (LOUE.mettreEnFile, types « note-chantier » et « note-action ») ; ce fichier ne fait que LIRE et GARDER.
// Ce qui est gardé dans le téléphone (dernière liste reçue, texte en cours de frappe) l'est dans une base À PART
// (« loue_notes_… ») : la base des fiches et des brouillons n'est pas modifiée. Tout y est rangé par compte et jamais
// rendu à quelqu'un d'autre ; les listes sont effacées à la déconnexion (un texte en cours de frappe, lui, attend le
// retour de son auteur, comme un brouillon de fiche).
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var LOUE = window.LOUE = window.LOUE || {};
  var CONFIG = window.LOUE_CONFIG || {};
  var NOM_BASE = 'loue_notes_' + (CONFIG.env || 'prod');
  var N = LOUE.notes = {};

  function moi() { var c = LOUE.compte && LOUE.compte(); return c ? c.profil.id : ''; }
  function cleChantier(nom) { return String(nom || '').trim().toLowerCase(); }

  // ── Base à part : un seul magasin « cache », entrées { cle, compte, sorte, date, valeur } ──
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
  function lireEntree(cle) {
    var id = moi();
    if (!id) return Promise.resolve(null);
    return magasin('readonly', function (s) { return s.get(id + '|' + cle); }).then(function (e) { return e && e.compte === id ? e : null; }).catch(function () { return null; });
  }
  function ecrireEntree(cle, sorte, valeur) {
    var id = moi();
    if (!id) return Promise.resolve(false);
    return magasin('readwrite', function (s) { return s.put({ cle: id + '|' + cle, compte: id, sorte: sorte, date: Date.now(), valeur: valeur }); })
      .then(function () { return true; }).catch(function () { return false; });
  }
  function effacerEntree(cle) {
    var id = moi();
    if (!id) return Promise.resolve();
    return magasin('readwrite', function (s) { return s.delete(id + '|' + cle); }).catch(function () {});
  }
  // Ménage : les listes gardées d'un autre compte sont effacées (toutes, si personne n'est connecté), ainsi que tout ce
  // qu'a laissé la première version de la page sur les téléphones d'essai (photos, listes et saisies de l'ancienne forme).
  // Un texte en cours de frappe n'est jamais effacé ici : il attend le retour de son auteur.
  N.nettoyerTelephone = function () {
    var id = moi();
    return magasin('readwrite', function (s) {
      var req = s.openCursor();
      req.onsuccess = function () {
        var c = req.result; if (!c) return;
        var e = c.value;
        if (e.sorte === 'texte') { c.continue(); return; }
        if (e.sorte !== 'elements' || !id || e.compte !== id) c.delete();
        c.continue();
      };
    }).catch(function () {});
  };
  if (LOUE.surEvenement) LOUE.surEvenement(function (ev) { if (ev.type === 'compte') N.nettoyerTelephone(); });

  // ── Texte d'un élément : une seule ligne, 2 000 caractères au plus. Un retour à la ligne, une tabulation ou un
  //    caractère invisible (collage, dictée) devient une espace. ──
  N.MAX_TEXTE = 2000;
  N.nettoyer = function (t) {
    return String(t || '').replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, ' ').replace(/ {2,}/g, ' ').trim().slice(0, N.MAX_TEXTE).trim();
  };

  // ── Appels au serveur ──
  function appel(corps, delai, defaut) {
    if (!LOUE.compte()) return Promise.reject(Object.assign(new Error('Connectez-vous pour voir les notes'), { connexion: true }));
    return LOUE.appeler(corps, delai || 20000).then(function (rep) {
      if (LOUE.estRefusDeConnexion(rep)) throw Object.assign(new Error(rep.message || 'Connexion nécessaire'), { connexion: true });
      if (!rep.ok) throw Object.assign(new Error(rep.code === 'ACTION_INCONNUE' ? 'le serveur n’est pas encore à jour' : (rep.message || defaut)), { serveur: true, code: rep.code });
      return rep.data || {};
    });
  }
  // o : { chantier, recherche, nouveau, termines }
  // → { donnees: { aFaire, termines, nbTermines, chantier, heure, plein }, date, depuisLeTelephone }
  // La liste d'un chantier (sans filtre) est gardée dans le téléphone et sert quand il n'y a pas de réseau.
  N.lire = function (o) {
    o = o || {};
    var gardable = !!o.chantier && !o.recherche && !o.nouveau;
    var cle = 'elements|' + cleChantier(o.chantier), qui = moi();
    return appel({ action: 'notes', chantier: o.chantier || '', recherche: o.recherche || '', nouveau: !!o.nouveau, termines: !!o.termines }, 20000, 'Notes indisponibles').then(function (d) {
      if (gardable && qui === moi()) ecrireEntree(cle, 'elements', d);
      return { donnees: d, date: Date.now(), depuisLeTelephone: false };
    }, function (err) {
      if (err && err.code === 'INTERDIT' && gardable) effacerEntree(cle);   // accès retiré : la liste gardée ne doit plus se lire hors réseau
      if (err && (err.connexion || err.serveur) || !gardable) throw err;
      return N.gardee(o.chantier).then(function (g) { if (g) return g; throw err; });   // pas de réseau : la dernière liste de CE compte
    });
  };
  // La dernière liste gardée dans le téléphone pour ce chantier (ou null) : affichée tout de suite, avant la réponse du serveur
  N.gardee = function (chantier) {
    return lireEntree('elements|' + cleChantier(chantier)).then(function (e) { return e && e.valeur ? { donnees: e.valeur, date: e.date, depuisLeTelephone: true } : null; });
  };
  // Après l'affichage : « j'ai vu la liste de ce chantier jusqu'à telle heure du serveur ». Un échec est sans gravité.
  // chantier vide + tous = vrai : tous les chantiers (vue « Tous chantiers » des conducteurs).
  N.vues = function (chantier, jusqua, tous) {
    return appel({ action: 'notesVues', chantier: chantier || '', jusqua: jusqua, tous: !!tous }, 15000, '').then(function () { return true; }, function () { return false; });
  };
  // Chiffres rouges de l'accueil : { parChantier: { nom: n }, total }
  N.nouvelles = function () { return appel({ action: 'notesNouvelles' }, 15000, 'Indisponible'); };

  // ── Texte en cours de frappe (pas encore ajouté), par compte et par chantier : gardé sans rien demander ──
  N.lireTexte = function (chantier) { return lireEntree('texte|' + cleChantier(chantier)).then(function (e) { return e && typeof e.valeur === 'string' ? e.valeur : ''; }); };
  N.ecrireTexte = function (chantier, texte) { return ecrireEntree('texte|' + cleChantier(chantier), 'texte', String(texte || '')); };
  N.effacerTexte = function (chantier) { return effacerEntree('texte|' + cleChantier(chantier)); };

  // ── Ajouts et gestes encore dans la file d'envoi, pour CE compte et ce chantier (du plus ancien au plus récent) ──
  N.enAttente = function (chantier) {
    var id = moi(), cle = cleChantier(chantier);
    if (!id || !LOUE.stockage) return Promise.resolve([]);
    return LOUE.stockage.tout('file').then(function (liste) {
      return liste.filter(function (e) {
        return /^note-/.test(e.type || '') && (!e.env || e.env === CONFIG.env) && e.saisiPar === id && e.donnees && cleChantier(e.donnees.chantier) === cle;
      }).sort(function (a, b) { return a.cree - b.cree; });
    }).catch(function () { return []; });
  };
})();
