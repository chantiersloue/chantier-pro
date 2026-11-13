// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// LOT 3 — NOTES DE CHANTIER : la liste des choses à faire d'un chantier (façon « Google Keep ») ; aucun mail
//
// Un élément = une ligne de texte et une case à cocher. Pas de suppression : un élément coché passe dans
// « Éléments terminés », d'où on peut le décocher. À l'écran : ni auteur, ni date. Le Sheet garde qui a fait quoi
// et quand (onglet « Notes historique »), comme filet de sécurité.
//
// Un nouvel élément et chaque geste arrivent comme une fiche (action « fiche ») : numéro unique, renvoi automatique,
// onglet Envois, tout cela est commun (Api.gs). Deux types de fiche :
//   « note-chantier » : un nouvel élément { chantier, texte } ;
//   « note-action »   : un geste { note, geste: modifier | fait | defaire, texte? } sur un élément existant.
// Ce fichier ajoute :
//   - refusNote_          : contrôle des données ET des droits, AVANT de réserver un numéro (refus définitif) ;
//   - traiterNoteChantier / traiterNoteAction : l'écriture, sous verrou, ligne retrouvée par son numéro ;
//   - listerNotes_, notesNouvelles_, marquerNotesVues_ : les lectures (droits vérifiés ici) ;
//   - installerLot3Test / installerLot3Production.
// Droits : lire, ajouter, modifier, cocher, décocher = toute personne qui a accès au chantier ;
//          vue « Tous chantiers » = conducteurs et admin.
// Plan : docs/lot3-plan.md (chapitre 14). Décisions : D3-… (DECISIONS.md).
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
const SHEET_NOTES = 'Notes';
const SHEET_NOTES_HISTO = 'Notes historique';
const SHEET_NOTES_VUES = 'Notes vues';
const NOTE_GESTES = ['modifier', 'fait', 'defaire'];
const NOTE_MAX_TEXTE = 2000, NOTE_MAX_CHANTIER = 150;
const NOTE_MAX_A_FAIRE = 300, NOTE_MAX_TERMINES = 300, NOTE_MAX_TOUS = 300;
const NOTE_ENTETES = ['Numéro', 'Chantier', 'Texte', 'Fait', 'Créé le', 'Créé par', 'Texte modifié le', 'Texte modifié par (identifiant)', 'Coché le', 'Coché par'];
const COL_N = { id: 1, chantier: 2, texte: 3, fait: 4, cree: 5, creePar: 6, texteLe: 7, texteParId: 8, cocheLe: 9, cochePar: 10 };
const NOTE_COLONNES_TEXTE = [COL_N.id, COL_N.chantier, COL_N.texte, COL_N.creePar, COL_N.texteParId, COL_N.cochePar];
const NOTE_HISTO_ENTETES = ['Le', 'Numéro', 'Chantier', 'Geste', 'Ancien texte', 'Nouveau texte', 'Par', 'Par (identifiant)'];
const NOTE_HISTO_TEXTE = [2, 3, 4, 5, 6, 7, 8];
const NOTE_VUES_ENTETES = ['Identifiant', 'Chantier', 'Vue le'];
const NOTE_REFUS_DROIT = 'Cet élément n’existe pas, ou ce chantier ne fait pas partie de vos chantiers.';

// ── Petits outils ──
function noteTexte_(v) { return typeof v === 'string' ? v.trim() : ''; }
// Texte d'un élément : une seule ligne. Un retour à la ligne ou une tabulation devient une espace (jamais un refus :
// une dictée ou un collage ne doit pas faire perdre l'élément).
function noteLigne_(v) { return typeof v === 'string' ? v.replace(/[\r\n\t\u2028\u2029]+/g, ' ').replace(/ {2,}/g, ' ').trim() : ''; }
// Erreurs que recevoirFiche_ ne signale PAS à Franck par mail : « occupé » (le téléphone réessaie) et « refus » (définitif)
function noteOccupe_() { return Object.assign(new Error('Serveur occupé, nouvel essai automatique'), { occupe: true }); }
function noteRefus_(message) { return Object.assign(new Error(message), { refusDefinitif: true }); }
function noteChef_(compte) { return !!compte && ROLES_TOUS_CHANTIERS.indexOf(compte.role) > -1; }
function noteMs_(v) { return v instanceof Date ? v.getTime() : 0; }
function noteQui_(compte) { return (compte.nom || compte.id) + ' (' + compte.id + ')'; }
// Nom du chantier tel qu'il est écrit dans l'onglet Chantiers ('' s'il n'y est pas)
function noteChantierConnu_(nom) { const l = ligneChantier_(nom); return l ? String(l[0]).trim() : ''; }
// Accès au chantier : conducteurs et admin partout, les autres seulement si la case du chantier est cochée
function notePeutLire_(compte, chantier) { return !!compte && !!compte.id && !!chantier && peutLireChantier_(compte, chantier); }

