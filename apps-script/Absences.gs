// ═══════════════════════════════════════════════════════════════════════════════
// LOT 14 — LA DEMANDE D'ABSENCE : RÉPONSE DE LA DIRECTION, ÉTAT POUR LE POSEUR, LIEN AVEC LE PLANNING
//
// Règles de Franck (19/11/2026) : le mail part UNIQUEMENT à la direction, avec deux boutons « Accepter » et « Refuser » ;
// un clic ouvre une page de confirmation (absence-reponse.html), on y confirme : deux clics en tout. Lien unique, à usage
// unique, valable quelques jours, sans connexion à l'appli. ACCEPTÉE : un mail au conducteur de travaux pour information, et
// l'absence s'inscrit toute seule dans le planning (lu ici par le programme de publication du planning, lot 11) avec son
// appellation — sauf maladie et accident : « Absent ». REFUSÉE : rien. Le poseur voit l'état de sa demande dans l'appli.
// LE MOTIF N'EST VISIBLE QUE PAR LA DIRECTION.
//
//   - ÉTEINT tant que la propriété du script ABSENCE_DIRECTION (1 à 3 adresses de la direction) n'existe pas : sans elle,
//     traiterAbsence fait exactement comme avant ;
//   - le motif et les précisions ne sont écrits NULLE PART ailleurs que dans le mail à la direction et son PDF : ni dans le
//     Sheet, ni dans Drive, ni dans l'onglet « Mails en attente », ni dans le Journal, ni dans une alerte ;
//   - si le mail à la direction ne peut pas partir, la demande n'est PAS reçue : le téléphone la garde et la renvoie
//     (même numéro : aucun doublon). Tant que ce mail n'est pas parti (colonne « Mail à la direction » vide), le poseur ne
//     voit pas la demande « En attente » ; une fois parti, il ne repart jamais une seconde fois ;
//   - ATTENTION : la boîte « Messages envoyés » du compte Google de Loué garde le mail de la direction (donc le motif) :
//     l'appli ne peut pas l'empêcher sans supprimer la preuve de la demande ;
//   - le lien est SIGNÉ avec la clé secrète du serveur (numéro de la demande + date limite) : rien de secret n'est écrit dans
//     le Sheet, lire le Sheet ne permet pas de fabriquer un lien. Usage unique : dès qu'une réponse est enregistrée, le lien
//     ne fait plus que la redire ;
//   - l'onglet « Absences suivi » (aucun motif) tient l'état de chaque demande ; c'est lui que le planning vient LIRE.
// Plan : docs/lot14-plan.md. Décisions : D14-… (DECISIONS.md).
// ═══════════════════════════════════════════════════════════════════════════════
const SHEET_ABS_SUIVI = 'Absences suivi';
const ABS_ENTETES = ['Numéro', 'Reçue le', 'Compte', 'Demandeur', 'Date d’absence', 'Du', 'Au', 'Durée', 'Appellation (planning)', 'État', 'Décidée le', 'Mail au conducteur', 'Mail à la direction'];
const COL_AB = { numero: 1, recue: 2, compte: 3, demandeur: 4, texte: 5, du: 6, au: 7, duree: 8, libelle: 9, etat: 10, decidee: 11, mail: 12, direction: 13 };
const ABS_MAX_PAR_JOUR = 5;                        // demandes par compte et par jour (chacune envoie 1 à 3 mails avec un PDF)
const ABS_MAIL_EN_COURS = 'envoi en cours ';       // suivi de l'heure (ms) : un mail au conducteur est en train de partir
const ABS_PROP_DIRECTION = 'ABSENCE_DIRECTION';     // adresses de la direction (jamais dans le dépôt). Absente = lot 14 éteint
const ABS_PROP_ADRESSE = 'ADRESSE_APPLI';           // (facultatif) adresse des pages de l'appli, pour les liens du mail
const ABS_ADRESSE_DEFAUT = 'https://chantiersloue.github.io/chantier-pro/';
const ABS_PROP_A_ENVOYER = 'ABS_MAIL_A_ENVOYER';    // « 1 » : un mail au conducteur attend (regardé toutes les 10 minutes)
const ABS_LIEN_JOURS = 7;                           // durée de vie d'un lien
const ABS_DIRECTION_MAX = 3;
const ABS_ETATS = { attente: 'En attente', acceptee: 'Acceptée', refusee: 'Refusée', sansReponse: 'Sans réponse' };
const ABS_RESERVE = '(réservé à la direction)';
const ABS_MAIL_A_ENVOYER = 'à envoyer';
// Mots de santé : l'appellation est toujours « Absent », quoi qu'il soit coché par ailleurs
const ABS_SANTE = ['medical', 'medicale', 'medecin', 'maladie', 'malade', 'accident', 'arret', 'hopital', 'hospitalisation', 'operation', 'chirurgie', 'sante', 'soins', 'blessure'];

