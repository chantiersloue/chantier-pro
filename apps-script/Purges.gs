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
const PRG_MOIS_TERMINE = 6;                 // « Terminé » depuis au moins 6 mois
const PRG_RELEVE_PROPOSITION_JOURS = 30;    // âge maximal du relevé pour PROPOSER la purge
const PRG_RELEVE_PURGE_JOURS = 7;           // … et au moment où la case est traitée
const PRG_ANNULATION_JOURS = 25;            // la case « Annuler » sert 25 jours
const PRG_CORBEILLE_JOURS = 30;             // Drive vide sa corbeille au bout de 30 jours : la place est libérée à ce moment-là
const PRG_PAQUET = 40;                      // éléments journalisés puis mis à la corbeille par paquet
const PRG_VERROU_MS = 7 * 60 * 1000;
const PRG_JOUR_MS = 24 * 3600 * 1000;
const PRG_QUOI = { indices: 'Anciens indices du carnet', termine: 'Chantier terminé' };
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
const PRG_AVANT_DE_COCHER = 'Avant de cocher : vérifiez sur le PC que MEGA a fini de synchroniser le dossier du chantier, et relancez le programme du PC si le relevé a plus de '
  + PRG_RELEVE_PURGE_JOURS + ' jours.';

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
function prgEcrire_(sh, cle, cellules) {
  const ligne = prgLigne_(sh, cle);
  if (!ligne) return false;
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
  return { racineId: driveRootId_(), planningId: planning, chantiers: chantiers || stkChantiers_(), lignesDossiers: stkLignesDossiers_(),
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
  if (c.lignes > 1) return non('deux lignes portent ce nom dans l’onglet Chantiers : corrigez-le');
  const lignes = ctx.lignesDossiers.filter(l => l.cle === c.cle && l.id);
  if (!lignes.length) return non('le dossier de ce chantier n’est pas noté dans l’onglet « ' + SHEET_DOSSIERS + ' » (il n’est jamais pris par ressemblance de nom) : ajoutez-y une ligne avec son identifiant');
  const ids = lignes.map(l => l.id).filter((x, i, t) => t.indexOf(x) === i);
  if (ids.length > 1) return non('plusieurs dossiers sont notés pour ce chantier dans « ' + SHEET_DOSSIERS + ' » : n’en gardez qu’un');
  if (lignes.some(l => l.aVerifier)) return non('la ligne de ce chantier dans « ' + SHEET_DOSSIERS + ' » porte la mention « À vérifier » : vérifiez que c’est le bon dossier, puis effacez cette mention');
  const autres = ctx.lignesDossiers.filter(l => l.id === ids[0] && l.cle !== c.cle);
  if (autres.length) return non('le même dossier est noté pour un autre chantier (« ' + autres[0].chantier + ' ») dans « ' + SHEET_DOSSIERS + ' »');
  let d;
  try { d = DriveApp.getFolderById(ids[0]); } catch (e) { return non('le dossier noté dans « ' + SHEET_DOSSIERS + ' » est introuvable dans Drive'); }
  if (d.isTrashed()) return non('le dossier du chantier est à la corbeille');
  if (ids[0] === ctx.racineId || ids[0] === ctx.planningId || estDossierTechnique_(d)) return non('le dossier noté dans « ' + SHEET_DOSSIERS + ' » n’est pas un dossier de chantier');
  if (!prgDescendDe_(d, ctx.racineId, ctx.sousRacine)) return non('le dossier du chantier n’est pas dans le Drive de cet environnement');
  return { ok: true, dossier: d, id: ids[0] };
}

// §4.3-1 — « Terminé » depuis au moins 6 mois : '' si c'est le cas, sinon ce qui manque
function prgTermineDepuis_(c) {
  if (!c || c.statut !== STATUTS_CHANTIER[2]) return 'le chantier n’est pas au statut « Terminé »';
  if (c.termine === null) return 'pas de date « Terminé » dans l’onglet Chantiers (elle se pose toute seule à la prochaine mesure, puis il faut attendre ' + PRG_MOIS_TERMINE + ' mois)';
  if (isNaN(c.termine)) return 'date « Terminé » illisible dans l’onglet Chantiers : écrivez-la sous la forme 31/12/2026';
  const maintenant = maintenant_();
  if (c.termine > maintenant) return 'date « Terminé » dans le futur (' + stkJour_(c.termine) + ') : elle est ignorée, corrigez-la';
  const possible = new Date(c.termine);
  possible.setMonth(possible.getMonth() + PRG_MOIS_TERMINE);
  if (possible.getTime() > maintenant) return 'terminé depuis le ' + stkJour_(c.termine) + ' : purge possible à partir du ' + stkJour_(possible.getTime()) + ' (' + PRG_MOIS_TERMINE + ' mois)';
  return '';
}

// §4.3-2 — Le relevé releve-pc.json : ce qui est dans le dossier du chantier sur le PC (format : docs/contrat-skills.md) à la racine du dossier du chantier.
// Rend { ok, raison, lignes: { '/chemin': [tailles] }, date }.
function prgReleve_(dossier, c, joursMax) {
  const non = raison => ({ ok: false, raison: raison });
  const relancer = ' : relancez le programme du PC, puis attendez la prochaine mesure';
  const it = dossier.getFilesByName(PRG_RELEVE), trouves = [];
  while (it.hasNext()) { const f = it.next(); if (!f.isTrashed()) trouves.push(f); }
  if (!trouves.length) return non('pas de relevé « ' + PRG_RELEVE + ' » dans le dossier du chantier' + relancer);
  if (trouves.length > 1) return non('deux relevés « ' + PRG_RELEVE + ' » dans le dossier du chantier : supprimez le plus ancien' + relancer);
  let lu;
  try { lu = JSON.parse(trouves[0].getBlob().getDataAsString('UTF-8')); } catch (e) { return non('relevé « ' + PRG_RELEVE + ' » illisible' + relancer); }
  if (!lu || typeof lu !== 'object' || Number(lu.version) !== 1 || !Array.isArray(lu.fichiers)) return non('relevé « ' + PRG_RELEVE + ' » d’un format inconnu' + relancer);
  if (typeof lu.chantier !== 'string' || cleChantier_(stkNfc_(lu.chantier)) !== cleChantier_(stkNfc_(c.nom))) {
    return non('le relevé « ' + PRG_RELEVE + ' » est celui d’un autre chantier (« ' + String(lu.chantier).slice(0, 80) + ' ») : rien n’est proposé');
  }
  const date = typeof lu.releve_le === 'string' ? Date.parse(lu.releve_le) : NaN;
  if (isNaN(date)) return non('date du relevé illisible' + relancer);
  const maintenant = maintenant_();
  if (date > maintenant + 3600 * 1000) return non('relevé daté du futur (' + stkJour_(date) + ') : vérifiez l’horloge du PC' + relancer);
  if (maintenant - date > joursMax * PRG_JOUR_MS) return non('relevé du ' + stkJour_(date) + ' : il a plus de ' + joursMax + ' jours' + relancer);
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
// Rend { existe, erreur, dossier, id, maj, json, anciens: [dossiers que plus aucun document montré ne désigne],
//        tous: [dossiers connus de carnet.json], laisses: [textes] }.
// Un dossier inconnu de carnet.json (dépôt en cours, posé à la main), mal décrit, ou en double : jamais rendu.
function prgCarnet_(dossierChantier, c, ctx) {
  const r = { existe: false, erreur: '', dossier: null, id: '', maj: 0, json: null, anciens: [], tous: [], laisses: [] };
  const carnets = sousDossiersParChemin_(dossierChantier, ctx.carnetChemin);
  if (!carnets.length) return r;
  r.existe = true;
  if (carnets.length > 1) { r.erreur = 'deux dossiers « ' + ctx.carnetChemin + ' » dans ce chantier : le carnet n’est pas touché'; return r; }
  r.dossier = carnets[0]; r.id = r.dossier.getId();
  cacheScript_().remove('carnet:liste:1:' + r.id + ':n');   // jamais la liste gardée 10 minutes : relue dans Drive
  let lu, montres;
  try { lu = carnetListe_(r.dossier); montres = carnetDocuments_(lu.liste, c.nom, dossierChantier.getName()); }
  catch (e) { if (!e || !e.carnet) throw e; r.erreur = 'carnet : ' + e.message; return r; }
  if (lu.doublon) { r.erreur = 'deux listes « ' + CARNET_FICHIER + ' » dans le carnet : supprimez la plus ancienne'; return r; }
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
    else { r.tous.push(x); if (!montresParNom[cle]) r.anciens.push(x); }
  });
  return r;
}
function prgElementsCarnet_(dossiers, ctx, depasse, r) {
  const aucun = { carnet: '', photos: '', fiches: [] };
  dossiers.forEach(x => {
    const p = stkInventaire_(x.api, aucun, depasse, false);
    if (!p.complet && r.raisons.indexOf(PRG_TROP_GROS) < 0) r.raisons.push(PRG_TROP_GROS);
    r.items.push({ type: 'dossier', id: x.id, chemin: ctx.cats.carnet + '/' + x.nom, taille: p.total, fichiers: p.fichiers });
    r.octets += p.total; r.nb += p.fichiers;
  });
}
const PRG_TROP_GROS = 'dossier trop gros pour être lu en un passage : rien n’est proposé';
function prgLaisses_(car) {
  return car.laisses.length ? car.laisses.length + ' dossier(s) du carnet laissé(s) en place : ' + stkCourt_(car.laisses) : '';
}

