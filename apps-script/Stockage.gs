// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// LOT 5 — STOCKAGE : où en est la place du compte Google (15 Go pour Drive, Gmail et Photos ensemble), ce que pèse
// chaque chantier, et les alertes par mail avant que ce soit plein. La purge est dans Purges.gs.
//
// Tout se passe dans le Sheet (onglet « Stockage ») : aucune page de l'appli ne change.
//   mesurerStockage()          lancée chaque nuit : commence un tour de mesure, ou continue celui qui est en cours ;
//   poursuivreMesureStockage() une heure plus tard : ne fait quelque chose QUE si le tour n'est pas fini.
// Chaque passage s'arrête proprement au bout de 4 minutes et note où il en est (propriété STOCKAGE_SUITE).
//
// Règles :
//   - LECTURE SEULE dans Drive : la mesure ne crée, ne déplace et ne supprime rien (pas même dossiers.json) ;
//   - elle ne prend jamais le verrou du script (celui des fiches) : elle a le sien (propriété STOCKAGE_EN_COURS) ;
//   - les titres de l'onglet sont contrôlés avant toute écriture : un onglet modifié à la main → arrêt et mail ;
//   - les lignes sont retrouvées par leur clé (dernière colonne), jamais par leur position : Franck peut trier ;
//   - les fichiers à la corbeille ne sont pas comptés dans les chantiers ;
//   - le mail d'alerte de place n'utilise pas alerte_ (une fois par jour, marque posée avant l'envoi) : ici la marque
//     d'un seuil n'est posée qu'APRÈS l'envoi réussi du mail.
// Plan : docs/lot5-plan.md. Décisions : D5-… (DECISIONS.md).
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
const SHEET_STOCKAGE = 'Stockage';
// Seuils d'alerte, en % de la place du compte (décisions de Franck du 14/11/2026)
const STK_SEUIL_ALERTE = 80;                // alerte : il est temps de purger
const STK_SEUIL_CRITIQUE = 95;              // critique : à 100 %, plus aucun mail ne part ni n'arrive
const STK_RAPPEL_ALERTE_JOURS = 30;         // 80 % : un mail au franchissement, puis un par mois au plus tant que la place reste au-dessus
const STK_RAPPEL_CRITIQUE_JOURS = 7;        // 95 % : un mail au franchissement (toujours), puis un rappel par semaine
const STK_RETOUR_CRITIQUE = 2;              // le niveau « 95 % » n'est quitté qu'en dessous de 93 % (95 − 2) : pas de mail à chaque oscillation
// Objectif de Franck : tenir 35 à 40 chantiers en cours. Pour dire combien de chantiers tiennent encore avant l'alerte,
// chaque nouveau chantier est compté au poids moyen d'un chantier en cours AUJOURD'HUI, multiplié par cette marge :
// un chantier en cours est en moyenne à mi-parcours, il pèsera plus lourd à sa clôture (calcul volontairement prudent).
const STK_MARGE_FIN_DE_CHANTIER = 1.5;
const STK_DUREE_MAX_MS = 4 * 60 * 1000;     // un passage s'arrête au bout de 4 minutes (limite de Google : 6)
const STK_VERROU_MS = 7 * 60 * 1000;        // au-delà, l'exécution précédente est morte : on reprend
const STK_LIMITE_DEFAUT = 15 * 1024 * 1024 * 1024;
const STK_MO = 1024 * 1024, STK_GO = 1024 * 1024 * 1024;
const STK_NOMS_MAX = 300;                   // longueur des listes de noms écrites dans une cellule

// Haut de l'onglet : colonne A = ces titres (contrôlés), colonne B = les valeurs écrites par le serveur
const STK_RESUME = ['Stockage du compte Google', 'Place utilisée', 'Mesurée le', 'D’où vient ce chiffre', 'Dont Drive',
  'Dont Gmail et Photos', 'Dont corbeille de Drive', 'Dossiers de l’appli', 'Chantiers en cours', 'Poids moyen d’un chantier en cours',
  'Place pour d’autres chantiers', 'À savoir'];
const STK_R = { etat: 1, place: 2, date: 3, source: 4, drive: 5, gmail: 6, corbeille: 7, appli: 8, enCours: 9, moyenne: 10, marge: 11, rappel: 12 };
const STK_RAPPEL = 'Les fiches envoyées par mail restent aussi dans « Messages envoyés » de Gmail, qui compte dans les 15 Go : '
  + 'la purge de Drive ne libère pas cette part (pour elle : ligne « Mails envoyés de plus de 3 mois » de l’onglet « Purges »). '
  + 'Un fichier mis à la corbeille compte encore 30 jours.';
const STK_LIGNE_TITRES = 14;                // la ligne de titres du tableau des chantiers
const STK_ENTETES = ['Chantier', 'Statut', 'Date « Terminé »', 'Poids total (Mo)', 'dont carnet (Mo)', 'dont fiches (Mo)', 'dont photos (Mo)',
  'dont autres (Mo)', 'Fichiers', 'Dernier dépôt au carnet', 'Anciens indices (nombre)', 'Anciens indices (Mo)', 'Mesuré le', 'Purge',
  'Clé (ne pas modifier)'];
const COL_K = { nom: 1, statut: 2, termine: 3, total: 4, carnet: 5, fiches: 6, photos: 7, autres: 8, fichiers: 9, depot: 10,
  indices: 11, indicesMo: 12, mesure: 13, purge: 14, cle: 15 };
const STK_CLE_TECHNIQUES = 'special:techniques', STK_CLE_ORPHELINS = 'special:orphelins',
  STK_CLE_SANS_DOSSIER = 'special:sans-dossier', STK_CLE_RESTE = 'special:reste';

