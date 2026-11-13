// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// LOT 3 — NOTES DE CHANTIER (pense-bête partagé par chantier ; aucun mail)
//
// Une note et chaque geste sur une note arrivent comme une fiche (actions « photo » puis « fiche ») : numéro unique,
// renvoi automatique, onglet Envois, tout cela est commun (Api.gs). Deux types de fiche :
//   « note-chantier » : une nouvelle note ;
//   « note-action »   : un geste (modifier, fait, defaire, supprimer, restaurer) sur une note existante.
// Ce fichier ajoute :
//   - refusNote_          : contrôle des données ET des droits, AVANT de réserver un numéro (refus définitif) ;
//   - traiterNoteChantier / traiterNoteAction : l'écriture, sous verrou, ligne retrouvée par son numéro ;
//   - listerNotes_, notesNouvelles_, historiqueNote_, photoNote_, exporterNotes_ : les lectures (droits vérifiés ici) ;
//   - installerLot3Test / installerLot3Production.
// Droits : lire, écrire, « Fait » = accès au chantier ; modifier, supprimer = l'auteur, les conducteurs, l'admin ;
//          corbeille, restauration, export PDF = conducteurs et admin.
// Plan : docs/lot3-plan.md. Décisions : D3-… (DECISIONS.md).
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
const SHEET_NOTES = 'Notes';
const SHEET_NOTES_HISTO = 'Notes historique';
const SHEET_NOTES_VUES = 'Notes vues';
const NOTE_GESTES = ['modifier', 'fait', 'defaire', 'supprimer', 'restaurer'];
const NOTE_MAX_TEXTE = 2000, NOTE_MAX_PHOTOS = 3, NOTE_MAX_CHANTIER = 150;
const NOTE_MAX_LISTE = 200, NOTE_MAX_LISTE_TOUS = 300, NOTE_MAX_HISTO = 50, NOTE_MAX_PHOTOS_PDF = 12;
const NOTE_ENTETES = ['Numéro', 'Chantier', 'Auteur (identifiant)', 'Auteur', 'Créée le', 'Texte', 'Photos (fichiers Drive)', 'Fait', 'Fait par', 'Fait le',
  'Modifiée par', 'Modifiée le', 'Supprimée par', 'Supprimée le', 'Version', 'Remarque', 'Saisie le', 'Dernier texte le', 'Dernier texte par (identifiant)'];
const COL_N = { id: 1, chantier: 2, auteurId: 3, auteur: 4, cree: 5, texte: 6, photos: 7, fait: 8, faitPar: 9, faitLe: 10,
  modifPar: 11, modifLe: 12, supprPar: 13, supprLe: 14, version: 15, remarque: 16, saisi: 17, texteLe: 18, texteParId: 19 };
const NOTE_HISTO_ENTETES = ['Numéro', 'Enregistrée le', 'Version remplacée', 'Ancien texte', 'Écrit par', 'Remplacé par', 'Motif'];
const NOTE_VUES_ENTETES = ['Identifiant', 'Chantier', 'Vue le'];
const NOTE_REFUS_DROIT = 'Cette note n’existe plus, ou vous n’avez pas le droit de faire cela.';

// ── Petits outils ──
function noteTexte_(v) { return typeof v === 'string' ? v.trim() : ''; }
// Erreurs que recevoirFiche_ ne signale PAS à Franck par mail : « occupé » (le téléphone réessaie) et « refus » (définitif)
function noteOccupe_() { return Object.assign(new Error('Serveur occupé, nouvel essai automatique'), { occupe: true }); }
function noteRefus_(message) { return Object.assign(new Error(message), { refusDefinitif: true }); }
// Nouvelle ligne en bas de l'onglet, colonnes de texte mises en « texte brut » AVANT l'écriture (au-delà des lignes
// formatées à l'installation, Sheets transformerait « 12/11 » en date). À appeler sous verrou.
function noteAjouterLigne_(sh, valeurs, colonnesTexte) {
  const ligne = sh.getLastRow() + 1;
  if (ligne > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 50);
  colonnesTexte.forEach(c => sh.getRange(ligne, c).setNumberFormat('@'));
  sh.getRange(ligne, 1, 1, valeurs.length).setValues([valeurs.map(cellule_)]);
  return ligne;
}
function noteChef_(compte) { return !!compte && ROLES_TOUS_CHANTIERS.indexOf(compte.role) > -1; }
function noteDate_(v) { return v instanceof Date ? texteDate_(v.getTime()) : String(v || ''); }
function noteMs_(v) { return v instanceof Date ? v.getTime() : 0; }
// Nom du chantier tel qu'il est écrit dans l'onglet Chantiers ('' s'il n'y est pas)
function noteChantierConnu_(nom) { const l = ligneChantier_(nom); return l ? String(l[0]).trim() : ''; }
// Accès au chantier : conducteurs et admin partout, les autres seulement si la case du chantier est cochée
function notePeutLire_(compte, chantier) { return !!compte && !!compte.id && !!chantier && peutLireChantier_(compte, chantier); }

