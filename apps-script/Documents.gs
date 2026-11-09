// ═══════════════════════════════════════════════════════════════
// Loué App — Documents.gs : fabrication des PDF et envois par type de fiche
// Les fichiers .gs du projet partagent les mêmes constantes et fonctions.
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// NOTE DE RÉUNION
// ═══════════════════════════════════════════════════════════════
function traiterNoteReunion(data, brut) {
  const now = new Date();
  // Lot 1 : PDF fabriqué par le modèle unique (modeles/note.js, copié dans Modeles.gs), le même que l'aperçu de la page
  const d = validerImages_(brut);
  if (!d.date) d.date = Utilities.formatDate(now, 'Europe/Paris', 'dd/MM/yyyy');
  const htmlPDF = modele_note(d, esc_);
  const nomPDF = nomFichier_(`Note_${brut.chantier||'—'}_${String(d.date).replace(/\//g,'-')}.pdf`);
  const blob   = HtmlService.createHtmlOutput(htmlPDF).getAs('application/pdf').setName(nomPDF);   // fabriqué une seule fois

  // Classement Drive (lot 1.5 : dossier « note » de dossiers.json, 05 - CHANTIER/COMPTE RENDU par défaut)
  const fichier = classerDocument_('note', blob, brut.chantier, d.date);

  // Mail : textes échappés (data), le PDF en pièce jointe
  const chantier = data.chantier || '—', auteur = data.auteur || '—';
  const ligneObjet = data.objet ? '<tr><td style="color:#6A6460;padding:3px 14px 3px 0">Objet</td><td>' + data.objet + '</td></tr>' : '';
  const sujet = `[Loué App] Note de réunion — ${brut.chantier||'—'}${brut.objet?' — '+brut.objet:''}`;
  const corps = `<div style="font-family:Arial,sans-serif;font-size:13px">
    <p>Bonjour,</p>
    <p>Veuillez trouver <strong>en pièce jointe</strong> la note de réunion.</p>
    <table style="font-size:12px;border-collapse:collapse;margin:12px 0">
      <tr><td style="color:#6A6460;padding:3px 14px 3px 0">Chantier</td><td><strong>${chantier}</strong></td></tr>
      <tr><td style="color:#6A6460;padding:3px 14px 3px 0">Date</td><td>${esc_(d.date)}</td></tr>
      ${ligneObjet}
      <tr><td style="color:#6A6460;padding:3px 14px 3px 0">Rédigé par</td><td>${auteur}</td></tr>
    </table>
    <p style="color:#6A6460;font-size:11px;margin-top:16px">Loué App · ${Utilities.formatDate(now,'Europe/Paris','dd/MM/yyyy HH:mm')}</p>
  </div>`;

  // Destinataires choisis dans la page + copie au conducteur du chantier calculée par le serveur (sinon Franck) :
  // toujours au moins un destinataire, même chantier tapé à la main (comme le quitus, D1-13) — contrôlés par distribuer_
  const adresses = (Array.isArray(brut.destinataires) ? brut.destinataires : []).concat([emailConducteurChantier_(brut.chantier) || emailAdmin_()]);
  distribuer_({
    fiche: 'note', chantier: brut.chantier, adresses: adresses,
    sujet: sujet, html: corps, fichier: fichier, nomPDF: nomPDF,
    texte: 'Bonjour,\n\nVeuillez trouver en pièce jointe la note de réunion — ' + (brut.chantier || '—') + '.\n\nLoué App',
    faireBlob: () => blob,
  });
}



