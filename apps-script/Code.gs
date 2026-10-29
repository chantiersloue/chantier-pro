// ═══════════════════════════════════════════════════════════════
// Loué App — Apps Script v4.1 (lot 0 : sécurité)
// Loué Menuiserie
// ═══════════════════════════════════════════════════════════════

const VERSION_API = 'v4.1';

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

const SHEET_JOURNAL     = 'Journal';
const SHEET_ATTENTE     = 'Mails en attente';
const SHEET_PARTAGES    = 'Partages (lot 0)';

// ── LIMITES D'ENVOI (le quota d'un compte gratuit est de 100 destinataires par jour) ──
const RESERVE_ADMIN         = 20;  // destinataires gardés pour Franck : en dessous, seuls ses mails partent
const MAX_LIBRES_PAR_FICHE  = 2;   // adresses tapées à la main acceptées par fiche
const MAX_LIBRES_PAR_JOUR   = 10;  // adresses tapées à la main acceptées par jour, toute l'appli
const MAX_ESSAIS_ATTENTE    = 12;  // un mail reporté est retenté toutes les 2 h, 12 fois au plus

// Sous-dossiers dont les fichiers restent partagés par lien (consultation par les poseurs).
// Tout le reste est en « accès limité » depuis le lot 0.
const SOUS_DOSSIERS_PARTAGES = ['Plans'];

