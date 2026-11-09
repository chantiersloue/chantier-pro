// ═══════════════════════════════════════════════════════════════
// Loué App — échanges avec le serveur (Apps Script) et file d'attente d'envoi
// Une fiche n'est JAMAIS perdue : elle est d'abord rangée dans le téléphone (IndexedDB),
// puis envoyée ; elle n'est retirée de la file que quand le serveur a répondu « enregistrée ».
// Chaque mode (production, test, local) a sa propre base : une fiche d'essai ne part jamais en production.
// Nécessite commun/config.js (adresse du serveur).
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var LOUE = window.LOUE = window.LOUE || {};
  var CONFIG = window.LOUE_CONFIG || { env: 'prod', url: 'https://config-introuvable.invalid/' };
  var URL_API = function () { return CONFIG.url; };
  LOUE.env = CONFIG.env;

  // Numéro unique (fiche, photo) fabriqué sur le téléphone
  LOUE.nouvelId = function (prefixe) {
    var a = new Uint8Array(8);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return (prefixe || 'id') + '-' + Date.now().toString(36) + '-' + Array.prototype.map.call(a, function (x) {
      return ('0' + x.toString(16)).slice(-2); }).join('');
  };

  // Message compréhensible par un poseur, quelle que soit l'erreur technique
  function messageClair(err) {
    if (!err) return 'Erreur inconnue, nouvel essai automatique';
    if (err.name === 'AbortError') return 'Réseau trop lent, nouvel essai automatique';
    if (err.name === 'TypeError' || /fetch|network|load failed|réseau/i.test(err.message || '')) return 'Pas de réseau, nouvel essai automatique';
    if (err.statut && err.statut < 500 && err.statut !== 408 && err.statut !== 429) return 'Adresse du serveur introuvable (erreur ' + err.statut + ') : prévenez le bureau';
    if (/^Serveur/.test(err.message || '')) return 'Serveur indisponible, nouvel essai automatique';
    return err.message;
  }
  LOUE.messageClair = messageClair;

  // ── Appel au serveur : POST en texte simple (pas de « pré-vol » CORS), réponse lue, délai maximal ──
  // ── Compte (lot 2) : jeton de connexion + profil, gardés dans le téléphone (un par mode : production, test, local) ──
  // Le jeton n'est JAMAIS mis dans une adresse : il voyage dans le corps des requêtes POST.
  var CLE_COMPTE = 'loue_compte_' + CONFIG.env;
  function lireCompteLocal() { try { return JSON.parse(localStorage.getItem(CLE_COMPTE) || 'null'); } catch (e) { return null; } }
  function ecrireCompteLocal(c) { try { if (c) localStorage.setItem(CLE_COMPTE, JSON.stringify(c)); else localStorage.removeItem(CLE_COMPTE); } catch (e) {} }
  // { jeton, profil: { id, nom, role, tous, conducteur }, chantiers } ou null si personne n'est connecté
  LOUE.compte = function () { var c = lireCompteLocal(); return c && c.jeton && c.profil ? c : null; };
  // Dernière personne connectée (même déconnectée : son identifiant est proposé à l'écran de connexion)
  LOUE.dernierIdentifiant = function () { var c = lireCompteLocal(); return c && c.profil ? c.profil.id : ''; };
  LOUE.enregistrerCompte = function (jeton, profil, chantiers) {
    var c = lireCompteLocal() || {};
    if (c.profil && profil && c.profil.id !== profil.id) c = {};            // autre personne : rien de l'ancienne
    c.jeton = jeton; if (profil) c.profil = profil; if (chantiers) c.chantiers = chantiers;
    ecrireCompteLocal(c);
  };
  function oublierJeton(raison) {
    var c = lireCompteLocal();
    if (!c || !c.jeton) return;
    delete c.jeton; ecrireCompteLocal(c);
    LOUE.signaler({ type: 'compte', etat: 'deconnecte', message: raison || '' });
  }
  // Se déconnecter : le jeton, le profil et les listes de la personne sont effacés du téléphone (pas les fiches en attente)
  LOUE.deconnecter = function () {
    var c = lireCompteLocal();
    try { if (c && c.profil) localStorage.removeItem(CLE_LISTES + '_' + c.profil.id); } catch (e) {}
    ecrireCompteLocal(null);
    LOUE.signaler({ type: 'compte', etat: 'deconnecte' });
  };
  var CODES_CONNEXION = ['CONNEXION_REQUISE', 'JETON_INVALIDE', 'COMPTE_REFUSE'];
  LOUE.estRefusDeConnexion = function (rep) { return !!rep && CODES_CONNEXION.indexOf(rep.code) > -1; };

  LOUE.appeler = function (corps, delaiMs) {
    var c = LOUE.compte();
    if (c && corps && !corps.jeton && corps.action !== 'connexion' && corps.action !== 'motDePasse' && corps.action !== 'ping') {
      corps = Object.assign({}, corps, { jeton: c.jeton });
    }
    return appelerBrut(corps, delaiMs).then(function (rep) {
      if (rep && rep.jeton && LOUE.compte()) LOUE.enregistrerCompte(rep.jeton);   // jeton prolongé de 90 jours
      if (rep && (rep.code === 'JETON_INVALIDE' || rep.jetonInvalide)) oublierJeton(rep.message);
      return rep;
    });
  };
  function appelerBrut(corps, delaiMs) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var minuteur = setTimeout(function () { if (ctrl) ctrl.abort(); }, delaiMs || 30000);
    return fetch(URL_API(), {
      method: 'POST', credentials: 'omit', redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(corps), signal: ctrl ? ctrl.signal : undefined,
    }).then(function (rep) {
      if (!rep.ok) throw Object.assign(new Error('Serveur : erreur ' + rep.status), { statut: rep.status });
      return rep.json().catch(function () { throw new Error('Serveur : réponse illisible'); });
    }).finally(function () { clearTimeout(minuteur); });
  }

  // ── Connexion, choix du mot de passe, profil (lot 2) ──
  LOUE.connexion = function (identifiant, motDePasse) {
    return LOUE.appeler({ action: 'connexion', identifiant: identifiant, motDePasse: motDePasse }, 30000).then(function (rep) {
      if (rep.ok) { LOUE.enregistrerCompte(rep.data.jeton, rep.data.profil); LOUE.signaler({ type: 'compte', etat: 'connecte' }); LOUE.viderFile(true); }
      return rep;
    });
  };
  LOUE.changerMotDePasse = function (identifiant, ancien, nouveau) {
    return LOUE.appeler({ action: 'motDePasse', identifiant: identifiant, ancien: ancien, nouveau: nouveau }, 30000).then(function (rep) {
      if (rep.ok) { LOUE.enregistrerCompte(rep.data.jeton, rep.data.profil); LOUE.signaler({ type: 'compte', etat: 'connecte' }); LOUE.viderFile(true); }
      return rep;
    });
  };
  // Profil + chantiers à jour (et jeton prolongé) ; garde la liste des chantiers pour l'accueil hors réseau
  LOUE.moi = function () {
    return LOUE.appeler({ action: 'moi' }, 20000).then(function (rep) {
      if (rep.ok && LOUE.compte()) LOUE.enregistrerCompte(LOUE.compte().jeton, rep.data.profil, rep.data.chantiers);
      return rep;
    });
  };
  LOUE.ping = function () { return appelerBrut({ action: 'ping' }, 10000); };

  // ── Base IndexedDB (une par mode) : file d'envoi, photos, brouillons ──
  var NOM_BASE = CONFIG.env === 'prod' ? 'loue' : 'loue_' + CONFIG.env;
  var basePromesse = null;
  function base() {
    if (basePromesse) return basePromesse;
    basePromesse = new Promise(function (ok, ko) {
      if (!window.indexedDB) return ko(new Error('Stockage du téléphone indisponible'));
      var fini = false;
      var minuteur = setTimeout(function () { if (!fini) { fini = true; ko(new Error('Mémoire du téléphone bloquée : fermez l’appli (et ses autres onglets), puis rouvrez-la')); } }, 5000);
      var req;
      try { req = indexedDB.open(NOM_BASE, 2); } catch (e) { clearTimeout(minuteur); return ko(e); }
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('file'))       db.createObjectStore('file', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('photos'))     db.createObjectStore('photos', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('brouillons')) db.createObjectStore('brouillons', { keyPath: 'cle' });
      };
      req.onblocked = function () { if (LOUE.message) LOUE.message('Une autre fenêtre de l’appli est ouverte : fermez-la pour continuer.', 8000); };
      req.onsuccess = function () {
        clearTimeout(minuteur);
        var db = req.result;
        db.onversionchange = function () { db.close(); basePromesse = null; };   // laisser passer une mise à jour
        if (fini) { db.close(); return; }
        fini = true; ok(db);
      };
      req.onerror = function () { clearTimeout(minuteur); if (!fini) { fini = true; ko(req.error || new Error('Stockage du téléphone indisponible')); } };
    }).catch(function (err) { basePromesse = null; throw err; });
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

  // Les photos reçoivent de NOUVEAUX numéros à chaque mise en file : deux envois du même brouillon
  // (deux onglets) ne se partagent jamais les mêmes photos
  function renumeroter(donnees, photos) {
    var correspondance = {};
    var nouvelles = (photos || []).map(function (p) {
      var id = LOUE.nouvelId('photo'); correspondance[p.id] = id;
      return { id: id, blob: p.blob };
    });
    var texte = JSON.stringify(donnees, function (k, v) {
      return (k === 'photoRef' && correspondance[v]) ? correspondance[v] : v;
    });
    return { donnees: JSON.parse(texte), photos: nouvelles };
  }

  // ── Ajouter une fiche à la file ──
  // donnees : les champs de la fiche ; photos : [{ id, blob }] référencées dans donnees par { photoRef: id }
  LOUE.mettreEnFile = function (type, donnees, photos, libelle) {
    var r = renumeroter(Object.assign({}, donnees, { type: type }), photos);
    var element = {
      id: LOUE.nouvelId('fiche'), type: type, libelle: libelle || type, cree: Date.now(), env: CONFIG.env,
      saisiPar: (LOUE.compte() || { profil: {} }).profil.id || '',   // qui était connecté quand la fiche a été rangée
      donnees: r.donnees, photos: r.photos.map(function (p) { return p.id; }),
      photosEnvoyees: [], etat: 'en attente', message: '', essais: 0, prochainEssai: 0,
    };
    var ecritures = r.photos.map(function (p) {
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

  // Envoie photos puis fiche. lirePhoto(id) → Promise<Blob|null> ; noter() mémorise une photo envoyée.
  function envoyerPhotosPuisFiche(el, lirePhoto, noter) {
    var aEnvoyer = el.photos.filter(function (id) { return el.photosEnvoyees.indexOf(id) < 0; });
    var chaine = Promise.resolve();
    aEnvoyer.forEach(function (idPhoto) {
      chaine = chaine.then(function () { return lirePhoto(idPhoto); }).then(function (blob) {
        if (!blob) throw Object.assign(new Error('Une photo de cette fiche n’est plus dans le téléphone. Refaites la fiche.'), { definitif: true });
        return blobEnBase64(blob).then(function (b64) {
          return LOUE.appeler({ action: 'photo', id: idPhoto, fiche: el.id, mime: blob.type || 'image/jpeg', data: b64 }, 90000);
        }).then(function (rep) {
          if (LOUE.estRefusDeConnexion(rep)) throw Object.assign(new Error(messageConnexion(rep)), { connexion: true });
          if (!rep.ok) throw Object.assign(new Error(rep.message || 'Photo refusée'), { definitif: rep.code === 'DONNEES_INVALIDES' || rep.code === 'TROP_GROS' || rep.code === 'LIMITE' });
          el.photosEnvoyees.push(idPhoto);
          return noter ? noter() : null;
        });
      });
    });
    return chaine.then(function () {
      return LOUE.appeler({ action: 'fiche', id: el.id, donnees: el.donnees, saisiPar: el.saisiPar || '' }, 120000);
    }).then(function (rep) {
      if (rep.ok) return rep;                                   // ENREGISTRE ou DEJA_RECU
      if (LOUE.estRefusDeConnexion(rep)) throw Object.assign(new Error(messageConnexion(rep)), { connexion: true });
      if (rep.code === 'PHOTOS_MANQUANTES') {                   // le serveur a perdu des photos : on les renverra
        el.photosEnvoyees = el.photosEnvoyees.filter(function (id) { return ((rep.data || {}).manquantes || []).indexOf(id) < 0; });
      }
      // Refus définitifs : la fiche elle-même est invalide. Tout le reste (serveur occupé, erreur passagère…) sera retenté.
      var definitif = ['TYPE_INCONNU', 'DONNEES_INVALIDES', 'ACTION_INCONNUE'].indexOf(rep.code) > -1;
      throw Object.assign(new Error(rep.message || 'Refusée par le serveur'), { definitif: definitif });
    });
  }

  function messageConnexion(rep) {
    return rep.code === 'COMPTE_REFUSE' ? rep.message : 'En attente : connectez-vous depuis l’accueil pour l’envoyer (la fiche est gardée)';
  }

  // Essais espacés : tout de suite, puis 1, 5, 15, 60 min.
  // Seules les réponses du SERVEUR comptent : après 12 refus du serveur, la fiche passe « à vérifier ».
  // Une coupure de réseau ne la fait jamais passer « à vérifier » (elle est retentée sans fin, au plus toutes les 5 min).
  var DELAIS_MIN = [0, 1, 5, 15, 60];
  var DELAIS_RESEAU_MIN = [0, 1, 5];
  var ESSAIS_MAX = 12;
  function erreurReseau(err) {
    // 404, 403… : l'adresse du serveur est fausse ou périmée, ce n'est pas une coupure de réseau
    if (err && err.statut && err.statut < 500 && err.statut !== 408 && err.statut !== 429) return false;
    return err && (err.name === 'AbortError' || err.name === 'TypeError' || /^Serveur : erreur|fetch|network|load failed/i.test(err.message || ''));
  }

  // ── Vider la file (au démarrage, au retour du réseau, au retour dans l'appli, sur bouton) ──
  var enCours = null, aRelancer = false;
  // Écrire une fiche seulement si elle est encore dans la file (un autre onglet a pu l'envoyer entre-temps)
  function ecrireSiPresente(el) {
    return LOUE.stockage.lire('file', el.id).then(function (x) { return x ? LOUE.stockage.ecrire('file', el).then(function () { return true; }) : false; });
  }
  LOUE.viderFile = function (forcer) {
    if (enCours) { aRelancer = true; return enCours; }
    var vider = function () { return LOUE.stockage.tout('file').then(function (liste) {
      liste.sort(function (a, b) { return a.cree - b.cree; });
      var chaine = Promise.resolve();
      liste.forEach(function (ancien) {
        var el = ancien;
        if (el.etat === 'erreur') return;                                   // attend une action de la personne
        if (el.env && el.env !== CONFIG.env) return;                        // fiche d'un autre mode (test / production)
        if (!forcer && el.prochainEssai && Date.now() < el.prochainEssai) return;
        chaine = chaine.then(function () { return LOUE.stockage.lire('file', ancien.id); }).then(function (frais) {
          if (!frais || frais.etat === 'erreur') return;                   // déjà envoyée ou mise de côté entre-temps
          el = frais;
          el.etat = 'envoi'; el.essais++; annoncer();
          return envoyerPhotosPuisFiche(el,
            function (id) { return LOUE.stockage.lire('photos', id).then(function (p) { return p ? p.blob : null; }); },
            function () { return ecrireSiPresente(el); }
          ).then(function (rep) {
            var supp = el.photos.map(function (id) { return LOUE.stockage.supprimer('photos', id); });
            return Promise.all(supp).then(function () { return LOUE.stockage.supprimer('file', el.id); })
              .then(function () { LOUE.signaler({ type: 'envoyee', element: el, reponse: rep }); });
          }).catch(function (err) {
            if (err && err.connexion) {
              // Pas connecté, session terminée, compte refusé : la fiche attend la connexion (elle repart dès qu'elle a lieu)
              el.etat = 'en attente'; el.message = err.message; el.attendConnexion = true;
              el.prochainEssai = Date.now() + 15 * 60000;
              return ecrireSiPresente(el).then(function (encore) { if (encore) LOUE.signaler({ type: el.etat, element: el }); });
            }
            el.attendConnexion = false;
            var reseau = erreurReseau(err);
            if (!reseau) el.refusServeur = (el.refusServeur || 0) + 1;
            var definitif = err.definitif || (el.refusServeur || 0) >= ESSAIS_MAX;
            el.etat = definitif ? 'erreur' : 'en attente';
            el.message = messageClair(err) + (!err.definitif && definitif ? ' (après ' + el.refusServeur + ' essais)' : '');
            if (definitif) el.message = el.message.replace(/,? nouvel essai automatique/, '');   // plus d'essai automatique : « Réessayer »
            var delais = reseau ? DELAIS_RESEAU_MIN : DELAIS_MIN;
            el.prochainEssai = Date.now() + delais[Math.min(el.essais, delais.length - 1)] * 60000;
            // Fiche disparue de la file pendant l'essai : un autre onglet l'a envoyée, rien à signaler
            return ecrireSiPresente(el).then(function (encore) { if (encore) LOUE.signaler({ type: el.etat, element: el }); });
          });
        });
      });
      return chaine;
    }); };
    // Verrou partagé entre onglets, avec un délai maximal : un onglet Safari suspendu en arrière-plan ne bloque pas les autres
    var avecVerrou = function () {
      var ctrl = window.AbortController ? new AbortController() : null;
      var minuteur = setTimeout(function () { if (ctrl) ctrl.abort(); }, 30000);
      return navigator.locks.request('loue-file-' + CONFIG.env, ctrl ? { signal: ctrl.signal } : {}, function () { clearTimeout(minuteur); return vider(); })
        .catch(function (err) { clearTimeout(minuteur); if (err && err.name === 'AbortError') return; throw err; });   // réessayé au prochain passage
    };
    enCours = (navigator.locks && navigator.locks.request ? avecVerrou() : vider()).catch(function (err) {
      LOUE.signaler({ type: 'stockage', message: err && err.message });
    }).finally(function () {
      enCours = null; annoncer();
      if (aRelancer) { aRelancer = false; setTimeout(function () { LOUE.viderFile(); }, 0); }
    });
    return enCours;
  };

  // Réessayer une fiche « à vérifier »
  LOUE.reessayer = function (id) {
    return LOUE.stockage.lire('file', id).then(function (el) {
      if (!el) return;
      el.etat = 'en attente'; el.message = ''; el.essais = 0; el.refusServeur = 0; el.prochainEssai = 0;
      return LOUE.stockage.ecrire('file', el);
    }).then(function () { return LOUE.viderFile(true); });
  };
  // Abandonner une fiche « à vérifier » (après confirmation par la personne)
  LOUE.abandonner = function (id) {
    return LOUE.stockage.lire('file', id).then(function (el) {
      if (!el) return;
      return Promise.all(el.photos.map(function (p) { return LOUE.stockage.supprimer('photos', p); }))
        .then(function () { return LOUE.stockage.supprimer('file', id); });
    }).then(annoncer);
  };

  // ── Plan de secours : le téléphone refuse de garder la fiche (navigation privée, mémoire pleine) ──
  // On l'envoie directement, page ouverte. photos : [{ id, blob }]
  LOUE.envoyerDirect = function (type, donnees, photos) {
    var r = renumeroter(Object.assign({}, donnees, { type: type }), photos);
    var blobs = {};
    r.photos.forEach(function (p) { blobs[p.id] = p.blob; });
    var el = { id: LOUE.nouvelId('fiche'), donnees: r.donnees, photos: r.photos.map(function (p) { return p.id; }), photosEnvoyees: [] };
    function tenter(n) {
      return envoyerPhotosPuisFiche(el, function (id) { return Promise.resolve(blobs[id] || null); }).catch(function (err) {
        if (err.definitif || n >= 3) throw Object.assign(new Error(messageClair(err)), { definitif: err.definitif });
        return new Promise(function (ok) { setTimeout(ok, 5000); }).then(function () { return tenter(n + 1); });
      });
    }
    return tenter(1);
  };

  // ── Annonces aux pages (indicateur « en attente / envoyée ») ──
  var abonnes = [];
  LOUE.surEvenement = function (fn) { abonnes.push(fn); };
  LOUE.signaler = function (ev) { abonnes.forEach(function (fn) { try { fn(ev); } catch (e) {} }); };
  function annoncer() {
    LOUE.stockage.tout('file').then(function (liste) {
      LOUE.signaler({ type: 'file', liste: liste.filter(function (e) { return !e.env || e.env === CONFIG.env; }) });
    }).catch(function () {});
  }
  LOUE.annoncerFile = annoncer;

  // Déclencheurs du renvoi automatique (pas de « synchronisation en arrière-plan » : elle n'existe pas sur iPhone)
  window.addEventListener('online', function () { LOUE.viderFile(true); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') LOUE.viderFile(); });
  window.addEventListener('load', function () { setTimeout(function () { LOUE.viderFile(); }, 500); });
  setInterval(function () { if (navigator.onLine !== false) LOUE.viderFile(); }, 60000);

  // ── Listes (contacts, chantiers…) : réseau d'abord, sinon la dernière liste gardée dans le téléphone ──
  var CLE_LISTES = 'loue_listes_' + CONFIG.env;
  // Une liste gardée par personne (et une pour « sans compte »), effacée à la déconnexion
  function cleListes() { var c = LOUE.compte(); return c ? CLE_LISTES + '_' + c.profil.id : CLE_LISTES; }
  LOUE.listesGardees = function () {
    try { var v = JSON.parse(localStorage.getItem(cleListes()) || 'null'); return v && v.donnees ? v : null; } catch (e) { return null; }
  };
  function listesValables(d) { return !!d && Array.isArray(d.chantiers); }
  var compteurJsonp = 0;
  function jsonp(url, delaiMs) {
    return new Promise(function (ok, ko) {
      var nom = '_loueCb' + Date.now().toString(36) + '_' + (++compteurJsonp) + '_' + Math.floor(Math.random() * 1e6);
      var s = document.createElement('script');
      var fin = function () { delete window[nom]; s.remove(); };
      var minuteur = setTimeout(function () { fin(); ko(new Error('délai dépassé')); }, delaiMs);
      window[nom] = function (d) { clearTimeout(minuteur); fin(); ok(d); };
      s.onerror = function () { clearTimeout(minuteur); fin(); ko(new Error('réseau')); };
      s.src = url + (url.indexOf('?') > -1 ? '&' : '?') + 'callback=' + nom;
      document.head.appendChild(s);
    });
  }
  // Question posée quand le chantier tapé n'est pas dans la liste (liste ancienne, ou limitée à « mes chantiers »)
  var listesPartielles = false;
  LOUE.questionHorsListe = function (nom) {
    return listesPartielles
      ? '« ' + nom + ' » ne fait pas partie de vos chantiers dans l’appli. Envoyer quand même avec ce nom ? (le bureau rangera la fiche)'
      : '« ' + nom + ' » n’est pas dans la liste gardée dans le téléphone (pas de réseau). Envoyer quand même avec ce nom ?';
  };
  LOUE.chargerListes = function () {
    if (!LOUE.compte()) return chargerListesSansCompte();
    var cle = cleListes();
    return LOUE.appeler({ action: 'listes' }, 15000).then(function (rep) {
      if (rep && rep.code === 'ACTION_INCONNUE') return chargerListesSansCompte();   // serveur pas encore à jour (lot 1)
      if (!rep || !rep.ok || !listesValables(rep.data)) throw new Error((rep && rep.message) || 'Listes indisponibles');
      try { localStorage.setItem(cle, JSON.stringify({ date: Date.now(), donnees: rep.data })); } catch (e) {}
      listesPartielles = !!rep.data.partiel;
      return { donnees: rep.data, date: Date.now(), depuisLeTelephone: false, partiel: !!rep.data.partiel };
    }).catch(function () {
      var g = LOUE.listesGardees();
      if (!g) {
        // Jeton refusé pendant la transition : la lecture sans compte marche encore
        if (!LOUE.compte()) return chargerListesSansCompte();
        throw new Error('Listes indisponibles : pas de réseau et rien de gardé dans le téléphone');
      }
      listesPartielles = !!g.donnees.partiel;
      return { donnees: g.donnees, date: g.date, depuisLeTelephone: true, partiel: !!g.donnees.partiel };
    });
  };
  function chargerListesSansCompte() {
    var url = URL_API() + '?action=getContacts&t=' + Date.now();
    var ctrl = window.AbortController ? new AbortController() : null;
    var minuteur = setTimeout(function () { if (ctrl) ctrl.abort(); }, 10000);
    return fetch(url, { credentials: 'omit', redirect: 'follow', signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .catch(function (err) {
        // Délai dépassé (réseau trop faible) : pas la peine d'essayer JSONP, on prend la liste gardée
        if (err && err.name === 'AbortError') throw err;
        return jsonp(URL_API() + '?action=getContacts&t=' + Date.now(), 8000);
      })
      .then(function (d) {
        // Une réponse d'erreur (« connexion requise » après la transition) ne remplace JAMAIS la liste gardée
        if (!listesValables(d)) throw new Error((d && d.message) || 'Listes refusées par le serveur');
        try { localStorage.setItem(CLE_LISTES, JSON.stringify({ date: Date.now(), donnees: d })); } catch (e) {}
        listesPartielles = false;
        return { donnees: d, date: Date.now(), depuisLeTelephone: false };
      })
      .catch(function () {
        var g = null;
        try { g = JSON.parse(localStorage.getItem(CLE_LISTES) || 'null'); } catch (e) {}
        if (g && g.donnees) return { donnees: g.donnees, date: g.date, depuisLeTelephone: true };
        throw new Error('Listes indisponibles : pas de réseau et rien de gardé dans le téléphone');
      })
      .finally(function () { clearTimeout(minuteur); });
  }

  // Documents d'un chantier (Plans) ou planning (chantier = '__PLANNING__') : avec le compte, sinon lecture sans compte
  LOUE.lireDossiers = function (chantier) {
    var sansCompte = function () {
      return LOUE.lire('action=getDossiers&chantier=' + encodeURIComponent(chantier)).then(function (d) {
        if (d && d.erreur === 'CONNEXION_REQUISE') throw new Error('Connectez-vous pour voir les documents');
        return (d && d.dossiers) || {};
      });
    };
    if (!LOUE.compte()) return sansCompte();
    return LOUE.appeler({ action: 'dossiers', chantier: chantier }, 20000).then(function (rep) {
      if (rep.code === 'ACTION_INCONNUE' || (!LOUE.compte() && rep.code === 'JETON_INVALIDE')) return sansCompte();
      if (!rep.ok) throw new Error(rep.message || 'Documents indisponibles');
      return rep.data.dossiers || {};
    });
  };

  // Chantier choisi à l'accueil (adresse « …?chantier=… ») : rempli AVANT que le brouillon prenne la photo de la page vierge,
  // et marqué « automatique » (il ne compte pas comme une saisie). Un brouillon restauré garde SON chantier.
  LOUE.preRemplirChantier = function (idChamp) {
    var nom = '';
    try { nom = (new URLSearchParams(location.search).get('chantier') || '').trim().slice(0, 150); } catch (e) {}
    var el = document.getElementById(idChamp);
    if (!nom || !el || el.value.trim()) return;
    el.value = nom; el.dataset.auto = nom;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  // ── Lecture simple (planning, documents d'un chantier…) : fetch anonyme d'abord, JSONP de secours (règle 3) ──
  // requete : « action=getDossiers&chantier=… » ; renvoie une promesse des données (rejet si rien n'arrive)
  LOUE.lire = function (requete, delaiMs) {
    delaiMs = delaiMs || 15000;
    var url = URL_API() + '?' + requete + '&t=' + Date.now();
    var ctrl = window.AbortController ? new AbortController() : null;
    var minuteur = setTimeout(function () { if (ctrl) ctrl.abort(); }, delaiMs);
    return fetch(url, { credentials: 'omit', redirect: 'follow', signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .catch(function (err) {
        if (err && err.name === 'AbortError') throw new Error('Réseau trop lent');
        return jsonp(url, 8000);
      })
      .finally(function () { clearTimeout(minuteur); });
  };
})();