// ── Petits outils ──
// Temps réel écoulé (limite des 4 minutes) : remplacée dans les tests pour simuler un passage coupé
function chronoMs_() { return Date.now(); }
// Une date, d'où qu'elle vienne (les dates lues dans le Sheet ne passent pas toujours le test « instanceof Date »)
function stkEstDate_(v) { return Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime()); }
function stkNfc_(v) { const s = String(v == null ? '' : v); return s.normalize ? s.normalize('NFC') : s; }
function stkJour_(ms) { return Utilities.formatDate(new Date(ms), 'Europe/Paris', 'dd/MM/yyyy'); }
function stkMo_(octets) { return Math.round((Number(octets) || 0) / STK_MO * 10) / 10; }
function stkGoTexte_(octets) { return String(Math.round((Number(octets) || 0) / STK_GO * 100) / 100).replace('.', ',') + ' Go'; }
function stkCourt_(noms) {
  const t = noms.join(', ');
  return t.length > STK_NOMS_MAX ? t.slice(0, STK_NOMS_MAX) + '…' : t;
}
// Date « Terminé » d'un chantier : millisecondes, ou null (vide), ou NaN (illisible)
function stkDateMs_(v) {
  if (v === '' || v == null) return null;
  if (stkEstDate_(v)) return v.getTime();
  const m = String(v).trim().match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (!m) return NaN;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return d.getMonth() === Number(m[2]) - 1 ? d.getTime() : NaN;
}

// Mail à Franck (adresse d'administration). Rend true seulement si le mail est parti.
function stkMail_(sujet, texte) {
  try {
    if (MailApp.getRemainingDailyQuota() < 1) return false;
    GmailApp.sendEmail(emailAdmin_(), sujet, texte + '\n\nLoué App', { name: NOM_ENTREPRISE });
    return true;
  } catch (e) { console.error('stkMail_ :', e.message); return false; }
}
// Un onglet du lot 5 dont les titres ont été changés : rien n'est lu ni écrit, et Franck est prévenu (un mail par jour
// au plus ; la marque du jour n'est posée que si le mail est parti)
let STK_PLACE_ = null;   // la place du compte lue par l'exécution en cours (pour le mail ci-dessous)
function stkAlerteOnglet_(nom) {
  const props = PropertiesService.getScriptProperties(), cle = 'ALERTE_STOCKAGE_' + jour_();
  if (props.getProperty(cle)) return;
  let place = '';
  try { const p = STK_PLACE_ || placeCompte_(); place = 'Place du compte Google en ce moment : ' + stkPlaceTexte_(p) + ' (les alertes de place, elles, continuent de partir).\n\n'; } catch (e) {}
  if (stkMail_('[Loué App] Onglet « ' + nom + ' » modifié — suivi du stockage arrêté',
    'Les titres de l’onglet « ' + nom + ' » du Sheet ne sont plus ceux attendus : le serveur n’y lit et n’y écrit plus rien '
    + '(ni détail par chantier, ni purge) tant que ce n’est pas réparé.\n\n' + place
    + 'Pour réparer : renomme cet onglet (par exemple « ' + nom + ' ancien »), puis lance installerLot5Production '
    + '(ou installerLot5Test sur la copie TEST) dans l’éditeur Apps Script : un onglet neuf sera créé.\n'
    + 'Rien n’est perdu dans Drive : aucune mise à la corbeille n’est faite pendant ce temps.')) props.setProperty(cle, '1');
}
function stkOngletModifie_(nom) {
  stkAlerteOnglet_(nom);
  return Object.assign(new Error('Les titres de l’onglet « ' + nom + ' » ont été modifiés : rien n’est lu ni écrit (renommer l’onglet, puis relancer l’installation du lot 5).'), { ongletModifie: true });
}
// Des lignes en plus au bas d'un onglet, si la ligne voulue dépasse sa taille
function stkAssurerLignes_(sh, derniere) {
  const manque = derniere - sh.getMaxRows();
  if (manque > 0) sh.insertRowsAfter(sh.getMaxRows(), manque + 50);
}

// ── Onglet « Stockage » ──
function stkTitresBons_(sh) {
  if (sh.getLastRow() < STK_LIGNE_TITRES || sh.getLastColumn() < STK_ENTETES.length) return false;
  const a = sh.getRange(1, 1, STK_RESUME.length, 1).getValues();
  if (!STK_RESUME.every((t, i) => String(a[i][0]) === t)) return false;
  const titres = sh.getRange(STK_LIGNE_TITRES, 1, 1, STK_ENTETES.length).getValues()[0];
  return STK_ENTETES.every((t, i) => String(titres[i]) === t);
}
function stkCreerOnglet_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().insertSheet(SHEET_STOCKAGE);
  sh.getRange(1, 1, STK_RESUME.length, 1).setValues(STK_RESUME.map(t => [t])).setFontWeight('bold');
  sh.getRange(STK_R.etat, 2).setValue('Pas encore de mesure : la première se fait dans la nuit (ou lance mesurerStockage).');
  sh.getRange(STK_R.rappel, 2).setValue(STK_RAPPEL);
  sh.getRange(STK_LIGNE_TITRES, 1, 1, STK_ENTETES.length).setValues([STK_ENTETES]).setFontWeight('bold').setBackground('#1A2B4A').setFontColor('white');
  const lignes = Math.max(1, sh.getMaxRows() - STK_LIGNE_TITRES);
  [COL_K.nom, COL_K.statut, COL_K.purge, COL_K.cle].forEach(c => sh.getRange(STK_LIGNE_TITRES + 1, c, lignes, 1).setNumberFormat('@'));
  [COL_K.termine, COL_K.depot, COL_K.mesure].forEach(c => sh.getRange(STK_LIGNE_TITRES + 1, c, lignes, 1).setNumberFormat('dd/MM/yyyy'));
  try { sh.setColumnWidth(1, 260); sh.setColumnWidth(2, 420); } catch (e) {}
  stkAvertir_(sh.getRange(1, 1, sh.getMaxRows(), STK_ENTETES.length), 'Onglet rempli par Loué App : ne rien modifier (le tri est permis).');
  return sh;
}
// Avertissement à la modification (Franck est propriétaire du Sheet : une protection ne l'arrête pas, elle le prévient)
function stkAvertir_(plage, texte) {
  try { plage.protect().setDescription(texte).setWarningOnly(true); } catch (e) { console.error('stkAvertir_ :', e.message); }
}
// L'onglet, créé s'il manque, vérifié dans tous les cas
function feuilleStockage_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_STOCKAGE) || stkCreerOnglet_();
  if (!stkTitresBons_(sh)) throw stkOngletModifie_(SHEET_STOCKAGE);
  return sh;
}
// Ligne d'une clé dans le tableau (0 si absente). Relu à chaque écriture : l'onglet peut avoir été trié entre-temps.
function stkLigne_(sh, cle) {
  const derniere = sh.getLastRow();
  if (derniere <= STK_LIGNE_TITRES) return 0;
  const cles = sh.getRange(STK_LIGNE_TITRES + 1, COL_K.cle, derniere - STK_LIGNE_TITRES, 1).getValues();
  for (let i = 0; i < cles.length; i++) if (String(cles[i][0]) === cle) return STK_LIGNE_TITRES + 1 + i;
  return 0;
}
// Écrit (ou réécrit) la ligne d'une clé ; valeurs : les colonnes 1 à 14
function stkEcrireLigne_(sh, cle, valeurs) {
  let ligne = stkLigne_(sh, cle);
  if (!ligne) { ligne = Math.max(sh.getLastRow(), STK_LIGNE_TITRES) + 1; stkAssurerLignes_(sh, ligne); }
  sh.getRange(ligne, 1, 1, STK_ENTETES.length).setValues([valeurs.concat([cle]).map(cellule_)]);
}

