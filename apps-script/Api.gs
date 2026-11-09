// ═══════════════════════════════════════════════════════════════
// Loué App — Api.gs : points d'entrée (doGet, doPost), contacts, dossiers Drive
// Les fichiers .gs du projet partagent les mêmes constantes et fonctions.
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// GET — contacts, chantiers, documents Drive, listes
// ═══════════════════════════════════════════════════════════════
function doGet(e) {
  const action = e.parameter.action || '';

  // Le nom de la fonction de rappel JSONP est contrôlé : lettres, chiffres, _ et $ seulement
  const cb = /^[A-Za-z_$][A-Za-z0-9_$]{0,60}$/.test(e.parameter.callback || '') ? e.parameter.callback : '';

  // Lot 2 : ces lectures sans compte ne marchent que pendant la période de transition (puis POST avec un jeton)
  if (action === 'getContacts' || action === 'getDossiers') {
    let ouverte = true;
    try { ouverte = transitionOuverte_(); } catch (err) {}
    if (!ouverte) return sortieJson_({ erreur: 'CONNEXION_REQUISE', message: MSG_CONNEXION }, cb);
    if (action === 'getContacts') { noterSansCompte_('listes'); return getContacts(cb); }
    noterSansCompte_(e.parameter.chantier === '__PLANNING__' ? 'planning' : 'dossiers');
    return getDossiers(e.parameter.chantier, cb);
  }

  // Ouvrir l'URL dans un navigateur affiche ce texte : sert à vérifier la version déployée
  return ContentService.createTextOutput('Loué App API ' + VERSION_API + ' OK').setMimeType(ContentService.MimeType.TEXT);
}