// ── Le réglage ──
function absDirection_() {
  const vues = {}, liste = [];
  decouperAdresses_(propriete_(ABS_PROP_DIRECTION)).forEach(a => { const c = a.toLowerCase(); if (!vues[c]) { vues[c] = true; liste.push(a); } });
  return liste.slice(0, ABS_DIRECTION_MAX);
}
function absAdresseAppli_() {
  const p = String(propriete_(ABS_PROP_ADRESSE)).trim();
  return /^https:\/\/[A-Za-z0-9.-]+\/[A-Za-z0-9._~\/-]*$/.test(p) ? (p.slice(-1) === '/' ? p : p + '/') : ABS_ADRESSE_DEFAUT;
}

// ── Textes et dates ──
function absNorm_(v) { return String(v === undefined || v === null ? '' : v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); }
// L'appellation écrite dans le planning et dans le mail au conducteur. Dans le doute : « Absent ».
function absLibelle_(motif, imputation) {
  const m = absNorm_(motif), mots = m.split(/[^a-z0-9]+/).filter(Boolean);
  if (mots.some(x => ABS_SANTE.indexOf(x) > -1)) return 'Absent';
  if (mots.indexOf('ecole') > -1) return 'École';
  if (mots.indexOf('formation') > -1) return 'Formation';
  if (mots.some(x => x === 'conge' || x === 'conges') || absNorm_(imputation).indexOf('conges payes') > -1) return 'Congés';
  return 'Absent';
}
// « 30/11/2026 », « Du 30/11/2026 au 04/12/2026 », « Semaine 49 (du lundi 30/11/2026 au vendredi 04/12/2026) » → { du, au } en
// AAAA-MM-JJ ; { du: '', au: '' } si ce n'est pas lisible (l'absence sera à inscrire à la main dans le planning)
function absDates_(texte) {
  const trouvees = [];
  String(texte || '').replace(/(\d{1,2})\/(\d{1,2})\/(\d{4})/g, (tout, j, m, a) => {
    const d = new Date(Date.UTC(+a, +m - 1, +j));
    trouvees.push(d.getUTCFullYear() === +a && d.getUTCMonth() === +m - 1 && d.getUTCDate() === +j ? d.toISOString().slice(0, 10) : null);
    return tout;
  });
  if (!trouvees.length || trouvees.length > 2 || trouvees.indexOf(null) > -1) return { du: '', au: '' };
  const du = trouvees[0], au = trouvees[trouvees.length - 1];
  if (au < du || (new Date(au) - new Date(du)) / 86400000 > 366) return { du: '', au: '' };
  return { du: du, au: au };
}
function absIso_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) return Utilities.formatDate(v, 'Europe/Paris', 'yyyy-MM-dd');
  const t = String(v === undefined || v === null ? '' : v).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : '';
}
function absMs_(v) { return Object.prototype.toString.call(v) === '[object Date]' ? v.getTime() : (Number(v) || 0); }
function absQuand_(ms) { return ms ? Utilities.formatDate(new Date(ms), 'Europe/Paris', 'dd/MM/yyyy') + ' à ' + Utilities.formatDate(new Date(ms), 'Europe/Paris', 'HH:mm') : ''; }

