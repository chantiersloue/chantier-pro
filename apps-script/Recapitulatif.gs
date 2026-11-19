// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// LOT 8d — RÉCAPITULATIF DES NOTES DE RÉUNION, par chantier
//
// Demande de Franck (19/11/2026) : pour chaque chantier, un seul document qui reprend toutes les notes de réunion,
// la date et le texte, sans les photos, la plus récente en haut.
//   - le TEXTE de chaque note est gardé dans l'onglet « Comptes rendus », colonne K « Texte de la note ». Cette colonne
//     est posée par installerLot8dTest / installerLot8dProduction. TANT QU'ELLE N'EXISTE PAS, RIEN NE CHANGE : le serveur
//     se comporte comme celui du lot 8 (ni texte gardé, ni récapitulatif) ;
//   - le fichier « RÉCAPITULATIF DES NOTES - <chantier>.pdf » est REFAIT dans le dossier des notes du chantier
//     (05 - CHANTIER/COMPTE RENDU), dans les 10 minutes, par le passage qui existe déjà (traiterComptes). L'envoi d'une
//     note n'est donc jamais ralenti ni bloqué par le récapitulatif ; un échec est retenté au passage suivant ;
//   - l'ancien fichier part à la corbeille de Drive (il y reste 30 jours) : c'est le seul fichier que le serveur remplace ;
//   - l'appli lit la même liste par l'action « recapNotes » (réservée aux comptes qui ont accès au chantier).
// Plan : docs/lot8d-plan.md. Décisions : D8d-… (DECISIONS.md).
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
const CR_TITRE_TEXTE = 'Texte de la note';
const COL_CR_TEXTE = 11;                     // colonne K, juste après les 10 colonnes du lot 8
const RECAP_TEXTE_MAX = 20000;               // caractères gardés par note dans l'onglet (une cellule en accepte 50 000)
const RECAP_PROP = 'RECAP_A_REFAIRE';        // propriété du script : les chantiers dont le fichier est à refaire
const RECAP_PREFIXE = 'RÉCAPITULATIF DES NOTES - ';
const RECAP_MAX_PAR_PASSAGE = 4;             // fichiers refaits par passage de 10 minutes, au plus
const RECAP_BUDGET_MS = 60000;               // et jamais plus d'une minute par passage
const RECAP_ESSAIS_ALERTE = 6;               // un fichier raté 6 fois de suite (une heure) : Franck est prévenu
const RECAP_ESSAIS_MAX = 30;                 // raté 30 fois : on n'insiste plus (la prochaine note le redemandera)
const RECAP_NOTES_MAX = 300;                 // notes d'un chantier reprises, au plus (les plus récentes)
const RECAP_REFUS = 'Ce chantier n’est pas dans votre liste.';

// ── L'onglet a-t-il la colonne du texte ? (non : le lot 8d n'est pas installé, rien ne change) ──
function recapAvecTexte_(sh) {
  return !!sh && sh.getLastColumn() >= COL_CR_TEXTE && String(sh.getRange(1, COL_CR_TEXTE).getValue()) === CR_TITRE_TEXTE;
}
// Le texte d'une note, tel qu'il est gardé : les retours à la ligne restent, les caractères invisibles partent
function recapTexte_(brut) {
  const saisi = typeof brut.remarques === 'string' ? brut.remarques : (typeof brut.commentaires === 'string' ? brut.commentaires : '');
  const propre = saisi.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u2028\u2029]+/g, ' ').replace(/[ \t]+\n/g, '\n').trim();
  return propre.length > RECAP_TEXTE_MAX ? propre.slice(0, RECAP_TEXTE_MAX) + '\n[… texte coupé : la suite est dans le PDF de la note]' : propre;
}

