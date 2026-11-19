// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// LOT 12 (plan : lot 11.1d) — LES CHANTIERS DU PLANNING, MIS TOUT SEULS EN FAVORIS
//
// Règles de Franck (19/11/2026) : un chantier où un gars est planifié arrive tout seul dans « Mes chantiers » de son
// appli. Le planning ne donne AUCUN accès et ne retire jamais rien. Un favori retiré par le gars ne revient qu'après une
// coupure (une semaine publiée sans lui sur ce chantier, puis une nouvelle planification). Plafond : 4 favoris nouveaux
// au plus par gars et par semaine ; au-delà, rien n'est ajouté pour ce gars et Franck reçoit un mail.
//
//   - ÉTEINT tant que la propriété du script PLANNING_SHEET_ID n'existe pas (le Sheet « Planning Loué » est le lot 11.1) :
//     sans elle, ce fichier ne lit rien, n'écrit rien, et ne coûte rien ;
//   - SENS UNIQUE : le serveur de l'appli LIT le planning ; il n'y écrit jamais (une seule fonction l'ouvre : planifLire_,
//     et elle ne fait que lire ; un test le vérifie). Le planning n'écrit jamais dans le Sheet de l'appli ;
//   - ce qu'il lit : l'onglet « APPLI » du planning, tenu par le programme de publication du planning (compte de Loué) :
//     une ligne « SEMAINE » par semaine publiée, une ligne « PLANIFIE » par gars et par chantier de cette semaine ;
//   - il ne s'y fie pas : le compte doit exister et être actif dans l'onglet Utilisateurs, le numéro doit être celui d'UN
//     SEUL chantier non « Terminé » de l'onglet Chantiers (comparé en entier : « 90 » ne vaut pas pour « 901 ») ;
//   - ce qu'il écrit : l'onglet « Planifiés » du Sheet de l'appli (une ligne par gars et par chantier : début de la série,
//     dernière semaine planifiée), et en colonne H ce que Franck doit regarder (« à voir ») ;
//   - quand : toutes les 30 minutes au plus (dans le passage de 10 minutes qui existe déjà), en quelques secondes ; si le
//     planning n'a pas changé depuis la dernière lecture, une seule cellule est lue. Une fois par jour, tout est relu ;
//   - le téléphone reçoit, avec la liste des chantiers, « planifie : <lundi du début de la série> ». C'est lui qui tient
//     les étoiles (commun/favoris.js) : une série qu'il ne connaît pas encore met une étoile, une fois.
// Plan : docs/lot11-1-plan.md (chapitre 13) et docs/lot12-plan.md. Décisions : D12-… (DECISIONS.md).
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
const SHEET_PLANIFIES = 'Planifiés';
const PLANIF_ENTETES = ['Compte', 'N° du chantier', 'Chantier', 'Série commencée le (lundi)', 'Dernière semaine planifiée (lundi)', 'Mis à jour le',
  '', 'À voir (écrit par l’appli)'];
const COL_PL = { compte: 1, numero: 2, chantier: 3, debut: 4, derniere: 5, maj: 6, aVoir: 8 };
const PLANIF_PROP_ID = 'PLANNING_SHEET_ID';     // identifiant du Sheet « Planning Loué » (jamais dans le dépôt)
const PLANIF_PROP_ETAT = 'PLANIF_ETAT';         // { dernier, jour, marque, semaines: { lundi: publié le }, alertes: { compte|lundi: 1 } }
const PLANIF_ONGLET = 'APPLI';                  // l'onglet du planning lu par l'appli
const PLANIF_INTERVALLE_MS = 30 * 60 * 1000;    // une lecture du planning toutes les 30 minutes au plus
const PLANIF_PLAFOND = 4;                       // favoris nouveaux par gars et par semaine
const PLANIF_LIGNES_MAX = 3000;                 // lignes lues dans l'onglet du planning, au plus
const PLANIF_SEMAINES = 4;                      // semaines traitées : de 4 semaines avant à 4 semaines après aujourd'hui
const PLANIF_VISIBLE_JOURS = 56;                // une série terminée depuis plus de 8 semaines n'est plus envoyée au téléphone
const PLANIF_A_VOIR_MAX = 100;

let PLANIFIES_LUS_ = null;   // onglet Planifiés lu une fois par requête (remis à zéro par routerV5_ et par traiterComptes)

// ── Dates : un lundi s'écrit « AAAA-MM-JJ » (comparable comme un texte, sans problème au passage d'année) ──
function planifIso_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) return Utilities.formatDate(v, 'Europe/Paris', 'yyyy-MM-dd');
  const t = String(v === undefined || v === null ? '' : v).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : '';
}
function planifDecaler_(iso, jours) {
  const p = iso.split('-').map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2] + jours)).toISOString().slice(0, 10);
}
function planifAujourdhui_() { return Utilities.formatDate(new Date(maintenant_()), 'Europe/Paris', 'yyyy-MM-dd'); }