// ── L'onglet de suivi ──
function absFeuille_() {
  const sh = feuille_(SHEET_ABS_SUIVI, ABS_ENTETES);
  return sh;
}
// Ligne d'une demande (par son numéro), ou 0
function absChercher_(sh, id) {
  const n = sh.getLastRow() - 1;
  if (n < 1) return 0;
  const v = sh.getRange(2, COL_AB.numero, n, 1).getValues();
  for (let i = v.length - 1; i >= 0; i--) if (String(v[i][0]) === String(id)) return i + 2;
  return 0;
}

// ── Le lien signé ──
function absSignature_(id, limite) { return signer_('absence|' + id + '|' + limite); }
function absLien_(id, limite, choix) {
  let test = false;
  try { test = environnementReel_().env === 'TEST'; } catch (e) {}
  return absAdresseAppli_() + 'absence-reponse.html?n=' + encodeURIComponent(id) + '&e=' + limite + '&s=' + absSignature_(id, limite)
    + '&c=' + (choix === 'refuser' ? 'refuser' : 'accepter') + '&env1=' + (test ? 'test' : 'prod');   // le serveur de cette page seulement (commun/config.js)
}
// { ok, id, expire } : la signature est vérifiée AVANT toute lecture du Sheet
function absVerifierLien_(corps) {
  const id = String(corps && corps.n || ''), limite = String(corps && corps.e || ''), s = String(corps && corps.s || '');
  if (!idValide_(id) || !/^\d{12,14}$/.test(limite) || s.length < 20 || s.length > 80) return { ok: false };
  if (!egaux_(s, absSignature_(id, limite))) return { ok: false };
  return { ok: true, id: id, expire: maintenant_() > Number(limite) };
}