// ── Onglets ──
// Colonnes de texte en « texte brut » : Sheets ne transforme pas « 1/2 » en date ni « 0123 » en nombre
function noteFormats_(sh, colonnesTexte) {
  const lignes = Math.max(1, sh.getMaxRows() - 1);
  colonnesTexte.forEach(c => sh.getRange(2, c, lignes, 1).setNumberFormat('@'));
}
function noteFeuille_(nom, entetes, colonnesTexte) {
  const existait = !!SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nom);
  const sh = feuille_(nom, entetes);
  if (!existait) noteFormats_(sh, colonnesTexte);
  return sh;
}
// Un onglet du même nom mais aux autres titres (première version du lot, restée sur la copie TEST) n'est JAMAIS lu ni
// écrit : le téléphone réessaiera, et l'installation dira quoi faire.
function noteTitresBons_(sh, entetes) {
  if (sh.getLastColumn() < entetes.length) return false;   // onglet plus étroit que prévu : pas les bons titres (et pas de lecture hors limites)
  const titres = sh.getRange(1, 1, 1, entetes.length).getValues()[0];
  return entetes.every((t, i) => String(titres[i]) === t);
}
// Titres changés (un titre de colonne renommé à la main, ou la première version restée sur la copie TEST) : rien n'est lu ni
// écrit, les téléphones gardent tout et réessaient, et Franck est prévenu par mail (une fois par jour) : sans cela, toutes
// les listes seraient bloquées sans que personne le sache.
function noteOngletVerifie_(sh, entetes) {
  if (noteTitresBons_(sh, entetes)) return sh;
  alerte_('Les listes « Notes » des chantiers sont bloquées : la ligne de titres de l’onglet « ' + sh.getName() + ' » n’est plus celle attendue ('
    + entetes.join(' | ') + '). Remettez ces titres, ou renommez l’onglet puis lancez installerLot3Production. Rien n’est perdu : les téléphones gardent tout et réessaient.', 'notes');
  throw Object.assign(new Error('Les onglets des notes ne sont pas à jour sur le serveur (titres changés, ou installation du lot 3 à faire).'), { occupe: true });
}
function feuilleNotes_() { return noteOngletVerifie_(noteFeuille_(SHEET_NOTES, NOTE_ENTETES, NOTE_COLONNES_TEXTE), NOTE_ENTETES); }
function feuilleNotesHisto_() { return noteOngletVerifie_(noteFeuille_(SHEET_NOTES_HISTO, NOTE_HISTO_ENTETES, NOTE_HISTO_TEXTE), NOTE_HISTO_ENTETES); }
function feuilleNotesVues_() { return noteFeuille_(SHEET_NOTES_VUES, NOTE_VUES_ENTETES, [1, 2]); }
// Nouvelle ligne en bas de l'onglet, colonnes de texte mises en « texte brut » AVANT l'écriture (au-delà des lignes
// formatées à l'installation, Sheets transformerait « 12/11 » en date). À appeler sous verrou.
function noteAjouterLigne_(sh, valeurs, colonnesTexte) {
  const ligne = sh.getLastRow() + 1;
  if (ligne > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 50);
  // colonnes voisines regroupées : une seule demande à Sheets par groupe
  for (let i = 0; i < colonnesTexte.length; i++) {
    let n = 1;
    while (i + n < colonnesTexte.length && colonnesTexte[i + n] === colonnesTexte[i] + n) n++;
    sh.getRange(ligne, colonnesTexte[i], 1, n).setNumberFormat('@');
    i += n - 1;
  }
  sh.getRange(ligne, 1, 1, valeurs.length).setValues([valeurs.map(cellule_)]);
  return ligne;
}
// Le filet de sécurité : une ligne par geste (qui, quand, quoi). Jamais lu par l'appli. À appeler sous verrou.
function noteHistorique_(id, chantier, geste, ancien, nouveau, compte) {
  noteAjouterLigne_(feuilleNotesHisto_(), [new Date(), id, chantier, geste, ancien, nouveau, compte.nom || compte.id, compte.id], NOTE_HISTO_TEXTE);
}

