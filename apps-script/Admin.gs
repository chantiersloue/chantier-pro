// ═══════════════════════════════════════════════════════════════
// Loué App — Admin.gs : tâches à lancer dans l'éditeur (déclencheurs, vérification, partages, copie TEST)
// Les fichiers .gs du projet partagent les mêmes constantes et fonctions.
// ═══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
// TÂCHES À LANCER DANS L'ÉDITEUR (choisir la fonction en haut, puis ▶ Exécuter)
// ══════════════════════════════════════════════════════════

// Renvoie les mails de l'onglet « Mails en attente » (lancé automatiquement toutes les 2 h)
function renvoyerMailsEnAttente() {
  const verrou = LockService.getScriptLock();
  if (!verrou.tryLock(20000)) return;
  try {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ATTENTE);
    if (sh && sh.getLastRow() > 1) {
      const valeurs = sh.getRange(2, 1, sh.getLastRow() - 1, 14).getValues();
      const envoyesCePassage = [];
      valeurs.forEach((r, i) => {
        if (r[10] !== 'en attente') return;
        const email = r[3], bcc = r[4];
        const besoin = 1 + (bcc ? decouperAdresses_(bcc).length || 1 : 0);
        const pourAdmin = !bcc && String(email).toLowerCase() === String(emailAdmin_()).toLowerCase();
        const reste = MailApp.getRemainingDailyQuota();
        if (reste < besoin || (!pourAdmin && reste - besoin < RESERVE_ADMIN)) return;  // on retentera plus tard
        const essais = Number(r[11] || 0) + 1;
        try {
          const blob = DriveApp.getFileById(r[8]).getBlob().setName(r[9] || 'document.pdf');
          const opts = { attachments: [blob], name: NOM_ENTREPRISE };
          if (r[7]) opts.htmlBody = r[7];
          if (bcc)  opts.bcc = bcc;
          GmailApp.sendEmail(email, r[5], r[6], opts);
          r[10] = 'envoyé';
          envoyesCePassage.push(r[8]);
          journal_({ fiche: r[1], chantier: r[2] }, email, 'envoyé', 'mail reporté, envoyé au ' + essais + 'e essai');
        } catch (err) {
          r[10] = essais >= MAX_ESSAIS_ATTENTE ? 'abandonné' : 'en attente';
          if (r[10] === 'abandonné') alerte_('Mail abandonné après ' + essais + ' essais : ' + email + ' (' + err.message + '). Le PDF est conservé.', 'abandon');
        }
        r[11] = essais;
        r[12] = new Date();
        sh.getRange(i + 2, 11, 1, 3).setValues([[r[10], r[11], r[12]]]);
      });
      // PDF temporaires (absences) envoyés pendant ce passage : à la corbeille si plus aucun mail ne les attend
      // (ceux des mails abandonnés sont gardés)
      const bloques = valeurs.filter(r => r[10] !== 'envoyé').map(r => r[8]);
      const vus = {};
      envoyesCePassage.forEach(id => {
        if (!id || vus[id] || bloques.indexOf(id) > -1) return;
        vus[id] = true;
        try {
          const f = DriveApp.getFileById(id);
          const parents = f.getParents();
          if (!f.isTrashed() && parents.hasNext() && parents.next().getName() === '_MAILS EN ATTENTE') f.setTrashed(true);
        } catch (e) {}
      });
    }
    // Photos de fiches jamais terminées : à la corbeille au bout de 7 jours
    try {
      const enCours = dossierPhotosEnCours_(false);
      if (enCours) {
        const limite = Date.now() - 7 * 24 * 3600 * 1000;
        const it = enCours.getFolders();
        while (it.hasNext()) { const d = it.next(); if (d.getDateCreated().getTime() < limite) d.setTrashed(true); }
      }
    } catch (e) { console.error('nettoyage photos :', e.message); }
    // Nettoyage des compteurs des jours passés
    const props = PropertiesService.getScriptProperties();
    const aujourdhui = jour_();
    props.getKeys().forEach(k => {
      if (/^(LIBRES|PHOTOS|ALERTE_[A-Z]+)_\d{4}-\d{2}-\d{2}$/.test(k) && k.slice(-10) < aujourdhui) props.deleteProperty(k);
    });
  } finally {
    verrou.releaseLock();
  }
}

