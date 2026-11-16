// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// LOT 5 — PURGES : libérer la place des chantiers terminés et des anciens indices du carnet, sans rien perdre.
// Les fiches sont d'abord recopiées dans le dossier du chantier sur le PC (que MEGA sauvegarde). La mesure et les alertes sont dans Stockage.gs.
//
// CE QUE CE FICHIER NE FAIT JAMAIS :
//   - aucune suppression définitive : il met à la CORBEILLE de Drive (30 jours), rien d'autre ;
//   - aucune mise à la corbeille sans une case cochée par Franck dans l'onglet « Purges » ;
//   - jamais le dossier d'un chantier, jamais le relevé releve-pc.json, jamais un fichier hors des dossiers de l'appli ;
//   - il ne prend jamais le verrou du script (celui des fiches) : une purge ne retarde jamais une fiche.
//
// Deux sortes de lignes dans l'onglet « Purges », proposées par la mesure de la nuit (prgProposerChantier_) :
//   « Anciens indices du carnet » : les dossiers de documents que carnet.json connaît et qu'AUCUN document montré dans
//       l'appli ne désigne (même fonction que le carnet des téléphones : carnetDocuments_) ;
//   « Chantier terminé » : fiches et photos (fichier par fichier, comparées une à une au relevé releve-pc.json du
//       programme du PC), puis le carnet (dossier de chaque document, carnet.json en dernier).
// traiterPurges() (toutes les 30 minutes) traite les cases : elle sort tout de suite s'il n'y a rien à faire ; sinon
// elle REVÉRIFIE tout, écrit chaque élément « à faire » dans « Purges détail » AVANT de le mettre à la corbeille,
// puis le marque « fait ». La case « Annuler » (25 jours) sort de la corbeille exactement ce que la ligne y a mis.
// Chaque ligne a une clé fixe (dernière colonne) : le serveur la retrouve par sa clé, même si Franck trie l'onglet,
// et n'efface ni ne déplace jamais une ligne.
// Plan : docs/lot5-plan.md (chapitre 4). Décisions : D5-… (DECISIONS.md).
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
const SHEET_PURGES = 'Purges';
const SHEET_PURGES_DETAIL = 'Purges détail';
const PRG_RELEVE = 'releve-pc.json';        // relevé de présence écrit par le programme du PC (seul nom accepté)
// Durée de conservation dans Drive après la clôture : un chantier « Terminé » n'est proposé à la purge qu'au bout de ce
// nombre de jours (décision de Franck du 14/11/2026 ; à changer ici, et nulle part ailleurs, s'il veut une autre durée)
const PRG_JOURS_APRES_TERMINE = 30;
// Le relevé releve-pc.json est refait par la recopie automatique du PC (toutes les heures), donc au moins une fois par jour :
const PRG_RELEVE_PROPOSITION_JOURS = 7;     // âge maximal du relevé pour PROPOSER la purge d'un chantier terminé
const PRG_RELEVE_PURGE_HEURES = 48;         // … et au moment où la case est traitée
const PRG_FICHIER_A_VOIR = 'CHANTIERPRO - A VOIR.txt';   // sur le PC : le fichier où la recopie automatique dit ce qui ne va pas
const PRG_ANNULATION_JOURS = 25;            // la case « Annuler » sert 25 jours
const PRG_CORBEILLE_JOURS = 30;             // Drive vide sa corbeille au bout de 30 jours : la place est libérée à ce moment-là
const PRG_PAQUET = 10;                      // fichiers (ou dossiers du carnet) journalisés puis mis à la corbeille par paquet
const PRG_MAX_MINUTES_JOUR = 30;            // temps passé à purger, par jour, toutes exécutions confondues (quota de 90 min de déclencheurs)
const PRG_DEPOT_RECENT_H = 24;              // un dossier du carnet modifié depuis moins de 24 h n'est pas touché (dépôt en cours ?)
const PRG_VERROU_MS = 7 * 60 * 1000;
const PRG_JOUR_MS = 24 * 3600 * 1000;
const PRG_QUOI = { indices: 'Anciens indices du carnet', termine: 'Chantier terminé', mails: 'Mails envoyés de plus de 3 mois' };
const PRG_COURT = { indices: 'anciens indices', termine: 'chantier terminé', mails: 'mails envoyés' };
const PRG_ETAT = { propose: 'Proposé', impossible: 'Impossible', enCours: 'En cours', fait: 'Fait', mail: 'Fait (mail à envoyer)',
  annulation: 'Annulation en cours', annule: 'Annulé' };
const PRG_ENTETES = ['Chantier', 'Quoi', 'Poids (Mo)', 'Fichiers', 'Possible ?', 'Pourquoi (ou ce qui manque)', 'Mettre à la corbeille', 'État', 'Message',
  'Mis à la corbeille le', 'Fichiers mis à la corbeille', 'Place libérée le', 'Annuler', 'Annulation possible jusqu’au', 'Mise à jour le', 'Clé (ne pas modifier)'];
const COL_P = { chantier: 1, quoi: 2, poids: 3, fichiers: 4, possible: 5, pourquoi: 6, corbeille: 7, etat: 8, message: 9, faitLe: 10, nbFaits: 11,
  libere: 12, annuler: 13, jusquau: 14, maj: 15, cle: 16 };
const PRG_COLONNES_TEXTE = [COL_P.chantier, COL_P.quoi, COL_P.possible, COL_P.pourquoi, COL_P.etat, COL_P.message, COL_P.cle];
const PRG_COLONNES_DATE = [COL_P.faitLe, COL_P.libere, COL_P.jusquau, COL_P.maj];
const PRG_DETAIL_ENTETES = ['Clé de la ligne', 'Type', 'Identifiant', 'Chemin', 'Taille (octets)', 'Fichiers', 'Noté le', 'État', 'Mis à jour le'];
const COL_D = { cle: 1, type: 2, id: 3, chemin: 4, taille: 5, fichiers: 6, note: 7, etat: 8, maj: 9 };
const PRG_RECOPIE = 'vérifie que la recopie automatique tourne sur le PC (fichier « ' + PRG_FICHIER_A_VOIR + ' »)';
const PRG_AVANT_DE_COCHER = 'Avant de cocher : vérifie sur le PC que MEGA a fini de synchroniser le dossier du chantier. Le relevé devra avoir moins de '
  + PRG_RELEVE_PURGE_HEURES + ' heures au moment du traitement. Après la mise à la corbeille, la place n’est rendue que ' + PRG_CORBEILLE_JOURS + ' jours plus tard.';

// ── Onglets (titres contrôlés avant toute lecture et toute écriture) ──
function prgFeuille_(nom, entetes, colonnesTexte, colonnesDate, avertir) {
  const existait = !!SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nom);
  const sh = noteFeuille_(nom, entetes, colonnesTexte);
  if (!existait) {
    const lignes = Math.max(1, sh.getMaxRows() - 1);
    colonnesDate.forEach(c => sh.getRange(2, c, lignes, 1).setNumberFormat('dd/MM/yyyy HH:mm'));
    avertir.forEach(x => stkAvertir_(sh.getRange(1, x[0], sh.getMaxRows(), x[1]), 'Colonnes remplies par Loué App : ne pas les modifier (seules les cases se cochent ; le tri est permis).'));
  }
  if (!noteTitresBons_(sh, entetes)) throw stkOngletModifie_(nom);
  return sh;
}
function feuillePurges_() {
  // avertissement sur tout sauf les deux colonnes de cases
  return prgFeuille_(SHEET_PURGES, PRG_ENTETES, PRG_COLONNES_TEXTE, PRG_COLONNES_DATE,
    [[1, COL_P.corbeille - 1], [COL_P.etat, COL_P.annuler - COL_P.etat], [COL_P.jusquau, COL_P.cle - COL_P.jusquau + 1]]);
}
function feuillePurgesDetail_() {
  return prgFeuille_(SHEET_PURGES_DETAIL, PRG_DETAIL_ENTETES, [COL_D.cle, COL_D.type, COL_D.id, COL_D.chemin, COL_D.etat], [COL_D.note, COL_D.maj],
    [[1, PRG_DETAIL_ENTETES.length]]);
}
// Toutes les lignes de l'onglet Purges : [{ ligne, r }] (lignes sans clé ignorées)
function prgLignes_(sh) {
  const derniere = sh.getLastRow();
  if (derniere < 2) return [];
  return sh.getRange(2, 1, derniere - 1, PRG_ENTETES.length).getValues().map((r, i) => ({ ligne: i + 2, r: r })).filter(x => String(x.r[COL_P.cle - 1] || ''));
}
// Ligne d'une clé (0 si absente). Relu avant chaque écriture : Franck peut avoir trié l'onglet entre-temps.
function prgLigne_(sh, cle) {
  const derniere = sh.getLastRow();
  if (derniere < 2) return 0;
  const cles = sh.getRange(2, COL_P.cle, derniere - 1, 1).getValues();
  for (let i = 0; i < cles.length; i++) if (String(cles[i][0]) === cle) return i + 2;
  return 0;
}
// Écrit des cellules de la ligne d'une clé : { numéroDeColonne: valeur }. Rien d'autre n'est touché sur la ligne.
// siLibre : ne rien écrire si la ligne est entre-temps passée « En cours », « Annulation en cours » ou « Fait » (la mesure
// de la nuit et le traitement des cases peuvent se croiser).
function prgEcrire_(sh, cle, cellules, siLibre) {
  const ligne = prgLigne_(sh, cle);
  if (!ligne) return false;
  if (siLibre) { const e = sh.getRange(ligne, COL_P.etat).getValue(); if (prgEstFait_(e) || prgEstOccupe_(e)) return false; }
  cellules[COL_P.maj] = new Date(maintenant_());
  Object.keys(cellules).forEach(c => sh.getRange(ligne, Number(c)).setValue(cellule_(cellules[c])));
  return true;
}
// Clé d'une ligne : nature | chantier | identifiant du dossier | numéro (1, puis 2 quand une purge faite est suivie d'une autre)
function prgCleBase_(nature, c, idDossier) { return nature + '|' + c.cle + '|' + idDossier; }
function prgLireCle_(cle) {
  const m = String(cle).split('|');
  if (m.length < 4 || !PRG_QUOI[m[0]] || !/^\d+$/.test(m[m.length - 1])) return null;
  return { nature: m[0], chantier: m.slice(1, m.length - 2).join('|'), dossier: m[m.length - 2], n: Number(m[m.length - 1]) };
}
function prgEstFait_(etat) { return /^fait/i.test(String(etat)); }
function prgEstOccupe_(etat) { return /^(en cours|annulation en cours)/i.test(String(etat)); }

// ── Ce que le serveur sait, lu une fois par exécution ──
function prgEnvironnement_() {
  const ou = environnementReel_();
  if (ou.env === 'INCOHERENT') return 'environnement incohérent (la propriété ENVIRONNEMENT et le nom du Sheet ne disent pas la même chose) : aucune purge';
  let nom;
  try { nom = DriveApp.getFolderById(driveRootId_()).getName(); } catch (e) { return 'dossier racine du Drive introuvable : aucune purge'; }
  // La copie TEST et la production sont dans le même compte : la racine doit être celle de CET environnement
  if (ou.env === 'TEST' && !/TEST/i.test(nom)) return 'ce serveur est la copie TEST, mais son dossier racine ne s’appelle pas « … TEST … » : aucune purge';
  if (ou.env === 'PRODUCTION' && /TEST/i.test(nom)) return 'ce serveur est la production, mais son dossier racine s’appelle « … TEST … » : aucune purge';
  return '';
}
function prgContexte_(chantiers, cats) {
  let planning = '';
  try { planning = drivePlanningId_(); } catch (e) {}
  const lignesDossiers = stkLignesDossiers_(), idsDossiers = {};
  lignesDossiers.forEach(l => { if (l.id && !idsDossiers[l.id]) idsDossiers[l.id] = l.chantier; });   // identifiant de dossier → chantier
  return { racineId: driveRootId_(), planningId: planning, chantiers: chantiers || stkChantiers_(), lignesDossiers: lignesDossiers, idsDossiers: idsDossiers,
    cats: cats || stkCategories_(), carnetChemin: stkConf_().documents.carnet, env: prgEnvironnement_(), sousRacine: {} };
}