function sortieJson_(objet, callback) {
  const json = JSON.stringify(objet);
  return callback
    ? ContentService.createTextOutput(callback+'('+json+')').setMimeType(ContentService.MimeType.JAVASCRIPT)
    : ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

// ── Contacts + chantiers + listes ──
function getContacts(callback) { return sortieJson_(donneesListes_(), callback); }
function donneesListes_() {
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

  return {
    contacts, chantiers, contactNotes,
    materiaux  : getList(SHEET_MATERIAUX),
    finitions  : getList(SHEET_FINITIONS),
    quincaille : getList(SHEET_QUINCAILLE),
    fonctions  : getList(SHEET_FONCTIONS),
    types      : getList(SHEET_TYPES),
  };
}

// ── Lecture automatique des dossiers Drive pour un chantier ──
function getDossiers(chantierNom, callback) {
  const r = lireDossiers_(chantierNom);
  return sortieJson_(r && r.__erreur ? { erreur: r.__erreur, dossiers: {} } : { dossiers: r }, callback);
}
// Documents lisibles d'un chantier (Plans), ou le planning (__PLANNING__) ; { __erreur } si le dossier n'existe pas
function lireDossiers_(chantierNom) {
  const result = {};

  try {
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
      return result;
    }

    // Chercher le dossier du chantier
    // Lot 1.5 : même recherche que pour le classement (onglet « Dossiers chantiers », nom exact, ressemblance unique)
    const chantierFolder = dossierChantier_(chantierNom, false);
    if (!chantierFolder) return { __erreur: 'Dossier chantier non trouvé' };

    // Lot 0 : seuls les sous-dossiers encore partagés par lien sont listés
    // (les autres ne s'ouvriraient plus chez les poseurs, et leurs noms de fichiers ne doivent pas fuiter)
    // Lot 1.5 : le dossier Plans est celui de dossiers.json (même nom que pour le rangement)
    const plans = dossierParChemin_(chantierFolder, dossiers_().documents.plans, false);
    result.plans = plans ? lireSousDossier(plans, '', true) : [];

  } catch(err) {
    console.error('getDossiers:', err.message);
  }
  return result;
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
// Deux formats acceptés :
//  - API v5 (pages refondues, lot 1) : { action: 'fiche' | 'photo' | 'ping', … } → réponse lisible
//    { ok, code, message, data } que la page affiche (« Envoyée ✓ », « en attente », erreur claire) ;
//  - ancien format (pages pas encore refondues) : { type: 'quitus', … } → { status: 'ok' }.
// brut : données telles que reçues (pour le Sheet, les recherches de noms, les sujets de mail)
// data : mêmes données, textes échappés (pour le HTML des PDF et des mails)
const SHEET_ENVOIS = 'Envois';
// Nom de la fonction qui traite chaque type de fiche (résolu au moment de l'appel :
// les fichiers .gs se chargent l'un après l'autre)
const TRAITEMENTS = {
  'fabrication'        : 'traiterFicheFabrication',
  'note'               : 'traiterNoteReunion',
  'bordereau-orga'     : 'traiterBordereau',
  'bordereau-materiaux': 'traiterBordereau',
  'quitus'             : 'traiterQuitus',
  'absence'            : 'traiterAbsence',
  'reception-support'  : 'traiterReceptionSupport',
  'attestation'        : 'traiterAttestation',
  'cotes'              : 'traiterFicheCotes',
};

function doPost(e) {
  let corps;
  try {
    corps = JSON.parse(e.postData.contents);
  } catch (err) {
    return repondre_({ ok: false, code: 'DONNEES_INVALIDES', message: 'Données illisibles' });
  }
  if (corps && corps.action) return repondre_(routerV5_(corps));
  // Ancien format (pages d'avant le lot 1) : accepté seulement pendant la transition du lot 2
  try {
    if (!transitionOuverte_()) return repondre_({ status: 'error', message: MSG_CONNEXION });
    noterSansCompte_('fiche', corps);
    traiterFiche_(corps);
    return repondre_({ status: 'ok' });
  } catch (err) {
    console.error('doPost:', err.message);
    return repondre_({ status: 'error', message: err.message });
  }
}

function repondre_(objet) {
  return ContentService.createTextOutput(JSON.stringify(objet)).setMimeType(ContentService.MimeType.JSON);
}

// Fabrique le PDF, classe et envoie une fiche (ancien et nouveau format)
function traiterFiche_(brut) {
  const nom = brut && Object.prototype.hasOwnProperty.call(TRAITEMENTS, brut.type) ? TRAITEMENTS[brut.type] : '';
  if (!nom) throw new Error('Type de fiche inconnu');
  globalThis[nom](preparerDonnees_(brut), brut);
}

// Lot 2 : chaque action (sauf ping, connexion, motDePasse) passe par identifier_ : jeton valable, ou transition ouverte
function routerV5_(corps) {
  try {
    UTILISATEURS_ = null;   // l'onglet Utilisateurs est relu à chaque requête (un changement agit tout de suite)
    if (corps.action === 'ping') {
      let fin = null;
      try { fin = finTransition_(); } catch (e) {}
      return { ok: true, code: 'OK', message: 'Loué App API ' + VERSION_API, data: { version: VERSION_API, comptes: true,
        transitionJusquau: fin, transitionOuverte: !fin || maintenant_() < fin } };
    }
    if (corps.action === 'connexion')  return connexion_(corps);
    if (corps.action === 'motDePasse') return motDePasse_(corps);
    if (['photo', 'fiche', 'moi', 'listes', 'dossiers'].indexOf(corps.action) < 0) return { ok: false, code: 'ACTION_INCONNUE', message: 'Action inconnue' };
    let qui = identifier_(corps);
    const envoi = corps.action === 'photo' || corps.action === 'fiche';
    // Fiche ou photo d'un compte désactivé : acceptée, notée « (compte désactivé) »
    if (qui.refus && qui.desactive && envoi) qui = { compte: { id: qui.desactive, etiquette: qui.desactive + ' (compte désactivé)' } };
    // Comptes illisibles (panne) pendant la transition : la fiche passe « sans compte »
    if (qui.refus && qui.sansPossible && envoi) qui = { sans: true };
    if (qui.refus) return qui.refus;
    const marquer = rep => { if (qui.jetonInvalide) rep.jetonInvalide = true; return rep; };   // la page efface son jeton
    if (corps.action === 'photo') { if (qui.sans) noterSansCompte_('photo'); return marquer(avecJeton_(recevoirPhoto_(corps), qui.compte)); }
    if (corps.action === 'fiche') {
      if (qui.sans) noterSansCompte_('fiche', corps.donnees);
      return marquer(avecJeton_(recevoirFiche_(corps, qui.compte), qui.compte));
    }
    // Lectures : réservées aux comptes (sans compte, les anciennes lectures GET servent pendant la transition)
    if (qui.sans) return marquer({ ok: false, code: 'CONNEXION_REQUISE', message: 'Connectez-vous pour voir vos chantiers.' });
    if (corps.action === 'moi')      return moi_(qui.compte);
    if (corps.action === 'listes')   return listes_(qui.compte);
    if (corps.action === 'dossiers') return dossiersCompte_(qui.compte, String(corps.chantier || ''));
  } catch (err) {
    console.error('routerV5_:', err.message);
    return { ok: false, code: 'ERREUR', message: 'Erreur du serveur : ' + err.message };
  }
}

// Identifiant fourni par le téléphone (unique par fiche ou par photo) : lettres, chiffres et tirets
function idValide_(id) {
  return /^[A-Za-z0-9-]{8,64}$/.test(String(id || ''));
}

// ── Photos : une par requête, gardées dans « _PHOTOS EN COURS/<id de la fiche> » jusqu'à l'envoi de la fiche ──
const MAX_PHOTO_OCTETS = 1.5 * 1024 * 1024; // 1,5 Mo par photo (une photo compressée fait 200 à 400 Ko)
const MAX_PHOTOS_PAR_FICHE = 15;
const MAX_PHOTOS_PAR_JOUR = 400;            // 600 Mo par jour au pire (temporaires, à la corbeille après usage) : protège les 15 Go
// Dossier « _PHOTOS EN COURS » : créé une seule fois (sous verrou), son identifiant est gardé
function dossierPhotosEnCours_(creer) {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('DOSSIER_PHOTOS_EN_COURS');
  if (id) { try { const d = DriveApp.getFolderById(id); if (!d.isTrashed()) return d; } catch (e) {} }
  if (!creer) return null;
  const d = trouverOuCreerSousDossier(DriveApp.getFolderById(driveRootId_()), '_PHOTOS EN COURS');
  props.setProperty('DOSSIER_PHOTOS_EN_COURS', d.getId());
  return d;
}
function dossierPhotosFiche_(idFiche) {
  return trouverOuCreerSousDossier(dossierPhotosEnCours_(true), idFiche);
}

// Les premiers octets disent la vraie nature du fichier (JPEG FF D8 FF, PNG 89 50 4E 47, WEBP « RIFF….WEBP »)
function signatureImage_(octets, mime) {
  const o = Array.prototype.map.call(octets || [], x => x & 0xFF);
  if (mime === 'image/jpeg') return o[0] === 0xFF && o[1] === 0xD8 && o[2] === 0xFF;
  if (mime === 'image/png')  return o[0] === 0x89 && o[1] === 0x50 && o[2] === 0x4E && o[3] === 0x47;
  if (mime === 'image/webp') return String.fromCharCode.apply(null, o.slice(0, 4)) === 'RIFF' && String.fromCharCode.apply(null, o.slice(8, 12)) === 'WEBP';
  return false;
}

function recevoirPhoto_(corps) {
  if (!idValide_(corps.id) || !idValide_(corps.fiche)) return { ok: false, code: 'DONNEES_INVALIDES', message: 'Identifiant de photo invalide' };
  const mime = /^image\/(jpeg|png|webp)$/.test(corps.mime || '') ? corps.mime : '';
  const b64 = String(corps.data || '');
  if (!mime || !/^[A-Za-z0-9+\/=]+$/.test(b64)) return { ok: false, code: 'DONNEES_INVALIDES', message: 'Photo illisible' };
  if (b64.length * 0.75 > MAX_PHOTO_OCTETS) return { ok: false, code: 'TROP_GROS', message: 'Photo trop lourde (1,5 Mo maximum)' };
  // Sous verrou (court) : création du dossier de la fiche et compteurs ; l'écriture de la photo se fait ensuite
  const verrou = LockService.getScriptLock();
  if (!verrou.tryLock(15000)) return { ok: false, code: 'SERVEUR_OCCUPE', message: 'Serveur occupé, nouvel essai automatique' };
  if (!signatureImage_(Utilities.base64Decode(b64.slice(0, 24)), mime)) return { ok: false, code: 'DONNEES_INVALIDES', message: 'Le fichier n’est pas une photo' };
  const nom = corps.id + '.' + mime.split('/')[1];
  let dossier;
  try {
    dossier = dossierPhotosFiche_(corps.fiche);
    if (dossier.getFilesByName(nom).hasNext()) return { ok: true, code: 'PHOTO_RECUE', message: 'Photo reçue', data: { id: corps.id } };
    let n = 0;
    const it = dossier.getFiles();
    while (it.hasNext()) { it.next(); n++; }
    if (n >= MAX_PHOTOS_PAR_FICHE) return { ok: false, code: 'LIMITE', message: MAX_PHOTOS_PAR_FICHE + ' photos au maximum par fiche' };
    const props = PropertiesService.getScriptProperties();
    const cle = 'PHOTOS_' + jour_();
    const jour = Number(props.getProperty(cle) || 0);
    if (jour >= MAX_PHOTOS_PAR_JOUR) {
      alerte_('Plafond de ' + MAX_PHOTOS_PAR_JOUR + " photos par jour atteint : photos refusées jusqu'à demain.", 'photos');
      return { ok: false, code: 'SERVEUR_OCCUPE', message: "Trop de photos aujourd'hui, nouvel essai plus tard" };
    }
    props.setProperty(cle, String(jour + 1));
  } finally {
    verrou.releaseLock();
  }
  dossier.createFile(Utilities.newBlob(Utilities.base64Decode(b64), mime, nom));
  return { ok: true, code: 'PHOTO_RECUE', message: 'Photo reçue', data: { id: corps.id } };
}

// Remplace chaque { photoRef: 'id', … } des données par la photo elle-même (base64), lue dans Drive
function joindrePhotos_(valeur, dossier, manquantes) {
  if (Array.isArray(valeur)) return valeur.map(v => joindrePhotos_(v, dossier, manquantes));
  if (!valeur || typeof valeur !== 'object') return valeur;
  if (valeur.photoRef) {
    const ref = String(valeur.photoRef);
    const it = idValide_(ref) && dossier ? dossier.getFiles() : null;
    let fichier = null;
    while (it && it.hasNext()) { const f = it.next(); if (f.getName().split('.')[0] === ref) { fichier = f; break; } }
    if (!fichier) { manquantes.push(ref); return null; }
    const o = Object.assign({}, valeur);
    delete o.photoRef;
    o.data = Utilities.base64Encode(fichier.getBlob().getBytes());
    o.mimeType = o.mime = fichier.getMimeType();
    return o;
  }
  const o = {};
  Object.keys(valeur).forEach(k => { o[k] = joindrePhotos_(valeur[k], dossier, manquantes); });
  return o;
}

// ── Fiche : enregistrée UNE seule fois même si le téléphone la renvoie (numéro unique) ──
function recevoirFiche_(corps, compte) {
  if (!idValide_(corps.id)) return { ok: false, code: 'DONNEES_INVALIDES', message: 'Numéro de fiche invalide' };
  const donnees = corps.donnees || {};
  if (!Object.prototype.hasOwnProperty.call(TRAITEMENTS, donnees.type)) return { ok: false, code: 'TYPE_INCONNU', message: 'Type de fiche inconnu' };

  // Auteur : le compte qui envoie (et celui qui était connecté quand la fiche a été rangée, s'il est différent)
  const saisiPar = normaliserId_(corps.saisiPar);
  // « rangée par » est déclaré par le téléphone (information, pas une preuve) ; le compte qui envoie est vérifié par le jeton
  const auteur = compte ? (compte.etiquette || compte.id) + (saisiPar && saisiPar !== compte.id && idCompteValide_(saisiPar) ? ' (rangée par ' + saisiPar + ', selon le téléphone)' : '')
                        : 'sans compte';
  // 1. Réserver le numéro (sous verrou, court)
  const verrou = LockService.getScriptLock();
  if (!verrou.tryLock(15000)) return { ok: false, code: 'SERVEUR_OCCUPE', message: 'Serveur occupé, nouvel essai automatique' };
  let ligne;
  try {
    const sh = feuille_(SHEET_ENVOIS, ['Numéro', 'Reçu le', 'Type', 'Chantier', 'Statut', 'Détail']);
    const trouve = chercherEnvoi_(sh, corps.id);
    if (trouve) {
      const statut = String(sh.getRange(trouve, 5).getValue());
      const recu = sh.getRange(trouve, 2).getValue();
      if (statut.indexOf('traité') === 0) return { ok: true, code: 'DEJA_RECU', message: 'Fiche déjà reçue', data: { id: corps.id } };   // « traité » ou « traité (incomplet) »
      if (statut === 'en cours' && recu instanceof Date && Date.now() - recu.getTime() < 7 * 60 * 1000) {
        return { ok: false, code: 'EN_COURS', message: 'Fiche en cours de traitement, nouvel essai automatique' };
      }
      ligne = trouve;
      sh.getRange(ligne, 2, 1, 6).setValues([[new Date(), donnees.type, donnees.chantier || '', 'en cours', '', auteur]].map(r => r.map(cellule_)));
    } else {
      sh.appendRow([corps.id, new Date(), donnees.type, donnees.chantier || '', 'en cours', '', auteur].map(cellule_));
      ligne = sh.getLastRow();
    }
  } finally {
    verrou.releaseLock();
  }

  // 2. Photos déposées avant la fiche
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ENVOIS);
  let dossierPhotos = null;
  try {
    const enCours = dossierPhotosEnCours_(false);
    // Le dossier à la corbeille (nettoyage après 7 jours) ne compte pas : les photos renvoyées sont dans le nouveau
    const d = enCours ? enCours.getFoldersByName(corps.id) : null;
    while (d && d.hasNext()) { const x = d.next(); if (!x.isTrashed()) { dossierPhotos = x; break; } }
  } catch (e) {}
  const manquantes = [];
  const brut = joindrePhotos_(donnees, dossierPhotos, manquantes);
  if (manquantes.length) {
    sh.getRange(ligne, 5, 1, 2).setValues([['en attente de photos', manquantes.length + ' photo(s) manquante(s)']]);
    return { ok: false, code: 'PHOTOS_MANQUANTES', message: manquantes.length + ' photo(s) pas encore reçue(s)', data: { manquantes: manquantes } };
  }

  // 3. PDF, classement, mails
  RAPPORT_ = {};
  try {
    traiterFiche_(brut);
  } catch (err) {
    // Des mails sont déjà partis : renvoyer la fiche les doublerait. On la note traitée et Franck vérifie.
    const partis = RAPPORT_ && ((RAPPORT_['envoyé'] || []).length + (RAPPORT_['reporté'] || []).length);
    if (partis) {
      sh.getRange(ligne, 5, 1, 2).setValues([['traité (incomplet)', String(err.message).slice(0, 300)]]);
      RAPPORT_ = null;
      alerte_('Une fiche « ' + (donnees.type || '?') + ' » a été envoyée en partie (' + err.message + '). ' +
        "Ne pas la renvoyer (les premiers destinataires l'ont reçue) : voir l'onglet Envois et le Journal.", 'erreur');
      return { ok: true, code: 'ENREGISTRE', message: 'Fiche enregistrée (envoi incomplet : le bureau est prévenu)', data: { incomplet: true } };
    }
    sh.getRange(ligne, 5, 1, 2).setValues([['erreur', String(err.message).slice(0, 300)]]);
    RAPPORT_ = null;
    // Souvent passager (Drive, conversion PDF) : le téléphone réessaiera plus tard ; Franck est prévenu
    alerte_('Une fiche « ' + (donnees.type || '?') + " » n'a pas pu être traitée (" + err.message + "). Le téléphone réessaiera ; voir l'onglet Envois.", 'erreur');
    return { ok: false, code: 'ERREUR', message: "Le serveur n'a pas pu traiter la fiche, nouvel essai automatique" };
  }
  const rapport = RAPPORT_;
  RAPPORT_ = null;
  const n = k => (rapport[k] || []).length;
  const detail = n('envoyé') + ' mail(s) envoyé(s)' + (n('reporté') ? ', ' + n('reporté') + ' reporté(s)' : '')
    + (n('refusé') ? ', ' + n('refusé') + ' adresse(s) refusée(s)' : '');
  sh.getRange(ligne, 5, 1, 2).setValues([['traité', detail]]);
  if (dossierPhotos) { try { dossierPhotos.setTrashed(true); } catch (e) {} }   // les photos sont dans le PDF

  return {
    ok: true, code: 'ENREGISTRE',
    message: 'Fiche enregistrée. ' + detail.charAt(0).toUpperCase() + detail.slice(1) + '.',
    data: { id: corps.id, envoyes: n('envoyé'), reportes: n('reporté'), refuses: rapport['refusé'] || [] },
  };
}

// Ligne d'un numéro dans l'onglet Envois (recherche rapide), ou 0
function chercherEnvoi_(sh, id) {
  if (sh.getLastRow() < 2) return 0;
  if (sh.createTextFinder) {
    const c = sh.getRange(2, 1, sh.getLastRow() - 1, 1).createTextFinder(id).matchEntireCell(true).findNext();
    return c ? c.getRow() : 0;
  }
  const ids = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === id) return i + 2;
  return 0;
}