// À lancer après le déploiement (le relancer ne crée pas de doublon : chaque déclencheur est supprimé puis recréé)
//  - renvoyerMailsEnAttente toutes les 2 h (lot 0)
//  - traiterComptes toutes les 10 min, et surModificationSheet à chaque modification du Sheet (lot 2 : cases
//    « Réinitialiser » et « Déconnecter », onglet « Accès chantiers »)
const DECLENCHEURS = ['renvoyerMailsEnAttente', 'traiterComptes', 'surModificationSheet'];
function installerDeclencheurs() {
  ScriptApp.getProjectTriggers()
    .filter(t => DECLENCHEURS.indexOf(t.getHandlerFunction()) > -1)
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('renvoyerMailsEnAttente').timeBased().everyHours(2).create();
  ScriptApp.newTrigger('traiterComptes').timeBased().everyMinutes(10).create();
  ScriptApp.newTrigger('surModificationSheet').forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet()).onEdit().create();
  const m = 'Déclencheurs installés : renvoyerMailsEnAttente (2 h), traiterComptes (10 min), surModificationSheet (à chaque modification).';
  Logger.log(m); return m;
}

// Retire les 3 déclencheurs (à lancer sur la copie TEST après les essais : les 90 min de déclencheurs par jour
// sont partagées par tout le compte Google, production comprise)
function retirerDeclencheurs() {
  let n = 0;
  ScriptApp.getProjectTriggers().filter(t => DECLENCHEURS.indexOf(t.getHandlerFunction()) > -1)
    .forEach(t => { ScriptApp.deleteTrigger(t); n++; });
  const m = n + ' déclencheur(s) retiré(s). (installerDeclencheurs pour les remettre.)';
  Logger.log(m); return m;
}

// À lancer après chaque modification des Propriétés du script : vérifie que tout est en place
function verifierConfig() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lignes = ['Loué App API ' + VERSION_API];
  const ok = (cond, texte) => lignes.push((cond ? '✅ ' : '❌ ') + texte);
  try { ok(true, 'Dossier racine : ' + DriveApp.getFolderById(driveRootId_()).getName()); }
  catch (e) { ok(false, 'DRIVE_ROOT_ID : ' + e.message); }
  try { ok(true, 'Dossier Planning : ' + DriveApp.getFolderById(drivePlanningId_()).getName()); }
  catch (e) { ok(false, 'DRIVE_PLANNING_ID : ' + e.message); }
  ok(estEmail_(emailAdmin_()), 'Adresse de Franck (alertes, copies) : ' + emailAdmin_());
  [SHEET_CONTACTS, SHEET_CONTACT_NOTES, SHEET_CHANTIERS].forEach(n => ok(!!ss.getSheetByName(n), 'Onglet « ' + n + ' »'));
  lignes.push(verifierDossiers_());   // lot 1.5 : fichier des noms de dossiers
  // Lot 1 R2 : onglet des matériaux proposés par le bordereau matériaux (créé vide, avec ses titres)
  if (!ss.getSheetByName(SHEET_MAT_BORDEREAU)) {
    feuille_(SHEET_MAT_BORDEREAU, ['Type', 'Matériau', 'Quantité']);
    lignes.push('✅ Onglet « ' + SHEET_MAT_BORDEREAU + ' » créé (vide) : une ligne par matériau — A le type, B le matériau, C la quantité');
  } else ok(true, 'Onglet « ' + SHEET_MAT_BORDEREAU + ' »');
  const presents = ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction());
  DECLENCHEURS.forEach(d => ok(presents.indexOf(d) > -1, 'Déclencheur ' + d + ' (sinon lancer installerDeclencheurs)'));
  lignes.push(verifierComptes_());    // lot 2 : comptes, clé, partage du Sheet, transition
  lignes.push("Mails encore possibles aujourd'hui : " + MailApp.getRemainingDailyQuota());
  Logger.log(lignes.join('\n'));
  return lignes.join('\n');
}