// ── Onglets ──
function noteFeuille_(nom, entetes, colonnesTexte) {
  const existait = !!SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nom);
  const sh = feuille_(nom, entetes);
  if (!existait) noteFormats_(sh, colonnesTexte);
  return sh;
}
// Colonnes de texte en « texte brut » : Sheets ne transforme pas « 1/2 » en date ni « 0123 » en nombre
function noteFormats_(sh, colonnesTexte) {
  const lignes = Math.max(1, sh.getMaxRows() - 1);
  colonnesTexte.forEach(c => sh.getRange(2, c, lignes, 1).setNumberFormat('@'));
}
const NOTE_COLONNES_TEXTE = [COL_N.id, COL_N.chantier, COL_N.auteurId, COL_N.auteur, COL_N.texte, COL_N.photos, COL_N.faitPar,
  COL_N.modifPar, COL_N.supprPar, COL_N.remarque, COL_N.saisi, COL_N.texteParId];
function feuilleNotes_() { return noteFeuille_(SHEET_NOTES, NOTE_ENTETES, NOTE_COLONNES_TEXTE); }
const NOTE_HISTO_TEXTE = [1, 4, 5, 6, 7];
function feuilleNotesHisto_() { return noteFeuille_(SHEET_NOTES_HISTO, NOTE_HISTO_ENTETES, NOTE_HISTO_TEXTE); }
function feuilleNotesVues_() { return noteFeuille_(SHEET_NOTES_VUES, NOTE_VUES_ENTETES, [1, 2]); }

// Toutes les lignes de l'onglet Notes (sans les titres), de la plus ancienne à la plus récente d'après « Créée le »
// (jamais d'après leur position : Franck peut trier l'onglet) ; [] si l'onglet n'existe pas encore
function lignesNotes_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NOTES);
  const derniere = sh ? sh.getLastRow() : 0;
  const lignes = derniere > 1 ? sh.getRange(2, 1, derniere - 1, NOTE_ENTETES.length).getValues() : [];
  return lignes.map((r, i) => ({ r: r, i: i, t: noteMs_(r[COL_N.cree - 1]) })).sort((a, b) => (a.t - b.t) || (a.i - b.i)).map(x => x.r);
}
// Ligne d'une note d'après son numéro (colonne A), ou 0. Jamais par position : Franck peut trier l'onglet.
function chercherNote_(sh, id) {
  const derniere = sh ? sh.getLastRow() : 0;
  if (derniere < 2) return 0;
  const ids = sh.getRange(2, COL_N.id, derniere - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return 0;
}
function noteLue_(id) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NOTES);
  const ligne = chercherNote_(sh, id);
  return ligne ? { sh: sh, ligne: ligne, r: sh.getRange(ligne, 1, 1, NOTE_ENTETES.length).getValues()[0] } : null;
}
function notePhotosIds_(r) { return String(r[COL_N.photos - 1] || '').split(/\s+/).filter(Boolean); }
function noteSupprimee_(r) { return !!String(r[COL_N.supprPar - 1] || '').trim() || r[COL_N.supprLe - 1] instanceof Date; }

