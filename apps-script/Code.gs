// ═══════════════════════════════════════════════════════════════
// Loué App — Apps Script v4
// Loué Menuiserie
// ═══════════════════════════════════════════════════════════════

// ── CONFIGURATION ──
const SHEET_CONTACTS      = 'Contacts';
const SHEET_CONTACT_NOTES = 'Contacts notes';
const SHEET_CHANTIERS   = 'Chantiers';
const SHEET_COTES       = 'Prise de Cote';
const SHEET_FABRICATION = 'Fabrication';
const SHEET_MATERIAUX   = 'Materiaux';
const SHEET_FINITIONS   = 'Finitions';
const SHEET_QUINCAILLE  = 'Quincaillerie';
const SHEET_FONCTIONS   = 'Fonctions';
const SHEET_TYPES       = 'Types';
const SHEET_ABSENCES    = 'Absences';
const NOM_ENTREPRISE    = 'Loué Menuiserie';

// ── DRIVE ──
// ID du dossier racine "Loué Menuiserie - Chantiers"
const DRIVE_ROOT_ID     = '1VUEOvq6Wvyqpvf6ISaoJfJXwLCR-OYxm';
// ID du dossier Planning (à la racine du Drive, hors chantiers)
const DRIVE_PLANNING_ID = '1FYY9wdeVb-sn2zggs2JvnjTjMyFavhf0';

// Noms des sous-dossiers dans chaque chantier (exactement comme dans Drive)
const SOUS_DOSSIERS = {
  acces       : 'Accès',
  plans       : 'Plans',
  qt          : 'QT/Tableau',
  cctp        : 'CCTP',
  securite    : 'Sécurité',
  fiches      : 'Fiches',
  notes       : 'Note/Réunion/Réunion',
  quitus      : 'Quitus',
};


// ═══════════════════════════════════════════════════════════════
// GET — contacts, chantiers, documents Drive, listes
// ═══════════════════════════════════════════════════════════════
function doGet(e) {
  const action = e.parameter.action || '';

  if (action === 'getContacts')  return getContacts(e.parameter.callback);
  if (action === 'getDossiers')  return getDossiers(e.parameter.chantier, e.parameter.callback);

  return ContentService.createTextOutput('Loué App API v4 OK').setMimeType(ContentService.MimeType.TEXT);
}

// ── Contacts + chantiers + listes ──
function getContacts(callback) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sc = ss.getSheetByName(SHEET_CONTACTS);
  const contacts = sc ? sc.getDataRange().getValues().slice(1).filter(r=>r[0]).map(r=>({
    nom:String(r[0]||''), role:String(r[1]||''), email:String(r[2]||''),
    chefEquipe:String(r[3]||''), destinataire:String(r[4]||''),
    conducteurDefaut:String(r[5]||''), chefAtelier:String(r[6]||''),
    absenceNotif:String(r[7]||''),
  })) : [];

  const sh = ss.getSheetByName(SHEET_CHANTIERS);
  const chantiers = sh ? sh.getDataRange().getValues().slice(1).filter(r=>r[0]).map(r=>({
    nom        : String(r[0]||''),
    reference  : String(r[1]||''),
    statut     : String(r[2]||''),
    conducteur : String(r[3]||''),  // colonne D = conducteur attribué
  })) : [];

  // Contact notes (destinataires note de réunion) — colonnes A=Nom, B=Email
  const sn = ss.getSheetByName(SHEET_CONTACT_NOTES);
  const contactNotes = sn ? sn.getDataRange().getValues().slice(1).filter(r=>r[0]&&r[1]).map(r=>({
    nom:String(r[0]||''), email:String(r[1]||''),
  })) : [];

  function getList(n){ const s=ss.getSheetByName(n); return s?s.getDataRange().getValues().slice(1).map(r=>String(r[0]||'')).filter(v=>v):[]; }

  const json = JSON.stringify({
    contacts, chantiers, contactNotes,
    materiaux  : getList(SHEET_MATERIAUX),
    finitions  : getList(SHEET_FINITIONS),
    quincaille : getList(SHEET_QUINCAILLE),
    fonctions  : getList(SHEET_FONCTIONS),
    types      : getList(SHEET_TYPES),
  });

  return callback
    ? ContentService.createTextOutput(callback+'('+json+')').setMimeType(ContentService.MimeType.JAVASCRIPT)
    : ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

// ── Lecture automatique des dossiers Drive pour un chantier ──
function getDossiers(chantierNom, callback) {
  const result = {};

  try {
    const root = DriveApp.getFolderById(DRIVE_ROOT_ID);

    // Cas spécial : planning global — lecture directe par ID
    if (chantierNom === '__PLANNING__') {
      try {
        const planningFolder = DriveApp.getFolderById(DRIVE_PLANNING_ID);
        const files = planningFolder.getFiles();
        const docs = [];
        while(files.hasNext()) {
          const f = files.next();
          try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(e){}
          const mime = f.getMimeType();
          let type = 'link';
          if(mime.includes('pdf'))   type='pdf';
          else if(mime.includes('image')) type='image';
          else if(mime.includes('spreadsheet')||mime.includes('excel')) type='xls';
          else if(mime.includes('presentation')) type='ppt';
          else if(mime.includes('document'))     type='doc';
          docs.push({ nom:f.getName(), url:f.getUrl(), type, date:Utilities.formatDate(f.getLastUpdated(),'Europe/Paris','dd/MM/yyyy') });
        }
        docs.sort((a,b)=>b.date.localeCompare(a.date));
        result.planning = docs;
      } catch(err){ console.error('Planning:', err.message); result.planning=[]; }
      const json = JSON.stringify({ dossiers: result });
      return callback
        ? ContentService.createTextOutput(callback+'('+json+')').setMimeType(ContentService.MimeType.JAVASCRIPT)
        : ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
    }

    // Chercher le dossier du chantier
    const chantierFolder = trouverDossierChantier(root, chantierNom);
    if (!chantierFolder) {
      const json = JSON.stringify({ erreur: 'Dossier chantier non trouvé', dossiers: {} });
      return callback
        ? ContentService.createTextOutput(callback+'('+json+')').setMimeType(ContentService.MimeType.JAVASCRIPT)
        : ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
    }

    // Lire chaque sous-dossier
    Object.entries(SOUS_DOSSIERS).forEach(([cle, nomDossier]) => {
      result[cle] = lireSousDossier(chantierFolder, nomDossier);
    });

  } catch(err) {
    console.error('getDossiers:', err.message);
  }

  const json = JSON.stringify({ dossiers: result });
  return callback
    ? ContentService.createTextOutput(callback+'('+json+')').setMimeType(ContentService.MimeType.JAVASCRIPT)
    : ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

// Trouve le dossier chantier même si le nom est légèrement différent
function trouverDossierChantier(root, nomChantier) {
  if (!nomChantier) return null;
  const nomClean = nomChantier.toLowerCase().trim();

  // 1. Chercher dans DOSSIER BASE (modèle) — non
  // 2. Chercher directement sous root
  const folders = root.getFolders();
  while (folders.hasNext()) {
    const f = folders.next();
    const fNom = f.getName().toLowerCase().trim();
    // Correspondance exacte ou partielle
    if (fNom === nomClean || fNom.includes(nomClean) || nomClean.includes(fNom)) {
      // Éviter le dossier modèle
      if (fNom !== 'dossier base') return f;
    }
  }
  return null;
}

// Lit directement un sous-dossier par nom dans un dossier parent
function lireSousDossierParNom(parent, nom) {
  const sub = parent.getFoldersByName(nom);
  if (!sub.hasNext()) return [];
  return lireSousDossier(sub.next(), ''); // passe le dossier lui-même
}

// Lit tous les fichiers d'un sous-dossier (nomSousDossier vide = lire le dossier parent lui-même)
function lireSousDossier(chantierFolder, nomSousDossier) {
  const docs = [];
  try {
    let folder;
    if (!nomSousDossier) {
      folder = chantierFolder;
    } else {
      const subFolders = chantierFolder.getFoldersByName(nomSousDossier);
      if (!subFolders.hasNext()) return docs;
      folder = subFolders.next();
    }

    const files = folder.getFiles();
    while (files.hasNext()) {
      const f = files.next();
      // Partager automatiquement si pas encore partagé
      try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(e){}

      const mime = f.getMimeType();
      let type = 'link';
      if (mime.includes('pdf'))                           type = 'pdf';
      else if (mime.includes('image'))                    type = 'image';
      else if (mime.includes('spreadsheet') || mime.includes('excel')) type = 'xls';
      else if (mime.includes('presentation'))             type = 'ppt';
      else if (mime.includes('document'))                 type = 'doc';

      docs.push({
        nom  : f.getName(),
        url  : f.getUrl(),
        type : type,
        date : Utilities.formatDate(f.getLastUpdated(), 'Europe/Paris', 'dd/MM/yyyy'),
      });
    }
    // Tri par date décroissante
    docs.sort((a,b) => b.date.localeCompare(a.date));
  } catch(err) {
    console.error('lireSousDossier '+nomSousDossier+':', err.message);
  }
  return docs;
}


// ═══════════════════════════════════════════════════════════════
// POST — routage
// ═══════════════════════════════════════════════════════════════
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.type === 'fabrication')       traiterFicheFabrication(data);
    else if (data.type === 'note')         traiterNoteReunion(data);
    else if (data.type === 'bordereau-orga' || data.type === 'bordereau-materiaux') traiterBordereau(data);
    else if (data.type === 'quitus')       traiterQuitus(data);
    else if (data.type === 'absence')      traiterAbsence(data);
    else if (data.type === 'reception-support') traiterReceptionSupport(data);
    else if (data.type === 'attestation')      traiterAttestation(data);
    else if (data.type === 'cotes')        traiterFicheCotes(data);
    else                                   traiterFicheCotes(data);
    return ContentService.createTextOutput(JSON.stringify({status:'ok'})).setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    console.error('doPost:', err.message);
    return ContentService.createTextOutput(JSON.stringify({status:'error',message:err.message})).setMimeType(ContentService.MimeType.JSON);
  }
}


