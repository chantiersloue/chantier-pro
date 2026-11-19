// ═══════════════════════════════════════════════════════════════
// Loué App — « Mes chantiers » : les étoiles (lot 12)
// Nécessite commun/config.js.
//
// « Mes chantiers » de l'accueil = les chantiers marqués d'une étoile par la personne. Les étoiles sont gardées DANS LE
// TÉLÉPHONE, par compte : mettre ou retirer une étoile marche sans réseau et n'envoie rien au serveur.
// Un chantier reçoit son étoile tout seul, UNE FOIS, quand le serveur le signale :
//   - « mien » : la case du chantier est cochée pour ce compte (ou la personne en est le conducteur) ;
//   - « planifie » : la personne y est planifiée ; le serveur donne le lundi du début de la série. Une série que le
//     téléphone ne connaît pas encore (première planification, ou retour après une coupure) remet l'étoile.
// Une étoile retirée à la main ne revient donc pas tant que rien de nouveau n'arrive du serveur.
// Rien n'est jamais effacé à la déconnexion (ce sont des préférences) ; un autre compte a ses propres étoiles.
// Les fonctions ci-dessous ne touchent ni à la page ni au réseau : elles sont testées sans navigateur
// (tests/lot12-favoris.test.js).
// ═══════════════════════════════════════════════════════════════
(function (racine) {
  'use strict';
  var LOUE = racine.LOUE = racine.LOUE || {};
  var CONFIG = racine.LOUE_CONFIG || {};
  var F = LOUE.favoris = {};

  function numero(ch) { return String(ch && ch.numero !== undefined && ch.numero !== null ? ch.numero : '').trim().toLowerCase().replace(/\s+/g, ''); }
  function nom(ch) { return String((ch && ch.nom) || '').trim().toLowerCase(); }
  function termine(ch) { return String((ch && ch.statut) || '').trim() === 'Terminé'; }
  F.estTermine = termine;

  // Clé de chaque chantier de la liste : { nom du chantier → clé }. Le NUMÉRO quand il est porté par un seul chantier
  // (un chantier renommé garde son étoile), sinon le nom.
  F.cles = function (chantiers) {
    var combien = {}, res = {};
    (chantiers || []).forEach(function (c) { var n = numero(c); if (n) combien[n] = (combien[n] || 0) + 1; });
    (chantiers || []).forEach(function (c) { var n = numero(c); res[c.nom] = n && combien[n] === 1 ? 'n:' + n : 'c:' + nom(c); });
    return res;
  };
  F.vide = function () { return { v: 1, etoiles: {}, vus: {}, series: {} }; };
  function propre(etat) {
    var e = etat && typeof etat === 'object' ? etat : F.vide();
    ['etoiles', 'vus', 'series'].forEach(function (k) { if (!e[k] || typeof e[k] !== 'object' || Array.isArray(e[k])) e[k] = {}; });
    e.v = 1;
    return e;
  }

  // Reporte dans l'état ce que dit la liste du serveur. Rend { etat, change }.
  // Une liste VIDE ne change rien (panne, pas encore chargée) : elle ne doit pas faire oublier ce qui a déjà été vu.
  F.integrer = function (etat, chantiers) {
    var e = propre(etat), change = !etat;
    if (!chantiers || !chantiers.length) return { etat: e, change: change };
    var cles = F.cles(chantiers), presentes = {};
    chantiers.forEach(function (c) {
      var k = cles[c.nom];
      presentes[k] = true;
      if (c.mien) {
        if (!e.vus[k]) { e.vus[k] = 1; e.etoiles[k] = 1; change = true; }           // signalé pour la première fois : une étoile
      } else if (e.vus[k]) { delete e.vus[k]; change = true; }                        // plus signalé : s'il l'est de nouveau, l'étoile reviendra
      if (c.planifie && e.series[k] !== c.planifie) { e.series[k] = String(c.planifie); e.etoiles[k] = 1; change = true; }   // nouvelle série du planning
    });
    Object.keys(e.vus).forEach(function (k) { if (!presentes[k]) { delete e.vus[k]; change = true; } });   // chantier sorti de la liste
    return { etat: e, change: change };
  };
  F.aEtoile = function (etat, cle) { return !!(etat && etat.etoiles && etat.etoiles[cle]); };
  F.basculer = function (etat, cle, oui) {
    var e = propre(etat);
    if (oui) e.etoiles[cle] = 1; else delete e.etoiles[cle];
    return e;
  };

  // Classement par numéro (« 90 » avant « 403 » avant « 1201 ») ; un chantier sans numéro va à la fin, par ordre alphabétique
  F.trier = function (chantiers) {
    function rang(c) { var m = /^\D*(\d+)/.exec(numero(c)); return m ? Number(m[1]) : Infinity; }
    return (chantiers || []).slice().sort(function (a, b) {
      var ra = rang(a), rb = rang(b);
      if (ra !== rb) return ra - rb;
      var na = numero(a), nb = numero(b);
      if (na !== nb) return na < nb ? -1 : 1;
      return nom(a).localeCompare(nom(b), 'fr');
    });
  };
  // Ce que l'accueil affiche : { mes (étoilés, non terminés), tous (en cours puis terminés), cles }
  F.ranger = function (etat, chantiers) {
    var cles = F.cles(chantiers), tries = F.trier(chantiers);
    return {
      cles: cles,
      mes: tries.filter(function (c) { return F.aEtoile(etat, cles[c.nom]) && !termine(c); }),
      tous: tries.filter(function (c) { return !termine(c); }).concat(tries.filter(termine)),
    };
  };

  // ── Rangement dans le téléphone, par compte ──
  function cleStockage(compteId) { return 'loue_favoris_' + (CONFIG.env || 'prod') + '_' + compteId; }
  F.lire = function (compteId) {
    if (!compteId) return null;
    try { var e = JSON.parse(racine.localStorage.getItem(cleStockage(compteId)) || 'null'); return e && typeof e === 'object' ? propre(e) : null; }
    catch (x) { return null; }
  };
  F.ecrire = function (compteId, etat) {
    if (!compteId) return false;
    try { racine.localStorage.setItem(cleStockage(compteId), JSON.stringify(propre(etat))); return true; } catch (x) { return false; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