// ═══════════════════════════════════════════════════════════════
// BORDEREAU (Organigramme ou Matériaux)
// ═══════════════════════════════════════════════════════════════
function traiterBordereau(data, brut) {
  const isOrga   = brut.type==='bordereau-orga';
  const nomPDF   = nomFichier_(`Bordereau_${isOrga?'Orga':'Mat'}_${brut.chantier||'—'}_${String(brut.date||'').replace(/\//g,'-')}.pdf`);
  // Lot 1 : PDF fabriqué par le modèle unique (modeles/bordereau.js, copié dans Modeles.gs), le même que l'aperçu de la page
  const htmlPDF = modele_bordereau(validerImages_(brut), esc_);
  const blob = HtmlService.createHtmlOutput(htmlPDF).getAs('application/pdf').setName(nomPDF);
  // Lot 0 : les bordereaux ont leur propre dossier (ils allaient par erreur dans « Quitus »)
  const fichier = classerDocument_(brut.type === 'bordereau-orga' ? 'bordereau-orga' : 'bordereau-materiaux', blob, brut.chantier, brut.date);
  const sujet = `[Loué App] ${isOrga?'Bordereau Organigramme':'Bordereau Matériaux'} — ${brut.chantier||'—'}`;
  // Copie au conducteur du chantier calculée par le serveur (sinon Franck) : toujours au moins un destinataire
  const adresses = (Array.isArray(brut.destinataires) ? brut.destinataires : []).concat([emailConducteurChantier_(brut.chantier) || emailAdmin_()]);
  distribuer_({
    fiche: brut.type, chantier: brut.chantier, adresses: adresses,
    sujet: sujet, texte: 'Bordereau — ' + (brut.chantier||'—') + '\n\nLoué App', fichier: fichier, nomPDF: nomPDF,
    faireBlob: () => blob,
  });
}

// ═══════════════════════════════════════════════════════════════
// QUITUS
// ═══════════════════════════════════════════════════════════════
function traiterQuitus(data, brut) {
  const chantierBrut    = (brut.chantier||'—') + (brut.precision ? ' — ' + brut.precision : '');
  const nomPDF   = nomFichier_(`Quitus_${chantierBrut}_${String(brut.date||'').replace(/\//g,'-')}.pdf`);
  // Lot 1 : PDF fabriqué par le modèle unique (modeles/quitus.js, copié dans Modeles.gs), le même que l'aperçu de la page
  const htmlPDF = modele_quitus(validerImages_(brut), esc_);

  const blob = HtmlService.createHtmlOutput(htmlPDF).getAs('application/pdf').setName(nomPDF);
  const fichier = classerDocument_('quitus', blob, brut.chantier, brut.date, brut.precision);
  const pdfUnique = () => blob;   // le même PDF sert au classement et aux mails
  const sujet = `[Loué App] Quitus — ${chantierBrut}`;
  // Copie au conducteur du chantier calculée par le serveur (sinon Franck) : toujours au moins un destinataire
  const adresses = (Array.isArray(brut.destinataires) ? brut.destinataires : []).concat([emailConducteurChantier_(brut.chantier) || emailAdmin_()]);
  distribuer_({
    fiche: 'quitus', chantier: brut.chantier, adresses: adresses,
    sujet: sujet, texte: `Quitus — ${chantierBrut}\n\nLoué App`, fichier: fichier, nomPDF: nomPDF,
    faireBlob: pdfUnique,
  });
}


// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
function traiterFicheCotes(data, brut) {
  const now = new Date();

  // Enregistrement Sheet — protégé contre les erreurs (données brutes, formules neutralisées)
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_COTES);
    if(sheet) {
      (brut.lignes||[]).forEach(l => {
        sheet.appendRow([brut.ref||'', brut.chantier||'', brut.batiment||'', brut.auteur||'', brut.date||'',
          l.logt||'', l.piece||'', l.haut||'', l.lep||'', l.lhf||'',
          l.long||'', l.prof||'', l.pend||'', l.plinthe||'', l.sol||'',
          brut.socle||'', brut.commentaires||'', now].map(cellule_));
      });
    }
  } catch(err) { console.error('Sheet cotes:', err.message); }

  // Email — toujours exécuté
  envoyerEmailCotes(data, now, brut);
}