// Vrai si TOUS les dossiers qui contiennent l'élément mènent au dossier « cible » (jamais vrai pour la cible elle-même)
function prgDescendDe_(el, cibleId, cache) {
  const monter = (x, niveau) => {
    if (niveau > 25) return false;
    const it = x.getParents();
    let n = 0, bon = true;
    while (it.hasNext()) {
      const p = it.next(), id = p.getId();
      n++;
      if (id === cibleId) continue;
      if (cache[id] === undefined) { cache[id] = false; cache[id] = monter(p, niveau + 1); }
      if (!cache[id]) bon = false;
    }
    return n > 0 && bon;
  };
  return el.getId() !== cibleId && monter(el, 0);
}

// §4.1 — Le dossier du chantier : une ligne explicite de « Dossiers chantiers », sans « À vérifier », dont l'identifiant
// n'est porté par aucun autre chantier ; jamais par ressemblance de nom ; et bien dans le Drive de cet environnement.
function prgDossierSur_(c, ctx) {
  const non = raison => ({ ok: false, raison: raison });
  if (ctx.env) return non(ctx.env);
  if (!c || !c.lignes) return non('chantier absent de l’onglet Chantiers');
  if (c.lignes > 1) return non('deux lignes portent ce nom dans l’onglet Chantiers : corrige-le');
  const lignes = ctx.lignesDossiers.filter(l => l.cle === c.cle && l.id);
  if (!lignes.length) return non('le dossier de ce chantier n’est pas noté dans l’onglet « ' + SHEET_DOSSIERS + ' » (il n’est jamais pris par ressemblance de nom) : ajoute-y une ligne avec son identifiant');
  const ids = lignes.map(l => l.id).filter((x, i, t) => t.indexOf(x) === i);
  if (ids.length > 1) return non('plusieurs dossiers sont notés pour ce chantier dans « ' + SHEET_DOSSIERS + ' » : n’en garde qu’un');
  if (lignes.some(l => l.aVerifier)) return non('la ligne de ce chantier dans « ' + SHEET_DOSSIERS + ' » porte la mention « À vérifier » : vérifie que c’est le bon dossier, puis efface cette mention');
  const autres = ctx.lignesDossiers.filter(l => l.id === ids[0] && l.cle !== c.cle);
  if (autres.length) return non('le même dossier est noté pour un autre chantier (« ' + autres[0].chantier + ' ») dans « ' + SHEET_DOSSIERS + ' »');
  let d;
  try { d = DriveApp.getFolderById(ids[0]); } catch (e) { return non('le dossier noté dans « ' + SHEET_DOSSIERS + ' » est introuvable dans Drive'); }
  if (d.isTrashed()) return non('le dossier du chantier est à la corbeille');
  if (ids[0] === ctx.racineId || ids[0] === ctx.planningId || estDossierTechnique_(d)) return non('le dossier noté dans « ' + SHEET_DOSSIERS + ' » n’est pas un dossier de chantier');
  if (!prgDescendDe_(d, ctx.racineId, ctx.sousRacine)) return non('le dossier du chantier n’est pas dans le Drive de cet environnement');
  const dessus = prgChantierAuDessus_(d, ctx);
  if (dessus) return non('le dossier de ce chantier est rangé dans le dossier d’un autre chantier (« ' + dessus + ' ») : sors-le de là');
  return { ok: true, dossier: d, id: ids[0] };
}
// Le dossier est-il rangé, à n'importe quelle profondeur, dans le dossier d'un autre chantier ? Rend le nom de ce chantier, ou ''.
function prgChantierAuDessus_(dossier, ctx) {
  let niveau = [dossier];
  for (let n = 0; n < 25 && niveau.length; n++) {
    const suivants = [];
    for (let i = 0; i < niveau.length; i++) {
      const it = niveau[i].getParents();
      while (it.hasNext()) {
        const p = it.next(), id = p.getId();
        if (id === ctx.racineId) continue;
        if (ctx.idsDossiers[id]) return ctx.idsDossiers[id];
        suivants.push(p);
      }
    }
    niveau = suivants;
  }
  return '';
}

// §4.3-1 — « Terminé » depuis au moins PRG_JOURS_APRES_TERMINE jours : '' si c'est le cas, sinon ce qui manque
function prgTermineDepuis_(c) {
  if (!c || c.statut !== STATUTS_CHANTIER[2]) return 'le chantier n’est pas au statut « Terminé »';
  if (c.termine === null) return 'pas de date « Terminé » dans l’onglet Chantiers (elle se pose toute seule à la prochaine mesure, puis il faut attendre ' + PRG_JOURS_APRES_TERMINE + ' jours)';
  if (isNaN(c.termine)) return 'date « Terminé » illisible dans l’onglet Chantiers : écris-la sous la forme 31/12/2026';
  const maintenant = maintenant_();
  if (c.termine > maintenant) return 'date « Terminé » dans le futur (' + stkJour_(c.termine) + ') : elle est ignorée, corrige-la';
  const possible = c.termine + PRG_JOURS_APRES_TERMINE * PRG_JOUR_MS;
  if (possible > maintenant) return 'terminé depuis le ' + stkJour_(c.termine) + ' : purge possible à partir du ' + stkJour_(possible) + ' (' + PRG_JOURS_APRES_TERMINE + ' jours après la clôture)';
  return '';
}

// §4.3-2 — Le relevé releve-pc.json : ce qui est dans le dossier du chantier sur le PC (format : docs/contrat-skills.md) à la racine du dossier du chantier.
// ageMaxMs : âge maximal du relevé, en millisecondes. Rend { ok, raison, lignes: { '/chemin': [tailles] }, date }.
function prgReleve_(dossier, c, ageMaxMs) {
  const non = raison => ({ ok: false, raison: raison });
  const relancer = ' : ' + PRG_RECOPIE + ', puis attends la prochaine mesure';
  const it = dossier.getFilesByName(PRG_RELEVE), trouves = [];
  while (it.hasNext()) { const f = it.next(); if (!f.isTrashed()) trouves.push(f); }
  if (!trouves.length) return non('pas de relevé « ' + PRG_RELEVE + ' » dans le dossier du chantier' + relancer);
  if (trouves.length > 1) return non('deux relevés « ' + PRG_RELEVE + ' » dans le dossier du chantier : supprime le plus ancien' + relancer);
  let lu;
  try { lu = JSON.parse(trouves[0].getBlob().getDataAsString('UTF-8')); } catch (e) { return non('relevé « ' + PRG_RELEVE + ' » illisible' + relancer); }
  if (!lu || typeof lu !== 'object' || Number(lu.version) !== 1 || !Array.isArray(lu.fichiers)) return non('relevé « ' + PRG_RELEVE + ' » d’un format inconnu' + relancer);
  if (typeof lu.chantier !== 'string' || cleChantier_(stkNfc_(lu.chantier)) !== cleChantier_(stkNfc_(c.nom))) {
    return non('le relevé « ' + PRG_RELEVE + ' » est celui d’un autre chantier (« ' + String(lu.chantier).slice(0, 80) + ' ») : rien n’est proposé');
  }
  const date = typeof lu.releve_le === 'string' ? Date.parse(lu.releve_le) : NaN;
  if (isNaN(date)) return non('date du relevé illisible' + relancer);
  const maintenant = maintenant_();
  if (date > maintenant + 3600 * 1000) return non('relevé daté du futur (' + stkJour_(date) + ') : vérifie l’horloge du PC' + relancer);
  const limite = ageMaxMs >= 3 * PRG_JOUR_MS ? Math.round(ageMaxMs / PRG_JOUR_MS) + ' jours' : Math.round(ageMaxMs / 3600000) + ' heures';
  if (maintenant - date > ageMaxMs) return non('relevé du ' + texteDate_(date) + ' : il a plus de ' + limite + relancer);
  const lignes = {};
  for (let i = 0; i < lu.fichiers.length; i++) {
    const f = lu.fichiers[i];
    if (!f || typeof f.chemin !== 'string' || typeof f.taille !== 'number' || !(f.taille >= 0)) return non('relevé « ' + PRG_RELEVE + ' » mal rempli (ligne ' + (i + 1) + ')' + relancer);
    const cle = '/' + stkNfc_(f.chemin);   // accents comparés sans tenir compte de leur codage
    (lignes[cle] = lignes[cle] || []).push(f.taille);
  }
  return { ok: true, raison: '', lignes: lignes, date: date };
}
// §4.3-3 — Chaque fiche du Drive correspond à UNE ligne distincte du relevé : même chemin, même taille.
function prgComparer_(liste, releve) {
  const reste = {}, vus = {}, r = { absents: [], tailles: [], doublons: [] };
  Object.keys(releve.lignes).forEach(k => { reste[k] = releve.lignes[k].slice(); });
  liste.forEach(f => {
    const cle = '/' + f.chemin;
    if (vus[cle]) { if (r.doublons.indexOf(f.chemin) < 0) r.doublons.push(f.chemin); }
    vus[cle] = true;
    const t = reste[cle];
    if (!t) { r.absents.push(f.chemin); return; }
    const i = t.indexOf(f.taille);
    if (i < 0) { r.tailles.push(f.chemin); return; }
    t.splice(i, 1);   // une ligne du relevé ne sert qu'une fois
  });
  return r;
}
// §4.3-4 — Envois en attente ou abandonnés pour ce chantier (onglet « Mails en attente », lu seulement)
function prgEnvoisEnAttente_(c) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ATTENTE);
  if (!sh || sh.getLastRow() < 2) return 0;
  return sh.getRange(2, 1, sh.getLastRow() - 1, 11).getValues()
    .filter(r => cleChantier_(r[2]) === c.cle && (r[10] === 'en attente' || r[10] === 'abandonné')).length;
}

// §4.2 — Le carnet d'un chantier, vu PAR DOSSIER de document, avec la même lecture que celle des téléphones.
// Rend { existe, erreur, dossier, id, maj, json, manquants: [documents montrés sans dossier], anciens: [dossiers que plus aucun document montré ne désigne],
//        tous: [dossiers connus de carnet.json], laisses: [textes] }.
// Un dossier inconnu de carnet.json (dépôt en cours, posé à la main), mal décrit, ou en double : jamais rendu.
function prgCarnet_(dossierChantier, c, ctx) {
  const r = { existe: false, erreur: '', dossier: null, id: '', maj: 0, json: null, anciens: [], tous: [], laisses: [], manquants: [] };
  const carnets = sousDossiersParChemin_(dossierChantier, ctx.carnetChemin);
  if (!carnets.length) return r;
  r.existe = true;
  if (carnets.length > 1) { r.erreur = 'deux dossiers « ' + ctx.carnetChemin + ' » dans ce chantier : le carnet n’est pas touché'; return r; }
  r.dossier = carnets[0]; r.id = r.dossier.getId();
  cacheScript_().remove('carnet:liste:1:' + r.id + ':n');   // jamais la liste gardée 10 minutes : relue dans Drive
  let lu, montres;
  try { lu = carnetListe_(r.dossier); montres = carnetDocuments_(lu.liste, c.nom, dossierChantier.getName()); }
  catch (e) { if (!e || !e.carnet) throw e; r.erreur = 'carnet : ' + e.message; return r; }
  if (lu.doublon) { r.erreur = 'deux listes « ' + CARNET_FICHIER + ' » dans le carnet : supprime la plus ancienne'; return r; }
  r.maj = lu.maj;
  const fichiers = r.dossier.getFilesByName(CARNET_FICHIER);
  while (fichiers.hasNext()) { const f = fichiers.next(); if (!f.isTrashed()) r.json = f; }
  const large = s => stkNfc_(s).trim().toLowerCase();
  const montresParNom = {}, connus = {}, douteux = {};
  montres.forEach(d => { montresParNom['/' + large(d.dossier)] = true; });
  lu.liste.documents.forEach(d => {
    if (!d || typeof d.dossier !== 'string') return;
    const bon = typeof d.id === 'string' && CARNET_NOM_SUR.test(d.id) && Array.isArray(d.pages) && !/[\/\\]/.test(d.dossier) && !!d.dossier.trim();
    if (bon) connus['/' + stkNfc_(d.dossier)] = true; else douteux['/' + large(d.dossier)] = true;
  });
  const sous = [], compte = {};
  const it = r.dossier.getFolders();
  while (it.hasNext()) {
    const d = it.next();
    if (d.isTrashed()) continue;
    const nom = stkNfc_(d.getName());
    sous.push({ id: d.getId(), nom: nom, api: d });
    compte['/' + large(nom)] = (compte['/' + large(nom)] || 0) + 1;
  }
  sous.forEach(x => {
    const cle = '/' + large(x.nom);
    if (compte[cle] > 1) r.laisses.push('« ' + x.nom + ' » (deux dossiers de ce nom)');
    else if (douteux[cle]) r.laisses.push('« ' + x.nom + ' » (mal décrit dans la liste du carnet)');
    else if (!connus['/' + x.nom]) r.laisses.push('« ' + x.nom + ' » (inconnu de la liste du carnet : dépôt en cours ?)');
    else if (prgRecent_(x.api)) r.laisses.push('« ' + x.nom + ' » (modifié depuis moins de ' + PRG_DEPOT_RECENT_H + ' heures : dépôt en cours ?)');
    else { r.tous.push(x); if (!montresParNom[cle]) r.anciens.push(x); }
  });
  // Les documents MONTRÉS dans l'appli dont le dossier d'images manque ou est à la corbeille
  montres.forEach(d => { if (!compte['/' + large(d.dossier)]) r.manquants.push({ id: String(d.id), dossier: stkNfc_(d.dossier) }); });
  return r;
}
function prgElementsCarnet_(dossiers, ctx, depasse, r) {
  const aucun = { carnet: '', photos: '', fiches: [] };
  dossiers.forEach(x => {
    const p = stkInventaire_(x.api, aucun, depasse, false, ctx.idsDossiers);
    if (!p.complet && r.raisons.indexOf(PRG_TROP_GROS) < 0) r.raisons.push(PRG_TROP_GROS);
    if (p.etrangers.length) r.raisons.push(prgEtrangers_(p.etrangers));
    r.items.push({ type: 'dossier', id: x.id, chemin: ctx.cats.carnet + '/' + x.nom, taille: p.total, fichiers: p.fichiers });
    r.octets += p.total; r.nb += p.fichiers;
  });
}
const PRG_TROP_GROS = 'dossier trop gros pour être lu en un passage : rien n’est proposé';
function prgLaisses_(car) {
  return car.laisses.length ? car.laisses.length + ' dossier(s) du carnet laissé(s) en place : ' + stkCourt_(car.laisses) : '';
}

