// ══════════════════════════════════════════════════════════
// RANGEMENT DRIVE (lot 1.5)
// - Un seul endroit pour les noms de dossiers : le fichier « dossiers.json » à la racine du Drive de l'appli
//   (créé automatiquement avec les valeurs ci-dessous ; Franck peut le modifier, il est relu au bout de 10 min).
// - Le dossier de chaque chantier est retenu dans l'onglet « Dossiers chantiers » (nom du chantier → identifiant Drive).
//   Plus de recherche « approximative » silencieuse : une ressemblance n'est utilisée que si elle est unique,
//   et elle est notée « à vérifier » dans cet onglet.
// - Migration des documents déjà produits par l'appli : planMigration() (ne déplace rien) puis executerMigration().
// ══════════════════════════════════════════════════════════
const SHEET_DOSSIERS = 'Dossiers chantiers';
const SHEET_MIGRATION = 'Migration (lot 1)';
const NOM_FICHIER_DOSSIERS = 'dossiers.json';
const DOSSIER_A_CLASSER = '_À CLASSER';   // lot 2 : documents d'un chantier inconnu (commence par « _ » : jamais pris pour un chantier)

const DOSSIERS_DEFAUT = {
  version: 1,
  aide: 'Noms des dossiers utilisés par Loué App (et plus tard par les skills). Séparateur « / ». ' +
        'Modifier seulement les noms entre guillemets à droite, puis attendre 10 minutes.',
  // Dans le dossier de chaque chantier
  documents: {
    'cotes':               '05 - CHANTIER/PRISE DE COTES',
    'fabrication':         '07 - ATELIER',
    'note':                '05 - CHANTIER/COMPTE RENDU',
    'quitus':              '05 - CHANTIER/OPR - RESERVES - QUITUS',
    'attestation':         '05 - CHANTIER/OPR - RESERVES - QUITUS',
    'reception-support':   '05 - CHANTIER/OPR - RESERVES - QUITUS',
    'bordereau-orga':      '05 - CHANTIER/ORGANIGRAMME',
    'bordereau-materiaux': '05 - CHANTIER/BORDEREAUX MATERIAUX',
    'photos':              '05 - CHANTIER/PHOTOS CHANTIER',
    'signalement':         '05 - CHANTIER/SIGNALEMENTS',
    'carnet':              'CARNET',
    'plans':               'Plans',   // ancien dossier des plans : plus lu ni créé par l'appli (lot 4b) ; sert à listerPartagesPlans()
  },
  // À la racine du Drive de l'appli (hors chantier)
  hors_chantier: {
    'absence': 'ADMINISTRATIF/ABSENCES',
  },
  // Début du nom des fichiers : « <INTITULÉ> <CHANTIER> <AAAA-MM-JJ>[_Vn].pdf »
  intitules: {
    'cotes': 'PRISE DE COTES', 'fabrication': 'FICHE FABRICATION', 'note': 'COMPTE RENDU',
    'quitus': 'QUITUS', 'attestation': 'ATTESTATION', 'reception-support': 'RECEPTION SUPPORT',
    'bordereau-orga': 'BORDEREAU ORGANIGRAMME', 'bordereau-materiaux': 'BORDEREAU MATERIAUX', 'absence': 'ABSENCE',
    'signalement': 'SIGNALEMENT',
  },
};

// Dossiers de la racine qui ne sont pas des chantiers
function estDossierTechnique_(dossier) {
  const nom = String(dossier.getName()).trim().toLowerCase();
  if (nom.charAt(0) === '_' || nom === 'dossier base' || nom === 'administratif') return true;
  try { return dossier.getId() === drivePlanningId_(); } catch (e) { return false; }
}

