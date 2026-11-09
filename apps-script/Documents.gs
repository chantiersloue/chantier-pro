// ═══════════════════════════════════════════════════════════════
// Loué App — Documents.gs : fabrication des PDF et envois par type de fiche
// Les fichiers .gs du projet partagent les mêmes constantes et fonctions.
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// NOTE DE RÉUNION
// ═══════════════════════════════════════════════════════════════
function traiterNoteReunion(data, brut) {
  const now = new Date();

  const chantier = data.chantier || '—';
  const auteur   = data.auteur   || '—';
  const date     = data.date     || Utilities.formatDate(now,'Europe/Paris','dd/MM/yyyy');
  const objet    = data.objet    || '';
  const comment  = data.commentaires || '';

  // ── Photos : 1 seule → inline page 1 / 2+ → 2 par page
  const photosB64 = data.photosBase64 || [];
  let photosInline = '';
  let photosPages  = '';

  if(photosB64.length === 1) {
    const p=photosB64[0]; if(p.data){
      photosInline=`<div style="margin-top:10px;border:1.5px solid #0D7A6B;border-radius:5px;overflow:hidden">
        <div style="background:#E0F5F2;padding:5px 10px;border-bottom:1px solid #0D7A6B">
          <span style="font-size:9px;font-weight:700;color:#0D7A6B;text-transform:uppercase">Photo / Croquis${p.label?' — '+p.label:''}</span>
        </div>
        <div style="padding:8px;text-align:center">
          <img src="data:${p.mimeType||'image/jpeg'};base64,${p.data}" style="max-width:100%;max-height:130mm;width:auto;height:auto;display:block;margin:0 auto;">
        </div>
      </div>`;
    }
  } else if(photosB64.length >= 2) {
    for(let i=0; i<photosB64.length; i+=2) {
      const p1=photosB64[i], p2=photosB64[i+1];
      if(!p1||!p1.data) continue;
      photosPages+=`<div style="page-break-before:always;padding:12px 10px;">
        <div style="font-size:9px;font-weight:700;color:#0D7A6B;margin-bottom:8px;border-bottom:2px solid #0D7A6B;padding-bottom:4px;text-transform:uppercase">
          Photos ${i+1}${p2?' &amp; '+(i+2):''}
        </div>
        <table style="width:100%;border-collapse:collapse"><tr>
          <td style="width:50%;padding-right:8px;text-align:center;vertical-align:top">
            <img src="data:${p1.mimeType||'image/jpeg'};base64,${p1.data}" style="max-width:100%;max-height:120mm;display:block;margin:0 auto;border:1px solid #ddd;">
            ${p1.label?`<div style="margin-top:4px;font-size:10px;color:#6A6460">${p1.label}</div>`:''}
          </td>
          ${p2&&p2.data?`<td style="width:50%;padding-left:8px;text-align:center;vertical-align:top">
            <img src="data:${p2.mimeType||'image/jpeg'};base64,${p2.data}" style="max-width:100%;max-height:120mm;display:block;margin:0 auto;border:1px solid #ddd;">
            ${p2.label?`<div style="margin-top:4px;font-size:10px;color:#6A6460">${p2.label}</div>`:''}
          </td>`:'<td></td>'}
        </tr></table>
      </div>`;
    }
  }

  const htmlPDF = `<html><head><style>
    @page{size:A4;margin:1.5cm}
    body{font-family:Arial,sans-serif;font-size:10px;margin:0}*{box-sizing:border-box}
  </style></head><body>
  <table style="width:100%;border-collapse:collapse;margin-bottom:12px;border-bottom:3px solid #0D7A6B;padding-bottom:10px">
    <tr>
      <td style="width:175px;vertical-align:top">
        <table style="width:100%;border-collapse:collapse;border:1.5px solid #D8D4CE">
          <tr><td style="padding:5px 8px;border-bottom:1px solid #E1DCD6">
            <div style="font-size:7.5px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:2px">Date</div>
            <div style="font-size:12px;font-weight:700">${date}</div>
          </td></tr>
          <tr><td style="padding:5px 8px;border-bottom:1px solid #E1DCD6">
            <div style="font-size:7.5px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:2px">Chantier</div>
            <div style="font-size:12px;font-weight:800;color:#1A2B4A">${chantier}</div>
          </td></tr>
          <tr><td style="padding:5px 8px">
            <div style="font-size:7.5px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:2px">Rédigé par</div>
            <div style="font-size:11px;font-weight:600">${auteur}</div>
          </td></tr>
        </table>
      </td>
      <td style="vertical-align:middle;padding:0 16px;text-align:center">
        <div style="font-weight:800;font-size:15px;color:#1A2B4A">Loué Menuiserie</div>
        <div style="font-size:9px;color:#6A6460;margin-bottom:8px">Menuiserie · Charpente · Agencement</div>
        <div style="font-weight:800;font-size:14px;color:#0D7A6B">NOTE DE RÉUNION</div>
        ${objet?`<div style="margin-top:5px;font-size:11px;font-weight:600;color:#141210">${objet}</div>`:''}
      </td>
    </tr>
  </table>
  ${comment?`<div style="padding:10px 12px;background:#F0F5F4;border:1.5px solid #0D7A6B;border-radius:5px;margin-bottom:10px">
    <div style="font-size:8px;font-weight:700;text-transform:uppercase;color:#0D7A6B;margin-bottom:6px;letter-spacing:.5px">Notes &amp; commentaires</div>
    <div style="font-size:11px;line-height:1.7;white-space:pre-wrap">${comment}</div>
  </div>`:''}
  ${photosInline}
  ${photosPages}
  </body></html>`;

  const nomPDF = nomFichier_(`Note_${brut.chantier||'—'}_${String(brut.date||date).replace(/\//g,'-')}.pdf`);
  const blob   = HtmlService.createHtmlOutput(htmlPDF).getAs('application/pdf').setName(nomPDF);

  // Classement Drive
  const fichier = classerFichierDrive(blob, brut.chantier||'—', 'Note/Réunion/Réunion', nomPDF);

  // Email — blob recréé pour chaque destinataire (évite le bug copyBlob)
  const sujet = `[Loué App] Note de réunion — ${brut.chantier||'—'}${brut.objet?' — '+brut.objet:''}`;
  const corps = `<div style="font-family:Arial,sans-serif;font-size:13px">
    <p>Bonjour,</p>
    <p>Veuillez trouver <strong>en pièce jointe</strong> la note de réunion.</p>
    <table style="font-size:12px;border-collapse:collapse;margin:12px 0">
      <tr><td style="color:#6A6460;padding:3px 14px 3px 0">Chantier</td><td><strong>${chantier}</strong></td></tr>
      <tr><td style="color:#6A6460;padding:3px 14px 3px 0">Date</td><td>${date}</td></tr>
      ${objet?`<tr><td style="color:#6A6460;padding:3px 14px 3px 0">Objet</td><td>${objet}</td></tr>`:''}
      <tr><td style="color:#6A6460;padding:3px 14px 3px 0">Rédigé par</td><td>${auteur}</td></tr>
    </table>
    <p style="color:#6A6460;font-size:11px;margin-top:16px">Loué App · ${Utilities.formatDate(now,'Europe/Paris','dd/MM/yyyy HH:mm')}</p>
  </div>`;

  distribuer_({
    fiche: 'note', chantier: brut.chantier, adresses: brut.destinataires,
    sujet: sujet, html: corps, fichier: fichier, nomPDF: nomPDF,
    texte: `Bonjour,\n\nVeuillez trouver en pièce jointe la note de réunion — ${brut.chantier||'—'}.\n\nLoué App`,
    faireBlob: () => HtmlService.createHtmlOutput(htmlPDF).getAs('application/pdf').setName(nomPDF),
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
  const fichier = classerFichierDrive(blob, brut.chantier||'—', 'Bordereaux', nomPDF);
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
  const fichier = classerFichierDrive(blob, brut.chantier||'—', 'Quitus', nomPDF);
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
    fichier = classerFichierDrive(blobPdf, brut.chantier||'—', 'Fiches', nomPDF);
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

  // Classement automatique dans Drive/[chantier]/Fiches
  let fichier = null;
  try {
    fichier = classerFichierDrive(blobPdf, brut.chantier||'—', 'Fiches', nomPDF);
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

// Classer un fichier dans Drive/[chantier]/[sousDossier]
function classerFichierDrive(blob, chantierNom, sousDossierNom, nomFichier) {
  try {
    const chantierDir   = trouverOuCreerDossierChantier(chantierNom);
    const sousDossier   = trouverOuCreerSousDossier(chantierDir, sousDossierNom);
    // Lot 0 : plus de partage public des PDF produits (les mails les envoient en pièce jointe)
    return sousDossier.createFile(blob.copyBlob().setName(nomFichier));
  } catch(err) {
    console.error('classerFichierDrive:', err.message);
    return null;
  }
}

// Trouve ou crée le dossier chantier + ses 8 sous-dossiers automatiquement
function trouverOuCreerDossierChantier(chantierNom) {
  const root     = DriveApp.getFolderById(driveRootId_());
  const nomClean = String(chantierNom||'—').trim();

  // 1. Cherche correspondance exacte
  let chantierFolder = null;
  const exact = root.getFoldersByName(nomClean);
  if (exact.hasNext()) {
    chantierFolder = exact.next();
  } else {
    // 2. Correspondance souple (ignore casse, cherche inclusion)
    const all = root.getFolders();
    while (all.hasNext()) {
      const f = all.next();
      const fNom = f.getName().toLowerCase().trim();
      if (fNom === 'dossier base') continue;
      if (fNom.includes(nomClean.toLowerCase()) || nomClean.toLowerCase().includes(fNom)) {
        chantierFolder = f;
        break;
      }
    }
  }

  // 3. Pas trouvé → créer le dossier
  if (!chantierFolder) {
    chantierFolder = root.createFolder(nomClean);
  }

  // 4. Dans tous les cas, s'assurer que les 8 sous-dossiers existent
  Object.values(SOUS_DOSSIERS).forEach(nom => {
    const existing = chantierFolder.getFoldersByName(nom);
    if (!existing.hasNext()) {
      chantierFolder.createFolder(nom);
    }
  });

  return chantierFolder;
}

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
  const ss          = SpreadsheetApp.getActiveSpreadsheet();
  const horodatage  = new Date();

  // 1. Enregistrer dans le sheet Absences (créer si besoin)
  let sheet = ss.getSheetByName(SHEET_ABSENCES);
  if(!sheet) {
    sheet = ss.insertSheet(SHEET_ABSENCES);
    sheet.appendRow(['Horodatage','Demandeur','Date dépôt','Date absence','Durée','Imputation','Motif','Précisions','Email perso']);
    sheet.getRange(1,1,1,9).setFontWeight('bold').setBackground('#1A2B4A').setFontColor('white');
  }
  sheet.appendRow([
    horodatage,
    brut.nom||'',
    brut.dateDepot||'',
    brut.dateAbsence||'',
    brut.duree||'',
    brut.imputation||'',
    brut.motif||'',
    brut.precisions||'',
    brut.emailPerso||'',
  ].map(cellule_));

  // 2. Construire le PDF
  const sig = data.signature||'';
  const sigImg = sig ? `<img src="${sig}" style="max-width:100%;max-height:72px;">` : '';
  const today  = data.dateDepot||'';

  const htmlPDF = `<html><head><style>
    @page{size:A4;margin:1.5cm}
    body{font-family:Arial,sans-serif;font-size:10px;margin:0}
    *{box-sizing:border-box}
    table{border-collapse:collapse;width:100%}
    td,th{padding:7px 10px;border:1px solid #D8D4CE;}
    .lbl{font-weight:700;background:#FAFAF8;font-size:9px;color:#6A6460;text-transform:uppercase;width:38%}
  </style></head><body>
  <table style="margin-bottom:16px;border:none">
    <tr>
      <td style="border:none;vertical-align:middle;width:50%">
        <div style="font-weight:800;font-size:16px;color:#1A2B4A">Loué Menuiserie</div>
        <div style="font-size:9px;color:#6A6460">Menuiserie · Charpente · Agencement</div>
      </td>
      <td style="border:none;text-align:center;vertical-align:middle">
        <div style="font-weight:800;font-size:14px;color:#B87A00">DEMANDE D'ABSENCE</div>
        <div style="font-size:10px;color:#6A6460;margin-top:3px">Déposée le ${today}</div>
      </td>
    </tr>
  </table>
  <table style="margin-bottom:12px">
    <tr><td class="lbl">Demandeur</td><td style="font-weight:700">${data.nom||'—'}</td></tr>
    <tr><td class="lbl">Date d'absence</td><td>${data.dateAbsence||'—'}</td></tr>
    <tr><td class="lbl">Durée</td><td>${data.duree||'—'}</td></tr>
    <tr><td class="lbl">Imputation</td><td>${data.imputation||'—'}</td></tr>
    <tr><td class="lbl">Motif</td><td>${data.motif||'—'}</td></tr>
    ${data.precisions?`<tr><td class="lbl">Précisions</td><td>${data.precisions}</td></tr>`:''}
  </table>
  <div style="padding:8px 12px;background:#FFF3CC;border:1px solid #B87A00;border-radius:4px;font-size:10px;color:#B87A00;margin-bottom:14px">
    Les absences seront prises sur votre compteur selon l'imputation choisie.<br>
    Acceptation selon l'accord de la Direction (voir coupon réponse ci-dessous).
  </div>
  <table style="margin-bottom:16px;border:none">
    <tr>
      <td style="border:none;width:50%;padding-right:8px;vertical-align:top">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:4px">Signature du demandeur</div>
        <div style="border:1px solid #D8D4CE;border-radius:4px;height:80px;background:#FAFAF8;text-align:center;padding:4px">${sigImg}</div>
        <div style="font-size:9px;color:#6A6460;margin-top:3px">Fait le ${today} à St Mathurin</div>
      </td>
      <td style="border:none;width:50%"></td>
    </tr>
  </table>
  <div style="border-top:2px dashed #D8D4CE;margin-bottom:14px"></div>
  <div style="text-align:center;font-weight:800;font-size:13px;color:#1A2B4A;margin-bottom:14px;letter-spacing:.5px">COUPON RÉPONSE DE LA DIRECTION</div>
  <div style="display:flex;gap:20px;margin-bottom:10px;font-size:12px">
    <span>☐ Demande acceptée</span><span>☐ Demande refusée</span>
  </div>
  <div style="font-size:12px;margin-bottom:16px">Motif refus : ______________________________________________________</div>
  <table style="border:none">
    <tr>
      <td style="border:none;width:50%;padding-right:8px;vertical-align:top">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:4px">Signature Direction</div>
        <div style="border:1px solid #D8D4CE;border-radius:4px;height:70px;background:#FAFAF8"></div>
        <div style="font-size:9px;color:#6A6460;margin-top:3px">Fait le ________________ à St Mathurin</div>
      </td>
      <td style="border:none;width:50%"></td>
    </tr>
  </table>
  </body></html>`;

  const nomFichier = nomFichier_(`Absence_${String(brut.nom||'').replace(/ /g,'_')}_${String(brut.dateAbsence||'').replace(/\//g,'-')}.pdf`);
  const blob = HtmlService.createHtmlOutput(htmlPDF).getAs('application/pdf').setName(nomFichier);

  // 3. Destinataires calculés par le serveur : contacts colonne H = O, plus l'email perso
  //    (une adresse inconnue du Sheet est traitée comme « adresse libre » : contenu imposé, plafonds, journal)
  const notifies = getContactsRaw().filter(r=>String(r[7]).toUpperCase()==='O').map(r=>r[2]);
  const destinataires = [...notifies, ...(Array.isArray(brut.destinataires) ? brut.destinataires : []), brut.emailPerso].filter(Boolean);
  if(!destinataires.length) destinataires.push(emailAdmin_());

  const sujet = `[Loué App] Demande d'absence — ${brut.nom||'?'} — ${brut.dateAbsence||'?'}`;
  const corps = `Bonjour,\n\nVeuillez trouver ci-joint la demande d'absence de ${brut.nom||'?'}.\n\nDate : ${brut.dateAbsence||'?'}\nDurée : ${brut.duree||'?'}\nMotif : ${brut.motif||'?'}\n\nLoué App`;

  distribuer_({
    fiche: 'absence', chantier: '', adresses: destinataires,
    sujet: sujet, texte: corps, fichier: null, nomPDF: nomFichier,
    faireBlob: () => HtmlService.createHtmlOutput(htmlPDF).getAs('application/pdf').setName(nomFichier),
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
  const fichier = classerFichierDrive(blobPDF, brut.chantier||'DIVERS', 'Réceptions Support', nomFichier);

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
  const fichier = classerFichierDrive(blob, brut.chantier||'DIVERS', 'Attestations', nomFichier);

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
