// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// LOT 8b — COMPTES RENDUS : le numéro « Compte rendu n° x » d'une note de réunion, par chantier
//
// Le numéro est donné par le SERVEUR, à la réception de la note, sous verrou : deux téléphones ne peuvent pas
// recevoir le même. Il est gardé dans l'onglet « Comptes rendus » (une ligne par note).
//   - une note renvoyée (réponse perdue, PDF raté au premier essai) retrouve SON numéro : la ligne est cherchée
//     par le numéro de fiche créé par le téléphone ;
//   - le numéro suit l'ordre d'arrivée au serveur (pas la date de la réunion) ;
//   - rattachement au chantier : par son N° (onglet Chantiers, colonne E) quand il est rempli, sinon par son nom
//     (minuscules, espaces retirés). Un chantier renommé garde donc sa série s'il a un N° ;
//   - chantier absent de l'onglet Chantiers : la note est envoyée et notée, SANS numéro ;
//   - onglet aux titres changés ou illisible : rien n'y est lu ni écrit, la note part SANS numéro (PDF et mails normaux),
//     Franck est prévenu une fois par jour. Un onglet de suivi ne bloque jamais l'envoi d'une note.
// Les points et leur reprise (colonnes M à O) arrivent avec le lot 8c.
// Plan : docs/lot8-plan.md. Décisions : D8-… (DECISIONS.md).
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
const SHEET_CR = 'Comptes rendus';
const CR_ENTETES = ['Numéro de fiche', 'Chantier', 'N° du chantier', 'N° du compte rendu', 'Date de la réunion', 'Objet',
  'Rédigé par', 'Compte qui a envoyé', 'Présents', 'Nom du PDF', 'Reçu le', 'Remarque de l’appli'];
const COL_CR = { fiche: 1, chantier: 2, numChantier: 3, numero: 4, date: 5, objet: 6, auteur: 7, compte: 8, presents: 9, pdf: 10, recu: 11, remarque: 12 };
// Tout ce qui est du texte saisi reste du texte (une date « 12/11 » ou un numéro « 0403 » ne sont pas transformés)
const CR_COLONNES_TEXTE = [COL_CR.fiche, COL_CR.chantier, COL_CR.numChantier, COL_CR.date, COL_CR.objet, COL_CR.auteur, COL_CR.compte, COL_CR.presents, COL_CR.pdf, COL_CR.remarque];
const CR_MAX_PRESENTS = 40, CR_MAX_NOM = 80;

// ── Petits outils ──
function crOccupe_(message) { return Object.assign(new Error(message || 'Serveur occupé, nouvel essai automatique'), { occupe: true }); }
// Texte d'une ligne : ni retour à la ligne, ni caractère invisible
function crLigne_(v, max) {
  return typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, ' ').replace(/ {2,}/g, ' ').trim().slice(0, max) : '';
}
// Présents saisis à la main : une liste de noms, nettoyée (jamais un refus : la note part toujours)
function crPresents_(v) {
  const vus = {}, liste = [];
  (Array.isArray(v) ? v : []).forEach(x => {
    const nom = crLigne_(x, CR_MAX_NOM), cle = nom.toLowerCase();
    if (!nom || vus[cle] || liste.length >= CR_MAX_PRESENTS) return;
    vus[cle] = true; liste.push(nom);
  });
  return liste;
}
// Clé d'un nom de chantier : minuscules, espaces retirés
function crCleNom_(nom) { return String(nom || '').toLowerCase().replace(/\s+/g, ''); }
function crCleNumero_(n) { return String(n === undefined || n === null ? '' : n).trim().toLowerCase().replace(/\s+/g, ''); }
// Date « jj/mm/aaaa » → nombre comparable (aaaammjj), 0 si illisible
function crJour_(texte) {
  const m = String(texte || '').match(/^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/);
  return m ? Number(m[3]) * 10000 + Number(m[2]) * 100 + Number(m[1]) : 0;
}

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
// Titres changés à la main : rien n'est lu ni écrit, et la fonction rend null (la note partira sans numéro).
// Franck reçoit un mail, une fois par jour, qui nomme la fonction d'installation de CET environnement.
function crFeuille_() {
  const existait = !!SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CR);
  const sh = feuille_(SHEET_CR, CR_ENTETES);
  if (!existait) crFormats_(sh);
  if (crTitresBons_(sh)) return sh;
  let fonction = 'installerLot8Production';
  try { if (environnementReel_().env === 'TEST') fonction = 'installerLot8Test'; } catch (e) {}
  alerte_('Les notes de réunion partent SANS numéro de compte rendu : la ligne de titres de l’onglet « ' + SHEET_CR + ' » n’est plus celle attendue ('
    + CR_ENTETES.join(' | ') + '). Remettez ces titres, ou renommez l’onglet puis lancez ' + fonction + '. '
    + 'Les notes sont envoyées normalement (PDF et mails) ; seuls le numéro et la ligne de l’onglet manquent.', 'comptesrendus');
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
// Numéro du compte rendu déjà donné à une fiche (0 : aucun, ou onglet illisible). Ne crée rien, ne lève jamais d'erreur :
// sert à la réponse « déjà reçue », qui doit partir même si l'onglet a été abîmé depuis.
function crNumeroDeLaFiche_(idFiche) {
  try {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CR);
    if (!sh || !crTitresBons_(sh)) return 0;
    const ligne = crChercher_(sh, idFiche);
    const n = ligne ? Number(sh.getRange(ligne, COL_CR.numero).getValue()) : 0;
    return n > 0 && isFinite(n) ? n : 0;
  } catch (e) { return 0; }
}

