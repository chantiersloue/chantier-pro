// ═══════════════════════════════════════════════════════════════
// Loué App — échanges avec le serveur (Apps Script) et file d'attente d'envoi
// Une fiche n'est JAMAIS perdue : elle est d'abord rangée dans le téléphone (IndexedDB),
// puis envoyée ; elle n'est retirée de la file que quand le serveur a répondu « enregistrée ».
// Nécessite commun/config.js (adresse du serveur).
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var LOUE = window.LOUE = window.LOUE || {};
  var URL_API = function () { return (window.LOUE_CONFIG || {}).url || 'https://config-introuvable.invalid/'; };

  // Numéro unique (fiche, photo) fabriqué sur le téléphone
  LOUE.nouvelId = function (prefixe) {
    var a = new Uint8Array(8);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return (prefixe || 'id') + '-' + Date.now().toString(36) + '-' + Array.prototype.map.call(a, function (x) {
      return ('0' + x.toString(16)).slice(-2); }).join('');
  };

  // ── Appel au serveur : POST en texte simple (pas de « pré-vol » CORS), réponse lue, délai maximal ──
  LOUE.appeler = function (corps, delaiMs) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var minuteur = setTimeout(function () { if (ctrl) ctrl.abort(); }, delaiMs || 30000);
    return fetch(URL_API(), {
      method: 'POST', credentials: 'omit', redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(corps), signal: ctrl ? ctrl.signal : undefined,
    }).then(function (rep) {
      if (!rep.ok) throw new Error('Serveur : erreur ' + rep.status);
      return rep.json();
    }).finally(function () { clearTimeout(minuteur); });
  };

  // ── Base IndexedDB « loue » : file d'envoi + photos ──
  var basePromesse = null;
  function base() {
    if (basePromesse) return basePromesse;
    basePromesse = new Promise(function (ok, ko) {
      var req = indexedDB.open('loue', 2);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('file'))       db.createObjectStore('file', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('photos'))     db.createObjectStore('photos', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('brouillons')) db.createObjectStore('brouillons', { keyPath: 'cle' });
      };
      req.onsuccess = function () { ok(req.result); };
      req.onerror = function () { basePromesse = null; ko(req.error); };
    });
    return basePromesse;
  }
  function magasin(nom, mode, action) {
    return base().then(function (db) {
      return new Promise(function (ok, ko) {
        var tx = db.transaction(nom, mode);
        var res = action(tx.objectStore(nom));
        // Une demande IndexedDB renvoie son résultat (undefined si rien n'est trouvé), jamais la demande elle-même
        tx.oncomplete = function () { ok(res && typeof IDBRequest !== 'undefined' && res instanceof IDBRequest ? res.result : res); };
        tx.onerror = tx.onabort = function () { ko(tx.error || new Error('Stockage du téléphone indisponible')); };
      });
    });
  }
  LOUE.stockage = {
    lire:      function (nom, id) { return magasin(nom, 'readonly',  function (s) { return s.get(id); }); },
    tout:      function (nom)     { return magasin(nom, 'readonly',  function (s) { return s.getAll(); }); },
    ecrire:    function (nom, v)  { return magasin(nom, 'readwrite', function (s) { return s.put(v); }); },
    supprimer: function (nom, id) { return magasin(nom, 'readwrite', function (s) { return s.delete(id); }); },
  };

  // ── Ajouter une fiche à la file ──
  // donnees : les champs de la fiche ; photos : [{ id, blob }] référencées dans donnees par { photoRef: id }
  LOUE.mettreEnFile = function (type, donnees, photos, libelle) {
    var element = {
      id: LOUE.nouvelId('fiche'), type: type, libelle: libelle || type, cree: Date.now(),
      donnees: Object.assign({}, donnees, { type: type }),
      photos: (photos || []).map(function (p) { return p.id; }),
      photosEnvoyees: [], etat: 'en attente', message: '', essais: 0,
    };
    var ecritures = (photos || []).map(function (p) {
      return LOUE.stockage.ecrire('photos', { id: p.id, fiche: element.id, blob: p.blob });
    });
    return Promise.all(ecritures).then(function () { return LOUE.stockage.ecrire('file', element); })
      .then(function () { annoncer(); return element; });
  };

  function blobEnBase64(blob) {
    return new Promise(function (ok, ko) {
      var r = new FileReader();
      r.onload = function () { ok(String(r.result).split(',')[1]); };
      r.onerror = function () { ko(r.error); };
      r.readAsDataURL(blob);
    });
  }

  // ── Envoyer un élément de la file : photos d'abord (une par requête), puis la fiche ──
  function envoyerElement(el) {
    var aEnvoyer = el.photos.filter(function (id) { return el.photosEnvoyees.indexOf(id) < 0; });
    var chaine = Promise.resolve();
    aEnvoyer.forEach(function (idPhoto) {
      chaine = chaine.then(function () { return LOUE.stockage.lire('photos', idPhoto); }).then(function (p) {
        if (!p) return;   // photo retirée entre-temps
        return blobEnBase64(p.blob).then(function (b64) {
          return LOUE.appeler({ action: 'photo', id: idPhoto, fiche: el.id, mime: p.blob.type || 'image/jpeg', data: b64 }, 90000);
        }).then(function (rep) {
          if (!rep.ok) throw Object.assign(new Error(rep.message || 'Photo refusée'), { definitif: rep.code === 'DONNEES_INVALIDES' || rep.code === 'TROP_GROS' });
          el.photosEnvoyees.push(idPhoto);
          return LOUE.stockage.ecrire('file', el);
        });
      });
    });
    return chaine.then(function () {
      return LOUE.appeler({ action: 'fiche', id: el.id, donnees: el.donnees }, 120000);
    }).then(function (rep) {
      if (rep.ok) return rep;                                   // ENREGISTRE ou DEJA_RECU
      if (rep.code === 'PHOTOS_MANQUANTES') {                   // le serveur a perdu des photos : on les renverra
        el.photosEnvoyees = el.photosEnvoyees.filter(function (id) { return (rep.data.manquantes || []).indexOf(id) < 0; });
      }
      var temporaire = ['SERVEUR_OCCUPE', 'EN_COURS', 'PHOTOS_MANQUANTES'].indexOf(rep.code) > -1;
      throw Object.assign(new Error(rep.message || 'Refusée par le serveur'), { definitif: !temporaire });
    });
  }

  // ── Vider la file (au démarrage, au retour du réseau, au retour dans l'appli, sur bouton) ──
  var enCours = null;
  LOUE.viderFile = function () {
    if (enCours) return enCours;
    enCours = LOUE.stockage.tout('file').then(function (liste) {
      liste.sort(function (a, b) { return a.cree - b.cree; });
      var chaine = Promise.resolve();
      liste.forEach(function (el) {
        if (el.etat === 'erreur') return;   // refus définitif : attend une action de la personne
        chaine = chaine.then(function () {
          el.etat = 'envoi'; el.essais++; annoncer();
          return envoyerElement(el).then(function (rep) {
            var supp = el.photos.map(function (id) { return LOUE.stockage.supprimer('photos', id); });
            return Promise.all(supp).then(function () { return LOUE.stockage.supprimer('file', el.id); })
              .then(function () { LOUE.signaler({ type: 'envoyee', element: el, reponse: rep }); });
          }).catch(function (err) {
            el.etat = err.definitif ? 'erreur' : 'en attente';
            el.message = err.name === 'AbortError' ? 'Réseau trop lent, nouvel essai automatique' : (err.message || 'Pas de réseau');
            return LOUE.stockage.ecrire('file', el).then(function () { LOUE.signaler({ type: el.etat, element: el }); });
          });
        });
      });
      return chaine;
    }).catch(function (err) {
      LOUE.signaler({ type: 'stockage', message: err && err.message });
    }).finally(function () { enCours = null; annoncer(); });
    return enCours;
  };

  // Réessayer une fiche en erreur (après correction, ou si l'erreur venait du serveur)
  LOUE.reessayer = function (id) {
    return LOUE.stockage.lire('file', id).then(function (el) {
      if (!el) return;
      el.etat = 'en attente'; el.message = '';
      return LOUE.stockage.ecrire('file', el);
    }).then(LOUE.viderFile);
  };

  // ── Annonces aux pages (indicateur « en attente / envoyée ») ──
  var abonnes = [];
  LOUE.surEvenement = function (fn) { abonnes.push(fn); };
  LOUE.signaler = function (ev) { abonnes.forEach(function (fn) { try { fn(ev); } catch (e) {} }); };
  function annoncer() {
    LOUE.stockage.tout('file').then(function (liste) { LOUE.signaler({ type: 'file', liste: liste }); }).catch(function () {});
  }
  LOUE.annoncerFile = annoncer;

  // Déclencheurs du renvoi automatique (pas de « synchronisation en arrière-plan » : elle n'existe pas sur iPhone)
  window.addEventListener('online', function () { LOUE.viderFile(); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') LOUE.viderFile(); });
  window.addEventListener('load', function () { setTimeout(LOUE.viderFile, 500); });
  setInterval(function () { if (navigator.onLine !== false) LOUE.viderFile(); }, 60000);

  // ── Listes (contacts, chantiers…) : réseau d'abord, sinon la dernière liste gardée dans le téléphone ──
  var CLE_LISTES = 'loue_listes_' + ((window.LOUE_CONFIG || {}).env || 'prod');
  LOUE.listesGardees = function () {
    try { var v = JSON.parse(localStorage.getItem(CLE_LISTES) || 'null'); return v && v.donnees ? v : null; } catch (e) { return null; }
  };
  function jsonp(url, delaiMs) {
    return new Promise(function (ok, ko) {
      var nom = '_loueCb' + Date.now().toString(36);
      var s = document.createElement('script');
      var fin = function () { delete window[nom]; s.remove(); };
      var minuteur = setTimeout(function () { fin(); ko(new Error('délai dépassé')); }, delaiMs);
      window[nom] = function (d) { clearTimeout(minuteur); fin(); ok(d); };
      s.onerror = function () { clearTimeout(minuteur); fin(); ko(new Error('réseau')); };
      s.src = url + (url.indexOf('?') > -1 ? '&' : '?') + 'callback=' + nom;
      document.head.appendChild(s);
    });
  }
  LOUE.chargerListes = function () {
    var url = URL_API() + '?action=getContacts&t=' + Date.now();
    var ctrl = window.AbortController ? new AbortController() : null;
    var minuteur = setTimeout(function () { if (ctrl) ctrl.abort(); }, 12000);
    return fetch(url, { credentials: 'omit', redirect: 'follow', signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .catch(function () { return jsonp(URL_API() + '?action=getContacts&t=' + Date.now(), 12000); })
      .then(function (d) {
        try { localStorage.setItem(CLE_LISTES, JSON.stringify({ date: Date.now(), donnees: d })); } catch (e) {}
        return { donnees: d, date: Date.now(), depuisLeTelephone: false };
      })
      .catch(function () {
        var g = LOUE.listesGardees();
        if (g) return { donnees: g.donnees, date: g.date, depuisLeTelephone: true };
        throw new Error('Listes indisponibles : pas de réseau et rien de gardé dans le téléphone');
      })
      .finally(function () { clearTimeout(minuteur); });
  };
})();
