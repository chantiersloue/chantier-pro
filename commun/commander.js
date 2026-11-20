// ═══════════════════════════════════════════════════════════════
// Loué App — « À commander » (lots 10a-1 et 10a-2) : les demandes de petit matériel d'un poseur
// Nécessite commun/config.js et commun/api.js.
//
// Lot 10a-2 — les articles « appris » et les propositions, calculés DANS LE TÉLÉPHONE (hors réseau aussi) :
//  - les articles habituels d'un compte ne sont pas comptés à part : ils sont RECOMPTÉS à chaque affichage à partir de
//    « Mes demandes » (la liste gardée pour ce compte, 90 jours) et des demandes encore dans la file d'envoi. Téléphone
//    changé, appli réinstallée, second téléphone : ils reviennent tout seuls dès que « Mes demandes » est relu au bureau ;
//  - la liste « Articles » du Sheet (facultative) arrive avec « Mes demandes » et est gardée dans le téléphone ;
//  - la recherche ignore majuscules et accents, « x » vaut « × », et chaque mot tapé doit être le DÉBUT d'un mot.
//
// Écriture : une demande part par la file d'attente commune (LOUE.mettreEnFile, type « demande ») ; ce fichier ne fait
// que LIRE et GARDER « Mes demandes ».
// La dernière liste reçue du bureau est gardée dans le téléphone PAR COMPTE (hors réseau, on retrouve ses demandes) et
// n'est jamais rendue à quelqu'un d'autre : sans compte connecté, rien n'est rendu.
// Chargé aussi par l'accueil : une demande écrite hors réseau part souvent de là, au retour du réseau, et elle entre
// alors dans la liste gardée.
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var LOUE = window.LOUE = window.LOUE || {};
  var CONFIG = window.LOUE_CONFIG || {};
  var D = LOUE.demandes = {};

  D.MAX_QUOI = 80;
  D.MAX_QUANTITE = 30;
  D.SORTES = { commander: 'À commander', panne: 'Outil en panne' };
  D.TEXTE_ATTENTE = 'partira dans le prochain récapitulatif';
  D.MAX_BOUTONS = 5;        // lot 10a-2 : gros boutons des articles habituels, au plus
  D.MAX_PROPOSITIONS = 3;   // propositions pendant la frappe, au plus (clavier ouvert : peu de place)
  D.MIN_LETTRES = 2;        // propositions dès 2 lettres (ou chiffres)
  D.MAX_ARTICLES = 500;     // liste « Articles » du Sheet gardée dans le téléphone, au plus

  function moi() { var c = LOUE.compte && LOUE.compte(); return c ? c.profil.id : ''; }
  // Une seule ligne : un retour à la ligne, une tabulation ou un caractère invisible (collage, dictée) devient une espace
  D.nettoyer = function (t, max) {
    return String(t || '').replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, ' ').replace(/ {2,}/g, ' ').trim().slice(0, max).trim();
  };

  // ── Liste gardée dans le téléphone, une par compte ──
  var CLE = 'loue_demandes_' + (CONFIG.env || 'prod') + '_';
  function lireGardee(id) {
    if (!id) return null;
    try { var v = JSON.parse(localStorage.getItem(CLE + id) || 'null'); return v && v.donnees && Array.isArray(v.donnees.demandes) ? v : null; } catch (e) { return null; }
  }
  function garder(id, donnees, date) {
    if (!id) return;
    try { localStorage.setItem(CLE + id, JSON.stringify({ date: date || Date.now(), donnees: donnees })); } catch (e) {}
  }
  // La dernière liste gardée pour le compte connecté (ou null) : affichée tout de suite, avant la réponse du bureau
  D.gardees = function () {
    var g = lireGardee(moi());
    return g ? { donnees: g.donnees, date: g.date, depuisLeTelephone: true } : null;
  };

  // ── « Mes demandes » : le bureau d'abord, sinon la liste gardée ──
  // → promesse de { donnees: { demandes: [{ id, date, sorte, type, quoi, quantite, etat, etatTexte }] }, date, depuisLeTelephone }
  // Lot 10a-2 : la même question rapporte la liste « Articles » du Sheet. Le téléphone dit quelle liste il garde déjà (son
  // empreinte, un code court) : le bureau ne la renvoie que si elle a changé.
  var dernierEnvoi = 0;   // heure du dernier envoi confirmé par le bureau
  D.lire = function () {
    var qui = moi(), depart = Date.now();
    if (!qui) return Promise.reject(Object.assign(new Error('Connexion nécessaire'), { connexion: true }));
    var gardes = lireArticles();
    return LOUE.appeler({ action: 'demandes', articles: gardes ? gardes.empreinte : '' }, 20000).then(function (rep) {
      if (LOUE.estRefusDeConnexion(rep)) throw Object.assign(new Error(rep.message || 'Connexion nécessaire'), { connexion: true });
      if (!rep.ok) throw Object.assign(new Error(rep.code === 'ACTION_INCONNUE' ? 'le serveur n’est pas encore à jour' : (rep.message || 'Demandes indisponibles')), { serveur: true });
      var d = rep.data || {};
      if (!Array.isArray(d.demandes)) d.demandes = [];
      // La liste « Articles » est gardée à part (une seule pour le téléphone), jamais avec les demandes d'un compte
      if (Array.isArray(d.articles) && qui === moi()) garderArticles(d.articles, d.articlesEmpreinte);
      delete d.articles; delete d.articlesEmpreinte;
      // Gardée seulement si c'est toujours le même compte, et si aucun envoi n'a été confirmé depuis le départ de la
      // question (une réponse partie avant un envoi et arrivée après ne doit pas faire disparaître la demande envoyée)
      if (qui === moi() && depart > dernierEnvoi) garder(qui, d);
      else if (qui === moi()) { var g = lireGardee(qui); if (g) d = g.donnees; }
      return { donnees: d, date: Date.now(), depuisLeTelephone: false };
    }, function (err) {
      var g = qui === moi() ? D.gardees() : null;   // pas de réseau : la dernière liste de CE compte
      if (g) return g;
      throw err;
    });
  };

  // ── Demandes encore dans la file d'envoi (du plus récent au plus ancien) ──
  // Celles du compte connecté, et celles écrites sans être connecté (elles partiront sous le nom de qui se connectera).
  D.enAttente = function () {
    var id = moi();
    if (!LOUE.stockage) return Promise.resolve([]);
    return LOUE.stockage.tout('file').then(function (liste) {
      return liste.filter(function (e) {
        return e.type === 'demande' && (!e.env || e.env === CONFIG.env) && e.donnees && (!e.saisiPar || e.saisiPar === id);
      }).sort(function (a, b) { return b.cree - a.cree; });
    }).catch(function () { return []; });
  };

  // Une demande que le bureau vient de confirmer entre dans la liste gardée, quelle que soit la page ouverte.
  // (Écrite sans être connecté : elle est partie sous le nom du compte connecté maintenant.)
  D.integrer = function (donnees, element, reponse) {
    donnees = donnees || { demandes: [] };
    if (!Array.isArray(donnees.demandes)) donnees.demandes = [];
    var d = element.donnees || {};
    if (donnees.demandes.some(function (x) { return x.id === element.id; })) return donnees;
    donnees.demandes.unshift({ id: element.id, date: element.cree || Date.now(), sorte: d.sorte === 'panne' ? 'panne' : 'commander',
      type: D.SORTES[d.sorte] || D.SORTES.commander, quoi: d.quoi || '', quantite: d.quantite || '', etat: 'attente', etatTexte: D.TEXTE_ATTENTE });
    donnees.demandes.sort(function (a, b) { return (b.date || 0) - (a.date || 0); });
    return donnees;
  };

  // ═════════ Lot 10a-2 : articles habituels, liste « Articles » du Sheet, propositions pendant la frappe ═════════

  // Clé de comparaison de deux textes : sans majuscules, sans accents, « × » comme « x » (« 4 x 40 » comme « 4×40 »),
  // espaces simples. (La même règle que le serveur : demCleArticle_, apps-script/Demandes.gs.)
  D.cle = function (t) {
    var texte = String(t === undefined || t === null ? '' : t);
    try { texte = texte.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) {}
    return texte.toLowerCase().replace(/×/g, 'x').replace(/œ/g, 'oe').replace(/æ/g, 'ae')
      .replace(/(\d)\s*x\s*(?=\d)/g, '$1x').replace(/\s+/g, ' ').trim();
  };
  // Les mots d'une clé (lettres et chiffres ; tout le reste sépare)
  function mots(cle) { return cle.split(/[^a-z0-9]+/).filter(Boolean); }

  // ── Les articles habituels de CE compte, du plus demandé au moins demandé (à égalité : le plus récent d'abord) ──
  // demandes : « Mes demandes » de ce compte (liste gardée ou réponse du bureau) ; attente : ses demandes encore dans la
  // file d'envoi (D.enAttente). Seulement « À commander » (pas « Outil en panne »). Une demande présente des deux côtés
  // (elle vient de partir) n'est comptée qu'une fois.
  // → [{ cle, quoi (la dernière écriture), quantite (la dernière demandée), n (nombre de demandes), date }]
  D.appris = function (demandes, attente) {
    var vus = {}, parCle = {}, liste = [];
    function compter(id, sorte, quoi, quantite, date) {
      if (sorte === 'panne' || (id && vus[id])) return;
      if (id) vus[id] = true;
      var texte = D.nettoyer(quoi, D.MAX_QUOI), cle = D.cle(texte);
      if (!cle) return;
      var a = parCle[cle];
      if (!a) { a = parCle[cle] = { cle: cle, quoi: texte, quantite: '', n: 0, date: -1 }; liste.push(a); }
      a.n++;
      // la plus récente fait foi ; à date égale, la première lue (les deux listes sont rangées de la plus récente à la plus ancienne)
      if ((Number(date) || 0) > a.date) { a.date = Number(date) || 0; a.quoi = texte; a.quantite = D.nettoyer(quantite, D.MAX_QUANTITE); }
    }
    (attente || []).forEach(function (e) { var d = e.donnees || {}; compter(e.id, d.sorte, d.quoi, d.quantite, e.cree); });
    (demandes || []).forEach(function (x) { compter(x.id, x.sorte, x.quoi, x.quantite, x.date); });
    return liste.sort(function (a, b) { return (b.n - a.n) || (b.date - a.date); });
  };

  // ── La liste « Articles » du Sheet, gardée dans le téléphone (une seule, la même pour tous les comptes) ──
  // Elle n'est rendue qu'à un compte connecté (le bureau ne la donne qu'aux comptes).
  var CLE_ARTICLES = 'loue_articles_' + (CONFIG.env || 'prod');
  var memoire = { brut: null, valeur: null };   // la liste déjà lue et préparée (relue seulement si elle a changé)
  function lireArticles() {
    var brut = null;
    try { brut = localStorage.getItem(CLE_ARTICLES); } catch (e) {}
    if (brut === memoire.brut) return memoire.valeur;
    var v = null;
    try { v = JSON.parse(brut || 'null'); } catch (e) {}
    if (!v || !Array.isArray(v.liste)) v = null;
    else v = { empreinte: String(v.empreinte || ''), liste: v.liste.map(function (t) { return { quoi: String(t), cle: D.cle(t) }; }) };
    memoire = { brut: brut, valeur: v };
    return v;
  }
  function garderArticles(liste, empreinte) {
    var vus = {}, propre = [];
    liste.forEach(function (t) {
      var texte = typeof t === 'string' ? D.nettoyer(t, D.MAX_QUOI) : '', cle = D.cle(texte);
      if (!cle || vus[cle] || propre.length >= D.MAX_ARTICLES) return;
      vus[cle] = true; propre.push(texte);
    });
    try { localStorage.setItem(CLE_ARTICLES, JSON.stringify({ date: Date.now(), empreinte: String(empreinte || ''), liste: propre })); } catch (e) {}
  }
  // → [{ quoi, cle }] ([] sans compte connecté, ou si aucune liste n'est gardée)
  D.articles = function () { var a = moi() ? lireArticles() : null; return a ? a.liste : []; };

  // ── Propositions pendant la frappe ──
  // Dès D.MIN_LETTRES lettres ou chiffres. Chaque mot tapé doit être le DÉBUT d'un mot de l'article : « vi » propose
  // « Vis 4×40 » et « Embout de vissage » ; « 4x40 » trouve « 4×40 » ; « sil bl » trouve « Cartouches silicone blanc ».
  // D'abord les articles déjà demandés par ce compte (les plus demandés en premier), puis la liste du Sheet (dans son ordre).
  // Un article de la liste du Sheet écrit exactement comme ce qui est tapé n'est pas proposé (il n'apporterait rien).
  // → [{ quoi, quantite (la dernière demandée, '' pour un article de la liste du Sheet), appris: vrai/faux }], « max » au plus
  D.chercher = function (texte, appris, articles, max) {
    var cle = D.cle(texte), demandes = mots(cle), trouves = [], vus = {};
    max = max || D.MAX_PROPOSITIONS;
    if (demandes.join('').length < D.MIN_LETTRES) return trouves;
    function convient(c) {
      var m = mots(c);
      return demandes.every(function (q) { return m.some(function (w) { return w.indexOf(q) === 0; }); });
    }
    (appris || []).forEach(function (a) {
      if (trouves.length >= max || vus[a.cle] || !convient(a.cle)) return;
      vus[a.cle] = true; trouves.push({ quoi: a.quoi, quantite: a.quantite || '', appris: true });
    });
    (articles || []).forEach(function (a) {
      if (trouves.length >= max || vus[a.cle] || a.cle === cle || !convient(a.cle)) return;
      vus[a.cle] = true; trouves.push({ quoi: a.quoi, quantite: '', appris: false });
    });
    return trouves;
  };

  if (LOUE.surEvenement) LOUE.surEvenement(function (ev) {
    var a = ev.element, id = moi();
    if (ev.type !== 'envoyee' || !a || a.type !== 'demande' || !id || (a.saisiPar && a.saisiPar !== id)) return;
    dernierEnvoi = Date.now();
    var g = lireGardee(id);
    garder(id, D.integrer(g ? g.donnees : { demandes: [] }, a, ev.reponse), g ? g.date : 0);
  });
})();