// ── Contrôle AVANT tout traitement : null si tout va bien, sinon { code, message } ──
// DONNEES_INVALIDES = refus définitif (la fiche reste dans le téléphone, marquée « à vérifier ») ;
// CONNEXION_REQUISE = la fiche attend dans le téléphone que la personne se reconnecte (jamais de note sans auteur).
// photosJointes : vrai quand le serveur a déjà remplacé les références des photos par leurs images (2e passage)
function refusNote_(d, compte, photosJointes) {
  d = d || {};
  const refus = m => ({ code: 'DONNEES_INVALIDES', message: m });
  const CONTROLE = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/, CONTROLE_SAUF_LIGNES = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u2028\u2029]/;
  if (!compte || !compte.id) return { code: 'CONNEXION_REQUISE', message: 'Connectez-vous depuis l’accueil : la note est gardée dans le téléphone et partira ensuite.' };
  if (d.texte != null && typeof d.texte !== 'string') return refus('Texte invalide');
  const texte = noteTexte_(d.texte);
  if (texte.length > NOTE_MAX_TEXTE) return refus('Note trop longue (' + NOTE_MAX_TEXTE + ' caractères au plus)');
  if (CONTROLE_SAUF_LIGNES.test(texte)) return refus('Texte invalide');

  if (d.type === 'note-chantier') {
    if (typeof d.date !== 'string' || !/^\d{2}\/\d{2}\/\d{4}$/.test(d.date)) return refus('Date invalide');
    if (typeof d.heure !== 'string' || !/^\d{2}h\d{2}$/.test(d.heure)) return refus('Heure invalide');
    const chantier = noteTexte_(d.chantier);
    if (!chantier || chantier.length > NOTE_MAX_CHANTIER || CONTROLE.test(chantier)) return refus('Chantier manquant ou invalide');
    const photos = d.photos == null ? [] : d.photos;
    if (!Array.isArray(photos)) return refus('Photos invalides');
    if (photos.length > NOTE_MAX_PHOTOS) return refus(NOTE_MAX_PHOTOS + ' photos au plus par note');
    for (let i = 0; i < photos.length; i++) {
      const p = photos[i];
      if (!p || typeof p !== 'object' || Array.isArray(p)) return refus('Photo invalide');
      // À la réception : seulement une référence à une photo déposée par l'action « photo »
      if (!photosJointes && (!idValide_(p.photoRef) || Object.keys(p).some(k => k !== 'photoRef'))) return refus('Photo invalide');
    }
    if (!texte && !photos.length) return refus('Note vide : écrivez un texte ou ajoutez une photo');
    // Même réponse pour « chantier inconnu » et « chantier interdit » : on n'apprend pas qu'un chantier existe
    const connu = noteChantierConnu_(chantier);
    if (!connu || !notePeutLire_(compte, connu)) return refus('Ce chantier ne fait pas partie de vos chantiers : la note n’est pas enregistrée. Voyez avec le bureau.');
    return null;
  }

  if (d.type === 'note-action') {
    if (NOTE_GESTES.indexOf(d.geste) < 0) return refus('Geste inconnu');
    if (typeof d.note !== 'string' || !idValide_(d.note)) return refus('Numéro de note invalide');
    if (d.base != null && !(typeof d.base === 'number' && isFinite(d.base) && d.base >= 1 && d.base < 1e6 && Math.floor(d.base) === d.base)) return refus('Version invalide');
    const n = noteLue_(d.note);
    if (!n || !notePeutLire_(compte, String(n.r[COL_N.chantier - 1]))) return refus(NOTE_REFUS_DROIT);
    const auteur = String(n.r[COL_N.auteurId - 1] || '') === compte.id, chef = noteChef_(compte);
    if ((d.geste === 'modifier' || d.geste === 'supprimer') && !auteur && !chef) return refus(NOTE_REFUS_DROIT);
    if (d.geste === 'restaurer' && !chef) return refus(NOTE_REFUS_DROIT);
    if (d.geste === 'modifier' && !texte && !notePhotosIds_(n.r).length) return refus('Note vide : écrivez un texte (ou supprimez la note)');
    return null;
  }
  return refus('Type de fiche inconnu');
}