function envoyerEmailCotes(data, horodatage, brut) {
  // Destinataire calculé par le serveur : le conducteur choisi, sinon Franck
  const emailCond = emailContact_(brut.conducteur);
  const destinataires = [emailCond || emailAdmin_()];

  console.log('Email cotes — conducteur:', brut.conducteur, '| email:', emailCond);

  // Lot 1 : PDF fabriqué par le modèle unique (modeles/cotes.js, copié dans Modeles.gs), le même que l'aperçu de la page
  const htmlPDF = modele_cotes(validerImages_(brut), esc_);

  const nomPDF = nomFichier_(`Cotes_${brut.chantier||'—'}_${brut.date||''}.pdf`);

  // Classement Drive
  let fichier = null;
  const blobPdf = HtmlService.createHtmlOutput(htmlPDF).getAs('application/pdf').setName(nomPDF);
  try {
    fichier = classerDocument_('cotes', blobPdf, brut.chantier, brut.date);
  } catch(err) { console.error('Drive cotes:', err.message); }

  distribuer_({
    fiche: 'cotes', chantier: brut.chantier, adresses: destinataires,
    sujet: `[Loué App] Prise de cotes — ${brut.chantier||'—'}`, fichier: fichier, nomPDF: nomPDF,
    texte: 'Bonjour,\n\nVeuillez trouver ci-joint la fiche de prise de cotes.\n\nLoué App',
    faireBlob: () => blobPdf,
  });
}


// ═══════════════════════════════════════════════════════════════
// FICHE FABRICATION
// ═══════════════════════════════════════════════════════════════
function traiterFicheFabrication(data, brut) {
  const now = new Date();

  // Enregistrement Sheet — protégé contre les erreurs (données brutes, formules neutralisées)
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_FABRICATION);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_FABRICATION);
      const h = ['N° Série','Chantier','Auteur','Chef Atelier','Conducteur','Date','Délai','Zone','Réf. chantier','Nb Blocs','Commentaires','Horodatage'];
      sheet.appendRow(h);
      sheet.getRange(1,1,1,h.length).setBackground('#1A2B4A').setFontColor('white').setFontWeight('bold');
    }
    // Lot 6 : précision libre du délai, ajoutée EN FIN de ligne (les colonnes existantes ne bougent pas)
    if (!sheet.getRange(1,13).getValue()) {
      sheet.getRange(1,13).setValue('Précision délai').setBackground('#1A2B4A').setFontColor('white').setFontWeight('bold');
    }
    sheet.appendRow([brut.serie||'',brut.chantier||'',brut.auteur||'',brut.chefAtelier||'',brut.conducteur||'',
      brut.date||'',brut.delai||'',brut.zone||'',brut.refChantier||'',(brut.blocs||[]).length,brut.commentaires||'',now,
      brut.delaiPrecision||''].map(cellule_));
  } catch(err) { console.error('Sheet fabrication:', err.message); }

  // Photos uniquement dans le PDF — pas de stockage Drive séparé
  envoyerEmailFabrication(data, now, brut);
}