// ══════════════════════════════════════════════════════════
// ESSAI DE MISE EN PAGE DES PHOTOS (lot 1, retouche R1) — à lancer sur TEST, AUCUN mail envoyé
// Fabrique 3 PDF d'essai à la racine du Drive de l'appli (« _ESSAI MISE EN PAGE … ») et écrit dans le journal,
// pour chacun : le format de page réel du PDF de Google, le nombre de pages obtenu et le nombre prévu.
// Si une ligne dit « refait », le contrôle automatique a dû corriger : envoyer le journal à Claude.
// ══════════════════════════════════════════════════════════
const ESSAI_PHOTO_JPEG = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAGAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDEooor9dPyQ//Z';
const ESSAI_CROQUIS_PNG = 'iVBORw0KGgoAAAANSUhEUgAAACIAAAAVCAIAAACsWquAAAAAZUlEQVR4nL3NOw7AIAwEUQ7h+1/VKYIERJbjzy5TTPuGXGmIiKq+J7UYqnQwPMxgGJLNwDGPAWL/DEQKMX0swXSwNFOTKkwBqzMpqcXEMQATwWCMLyEZB8MzJsZiPhKR2bHJXOgBFDn9wGtZlnUAAAAASUVORK5CYII=';
function essaiMiseEnPage() {
  const racine = DriveApp.getFolderById(driveRootId_());
  const photo = label => ({ data: ESSAI_PHOTO_JPEG, mimeType: 'image/jpeg', label: label || '' });
  const croquis = { data: ESSAI_CROQUIS_PNG, mimeType: 'image/png', label: 'Croquis' };
  const ligne = (i, n) => ({ repere: 'R' + i, qte: 2, long: 2040, larg: 830, haut: 40, section: '40x40', materiau: 'Médium', finition: 'BLANC', quincaillerie: 'Paumelles', observations: n });
  const cas = [
    ['fabrication', modele_fabrication, { chantier: 'ESSAI MISE EN PAGE', date: '01/01/2026', auteur: 'Essai', chefAtelier: 'Essai', conducteur: 'Essai', delai: 'Essai',
      blocs: [{ id: 1, type: 'divers', rows: [ligne(1, 'photo en page 1'), ligne(2, 'croquis en page 2')] }], photosBase64: [photo('Photo : toute la place sous le tableau'), croquis] }],
    ['quitus', modele_quitus, { chantier: 'ESSAI MISE EN PAGE', date: '01/01/2026', heure: '12h00', intervenant: 'Essai', solde: 'OUI',
      description: 'Essai : 1 photo en page 1 sous les signatures, 2 photos sur la page 2.', photosBase64: [photo('1'), photo('2'), photo('3')] }],
    ['bordereau', modele_bordereau, { type: 'bordereau-materiaux', chantier: 'ESSAI MISE EN PAGE', date: '01/01/2026', heure: '12h00', soussigne: 'Essai', preneur: 'Essai',
      entreprise: 'Essai', typeDoc: 'Kit', nombre: '1', listeMateriaux: '2 × Vis\n1 × Mousse', photosBase64: [photo('Photo en page 1')] }],
  ];
  const lignes = ['Essai de mise en page (' + VERSION_API + ')'];
  cas.forEach(([nom, modele, d]) => {
    const html = modele(d, esc_);
    const brut = HtmlService.createHtmlOutput(html).getAs('application/pdf');
    const info = infoPdf_(brut);
    const prevues = 1 + (html.match(/page-break-before:always/g) || []).length;
    const blob = pdfDuModele_(modele, d, '_ESSAI MISE EN PAGE ' + nom + '.pdf');
    const refait = info.pages && info.pages > prevues;
    const anciens = racine.getFilesByName(blob.getName());
    while (anciens.hasNext()) anciens.next().setTrashed(true);
    racine.createFile(blob);
    lignes.push((refait ? '⚠ ' : '✅ ') + nom + ' : format ' + (info.l ? info.l + ' × ' + info.h + ' mm' : 'illisible')
      + ', ' + (info.pages || '?') + ' page(s) pour ' + prevues + ' prévue(s)' + (refait ? ' → contrôle : PDF refait (voir le journal d’exécution)' : ''));
  });
  lignes.push('PDF à ouvrir à la racine du Drive de l’appli : « _ESSAI MISE EN PAGE … » (à supprimer ensuite).');
  Logger.log(lignes.join('\n'));
  return lignes.join('\n');
}


// ══════════════════════════════════════════════════════════
// PARTAGES PAR LIEN (lot 0) — TEST d'abord, puis réel avec l'accord de Franck
// 1. listerPartages()   : remplit l'onglet « Partages (lot 0) » (relancer tant que le journal dit « À suivre »)
// 2. Franck télécharge l'onglet en CSV dans _prive/ (sauvegarde)
// 3. retirerPartages()  : passe en « accès limité » ce qui est marqué « à retirer »
// 4. remettrePartages() : en cas de problème, remet les partages d'origine
// ══════════════════════════════════════════════════════════
const DUREE_MAX_MS = 4.5 * 60 * 1000;   // on s'arrête avant la limite de 6 min ; il suffit de relancer