// Un dossier de document du carnet touché depuis moins de 24 heures (lui-même ou l'un de ses fichiers) : un dépôt est
// peut-être en cours de synchronisation, il n'est ni proposé ni mis à la corbeille
function prgRecent_(dossier) {
  const limite = maintenant_() - PRG_DEPOT_RECENT_H * 3600 * 1000;
  try {
    if (dossier.getLastUpdated().getTime() > limite) return true;
    const it = dossier.getFiles();
    while (it.hasNext()) { const f = it.next(); if (!f.isTrashed() && f.getLastUpdated().getTime() > limite) return true; }
  } catch (e) { return true; }   // date illisible : dans le doute, on n'y touche pas
  return false;
}

// Garde appelée juste avant CHAQUE mise à la corbeille : '' si elle est permise, sinon la raison du refus
function prgGarde_(dossierChantier, ctx, carnet) {
  const cache = {}, idChantier = dossierChantier.getId(), idCarnet = carnet ? carnet.getId() : '';
  let sousRacine = null;   // la remontée « dossier du chantier → racine » n'est faite qu'une fois par exécution
  return (api, item) => {
    const id = api.getId();
    if (id === idChantier || id === ctx.racineId || id === ctx.planningId || id === idCarnet) return 'dossier protégé';
    if (api.getName() === PRG_RELEVE) return 'le relevé n’est jamais mis à la corbeille';
    if (api.isTrashed()) return 'déjà à la corbeille';
    if (item.type === 'fichier' && Number(api.getSize()) !== item.taille) return 'taille changée depuis la comparaison';
    if (item.type === 'dossier' || item.liste) {
      // un dossier de document, et la liste du carnet, sont directement dans le dossier du carnet
      const it = api.getParents();
      let n = 0, bon = true;
      while (it.hasNext()) { n++; if (it.next().getId() !== idCarnet) bon = false; }
      if (!idCarnet || !n || !bon) return 'hors du dossier du carnet';
    }
    if (item.type === 'dossier' && prgRecent_(api)) return 'modifié depuis moins de ' + PRG_DEPOT_RECENT_H + ' heures (dépôt en cours ?)';
    if (item.liste) {
      // carnet.json en dernier, et seulement s'il ne reste plus aucun dossier dans le carnet
      const it = carnet.getFolders();
      while (it.hasNext()) if (!it.next().isTrashed()) return 'des dossiers du carnet sont restés en place : la liste est gardée';
    }
    if (!prgDescendDe_(api, idChantier, cache)) return 'hors du dossier du chantier';
    // « descend de la racine de cet environnement » (la copie TEST et la production sont dans le même compte)
    if (sousRacine === null) sousRacine = !ctx.env && prgDescendDe_(dossierChantier, ctx.racineId, ctx.sousRacine);
    if (!sousRacine) return 'hors du Drive de cet environnement';
    return '';
  };
}
function prgEtrangers_(etrangers) {
  return 'le dossier d’un autre chantier (« ' + etrangers[0].nom + ' ») est rangé dans ce dossier (« ' + etrangers[0].chemin + ' ») : sors-le de là ; rien n’est proposé tant qu’il y est';
}

// ── Les deux examens. Chacun rend { possible, raisons, infos, items, octets, nb, dossierId, garde, carnet } ──
// items : ce qui serait mis à la corbeille, dans l'ordre. LECTURE SEULE.
function prgExaminerIndices_(c, ctx, depasse, dossierMesure) {
  const r = { possible: false, raisons: [], infos: [], items: [], octets: 0, nb: 0, dossierId: '', garde: null, carnet: null };
  const ident = prgDossierSur_(c, ctx);
  if (!ident.ok) r.raisons.push(ident.raison); else r.dossierId = ident.id;
  const dossier = ident.ok ? ident.dossier : dossierMesure;
  if (!dossier) return r;
  const car = r.carnet = prgCarnet_(dossier, c, ctx);
  if (car.erreur) { r.raisons.push(car.erreur); return r; }
  prgElementsCarnet_(car.anciens, ctx, depasse, r);
  if (prgLaisses_(car)) r.infos.push(prgLaisses_(car));
  if (!r.items.length && !r.raisons.length) r.raisons.push('aucun ancien indice à mettre à la corbeille');
  if (ident.ok) r.garde = prgGarde_(ident.dossier, ctx, car.dossier);
  r.possible = ident.ok && !r.raisons.length && r.items.length > 0;
  return r;
}
function prgExaminerTermine_(c, ctx, ageReleveMs, depasse, inv, dossierMesure) {
  const r = { possible: false, raisons: [], infos: [], items: [], octets: 0, nb: 0, dossierId: '', garde: null, carnet: null };
  const quand = prgTermineDepuis_(c);
  if (quand) r.raisons.push(quand);
  const ident = prgDossierSur_(c, ctx);
  if (!ident.ok) { r.raisons.push(ident.raison); return r; }   // sans dossier sûr, rien d'autre n'est lu
  r.dossierId = ident.id;
  const attente = prgEnvoisEnAttente_(c);
  if (attente) r.raisons.push(attente + ' envoi(s) en attente ou abandonné(s) pour ce chantier (onglet « ' + SHEET_ATTENTE + ' ») : attends qu’ils partent, ou règle-les');
  const releve = prgReleve_(ident.dossier, c, ageReleveMs);
  if (!releve.ok) r.raisons.push(releve.raison);
  if (!inv || !dossierMesure || dossierMesure.getId() !== ident.id) inv = stkInventaire_(ident.dossier, ctx.cats, depasse, true, ctx.idsDossiers);
  if (!inv.complet) r.raisons.push(PRG_TROP_GROS);
  // Le dossier d'un AUTRE chantier rangé quelque part dans celui-ci : ses fiches ne sont jamais lues comme celles de ce
  // chantier (le parcours n'y descend pas), et la purge est bloquée tant qu'il y est
  if (inv.etrangers && inv.etrangers.length) r.raisons.push(prgEtrangers_(inv.etrangers));
  if (releve.ok) {
    const cmp = prgComparer_(inv.liste, releve), exemples = t => stkCourt_(t.slice(0, 3).map(x => '« ' + x + ' »')) + (t.length > 3 ? '…' : '');
    if (cmp.doublons.length) r.raisons.push('deux fichiers de même nom dans un dossier du Drive (' + exemples(cmp.doublons) + ') : renomme-en un, puis attends la prochaine recopie du PC et la prochaine mesure');
    if (cmp.absents.length) r.raisons.push(cmp.absents.length + ' fiche(s) ou photo(s) absente(s) du relevé (' + exemples(cmp.absents) + ') : ' + PRG_RECOPIE + ', puis attends la prochaine mesure');
    if (cmp.tailles.length) r.raisons.push(cmp.tailles.length + ' fichier(s) dont la taille n’est pas celle du relevé (' + exemples(cmp.tailles) + ') : ' + PRG_RECOPIE + ', puis attends la prochaine mesure');
  }
  // Fiches et photos : fichier par fichier, seulement ceux qui viennent d'être comparés. Les dossiers restent en place.
  inv.liste.forEach(f => { r.items.push({ type: 'fichier', id: f.id, chemin: f.chemin, taille: f.taille, fichiers: 1 }); r.octets += f.taille; r.nb++; });
  // Le carnet : le dossier de chaque document, puis carnet.json en dernier
  const car = r.carnet = prgCarnet_(ident.dossier, c, ctx);
  if (car.erreur) r.raisons.push(car.erreur);
  else if (car.existe) {
    prgElementsCarnet_(car.tous, ctx, depasse, r);
    if (prgLaisses_(car)) r.infos.push(prgLaisses_(car) + ' ; la liste « ' + CARNET_FICHIER + ' » est gardée');
    else if (car.json) {
      const t = Number(car.json.getSize()) || 0;
      r.items.push({ type: 'fichier', id: car.json.getId(), chemin: ctx.cats.carnet + '/' + CARNET_FICHIER, taille: t, fichiers: 1, liste: true });
      r.octets += t; r.nb++;
    }
  }
  if (inv.nb.autres) r.infos.push(inv.nb.autres + ' fichier(s) hors des dossiers de l’appli (relevé compris) : laissé(s) en place');
  if (!r.items.length && !r.raisons.length) r.raisons.push('rien à mettre à la corbeille : ni fiche, ni photo, ni carnet dans ce dossier');
  r.garde = prgGarde_(ident.dossier, ctx, car.dossier);
  r.possible = !r.raisons.length && r.items.length > 0;
  return r;
}
function prgExaminer_(nature, c, ctx, ageReleveMs, depasse, inv, dossierMesure) {
  return nature === 'termine' ? prgExaminerTermine_(c, ctx, ageReleveMs, depasse, inv, dossierMesure) : prgExaminerIndices_(c, ctx, depasse, dossierMesure);
}
function prgPourquoi_(nature, exam) {
  const phrase = t => t.charAt(0).toUpperCase() + t.slice(1);
  if (exam.possible && exam.pourquoi) return exam.pourquoi;
  if (exam.possible) {
    return ['Possible : ' + exam.nb + ' fichier(s) partiraient à la corbeille.'].concat(exam.infos.map(x => phrase(x) + '.'))
      .concat(nature === 'termine' ? [PRG_AVANT_DE_COCHER] : ['Ces indices ne sont plus montrés dans l’appli ; les PDF d’origine sont dans le dossier du chantier sur le PC.']).join(' ');
  }
  return exam.raisons.concat(exam.infos).map(x => phrase(x) + '.').join(' ');
}