// ═══════════════════════════════════════════════════════════════
// NOTE DE RÉUNION
// ═══════════════════════════════════════════════════════════════
function traiterNoteReunion(data) {
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

  const nomPDF = `Note_${chantier}_${date.replace(/\//g,'-')}.pdf`;
  const blob   = HtmlService.createHtmlOutput(htmlPDF).getAs('application/pdf').setName(nomPDF);

  // Classement Drive
  classerFichierDrive(blob, chantier, 'Note/Réunion/Réunion', nomPDF);

  // Email — blob recréé pour chaque destinataire (évite le bug copyBlob)
  const sujet = `[Loué App] Note de réunion — ${chantier}${objet?' — '+objet:''}`;
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

  const destinataires = [...new Set((data.destinataires||[]).filter(Boolean))];
  console.log('Destinataires note:', JSON.stringify(destinataires));

  if(!destinataires.length) {
    console.log('Aucun destinataire — note classée dans Drive uniquement');
    return;
  }

  destinataires.forEach(email=>{
    try {
      // Recréer le blob pour chaque envoi
      const blobEmail = HtmlService.createHtmlOutput(htmlPDF).getAs('application/pdf').setName(nomPDF);
      GmailApp.sendEmail(email, sujet,
        `Bonjour,\n\nVeuillez trouver en pièce jointe la note de réunion — ${chantier}.\n\nLoué App`,
        {htmlBody:corps, attachments:[blobEmail], name:NOM_ENTREPRISE});
      console.log('Email note envoyé à:', email);
    } catch(err){ console.error('Email note échoué:', email, err.message); }
  });
}



// ═══════════════════════════════════════════════════════════════
// BORDEREAU (Organigramme ou Matériaux)
// ═══════════════════════════════════════════════════════════════
function traiterBordereau(data) {
  const now = new Date();
  const chantier = data.chantier||'—';
  const isOrga   = data.type==='bordereau-orga';
  const titre    = isOrga ? 'BORDEREAU DE REMISE — ORGANIGRAMME' : 'BORDEREAU DE REMISE — MATÉRIAUX';
  const nomPDF   = `Bordereau_${isOrga?'Orga':'Mat'}_${chantier}_${(data.date||'').replace(/\//g,'-')}.pdf`;

  const photosB64 = data.photosBase64||[];
  let photosInline = '';
  let photosPages  = '';
  if(photosB64.length===1 && photosB64[0].data){
    // 1 seule photo : inline sur la page 1, pas de page-break
    photosInline=`<div style="margin-top:10px;border:1px solid #D8D4CE;border-radius:5px;overflow:hidden">
      <div style="background:#FAFAF8;padding:5px 10px;border-bottom:1px solid #D8D4CE;font-size:9px;font-weight:700;color:#7A4200">Photo${photosB64[0].label?' — '+photosB64[0].label:''}</div>
      <div style="padding:8px;text-align:center"><img src="data:${photosB64[0].mimeType||'image/jpeg'};base64,${photosB64[0].data}" style="max-width:100%;max-height:100mm;display:block;margin:0 auto;"></div>
    </div>`;
  } else if(photosB64.length>=2){
    for(let i=0;i<photosB64.length;i+=2){
      const p1=photosB64[i],p2=photosB64[i+1];
      if(!p1||!p1.data) continue;
      photosPages+=`<div style="page-break-before:always;padding:10px">
        <div style="font-size:9px;font-weight:700;color:#7A4200;margin-bottom:6px;border-bottom:2px solid #C8860A;padding-bottom:3px">Photos ${i+1}${p2?' & '+(i+2):''}</div>
        <table style="width:100%;border-collapse:collapse"><tr>
          <td style="width:50%;padding-right:6px;text-align:center"><img src="data:${p1.mimeType||'image/jpeg'};base64,${p1.data}" style="max-width:100%;max-height:110mm;display:block;margin:0 auto;">${p1.label?`<div style="font-size:9px;margin-top:3px;color:#6A6460">${p1.label}</div>`:''}</td>
          ${p2&&p2.data?`<td style="width:50%;padding-left:6px;text-align:center"><img src="data:${p2.mimeType||'image/jpeg'};base64,${p2.data}" style="max-width:100%;max-height:110mm;display:block;margin:0 auto;">${p2.label?`<div style="font-size:9px;margin-top:3px;color:#6A6460">${p2.label}</div>`:''}</td>`:'<td></td>'}
        </tr></table></div>`;
    }
  }

  const mentionOrga = isOrga ? `
    <div style="margin-top:12px;padding:10px 12px;background:#FFF0F0;border:1.5px solid #EFC0C0;border-radius:5px;font-size:10px;color:#B32E2E;line-height:1.7">
      <strong>Le preneur est informé qu'en cas de perte d'un Pass Général, l'ensemble de l'organigramme est à refaire. Les frais étant supportés par le preneur de la clé.</strong><br>
      En cas de perte d'une clé, un forfait de refabrication de <strong>100 € HT</strong> sera facturé au preneur en plus du prix de la clé ou du cylindre complet.
    </div>` : '';

  const htmlPDF = `<html><head><style>@page{size:A4;margin:1.5cm}body{font-family:Arial,sans-serif;font-size:10px;margin:0}*{box-sizing:border-box}</style></head><body>
  <table style="width:100%;border-collapse:collapse;margin-bottom:14px;border-bottom:3px solid #7A4200;padding-bottom:10px">
    <tr>
      <td style="vertical-align:middle;width:40%">
        <div style="font-weight:800;font-size:16px;color:#1A2B4A">Loué Menuiserie</div>
        <div style="font-size:9px;color:#6A6460">Menuiserie · Charpente · Agencement</div>
      </td>
      <td style="vertical-align:middle;text-align:center;width:40%">
        <div style="font-weight:800;font-size:13px;color:#7A4200">${titre}</div>
        <div style="font-size:10px;color:#6A6460;margin-top:4px">Chantier : <b>${chantier}</b></div>
        <div style="font-size:10px;color:#6A6460">Le ${data.date||'—'} à ${data.heure||'—'}</div>
      </td>
      <td style="vertical-align:middle;text-align:right;width:20%">
        <div style="font-size:9px;color:#6A6460">Rédigé par</div>
        <div style="font-size:10px;font-weight:700">${data.soussigne||'—'}</div>
      </td>
    </tr>
  </table>
  <div style="padding:10px 12px;background:#FDF0D6;border:1.5px solid #C8860A;border-radius:5px;margin-bottom:10px;font-size:11px;line-height:1.9">
    Je soussigné(e) <strong>${data.soussigne||'—'}</strong>, Entreprise Loué Menuiserie,<br>
    déclare par la présente avoir remis en main propre à <strong>${data.preneur||'—'}</strong>${data.fonction?' ('+data.fonction+')':''}${data.entreprise?' — '+data.entreprise:''} :<br>
    <strong>${data.nombre||'—'} × ${data.typeDoc||'—'}</strong>${data.commentaires?'<br><span style="color:#6A6460;word-break:break-word">'+data.commentaires+'</span>':''}
  </div>
  ${photosInline}
  ${photosPages}
  <table style="width:100%;border-collapse:collapse;margin-top:14px"><tr>
    <td style="width:50%;padding-right:8px;vertical-align:top">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:4px">Signature Entreprise Loué</div>
      <div style="border:1px solid #D8D4CE;border-radius:4px;height:80px;background:#FAFAF8;text-align:center;padding:4px">${data.sigLoue?`<img src="${data.sigLoue}" style="max-width:100%;max-height:72px;">`:''}</div>
    </td>
    <td style="width:50%;padding-left:8px;vertical-align:top">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:4px">Signature Preneur</div>
      <div style="border:1px solid #D8D4CE;border-radius:4px;height:80px;background:#FAFAF8;text-align:center;padding:4px">${data.sigPreneur?`<img src="${data.sigPreneur}" style="max-width:100%;max-height:72px;">`:''}</div>
    </td>
  </tr></table>
  ${mentionOrga}
  </body></html>`;

  const blob = HtmlService.createHtmlOutput(htmlPDF).getAs('application/pdf').setName(nomPDF);
  classerFichierDrive(blob, chantier, 'Quitus', nomPDF);
  const sujet = `[Loué App] ${isOrga?'Bordereau Organigramme':'Bordereau Matériaux'} — ${chantier}`;
  const destinataires = [...new Set((data.destinataires||[]).filter(Boolean))];
  destinataires.forEach(email=>{
    try { const b2=HtmlService.createHtmlOutput(htmlPDF).getAs('application/pdf').setName(nomPDF);
      GmailApp.sendEmail(email,sujet,`Bordereau — ${chantier}\n\nLoué App`,{attachments:[b2],name:NOM_ENTREPRISE});
    } catch(err){ console.error('Email bordereau:',email,err.message); }
  });
}