// ── DRIVE ──
// Les identifiants des dossiers ne sont PAS dans le code (dépôt public).
// Ils sont dans : éditeur Apps Script → Paramètres du projet → Propriétés du script.
//   DRIVE_ROOT_ID     : dossier racine "Loué Menuiserie - Chantiers"
//   DRIVE_PLANNING_ID : dossier Planning
//   EMAIL_ADMIN       : (facultatif) adresse de Franck ; sinon celle du compte qui a déployé
function propriete_(cle) {
  return PropertiesService.getScriptProperties().getProperty(cle) || '';
}
function driveRootId_() {
  const id = propriete_('DRIVE_ROOT_ID');
  if (!id) throw new Error('Propriété du script DRIVE_ROOT_ID manquante');
  return id;
}
function drivePlanningId_() {
  const id = propriete_('DRIVE_PLANNING_ID');
  if (!id) throw new Error('Propriété du script DRIVE_PLANNING_ID manquante');
  return id;
}
function emailAdmin_() {
  return propriete_('EMAIL_ADMIN') || Session.getEffectiveUser().getEmail();
}

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

  // Le nom de la fonction de rappel JSONP est contrôlé : lettres, chiffres, _ et $ seulement
  const cb = /^[A-Za-z_$][A-Za-z0-9_$]{0,60}$/.test(e.parameter.callback || '') ? e.parameter.callback : '';

  if (action === 'getContacts')  return getContacts(cb);
  if (action === 'getDossiers')  return getDossiers(e.parameter.chantier, cb);

  // Ouvrir l'URL dans un navigateur affiche ce texte : sert à vérifier la version déployée
  return ContentService.createTextOutput('Loué App API ' + VERSION_API + ' OK').setMimeType(ContentService.MimeType.TEXT);
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
    const root = DriveApp.getFolderById(driveRootId_());

    // Cas spécial : planning global — lecture directe par ID
    if (chantierNom === '__PLANNING__') {
      try {
        const planningFolder = DriveApp.getFolderById(drivePlanningId_());
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
        docs.sort(parDateDecroissante_);
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

    // Lot 0 : seuls les sous-dossiers encore partagés par lien sont listés
    // (les autres ne s'ouvriraient plus chez les poseurs, et leurs noms de fichiers ne doivent pas fuiter)
    Object.entries(SOUS_DOSSIERS).forEach(([cle, nomDossier]) => {
      if (SOUS_DOSSIERS_PARTAGES.indexOf(nomDossier) > -1) result[cle] = lireSousDossier(chantierFolder, nomDossier, true);
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

// Lit tous les fichiers d'un sous-dossier (nomSousDossier vide = lire le dossier parent lui-même).
// partager = true : les fichiers sont mis en « tous ceux qui ont le lien » (dossier Plans uniquement).
function lireSousDossier(chantierFolder, nomSousDossier, partager) {
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
      if (partager) {
        try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(e){}
      }

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
    docs.sort(parDateDecroissante_);
  } catch(err) {
    console.error('lireSousDossier '+nomSousDossier+':', err.message);
  }
  return docs;
}

// Tri des documents par date « jj/mm/aaaa », la plus récente en premier
function parDateDecroissante_(a, b) {
  const cle = d => String(d.date || '').split('/').reverse().join('');
  return cle(b).localeCompare(cle(a));
}


// ═══════════════════════════════════════════════════════════════
// POST — routage
// ═══════════════════════════════════════════════════════════════
// brut : données telles que reçues (pour le Sheet, les recherches de noms, les sujets de mail)
// data : mêmes données, textes échappés (pour le HTML des PDF et des mails)
function doPost(e) {
  try {
    const brut = JSON.parse(e.postData.contents);
    const data = preparerDonnees_(brut);
    if (data.type === 'fabrication')       traiterFicheFabrication(data, brut);
    else if (data.type === 'note')         traiterNoteReunion(data, brut);
    else if (data.type === 'bordereau-orga' || data.type === 'bordereau-materiaux') traiterBordereau(data, brut);
    else if (data.type === 'quitus')       traiterQuitus(data, brut);
    else if (data.type === 'absence')      traiterAbsence(data, brut);
    else if (data.type === 'reception-support') traiterReceptionSupport(data, brut);
    else if (data.type === 'attestation')      traiterAttestation(data, brut);
    else if (data.type === 'cotes')        traiterFicheCotes(data, brut);
    else throw new Error('Type de fiche inconnu');
    return ContentService.createTextOutput(JSON.stringify({status:'ok'})).setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    console.error('doPost:', err.message);
    return ContentService.createTextOutput(JSON.stringify({status:'error',message:err.message})).setMimeType(ContentService.MimeType.JSON);
  }
}


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
  const now = new Date();
  const chantier = data.chantier||'—';
  const isOrga   = data.type==='bordereau-orga';
  const titre    = isOrga ? 'BORDEREAU DE REMISE — ORGANIGRAMME' : 'BORDEREAU DE REMISE — MATÉRIAUX';
  const nomPDF   = nomFichier_(`Bordereau_${isOrga?'Orga':'Mat'}_${brut.chantier||'—'}_${String(brut.date||'').replace(/\//g,'-')}.pdf`);

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
  // Lot 0 : les bordereaux ont leur propre dossier (ils allaient par erreur dans « Quitus »)
  const fichier = classerFichierDrive(blob, brut.chantier||'—', 'Bordereaux', nomPDF);
  const sujet = `[Loué App] ${isOrga?'Bordereau Organigramme':'Bordereau Matériaux'} — ${brut.chantier||'—'}`;
  distribuer_({
    fiche: data.type, chantier: brut.chantier, adresses: brut.destinataires,
    sujet: sujet, texte: `Bordereau — ${brut.chantier||'—'}\n\nLoué App`, fichier: fichier, nomPDF: nomPDF,
    faireBlob: () => HtmlService.createHtmlOutput(htmlPDF).getAs('application/pdf').setName(nomPDF),
  });
}


// ═══════════════════════════════════════════════════════════════
// QUITUS
// ═══════════════════════════════════════════════════════════════
function traiterQuitus(data, brut) {
  const chantier        = data.chantier||'—';
  const precision       = data.precision||'';
  const chantierAffiche = precision ? chantier + ' — ' + precision : chantier;
  const chantierBrut    = (brut.chantier||'—') + (brut.precision ? ' — ' + brut.precision : '');
  const nomPDF   = nomFichier_(`Quitus_${chantierBrut}_${String(brut.date||'').replace(/\//g,'-')}.pdf`);
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
  const fichier = classerFichierDrive(blob, brut.chantier||'—', 'Quitus', nomPDF);
  const sujet = `[Loué App] Quitus — ${chantierBrut}`;
  distribuer_({
    fiche: 'quitus', chantier: brut.chantier, adresses: brut.destinataires,
    sujet: sujet, texte: `Quitus — ${chantierBrut}\n\nLoué App`, fichier: fichier, nomPDF: nomPDF,
    faireBlob: () => HtmlService.createHtmlOutput(htmlPDF).getAs('application/pdf').setName(nomPDF),
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

  const chantier     = data.chantier || '—';
  const hasSocle     = data.socle === 'OUI';
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

  const nomPDF = nomFichier_(`Cotes_${brut.chantier||'—'}_${brut.date||''}.pdf`);

  // Classement Drive
  let fichier = null;
  try {
    const blobDrive = HtmlService.createHtmlOutput(htmlPDF).getAs('application/pdf').setName(nomPDF);
    fichier = classerFichierDrive(blobDrive, brut.chantier||'—', 'Fiches', nomPDF);
  } catch(err) { console.error('Drive cotes:', err.message); }

  distribuer_({
    fiche: 'cotes', chantier: brut.chantier, adresses: destinataires,
    sujet: `[Loué App] Prise de cotes — ${brut.chantier||'—'}`, fichier: fichier, nomPDF: nomPDF,
    texte: 'Bonjour,\n\nVeuillez trouver ci-joint la fiche de prise de cotes.\n\nLoué App',
    faireBlob: () => HtmlService.createHtmlOutput(htmlPDF).getAs('application/pdf').setName(nomPDF),
  });
}


// ═══════════════════════════════════════════════════════════════
// FICHE FABRICATION
// ═══════════════════════════════════════════════════════════════
function traiterFicheFabrication(data, brut) {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const now = new Date();

  let sheet = ss.getSheetByName(SHEET_FABRICATION);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_FABRICATION);
    const h = ['N° Série','Chantier','Auteur','Chef Atelier','Conducteur','Date','Délai','Zone','Réf. chantier','Nb Blocs','Commentaires','Horodatage'];
    sheet.appendRow(h);
    sheet.getRange(1,1,1,h.length).setBackground('#1A2B4A').setFontColor('white').setFontWeight('bold');
  }
  sheet.appendRow([brut.serie||'',brut.chantier,brut.auteur,brut.chefAtelier||'',brut.conducteur||'',
    brut.date,brut.delai||'',brut.zone||'',brut.refChantier||'',(brut.blocs||[]).length,brut.commentaires||'',now].map(cellule_));

  // Photos uniquement dans le PDF — pas de stockage Drive séparé
  envoyerEmailFabrication(data, [], now, brut);
}

function envoyerEmailFabrication(data, liensDrive, horodatage, brut) {
  // Destinataires calculés par le serveur : chef d'atelier (colonne G = O) + conducteur choisi
  const contacts = getContactsRaw();
  const chefRow  = contacts.find(r=>String(r[6]).toUpperCase()==='O');
  const emailChef = chefRow ? chefRow[2] : null;
  const emailCond = emailContact_(brut.conducteur);
  const destinataires = [...new Set([emailChef,emailCond].filter(Boolean))];
  if (!destinataires.length) destinataires.push(emailAdmin_());

  const serie    = data.serie||'';
  const chantier = data.chantier||'—';
  const sujet    = `[Loué App] Fiche fabrication — ${brut.serie?'Série '+brut.serie+' — ':''}${brut.chantier||'—'}`;

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

  const nomPDF = nomFichier_(`Fab_${brut.chantier||'—'}${brut.serie?'_S'+brut.serie:''}_${brut.date||''}.pdf`);
  const blob   = HtmlService.createHtmlOutput(htmlPDF).getAs('application/pdf').setName(nomPDF);

  // Classement automatique dans Drive/[chantier]/Fiches
  const fichier = classerFichierDrive(blob, brut.chantier||'—', 'Fiches', nomPDF);

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

  // Lot 0 : chaque envoi est protégé (un échec de mail ne fait plus échouer toute la fiche)
  distribuer_({
    fiche: 'fabrication', chantier: brut.chantier, adresses: destinataires,
    sujet: sujet, html: corps, fichier: fichier, nomPDF: nomPDF,
    texte: `Bonjour,\n\nFiche de fabrication en pièce jointe — ${brut.chantier||'—'}${brut.serie?' — Série '+brut.serie:''}.\n\nLoué App`,
    faireBlob: () => HtmlService.createHtmlOutput(htmlPDF).getAs('application/pdf').setName(nomPDF),
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
  sheet.appendRow([horodatage, brut.chantier||'', brut.precision||'', brut.signataire||'',
    brut.date||'', brut.lotLabel||'', nbOk, nbNok, nbSo, brut.observations||''].map(cellule_));

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

  const nomFichier = nomFichier_(`Reception_${String(brut.chantier||'').replace(/ /g,'_')}_${String(brut.lotLabel||'').replace(/ /g,'_')}.pdf`);
  const blobPDF = HtmlService.createHtmlOutput(htmlPDF).getAs('application/pdf').setName(nomFichier);

  // 3. Sauvegarder dans Drive (sous-dossier "Réceptions Support" du chantier)
  const fichier = classerFichierDrive(blobPDF, brut.chantier||'DIVERS', 'Réceptions Support', nomFichier);

  // 4. Destinataires : conducteur + destinataire supplémentaire (contrôlés par distribuer_)
  const destinataires = [brut.conducteurEmail, brut.destSupp].filter(Boolean);
  if(!destinataires.length) destinataires.push(emailConducteurChantier_(brut.chantier) || emailAdmin_());

  const sujet = `[Loué App] Réception Support — ${brut.chantier||'?'} — ${brut.lotLabel||'?'}`;
  const corps = `Bonjour,\n\nVeuillez trouver ci-joint la fiche de réception support.\n\nChantier : ${brut.chantier||'?'}\nLot : ${brut.lotLabel||'?'}\nBilan : ${nbOk} conforme(s) / ${nbNok} non conforme(s)\n\nLoué App`;

  distribuer_({
    fiche: 'reception-support', chantier: brut.chantier, adresses: destinataires,
    sujet: sujet, texte: corps, fichier: fichier, nomPDF: nomFichier,
    faireBlob: () => HtmlService.createHtmlOutput(htmlPDF).getAs('application/pdf').setName(nomFichier),
  });
}

// ══════════════════════════════════════════════════════════
// ATTESTATION
// ══════════════════════════════════════════════════════════
function traiterAttestation(data, brut) {
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
  const objetOuDas = brut.typeAttest==='das' ? (brut.dasNumero||'') : String(brut.objet||'').substring(0,100);
  sheet.appendRow([horodatage, brut.typeLabel||'', brut.chantier||'', brut.precision||'',
    brut.signataire||'', brut.date||'', brut.ref||'', objetOuDas].map(cellule_));

  // 2. PDF
  const chFull = data.chantier + (data.precision ? ' — '+data.precision : '');
  const sig    = data.signature||'';

  // Qualité (rôle) du signataire — colonne B de l'onglet Contacts
  const _rowSig    = getContactsRaw().find(r => String(r[0]).toLowerCase() === String(brut.signataire||'').toLowerCase());
  const qualite    = _rowSig ? esc_(String(_rowSig[1]||'')) : '';
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

  const nomFichier=nomFichier_(`Attestation_${String(brut.typeLabel||'').replace(/ /g,'_')}_${String(brut.chantier||'').replace(/ /g,'_')}.pdf`);
  const fichier = classerFichierDrive(HtmlService.createHtmlOutput(htmlPDF).getAs('application/pdf').setName(nomFichier), brut.chantier||'DIVERS', 'Attestations', nomFichier);

  // Envoi email — conducteur du chantier (contrôlé par distribuer_)
  const destinataires=[brut.conducteurEmail].filter(Boolean);
  if(!destinataires.length) destinataires.push(emailConducteurChantier_(brut.chantier) || emailAdmin_());

  const sujet=`[Loué App] Attestation — ${brut.typeLabel||''} — ${brut.chantier||'?'}`;
  const corps=`Bonjour,\n\nVeuillez trouver ci-joint l'attestation.\n\nType : ${brut.typeLabel||'?'}\nChantier : ${brut.chantier||'?'}\nSignataire : ${brut.signataire||'?'}\n\nLoué App`;
  distribuer_({
    fiche: 'attestation', chantier: brut.chantier, adresses: destinataires,
    sujet: sujet, texte: corps, fichier: fichier, nomPDF: nomFichier,
    faireBlob: () => HtmlService.createHtmlOutput(htmlPDF).getAs('application/pdf').setName(nomFichier),
  });
}


// ══════════════════════════════════════════════════════════
// SÉCURITÉ DES ENVOIS (lot 0)
// ══════════════════════════════════════════════════════════
// Règles :
//  - une adresse présente dans l'onglet Contacts (col. C) ou Contacts notes (col. B) reçoit le mail habituel ;
//  - une adresse tapée à la main (« adresse libre ») reçoit un mail au contenu IMPOSÉ + le PDF,
//    MAX_LIBRES_PAR_FICHE par fiche et MAX_LIBRES_PAR_JOUR par jour au plus, avec le conducteur du chantier
//    (ou Franck) en copie cachée ; chaque envoi est noté dans l'onglet Journal ;
//  - sous RESERVE_ADMIN mails restants dans la journée, seuls les mails vers Franck partent :
//    les autres sont reportés dans l'onglet « Mails en attente » et renvoyés toutes les 2 h.

const LIBELLES_FICHES = {
  'note'               : 'Note de réunion',
  'bordereau-orga'     : 'Bordereau de remise (organigramme)',
  'bordereau-materiaux': 'Bordereau de remise (matériaux)',
  'quitus'             : 'Quitus',
  'absence'            : "Demande d'absence",
  'reception-support'  : 'Réception support',
  'attestation'        : 'Attestation',
  'cotes'              : 'Prise de cotes',
  'fabrication'        : 'Fiche de fabrication',
};

// Champs qui contiennent une image « data: » (signatures)
const CHAMPS_IMAGE_URL = ['sigLoue', 'sigPreneur', 'sigIntervenant', 'signature'];

// Rend un texte inoffensif avant de l'insérer dans du HTML (PDF, mail)
function esc_(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// Copie des données reçues : textes échappés, images contrôlées
function preparerDonnees_(brut) {
  function nettoyer(v, cle) {
    if (v === null || v === undefined) return v;
    if (Array.isArray(v)) return v.map(x => nettoyer(x, cle));
    if (typeof v === 'object') {
      const o = {};
      Object.keys(v).forEach(k => { o[k] = nettoyer(v[k], k); });
      return o;
    }
    if (typeof v !== 'string') return v;
    if (CHAMPS_IMAGE_URL.indexOf(cle) > -1) return /^data:image\/(png|jpeg);base64,[A-Za-z0-9+\/=]+$/.test(v) ? v : '';
    if (cle === 'data') return /^[A-Za-z0-9+\/=\s]*$/.test(v) ? v : '';
    if (cle === 'mimeType' || cle === 'mime') return /^image\/(jpeg|png|webp|gif)$/.test(v) ? v : 'image/jpeg';
    return esc_(v);
  }
  const data = nettoyer(brut || {}, '');
  // Fiche de fabrication : les commentaires sont mis en forme (gras, couleur, taille) → liste blanche
  if (brut && brut.type === 'fabrication') data.commentaires = nettoyerHtmlRiche_(brut.commentaires);
  return data;
}

// Ne garde du HTML que gras / italique / souligné / retours à la ligne et des <span> avec
// couleur, graisse ou taille. Tout le reste (scripts, liens, images, attributs) est supprimé.
function nettoyerHtmlRiche_(html) {
  if (typeof html !== 'string') return '';
  return html.split(/(<[^>]*>)/).map(morceau => {
    if (morceau.charAt(0) !== '<') return morceau.replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const m = morceau.match(/^<\s*(\/?)\s*([a-zA-Z]+)([^>]*)>$/);
    if (!m) return '';
    const ferme = m[1] === '/', balise = m[2].toLowerCase(), attributs = m[3];
    if (['b','strong','i','em','u','div','p'].indexOf(balise) > -1) return ferme ? '</' + balise + '>' : '<' + balise + '>';
    if (balise === 'br') return ferme ? '' : '<br>';
    if (balise === 'span' || balise === 'font') {
      if (ferme) return '</span>';
      const styles = [];
      const style = (attributs.match(/style\s*=\s*"([^"]*)"/i) || [])[1] || '';
      style.split(';').forEach(decl => {
        const i = decl.indexOf(':');
        if (i < 0) return;
        const prop = decl.slice(0, i).trim().toLowerCase(), val = decl.slice(i + 1).trim();
        if (prop === 'color' && /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i.test(val)) styles.push('color:' + val);
        if (prop === 'font-weight' && /^(bold|bolder|[1-9]00)$/i.test(val)) styles.push('font-weight:' + val);
        if (prop === 'font-size' && /^\d+(\.\d+)?(em|px|%)$/i.test(val)) styles.push('font-size:' + val);
      });
      const couleur = (attributs.match(/color\s*=\s*"?(#[0-9a-f]{3,8})"?/i) || [])[1];
      if (balise === 'font' && couleur) styles.push('color:' + couleur);
      return styles.length ? '<span style="' + styles.join(';') + '">' : '<span>';
    }
    return '';
  }).join('');
}

// Valeur écrite dans le Sheet : un texte qui commence par = + @ (ou - suivi d'une lettre)
// serait pris pour une formule → on le préfixe d'une apostrophe. Les nombres négatifs restent des nombres.
function cellule_(v) {
  if (typeof v !== 'string') return v;
  return (/^[=+@]/.test(v) || /^-(?![\d.,\s]|$)/.test(v)) ? "'" + v : v;
}

// Nom de fichier Drive : sans caractères de contrôle, longueur raisonnable
function nomFichier_(nom) {
  return String(nom).replace(/[\u0000-\u001f]/g, ' ').slice(0, 180);
}

function jour_() {
  return Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyy-MM-dd');
}

function estEmail_(s) {
  return /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[A-Za-z]{2,}$/.test(String(s || '').trim());
}

// Adresse mail d'un contact à partir de son nom (onglet Contacts, colonnes A et C)
function emailContact_(nom) {
  const n = String(nom || '').trim().toLowerCase();
  if (!n) return '';
  const r = getContactsRaw().find(r => String(r[0]).trim().toLowerCase() === n);
  return r ? decouperAdresses_(r[2]).join(', ') : '';
}

// Une cellule peut contenir plusieurs adresses (« a@x.fr, b@x.fr ») : on les sépare
function decouperAdresses_(v) {
  return String(v || '').split(/[,;\s]+/).map(s => s.trim()).filter(estEmail_);
}

// Ligne du chantier dans l'onglet Chantiers (colonne A), ou null s'il n'existe pas
function ligneChantier_(nom) {
  const n = String(nom || '').trim().toLowerCase();
  if (!n) return null;
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CHANTIERS);
  if (!sh) return null;
  return sh.getDataRange().getValues().slice(1).find(r => String(r[0]).trim().toLowerCase() === n) || null;
}

// Mail du conducteur d'un chantier (onglet Chantiers, colonne D → onglet Contacts)
function emailConducteurChantier_(nomChantier) {
  const r = ligneChantier_(nomChantier);
  return r ? emailContact_(r[3]) : '';
}

// Adresses connues : onglet Contacts (col. C) et Contacts notes (col. B), en minuscules
let ADRESSES_CONNUES_ = null;
function adressesConnues_() {
  if (ADRESSES_CONNUES_) return ADRESSES_CONNUES_;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const res = {};
  const ajouter = v => decouperAdresses_(v).forEach(e => { res[e.toLowerCase()] = true; });
  const sc = ss.getSheetByName(SHEET_CONTACTS);
  if (sc) sc.getDataRange().getValues().slice(1).forEach(r => ajouter(r[2]));
  const sn = ss.getSheetByName(SHEET_CONTACT_NOTES);
  if (sn) sn.getDataRange().getValues().slice(1).forEach(r => ajouter(r[1]));
  ajouter(emailAdmin_());
  ADRESSES_CONNUES_ = res;
  return res;
}

// Point d'entrée unique des mails d'une fiche.
// o = { fiche, chantier, adresses, sujet, texte, html, fichier (Drive ou null), nomPDF, faireBlob }
function distribuer_(o) {
  const connues = adressesConnues_();
  const vues = {}, servies = [], libres = [];
  // Toujours un tableau, 20 adresses au plus (sinon un pirate pourrait remplir le Journal)
  const liste = (Array.isArray(o.adresses) ? o.adresses : [])
    .reduce((acc, a) => acc.concat(String(a || '').split(/[,;]+/)), []).slice(0, 20);
  liste.forEach(a => {
    const email = String(a || '').trim();
    if (!email) return;
    const cle = email.toLowerCase();
    if (vues[cle]) return;
    vues[cle] = true;
    if (!estEmail_(email)) { journal_(o, email, 'refusé', 'adresse mal formée'); return; }
    if (connues[cle]) servies.push(email); else libres.push(email);
  });

  servies.forEach(email => envoyer_(o, email, { sujet: o.sujet, texte: o.texte, html: o.html || '', bcc: '' }, 'connue'));

  const libelle    = LIBELLES_FICHES[o.fiche] || 'Document';
  const chantierOk = ligneChantier_(o.chantier) ? String(o.chantier).trim() : '';  // jamais de texte libre dans le mail
  libres.forEach((email, i) => {
    if (i >= MAX_LIBRES_PAR_FICHE) {
      journal_(o, email, 'refusé', 'plus de ' + MAX_LIBRES_PAR_FICHE + ' adresses libres sur la même fiche');
      alerte_('Adresse refusée (plus de ' + MAX_LIBRES_PAR_FICHE + ' adresses libres sur une fiche « ' + libelle + ' ») : ' + email);
      return;
    }
    const place = reserverLibre_();
    if (place !== 'ok') {
      const motif = place === 'verrou' ? 'serveur occupé, adresse non servie (renvoyer la fiche plus tard)'
                                       : 'plafond de ' + MAX_LIBRES_PAR_JOUR + ' adresses libres par jour atteint';
      journal_(o, email, 'refusé', motif);
      alerte_('Adresse refusée (' + motif + ') : ' + email);
      return;
    }
    const copie = emailConducteurChantier_(o.chantier) || emailAdmin_();
    envoyer_(o, email, {
      sujet: 'Loué Menuiserie — ' + libelle + (chantierOk ? ' — ' + chantierOk : ''),
      texte: 'Bonjour,\n\nVeuillez trouver ci-joint le document « ' + libelle + ' » établi par Loué Menuiserie.\n\n'
           + 'Cordialement,\nLoué Menuiserie',
      html: '',
      bcc: copie,
      nomPJ: 'Loue Menuiserie - ' + libelle + ' - ' + jour_() + '.pdf',
    }, 'libre');
  });
}

// Envoie un mail, ou le reporte si le quota du jour est trop bas
function envoyer_(o, email, m, mode) {
  const besoin    = m.bcc ? 2 : 1;
  const pourAdmin = !m.bcc && email.toLowerCase() === String(emailAdmin_()).toLowerCase();
  let reste = 0;
  try { reste = MailApp.getRemainingDailyQuota(); } catch (e) {}
  if (reste < besoin || (!pourAdmin && reste - besoin < RESERVE_ADMIN)) {
    differer_(o, email, m, mode, 'quota du jour presque atteint');
    return;
  }
  try {
    const blob = o.faireBlob();
    if (m.nomPJ) blob.setName(m.nomPJ);
    const opts = { attachments: [blob], name: NOM_ENTREPRISE };
    if (m.html) opts.htmlBody = m.html;
    if (m.bcc)  opts.bcc = m.bcc;
    GmailApp.sendEmail(email, m.sujet, m.texte, opts);
    if (mode === 'libre') journal_(o, email, 'envoyé', 'adresse libre, copie cachée à ' + m.bcc);
  } catch (err) {
    console.error('Envoi mail échoué :', email, err.message);
    differer_(o, email, m, mode, 'erreur : ' + err.message);
  }
}

// Met un mail de côté dans l'onglet « Mails en attente » (le PDF est gardé dans Drive)
function differer_(o, email, m, mode, motif) {
  try {
    if (!o._idPdf) {
      if (o.fichier) {
        o._idPdf = o.fichier.getId();
      } else {
        const root    = DriveApp.getFolderById(driveRootId_());
        const attente = trouverOuCreerSousDossier(root, '_MAILS EN ATTENTE');
        o._idPdf = attente.createFile(o.faireBlob().setName(o.nomPDF || 'document.pdf')).getId();
      }
    }
    const sh = feuille_(SHEET_ATTENTE, ['Horodatage','Fiche','Chantier','Destinataire','Copie cachée','Sujet','Texte',
      'HTML','ID du PDF','Nom de la pièce jointe','Statut','Essais','Dernier essai','Mode']);
    sh.appendRow([new Date(), o.fiche, o.chantier || '', email, m.bcc || '', m.sujet, m.texte,
      String(m.html || '').slice(0, 45000), o._idPdf, m.nomPJ || o.nomPDF || '', 'en attente', 0, '', mode].map(cellule_));
    journal_(o, email, 'reporté', motif);
  } catch (err) {
    console.error('differer_ :', err.message);
    journal_(o, email, 'perdu', 'impossible de reporter : ' + err.message);
  }
}

// Onglet du Sheet, créé avec ses en-têtes s'il n'existe pas
function feuille_(nom, entetes) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(nom);
  if (!sh) {
    sh = ss.insertSheet(nom);
    sh.appendRow(entetes);
    sh.getRange(1, 1, 1, entetes.length).setFontWeight('bold').setBackground('#1A2B4A').setFontColor('white');
    sh.setFrozenRows(1);
  }
  return sh;
}

// Une ligne dans l'onglet Journal
function journal_(o, adresse, statut, motif) {
  try {
    feuille_(SHEET_JOURNAL, ['Horodatage','Fiche','Chantier','Adresse','Statut','Motif'])
      .appendRow([new Date(), o.fiche || '', o.chantier || '', adresse, statut, motif].map(cellule_));
  } catch (err) { console.error('journal_ :', err.message); }
}

// Un mail d'alerte à Franck au plus une fois par jour (le détail est dans l'onglet Journal)
function alerte_(texte, sorte) {
  sorte = sorte || 'refus';
  const props = PropertiesService.getScriptProperties();
  const cle = 'ALERTE_' + sorte.toUpperCase() + '_' + jour_();
  if (props.getProperty(cle)) return;
  props.setProperty(cle, '1');
  try {
    if (MailApp.getRemainingDailyQuota() < 1) return;
    const sujet = sorte === 'abandon' ? "[Loué App] Mail abandonné — voir l'onglet Mails en attente"
                                      : "[Loué App] Envoi refusé — voir l'onglet Journal";
    GmailApp.sendEmail(emailAdmin_(), sujet,
      texte + "\n\nLes cas suivants de la journée sont notés dans l'onglet « Journal » du Sheet, sans autre mail.\n\nLoué App",
      { name: NOM_ENTREPRISE });
  } catch (err) { console.error('alerte_ :', err.message); }
}

// Réserve une place dans le plafond quotidien des adresses libres
function reserverLibre_() {
  const verrou = LockService.getScriptLock();
  if (!verrou.tryLock(10000)) return 'verrou';
  try {
    const props = PropertiesService.getScriptProperties();
    const cle = 'LIBRES_' + jour_();
    const n = Number(props.getProperty(cle) || 0);
    if (n >= MAX_LIBRES_PAR_JOUR) return 'plafond';
    props.setProperty(cle, String(n + 1));
    return 'ok';
  } finally {
    verrou.releaseLock();
  }
}


// ══════════════════════════════════════════════════════════
// TÂCHES À LANCER DANS L'ÉDITEUR (choisir la fonction en haut, puis ▶ Exécuter)
// ══════════════════════════════════════════════════════════

// Renvoie les mails de l'onglet « Mails en attente » (lancé automatiquement toutes les 2 h)
function renvoyerMailsEnAttente() {
  const verrou = LockService.getScriptLock();
  if (!verrou.tryLock(20000)) return;
  try {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ATTENTE);
    if (sh && sh.getLastRow() > 1) {
      const valeurs = sh.getRange(2, 1, sh.getLastRow() - 1, 14).getValues();
      const envoyesCePassage = [];
      valeurs.forEach((r, i) => {
        if (r[10] !== 'en attente') return;
        const email = r[3], bcc = r[4];
        const besoin = bcc ? 2 : 1;
        const pourAdmin = !bcc && String(email).toLowerCase() === String(emailAdmin_()).toLowerCase();
        const reste = MailApp.getRemainingDailyQuota();
        if (reste < besoin || (!pourAdmin && reste - besoin < RESERVE_ADMIN)) return;  // on retentera plus tard
        const essais = Number(r[11] || 0) + 1;
        try {
          const blob = DriveApp.getFileById(r[8]).getBlob().setName(r[9] || 'document.pdf');
          const opts = { attachments: [blob], name: NOM_ENTREPRISE };
          if (r[7]) opts.htmlBody = r[7];
          if (bcc)  opts.bcc = bcc;
          GmailApp.sendEmail(email, r[5], r[6], opts);
          r[10] = 'envoyé';
          envoyesCePassage.push(r[8]);
          journal_({ fiche: r[1], chantier: r[2] }, email, 'envoyé', 'mail reporté, envoyé au ' + essais + 'e essai');
        } catch (err) {
          r[10] = essais >= MAX_ESSAIS_ATTENTE ? 'abandonné' : 'en attente';
          if (r[10] === 'abandonné') alerte_('Mail abandonné après ' + essais + ' essais : ' + email + ' (' + err.message + '). Le PDF est conservé.', 'abandon');
        }
        r[11] = essais;
        r[12] = new Date();
        sh.getRange(i + 2, 11, 1, 3).setValues([[r[10], r[11], r[12]]]);
      });
      // PDF temporaires (absences) envoyés pendant ce passage : à la corbeille si plus aucun mail ne les attend
      // (ceux des mails abandonnés sont gardés)
      const bloques = valeurs.filter(r => r[10] !== 'envoyé').map(r => r[8]);
      const vus = {};
      envoyesCePassage.forEach(id => {
        if (!id || vus[id] || bloques.indexOf(id) > -1) return;
        vus[id] = true;
        try {
          const f = DriveApp.getFileById(id);
          const parents = f.getParents();
          if (!f.isTrashed() && parents.hasNext() && parents.next().getName() === '_MAILS EN ATTENTE') f.setTrashed(true);
        } catch (e) {}
      });
    }
    // Nettoyage des compteurs des jours passés
    const props = PropertiesService.getScriptProperties();
    const aujourdhui = jour_();
    props.getKeys().forEach(k => {
      if (/^(LIBRES|ALERTE_[A-Z]+)_\d{4}-\d{2}-\d{2}$/.test(k) && k.slice(-10) < aujourdhui) props.deleteProperty(k);
    });
  } finally {
    verrou.releaseLock();
  }
}

// À lancer UNE fois après le déploiement : programme renvoyerMailsEnAttente toutes les 2 h
function installerDeclencheurs() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'renvoyerMailsEnAttente')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('renvoyerMailsEnAttente').timeBased().everyHours(2).create();
  Logger.log('Déclencheur installé : renvoyerMailsEnAttente toutes les 2 heures.');
}