// ── Propositions : appelée par la mesure de la nuit pour chaque dossier porté par UN chantier ──
// Rend ce que l'onglet « Stockage » affiche : { indices, indicesMo, depot, texte }.
function prgProposerChantier_(u, inv, ctx, depasse) {
  const sh = feuillePurges_();
  const c = ctx.chantiers[u.cles[0]] || { nom: u.noms[0], cle: u.cles[0], statut: '', termine: null, lignes: 0 };
  const rendu = { indices: '', indicesMo: '', depot: '', texte: '' }, textes = [];
  const exI = prgExaminerIndices_(c, ctx, depasse, u.dossier);
  const carnetLu = exI.carnet && exI.carnet.existe && !exI.carnet.erreur;
  if (carnetLu) {
    rendu.depot = exI.carnet.maj ? new Date(exI.carnet.maj) : '';
    rendu.indices = exI.items.length; rendu.indicesMo = stkMo_(exI.octets);
  }
  textes.push(prgProposer_(sh, 'indices', c, u.id, exI, exI.items.length > 0));
  // Un document MONTRÉ dans l'appli dont le dossier d'images manque ou est à la corbeille (un ancien indice purgé redevient
  // le document montré quand le nouvel indice est retiré) : dit dans Stockage, et sur la ou les lignes « Fait » qui ont mis
  // ce dossier à la corbeille (retrouvées par le journal) — jamais sur une ligne « Proposé », où « Annuler » ne ferait rien
  if (carnetLu && exI.carnet.manquants.length) {
    const ids = stkCourt_(exI.carnet.manquants.map(x => x.id)), chemins = {}, cles = {};
    exI.carnet.manquants.forEach(x => { chemins['/' + ctx.cats.carnet + '/' + x.dossier] = true; });
    const shD = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PURGES_DETAIL);
    if (shD) prgDetail_(shD).forEach(x => { if (String(x.r[COL_D.etat - 1]) === 'fait' && chemins['/' + x.r[COL_D.chemin - 1]]) cles['/' + x.r[COL_D.cle - 1]] = true; });
    const faites = prgLignes_(sh).filter(x => cles['/' + x.r[COL_P.cle - 1]] && prgEstFait_(x.r[COL_P.etat - 1]));
    const lesquelles = faites.map(x => '« ' + x.r[COL_P.quoi - 1] + ' »' + (stkEstDate_(x.r[COL_P.faitLe - 1]) ? ' mise à la corbeille le ' + stkJour_(x.r[COL_P.faitLe - 1].getTime()) : ''));
    textes.unshift('⚠ ' + exI.carnet.manquants.length + ' document(s) du carnet montré(s) dans l’appli sans leurs images (' + ids + ') : '
      + (faites.length ? 'coche « Annuler » sur la ligne ' + lesquelles.join(', ou ') + ' de ce chantier (onglet « ' + SHEET_PURGES + ' »), ou redépose le document'
        : 'redépose le document (aucune purge annulable ne contient ses images)'));
    const alerte = '⚠ Cette purge a emporté les images d’un document que l’appli montre de nouveau (' + ids + ') : coche « Annuler » sur CETTE ligne, ou redépose le document.';
    faites.forEach(x => {
      const message = String(x.r[COL_P.message - 1] || '');
      if (message.indexOf(alerte) > -1) return;
      const m = {};
      m[COL_P.message] = alerte + ' ' + message;
      prgEcrire_(sh, String(x.r[COL_P.cle - 1]), m);
    });
  }
  const termine = c.statut === STATUTS_CHANTIER[2];
  const active = prgActive_(prgLignes_(sh), prgCleBase_('termine', c, u.id));
  if (termine || (active && !prgEstFait_(active.r[COL_P.etat - 1]))) {
    textes.push(prgProposer_(sh, 'termine', c, u.id, prgExaminerTermine_(c, ctx, PRG_RELEVE_PROPOSITION_JOURS * PRG_JOUR_MS, depasse, inv, u.dossier), termine));
  }
  rendu.texte = textes.filter(Boolean).join(' ; ');
  return rendu;
}
// La ligne en service d'une base de clé : celle du plus grand numéro
function prgActive_(lignes, base) {
  let active = null;
  lignes.forEach(x => {
    const cle = String(x.r[COL_P.cle - 1]);
    if (cle.indexOf(base + '|') !== 0) return;
    const n = Number(cle.slice(base.length + 1));
    if (n > 0 && (!active || n > active.n)) active = { ligne: x.ligne, r: x.r, n: n, cle: cle };
  });
  return active;
}
// Plus grand numéro déjà utilisé pour cette base dans le journal « Purges détail » (une ligne « Fait » supprimée de l'onglet
// Purges ne doit jamais faire réutiliser sa clé : le journal de l'ancienne purge se mélangerait à la nouvelle)
function prgNumeroJournal_(base) {
  const shD = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PURGES_DETAIL);
  let max = 0;
  if (!shD || shD.getLastRow() < 2) return max;
  shD.getRange(2, COL_D.cle, shD.getLastRow() - 1, 1).getValues().forEach(v => {
    const cle = String(v[0]);
    if (cle.indexOf(base + '|') !== 0) return;
    const n = Number(cle.slice(base.length + 1));
    if (n > max) max = n;
  });
  return max;
}
// Écrit la proposition : une nouvelle ligne si la base n'en a pas (ou si la précédente est « Fait » et qu'il y a de nouveau
// quelque chose), sinon ses cellules de proposition sont mises à jour. Les cases, les dates d'une purge faite, les lignes
// en cours : jamais touchées. creer : faut-il une ligne s'il n'y en a pas ?
function prgProposer_(sh, nature, c, idDossier, exam, creer) {
  const base = prgCleBase_(nature, c, idDossier), active = prgActive_(prgLignes_(sh), base);
  const etat = active ? String(active.r[COL_P.etat - 1]) : '', court = PRG_COURT[nature];
  if (active && prgEstOccupe_(etat)) return court + ' : purge en cours';
  const fait = active && prgEstFait_(etat);
  const quand = fait && stkEstDate_(active.r[COL_P.faitLe - 1]) ? ' le ' + stkJour_(active.r[COL_P.faitLe - 1].getTime()) : '';
  if (fait && !exam.items.length) return court + ' : mis à la corbeille' + quand;
  if (!active && !creer) return '';
  const cellules = {};
  cellules[COL_P.chantier] = c.nom; cellules[COL_P.quoi] = PRG_QUOI[nature];
  cellules[COL_P.poids] = stkMo_(exam.octets); cellules[COL_P.fichiers] = exam.nb;
  cellules[COL_P.possible] = exam.possible ? 'oui' : 'non'; cellules[COL_P.pourquoi] = prgPourquoi_(nature, exam);
  cellules[COL_P.etat] = exam.possible ? PRG_ETAT.propose : PRG_ETAT.impossible;
  if (!active || fait) {
    const cle = base + '|' + (Math.max(active ? active.n : 0, prgNumeroJournal_(base)) + 1), ligne = sh.getLastRow() + 1;
    stkAssurerLignes_(sh, ligne);
    PRG_COLONNES_TEXTE.forEach(col => sh.getRange(ligne, col).setNumberFormat('@'));
    sh.getRange(ligne, COL_P.corbeille).insertCheckboxes(); sh.getRange(ligne, COL_P.annuler).insertCheckboxes();
    const valeurs = PRG_ENTETES.map((t, i) => cellules[i + 1] === undefined ? '' : cellules[i + 1]);
    valeurs[COL_P.corbeille - 1] = false; valeurs[COL_P.annuler - 1] = false;
    valeurs[COL_P.maj - 1] = new Date(maintenant_()); valeurs[COL_P.cle - 1] = cle;
    sh.getRange(ligne, 1, 1, PRG_ENTETES.length).setValues([valeurs.map(cellule_)]);
  } else if (!prgEcrire_(sh, active.cle, cellules, true)) return court + ' : purge en cours';   // l'état a changé entre la lecture et l'écriture
  return court + (exam.possible ? ' : purge possible (onglet « ' + SHEET_PURGES + ' »)' : ' : purge impossible pour l’instant (onglet « ' + SHEET_PURGES + ' »)');
}

// ── Journal « Purges détail » ──
function prgElement_(type, id) { return type === 'mail' ? prgMailElement_(id) : type === 'dossier' ? DriveApp.getFolderById(id) : DriveApp.getFileById(id); }
// Les mots de la ligne et du mail, selon que la purge porte sur Drive ou sur les mails envoyés
function prgMots_(cle, texte) {
  const k = prgLireCle_(cle);
  if (!k || k.nature !== 'mails') return texte;
  return texte.replace(/fichier\(s\) ou dossier\(s\)/g, 'mail(s)').replace(/fichier\(s\)/g, 'mail(s)').replace(/corbeille de Drive/g, 'corbeille de Gmail')
    .replace(/ ; ils sont dans le dossier du chantier sur le PC/g, ' ; leurs PDF sont dans le dossier du chantier sur le PC');
}
function prgDetail_(shD) {
  const derniere = shD.getLastRow();
  return derniere < 2 ? [] : shD.getRange(2, 1, derniere - 1, PRG_DETAIL_ENTETES.length).getValues().map((r, i) => ({ ligne: i + 2, r: r }));
}
function prgEcrireDetail_(shD, ligne, etat) { shD.getRange(ligne, COL_D.etat, 1, 2).setValues([[cellule_(etat), new Date(maintenant_())]]); }
// Ce que la ligne a réellement mis à la corbeille (d'après le journal) ; « autres » : refusés ou en échec ;
// « premier » : la date de la PLUS ANCIENNE mise à la corbeille de cette purge (0 s'il n'y en a pas). Google supprime
// chaque fichier, chaque mail, 30 jours après SA mise à la corbeille : c'est cette date qui fixe les délais de la ligne.
function prgTotaux_(shD, cle) {
  const t = { elements: 0, fichiers: 0, octets: 0, autres: 0, premier: 0 };
  prgDetail_(shD).forEach(x => {
    if (String(x.r[COL_D.cle - 1]) !== cle) return;
    const etat = String(x.r[COL_D.etat - 1]);
    if (etat === 'fait') {
      t.elements++; t.fichiers += Number(x.r[COL_D.fichiers - 1]) || 0; t.octets += Number(x.r[COL_D.taille - 1]) || 0;
      const note = x.r[COL_D.note - 1];
      if (stkEstDate_(note) && (!t.premier || note.getTime() < t.premier)) t.premier = note.getTime();
    } else if (/^(refusé|échec)/.test(etat)) t.autres++;
  });
  return t;
}
// Le journal d'ABORD : chaque paquet est écrit « à faire » (et réellement enregistré : flush) avant sa première mise à la
// corbeille ; puis chaque fichier ou dossier est marqué « fait », « refusé : … » ou « échec : … ». Le temps est regardé
// avant CHAQUE mise à la corbeille : ce qui reste du paquet est alors marqué « non fait ». Rend false si le temps a manqué.
function prgExecuter_(shD, cle, items, garde, depasse) {
  for (let i = 0; i < items.length; i += PRG_PAQUET) {
    if (depasse()) return false;
    const paquet = items.slice(i, i + PRG_PAQUET), date = new Date(maintenant_());
    const debut = shD.getLastRow() + 1;
    stkAssurerLignes_(shD, debut + paquet.length - 1);
    shD.getRange(debut, 1, paquet.length, COL_D.chemin).setNumberFormat('@');
    shD.getRange(debut, 1, paquet.length, PRG_DETAIL_ENTETES.length)
      .setValues(paquet.map(x => [cle, x.type, x.id, x.chemin, x.taille, x.fichiers, date, 'à faire', date].map(cellule_)));
    SpreadsheetApp.flush();
    let coupe = false;
    const etats = paquet.map(x => {
      if (coupe || depasse()) { coupe = true; return 'non fait (temps écoulé)'; }
      try {
        const api = prgElement_(x.type, x.id), refus = garde(api, x);
        if (refus) return 'refusé : ' + refus;
        api.setTrashed(true);      // la corbeille de Drive, jamais une suppression définitive
        return 'fait';
      } catch (e) { return 'échec : ' + (e && e.message ? e.message : e); }
    });
    prgMarquer_(shD, cle, debut, paquet, etats);
    SpreadsheetApp.flush();
    if (coupe) return false;
  }
  return true;
}
// Marque un paquet. Ses lignes sont en principe là où elles viennent d'être écrites ; si l'onglet a bougé entre-temps,
// chaque ligne est retrouvée par sa clé et son identifiant.
function prgMarquer_(shD, cle, debut, paquet, etats) {
  const date = new Date(maintenant_());
  const ids = shD.getRange(debut, COL_D.id, paquet.length, 1).getValues();
  if (paquet.every((x, i) => String(ids[i][0]) === x.id)) {
    shD.getRange(debut, COL_D.etat, paquet.length, 2).setValues(etats.map(e => [cellule_(e), date]));
    return;
  }
  const lignes = prgDetail_(shD);
  paquet.forEach((x, i) => {
    const l = lignes.filter(y => String(y.r[COL_D.cle - 1]) === cle && String(y.r[COL_D.id - 1]) === x.id && String(y.r[COL_D.etat - 1]) === 'à faire')[0];
    if (l) prgEcrireDetail_(shD, l.ligne, etats[i]);
  });
}
// Reprise après une exécution coupée : une ligne restée « à faire » dit si son fichier est parti à la corbeille ou non.
// Appelée à CHAQUE traitement d'une clé, quel que soit l'état affiché par la ligne.
function prgReprendre_(shD, cle) {
  prgDetail_(shD).forEach(x => {
    if (String(x.r[COL_D.cle - 1]) !== cle || String(x.r[COL_D.etat - 1]) !== 'à faire') return;
    let etat;
    try { etat = prgElement_(String(x.r[COL_D.type - 1]), String(x.r[COL_D.id - 1])).isTrashed() ? 'fait' : 'non fait (exécution coupée)'; }
    catch (e) { etat = 'introuvable (exécution coupée)'; }
    prgEcrireDetail_(shD, x.ligne, etat);
  });
}
// Avant une nouvelle purge sur la même clé (après une annulation) : les lignes « remis » de l'annulation précédente sont
// rangées, pour que le bilan de la prochaine annulation ne compte que ses propres lignes
function prgRanger_(shD, cle) {
  prgDetail_(shD).forEach(x => {
    const etat = String(x.r[COL_D.etat - 1]);
    if (String(x.r[COL_D.cle - 1]) === cle && /^(remis|non remis)/.test(etat) && etat.indexOf(PRG_AVANT) < 0) prgEcrireDetail_(shD, x.ligne, etat + PRG_AVANT);
  });
}
const PRG_AVANT = ' — purge précédente';