// Toutes les lignes de l'onglet Notes (sans les titres), de la plus ancienne à la plus récente d'après « Créé le »
// (jamais d'après leur position : Franck peut trier l'onglet) ; [] si l'onglet n'existe pas encore
function lignesNotes_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NOTES);
  if (sh) noteOngletVerifie_(sh, NOTE_ENTETES);
  const derniere = sh ? sh.getLastRow() : 0;
  const lignes = derniere > 1 ? sh.getRange(2, 1, derniere - 1, NOTE_ENTETES.length).getValues() : [];
  return lignes.filter(r => String(r[COL_N.id - 1] || '')).map((r, i) => ({ r: r, i: i, t: noteMs_(r[COL_N.cree - 1]) }))
    .sort((a, b) => (a.t - b.t) || (a.i - b.i)).map(x => x.r);
}
// Ligne d'un élément d'après son numéro (colonne A), ou 0. Jamais par position : Franck peut trier l'onglet.
function chercherNote_(sh, id) {
  const derniere = sh ? sh.getLastRow() : 0;
  if (derniere < 2) return 0;
  const ids = sh.getRange(2, COL_N.id, derniere - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return 0;
}
function noteLue_(id) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NOTES);
  if (sh) noteOngletVerifie_(sh, NOTE_ENTETES);
  const ligne = chercherNote_(sh, id);
  return ligne ? { sh: sh, ligne: ligne, r: sh.getRange(ligne, 1, 1, NOTE_ENTETES.length).getValues()[0] } : null;
}
function noteFaite_(r) { return String(r[COL_N.fait - 1] || '') === 'Oui'; }

// ── Contrôle AVANT tout traitement : null si tout va bien, sinon { code, message } ──
// DONNEES_INVALIDES = refus définitif (la fiche reste dans le téléphone, marquée « à vérifier ») ;
// CONNEXION_REQUISE = la fiche attend dans le téléphone que la personne se reconnecte (jamais d'élément sans auteur).
function refusNote_(d, compte) {
  d = d || {};
  const refus = m => ({ code: 'DONNEES_INVALIDES', message: m });
  const CONTROLE = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;   // après nettoyage des retours à la ligne : plus aucun caractère invisible
  if (!compte || !compte.id) return { code: 'CONNEXION_REQUISE', message: 'Connectez-vous depuis l’accueil : c’est gardé dans le téléphone et partira ensuite.' };
  if (d.texte != null && typeof d.texte !== 'string') return refus('Texte invalide');
  const texte = noteLigne_(d.texte);
  if (texte.length > NOTE_MAX_TEXTE) return refus('Texte trop long (' + NOTE_MAX_TEXTE + ' caractères au plus)');
  if (CONTROLE.test(texte)) return refus('Texte invalide');

  if (d.type === 'note-chantier') {
    const chantier = noteTexte_(d.chantier);
    if (!chantier || chantier.length > NOTE_MAX_CHANTIER || CONTROLE.test(chantier)) return refus('Chantier manquant ou invalide');
    if (!texte) return refus('Élément vide : écrivez un texte');
    // Même réponse pour « chantier inconnu » et « chantier interdit » : on n'apprend pas qu'un chantier existe
    const connu = noteChantierConnu_(chantier);
    if (!connu || !notePeutLire_(compte, connu)) return refus('Ce chantier ne fait pas partie de vos chantiers : l’élément n’est pas enregistré. Voyez avec le bureau.');
    return null;
  }

  if (d.type === 'note-action') {
    if (NOTE_GESTES.indexOf(d.geste) < 0) return refus('Geste inconnu');
    if (typeof d.note !== 'string' || !idValide_(d.note)) return refus('Numéro d’élément invalide');
    const n = noteLue_(d.note);
    if (!n || !notePeutLire_(compte, String(n.r[COL_N.chantier - 1]))) return refus(NOTE_REFUS_DROIT);
    if (d.geste === 'modifier' && !texte) return refus('Le texte ne peut pas être vide (un élément ne se supprime pas : cochez-le)');
    return null;
  }
  return refus('Type de fiche inconnu');
}