// ── La liste d'attente : { clé du chantier : { nom, n (nombre de demandes), essais } } ──
function recapAttente_() {
  try {
    const lu = JSON.parse(PropertiesService.getScriptProperties().getProperty(RECAP_PROP) || '{}');
    return lu && typeof lu === 'object' && !Array.isArray(lu) ? lu : {};
  } catch (e) { return {}; }
}
function recapEcrireAttente_(attente) {
  const props = PropertiesService.getScriptProperties();
  if (Object.keys(attente).length) props.setProperty(RECAP_PROP, JSON.stringify(attente));
  else props.deleteProperty(RECAP_PROP);
}
// Le chantier vu par le récapitulatif : { nom, numero, cleNum, cleNom } (nom vide : hors liste).
// cleNum n'est rempli que si ce N° est porté par UNE SEULE ligne de l'onglet Chantiers. Deux chantiers de même N° (deux
// lots d'une même opération) ne partagent donc jamais leurs notes : chacun est suivi par son NOM EXACT, celui sur
// lequel les droits d'accès sont vérifiés (cleChantier_, comme peutLireChantier_). Après relecture indépendante (B1).
function recapNumeroLigne_(r) { return crCleNumero_(r.length > 4 ? r[4] : ''); }
function recapChantier_(nom) {
  const c = crChantier_(nom);
  if (!c.nom) return { nom: '', numero: '', cleNum: '', cleNom: '' };
  const num = crCleNumero_(c.numero);
  const memes = num ? lignesChantiers_().filter(r => recapNumeroLigne_(r) === num).length : 0;
  return { nom: c.nom, numero: c.numero, cleNum: memes === 1 ? num : '', cleNom: cleChantier_(c.nom) };
}
// Le chantier d'une entrée de la liste d'attente : retrouvé par son N° s'il a été renommé entre la note et le passage
function recapChantierEntree_(entree) {
  const c = recapChantier_(entree.nom);
  if (c.nom || !entree.numero) return c;
  const num = crCleNumero_(entree.numero);
  const lignes = lignesChantiers_().filter(r => recapNumeroLigne_(r) === num);
  return lignes.length === 1 ? recapChantier_(String(lignes[0][0]).trim()) : c;
}
function recapCle_(chantier) { return chantier.cleNum ? 'n:' + chantier.cleNum : 'c:' + chantier.cleNom; }
// À appeler SOUS VERROU (crEnregistrer_ le tient) : le fichier de ce chantier sera refait au prochain passage.
// Ne lève jamais d'erreur : une note ne doit pas échouer à cause du récapitulatif.
function recapDemander_(chantierNote) {
  try {
    const chantier = chantierNote && chantierNote.nom ? recapChantier_(chantierNote.nom) : null;
    if (!chantier || !chantier.nom) return;
    const attente = recapAttente_(), cle = recapCle_(chantier), avant = attente[cle] || {};
    // Les essais ratés ne repartent pas de zéro à chaque note : sinon, sur un chantier actif en panne, l'alerte ne partirait jamais
    attente[cle] = { nom: chantier.nom.slice(0, 100), numero: chantier.cleNum ? String(chantier.numero).slice(0, 30) : '',
      n: Number(avant.n || 0) + 1, essais: Number(avant.essais || 0) };
    // Une propriété du script contient 9 000 caractères au plus : au-delà de 8 000 (des dizaines de chantiers en attente,
    // jamais vu), ce chantier n'est pas noté ; sa prochaine note le redemandera
    if (JSON.stringify(attente).length > 8000) return;
    recapEcrireAttente_(attente);
  } catch (e) { console.error('recapDemander_ :', e.message); }
}