function envoyerEmailFabrication(data, horodatage, brut) {
  // Destinataires calculés par le serveur : chef d'atelier (colonne G = O) + conducteur choisi
  const contacts = getContactsRaw();
  const chefRow  = contacts.find(r=>String(r[6]).toUpperCase()==='O');
  const emailChef = chefRow ? chefRow[2] : null;
  const emailCond = emailContact_(brut.conducteur);
  const destinataires = [...new Set([emailChef,emailCond].filter(Boolean))];
  if (!destinataires.length) destinataires.push(emailAdmin_());

  // Lot 1 : PDF fabriqué par le modèle unique (modeles/fabrication.js, copié dans Modeles.gs), le même que l'aperçu de la page
  const htmlPDF = modele_fabrication(validerImages_(brut), esc_);
  const nomPDF = nomFichier_(`Fab_${brut.chantier||'—'}${brut.serie?'_S'+brut.serie:''}_${brut.date||''}.pdf`);
  const blobPdf = HtmlService.createHtmlOutput(htmlPDF).getAs('application/pdf').setName(nomPDF);

  // Classement automatique (lot 1.5 : dossier « fabrication » de dossiers.json, 07 - ATELIER par défaut)
  let fichier = null;
  try {
    fichier = classerDocument_('fabrication', blobPdf, brut.chantier, brut.date, brut.serie ? 'S' + brut.serie : '');
  } catch(err) { console.error('Drive fabrication:', err.message); }

  const chantier = data.chantier||'—';
  const ligne = (titre, valeur) => `<tr><td style="color:#6A6460;padding:3px 14px 3px 0">${titre}</td><td>${valeur}</td></tr>`;
  const delaiHtml = `<strong style="color:#9A5600">${data.delai||'—'}</strong>` + (data.delaiPrecision ? ` — ${data.delaiPrecision}` : '');
  const corps = `<div style="font-family:Arial,sans-serif;font-size:13px">
    <p>Bonjour,</p>
    <p>Veuillez trouver <strong>en pièce jointe</strong> la fiche de fabrication PDF.</p>
    <table style="font-size:12px;border-collapse:collapse;margin:12px 0">
      ${ligne('Chantier', '<strong>' + chantier + '</strong>')}
      ${data.serie ? ligne('N° Série', '<strong>' + data.serie + '</strong>') : ''}
      ${ligne('Rédigé par', data.auteur||'—')}
      ${ligne('Date', data.date||'—')}
      ${ligne('Délai', delaiHtml)}
    </table>
    <p style="color:#6A6460;font-size:11px;margin-top:16px">Loué App · ${Utilities.formatDate(horodatage,'Europe/Paris','dd/MM/yyyy HH:mm')}</p>
  </div>`;

  // Lot 0 : chaque envoi est protégé (un échec de mail ne fait plus échouer toute la fiche)
  distribuer_({
    fiche: 'fabrication', chantier: brut.chantier, adresses: destinataires,
    sujet: `[Loué App] Fiche fabrication — ${brut.serie?'Série '+brut.serie+' — ':''}${brut.chantier||'—'}`,
    html: corps, fichier: fichier, nomPDF: nomPDF,
    texte: `Bonjour,\n\nFiche de fabrication en pièce jointe — ${brut.chantier||'—'}${brut.serie?' — Série '+brut.serie:''}.\n\nLoué App`,
    faireBlob: () => blobPdf,
  });
}


// ═══════════════════════════════════════════════════════════════
// UTILITAIRES DRIVE
// ═══════════════════════════════════════════════════════════════

// Trouve ou crée un sous-dossier
function trouverOuCreerSousDossier(parent, nom) {
  const existing = parent.getFoldersByName(nom);
  while (existing.hasNext()) {
    const d = existing.next();
    if (!d.isTrashed()) return d;   // un dossier à la corbeille ne compte pas
  }
  return parent.createFolder(nom);
}

function getContactsRaw() {
  const sc = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CONTACTS);
  return sc ? sc.getDataRange().getValues().slice(1).filter(r=>r[0]) : [];
}

