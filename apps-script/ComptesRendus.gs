// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// LOT 8 — COMPTES RENDUS : l'onglet « Comptes rendus », une ligne par note de réunion reçue
//
// Un compte rendu se désigne par sa DATE DE RÉUNION (« compte rendu du 06/11/2026 ») : il n'a pas de numéro
// (décision de Franck du 16/11/2026).
//   - la ligne est écrite EN UNE FOIS, à la réception de la note, sous verrou ;
//   - une note renvoyée par le téléphone (réponse perdue, PDF raté au premier essai) n'est jamais notée deux fois :
//     la ligne est cherchée par le numéro de fiche créé par le téléphone ;
//   - l'ordre des comptes rendus d'un chantier est l'ordre d'ARRIVÉE au serveur (colonne « Reçu le ») ;
//   - rattachement au chantier : par son N° (onglet Chantiers, colonne E) quand il est rempli, sinon par son nom
//     (minuscules, espaces retirés). Un chantier renommé garde donc sa suite s'il a un N° ;
//   - onglet aux titres changés ou illisible : rien n'y est lu ni écrit, la note part quand même (PDF et mails normaux),
//     Franck est prévenu une fois par jour. Un onglet de suivi ne bloque jamais l'envoi d'une note.
// Plan : docs/lot8-plan.md. Décisions : D8-… (DECISIONS.md).
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
const SHEET_CR = 'Comptes rendus';
const CR_ENTETES = ['Numéro de fiche', 'Chantier', 'N° du chantier', 'Date de la réunion', 'Objet',
  'Rédigé par', 'Compte qui a envoyé', 'Nom du PDF', 'Reçu le', 'Remarque de l’appli'];
const COL_CR = { fiche: 1, chantier: 2, numChantier: 3, date: 4, objet: 5, auteur: 6, compte: 7, pdf: 8, recu: 9, remarque: 10 };
// Tout ce qui est du texte saisi reste du texte (une date « 12/11 » ou un numéro « 0403 » ne sont pas transformés)
const CR_COLONNES_TEXTE = [COL_CR.fiche, COL_CR.chantier, COL_CR.numChantier, COL_CR.date, COL_CR.objet, COL_CR.auteur, COL_CR.compte, COL_CR.pdf, COL_CR.remarque];

// ── Petits outils ──
function crOccupe_(message) { return Object.assign(new Error(message || 'Serveur occupé, nouvel essai automatique'), { occupe: true }); }
// Texte d'une ligne : ni retour à la ligne, ni caractère invisible
function crLigne_(v, max) {
  return typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, ' ').replace(/ {2,}/g, ' ').trim().slice(0, max) : '';
}
// Clé d'un nom de chantier : minuscules, espaces retirés
function crCleNom_(nom) { return String(nom || '').toLowerCase().replace(/\s+/g, ''); }
function crCleNumero_(n) { return String(n === undefined || n === null ? '' : n).trim().toLowerCase().replace(/\s+/g, ''); }
// Date « jj/mm/aaaa » → nombre comparable (aaaammjj), 0 si illisible
function crJour_(texte) {
  const m = String(texte || '').match(/^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/);
  return m ? Number(m[3]) * 10000 + Number(m[2]) * 100 + Number(m[1]) : 0;
}

// Heure (millisecondes) d’une cellule de date, 0 si ce n’en est pas une
function crMs_(v) { return Object.prototype.toString.call(v) === "[object Date]" && !isNaN(v.getTime()) ? v.getTime() : 0; }