// ── L'état gardé d'un passage à l'autre ──
function planifEtat_() {
  let e = {};
  try { e = JSON.parse(PropertiesService.getScriptProperties().getProperty(PLANIF_PROP_ETAT) || '{}') || {}; } catch (x) { e = {}; }
  if (typeof e !== 'object' || Array.isArray(e)) e = {};
  if (!e.semaines || typeof e.semaines !== 'object') e.semaines = {};
  if (!e.alertes || typeof e.alertes !== 'object') e.alertes = {};
  return e;
}
function planifEcrireEtat_(e) {
  // On ne garde que les semaines et les alertes des 12 dernières semaines (la propriété reste petite)
  const limite = planifDecaler_(planifAujourdhui_(), -84);
  Object.keys(e.semaines).forEach(l => { if (l < limite) delete e.semaines[l]; });
  Object.keys(e.alertes).forEach(k => { if (String(k).split('|')[1] < limite) delete e.alertes[k]; });
  PropertiesService.getScriptProperties().setProperty(PLANIF_PROP_ETAT, JSON.stringify(e));
}

// ── LA SEULE FONCTION QUI OUVRE LE PLANNING. Elle ne fait que lire. ──
// Rend null si le planning n'a pas changé depuis « marqueConnue » (une seule cellule lue), sinon { marque, lignes }.
function planifLire_(id, marqueConnue) {
  const sh = SpreadsheetApp.openById(id).getSheetByName(PLANIF_ONGLET);
  if (!sh) throw new Error('onglet « ' + PLANIF_ONGLET + ' » absent du planning');
  const marque = String(sh.getRange(1, 8).getValue());           // H1 : changée par le planning à chaque publication
  if (marque && marqueConnue && marque === marqueConnue) return null;
  const n = Math.min(PLANIF_LIGNES_MAX, sh.getLastRow() - 1);
  return { marque: marque, lignes: n > 0 ? sh.getRange(2, 1, n, 5).getValues() : [] };
}

// ── Le passage (appelé par traiterComptes toutes les 10 minutes, APRÈS qu'il a rendu son verrou). Ne lève jamais d'erreur. ──
function planifPassage_() {
  try {
    const id = PropertiesService.getScriptProperties().getProperty(PLANIF_PROP_ID);
    if (!id) return 'éteint';
    const etat = planifEtat_(), m = maintenant_();
    if (etat.dernier && m >= etat.dernier && m - etat.dernier < PLANIF_INTERVALLE_MS) return 'trop tôt';
    const verrou = LockService.getScriptLock();
    if (!verrou.tryLock(5000)) return 'occupé';
    try { return planifTraiter_(String(id), etat, m); } finally { verrou.releaseLock(); }
  } catch (e) { console.error('planifPassage_ :', e.message); return 'erreur : ' + e.message; }
}