function listerPartages() {
  const debut = Date.now();
  const props = PropertiesService.getScriptProperties();
  const rootId = driveRootId_(), planningId = drivePlanningId_();
  let phase = props.getProperty('PARTAGES_PHASE') || '';
  const sh = feuille_(SHEET_PARTAGES, ['Type','Nom','Chemin','ID',"Accès d'origine","Permission d'origine",'Décision','État']);
  if (!phase || phase === 'terminé') {
    if (sh.getLastRow() > 1) {
      const etats = sh.getRange(2, 8, sh.getLastRow() - 1, 1).getValues().map(r => String(r[0]));
      if (etats.some(e => /^(retiré|remis)/.test(e))) {
        const msg = "Refusé : l'onglet « " + SHEET_PARTAGES + " » sert au retour arrière (des partages ont déjà été retirés). "
          + "Pour refaire une liste, renommer d'abord cet onglet (exemple : « Partages (lot 0) ancien »).";
        Logger.log(msg);
        return msg;
      }
      sh.getRange(2, 1, sh.getLastRow() - 1, 8).clearContent();
    }
    phase = 'fichiers';
    props.deleteProperty('PARTAGES_JETON');
  }
  const requete = "(visibility = 'anyoneWithLink' or visibility = 'anyoneCanFind') and trashed = false";
  const cache = {};
  const lignes = [];
  let total = 0;
  while (phase !== 'terminé') {
    const jeton = props.getProperty('PARTAGES_JETON');
    const it = jeton
      ? (phase === 'fichiers' ? DriveApp.continueFileIterator(jeton) : DriveApp.continueFolderIterator(jeton))
      : (phase === 'fichiers' ? DriveApp.searchFiles(requete) : DriveApp.searchFolders(requete));
    while (it.hasNext() && Date.now() - debut < DUREE_MAX_MS) {
      const el = it.next();
      const chemin = cheminDansAppli_(el, rootId, planningId, cache);
      if (!chemin) continue;  // fichier hors de l'appli : on n'y touche pas
      const morceaux = chemin.split(' › ');
      const garder = morceaux[0] === 'PLANNING' || (morceaux[0] === 'RACINE' && SOUS_DOSSIERS_PARTAGES.indexOf(morceaux[2]) > -1);
      lignes.push([phase === 'fichiers' ? 'fichier' : 'dossier', el.getName(), chemin, el.getId(),
        String(el.getSharingAccess()), String(el.getSharingPermission()),
        garder ? 'garder' : 'à retirer', ''].map(cellule_));
    }
    // Les lignes sont écrites AVANT d'enregistrer où l'on en est : rien n'est perdu si l'exécution est coupée
    if (lignes.length) { sh.getRange(sh.getLastRow() + 1, 1, lignes.length, 8).setValues(lignes); total += lignes.length; lignes.length = 0; }
    if (it.hasNext()) {
      props.setProperty('PARTAGES_JETON', it.getContinuationToken());
      props.setProperty('PARTAGES_PHASE', phase);
      break;
    }
    props.deleteProperty('PARTAGES_JETON');
    phase = phase === 'fichiers' ? 'dossiers' : 'terminé';
    props.setProperty('PARTAGES_PHASE', phase);
  }
  const msg = phase === 'terminé'
    ? 'Liste terminée (' + (sh.getLastRow() - 1) + " élément(s)). Télécharger l'onglet en CSV dans _prive/, puis lancer retirerPartages()."
    : 'À suivre : ' + total + ' élément(s) ajouté(s). Relancer listerPartages() pour continuer.';
  Logger.log(msg);
  return msg;
}

// Chemin d'un fichier ou dossier depuis la racine de l'appli ("RACINE/…" ou "PLANNING/…"), ou '' s'il est ailleurs
function cheminDansAppli_(el, rootId, planningId, cache) {
  const id0 = el.getId();
  const SEP = ' › ';   // et non « / », qui apparaît dans certains noms de chantiers
  if (id0 === rootId) return 'RACINE';
  if (id0 === planningId) return 'PLANNING';
  const noms = [el.getName()];
  const traverses = [];   // dossiers parcourus, pour remplir le cache
  let parents = el.getParents();
  let base = '';
  for (let niveau = 0; niveau < 12 && parents.hasNext(); niveau++) {
    const p = parents.next();
    const id = p.getId();
    if (cache[id] !== undefined) { base = cache[id]; break; }
    if (id === rootId)     { base = 'RACINE';   break; }
    if (id === planningId) { base = 'PLANNING'; break; }
    traverses.push(id);
    noms.push(p.getName());
    parents = p.getParents();
  }
  // Le cache retient, pour chaque dossier traversé, son chemin complet (ou '' s'il est hors de l'appli)
  for (let k = 0; k < traverses.length; k++) {
    cache[traverses[k]] = base ? base + SEP + noms.slice(k + 1).reverse().join(SEP) : '';
  }
  return base ? base + SEP + noms.reverse().join(SEP) : '';
}