// ── La place du compte : deux sources ──
// Le service avancé Drive (s'il est activé dans l'éditeur) donne le total du compte, la part de Drive et celle de la
// corbeille. Sinon DriveApp, dont la documentation dit seulement « octets stockés dans Drive ».
function placeCompte_() {
  let erreur = '';
  if (typeof Drive !== 'undefined' && Drive && Drive.About && typeof Drive.About.get === 'function') {
    try {
      // API Drive version 3 (celle que l'éditeur propose). Une autre version, ou une réponse sans chiffre : repli sur DriveApp.
      const q = (Drive.About.get({ fields: 'storageQuota' }) || {}).storageQuota || {};
      const utilise = Number(q.usage), limite = Number(q.limit), drive = Number(q.usageInDrive), corbeille = Number(q.usageInDriveTrash);
      if (q.usage !== undefined && isFinite(utilise) && utilise >= 0) {
        return stkPlace_('service avancé Drive', utilise, limite, isFinite(drive) ? drive : null, isFinite(corbeille) ? corbeille : null);
      }
      erreur = 'réponse sans chiffre';
    } catch (e) { erreur = e.message; }
  }
  const p = stkPlace_('DriveApp', Number(DriveApp.getStorageUsed()), Number(DriveApp.getStorageLimit()), null, null);
  p.erreurAvance = erreur;
  return p;
}
function stkPlace_(source, utilise, limite, drive, corbeille) {
  const lim = isFinite(limite) && limite > 0 ? limite : STK_LIMITE_DEFAUT;
  return { source: source, utilise: utilise, limite: lim, pourcent: utilise / lim * 100, drive: drive, corbeille: corbeille, erreurAvance: '' };
}
function stkPlaceTexte_(place) {
  return stkGoTexte_(place.utilise) + ' sur ' + stkGoTexte_(place.limite) + ' (' + Math.floor(place.pourcent) + ' %)';
}