// ── Onglet : créé s'il n'existe pas, VÉRIFIÉ avant toute lecture et toute écriture ──
function crTitresBons_(sh) {
  if (sh.getLastColumn() < CR_ENTETES.length) return false;
  const titres = sh.getRange(1, 1, 1, CR_ENTETES.length).getValues()[0];
  return CR_ENTETES.every((t, i) => String(titres[i]) === t);
}
function crFormats_(sh) {
  const lignes = Math.max(1, sh.getMaxRows() - 1);
  CR_COLONNES_TEXTE.forEach(c => sh.getRange(2, c, lignes, 1).setNumberFormat('@'));
}
// Titres changés à la main : rien n'est lu ni écrit, et la fonction rend null (la note partira sans être notée).
// Franck reçoit un mail, une fois par jour, qui nomme la fonction d'installation de CET environnement.
function crFeuille_() {
  const existait = !!SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CR);
  const sh = feuille_(SHEET_CR, CR_ENTETES);
  if (!existait) crFormats_(sh);
  if (crTitresBons_(sh)) return sh;
  let fonction = 'installerLot8Production';
  try { if (environnementReel_().env === 'TEST') fonction = 'installerLot8Test'; } catch (e) {}
  alerte_('Les notes de réunion ne sont plus notées dans l’onglet « ' + SHEET_CR + ' » : sa ligne de titres n’est plus celle attendue ('
    + CR_ENTETES.join(' | ') + '). Remettez ces titres, ou renommez l’onglet puis lancez ' + fonction + '. '
    + 'Les notes sont envoyées normalement (PDF et mails) ; seule la ligne de l’onglet manque.', 'comptesrendus');
  return null;
}
// Ligne d'une note d'après son numéro de fiche (colonne A), ou 0. Jamais par position : Franck peut trier l'onglet.
function crChercher_(sh, idFiche) {
  const derniere = sh.getLastRow();
  if (derniere < 2) return 0;
  const ids = sh.getRange(2, COL_CR.fiche, derniere - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(idFiche)) return i + 2;
  return 0;
}
// Le chantier d'une note, tel que le bureau le connaît : { nom ('' : hors liste), numero (N° du chantier, colonne E) }
function crChantier_(nom) {
  const l = ligneChantier_(nom);
  return { nom: l ? String(l[0]).trim() : '',
    numero: l && l.length > 4 ? String(l[4] === undefined || l[4] === null ? '' : l[4]).trim() : '' };
}
// La dernière ligne ARRIVÉE pour ce chantier (la plus récente en « Reçu le » ; à égalité, la plus basse de l'onglet), ou null.
// lignes : les valeurs de l'onglet sans la ligne de titres ; sauf : numéro de fiche à ne pas compter (la note elle-même).
function crDerniereLigne_(lignes, chantier, sauf) {
  const cleNum = crCleNumero_(chantier.numero), cleNom = crCleNom_(chantier.nom);
  let meilleure = null, quand = -1;
  lignes.forEach(r => {
    if (!String(r[COL_CR.fiche - 1]) || String(r[COL_CR.fiche - 1]) === String(sauf || '')) return;
    const numLigne = crCleNumero_(r[COL_CR.numChantier - 1]);
    // même N° de chantier (quand les deux sont remplis), sinon même nom
    const meme = cleNum && numLigne ? numLigne === cleNum : crCleNom_(r[COL_CR.chantier - 1]) === cleNom;
    if (!meme) return;
    const t = crMs_(r[COL_CR.recu - 1]);
    if (t >= quand) { quand = t; meilleure = r; }
  });
  return meilleure;
}