// À lancer après chaque modification des Propriétés du script : vérifie que tout est en place
function verifierConfig() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lignes = ['Loué App API ' + VERSION_API];
  const ok = (cond, texte) => lignes.push((cond ? '✅ ' : '❌ ') + texte);
  try { ok(true, 'Dossier racine : ' + DriveApp.getFolderById(driveRootId_()).getName()); }
  catch (e) { ok(false, 'DRIVE_ROOT_ID : ' + e.message); }
  try { ok(true, 'Dossier Planning : ' + DriveApp.getFolderById(drivePlanningId_()).getName()); }
  catch (e) { ok(false, 'DRIVE_PLANNING_ID : ' + e.message); }
  ok(estEmail_(emailAdmin_()), 'Adresse de Franck (alertes, copies) : ' + emailAdmin_());
  [SHEET_CONTACTS, SHEET_CONTACT_NOTES, SHEET_CHANTIERS].forEach(n => ok(!!ss.getSheetByName(n), 'Onglet « ' + n + ' »'));
  ok(ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'renvoyerMailsEnAttente'),
     'Déclencheur des mails reportés (sinon lancer installerDeclencheurs)');
  lignes.push("Mails encore possibles aujourd'hui : " + MailApp.getRemainingDailyQuota());
  Logger.log(lignes.join('\n'));
  return lignes.join('\n');
}