// ── Alertes de place : 80 % (alerte) et 95 % (critique) ──
// État gardé dans la propriété STOCKAGE_ALERTES : { niveau (dernier seuil prévenu), dernierAlerte, dernierCritique (dates des derniers mails) }.
// 80 % : un mail au franchissement, puis un par mois au plus tant que la place reste au-dessus (jamais deux mails « 80 % » en
// moins de 30 jours, même si la place passe et repasse le seuil). 95 % : toujours au franchissement, puis un rappel par semaine.
// La marque n'est écrite qu'APRÈS l'envoi réussi : un mail qui n'est pas parti repartira au passage suivant.
function stkAlertes_(place) {
  const props = PropertiesService.getScriptProperties();
  let e = {};
  try { e = JSON.parse(props.getProperty('STOCKAGE_ALERTES') || '{}') || {}; } catch (x) { e = {}; }
  const maintenant = maintenant_(), JOUR = 24 * 3600 * 1000;
  let niveau = Number(e.niveau) || 0, dernierAlerte = Number(e.dernierAlerte) || 0, dernierCritique = Number(e.dernierCritique) || 0;
  const seuil = place.pourcent >= STK_SEUIL_CRITIQUE ? STK_SEUIL_CRITIQUE : place.pourcent >= STK_SEUIL_ALERTE ? STK_SEUIL_ALERTE : 0;
  const critique = seuil === STK_SEUIL_CRITIQUE;
  let ecrire = false, envoye = false;
  // la place est redescendue : le seuil pourra prévenir de nouveau (pour 95 % : seulement une fois repassé sous 93 %)
  if (seuil < niveau && !(niveau === STK_SEUIL_CRITIQUE && place.pourcent >= STK_SEUIL_CRITIQUE - STK_RETOUR_CRITIQUE)) { niveau = seuil; ecrire = true; }
  const franchi = seuil > niveau;
  const attendu = critique ? maintenant - dernierCritique >= STK_RAPPEL_CRITIQUE_JOURS * JOUR
    : !dernierAlerte || maintenant - dernierAlerte >= STK_RAPPEL_ALERTE_JOURS * JOUR;
  const rappel = !franchi && attendu;
  const aEnvoyer = seuil > 0 && (franchi ? (critique || attendu) : attendu);
  if (aEnvoyer && stkMail_(stkSujetAlerte_(seuil, place), stkTexteAlerte_(seuil, place, rappel))) {
    niveau = seuil; envoye = true; ecrire = true;
    dernierAlerte = maintenant;                 // un mail « 95 % » vaut aussi pour « 80 % »
    if (critique) dernierCritique = maintenant;
  }
  if (ecrire) props.setProperty('STOCKAGE_ALERTES', JSON.stringify({ niveau: niveau, dernierAlerte: dernierAlerte, dernierCritique: dernierCritique }));
  return { seuil: seuil, envoye: envoye, niveau: niveau };
}
function stkSujetAlerte_(seuil, place) {
  return seuil === STK_SEUIL_CRITIQUE ? '[Loué App] URGENT — place Google presque pleine (' + Math.floor(place.pourcent) + ' %)'
    : '[Loué App] Place Google : ' + Math.floor(place.pourcent) + ' % utilisés';
}
function stkTexteAlerte_(seuil, place, rappel) {
  const lignes = [(rappel ? 'Rappel : la' : 'La') + ' place du compte Google de l’appli est utilisée à ' + Math.floor(place.pourcent) + ' % : ' + stkPlaceTexte_(place) + '.',
    'Ce chiffre vient de : ' + place.source + '. Le détail par chantier est dans l’onglet « ' + SHEET_STOCKAGE + ' » du Sheet.', ''];
  if (seuil === STK_SEUIL_CRITIQUE) lignes.push('À 100 %, plus aucun fichier ne peut être créé dans Drive et PLUS AUCUN MAIL NE PART NI N’ARRIVE : les fiches des poseurs '
    + 'resteraient dans leurs téléphones (elles ne sont pas perdues), mais plus rien n’arriverait au bureau, pas même ce mail.', '');
  lignes.push('Pour libérer de la place :',
    '1. onglet « Purges » du Sheet : coche « Mettre à la corbeille » sur les lignes où c’est possible (anciens indices du carnet, chantiers terminés) ;',
    '2. un fichier mis à la corbeille compte encore 30 jours : si la place presse, ouvre la corbeille de Drive et supprime-y les fichiers voulus, un par un '
      + '(pas « Vider la corbeille », qui supprimerait aussi les purges encore annulables) ;',
    '3. Gmail compte aussi : même onglet, ligne « Mails envoyés de plus de 3 mois » (les PDF restent dans Drive et dans le dossier du chantier sur le PC) ;',
    '', 'Mode d’emploi : docs/lot5-procedure.md.');
  lignes.push(seuil === STK_SEUIL_CRITIQUE ? 'Tu recevras un rappel par semaine tant que la place reste au-dessus de ' + STK_SEUIL_CRITIQUE + ' %.'
    : 'Alerte à ' + STK_SEUIL_ALERTE + ' % : tu recevras ce mail une fois par mois au plus tant que la place reste au-dessus ; à ' + STK_SEUIL_CRITIQUE + ' %, un mail urgent part toujours.');
  return lignes.join('\n');
}

// Statut d'un chantier tel qu'il est écrit dans la liste (« terminé », « TERMINÉ » → « Terminé ») ; un autre texte est rendu tel quel
function stkStatut_(v) {
  const s = stkNfc_(v).trim(), bas = s.toLowerCase();
  for (let i = 0; i < STATUTS_CHANTIER.length; i++) if (STATUTS_CHANTIER[i].toLowerCase() === bas) return STATUTS_CHANTIER[i];
  return s;
}
// ── Date « Terminé » de l'onglet Chantiers : posée quand le statut passe à « Terminé », effacée s'il change ──
// Seule la cellule de la date est écrite, jamais le reste de la ligne. Sur un chantier « Terminé », une date déjà saisie
// (par Franck) n'est jamais remplacée. Sur un chantier qui n'est PAS « Terminé », une date est effacée, même saisie à la main.
function stkDatesTermine_() {
  const rendu = { colonne: false, posees: 0, effacees: 0 };
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CHANTIERS);
  const COL = 10, TITRE = ENTETES_CHANTIERS_9A[5];   // colonne J : « Date « Terminé » »
  if (!sh || sh.getLastRow() < 2 || sh.getLastColumn() < COL) return rendu;
  if (String(sh.getRange(1, COL).getValue()).trim() !== TITRE) return rendu;   // colonne absente ou déplacée : on n'écrit rien
  rendu.colonne = true;
  const lignes = sh.getRange(2, 1, sh.getLastRow() - 1, COL).getValues();
  lignes.forEach((r, i) => {
    const nom = String(r[0] || '').trim();
    if (!nom) return;
    const termine = stkStatut_(r[2]) === STATUTS_CHANTIER[2], vide = r[COL - 1] === '' || r[COL - 1] == null;
    if (termine !== vide) return;   // « Terminé » avec sa date, ou autre statut sans date : rien à faire
    // relu juste avant d'écrire : si l'onglet a été trié entre-temps, on ne touche pas la ligne d'un autre chantier
    if (String(sh.getRange(i + 2, 1).getValue()).trim() !== nom) return;
    if (termine) { sh.getRange(i + 2, COL).setValue(new Date(maintenant_())); rendu.posees++; }
    else { sh.getRange(i + 2, COL).setValue(''); rendu.effacees++; }
  });
  return rendu;
}

