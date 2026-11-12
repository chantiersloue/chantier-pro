// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// LOT 7 — SIGNALEMENTS (casse / manquant / à recommander)
//
// Un signalement arrive comme une fiche (actions « photo » puis « fiche », type « signalement ») : numéro unique,
// photos, onglet Envois, tout cela est commun (Api.gs). Ce fichier ajoute :
//   - validerSignalement_ : refus DÉFINITIF des données invalides, avant tout traitement ;
//   - traiterSignalement  : une ligne dans l'onglet « Signalements » (écrite EN PREMIER, jamais deux fois),
//                           un PDF (informations + photos) rangé dans le dossier du chantier, le mail ;
//   - listerSignalements_ / changerStatutSignalement_ : le suivi, selon le rôle ;
//   - installerLot7Test / installerLot7Production.
// Décisions : D7-1 à D7-3 (DECISIONS.md), plan : docs/lot7-plan.md.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
const SHEET_SIGNALEMENTS = 'Signalements';
const SIG_TYPES    = ['Casse', 'Manquant', 'À recommander'];
const SIG_URGENCES = ['Bloquant', 'Cette semaine', 'Pas urgent'];
const SIG_STATUTS  = ['À traiter', 'Commandé', 'Livré', 'Clos'];
const SIG_ROLES_SUIVI = ['Conducteur', 'Admin', 'Atelier'];   // voient tous les signalements et changent le statut
const SIG_MAX_LEGENDE = 80;
const SIG_MAX_PHOTOS = 3, SIG_MAX_REPERE = 120, SIG_MAX_COMMENTAIRE = 2000, SIG_MAX_CHANTIER = 150, SIG_MAX_LISTE = 100;
const SIG_ENTETES = ['Numéro', 'Reçu le', 'Chantier', 'Auteur (identifiant)', 'Auteur', 'Type', 'Urgence', 'Repère', 'Commentaire', 'Photos',
  'Atelier prévenu', 'Remarque', 'Statut', 'Statut modifié par l’appli le', 'Statut modifié par l’appli par', 'Mail à la réception', 'Saisi le'];
const COL_S = { id: 1, recu: 2, chantier: 3, auteurId: 4, auteur: 5, type: 6, urgence: 7, repere: 8, commentaire: 9, photos: 10,
  atelier: 11, remarque: 12, statut: 13, modifLe: 14, modifPar: 15, mail: 16, saisi: 17 };

// ── Contrôle des données : '' si tout va bien, sinon la raison du refus (code DONNEES_INVALIDES, définitif) ──
// photosJointes : vrai quand le serveur a déjà remplacé les références des photos par leurs images (2e passage)
function validerSignalement_(d, photosJointes) {
  d = d || {};
  const texte = v => (typeof v === 'string' ? v.trim() : '');
  const CONTROLE = /[\u0000-\u001f\u007f]/, CONTROLE_SAUF_LIGNES = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
  if (typeof d.date !== 'string' || !/^\d{2}\/\d{2}\/\d{4}$/.test(d.date)) return 'Date invalide';
  if (typeof d.heure !== 'string' || !/^\d{2}h\d{2}$/.test(d.heure)) return 'Heure invalide';
  if (SIG_TYPES.indexOf(d.type_signalement) < 0) return 'Type de signalement inconnu';
  if (SIG_URGENCES.indexOf(d.urgence) < 0) return 'Urgence inconnue';
  const chantier = texte(d.chantier);
  if (!chantier) return 'Chantier manquant';
  if (chantier.length > SIG_MAX_CHANTIER) return 'Nom de chantier trop long';
  if (CONTROLE.test(chantier)) return 'Nom de chantier invalide';
  if (d.repere != null && typeof d.repere !== 'string') return 'Repère invalide';
  if (d.commentaire != null && typeof d.commentaire !== 'string') return 'Commentaire invalide';
  if (CONTROLE.test(texte(d.repere))) return 'Repère invalide';
  if (CONTROLE_SAUF_LIGNES.test(texte(d.commentaire))) return 'Commentaire invalide';
  if (texte(d.repere).length > SIG_MAX_REPERE) return 'Repère trop long (' + SIG_MAX_REPERE + ' caractères au plus)';
  if (texte(d.commentaire).length > SIG_MAX_COMMENTAIRE) return 'Commentaire trop long (' + SIG_MAX_COMMENTAIRE + ' caractères au plus)';
  const photos = d.photosBase64 == null ? [] : d.photosBase64;
  if (!Array.isArray(photos)) return 'Photos invalides';
  if (photos.length > SIG_MAX_PHOTOS) return SIG_MAX_PHOTOS + ' photos au plus pour un signalement';
  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    if (!p || typeof p !== 'object' || Array.isArray(p)) return 'Photo invalide';
    if (p.label != null && (typeof p.label !== 'string' || p.label.length > SIG_MAX_LEGENDE || CONTROLE.test(p.label))) return 'Légende de photo invalide';
    // À la réception : seulement une référence à une photo déposée par l'action « photo » (jamais une image glissée dans la fiche)
    if (!photosJointes && (!idValide_(p.photoRef) || Object.keys(p).some(k => k !== 'photoRef' && k !== 'label'))) return 'Photo invalide';
  }
  if (!texte(d.repere) && !texte(d.commentaire) && !photos.length) return 'Signalement vide : il faut un repère, un commentaire ou une photo';
  if (d.atelier != null && d.atelier !== true && d.atelier !== false) return 'Case « atelier » invalide';
  return '';
}