// ══════════════════════════════════════════════════════════
// PARTAGES PAR LIEN (lot 0) — TEST d'abord, puis réel avec l'accord de Franck
// 1. listerPartages()   : remplit l'onglet « Partages (lot 0) » (relancer tant que le journal dit « À suivre »)
// 2. Franck télécharge l'onglet en CSV dans _prive/ (sauvegarde)
// 3. retirerPartages()  : passe en « accès limité » ce qui est marqué « à retirer »
// 4. remettrePartages() : en cas de problème, remet les partages d'origine
// ══════════════════════════════════════════════════════════
const DUREE_MAX_MS = 4.5 * 60 * 1000;   // on s'arrête avant la limite de 6 min ; il suffit de relancer

function listerPartages() {
  const debut = Date.now();
  const props = PropertiesService.getScriptProperties();
  const rootId = driveRootId_(), planningId = drivePlanningId_();
  let phase = props.getProperty('PARTAGES_PHASE') || '';
  const sh = feuille_(SHEET_PARTAGES, ['Type','Nom','Chemin','ID',"Accès d'origine","Permission d'origine",'Décision','État']);
  if (!phase || phase === 'terminé') {
    if (sh.getLastRow() > 1) {
      const etats = sh.getRange(2, 8, sh.getLastRow() - 1, 1).getValues().map(r => String(r[0]));
      if (etats.some(e => /^(retiré|remis)/.test(e))) {
        const msg = "Refusé : l'onglet « " + SHEET_PARTAGES + " » sert au retour arrière (des partages ont déjà été retirés). "
          + "Pour refaire une liste, renommer d'abord cet onglet (exemple : « Partages (lot 0) ancien »).";
        Logger.log(msg);
        return msg;
      }
      sh.getRange(2, 1, sh.getLastRow() - 1, 8).clearContent();
    }
    phase = 'fichiers';
    props.deleteProperty('PARTAGES_JETON');
  }
  const requete = "(visibility = 'anyoneWithLink' or visibility = 'anyoneCanFind') and trashed = false";
  const cache = {};
  const lignes = [];
  let total = 0;
  while (phase !== 'terminé') {
    const jeton = props.getProperty('PARTAGES_JETON');
    const it = jeton
      ? (phase === 'fichiers' ? DriveApp.continueFileIterator(jeton) : DriveApp.continueFolderIterator(jeton))
      : (phase === 'fichiers' ? DriveApp.searchFiles(requete) : DriveApp.searchFolders(requete));
    while (it.hasNext() && Date.now() - debut < DUREE_MAX_MS) {
      const el = it.next();
      const chemin = cheminDansAppli_(el, rootId, planningId, cache);
      if (!chemin) continue;  // fichier hors de l'appli : on n'y touche pas
      const morceaux = chemin.split('/');
      const garder = morceaux[0] === 'PLANNING' || (morceaux[0] === 'RACINE' && SOUS_DOSSIERS_PARTAGES.indexOf(morceaux[2]) > -1);
      lignes.push([phase === 'fichiers' ? 'fichier' : 'dossier', el.getName(), chemin, el.getId(),
        String(el.getSharingAccess()), String(el.getSharingPermission()),
        garder ? 'garder' : 'à retirer', ''].map(cellule_));
    }
    // Les lignes sont écrites AVANT d'enregistrer où l'on en est : rien n'est perdu si l'exécution est coupée
    if (lignes.length) { sh.getRange(sh.getLastRow() + 1, 1, lignes.length, 8).setValues(lignes); total += lignes.length; lignes.length = 0; }
    if (it.hasNext()) {
      props.setProperty('PARTAGES_JETON', it.getContinuationToken());
      props.setProperty('PARTAGES_PHASE', phase);
      break;
    }
    props.deleteProperty('PARTAGES_JETON');
    phase = phase === 'fichiers' ? 'dossiers' : 'terminé';
    props.setProperty('PARTAGES_PHASE', phase);
  }
  const msg = phase === 'terminé'
    ? 'Liste terminée (' + (sh.getLastRow() - 1) + " élément(s)). Télécharger l'onglet en CSV dans _prive/, puis lancer retirerPartages()."
    : 'À suivre : ' + total + ' élément(s) ajouté(s). Relancer listerPartages() pour continuer.';
  Logger.log(msg);
  return msg;
}