// ── Nouvelle note (appelé par traiterFiche_) ──
// contexte : { id (numéro de la fiche = numéro de la note), compte (profil vérifié par le jeton), auteurNom }
function traiterNoteChantier(data, brut, contexte) {
  if (!contexte || !contexte.id) throw new Error('Note refusée : numéro de fiche absent (page trop ancienne)');
  const compte = contexte.compte;
  const refus = refusNote_(brut, compte, true);
  if (refus) throw noteRefus_(refus.message);
  const chantier = noteChantierConnu_(brut.chantier);
  const texte = noteTexte_(brut.texte);
  const saisi = (noteTexte_(brut.date) + ' ' + noteTexte_(brut.heure)).trim().slice(0, 30);
  const auteurNom = compte.nom || contexte.auteurNom || compte.id;

  // Déjà écrite (nouvel essai après une coupure) : rien à refaire
  if (chercherNote_(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NOTES), contexte.id)) return;

  // 1. Les photos, rangées dans le dossier du chantier sous un nom fixe : un nouvel essai ne les range pas deux fois
  const photos = (Array.isArray(brut.photos) ? brut.photos : []).filter(Boolean);
  const ids = [];
  if (photos.length) {
    const dossier = dossierParChemin_(dossierChantier_(chantier, true), dossiers_().documents['notes-photos'] || '05 - CHANTIER/PHOTOS CHANTIER/NOTES', true);
    photos.forEach((p, i) => {
      const mime = /^image\/(jpeg|png|webp)$/.test(String(p.mimeType || p.mime || '')) ? String(p.mimeType || p.mime) : '';
      const b64 = String(p.data || '').replace(/\s+/g, '');
      if (!mime || !/^[A-Za-z0-9+\/=]+$/.test(b64) || b64.length * 0.75 > MAX_PHOTO_OCTETS) throw noteRefus_('Photo de la note illisible');
      const nom = 'NOTE ' + contexte.id + '-' + (i + 1) + '.' + mime.split('/')[1];
      let fichier = null;
      const it = dossier.getFilesByName(nom);
      while (it.hasNext()) { const f = it.next(); if (!f.isTrashed()) { fichier = f; break; } }
      if (!fichier) fichier = dossier.createFile(Utilities.newBlob(Utilities.base64Decode(b64), mime, nom));
      ids.push(fichier.getId());
    });
  }

  // 2. La ligne, une seule fois (onglet créé sous verrou s'il manque)
  const verrou = LockService.getScriptLock();
  if (!verrou.tryLock(15000)) throw noteOccupe_();
  try {
    const sh = feuilleNotes_();
    if (chercherNote_(sh, contexte.id)) return;
    const maintenant = new Date(), ligne = [];
    for (let c = 1; c <= NOTE_ENTETES.length; c++) ligne.push('');
    ligne[COL_N.id - 1] = contexte.id; ligne[COL_N.chantier - 1] = chantier; ligne[COL_N.auteurId - 1] = compte.id; ligne[COL_N.auteur - 1] = auteurNom;
    ligne[COL_N.cree - 1] = maintenant; ligne[COL_N.texte - 1] = texte; ligne[COL_N.photos - 1] = ids.join(' ');
    ligne[COL_N.version - 1] = 1; ligne[COL_N.saisi - 1] = saisi; ligne[COL_N.texteLe - 1] = maintenant; ligne[COL_N.texteParId - 1] = compte.id;
    noteAjouterLigne_(sh, ligne, NOTE_COLONNES_TEXTE);
  } finally { verrou.releaseLock(); }
}

// ── Geste sur une note (appelé par traiterFiche_) ──
function traiterNoteAction(data, brut, contexte) {
  const compte = contexte && contexte.compte;
  const refus = refusNote_(brut, compte, true);
  if (refus) throw noteRefus_(refus.message);
  const nom = compte.nom || compte.id, geste = brut.geste;
  const verrou = LockService.getScriptLock();
  if (!verrou.tryLock(15000)) throw noteOccupe_();
  try {
    const n = noteLue_(brut.note);   // relue sous verrou
    if (!n) throw noteRefus_(NOTE_REFUS_DROIT);
    const r = n.r, sh = n.sh, maintenant = new Date();
    const histo = valeurs => noteAjouterLigne_(feuilleNotesHisto_(), valeurs, NOTE_HISTO_TEXTE);
    const ecrire = (col, valeurs) => sh.getRange(n.ligne, col, 1, valeurs.length).setValues([valeurs.map(cellule_)]);
    const supprimee = noteSupprimee_(r);

    if (geste === 'modifier') {
      const texte = noteTexte_(brut.texte), ancien = String(r[COL_N.texte - 1] || '');
      const version = Number(r[COL_N.version - 1]) || 1;
      const dernierId = String(r[COL_N.texteParId - 1] || ''), dernierNom = String(r[COL_N.modifPar - 1] || r[COL_N.auteur - 1] || '');
      if (supprimee) {
        // Reçue après la suppression de la note : le texte n'est pas perdu, il est gardé dans l'historique
        histo([brut.note, maintenant, version, texte, nom, '', 'reçue après suppression (texte non appliqué)']);
        return;
      }
      if (texte === ancien) return;   // rien à changer (geste répété)
      // Quelqu'un d'AUTRE a changé le texte depuis la version que ce téléphone avait sous les yeux :
      // la modification reçue en dernier l'emporte (heure du serveur), l'autre version reste dans l'historique
      const conflit = brut.base != null && Number(brut.base) !== version && dernierId !== compte.id;
      histo([brut.note, maintenant, version, ancien, dernierNom, nom, conflit ? 'modification en même temps' : 'modification']);
      ecrire(COL_N.texte, [texte]);
      ecrire(COL_N.modifPar, [nom, maintenant]);
      // La mention de conflit ne s'efface que quand quelqu'un modifie EN AYANT VU la version actuelle (base = version) :
      // une 2e modification du même téléphone, écrite hors réseau sur l'ancienne base, ne la fait pas disparaître
      const remarque = conflit ? 'modifiée en même temps par ' + dernierNom
        : (brut.base != null && Number(brut.base) === version ? '' : String(r[COL_N.remarque - 1] || ''));
      ecrire(COL_N.version, [version + 1, remarque]);
      ecrire(COL_N.texteLe, [maintenant, compte.id]);
    } else if (geste === 'fait') {
      if (String(r[COL_N.fait - 1] || '') !== 'Oui') ecrire(COL_N.fait, ['Oui', nom, maintenant]);
    } else if (geste === 'defaire') {
      if (String(r[COL_N.fait - 1] || '') === 'Oui') ecrire(COL_N.fait, ['', '', '']);
    } else if (geste === 'supprimer') {
      if (!supprimee) ecrire(COL_N.supprPar, [nom, maintenant]);
    } else if (geste === 'restaurer') {
      if (supprimee) ecrire(COL_N.supprPar, ['', '']);
    }
  } finally { verrou.releaseLock(); }
}