// ── dossiers.json : lu dans Drive (créé s'il manque), gardé 10 min en cache ──
function dossiers_() {
  const cache = CacheService.getScriptCache();
  const enCache = cache.get('dossiers.json');
  // Le cache est commun à tous les déploiements du projet : un ancien serveur encore en service peut y avoir rangé une
  // configuration SANS les clés ajoutées depuis (lot 7 : « signalement »). On complète donc toujours par les valeurs par défaut.
  if (enCache) {
    try {
      const c = JSON.parse(enCache);
      return { version: c.version || 1,
        documents: Object.assign({}, DOSSIERS_DEFAUT.documents, c.documents || {}),
        hors_chantier: Object.assign({}, DOSSIERS_DEFAUT.hors_chantier, c.hors_chantier || {}),
        intitules: Object.assign({}, DOSSIERS_DEFAUT.intitules, c.intitules || {}) };
    } catch (e) {}
  }
  let conf = DOSSIERS_DEFAUT;
  try {
    const racine = DriveApp.getFolderById(driveRootId_());
    const fichier = fichierDossiers_(racine);
    if (fichier) {
      const lu = JSON.parse(fichier.getBlob().getDataAsString());
      // Valeurs du fichier par-dessus les valeurs par défaut : une clé oubliée ne casse rien
      conf = {
        version: lu.version || 1,
        documents: cheminsSurs_(DOSSIERS_DEFAUT.documents, lu.documents),
        hors_chantier: cheminsSurs_(DOSSIERS_DEFAUT.hors_chantier, lu.hors_chantier),
        intitules: cheminsSurs_(DOSSIERS_DEFAUT.intitules, lu.intitules),
      };
    } else {
      racine.createFile(NOM_FICHIER_DOSSIERS, JSON.stringify(DOSSIERS_DEFAUT, null, 2), 'application/json');
    }
  } catch (err) {
    // Fichier illisible (virgule oubliée…) : on range avec les valeurs par défaut et on prévient Franck
    console.error('dossiers.json :', err.message);
    alerte_('Le fichier dossiers.json du Drive de l’appli est illisible (' + err.message +
      '). Les documents sont rangés avec les noms par défaut en attendant. Lancez verifierConfig() pour le détail.', 'dossiers');
  }
  try { cache.put('dossiers.json', JSON.stringify(conf), 600); } catch (e) {}
  return conf;
}

// dossiers.json de la racine (un fichier mis à la corbeille ne compte pas)
function fichierDossiers_(racine) {
  const it = racine.getFilesByName(NOM_FICHIER_DOSSIERS);
  while (it.hasNext()) { const f = it.next(); if (!f.isTrashed()) return f; }
  return null;
}
// Valeurs de Franck par-dessus les valeurs par défaut ; un nom vide ou contenant « .. » garde la valeur par défaut
function cheminsSurs_(defaut, lu) {
  const r = Object.assign({}, defaut);
  Object.keys(lu || {}).forEach(k => {
    const v = String(lu[k] == null ? '' : lu[k]).trim();
    if (v && v.split('/').every(m => m.trim() !== '..')) r[k] = v;
  });
  return r;
}

// Sous-dossier « A/B/C » (créé s'il manque quand creer = true)
function dossierParChemin_(parent, chemin, creer) {
  let d = parent;
  const morceaux = String(chemin || '').split('/').map(s => s.trim()).filter(Boolean);
  for (let i = 0; i < morceaux.length; i++) {
    const it = d.getFoldersByName(morceaux[i]);
    let trouve = null;
    while (it.hasNext()) { const x = it.next(); if (!x.isTrashed()) { trouve = x; break; } }
    if (!trouve) {
      if (!creer) return null;
      trouve = d.createFolder(morceaux[i]);
    }
    d = trouve;
  }
  return d;
}