// Chemin d'un fichier ou dossier depuis la racine de l'appli ("RACINE/…" ou "PLANNING/…"), ou '' s'il est ailleurs
function cheminDansAppli_(el, rootId, planningId, cache) {
  const id0 = el.getId();
  if (id0 === rootId) return 'RACINE';
  if (id0 === planningId) return 'PLANNING';
  const noms = [el.getName()];
  const traverses = [];   // dossiers parcourus, pour remplir le cache
  let parents = el.getParents();
  let base = '';
  for (let niveau = 0; niveau < 12 && parents.hasNext(); niveau++) {
    const p = parents.next();
    const id = p.getId();
    if (cache[id] !== undefined) { base = cache[id]; break; }
    if (id === rootId)     { base = 'RACINE';   break; }
    if (id === planningId) { base = 'PLANNING'; break; }
    traverses.push(id);
    noms.push(p.getName());
    parents = p.getParents();
  }
  // Le cache retient, pour chaque dossier traversé, son chemin complet (ou '' s'il est hors de l'appli)
  for (let k = 0; k < traverses.length; k++) {
    cache[traverses[k]] = base ? base + '/' + noms.slice(k + 1).reverse().join('/') : '';
  }
  return base ? base + '/' + noms.reverse().join('/') : '';
}

function retirerPartages() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('PARTAGES_PHASE') !== 'terminé') {
    Logger.log("La liste n'est pas terminée : lancer d'abord listerPartages() jusqu'à « Liste terminée ».");
    return;
  }
  return modifierPartages_(r => r[7] === '' || String(r[7]).indexOf('remis') === 0 || String(r[7]).indexOf('erreur') === 0,
    el => {
      // Un fichier rendu privé par son dossier (partage hérité) n'a plus rien à retirer
      if (String(el.getSharingAccess()) === 'PRIVATE') return 'déjà privé (dossier parent)';
      el.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
    }, 'retiré le ');
}