// ── Notes vues (badge « nouveau ») ──
// Dernière visite de chaque chantier par ce compte : { cléDuChantier: millisecondes }
function notesVues_(id) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NOTES_VUES);
  const res = {};
  if (!sh || sh.getLastRow() < 2) return res;
  sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues().forEach(r => {
    if (String(r[0]) === id) res[cleChantier_(r[1])] = Math.max(res[cleChantier_(r[1])] || 0, noteMs_(r[2]));
  });
  return res;
}
// Action « notesVues » { chantier, jusqua } : envoyée par la page APRÈS l'affichage de la liste, avec l'heure du serveur
// de cette liste (jamais celle du téléphone). La visite ne recule jamais et ne dépasse jamais l'heure du serveur.
// Avec { tous: true } (conducteurs et admin, depuis la vue « Tous chantiers ») : tous les chantiers qui ont des notes.
function marquerNotesVues_(compte, corps) {
  const REFUS = { ok: false, code: 'INTERDIT', message: 'Ce chantier ne fait pas partie de vos chantiers : voyez avec le bureau.' };
  let chantiers;
  if (corps.tous === true) {
    if (!noteChef_(compte)) return avecJeton_(REFUS, compte);
    const vus = {};
    lignesNotes_().forEach(r => { const n = String(r[COL_N.chantier - 1] || '').trim(); if (n && String(r[COL_N.id - 1] || '')) vus[cleChantier_(n)] = n; });
    chantiers = Object.keys(vus).map(k => vus[k]);
  } else {
    const chantier = noteChantierConnu_(typeof corps.chantier === 'string' ? corps.chantier.trim().slice(0, NOTE_MAX_CHANTIER) : '');
    if (!chantier || !notePeutLire_(compte, chantier)) return avecJeton_(REFUS, compte);
    chantiers = [chantier];
  }
  const maintenant = Date.now();
  const jusqua = typeof corps.jusqua === 'number' && isFinite(corps.jusqua) && corps.jusqua > 0 ? Math.min(corps.jusqua, maintenant) : maintenant;
  const verrou = LockService.getScriptLock();
  if (!verrou.tryLock(5000)) return avecJeton_({ ok: false, code: 'SERVEUR_OCCUPE', message: 'Serveur occupé' }, compte);
  try {
    const sh = feuilleNotesVues_(), derniere = sh.getLastRow();
    const lignes = derniere > 1 ? sh.getRange(2, 1, derniere - 1, 3).getValues() : [];
    chantiers.forEach(chantier => {
      for (let i = 0; i < lignes.length; i++) {
        if (String(lignes[i][0]) !== compte.id || cleChantier_(lignes[i][1]) !== cleChantier_(chantier)) continue;
        if (noteMs_(lignes[i][2]) < jusqua) sh.getRange(i + 2, 3).setValue(new Date(jusqua));
        return;
      }
      noteAjouterLigne_(sh, [compte.id, chantier, new Date(jusqua)], [1, 2]);
    });
  } finally { verrou.releaseLock(); }
  return avecJeton_({ ok: true, code: 'OK', message: 'Visite notée' }, compte);
}
// « Nouveau » pour ce compte : texte écrit ou modifié par quelqu'un d'autre après sa dernière visite du chantier
function noteNouvelle_(r, compte, vues) {
  if (noteSupprimee_(r) || String(r[COL_N.texteParId - 1] || '') === compte.id) return false;
  return noteMs_(r[COL_N.texteLe - 1]) > (vues[cleChantier_(r[COL_N.chantier - 1])] || 0);
}