// ── Dossier d'un chantier ──
function lignesDossiers_() {
  return feuille_(SHEET_DOSSIERS, ['Chantier', 'Dossier Drive', 'Identifiant du dossier', 'Trouvé par', 'À vérifier'])
    .getDataRange().getValues();
}
function cleChantier_(nom) { return String(nom || '').trim().toLowerCase(); }
function noterDossierChantier_(chantier, dossier, trouvePar) {
  const sh = feuille_(SHEET_DOSSIERS, ['Chantier', 'Dossier Drive', 'Identifiant du dossier', 'Trouvé par', 'À vérifier']);
  sh.appendRow([cellule_(String(chantier).trim()), cellule_(dossier.getName()), dossier.getId(), trouvePar,
    trouvePar === 'ressemblance' ? 'OUI — vérifiez que c’est le bon dossier' : '']);
}
// Ressemblance : le nom du dossier contient celui du chantier (ou l'inverse). Utilisée seulement si UNIQUE.
function ressemblances_(racine, nom) {
  const cle = cleChantier_(nom), trouves = [];
  const it = racine.getFolders();
  while (it.hasNext()) {
    const f = it.next();
    if (f.isTrashed() || estDossierTechnique_(f)) continue;
    const n = cleChantier_(f.getName());
    if (n && (n.indexOf(cle) > -1 || cle.indexOf(n) > -1)) trouves.push(f);
  }
  return trouves;
}
// creer = false : lecture seule (tuile Chantiers) ; renvoie null si rien
function dossierChantier_(chantierNom, creer) {
  const nom = String(chantierNom || '').trim() || 'DIVERS';
  const racine = DriveApp.getFolderById(driveRootId_());
  // 1. Onglet « Dossiers chantiers »
  const lignes = lignesDossiers_();
  for (let i = 1; i < lignes.length; i++) {
    if (cleChantier_(lignes[i][0]) !== cleChantier_(nom) || !lignes[i][2]) continue;
    try { const d = DriveApp.getFolderById(String(lignes[i][2])); if (!d.isTrashed()) return d; } catch (e) {}
  }
  // 2. Dossier portant exactement le nom du chantier
  const exacts = racine.getFoldersByName(nom);
  while (exacts.hasNext()) {
    const d = exacts.next();
    if (!d.isTrashed() && !estDossierTechnique_(d)) { if (creer) noterDossierChantier_(nom, d, 'nom exact'); return d; }
  }
  // 3. Une seule ressemblance : utilisée, mais notée « à vérifier »
  const proches = ressemblances_(racine, nom);
  if (proches.length === 1) { if (creer) noterDossierChantier_(nom, proches[0], 'ressemblance'); return proches[0]; }
  if (!creer) return null;
  // 4. Nouveau dossier (plusieurs ressemblances : on ne devine pas)
  // (plus de sous-dossier « Plans » créé d'office : les plans passent par le carnet, lot 4b)
  const d = racine.createFolder(nom);
  noterDossierChantier_(nom, d, proches.length ? 'créé (plusieurs dossiers ressemblants)' : 'créé');
  return d;
}