// ══════════════════════════════════════════════════════════
// LA DEMANDE ARRIVE (appelée par traiterAbsence quand le réglage ABSENCE_DIRECTION existe)
// ══════════════════════════════════════════════════════════
function absTraiter_(brut, contexte, direction) {
  // Une fiche de l'ancien format (sans numéro, pendant la période de transition) reçoit un numéro du serveur
  const id = contexte && idValide_(contexte.id) ? String(contexte.id) : 'abs-' + Utilities.getUuid();
  const dates = absDates_(brut.dateAbsence), libelle = absLibelle_(brut.motif, brut.imputation);
  const compte = contexte && contexte.auteurId ? String(contexte.auteurId) : '';
  // Colonnes C à I. Écrites en « texte brut » : « 30/11/2026 » ne devient pas une date de tableur, le compte « 007 » reste « 007 ».
  const contenu = [compte, brut.nom || '', brut.dateAbsence || '', dates.du, dates.au, brut.duree || '', libelle].map(cellule_);

  // 1. La ligne de suivi (aucun motif), sous verrou. Retrouvée par son numéro si le téléphone renvoie la demande.
  const verrou = LockService.getScriptLock();
  if (!verrou.tryLock(10000)) absReessayer_('le serveur est occupé', true);
  let sh, ligne;
  try {
    sh = absFeuille_();
    ligne = absChercher_(sh, id);
    if (ligne) {
      const r = sh.getRange(ligne, 1, 1, ABS_ENTETES.length).getValues()[0];
      if (String(r[COL_AB.etat - 1]) !== ABS_ETATS.attente) return;      // déjà décidée : rien à refaire, la demande est « reçue »
      if (String(r[COL_AB.direction - 1])) return;                       // le mail à la direction est déjà parti : jamais deux fois
      // Le mail n'est pas encore parti : la ligne reprend le contenu reçu maintenant (elle dira ce que dira le mail)
      absEcrireTexte_(sh, ligne, COL_AB.compte, contenu);
    } else {
      if (compte && absDuJour_(sh, compte) >= ABS_MAX_PAR_JOUR) {
        const e = new Error('Déjà ' + ABS_MAX_PAR_JOUR + ' demandes d’absence aujourd’hui : voyez avec le bureau.'); e.refusDefinitif = true; throw e;
      }
      ligne = sh.getLastRow() + 1;
      if (sh.getMaxRows() < ligne) sh.insertRowsAfter(sh.getMaxRows(), 50);
      absEcrireTexte_(sh, ligne, COL_AB.numero, [id]);
      sh.getRange(ligne, COL_AB.recue).setValue(new Date(maintenant_()));
      absEcrireTexte_(sh, ligne, COL_AB.compte, contenu.concat([ABS_ETATS.attente]));
      // L'onglet « Absences » d'avant, sans le motif, les précisions ni l'imputation (écrit ici, une seule fois par demande)
      try {
        const ancien = feuille_(SHEET_ABSENCES, ['Horodatage', 'Demandeur', 'Date dépôt', 'Date absence', 'Durée', 'Imputation', 'Motif', 'Précisions', 'Email perso']);
        const l = ancien.getLastRow() + 1;
        if (ancien.getMaxRows() < l) ancien.insertRowsAfter(ancien.getMaxRows(), 50);
        ancien.getRange(l, 1).setValue(new Date(maintenant_()));
        absEcrireTexte_(ancien, l, 2, [brut.nom || '', brut.dateDepot || '', brut.dateAbsence || '', brut.duree || '', ABS_RESERVE, ABS_RESERVE, ABS_RESERVE, ''].map(cellule_));
      } catch (err) { console.error('Sheet absences:', err.message); }
    }
  } finally { verrou.releaseLock(); }

  // 2. Le PDF (avec le motif) : fabriqué une fois, joint au mail. Il n'est PAS rangé dans Drive.
  const htmlPDF = modele_absence(validerImages_(brut), esc_);
  const nomFichier = nomFichier_('Absence_' + String(brut.nom || '').replace(/ /g, '_') + '_' + String(brut.dateAbsence || '').replace(/\//g, '-') + '.pdf');
  const pdf = HtmlService.createHtmlOutput(htmlPDF).getAs('application/pdf').setName(nomFichier);

  // 3. Le mail à la direction, et à elle seule. S'il ne peut pas partir du tout, la demande reste dans le téléphone.
  let quota = 0;
  try { quota = MailApp.getRemainingDailyQuota(); } catch (e) {}
  if (quota < direction.length) absReessayer_('le quota de mails du jour est atteint');
  const limite = maintenant_() + ABS_LIEN_JOURS * 86400000;
  const m = absMailDirection_(brut, absLien_(id, limite, 'accepter'), absLien_(id, limite, 'refuser'), limite);
  let partis = 0, erreur = '';
  direction.forEach(adresse => {
    try {
      GmailApp.sendEmail(adresse, m.sujet, m.texte, { htmlBody: m.html, attachments: [pdf.copyBlob().setName(nomFichier)], name: NOM_ENTREPRISE });
      partis++; noter_('envoyé', adresse);
    } catch (err) { erreur = err.message; console.error('Mail à la direction échoué :', err.message); }
  });
  if (!partis) absReessayer_('le mail à la direction n’a pas pu partir (' + erreur + ')');
  // Noté AUSSITÔT : à partir d'ici le poseur voit « En attente », et ce mail ne repartira jamais (même si le téléphone renvoie la demande)
  sh.getRange(ligne, COL_AB.direction).setNumberFormat('@').setValue('envoyé le ' + absQuand_(maintenant_()));
  // Une adresse sur plusieurs a échoué : la direction est prévenue par l'autre ; Franck l'apprend, sans aucun détail de la demande
  if (partis < direction.length) alerte_('Une demande d’absence est partie à ' + partis + ' adresse(s) de la direction sur ' + direction.length + ' (' + erreur + '). Vérifier le réglage ' + ABS_PROP_DIRECTION + '.', 'erreur');
}
function absEcrireTexte_(sh, ligne, colonne, valeurs) { sh.getRange(ligne, colonne, 1, valeurs.length).setNumberFormat('@').setValues([valeurs]); }
// Combien de demandes ce compte a déjà faites aujourd'hui
function absDuJour_(sh, compte) {
  const n = sh.getLastRow() - 1;
  if (n < 1) return 0;
  const jour = t => Utilities.formatDate(new Date(t), 'Europe/Paris', 'yyyy-MM-dd'), aujourdhui = jour(maintenant_());
  return sh.getRange(2, 1, n, COL_AB.compte).getValues().filter(r => String(r[COL_AB.compte - 1]) === compte && absMs_(r[COL_AB.recue - 1]) && jour(absMs_(r[COL_AB.recue - 1])) === aujourdhui).length;
}
// « Le téléphone réessaiera » : la fiche reste dans la file du téléphone. Franck est prévenu (une alerte par jour au plus, sans
// aucun détail de la demande), sauf pour un simple « serveur occupé ».
function absReessayer_(raison, sansAlerte) {
  if (!sansAlerte) alerte_('Une demande d’absence n’a pas pu partir vers la direction (' + raison + '). Elle est gardée dans le téléphone du salarié et repartira toute seule ; '
    + 'si cela dure, vérifier le quota de mails du jour et le réglage ' + ABS_PROP_DIRECTION + '.', 'erreur');
  const e = new Error('Demande gardée dans le téléphone : ' + raison + '. Nouvel essai automatique.'); e.occupe = true; throw e;
}

// Le mail à la direction : texte brut (liens écrits en entier) et version mise en forme avec deux gros boutons, faits en
// tableau (la seule façon d'avoir de vrais boutons dans Outlook)
function absMailDirection_(brut, lienOui, lienNon, limite) {
  const nom = brut.nom || '?', jusquau = Utilities.formatDate(new Date(limite), 'Europe/Paris', 'dd/MM/yyyy');
  const lignes = [['Salarié', nom], ['Date', brut.dateAbsence || '?'], ['Durée', brut.duree || '?'], ['Heures imputées sur', brut.imputation || '—'],
    ['Motif', brut.motif || '?'], ['Précisions', brut.precisions || '—'], ['Demande déposée le', brut.dateDepot || '?']];
  const sujet = '[Loué App] Demande d\'absence — ' + nom + ' — ' + (brut.dateAbsence || '?');
  const texte = 'Bonjour,\n\nDemande d\'absence de ' + nom + '.\n\n' + lignes.slice(1).map(l => l[0] + ' : ' + l[1]).join('\n')
    + '\n\nPour ACCEPTER, ouvrez ce lien puis confirmez :\n' + lienOui + '\n\nPour REFUSER, ouvrez ce lien puis confirmez :\n' + lienNon
    + '\n\nLiens valables jusqu\'au ' + jusquau + ', pour une seule réponse. La demande signée est en pièce jointe.\n\nLoué App';
  const bouton = (lien, libelle, couleur) => '<td bgcolor="' + couleur + '" style="background:' + couleur + ';padding:16px 30px;border-radius:8px">'
    + '<a href="' + esc_(lien) + '" style="font-family:Arial,Helvetica,sans-serif;font-size:19px;font-weight:bold;color:#ffffff;text-decoration:none">' + libelle + '</a></td>';
  const html = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1A2B4A;line-height:1.5">'
    + '<p>Bonjour,</p><p>Demande d\'absence de <b>' + esc_(nom) + '</b>.</p>'
    + '<table cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 20px">'
    + lignes.slice(1).map(l => '<tr><td style="padding:3px 16px 3px 0;color:#555555;vertical-align:top">' + esc_(l[0]) + '</td><td style="padding:3px 0"><b>' + esc_(l[1]).replace(/\n/g, '<br>') + '</b></td></tr>').join('')
    + '</table>'
    + '<table cellpadding="0" cellspacing="0" border="0"><tr>' + bouton(lienOui, '✅ Accepter', '#1E7B34') + '<td width="18">&nbsp;</td>' + bouton(lienNon, '❌ Refuser', '#B3261E') + '</tr></table>'
    + '<p style="font-size:13px;color:#555555;margin-top:18px">Un clic ouvre une page qui rappelle la demande : vous y confirmez votre réponse. '
    + 'Liens valables jusqu\'au ' + jusquau + ', pour une seule réponse. La demande signée est en pièce jointe.</p>'
    + '<p style="font-size:12px;color:#777777">Si les boutons ne s\'affichent pas — Accepter : <a href="' + esc_(lienOui) + '">' + esc_(lienOui) + '</a><br>Refuser : <a href="' + esc_(lienNon) + '">' + esc_(lienNon) + '</a></p>'
    + '<p>Loué App</p></div>';
  return { sujet: sujet, texte: texte, html: html };
}

// ══════════════════════════════════════════════════════════
// LA DIRECTION RÉPOND (page absence-reponse.html — sans compte : c'est le lien signé qui fait foi)
// ══════════════════════════════════════════════════════════
const ABS_REFUS_LIEN = { ok: false, code: 'LIEN_INVALIDE', message: 'Ce lien n’est pas valable. Ouvrez-le depuis le mail de la demande.' };
function absResume_(r, expire) {
  const etat = String(r[COL_AB.etat - 1]);
  return { demandeur: String(r[COL_AB.demandeur - 1]), dateAbsence: String(r[COL_AB.texte - 1]), duree: String(r[COL_AB.duree - 1]),
    etat: etat, decideeLe: absQuand_(absMs_(r[COL_AB.decidee - 1])), expire: etat === ABS_ETATS.attente && !!expire };
}
// Rappelle la demande (qui, quelles dates, quelle durée) : jamais le motif. Ne modifie rien.
function absVoir_(corps) {
  const lien = absVerifierLien_(corps);
  if (!lien.ok) return ABS_REFUS_LIEN;
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ABS_SUIVI), ligne = sh ? absChercher_(sh, lien.id) : 0;
  if (!ligne) return ABS_REFUS_LIEN;
  return { ok: true, code: 'OK', message: '', data: absResume_(sh.getRange(ligne, 1, 1, ABS_ENTETES.length).getValues()[0], lien.expire) };
}
// Enregistre la réponse. Usage unique : une demande déjà décidée ne change plus ; on redit seulement la réponse donnée.
function absDecider_(corps) {
  const lien = absVerifierLien_(corps);
  if (!lien.ok) return ABS_REFUS_LIEN;
  const choix = corps.choix === 'accepter' ? ABS_ETATS.acceptee : corps.choix === 'refuser' ? ABS_ETATS.refusee : '';
  if (!choix) return { ok: false, code: 'DONNEES_INVALIDES', message: 'Réponse inconnue.' };
  const verrou = LockService.getScriptLock();
  if (!verrou.tryLock(10000)) return { ok: false, code: 'SERVEUR_OCCUPE', message: 'Le serveur est occupé : appuyez de nouveau dans un instant.' };
  let sh, ligne, r;
  try {
    sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ABS_SUIVI);
    ligne = sh ? absChercher_(sh, lien.id) : 0;
    if (!ligne) return ABS_REFUS_LIEN;
    r = sh.getRange(ligne, 1, 1, ABS_ENTETES.length).getValues()[0];
    if (String(r[COL_AB.etat - 1]) !== ABS_ETATS.attente) return { ok: true, code: 'DEJA_DECIDE', message: 'Une réponse a déjà été donnée.', data: absResume_(r, false) };
    if (lien.expire) return { ok: false, code: 'LIEN_EXPIRE', message: 'Ce lien a expiré (' + ABS_LIEN_JOURS + ' jours). Le salarié doit refaire sa demande.', data: absResume_(r, true) };
    const quand = new Date(maintenant_());
    r[COL_AB.etat - 1] = choix; r[COL_AB.decidee - 1] = quand; r[COL_AB.mail - 1] = choix === ABS_ETATS.acceptee ? ABS_MAIL_A_ENVOYER : '';
    sh.getRange(ligne, COL_AB.etat, 1, 3).setValues([[choix, quand, r[COL_AB.mail - 1]]]);
    if (choix === ABS_ETATS.acceptee) PropertiesService.getScriptProperties().setProperty(ABS_PROP_A_ENVOYER, '1');
    SpreadsheetApp.flush();
  } finally { verrou.releaseLock(); }
  // Acceptée : le conducteur est prévenu (hors du verrou ; s'il ne part pas, le passage de 10 minutes le renverra)
  if (choix === ABS_ETATS.acceptee) { try { absMailConducteur_(sh, ligne); } catch (err) { console.error('Mail au conducteur :', err.message); } }
  return { ok: true, code: 'OK', message: 'Réponse enregistrée.', data: absResume_(r, false) };
}

