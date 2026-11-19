// ═══════════════════════════════════════════════════════════════════════════════
// PLANNING LOUÉ — LE PROGRAMME DE PUBLICATION (lot 11.1c)
//
// Un programme À PART (script.google.com, dans le compte Google de Loué), invisible depuis le Sheet du planning : seul le
// compte de Loué peut le modifier. C'est lui, et lui seul, qui fait sortir quelque chose du planning :
//   - toutes les 10 minutes (passagePublication) : pour chaque semaine où « Publier » est coché, il fabrique le PDF de
//     l'affiche compacte et le dépose dans le dossier « Planning » de l'appli ; il écrit « Publié le … », décoche la case,
//     et tient l'onglet « APPLI » (ce que lit l'appli pour mettre les chantiers en favoris) ; il prévient si une semaine
//     publiée a été modifiée depuis ;
//   - chaque nuit (passageDeNuit) : il recopie la liste des chantiers depuis le Sheet de l'appli (LECTURE SEULE), retire les
//     PDF des semaines terminées, range les semaines de plus de deux mois dans « HISTORIQUE » et efface l'historique de
//     plus de 12 mois.
// Il ne supprime jamais rien pour de bon (corbeille), et ne met à la corbeille que les fichiers qu'il a LUI-MÊME déposés
// (il garde leurs identifiants). Il n'écrit JAMAIS dans le Sheet de l'appli. Il n'envoie aucun mail.
//
// Réglages (Propriétés du script, jamais dans le dépôt) :
//   PLANNING_ID          : identifiant du Sheet « Planning Loué »
//   APPLI_SHEET_ID       : identifiant du Sheet de l'appli (lu seulement : onglet Chantiers)
//   DOSSIER_PLANNING_ID  : identifiant du dossier Drive « Planning » de l'appli (où vont les PDF)
//   DOSSIER_SAUVEGARDE_ID: (facultatif) un AUTRE dossier, où une copie de chaque PDF publié est gardée
// Les règles (calculs) sont dans Regles.gs ; l'écriture de l'affiche dans Affiche.gs.
// ═══════════════════════════════════════════════════════════════════════════════
const PUB_PROP = { planning: 'PLANNING_ID', appli: 'APPLI_SHEET_ID', dossier: 'DOSSIER_PLANNING_ID', sauvegarde: 'DOSSIER_SAUVEGARDE_ID', etat: 'PUB_ETAT' };
const PUB_SEMAINES_DEVANT = 5;            // on publie de la semaine en cours à 5 semaines devant
const PUB_ESSAIS_MAX = 3;                 // après 3 échecs, la case est décochée (pas d'essai sans fin)
const PUB_GARDER_JOURS = 63;              // une semaine reste deux mois dans le Sheet, puis va dans HISTORIQUE
const PUB_HISTORIQUE_JOURS = 365;         // l'historique est effacé au bout de 12 mois (données personnelles)
const PUB_APPLI_JOURS = 70;               // lignes gardées dans l'onglet APPLI (l'appli y reconnaît les coupures)
const PUB_APPLI_TITRES = ['Sorte', 'Lundi', 'Compte', 'N° du chantier', 'Publié le', '', 'À voir (écrit par le programme)', ''];
const PUB_HISTO_TITRES = ['Lundi', 'Équipe', 'Nom'].concat(PL_JOURS);
var PUB_HORLOGE_ = null;                  // remplacée dans les tests