// ── Onglet ──
function feuilleSignalements_() {
  const existait = !!SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SIGNALEMENTS);
  const sh = feuille_(SHEET_SIGNALEMENTS, SIG_ENTETES);
  if (!existait) preparerOngletSignalements_(sh);
  return sh;
}
// Liste déroulante des statuts, et colonnes de texte en « texte brut » : sans cela Sheets transformerait un repère
// « 1/2 » en date ou un identifiant « 0123 » en nombre (et le poseur ne retrouverait plus « les siens »)
function preparerOngletSignalements_(sh) {
  const lignes = Math.max(1, sh.getMaxRows() - 1);
  [COL_S.id, COL_S.chantier, COL_S.auteurId, COL_S.auteur, COL_S.repere, COL_S.commentaire, COL_S.remarque, COL_S.saisi]
    .forEach(c => sh.getRange(2, c, lignes, 1).setNumberFormat('@'));
  sh.getRange(2, COL_S.statut, lignes, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(SIG_STATUTS).setAllowInvalid(true).build());
}
// Ligne d'un signalement d'après son numéro (colonne A), ou 0. Jamais par position : Franck peut trier l'onglet.
function chercherSignalement_(sh, id) {
  const derniere = sh.getLastRow();
  if (derniere < 2) return 0;
  const ids = sh.getRange(2, COL_S.id, derniere - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return 0;
}
function statutLu_(v) { const s = String(v || '').trim(); return SIG_STATUTS.indexOf(s) > -1 ? s : SIG_STATUTS[0]; }

// Adresses de TOUS les chefs d'atelier (onglet Contacts, colonne G « ChefAtelier » = O), sans doublon
function chefsAtelier_() {
  const vues = {}, res = [];
  getContactsRaw().filter(r => String(r[6] || '').trim().toUpperCase() === 'O').forEach(r => {
    decouperAdresses_(r[2]).forEach(a => { const c = a.toLowerCase(); if (!vues[c]) { vues[c] = true; res.push(a); } });
  });
  return res;
}

// ── Traitement d'un signalement reçu (appelé par traiterFiche_) ──
// contexte : { id (numéro de la fiche), auteurId (identifiant VÉRIFIÉ par le jeton, '' si sans compte), auteurNom }
// Ordre : la ligne d'abord (un PDF ou un mail en panne ne fait jamais perdre le signalement), puis PDF, rangement, mail.
// Rappelé après une panne, il retrouve la ligne par son numéro et ne la réécrit pas.
function traiterSignalement(data, brut, contexte) {
  if (!contexte || !contexte.id) throw new Error('Signalement refusé : numéro de fiche absent (page trop ancienne)');
  const refus = validerSignalement_(brut, true);
  if (refus) throw new Error(refus);
  const texte = v => (typeof v === 'string' ? v.trim() : '');
  const chantier = texte(brut.chantier), type = brut.type_signalement, urgence = brut.urgence;
  const repere = texte(brut.repere), commentaire = texte(brut.commentaire);
  const photos = Array.isArray(brut.photosBase64) ? brut.photosBase64 : [];
  const atelier = brut.atelier === true;
  const saisi = (texte(brut.date) + ' ' + texte(brut.heure)).trim().slice(0, 30);
  const auteurNom = contexte.auteurNom || 'sans compte';

  // Toutes les lectures du Sheet AVANT le PDF et le mail
  const chefs = atelier ? chefsAtelier_() : [];
  const remarque = atelier && !chefs.length ? 'aucun chef d’atelier dans l’onglet Contacts (colonne ChefAtelier = O)' : '';
  const conducteur = emailConducteurChantier_(chantier) || emailAdmin_();

  // 1. La ligne, une seule fois (onglet créé sous verrou s'il manque)
  const verrou = LockService.getScriptLock();
  if (!verrou.tryLock(15000)) throw new Error('Serveur occupé (onglet Signalements)');
  let sh, dejaTraite = false;
  try {
    sh = feuilleSignalements_();
    const existante = chercherSignalement_(sh, contexte.id);
    // Nouvel essai après une coupure : si le mail de ce signalement est déjà parti (ou reporté), on ne refait ni PDF ni mail
    if (existante) dejaTraite = String(sh.getRange(existante, COL_S.mail).getValue()) !== 'en cours';
    else {
      const ligne = [];
      for (let c = 1; c <= SIG_ENTETES.length; c++) ligne.push('');
      ligne[COL_S.id - 1] = contexte.id; ligne[COL_S.recu - 1] = new Date(); ligne[COL_S.chantier - 1] = chantier;
      ligne[COL_S.auteurId - 1] = contexte.auteurId || ''; ligne[COL_S.auteur - 1] = auteurNom;
      ligne[COL_S.type - 1] = type; ligne[COL_S.urgence - 1] = urgence; ligne[COL_S.repere - 1] = repere; ligne[COL_S.commentaire - 1] = commentaire;
      ligne[COL_S.photos - 1] = photos.length; ligne[COL_S.atelier - 1] = atelier ? 'Oui' : 'Non'; ligne[COL_S.remarque - 1] = remarque;
      ligne[COL_S.statut - 1] = SIG_STATUTS[0]; ligne[COL_S.mail - 1] = 'en cours'; ligne[COL_S.saisi - 1] = saisi;
      sh.appendRow(ligne.map(cellule_));
    }
  } finally { verrou.releaseLock(); }
  if (dejaTraite) return;

  // 2. Le PDF (informations + photos), rangé dans le dossier du chantier
  const heure = texte(brut.heure).replace(/[^0-9]/g, 'h').replace(/h+$/, '');
  const nomPDF = nomFichier_('Signalement_' + type + '_' + chantier + '_' + texte(brut.date).replace(/\//g, '-') + '.pdf');
  const pourPdf = Object.assign(validerImages_(brut), { type: type, auteur: auteurNom, chantier: chantier, repere: repere, commentaire: commentaire, atelier: atelier });
  const blob = pdfDuModele_(modele_signalement, pourPdf, nomPDF);
  const fichier = classerDocument_('signalement', blob, chantier, brut.date, (type + ' ' + heure).trim());

  // 3. Le mail : conducteur du chantier (sinon Franck), et les chefs d'atelier si la case est cochée
  const corps = [
    'Signalement — ' + type + ' — ' + urgence,
    'Chantier : ' + chantier,
    repere ? 'Repère : ' + repere : '',
    commentaire ? 'Commentaire : ' + commentaire : '',
    'Signalé par : ' + auteurNom + (saisi ? ', le ' + texte(brut.date) + ' à ' + texte(brut.heure) : ''),
    'Photos : ' + (photos.length ? photos.length + ' (dans le PDF joint)' : 'aucune'),
    'Atelier prévenu : ' + (atelier ? 'oui' : 'non'),
    '',
    'Suivi : appli Loué, tuile « Signalements ».',
    '',
    'Loué App',
  ].filter((l, i, t) => l !== '' || (i > 0 && t[i - 1] !== '')).join('\n');
  distribuer_({
    fiche: 'signalement', chantier: chantier, adresses: [conducteur].concat(chefs),
    sujet: '[Loué App] Signalement — ' + type + ' — ' + chantier, texte: corps,
    fichier: fichier, nomPDF: nomPDF, faireBlob: () => blob,
  });

  // 4. Ce qui s'est passé pour le mail, noté sur la ligne (retrouvée par son numéro)
  const n = k => (RAPPORT_ && RAPPORT_[k] ? RAPPORT_[k].length : 0);
  const mail = n('envoyé') && n('reporté') ? 'envoyé et reporté' : n('reporté') ? 'reporté' : n('envoyé') ? 'envoyé' : 'aucun';
  try {
    const ligne = chercherSignalement_(sh, contexte.id);
    if (ligne) sh.getRange(ligne, COL_S.mail).setValue(mail);
  } catch (e) { console.error('traiterSignalement (colonne Mail) :', e.message); }
}

// ── Suivi : lecture ──
// Qui voit quoi : Conducteur, Admin, Atelier → tous ; Poseur → les siens (identifiant vérifié à l'envoi).
// Le filtre par rôle passe AVANT tout autre ; aucun total n'est rendu.
function listerSignalements_(compte, corps) {
  const voitTout = SIG_ROLES_SUIVI.indexOf(compte.role) > -1;
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SIGNALEMENTS);
  const derniere = sh ? sh.getLastRow() : 0;
  const lignes = derniere > 1 ? sh.getRange(2, 1, derniere - 1, SIG_ENTETES.length).getValues() : [];
  const chantier = typeof corps.chantier === 'string' ? corps.chantier.trim().toLowerCase().slice(0, SIG_MAX_CHANTIER) : '';
  const tout = corps.tout === true;
  const date = v => (v instanceof Date ? texteDate_(v.getTime()) : String(v || ''));
  const res = [];
  for (let i = lignes.length - 1; i >= 0 && res.length < SIG_MAX_LISTE; i--) {   // les plus récents d'abord
    const r = lignes[i];
    const id = String(r[COL_S.id - 1] || '');
    if (!id) continue;
    const mien = !!compte.id && String(r[COL_S.auteurId - 1] || '') === compte.id;
    if (!voitTout && !mien) continue;
    if (chantier && String(r[COL_S.chantier - 1] || '').trim().toLowerCase() !== chantier) continue;
    const statut = statutLu_(r[COL_S.statut - 1]);
    if (!tout && statut === 'Clos') continue;
    res.push({ id: id, recu: date(r[COL_S.recu - 1]), saisi: String(r[COL_S.saisi - 1] || ''), chantier: String(r[COL_S.chantier - 1] || ''),
      auteur: String(r[COL_S.auteur - 1] || ''), type: String(r[COL_S.type - 1] || ''), urgence: String(r[COL_S.urgence - 1] || ''),
      repere: String(r[COL_S.repere - 1] || ''), commentaire: String(r[COL_S.commentaire - 1] || ''), photos: Number(r[COL_S.photos - 1]) || 0,
      atelier: String(r[COL_S.atelier - 1] || '') === 'Oui', statut: statut,
      mailReporte: /reporté/.test(String(r[COL_S.mail - 1] || '')),
      modifLe: date(r[COL_S.modifLe - 1]), modifPar: String(r[COL_S.modifPar - 1] || ''), mien: mien });
  }
  return avecJeton_({ ok: true, code: 'OK', message: res.length + ' signalement(s)',
    data: { signalements: res, peutChanger: voitTout, statuts: SIG_STATUTS, plein: res.length >= SIG_MAX_LISTE } }, compte);
}

// ── Suivi : changement de statut (Conducteur, Admin, Atelier) ──
// Même réponse pour « inconnu » et « interdit » : on n'apprend pas qu'un numéro existe.
function changerStatutSignalement_(compte, corps) {
  const REFUS = { ok: false, code: 'INTERDIT', message: 'Signalement introuvable, ou vous ne pouvez pas changer son statut.' };
  if (SIG_ROLES_SUIVI.indexOf(compte.role) < 0) return avecJeton_(REFUS, compte);
  if (typeof corps.statut !== 'string' || SIG_STATUTS.indexOf(corps.statut) < 0) return avecJeton_({ ok: false, code: 'DONNEES_INVALIDES', message: 'Statut inconnu' }, compte);
  if (typeof corps.id !== 'string' || !idValide_(corps.id)) return avecJeton_(REFUS, compte);
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SIGNALEMENTS);
  if (!sh) return avecJeton_(REFUS, compte);
  const verrou = LockService.getScriptLock();
  if (!verrou.tryLock(15000)) return avecJeton_({ ok: false, code: 'SERVEUR_OCCUPE', message: 'Serveur occupé : réessayez dans un instant.' }, compte);
  try {
    const ligne = chercherSignalement_(sh, corps.id);   // cherché sous verrou, par son numéro
    if (!ligne) return avecJeton_(REFUS, compte);
    const maintenant = new Date();
    sh.getRange(ligne, COL_S.statut, 1, 3).setValues([[corps.statut, maintenant, cellule_(compte.nom || compte.id)]]);
    return avecJeton_({ ok: true, code: 'OK', message: 'Statut enregistré : ' + corps.statut,
      data: { id: corps.id, statut: corps.statut, modifLe: texteDate_(maintenant.getTime()), modifPar: compte.nom || compte.id } }, compte);
  } finally { verrou.releaseLock(); }
}

// ── Installation du lot 7 (une fonction par environnement ; relançable sans danger) ──
function etapesLot7_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const regleStatut = sh => {
    try { return sh.getRange(2, COL_S.statut).getDataValidation(); } catch (e) { return null; }
  };
  return [
    { nom: 'Onglet « ' + SHEET_SIGNALEMENTS + ' » (titres et liste déroulante des statuts)',
      fait: () => {
        const sh = ss.getSheetByName(SHEET_SIGNALEMENTS);
        if (!sh) return false;
        const titres = sh.getRange(1, 1, 1, SIG_ENTETES.length).getValues()[0];
        return SIG_ENTETES.every((t, i) => String(titres[i]) === t) && !!regleStatut(sh);
      },
      action: () => {
        const sh = ss.getSheetByName(SHEET_SIGNALEMENTS);
        if (!sh) { feuilleSignalements_(); return 'onglet créé'; }   // titres, liste des statuts, colonnes de texte en texte brut
        // Onglet déjà là (créé par un premier signalement, ou par quelqu'un) : jamais rien réécrire par-dessus des données
        const titres = sh.getRange(1, 1, 1, SIG_ENTETES.length).getValues()[0];
        if (!SIG_ENTETES.every((t, i) => String(titres[i]) === t)) {
          if (sh.getLastRow() > 1 || titres.some(t => String(t).trim() !== '')) throw new Error('un onglet « ' + SHEET_SIGNALEMENTS + ' » existe déjà avec d’autres titres : le renommer, puis relancer');
          sh.getRange(1, 1, 1, SIG_ENTETES.length).setValues([SIG_ENTETES]);
        }
        preparerOngletSignalements_(sh);
        return 'onglet prêt';
      } },
  ];
}
// Informations utiles à Franck (jamais bloquantes) : chantiers en cours sans conducteur, chefs d'atelier
function infosLot7_() {
  const sans = lignesChantiers_().filter(r => String(r[2] || '').trim() === STATUTS_CHANTIER[1] && !emailContact_(r[3])).map(r => String(r[0]));
  const chefs = chefsAtelier_().length;
  return [
    sans.length ? 'ℹ ' + sans.length + ' chantier(s) « ' + STATUTS_CHANTIER[1] + ' » sans conducteur connu (onglet Chantiers, colonne D vide ou nom absent de Contacts) : leurs signalements arriveront à Franck'
                : 'ℹ Tous les chantiers « ' + STATUTS_CHANTIER[1] + ' » ont un conducteur connu.',
    chefs ? 'ℹ Chef(s) d’atelier (Contacts, ChefAtelier = O) : ' + chefs + ' adresse(s).'
          : 'ℹ Aucun chef d’atelier dans Contacts (colonne ChefAtelier = O) : la case « Prévenir l’atelier » n’enverra de mail à personne.',
  ].join('\n');
}
function installerLot7_(attendu) {
  const r = installer_('Lot 7', attendu, etapesLot7_());
  let infos = '';
  if (r.ok) { try { infos = '\n' + infosLot7_(); } catch (e) { infos = '\n(informations indisponibles : ' + e.message + ')'; } Logger.log(infos); }
  return r.texte + infos;
}
function installerLot7Test() { return installerLot7_('TEST'); }
function installerLot7Production() { return installerLot7_('PRODUCTION'); }