// ── Lecture ──
function noteObjet_(r, compte, vues) {
  const chef = noteChef_(compte), mien = String(r[COL_N.auteurId - 1] || '') === compte.id;
  return { id: String(r[COL_N.id - 1]), chantier: String(r[COL_N.chantier - 1] || ''), auteur: String(r[COL_N.auteur - 1] || ''),
    cree: noteDate_(r[COL_N.cree - 1]), texte: String(r[COL_N.texte - 1] || ''), photos: notePhotosIds_(r).length,
    fait: String(r[COL_N.fait - 1] || '') === 'Oui', faitPar: String(r[COL_N.faitPar - 1] || ''), faitLe: noteDate_(r[COL_N.faitLe - 1]),
    modifPar: String(r[COL_N.modifPar - 1] || ''), modifLe: noteDate_(r[COL_N.modifLe - 1]),
    supprPar: String(r[COL_N.supprPar - 1] || ''), supprLe: noteDate_(r[COL_N.supprLe - 1]),
    version: Number(r[COL_N.version - 1]) || 1, remarque: String(r[COL_N.remarque - 1] || ''),
    mien: mien, peutModifier: mien || chef, nouveau: noteNouvelle_(r, compte, vues) };
}
// corps : { chantier?, corbeille?, recherche?, nonFait?, nouveau?, auteur? }.
// Avec un chantier : ses notes (accès au chantier). Sans : vue « Tous chantiers », réservée aux conducteurs et à l'admin.
// Les filtres sont appliqués ICI, avant le plafond : la recherche porte sur toutes les notes, pas sur les plus récentes.
function listerNotes_(compte, corps) {
  const REFUS = { ok: false, code: 'INTERDIT', message: 'Ce chantier ne fait pas partie de vos chantiers : voyez avec le bureau.' };
  const chef = noteChef_(compte);
  const demande = typeof corps.chantier === 'string' ? corps.chantier.trim().slice(0, NOTE_MAX_CHANTIER) : '';
  const corbeille = corps.corbeille === true;
  if (corbeille && !chef) return avecJeton_(REFUS, compte);
  let chantier = '';
  if (demande) {
    chantier = noteChantierConnu_(demande);
    if (!chantier || !notePeutLire_(compte, chantier)) return avecJeton_(REFUS, compte);
  } else if (!chef) {
    return avecJeton_({ ok: false, code: 'INTERDIT', message: 'La vue « Tous chantiers » est réservée aux conducteurs : ouvrez les notes depuis un chantier.' }, compte);
  }
  const minus = v => String(v || '').toLowerCase();
  const recherche = typeof corps.recherche === 'string' ? minus(corps.recherche.trim().slice(0, 100)) : '';
  const auteur = typeof corps.auteur === 'string' ? minus(corps.auteur.trim().slice(0, 100)) : '';
  const nonFait = corps.nonFait === true, nouveau = corps.nouveau === true;
  const heure = Date.now();   // heure du serveur de cette liste : la page la renvoie dans « notesVues »
  const vues = notesVues_(compte.id);
  const lignes = lignesNotes_(), max = demande ? NOTE_MAX_LISTE : NOTE_MAX_LISTE_TOUS, res = [];
  for (let i = lignes.length - 1; i >= 0 && res.length < max; i--) {   // les plus récentes d'abord
    const r = lignes[i];
    if (!String(r[COL_N.id - 1] || '')) continue;
    const cle = cleChantier_(r[COL_N.chantier - 1]);
    if (demande && cle !== cleChantier_(chantier)) continue;
    if (noteSupprimee_(r) !== corbeille) continue;
    if (nonFait && String(r[COL_N.fait - 1] || '') === 'Oui') continue;
    if (auteur && minus(r[COL_N.auteur - 1]) !== auteur) continue;
    if (recherche && minus(r[COL_N.texte - 1]).indexOf(recherche) < 0 && minus(r[COL_N.auteur - 1]).indexOf(recherche) < 0
      && minus(r[COL_N.chantier - 1]).indexOf(recherche) < 0) continue;
    if (nouveau && !noteNouvelle_(r, compte, vues)) continue;
    res.push(noteObjet_(r, compte, vues));
  }
  return avecJeton_({ ok: true, code: 'OK', message: res.length + ' note(s)',
    data: { notes: res, chantier: chantier, corbeille: corbeille, chef: chef, heure: heure, plein: res.length >= max } }, compte);
}
// Nombre de notes nouvelles par chantier visible (badges de l'accueil)
function notesNouvelles_(compte) {
  const visibles = {};   // les chantiers que l'accueil montre à ce compte (un poseur ne voit pas un chantier « Terminé »)
  chantiersVisibles_(compte).forEach(c => { visibles[cleChantier_(c.nom)] = true; });
  const vues = notesVues_(compte.id), parChantier = {};
  let total = 0;
  lignesNotes_().forEach(r => {
    if (!String(r[COL_N.id - 1] || '')) return;
    const cle = cleChantier_(r[COL_N.chantier - 1]);
    if (!visibles[cle]) return;
    if (!noteNouvelle_(r, compte, vues)) return;
    const nom = String(r[COL_N.chantier - 1]).trim();
    parChantier[nom] = (parChantier[nom] || 0) + 1; total++;
  });
  return avecJeton_({ ok: true, code: 'OK', message: total + ' note(s) nouvelle(s)', data: { parChantier: parChantier, total: total } }, compte);
}
// Note retrouvée et droit de lecture vérifié (une note à la corbeille : conducteurs et admin seulement), sinon null
function noteAutorisee_(compte, id) {
  if (typeof id !== 'string' || !idValide_(id)) return null;
  const n = noteLue_(id);
  if (!n || !notePeutLire_(compte, String(n.r[COL_N.chantier - 1]))) return null;
  if (noteSupprimee_(n.r) && !noteChef_(compte)) return null;
  return n;
}
function historiqueNote_(compte, corps) {
  const n = noteAutorisee_(compte, corps.note);
  if (!n) return avecJeton_({ ok: false, code: 'INTERDIT', message: NOTE_REFUS_DROIT }, compte);
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NOTES_HISTO);
  const lignes = sh && sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, NOTE_HISTO_ENTETES.length).getValues() : [];
  const res = [];
  for (let i = lignes.length - 1; i >= 0 && res.length < NOTE_MAX_HISTO; i--) {
    const r = lignes[i];
    if (String(r[0]) !== corps.note) continue;
    res.push({ le: noteDate_(r[1]), version: Number(r[2]) || 0, texte: String(r[3] || ''), par: String(r[4] || ''), remplacePar: String(r[5] || ''), motif: String(r[6] || '') });
  }
  return avecJeton_({ ok: true, code: 'OK', message: res.length + ' ancienne(s) version(s)', data: { versions: res } }, compte);
}
// Une photo d'une note : rendue par le serveur après contrôle (jamais de lien public, jamais d'identifiant Drive)
function photoNote_(compte, corps) {
  const REFUS = { ok: false, code: 'INTERDIT', message: NOTE_REFUS_DROIT };
  const n = noteAutorisee_(compte, corps.note);
  const rang = Number(corps.rang);
  if (!n || !(rang >= 1 && rang <= NOTE_MAX_PHOTOS && Math.floor(rang) === rang)) return avecJeton_(REFUS, compte);
  const idFichier = notePhotosIds_(n.r)[rang - 1];
  if (!idFichier) return avecJeton_(REFUS, compte);
  try {
    const f = DriveApp.getFileById(idFichier);
    if (f.isTrashed()) throw new Error('à la corbeille');
    const blob = f.getBlob(), octets = blob.getBytes();
    if (octets.length > MAX_PHOTO_OCTETS) throw new Error('trop lourde');
    return avecJeton_({ ok: true, code: 'OK', message: 'Photo', data: { mime: f.getMimeType(), data: Utilities.base64Encode(octets) } }, compte);
  } catch (e) {
    console.error('photoNote_ :', e.message);
    return avecJeton_({ ok: false, code: 'INTROUVABLE', message: 'Cette photo n’est plus disponible.' }, compte);
  }
}