function pubMaintenant_() { return typeof PUB_HORLOGE_ === 'function' ? PUB_HORLOGE_() : Date.now(); }
function pubAujourdhui_() { return Utilities.formatDate(new Date(pubMaintenant_()), 'Europe/Paris', 'yyyy-MM-dd'); }
// « 20/11 à 16 h 10 »
function pubQuand_() {
  const d = new Date(pubMaintenant_()), f = x => Utilities.formatDate(d, 'Europe/Paris', x);
  return f('dd/MM') + ' à ' + Number(f('HH')) + ' h ' + f('mm');
}
function pubProp_(nom) { return String(PropertiesService.getScriptProperties().getProperty(nom) || '').trim(); }
// L'état gardé d'un passage à l'autre : { semaines: { lundi: { fichier, empreinte, publieLe } }, echecs: { lundi: n }, nuit: 'AAAA-MM-JJ' }
function pubEtat_() {
  let e = {};
  try { e = JSON.parse(PropertiesService.getScriptProperties().getProperty(PUB_PROP.etat) || '{}') || {}; } catch (x) { e = {}; }
  e.semaines = e.semaines || {}; e.echecs = e.echecs || {};
  return e;
}
function pubGarderEtat_(e) { PropertiesService.getScriptProperties().setProperty(PUB_PROP.etat, JSON.stringify(e)); }
function pubMessage_(err) { return String(err && err.message ? err.message : err).slice(0, 140); }
function pubOngletsSemaine_(ss) {
  return ss.getSheets().map(sh => ({ sh: sh, lundi: plLundiDeNom_(sh.getName()) })).filter(x => x.lundi).sort((a, b) => (a.lundi < b.lundi ? -1 : 1));
}
function pubLireOnglet_(sh) {
  const nb = sh.getLastRow();
  return nb >= PL_S.lig1 ? plLireSemaine_(sh.getRange(1, 1, nb, PL_S.nbCol).getValues()) : null;
}
// Les listes du planning (chantiers, véhicules, autres cas)
function pubListes_(ss) {
  const sh = ss.getSheetByName(PL_ONGLETS.listes);
  if (!sh) throw new Error('onglet ' + PL_ONGLETS.listes + ' absent du planning');
  const n = Math.min(PL_L.max, Math.max(0, sh.getLastRow() - PL_L.lig1 + 1));
  const v = n ? sh.getRange(PL_L.lig1, 1, n, PL_L.nbCol).getValues() : [];
  const chantiers = v.map(r => ({ numero: plTexte_(r[PL_L.colNumero - 1]), nom: plTexte_(r[PL_L.colNom - 1]), court: plTexte_(r[PL_L.colCourt - 1]) })).filter(c => c.numero);
  const vehicules = v.map(r => ({ nom: plTexte_(r[PL_L.colVehicule - 1]), couleur: plTexte_(r[PL_L.colCouleur - 1]) })).filter(x => x.nom);
  const casLus = v.map(r => plTexte_(r[PL_L.colCas - 1])).filter(Boolean), cas = casLus.length ? casLus : PL_CAS;
  return { sh: sh, chantiers: chantiers, vehicules: vehicules, cas: cas, index: plIndex_(chantiers, cas),
    demande: n ? v[0][PL_L.colEtat - 1] === true : false };
}

// ══════════════════════════════════════════════════════════
// TOUTES LES 10 MINUTES
// ══════════════════════════════════════════════════════════
function passagePublication() {
  const verrou = LockService.getScriptLock();
  if (!verrou.tryLock(1000)) return 'occupé';
  try { return pubPassage_(); }
  finally { verrou.releaseLock(); }
}
function pubPassage_() {
  const id = pubProp_(PUB_PROP.planning);
  if (!id) return 'pas réglé';
  const ss = SpreadsheetApp.openById(id), etat = pubEtat_();
  const lundiCourant = plLundi_(pubAujourdhui_()), dernier = plDecaler_(lundiCourant, PUB_SEMAINES_DEVANT * 7);
  let listes = null;
  const bilan = [];
  pubOngletsSemaine_(ss).forEach(x => {
    if (x.lundi < plDecaler_(lundiCourant, -7) || x.lundi > dernier) return;
    const ligne = x.sh.getRange(PL_S.ligPublier, PL_S.colCase, 1, 2).getValues()[0];
    const coche = ligne[0] === true, connue = etat.semaines[x.lundi];
    if (!coche && !connue) return;                           // rien de demandé, jamais publiée : l'onglet n'est même pas lu
    listes = listes || pubListes_(ss);
    if (coche) bilan.push(x.sh.getName() + ' : ' + pubPublier_(ss, x, etat, listes, lundiCourant));
    else if (x.lundi >= lundiCourant) pubSurveiller_(x, etat, plTexte_(ligne[1]));
  });
  // La liste des chantiers, demandée « maintenant » par la case de l'onglet LISTES
  const li = listes || (ss.getSheetByName(PL_ONGLETS.listes) ? pubListes_(ss) : null);
  if (li && li.demande) {
    let r = '';
    try { r = pubListe_(ss); } catch (err) { r = '⚠ ' + pubMessage_(err); }      // l'échec est écrit dans la case d'état de la liste
    bilan.push('liste : ' + r);
    li.sh.getRange(PL_L.lig1, PL_L.colEtat).setValue(false);
  }
  pubGarderEtat_(etat);
  return bilan.length ? bilan.join(' ; ') : 'rien à faire';
}