// Garde appelée juste avant CHAQUE mise à la corbeille : '' si elle est permise, sinon la raison du refus
function prgGarde_(dossierChantier, ctx, carnet) {
  const cache = {}, idChantier = dossierChantier.getId(), idCarnet = carnet ? carnet.getId() : '';
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
    if (item.liste) {
      // carnet.json en dernier, et seulement s'il ne reste plus aucun dossier dans le carnet
      const it = carnet.getFolders();
      while (it.hasNext()) if (!it.next().isTrashed()) return 'des dossiers du carnet sont restés en place : la liste est gardée';
    }
    if (!prgDescendDe_(api, idChantier, cache)) return 'hors du dossier du chantier';
    // « descend de la racine de cet environnement » (la copie TEST et la production sont dans le même compte)
    if (ctx.env || !prgDescendDe_(dossierChantier, ctx.racineId, {})) return 'hors du Drive de cet environnement';
    return '';
  };
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
function prgExaminerTermine_(c, ctx, joursReleve, depasse, inv, dossierMesure) {
  const r = { possible: false, raisons: [], infos: [], items: [], octets: 0, nb: 0, dossierId: '', garde: null, carnet: null };
  const quand = prgTermineDepuis_(c);
  if (quand) r.raisons.push(quand);
  const ident = prgDossierSur_(c, ctx);
  if (!ident.ok) { r.raisons.push(ident.raison); return r; }   // sans dossier sûr, rien d'autre n'est lu
  r.dossierId = ident.id;
  const attente = prgEnvoisEnAttente_(c);
  if (attente) r.raisons.push(attente + ' envoi(s) en attente ou abandonné(s) pour ce chantier (onglet « ' + SHEET_ATTENTE + ' ») : attendez qu’ils partent, ou réglez-les');
  const releve = prgReleve_(ident.dossier, c, joursReleve);
  if (!releve.ok) r.raisons.push(releve.raison);
  if (!inv || !dossierMesure || dossierMesure.getId() !== ident.id) inv = stkInventaire_(ident.dossier, ctx.cats, depasse, true);
  if (!inv.complet) r.raisons.push(PRG_TROP_GROS);
  if (releve.ok) {
    const cmp = prgComparer_(inv.liste, releve), exemples = t => stkCourt_(t.slice(0, 3).map(x => '« ' + x + ' »')) + (t.length > 3 ? '…' : '');
    if (cmp.doublons.length) r.raisons.push('deux fichiers de même nom dans un dossier du Drive (' + exemples(cmp.doublons) + ') : renommez-en un, relancez le programme du PC, puis attendez la prochaine mesure');
    if (cmp.absents.length) r.raisons.push(cmp.absents.length + ' fiche(s) ou photo(s) absente(s) du relevé (' + exemples(cmp.absents) + ') : relancez le programme du PC, puis attendez la prochaine mesure');
    if (cmp.tailles.length) r.raisons.push(cmp.tailles.length + ' fichier(s) dont la taille n’est pas celle du relevé (' + exemples(cmp.tailles) + ') : relancez le programme du PC, puis attendez la prochaine mesure');
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
function prgExaminer_(nature, c, ctx, jours, depasse, inv, dossierMesure) {
  return nature === 'termine' ? prgExaminerTermine_(c, ctx, jours, depasse, inv, dossierMesure) : prgExaminerIndices_(c, ctx, depasse, dossierMesure);
}
function prgPourquoi_(nature, exam) {
  const phrase = t => t.charAt(0).toUpperCase() + t.slice(1);
  if (exam.possible) {
    return ['Possible : ' + exam.items.length + ' élément(s), ' + exam.nb + ' fichier(s).'].concat(exam.infos.map(x => phrase(x) + '.'))
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
  if (exI.carnet && exI.carnet.existe && !exI.carnet.erreur) {
    rendu.depot = exI.carnet.maj ? new Date(exI.carnet.maj) : '';
    rendu.indices = exI.items.length; rendu.indicesMo = stkMo_(exI.octets);
  }
  textes.push(prgProposer_(sh, 'indices', c, u.id, exI, exI.items.length > 0));
  const termine = c.statut === STATUTS_CHANTIER[2];
  const active = prgActive_(prgLignes_(sh), prgCleBase_('termine', c, u.id));
  if (termine || (active && !prgEstFait_(active.r[COL_P.etat - 1]))) {
    textes.push(prgProposer_(sh, 'termine', c, u.id, prgExaminerTermine_(c, ctx, PRG_RELEVE_PROPOSITION_JOURS, depasse, inv, u.dossier), termine));
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
// Écrit la proposition : une nouvelle ligne si la base n'en a pas (ou si la précédente est « Fait » et qu'il y a de nouveau
// quelque chose), sinon ses cellules de proposition sont mises à jour. Les cases, les dates d'une purge faite, les lignes
// en cours : jamais touchées. creer : faut-il une ligne s'il n'y en a pas ?
function prgProposer_(sh, nature, c, idDossier, exam, creer) {
  const base = prgCleBase_(nature, c, idDossier), active = prgActive_(prgLignes_(sh), base);
  const etat = active ? String(active.r[COL_P.etat - 1]) : '', court = nature === 'termine' ? 'chantier terminé' : 'anciens indices';
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
    const cle = base + '|' + (active ? active.n + 1 : 1), ligne = sh.getLastRow() + 1;
    stkAssurerLignes_(sh, ligne);
    PRG_COLONNES_TEXTE.forEach(col => sh.getRange(ligne, col).setNumberFormat('@'));
    sh.getRange(ligne, COL_P.corbeille).insertCheckboxes(); sh.getRange(ligne, COL_P.annuler).insertCheckboxes();
    const valeurs = PRG_ENTETES.map((t, i) => cellules[i + 1] === undefined ? '' : cellules[i + 1]);
    valeurs[COL_P.corbeille - 1] = false; valeurs[COL_P.annuler - 1] = false;
    valeurs[COL_P.maj - 1] = new Date(maintenant_()); valeurs[COL_P.cle - 1] = cle;
    sh.getRange(ligne, 1, 1, PRG_ENTETES.length).setValues([valeurs.map(cellule_)]);
  } else prgEcrire_(sh, active.cle, cellules);
  return court + (exam.possible ? ' : purge possible (onglet « ' + SHEET_PURGES + ' »)' : ' : purge impossible pour l’instant (onglet « ' + SHEET_PURGES + ' »)');
}

// ── Journal « Purges détail » ──
function prgElement_(type, id) { return type === 'dossier' ? DriveApp.getFolderById(id) : DriveApp.getFileById(id); }
function prgDetail_(shD) {
  const derniere = shD.getLastRow();
  return derniere < 2 ? [] : shD.getRange(2, 1, derniere - 1, PRG_DETAIL_ENTETES.length).getValues().map((r, i) => ({ ligne: i + 2, r: r }));
}
function prgEcrireDetail_(shD, ligne, etat) { shD.getRange(ligne, COL_D.etat, 1, 2).setValues([[cellule_(etat), new Date(maintenant_())]]); }
// Ce que la ligne a réellement mis à la corbeille (d'après le journal)
function prgTotaux_(shD, cle) {
  const t = { elements: 0, fichiers: 0, octets: 0, autres: 0 };
  prgDetail_(shD).forEach(x => {
    if (String(x.r[COL_D.cle - 1]) !== cle) return;
    const etat = String(x.r[COL_D.etat - 1]);
    if (etat === 'fait') { t.elements++; t.fichiers += Number(x.r[COL_D.fichiers - 1]) || 0; t.octets += Number(x.r[COL_D.taille - 1]) || 0; }
    else if (/^(refusé|échec|non fait)/.test(etat)) t.autres++;
  });
  return t;
}
// Le journal d'ABORD : chaque paquet est écrit « à faire » (et réellement enregistré : flush) avant sa première mise à la
// corbeille ; puis chaque élément est marqué « fait », « refusé : … » ou « échec : … ». Rend false si le temps a manqué.
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
    const etats = paquet.map(x => {
      try {
        const api = prgElement_(x.type, x.id), refus = garde(api, x);
        if (refus) return 'refusé : ' + refus;
        api.setTrashed(true);      // la corbeille de Drive, jamais une suppression définitive
        return 'fait';
      } catch (e) { return 'échec : ' + (e && e.message ? e.message : e); }
    });
    prgMarquer_(shD, cle, debut, paquet, etats);
    SpreadsheetApp.flush();
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
// Reprise après une exécution coupée : une ligne restée « à faire » dit si son élément est parti à la corbeille ou non
function prgReprendre_(shD, cle) {
  prgDetail_(shD).forEach(x => {
    if (String(x.r[COL_D.cle - 1]) !== cle || String(x.r[COL_D.etat - 1]) !== 'à faire') return;
    let etat;
    try { etat = prgElement_(String(x.r[COL_D.type - 1]), String(x.r[COL_D.id - 1])).isTrashed() ? 'fait' : 'non fait (exécution coupée)'; }
    catch (e) { etat = 'introuvable (exécution coupée)'; }
    prgEcrireDetail_(shD, x.ligne, etat);
  });
}

// ── Verrou de la purge : une propriété datée, JAMAIS le verrou du script (celui des fiches) ──
function prgPrendre_() {
  const props = PropertiesService.getScriptProperties(), depuis = Number(props.getProperty('PURGE_EN_COURS') || 0);
  if (depuis && Math.abs(Date.now() - depuis) < PRG_VERROU_MS) return false;   // au-delà de 7 min : exécution morte, on reprend
  props.setProperty('PURGE_EN_COURS', String(Date.now()));
  return true;
}
function prgRendre_() { PropertiesService.getScriptProperties().deleteProperty('PURGE_EN_COURS'); }

// ── Le traitement des cases (déclencheur dédié, toutes les 30 minutes) ──
function traiterPurges() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PURGES);
  if (!sh || sh.getLastRow() < 2) return 'rien';
  if (!noteTitresBons_(sh, PRG_ENTETES)) { stkAlerteOnglet_(SHEET_PURGES); return 'onglet modifié'; }
  // Rien à faire (aucune case cochée, aucune purge à reprendre, aucun mail à renvoyer) : on sort tout de suite
  const aFaire = prgLignes_(sh).filter(x => x.r[COL_P.corbeille - 1] === true || x.r[COL_P.annuler - 1] === true
    || prgEstOccupe_(x.r[COL_P.etat - 1]) || String(x.r[COL_P.etat - 1]) === PRG_ETAT.mail).map(x => String(x.r[COL_P.cle - 1]));
  if (!aFaire.length) return 'rien';
  if (!prgPrendre_()) return 'occupé';
  const debut = chronoMs_(), depasse = () => chronoMs_() - debut > STK_DUREE_MAX_MS;
  let traitees = 0;
  try {
    let shD;
    try { shD = feuillePurgesDetail_(); } catch (e) { return 'onglet modifié'; }   // sans journal, aucune mise à la corbeille
    const ctx = prgContexte_();
    for (let i = 0; i < aFaire.length; i++) {
      if (depasse()) break;
      try { prgTraiterLigne_(sh, shD, aFaire[i], ctx, depasse); }
      catch (e) {
        console.error('traiterPurges :', e && e.message);
        prgArreter_(sh, shD, aFaire[i], 'Erreur le ' + texteDate_(maintenant_()) + ' : ' + (e && e.message ? e.message : e) + '.');
      }
      traitees++;
    }
  } finally { prgRendre_(); }
  return traitees + ' ligne(s) traitée(s)';
}

function prgTraiterLigne_(sh, shD, cle, ctx, depasse) {
  const ligne = prgLigne_(sh, cle);
  if (!ligne) return;
  const r = sh.getRange(ligne, 1, 1, PRG_ENTETES.length).getValues()[0];
  const corbeille = r[COL_P.corbeille - 1] === true, annuler = r[COL_P.annuler - 1] === true, etat = String(r[COL_P.etat - 1]);
  const enCours = /^en cours/i.test(etat), annulation = /^annulation en cours/i.test(etat), fait = prgEstFait_(etat);
  const dire = (message, autres) => { const c = autres || {}; c[COL_P.message] = message; prgEcrire_(sh, cle, c); };
  const decocher = () => { const c = {}; c[COL_P.corbeille] = false; c[COL_P.annuler] = false; return c; };
  if (corbeille && annuler && !enCours && !annulation) {
    dire('Les deux cases étaient cochées : rien n’a été fait, et elles ont été décochées. Cochez-en une seule.', decocher());
    return;
  }
  if (annulation || (annuler && !enCours)) {
    if (!fait && !annulation) { dire('Rien à annuler sur cette ligne : rien n’a été mis à la corbeille.', decocher()); return; }
    prgAnnuler_(sh, shD, cle, r, annulation, depasse);
    return;
  }
  if (corbeille || enCours) {
    if (fait) { dire('Déjà fait : rien de plus n’a été mis à la corbeille. S’il reste des fichiers, une nouvelle ligne sera proposée à la prochaine mesure.', decocher()); return; }
    prgPurger_(sh, shD, cle, r, enCours, corbeille, ctx, depasse);
    return;
  }
  if (etat === PRG_ETAT.mail) prgMailPurge_(sh, shD, cle, r);   // le mail d'une purge faite n'était pas parti : nouvel essai
}

// Une case « Mettre à la corbeille » : tout est REVÉRIFIÉ, puis journal, puis corbeille
function prgPurger_(sh, shD, cle, r, enCours, cochee, ctx, depasse) {
  const k = prgLireCle_(cle), c = k ? ctx.chantiers[k.chantier] : null;
  if (enCours) prgReprendre_(shD, cle);
  if (enCours && !cochee) { prgFinir_(sh, shD, cle, r, 'Arrêtée : la case a été décochée pendant la purge.'); return; }
  let refus = '', exam = null;
  if (!k || !c) refus = 'Ce chantier n’est plus dans l’onglet Chantiers.';
  else {
    exam = prgExaminer_(k.nature, c, ctx, PRG_RELEVE_PURGE_JOURS, depasse, null, null);
    if (exam.dossierId && exam.dossierId !== k.dossier) refus = 'Le dossier du chantier n’est plus celui de cette ligne.';
    else if (!exam.possible) refus = prgPourquoi_(k.nature, exam);
  }
  if (refus) {
    if (enCours) { prgFinir_(sh, shD, cle, r, 'Arrêtée avant la fin : ' + refus); return; }
    const cellules = {};
    cellules[COL_P.corbeille] = false; cellules[COL_P.possible] = 'non'; cellules[COL_P.pourquoi] = refus; cellules[COL_P.etat] = PRG_ETAT.impossible;
    cellules[COL_P.message] = 'Refusé le ' + texteDate_(maintenant_()) + ' : les conditions ne sont plus réunies. Rien n’a été mis à la corbeille.';
    prgEcrire_(sh, cle, cellules);
    return;
  }
  const cellules = {};
  cellules[COL_P.etat] = PRG_ETAT.enCours; cellules[COL_P.message] = 'Mise à la corbeille en cours depuis le ' + texteDate_(maintenant_()) + '.';
  prgEcrire_(sh, cle, cellules);
  SpreadsheetApp.flush();
  const fini = prgExecuter_(shD, cle, exam.items, exam.garde, depasse);
  if (exam.carnet && exam.carnet.id) cacheScript_().remove('carnet:liste:1:' + exam.carnet.id + ':n');   // les téléphones relisent le carnet
  if (!fini) { const m = {}; m[COL_P.message] = 'En cours : la suite au prochain passage (30 minutes au plus).'; prgEcrire_(sh, cle, m); return; }
  prgFinir_(sh, shD, cle, r, '');
}
// Fin d'une purge (complète, ou arrêtée) : la ligne dit ce qui a été fait d'après le journal, et le mail part
function prgFinir_(sh, shD, cle, r, remarque) {
  const t = prgTotaux_(shD, cle), maintenant = maintenant_(), cellules = {};
  cellules[COL_P.corbeille] = false;
  if (!t.elements) {
    cellules[COL_P.etat] = PRG_ETAT.impossible;
    cellules[COL_P.message] = [remarque, 'Rien n’a été mis à la corbeille' + (t.autres ? ' (' + t.autres + ' élément(s) refusé(s) ou en échec : voir « ' + SHEET_PURGES_DETAIL + ' »).' : '.')].filter(Boolean).join(' ');
    prgEcrire_(sh, cle, cellules);
    return;
  }
  cellules[COL_P.etat] = PRG_ETAT.mail;
  cellules[COL_P.faitLe] = new Date(maintenant); cellules[COL_P.nbFaits] = t.fichiers;
  cellules[COL_P.libere] = new Date(maintenant + PRG_CORBEILLE_JOURS * PRG_JOUR_MS);
  cellules[COL_P.jusquau] = new Date(maintenant + PRG_ANNULATION_JOURS * PRG_JOUR_MS);
  cellules[COL_P.message] = [remarque, t.fichiers + ' fichier(s) à la corbeille (' + stkMo_(t.octets) + ' Mo)'
    + (t.autres ? ' ; ' + t.autres + ' élément(s) laissé(s) en place (voir « ' + SHEET_PURGES_DETAIL + ' »)' : '') + '. Pour annuler : cochez « Annuler » avant le '
    + stkJour_(maintenant + PRG_ANNULATION_JOURS * PRG_JOUR_MS) + '.'].filter(Boolean).join(' ');
  prgEcrire_(sh, cle, cellules);
  prgMailPurge_(sh, shD, cle, r);
}
// Un mail à Franck à chaque mise à la corbeille ; s'il ne part pas, la ligne reste « Fait (mail à envoyer) » et il repartira
function prgMailPurge_(sh, shD, cle, r) {
  const ligne = prgLigne_(sh, cle);
  if (!ligne) return;
  const v = sh.getRange(ligne, 1, 1, PRG_ENTETES.length).getValues()[0], t = prgTotaux_(shD, cle);
  const date = d => stkEstDate_(d) ? stkJour_(d.getTime()) : '?';
  const chantier = String(v[COL_P.chantier - 1] || r[COL_P.chantier - 1]), quoi = String(v[COL_P.quoi - 1] || r[COL_P.quoi - 1]);
  const texte = ['Vous avez coché « Mettre à la corbeille » dans l’onglet « ' + SHEET_PURGES + ' » du Sheet.', '',
    'Chantier : ' + chantier, 'Quoi : ' + quoi,
    'Mis à la corbeille de Drive le ' + date(v[COL_P.faitLe - 1]) + ' : ' + t.fichiers + ' fichier(s), ' + stkMo_(t.octets) + ' Mo'
      + (t.autres ? ' (' + t.autres + ' élément(s) laissé(s) en place : voir l’onglet « ' + SHEET_PURGES_DETAIL + ' »)' : '') + '.', '',
    'Rien n’est supprimé définitivement : tout est dans la corbeille de Drive, et la liste exacte est dans l’onglet « ' + SHEET_PURGES_DETAIL + ' ».',
    'La place sera vraiment libérée le ' + date(v[COL_P.libere - 1]) + ' (la corbeille compte dans les 15 Go pendant ' + PRG_CORBEILLE_JOURS + ' jours).', '',
    'POUR ANNULER : dans l’onglet « ' + SHEET_PURGES + ' », cochez la case « Annuler » de cette ligne avant le ' + date(v[COL_P.jusquau - 1])
      + '. Tout ressort de la corbeille dans la demi-heure.',
    'Passé cette date et jusqu’au ' + date(v[COL_P.libere - 1]) + ', c’est encore possible à la main dans la corbeille de Drive.', '',
    'Si MEGA n’avait pas fini de synchroniser le dossier du chantier sur le PC, annulez, laissez MEGA finir, puis recommencez.'].join('\n');
  const cellules = {};
  cellules[COL_P.etat] = stkMail_('[Loué App] Mise à la corbeille — ' + chantier + ' — ' + quoi, texte) ? PRG_ETAT.fait : PRG_ETAT.mail;
  prgEcrire_(sh, cle, cellules);
}
// Une erreur inattendue pendant le traitement d'une ligne : la ligne le dit, les cases sont décochées (pas de nouvel essai
// toutes les 30 minutes), et ce qui est déjà parti à la corbeille reste annulable
function prgArreter_(sh, shD, cle, message) {
  try {
    const ligne = prgLigne_(sh, cle);
    if (!ligne) return;
    const r = sh.getRange(ligne, 1, 1, PRG_ENTETES.length).getValues()[0], etat = String(r[COL_P.etat - 1]);
    if (/^en cours/i.test(etat)) { prgReprendre_(shD, cle); prgFinir_(sh, shD, cle, r, message); return; }
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
  // Bilan d'après le journal : ce qui est revenu, ce qui n'a pas pu revenir
  let remis = 0, perdus = 0;
  prgDetail_(shD).forEach(x => {
    if (String(x.r[COL_D.cle - 1]) !== cle) return;
    const etat = String(x.r[COL_D.etat - 1]), n = Number(x.r[COL_D.fichiers - 1]) || 1;
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
  prgEcrire_(sh, cle, cellules);
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
    place.source === 'DriveApp' ? 'Service avancé Drive : non activé. Comparez ce chiffre avec celui de one.google.com/storage : s’ils diffèrent, activez-le (docs/lot5-procedure.md).'
      : 'Service avancé Drive : activé (total du compte, part de Drive et de la corbeille).',
    'Première mesure : dans la nuit, ou tout de suite en lançant mesurerStockage (à relancer tant que le journal dit « À suivre »).',
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