// ── Verrou de la purge : une propriété datée, JAMAIS le verrou du script (celui des fiches) ──
function prgPrendre_() {
  const props = PropertiesService.getScriptProperties(), depuis = Number(props.getProperty('PURGE_EN_COURS') || 0);
  if (depuis && Math.abs(Date.now() - depuis) < PRG_VERROU_MS) return false;   // au-delà de 7 min : exécution morte, on reprend
  props.setProperty('PURGE_EN_COURS', String(Date.now()));
  return true;
}
function prgRendre_() { PropertiesService.getScriptProperties().deleteProperty('PURGE_EN_COURS'); }
// ── Plafond par jour du temps passé à purger (les 90 minutes de déclencheurs du compte servent aussi aux fiches) ──
// Propriété PURGE_TEMPS : { jour, ms }. Rend les millisecondes encore permises aujourd'hui.
function prgBudget_() {
  let t = {};
  try { t = JSON.parse(PropertiesService.getScriptProperties().getProperty('PURGE_TEMPS') || '{}') || {}; } catch (e) { t = {}; }
  return PRG_MAX_MINUTES_JOUR * 60 * 1000 - (t.jour === jour_() ? Number(t.ms) || 0 : 0);
}
function prgCompter_(ms) {
  const utilise = PRG_MAX_MINUTES_JOUR * 60 * 1000 - prgBudget_() + Math.max(0, ms);
  PropertiesService.getScriptProperties().setProperty('PURGE_TEMPS', JSON.stringify({ jour: jour_(), ms: utilise }));
}
const PRG_SUITE_DEMAIN = 'Temps de purge du jour épuisé (' + PRG_MAX_MINUTES_JOUR + ' minutes par jour, pour ne jamais gêner l’envoi des fiches) : la suite demain, toute seule.';

// ── Le traitement des cases (déclencheur dédié, toutes les 30 minutes) ──
function traiterPurges() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PURGES);
  if (!sh || sh.getLastRow() < 2) return 'rien';
  if (!noteTitresBons_(sh, PRG_ENTETES)) { stkAlerteOnglet_(SHEET_PURGES); return 'onglet modifié'; }
  // Rien à faire (aucune case cochée, aucune purge à reprendre, aucun mail à renvoyer) : on sort tout de suite
  const lignes = prgLignes_(sh);
  const aFaire = lignes.filter(x => x.r[COL_P.corbeille - 1] === true || x.r[COL_P.annuler - 1] === true
    || prgEstOccupe_(x.r[COL_P.etat - 1]) || String(x.r[COL_P.etat - 1]) === PRG_ETAT.mail);
  if (!aFaire.length) return 'rien';
  if (!prgPrendre_()) return 'occupé';
  const debut = chronoMs_();
  let traitees = 0;
  try {
    let shD;
    try { shD = feuillePurgesDetail_(); } catch (e) { return 'onglet modifié'; }   // sans journal, aucune mise à la corbeille
    // Une clé présente deux fois (ligne copiée-collée) : aucune de ses lignes n'est traitée, elles le disent
    const compte = {}, cles = [];
    lignes.forEach(x => { const k = '/' + x.r[COL_P.cle - 1]; compte[k] = (compte[k] || 0) + 1; });
    aFaire.forEach(x => {
      const cle = String(x.r[COL_P.cle - 1]);
      if (compte['/' + cle] > 1) { prgDoublon_(sh, x.ligne, cle); traitees++; }
      else if (cles.indexOf(cle) < 0) cles.push(cle);
    });
    const ctx = prgContexte_(), budget = prgBudget_();
    const depasse = () => chronoMs_() - debut > STK_DUREE_MAX_MS;
    const temps = { depasse: depasse, depassePurge: () => depasse() || chronoMs_() - debut > budget, epuise: () => chronoMs_() - debut > budget };
    for (let i = 0; i < cles.length; i++) {
      if (depasse()) break;
      try { prgTraiterLigne_(sh, shD, cles[i], ctx, temps); }
      catch (e) {
        console.error('traiterPurges :', e && e.message);
        prgArreter_(sh, shD, cles[i], 'Erreur le ' + texteDate_(maintenant_()) + ' : ' + (e && e.message ? e.message : e) + '.');
      }
      traitees++;
    }
  } finally { prgCompter_(chronoMs_() - debut); prgRendre_(); }
  return traitees + ' ligne(s) traitée(s)';
}
// Une ligne dont la clé existe en double : cases décochées, message. Écrit par numéro de ligne, après avoir relu la clé.
function prgDoublon_(sh, ligne, cle) {
  if (String(sh.getRange(ligne, COL_P.cle).getValue()) !== cle) return;
  const message = 'Cette ligne existe en double (copier-coller ?) : rien n’est fait sur aucune des deux. Supprime la copie, puis recoche.';
  if (sh.getRange(ligne, COL_P.corbeille).getValue() === true) sh.getRange(ligne, COL_P.corbeille).setValue(false);
  if (sh.getRange(ligne, COL_P.annuler).getValue() === true) sh.getRange(ligne, COL_P.annuler).setValue(false);
  if (String(sh.getRange(ligne, COL_P.message).getValue()) !== message) sh.getRange(ligne, COL_P.message).setValue(message);
}

function prgTraiterLigne_(sh, shD, cle, ctx, temps) {
  if (!prgLigne_(sh, cle)) return;
  prgReprendre_(shD, cle);   // toujours : un journal resté « à faire » est tranché d'après l'état réel des fichiers
  const lire = () => { const l = prgLigne_(sh, cle); return l ? sh.getRange(l, 1, 1, PRG_ENTETES.length).getValues()[0] : null; };
  let r = lire();
  if (!r) return;
  const k = prgLireCle_(cle), c = !k ? null : k.nature === 'mails' ? PRG_MAILS_C : ctx.chantiers[k.chantier];
  const corbeille = r[COL_P.corbeille - 1] === true, annuler = r[COL_P.annuler - 1] === true, etat = String(r[COL_P.etat - 1]);
  const enCours = /^en cours/i.test(etat), annulation = /^annulation en cours/i.test(etat);
  let fait = prgEstFait_(etat);
  const dire = (message, autres) => { const m = autres || {}; m[COL_P.message] = message; prgEcrire_(sh, cle, m); };
  const decocher = () => { const m = {}; m[COL_P.corbeille] = false; m[COL_P.annuler] = false; return m; };
  // Le journal dit que des fichiers sont à la corbeille alors que la ligne ne dit ni « En cours » ni « Fait » (état
  // écrasé pendant une purge) : la ligne est remise en ordre, pour que « Annuler » marche
  if (!fait && !enCours && !annulation && prgTotaux_(shD, cle).elements > 0) {
    prgFinir_(sh, shD, cle, 'Ligne remise en ordre : une purge avait commencé sur cette ligne.');
    return;
  }
  // La ligne affichée ne correspond plus à sa clé (tri d'une partie des colonnes) : jamais de purge ni d'annulation « à l'aveugle »
  if (!k || cleChantier_(r[COL_P.chantier - 1]) !== k.chantier || String(r[COL_P.quoi - 1]).trim() !== PRG_QUOI[k.nature]) {
    if (enCours) { prgFinir_(sh, shD, cle, 'Arrêtée : la ligne ne correspondait plus à sa clé (onglet trié en partie ?).'); return; }
    const m = decocher();
    if (k) { m[COL_P.chantier] = c ? c.nom : k.chantier; m[COL_P.quoi] = PRG_QUOI[k.nature]; }
    if (!fait && !annulation) { m[COL_P.etat] = PRG_ETAT.impossible; m[COL_P.possible] = 'non'; }
    dire('Cette ligne avait été mélangée (tri d’une partie des colonnes ?) : le chantier affiché n’était plus celui de sa clé. Rien n’a été fait. '
      + 'Le chantier et « Quoi » sont remis ; attends la prochaine mesure avant de recocher.', m);
    return;
  }
  if (corbeille && annuler && !enCours && !annulation) {
    dire('Les deux cases étaient cochées : rien n’a été fait, et elles ont été décochées. Coches-en une seule.', decocher());
    return;
  }
  // « Annuler » cochée pendant une purge en plusieurs passages : la purge s'arrête là, puis ce qui est parti est annulé
  if (annuler && enCours) {
    fait = prgFinir_(sh, shD, cle, 'Purge arrêtée : « Annuler » a été cochée.', true);
    if (!fait) { const m = {}; m[COL_P.annuler] = false; prgEcrire_(sh, cle, m); return; }
    r = lire();
    if (r) prgAnnuler_(sh, shD, cle, r, false, temps.depasse);
    return;
  }
  if (annulation || annuler) {
    if (!fait && !annulation) { dire('Rien à annuler sur cette ligne : rien n’a été mis à la corbeille.', decocher()); return; }
    prgAnnuler_(sh, shD, cle, r, annulation, temps.depasse);
    return;
  }
  if (corbeille || enCours) {
    if (fait) { dire('Déjà fait : rien de plus n’a été mis à la corbeille. S’il reste des fichiers, une nouvelle ligne sera proposée à la prochaine mesure.', decocher()); return; }
    // La case n'agit que sur une ligne « Proposé » : ce que tu as lu à l'écran est ce qui est fait
    if (!enCours && etat !== PRG_ETAT.propose) {
      dire('Cette ligne n’est pas « ' + PRG_ETAT.propose + ' » : rien n’a été fait, la case est décochée. Attends la prochaine mesure (cette nuit) ; si elle dit « Possible ? oui », recoche.', decocher());
      return;
    }
    if (temps.epuise()) { if (String(r[COL_P.message - 1]) !== PRG_SUITE_DEMAIN) dire(PRG_SUITE_DEMAIN); return; }
    prgPurger_(sh, shD, cle, k, c, enCours, corbeille, ctx, temps);
    return;
  }
  if (etat === PRG_ETAT.mail) prgMailPurge_(sh, shD, cle);   // le mail d'une purge faite n'était pas parti : nouvel essai
}