// ═══════════════════════════════════════════════════════════════
// QUITUS
// ═══════════════════════════════════════════════════════════════
function traiterQuitus(data) {
  const chantier        = data.chantier||'—';
  const precision       = data.precision||'';
  const chantierAffiche = precision ? chantier + ' — ' + precision : chantier;
  const nomPDF   = `Quitus_${chantierAffiche}_${(data.date||'').replace(/\//g,'-')}.pdf`;
  const solde    = data.solde||'—';
  const soldeColor = solde==='OUI'?'#196B3B':solde==='NON'?'#B32E2E':'#6A6460';
  const soldeBg    = solde==='OUI'?'#E1F2E9':solde==='NON'?'#FAE8E8':'#F2F0EC';

  const photosB64 = data.photosBase64||[];
  let photosInline = '';
  let photosPages  = '';
  if(photosB64.length===1 && photosB64[0].data){
    photosInline=`<div style="margin-top:10px;border:1px solid #D8D4CE;border-radius:5px;overflow:hidden">
      <div style="background:#E1F2E9;padding:5px 10px;border-bottom:1px solid #196B3B;font-size:9px;font-weight:700;color:#196B3B">Photo</div>
      <div style="padding:8px;text-align:center"><img src="data:${photosB64[0].mimeType||'image/jpeg'};base64,${photosB64[0].data}" style="max-width:100%;max-height:100mm;display:block;margin:0 auto;"></div>
    </div>`;
  } else if(photosB64.length>=2){
    for(let i=0;i<photosB64.length;i+=2){
      const p1=photosB64[i],p2=photosB64[i+1];
      if(!p1||!p1.data) continue;
      photosPages+=`<div style="page-break-before:always;padding:10px"><table style="width:100%;border-collapse:collapse"><tr>
        <td style="width:50%;padding-right:6px;text-align:center"><img src="data:${p1.mimeType||'image/jpeg'};base64,${p1.data}" style="max-width:100%;max-height:110mm;display:block;margin:0 auto;"></td>
        ${p2&&p2.data?`<td style="width:50%;padding-left:6px;text-align:center"><img src="data:${p2.mimeType||'image/jpeg'};base64,${p2.data}" style="max-width:100%;max-height:110mm;display:block;margin:0 auto;"></td>`:'<td></td>'}
      </tr></table></div>`;
    }
  }

  const htmlPDF = `<html><head><style>@page{size:A4;margin:1.5cm}body{font-family:Arial,sans-serif;font-size:10px;margin:0}*{box-sizing:border-box}</style></head><body>
  <table style="width:100%;border-collapse:collapse;margin-bottom:14px;border-bottom:3px solid #196B3B;padding-bottom:10px">
    <tr>
      <td style="vertical-align:middle;width:40%">
        <div style="font-weight:800;font-size:16px;color:#1A2B4A">Loué Menuiserie</div>
        <div style="font-size:9px;color:#6A6460">Menuiserie · Charpente · Agencement</div>
      </td>
      <td style="vertical-align:middle;text-align:center;width:40%">
        <div style="font-weight:800;font-size:15px;color:#196B3B">QUITUS</div>
        <div style="font-size:11px;color:#6A6460;margin-top:4px">Chantier : <b>${chantierAffiche}</b></div>
        <div style="font-size:11px;color:#6A6460">Le ${data.date||'—'} à ${data.heure||'—'}</div>
      </td>
      <td style="vertical-align:middle;text-align:right;width:20%">
        <div style="font-size:9px;color:#6A6460">Client</div>
        <div style="font-size:10px;font-weight:700">${data.intervenant||'—'}</div>
      </td>
    </tr>
  </table>
  <div style="padding:10px 12px;background:#E1F2E9;border:1.5px solid #196B3B;border-radius:5px;margin-bottom:10px;font-size:11px"><strong>Client :</strong> ${data.intervenant||'—'}</div>
  ${data.description?`<div style="padding:10px 12px;background:#F7F5F1;border:1px solid #D8D4CE;border-radius:5px;margin-bottom:10px"><div style="font-size:8px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:5px">Description Intervention</div><div style="font-size:11px;line-height:1.7;white-space:pre-wrap;word-break:break-word;overflow-wrap:break-word">${data.description}</div></div>`:''}
  <div style="display:inline-flex;align-items:center;padding:8px 14px;background:${soldeBg};border:1.5px solid ${soldeColor};border-radius:8px;margin-bottom:12px"><span style="font-size:11px;font-weight:700;color:${soldeColor}">SOLDÉ : ${solde}</span></div>
  ${photosInline}
  ${photosPages}
  <table style="width:100%;border-collapse:collapse;margin-top:14px"><tr>
    <td style="width:50%;padding-right:8px;vertical-align:top">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:4px">Signature Entreprise Loué</div>
      <div style="border:1px solid #D8D4CE;border-radius:4px;height:80px;background:#FAFAF8;text-align:center;padding:4px">${data.sigLoue?`<img src="${data.sigLoue}" style="max-width:100%;max-height:72px;">`:''}</div>
    </td>
    <td style="width:50%;padding-left:8px;vertical-align:top">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:4px">Signature Client</div>
      <div style="border:1px solid #D8D4CE;border-radius:4px;height:80px;background:#FAFAF8;text-align:center;padding:4px">${data.sigIntervenant?`<img src="${data.sigIntervenant}" style="max-width:100%;max-height:72px;">`:''}</div>
    </td>
  </tr></table>
  </body></html>`;

  const blob = HtmlService.createHtmlOutput(htmlPDF).getAs('application/pdf').setName(nomPDF);
  classerFichierDrive(blob, chantier, 'Quitus', nomPDF);
  const sujet = `[Loué App] Quitus — ${chantierAffiche}`;
  const destinataires = [...new Set((data.destinataires||[]).filter(Boolean))];
  destinataires.forEach(email=>{
    try { const b2=HtmlService.createHtmlOutput(htmlPDF).getAs('application/pdf').setName(nomPDF);
      GmailApp.sendEmail(email,sujet,`Quitus — ${chantierAffiche}\n\nLoué App`,{attachments:[b2],name:NOM_ENTREPRISE});
    } catch(err){ console.error('Email quitus:',email,err.message); }
  });
}


// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
function traiterFicheCotes(data) {
  const now = new Date();

  // Enregistrement Sheet — protégé contre les erreurs
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_COTES);
    if(sheet) {
      (data.lignes||[]).forEach(l => {
        sheet.appendRow([data.ref||'', data.chantier||'', data.batiment||'', data.auteur||'', data.date||'',
          l.logt||'', l.piece||'', l.haut||'', l.lep||'', l.lhf||'',
          l.long||'', l.prof||'', l.pend||'', l.plinthe||'', l.sol||'',
          data.socle||'', data.commentaires||'', now]);
      });
    }
  } catch(err) { console.error('Sheet cotes:', err.message); }

  // Email — toujours exécuté
  envoyerEmailCotes(data, now);
}