function remettrePartages() {
  return modifierPartages_(r => String(r[7]).indexOf('retiré') === 0,
    (el, r) => el.setSharing(DriveApp.Access[r[4]], DriveApp.Permission[r[5]]), 'remis le ');
}

function modifierPartages_(aTraiter, action, texteEtat) {
  const debut = Date.now();
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PARTAGES);
  if (!sh || sh.getLastRow() < 2) { Logger.log('Onglet « ' + SHEET_PARTAGES + ' » vide.'); return; }
  const valeurs = sh.getRange(2, 1, sh.getLastRow() - 1, 8).getValues();
  let faits = 0, restants = 0;
  // Les dossiers d'abord : leurs fichiers perdent alors le partage hérité
  const ordre = valeurs.map((r, i) => i).sort((a, b) => (valeurs[a][0] === 'dossier' ? 0 : 1) - (valeurs[b][0] === 'dossier' ? 0 : 1));
  ordre.forEach(i => {
    const r = valeurs[i];
    if (r[6] !== 'à retirer' || !aTraiter(r)) return;
    if (Date.now() - debut > DUREE_MAX_MS) { restants++; return; }
    try {
      const el = r[0] === 'dossier' ? DriveApp.getFolderById(r[3]) : DriveApp.getFileById(r[3]);
      const note = action(el, r);
      sh.getRange(i + 2, 8).setValue(texteEtat + Utilities.formatDate(new Date(), 'Europe/Paris', 'dd/MM/yyyy HH:mm')
        + (note ? ' — ' + note : ''));
      faits++;
    } catch (err) {
      sh.getRange(i + 2, 8).setValue('erreur : ' + err.message);
    }
  });
  const msg = faits + ' élément(s) traité(s).' + (restants ? ' ' + restants + ' restant(s) : relancer la même fonction.' : ' Terminé.');
  Logger.log(msg);
  return msg;
}