// Une case « Mettre à la corbeille » : tout est REVÉRIFIÉ, puis journal, puis corbeille
function prgPurger_(sh, shD, cle, k, c, enCours, cochee, ctx, temps) {
  if (k.nature === 'mails') { prgPurgerMails_(sh, shD, cle, enCours, cochee, ctx, temps); return; }
  if (enCours && !cochee) { prgFinir_(sh, shD, cle, 'Arrêtée : la case a été décochée pendant la purge.'); return; }
  let refus = '', exam = null;
  if (!c) refus = 'Ce chantier n’est plus dans l’onglet Chantiers.';
  else {
    exam = prgExaminer_(k.nature, c, ctx, PRG_RELEVE_PURGE_HEURES * 3600 * 1000, temps.depasse, null, null);
    if (exam.dossierId && exam.dossierId !== k.dossier) refus = 'Le dossier du chantier n’est plus celui de cette ligne.';
    else if (!exam.possible) refus = prgPourquoi_(k.nature, exam);
  }
  if (refus) {
    if (enCours) { prgFinir_(sh, shD, cle, 'Arrêtée avant la fin : ' + refus); return; }
    const cellules = {};
    cellules[COL_P.corbeille] = false; cellules[COL_P.possible] = 'non'; cellules[COL_P.pourquoi] = refus; cellules[COL_P.etat] = PRG_ETAT.impossible;
    cellules[COL_P.message] = 'Refusé le ' + texteDate_(maintenant_()) + ' : les conditions ne sont plus réunies. Rien n’a été mis à la corbeille.';
    prgEcrire_(sh, cle, cellules);
    return;
  }
  if (!enCours) prgRanger_(shD, cle);
  const cellules = {};
  cellules[COL_P.etat] = PRG_ETAT.enCours; cellules[COL_P.message] = 'Mise à la corbeille en cours depuis le ' + texteDate_(maintenant_()) + '.';
  prgEcrire_(sh, cle, cellules);
  SpreadsheetApp.flush();
  const fini = prgExecuter_(shD, cle, exam.items, exam.garde, temps.depassePurge);
  if (exam.carnet && exam.carnet.id) cacheScript_().remove('carnet:liste:1:' + exam.carnet.id + ':n');   // les téléphones relisent le carnet
  if (!fini) { prgEnCours_(sh, shD, cle, temps.epuise() ? PRG_SUITE_DEMAIN : 'En cours : la suite au prochain passage (30 minutes au plus).'); return; }
  prgFinir_(sh, shD, cle, '');
}
// Une purge qui continuera à un autre passage (ou un autre jour) : la ligne le dit, avec les vrais délais, comptés depuis
// la PREMIÈRE mise à la corbeille de cette purge
function prgEnCours_(sh, shD, cle, message) {
  const t = prgTotaux_(shD, cle), m = {};
  m[COL_P.message] = message;
  if (t.premier) {
    m[COL_P.libere] = new Date(t.premier + PRG_CORBEILLE_JOURS * PRG_JOUR_MS); m[COL_P.jusquau] = new Date(t.premier + PRG_ANNULATION_JOURS * PRG_JOUR_MS);
    m[COL_P.message] = prgMots_(cle, message + ' Déjà ' + t.fichiers + ' fichier(s) à la corbeille, depuis le ' + stkJour_(t.premier) + ' : pour tout annuler, coche « Annuler » avant le '
      + stkJour_(t.premier + PRG_ANNULATION_JOURS * PRG_JOUR_MS) + ' (les délais se comptent depuis les premières mises à la corbeille).');
  }
  prgEcrire_(sh, cle, m);
}
// Fin d'une purge (complète, ou arrêtée) : la ligne dit ce qui a été fait d'après le journal, et le mail part.
// sansMail : la purge est arrêtée pour être annulée aussitôt. Rend true si quelque chose est à la corbeille.
function prgFinir_(sh, shD, cle, remarque, sansMail) {
  const t = prgTotaux_(shD, cle), maintenant = maintenant_(), cellules = {};
  cellules[COL_P.corbeille] = false;
  if (!t.elements) {
    cellules[COL_P.etat] = PRG_ETAT.impossible;
    cellules[COL_P.message] = prgMots_(cle, [remarque, 'Rien n’a été mis à la corbeille' + (t.autres ? ' (' + t.autres + ' fichier(s) ou dossier(s) refusé(s) ou en échec : voir « ' + SHEET_PURGES_DETAIL + ' »).' : '.')].filter(Boolean).join(' '));
    prgEcrire_(sh, cle, cellules);
    return false;
  }
  cellules[COL_P.etat] = sansMail ? PRG_ETAT.fait : PRG_ETAT.mail;
  // Les délais se comptent depuis la PLUS ANCIENNE mise à la corbeille de cette purge (elle a pu s'étaler sur plusieurs jours)
  const depuis = t.premier || maintenant, etale = stkJour_(depuis) !== stkJour_(maintenant);
  cellules[COL_P.faitLe] = new Date(depuis); cellules[COL_P.nbFaits] = t.fichiers;
  cellules[COL_P.libere] = new Date(depuis + PRG_CORBEILLE_JOURS * PRG_JOUR_MS);
  cellules[COL_P.jusquau] = new Date(depuis + PRG_ANNULATION_JOURS * PRG_JOUR_MS);
  cellules[COL_P.message] = prgMots_(cle, [remarque, t.fichiers + ' fichier(s) à la corbeille (' + String(stkMo_(t.octets)).replace('.', ',') + ' Mo)'
    + (t.autres ? ' ; ' + t.autres + ' fichier(s) ou dossier(s) laissé(s) en place (voir « ' + SHEET_PURGES_DETAIL + ' »)' : '') + '.'
    + (etale ? ' Purge commencée le ' + stkJour_(depuis) + ', finie le ' + stkJour_(maintenant) + ' : les délais se comptent depuis le début.' : '')
    + ' Pour annuler : coche « Annuler » avant le ' + stkJour_(depuis + PRG_ANNULATION_JOURS * PRG_JOUR_MS) + '.'].filter(Boolean).join(' '));
  prgEcrire_(sh, cle, cellules);   // si la ligne a été supprimée entre-temps, le mail part quand même
  if (!sansMail) prgMailPurge_(sh, shD, cle);
  return true;
}
// Un mail à Franck à chaque mise à la corbeille ; s'il ne part pas, la ligne reste « Fait (mail à envoyer) » et il repartira.
// Le chantier et la sorte de purge viennent de la CLÉ (jamais du texte affiché, que Franck peut avoir trié ou modifié) ;
// le mail part même si la ligne a disparu de l'onglet.
function prgMailPurge_(sh, shD, cle) {
  const ligne = prgLigne_(sh, cle), v = ligne ? sh.getRange(ligne, 1, 1, PRG_ENTETES.length).getValues()[0] : null;
  const t = prgTotaux_(shD, cle), k = prgLireCle_(cle), maintenant = maintenant_();
  const connu = k ? stkChantiers_()[k.chantier] : null;
  const chantier = connu ? connu.nom : (k ? k.chantier : cle), quoi = k ? PRG_QUOI[k.nature] : '';
  const jour = (cellule, defaut) => stkJour_(v && stkEstDate_(cellule) ? cellule.getTime() : defaut);
  const faitLe = jour(v && v[COL_P.faitLe - 1], maintenant), libere = jour(v && v[COL_P.libere - 1], maintenant + PRG_CORBEILLE_JOURS * PRG_JOUR_MS);
  const jusquau = jour(v && v[COL_P.jusquau - 1], maintenant + PRG_ANNULATION_JOURS * PRG_JOUR_MS);
  const mails = !!k && k.nature === 'mails';
  const texte = prgMots_(cle, ['Tu as coché « Mettre à la corbeille » dans l’onglet « ' + SHEET_PURGES + ' » du Sheet.', '',
    mails ? 'Compte Gmail de l’appli' : 'Chantier : ' + chantier, 'Quoi : ' + quoi,
    'Mis à la corbeille de Drive le ' + faitLe + ' : ' + t.fichiers + ' fichier(s), ' + String(stkMo_(t.octets)).replace('.', ',') + ' Mo'
      + (t.autres ? ' (' + t.autres + ' fichier(s) ou dossier(s) laissé(s) en place : voir l’onglet « ' + SHEET_PURGES_DETAIL + ' »)' : '') + '.', '',
    'Rien n’est supprimé définitivement : tout est dans la corbeille de Drive, et la liste exacte est dans l’onglet « ' + SHEET_PURGES_DETAIL + ' ».',
    'La place sera vraiment libérée le ' + libere + ' (la corbeille compte dans les 15 Go pendant ' + PRG_CORBEILLE_JOURS + ' jours).', '',
    v ? 'POUR ANNULER : dans l’onglet « ' + SHEET_PURGES + ' », coche la case « Annuler » de cette ligne avant le ' + jusquau + '. Tout ressort de la corbeille dans la demi-heure.'
      : 'ATTENTION : la ligne de cette purge n’est plus dans l’onglet « ' + SHEET_PURGES + ' » (supprimée ?) : la case « Annuler » n’existe donc plus. Pour annuler, restaure les fichiers à la main dans la corbeille de Drive.',
    'Jusqu’au ' + libere + ', c’est aussi possible à la main dans la corbeille de Drive.', '',
    mails ? 'Ce sont des mails de fiches de chantier : les PDF de ces fiches sont rangés dans le Drive et recopiés dans le dossier du chantier sur le PC '
        + '(pour chaque mail, le PDF a été retrouvé dans le dossier Drive du chantier avant la mise à la corbeille). ' + PRG_MAILS_JAMAIS_VISES
      : 'Si MEGA n’avait pas fini de synchroniser le dossier du chantier sur le PC, annule, laisse MEGA finir, puis recommence.'].join('\n'));
  const parti = stkMail_('[Loué App] Mise à la corbeille — ' + chantier + ' — ' + quoi, texte);
  if (v) { const cellules = {}; cellules[COL_P.etat] = parti ? PRG_ETAT.fait : PRG_ETAT.mail; prgEcrire_(sh, cle, cellules); }
}
// Une erreur inattendue pendant le traitement d'une ligne : la ligne le dit, les cases sont décochées (pas de nouvel essai
// toutes les 30 minutes), et ce qui est déjà parti à la corbeille reste annulable
function prgArreter_(sh, shD, cle, message) {
  try {
    const ligne = prgLigne_(sh, cle);
    if (!ligne) return;
    const r = sh.getRange(ligne, 1, 1, PRG_ENTETES.length).getValues()[0], etat = String(r[COL_P.etat - 1]);
    if (/^en cours/i.test(etat)) { prgReprendre_(shD, cle); prgFinir_(sh, shD, cle, message); return; }
    const cellules = {};
    cellules[COL_P.corbeille] = false; cellules[COL_P.annuler] = false; cellules[COL_P.message] = message + ' Les cases ont été décochées.';
    if (/^annulation en cours/i.test(etat)) cellules[COL_P.etat] = PRG_ETAT.fait;   // ce qui n'est pas revenu reste annulable
    prgEcrire_(sh, cle, cellules);
  } catch (e) { console.error('prgArreter_ :', e && e.message); }
}