// Publier UNE semaine. Rend 'publiée', ou la raison pour laquelle elle ne l'est pas. Ne lève jamais d'erreur.
function pubPublier_(ss, x, etat, listes, lundiCourant) {
  const sh = x.sh;
  const dire = t => { sh.getRange(PL_S.ligPublier, PL_S.colEtat).setValue(t); };
  const decocher = () => { sh.getRange(PL_S.ligPublier, PL_S.colCase).setValue(false); };
  if (x.lundi < lundiCourant) { decocher(); dire('⚠ Semaine passée : elle n’est pas publiée.'); return 'semaine passée'; }
  let s = null;
  try { s = pubLireOnglet_(sh); } catch (err) { s = null; }
  if (!s || s.lundi !== x.lundi) { decocher(); dire('⚠ Onglet illisible : pas publié. Menu Planning Loué → Vérifier la semaine.'); return 'illisible'; }
  try {
    const nom = plNomFichier_(s.lundi);
    const pdf = pubPdf_(plAffiche_(s, listes.index), listes.vehicules, nom);
    const nouveau = DriveApp.getFolderById(pubProp_(PUB_PROP.dossier)).createFile(pdf);
    const ancien = etat.semaines[s.lundi] ? etat.semaines[s.lundi].fichier : '';
    const quand = pubQuand_();
    etat.semaines[s.lundi] = { fichier: nouveau.getId(), empreinte: plEmpreinte_(plContenu_(s)), publieLe: quand };
    delete etat.echecs[s.lundi];
    pubGarderEtat_(etat);                                    // noté tout de suite : ce fichier est à nous
    if (ancien && ancien !== nouveau.getId()) pubCorbeille_(ancien);
    pubEcrireAppli_(ss, s, quand, listes);
    pubSauvegarde_(pdf, nom);
    decocher(); dire('Publié le ' + quand);
    return 'publiée';
  } catch (err) {
    const n = (etat.echecs[x.lundi] || 0) + 1;
    console.error('Publication de ' + sh.getName() + ' :', pubMessage_(err));
    if (n >= PUB_ESSAIS_MAX) {
      delete etat.echecs[x.lundi]; decocher();
      dire('⚠ Publication impossible (' + pubMessage_(err) + '). Dépose le PDF à la main (voir le guide), ou recoche « Publier » plus tard.');
    } else {
      etat.echecs[x.lundi] = n;
      dire('⚠ Pas encore publié (' + pubMessage_(err) + ') : nouvel essai dans 10 minutes.');
    }
    return 'échec';
  }
}
// Une semaine publiée a-t-elle changé depuis ? La case d'état le dit (les gars voient encore l'ancienne version).
function pubSurveiller_(x, etat, etatAffiche) {
  let s = null;
  try { s = pubLireOnglet_(x.sh); } catch (err) { return; }
  if (!s) return;
  const connue = etat.semaines[x.lundi], change = plEmpreinte_(plContenu_(s)) !== connue.empreinte, signale = etatAffiche.indexOf('⚠ Modifié') === 0;
  if (change && !signale) x.sh.getRange(PL_S.ligPublier, PL_S.colEtat).setValue('⚠ Modifié depuis la publication du ' + connue.publieLe + ' : les gars voient encore l’ancienne version. Recoche « Publier ».');
  if (!change && signale) x.sh.getRange(PL_S.ligPublier, PL_S.colEtat).setValue('Publié le ' + connue.publieLe);
}
// Le PDF de l'affiche compacte : écrite dans un classeur provisoire (mis à la corbeille ensuite), exportée en A4 paysage.
// D'abord par l'adresse d'export (non garantie par Google) ; si elle échoue, par la méthode officielle (getAs), moins bien cadrée.
function pubPdf_(affiche, vehicules, nom) {
  const tmp = SpreadsheetApp.create('Planning (provisoire) ' + nom);
  try {
    const sh = tmp.getSheets()[0];
    plEcrireAffiche_(sh, affiche, vehicules);
    SpreadsheetApp.flush();
    let pdf = null;
    try {
      const rep = UrlFetchApp.fetch(plAdresseExport_(tmp.getId(), sh.getSheetId(), 'A4'),
        { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
      if (rep.getResponseCode() === 200 && String(rep.getBlob().getContentType()).indexOf('pdf') > -1) pdf = rep.getBlob();
    } catch (err) { console.error('Export par adresse refusé :', pubMessage_(err)); }
    if (!pdf) pdf = DriveApp.getFileById(tmp.getId()).getAs('application/pdf');
    return pdf.setName(nom + '.pdf');
  } finally {
    try { DriveApp.getFileById(tmp.getId()).setTrashed(true); } catch (err) { console.error('Classeur provisoire non retiré :', pubMessage_(err)); }
  }
}
function pubCorbeille_(idFichier) {
  try { DriveApp.getFileById(idFichier).setTrashed(true); return true; }
  catch (err) { console.error('Ancien PDF non retiré :', pubMessage_(err)); return false; }
}
// Une copie du PDF dans un AUTRE dossier (facultatif) ; jamais dans le dossier « Planning » : elle serait montrée aux gars
function pubSauvegarde_(pdf, nom) {
  const id = pubProp_(PUB_PROP.sauvegarde);
  if (!id || id === pubProp_(PUB_PROP.dossier)) return;
  try { DriveApp.getFolderById(id).createFile(pdf.copyBlob().setName(nom + ' (publié le ' + pubAujourdhui_() + ').pdf')); }
  catch (err) { console.error('Copie de sauvegarde non faite :', pubMessage_(err)); }
}

// ── L'onglet APPLI : lu par l'appli (jamais par les gars). Ligne 1 = titres ; H1 = une marque qui change à chaque publication. ──
function pubIso_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) return Utilities.formatDate(v, 'Europe/Paris', 'yyyy-MM-dd');
  return plTexte_(v);
}
function pubEcrireAppli_(ss, s, quand, listes) {
  let sh = ss.getSheetByName(PL_ONGLETS.appli);
  if (!sh) sh = ss.insertSheet(PL_ONGLETS.appli, ss.getSheets().length);
  const salaries = ss.getSheetByName(PL_ONGLETS.salaries);
  const lignesSal = salaries && salaries.getLastRow() >= 2 ? salaries.getRange(2, 1, salaries.getLastRow() - 1, 4).getValues() : [];
  const c = plComptes_(lignesSal);
  const n = Math.max(0, sh.getLastRow() - 1), limite = plDecaler_(pubAujourdhui_(), -PUB_APPLI_JOURS);
  const gardees = (n ? sh.getRange(2, 1, n, 5).getValues() : [])
    .map(r => [plTexte_(r[0]), pubIso_(r[1]), plTexte_(r[2]), plTexte_(r[3]), plTexte_(r[4])])
    .filter(r => (r[0] === 'SEMAINE' || r[0] === 'PLANIFIE') && plEstIso_(r[1]) && r[1] !== s.lundi && r[1] >= limite);
  const lignes = gardees.concat(plLignesAppli_([{ semaine: s, publieLe: quand }], c.comptes, listes.index))
    .sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : (a[0] === 'SEMAINE' ? -1 : b[0] === 'SEMAINE' ? 1 : 0)));
  const titres = PUB_APPLI_TITRES.slice(); titres[7] = String(pubMaintenant_());
  if (n) sh.getRange(2, 1, n, 5).clearContent();
  sh.getRange(1, 1, Math.max(2, lignes.length + 1), 5).setNumberFormat('@');
  sh.getRange(1, 1, 1, 8).setValues([titres]);
  if (lignes.length) sh.getRange(2, 1, lignes.length, 5).setValues(lignes);
  // « À voir » : ce que le programme n'a pas pu rattacher (colonne G, sous le titre)
  sh.getRange(2, 7, 30, 1).clearContent();
  if (c.problemes.length) sh.getRange(2, 7, Math.min(30, c.problemes.length), 1).setValues(c.problemes.slice(0, 30).map(p => [p]));
  return lignes.length;
}