function retirerPartages() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('PARTAGES_PHASE') !== 'terminé') {
    Logger.log("La liste n'est pas terminée : lancer d'abord listerPartages() jusqu'à « Liste terminée ».");
    return;
  }
  return modifierPartages_(r => r[7] === '' || String(r[7]).indexOf('remis') === 0 || String(r[7]).indexOf('erreur') === 0,
    el => {
      // Un fichier rendu privé par son dossier (partage hérité) n'a plus rien à retirer
      if (String(el.getSharingAccess()) === 'PRIVATE') return 'déjà privé (dossier parent)';
      el.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
    }, 'retiré le ');
}

function remettrePartages() {
  return modifierPartages_(r => String(r[7]).indexOf('retiré') === 0,
    (el, r) => el.setSharing(DriveApp.Access[r[4]], DriveApp.Permission[r[5]]), 'remis le ');
}

// Secours : si l'onglet a été perdu et réimporté depuis la sauvegarde CSV (colonne État vide),
// remet le partage d'origine de TOUTES les lignes « à retirer », quel que soit leur état.
function remettreDepuisSauvegarde() {
  return modifierPartages_(r => String(r[7]).indexOf('remis') !== 0,
    (el, r) => el.setSharing(DriveApp.Access[r[4]], DriveApp.Permission[r[5]]), 'remis le ');
}

function modifierPartages_(aTraiter, action, texteEtat) {
  const debut = Date.now();
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PARTAGES);
  if (!sh || sh.getLastRow() < 2) { Logger.log('Onglet « ' + SHEET_PARTAGES + ' » vide.'); return; }
  const valeurs = sh.getRange(2, 1, sh.getLastRow() - 1, 8).getValues();
  let faits = 0, restants = 0;
  // Les dossiers d'abord : leurs fichiers perdent alors le partage hérité
  const ordre = valeurs.map((r, i) => i).sort((a, b) => (valeurs[a][0] === 'dossier' ? 0 : 1) - (valeurs[b][0] === 'dossier' ? 0 : 1));
  ordre.forEach(i => {
    const r = valeurs[i];
    if (r[6] !== 'à retirer' || !aTraiter(r)) return;
    if (Date.now() - debut > DUREE_MAX_MS) { restants++; return; }
    try {
      const el = r[0] === 'dossier' ? DriveApp.getFolderById(r[3]) : DriveApp.getFileById(r[3]);
      const note = action(el, r);
      sh.getRange(i + 2, 8).setValue(texteEtat + Utilities.formatDate(new Date(), 'Europe/Paris', 'dd/MM/yyyy HH:mm')
        + (note ? ' — ' + note : ''));
      faits++;
    } catch (err) {
      sh.getRange(i + 2, 8).setValue('erreur : ' + err.message);
    }
  });
  const msg = faits + ' élément(s) traité(s).' + (restants ? ' ' + restants + ' restant(s) : relancer la même fonction.' : ' Terminé.');
  Logger.log(msg);
  return msg;
}


// ══════════════════════════════════════════════════════════
// COPIE TEST UNIQUEMENT — remplace les vraies adresses par des variantes de celle de Franck
// (franck+contact1@…, qui arrivent dans sa boîte), pour qu'aucun essai n'écrive à un vrai conducteur ou client.
// Refuse de tourner si le Sheet ne s'appelle pas « … TEST … » ou si la propriété ENVIRONNEMENT ≠ TEST.
// ══════════════════════════════════════════════════════════
function anonymiserCopieTest() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (propriete_('ENVIRONNEMENT') !== 'TEST' || !/TEST/i.test(ss.getName())) {
    const msg = 'Refusé : à lancer seulement sur la copie TEST (Sheet nommé « … TEST … » et propriété ENVIRONNEMENT = TEST).';
    Logger.log(msg);
    return msg;
  }
  const admin = emailAdmin_();
  const at = admin.indexOf('@');
  const variante = n => admin.slice(0, at) + '+' + n + admin.slice(at);
  let n = 0;
  [[SHEET_CONTACTS, 3], [SHEET_CONTACT_NOTES, 2]].forEach(([nom, col]) => {
    const sh = ss.getSheetByName(nom);
    if (!sh || sh.getLastRow() < 2) return;
    const plage = sh.getRange(2, col, sh.getLastRow() - 1, 1);
    plage.setValues(plage.getValues().map(r => [r[0] ? variante('contact' + (++n)) : '']));
  });
  const msg = n + ' adresse(s) remplacée(s) par des variantes de ' + admin + '.';
  Logger.log(msg);
  return msg;
}
