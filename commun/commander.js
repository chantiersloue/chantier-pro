// ═══════════════════════════════════════════════════════════════
// Loué App — « À commander » (lot 10a-1) : les demandes de petit matériel d'un poseur
// Nécessite commun/config.js et commun/api.js.
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
  var dernierEnvoi = 0;   // heure du dernier envoi confirmé par le bureau
  D.lire = function () {
    var qui = moi(), depart = Date.now();
    if (!qui) return Promise.reject(Object.assign(new Error('Connexion nécessaire'), { connexion: true }));
    return LOUE.appeler({ action: 'demandes' }, 20000).then(function (rep) {
      if (LOUE.estRefusDeConnexion(rep)) throw Object.assign(new Error(rep.message || 'Connexion nécessaire'), { connexion: true });
      if (!rep.ok) throw Object.assign(new Error(rep.code === 'ACTION_INCONNUE' ? 'le serveur n’est pas encore à jour' : (rep.message || 'Demandes indisponibles')), { serveur: true });
      var d = rep.data || {};
      if (!Array.isArray(d.demandes)) d.demandes = [];
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
  if (LOUE.surEvenement) LOUE.surEvenement(function (ev) {
    var a = ev.element, id = moi();
    if (ev.type !== 'envoyee' || !a || a.type !== 'demande' || !id || (a.saisiPar && a.saisiPar !== id)) return;
    dernierEnvoi = Date.now();
    var g = lireGardee(id);
    garder(id, D.integrer(g ? g.donnees : { demandes: [] }, a, ev.reponse), g ? g.date : 0);
  });
})();
