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
  'signalement'        : 'Signalement',
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

  // Toutes les lectures du Sheet AVANT le premier mail : une erreur de lecture ne peut plus couper un envoi à moitié
  const libelle    = LIBELLES_FICHES[o.fiche] || 'Document';
  const chantierOk = ligneChantier_(o.chantier) ? String(o.chantier).trim() : '';  // jamais de texte libre dans le mail

  servies.forEach(email => envoyer_(o, email, { sujet: o.sujet, texte: o.texte, html: o.html || '', bcc: '' }, 'connue'));
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
      dossiers : '[Loué App] dossiers.json illisible',
      rangement: '[Loué App] Document non rangé dans Drive',
      aclasser : '[Loué App] Document à classer (chantier inconnu)',
      connexions: '[Loué App] Beaucoup de connexions ratées',
      transition: '[Loué App] Fin de la période sans compte dans 3 jours',
      demarrage : '[Loué App] Période de transition pas démarrée',
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