// ══════════════════════════════════════════════════════════
// CHAQUE NUIT
// ══════════════════════════════════════════════════════════
function passageDeNuit() {
  const verrou = LockService.getScriptLock();
  if (!verrou.tryLock(30000)) return 'occupé';
  try { return pubNuit_(); }
  finally { verrou.releaseLock(); }
}
function pubNuit_() {
  const id = pubProp_(PUB_PROP.planning);
  if (!id) return 'pas réglé';
  const ss = SpreadsheetApp.openById(id), etat = pubEtat_(), aujourdhui = pubAujourdhui_(), lundiCourant = plLundi_(aujourdhui);
  const bilan = [];
  // Chaque étape est indépendante : une panne de l'une n'empêche pas les autres
  const etape = (nom, f) => { try { bilan.push(nom + ' : ' + f()); } catch (err) { console.error(nom + ' :', pubMessage_(err)); bilan.push(nom + ' : ⚠ ' + pubMessage_(err)); } };
  etape('liste des chantiers', () => pubListe_(ss));
  etape('PDF des semaines terminées', () => pubRetirerTerminees_(etat, lundiCourant));
  etape('historique', () => pubRanger_(ss, etat, aujourdhui));
  etat.nuit = aujourdhui;
  pubGarderEtat_(etat);
  return bilan.join(' ; ');
}