function envoyerEmailCotes(data, horodatage) {
  const contacts = getContactsRaw();
  const condRow  = contacts.find(r => String(r[0]).toLowerCase() === (data.conducteur||'').toLowerCase());
  const emailCond = condRow ? condRow[2] : null;

  const destinataires = emailCond ? [emailCond] : [];

  if(!destinataires.length) {
    const fallback = Session.getActiveUser().getEmail();
    console.log('Conducteur "'+data.conducteur+'" non trouvé — fallback Session:', fallback);
    destinataires.push(fallback);
  }

  console.log('Email cotes — conducteur:', data.conducteur, '| email:', emailCond);

  const chantier     = data.chantier || '—';
  const hasSocle     = data.socle === 'OUI';
  const sujet        = `[Loué App] Prise de cotes — ${chantier}`;
  const commentaires = data.commentaires || '';

  const lignesHtml = (data.lignes||[]).map((l,i) => `
    <tr style="background:${i%2===0?'#F7F5F1':'white'}">
      <td style="padding:5px 4px;border:1px solid #ddd;font-weight:700">${l.logt||'—'}</td>
      <td style="padding:5px 4px;border:1px solid #ddd">${l.piece||'—'}</td>
      <td style="padding:5px 4px;border:1px solid #ddd;text-align:center;font-weight:700">${l.haut||'—'}</td>
      <td style="padding:5px 4px;border:1px solid #ddd;text-align:center">${l.lep||'—'}</td>
      <td style="padding:5px 4px;border:1px solid #ddd;text-align:center">${l.lhf||'—'}</td>
      <td style="padding:5px 4px;border:1px solid #ddd;text-align:center;font-weight:700">${l.long||'—'}</td>
      <td style="padding:5px 4px;border:1px solid #ddd;text-align:center">${l.prof||'—'}</td>
      <td style="padding:5px 4px;border:1px solid #ddd;text-align:center">${l.pend||'—'}</td>
      <td style="padding:5px 4px;border:1px solid #ddd;text-align:center;color:#7A4200">${l.plinthe||'—'}</td>
      <td style="padding:5px 4px;border:1px solid #ddd;text-align:center;color:#1454A0;font-weight:600">${l.sol||'—'}</td>
      ${hasSocle?`<td style="padding:5px 4px;border:1px solid #ddd;text-align:center;background:#FAE8E8;font-weight:700;color:#B32E2E">OUI</td>`:''}
    </tr>`).join('');

  const htmlPDF = `<html><head><style>
    @page{size:landscape;margin:1cm}
    body{font-family:Arial,sans-serif;font-size:10px;margin:0}
    table{width:100%;border-collapse:collapse}
    th{background:#1A2B4A;color:white;padding:5px 4px;font-size:9px;text-align:center}
    td{border:1px solid #ddd;padding:5px 4px;font-size:10px}
  </style></head><body>
    <table style="margin-bottom:10px;border-bottom:3px solid #1A2B4A;padding-bottom:8px"><tr>
      <td style="border:none"><div style="font-weight:800;font-size:14px;color:#1A2B4A">Loué Menuiserie</div><div style="font-size:9px;color:#999">Menuiserie · Charpente · Agencement</div></td>
      <td style="border:none;text-align:center">
        <div style="font-weight:800;font-size:12px;color:#1A2B4A">PRISE DE COTES — FAÇADES &amp; PLACARDS</div>
        <div style="font-size:10px;color:#666;margin-top:3px">Chantier : <b>${chantier}</b> &nbsp;|&nbsp; Par : <b>${data.auteur||'—'}</b> &nbsp;|&nbsp; Date : <b>${data.date||'—'}</b></div>
      </td>
      <td style="border:none;text-align:right">
        <div style="background:${hasSocle?'#B32E2E':'#2A5A3A'};color:white;padding:6px 14px;border-radius:4px;font-weight:700;font-size:13px;display:inline-block">${hasSocle?'SOCLE POSÉ':'PAS DE SOCLE'}</div>
      </td>
    </tr></table>
    <table><thead><tr>
      <th style="text-align:left">N°</th>
      <th style="text-align:left">Pièce</th>
      <th>Hauteur<br><span style="font-weight:400;font-size:7px">Façade</span></th>
      <th>Larg. Entre<br><span style="font-weight:400;font-size:7px">Plinthes</span></th>
      <th>Larg. Haut<br><span style="font-weight:400;font-size:7px">Façade</span></th>
      <th>Longueur<br><span style="font-weight:400;font-size:7px">Amén.</span></th>
      <th>Prof<br><span style="font-weight:400;font-size:7px">Amén.</span></th>
      <th>Côté<br><span style="font-weight:400;font-size:7px">Penderie</span></th>
      <th>Haut.<br><span style="font-weight:400;font-size:7px">Plinthe</span></th>
      <th>Sol</th>
      ${hasSocle?'<th style="background:#B32E2E">Socle</th>':''}
    </tr></thead><tbody>${lignesHtml}</tbody></table>
    ${commentaires?`<div style="margin-top:10px;padding:8px;border:1px solid #ccc"><b>Commentaires :</b> ${commentaires}</div>`:''}
  </body></html>`;

  const nomPDF = `Cotes_${chantier}_${data.date||''}.pdf`;

  // Classement Drive
  try {
    const blobDrive = HtmlService.createHtmlOutput(htmlPDF).getAs('application/pdf').setName(nomPDF);
    classerFichierDrive(blobDrive, chantier, 'Fiches', nomPDF);
  } catch(err) { console.error('Drive cotes:', err.message); }

  // Email — même pattern que fab : forEach sur destinataires
  destinataires.forEach(email => {
    try {
      const blobEmail = HtmlService.createHtmlOutput(htmlPDF).getAs('application/pdf').setName(nomPDF);
      GmailApp.sendEmail(email, sujet,
        'Bonjour,\n\nVeuillez trouver ci-joint la fiche de prise de cotes.\n\nLoué App',
        {attachments:[blobEmail], name:NOM_ENTREPRISE});
      console.log('Email cotes envoyé à:', email);
    } catch(err) { console.error('Email cotes:', email, err.message); }
  });
}


// ═══════════════════════════════════════════════════════════════
// FICHE FABRICATION
// ═══════════════════════════════════════════════════════════════
function traiterFicheFabrication(data) {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const now = new Date();

  let sheet = ss.getSheetByName(SHEET_FABRICATION);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_FABRICATION);
    const h = ['N° Série','Chantier','Auteur','Chef Atelier','Conducteur','Date','Délai','Zone','Réf. chantier','Nb Blocs','Commentaires','Horodatage'];
    sheet.appendRow(h);
    sheet.getRange(1,1,1,h.length).setBackground('#1A2B4A').setFontColor('white').setFontWeight('bold');
  }
  sheet.appendRow([data.serie||'',data.chantier,data.auteur,data.chefAtelier||'',data.conducteur||'',
    data.date,data.delai||'',data.zone||'',data.refChantier||'',(data.blocs||[]).length,data.commentaires||'',now]);

  // Photos Drive
  // Photos uniquement dans le PDF — pas de stockage Drive séparé
  envoyerEmailFabrication(data, [], now);
}

function sauvegarderPhotos(photosBase64, chantier, serie, now) {
  const liens = [];
  try {
    // Sauvegarder dans Drive/[chantier]/Fiches/[serie]
    const chantierFolder = trouverOuCreerDossierChantier(chantier);
    const fichesFolder   = trouverOuCreerSousDossier(chantierFolder, 'Fiches');
    const nomDossier = serie
      ? `Série ${serie} — ${Utilities.formatDate(now,'Europe/Paris','dd-MM-yyyy')}`
      : Utilities.formatDate(now,'Europe/Paris','dd-MM-yyyy HH-mm');
    const photoFolder = fichesFolder.createFolder(nomDossier);

    photosBase64.forEach((p,i) => {
      try {
        const bytes = Utilities.base64Decode(p.data);
        const file  = photoFolder.createFile(
          Utilities.newBlob(bytes, p.mimeType||'image/jpeg', `Photo_${i+1}.jpg`)
        );
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        liens.push({nom: p.label||`Photo ${i+1}`, url: file.getUrl()});
      } catch(err){ console.error('Photo '+i, err.message); }
    });
  } catch(err){ console.error('sauvegarderPhotos:', err.message); }
  return liens;
}