// ══════════════════════════════════════════════════════════
// DEMANDE D'ABSENCE
// ══════════════════════════════════════════════════════════
function traiterAbsence(data, brut) {
  // 1. Sheet « Absences » — mêmes colonnes qu'avant ; protégé contre les erreurs (données brutes, formules neutralisées)
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_ABSENCES);
    if(!sheet) {
      sheet = ss.insertSheet(SHEET_ABSENCES);
      sheet.appendRow(['Horodatage','Demandeur','Date dépôt','Date absence','Durée','Imputation','Motif','Précisions','Email perso']);
      sheet.getRange(1,1,1,9).setFontWeight('bold').setBackground('#1A2B4A').setFontColor('white');
    }
    sheet.appendRow([new Date(), brut.nom||'', brut.dateDepot||'', brut.dateAbsence||'', brut.duree||'',
      brut.imputation||'', brut.motif||'', brut.precisions||'', brut.emailPerso||''].map(cellule_));
  } catch(err) { console.error('Sheet absences:', err.message); }

  // 2. PDF — Lot 1 : modèle unique (modeles/absence.js, copié dans Modeles.gs), le même que l'aperçu de la page
  const htmlPDF = modele_absence(validerImages_(brut), esc_);
  const nomFichier = nomFichier_('Absence_' + String(brut.nom||'').replace(/ /g,'_') + '_' + String(brut.dateAbsence||'').replace(/\//g,'-') + '.pdf');
  const blob = HtmlService.createHtmlOutput(htmlPDF).getAs('application/pdf').setName(nomFichier);   // fabriqué une seule fois

  // 3. Drive (lot 1.5) : ADMINISTRATIF/ABSENCES à la racine (hors chantier), nommé avec la date de la demande et le salarié.
  //    Un mail reporté reprend ce PDF ; il n'est jamais mis à la corbeille (il n'est pas dans _MAILS EN ATTENTE).
  //    Si le rangement échoue (fichier null), on retombe sur l'ancien comportement (PDF temporaire dans _MAILS EN ATTENTE).
  const fichier = classerDocument_('absence', blob, '', brut.dateDepot, brut.nom);

  // 4. Destinataires calculés par le serveur seul : contacts colonne H = O, plus l'email perso
  //    (une adresse inconnue du Sheet est traitée comme « adresse libre » : contenu imposé, plafonds, journal).
  //    La liste « destinataires » envoyée par les anciennes pages (la même, calculée dans la page) est ignorée.
  const notifies = getContactsRaw().filter(r=>String(r[7]).toUpperCase()==='O').map(r=>r[2]);
  const destinataires = [...notifies, brut.emailPerso].filter(Boolean);
  if(!destinataires.length) destinataires.push(emailAdmin_());

  const sujet = `[Loué App] Demande d'absence — ${brut.nom||'?'} — ${brut.dateAbsence||'?'}`;
  const corps = `Bonjour,\n\nVeuillez trouver ci-joint la demande d'absence de ${brut.nom||'?'}.\n\nDate : ${brut.dateAbsence||'?'}\nDurée : ${brut.duree||'?'}\nMotif : ${brut.motif||'?'}\n\nLoué App`;

  distribuer_({
    fiche: 'absence', chantier: '', adresses: destinataires,
    sujet: sujet, texte: corps, fichier: fichier, nomPDF: nomFichier,
    faireBlob: () => blob,
  });
}

// ══════════════════════════════════════════════════════════
// RÉCEPTION SUPPORT
// ══════════════════════════════════════════════════════════
function traiterReceptionSupport(data, brut) {
  const pts   = Array.isArray(brut.points) ? brut.points.filter(p => p) : [];
  const nbOk  = pts.filter(p=>p.state==='ok').length;
  const nbNok = pts.filter(p=>p.state==='nok').length;
  const nbSo  = pts.filter(p=>p.state==='so').length;

  // 1. Sheet — mêmes colonnes qu'avant ; protégé contre les erreurs (données brutes, formules neutralisées)
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const SHEET_REC = 'Réceptions Support';
    let sheet = ss.getSheetByName(SHEET_REC);
    if(!sheet) {
      sheet = ss.insertSheet(SHEET_REC);
      sheet.appendRow(['Horodatage','Chantier','Précision','Signataire','Date','Lot','Nb OK','Nb NOK','Nb SO','Observations']);
      sheet.getRange(1,1,1,10).setFontWeight('bold').setBackground('#0D7A6B').setFontColor('white');
    }
    sheet.appendRow([new Date(), brut.chantier||'', brut.precision||'', brut.signataire||'',
      brut.date||'', brut.lotLabel||'', nbOk, nbNok, nbSo, brut.observations||''].map(cellule_));
  } catch(err) { console.error('Sheet réception support:', err.message); }

  // 2. PDF — Lot 1 : modèle unique (modeles/reception.js, copié dans Modeles.gs), le même que l'aperçu de la page
  const htmlPDF = modele_reception(validerImages_(brut), esc_);
  const nomFichier = nomFichier_(`Reception_${String(brut.chantier||'').replace(/ /g,'_')}_${String(brut.lotLabel||'').replace(/ /g,'_')}.pdf`);
  const blobPDF = HtmlService.createHtmlOutput(htmlPDF).getAs('application/pdf').setName(nomFichier);   // fabriqué une seule fois

  // 3. Drive (sous-dossier « Réceptions Support » du chantier)
  const fichier = classerDocument_('reception-support', blobPDF, brut.chantier, brut.date, brut.lotLabel);

  // 4. Destinataires choisis dans la page (+ « destinataire supplémentaire » des pages d'avant la refonte)
  //    et copie au conducteur du chantier calculée par le serveur (sinon Franck) — contrôlés par distribuer_
  const destinataires = (Array.isArray(brut.destinataires) ? brut.destinataires : [])
    .concat(brut.destSupp ? [brut.destSupp] : [])
    .concat([emailConducteurChantier_(brut.chantier) || emailAdmin_()]);

  const sujet = `[Loué App] Réception Support — ${brut.chantier||'?'} — ${brut.lotLabel||'?'}`;
  const corps = `Bonjour,\n\nVeuillez trouver ci-joint la fiche de réception support.\n\nChantier : ${brut.chantier||'?'}\nLot : ${brut.lotLabel||'?'}\nBilan : ${nbOk} conforme(s) / ${nbNok} non conforme(s)\n\nLoué App`;

  distribuer_({
    fiche: 'reception-support', chantier: brut.chantier, adresses: destinataires,
    sujet: sujet, texte: corps, fichier: fichier, nomPDF: nomFichier,
    faireBlob: () => blobPDF,
  });
}