// La liste des chantiers : recopiée depuis l'onglet Chantiers du Sheet de l'appli. SEULE fonction qui ouvre le Sheet de
// l'appli, et elle ne fait que LIRE (un test le vérifie).
function pubLireChantiersAppli_() {
  const id = pubProp_(PUB_PROP.appli);
  if (!id) throw new Error('réglage ' + PUB_PROP.appli + ' absent');
  const sh = SpreadsheetApp.openById(id).getSheetByName('Chantiers');
  if (!sh) throw new Error('onglet Chantiers absent du Sheet de l’appli');
  const n = sh.getLastRow() - 1;
  return n > 0 ? sh.getRange(2, 1, n, 6).getValues() : [];
}
function pubListe_(ss) {
  const li = ss.getSheetByName(PL_ONGLETS.listes);
  if (!li) throw new Error('onglet ' + PL_ONGLETS.listes + ' absent du planning');
  const dire = t => { li.getRange(1, PL_L.colEtat).setValue(t); };
  try {
    const n = Math.min(PL_L.max, Math.max(0, li.getLastRow() - PL_L.lig1 + 1));
    const anciens = (n ? li.getRange(PL_L.lig1, PL_L.colNumero, n, 3).getValues() : []).map(r => ({ numero: r[0], nom: r[1], court: r[2] })).filter(a => plTexte_(a.numero));
    const liste = plListeChantiers_(pubLireChantiersAppli_(), anciens).slice(0, PL_L.max);
    // Une liste vide alors qu'il y en avait une : c'est une panne de lecture, pas une vraie liste. L'ancienne est gardée.
    if (!liste.length && anciens.length) throw new Error('la liste lue dans l’appli est vide');
    li.getRange(PL_L.lig1, PL_L.colNumero, PL_L.max, 4).clearContent().setNumberFormat('@');
    if (liste.length) li.getRange(PL_L.lig1, PL_L.colNumero, liste.length, 3).setValues(liste.map(c => [c.numero, c.nom, c.court]));
    const casLus = (n ? li.getRange(PL_L.lig1, PL_L.colCas, n, 1).getValues() : []).map(r => plTexte_(r[0])).filter(Boolean);
    const choix = plChoix_(plIndex_(liste, casLus.length ? casLus : PL_CAS)).slice(0, PL_L.max);
    if (choix.length) li.getRange(PL_L.lig1, PL_L.colChoix, choix.length, 1).setValues(choix.map(c => [c]));
    dire('à jour du ' + pubQuand_() + ' (' + liste.length + ' chantiers)');
    return liste.length + ' chantiers';
  } catch (err) {
    dire('⚠ pas mise à jour le ' + pubQuand_() + ' (' + pubMessage_(err) + ') : l’ancienne liste est gardée');
    throw err;
  }
}
// Le lundi, les PDF des semaines terminées sortent du dossier « Planning » (corbeille). Seulement ceux que ce programme a déposés.
function pubRetirerTerminees_(etat, lundiCourant) {
  let n = 0;
  Object.keys(etat.semaines).forEach(lundi => {
    const e = etat.semaines[lundi];
    if (lundi >= lundiCourant || !e.fichier) return;
    if (pubCorbeille_(e.fichier)) { e.fichier = ''; n++; }
  });
  // l'état d'une semaine vieille de plus de 3 mois ne sert plus
  Object.keys(etat.semaines).forEach(lundi => { if (lundi < plDecaler_(lundiCourant, -91) && !etat.semaines[lundi].fichier) delete etat.semaines[lundi]; });
  return n + ' retiré(s)';
}
// Les semaines de plus de deux mois vont dans HISTORIQUE (une ligne par gars), puis leur onglet est supprimé ; l'historique
// de plus de 12 mois est effacé. Une semaine n'est supprimée QUE si ses lignes sont bien écrites dans l'historique.
function pubRanger_(ss, etat, aujourdhui) {
  const limite = plDecaler_(aujourdhui, -PUB_GARDER_JOURS), vieux = pubOngletsSemaine_(ss).filter(x => x.lundi < limite);
  let histo = ss.getSheetByName(PL_ONGLETS.historique);
  let rangees = 0, effacees = 0;
  // au plus 4 semaines par nuit (le passage reste court)
  vieux.slice(0, 4).forEach(x => {
    const s = pubLireOnglet_(x.sh);
    if (!s || s.lundi !== x.lundi) return;                                // illisible : laissée en place, à voir par Franck
    if (!histo) { histo = ss.insertSheet(PL_ONGLETS.historique, ss.getSheets().length); histo.getRange(1, 1, 1, PUB_HISTO_TITRES.length).setValues([PUB_HISTO_TITRES]); }
    const lignes = plLignesHistorique_(s);
    if (lignes.length) {
      const debut = Math.max(2, histo.getLastRow() + 1);
      if (histo.getMaxRows() < debut + lignes.length) histo.insertRowsAfter(histo.getMaxRows(), debut + lignes.length - histo.getMaxRows() + 50);
      histo.getRange(debut, 1, lignes.length, PUB_HISTO_TITRES.length).setNumberFormat('@').setValues(lignes);
      SpreadsheetApp.flush();
      const relu = histo.getRange(debut, 1, lignes.length, 3).getValues();
      if (plTexte_(relu[0][0]) !== s.lundi || plTexte_(relu[lignes.length - 1][2]) !== plTexte_(lignes[lignes.length - 1][2])) throw new Error('l’historique n’a pas pu être écrit : la semaine ' + x.sh.getName() + ' est gardée');
    }
    ss.deleteSheet(x.sh);
    rangees++;
  });
  // Effacer l'historique de plus de 12 mois (les lignes sont dans l'ordre des dates : les plus vieilles en haut)
  if (histo && histo.getLastRow() >= 2) {
    const fin = plDecaler_(aujourdhui, -PUB_HISTORIQUE_JOURS);
    const dates = histo.getRange(2, 1, histo.getLastRow() - 1, 1).getValues();
    while (effacees < dates.length && plEstIso_(pubIso_(dates[effacees][0])) && pubIso_(dates[effacees][0]) < fin) effacees++;
    if (effacees) histo.deleteRows(2, effacees);
  }
  return rangees + ' semaine(s) rangée(s), ' + effacees + ' ligne(s) de plus de 12 mois effacée(s)';
}