// ── Ce que le serveur sait des chantiers et de leurs dossiers (lecture seule) ──
// { cléDuChantier: { nom, cle, statut, termine (ms, null ou NaN), lignes (nombre de lignes de ce nom) } }
function stkChantiers_() {
  const parCle = {};
  lignesChantiers_().forEach(r => {
    const nom = String(r[0]).trim(), cle = cleChantier_(nom);
    if (parCle[cle]) { parCle[cle].lignes++; return; }
    parCle[cle] = { nom: nom, cle: cle, statut: stkStatut_(r[2]), termine: stkDateMs_(r.length > 9 ? r[9] : ''), lignes: 1 };
  });
  return parCle;
}
// Lignes de l'onglet « Dossiers chantiers » (jamais créé ici) : [{ chantier, cle, id, trouvePar, aVerifier }]
function stkLignesDossiers_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_DOSSIERS);
  return (sh ? sh.getDataRange().getValues().slice(1) : []).map(l => ({ chantier: String(l[0] || '').trim(), cle: cleChantier_(l[0]),
    id: String(l[2] || '').trim(), trouvePar: String(l[3] || '').trim(), aVerifier: String(l[4] || '').trim() })).filter(l => l.cle);
}
// Noms des dossiers : ceux de dossiers.json s'il existe, sinon les noms par défaut (sans créer le fichier : lecture seule)
function stkConf_() {
  try { if (fichierDossiers_(DriveApp.getFolderById(driveRootId_()))) return dossiers_(); } catch (e) { console.error('stkConf_ :', e.message); }
  return DOSSIERS_DEFAUT;
}
// Sous-dossiers d'un chantier, par sorte : { carnet, photos, fiches: [chemins] } (chemins « A/B », accents en forme composée)
function stkCategories_() {
  const d = stkConf_().documents;
  const propre = c => String(c || '').split('/').map(x => x.trim()).filter(Boolean).map(stkNfc_).join('/');
  const fiches = [];
  ['cotes', 'fabrication', 'note', 'quitus', 'attestation', 'reception-support', 'bordereau-orga', 'bordereau-materiaux', 'signalement'].forEach(k => {
    const c = propre(d[k]);
    if (c && fiches.indexOf(c) < 0) fiches.push(c);
  });
  return { carnet: propre(d.carnet), photos: propre(d.photos), fiches: fiches };
}
function stkCategorie_(chemin, cats) {
  const sous = p => !!p && (chemin === p || chemin.indexOf(p + '/') === 0);
  if (sous(cats.carnet)) return 'carnet';
  if (sous(cats.photos)) return 'photos';
  return cats.fiches.some(sous) ? 'fiches' : 'autres';
}

// Ce que contient un dossier, tout compris : poids et nombre de fichiers par sorte. Fichiers à la corbeille non comptés.
// avecListe : rend aussi la liste des fiches et des photos (identifiant, chemin depuis le dossier, taille).
// depasse() : limite de temps ; « complet » passe à false si elle est atteinte avant la fin. LECTURE SEULE.
// autres : { identifiant de dossier: chantier } (onglet « Dossiers chantiers »). Un sous-dossier qui est le dossier d'un
// chantier n'est PAS parcouru (il est mesuré à part) : il est rendu dans « etrangers », et bloque la purge de celui-ci.
function stkInventaire_(dossier, cats, depasse, avecListe, autres) {
  const r = { complet: true, octets: { carnet: 0, fiches: 0, photos: 0, autres: 0 }, nb: { carnet: 0, fiches: 0, photos: 0, autres: 0 },
    total: 0, fichiers: 0, liste: [], etrangers: [] };
  const pile = [{ d: dossier, chemin: '' }];
  while (pile.length) {
    if (depasse()) { r.complet = false; break; }
    const x = pile.pop(), cat = stkCategorie_(x.chemin, cats), prefixe = x.chemin ? x.chemin + '/' : '';
    const fichiers = x.d.getFiles();
    while (fichiers.hasNext()) {
      const f = fichiers.next();
      if (f.isTrashed()) continue;
      const taille = Number(f.getSize()) || 0;
      r.octets[cat] += taille; r.nb[cat]++; r.total += taille; r.fichiers++;
      if (avecListe && (cat === 'fiches' || cat === 'photos')) r.liste.push({ id: f.getId(), nom: f.getName(), chemin: prefixe + stkNfc_(f.getName()), taille: taille });
    }
    const sous = x.d.getFolders();
    while (sous.hasNext()) {
      const d = sous.next();
      if (d.isTrashed()) continue;
      if (autres && autres[d.getId()]) { r.etrangers.push({ nom: autres[d.getId()], chemin: prefixe + stkNfc_(d.getName()) }); continue; }
      pile.push({ d: d, chemin: prefixe + stkNfc_(d.getName()) });
    }
  }
  return r;
}

// Ce qu'il y a à mesurer : les dossiers de chantier (onglet « Dossiers chantiers », ou dossier de la racine qui porte
// exactement le nom d'un chantier), les dossiers techniques et les dossiers de la racine rattachés à aucun chantier.
// Toujours dans le même ordre (par identifiant), pour la reprise.
function stkUnites_() {
  const racine = DriveApp.getFolderById(driveRootId_());
  const chantiers = stkChantiers_(), parId = {}, avecDossier = {};
  stkLignesDossiers_().forEach(l => {
    if (!l.id) return;
    let u = parId[l.id];
    if (!u) {
      let d = null;
      try { d = DriveApp.getFolderById(l.id); if (d.isTrashed()) d = null; } catch (e) { d = null; }
      if (!d) return;
      u = parId[l.id] = { id: l.id, type: 'chantier', dossier: d, noms: [], cles: [] };
    }
    if (u.cles.indexOf(l.cle) < 0) { u.cles.push(l.cle); u.noms.push(chantiers[l.cle] ? chantiers[l.cle].nom : l.chantier); }
    avecDossier[l.cle] = true;
  });
  const it = racine.getFolders();
  while (it.hasNext()) {
    const d = it.next(), id = d.getId();
    if (d.isTrashed() || parId[id]) continue;
    if (estDossierTechnique_(d)) { parId[id] = { id: id, type: 'technique', dossier: d, noms: [d.getName()], cles: [] }; continue; }
    const c = chantiers[cleChantier_(d.getName())];
    if (c && !avecDossier[c.cle]) { parId[id] = { id: id, type: 'chantier', dossier: d, noms: [c.nom], cles: [c.cle] }; avecDossier[c.cle] = true; }
    else parId[id] = { id: id, type: 'orphelin', dossier: d, noms: [d.getName()], cles: [] };
  }
  return { racine: racine, chantiers: chantiers, unites: Object.keys(parId).sort().map(id => parId[id]),
    sansDossier: Object.keys(chantiers).filter(k => !avecDossier[k]).map(k => chantiers[k].nom).sort() };
}