function planifTraiter_(id, etat, m) {
  const aujourdhui = planifAujourdhui_();
  const force = etat.jour !== aujourdhui;                         // une fois par jour : tout est relu, même si rien n'a changé
  etat.dernier = m;
  let lu;
  try { lu = planifLire_(id, force ? '' : etat.marque); }
  catch (e) { planifEcrireEtat_(etat); console.error('planifLire_ :', e.message); return 'planning illisible : ' + e.message; }
  if (!lu) { planifEcrireEtat_(etat); return 'inchangé'; }

  // 1. Ce que dit le planning : semaines publiées, et qui est planifié où
  const publiees = {}, planifs = {};
  lu.lignes.forEach(r => {
    const sorte = String(r[0] || '').trim().toUpperCase(), lundi = planifIso_(r[1]);
    if (!lundi) return;
    // « Publié le » : seulement comparé à lui-même d'une lecture à l'autre (une date de Sheets est prise à la milliseconde)
    if (sorte === 'SEMAINE') {
      publiees[lundi] = Object.prototype.toString.call(r[4]) === '[object Date]' ? String(r[4].getTime()) : String(r[4] === undefined || r[4] === null ? '' : r[4]);
      return;
    }
    if (sorte !== 'PLANIFIE') return;
    const compte = normaliserId_(r[2]), numero = crCleNumero_(r[3]);
    if (!compte || !numero) return;
    planifs[lundi] = planifs[lundi] || {};
    planifs[lundi][compte] = planifs[lundi][compte] || {};
    planifs[lundi][compte][numero] = true;
  });
  const debutFenetre = planifDecaler_(aujourdhui, -7 * PLANIF_SEMAINES), finFenetre = planifDecaler_(aujourdhui, 7 * PLANIF_SEMAINES);
  const aTraiter = Object.keys(publiees).filter(l => l >= debutFenetre && l <= finFenetre && (force || etat.semaines[l] !== publiees[l])).sort();
  // Toutes les semaines publiées connues (déjà lues, ou dans le planning) : elles servent à reconnaître une coupure
  const connues = {};
  Object.keys(etat.semaines).forEach(l => { connues[l] = true; });
  Object.keys(publiees).forEach(l => { connues[l] = true; });
  const coupure = (derniere, lundi) => Object.keys(connues).some(x => x > derniere && x < lundi);

  // 2. Ce que le bureau sait : chantiers (un numéro = un seul chantier non terminé) et comptes actifs
  const parNumero = {};
  lignesChantiers_().forEach(r => { const n = crCleNumero_(r.length > 4 ? r[4] : ''); if (n) (parNumero[n] = parNumero[n] || []).push(r); });
  const chantierDe = n => { const l = parNumero[n]; return l && l.length === 1 && String(l[0][2] || '').trim() !== 'Terminé' ? String(l[0][0]).trim() : ''; };
  UTILISATEURS_ = null;
  const u = utilisateurs_();

  // 3. L'onglet Planifiés tel qu'il est
  const sh = feuille_(SHEET_PLANIFIES, PLANIF_ENTETES);
  const derniereLigne = sh.getLastRow();
  const existantes = derniereLigne > 1 ? sh.getRange(2, 1, derniereLigne - 1, COL_PL.derniere).getValues() : [];
  const entrees = {};
  existantes.forEach((r, i) => {
    const compte = normaliserId_(r[COL_PL.compte - 1]), numero = crCleNumero_(r[COL_PL.numero - 1]);
    if (compte && numero) entrees[compte + '|' + numero] = { ligne: i + 2, debut: planifIso_(r[COL_PL.debut - 1]), derniere: planifIso_(r[COL_PL.derniere - 1]) };
  });

  // 4. Semaine par semaine, de la plus ancienne à la plus récente
  const aVoir = [], modifiees = {}, nouvelles = [];
  const voir = t => { if (aVoir.indexOf(t) < 0 && aVoir.length < PLANIF_A_VOIR_MAX) aVoir.push(t); };
  aTraiter.forEach(lundi => {
    const comptes = planifs[lundi] || {};
    Object.keys(comptes).sort().forEach(compte => {
      if (!compteUtilisable_(u, compte)) { voir('Semaine du ' + lundi + ' : le compte « ' + compte + ' » est inconnu ou inactif dans l’onglet Utilisateurs (ignoré)'); return; }
      const nouveaux = [];
      Object.keys(comptes[compte]).sort().forEach(numero => {
        if (!chantierDe(numero)) { voir('Semaine du ' + lundi + ' : le numéro « ' + numero + ' » n’est pas celui d’un seul chantier en cours (ignoré)'); return; }
        const cle = compte + '|' + numero, e = entrees[cle];
        if (!e || !e.derniere) { nouveaux.push(numero); return; }
        if (lundi <= e.derniere) return;                             // semaine déjà comptée
        if (coupure(e.derniere, lundi)) { nouveaux.push(numero); return; }
        e.derniere = lundi; modifiees[cle] = true;                   // la série continue
      });
      if (nouveaux.length > PLANIF_PLAFOND) {
        // Trop de chantiers nouveaux d'un coup (collage raté, mauvaise ligne) : rien n'est ajouté pour ce gars cette semaine-là
        voir('Semaine du ' + lundi + ' : ' + nouveaux.length + ' chantiers nouveaux pour « ' + compte + ' » (plus de ' + PLANIF_PLAFOND + ') : aucun n’est ajouté');
        const marque = compte + '|' + lundi;
        if (!etat.alertes[marque] && planifAlerter_(u.parId[compte].nom || compte, lundi, nouveaux.length)) etat.alertes[marque] = 1;
        return;
      }
      nouveaux.forEach(numero => {
        const cle = compte + '|' + numero;
        if (entrees[cle]) { entrees[cle].debut = lundi; entrees[cle].derniere = lundi; modifiees[cle] = true; }
        else { entrees[cle] = { ligne: 0, debut: lundi, derniere: lundi }; nouvelles.push(cle); }
      });
    });
    etat.semaines[lundi] = publiees[lundi];
  });

  // 5. Écritures : les lignes changées, les lignes nouvelles, la liste « à voir »
  const quand = new Date(m);
  Object.keys(modifiees).forEach(cle => {
    const e = entrees[cle];
    if (!e.ligne) return;                                            // créée pendant ce passage : écrite avec les nouvelles
    sh.getRange(e.ligne, COL_PL.debut, 1, 2).setNumberFormat('@');
    sh.getRange(e.ligne, COL_PL.debut, 1, 3).setValues([[e.debut, e.derniere, quand]]);
  });
  nouvelles.forEach(cle => {
    const p = cle.split('|'), e = entrees[cle];
    noteAjouterLigne_(sh, [p[0], p[1], chantierDe(p[1]), e.debut, e.derniere, quand], [COL_PL.compte, COL_PL.numero, COL_PL.chantier, COL_PL.debut, COL_PL.derniere]);
  });
  const hauteur = Math.max(1, sh.getLastRow() - 1, PLANIF_A_VOIR_MAX);
  if (sh.getMaxRows() < hauteur + 1) sh.insertRowsAfter(sh.getMaxRows(), hauteur + 1 - sh.getMaxRows());
  sh.getRange(2, COL_PL.aVoir, hauteur, 1).clearContent();
  if (aVoir.length) sh.getRange(2, COL_PL.aVoir, aVoir.length, 1).setValues(aVoir.map(t => [cellule_(t)]));

  etat.marque = lu.marque; etat.jour = aujourdhui;
  planifEcrireEtat_(etat);
  PLANIFIES_LUS_ = null;
  return 'lu : ' + aTraiter.length + ' semaine(s), ' + nouvelles.length + ' nouvelle(s) série(s), ' + Object.keys(modifiees).length + ' prolongée(s)';
}