function envoyerEmailFabrication(data, liensDrive, horodatage) {
  const contacts = getContactsRaw();
  const chefRow  = contacts.find(r=>String(r[6]).toUpperCase()==='O');
  const condRow  = contacts.find(r=>String(r[0]).toLowerCase()===(data.conducteur||'').toLowerCase());
  const emailChef = chefRow ? chefRow[2] : null;
  const emailCond = condRow ? condRow[2] : null;
  const destinataires = [...new Set([emailChef,emailCond].filter(Boolean))];
  if (!destinataires.length){ console.log('Aucun destinataire fab'); return; }

  const serie    = data.serie||'';
  const chantier = data.chantier||'—';
  const sujet    = `[Loué App] Fiche fabrication — ${serie?'Série '+serie+' — ':''}${chantier}`;

  // ── En-tête PDF ──
  const serieCell = serie
    ? `<div style="font-size:13px;font-weight:800;color:#1A2B4A">${serie}</div>`
    : `<div style="width:90px;height:22px;border:1.5px solid #1A2B4A;border-radius:3px;margin-top:2px"></div>`;

  const leftRows = `
    <tr><td style="padding:5px 8px;border-bottom:1px solid #E1DCD6;border-right:1px solid #E1DCD6;width:50%">
      <div style="font-size:7.5px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:2px">N° Série</div>${serieCell}
    </td><td style="padding:5px 8px;border-bottom:1px solid #E1DCD6;width:50%">
      <div style="font-size:7.5px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:2px">Date</div>
      <div style="font-size:11px;font-weight:600">${data.date||'—'}</div>
    </td></tr>
    <tr><td colspan="2" style="padding:5px 8px;border-bottom:1px solid #E1DCD6">
      <div style="font-size:7.5px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:2px">Chantier</div>
      <div style="font-size:12px;font-weight:800;color:#1A2B4A">${chantier}${data.refChantier?' / '+data.refChantier:''}</div>
    </td></tr>
    <tr><td style="padding:5px 8px;border-right:1px solid #E1DCD6;width:50%">
      <div style="font-size:7.5px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:2px">Responsable</div>
      <div style="font-size:11px;font-weight:600">${data.auteur||'—'}</div>
    </td><td style="padding:5px 8px;width:50%">
      <div style="font-size:7.5px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:2px">Délai</div>
      <div style="font-size:11px;font-weight:700;color:#9A5600">${data.delai||'—'}</div>
    </td></tr>
    ${data.zone?`<tr><td colspan="2" style="padding:5px 8px">
      <div style="font-size:7.5px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:2px">Zone</div>
      <div style="font-size:10px">${data.zone}</div>
    </td></tr>`:''}`;

  const tempsRows = Array(6).fill(null).map(()=>`<tr>
    <td style="padding:5px;border:1px solid #E1DCD6;min-width:65px;height:20px"></td>
    <td style="padding:5px;border:1px solid #E1DCD6;width:52px;height:20px"></td>
    <td style="padding:5px;border:1px solid #E1DCD6;width:52px;height:20px"></td>
  </tr>`).join('');

  const enTete = `
  <table style="width:100%;border-collapse:collapse;margin-bottom:10px;border-bottom:3px solid #1A2B4A;padding-bottom:8px">
    <tr>
      <td style="width:340px;vertical-align:top;padding-right:12px">
        <table style="width:100%;border-collapse:collapse;border:1.5px solid #D8D4CE">${leftRows}</table>
      </td>
      <td style="vertical-align:top;padding:0 12px">
        <div style="font-weight:800;font-size:15px;color:#1A2B4A">Loué Menuiserie</div>
        <div style="font-size:9px;color:#6A6460;margin-bottom:6px">Menuiserie · Charpente · Agencement</div>
        <div style="font-weight:800;font-size:13px;color:#1A2B4A">FICHE DE FABRICATION</div>
        <div style="margin-top:6px;font-size:10px;color:#6A6460">
          Chef d'atelier : <b style="color:#141210">${data.chefAtelier||'—'}</b>
          &nbsp;·&nbsp; Conducteur : <b style="color:#141210">${data.conducteur||'—'}</b>
        </div>
      </td>
      <td style="width:185px;vertical-align:top">
        <div style="font-size:8px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:3px">Opérateurs / Temps</div>
        <table style="width:100%;border-collapse:collapse;border:1.5px solid #D8D4CE;font-size:9px">
          <tr>
            <th style="padding:4px 5px;background:#1A2B4A;color:white;text-align:left;font-size:8px">Opérateur</th>
            <th style="padding:4px 5px;background:#1A2B4A;color:white;font-size:8px">Objectif</th>
            <th style="padding:4px 5px;background:#1A2B4A;color:white;font-size:8px">Réalisé</th>
          </tr>${tempsRows}
        </table>
      </td>
    </tr>
  </table>`;

  // ── Blocs ──
  const blocsHtml = (data.blocs||[]).map(b => {
    const label   = b.type==='porte'
      ? ({complet:'Bloc porte complet',vantail:'Vantail seul',huisserie:'Huisserie seule'}[b.porteType]||'Bloc porte')
      : (b.type==='photo'?'Photo / Croquis':'Divers');
    const clr   = b.type==='divers'?'#1A2B4A':b.type==='photo'?'#6B3FA0':'#7A4200';
    const clrBg = b.type==='divers'?'#EBF1FA':b.type==='photo'?'#EDE8F8':'#FDF0D6';
    let inner = '';

    if (b.type==='divers' && (b.rows||[]).length) {
      const trs = b.rows.map((r,i)=>`<tr style="background:${i%2===0?'#F7F5F1':'white'}">
        <td style="padding:4px 6px;border:1px solid #E1DCD6;font-weight:700;font-size:10px">${r.repere||'—'}</td>
        <td style="padding:4px 6px;border:1px solid #E1DCD6;text-align:center;font-weight:700;font-size:10px">${r.qte||'—'}</td>
        <td style="padding:4px 6px;border:1px solid #E1DCD6;text-align:center;font-size:10px">${r.long||'—'}</td>
        <td style="padding:4px 6px;border:1px solid #E1DCD6;text-align:center;font-size:10px">${r.larg||'—'}</td>
        <td style="padding:4px 6px;border:1px solid #E1DCD6;text-align:center;font-size:10px">${r.haut||'—'}</td>
        <td style="padding:4px 6px;border:1px solid #E1DCD6;text-align:center;font-size:10px">${r.section||'—'}</td>
        <td style="padding:4px 6px;border:1px solid #E1DCD6;font-size:10px">${r.materiau||'—'}</td>
        <td style="padding:4px 6px;border:1px solid #E1DCD6;font-size:10px">${r.finition||'—'}</td>
        <td style="padding:4px 6px;border:1px solid #E1DCD6;font-size:10px">${r.quincaillerie||'—'}</td>
        <td style="padding:4px 6px;border:1px solid #E1DCD6;font-size:9px">${r.observations||''}</td>
      </tr>`).join('');
      inner = `<table style="width:100%;border-collapse:collapse"><thead>
        <tr>
          <th rowspan="2" style="padding:5px 6px;background:#1A2B4A;color:white;font-size:9px;text-align:left">Rep.</th>
          <th rowspan="2" style="padding:5px 6px;background:#1A2B4A;color:white;font-size:9px">Qté</th>
          <th colspan="3" style="padding:5px 6px;background:#203A6D;color:white;font-size:9px">DIMENSIONS (mm)</th>
          <th rowspan="2" style="padding:5px 6px;background:#203A6D;color:white;font-size:9px">Section</th>
          <th rowspan="2" style="padding:5px 6px;background:#2A5A3A;color:white;font-size:9px">Matériau</th>
          <th rowspan="2" style="padding:5px 6px;background:#6B3FA0;color:white;font-size:9px">Finition</th>
          <th rowspan="2" style="padding:5px 6px;background:#6B3FA0;color:white;font-size:9px">Quincaillerie</th>
          <th rowspan="2" style="padding:5px 6px;background:#1A2B4A;color:white;font-size:9px">Observations</th>
        </tr>
        <tr>
          <th style="padding:4px 6px;background:#2A4A8A;color:white;font-size:9px">Long.</th>
          <th style="padding:4px 6px;background:#2A4A8A;color:white;font-size:9px">Larg.</th>
          <th style="padding:4px 6px;background:#2A4A8A;color:white;font-size:9px">Ep.</th>
        </tr>
      </thead><tbody>${trs}</tbody></table>`;
    }

    if (b.type==='porte' && (b.rows||[]).length) {
      const isV = b.porteType==='vantail'||b.porteType==='complet';
      const isH = b.porteType==='huisserie'||b.porteType==='complet';
      // Ferrage + Serrure : 1 seule colonne commune pour tous les types
      const nbColsV = isV ? 4 : 0; // haut larg sens nature
      const nbColsH = isH ? 5 : 0; // support ep sens feuillure rainure
      const thV = isV?`<th colspan="${nbColsV}" style="padding:5px;background:#203A6D;color:white;font-size:9px">VANTAIL</th>`:'';
      const thH = isH?`<th colspan="${nbColsH}" style="padding:5px;background:#2A5A3A;color:white;font-size:9px">HUISSERIE</th>`:'';
      const thC = `<th colspan="3" style="padding:5px;background:#4A2A7A;color:white;font-size:9px">FERRAGE / SERRURE</th>`;
      const sv='padding:4px 5px;background:#2A4A8A;color:white;font-size:8.5px';
      const sh='padding:4px 5px;background:#3A7A4A;color:white;font-size:8.5px';
      const sc='padding:4px 5px;background:#4A2A7A;color:white;font-size:8.5px';
      const th2V=isV?`<th style="${sv}">Haut.</th><th style="${sv}">Larg.</th><th style="${sv}">Sens</th><th style="${sv}">Nature</th>`:'';
      const th2H=isH?`<th style="${sh}">Support</th><th style="${sh}">Ép.</th><th style="${sh}">Sens</th><th style="${sh}">Feuillure</th><th style="${sh}">Rainure</th>`:'';
      const th2C=`<th style="${sc}">Ferrage</th><th style="${sc}">QT</th><th style="${sc}">Serrure</th>`;
      const c='padding:4px 5px;border:1px solid #E1DCD6;font-size:9.5px';
      const trs = b.rows.map((r,i)=>{
        const tdV=isV?`<td style="${c};text-align:center">${r.haut||'—'}</td><td style="${c};text-align:center">${r.larg||'—'}</td><td style="${c}">${r.sens||'—'}</td><td style="${c}">${r.nature||'—'}</td>`:'';
        const tdH=isH?`<td style="${c}">${r.support||'—'}</td><td style="${c};text-align:center">${r.epSupport||'—'}</td><td style="${c}">${r.sensH||r.sens||'—'}</td><td style="${c}">${r.feuillure||'—'}</td><td style="${c};text-align:center">${r.rainure||'—'}</td>`:'';
        const tdC=`<td style="${c}">${r.ferrageType||'—'}</td><td style="${c};text-align:center">${r.ferrageQt||'—'}</td><td style="${c}">${r.serrure||'—'}</td>`;
        return `<tr style="background:${i%2===0?'#F7F5F1':'white'}">
          <td style="${c};font-weight:700">${r.repere||'—'}</td>
          <td style="${c};text-align:center;font-weight:700">${r.qt||'—'}</td>
          ${tdV}${tdH}${tdC}</tr>`;
      }).join('');
      inner = `<table style="width:100%;border-collapse:collapse"><thead>
        <tr><th rowspan="2" style="padding:5px;background:#7A4200;color:white;font-size:9px;text-align:left">Rep.</th>
        <th rowspan="2" style="padding:5px;background:#7A4200;color:white;font-size:9px">QT</th>
        ${thV}${thH}${thC}</tr><tr>${th2V}${th2H}${th2C}</tr>
      </thead><tbody>${trs}</tbody></table>`;
    }

    if (b.type==='photo') {
      return ''; // Les photos sont affichées dans photosSection directement
    }

    return `<div style="margin-bottom:12px;border:1.5px solid ${clr};border-radius:5px;overflow:hidden;page-break-inside:avoid">
      <div style="background:${clrBg};padding:6px 10px;border-bottom:1px solid ${clr}">
        <span style="font-weight:700;font-size:10px;color:${clr};text-transform:uppercase;letter-spacing:.4px">${label} — Bloc ${b.id}</span>
      </div>
      <div>${inner||'<div style="padding:8px;color:#999;font-size:10px;font-style:italic">Bloc vide</div>'}</div>
    </div>`;
  }).join('');

  // ── Photos dans le PDF — après les blocs, 1 photo sur page 1, 2+ sur pages séparées ──
  const photosB64 = data.photosBase64 || [];
  const photosSection = photosB64.map((p,i) => {
    const mime = p.mimeType||'image/jpeg', b64 = p.data||'', label = p.label||`Photo ${i+1}`;
    if(!b64) return '';
    const seule = photosB64.length === 1;
    const style = seule ? 'margin-top:8px;page-break-inside:avoid;' : 'page-break-before:always;padding:10px;';
    const mh = seule ? '95mm' : '135mm';   // 1 photo : laisse la place aux blocs au-dessus → tient sur 1 page
    return `<div style="${style}text-align:center;">
      <div style="width:100%;max-height:${mh};overflow:hidden;display:flex;align-items:center;justify-content:center;">
        <img src="data:${mime};base64,${b64}"
          style="max-width:100%;max-height:${mh};width:auto;height:auto;object-fit:contain;border:1px solid #ddd;display:block;">
      </div>
      ${label && label!==`Photo ${i+1}` ? `<div style="font-size:9px;color:#666;margin-top:3px">${label}</div>` : ''}
    </div>`;
  }).join('');

  const commentaireSection = data.commentaires
    ? `<div style="margin-top:10px;padding:8px 10px;background:#F7F5F1;border:1px solid #D8D4CE;border-radius:4px">
        <div style="font-size:8.5px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:3px">Commentaires</div>
        <div style="font-size:10px;line-height:1.5">${data.commentaires.replace(/\n/g,'<br>')}</div>
      </div>` : '';

  const htmlPDF = `<html><head><style>
    @page{size:landscape;margin:1cm}body{font-family:Arial,sans-serif;font-size:10px;margin:0}*{box-sizing:border-box}
  </style></head><body>
    ${enTete}${blocsHtml}${commentaireSection}${photosSection}
  </body></html>`;

  const nomPDF = `Fab_${chantier}${serie?'_S'+serie:''}_${data.date||''}.pdf`;
  const blob   = HtmlService.createHtmlOutput(htmlPDF).getAs('application/pdf').setName(nomPDF);

  // Classement automatique dans Drive/[chantier]/Fiches
  classerFichierDrive(blob, chantier, 'Fiches', nomPDF);

  // Corps email
  const liensDriveHtml = liensDrive.length
    ? `<p><strong>📷 Photos (${liensDrive.length}) :</strong></p><ul>${liensDrive.map(l=>`<li><a href="${l.url}">${l.nom}</a></li>`).join('')}</ul>`
    : '';

  const corps = `<div style="font-family:Arial,sans-serif;font-size:13px">
    <p>Bonjour,</p>
    <p>Veuillez trouver <strong>en pièce jointe</strong> la fiche de fabrication PDF.</p>
    <table style="font-size:12px;border-collapse:collapse;margin:12px 0">
      <tr><td style="color:#6A6460;padding:3px 14px 3px 0">Chantier</td><td><strong>${chantier}</strong></td></tr>
      ${serie?`<tr><td style="color:#6A6460;padding:3px 14px 3px 0">N° Série</td><td><strong>${serie}</strong></td></tr>`:''}
      <tr><td style="color:#6A6460;padding:3px 14px 3px 0">Rédigé par</td><td>${data.auteur||'—'}</td></tr>
      <tr><td style="color:#6A6460;padding:3px 14px 3px 0">Date</td><td>${data.date||'—'}</td></tr>
      <tr><td style="color:#6A6460;padding:3px 14px 3px 0">Délai</td><td><strong style="color:#9A5600">${data.delai||'—'}</strong></td></tr>
    </table>
    ${liensDriveHtml}
    <p style="color:#6A6460;font-size:11px;margin-top:16px">Loué App · ${Utilities.formatDate(horodatage,'Europe/Paris','dd/MM/yyyy HH:mm')}</p>
  </div>`;

  destinataires.forEach(email => {
    GmailApp.sendEmail(email, sujet,
      `Bonjour,\n\nFiche de fabrication en pièce jointe — ${chantier}${serie?' — Série '+serie:''}.\n\nLoué App`,
      {htmlBody:corps, attachments:[blob], name:NOM_ENTREPRISE});
  });
}


