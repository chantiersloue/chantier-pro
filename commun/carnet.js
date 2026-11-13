// ═══════════════════════════════════════════════════════════════
// Loué App — carnet de chantier (lot 4) : les plans et documents en pages-images
// Nécessite commun/config.js et commun/api.js.
//
// Ce fichier demande au serveur la liste des documents et les images (actions « carnet » et « carnetTuiles »), et GARDE
// dans le téléphone ce qui a été reçu, pour le relire sans réseau.
//
// Règles (docs/lot4-plan.md, §3-C et §6) :
//  - une base À PART (« loue_carnet_… ») : la base des fiches et des brouillons n'est jamais touchée ;
//  - les plans ne doivent JAMAIS prendre la place des fiches : le carnet a un plafond, garde une marge libre dans le
//    téléphone, efface d'abord ses images les plus anciennes, et un « plein » reste chez lui (l'image est affichée
//    quand même, elle n'est simplement pas gardée) ;
//  - tout appartient au compte qui l'a téléchargé : un autre compte sur ce téléphone → tout est effacé ; un refus du
//    serveur pour un chantier → ce chantier est effacé ; une session expirée du MÊME compte → tout est gardé
//    (sinon un poseur sans réseau perdrait ses plans).
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var LOUE = window.LOUE = window.LOUE || {};
  var CONFIG = window.LOUE_CONFIG || {};
  var NOM_BASE = 'loue_carnet_' + (CONFIG.env || 'prod');
  var C = LOUE.carnet = {};
  var Mo = 1024 * 1024;
  C.PLAFOND = 400 * Mo;      // place maximale du carnet dans le téléphone
  C.MARGE = 80 * Mo;         // place toujours laissée libre pour les fiches, les photos et les brouillons
  C.PAR_DEMANDE = 8;         // tuiles demandées en une fois
  C.EN_MEME_TEMPS = 2;       // demandes au serveur en même temps (le compte Google en accepte 30 pour toute l'entreprise)

  function moi() { return LOUE.dernierIdentifiant ? LOUE.dernierIdentifiant() : ''; }
  function cleChantier(nom) { return String(nom || '').trim().toLowerCase(); }
  function cleImage(chantier, doc, page, quoi) { return cleChantier(chantier) + '|' + doc + '|' + page + '|' + quoi; }

  // ── Base : « listes » (une par chantier), « index » (une ligne légère par image), « octets » (les images), « meta » ──
  var basePromesse = null;
  function base() {
    if (basePromesse) return basePromesse;
    basePromesse = new Promise(function (ok, ko) {
      if (!window.indexedDB) return ko(new Error('Stockage du téléphone indisponible'));
      var fini = false, req;
      var minuteur = setTimeout(function () { if (!fini) { fini = true; ko(new Error('Stockage du téléphone occupé')); } }, 5000);
      try { req = indexedDB.open(NOM_BASE, 1); } catch (e) { clearTimeout(minuteur); return ko(e); }
      req.onupgradeneeded = function () {
        var db = req.result;
        ['listes', 'index', 'octets', 'meta'].forEach(function (n) { if (!db.objectStoreNames.contains(n)) db.createObjectStore(n, { keyPath: 'cle' }); });
      };
      req.onsuccess = function () {
        clearTimeout(minuteur);
        var db = req.result;
        db.onversionchange = function () { db.close(); basePromesse = null; proprioVerifie = null; };
        if (fini) { db.close(); return; }
        fini = true; ok(db);
      };
      req.onerror = function () { clearTimeout(minuteur); if (!fini) { fini = true; ko(req.error || new Error('Stockage du téléphone indisponible')); } };
    }).catch(function (err) { basePromesse = null; throw err; });
    return basePromesse;
  }
  // Une transaction sur un ou plusieurs magasins ; « action » reçoit une fonction qui donne chaque magasin
  function transaction(noms, mode, action) {
    return base().then(function (db) {
      return new Promise(function (ok, ko) {
        var tx = db.transaction(noms, mode), res = action(function (n) { return tx.objectStore(n); });
        tx.oncomplete = function () { ok(res && typeof IDBRequest !== 'undefined' && res instanceof IDBRequest ? res.result : res); };
        tx.onerror = tx.onabort = function () { ko(tx.error || new Error('Stockage du téléphone indisponible')); };
      });
    });
  }
  var TOUT = ['listes', 'index', 'octets', 'meta'];
  function toutEffacer(nouveauProprio) {
    indexMemoire = null;
    return transaction(TOUT, 'readwrite', function (m) {
      TOUT.forEach(function (n) { m(n).clear(); });
      if (nouveauProprio) m('meta').put({ cle: 'proprio', compte: nouveauProprio });
    });
  }
  // Le carnet gardé appartient à UN compte : vérifié avant toute lecture ou écriture
  var proprioVerifie = null;   // { compte, promesse }
  function pret() {
    var id = moi();
    if (!id) return Promise.reject(new Error('Connexion nécessaire'));
    if (proprioVerifie && proprioVerifie.compte === id) return proprioVerifie.promesse;
    var p = transaction(['meta'], 'readonly', function (m) { return m('meta').get('proprio'); }).then(function (e) {
      if (e && e.compte === id) return;
      return toutEffacer(id);
    });
    proprioVerifie = { compte: id, promesse: p };
    p.catch(function () { proprioVerifie = null; });
    return p;
  }
  // Déconnexion volontaire (le profil est effacé du téléphone) : le carnet gardé l'est aussi. Session expirée : gardé.
  if (LOUE.surEvenement) LOUE.surEvenement(function (ev) {
    if (ev.type !== 'compte' || moi()) return;
    proprioVerifie = null;
    toutEffacer('').catch(function () {});
  });

  // ── L'index en mémoire : { cle: { cle, chantier, doc, o, vu } } et le total gardé ──
  var indexMemoire = null;
  function index() {
    if (indexMemoire) return Promise.resolve(indexMemoire);
    return pret().then(function () { return transaction(['index'], 'readonly', function (m) { return m('index').getAll(); }); }).then(function (lignes) {
      var ix = { lignes: {}, total: 0 };
      (lignes || []).forEach(function (l) { ix.lignes[l.cle] = l; ix.total += l.o || 0; });
      indexMemoire = ix;
      return ix;
    });
  }
  C.occupation = function () { return index().then(function (ix) { return ix.total; }).catch(function () { return 0; }); };
  // Place encore utilisable par le carnet, d'après le téléphone (quand il sait le dire)
  function placeLibre() {
    if (!navigator.storage || !navigator.storage.estimate) return Promise.resolve(Infinity);
    return navigator.storage.estimate().then(function (e) {
      return e && e.quota ? Math.max(0, e.quota - (e.usage || 0)) : Infinity;
    }).catch(function () { return Infinity; });
  }
  function supprimer(cles) {
    if (!cles.length) return Promise.resolve();
    return transaction(['index', 'octets'], 'readwrite', function (m) {
      cles.forEach(function (k) { m('index').delete(k); m('octets').delete(k); });
    }).then(function () {
      if (indexMemoire) cles.forEach(function (k) { var l = indexMemoire.lignes[k]; if (l) { indexMemoire.total -= l.o || 0; delete indexMemoire.lignes[k]; } });
    });
  }
  // Fait de la place pour « besoin » octets : les images vues il y a le plus longtemps partent d'abord ;
  // jamais celles du document affiché (« protege » : début de clé). Rend true si la place y est.
  function faireDeLaPlace(besoin, protege) {
    return Promise.all([index(), placeLibre()]).then(function (r) {
      var ix = r[0], libre = r[1];
      var plafond = Math.min(C.PLAFOND, ix.total + libre - C.MARGE);
      if (ix.total + besoin <= plafond) return true;
      var anciennes = Object.keys(ix.lignes).map(function (k) { return ix.lignes[k]; })
        .filter(function (l) { return !protege || l.cle.indexOf(protege) !== 0; })
        .sort(function (a, b) { return (a.vu || 0) - (b.vu || 0); });
      var aRetirer = [], gagne = 0;
      // retirer une image du carnet libère autant de place dans le téléphone : le plafond ne bouge pas
      for (var i = 0; i < anciennes.length && ix.total - gagne + besoin > plafond; i++) { aRetirer.push(anciennes[i].cle); gagne += anciennes[i].o || 0; }
      if (ix.total - gagne + besoin > plafond) return false;   // même vide, le carnet n'a pas la place : on ne retire rien
      return supprimer(aRetirer).then(function () { return true; });
    });
  }
  // Garde une image. Ne lève jamais d'erreur : si le téléphone ne peut pas la garder, elle est seulement affichée.
  C.pleinLe = 0;
  function garder(chantier, doc, page, quoi, octets) {
    var cle = cleImage(chantier, doc, page, quoi), taille = octets.byteLength;
    return faireDeLaPlace(taille, cleChantier(chantier) + '|' + doc + '|').then(function (place) {
      if (!place) { C.pleinLe = Date.now(); return false; }
      var ligne = { cle: cle, chantier: cleChantier(chantier), doc: doc, o: taille, vu: Date.now() };
      return transaction(['index', 'octets'], 'readwrite', function (m) { m('index').put(ligne); m('octets').put({ cle: cle, octets: octets }); }).then(function () {
        if (indexMemoire) { var ancien = indexMemoire.lignes[cle]; indexMemoire.total += taille - (ancien ? ancien.o || 0 : 0); indexMemoire.lignes[cle] = ligne; }
        return true;
      });
    }).catch(function (err) {
      // L'image n'a pas pu être gardée. Seul un vrai « plein » signalé par le téléphone fait rendre de la place : le quart
      // le plus ancien, une seule fois à la fois (huit images arrivent ensemble), jamais le document affiché.
      C.pleinLe = Date.now();
      if (!err || err.name !== 'QuotaExceededError' || purgeEnCours) return false;
      purgeEnCours = true;
      var protege = cleChantier(chantier) + '|' + doc + '|';
      return index().then(function (ix) {
        var anciennes = Object.keys(ix.lignes).map(function (k) { return ix.lignes[k]; })
          .filter(function (l) { return l.cle.indexOf(protege) !== 0; }).sort(function (a, b) { return (a.vu || 0) - (b.vu || 0); });
        return supprimer(anciennes.slice(0, Math.ceil(anciennes.length / 4)).map(function (l) { return l.cle; }));
      }).catch(function () {}).then(function () { setTimeout(function () { purgeEnCours = false; }, 10000); return false; });
    });
  }
  var purgeEnCours = false;
  // Une image gardée (ArrayBuffer), ou null
  C.gardee = function (chantier, doc, page, quoi) {
    var cle = cleImage(chantier, doc, page, quoi);
    return index().then(function (ix) {
      var l = ix.lignes[cle];
      if (!l) return null;
      return transaction(['octets'], 'readonly', function (m) { return m('octets').get(cle); }).then(function (e) {
        if (!e || !e.octets) return null;
        if (Date.now() - (l.vu || 0) > 3600000) {   // « vue » notée au plus une fois par heure (pas une écriture par image)
          l.vu = Date.now();
          transaction(['index'], 'readwrite', function (m) { m('index').put(l); }).catch(function () {});
        }
        return e.octets;
      });
    }).catch(function () { return null; });
  };
  // Ce qui est gardé d'un document : { images, octets, pages: { numéro: true } (pages dont l'aperçu est gardé) }
  C.etat = function (chantier, doc) {
    var debut = cleChantier(chantier) + '|' + doc + '|';
    return index().then(function (ix) {
      var e = { images: 0, octets: 0, pages: {} };
      Object.keys(ix.lignes).forEach(function (k) {
        if (k.indexOf(debut) !== 0) return;
        e.images++; e.octets += ix.lignes[k].o || 0;
        var m = k.slice(debut.length).split('|');
        if (m[1] === 'leger' || m[1] === 'net') e.pages[m[0]] = true;
      });
      return e;
    }).catch(function () { return { images: 0, octets: 0, pages: {} }; });
  };
  C.oublierChantier = function (chantier) {
    var k = cleChantier(chantier);
    return index().then(function (ix) {
      return supprimer(Object.keys(ix.lignes).filter(function (c) { return ix.lignes[c].chantier === k; }));
    }).then(function () { return transaction(['listes'], 'readwrite', function (m) { m('listes').delete(k); }); }).catch(function () {});
  };
  // Demande au téléphone de ne pas effacer les données de l'appli quand il manque de place (une fois suffit)
  C.persister = function () {
    try { if (navigator.storage && navigator.storage.persist) return navigator.storage.persist().catch(function () { return false; }); } catch (e) {}
    return Promise.resolve(false);
  };

  // Une liste vient d'arriver du serveur : elle est gardée, et le ménage est fait dans les images du chantier.
  //  - document redéposé sous le même identifiant (son « empreinte » a changé) : ce qui en était gardé est effacé,
  //    sinon le téléphone continuerait de montrer l'ancien plan ;
  //  - document remplacé par un nouvel indice : l'ancien reste lisible (marqué « ancien ») tant que le nouveau n'a pas
  //    été ouvert sur ce téléphone — une barre de réseau ne doit pas laisser le poseur sans aucun plan ;
  //  - liste vide alors que la précédente ne l'était pas (dossier renommé ou déplacé dans le Drive, par exemple) : la
  //    liste gardée reste affichée, avec un message, et rien n'est effacé tant que cela ne dure pas depuis 24 heures.
  var majConnue = {};   // date de la liste du serveur, par chantier, telle que ce téléphone l'a reçue pendant cette visite
  // quand un document a été déposé (instant du dépôt s'il est connu, sinon son jour)
  function quand(d) { return /^[0-9]{4}-[0-9]{2}-[0-9]{2}T/.test(String(d.empreinte || '')) ? String(d.empreinte) : String(d.date || ''); }
  // Le serveur dit de quelle liste viennent ses images : si elle a changé depuis celle que le téléphone a reçue (nouveau
  // dépôt pendant la lecture), l'image n'est ni affichée ni gardée — la page recharge la liste.
  function listeChangee(chantier, rep) {
    var connue = majConnue[cleChantier(chantier)], recue = rep && rep.data && rep.data.maj;
    return !!connue && !!recue && connue !== recue;
  }
  var CHANGE = { ok: false, code: 'CARNET_INCONNU', message: 'Ce document a changé : rouvrez la liste.' };
  function recevoir(chantier, k, data, ancienne) {
    var recus = data.documents || [];
    var avant = (ancienne && ancienne.documents) || [];
    majConnue[k] = data.maj || 0;
    if (!recus.length && avant.length) {
      var videLe = ancienne.videLe || Date.now();
      if (Date.now() - videLe < 24 * 3600000) {
        ancienne.videLe = videLe;
        return transaction(['listes'], 'readwrite', function (m) { m('listes').put(ancienne); }).catch(function () {}).then(function () {
          return { documents: avant, maj: ancienne.maj, date: ancienne.date, horsReseau: false,
            message: 'Le serveur ne trouve plus le carnet de ce chantier. Si cela dure, prévenez le bureau.' };
        });
      }
    }
    return index().then(function (ix) {
      var apercuGarde = function (id) { return !!(ix.lignes[k + '|' + id + '|1|leger'] || ix.lignes[k + '|' + id + '|1|net']); };
      var presents = {}, effaces = {}, anciens = [];
      recus.forEach(function (d) { presents[d.id] = d; });
      avant.forEach(function (a) {
        var neuf = presents[a.id];
        if (neuf) { if (String(a.empreinte || '') !== String(neuf.empreinte || '')) effaces[a.id] = true; return; }
        var remplacant = a.code ? recus.filter(function (d) { return d.code === a.code; })[0] : null;
        if (remplacant && quand(remplacant) > quand(a) && apercuGarde(a.id) && !apercuGarde(remplacant.id)) anciens.push(Object.assign({}, a, { ancien: true, remplacePar: remplacant.indice || '' }));
      });
      var gardes = {}; anciens.forEach(function (a) { gardes[a.id] = true; });
      var docs = recus.concat(anciens);
      var liste = { cle: k, chantier: data.chantier || chantier, documents: docs, maj: data.maj || 0, date: Date.now() };
      return supprimer(Object.keys(ix.lignes).filter(function (c) {
        var l = ix.lignes[c];
        return l.chantier === k && (effaces[l.doc] || (!presents[l.doc] && !gardes[l.doc]));
      })).then(function () {
        return transaction(['listes'], 'readwrite', function (m) { m('listes').put(liste); });
      }).catch(function () {}).then(function () { return { documents: docs, maj: liste.maj, date: liste.date, horsReseau: false }; });
    }, function () { return { documents: recus, maj: data.maj || 0, date: Date.now(), horsReseau: false }; });
  }

  // ── La liste des documents d'un chantier ──
  // Rend { documents, maj, date, horsReseau } ; ou { interdit: true, message } ; rejette s'il n'y a ni réseau ni liste gardée.
  C.liste = function (chantier) {
    var k = cleChantier(chantier);
    var gardee = function () {
      return pret().then(function () { return transaction(['listes'], 'readonly', function (m) { return m('listes').get(k); }); }).catch(function () { return null; });
    };
    return LOUE.appeler({ action: 'carnet', chantier: chantier }, 25000).then(function (rep) {
      if (rep && rep.ok) return gardee().then(function (ancienne) { return recevoir(chantier, k, rep.data || {}, ancienne); });
      // Refus du chantier : ce que ce compte en gardait est effacé. Compte refusé (désactivé) : tout le carnet gardé est effacé.
      if (rep && rep.code === 'INTERDIT') return C.oublierChantier(chantier).then(function () { return { interdit: true, message: rep.message }; });
      if (rep && rep.code === 'COMPTE_REFUSE') return toutEffacer(moi()).catch(function () {}).then(function () { return { interdit: true, message: rep.message }; });
      // Le serveur a répondu autre chose (liste en cours d'arrivée, session terminée, serveur occupé) : la liste gardée, avec SON message
      return gardee().then(function (g) {
        if (g) return { documents: g.documents, maj: g.maj, date: g.date, horsReseau: false, message: (rep && rep.message) || 'Le serveur ne répond pas' };
        throw Object.assign(new Error((rep && rep.message) || 'Le serveur ne répond pas'), { reponse: rep });
      });
    }, function (err) {
      return gardee().then(function (g) {
        if (g) return { documents: g.documents, maj: g.maj, date: g.date, horsReseau: true };
        throw err;
      });
    });
  };

  // ── Les images : gardées d'abord, sinon demandées au serveur, deux demandes à la fois ──
  function octetsDe(b64) {
    var brut = atob(b64), t = new Uint8Array(brut.length);
    for (var i = 0; i < brut.length; i++) t[i] = brut.charCodeAt(i);
    return t.buffer;
  }
  var file = [], enCours = 0, generation = 0;
  // Abandonne les demandes pas encore parties (la personne a changé de page ou de zone)
  C.abandonner = function () { generation++; file.forEach(function (d) { d.rendre(null); }); file = []; };
  // Les tuiles pas encore demandées au serveur sortent de la file (la personne regarde ailleurs) ; ce qui est parti arrive
  C.abandonnerAttente = function () {
    var parties = file.filter(function (d) { return d.tuiles; });
    file = file.filter(function (d) { return !d.tuiles; });
    parties.forEach(function (d) { d.rendre(null); });
  };
  function avancer() {
    while (enCours < C.EN_MEME_TEMPS && file.length) {
      var d = file.shift();
      enCours++;
      d.partir().then(null, function () {}).then(function () { enCours--; avancer(); });
    }
  }
  function erreurDe(rep) { return Object.assign(new Error((rep && rep.message) || 'Le serveur ne répond pas'), { reponse: rep }); }
  // Aperçu d'une page (« leger » ou « net ») : rend un ArrayBuffer (rejette sans réseau si rien n'est gardé)
  C.apercu = function (chantier, doc, page, quoi) {
    return C.gardee(chantier, doc, page, quoi).then(function (o) {
      if (o) return o;
      return new Promise(function (ok, ko) {
        var gen = generation;
        file.push({ rendre: function () { ko(new Error('abandonné')); }, partir: function () {
          if (gen !== generation) { ko(new Error('abandonné')); return Promise.resolve(); }
          return LOUE.appeler({ action: 'carnetTuiles', chantier: chantier, doc: doc, page: page, quoi: quoi }, 60000).then(function (rep) {
            var im = rep && rep.ok && rep.data.images && rep.data.images[0];
            if (!im) throw erreurDe(rep);
            if (listeChangee(chantier, rep)) throw erreurDe(CHANGE);
            var octets = octetsDe(im.b64);
            ok(octets);
            return garder(chantier, doc, page, quoi, octets);
          }).catch(ko);
        } });
        avancer();
      });
    });
  };
  // Des tuiles d'un niveau : « recu(colonne, ligne, ArrayBuffer) » est appelé pour chacune, dès qu'elle est là ;
  // la promesse rend { manquantes: n, erreur } quand tout est fini (sans réseau : les tuiles non gardées manquent).
  C.tuiles = function (chantier, doc, page, niveau, liste, recu) {
    var bilan = { manquantes: 0, erreur: null }, gen = generation;
    return Promise.all(liste.map(function (t) {
      return C.gardee(chantier, doc, page, 'z' + niveau + ':' + t[0] + ',' + t[1]).then(function (o) { if (o) { recu(t[0], t[1], o); return null; } return t; });
    })).then(function (restantes) {
      restantes = restantes.filter(Boolean);
      if (!restantes.length || gen !== generation) return bilan;
      var lots = [];
      for (var i = 0; i < restantes.length; i += C.PAR_DEMANDE) lots.push(restantes.slice(i, i + C.PAR_DEMANDE));
      var demander = function (lot, tours) {
        return new Promise(function (fini) {
          file.push({ tuiles: true, rendre: function () { bilan.abandonnees = (bilan.abandonnees || 0) + lot.length; fini(); }, partir: function () {
            if (gen !== generation) { fini(); return Promise.resolve(); }
            return LOUE.appeler({ action: 'carnetTuiles', chantier: chantier, doc: doc, page: page, quoi: 'tuiles', niveau: niveau, tuiles: lot }, 60000).then(function (rep) {
              if (!rep || !rep.ok) throw erreurDe(rep);
              if (listeChangee(chantier, rep)) throw erreurDe(CHANGE);
              var suites = [];
              (rep.data.images || []).forEach(function (im) {
                var octets = octetsDe(im.b64);
                if (gen === generation) recu(im.c, im.l, octets);
                suites.push(garder(chantier, doc, page, 'z' + niveau + ':' + im.c + ',' + im.l, octets));
              });
              var reste = rep.data.reste || [];
              // le serveur n'a pas tout rendu (plafond par réponse) : la suite repart dans la file
              var suite = reste.length && tours < 8 && (rep.data.images || []).length ? demander(reste, tours + 1) : Promise.resolve();
              if (reste.length && !(tours < 8 && (rep.data.images || []).length)) bilan.manquantes += reste.length;
              suite.then(fini);
              return Promise.all(suites);
            }).catch(function (err) { bilan.manquantes += lot.length; bilan.erreur = err; fini(); });
          } });
          avancer();
        });
      };
      return Promise.all(lots.map(function (l) { return demander(l, 0); })).then(function () { return bilan; });
    });
  };

  // ═══════════════ Lot 4b : hors réseau complet ═══════════════
  // « Tout télécharger » va chercher TOUTES les images d'un document (aperçus et tuiles de chaque niveau), une seule
  // demande à la fois (le serveur est partagé par toute l'entreprise), par lots d'environ 1,2 Mo. Il s'arrête sur
  // demande, reprend où il en était (ce qui est gardé n'est jamais redemandé), et s'arrête de lui-même si le carnet
  // n'a plus de place — les fiches passent toujours avant.
  C.LOT_MASSE = 1200 * 1024;   // octets d'images par demande (le serveur en accepte 1 500 Ko)
  C.TUILES_MASSE = 60;         // tuiles par demande (le serveur en accepte 64)
  // Toutes les images d'un document : [{ page, quoi, o, niveau, c, l }]
  function imagesDe(d) {
    var t = [];
    (d.pages || []).forEach(function (p, i) {
      ['leger', 'net'].forEach(function (q) { if (p[q] && p[q].f) t.push({ page: i + 1, quoi: q, o: Number(p[q].o) || 0 }); });
      (p.niveaux || []).forEach(function (nv) {
        (nv.paquets || []).forEach(function (pq) {
          (pq.tuiles || []).forEach(function (tu) { t.push({ page: i + 1, quoi: 'z' + nv.z + ':' + tu[0] + ',' + tu[1], o: Number(tu[3]) || 0, niveau: nv.z, c: tu[0], l: tu[1] }); });
        });
      });
    });
    return t;
  }
  function cleComplet(chantier, id) { return 'complet|' + cleChantier(chantier) + '|' + id; }
  // Où en est un document : { total, gardees, octets, octetsGardes, complet, etaitComplet }
  //  - complet : toutes ses images sont dans le téléphone ;
  //  - etaitComplet : il a été téléchargé en entier (ce dépôt-là) ; s'il ne l'est plus, le téléphone a fait du ménage.
  C.bilan = function (chantier, d) {
    return index().then(function (ix) {
      return transaction(['meta'], 'readonly', function (m) { return m('meta').get(cleComplet(chantier, d.id)); }).catch(function () { return null; }).then(function (marque) {
        var b = { total: 0, gardees: 0, octets: 0, octetsGardes: 0 };
        imagesDe(d).forEach(function (im) {
          b.total++; b.octets += im.o;
          if (ix.lignes[cleImage(chantier, d.id, im.page, im.quoi)]) { b.gardees++; b.octetsGardes += im.o; }
        });
        b.complet = b.total > 0 && b.gardees === b.total;
        b.etaitComplet = !!marque && String(marque.empreinte || '') === String(d.empreinte || '');
        return b;
      });
    }).catch(function () { return { total: 0, gardees: 0, octets: 0, octetsGardes: 0, complet: false, etaitComplet: false }; });
  };
  var enCoursMasse = null;   // { arret } : un seul téléchargement complet à la fois
  C.telechargementEnCours = function () { return !!enCoursMasse; };
  C.arreterTelechargement = function () { if (enCoursMasse) enCoursMasse.arret = true; };
  function attendreMs(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }
  // Une demande « de masse », reprise deux fois si le serveur est occupé (attente au hasard : tous les téléphones ne
  // reviennent pas à la même seconde)
  function demanderMasse(corps, essai) {
    return LOUE.appeler(corps, 120000).then(function (rep) {
      if (rep && rep.code === 'SERVEUR_OCCUPE' && (essai || 0) < 2) return attendreMs(5000 + Math.random() * 10000).then(function () { return demanderMasse(corps, (essai || 0) + 1); });
      return rep;
    });
  }
  // Télécharge tout ce qui manque d'un document. « progres(octetsGardes, octets) » est appelé au fil de l'eau.
  // Rend { fini, arrete, plein, erreur } (jamais de rejet) ; « erreur » porte le message à montrer.
  C.telecharger = function (chantier, d, progres) {
    if (enCoursMasse) return Promise.resolve({ fini: false, erreur: 'Un téléchargement est déjà en cours.' });
    var moiMeme = enCoursMasse = { arret: false };
    var finir = function (r) { if (enCoursMasse === moiMeme) enCoursMasse = null; return r; };
    return index().then(function (ix) {
      var toutes = imagesDe(d), fait = 0, total = 0;
      var manque = toutes.filter(function (im) {
        total += im.o;
        if (ix.lignes[cleImage(chantier, d.id, im.page, im.quoi)]) { fait += im.o; return false; }
        return true;
      });
      var dire = function () { try { if (progres) progres(fait, total); } catch (e) {} };
      dire();
      // les lots : chaque aperçu seul ; les tuiles d'une même page et d'un même niveau ensemble, jusqu'à la taille d'un lot
      var lots = [];
      manque.filter(function (im) { return im.niveau === undefined; }).forEach(function (im) { lots.push({ page: im.page, quoi: im.quoi, images: [im] }); });
      var courant = null;
      manque.filter(function (im) { return im.niveau !== undefined; }).forEach(function (im) {
        if (!courant || courant.page !== im.page || courant.niveau !== im.niveau || courant.o + im.o > C.LOT_MASSE || courant.images.length >= C.TUILES_MASSE) {
          courant = { page: im.page, quoi: 'tuiles', niveau: im.niveau, images: [], o: 0 }; lots.push(courant);
        }
        courant.images.push(im); courant.o += im.o;
      });
      var suivant = function () {
        if (moiMeme.arret) return { fini: false, arrete: true };
        var lot = lots.shift();
        if (!lot) return null;
        var corps = { action: 'carnetTuiles', chantier: chantier, doc: d.id, page: lot.page, quoi: lot.quoi, masse: true };
        if (lot.quoi === 'tuiles') { corps.niveau = lot.niveau; corps.tuiles = lot.images.map(function (im) { return [im.c, im.l]; }); }
        return demanderMasse(corps).then(function (rep) {
          if (!rep || !rep.ok) return { fini: false, erreur: (rep && rep.message) || 'Le serveur ne répond pas.', reponse: rep };
          if (listeChangee(chantier, rep)) return { fini: false, erreur: CHANGE.message, reponse: CHANGE };
          var recues = rep.data.images || [];
          if (!recues.length) return { fini: false, erreur: 'Le serveur n’a rien rendu pour une partie du document : réessayez plus tard.' };
          // rangées l'une après l'autre : si le carnet n'a plus de place, on s'arrête là
          var ranger = function (i) {
            if (i >= recues.length) return Promise.resolve(true);
            var im = recues[i], quoi = lot.quoi === 'tuiles' ? 'z' + lot.niveau + ':' + im.c + ',' + im.l : lot.quoi, octets = octetsDe(im.b64);
            return garder(chantier, d.id, lot.page, quoi, octets).then(function (gardee) {
              if (!gardee) return false;
              fait += octets.byteLength; dire();
              return ranger(i + 1);
            });
          };
          return ranger(0).then(function (place) {
            if (!place) return { fini: false, plein: true };
            // ce que le serveur n'a pas rendu cette fois (plafond par réponse) repart en tête
            var reste = rep.data.reste || [];
            if (lot.quoi === 'tuiles' && reste.length) {
              var cles = {}; reste.forEach(function (t) { cles[t[0] + ',' + t[1]] = true; });
              lots.unshift({ page: lot.page, quoi: 'tuiles', niveau: lot.niveau, o: 0, images: lot.images.filter(function (im) { return cles[im.c + ',' + im.l]; }) });
            }
            return suivant();
          });
        });
      };
      return Promise.resolve(suivant()).then(function (r) {
        if (r) return r;
        // tout y est : on le note, pour pouvoir dire plus tard « plus disponible » si le téléphone fait du ménage
        return transaction(['meta'], 'readwrite', function (m) { m('meta').put({ cle: cleComplet(chantier, d.id), empreinte: String(d.empreinte || ''), date: Date.now() }); })
          .catch(function () {}).then(function () { return { fini: true }; });
      });
    }).then(finir, function (err) { return finir({ fini: false, erreur: LOUE.messageClair ? LOUE.messageClair(err) : 'Pas de réseau.' }); });
  };

  // ── Wi-Fi : seul Chrome sur Android sait dire si le téléphone est en Wi-Fi ──
  C.saitWifi = function () { var c = navigator.connection; return !!c && typeof c.type === 'string' && c.type !== ''; };
  C.wifi = function () { var c = navigator.connection; return !!c && c.type === 'wifi' && !c.saveData; };
  var CLE_AUTO = 'loue_carnet_auto_' + (CONFIG.env || 'prod');
  C.autoActif = function () { try { return localStorage.getItem(CLE_AUTO) !== 'non'; } catch (e) { return true; } };
  C.reglerAuto = function (oui) { try { localStorage.setItem(CLE_AUTO, oui ? 'oui' : 'non'); } catch (e) {} };
  // Télécharge tout seul, EN WI-FI SEULEMENT, les documents incomplets des chantiers donnés (5 au plus), l'un après l'autre.
  // « suivi({ chantier, doc, fait, total }) » est appelé au fil de l'eau ; rend le nombre de documents complétés.
  // Départ retardé au hasard : le lundi matin, tous les téléphones du dépôt ne partent pas à la même seconde.
  C.autoWifi = function (chantiers, suivi, delaiMax) {
    if (!C.wifi() || !C.autoActif() || enCoursMasse || !LOUE.compte || !LOUE.compte()) return Promise.resolve(0);
    var noms = (chantiers || []).slice(0, 5), faits = 0;
    var doc = function (chantier, docs) {
      var d = docs.shift();
      if (!d || !C.wifi() || document.visibilityState === 'hidden') return Promise.resolve();
      return C.bilan(chantier, d).then(function (b) {
        if (b.complet || d.ancien) return doc(chantier, docs);
        return C.telecharger(chantier, d, function (fait, total) { try { if (suivi) suivi({ chantier: chantier, doc: d, fait: fait, total: total }); } catch (e) {} }).then(function (r) {
          if (r.fini) { faits++; return doc(chantier, docs); }   // arrêt, plein, erreur : on n'insiste pas
        });
      });
    };
    var chantier = function () {
      var nom = noms.shift();
      if (!nom || !C.wifi()) return Promise.resolve();
      return C.liste(nom).then(function (r) { return r && r.documents && !r.horsReseau && !r.message ? doc(nom, r.documents.slice()) : null; }, function () {}).then(chantier);
    };
    return attendreMs(Math.random() * (delaiMax === undefined ? 30000 : delaiMax)).then(chantier).then(function () { return faits; });
  };
})();