// ── Nouvel élément (appelé par traiterFiche_) ──
// contexte : { id (numéro de la fiche = numéro de l'élément), compte (profil vérifié par le jeton) }
function traiterNoteChantier(data, brut, contexte) {
  if (!contexte || !contexte.id) throw new Error('Élément refusé : numéro de fiche absent (page trop ancienne)');
  const compte = contexte.compte;
  const refus = refusNote_(brut, compte);
  if (refus) throw noteRefus_(refus.message);
  const chantier = noteChantierConnu_(brut.chantier), texte = noteLigne_(brut.texte);
  const verrou = LockService.getScriptLock();
  if (!verrou.tryLock(15000)) throw noteOccupe_();
  try {
    const sh = feuilleNotes_();
    feuilleNotesHisto_();   // vérifié AVANT d'écrire : jamais un élément sans sa ligne d'historique
    if (chercherNote_(sh, contexte.id)) return;   // déjà écrit (nouvel essai après une coupure) : rien à refaire
    const maintenant = new Date(), ligne = [];
    for (let c = 1; c <= NOTE_ENTETES.length; c++) ligne.push('');
    ligne[COL_N.id - 1] = contexte.id; ligne[COL_N.chantier - 1] = chantier; ligne[COL_N.texte - 1] = texte;
    ligne[COL_N.cree - 1] = maintenant; ligne[COL_N.creePar - 1] = noteQui_(compte);
    ligne[COL_N.texteLe - 1] = maintenant; ligne[COL_N.texteParId - 1] = compte.id;
    // L'historique d'abord : si une panne coupe entre les deux écritures, le nouvel essai refait le tout
    // (une ligne d'historique en double vaut mieux qu'un élément sans trace de son auteur)
    noteHistorique_(contexte.id, chantier, 'création', '', texte, compte);
    noteAjouterLigne_(sh, ligne, NOTE_COLONNES_TEXTE);
  } finally { verrou.releaseLock(); }
}

// ── Geste sur un élément (appelé par traiterFiche_) : modifier le texte, cocher, décocher ──
// Deux personnes modifient le même élément : la dernière modification reçue l'emporte (heure du serveur) ;
// l'historique garde les deux textes. Un geste répété ne change rien.
function traiterNoteAction(data, brut, contexte) {
  const compte = contexte && contexte.compte;
  const refus = refusNote_(brut, compte);
  if (refus) throw noteRefus_(refus.message);
  const verrou = LockService.getScriptLock();
  if (!verrou.tryLock(15000)) throw noteOccupe_();
  try {
    feuilleNotesHisto_();   // vérifié AVANT d'écrire : jamais un geste sans sa ligne d'historique
    const n = noteLue_(brut.note);   // relu sous verrou
    if (!n) throw noteRefus_(NOTE_REFUS_DROIT);
    const r = n.r, maintenant = new Date(), chantier = String(r[COL_N.chantier - 1] || '');
    const ecrire = (col, valeurs) => n.sh.getRange(n.ligne, col, 1, valeurs.length).setValues([valeurs.map(cellule_)]);
    if (brut.geste === 'modifier') {
      const texte = noteLigne_(brut.texte), ancien = String(r[COL_N.texte - 1] || '');
      if (texte === ancien) return;
      // « vu » = le texte que le téléphone avait sous les yeux. S'il n'est plus le texte actuel, quelqu'un d'autre l'a changé
      // entre-temps : la modification reçue l'emporte quand même, et l'historique le dit (rien à l'écran).
      const enMemeTemps = typeof brut.vu === 'string' && noteLigne_(brut.vu) !== ancien && String(r[COL_N.texteParId - 1] || '') !== compte.id;
      noteHistorique_(brut.note, chantier, enMemeTemps ? 'modification en même temps' : 'modification', ancien, texte, compte);   // l'historique d'abord
      ecrire(COL_N.texte, [texte]);
      ecrire(COL_N.texteLe, [maintenant, compte.id]);
    } else if (brut.geste === 'fait') {
      if (noteFaite_(r)) return;
      noteHistorique_(brut.note, chantier, 'coché', '', '', compte);
      ecrire(COL_N.fait, ['Oui']);
      ecrire(COL_N.cocheLe, [maintenant, noteQui_(compte)]);
    } else {
      if (!noteFaite_(r)) return;
      noteHistorique_(brut.note, chantier, 'décoché', '', '', compte);
      ecrire(COL_N.fait, ['']);
      ecrire(COL_N.cocheLe, ['', '']);
    }
  } finally { verrou.releaseLock(); }
}