// ── Verrou de la mesure : une propriété datée, jamais le verrou du script ──
function stkPrendre_() {
  const props = PropertiesService.getScriptProperties(), depuis = Number(props.getProperty('STOCKAGE_EN_COURS') || 0);
  if (depuis && Math.abs(Date.now() - depuis) < STK_VERROU_MS) return false;
  props.setProperty('STOCKAGE_EN_COURS', String(Date.now()));
  return true;
}
function stkRendre_() { PropertiesService.getScriptProperties().deleteProperty('STOCKAGE_EN_COURS'); }

// ── La mesure ──
function mesurerStockage() { return stkPasse_(true); }
// Second passage de la nuit : ne fait quelque chose que si un tour est en cours
function poursuivreMesureStockage() { return stkPasse_(false); }

function stkSuite_() {
  try { const s = JSON.parse(PropertiesService.getScriptProperties().getProperty('STOCKAGE_SUITE') || 'null'); return s && typeof s === 'object' ? s : null; }
  catch (e) { return null; }
}
function stkPasse_(peutCommencer) {
  if (!peutCommencer && !stkSuite_()) return 'Rien à poursuivre : aucun tour de mesure en cours.';
  if (!stkPrendre_()) return 'Une mesure est déjà en cours : rien n’a été fait.';
  let message;
  try { message = stkMesurer_(); }
  catch (e) {
    message = 'Mesure arrêtée : ' + (e && e.message ? e.message : e);
    console.error('mesurerStockage :', message);
  } finally { stkRendre_(); }
  Logger.log(message);
  return message;
}