// ── Nom des fichiers : « <INTITULÉ> <CHANTIER>[ <complément>] <AAAA-MM-JJ>[_Vn].pdf » ──
function dateIso_(texte) {
  const m = String(texte || '').match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  const iso = String(texte || '').match(/(\d{4})-(\d{2})-(\d{2})/);
  return iso ? iso[0] : jour_();
}
function nomDocument_(type, chantier, complement, dateTexte) {
  const intitule = dossiers_().intitules[type] || String(type).toUpperCase();
  // Lot 2 (9a) : le « nom court » de l'onglet Chantiers (colonne F) s'il est rempli, sinon le nom du chantier
  const ligne = chantier ? ligneChantier_(chantier) : null;
  const court = ligne && ligne.length > 5 ? String(ligne[5] || '').trim() : '';
  const morceaux = [intitule, court || String(chantier || '').trim(), String(complement || '').trim(), dateIso_(dateTexte)].filter(Boolean);
  return nomFichier_(morceaux.join(' ').replace(/[\\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' '));
}
// Ne jamais écraser : « _V2 », « _V3 »… si le nom existe déjà dans le dossier
function nomLibre_(dossier, base) {
  let nom = base + '.pdf';
  for (let n = 2; dossier.getFilesByName(nom).hasNext() && n < 100; n++) nom = base + '_V' + n + '.pdf';
  return nom;
}

// ── Classement d'un document produit par l'appli ──
// type : clé de DOSSIERS_DEFAUT.documents (ou hors_chantier) ; blob : le PDF ; complement : série, précision…
// Renvoie le fichier créé (ou null : le classement ne doit jamais faire échouer l'envoi des mails)
function classerDocument_(type, blob, chantier, dateTexte, complement) {
  try {
    const conf = dossiers_();
    let dossier;
    if (conf.hors_chantier[type]) {
      dossier = dossierParChemin_(DriveApp.getFolderById(driveRootId_()), conf.hors_chantier[type], true);
    } else if (String(chantier || '').trim() && !ligneChantier_(chantier) && !dossierChantier_(chantier, false)) {
      // Lot 2 : nom absent de l'onglet Chantiers et sans dossier existant (faute de frappe, chantier pas encore saisi) :
      // aucun dossier de chantier n'est créé ; le PDF attend dans « _À CLASSER » et Franck est prévenu
      dossier = dossierParChemin_(DriveApp.getFolderById(driveRootId_()), DOSSIER_A_CLASSER, true);
      alerte_('Un document « ' + type + ' » a été fait pour le chantier « ' + String(chantier).slice(0, 80) + ' », absent de l’onglet Chantiers. '
        + 'Il est rangé dans le dossier « ' + DOSSIER_A_CLASSER + ' » du Drive : déplacez-le (et ajoutez le chantier à l’onglet s’il est nouveau). '
        + 'Les mails sont partis normalement.', 'aclasser');
    } else {
      dossier = dossierParChemin_(dossierChantier_(chantier, true), conf.documents[type] || 'Divers', true);
    }
    const nom = nomLibre_(dossier, nomDocument_(type, conf.hors_chantier[type] ? '' : chantier, complement, dateTexte));
    return dossier.createFile(blob.copyBlob().setName(nom));
  } catch (err) {
    console.error('classerDocument_ (' + type + ') :', err.message);
    alerte_('Un document « ' + type + ' » (chantier « ' + String(chantier || '—') + ' ») n’a pas pu être rangé dans Drive (' +
      err.message + '). Le mail part quand même ; le PDF est en pièce jointe.', 'rangement');
    return null;
  }
}

// ══════════════════════════════════════════════════════════
// MIGRATION des documents déjà produits par l'appli (anciens sous-dossiers → nouveaux)
// Seuls ces dossiers sont concernés ; Plans, QT/Tableau, CCTP, Sécurité, Accès ne bougent pas (lot 4).
// Les fichiers gardent leur nom et leur lien (déplacement, pas copie) ; rien n'est jamais écrasé ni supprimé.
// ══════════════════════════════════════════════════════════
const ANCIENS_DOSSIERS = [
  { nom: 'Fiches',               regles: [[/^cotes[_ ]/i, 'cotes'], [/^fab[_ ]/i, 'fabrication']] },
  { nom: 'Note/Réunion/Réunion', regles: [[/^note[_ ]/i, 'note']] },
  { nom: 'Quitus',               regles: [[/^quitus/i, 'quitus'], [/^bordereau[_ ]orga/i, 'bordereau-orga'], [/^bordereau[_ ]mat/i, 'bordereau-materiaux']] },
  { nom: 'Bordereaux',           regles: [[/^bordereau[_ ]orga/i, 'bordereau-orga'], [/^bordereau[_ ]mat/i, 'bordereau-materiaux']] },
  { nom: 'Réceptions Support',   regles: [[/^r[ée]ception[_ ]/i, 'reception-support']] },
  { nom: 'Attestations',         regles: [[/^attestation[_ ]/i, 'attestation']] },
];
const ENTETES_MIGRATION = ['Dossier chantier', 'Ancien dossier', 'Fichier', 'Identifiant du fichier', 'Type', 'Nouveau dossier', 'Action', 'État', 'Date'];

// 1) Liste ce qui serait déplacé, SANS RIEN DÉPLACER, dans l'onglet « Migration (lot 1) ».
//    Remplit aussi « Dossiers chantiers » pour les chantiers du Sheet. Peut être relancée sans risque.
function planMigration() {
  const deja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_MIGRATION);
  if (deja && deja.getLastRow() > 1 && deja.getRange(2, 8, deja.getLastRow() - 1, 1).getValues().some(l => l[0] === 'déplacé')) {
    const m = 'Des documents ont déjà été déplacés : l’onglet « ' + SHEET_MIGRATION + ' » sert au retour arrière (annulerMigration). ' +
      'Pour refaire un plan, renommez d’abord cet onglet (par exemple « Migration (lot 1) faite »).';
    Logger.log(m); return m;
  }
  const debut = Date.now();
  const conf = dossiers_();
  const racine = DriveApp.getFolderById(driveRootId_());
  const lignes = [];
  let aTrier = 0, aDeplacer = 0, coupe = false;

  const it = racine.getFolders();
  while (it.hasNext()) {
    if (Date.now() - debut > DUREE_MAX_MS) { coupe = true; break; }
    const chantier = it.next();
    if (chantier.isTrashed() || estDossierTechnique_(chantier)) continue;
    ANCIENS_DOSSIERS.forEach(ancien => {
      const sous = chantier.getFoldersByName(ancien.nom);
      while (sous.hasNext()) {
        const dossier = sous.next();
        if (dossier.isTrashed()) continue;
        const fichiers = dossier.getFiles();
        while (fichiers.hasNext()) {
          const f = fichiers.next();
          if (f.isTrashed()) continue;
          const regle = ancien.regles.find(r => r[0].test(f.getName()));
          const type = regle ? regle[1] : '';
          if (type) aDeplacer++; else aTrier++;
          lignes.push([chantier.getName(), ancien.nom, f.getName(), f.getId(), type,
            type ? conf.documents[type] : '', type ? 'DÉPLACER' : 'À TRIER À LA MAIN', '', '']);
        }
      }
    });
  }
  const sh = feuille_(SHEET_MIGRATION, ENTETES_MIGRATION);
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, ENTETES_MIGRATION.length).clearContent();
  if (lignes.length) sh.getRange(2, 1, lignes.length, ENTETES_MIGRATION.length).setValues(lignes.map(l => l.map(cellule_)));

  // Dossier retenu pour chaque chantier du Sheet (sans rien créer)
  const dejaNotes = {};
  lignesDossiers_().slice(1).forEach(l => { if (l[2]) dejaNotes[cleChantier_(l[0])] = true; });
  const shC = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CHANTIERS);
  const sansDossier = [];
  (shC ? shC.getDataRange().getValues().slice(1) : []).forEach(l => {
    const nom = String(l[0] || '').trim();
    if (!nom || dejaNotes[cleChantier_(nom)]) return;
    const exacts = racine.getFoldersByName(nom);
    let exact = null;
    while (exacts.hasNext() && !exact) { const d = exacts.next(); if (!d.isTrashed() && !estDossierTechnique_(d)) exact = d; }
    if (exact) { noterDossierChantier_(nom, exact, 'nom exact'); return; }
    const proches = ressemblances_(racine, nom);
    if (proches.length === 1) noterDossierChantier_(nom, proches[0], 'ressemblance');
    else sansDossier.push(nom + (proches.length ? ' (' + proches.length + ' dossiers ressemblants)' : ''));
  });

  const bilan = [
    'Plan de migration écrit dans l’onglet « ' + SHEET_MIGRATION + ' » (rien n’a été déplacé).',
    aDeplacer + ' document(s) à déplacer, ' + aTrier + ' à trier à la main (ils restent où ils sont).',
    'Vérifiez l’onglet « ' + SHEET_DOSSIERS + ' » : les lignes « À vérifier » doivent désigner le bon dossier (sinon corrigez l’identifiant ou supprimez la ligne).',
    sansDossier.length ? 'Chantiers sans dossier retenu (un dossier au nom exact sera créé au premier document ; s’il existe déjà sous un autre nom, ajoutez une ligne dans « ' + SHEET_DOSSIERS + ' » avec son identifiant) : ' + sansDossier.join(', ') : 'Tous les chantiers du Sheet ont un dossier.',
    'Pour ne pas déplacer un document : remplacez « DÉPLACER » par « IGNORER » dans la colonne Action.',
    coupe ? '⚠ Arrêt avant la limite de temps de Google : relancez planMigration().' : 'Ensuite : executerMigration().',
  ].join('\n');
  Logger.log(bilan);
  return bilan;
}