// ═══════════════════════════════════════════════════════════════
// UTILITAIRES DRIVE
// ═══════════════════════════════════════════════════════════════

// Classer un fichier dans Drive/[chantier]/[sousDossier]
function classerFichierDrive(blob, chantierNom, sousDossierNom, nomFichier) {
  try {
    const root          = DriveApp.getFolderById(DRIVE_ROOT_ID);
    const chantierDir   = trouverOuCreerDossierChantier(chantierNom);
    const sousDossier   = trouverOuCreerSousDossier(chantierDir, sousDossierNom);
    const file = sousDossier.createFile(blob.copyBlob().setName(nomFichier));
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file;
  } catch(err) {
    console.error('classerFichierDrive:', err.message);
    return null;
  }
}

// Trouve ou crée le dossier chantier + ses 8 sous-dossiers automatiquement
function trouverOuCreerDossierChantier(chantierNom) {
  const root     = DriveApp.getFolderById(DRIVE_ROOT_ID);
  const nomClean = chantierNom.trim();

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
  if (existing.hasNext()) return existing.next();
  return parent.createFolder(nom);
}

function getContactsRaw() {
  const sc = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CONTACTS);
  return sc ? sc.getDataRange().getValues().slice(1).filter(r=>r[0]) : [];
}

// ══════════════════════════════════════════════════════════
// DEMANDE D'ABSENCE
// ══════════════════════════════════════════════════════════
function traiterAbsence(data) {
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
    data.nom||'',
    data.dateDepot||'',
    data.dateAbsence||'',
    data.duree||'',
    data.imputation||'',
    data.motif||'',
    data.precisions||'',
    data.emailPerso||'',
  ]);

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

  const nomFichier = `Absence_${(data.nom||'').replace(/ /g,'_')}_${(data.dateAbsence||'').replace(/\//g,'-')}.pdf`;
  const blob = HtmlService.createHtmlOutput(htmlPDF).getAs('application/pdf').setName(nomFichier);

  // 3. Destinataires : colonne H = O + email perso si fourni
  const destinataires = (data.destinataires||[]).filter(e=>e&&e.indexOf('@')>-1);
  if(data.emailPerso && data.emailPerso.indexOf('@')>-1) destinataires.push(data.emailPerso);
  if(!destinataires.length) {
    const fallback = Session.getActiveUser().getEmail();
    if(fallback) destinataires.push(fallback);
  }

  const sujet = `[Loué App] Demande d'absence — ${data.nom||'?'} — ${data.dateAbsence||'?'}`;
  const corps = `Bonjour,\n\nVeuillez trouver ci-joint la demande d'absence de ${data.nom||'?'}.\n\nDate : ${data.dateAbsence||'?'}\nDurée : ${data.duree||'?'}\nMotif : ${data.motif||'?'}\n\nLoué App`;

  destinataires.forEach(email => {
    try {
      const b = HtmlService.createHtmlOutput(htmlPDF).getAs('application/pdf').setName(nomFichier);
      GmailApp.sendEmail(email, sujet, corps, {attachments:[b], name:NOM_ENTREPRISE});
      console.log('Absence envoyée à:', email);
    } catch(err) { console.error('Email absence:', email, err.message); }
  });
}

