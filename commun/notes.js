// ═══════════════════════════════════════════════════════════════
// Loué App — notes de chantier (lot 3) : lectures, liste et photos gardées dans le téléphone, saisie en cours
// Nécessite commun/config.js et commun/api.js.
//
// Écriture : une note ou un geste part par la file d'attente commune (LOUE.mettreEnFile, types « note-chantier »
// et « note-action ») ; ce fichier ne fait que LIRE et GARDER.
// Ce qui est gardé dans le téléphone l'est dans une base À PART (« loue_notes_… ») : la base des fiches et des
// brouillons n'est pas modifiée. Tout y est rangé par compte, jamais rendu à quelqu'un d'autre, effacé à la déconnexion.
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var LOUE = window.LOUE = window.LOUE || {};
  var CONFIG = window.LOUE_CONFIG || {};
  var NOM_BASE = 'loue_notes_' + (CONFIG.env || 'prod');
  var PHOTOS_GARDEES = 60;
  var N = LOUE.notes = {};

  function moi() { var c = LOUE.compte && LOUE.compte(); return c ? c.profil.id : ''; }
  function cleChantier(nom) { return String(nom || '').trim().toLowerCase(); }
  N.cleChantier = cleChantier;

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
  // Efface tout ce qui n'appartient pas au compte connecté (tout, si personne n'est connecté)
  N.nettoyerTelephone = function () {
    var id = moi();
    return magasin('readwrite', function (s) {
      var req = s.openCursor();
      req.onsuccess = function () { var c = req.result; if (!c) return; if (!id || c.value.compte !== id) c.delete(); c.continue(); };
    }).catch(function () {});
  };
  // Pas plus de 60 photos gardées : les plus anciennes sont retirées
  function limiterPhotos() {
    return magasin('readwrite', function (s) {
      var req = s.getAll();
      req.onsuccess = function () {
        var photos = (req.result || []).filter(function (e) { return e.sorte === 'photo'; }).sort(function (a, b) { return b.date - a.date; });
        photos.slice(PHOTOS_GARDEES).forEach(function (e) { s.delete(e.cle); });
      };
    }).catch(function () {});
  }
  if (LOUE.surEvenement) LOUE.surEvenement(function (ev) { if (ev.type === 'compte') N.nettoyerTelephone(); });

  // ── Texte : 2 000 caractères au plus ; tabulations et caractères invisibles remplacés par une espace ;
  //    les retours à la ligne sont gardés (le serveur refuse le reste, et un refus est définitif) ──
  N.MAX_TEXTE = 2000;
  N.MAX_PHOTOS = 3;
  N.nettoyer = function (t) {
    return String(t || '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f-\u009f\u2028\u2029]+/g, ' ').trim().slice(0, N.MAX_TEXTE).trim();
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
  // o : { chantier, corbeille, recherche, nonFait, nouveau, auteur }
  // → { donnees: { notes, chantier, chef, moi, heure, plein }, date, depuisLeTelephone }
  // La liste simple (un chantier, ou tous sans filtre) est gardée dans le téléphone et sert quand il n'y a pas de réseau.
  N.lire = function (o) {
    o = o || {};
    var simple = !o.corbeille && !o.recherche && !o.nonFait && !o.nouveau && !o.auteur;
    var cle = 'liste|' + cleChantier(o.chantier), qui = moi();
    return appel({ action: 'notes', chantier: o.chantier || '', corbeille: !!o.corbeille, recherche: o.recherche || '', nonFait: !!o.nonFait,
      nouveau: !!o.nouveau, auteur: o.auteur || '' }, 20000, 'Notes indisponibles').then(function (d) {
      if (simple && qui === moi()) ecrireEntree(cle, 'liste', d);
      return { donnees: d, date: Date.now(), depuisLeTelephone: false };
    }, function (err) {
      if (err && (err.connexion || err.serveur) || !simple) throw err;
      return lireEntree(cle).then(function (e) {   // pas de réseau : la dernière liste de CE compte
        if (e && e.valeur) return { donnees: e.valeur, date: e.date, depuisLeTelephone: true };
        throw err;
      });
    });
  };
  // Après l'affichage : « j'ai vu les notes de ce chantier jusqu'à telle heure du serveur ». Un échec est sans gravité.
  N.vues = function (chantier, jusqua) {
    return appel({ action: 'notesVues', chantier: chantier, jusqua: jusqua }, 15000, '').catch(function () { return null; });
  };
  // Badges : { parChantier: { nom: n }, total }
  N.nouvelles = function () { return appel({ action: 'notesNouvelles' }, 15000, 'Indisponible'); };
  N.historique = function (id) { return appel({ action: 'noteHistorique', note: id }, 20000, 'Historique indisponible').then(function (d) { return d.versions || []; }); };
  N.exporter = function (chantier) { return appel({ action: 'notesPdf', chantier: chantier }, 120000, 'Export impossible'); };
  // Photo d'une note → adresse locale de l'image. Chargée à la demande (90 s : une barre de réseau), puis gardée.
  N.photo = function (id, rang) {
    var cle = 'photo|' + id + '|' + rang;
    return lireEntree(cle).then(function (e) {
      if (e && e.valeur) return URL.createObjectURL(e.valeur);
      return appel({ action: 'notePhoto', note: id, rang: rang }, 90000, 'Photo indisponible').then(function (d) {
        var binaire = atob(d.data), octets = new Uint8Array(binaire.length);
        for (var i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
        var blob = new Blob([octets], { type: /^image\/(jpeg|png|webp)$/.test(d.mime) ? d.mime : 'image/jpeg' });
        ecrireEntree(cle, 'photo', blob).then(limiterPhotos);
        return URL.createObjectURL(blob);
      });
    });
  };

  // ── Saisie en cours (texte et photos pas encore ajoutés), par compte et par chantier : gardée sans rien demander ──
  N.lireSaisie = function (chantier) { return lireEntree('saisie|' + cleChantier(chantier)).then(function (e) { return e ? e.valeur : null; }); };
  N.ecrireSaisie = function (chantier, valeur) { return ecrireEntree('saisie|' + cleChantier(chantier), 'saisie', valeur); };
  N.effacerSaisie = function (chantier) { return effacerEntree('saisie|' + cleChantier(chantier)); };

  // ── Notes et gestes encore dans la file d'envoi, pour CE compte et ce chantier (du plus ancien au plus récent) ──
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