// ══════════════════════════════════════════════════════════
// INSTALLATION ET VÉRIFICATION (à lancer à la main dans l'éditeur, par le compte de Loué)
// ══════════════════════════════════════════════════════════
// Vérifie les réglages SANS rien modifier, et dit ce qui manque
function verifierPublication() {
  const lignes = [PL_VERSION + ' — programme de publication'];
  const voir = (nom, f) => { try { lignes.push('✅ ' + nom + ' : ' + f()); } catch (err) { lignes.push('❌ ' + nom + ' : ' + pubMessage_(err)); } };
  voir('Planning (' + PUB_PROP.planning + ')', () => { const ss = SpreadsheetApp.openById(pubProp_(PUB_PROP.planning)); return '« ' + ss.getName() + ' », ' + pubOngletsSemaine_(ss).length + ' semaine(s)'; });
  voir('Sheet de l’appli (' + PUB_PROP.appli + '), lu seulement', () => pubLireChantiersAppli_().length + ' ligne(s) dans l’onglet Chantiers');
  voir('Dossier « Planning » de l’appli (' + PUB_PROP.dossier + ')', () => '« ' + DriveApp.getFolderById(pubProp_(PUB_PROP.dossier)).getName() + ' »');
  const sauv = pubProp_(PUB_PROP.sauvegarde);
  if (!sauv) lignes.push('• Copie de sauvegarde (' + PUB_PROP.sauvegarde + ') : pas réglée (facultatif)');
  else if (sauv === pubProp_(PUB_PROP.dossier)) lignes.push('❌ Copie de sauvegarde : c’est le même dossier que « Planning » (les copies seraient montrées aux gars) : elle n’est pas faite');
  else voir('Copie de sauvegarde (' + PUB_PROP.sauvegarde + ')', () => '« ' + DriveApp.getFolderById(sauv).getName() + ' »');
  const poses = ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction());
  ['passagePublication', 'passageDeNuit'].forEach(f => lignes.push((poses.indexOf(f) > -1 ? '✅' : '❌') + ' Minuterie ' + f + (poses.indexOf(f) > -1 ? ' : posée' : ' : absente (lance installerPublication)')));
  const e = pubEtat_();
  lignes.push('Semaines publiées connues : ' + (Object.keys(e.semaines).sort().join(', ') || 'aucune') + ' ; dernier passage de nuit : ' + (e.nuit || 'jamais'));
  Logger.log(lignes.join('\n'));
  return lignes.join('\n');
}
// Pose les deux minuteries (une seule fois chacune). Ne publie rien.
function installerPublication() {
  const poses = ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction());
  if (poses.indexOf('passagePublication') < 0) ScriptApp.newTrigger('passagePublication').timeBased().everyMinutes(10).create();
  if (poses.indexOf('passageDeNuit') < 0) ScriptApp.newTrigger('passageDeNuit').timeBased().atHour(3).everyDays(1).create();
  return verifierPublication();
}
// Retire les minuteries (retour arrière : plus rien ne tourne)
function arreterPublication() {
  let n = 0;
  ScriptApp.getProjectTriggers().forEach(t => { if (['passagePublication', 'passageDeNuit'].indexOf(t.getHandlerFunction()) > -1) { ScriptApp.deleteTrigger(t); n++; } });
  return n + ' minuterie(s) retirée(s)';
}