// ── Le mail au conducteur de travaux (pour information) : qui, quand, quelle durée, l'appellation du planning. JAMAIS le motif. ──
function absConducteurs_() {
  const vues = {}, liste = [];
  getContactsRaw().filter(r => String(r[5]).toUpperCase() === 'O').forEach(r => decouperAdresses_(r[2]).forEach(a => { if (!vues[a.toLowerCase()]) { vues[a.toLowerCase()] = true; liste.push(a); } }));
  if (!liste.length) decouperAdresses_(emailAdmin_()).forEach(a => liste.push(a));
  return liste;
}
// Rend true si le mail est parti (ou n'a plus à partir). Jamais deux fois : avant d'envoyer, la ligne est marquée « envoi en
// cours » sous le verrou ; un second passage qui arrive pendant l'envoi ne fait rien.
function absMailConducteur_(sh, ligne) {
  const verrou = LockService.getScriptLock();
  if (!verrou.tryLock(5000)) return false;
  let r, a;
  try {
    r = sh.getRange(ligne, 1, 1, ABS_ENTETES.length).getValues()[0];
    const marque = String(r[COL_AB.mail - 1]), enCours = marque.indexOf(ABS_MAIL_EN_COURS) === 0;
    if (String(r[COL_AB.etat - 1]) !== ABS_ETATS.acceptee) return true;
    if (enCours && maintenant_() - (Number(marque.slice(ABS_MAIL_EN_COURS.length)) || 0) < 15 * 60000) return false;   // un autre passage l'envoie
    if (!enCours && marque !== ABS_MAIL_A_ENVOYER) return true;
    a = absConducteurs_();
    if (!a.length) { sh.getRange(ligne, COL_AB.mail).setValue('aucune adresse de conducteur'); return true; }
    let quota = 0;
    try { quota = MailApp.getRemainingDailyQuota(); } catch (e) {}
    if (quota < a.length) { if (enCours) sh.getRange(ligne, COL_AB.mail).setValue(ABS_MAIL_A_ENVOYER); return false; }
    sh.getRange(ligne, COL_AB.mail).setValue(ABS_MAIL_EN_COURS + maintenant_());
    SpreadsheetApp.flush();
  } finally { verrou.releaseLock(); }
  const nom = String(r[COL_AB.demandeur - 1]) || '?', quand = String(r[COL_AB.texte - 1]) || '?';
  try {
    GmailApp.sendEmail(a.join(', '), '[Loué App] Absence acceptée — ' + nom + ' — ' + quand,
      'Bonjour,\n\nLa direction a accepté une demande d\'absence.\n\nSalarié : ' + nom + '\nDate : ' + quand + '\nDurée : ' + (String(r[COL_AB.duree - 1]) || '?')
      + '\nDans le planning : ' + String(r[COL_AB.libelle - 1]) + '\n\nElle s\'inscrit toute seule dans le planning (dans la nuit, ou à la prochaine publication).\n\nLoué App',
      { name: NOM_ENTREPRISE });
  } catch (err) { sh.getRange(ligne, COL_AB.mail).setValue(ABS_MAIL_A_ENVOYER); throw err; }
  sh.getRange(ligne, COL_AB.mail).setValue('envoyé le ' + absQuand_(maintenant_()));
  return true;
}
// Toutes les 10 minutes (traiterComptes) : les mails au conducteur qui n'ont pas pu partir. Ne lève jamais d'erreur.
function absPassage_() {
  try {
    const props = PropertiesService.getScriptProperties();
    if (props.getProperty(ABS_PROP_A_ENVOYER) !== '1') return 'rien';
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ABS_SUIVI);
    const n = sh ? sh.getLastRow() - 1 : 0;
    let restent = 0, partis = 0;
    if (n > 0) sh.getRange(2, COL_AB.mail, n, 1).getValues().forEach((l, i) => {
      if (String(l[0]) !== ABS_MAIL_A_ENVOYER && String(l[0]).indexOf(ABS_MAIL_EN_COURS) !== 0) return;
      let fait = false;
      if (partis < 5) { try { fait = absMailConducteur_(sh, i + 2); } catch (err) { console.error('absPassage_ :', err.message); } }
      if (fait) partis++; else restent++;
    });
    if (!restent) props.deleteProperty(ABS_PROP_A_ENVOYER);
    return partis + ' parti(s), ' + restent + ' en attente';
  } catch (e) { console.error('absPassage_ :', e.message); return 'erreur : ' + e.message; }
}