// ── Les notes d'un chantier, la plus récente en haut ──
// Rend [{ date, objet, auteur, texte, sansTexte, pdf }] ; chantier : { nom, numero, cleNum, cleNom } (recapChantier_).
function recapNotes_(sh, chantier) {
  const derniere = sh.getLastRow();
  if (derniere < 2) return [];
  const avecTexte = recapAvecTexte_(sh);
  const lignes = sh.getRange(2, 1, derniere - 1, avecTexte ? COL_CR_TEXTE : CR_ENTETES.length).getValues();
  // (un texte qui commence par « - », « = », « + » ou « @ » est écrit avec une apostrophe devant, pour ne jamais devenir
  // une formule : cellule_. Sheets ne la rend pas à la lecture ; si elle est là quand même, elle est retirée.)
  const lu = v => String(v === undefined || v === null ? '' : v).replace(/^'(?=[=+@-])/, '');
  const notes = [];
  lignes.forEach((r, i) => {
    if (!String(r[COL_CR.fiche - 1])) return;
    const numLigne = crCleNumero_(r[COL_CR.numChantier - 1]);
    // même N° de chantier quand ce N° est celui d'un seul chantier et que la ligne en porte un ; sinon même nom EXACT
    const meme = chantier.cleNum && numLigne ? numLigne === chantier.cleNum : cleChantier_(r[COL_CR.chantier - 1]) === chantier.cleNom;
    if (!meme) return;
    const texte = avecTexte ? lu(r[COL_CR_TEXTE - 1]) : '';
    notes.push({ date: String(r[COL_CR.date - 1] || ''), objet: lu(r[COL_CR.objet - 1]), auteur: lu(r[COL_CR.auteur - 1]),
      texte: texte, sansTexte: !texte, pdf: String(r[COL_CR.pdf - 1] || ''), jour: crJour_(r[COL_CR.date - 1]), recu: crMs_(r[COL_CR.recu - 1]), rang: i });
  });
  // date de réunion la plus récente d'abord ; même jour : la dernière arrivée d'abord ; sinon la plus basse de l'onglet
  notes.sort((a, b) => (b.jour - a.jour) || (b.recu - a.recu) || (b.rang - a.rang));
  return notes.slice(0, RECAP_NOTES_MAX).map(n => ({ date: n.date, objet: n.objet, auteur: n.auteur, texte: n.texte, sansTexte: n.sansTexte, pdf: n.pdf }));
}

// ── Le document (tableaux et styles en ligne seulement : le convertisseur PDF de Google ne connaît ni flex ni grid) ──
function recapNomFichier_(nomChantier) {
  return nomFichier_((RECAP_PREFIXE + String(nomChantier || '').trim()).replace(/[\\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ')) + '.pdf';
}
function recapHtml_(nomChantier, notes, quand) {
  const TEXTE = 'white-space:pre-wrap;word-break:break-word;overflow-wrap:break-word;';
  const blocs = notes.map(n => {
    const titre = 'Réunion du ' + esc_(n.date || '—') + (n.objet ? ' — ' + esc_(n.objet) : '');
    const corps = n.sansTexte
      ? '<div style="font-size:10px;color:#6A6460;font-style:italic">Texte dans le PDF de la note' + (n.pdf ? ' (' + esc_(n.pdf) + ')' : '') + '.</div>'
      : '<div style="font-size:11px;line-height:1.6;' + TEXTE + '">' + esc_(n.texte) + '</div>';
    return '<div style="margin-bottom:10px;padding:8px 10px;border:1px solid #D8D4CE;border-left:4px solid #0D7A6B;border-radius:4px">'
      + '<div style="font-size:11.5px;font-weight:800;color:#1A2B4A;' + TEXTE + '">' + titre + '</div>'
      + (n.auteur ? '<div style="font-size:9px;color:#6A6460;margin-bottom:5px">Rédigé par ' + esc_(n.auteur) + '</div>' : '<div style="margin-bottom:5px"></div>')
      + corps + '</div>';
  }).join('');
  return '<html><head><meta charset="utf-8"><style>@page{size:A4;margin:1.5cm}body{font-family:Arial,sans-serif;font-size:10px;margin:0}*{box-sizing:border-box}</style></head><body>'
    + '<table style="width:100%;border-collapse:collapse;margin-bottom:12px;border-bottom:3px solid #0D7A6B"><tr>'
    + '<td style="vertical-align:middle;padding:0 0 10px">'
    + '<div style="font-weight:800;font-size:15px;color:#1A2B4A">' + esc_(NOM_ENTREPRISE) + '</div>'
    + '<div style="font-weight:800;font-size:14px;color:#0D7A6B;margin-top:4px">RÉCAPITULATIF DES NOTES DE RÉUNION</div>'
    + '<div style="font-size:12px;font-weight:800;color:#141210;margin-top:4px;' + TEXTE + '">' + esc_(nomChantier) + '</div>'
    + '<div style="font-size:9px;color:#6A6460;margin-top:4px">' + notes.length + (notes.length > 1 ? ' notes' : ' note') + ', la plus récente en haut — mis à jour le '
    + esc_(quand) + '. Les photos sont dans le PDF de chaque note.</div>'
    + '</td></tr></table>'
    + blocs
    + '</body></html>';
}

// ── Refaire le fichier d'un chantier ──
// entree : { nom, numero } (liste d'attente). Rend 'fait', ou 'rien' (chantier sorti de la liste, aucune note).
// Lève une erreur si le fichier n'a pas pu être fait.
function recapRefaire_(entree) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CR);
  if (!sh || !crTitresBons_(sh)) throw new Error('onglet « ' + SHEET_CR + ' » illisible');
  if (!recapAvecTexte_(sh)) return 'rien';
  const chantier = recapChantierEntree_(entree);
  if (!chantier.nom) return 'rien';
  const notes = recapNotes_(sh, chantier);
  if (!notes.length) return 'rien';
  const nom = recapNomFichier_(chantier.nom);
  const quand = Utilities.formatDate(new Date(), 'Europe/Paris', 'dd/MM/yyyy') + ' à ' + Utilities.formatDate(new Date(), 'Europe/Paris', 'HH:mm').replace(':', ' h ');
  // Le PDF est fabriqué AVANT de toucher à l'ancien : si la fabrication échoue, l'ancien reste en place
  const blob = HtmlService.createHtmlOutput(recapHtml_(chantier.nom, notes, quand)).getAs('application/pdf').setName(nom);
  const dossier = dossierParChemin_(dossierChantier_(chantier.nom, true), dossiers_().documents['note'] || 'Divers', true);
  // Les anciens récapitulatifs de ce dossier (même nom, ou ancien nom d'un chantier renommé) : reconnus à leur nom, qui
  // commence par « RÉCAPITULATIF DES NOTES - » et finit par « .pdf ». Aucun autre fichier n'est jamais touché.
  const anciens = [], it = dossier.getFiles();
  while (it.hasNext()) {
    const f = it.next(), n = String(f.getName());
    if (!f.isTrashed() && n.indexOf(RECAP_PREFIXE) === 0 && /\.pdf$/i.test(n)) anciens.push(f);
  }
  // Ancien à la corbeille PUIS nouveau créé : jamais deux fichiers du même nom (Drive pour ordinateur en ferait un « (1) »)
  anciens.forEach(f => f.setTrashed(true));
  try {
    dossier.createFile(blob);
  } catch (e) {
    anciens.forEach(f => { try { f.setTrashed(false); } catch (x) {} });   // le nouveau n'est pas là : l'ancien revient
    throw e;
  }
  return 'fait';
}

// ── Le passage (appelé par traiterComptes toutes les 10 minutes, APRÈS qu'il a rendu son verrou) ──
// Rend le nombre de chantiers traités. Ne lève jamais d'erreur.
function recapPassage_() {
  try {
    const props = PropertiesService.getScriptProperties();
    if (!props.getProperty(RECAP_PROP)) return 0;           // rien en attente : une seule lecture, et c'est tout
    // Un seul passage à la fois (traiterComptes peut être lancé deux fois de suite : minuterie, et case cochée dans le
    // Sheet) : sans cela, deux passages feraient deux fichiers du même nom. La marque tombe seule au bout de 6 minutes.
    const cache = cacheScript_();
    if (cache.get('recap:passage')) return 0;
    cache.put('recap:passage', '1', 360);
    const debut = Date.now();
    let traites = 0;
    const cles = Object.keys(recapAttente_());
    for (let i = 0; i < cles.length; i++) {
      if (traites >= RECAP_MAX_PAR_PASSAGE || Date.now() - debut > RECAP_BUDGET_MS) break;
      const entree = recapAttente_()[cles[i]];
      if (!entree) continue;
      let erreur = '';
      try { recapRefaire_(entree); } catch (e) { erreur = String(e && e.message || e); console.error('recapRefaire_ (' + entree.nom + ') :', erreur); }
      recapSolder_(cles[i], entree, erreur);
      traites++;
    }
    cache.remove('recap:passage');
    return traites;
  } catch (e) { console.error('recapPassage_ :', e.message); try { cacheScript_().remove('recap:passage'); } catch (x) {} return 0; }
}
// Retire le chantier de la liste d'attente (fichier fait), ou compte un essai raté. Sous verrou, très court.
function recapSolder_(cle, traitee, erreur) {
  const verrou = LockService.getScriptLock();
  if (!verrou.tryLock(10000)) return;                        // occupé : le chantier reste en attente, il sera refait (sans dommage)
  try {
    const attente = recapAttente_(), e = attente[cle];
    if (!e) return;
    if (!erreur) {
      // Une note du même chantier est arrivée pendant la fabrication : le fichier est déjà en retard, on le garde en attente
      if (Number(e.n) === Number(traitee.n)) delete attente[cle]; else e.essais = 0;
    } else {
      e.essais = Number(e.essais || 0) + 1;
      if (e.essais === RECAP_ESSAIS_ALERTE) {
        alerte_('Le récapitulatif des notes du chantier « ' + e.nom + ' » n’a pas pu être refait (' + erreur.slice(0, 200) + '). '
          + 'L’appli réessaie toutes les 10 minutes. Les notes elles-mêmes sont bien envoyées et rangées : seul le fichier « '
          + RECAP_PREFIXE + '… » du dossier du chantier est en retard.', 'recap');
      }
      if (e.essais >= RECAP_ESSAIS_MAX) delete attente[cle];
    }
    recapEcrireAttente_(attente);
  } finally { verrou.releaseLock(); }
}

// ── Lecture par l'appli (action « recapNotes ») : les notes d'un chantier, pour un compte qui y a accès ──
// Chantier inconnu et chantier interdit reçoivent la même réponse (on ne dit pas quels chantiers existent).
function recapLire_(compte, corps) {
  const demande = typeof corps.chantier === 'string' ? corps.chantier.trim().slice(0, NOTE_MAX_CHANTIER) : '';
  const nom = demande ? noteChantierConnu_(demande) : '';
  if (!nom || !notePeutLire_(compte, nom)) return avecJeton_({ ok: false, code: 'INTERDIT', message: RECAP_REFUS }, compte);
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CR);
  // Onglet absent (aucune note encore) ou titres changés : une liste vide, jamais une erreur pour le poseur
  const lisible = !!sh && crTitresBons_(sh);
  const notes = lisible ? recapNotes_(sh, recapChantier_(nom)) : [];
  return avecJeton_({ ok: true, code: 'OK', message: notes.length + ' note(s)',
    data: { chantier: nom, notes: notes.map(n => ({ date: n.date, objet: n.objet, auteur: n.auteur, texte: n.texte, sansTexte: n.sansTexte })),
      heure: Date.now() } }, compte);
}

// ── Installation du lot 8d (une fonction par environnement ; relançable sans danger) ──
function etapesLot8d_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return etapesLot8_().concat([{
    nom: 'Colonne « ' + CR_TITRE_TEXTE + ' » de l’onglet « ' + SHEET_CR + ' »',
    fait: () => recapAvecTexte_(ss.getSheetByName(SHEET_CR)),
    action: () => {
      const sh = ss.getSheetByName(SHEET_CR);
      if (!sh || !crTitresBons_(sh)) throw new Error('l’onglet « ' + SHEET_CR + ' » n’a pas les titres du lot 8 : corriger d’abord');
      // Jamais rien réécrire par-dessus des données : la colonne K doit être libre (ou déjà à nous)
      if (sh.getMaxColumns && sh.getMaxColumns() < COL_CR_TEXTE) sh.insertColumnsAfter(sh.getMaxColumns(), COL_CR_TEXTE - sh.getMaxColumns());
      const lignes = Math.max(1, sh.getLastRow());
      const occupee = sh.getLastColumn() >= COL_CR_TEXTE
        && sh.getRange(1, COL_CR_TEXTE, lignes, 1).getValues().some(r => String(r[0]).trim() !== '');
      if (occupee) throw new Error('la colonne K de l’onglet « ' + SHEET_CR + ' » contient déjà autre chose : la vider ou la déplacer, puis relancer');
      sh.getRange(1, COL_CR_TEXTE).setValue(CR_TITRE_TEXTE).setFontWeight('bold');
      sh.getRange(2, COL_CR_TEXTE, Math.max(1, sh.getMaxRows() - 1), 1).setNumberFormat('@');
      // Un long texte ne doit pas faire des lignes de 40 cm de haut dans le Sheet : il est coupé à l'affichage, pas dans la cellule
      try { sh.getRange(1, COL_CR_TEXTE, sh.getMaxRows(), 1).setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP); } catch (e) {}
      return 'colonne ajoutée';
    } }]);
}
function installerLot8d_(attendu) { return installer_('Lot 8d', attendu, etapesLot8d_()).texte; }
function installerLot8dTest() { return installerLot8d_('TEST'); }
function installerLot8dProduction() { return installerLot8d_('PRODUCTION'); }