// ── Réserver le numéro (à appeler AVANT de fabriquer le PDF) ──
// idFiche : numéro de fiche créé par le téléphone ; brut : données de la note ; qui : texte « compte qui a envoyé ».
// Rend { numero (0 : pas de numéro), horsListe, sansOnglet, dejaLa }. Lève « occupé » si le verrou n'est pas disponible
// (passager : le téléphone réessaie). Onglet illisible : pas d'erreur, la note part sans numéro.
function crReserver_(idFiche, brut, qui) {
  const verrou = LockService.getScriptLock();
  if (!verrou.tryLock(15000)) throw crOccupe_();
  try {
    let sh = null;
    try { sh = crFeuille_(); } catch (e) { console.error('crReserver_ :', e.message); }
    if (!sh) return { numero: 0, horsListe: false, sansOnglet: true, dejaLa: false };
    // Note renvoyée par le téléphone : elle retrouve son numéro, aucune ligne n'est ajoutée
    const deja = crChercher_(sh, idFiche);
    if (deja) {
      const n = Number(sh.getRange(deja, COL_CR.numero).getValue());
      return { numero: n > 0 && isFinite(n) ? n : 0, horsListe: !(n > 0), dejaLa: true };
    }
    const ligneChantier = ligneChantier_(brut.chantier);
    const nomConnu = ligneChantier ? String(ligneChantier[0]).trim() : '';
    const numChantier = ligneChantier && ligneChantier.length > 4 ? String(ligneChantier[4] === undefined || ligneChantier[4] === null ? '' : ligneChantier[4]).trim() : '';
    let numero = 0, remarque = '';
    if (!nomConnu) {
      remarque = 'chantier hors liste : pas de numéro';
    } else {
      // Les notes de CE chantier : même N° de chantier (quand les deux sont remplis), sinon même nom
      const cleNum = crCleNumero_(numChantier), cleNom = crCleNom_(nomConnu);
      const derniere = sh.getLastRow();
      const lignes = derniere > 1 ? sh.getRange(2, 1, derniere - 1, CR_ENTETES.length).getValues() : [];
      let max = 0, jourDuMax = 0, dateDuMax = '';
      lignes.forEach(r => {
        const n = Number(r[COL_CR.numero - 1]);
        if (!(n > 0) || !isFinite(n)) return;
        const numLigne = crCleNumero_(r[COL_CR.numChantier - 1]);
        const meme = cleNum && numLigne ? numLigne === cleNum : crCleNom_(r[COL_CR.chantier - 1]) === cleNom;
        if (!meme) return;
        if (n > max) { max = n; dateDuMax = String(r[COL_CR.date - 1] || ''); jourDuMax = crJour_(dateDuMax); }
      });
      numero = max + 1;
      // Le numéro suit l'ordre d'arrivée : une note restée sans réseau peut porter une date plus ancienne que la précédente
      const jour = crJour_(brut.date);
      if (max && jour && jourDuMax && jour < jourDuMax) remarque = 'reçu après le CR n° ' + max + ' (daté du ' + dateDuMax + ')';
    }
    const ligne = [];
    for (let c = 0; c < CR_ENTETES.length; c++) ligne.push('');
    ligne[COL_CR.fiche - 1] = String(idFiche);
    ligne[COL_CR.chantier - 1] = nomConnu || crLigne_(brut.chantier, 150);
    ligne[COL_CR.numChantier - 1] = numChantier;
    ligne[COL_CR.numero - 1] = numero || '';
    ligne[COL_CR.date - 1] = crLigne_(brut.date, 20);
    ligne[COL_CR.objet - 1] = crLigne_(brut.objet, 300);
    ligne[COL_CR.auteur - 1] = crLigne_(brut.auteur, 150);
    ligne[COL_CR.compte - 1] = String(qui || 'sans compte');
    ligne[COL_CR.presents - 1] = crPresents_(brut.presents).join(' ; ');
    ligne[COL_CR.recu - 1] = new Date();
    ligne[COL_CR.remarque - 1] = remarque;
    // La ligne entière en une écriture (colonnes de texte en « texte brut » avant d'écrire)
    noteAjouterLigne_(sh, ligne, CR_COLONNES_TEXTE);
    // Écriture poussée dans le Sheet AVANT de rendre le verrou : la note suivante du même chantier doit lire cette ligne
    // (sans cela, Google peut la garder en attente jusqu'à la fin de la fabrication du PDF)
    SpreadsheetApp.flush();
    return { numero: numero, horsListe: !nomConnu, dejaLa: false };
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
      // Onglet déjà là : jamais rien réécrire par-dessus des données
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