// ══════════════════════════════════════════════════════════
// RÉCEPTION SUPPORT
// ══════════════════════════════════════════════════════════
function traiterReceptionSupport(data) {
  const ss         = SpreadsheetApp.getActiveSpreadsheet();
  const horodatage = new Date();
  const SHEET_REC  = 'Réceptions Support';

  // 1. Enregistrer dans le sheet
  let sheet = ss.getSheetByName(SHEET_REC);
  if(!sheet) {
    sheet = ss.insertSheet(SHEET_REC);
    sheet.appendRow(['Horodatage','Chantier','Précision','Signataire','Date','Lot','Nb OK','Nb NOK','Nb SO','Observations']);
    sheet.getRange(1,1,1,10).setFontWeight('bold').setBackground('#0D7A6B').setFontColor('white');
  }
  const pts   = data.points||[];
  const nbOk  = pts.filter(p=>p.state==='ok').length;
  const nbNok = pts.filter(p=>p.state==='nok').length;
  const nbSo  = pts.filter(p=>p.state==='so').length;
  sheet.appendRow([horodatage, data.chantier||'', data.precision||'', data.signataire||'',
    data.date||'', data.lotLabel||'', nbOk, nbNok, nbSo, data.observations||'']);

  // 2. Construire le HTML du PDF
  const sig = data.signature||'';
  const lignes = pts.map((p,i)=>{
    const sc = p.state==='ok'?'#196B3B':p.state==='nok'?'#B32E2E':p.state==='so'?'#888':'#999';
    const sl = p.state==='ok'?'✓ Conforme':p.state==='nok'?'✗ Non conforme':p.state==='so'?'— Sans objet':'Non évalué';
    return `<tr style="background:${i%2===0?'white':'#FAFAF8'}">
      <td style="padding:6px 8px;border:1px solid #D8D4CE;font-size:11px">${p.label}</td>
      <td style="padding:6px 8px;border:1px solid #D8D4CE;font-size:10px;font-weight:700;color:${sc};text-align:center">${sl}</td>
      <td style="padding:6px 8px;border:1px solid #D8D4CE;font-size:10px;color:#6A6460">${p.comment||''}</td>
    </tr>`;
  }).join('');

  const confColor = nbNok>0?'#B32E2E':'#196B3B';
  const htmlPDF = `<html><head><style>
    @page{size:A4;margin:1.5cm}body{font-family:Arial,sans-serif;font-size:10px;margin:0}*{box-sizing:border-box}
    table{border-collapse:collapse;width:100%}
  </style></head><body>
  <table style="margin-bottom:14px;border:none;border-bottom:3px solid #0D7A6B;padding-bottom:10px">
    <tr>
      <td style="border:none;vertical-align:middle;width:40%">
        <div style="font-weight:800;font-size:16px;color:#1A2B4A">Loué Menuiserie</div>
        <div style="font-size:9px;color:#6A6460">Menuiserie · Charpente · Agencement</div>
      </td>
      <td style="border:none;text-align:center;vertical-align:middle">
        <div style="font-weight:800;font-size:14px;color:#0D7A6B">RÉCEPTION SUPPORT</div>
        <div style="font-size:10px;color:#6A6460;margin-top:2px">${data.lotLabel||''}</div>
      </td>
      <td style="border:none;text-align:right;vertical-align:middle;font-size:10px;color:#6A6460">
        <div>${data.date||'—'}</div>
        <div style="font-weight:700">${data.signataire||'—'}</div>
      </td>
    </tr>
  </table>
  <table style="margin-bottom:10px">
    <tr><td style="padding:6px 8px;border:1px solid #D8D4CE;background:#FAFAF8;font-size:9px;color:#6A6460;font-weight:700;text-transform:uppercase;width:35%">Chantier</td>
        <td style="padding:6px 8px;border:1px solid #D8D4CE;font-weight:700">${data.chantier||'—'}${data.precision?' — <span style="font-weight:400;color:#6A6460">'+data.precision+'</span>':''}</td></tr>
    <tr><td style="padding:6px 8px;border:1px solid #D8D4CE;background:#FAFAF8;font-size:9px;color:#6A6460;font-weight:700;text-transform:uppercase">Lot contrôlé</td>
        <td style="padding:6px 8px;border:1px solid #D8D4CE">${data.lotLabel||'—'}</td></tr>
  </table>
  <table style="margin-bottom:10px">
    <thead><tr>
      <th style="padding:6px 8px;background:#1A2B4A;color:white;font-size:9px;text-align:left;width:38%">Point de contrôle</th>
      <th style="padding:6px 8px;background:#1A2B4A;color:white;font-size:9px;text-align:center;width:22%">Résultat</th>
      <th style="padding:6px 8px;background:#1A2B4A;color:white;font-size:9px;text-align:left">Commentaire</th>
    </tr></thead>
    <tbody>${lignes}</tbody>
  </table>
  <div style="padding:7px 10px;background:${nbNok>0?'#FAE8E8':'#E1F2E9'};border:1px solid ${confColor};border-radius:4px;font-size:10px;color:${confColor};font-weight:700;margin-bottom:10px">
    Bilan : ${nbOk} conforme(s) · ${nbNok} non conforme(s) · ${nbSo} sans objet
  </div>
  ${data.observations?`<div style="padding:7px 10px;background:#F7F5F1;border:1px solid #D8D4CE;border-radius:4px;font-size:10px;margin-bottom:10px"><strong>Observations :</strong> ${data.observations}</div>`:''}
  <table style="border:none">
    <tr>
      <td style="border:none;width:50%;padding-right:8px;vertical-align:top">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:4px">Signature</div>
        <div style="border:1px solid #D8D4CE;border-radius:4px;height:75px;background:#FAFAF8;text-align:center;padding:3px">
          ${sig?`<img src="${sig}" style="max-width:100%;max-height:68px;">`:''}
        </div>
        <div style="font-size:9px;color:#6A6460;margin-top:3px">${data.signataire||''} — ${data.date||''}</div>
      </td>
      <td style="border:none;width:50%"></td>
    </tr>
  </table>
  ${pts.filter(p=>p.photos&&p.photos.length).map(p=>`
    <div style="page-break-before:always;padding-top:10px">
      <div style="font-weight:700;font-size:11px;color:#0D7A6B;border-bottom:2px solid #0D7A6B;padding-bottom:4px;margin-bottom:8px">
        Photos — ${p.label}
      </div>
      <table style="width:100%;border-collapse:separate;border-spacing:8px"><tr>
        ${p.photos.map(ph=>`<td style="text-align:center;vertical-align:top;width:50%">
          <img src="data:${ph.mime};base64,${ph.data}" style="max-width:100%;max-height:100mm;border:1px solid #ddd;">
        </td>`).join('')}
      </tr></table>
    </div>`).join('')}
  </body></html>`;

  const nomFichier = `Reception_${(data.chantier||'').replace(/ /g,'_')}_${(data.lotLabel||'').replace(/ /g,'_')}.pdf`;
  const blobPDF = HtmlService.createHtmlOutput(htmlPDF).getAs('application/pdf').setName(nomFichier);

  // 3. Sauvegarder dans Drive (sous-dossier "Réceptions Support" du chantier)
  classerFichierDrive(blobPDF, data.chantier||'DIVERS', 'Réceptions Support', nomFichier);

  // 4. Destinataires : conducteur + supp
  const destinataires = [];
  if(data.conducteurEmail && data.conducteurEmail.indexOf('@')>-1) destinataires.push(data.conducteurEmail);
  if(data.destSupp && data.destSupp.indexOf('@')>-1) destinataires.push(data.destSupp);
  if(!destinataires.length) destinataires.push(Session.getActiveUser().getEmail());

  const sujet = `[Loué App] Réception Support — ${data.chantier||'?'} — ${data.lotLabel||'?'}`;
  const corps = `Bonjour,\n\nVeuillez trouver ci-joint la fiche de réception support.\n\nChantier : ${data.chantier||'?'}\nLot : ${data.lotLabel||'?'}\nBilan : ${nbOk} conforme(s) / ${nbNok} non conforme(s)\n\nLoué App`;

  destinataires.forEach(email=>{
    try {
      const b = HtmlService.createHtmlOutput(htmlPDF).getAs('application/pdf').setName(nomFichier);
      GmailApp.sendEmail(email,sujet,corps,{attachments:[b],name:NOM_ENTREPRISE});
    } catch(err){console.error('Email reception:',email,err.message);}
  });
}