// ══════════════════════════════════════════════════════════
// COPIE TEST UNIQUEMENT — remplace les vraies adresses par des variantes de celle de Franck
// (franck+contact1@…, qui arrivent dans sa boîte), pour qu'aucun essai n'écrive à un vrai conducteur ou client.
// Refuse de tourner si le Sheet ne s'appelle pas « … TEST … » ou si la propriété ENVIRONNEMENT ≠ TEST.
// ══════════════════════════════════════════════════════════
function anonymiserCopieTest() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (propriete_('ENVIRONNEMENT') !== 'TEST' || !/TEST/i.test(ss.getName())) {
    const msg = 'Refusé : à lancer seulement sur la copie TEST (Sheet nommé « … TEST … » et propriété ENVIRONNEMENT = TEST).';
    Logger.log(msg);
    return msg;
  }
  const admin = emailAdmin_();
  const at = admin.indexOf('@');
  const variante = n => admin.slice(0, at) + '+' + n + admin.slice(at);
  let n = 0;
  [[SHEET_CONTACTS, 3], [SHEET_CONTACT_NOTES, 2]].forEach(([nom, col]) => {
    const sh = ss.getSheetByName(nom);
    if (!sh || sh.getLastRow() < 2) return;
    const plage = sh.getRange(2, col, sh.getLastRow() - 1, 1);
    plage.setValues(plage.getValues().map(r => [r[0] ? variante('contact' + (++n)) : '']));
  });
  const msg = n + ' adresse(s) remplacée(s) par des variantes de ' + admin + '.';
  Logger.log(msg);
  return msg;
}