// Une seule migration à la fois, SANS prendre le verrou du script : les fiches continuent d'arriver pendant ce temps
function prendreMigration_() {
  const props = PropertiesService.getScriptProperties();
  const depuis = Number(props.getProperty('MIGRATION_EN_COURS') || 0);
  if (depuis && Date.now() - depuis < 7 * 60 * 1000) return false;   // au-delà de 7 min : exécution morte, on reprend
  props.setProperty('MIGRATION_EN_COURS', String(Date.now()));
  return true;
}
function rendreMigration_() { PropertiesService.getScriptProperties().deleteProperty('MIGRATION_EN_COURS'); }

// 2) Déplace les documents marqués « DÉPLACER » (et pas encore faits). Relancer tant qu'il en reste.
function executerMigration() {
  if (!prendreMigration_()) { Logger.log('Une migration est déjà en cours : relancez dans quelques minutes.'); return 'occupé'; }
  try {
    const debut = Date.now();
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_MIGRATION);
    if (!sh || sh.getLastRow() < 2) { Logger.log('Lancez d’abord planMigration().'); return 'pas de plan'; }
    const racine = DriveApp.getFolderById(driveRootId_());
    const lignes = sh.getRange(2, 1, sh.getLastRow() - 1, ENTETES_MIGRATION.length).getValues();
    let faits = 0, problemes = 0, restants = 0;
    for (let i = 0; i < lignes.length; i++) {
      const l = lignes[i];
      if (String(l[6]).trim().toUpperCase() !== 'DÉPLACER' || l[7]) continue;
      if (Date.now() - debut > DUREE_MAX_MS) { restants++; continue; }
      let etat;
      try {
        const f = DriveApp.getFileById(String(l[3]));
        // Toujours dans l'ancien dossier ? (sinon quelqu'un l'a déjà rangé : on n'y touche pas)
        const parents = f.getParents();
        let ancien = null;
        while (parents.hasNext()) { const p = parents.next(); if (p.getName() === l[1]) ancien = p; }
        if (f.isTrashed()) etat = 'à la corbeille : ignoré';
        else if (!ancien) etat = 'plus dans « ' + l[1] + ' » : ignoré';
        else {
          const chantier = ancien.getParents().hasNext() ? ancien.getParents().next() : racine;
          const dest = dossierParChemin_(chantier, String(l[5]), true);
          f.moveTo(dest);   // même fichier, même lien ; Drive accepte deux fichiers du même nom : rien n'est écrasé
          etat = 'déplacé';
          faits++;
        }
      } catch (err) { etat = 'erreur : ' + err.message; problemes++; }
      sh.getRange(i + 2, 8, 1, 2).setValues([[etat, new Date()]]);
    }
    const bilan = faits + ' document(s) déplacé(s), ' + problemes + ' erreur(s).' +
      (restants ? ' Il en reste ' + restants + ' : relancez executerMigration().' : ' Migration terminée.') +
      ' Les anciens dossiers vides restent en place (rien n’est supprimé).';
    Logger.log(bilan);
    return bilan;
  } finally { rendreMigration_(); }
}