// ── Notes vues (chiffre rouge « nouveau » de l'accueil) ──
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
// « Nouveau » pour ce compte : un élément À FAIRE dont le texte a été écrit ou modifié par quelqu'un d'autre
// après sa dernière visite du chantier
function noteNouvelle_(r, compte, vues) {
  if (noteFaite_(r) || String(r[COL_N.texteParId - 1] || '') === compte.id) return false;
  return noteMs_(r[COL_N.texteLe - 1]) > (vues[cleChantier_(r[COL_N.chantier - 1])] || 0);
}
// Action « notesVues » { chantier, jusqua } : envoyée par la page APRÈS l'affichage de la liste, avec l'heure du serveur
// de cette liste (jamais celle du téléphone). La visite ne recule jamais et ne dépasse jamais l'heure du serveur.
// Avec { tous: true } (conducteurs et admin, depuis la vue « Tous chantiers ») : tous les chantiers qui ont des éléments.
function marquerNotesVues_(compte, corps) {
  const REFUS = { ok: false, code: 'INTERDIT', message: 'Ce chantier ne fait pas partie de vos chantiers : voyez avec le bureau.' };
  let chantiers;
  if (corps.tous === true) {
    if (!noteChef_(compte)) return avecJeton_(REFUS, compte);
    const vus = {};
    lignesNotes_().forEach(r => { const n = String(r[COL_N.chantier - 1] || '').trim(); if (n) vus[cleChantier_(n)] = n; });
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
    const nouvelles = [];
    chantiers.forEach(chantier => {
      for (let i = 0; i < lignes.length; i++) {
        if (String(lignes[i][0]) !== compte.id || cleChantier_(lignes[i][1]) !== cleChantier_(chantier)) continue;
        if (noteMs_(lignes[i][2]) < jusqua) sh.getRange(i + 2, 3).setValue(new Date(jusqua));
        return;
      }
      nouvelles.push([cellule_(compte.id), cellule_(chantier), new Date(jusqua)]);
    });
    // Les nouvelles lignes en UNE écriture (50 chantiers d'un coup ne tiennent pas le verrou du script 20 secondes)
    if (nouvelles.length) {
      const debut = sh.getLastRow() + 1, manque = debut + nouvelles.length - 1 - sh.getMaxRows();
      if (manque > 0) sh.insertRowsAfter(sh.getMaxRows(), manque + 50);
      sh.getRange(debut, 1, nouvelles.length, 2).setNumberFormat('@');
      sh.getRange(debut, 1, nouvelles.length, 3).setValues(nouvelles);
    }
  } finally { verrou.releaseLock(); }
  return avecJeton_({ ok: true, code: 'OK', message: 'Visite notée' }, compte);
}