function stkMesurer_() {
  const debut = chronoMs_(), depasse = () => chronoMs_() - debut > STK_DUREE_MAX_MS;
  const props = PropertiesService.getScriptProperties();
  // 1. La place du compte (lue à chaque passage) et les alertes, AVANT tout contrôle d'onglet : un onglet modifié à la
  //    main arrête le détail par chantier, jamais l'alerte de place
  const place = STK_PLACE_ = placeCompte_(), maintenant = maintenant_();
  const alerte = stkAlertes_(place);
  const sh = feuilleStockage_();          // titres contrôlés avant toute écriture
  try { feuillePurges_(); feuillePurgesDetail_(); }
  catch (e) {
    // L'onglet Stockage, lui, est bon : son état reste juste (place, alerte), et il dit pourquoi le détail s'arrête
    if (e && e.ongletModifie) sh.getRange(1, 2, 4, 1).setValues([[stkEtat_(place, alerte, '') + ' ⚠ Détail par chantier arrêté : ' + e.message], [stkPlaceTexte_(place)],
      [new Date(maintenant)], [stkSource_(place)]].map(l => l.map(cellule_)));
    throw e;
  }
  const dates = stkDatesTermine_();
  // 2. Le tour : commencé ici, ou repris
  const liste = stkUnites_();
  let suite = stkSuite_();
  if (!suite) {
    suite = { debut: maintenant, apres: '', faits: 0, octets: 0, fichiers: 0, incomplets: 0, octetsRacine: 0,
      tech: { octets: 0, fichiers: 0, noms: [] }, orph: { octets: 0, fichiers: 0, noms: [] }, racine: false,
      enCours: { n: 0, octets: 0 } };   // chantiers « En cours » mesurés en entier pendant ce tour
  }
  const cats = stkCategories_(), ctx = prgContexte_(liste.chantiers, cats);
  const date = new Date(maintenant);
  let fini = true, faitsCePassage = 0;
  // Les fichiers posés directement à la racine (dossiers.json…) : comptés avec les dossiers techniques
  if (!suite.racine) {
    const it = liste.racine.getFiles();
    while (it.hasNext()) { const f = it.next(); if (!f.isTrashed()) { const t = Number(f.getSize()) || 0; suite.tech.octets += t; suite.tech.fichiers++; suite.octetsRacine += t; suite.fichiers++; } }
    suite.racine = true;
  }
  for (let i = 0; i < liste.unites.length; i++) {
    const u = liste.unites[i];
    if (suite.apres && u.id <= suite.apres) continue;      // déjà mesuré lors d'un passage précédent
    if (depasse()) { fini = false; break; }
    const inv = stkInventaire_(u.dossier, cats, depasse, u.type === 'chantier', ctx.idsDossiers);
    // Limite de temps au milieu d'un dossier : il sera refait en entier au passage suivant. S'il est le premier du passage,
    // il ne tiendra jamais dans un passage : ce qui a été vu est écrit, et la ligne dit que la mesure est incomplète.
    if (!inv.complet && faitsCePassage) { fini = false; break; }
    if (!inv.complet) suite.incomplets++;
    if (u.type === 'chantier') {
      const c = u.cles.length === 1 ? liste.chantiers[u.cles[0]] : null;
      if (c && c.statut === STATUTS_CHANTIER[1] && inv.complet && suite.enCours) { suite.enCours.n++; suite.enCours.octets += inv.total; }
      // Propositions de purge de ce chantier (Purges.gs) : seulement pour un dossier porté par un seul chantier
      let p = { indices: '', indicesMo: '', depot: '', texte: u.cles.length > 1 ? 'dossier porté par plusieurs chantiers : aucune purge proposée' : '' };
      if (u.cles.length === 1) {
        try { p = prgProposerChantier_(u, inv, ctx, depasse); }
        catch (e) { if (e && e.ongletModifie) throw e; p.texte = 'propositions non calculées : ' + e.message; }
      }
      if (inv.etrangers.length) p.texte = ['⚠ contient le dossier d’un autre chantier (« ' + inv.etrangers[0].nom + ' », dans « ' + inv.etrangers[0].chemin + ' ») : sors-le de là', p.texte].filter(Boolean).join(' ; ');
      stkEcrireLigne_(sh, 'chantier:' + u.id, [
        u.noms.join(' + ') + (inv.complet ? '' : ' — ⚠ mesure incomplète (dossier trop gros pour un passage)'),
        c ? c.statut : '', c && c.termine && !isNaN(c.termine) ? new Date(c.termine) : '',
        stkMo_(inv.total), stkMo_(inv.octets.carnet), stkMo_(inv.octets.fiches), stkMo_(inv.octets.photos), stkMo_(inv.octets.autres),
        inv.fichiers, p.depot, p.indices, p.indicesMo, date, p.texte]);
    } else {
      const s = u.type === 'technique' ? suite.tech : suite.orph;
      s.octets += inv.total; s.fichiers += inv.fichiers;
      if (stkCourt_(s.noms).length < STK_NOMS_MAX) s.noms.push(u.noms[0]);
    }
    // La ligne est écrite AVANT de noter où l'on en est : rien n'est perdu ni compté deux fois si l'exécution est coupée
    suite.apres = u.id; suite.faits++; suite.octets += inv.total; suite.fichiers += inv.fichiers; faitsCePassage++;
    props.setProperty('STOCKAGE_SUITE', JSON.stringify(suite));
  }
  // 3. Fin de tour : lignes d'ensemble, et « Reste du compte » (jamais avant un tour complet, jamais négatif)
  let appli, moyenne = null, marge = null;
  if (fini) {
    const special = (cle, nom, s) => stkEcrireLigne_(sh, cle, [nom, '', '', stkMo_(s.octets), '', '', '', stkMo_(s.octets), s.fichiers, '', '', '', date, '']);
    special(STK_CLE_TECHNIQUES, 'Dossiers techniques' + (suite.tech.noms.length ? ' (' + stkCourt_(suite.tech.noms) + ', fichiers de la racine)' : ' (fichiers de la racine)'), suite.tech);
    special(STK_CLE_ORPHELINS, 'Dossiers de la racine rattachés à aucun chantier' + (suite.orph.noms.length ? ' (' + suite.orph.noms.length + ') : ' + stkCourt_(suite.orph.noms) : ' : aucun'), suite.orph);
    stkEcrireLigne_(sh, STK_CLE_SANS_DOSSIER, ['Chantiers sans dossier' + (liste.sansDossier.length ? ' (' + liste.sansDossier.length + ') : ' + stkCourt_(liste.sansDossier) : ' : aucun'),
      '', '', '', '', '', '', '', '', '', '', '', date, '']);
    const total = suite.octets + (Number(suite.octetsRacine) || 0);   // tout ce qui a été mesuré dans le Drive de l'appli
    const reste = Math.max(0, place.utilise - total);
    stkEcrireLigne_(sh, STK_CLE_RESTE, [(place.source === 'DriveApp' ? 'Reste vu par DriveApp (corbeille et autres fichiers de Drive ; Gmail et Photos seulement si DriveApp les compte)'
      : 'Reste du compte (Gmail, Photos, corbeille, autres fichiers)') + (suite.incomplets ? ' — approximatif : ' + suite.incomplets + ' dossier(s) mesuré(s) en partie' : ''),
      '', '', stkMo_(reste), '', '', '', stkMo_(reste), '', '', '', '', date, '']);
    stkLignesDisparues_(sh, liste.unites);
    // La ligne « Mails envoyés de plus de 3 mois » de l'onglet Purges (Gmail compte dans les 15 Go) : jamais bloquante
    try { prgProposerMails_(ctx, depasse); } catch (e) { if (e && e.ongletModifie) throw e; console.error('prgProposerMails_ :', e && e.message); }
    appli = stkGoTexte_(total) + ' dans ' + suite.fichiers + ' fichier(s) — tour complet du ' + stkJour_(maintenant)
      + (suite.incomplets ? ' (⚠ ' + suite.incomplets + ' dossier(s) trop gros, mesuré(s) en partie)' : '');
    // Suivi de l'objectif (35 à 40 chantiers en cours) : rien si les données manquent (aucun chantier en cours mesuré, ou mesure en partie)
    const ec = suite.enCours;
    if (ec && ec.n > 0 && ec.octets > 0 && !suite.incomplets) {
      const poids = ec.octets / ec.n, prudent = poids * STK_MARGE_FIN_DE_CHANTIER;
      moyenne = String(stkMo_(poids)).replace('.', ',') + ' Mo (moyenne de ' + ec.n + ' chantier(s) en cours, mesuré(s) le ' + stkJour_(maintenant) + ')';
      // place qui reste avant le seuil d'alerte, divisée par le poids prudent d'un chantier (arrondi vers le bas)
      const libre = place.limite * STK_SEUIL_ALERTE / 100 - place.utilise;
      marge = libre <= 0 ? 'Le seuil de ' + STK_SEUIL_ALERTE + ' % est atteint : plus de place pour un chantier de plus sans purge.'
        : 'À ce rythme, place pour environ ' + Math.floor(libre / prudent) + ' chantier(s) en cours de plus avant ' + STK_SEUIL_ALERTE
          + ' % (calcul prudent : chaque nouveau chantier compté ' + String(stkMo_(prudent)).replace('.', ',') + ' Mo).';
    }
    props.deleteProperty('STOCKAGE_SUITE');
  } else {
    appli = 'Mesure en cours : ' + suite.faits + ' dossier(s) sur ' + liste.unites.length + ' (la suite au prochain passage)';
    props.setProperty('STOCKAGE_SUITE', JSON.stringify(suite));
  }
  // 4. Le haut de l'onglet
  const pct = Math.floor(place.pourcent);
  const etat = stkEtat_(place, alerte, fini ? '' : 'Mesure en cours : ' + suite.faits + ' dossier(s) sur ' + liste.unites.length);
  const source = stkSource_(place);
  const inconnu = 'non connu sans le service avancé Drive';
  const enCours = Object.keys(liste.chantiers).filter(k => liste.chantiers[k].statut === STATUTS_CHANTIER[1]).length;
  // Tour pas fini : le poids moyen et la place pour d'autres chantiers restent ceux du dernier tour complet
  const avant = fini ? null : sh.getRange(STK_R.moyenne, 2, 2, 1).getValues();
  sh.getRange(1, 2, STK_RESUME.length, 1).setValues([[etat], [stkPlaceTexte_(place)], [date], [source],
    [place.drive == null ? inconnu : stkGoTexte_(place.drive)],
    [place.drive == null ? inconnu : stkGoTexte_(Math.max(0, place.utilise - place.drive))],
    [place.corbeille == null ? inconnu : stkGoTexte_(place.corbeille)],
    [appli], [enCours], [fini ? (moyenne || '') : avant[0][0]], [fini ? (marge || '') : avant[1][0]], [STK_RAPPEL]].map(l => l.map(cellule_)));
  return (fini ? 'Tour de mesure terminé' : 'À suivre') + ' : ' + suite.faits + ' dossier(s) mesuré(s) sur ' + liste.unites.length + ', place utilisée ' + pct + ' % (' + place.source + ').'
    + (alerte.envoye ? ' Mail d’alerte envoyé (seuil ' + alerte.seuil + ' %).' : '')
    + (dates.posees || dates.effacees ? ' Dates « Terminé » : ' + dates.posees + ' posée(s), ' + dates.effacees + ' effacée(s).' : '');
}