// ── Noter la note dans l'onglet (à appeler AVANT de fabriquer le PDF) ──
// idFiche : numéro de fiche créé par le téléphone ; brut : données de la note ; qui : texte « compte qui a envoyé ».
// Rend { horsListe, sansOnglet, dejaLa }. Lève « occupé » si le verrou n'est pas disponible (passager : le téléphone
// réessaie). Onglet illisible : pas d'erreur, la note part sans être notée.
function crEnregistrer_(idFiche, brut, qui) {
  const verrou = LockService.getScriptLock();
  if (!verrou.tryLock(15000)) throw crOccupe_();
  try {
    let sh = null;
    try { sh = crFeuille_(); } catch (e) { console.error('crEnregistrer_ :', e.message); }
    if (!sh) return { horsListe: false, sansOnglet: true, dejaLa: false };
    // Note renvoyée par le téléphone : sa ligne existe déjà, aucune ligne n'est ajoutée
    if (crChercher_(sh, idFiche)) return { horsListe: false, sansOnglet: false, dejaLa: true };
    const chantier = crChantier_(brut.chantier);
    let remarque = '';
    if (!chantier.nom) {
      remarque = 'chantier hors liste';
    } else {
      // L'ordre est celui de l'arrivée : une note restée sans réseau peut porter une date plus ancienne que la précédente
      const derniere = sh.getLastRow();
      const avant = crDerniereLigne_(derniere > 1 ? sh.getRange(2, 1, derniere - 1, CR_ENTETES.length).getValues() : [], chantier, idFiche);
      const dateAvant = avant ? String(avant[COL_CR.date - 1] || '') : '';
      if (crJour_(brut.date) && crJour_(dateAvant) && crJour_(brut.date) < crJour_(dateAvant)) remarque = 'reçu après le compte rendu du ' + dateAvant;
    }
    const ligne = [];
    for (let c = 0; c < CR_ENTETES.length; c++) ligne.push('');
    ligne[COL_CR.fiche - 1] = String(idFiche);
    ligne[COL_CR.chantier - 1] = chantier.nom || crLigne_(brut.chantier, 150);
    ligne[COL_CR.numChantier - 1] = chantier.numero;
    ligne[COL_CR.date - 1] = crLigne_(brut.date, 20);
    ligne[COL_CR.objet - 1] = crLigne_(brut.objet, 300);
    ligne[COL_CR.auteur - 1] = crLigne_(brut.auteur, 150);
    ligne[COL_CR.compte - 1] = String(qui || 'sans compte');
    ligne[COL_CR.recu - 1] = new Date();
    ligne[COL_CR.remarque - 1] = remarque;
    // Lot 8d : le texte de la note va en colonne K, SI cette colonne est installée (sinon rien ne change : lot 8)
    const avecTexte = recapAvecTexte_(sh);
    if (avecTexte) ligne.push(recapTexte_(brut));
    // La ligne entière en une écriture (colonnes de texte en « texte brut » avant d'écrire)
    noteAjouterLigne_(sh, ligne, avecTexte ? CR_COLONNES_TEXTE.concat([COL_CR_TEXTE]) : CR_COLONNES_TEXTE);
    // Écriture poussée dans le Sheet AVANT de rendre le verrou : la note suivante du même chantier doit lire cette ligne
    // (sans cela, Google peut la garder en attente jusqu'à la fin de la fabrication du PDF)
    SpreadsheetApp.flush();
    // Lot 8d : le récapitulatif du chantier sera refait au prochain passage de 10 minutes (jamais pendant l'envoi)
    if (avecTexte) recapDemander_(chantier);
    return { horsListe: !chantier.nom, sansOnglet: false, dejaLa: false };
  } finally { verrou.releaseLock(); }
}
// Nom du PDF rangé dans Drive, noté après le rangement (la ligne est retrouvée par le numéro de fiche).
// Un échec ici ne fait jamais échouer la note : le PDF est rangé et les mails partent.
function crNoterPdf_(idFiche, nom) {
  try {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CR);
    if (!sh || !crTitresBons_(sh)) return;
    const ligne = crChercher_(sh, idFiche);
    if (ligne) sh.getRange(ligne, COL_CR.pdf).setValue(cellule_(String(nom || '')));
  } catch (e) { console.error('crNoterPdf_ :', e.message); }
}

// ── Installation du lot 8 (une fonction par environnement ; relançable sans danger) ──
function etapesLot8_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return [{
    nom: 'Onglet « ' + SHEET_CR + ' »',
    fait: () => { const sh = ss.getSheetByName(SHEET_CR); return !!sh && crTitresBons_(sh); },
    action: () => {
      const sh = ss.getSheetByName(SHEET_CR);
      if (!sh) { feuille_(SHEET_CR, CR_ENTETES); crFormats_(ss.getSheetByName(SHEET_CR)); return 'onglet créé'; }
      // Onglet déjà là : jamais rien réécrire par-dessus des données (un onglet d'un essai précédent, avec d'autres
      // titres, se renomme à la main : l'installation en crée alors un neuf)
      const titres = sh.getRange(1, 1, 1, Math.max(CR_ENTETES.length, sh.getLastColumn())).getValues()[0];
      if (sh.getLastRow() > 1 || titres.some(t => String(t).trim() !== '')) throw new Error('un onglet « ' + SHEET_CR + ' » existe déjà avec d’autres titres : le renommer, puis relancer');
      sh.getRange(1, 1, 1, CR_ENTETES.length).setValues([CR_ENTETES]);
      crFormats_(sh);
      return 'onglet prêt';
    } }];
}
function installerLot8_(attendu) { return installer_('Lot 8', attendu, etapesLot8_()).texte; }
function installerLot8Test() { return installerLot8_('TEST'); }
function installerLot8Production() { return installerLot8_('PRODUCTION'); }