// ══════════════════════════════════════════════════════════
// LE POSEUR VOIT L'ÉTAT DE SES DEMANDES (action « absencesMiennes », avec son compte)
// ══════════════════════════════════════════════════════════
function absMiennes_(compte) {
  // direction : le réglage est allumé (la page cache alors le champ « e-mail personnel ») ; suivi : il y a quelque chose à
  // montrer (réglage allumé, ou demandes déjà faites avant qu'il soit retiré : leurs liens marchent encore)
  const direction = absDirection_().length > 0;
  const rep = demandes => ({ ok: true, code: 'OK', message: '', data: { suivi: direction || demandes.length > 0, direction: direction, demandes: demandes, jours: ABS_LIEN_JOURS } });
  if (!compte || !compte.id) return rep([]);
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ABS_SUIVI), n = sh ? sh.getLastRow() - 1 : 0;
  if (n < 1) return rep([]);
  const moi = String(compte.id), limite = maintenant_() - ABS_LIEN_JOURS * 86400000;
  // Une demande dont le mail à la direction n'est pas encore parti n'est pas montrée : le téléphone l'affiche lui-même (« ⏳ »)
  const demandes = sh.getRange(2, 1, n, ABS_ENTETES.length).getValues().filter(r => String(r[COL_AB.compte - 1]) === moi && String(r[COL_AB.direction - 1])).map(r => {
    const recue = absMs_(r[COL_AB.recue - 1]);
    let etat = String(r[COL_AB.etat - 1]);
    if (etat === ABS_ETATS.attente && recue && recue < limite) etat = ABS_ETATS.sansReponse;      // le lien de la direction a expiré
    if ([ABS_ETATS.attente, ABS_ETATS.acceptee, ABS_ETATS.refusee, ABS_ETATS.sansReponse].indexOf(etat) < 0) etat = ABS_ETATS.attente;
    return { id: String(r[COL_AB.numero - 1]), recueLe: recue, dateAbsence: String(r[COL_AB.texte - 1]), duree: String(r[COL_AB.duree - 1]), etat: etat,
      decideeLe: absQuand_(absMs_(r[COL_AB.decidee - 1])) };
  });
  return rep(demandes.sort((a, b) => b.recueLe - a.recueLe).slice(0, 15));
}