// Le mail d'alerte du plafond, à Franck seul. Rend vrai s'il est parti (sinon il sera retenté au prochain passage complet).
function planifAlerter_(nom, lundi, nombre) {
  try {
    if (MailApp.getRemainingDailyQuota() < 1) return false;
    GmailApp.sendEmail(emailAdmin_(), '[Loué App] Planning : trop de chantiers nouveaux pour ' + nom,
      'Dans le planning, la semaine du ' + lundi.split('-').reverse().join('/') + ', ' + nom + ' est planifié sur ' + nombre + ' chantiers nouveaux pour lui.\n'
      + 'C’est plus que ' + PLANIF_PLAFOND + ' : aucun n’a été ajouté à « Mes chantiers » de son appli pour cette semaine (collage raté ? mauvaise ligne ?).\n\n'
      + 'S’il s’agit d’une erreur : corrige le planning et publie-le de nouveau. Sinon : il peut mettre lui-même ses étoiles dans l’appli (« Tous les chantiers »).\n'
      + 'Ce mail n’est envoyé qu’une fois par personne et par semaine. Le détail est en colonne H de l’onglet « ' + SHEET_PLANIFIES + ' ».\n\nLoué App',
      { name: NOM_ENTREPRISE });
    return true;
  } catch (e) { console.error('planifAlerter_ :', e.message); return false; }
}

// ── Pour le téléphone : les séries du compte, { numéro du chantier : lundi du début de la série } ──
// Éteint (pas de propriété) ou onglet absent : {} sans rien lire de plus.
function planifiesDuCompte_(id) {
  try {
    if (PLANIFIES_LUS_ === null) {
      PLANIFIES_LUS_ = [];
      if (PropertiesService.getScriptProperties().getProperty(PLANIF_PROP_ID)) {
        const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PLANIFIES);
        if (sh && sh.getLastRow() > 1) PLANIFIES_LUS_ = sh.getRange(2, 1, sh.getLastRow() - 1, COL_PL.derniere).getValues();
      }
    }
    const limite = planifDecaler_(planifAujourdhui_(), -PLANIF_VISIBLE_JOURS), res = {};
    PLANIFIES_LUS_.forEach(r => {
      if (normaliserId_(r[COL_PL.compte - 1]) !== id) return;
      const numero = crCleNumero_(r[COL_PL.numero - 1]), debut = planifIso_(r[COL_PL.debut - 1]), derniere = planifIso_(r[COL_PL.derniere - 1]);
      if (numero && debut && derniere >= limite) res[numero] = debut;
    });
    return res;
  } catch (e) { console.error('planifiesDuCompte_ :', e.message); return {}; }
}
// Ajoute « planifie » aux chantiers rendus à un compte (objets de chantierObjet_). Un numéro porté par deux chantiers ne
// désigne personne : rien n'est ajouté.
function planifMarquer_(compte, chantiers) {
  if (!compte || !compte.id || !chantiers.length) return chantiers;
  const series = planifiesDuCompte_(compte.id);
  if (!Object.keys(series).length) return chantiers;
  const vus = {};
  chantiers.forEach(c => { const n = crCleNumero_(c.numero); if (n) vus[n] = (vus[n] || 0) + 1; });
  chantiers.forEach(c => { const n = crCleNumero_(c.numero); if (n && vus[n] === 1 && series[n]) c.planifie = series[n]; });
  return chantiers;
}

// ── Installation (lot 12) : l'onglet Planifiés est créé par le premier passage ; rien à installer tant que le planning n'existe pas ──