// La phrase d'état du haut de l'onglet. tour : « Mesure en cours : n dossier(s) sur m », ou '' si le tour est fini.
// Au-dessus d'un seuil, l'alerte passe toujours en premier, même pendant un tour de plusieurs nuits.
function stkEtat_(place, alerte, tour) {
  const pct = Math.floor(place.pourcent);
  if (alerte.seuil === STK_SEUIL_CRITIQUE) return 'URGENT : ' + pct + ' % — à 100 %, plus aucun mail ne part ni n’arrive. Libère de la place (onglet « Purges »).' + (tour ? ' ' + tour + '.' : '');
  if (alerte.seuil) return 'Attention : ' + pct + ' % (alerte à ' + STK_SEUIL_ALERTE + ' %) — il est temps de purger (onglet « Purges »).' + (tour ? ' ' + tour + '.' : '');
  return tour ? tour + ' — place utilisée : ' + pct + ' % (alerte à ' + STK_SEUIL_ALERTE + ' %)' : 'Tout va bien : ' + pct + ' % (alerte à ' + STK_SEUIL_ALERTE + ' %)';
}
function stkSource_(place) {
  return place.source !== 'DriveApp' ? 'Service avancé Drive : total du compte (Drive, Gmail et Photos)'
    : 'DriveApp : Google ne garantit pas que ce chiffre compte Gmail et Photos — à comparer avec one.google.com/storage'
      + (place.erreurAvance ? ' (service avancé Drive en panne : ' + place.erreurAvance + ')' : ' (service avancé Drive non activé)');
}

// Fin de tour : la ligne d'un dossier de chantier qui n'existe plus (mis à la corbeille, sorti de la racine) le dit
function stkLignesDisparues_(sh, unites) {
  const derniere = sh.getLastRow();
  if (derniere <= STK_LIGNE_TITRES) return;
  const presents = {};
  unites.forEach(u => { presents['chantier:' + u.id] = true; });
  const n = derniere - STK_LIGNE_TITRES;
  const cles = sh.getRange(STK_LIGNE_TITRES + 1, COL_K.cle, n, 1).getValues(), textes = sh.getRange(STK_LIGNE_TITRES + 1, COL_K.purge, n, 1).getValues();
  const DISPARU = 'dossier disparu de Drive (corbeille, ou déplacé) : chiffres de l’ancienne mesure';
  cles.forEach((c, i) => {
    const cle = String(c[0]);
    if (/^chantier:/.test(cle) && !presents[cle] && String(textes[i][0]) !== DISPARU) sh.getRange(STK_LIGNE_TITRES + 1 + i, COL_K.purge).setValue(DISPARU);
  });
}

// Contrôles du lot 5, ajoutés à verifierConfig()
function verifierStockage_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), lignes = [];
  const ok = (cond, texte) => lignes.push((cond ? '✅ ' : '❌ ') + texte);
  const sh = ss.getSheetByName(SHEET_STOCKAGE), p = ss.getSheetByName(SHEET_PURGES), d = ss.getSheetByName(SHEET_PURGES_DETAIL);
  ok(!!sh && stkTitresBons_(sh), 'Onglet « ' + SHEET_STOCKAGE + ' » (sinon lancer installerLot5Test ou installerLot5Production)');
  ok(!!p && noteTitresBons_(p, PRG_ENTETES), 'Onglet « ' + SHEET_PURGES + ' »');
  ok(!!d && noteTitresBons_(d, PRG_DETAIL_ENTETES), 'Onglet « ' + SHEET_PURGES_DETAIL + ' »');
  const ch = ss.getSheetByName(SHEET_CHANTIERS);
  ok(!!ch && ch.getLastColumn() >= 10 && String(ch.getRange(1, 10).getValue()).trim() === ENTETES_CHANTIERS_9A[5],
    'Onglet Chantiers : colonne J « ' + ENTETES_CHANTIERS_9A[5] + ' » (sans elle, aucune purge de chantier terminé n’est proposée)');
  try {
    const place = placeCompte_();
    lignes.push('Place du compte : ' + stkPlaceTexte_(place) + ' — source : ' + place.source
      + (place.source === 'DriveApp' ? ' (service avancé Drive non activé : chiffre à comparer avec one.google.com/storage)' : ''));
  } catch (e) { ok(false, 'Place du compte illisible : ' + e.message); }
  lignes.push((prgGmailPresent_() ? '✅ ' : '➖ ') + 'Service avancé Gmail (ligne « ' + PRG_QUOI.mails + ' » de l’onglet Purges)' + (prgGmailPresent_() ? '' : ' : absent, cette ligne ne sera pas proposée (éditeur → Services → Gmail API)'));
  const suite = stkSuite_();
  if (suite) lignes.push('Mesure du stockage : un tour est en cours (' + suite.faits + ' dossier(s) faits)');
  return lignes.join('\n');
}