// ══════════════════════════════════════════════════════════
// ATTESTATION
// ══════════════════════════════════════════════════════════
function traiterAttestation(data, brut) {
  // 1. Sheet — mêmes colonnes qu'avant ; protégé contre les erreurs (données brutes, formules neutralisées)
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const SHEET_ATT = 'Attestations';
    let sheet = ss.getSheetByName(SHEET_ATT);
    if(!sheet){
      sheet = ss.insertSheet(SHEET_ATT);
      sheet.appendRow(['Horodatage','Type','Chantier','Précision','Signataire','Date','Référence','Objet/DAS N°']);
      sheet.getRange(1,1,1,8).setFontWeight('bold').setBackground('#6B3FA0').setFontColor('white');
    }
    const objetOuDas = brut.typeAttest==='das' ? (brut.dasNumero||'') : String(brut.objet||'').substring(0,100);
    sheet.appendRow([new Date(), brut.typeLabel||'', brut.chantier||'', brut.precision||'',
      brut.signataire||'', brut.date||'', brut.ref||'', objetOuDas].map(cellule_));
  } catch(err) { console.error('Sheet attestation:', err.message); }

  // 2. PDF — Lot 1 : modèle unique (modeles/attestation.js, copié dans Modeles.gs), le même que l'aperçu de la page.
  // La qualité du signataire vient TOUJOURS de l'onglet Contacts (colonne B), jamais de la page.
  const d = validerImages_(brut);
  const ligneSig = getContactsRaw().find(r => String(r[0]).trim().toLowerCase() === String(brut.signataire||'').trim().toLowerCase());
  d.qualite = ligneSig ? String(ligneSig[1]||'') : '';
  const htmlPDF = modele_attestation(d, esc_);
  const nomFichier = nomFichier_(`Attestation_${String(brut.typeLabel||'').replace(/ /g,'_')}_${String(brut.chantier||'').replace(/ /g,'_')}.pdf`);
  const blob = HtmlService.createHtmlOutput(htmlPDF).getAs('application/pdf').setName(nomFichier);   // fabriqué une seule fois
  const fichier = classerDocument_('attestation', blob, brut.chantier, brut.date, brut.typeLabel);

  // 3. Mail au conducteur du chantier, calculé par le serveur (sinon Franck) — contrôlé par distribuer_
  const destinataires = [emailConducteurChantier_(brut.chantier) || emailAdmin_()];
  const sujet=`[Loué App] Attestation — ${brut.typeLabel||''} — ${brut.chantier||'?'}`;
  const corps=`Bonjour,\n\nVeuillez trouver ci-joint l'attestation.\n\nType : ${brut.typeLabel||'?'}\nChantier : ${brut.chantier||'?'}\nSignataire : ${brut.signataire||'?'}\n\nLoué App`;
  distribuer_({
    fiche: 'attestation', chantier: brut.chantier, adresses: destinataires,
    sujet: sujet, texte: corps, fichier: fichier, nomPDF: nomFichier,
    faireBlob: () => blob,
  });
}
