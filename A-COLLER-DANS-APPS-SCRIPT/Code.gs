// ═══════════════════════════════════════════════════════════════
// LOUÉ APP — SERVEUR COMPLET, À COLLER DANS APPS SCRIPT (fichier « Code.gs », tout remplacer)
// FICHIER GÉNÉRÉ AUTOMATIQUEMENT par « node outils/construire.js » — NE PAS MODIFIER À LA MAIN :
// les sources sont dans le dossier apps-script/ du dépôt. Version 628b6b88c2
// ═══════════════════════════════════════════════════════════════

// ████ Config.gs ████
// ═══════════════════════════════════════════════════════════════
// Loué App — Apps Script v4.1 (lot 0 : sécurité)
// Loué Menuiserie
// ═══════════════════════════════════════════════════════════════

const VERSION_API = 'v5.0';

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

// ████ Securite.gs ████
// ═══════════════════════════════════════════════════════════════
// Loué App — Securite.gs : contrôle des destinataires, quota, journal, échappement
// Les fichiers .gs du projet partagent les mêmes constantes et fonctions.
// ═══════════════════════════════════════════════════════════════

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

// Copie des données reçues pour les modèles uniques (modeles/*.js) : textes laissés bruts
// (le modèle les échappe lui-même), images contrôlées comme dans preparerDonnees_
function validerImages_(brut) {
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
    return v;
  }
  return nettoyer(brut || {}, '');
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
  // Toujours un tableau. Les adresses du Sheet sont toutes servies ; les autres (libres ou mal formées)
  // sont examinées 20 au plus, pour qu'un pirate ne puisse pas remplir le Journal.
  const liste = (Array.isArray(o.adresses) ? o.adresses : [])
    .reduce((acc, a) => acc.concat(String(a || '').split(/[,;]+/)), []);
  let horsSheet = 0, ignorees = 0;
  liste.forEach(a => {
    const email = String(a || '').trim();
    if (!email) return;
    const cle = email.toLowerCase();
    if (vues[cle]) return;
    vues[cle] = true;
    if (connues[cle]) { servies.push(email); return; }
    if (++horsSheet > 20) { ignorees++; return; }
    if (!estEmail_(email)) { journal_(o, email, 'refusé', 'adresse mal formée'); return; }
    libres.push(email);
  });
  if (ignorees) journal_(o, ignorees + ' autre(s) adresse(s)', 'refusé', 'plus de 20 adresses hors Sheet sur une fiche');

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
  const besoin    = 1 + (m.bcc ? decouperAdresses_(m.bcc).length || 1 : 0);
  const pourAdmin = !m.bcc && email.toLowerCase() === String(emailAdmin_()).toLowerCase();
  let reste = 0;
  try { reste = MailApp.getRemainingDailyQuota(); } catch (e) {}
  if (reste < besoin || (!pourAdmin && reste - besoin < RESERVE_ADMIN)) {
    differer_(o, email, m, mode, 'quota du jour presque atteint');
    return;
  }
  try {
    // Le PDF n'est fabriqué qu'une fois pour tous les destinataires (la conversion est lente)
    if (!o._blob) o._blob = o.faireBlob();
    const blob = o._blob.copyBlob().setName(m.nomPJ || o._blob.getName());
    const opts = { attachments: [blob], name: NOM_ENTREPRISE };
    if (m.html) opts.htmlBody = m.html;
    if (m.bcc)  opts.bcc = m.bcc;
    GmailApp.sendEmail(email, m.sujet, m.texte, opts);
    noter_('envoyé', email);
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
    noter_('reporté', email);
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

// Bilan des envois de la requête en cours, renvoyé à la page (API v5) : {envoyé: [...], reporté: [...], refusé: [...]}
let RAPPORT_ = null;
function noter_(statut, adresse) {
  if (!RAPPORT_) return;
  (RAPPORT_[statut] = RAPPORT_[statut] || []).push(String(adresse));
}

// Une ligne dans l'onglet Journal
function journal_(o, adresse, statut, motif) {
  if (statut === 'refusé') noter_('refusé', adresse);
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
    const sujet = {
      abandon: "[Loué App] Mail abandonné — voir l'onglet Mails en attente",
      erreur : "[Loué App] Fiche non traitée — voir l'onglet Envois",
      photos : "[Loué App] Trop de photos aujourd'hui",
    }[sorte] || "[Loué App] Envoi refusé — voir l'onglet Journal";
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

// ████ Api.gs ████
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
    // Lot 1.5 : même recherche que pour le classement (onglet « Dossiers chantiers », nom exact, ressemblance unique)
    const chantierFolder = dossierChantier_(chantierNom, false);
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
  // Ancien format
  try {
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

function routerV5_(corps) {
  try {
    if (corps.action === 'ping')  return { ok: true, code: 'OK', message: 'Loué App API ' + VERSION_API, data: { version: VERSION_API } };
    if (corps.action === 'photo') return recevoirPhoto_(corps);
    if (corps.action === 'fiche') return recevoirFiche_(corps);
    return { ok: false, code: 'ACTION_INCONNUE', message: 'Action inconnue' };
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
const MAX_PHOTO_OCTETS = 3 * 1024 * 1024;   // 3 Mo par photo (une photo compressée fait 200 à 400 Ko)
const MAX_PHOTOS_PAR_FICHE = 15;
const MAX_PHOTOS_PAR_JOUR = 400;            // ≈ 120 Mo par jour au pire : protège les 15 Go
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

function recevoirPhoto_(corps) {
  if (!idValide_(corps.id) || !idValide_(corps.fiche)) return { ok: false, code: 'DONNEES_INVALIDES', message: 'Identifiant de photo invalide' };
  const mime = /^image\/(jpeg|png|webp)$/.test(corps.mime || '') ? corps.mime : '';
  const b64 = String(corps.data || '');
  if (!mime || !/^[A-Za-z0-9+\/=]+$/.test(b64)) return { ok: false, code: 'DONNEES_INVALIDES', message: 'Photo illisible' };
  if (b64.length * 0.75 > MAX_PHOTO_OCTETS) return { ok: false, code: 'TROP_GROS', message: 'Photo trop lourde (3 Mo maximum)' };
  // Sous verrou (court) : création du dossier de la fiche et compteurs ; l'écriture de la photo se fait ensuite
  const verrou = LockService.getScriptLock();
  if (!verrou.tryLock(15000)) return { ok: false, code: 'SERVEUR_OCCUPE', message: 'Serveur occupé, nouvel essai automatique' };
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
function recevoirFiche_(corps) {
  if (!idValide_(corps.id)) return { ok: false, code: 'DONNEES_INVALIDES', message: 'Numéro de fiche invalide' };
  const donnees = corps.donnees || {};
  if (!Object.prototype.hasOwnProperty.call(TRAITEMENTS, donnees.type)) return { ok: false, code: 'TYPE_INCONNU', message: 'Type de fiche inconnu' };

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
      if (statut === 'traité') return { ok: true, code: 'DEJA_RECU', message: 'Fiche déjà reçue', data: { id: corps.id } };
      if (statut === 'en cours' && recu instanceof Date && Date.now() - recu.getTime() < 7 * 60 * 1000) {
        return { ok: false, code: 'EN_COURS', message: 'Fiche en cours de traitement, nouvel essai automatique' };
      }
      ligne = trouve;
      sh.getRange(ligne, 2, 1, 5).setValues([[new Date(), donnees.type, donnees.chantier || '', 'en cours', '']].map(r => r.map(cellule_)));
    } else {
      sh.appendRow([corps.id, new Date(), donnees.type, donnees.chantier || '', 'en cours', ''].map(cellule_));
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
    const d = enCours ? enCours.getFoldersByName(corps.id) : null;
    if (d && d.hasNext()) dossierPhotos = d.next();
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

// ████ Documents.gs ████
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

// ████ Dossiers.gs ████
// ══════════════════════════════════════════════════════════
// RANGEMENT DRIVE (lot 1.5)
// - Un seul endroit pour les noms de dossiers : le fichier « dossiers.json » à la racine du Drive de l'appli
//   (créé automatiquement avec les valeurs ci-dessous ; Franck peut le modifier, il est relu au bout de 10 min).
// - Le dossier de chaque chantier est retenu dans l'onglet « Dossiers chantiers » (nom du chantier → identifiant Drive).
//   Plus de recherche « approximative » silencieuse : une ressemblance n'est utilisée que si elle est unique,
//   et elle est notée « à vérifier » dans cet onglet.
// - Migration des documents déjà produits par l'appli : planMigration() (ne déplace rien) puis executerMigration().
// ══════════════════════════════════════════════════════════
const SHEET_DOSSIERS = 'Dossiers chantiers';
const SHEET_MIGRATION = 'Migration (lot 1)';
const NOM_FICHIER_DOSSIERS = 'dossiers.json';

const DOSSIERS_DEFAUT = {
  version: 1,
  aide: 'Noms des dossiers utilisés par Loué App (et plus tard par les skills). Séparateur « / ». ' +
        'Modifier seulement les noms entre guillemets à droite, puis attendre 10 minutes.',
  // Dans le dossier de chaque chantier
  documents: {
    'cotes':               '05 - CHANTIER/PRISE DE COTES',
    'fabrication':         '07 - ATELIER',
    'note':                '05 - CHANTIER/COMPTE RENDU',
    'quitus':              '05 - CHANTIER/OPR - RESERVES - QUITUS',
    'attestation':         '05 - CHANTIER/OPR - RESERVES - QUITUS',
    'reception-support':   '05 - CHANTIER/OPR - RESERVES - QUITUS',
    'bordereau-orga':      '05 - CHANTIER/ORGANIGRAMME',
    'bordereau-materiaux': '05 - CHANTIER/BORDEREAUX MATERIAUX',
    'photos':              '05 - CHANTIER/PHOTOS CHANTIER',
    'carnet':              'CARNET',
    'plans':               'Plans',
  },
  // À la racine du Drive de l'appli (hors chantier)
  hors_chantier: {
    'absence': 'ADMINISTRATIF/ABSENCES',
  },
  // Début du nom des fichiers : « <INTITULÉ> <CHANTIER> <AAAA-MM-JJ>[_Vn].pdf »
  intitules: {
    'cotes': 'PRISE DE COTES', 'fabrication': 'FICHE FABRICATION', 'note': 'COMPTE RENDU',
    'quitus': 'QUITUS', 'attestation': 'ATTESTATION', 'reception-support': 'RECEPTION SUPPORT',
    'bordereau-orga': 'BORDEREAU ORGANIGRAMME', 'bordereau-materiaux': 'BORDEREAU MATERIAUX', 'absence': 'ABSENCE',
  },
};

// Dossiers de la racine qui ne sont pas des chantiers
function estDossierTechnique_(dossier) {
  const nom = String(dossier.getName()).trim().toLowerCase();
  if (nom.charAt(0) === '_' || nom === 'dossier base' || nom === 'administratif') return true;
  try { return dossier.getId() === drivePlanningId_(); } catch (e) { return false; }
}

// ── dossiers.json : lu dans Drive (créé s'il manque), gardé 10 min en cache ──
function dossiers_() {
  const cache = CacheService.getScriptCache();
  const enCache = cache.get('dossiers.json');
  if (enCache) { try { return JSON.parse(enCache); } catch (e) {} }
  let conf = DOSSIERS_DEFAUT;
  try {
    const racine = DriveApp.getFolderById(driveRootId_());
    const fichiers = racine.getFilesByName(NOM_FICHIER_DOSSIERS);
    if (fichiers.hasNext()) {
      const lu = JSON.parse(fichiers.next().getBlob().getDataAsString());
      // Valeurs du fichier par-dessus les valeurs par défaut : une clé oubliée ne casse rien
      conf = {
        version: lu.version || 1,
        documents: Object.assign({}, DOSSIERS_DEFAUT.documents, lu.documents || {}),
        hors_chantier: Object.assign({}, DOSSIERS_DEFAUT.hors_chantier, lu.hors_chantier || {}),
        intitules: Object.assign({}, DOSSIERS_DEFAUT.intitules, lu.intitules || {}),
      };
    } else {
      racine.createFile(NOM_FICHIER_DOSSIERS, JSON.stringify(DOSSIERS_DEFAUT, null, 2), 'application/json');
    }
  } catch (err) {
    // Fichier illisible (virgule oubliée…) : on range avec les valeurs par défaut et on prévient Franck
    console.error('dossiers.json :', err.message);
    alerterFranck_('dossiers.json illisible', 'Le fichier dossiers.json du Drive de l’appli est illisible (' + err.message +
      '). Les documents sont rangés avec les noms par défaut en attendant. Lancez verifierConfig() pour le détail.');
  }
  try { cache.put('dossiers.json', JSON.stringify(conf), 600); } catch (e) {}
  return conf;
}

// Une alerte de ce type par jour au maximum (le fichier est relu toutes les 10 min)
function alerterFranck_(cle, texte) {
  const props = PropertiesService.getScriptProperties();
  const marque = 'ALERTE_' + cle + '_' + jour_();
  if (props.getProperty(marque)) return;
  props.setProperty(marque, '1');
  try { GmailApp.sendEmail(emailAdmin_(), '[Loué App] ' + cle, texte); } catch (e) { console.error('alerte :', e.message); }
}

// Sous-dossier « A/B/C » (créé s'il manque quand creer = true)
function dossierParChemin_(parent, chemin, creer) {
  let d = parent;
  const morceaux = String(chemin || '').split('/').map(s => s.trim()).filter(Boolean);
  for (let i = 0; i < morceaux.length; i++) {
    const it = d.getFoldersByName(morceaux[i]);
    let trouve = null;
    while (it.hasNext()) { const x = it.next(); if (!x.isTrashed()) { trouve = x; break; } }
    if (!trouve) {
      if (!creer) return null;
      trouve = d.createFolder(morceaux[i]);
    }
    d = trouve;
  }
  return d;
}

// ── Dossier d'un chantier ──
function lignesDossiers_() {
  return feuille_(SHEET_DOSSIERS, ['Chantier', 'Dossier Drive', 'Identifiant du dossier', 'Trouvé par', 'À vérifier'])
    .getDataRange().getValues();
}
function cleChantier_(nom) { return String(nom || '').trim().toLowerCase(); }
function noterDossierChantier_(chantier, dossier, trouvePar) {
  const sh = feuille_(SHEET_DOSSIERS, ['Chantier', 'Dossier Drive', 'Identifiant du dossier', 'Trouvé par', 'À vérifier']);
  sh.appendRow([cellule_(String(chantier).trim()), cellule_(dossier.getName()), dossier.getId(), trouvePar,
    trouvePar === 'ressemblance' ? 'OUI — vérifiez que c’est le bon dossier' : '']);
}
// Ressemblance : le nom du dossier contient celui du chantier (ou l'inverse). Utilisée seulement si UNIQUE.
function ressemblances_(racine, nom) {
  const cle = cleChantier_(nom), trouves = [];
  const it = racine.getFolders();
  while (it.hasNext()) {
    const f = it.next();
    if (f.isTrashed() || estDossierTechnique_(f)) continue;
    const n = cleChantier_(f.getName());
    if (n && n !== cle && (n.indexOf(cle) > -1 || cle.indexOf(n) > -1)) trouves.push(f);
  }
  return trouves;
}
// creer = false : lecture seule (tuile Chantiers) ; renvoie null si rien
function dossierChantier_(chantierNom, creer) {
  const nom = String(chantierNom || '').trim() || 'DIVERS';
  const racine = DriveApp.getFolderById(driveRootId_());
  // 1. Onglet « Dossiers chantiers »
  const lignes = lignesDossiers_();
  for (let i = 1; i < lignes.length; i++) {
    if (cleChantier_(lignes[i][0]) !== cleChantier_(nom) || !lignes[i][2]) continue;
    try { const d = DriveApp.getFolderById(String(lignes[i][2])); if (!d.isTrashed()) return d; } catch (e) {}
  }
  // 2. Dossier portant exactement le nom du chantier
  const exacts = racine.getFoldersByName(nom);
  while (exacts.hasNext()) {
    const d = exacts.next();
    if (!d.isTrashed()) { if (creer) noterDossierChantier_(nom, d, 'nom exact'); return d; }
  }
  // 3. Une seule ressemblance : utilisée, mais notée « à vérifier »
  const proches = ressemblances_(racine, nom);
  if (proches.length === 1) { if (creer) noterDossierChantier_(nom, proches[0], 'ressemblance'); return proches[0]; }
  if (!creer) return null;
  // 4. Nouveau dossier (plusieurs ressemblances : on ne devine pas)
  const d = racine.createFolder(nom);
  dossierParChemin_(d, dossiers_().documents.plans, true);   // « Plans » : le dossier que Franck remplit pour les gars
  noterDossierChantier_(nom, d, proches.length ? 'créé (plusieurs dossiers ressemblants)' : 'créé');
  return d;
}

// ── Nom des fichiers : « <INTITULÉ> <CHANTIER>[ <complément>] <AAAA-MM-JJ>[_Vn].pdf » ──
function dateIso_(texte) {
  const m = String(texte || '').match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  const iso = String(texte || '').match(/(\d{4})-(\d{2})-(\d{2})/);
  return iso ? iso[0] : jour_();
}
function nomDocument_(type, chantier, complement, dateTexte) {
  const intitule = dossiers_().intitules[type] || String(type).toUpperCase();
  const morceaux = [intitule, String(chantier || '').trim(), String(complement || '').trim(), dateIso_(dateTexte)].filter(Boolean);
  return nomFichier_(morceaux.join(' ').replace(/[\\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' '));
}
// Ne jamais écraser : « _V2 », « _V3 »… si le nom existe déjà dans le dossier
function nomLibre_(dossier, base) {
  let nom = base + '.pdf';
  for (let n = 2; dossier.getFilesByName(nom).hasNext() && n < 100; n++) nom = base + '_V' + n + '.pdf';
  return nom;
}

// ── Classement d'un document produit par l'appli ──
// type : clé de DOSSIERS_DEFAUT.documents (ou hors_chantier) ; blob : le PDF ; complement : série, précision…
// Renvoie le fichier créé (ou null : le classement ne doit jamais faire échouer l'envoi des mails)
function classerDocument_(type, blob, chantier, dateTexte, complement) {
  try {
    const conf = dossiers_();
    let dossier;
    if (conf.hors_chantier[type]) {
      dossier = dossierParChemin_(DriveApp.getFolderById(driveRootId_()), conf.hors_chantier[type], true);
    } else {
      dossier = dossierParChemin_(dossierChantier_(chantier, true), conf.documents[type] || 'Divers', true);
    }
    const nom = nomLibre_(dossier, nomDocument_(type, conf.hors_chantier[type] ? '' : chantier, complement, dateTexte));
    return dossier.createFile(blob.copyBlob().setName(nom));
  } catch (err) {
    console.error('classerDocument_ (' + type + ') :', err.message);
    return null;
  }
}

// ══════════════════════════════════════════════════════════
// MIGRATION des documents déjà produits par l'appli (anciens sous-dossiers → nouveaux)
// Seuls ces dossiers sont concernés ; Plans, QT/Tableau, CCTP, Sécurité, Accès ne bougent pas (lot 4).
// Les fichiers gardent leur nom et leur lien (déplacement, pas copie) ; rien n'est jamais écrasé ni supprimé.
// ══════════════════════════════════════════════════════════
const ANCIENS_DOSSIERS = [
  { nom: 'Fiches',               regles: [[/^cotes[_ ]/i, 'cotes'], [/^fab[_ ]/i, 'fabrication']] },
  { nom: 'Note/Réunion/Réunion', regles: [[/./, 'note']] },
  { nom: 'Quitus',               regles: [[/^quitus/i, 'quitus'], [/^bordereau[_ ]orga/i, 'bordereau-orga'], [/^bordereau[_ ]mat/i, 'bordereau-materiaux']] },
  { nom: 'Bordereaux',           regles: [[/^bordereau[_ ]orga/i, 'bordereau-orga'], [/^bordereau[_ ]mat/i, 'bordereau-materiaux']] },
  { nom: 'Réceptions Support',   regles: [[/./, 'reception-support']] },
  { nom: 'Attestations',         regles: [[/./, 'attestation']] },
];
const ENTETES_MIGRATION = ['Dossier chantier', 'Ancien dossier', 'Fichier', 'Identifiant du fichier', 'Type', 'Nouveau dossier', 'Action', 'État', 'Date'];

// 1) Liste ce qui serait déplacé, SANS RIEN DÉPLACER, dans l'onglet « Migration (lot 1) ».
//    Remplit aussi « Dossiers chantiers » pour les chantiers du Sheet. Peut être relancée sans risque.
function planMigration() {
  const debut = Date.now();
  const conf = dossiers_();
  const racine = DriveApp.getFolderById(driveRootId_());
  const lignes = [];
  let aTrier = 0, aDeplacer = 0, coupe = false;

  const it = racine.getFolders();
  while (it.hasNext()) {
    if (Date.now() - debut > DUREE_MAX_MS) { coupe = true; break; }
    const chantier = it.next();
    if (chantier.isTrashed() || estDossierTechnique_(chantier)) continue;
    ANCIENS_DOSSIERS.forEach(ancien => {
      const sous = chantier.getFoldersByName(ancien.nom);
      while (sous.hasNext()) {
        const dossier = sous.next();
        if (dossier.isTrashed()) continue;
        const fichiers = dossier.getFiles();
        while (fichiers.hasNext()) {
          const f = fichiers.next();
          if (f.isTrashed()) continue;
          const regle = ancien.regles.find(r => r[0].test(f.getName()));
          const type = regle ? regle[1] : '';
          if (type) aDeplacer++; else aTrier++;
          lignes.push([chantier.getName(), ancien.nom, f.getName(), f.getId(), type,
            type ? conf.documents[type] : '', type ? 'DÉPLACER' : 'À TRIER À LA MAIN', '', '']);
        }
      }
    });
  }
  const sh = feuille_(SHEET_MIGRATION, ENTETES_MIGRATION);
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, ENTETES_MIGRATION.length).clearContent();
  if (lignes.length) sh.getRange(2, 1, lignes.length, ENTETES_MIGRATION.length).setValues(lignes.map(l => l.map(cellule_)));

  // Dossier retenu pour chaque chantier du Sheet (sans rien créer)
  const dejaNotes = {};
  lignesDossiers_().slice(1).forEach(l => { if (l[2]) dejaNotes[cleChantier_(l[0])] = true; });
  const shC = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CHANTIERS);
  const sansDossier = [];
  (shC ? shC.getDataRange().getValues().slice(1) : []).forEach(l => {
    const nom = String(l[0] || '').trim();
    if (!nom || dejaNotes[cleChantier_(nom)]) return;
    const exact = racine.getFoldersByName(nom);
    if (exact.hasNext()) { noterDossierChantier_(nom, exact.next(), 'nom exact'); return; }
    const proches = ressemblances_(racine, nom);
    if (proches.length === 1) noterDossierChantier_(nom, proches[0], 'ressemblance');
    else sansDossier.push(nom + (proches.length ? ' (' + proches.length + ' dossiers ressemblants)' : ''));
  });

  const bilan = [
    'Plan de migration écrit dans l’onglet « ' + SHEET_MIGRATION + ' » (rien n’a été déplacé).',
    aDeplacer + ' document(s) à déplacer, ' + aTrier + ' à trier à la main (ils restent où ils sont).',
    'Vérifiez l’onglet « ' + SHEET_DOSSIERS + ' » : les lignes « À vérifier » doivent désigner le bon dossier (sinon corrigez l’identifiant ou supprimez la ligne).',
    sansDossier.length ? 'Chantiers sans dossier Drive (un dossier sera créé au premier document) : ' + sansDossier.join(', ') : 'Tous les chantiers du Sheet ont un dossier.',
    'Pour ne pas déplacer un document : remplacez « DÉPLACER » par « IGNORER » dans la colonne Action.',
    coupe ? '⚠ Arrêt avant la limite de temps de Google : relancez planMigration().' : 'Ensuite : executerMigration().',
  ].join('\n');
  Logger.log(bilan);
  return bilan;
}

// 2) Déplace les documents marqués « DÉPLACER » (et pas encore faits). Relancer tant qu'il en reste.
function executerMigration() {
  const verrou = LockService.getScriptLock();
  if (!verrou.tryLock(30000)) { Logger.log('Une autre opération est en cours : relancez dans une minute.'); return 'occupé'; }
  try {
    const debut = Date.now();
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_MIGRATION);
    if (!sh || sh.getLastRow() < 2) { Logger.log('Lancez d’abord planMigration().'); return 'pas de plan'; }
    const racine = DriveApp.getFolderById(driveRootId_());
    const lignes = sh.getRange(2, 1, sh.getLastRow() - 1, ENTETES_MIGRATION.length).getValues();
    let faits = 0, problemes = 0, restants = 0;
    for (let i = 0; i < lignes.length; i++) {
      const l = lignes[i];
      if (String(l[6]).trim().toUpperCase() !== 'DÉPLACER' || l[7]) continue;
      if (Date.now() - debut > DUREE_MAX_MS) { restants++; continue; }
      let etat;
      try {
        const f = DriveApp.getFileById(String(l[3]));
        // Toujours dans l'ancien dossier ? (sinon quelqu'un l'a déjà rangé : on n'y touche pas)
        const parents = f.getParents();
        let ancien = null;
        while (parents.hasNext()) { const p = parents.next(); if (p.getName() === l[1]) ancien = p; }
        if (f.isTrashed()) etat = 'à la corbeille : ignoré';
        else if (!ancien) etat = 'plus dans « ' + l[1] + ' » : ignoré';
        else {
          const chantier = ancien.getParents().hasNext() ? ancien.getParents().next() : racine;
          const dest = dossierParChemin_(chantier, String(l[5]), true);
          f.moveTo(dest);   // même fichier, même lien ; Drive accepte deux fichiers du même nom : rien n'est écrasé
          etat = 'déplacé';
          faits++;
        }
      } catch (err) { etat = 'erreur : ' + err.message; problemes++; }
      sh.getRange(i + 2, 8, 1, 2).setValues([[etat, new Date()]]);
    }
    const bilan = faits + ' document(s) déplacé(s), ' + problemes + ' erreur(s).' +
      (restants ? ' Il en reste ' + restants + ' : relancez executerMigration().' : ' Migration terminée.') +
      ' Les anciens dossiers vides restent en place (rien n’est supprimé).';
    Logger.log(bilan);
    return bilan;
  } finally { verrou.releaseLock(); }
}

// Contrôle pour verifierConfig()
function verifierDossiers_() {
  try {
    CacheService.getScriptCache().remove('dossiers.json');
    const racine = DriveApp.getFolderById(driveRootId_());
    const f = racine.getFilesByName(NOM_FICHIER_DOSSIERS);
    if (!f.hasNext()) { dossiers_(); return '✅ dossiers.json créé avec les noms par défaut'; }
    JSON.parse(f.next().getBlob().getDataAsString());
    const aVerifier = lignesDossiers_().slice(1).filter(l => String(l[4] || '').indexOf('OUI') === 0).length;
    return '✅ dossiers.json lisible' + (aVerifier ? ' — ⚠ ' + aVerifier + ' dossier(s) chantier « à vérifier » (onglet ' + SHEET_DOSSIERS + ')' : '');
  } catch (err) {
    return '❌ dossiers.json illisible : ' + err.message + ' (vérifiez les guillemets et les virgules)';
  }
}

// ████ Admin.gs ████
// ═══════════════════════════════════════════════════════════════
// Loué App — Admin.gs : tâches à lancer dans l'éditeur (déclencheurs, vérification, partages, copie TEST)
// Les fichiers .gs du projet partagent les mêmes constantes et fonctions.
// ═══════════════════════════════════════════════════════════════

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
        const besoin = 1 + (bcc ? decouperAdresses_(bcc).length || 1 : 0);
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
    // Photos de fiches jamais terminées : à la corbeille au bout de 7 jours
    try {
      const enCours = dossierPhotosEnCours_(false);
      if (enCours) {
        const limite = Date.now() - 7 * 24 * 3600 * 1000;
        const it = enCours.getFolders();
        while (it.hasNext()) { const d = it.next(); if (d.getDateCreated().getTime() < limite) d.setTrashed(true); }
      }
    } catch (e) { console.error('nettoyage photos :', e.message); }
    // Nettoyage des compteurs des jours passés
    const props = PropertiesService.getScriptProperties();
    const aujourdhui = jour_();
    props.getKeys().forEach(k => {
      if (/^(LIBRES|PHOTOS|ALERTE_[A-Z]+)_\d{4}-\d{2}-\d{2}$/.test(k) && k.slice(-10) < aujourdhui) props.deleteProperty(k);
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
  lignes.push(verifierDossiers_());   // lot 1.5 : fichier des noms de dossiers
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
      const morceaux = chemin.split(' › ');
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
  const SEP = ' › ';   // et non « / », qui apparaît dans certains noms de chantiers
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
    cache[traverses[k]] = base ? base + SEP + noms.slice(k + 1).reverse().join(SEP) : '';
  }
  return base ? base + SEP + noms.reverse().join(SEP) : '';
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

// Secours : si l'onglet a été perdu et réimporté depuis la sauvegarde CSV (colonne État vide),
// remet le partage d'origine de TOUTES les lignes « à retirer », quel que soit leur état.
function remettreDepuisSauvegarde() {
  return modifierPartages_(r => String(r[7]).indexOf('remis') !== 0,
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

// ████ Modeles.gs ████
// ═══════════════════════════════════════════════════════════════
// FICHIER GÉNÉRÉ AUTOMATIQUEMENT — NE PAS MODIFIER À LA MAIN
// Copie des modèles de PDF du dossier modeles/ (node outils/construire.js).
// Pour changer un PDF : modifier modeles/<document>.js, relancer la commande, recoller ce fichier.
// ═══════════════════════════════════════════════════════════════

// ── modeles/attestation.js ──
// ═══════════════════════════════════════════════════════════════
// MODÈLE UNIQUE du PDF « Attestation » (mise en œuvre, levée d'observations, contrôle DAS, autre)
// Utilisé tel quel par la page (aperçu, impression sur PC) ET par le serveur (PDF envoyé par mail) :
// apps-script/Modeles.gs est une COPIE générée par « node outils/construire.js » — ne jamais la modifier à la main.
// Règles : tableaux et styles en ligne seulement (le convertisseur PDF de Google ne connaît ni flex ni grid),
// pas de backticks imbriqués, tout texte saisi passe par esc().
// d : données de la fiche (textes bruts ; images déjà contrôlées) ; esc : fonction d'échappement
// d.qualite (fonction du signataire) : calculée par la page pour l'aperçu, par le serveur pour le PDF envoyé.
// ═══════════════════════════════════════════════════════════════
function modele_attestation(d, esc) {
  var type = d.typeAttest || '';
  var titres = {
    'mise-oeuvre': 'Attestation de mise en œuvre',
    'levee-obs': 'Attestation de levée d’observations',
    'das': 'Attestation de contrôle — Bloc porte DAS',
  };
  var titre = titres[type] || d.typeLabel || 'Attestation';
  var couleur = { 'mise-oeuvre': '#1A6B3B', 'levee-obs': '#B32E2E', 'das': '#1A2B4A', 'autre': '#6B3FA0' }[type] || '#6B3FA0';
  var chantier = (d.chantier || '—') + (d.precision ? ' — ' + d.precision : '');
  var photos = (d.photos || []).filter(function (p) { return p && p.data; });
  var CASE = 'padding:6px 8px;border:1px solid #D8D4CE;';
  var ETIQ = CASE + 'background:#FAFAF8;font-size:9px;font-weight:700;text-transform:uppercase;color:#6A6460;width:35%';

  function ligne(etiquette, valeur, gras) {
    return '<tr><td style="' + ETIQ + '">' + etiquette + '</td><td style="' + CASE + (gras ? 'font-weight:700;' : '') + '">' + esc(valeur || '—') + '</td></tr>';
  }

  // ── Corps : points de contrôle DAS, ou objet de l'attestation ──
  var corps = '';
  if (type === 'das') {
    var points = d.dasPoints || [];
    var nb = function (s) { return points.filter(function (p) { return p && p.state === s; }).length; };
    var lignes = points.map(function (p, i) {
      var s = p.state;
      var cl = s === 'ok' ? '#196B3B' : s === 'nc' ? '#B32E2E' : s === 'so' ? '#888888' : '#999999';
      var lb = s === 'ok' ? '✓ OK' : s === 'nc' ? '✗ N.C.' : s === 'so' ? '— S.O.' : '—';
      return '<tr style="background:' + (i % 2 === 0 ? 'white' : '#FAFAF8') + '">'
        + '<td style="' + CASE + 'font-size:10px">' + esc(p.label || '') + '</td>'
        + '<td style="' + CASE + 'font-size:10px;font-weight:700;color:' + cl + ';text-align:center;width:25%">' + lb + '</td></tr>';
    }).join('');
    var nc = nb('nc');
    corps = '<table style="width:100%;border-collapse:collapse;margin-bottom:10px">'
      + ligne('N° Bloc porte', d.dasNumero, true) + ligne('Étage / Niveau', d.dasEtage)
      + ligne('Localisation', d.dasLocalisation) + ligne('Asservissement(s)', d.asservissements)
      + '</table>'
      + '<table style="width:100%;border-collapse:collapse;margin-bottom:10px"><thead><tr>'
      + '<th style="padding:6px 8px;background:#1A2B4A;color:white;font-size:9px;text-align:left">Point de contrôle</th>'
      + '<th style="padding:6px 8px;background:#1A2B4A;color:white;font-size:9px;text-align:center;width:25%">Résultat</th>'
      + '</tr></thead><tbody>' + lignes + '</tbody></table>'
      + '<div style="padding:7px 10px;background:' + (nc ? '#FAE8E8' : '#E1F2E9') + ';border:1px solid ' + (nc ? '#B32E2E' : '#196B3B')
      + ';border-radius:4px;font-size:10px;font-weight:700;color:' + (nc ? '#B32E2E' : '#196B3B') + ';margin-bottom:10px">'
      + 'Bilan : ' + nb('ok') + ' conforme(s) · ' + nc + ' non conforme(s) · ' + nb('so') + ' sans objet</div>';
  } else {
    corps = '<div style="padding:10px 12px;background:#F7F5F1;border:1px solid #D8D4CE;border-radius:4px;margin-bottom:12px">'
      + '<div style="font-size:8px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:4px">Objet</div>'
      + '<div style="font-size:11px;line-height:1.7;white-space:pre-wrap;word-break:break-word;overflow-wrap:break-word">' + esc(d.objet || '—') + '</div></div>';
  }

  // ── Photos : toutes, deux par ligne (avant la refonte, le PDF envoyé n'en gardait que deux) ──
  var photosHtml = '';
  if (photos.length) {
    var haut = photos.length === 1 ? '90mm' : '68mm';
    var img = function (p) {
      return '<img src="data:' + (p.mimeType || p.mime || 'image/jpeg') + ';base64,' + p.data + '" style="max-width:100%;max-height:' + haut + ';border:1px solid #ddd;">';
    };
    var rangs = '';
    for (var i = 0; i < photos.length; i += 2) {
      var deux = photos[i + 1];
      rangs += '<table style="width:100%;border-collapse:collapse;page-break-inside:avoid"><tr>'
        + '<td style="width:' + (photos.length === 1 ? '100%' : '50%') + ';padding:4px;text-align:center;vertical-align:top">' + img(photos[i]) + '</td>'
        + (photos.length === 1 ? '' : '<td style="width:50%;padding:4px;text-align:center;vertical-align:top">' + (deux ? img(deux) : '') + '</td>')
        + '</tr></table>';
    }
    photosHtml = '<div style="margin-top:10px">'
      + '<div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:6px;border-bottom:2px solid ' + couleur + ';padding-bottom:3px">Photo' + (photos.length > 1 ? 's' : '') + '</div>'
      + rangs + '</div>';
  }

  var qualite = d.qualite ? ', en qualité de ' + esc(d.qualite) : '';
  return '<html><head><meta charset="utf-8"><style>@page{size:A4;margin:1.5cm}body{font-family:Arial,sans-serif;font-size:10px;margin:0;color:#1A1A1A}*{box-sizing:border-box}</style></head><body>'
    + '<div style="border-bottom:3px solid ' + couleur + ';padding-bottom:10px;margin-bottom:14px">'
    + '<table style="width:100%;border-collapse:collapse"><tr>'
    + '<td style="vertical-align:top"><div style="font-weight:800;font-size:16px;color:#1A2B4A">Loué Menuiserie</div>'
    + '<div style="font-size:9px;color:#6A6460">Menuiserie · Charpente · Agencement</div></td>'
    + '<td style="text-align:right;vertical-align:top;white-space:nowrap">'
    + '<div style="font-size:8px;font-weight:700;text-transform:uppercase;color:#6A6460;letter-spacing:.4px">Date</div>'
    + '<div style="font-size:17px;font-weight:800;color:#1A1A1A">' + esc(d.date || '—') + '</div>'
    + (d.ref ? '<div style="font-size:9px;color:#6A6460;margin-top:4px">Réf : ' + esc(d.ref) + '</div>' : '')
    + '</td></tr></table>'
    + '<div style="text-align:center;font-weight:900;font-size:22px;color:' + couleur + ';letter-spacing:.5px;line-height:1.15;margin-top:12px">' + esc(titre.toUpperCase()) + '</div>'
    + '</div>'
    + '<table style="width:100%;border-collapse:collapse;margin-bottom:12px">'
    + ligne('Chantier', chantier, true)
    + '</table>'
    + '<div style="margin:0 0 12px;font-size:12px;line-height:1.55">Je soussigné <strong>' + esc(d.signataire || '—') + '</strong>' + qualite + ', certifie que&nbsp;:</div>'
    + corps
    + photosHtml
    + '<table style="width:100%;border-collapse:collapse;margin-top:14px;page-break-inside:avoid"><tr>'
    + '<td style="width:50%;padding-right:8px;vertical-align:top">'
    + '<div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:4px">Signature</div>'
    + '<div style="border:1px solid #D8D4CE;border-radius:4px;height:80px;background:#FAFAF8;text-align:center;padding:4px">'
    + (d.signature ? '<img src="' + d.signature + '" style="max-width:100%;max-height:72px;">' : '') + '</div>'
    + '<div style="font-size:9px;color:#6A6460;margin-top:3px">' + esc(d.signataire || '') + ' — ' + esc(d.date || '') + '</div>'
    + '</td><td style="width:50%"></td></tr></table>'
    + '</body></html>';
}

// ── modeles/bordereau.js ──
// ═══════════════════════════════════════════════════════════════
// MODÈLE UNIQUE du PDF « Bordereau de remise » (organigramme ou matériaux)
// Utilisé tel quel par la page (aperçu, impression sur PC) ET par le serveur (PDF envoyé par mail) :
// apps-script/Modeles.gs est une COPIE générée par « node outils/construire.js » — ne jamais la modifier à la main.
// Règles : tableaux et styles en ligne seulement, pas de backticks imbriqués, tout texte saisi passe par esc().
// d : données de la fiche (d.type = 'bordereau-orga' ou 'bordereau-materiaux') ; esc : fonction d'échappement
// ═══════════════════════════════════════════════════════════════
function modele_bordereau(d, esc) {
  var orga = d.type === 'bordereau-orga';
  var titre = orga ? 'BORDEREAU DE REMISE — ORGANIGRAMME' : 'BORDEREAU DE REMISE — MATÉRIAUX';
  var photos = (d.photosBase64 || []).filter(function (p) { return p && p.data; });

  function img(p, hauteur) {
    return '<img src="data:' + (p.mimeType || 'image/jpeg') + ';base64,' + p.data + '" style="max-width:100%;max-height:' + hauteur + ';display:block;margin:0 auto;">';
  }
  function legende(p) { return p.label ? '<div style="font-size:9px;margin-top:3px;color:#6A6460">' + esc(p.label) + '</div>' : ''; }
  var photosHtml = '';
  if (photos.length === 1) {
    photosHtml = '<div style="margin-top:10px;border:1px solid #D8D4CE;border-radius:5px;overflow:hidden">'
      + '<div style="background:#FAFAF8;padding:5px 10px;border-bottom:1px solid #D8D4CE;font-size:9px;font-weight:700;color:#7A4200">Photo'
      + (photos[0].label ? ' — ' + esc(photos[0].label) : '') + '</div>'
      + '<div style="padding:8px;text-align:center">' + img(photos[0], '100mm') + '</div></div>';
  } else {
    for (var i = 0; i < photos.length; i += 2) {
      var p2 = photos[i + 1];
      var cellule2 = p2 ? '<td style="width:50%;padding-left:6px;text-align:center">' + img(p2, '110mm') + legende(p2) + '</td>' : '<td></td>';
      photosHtml += '<div style="page-break-before:always;padding:10px">'
        + '<div style="font-size:9px;font-weight:700;color:#7A4200;margin-bottom:6px;border-bottom:2px solid #C8860A;padding-bottom:3px">Photos ' + (i + 1) + (p2 ? ' & ' + (i + 2) : '') + '</div>'
        + '<table style="width:100%;border-collapse:collapse"><tr>'
        + '<td style="width:50%;padding-right:6px;text-align:center">' + img(photos[i], '110mm') + legende(photos[i]) + '</td>' + cellule2
        + '</tr></table></div>';
    }
  }
  function signature(titreSig, src) {
    return '<td style="width:50%;padding:0 4px;vertical-align:top">'
      + '<div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:4px">' + titreSig + '</div>'
      + '<div style="border:1px solid #D8D4CE;border-radius:4px;height:80px;background:#FAFAF8;text-align:center;padding:4px">'
      + (src ? '<img src="' + src + '" style="max-width:100%;max-height:72px;">' : '') + '</div></td>';
  }
  var mention = orga
    ? '<div style="margin-top:12px;padding:10px 12px;background:#FFF0F0;border:1.5px solid #EFC0C0;border-radius:5px;font-size:10px;color:#B32E2E;line-height:1.7">'
      + '<strong>Le preneur est informé qu’en cas de perte d’un passe général, l’ensemble de l’organigramme est à refaire. Les frais sont supportés par le preneur de la clé.</strong><br>'
      + 'En cas de perte d’une clé, un forfait de refabrication de <strong>100 € HT</strong> sera facturé au preneur en plus du prix de la clé ou du cylindre complet.</div>'
    : '';
  var preneur = '<strong>' + esc(d.preneur || '—') + '</strong>' + (d.fonction ? ' (' + esc(d.fonction) + ')' : '') + (d.entreprise ? ' — ' + esc(d.entreprise) : '');
  var commentaires = d.commentaires ? '<br><span style="color:#6A6460;word-break:break-word;white-space:pre-wrap">' + esc(d.commentaires) + '</span>' : '';

  return '<html><head><meta charset="utf-8"><style>@page{size:A4;margin:1.5cm}body{font-family:Arial,sans-serif;font-size:10px;margin:0}*{box-sizing:border-box}</style></head><body>'
    + '<table style="width:100%;border-collapse:collapse;margin-bottom:14px;border-bottom:3px solid #7A4200;padding-bottom:10px"><tr>'
    + '<td style="vertical-align:middle;width:40%"><div style="font-weight:800;font-size:16px;color:#1A2B4A">Loué Menuiserie</div>'
    + '<div style="font-size:9px;color:#6A6460">Menuiserie · Charpente · Agencement</div></td>'
    + '<td style="vertical-align:middle;text-align:center;width:40%"><div style="font-weight:800;font-size:13px;color:#7A4200">' + titre + '</div>'
    + '<div style="font-size:10px;color:#6A6460;margin-top:4px">Chantier : <b>' + esc(d.chantier || '—') + '</b></div>'
    + '<div style="font-size:10px;color:#6A6460">Le ' + esc(d.date || '—') + ' à ' + esc(d.heure || '—') + '</div></td>'
    + '<td style="vertical-align:middle;text-align:right;width:20%"><div style="font-size:9px;color:#6A6460">Rédigé par</div>'
    + '<div style="font-size:10px;font-weight:700">' + esc(d.soussigne || '—') + '</div></td>'
    + '</tr></table>'
    + '<div style="padding:10px 12px;background:#FDF0D6;border:1.5px solid #C8860A;border-radius:5px;margin-bottom:10px;font-size:11px;line-height:1.9">'
    + 'Je soussigné(e) <strong>' + esc(d.soussigne || '—') + '</strong>, Entreprise Loué Menuiserie,<br>'
    + 'déclare par la présente avoir remis en main propre à ' + preneur + ' :<br>'
    + '<strong>' + esc(d.nombre || '—') + ' × ' + esc(d.typeDoc || '—') + '</strong>' + commentaires
    + '</div>'
    + photosHtml
    + '<table style="width:100%;border-collapse:collapse;margin-top:14px;page-break-inside:avoid"><tr>'
    + signature('Signature Entreprise Loué', d.sigLoue) + signature('Signature Preneur', d.sigPreneur)
    + '</tr></table>'
    + mention
    + '</body></html>';
}

// ── modeles/cotes.js ──
// ═══════════════════════════════════════════════════════════════
// MODÈLE UNIQUE du PDF « Prise de cotes — façades et placards »
// Utilisé tel quel par la page (aperçu, impression sur PC) ET par le serveur (PDF envoyé par mail) :
// apps-script/Modeles.gs est une COPIE générée par « node outils/construire.js » — ne jamais la modifier à la main.
// Règles : tableaux et styles en ligne seulement, pas de backticks imbriqués, tout texte saisi passe par esc().
// ═══════════════════════════════════════════════════════════════
function modele_cotes(d, esc) {
  var socle = d.socle === 'OUI';
  var c = 'padding:5px 4px;border:1px solid #ddd;text-align:center';
  var lignes = (d.lignes || []).map(function (l, i) {
    return '<tr style="background:' + (i % 2 === 0 ? '#F7F5F1' : 'white') + '">'
      + '<td style="padding:5px 4px;border:1px solid #ddd;font-weight:700">' + esc(l.logt || '—') + '</td>'
      + '<td style="padding:5px 4px;border:1px solid #ddd">' + esc(l.piece || '—') + '</td>'
      + '<td style="' + c + ';font-weight:700">' + esc(l.haut || '—') + '</td>'
      + '<td style="' + c + '">' + esc(l.lep || '—') + '</td>'
      + '<td style="' + c + '">' + esc(l.lhf || '—') + '</td>'
      + '<td style="' + c + ';font-weight:700">' + esc(l.long || '—') + '</td>'
      + '<td style="' + c + '">' + esc(l.prof || '—') + '</td>'
      + '<td style="' + c + '">' + esc(l.pend || '—') + '</td>'
      + '<td style="' + c + ';color:#7A4200">' + esc(l.plinthe || '—') + '</td>'
      + '<td style="' + c + ';color:#1454A0;font-weight:600">' + esc(l.sol || '—') + '</td>'
      + (socle ? '<td style="' + c + ';background:#FAE8E8;font-weight:700;color:#B32E2E">OUI</td>' : '')
      + '</tr>';
  }).join('');
  var th = function (titre, sous, gauche) {
    return '<th style="background:#1A2B4A;color:white;padding:5px 4px;font-size:9px;text-align:' + (gauche ? 'left' : 'center') + '">' + titre
      + (sous ? '<br><span style="font-weight:400;font-size:7px">' + sous + '</span>' : '') + '</th>';
  };
  // Rappel des réglages généraux (plinthe générale, type de sol) sous le titre
  var reglages = [];
  if (d.plinthMode === 'gen') reglages.push('Plinthe générale : <b>' + esc(d.plinthGen || '—') + (d.plinthGen && d.plinthGen !== 'Non posée' ? ' mm' : '') + '</b>');
  if (d.plinthMode === 'att') reglages.push('Plinthe : <b>hauteurs variables</b> (voir chaque ligne)');
  if (d.solMode) reglages.push('Hauteur de façade sur : <b>' + esc(d.solMode) + '</b>');
  var batiment = d.batiment && d.batiment !== '—' ? ' &nbsp;|&nbsp; Bâtiment : <b>' + esc(d.batiment) + '</b>' : '';

  return '<html><head><meta charset="utf-8"><style>@page{size:landscape;margin:1cm}body{font-family:Arial,sans-serif;font-size:10px;margin:0}</style></head><body>'
    + '<table style="width:100%;border-collapse:collapse;margin-bottom:10px;border-bottom:3px solid #1A2B4A;padding-bottom:8px"><tr>'
    + '<td style="border:none"><div style="font-weight:800;font-size:14px;color:#1A2B4A">Loué Menuiserie</div><div style="font-size:9px;color:#999">Menuiserie · Charpente · Agencement</div></td>'
    + '<td style="border:none;text-align:center"><div style="font-weight:800;font-size:12px;color:#1A2B4A">PRISE DE COTES — FAÇADES &amp; PLACARDS</div>'
    + '<div style="font-size:10px;color:#666;margin-top:3px">Chantier : <b>' + esc(d.chantier || '—') + '</b>' + batiment
    + ' &nbsp;|&nbsp; Par : <b>' + esc(d.auteur || '—') + '</b> &nbsp;|&nbsp; Date : <b>' + esc(d.date || '—') + '</b></div>'
    + (reglages.length ? '<div style="font-size:10px;color:#666;margin-top:3px">' + reglages.join(' &nbsp;|&nbsp; ') + '</div>' : '')
    + '</td>'
    + '<td style="border:none;text-align:right"><span style="background:' + (socle ? '#B32E2E' : '#2A5A3A') + ';color:white;padding:6px 14px;border-radius:4px;font-weight:700;font-size:13px">'
    + (socle ? 'SOCLE POSÉ' : 'PAS DE SOCLE') + '</span></td>'
    + '</tr></table>'
    + '<table style="width:100%;border-collapse:collapse"><thead><tr>'
    + th('N°', '', true) + th('Pièce', '', true) + th('Hauteur', 'Façade') + th('Larg. entre', 'Plinthes') + th('Larg. haut', 'Façade')
    + th('Longueur', 'Amén.') + th('Prof.', 'Amén.') + th('Côté', 'Penderie') + th('Haut.', 'Plinthe') + th('Sol', '')
    + (socle ? '<th style="background:#B32E2E;color:white;padding:5px 4px;font-size:9px">Socle</th>' : '')
    + '</tr></thead><tbody>' + lignes + '</tbody></table>'
    + (d.commentaires ? '<div style="margin-top:10px;padding:8px;border:1px solid #ccc;white-space:pre-wrap"><b>Commentaires :</b> ' + esc(d.commentaires) + '</div>' : '')
    + '</body></html>';
}

// ── modeles/fabrication.js ──
// ═══════════════════════════════════════════════════════════════
// MODÈLE UNIQUE du PDF « Fiche de fabrication »
// Utilisé tel quel par la page (aperçu, impression sur PC) ET par le serveur (PDF envoyé par mail) :
// apps-script/Modeles.gs est une COPIE générée par « node outils/construire.js » — ne jamais la modifier à la main.
// Règles : tableaux et styles en ligne seulement, pas de backticks imbriqués, tout texte saisi passe par esc().
// Seule exception : les commentaires mis en forme (gras, couleur, taille), filtrés par une liste blanche ci-dessous.
// ═══════════════════════════════════════════════════════════════
function modele_fabrication(d, esc) {
  // ── Commentaires : on ne garde que gras, italique, souligné, retours à la ligne, couleur et taille ──
  function nettoyerRiche(html) {
    if (typeof html !== 'string') return '';
    return html.split(/(<[^>]*>)/).map(function (morceau) {
      if (morceau.charAt(0) !== '<') return morceau.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      var m = morceau.match(/^<\s*(\/?)\s*([a-zA-Z]+)([^>]*)>$/);
      if (!m) return '';
      var ferme = m[1] === '/', balise = m[2].toLowerCase(), attributs = m[3];
      if (['b', 'strong', 'i', 'em', 'u', 'div', 'p'].indexOf(balise) > -1) return ferme ? '</' + balise + '>' : '<' + balise + '>';
      if (balise === 'br') return ferme ? '' : '<br>';
      if (balise === 'span' || balise === 'font') {
        if (ferme) return '</span>';
        var styles = [];
        var style = (attributs.match(/style\s*=\s*"([^"]*)"/i) || [])[1] || '';
        style.split(';').forEach(function (decl) {
          var i = decl.indexOf(':');
          if (i < 0) return;
          var prop = decl.slice(0, i).trim().toLowerCase(), val = decl.slice(i + 1).trim();
          if (prop === 'color' && /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i.test(val)) styles.push('color:' + val);
          if (prop === 'font-weight' && /^(bold|bolder|[1-9]00)$/i.test(val)) styles.push('font-weight:' + val);
          if (prop === 'font-size' && /^\d+(\.\d+)?(em|px|%)$/i.test(val)) styles.push('font-size:' + val);
        });
        var couleur = (attributs.match(/color\s*=\s*"?(#[0-9a-f]{3,8})"?/i) || [])[1];
        if (balise === 'font' && couleur) styles.push('color:' + couleur);
        return styles.length ? '<span style="' + styles.join(';') + '">' : '<span>';
      }
      return '';
    }).join('');
  }
  function v(x) { return esc(x === undefined || x === null || x === '' ? '—' : String(x)); }
  var etiquette = 'font-size:7.5px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:2px';

  // ── En-tête : cartouche de gauche ──
  var serieCell = d.serie
    ? '<div style="font-size:13px;font-weight:800;color:#1A2B4A">' + esc(d.serie) + '</div>'
    : '<div style="width:90px;height:22px;border:1.5px solid #1A2B4A;border-radius:3px;margin-top:2px"></div>';
  var precision = d.delaiPrecision
    ? '<div style="font-size:9.5px;font-weight:600;color:#7A4200;margin-top:2px;white-space:pre-wrap">' + esc(d.delaiPrecision) + '</div>' : '';
  var gauche = '<tr><td style="padding:5px 8px;border-bottom:1px solid #E1DCD6;border-right:1px solid #E1DCD6;width:50%">'
    + '<div style="' + etiquette + '">N° Série</div>' + serieCell + '</td>'
    + '<td style="padding:5px 8px;border-bottom:1px solid #E1DCD6;width:50%"><div style="' + etiquette + '">Date</div>'
    + '<div style="font-size:11px;font-weight:600">' + v(d.date) + '</div></td></tr>'
    + '<tr><td colspan="2" style="padding:5px 8px;border-bottom:1px solid #E1DCD6"><div style="' + etiquette + '">Chantier</div>'
    + '<div style="font-size:12px;font-weight:800;color:#1A2B4A">' + v(d.chantier) + (d.refChantier ? ' / ' + esc(d.refChantier) : '') + '</div></td></tr>'
    + '<tr><td style="padding:5px 8px;border-right:1px solid #E1DCD6;width:50%;vertical-align:top"><div style="' + etiquette + '">Responsable</div>'
    + '<div style="font-size:11px;font-weight:600">' + v(d.auteur) + '</div></td>'
    + '<td style="padding:5px 8px;width:50%;vertical-align:top"><div style="' + etiquette + '">Délai</div>'
    + '<div style="font-size:11px;font-weight:700;color:#9A5600">' + v(d.delai) + '</div>' + precision + '</td></tr>'
    + (d.zone ? '<tr><td colspan="2" style="padding:5px 8px;border-top:1px solid #E1DCD6"><div style="' + etiquette + '">Zone</div>'
      + '<div style="font-size:10px">' + esc(d.zone) + '</div></td></tr>' : '');

  var tempsRows = '';
  for (var t = 0; t < 6; t++) {
    tempsRows += '<tr><td style="padding:5px;border:1px solid #E1DCD6;min-width:65px;height:20px"></td>'
      + '<td style="padding:5px;border:1px solid #E1DCD6;width:52px;height:20px"></td>'
      + '<td style="padding:5px;border:1px solid #E1DCD6;width:52px;height:20px"></td></tr>';
  }
  var thTemps = 'padding:4px 5px;background:#1A2B4A;color:white;font-size:8px';
  var enTete = '<table style="width:100%;border-collapse:collapse;margin-bottom:10px;border-bottom:3px solid #1A2B4A;padding-bottom:8px"><tr>'
    + '<td style="width:340px;vertical-align:top;padding-right:12px"><table style="width:100%;border-collapse:collapse;border:1.5px solid #D8D4CE">' + gauche + '</table></td>'
    + '<td style="vertical-align:top;padding:0 12px">'
    + '<div style="font-weight:800;font-size:15px;color:#1A2B4A">Loué Menuiserie</div>'
    + '<div style="font-size:9px;color:#6A6460;margin-bottom:6px">Menuiserie · Charpente · Agencement</div>'
    + '<div style="font-weight:800;font-size:13px;color:#1A2B4A">FICHE DE FABRICATION</div>'
    + '<div style="margin-top:6px;font-size:10px;color:#6A6460">Chef d’atelier : <b style="color:#141210">' + v(d.chefAtelier) + '</b>'
    + ' &nbsp;·&nbsp; Conducteur : <b style="color:#141210">' + v(d.conducteur) + '</b></div></td>'
    + '<td style="width:185px;vertical-align:top"><div style="font-size:8px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:3px">Opérateurs / Temps</div>'
    + '<table style="width:100%;border-collapse:collapse;border:1.5px solid #D8D4CE;font-size:9px"><tr>'
    + '<th style="' + thTemps + ';text-align:left">Opérateur</th><th style="' + thTemps + '">Objectif</th><th style="' + thTemps + '">Réalisé</th></tr>'
    + tempsRows + '</table></td>'
    + '</tr></table>';

  // ── Blocs « Divers » et « Bloc porte » (les blocs photo sont regroupés à la fin) ──
  var LIBELLES_PORTE = { complet: 'Bloc porte complet', vantail: 'Vantail seul', huisserie: 'Huisserie seule' };
  function tableauDivers(b) {
    var c = 'padding:4px 6px;border:1px solid #E1DCD6;font-size:10px';
    var trs = b.rows.map(function (r, i) {
      return '<tr style="background:' + (i % 2 === 0 ? '#F7F5F1' : 'white') + '">'
        + '<td style="' + c + ';font-weight:700">' + v(r.repere) + '</td>'
        + '<td style="' + c + ';text-align:center;font-weight:700">' + v(r.qte) + '</td>'
        + '<td style="' + c + ';text-align:center">' + v(r.long) + '</td>'
        + '<td style="' + c + ';text-align:center">' + v(r.larg) + '</td>'
        + '<td style="' + c + ';text-align:center">' + v(r.haut) + '</td>'
        + '<td style="' + c + ';text-align:center">' + v(r.section) + '</td>'
        + '<td style="' + c + '">' + v(r.materiau) + '</td>'
        + '<td style="' + c + '">' + v(r.finition) + '</td>'
        + '<td style="' + c + '">' + v(r.quincaillerie) + '</td>'
        + '<td style="' + c + ';font-size:9px">' + esc(r.observations || '') + '</td></tr>';
    }).join('');
    function th(fond, texte, attr) { return '<th ' + (attr || '') + ' style="padding:5px 6px;background:' + fond + ';color:white;font-size:9px">' + texte + '</th>'; }
    return '<table style="width:100%;border-collapse:collapse"><thead><tr>'
      + th('#1A2B4A', 'Rep.', 'rowspan="2"') + th('#1A2B4A', 'Qté', 'rowspan="2"') + th('#203A6D', 'DIMENSIONS (mm)', 'colspan="3"')
      + th('#203A6D', 'Section', 'rowspan="2"') + th('#2A5A3A', 'Matériau', 'rowspan="2"') + th('#6B3FA0', 'Finition', 'rowspan="2"')
      + th('#6B3FA0', 'Quincaillerie', 'rowspan="2"') + th('#1A2B4A', 'Observations', 'rowspan="2"')
      + '</tr><tr>' + th('#2A4A8A', 'Long.') + th('#2A4A8A', 'Larg.') + th('#2A4A8A', 'Ép.') + '</tr></thead><tbody>' + trs + '</tbody></table>';
  }
  function tableauPorte(b) {
    var isV = b.porteType === 'vantail' || b.porteType === 'complet';
    var isH = b.porteType === 'huisserie' || b.porteType === 'complet';
    var isHS = b.porteType === 'huisserie';   // huisserie seule : cotes du vantail à recevoir + talon
    var sv = 'padding:4px 5px;background:#2A4A8A;color:white;font-size:8.5px';
    var sh = 'padding:4px 5px;background:#3A7A4A;color:white;font-size:8.5px';
    var sc = 'padding:4px 5px;background:#4A2A7A;color:white;font-size:8.5px';
    var c = 'padding:4px 5px;border:1px solid #E1DCD6;font-size:9.5px';
    var th1 = (isV ? '<th colspan="4" style="padding:5px;background:#203A6D;color:white;font-size:9px">VANTAIL</th>' : '')
      + (isH ? '<th colspan="' + (isHS ? 8 : 5) + '" style="padding:5px;background:#2A5A3A;color:white;font-size:9px">HUISSERIE</th>' : '')
      + '<th colspan="3" style="padding:5px;background:#4A2A7A;color:white;font-size:9px">FERRAGE / SERRURE</th>';
    var th2 = (isV ? '<th style="' + sv + '">Haut.</th><th style="' + sv + '">Larg.</th><th style="' + sv + '">Sens</th><th style="' + sv + '">Nature</th>' : '')
      + (isHS ? '<th style="' + sh + '">Haut. vantail</th><th style="' + sh + '">Larg. vantail</th><th style="' + sh + '">Talon</th>' : '')
      + (isH ? '<th style="' + sh + '">Support</th><th style="' + sh + '">Ép.</th><th style="' + sh + '">Sens</th><th style="' + sh + '">Feuillure</th><th style="' + sh + '">Rainure</th>' : '')
      + '<th style="' + sc + '">Ferrage</th><th style="' + sc + '">QT</th><th style="' + sc + '">Serrure</th>';
    var trs = b.rows.map(function (r, i) {
      var centre = c + ';text-align:center';
      return '<tr style="background:' + (i % 2 === 0 ? '#F7F5F1' : 'white') + '">'
        + '<td style="' + c + ';font-weight:700">' + v(r.repere) + '</td>'
        + '<td style="' + centre + ';font-weight:700">' + v(r.qt || r.qte) + '</td>'
        + (isV ? '<td style="' + centre + '">' + v(r.haut) + '</td><td style="' + centre + '">' + v(r.larg) + '</td><td style="' + c + '">' + v(r.sens) + '</td><td style="' + c + '">' + v(r.nature) + '</td>' : '')
        + (isHS ? '<td style="' + centre + '">' + v(r.hautVantail) + '</td><td style="' + centre + '">' + v(r.largVantail) + '</td><td style="' + centre + '">' + v(r.talon) + '</td>' : '')
        + (isH ? '<td style="' + c + '">' + v(r.support) + '</td><td style="' + centre + '">' + v(r.epSupport) + '</td><td style="' + c + '">' + v(r.sensH || r.sens)
          + '</td><td style="' + c + '">' + v(r.feuillure) + '</td><td style="' + centre + '">' + v(r.rainure) + '</td>' : '')
        + '<td style="' + c + '">' + v(r.ferrageType) + '</td><td style="' + centre + '">' + v(r.ferrageQt) + '</td><td style="' + c + '">' + v(r.serrure) + '</td>'
        + '</tr>';
    }).join('');
    return '<table style="width:100%;border-collapse:collapse"><thead><tr>'
      + '<th rowspan="2" style="padding:5px;background:#7A4200;color:white;font-size:9px;text-align:left">Rep.</th>'
      + '<th rowspan="2" style="padding:5px;background:#7A4200;color:white;font-size:9px">QT</th>'
      + th1 + '</tr><tr>' + th2 + '</tr></thead><tbody>' + trs + '</tbody></table>';
  }
  var blocsHtml = (d.blocs || []).map(function (b) {
    if (b.type === 'photo') return '';
    var porte = b.type === 'porte';
    var label = porte ? (LIBELLES_PORTE[b.porteType] || 'Bloc porte') : 'Divers';
    var clr = porte ? '#7A4200' : '#1A2B4A', clrBg = porte ? '#FDF0D6' : '#EBF1FA';
    var rows = b.rows || [];
    var inner = rows.length ? (porte ? tableauPorte(b) : tableauDivers(b)) : '<div style="padding:8px;color:#999;font-size:10px;font-style:italic">Bloc vide</div>';
    return '<div style="margin-bottom:12px;border:1.5px solid ' + clr + ';border-radius:5px;overflow:hidden;page-break-inside:avoid">'
      + '<div style="background:' + clrBg + ';padding:6px 10px;border-bottom:1px solid ' + clr + '">'
      + '<span style="font-weight:700;font-size:10px;color:' + clr + ';text-transform:uppercase;letter-spacing:.4px">' + label + ' — Bloc ' + esc(b.id) + '</span></div>'
      + '<div>' + inner + '</div></div>';
  }).join('');

  var commentaires = nettoyerRiche(d.commentaires);
  var commentaireSection = commentaires.replace(/<[^>]*>|&nbsp;|\s/g, '')
    ? '<div style="margin-top:10px;padding:8px 10px;background:#F7F5F1;border:1px solid #D8D4CE;border-radius:4px">'
      + '<div style="font-size:8.5px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:3px">Commentaires</div>'
      + '<div style="font-size:10px;line-height:1.5">' + commentaires + '</div></div>'
    : '';

  // ── Photos et croquis : 1 seule → sous les blocs ; 2 et plus → une par page ──
  var photos = (d.photosBase64 || []).filter(function (p) { return p && p.data; });
  var photosSection = photos.map(function (p) {
    var seule = photos.length === 1;
    var mh = seule ? '95mm' : '135mm';
    return '<div style="' + (seule ? 'margin-top:8px;page-break-inside:avoid;' : 'page-break-before:always;padding:10px;') + 'text-align:center">'
      + '<img src="data:' + (p.mimeType || 'image/jpeg') + ';base64,' + p.data + '" style="max-width:100%;max-height:' + mh + ';width:auto;height:auto;border:1px solid #ddd;display:block;margin:0 auto">'
      + (p.label ? '<div style="font-size:9px;color:#666;margin-top:3px">' + esc(p.label) + '</div>' : '')
      + '</div>';
  }).join('');

  return '<html><head><meta charset="utf-8"><style>@page{size:landscape;margin:1cm}body{font-family:Arial,sans-serif;font-size:10px;margin:0}*{box-sizing:border-box}</style></head><body>'
    + enTete + blocsHtml + commentaireSection + photosSection
    + '</body></html>';
}

// ── modeles/note.js ──
// ═══════════════════════════════════════════════════════════════
// MODÈLE UNIQUE du PDF « Note de réunion »
// Utilisé tel quel par la page (aperçu, impression sur PC) ET par le serveur (PDF envoyé par mail) :
// apps-script/Modeles.gs est une COPIE générée par « node outils/construire.js » — ne jamais la modifier à la main.
// Règles : tableaux et styles en ligne seulement (le convertisseur PDF de Google ne connaît ni flex ni grid),
// pas de backticks imbriqués, tout texte saisi passe par esc().
// d : données de la fiche (textes bruts ; images déjà contrôlées) ; esc : fonction d'échappement
// ═══════════════════════════════════════════════════════════════
function modele_note(d, esc) {
  var photos = (d.photosBase64 || []).filter(function (p) { return p && p.data; });
  var TEXTE = 'white-space:pre-wrap;word-break:break-word;overflow-wrap:break-word;';
  var ETIQ = 'font-size:7.5px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:2px';

  function src(p) { return 'data:' + (p.mimeType || p.mime || 'image/jpeg') + ';base64,' + p.data; }
  function legende(p) {
    return p.label ? '<div style="margin-top:4px;font-size:10px;color:#6A6460;' + TEXTE + '">' + esc(p.label) + '</div>' : '';
  }

  // Une seule photo : sous les notes, page 1. Deux ou plus : deux par page, à partir de la page 2.
  var photosHtml = '';
  if (photos.length === 1) {
    var p = photos[0];
    photosHtml = '<div style="margin-top:10px;border:1.5px solid #0D7A6B;border-radius:5px;overflow:hidden;page-break-inside:avoid">'
      + '<div style="background:#E0F5F2;padding:5px 10px;border-bottom:1px solid #0D7A6B;font-size:9px;font-weight:700;color:#0D7A6B;text-transform:uppercase">'
      + 'Photo / Croquis' + (p.label ? ' — <span style="text-transform:none">' + esc(p.label) + '</span>' : '') + '</div>'
      + '<div style="padding:8px;text-align:center"><img src="' + src(p) + '" style="max-width:100%;max-height:130mm;display:block;margin:0 auto;"></div></div>';
  } else {
    for (var i = 0; i < photos.length; i += 2) {
      var p1 = photos[i], p2 = photos[i + 1];
      var cellule2 = p2
        ? '<td style="width:50%;padding-left:8px;text-align:center;vertical-align:top"><img src="' + src(p2) + '" style="max-width:100%;max-height:120mm;display:block;margin:0 auto;border:1px solid #ddd;">' + legende(p2) + '</td>'
        : '<td style="width:50%"></td>';
      photosHtml += '<div style="page-break-before:always;padding:12px 10px">'
        + '<div style="font-size:9px;font-weight:700;color:#0D7A6B;margin-bottom:8px;border-bottom:2px solid #0D7A6B;padding-bottom:4px;text-transform:uppercase">'
        + 'Photos / Croquis ' + (i + 1) + (p2 ? ' &amp; ' + (i + 2) : '') + '</div>'
        + '<table style="width:100%;border-collapse:collapse"><tr>'
        + '<td style="width:50%;padding-right:8px;text-align:center;vertical-align:top"><img src="' + src(p1) + '" style="max-width:100%;max-height:120mm;display:block;margin:0 auto;border:1px solid #ddd;">' + legende(p1) + '</td>'
        + cellule2 + '</tr></table></div>';
    }
  }

  var commentaires = d.commentaires
    ? '<div style="padding:10px 12px;background:#F0F5F4;border:1.5px solid #0D7A6B;border-radius:5px;margin-bottom:10px">'
      + '<div style="font-size:8px;font-weight:700;text-transform:uppercase;color:#0D7A6B;margin-bottom:6px;letter-spacing:.5px">Notes &amp; commentaires</div>'
      + '<div style="font-size:11px;line-height:1.7;' + TEXTE + '">' + esc(d.commentaires) + '</div></div>'
    : '';

  return '<html><head><meta charset="utf-8"><style>@page{size:A4;margin:1.5cm}body{font-family:Arial,sans-serif;font-size:10px;margin:0}*{box-sizing:border-box}</style></head><body>'
    + '<table style="width:100%;border-collapse:collapse;margin-bottom:12px;border-bottom:3px solid #0D7A6B"><tr>'
    + '<td style="width:175px;vertical-align:top;padding-bottom:10px">'
    + '<table style="width:100%;border-collapse:collapse;border:1.5px solid #D8D4CE">'
    + '<tr><td style="padding:5px 8px;border-bottom:1px solid #E1DCD6"><div style="' + ETIQ + '">Date</div>'
    + '<div style="font-size:12px;font-weight:700">' + esc(d.date || '—') + '</div></td></tr>'
    + '<tr><td style="padding:5px 8px;border-bottom:1px solid #E1DCD6"><div style="' + ETIQ + '">Chantier</div>'
    + '<div style="font-size:12px;font-weight:800;color:#1A2B4A;word-break:break-word">' + esc(d.chantier || '—') + '</div></td></tr>'
    + '<tr><td style="padding:5px 8px"><div style="' + ETIQ + '">Rédigé par</div>'
    + '<div style="font-size:11px;font-weight:600">' + esc(d.auteur || '—') + '</div></td></tr>'
    + '</table></td>'
    + '<td style="vertical-align:middle;padding:0 16px 10px;text-align:center">'
    + '<div style="font-weight:800;font-size:15px;color:#1A2B4A">Loué Menuiserie</div>'
    + '<div style="font-size:9px;color:#6A6460;margin-bottom:8px">Menuiserie · Charpente · Agencement</div>'
    + '<div style="font-weight:800;font-size:14px;color:#0D7A6B">NOTE DE RÉUNION</div>'
    + (d.objet ? '<div style="margin-top:5px;font-size:11px;font-weight:600;color:#141210;' + TEXTE + '">' + esc(d.objet) + '</div>' : '')
    + '</td></tr></table>'
    + commentaires
    + photosHtml
    + '</body></html>';
}

// ── modeles/quitus.js ──
// ═══════════════════════════════════════════════════════════════
// MODÈLE UNIQUE du PDF « Quitus »
// Utilisé tel quel par la page (aperçu, impression sur PC) ET par le serveur (PDF envoyé par mail) :
// apps-script/Modeles.gs est une COPIE générée par « node outils/construire.js » — ne jamais la modifier à la main.
// Règles : tableaux et styles en ligne seulement (le convertisseur PDF de Google ne connaît ni flex ni grid),
// pas de backticks imbriqués, tout texte saisi passe par esc().
// d : données de la fiche (textes bruts ; images déjà contrôlées) ; esc : fonction d'échappement
// ═══════════════════════════════════════════════════════════════
function modele_quitus(d, esc) {
  var chantier = (d.chantier || '—') + (d.precision ? ' — ' + d.precision : '');
  var solde = d.solde || '—';
  var couleur = solde === 'OUI' ? '#196B3B' : solde === 'NON' ? '#B32E2E' : '#6A6460';
  var fond = solde === 'OUI' ? '#E1F2E9' : solde === 'NON' ? '#FAE8E8' : '#F2F0EC';
  var photos = (d.photosBase64 || []).filter(function (p) { return p && p.data; });

  function img(p, hauteur) {
    return '<img src="data:' + (p.mimeType || 'image/jpeg') + ';base64,' + p.data + '" style="max-width:100%;max-height:' + hauteur + ';display:block;margin:0 auto;">'
      + (p.label ? '<div style="font-size:9px;color:#6A6460;margin-top:3px">' + esc(p.label) + '</div>' : '');
  }
  var photosHtml = '';
  if (photos.length === 1) {
    photosHtml = '<div style="margin-top:10px;border:1px solid #D8D4CE;border-radius:5px;overflow:hidden">'
      + '<div style="background:#E1F2E9;padding:5px 10px;border-bottom:1px solid #196B3B;font-size:9px;font-weight:700;color:#196B3B">Photo</div>'
      + '<div style="padding:8px;text-align:center">' + img(photos[0], '100mm') + '</div></div>';
  } else {
    for (var i = 0; i < photos.length; i += 2) {
      var deuxieme = photos[i + 1]
        ? '<td style="width:50%;padding-left:6px;text-align:center">' + img(photos[i + 1], '110mm') + '</td>' : '<td></td>';
      photosHtml += '<div style="page-break-before:always;padding:10px"><table style="width:100%;border-collapse:collapse"><tr>'
        + '<td style="width:50%;padding-right:6px;text-align:center">' + img(photos[i], '110mm') + '</td>' + deuxieme
        + '</tr></table></div>';
    }
  }
  function signature(titre, src) {
    return '<td style="width:50%;padding:0 4px;vertical-align:top">'
      + '<div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:4px">' + titre + '</div>'
      + '<div style="border:1px solid #D8D4CE;border-radius:4px;height:80px;background:#FAFAF8;text-align:center;padding:4px">'
      + (src ? '<img src="' + src + '" style="max-width:100%;max-height:72px;">' : '') + '</div></td>';
  }
  var description = d.description
    ? '<div style="padding:10px 12px;background:#F7F5F1;border:1px solid #D8D4CE;border-radius:5px;margin-bottom:10px">'
      + '<div style="font-size:8px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:5px">Description de l’intervention</div>'
      + '<div style="font-size:11px;line-height:1.7;white-space:pre-wrap;word-break:break-word;overflow-wrap:break-word">' + esc(d.description) + '</div></div>'
    : '';

  return '<html><head><meta charset="utf-8"><style>@page{size:A4;margin:1.5cm}body{font-family:Arial,sans-serif;font-size:10px;margin:0}*{box-sizing:border-box}</style></head><body>'
    + '<table style="width:100%;border-collapse:collapse;margin-bottom:14px;border-bottom:3px solid #196B3B;padding-bottom:10px"><tr>'
    + '<td style="vertical-align:middle;width:40%"><div style="font-weight:800;font-size:16px;color:#1A2B4A">Loué Menuiserie</div>'
    + '<div style="font-size:9px;color:#6A6460">Menuiserie · Charpente · Agencement</div></td>'
    + '<td style="vertical-align:middle;text-align:center;width:40%"><div style="font-weight:800;font-size:15px;color:#196B3B">QUITUS</div>'
    + '<div style="font-size:11px;color:#6A6460;margin-top:4px">Chantier : <b>' + esc(chantier) + '</b></div>'
    + '<div style="font-size:11px;color:#6A6460">Le ' + esc(d.date || '—') + ' à ' + esc(d.heure || '—') + '</div></td>'
    + '<td style="vertical-align:middle;text-align:right;width:20%"><div style="font-size:9px;color:#6A6460">Client</div>'
    + '<div style="font-size:10px;font-weight:700">' + esc(d.intervenant || '—') + '</div></td>'
    + '</tr></table>'
    + '<div style="padding:10px 12px;background:#E1F2E9;border:1.5px solid #196B3B;border-radius:5px;margin-bottom:10px;font-size:11px"><strong>Client :</strong> ' + esc(d.intervenant || '—') + '</div>'
    + description
    + '<table style="border-collapse:collapse;margin-bottom:12px"><tr><td style="padding:8px 14px;background:' + fond + ';border:1.5px solid ' + couleur + ';border-radius:8px">'
    + '<span style="font-size:11px;font-weight:700;color:' + couleur + '">SOLDÉ : ' + esc(solde) + '</span></td></tr></table>'
    + photosHtml
    + '<table style="width:100%;border-collapse:collapse;margin-top:14px;page-break-inside:avoid"><tr>'
    + signature('Signature Entreprise Loué', d.sigLoue) + signature('Signature Client', d.sigIntervenant)
    + '</tr></table>'
    + '</body></html>';
}

// ── modeles/reception.js ──
// ═══════════════════════════════════════════════════════════════
// MODÈLE UNIQUE du PDF « Réception support »
// Utilisé tel quel par la page (aperçu, impression sur PC) ET par le serveur (PDF envoyé par mail) :
// apps-script/Modeles.gs est une COPIE générée par « node outils/construire.js » — ne jamais la modifier à la main.
// Règles : tableaux et styles en ligne seulement (le convertisseur PDF de Google ne connaît ni flex ni grid),
// pas de backticks imbriqués, tout texte saisi passe par esc().
// d : données de la fiche (textes bruts ; images déjà contrôlées) ; esc : fonction d'échappement
// ═══════════════════════════════════════════════════════════════
function modele_reception(d, esc) {
  var points = (d.points || []).filter(function (p) { return p; });
  var nb = function (s) { return points.filter(function (p) { return p.state === s; }).length; };
  var nbOk = nb('ok'), nbNok = nb('nok'), nbSo = nb('so');
  var conf = nbNok > 0 ? '#B32E2E' : '#196B3B';
  var CASE = 'padding:6px 8px;border:1px solid #D8D4CE;';
  var ETIQ = CASE + 'background:#FAFAF8;font-size:9px;color:#6A6460;font-weight:700;text-transform:uppercase;width:35%';
  var TEXTE = 'white-space:pre-wrap;word-break:break-word;overflow-wrap:break-word;';

  var lignes = points.map(function (p, i) {
    var s = p.state;
    var sc = s === 'ok' ? '#196B3B' : s === 'nok' ? '#B32E2E' : s === 'so' ? '#888888' : '#999999';
    var sl = s === 'ok' ? '✓ Conforme' : s === 'nok' ? '✗ Non conforme' : s === 'so' ? '— Sans objet' : 'Non évalué';
    return '<tr style="background:' + (i % 2 === 0 ? 'white' : '#FAFAF8') + '">'
      + '<td style="' + CASE + 'font-size:11px">' + esc(p.label || '') + '</td>'
      + '<td style="' + CASE + 'font-size:10px;font-weight:700;color:' + sc + ';text-align:center">' + sl + '</td>'
      + '<td style="' + CASE + 'font-size:10px;color:#6A6460;' + TEXTE + '">' + esc(p.comment || '') + '</td></tr>';
  }).join('');

  // Photos de chaque point : une page par point, deux photos par ligne
  var photosHtml = points.map(function (p) {
    var ph = (p.photos || []).filter(function (x) { return x && x.data; });
    if (!ph.length) return '';
    var rangs = '';
    for (var i = 0; i < ph.length; i += 2) {
      var cellule = function (x) {
        return '<td style="text-align:center;vertical-align:top;width:50%;padding:4px">'
          + (x ? '<img src="data:' + (x.mimeType || x.mime || 'image/jpeg') + ';base64,' + x.data + '" style="max-width:100%;max-height:100mm;border:1px solid #ddd;">' : '') + '</td>';
      };
      rangs += '<table style="width:100%;border-collapse:collapse;page-break-inside:avoid"><tr>' + cellule(ph[i]) + cellule(ph[i + 1]) + '</tr></table>';
    }
    return '<div style="page-break-before:always;padding-top:10px">'
      + '<div style="font-weight:700;font-size:11px;color:#0D7A6B;border-bottom:2px solid #0D7A6B;padding-bottom:4px;margin-bottom:8px">Photos — ' + esc(p.label || '') + '</div>'
      + rangs + '</div>';
  }).join('');

  return '<html><head><meta charset="utf-8"><style>@page{size:A4;margin:1.5cm}body{font-family:Arial,sans-serif;font-size:10px;margin:0}*{box-sizing:border-box}</style></head><body>'
    + '<table style="width:100%;border-collapse:collapse;margin-bottom:14px;border-bottom:3px solid #0D7A6B"><tr>'
    + '<td style="vertical-align:middle;width:40%;padding-bottom:10px"><div style="font-weight:800;font-size:16px;color:#1A2B4A">Loué Menuiserie</div>'
    + '<div style="font-size:9px;color:#6A6460">Menuiserie · Charpente · Agencement</div></td>'
    + '<td style="text-align:center;vertical-align:middle;padding-bottom:10px"><div style="font-weight:800;font-size:14px;color:#0D7A6B">RÉCEPTION SUPPORT</div>'
    + '<div style="font-size:10px;color:#6A6460;margin-top:2px">' + esc(d.lotLabel || '') + '</div></td>'
    + '<td style="text-align:right;vertical-align:middle;font-size:10px;color:#6A6460;padding-bottom:10px">'
    + '<div>' + esc(d.date || '—') + '</div><div style="font-weight:700">' + esc(d.signataire || '—') + '</div></td>'
    + '</tr></table>'
    + '<table style="width:100%;border-collapse:collapse;margin-bottom:10px">'
    + '<tr><td style="' + ETIQ + '">Chantier</td><td style="' + CASE + 'font-weight:700">' + esc(d.chantier || '—')
    + (d.precision ? ' — <span style="font-weight:400;color:#6A6460">' + esc(d.precision) + '</span>' : '') + '</td></tr>'
    + '<tr><td style="' + ETIQ + '">Lot contrôlé</td><td style="' + CASE + '">' + esc(d.lotLabel || '—') + '</td></tr>'
    + '</table>'
    + '<table style="width:100%;border-collapse:collapse;margin-bottom:10px"><thead><tr>'
    + '<th style="padding:6px 8px;background:#1A2B4A;color:white;font-size:9px;text-align:left;width:38%">Point de contrôle</th>'
    + '<th style="padding:6px 8px;background:#1A2B4A;color:white;font-size:9px;text-align:center;width:22%">Résultat</th>'
    + '<th style="padding:6px 8px;background:#1A2B4A;color:white;font-size:9px;text-align:left">Commentaire</th>'
    + '</tr></thead><tbody>' + lignes + '</tbody></table>'
    + '<div style="padding:7px 10px;background:' + (nbNok > 0 ? '#FAE8E8' : '#E1F2E9') + ';border:1px solid ' + conf + ';border-radius:4px;font-size:10px;color:' + conf + ';font-weight:700;margin-bottom:10px">'
    + 'Bilan : ' + nbOk + ' conforme(s) · ' + nbNok + ' non conforme(s) · ' + nbSo + ' sans objet</div>'
    + (d.observations ? '<div style="padding:7px 10px;background:#F7F5F1;border:1px solid #D8D4CE;border-radius:4px;font-size:10px;margin-bottom:10px;' + TEXTE + '"><strong>Observations :</strong> ' + esc(d.observations) + '</div>' : '')
    + '<table style="width:100%;border-collapse:collapse;page-break-inside:avoid"><tr>'
    + '<td style="width:50%;padding-right:8px;vertical-align:top">'
    + '<div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:4px">Signature</div>'
    + '<div style="border:1px solid #D8D4CE;border-radius:4px;height:80px;background:#FAFAF8;text-align:center;padding:4px">'
    + (d.signature ? '<img src="' + d.signature + '" style="max-width:100%;max-height:72px;">' : '') + '</div>'
    + '<div style="font-size:9px;color:#6A6460;margin-top:3px">' + esc(d.signataire || '') + ' — ' + esc(d.date || '') + '</div>'
    + '</td><td style="width:50%"></td></tr></table>'
    + photosHtml
    + '</body></html>';
}