// ── Lecture ──
// Ce que l'appli reçoit d'un élément : son numéro, son texte, s'il est fait, s'il est nouveau. Ni auteur, ni date.
function noteObjet_(r, compte, vues, avecChantier) {
  const o = { id: String(r[COL_N.id - 1]), texte: String(r[COL_N.texte - 1] || ''), fait: noteFaite_(r), nouveau: noteNouvelle_(r, compte, vues) };
  if (avecChantier) o.chantier = String(r[COL_N.chantier - 1] || '');
  return o;
}
// corps : { chantier?, recherche?, nouveau?, termines? }.
// Avec un chantier (accès au chantier) : ses éléments à faire (dans l'ordre où ils ont été ajoutés), puis ses éléments terminés
// (les derniers cochés en haut). Sans chantier : vue « Tous chantiers », réservée aux conducteurs et à l'admin ;
// les éléments terminés n'y sont rendus que sur demande (termines: true).
// Les filtres sont appliqués ICI, avant les plafonds : la recherche porte sur tous les éléments.
function listerNotes_(compte, corps) {
  const REFUS = { ok: false, code: 'INTERDIT', message: 'Ce chantier ne fait pas partie de vos chantiers : voyez avec le bureau.' };
  const demande = typeof corps.chantier === 'string' ? corps.chantier.trim().slice(0, NOTE_MAX_CHANTIER) : '';
  let chantier = '';
  if (demande) {
    chantier = noteChantierConnu_(demande);
    if (!chantier || !notePeutLire_(compte, chantier)) return avecJeton_(REFUS, compte);
  } else if (!noteChef_(compte)) {
    return avecJeton_({ ok: false, code: 'INTERDIT', message: 'La vue « Tous chantiers » est réservée aux conducteurs : ouvrez les notes depuis un chantier.' }, compte);
  }
  const minus = v => String(v || '').toLowerCase();
  const recherche = typeof corps.recherche === 'string' ? minus(corps.recherche.trim().slice(0, 100)) : '';
  const nouveau = corps.nouveau === true, avecTermines = !!demande || corps.termines === true;
  const heure = Date.now();   // heure du serveur de cette liste : la page la renvoie dans « notesVues »
  const vues = notesVues_(compte.id), lignes = lignesNotes_();
  const maxAFaire = demande ? NOTE_MAX_A_FAIRE : NOTE_MAX_TOUS, aFaire = [], termines = [];
  let plein = false;
  for (let i = lignes.length - 1; i >= 0; i--) {   // du plus récent au plus ancien : au-delà du plafond, ce sont les plus anciens qui manquent
    const r = lignes[i];
    if (demande && cleChantier_(r[COL_N.chantier - 1]) !== cleChantier_(chantier)) continue;
    if (recherche && minus(r[COL_N.texte - 1]).indexOf(recherche) < 0 && minus(r[COL_N.chantier - 1]).indexOf(recherche) < 0) continue;
    if (nouveau && !noteNouvelle_(r, compte, vues)) continue;
    if (noteFaite_(r)) { if (avecTermines) termines.push(r); continue; }
    if (aFaire.length < maxAFaire) aFaire.push(noteObjet_(r, compte, vues, !demande)); else plein = true;
  }
  aFaire.reverse();   // affichés comme une liste dictée : le plus ancien en haut, le dernier ajouté en bas
  // Éléments terminés : les derniers cochés en haut ; le nombre total est rendu même au-delà du plafond
  termines.sort((a, b) => noteMs_(b[COL_N.cocheLe - 1]) - noteMs_(a[COL_N.cocheLe - 1]));
  return avecJeton_({ ok: true, code: 'OK', message: aFaire.length + ' élément(s) à faire',
    data: { aFaire: aFaire, termines: termines.slice(0, NOTE_MAX_TERMINES).map(r => noteObjet_(r, compte, vues, !demande)), nbTermines: termines.length,
      chantier: chantier, heure: heure, plein: plein } }, compte);
}
// Nombre d'éléments nouveaux par chantier visible (chiffres rouges de l'accueil)
function notesNouvelles_(compte) {
  const visibles = {};   // les chantiers que l'accueil montre à ce compte (un poseur ne voit pas un chantier « Terminé »)
  chantiersVisibles_(compte).forEach(c => { visibles[cleChantier_(c.nom)] = true; });
  const vues = notesVues_(compte.id), parChantier = {};
  let total = 0;
  lignesNotes_().forEach(r => {
    if (!visibles[cleChantier_(r[COL_N.chantier - 1])] || !noteNouvelle_(r, compte, vues)) return;
    const nom = String(r[COL_N.chantier - 1]).trim();
    parChantier[nom] = (parChantier[nom] || 0) + 1; total++;
  });
  return avecJeton_({ ok: true, code: 'OK', message: total + ' élément(s) nouveau(x)', data: { parChantier: parChantier, total: total } }, compte);
}

// ── Installation du lot 3 (une fonction par environnement ; relançable sans danger) ──
function etapesLot3_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const etape = (nom, entetes, colonnesTexte) => ({
    nom: 'Onglet « ' + nom + ' »',
    fait: () => { const sh = ss.getSheetByName(nom); return !!sh && noteTitresBons_(sh, entetes); },
    action: () => {
      const sh = ss.getSheetByName(nom);
      if (!sh) { noteFeuille_(nom, entetes, colonnesTexte); return 'onglet créé'; }
      // Onglet déjà là : jamais rien réécrire par-dessus des données
      const titres = sh.getRange(1, 1, 1, Math.max(entetes.length, sh.getLastColumn())).getValues()[0];
      if (sh.getLastRow() > 1 || titres.some(t => String(t).trim() !== '')) throw new Error('un onglet « ' + nom + ' » existe déjà avec d’autres titres : le renommer, puis relancer');
      sh.getRange(1, 1, 1, entetes.length).setValues([entetes]);
      noteFormats_(sh, colonnesTexte);
      return 'onglet prêt';
    } });
  return [
    etape(SHEET_NOTES, NOTE_ENTETES, NOTE_COLONNES_TEXTE),
    etape(SHEET_NOTES_HISTO, NOTE_HISTO_ENTETES, NOTE_HISTO_TEXTE),
    etape(SHEET_NOTES_VUES, NOTE_VUES_ENTETES, [1, 2]),
  ];
}
function installerLot3_(attendu) { return installer_('Lot 3', attendu, etapesLot3_()).texte; }
function installerLot3Test() { return installerLot3_('TEST'); }
function installerLot3Production() { return installerLot3_('PRODUCTION'); }