// ── Export PDF des notes d'un chantier (conducteurs et admin) : rangé dans le dossier du chantier ──
function exporterNotes_(compte, corps) {
  const chantier = noteChantierConnu_(typeof corps.chantier === 'string' ? corps.chantier.trim().slice(0, NOTE_MAX_CHANTIER) : '');
  if (!noteChef_(compte) || !chantier) return avecJeton_({ ok: false, code: 'INTERDIT', message: 'L’export en PDF est réservé aux conducteurs.' }, compte);
  const lignes = lignesNotes_().filter(r => String(r[COL_N.id - 1] || '') && cleChantier_(r[COL_N.chantier - 1]) === cleChantier_(chantier) && !noteSupprimee_(r));
  if (!lignes.length) return avecJeton_({ ok: false, code: 'VIDE', message: 'Aucune note à exporter pour ce chantier.' }, compte);
  let reste = NOTE_MAX_PHOTOS_PDF, nonReprises = 0;
  const notes = lignes.map(r => {   // de la plus ancienne à la plus récente
    const photos = [];
    notePhotosIds_(r).forEach(id => {
      if (reste <= 0) { nonReprises++; return; }
      try {
        const f = DriveApp.getFileById(id);
        if (f.isTrashed()) return;
        photos.push({ data: Utilities.base64Encode(f.getBlob().getBytes()), mimeType: f.getMimeType() });
        reste--;
      } catch (e) { nonReprises++; }
    });
    return { cree: noteDate_(r[COL_N.cree - 1]), auteur: String(r[COL_N.auteur - 1] || ''), texte: String(r[COL_N.texte - 1] || ''),
      fait: String(r[COL_N.fait - 1] || '') === 'Oui', faitPar: String(r[COL_N.faitPar - 1] || ''), faitLe: noteDate_(r[COL_N.faitLe - 1]),
      modifPar: String(r[COL_N.modifPar - 1] || ''), modifLe: noteDate_(r[COL_N.modifLe - 1]), photos: photos };
  });
  const jour = Utilities.formatDate(new Date(), 'Europe/Paris', 'dd/MM/yyyy');
  const d = validerImages_({ chantier: chantier, date: jour, exportePar: compte.nom || compte.id, notes: notes, nonReprises: nonReprises });
  const blob = pdfDuModele_(modele_notes_chantier, d, nomFichier_('Notes_' + chantier + '_' + jour.replace(/\//g, '-') + '.pdf'));
  const fichier = classerDocument_('notes-chantier', blob, chantier, jour, '');
  if (!fichier) return avecJeton_({ ok: false, code: 'ERREUR', message: 'Le PDF n’a pas pu être rangé dans Drive : réessayez plus tard.' }, compte);
  return avecJeton_({ ok: true, code: 'OK', message: 'PDF rangé dans le dossier du chantier : ' + fichier.getName(),
    data: { nom: fichier.getName(), notes: notes.length, photosNonReprises: nonReprises } }, compte);
}

// ── Installation du lot 3 (une fonction par environnement ; relançable sans danger) ──
function etapesLot3_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const etape = (nom, entetes, colonnesTexte) => ({
    nom: 'Onglet « ' + nom + ' »',
    fait: () => {
      const sh = ss.getSheetByName(nom);
      return !!sh && entetes.every((t, i) => String(sh.getRange(1, i + 1).getValue()) === t);
    },
    action: () => {
      const sh = ss.getSheetByName(nom);
      if (!sh) { noteFeuille_(nom, entetes, colonnesTexte); return 'onglet créé'; }
      // Onglet déjà là : jamais rien réécrire par-dessus des données
      const titres = sh.getRange(1, 1, 1, entetes.length).getValues()[0];
      if (sh.getLastRow() > 1 || titres.some(t => String(t).trim() !== '')) throw new Error('un onglet « ' + nom + ' » existe déjà avec d’autres titres : le renommer, puis relancer');
      sh.getRange(1, 1, 1, entetes.length).setValues([entetes]);
      noteFormats_(sh, colonnesTexte);
      return 'onglet prêt';
    } });
  return [
    etape(SHEET_NOTES, NOTE_ENTETES, NOTE_COLONNES_TEXTE),
    etape(SHEET_NOTES_HISTO, NOTE_HISTO_ENTETES, [1, 4, 5, 6, 7]),
    etape(SHEET_NOTES_VUES, NOTE_VUES_ENTETES, [1, 2]),
  ];
}
function installerLot3_(attendu) { return installer_('Lot 3', attendu, etapesLot3_()).texte; }
function installerLot3Test() { return installerLot3_('TEST'); }
function installerLot3Production() { return installerLot3_('PRODUCTION'); }