// 3) RETOUR ARRIÈRE : remet dans leur ancien dossier les documents marqués « déplacé » (relancer tant qu'il en reste).
//    Les nouveaux dossiers vides restent (rien n'est supprimé). La ligne passe à « remis en place ».
function annulerMigration() {
  if (!prendreMigration_()) { Logger.log('Une migration est déjà en cours : relancez dans quelques minutes.'); return 'occupé'; }
  try {
    const debut = Date.now();
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_MIGRATION);
    if (!sh || sh.getLastRow() < 2) { Logger.log('Aucune migration à annuler.'); return 'rien'; }
    const lignes = sh.getRange(2, 1, sh.getLastRow() - 1, ENTETES_MIGRATION.length).getValues();
    let remis = 0, problemes = 0, restants = 0;
    for (let i = 0; i < lignes.length; i++) {
      const l = lignes[i];
      if (l[7] !== 'déplacé') continue;
      if (Date.now() - debut > DUREE_MAX_MS) { restants++; continue; }
      let etat;
      try {
        const f = DriveApp.getFileById(String(l[3]));
        // Le dossier chantier est celui qui contient le nouveau dossier actuel du fichier
        let dossier = f.getParents().next();
        const profondeur = String(l[5]).split('/').map(x => x.trim()).filter(Boolean).length;
        for (let n = 0; n < profondeur; n++) dossier = dossier.getParents().next();
        f.moveTo(trouverOuCreerAncien_(dossier, String(l[1])));
        etat = 'remis en place'; remis++;
      } catch (err) { etat = 'déplacé (retour impossible : ' + err.message + ')'; problemes++; }
      sh.getRange(i + 2, 8, 1, 2).setValues([[etat, new Date()]]);
    }
    const bilan = remis + ' document(s) remis dans leur ancien dossier, ' + problemes + ' erreur(s).' +
      (restants ? ' Il en reste ' + restants + ' : relancez annulerMigration().' : ' Retour arrière terminé.');
    Logger.log(bilan);
    return bilan;
  } finally { rendreMigration_(); }
}
// Ancien dossier (son nom peut contenir « / », ex. « Note/Réunion/Réunion » : ce n'est PAS un chemin)
function trouverOuCreerAncien_(chantier, nom) {
  const it = chantier.getFoldersByName(nom);
  while (it.hasNext()) { const d = it.next(); if (!d.isTrashed()) return d; }
  return chantier.createFolder(nom);
}

// Contrôle pour verifierConfig()
function verifierDossiers_() {
  try {
    CacheService.getScriptCache().remove('dossiers.json');
    const racine = DriveApp.getFolderById(driveRootId_());
    const f = fichierDossiers_(racine);
    if (!f) { dossiers_(); return '✅ dossiers.json créé avec les noms par défaut'; }
    JSON.parse(f.getBlob().getDataAsString());
    const aVerifier = lignesDossiers_().slice(1).filter(l => String(l[4] || '').indexOf('OUI') === 0).length;
    return '✅ dossiers.json lisible' + (aVerifier ? ' — ⚠ ' + aVerifier + ' dossier(s) chantier « à vérifier » (onglet ' + SHEET_DOSSIERS + ')' : '');
  } catch (err) {
    return '❌ dossiers.json illisible : ' + err.message + ' (vérifiez les guillemets et les virgules)';
  }
}