// La case « Annuler » : sort de la corbeille exactement ce que la ligne y a mis, et dit ce qui n'a pas pu revenir
function prgAnnuler_(sh, shD, cle, r, reprise, depasse) {
  const maintenant = maintenant_(), faitLe = r[COL_P.faitLe - 1];
  if (!reprise && stkEstDate_(faitLe) && maintenant > faitLe.getTime() + PRG_ANNULATION_JOURS * PRG_JOUR_MS) {
    const cellules = {};
    cellules[COL_P.annuler] = false;
    cellules[COL_P.message] = 'Annulation refusée : le délai de ' + PRG_ANNULATION_JOURS + ' jours est passé (purge du ' + stkJour_(faitLe.getTime()) + '). Jusqu’au '
      + stkJour_(faitLe.getTime() + PRG_CORBEILLE_JOURS * PRG_JOUR_MS) + ', c’est encore possible à la main dans la corbeille de Drive (liste dans « ' + SHEET_PURGES_DETAIL + ' »).';
    cellules[COL_P.message] = prgMots_(cle, cellules[COL_P.message]);
    prgEcrire_(sh, cle, cellules);
    return;
  }
  if (!reprise) { const c = {}; c[COL_P.etat] = PRG_ETAT.annulation; c[COL_P.message] = 'Annulation en cours depuis le ' + texteDate_(maintenant) + '.'; prgEcrire_(sh, cle, c); SpreadsheetApp.flush(); }
  // Dans l'ordre inverse de la purge : la liste du carnet d'abord, puis les dossiers, puis les fiches
  const lignes = prgDetail_(shD).filter(x => String(x.r[COL_D.cle - 1]) === cle && String(x.r[COL_D.etat - 1]) === 'fait').reverse();
  let coupe = false;
  for (let i = 0; i < lignes.length; i++) {
    if (depasse()) { coupe = true; break; }
    const x = lignes[i];
    let etat;
    try {
      const api = prgElement_(String(x.r[COL_D.type - 1]), String(x.r[COL_D.id - 1]));
      if (api.isTrashed()) api.setTrashed(false);
      etat = api.isTrashed() ? 'non remis (encore à la corbeille)' : 'remis';
    } catch (e) { etat = 'non remis (introuvable : corbeille vidée ?)'; }
    prgEcrireDetail_(shD, x.ligne, etat);
    if (i % PRG_PAQUET === PRG_PAQUET - 1) SpreadsheetApp.flush();
  }
  if (coupe) { const m = {}; m[COL_P.message] = 'Annulation en cours : la suite au prochain passage (30 minutes au plus).'; prgEcrire_(sh, cle, m); return; }
  // Bilan de CETTE annulation d'après le journal (les lignes d'une annulation précédente sont rangées à part)
  let remis = 0, perdus = 0;
  prgDetail_(shD).forEach(x => {
    const etat = String(x.r[COL_D.etat - 1]);
    if (String(x.r[COL_D.cle - 1]) !== cle || etat.indexOf(PRG_AVANT) > -1) return;
    const n = Number(x.r[COL_D.fichiers - 1]) || 1;
    if (etat === 'remis') remis += n; else if (/^non remis/.test(etat)) perdus += n;
  });
  const k = prgLireCle_(cle);
  try { if (k) { const d = DriveApp.getFolderById(k.dossier); sousDossiersParChemin_(d, stkConf_().documents.carnet).forEach(x => cacheScript_().remove('carnet:liste:1:' + x.getId() + ':n')); } } catch (e) {}
  const cellules = {};
  cellules[COL_P.annuler] = false; cellules[COL_P.corbeille] = false; cellules[COL_P.etat] = PRG_ETAT.annule;
  cellules[COL_P.faitLe] = ''; cellules[COL_P.nbFaits] = ''; cellules[COL_P.libere] = ''; cellules[COL_P.jusquau] = '';
  cellules[COL_P.message] = 'Annulé le ' + texteDate_(maintenant_()) + ' : ' + remis + ' fichier(s) remis en place.'
    + (perdus ? ' ⚠ ' + perdus + ' fichier(s) n’ont PAS pu revenir (corbeille vidée à la main entre-temps ?) : voir « ' + SHEET_PURGES_DETAIL + ' » ; ils sont dans le dossier du chantier sur le PC.' : '')
    + ' La ligne sera proposée de nouveau à la prochaine mesure.';
  cellules[COL_P.message] = prgMots_(cle, cellules[COL_P.message]);
  prgEcrire_(sh, cle, cellules);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// MAILS ENVOYÉS DE PLUS DE 3 MOIS (décision de Franck du 16/11/2026) — une seule ligne de l'onglet « Purges »
//
// Chaque fiche part par mail avec son PDF, et Gmail garde une copie dans « Messages envoyés », qui compte dans les 15 Go.
// Cette ligne propose de mettre à la CORBEILLE DE GMAIL (vidée par Google au bout de 30 jours) les mails des FICHES DE
// CHANTIER que l'appli a envoyés il y a plus de 90 jours. Même case, même journal écrit avant, même annulation de 25 jours.
//
// Quels mails, et seulement ceux-là (chaque mail est lu une fois, juste avant le journal et la corbeille) :
//   - dans « Messages envoyés », envoyé PAR CE COMPTE sous le nom de l'entreprise (c'est ainsi que l'appli envoie) ;
//   - objet « [Loué App] <fiche> — … » où <fiche> est dans la liste FERMÉE PRG_MAILS_FICHES (les fiches de chantier) ;
//     un transfert ou une réponse commence par « TR: », « RE: »… : jamais touché ; une demande d'absence : jamais ;
//   - l'objet nomme un chantier de l'onglet Chantiers dont le dossier Drive est sûr (mêmes règles que pour une purge), ET le
//     PDF de la fiche est retrouvé dans ce dossier (un fichier de la même taille que la pièce jointe) : une fiche d'un
//     chantier inconnu (rangée dans « _À CLASSER ») ou dont le rangement a échoué n'est donc jamais visée — son PDF
//     n'existe peut-être que dans le mail. Dans le doute, le mail n'est PAS visé ;
//   - avec au moins une pièce jointe ; de plus de 90 jours ;
//   - jamais un brouillon, un mail suivi (étoile), « Important », portant un libellé, présent dans la boîte de réception,
//     ni un mail dont ce compte est lui-même destinataire (c'est aussi un mail REÇU).
// Mail par mail, jamais par fil de discussion : une réponse reçue dans le même fil n'est jamais touchée.
// Les mails « Loué Menuiserie — … » envoyés aux adresses tapées à la main ne sont pas visés.
//
// Copie TEST : elle est dans le MÊME compte Google que la production, et rien ne distingue un mail de l'une d'un mail de
// l'autre. Sur la copie TEST, seuls les mails dont l'objet contient « CHANTIER TEST AUTO » (le chantier d'essai, qui
// n'existe pas en production) sont visés ; l'âge peut y être réduit par la propriété PURGE_MAILS_JOURS_TEST (ignorée ailleurs).
// Service utilisé : le service avancé Gmail (à activer dans l'éditeur s'il ne l'est pas : verifierConfig le dit), qui sait
// agir mail par mail et sortir un mail de la corbeille. Seulement Messages.list, get, trash et untrash.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
const PRG_MAILS_JOURS = 90;                          // « plus de 3 mois »
const PRG_MAILS_OBJET = '[Loué App] ';               // début de l'objet de tous les mails de fiches envoyés par l'appli
// LISTE FERMÉE des fiches de chantier dont le mail peut être visé : le texte qui suit « [Loué App] » dans l'objet.
// Un nouveau type de fiche n'y entre que sur décision (un test échoue s'il manque ici ET dans PRG_MAILS_JAMAIS).
const PRG_MAILS_FICHES = ['Note de réunion', 'Bordereau Organigramme', 'Bordereau Matériaux', 'Quitus', 'Prise de cotes', 'Fiche fabrication',
  'Réception Support', 'Attestation', 'Signalement'];
const PRG_MAILS_JAMAIS = ["Demande d'absence"];      // PDF rangé hors chantier, jamais recopié sur le PC : jamais visé
const PRG_MAILS_CHANTIER_TEST = 'CHANTIER TEST AUTO';
const PRG_MAILS_C = { nom: '(tout le compte)', cle: '(tout le compte)' }, PRG_MAILS_ID = 'envoyes';
const PRG_MAILS_MAX_LISTE = 2000;                    // mails comptés au plus pour la proposition (au-delà : « plus de 2000 »)
const PRG_MAILS_ECHANTILLON = 30;                    // mails lus pour estimer le nombre et le poids
const PRG_MAILS_PAR_PASSAGE = 200;                   // mails lus (une seule lecture chacun) par passage
const PRG_MAILS_JAMAIS_VISES = 'Jamais visés : les demandes d’absence, les fiches d’un chantier inconnu ou mal rangées, les mails aux adresses tapées à la main, '
  + 'les mails reçus, transférés, suivis (étoile), « Important » ou portant un libellé.';

function prgGmailPresent_() { return typeof Gmail !== 'undefined' && !!Gmail && !!Gmail.Users && !!Gmail.Users.Messages; }
function prgMailsCompte_() { return String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase(); }
// Adresse sans son « +quelquechose » (franck+contact1@… arrive dans la boîte de franck@…)
function prgAdresseNue_(a) { return String(a || '').trim().toLowerCase().replace(/\+[^@]*@/, '@'); }
function prgMailsRegles_(depasse) {
  const test = environnementReel_().env === 'TEST';
  let jours = PRG_MAILS_JOURS;
  if (test) { const j = Number(propriete_('PURGE_MAILS_JOURS_TEST')); if (j >= 1) jours = j; }
  return { test: test, jours: jours, limite: maintenant_() - jours * PRG_JOUR_MS, compte: prgMailsCompte_(), depasse: depasse || (() => false),
    dossiers: {}, tailles: {} };   // par chantier, pour cette exécution : son dossier sûr, et les tailles de ses fiches dans Drive
}
// La recherche Gmail : large filet, chaque mail est ensuite lu et passé à la règle (prgMailRefus_)
function prgMailsRequete_(regles) {
  const avant = Utilities.formatDate(new Date(regles.limite), 'Europe/Paris', 'yyyy/MM/dd');
  return 'in:sent has:attachment subject:"' + PRG_MAILS_OBJET.trim() + '" before:' + avant + ' -in:inbox -is:starred'
    + ' -to:' + regles.compte + ' -cc:' + regles.compte + ' -bcc:' + regles.compte
    + (regles.test ? ' subject:"' + PRG_MAILS_CHANTIER_TEST + '"' : '');
}
// Identifiants des mails trouvés (max au plus) ; « plus » : il y en a davantage
function prgMailsListe_(regles, max) {
  const ids = [];
  let jeton = null, plus = false;
  do {
    const o = { q: prgMailsRequete_(regles), maxResults: Math.min(500, max - ids.length) };
    if (jeton) o.pageToken = jeton;
    const rep = Gmail.Users.Messages.list('me', o) || {};
    (rep.messages || []).forEach(m => { if (ids.length < max) ids.push(String(m.id)); });
    jeton = rep.nextPageToken || null;
    if (jeton && ids.length >= max) plus = true;
  } while (jeton && ids.length < max);
  return { ids: ids, plus: plus };
}
// Un mail, lu dans Gmail : { id, labels, taille, date, de, a, objet, pj: [tailles des pièces jointes] }
function prgMailLu_(id) {
  const m = Gmail.Users.Messages.get('me', id, { format: 'full' }) || {};
  const entetes = {}, pj = [];
  ((m.payload && m.payload.headers) || []).forEach(h => { const n = String(h.name || '').toLowerCase(); entetes[n] = (entetes[n] ? entetes[n] + ', ' : '') + String(h.value || ''); });
  const parcourir = p => { if (!p) return; if (String(p.filename || '') !== '') pj.push(Number(p.body && p.body.size) || 0); (p.parts || []).forEach(parcourir); };
  parcourir(m.payload);
  return { id: String(id), labels: m.labelIds || [], taille: Number(m.sizeEstimate) || 0, date: Number(m.internalDate) || 0,
    de: entetes.from || '', a: [entetes.to, entetes.cc, entetes.bcc].filter(Boolean).join(', '), objet: entetes.subject || '', pj: pj };
}
// Le type de fiche et le chantier nommés par l'objet « [Loué App] <fiche> — … — <chantier> — … » ; null si ce n'est pas sûr
function prgMailFiche_(objet, ctx) {
  if (objet.indexOf(PRG_MAILS_OBJET) !== 0) return null;
  const reste = objet.slice(PRG_MAILS_OBJET.length);
  const fiche = PRG_MAILS_FICHES.filter(f => reste.indexOf(f + ' — ') === 0)[0];
  if (!fiche) return { fiche: '', jamais: PRG_MAILS_JAMAIS.some(f => reste.indexOf(f) === 0) };
  const morceaux = reste.slice(fiche.length).split(' — ').map(x => x.trim()).filter(Boolean);
  let c = null;
  for (let i = 0; i < morceaux.length && !c; i++) c = ctx.chantiers[cleChantier_(morceaux[i])] || null;
  return { fiche: fiche, chantier: c };
}
// '' si ce mail peut aller à la corbeille, sinon la raison. C'est LA règle : tout ce qui n'est pas sûr est refusé.
// avecDrive : vérifier aussi que le PDF de la fiche est dans le dossier Drive du chantier (lecture du dossier, une fois par chantier).
function prgMailRefus_(m, regles, ctx, avecDrive) {
  const a = l => m.labels.indexOf(l) > -1;
  if (!a('SENT')) return 'pas dans les messages envoyés';
  if (a('TRASH')) return 'déjà à la corbeille';
  if (a('DRAFT')) return 'brouillon';
  if (a('INBOX')) return 'aussi dans la boîte de réception (mail reçu)';
  if (a('STARRED')) return 'mail suivi (étoile)';
  if (a('SPAM')) return 'indésirable';
  if (a('IMPORTANT')) return 'marqué « Important »';
  // tout autre libellé (créé par l'utilisateur, ou inconnu) : le mail compte pour quelqu'un, il n'est pas visé
  const autres = m.labels.filter(l => l !== 'SENT' && !/^CATEGORY_/.test(l));
  if (autres.length) return 'porte un libellé';
  if (!regles.compte || m.de.toLowerCase().indexOf(regles.compte) < 0) return 'pas envoyé par ce compte';
  if (m.de.indexOf(NOM_ENTREPRISE) < 0) return 'pas envoyé par l’appli (nom de l’expéditeur)';
  const f = prgMailFiche_(m.objet, ctx);
  if (!f) return 'objet qui ne commence pas par « ' + PRG_MAILS_OBJET.trim() + ' »';
  if (!f.fiche) return f.jamais ? 'demande d’absence : jamais visée' : 'pas une fiche de chantier de la liste';
  if (regles.test && m.objet.indexOf(PRG_MAILS_CHANTIER_TEST) < 0) return 'copie TEST : seuls les mails du chantier d’essai sont visés';
  if (!m.pj.length) return 'sans pièce jointe';
  if (!(m.date > 0) || m.date > regles.limite) return 'envoyé depuis moins de ' + regles.jours + ' jours';
  const destinataires = (m.a.match(/[^\s<>,;"]+@[^\s<>,;"]+/g) || []).map(prgAdresseNue_);
  if (!destinataires.length) return 'destinataires illisibles';
  if (destinataires.indexOf(prgAdresseNue_(regles.compte)) > -1) return 'ce compte est lui-même destinataire (mail reçu)';
  if (!f.chantier) return 'chantier inconnu de l’onglet Chantiers (fiche rangée dans « ' + DOSSIER_A_CLASSER + ' » ?)';
  const cle = f.chantier.cle;
  if (!regles.dossiers[cle]) regles.dossiers[cle] = prgDossierSur_(f.chantier, ctx);
  if (!regles.dossiers[cle].ok) return 'dossier Drive du chantier non sûr';
  if (!avecDrive) return '';
  if (!regles.tailles[cle]) {
    const inv = stkInventaire_(regles.dossiers[cle].dossier, ctx.cats, regles.depasse, true, ctx.idsDossiers), t = { complet: inv.complet };
    inv.liste.forEach(x => { t['/' + x.taille] = true; });
    regles.tailles[cle] = t;
  }
  if (!regles.tailles[cle].complet) return 'dossier Drive du chantier pas lu en entier';
  if (!m.pj.some(t => t > 0 && regles.tailles[cle]['/' + t])) return 'PDF de la fiche introuvable dans le dossier Drive du chantier (rangement échoué, ou chantier déjà purgé)';
  return '';
}
// Un mail vu comme un fichier de Drive par la reprise et l'annulation
function prgMailElement_(id) {
  return { getId: () => id,
    isTrashed: () => (Gmail.Users.Messages.get('me', id, { format: 'minimal' }).labelIds || []).indexOf('TRASH') > -1,
    setTrashed: v => { if (v) Gmail.Users.Messages.trash('me', id); else Gmail.Users.Messages.untrash('me', id); } };   // corbeille de Gmail, rien d'autre
}
// Pourquoi la ligne ne peut rien faire sur ce serveur ('' si elle le peut)
function prgMailsBloque_(ctx) {
  if (ctx.env) return ctx.env;
  if (!prgGmailPresent_()) return 'le service avancé Gmail n’est pas activé sur ce serveur : dans l’éditeur Apps Script, « Services » (le +) → « Gmail API » → Ajouter (à faire une fois)';
  if (!prgMailsCompte_()) return 'adresse du compte illisible : aucun mail n’est visé';
  return '';
}
// La proposition (mesure de la nuit) : compte et estime sur un échantillon, sans lire les dossiers de Drive. LECTURE SEULE.
function prgExaminerMails_(ctx, depasse) {
  const r = { possible: false, raisons: [], infos: [], items: [], octets: 0, nb: 0, dossierId: PRG_MAILS_ID, garde: null, carnet: null, pourquoi: '' };
  const bloque = prgMailsBloque_(ctx);
  if (bloque) { r.raisons.push(bloque); return r; }
  const regles = prgMailsRegles_(depasse), liste = prgMailsListe_(regles, PRG_MAILS_MAX_LISTE);
  let bons = 0, octets = 0, lus = 0;
  for (let i = 0; i < liste.ids.length && lus < PRG_MAILS_ECHANTILLON && !depasse(); i++) {
    const m = prgMailLu_(liste.ids[i]);
    lus++;
    if (!prgMailRefus_(m, regles, ctx, false)) { bons++; octets += m.taille; }
  }
  const nombre = lus ? Math.round(liste.ids.length * bons / lus) : 0;
  r.nb = nombre; r.octets = bons ? Math.round(octets / bons * nombre) : 0;
  for (let i = 0; i < nombre; i++) r.items.push(null);   // seul le nombre compte pour une proposition
  if (!nombre) { r.raisons.push('aucun mail de fiche de chantier de plus de ' + regles.jours + ' jours à mettre à la corbeille'); return r; }
  r.possible = true;
  r.pourquoi = 'Possible : au plus ' + (liste.plus ? 'plus de ' : 'environ ') + nombre + ' mail(s) de fiches de chantier envoyé(s) par l’appli avant le ' + stkJour_(regles.limite)
    + ' (environ ' + String(stkMo_(r.octets)).replace('.', ',') + ' Mo, estimation). Un mail ne part que si le PDF de sa fiche est retrouvé dans le dossier Drive de son chantier : '
    + 'les PDF de ces fiches sont rangés dans le Drive et recopiés dans le dossier du chantier sur le PC. ' + PRG_MAILS_JAMAIS_VISES
    + (regles.test ? ' Sur la copie TEST : seulement les mails du chantier d’essai.' : '')
    + ' Avant de cocher : vérifie que tu n’as plus besoin de retrouver ces mails dans Gmail, et purge les mails AVANT de purger un chantier terminé (après, ses mails ne sont plus visés). '
    + 'Après la mise à la corbeille, Gmail ne rend la place que ' + PRG_CORBEILLE_JOURS + ' jours plus tard.';
  return r;
}
// Appelée par la mesure de la nuit, à la fin d'un tour : la ligne n'est créée que s'il y a quelque chose à gagner
function prgProposerMails_(ctx, depasse) {
  const sh = feuillePurges_();
  const exam = prgExaminerMails_(ctx, depasse);
  return prgProposer_(sh, 'mails', PRG_MAILS_C, PRG_MAILS_ID, exam, exam.possible);
}
// Un passage sur des mails : chacun est LU UNE FOIS, passé à la règle ; seuls ceux qui passent sont écrits « à faire » au
// journal (identifiant, date, début de l'objet — rien d'un mail non visé), puis mis à la corbeille, puis marqués.
// Rend { coupe (temps écoulé), refuses (mails lus et non visés) }.
function prgExecuterMails_(shD, cle, ids, regles, ctx, depasse) {
  const rendu = { coupe: false, refuses: 0 };
  for (let i = 0; i < ids.length && !rendu.coupe; i += PRG_PAQUET) {
    const vises = [];
    for (let j = i; j < Math.min(ids.length, i + PRG_PAQUET); j++) {
      if (depasse()) { rendu.coupe = true; break; }
      let m = null, refus;
      try { m = prgMailLu_(ids[j]); refus = prgMailRefus_(m, regles, ctx, true); } catch (e) { refus = 'illisible'; }
      if (refus) rendu.refuses++;
      else vises.push({ type: 'mail', id: m.id, chemin: texteDate_(m.date) + ' — ' + m.objet.slice(0, 80), taille: m.taille, fichiers: 1 });
    }
    if (!vises.length) continue;
    const date = new Date(maintenant_()), debut = shD.getLastRow() + 1;
    stkAssurerLignes_(shD, debut + vises.length - 1);
    shD.getRange(debut, 1, vises.length, COL_D.chemin).setNumberFormat('@');
    shD.getRange(debut, 1, vises.length, PRG_DETAIL_ENTETES.length)
      .setValues(vises.map(x => [cle, x.type, x.id, x.chemin, x.taille, x.fichiers, date, 'à faire', date].map(cellule_)));
    SpreadsheetApp.flush();   // le journal d'abord
    const etats = vises.map(x => {
      if (rendu.coupe || depasse()) { rendu.coupe = true; return 'non fait (temps écoulé)'; }
      try { prgMailElement_(x.id).setTrashed(true); return 'fait'; }
      catch (e) { return 'échec : ' + (e && e.message ? e.message : e); }
    });
    prgMarquer_(shD, cle, debut, vises, etats);
    SpreadsheetApp.flush();
  }
  return rendu;
}
// La case « Mettre à la corbeille » de la ligne des mails : par passages de PRG_MAILS_PAR_PASSAGE mails lus
function prgPurgerMails_(sh, shD, cle, enCours, cochee, ctx, temps) {
  const props = PropertiesService.getScriptProperties();
  if (enCours && !cochee) { props.deleteProperty('PURGE_MAILS_SAUT'); prgFinir_(sh, shD, cle, 'Arrêtée : la case a été décochée pendant la purge.'); return; }
  const refuser = raison => {
    props.deleteProperty('PURGE_MAILS_SAUT');
    if (enCours) { prgFinir_(sh, shD, cle, 'Arrêtée avant la fin : ' + raison); return; }
    const c = {};
    c[COL_P.corbeille] = false; c[COL_P.possible] = 'non'; c[COL_P.pourquoi] = raison; c[COL_P.etat] = PRG_ETAT.impossible;
    c[COL_P.message] = 'Refusé le ' + texteDate_(maintenant_()) + ' : les conditions ne sont plus réunies. Rien n’a été mis à la corbeille.';
    prgEcrire_(sh, cle, c);
  };
  const bloque = prgMailsBloque_(ctx);
  if (bloque) { refuser(bloque.charAt(0).toUpperCase() + bloque.slice(1) + '.'); return; }
  if (!enCours) { prgRanger_(shD, cle); props.deleteProperty('PURGE_MAILS_SAUT'); }
  // Les mails lus et non visés restent dans la recherche : « saut » dit combien en passer au passage suivant
  const saut = Math.max(0, Number(props.getProperty('PURGE_MAILS_SAUT')) || 0);
  const regles = prgMailsRegles_(temps.depasse), liste = prgMailsListe_(regles, saut + PRG_MAILS_PAR_PASSAGE + 1);
  const ids = liste.ids.slice(saut, saut + PRG_MAILS_PAR_PASSAGE), encore = liste.plus || liste.ids.length > saut + PRG_MAILS_PAR_PASSAGE;
  if (!enCours && !ids.length) { refuser('Aucun mail de fiche de chantier de plus de ' + regles.jours + ' jours à mettre à la corbeille.'); return; }
  const c = {};
  c[COL_P.etat] = PRG_ETAT.enCours; c[COL_P.message] = 'Mise à la corbeille en cours depuis le ' + texteDate_(maintenant_()) + '.';
  prgEcrire_(sh, cle, c);
  SpreadsheetApp.flush();
  const r = prgExecuterMails_(shD, cle, ids, regles, ctx, temps.depassePurge);
  if (r.coupe || encore) {
    props.setProperty('PURGE_MAILS_SAUT', String(saut + r.refuses));
    prgEnCours_(sh, shD, cle, temps.epuise() ? PRG_SUITE_DEMAIN : 'En cours : la suite au prochain passage (30 minutes au plus).');
    return;
  }
  props.deleteProperty('PURGE_MAILS_SAUT');
  prgFinir_(sh, shD, cle, '');
}

// ── Installation du lot 5 (une fonction par environnement ; relançable sans danger) ──
function etapesLot5_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const etape = (nom, bons, creer) => ({
    nom: 'Onglet « ' + nom + ' »',
    fait: () => { const sh = ss.getSheetByName(nom); return !!sh && bons(sh); },
    action: () => {
      // Onglet déjà là avec d'autres titres : jamais rien réécrire par-dessus
      if (ss.getSheetByName(nom)) throw new Error('un onglet « ' + nom + ' » existe déjà avec d’autres titres : le renommer, puis relancer');
      creer();
      return 'onglet créé';
    } });
  return [
    etape(SHEET_STOCKAGE, stkTitresBons_, stkCreerOnglet_),
    etape(SHEET_PURGES, sh => noteTitresBons_(sh, PRG_ENTETES), feuillePurges_),
    etape(SHEET_PURGES_DETAIL, sh => noteTitresBons_(sh, PRG_DETAIL_ENTETES), feuillePurgesDetail_),
    // Sur TEST, les déclencheurs ne sont posés que pendant les essais (quota partagé avec la production)
    { nom: 'Déclencheurs ' + DECLENCHEURS.join(', ') + ' (installerDeclencheurs)', seulement: 'PRODUCTION',
      fait: () => { const p = ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction()); return DECLENCHEURS.every(d => p.indexOf(d) > -1); },
      action: () => installerDeclencheurs() },
  ];
}
// Informations utiles à Franck (jamais bloquantes)
function infosLot5_() {
  const place = placeCompte_();
  return ['Place du compte : ' + stkPlaceTexte_(place) + ' — chiffre lu par : ' + place.source + '.',
    place.source === 'DriveApp' ? 'Service avancé Drive : non activé. Compare ce chiffre avec celui de one.google.com/storage : s’ils diffèrent, active-le (docs/lot5-procedure.md).'
      : 'Service avancé Drive : activé (total du compte, part de Drive et de la corbeille).',
    'Première mesure : dans la nuit, ou tout de suite en lançant mesurerStockage (à relancer tant que le journal dit « À suivre »).',
    'Service avancé Gmail (pour la ligne « ' + PRG_QUOI.mails + ' ») : ' + (prgGmailPresent_() ? 'présent.' : 'ABSENT — dans l’éditeur : « Services » (le +) → « Gmail API » → Ajouter.'),
    'Rien n’est jamais mis à la corbeille sans une case cochée dans l’onglet « ' + SHEET_PURGES + ' ».'].join('\n');
}
function installerLot5_(attendu) {
  const r = installer_('Lot 5', attendu, etapesLot5_());
  let infos = '';
  if (r.ok) { try { infos = '\n' + infosLot5_(); } catch (e) { infos = '\n(informations indisponibles : ' + e.message + ')'; } Logger.log(infos); }
  return r.texte + infos;
}
function installerLot5Test() { return installerLot5_('TEST'); }
function installerLot5Production() { return installerLot5_('PRODUCTION'); }