// ══════════════════════════════════════════════════════════
// ATTESTATION
// ══════════════════════════════════════════════════════════
function traiterAttestation(data) {
  const ss         = SpreadsheetApp.getActiveSpreadsheet();
  const horodatage = new Date();
  const SHEET_ATT  = 'Attestations';

  // 1. Sheet
  let sheet = ss.getSheetByName(SHEET_ATT);
  if(!sheet){
    sheet = ss.insertSheet(SHEET_ATT);
    sheet.appendRow(['Horodatage','Type','Chantier','Précision','Signataire','Date','Référence','Objet/DAS N°']);
    sheet.getRange(1,1,1,8).setFontWeight('bold').setBackground('#6B3FA0').setFontColor('white');
  }
  const objetOuDas = data.typeAttest==='das' ? (data.dasNumero||'') : (data.objet||'').substring(0,100);
  sheet.appendRow([horodatage, data.typeLabel||'', data.chantier||'', data.precision||'',
    data.signataire||'', data.date||'', data.ref||'', objetOuDas]);

  // 2. PDF
  const chFull = data.chantier + (data.precision ? ' — '+data.precision : '');
  const sig    = data.signature||'';

  // Qualité (rôle) du signataire — colonne B de l'onglet Contacts
  const _rowSig    = getContactsRaw().find(r => String(r[0]).toLowerCase() === String(data.signataire||'').toLowerCase());
  const qualite    = _rowSig ? String(_rowSig[1]||'') : '';
  const qualiteTxt = qualite ? (', en qualité de '+qualite) : '';

  // Couleur d'accent selon le type de document (identique à l'aperçu de l'app)
  const typeColor  = {'mise-oeuvre':'#1A6B3B','levee-obs':'#B32E2E','das':'#1A2B4A','autre':'#6B3FA0'}[data.typeAttest] || '#6B3FA0';

  let corpsHtml = '';
  if(data.typeAttest==='das'){
    const lignes=(data.dasPoints||[]).map((p,i)=>{
      const cl=p.state==='ok'?'#196B3B':p.state==='nc'?'#B32E2E':p.state==='so'?'#888':'#999';
      const lb=p.state==='ok'?'✓ OK':p.state==='nc'?'✗ N.C.':p.state==='so'?'— S.O.':'—';
      return `<tr style="background:${i%2===0?'white':'#FAFAF8'}">
        <td style="padding:6px 8px;border:1px solid #D8D4CE;font-size:10px">${p.label}</td>
        <td style="padding:6px 8px;border:1px solid #D8D4CE;font-size:10px;font-weight:700;color:${cl};text-align:center;width:25%">${lb}</td>
      </tr>`;
    }).join('');
    const nbOk=(data.dasPoints||[]).filter(p=>p.state==='ok').length;
    const nbNc=(data.dasPoints||[]).filter(p=>p.state==='nc').length;
    const nbSo=(data.dasPoints||[]).filter(p=>p.state==='so').length;
    corpsHtml=`
    <table style="width:100%;border-collapse:collapse;margin-bottom:10px">
      <tr><td style="padding:6px 8px;border:1px solid #D8D4CE;background:#FAFAF8;font-size:9px;font-weight:700;text-transform:uppercase;color:#6A6460;width:38%">N° Bloc porte</td><td style="padding:6px 8px;border:1px solid #D8D4CE;font-weight:700">${data.dasNumero||'—'}</td></tr>
      <tr><td style="padding:6px 8px;border:1px solid #D8D4CE;background:#FAFAF8;font-size:9px;font-weight:700;text-transform:uppercase;color:#6A6460">Étage / Niveau</td><td style="padding:6px 8px;border:1px solid #D8D4CE">${data.dasEtage||'—'}</td></tr>
      <tr><td style="padding:6px 8px;border:1px solid #D8D4CE;background:#FAFAF8;font-size:9px;font-weight:700;text-transform:uppercase;color:#6A6460">Localisation</td><td style="padding:6px 8px;border:1px solid #D8D4CE">${data.dasLocalisation||'—'}</td></tr>
      <tr><td style="padding:6px 8px;border:1px solid #D8D4CE;background:#FAFAF8;font-size:9px;font-weight:700;text-transform:uppercase;color:#6A6460">Asservissement(s)</td><td style="padding:6px 8px;border:1px solid #D8D4CE">${data.asservissements||'—'}</td></tr>
    </table>
    <table style="width:100%;border-collapse:collapse;margin-bottom:10px">
      <thead><tr>
        <th style="padding:6px 8px;background:#1A2B4A;color:white;font-size:9px;text-align:left">Point de contrôle</th>
        <th style="padding:6px 8px;background:#1A2B4A;color:white;font-size:9px;text-align:center;width:25%">Résultat</th>
      </tr></thead>
      <tbody>${lignes}</tbody>
    </table>
    <div style="padding:7px 10px;background:${nbNc>0?'#FAE8E8':'#E1F2E9'};border:1px solid ${nbNc>0?'#B32E2E':'#196B3B'};border-radius:4px;font-size:10px;font-weight:700;color:${nbNc>0?'#B32E2E':'#196B3B'};margin-bottom:10px">
      Bilan : ${nbOk} conforme(s) · ${nbNc} non conforme(s) · ${nbSo} sans objet
    </div>`;
  } else {
    corpsHtml=`<div style="padding:10px 12px;background:#F7F5F1;border:1px solid #D8D4CE;border-radius:4px;font-size:11px;line-height:1.7;white-space:pre-wrap;margin-bottom:12px">${data.objet||'—'}</div>`;
  }

  const _nbPhotos  = (data.photos||[]).length;
  const _photoMaxH = _nbPhotos<=1 ? '78mm' : '68mm';
  const _photoTdW  = _nbPhotos===1 ? '100%' : '50%';
  const photosHtml=_nbPhotos?`
    <div style="margin-top:10px;page-break-inside:avoid">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:6px;border-bottom:2px solid ${typeColor};padding-bottom:3px">Photo${_nbPhotos>1?'s':''}</div>
      <table style="width:100%;border-collapse:collapse"><tr>
        ${(data.photos||[]).slice(0,2).map(p=>`<td style="width:${_photoTdW};padding:4px;text-align:center"><img src="data:${p.mime};base64,${p.data}" style="max-width:100%;max-height:${_photoMaxH};border:1px solid #ddd;"></td>`).join('')}
      </tr></table>
    </div>`:'';

  const htmlPDF=`<html><head><style>
    @page{size:A4;margin:1.5cm}body{font-family:Arial,sans-serif;font-size:10px;margin:0}*{box-sizing:border-box}
  </style></head><body>
  <div style="border-bottom:3px solid ${typeColor};padding-bottom:10px;margin-bottom:14px">
    <table style="width:100%;border-collapse:collapse">
      <tr>
        <td style="vertical-align:top">
          <div style="font-weight:800;font-size:16px;color:#1A2B4A">Loué Menuiserie</div>
          <div style="font-size:9px;color:#6A6460">Menuiserie · Charpente · Agencement</div>
        </td>
        <td style="text-align:right;vertical-align:top;white-space:nowrap">
          <div style="font-size:8px;font-weight:700;text-transform:uppercase;color:#6A6460;letter-spacing:.4px">Date</div>
          <div style="font-size:17px;font-weight:800;color:#1A1A1A">${data.date||'—'}</div>
          ${data.ref?`<div style="font-size:9px;color:#6A6460;margin-top:4px">Réf : ${data.ref}</div>`:''}
        </td>
      </tr>
    </table>
    <div style="text-align:center;font-weight:900;font-size:23px;color:${typeColor};letter-spacing:.5px;line-height:1.15;margin-top:12px">${(data.typeLabel||'ATTESTATION').toUpperCase()}</div>
  </div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
    <tr><td style="padding:6px 8px;border:1px solid #D8D4CE;background:#FAFAF8;font-size:9px;font-weight:700;text-transform:uppercase;color:#6A6460;width:35%">Chantier</td>
        <td style="padding:6px 8px;border:1px solid #D8D4CE;font-weight:700">${chFull}</td></tr>
  </table>
  <div style="margin:0 0 12px;font-size:12px;line-height:1.55">
    Je soussigné <strong>${data.signataire||'—'}</strong>${qualiteTxt}, certifie que&nbsp;:
  </div>
  ${corpsHtml}
  ${photosHtml}
  <table style="width:100%;border-collapse:collapse;margin-top:14px;border:none;page-break-inside:avoid">
    <tr>
      <td style="border:none;width:50%;padding-right:8px;vertical-align:top">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:4px">Signature</div>
        <div style="border:1px solid #D8D4CE;border-radius:4px;height:75px;background:#FAFAF8;text-align:center;padding:3px">
          ${sig?`<img src="${sig}" style="max-width:100%;max-height:68px;">`:''}
        </div>
        <div style="font-size:9px;color:#6A6460;margin-top:3px">${data.signataire||''} — ${data.date||''}</div>
      </td>
      <td style="border:none;width:50%"></td>
    </tr>
  </table>
  </body></html>`;

  const nomFichier=`Attestation_${(data.typeLabel||'').replace(/ /g,'_')}_${(data.chantier||'').replace(/ /g,'_')}.pdf`;
  classerFichierDrive(HtmlService.createHtmlOutput(htmlPDF).getAs('application/pdf').setName(nomFichier), data.chantier||'DIVERS', 'Attestations', nomFichier);

  // Envoi email — conducteur du chantier
  const destinataires=[];
  if(data.conducteurEmail && data.conducteurEmail.indexOf('@')>-1) destinataires.push(data.conducteurEmail);
  if(!destinataires.length) destinataires.push(Session.getActiveUser().getEmail());

  const sujet=`[Loué App] Attestation — ${data.typeLabel||''} — ${data.chantier||'?'}`;
  const corps=`Bonjour,\n\nVeuillez trouver ci-joint l'attestation.\n\nType : ${data.typeLabel||'?'}\nChantier : ${data.chantier||'?'}\nSignataire : ${data.signataire||'?'}\n\nLoué App`;
  destinataires.forEach(email=>{
    try{
      const b=HtmlService.createHtmlOutput(htmlPDF).getAs('application/pdf').setName(nomFichier);
      GmailApp.sendEmail(email,sujet,corps,{attachments:[b],name:NOM_ENTREPRISE});
    }catch(err){console.error('Email attestation:',email,err.message);}
  });
}
