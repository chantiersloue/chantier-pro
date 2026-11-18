// ═══════════════════════════════════════════════════════════════
// LOUÉ APP — SERVEUR COMPLET, À COLLER DANS APPS SCRIPT (fichier « Code.gs », tout remplacer)
// FICHIER GÉNÉRÉ AUTOMATIQUEMENT par « node outils/construire.js » — NE PAS MODIFIER À LA MAIN :
// les sources sont dans le dossier apps-script/ du dépôt. Version du serveur 1e2318f2a4 (pages 50cb5db576)
// ═══════════════════════════════════════════════════════════════

const EMPREINTE_SERVEUR = '1e2318f2a4';

// ████ Config.gs ████
// ═══════════════════════════════════════════════════════════════
// Loué App — Apps Script v4.1 (lot 0 : sécurité)
// Loué Menuiserie
// ═══════════════════════════════════════════════════════════════

const VERSION_API = 'v10.1';   // 10.1 : lot 5c (planning lisible par les seuls comptes, plus aucun lien de partage) ; 10.0 : lot 5 (suivi du stockage, purge sur case cochée) ; 9.1 : retrait de la lecture du dossier Plans (lot 4b) ; 9.0 : lot 4a (carnet de chantier) ; 8.0 : lot 3 (notes de chantier) ; 7.0 : lot 7 (signalements) ; 6.0 : lot 2 (comptes)

// ── CONFIGURATION ──
const SHEET_CONTACTS      = 'Contacts';
const SHEET_CONTACT_NOTES = 'Contacts notes';
const SHEET_CHANTIERS   = 'Chantiers';
const SHEET_COTES       = 'Prise de Cote';
const SHEET_FABRICATION = 'Fabrication';
const SHEET_MATERIAUX   = 'Materiaux';
const SHEET_MAT_BORDEREAU = 'Matériaux bordereau';   // lot 1 R2 : A Type, B Matériau, C Quantité (une ligne par matériau)
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

// Sous-dossiers que listerPartages() (lot 0) marque « garder » : leurs partages par lien ne sont pas retirés par retirerPartages().
// Tout le reste est en « accès limité » depuis le lot 0.
// Depuis le lot 4b, l'appli ne lit plus le dossier Plans et n'y pose plus aucun partage : les partages restants se
// listent avec listerPartagesPlans() (lecture seule), et c'est Franck qui décide de les retirer.
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
  // « -1+IMPORTDATA(…) » commence comme un nombre mais serait une formule : seul un nombre négatif PUR passe tel quel
  return (/^[=+@]/.test(v) || (/^-/.test(v) && !/^-\s*\d+(?:[.,]\d+)?\s*$/.test(v))) ? "'" + v : v;
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
      notes  : '[Loué App] Listes « Notes » bloquées — titres d’un onglet changés',
      photos : "[Loué App] Trop de photos aujourd'hui",
      dossiers : '[Loué App] dossiers.json illisible',
      rangement: '[Loué App] Document non rangé dans Drive',
      aclasser : '[Loué App] Document à classer (chantier inconnu)',
      connexions: '[Loué App] Beaucoup de connexions ratées',
      transition: '[Loué App] Fin de la période sans compte dans 3 jours',
      demarrage : '[Loué App] Période de transition pas démarrée',
      planning  : '[Loué App] Planning encore lisible par lien',
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

// ████ Comptes.gs ████
// ═══════════════════════════════════════════════════════════════
// Loué App — Comptes.gs (lot 2) : comptes, mots de passe, jetons de connexion, droits sur les chantiers,
// période de transition. Les fichiers .gs du projet partagent les mêmes constantes et fonctions.
//
// RÈGLE DE SÉCURITÉ : le Sheet n'est partagé qu'avec Franck. Toute personne qui peut le MODIFIER peut aussi ouvrir
// ce script et lire la clé secrète des jetons (Propriétés du script) : elle pourrait se faire passer pour n'importe qui.
//
// Fonctions à lancer dans l'éditeur (choisir la fonction en haut, puis ▶ Exécuter) :
//   genererCle()            une fois : crée la clé secrète des jetons
//   preparerOngletsLot2()   une fois : onglets Utilisateurs, Accès chantiers, Intervenants, colonnes de Chantiers
//   mesurerHachage()        sur TEST : règle le temps de calcul des mots de passe
//   demarrerTransition()    après la fusion des pages du lot 2 : 15 jours où l'appli marche encore sans compte
//   prolongerTransition()   +7 jours ;  finirTransitionMaintenant() : TEST seulement
// ═══════════════════════════════════════════════════════════════

const SHEET_UTILISATEURS = 'Utilisateurs';
const SHEET_ACCES        = 'Accès chantiers';
const SHEET_INTERVENANTS = 'Intervenants';
const SHEET_SANS_COMPTE  = 'Sans compte';

const ROLES = ['Poseur', 'Conducteur', 'Atelier', 'Admin'];
const ROLES_TOUS_CHANTIERS = ['Conducteur', 'Admin'];   // les autres : cases de l'onglet « Accès chantiers »

// Colonnes de l'onglet Utilisateurs (numéros à partir de 1)
const COL_U = { id: 1, nom: 2, role: 3, actif: 4, reinit: 5, provisoire: 6, valable: 7, deconnecter: 8, tous: 9, etat: 10 };
const ENTETES_UTILISATEURS = ['Identifiant', 'Nom', 'Rôle', 'Actif', 'Réinitialiser le mot de passe', 'Mot de passe provisoire',
  'Provisoire valable jusqu’au', 'Déconnecter ses téléphones', 'Tous les chantiers', 'État (rempli par l’appli)'];
const ENTETES_CHANTIERS_9A = ['N°', 'Nom court', 'Adresse', 'Client', 'Architecte', 'Date « Terminé »', 'Chemin MEGA'];
const ENTETES_INTERVENANTS = ['Chantier', 'Nom', 'Société', 'Lot / fonction', 'Mail', 'Téléphone', 'Mis à jour le'];
const STATUTS_CHANTIER = ['En préparation', 'En cours', 'Terminé'];

const DUREE_JETON_JOURS    = 90;    // une connexion tous les 90 jours au plus (prolongée à l'usage)
const PROLONGER_APRES_JOURS = 30;   // un jeton de plus de 30 jours est remplacé par un neuf dans la réponse
const DUREE_PROVISOIRE_H   = 48;    // un mot de passe provisoire sert une fois, pendant 48 h
const ESSAIS_AVANT_BLOCAGE = 5;     // 5 mots de passe faux → identifiant bloqué 15 min
const BLOCAGE_MIN          = 15;
const ECHECS_GLOBAUX_HEURE = 50;    // au-delà, pour toute l'appli : alerte à Franck
const ITERATIONS_DEFAUT    = 2000;  // réglable par la propriété HACHAGE_ITERATIONS (mesurerHachage) ; gardé avec chaque compte
const DUREE_TRANSITION_JOURS = 15;
const MAX_SANS_COMPTE_PAR_JOUR = 200;
const MDP_MIN = 8;
const MDP_EVIDENTS = ['12345678', '123456789', '1234567890', '87654321', '00000000', '11111111', 'azertyui', 'azertyuiop',
  'qwertyui', 'qwertyuiop', 'motdepasse', 'password', 'loueloue', 'menuiserie', 'chantier', 'chantiers'];

const MSG_CONNEXION = 'Appli à mettre à jour ou connexion nécessaire : touchez « Mettre à jour » en haut de l’accueil si le bouton est là, '
  + 'puis connectez-vous. Votre fiche est gardée dans le téléphone.';
const MSG_JETON = 'Session terminée : reconnectez-vous depuis l’accueil. Vos fiches en attente sont gardées.';
const MSG_ERREUR_COMPTES = 'Serveur momentanément indisponible : réessayez dans quelques minutes (les fiches en attente repartent toutes seules)';
const JOURS_FICHES_APRES_DESACTIVATION = 7;   // un compte décoché « Actif » peut encore envoyer les fiches de son téléphone 7 jours

// ── Outils ──
function maintenant_() { return Date.now(); }   // remplacée dans les tests pour simuler le temps qui passe
function normaliserId_(id) { return String(id || '').trim().toLowerCase(); }
function idCompteValide_(id) { return /^[a-z0-9_-]{2,30}$/.test(id); }
function aleatoire_(n) {   // n caractères hexadécimaux aléatoires
  let s = '';
  while (s.length < n) s += Utilities.getUuid().replace(/-/g, '');
  return s.slice(0, n);
}
// Comparaison qui prend toujours le même temps (ne laisse pas deviner un jeton caractère par caractère)
function egaux_(a, b) {
  a = String(a || ''); b = String(b || '');
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
function texteDate_(ms) { return Utilities.formatDate(new Date(ms), 'Europe/Paris', 'dd/MM/yyyy HH:mm'); }
function codeEnv_() { return propriete_('ENVIRONNEMENT') === 'TEST' ? 't' : 'p'; }

// ── Empreinte d'un mot de passe : HMAC-SHA256 répété n fois avec un sel propre au compte (jamais le mot de passe en clair) ──
function empreinte_(mdp, sel, n) {
  let h = String(sel);
  for (let i = 0; i < n; i++) h = Utilities.base64Encode(Utilities.computeHmacSha256Signature(h, String(mdp)));
  return h;
}
function iterations_() { return Math.max(100, Number(propriete_('HACHAGE_ITERATIONS')) || ITERATIONS_DEFAUT); }
function nouvelleEmpreinte_(mdp) {
  const n = iterations_();
  const sel = aleatoire_(32);
  return { sel: sel, emp: empreinte_(mdp, sel, n), n: n };
}
function verifierEmpreinte_(mdp, e) { return !!(e && e.emp) && egaux_(empreinte_(mdp, e.sel, e.n), e.emp); }

// Mot de passe provisoire : 8 minuscules et chiffres faciles à lire et à taper avec des gants (ni 0/o, ni 1/l/i)
const ALPHABET_PROVISOIRE = 'abcdefghjkmnpqrstuvwxyz23456789';
function motDePasseProvisoire_() {
  const hex = aleatoire_(16);
  let s = '';
  for (let i = 0; i < 8; i++) s += ALPHABET_PROVISOIRE.charAt(parseInt(hex.substr(i * 2, 2), 16) % ALPHABET_PROVISOIRE.length);
  return s;
}

// Règles d'un mot de passe choisi : renvoie '' s'il convient, sinon la raison (affichée telle quelle)
function refusMotDePasse_(mdp, id) {
  const m = String(mdp || '');
  const ident = normaliserId_(id);
  if (m.length < MDP_MIN) return 'Le mot de passe doit faire au moins ' + MDP_MIN + ' caractères.';
  if (m.length > 100) return 'Mot de passe trop long (100 caractères au plus).';
  const bas = m.toLowerCase();
  if (ident && (bas === ident || (ident.length >= 4 && bas.indexOf(ident) > -1))) return 'Le mot de passe ne doit pas contenir votre identifiant.';
  if (/^(.)\1+$/.test(m) || MDP_EVIDENTS.indexOf(bas) > -1) return 'Mot de passe trop facile à deviner : choisissez-en un autre.';
  return '';
}

// ── Données techniques d'un compte (Propriétés du script, jamais dans le Sheet) ──
// emp, sel, n : mot de passe choisi ; prov : { emp, sel, n, exp } mot de passe provisoire en cours ;
// ver : version de session (augmente à chaque « Déconnecter » / « Réinitialiser » / changement de mot de passe)
// Une erreur de LECTURE remonte (le serveur répond alors « ERREUR » : personne n'est déconnecté pour une panne)
function lireCompte_(id) {
  const brut = PropertiesService.getScriptProperties().getProperty('COMPTE_' + id);
  if (!brut) return { ver: 1 };
  try { return JSON.parse(brut); } catch (e) { return { ver: 1 }; }
}
function ecrireCompte_(id, c) { PropertiesService.getScriptProperties().setProperty('COMPTE_' + id, JSON.stringify(c)); }

// ── Clé secrète des jetons ──
// À lancer UNE fois (sur TEST, puis sur la production) : la clé est écrite directement dans les Propriétés du script.
function genererCle() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('CLE_JETON')) {
    const m = 'La clé existe déjà : rien n’est changé.';
    Logger.log(m); return m;
  }
  props.setProperty('CLE_JETON', aleatoire_(96));
  const m = '✅ Clé secrète créée et rangée dans les Propriétés du script (ne la copiez nulle part).';
  Logger.log(m); return m;
}
// Cas grave uniquement (clé divulguée) : TOUS les téléphones devront se reconnecter.
// Garde-fou : refuse si la propriété CONFIRMER_CHANGER_CLE ne vaut pas OUI (à poser à la main juste avant).
function changerCle() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('CONFIRMER_CHANGER_CLE') !== 'OUI') {
    const m = 'Refusé : changer la clé déconnecte TOUS les téléphones. Si c’est vraiment voulu, ajoutez la propriété '
      + 'CONFIRMER_CHANGER_CLE = OUI (Paramètres du projet → Propriétés du script), puis relancez changerCle().';
    Logger.log(m); return m;
  }
  props.setProperty('CLE_JETON', aleatoire_(96));
  props.deleteProperty('CONFIRMER_CHANGER_CLE');
  const m = '✅ Nouvelle clé : tous les téléphones devront se reconnecter.';
  Logger.log(m); return m;
}
function cleJeton_() {
  const k = propriete_('CLE_JETON');
  if (!k) throw new Error('Clé secrète absente : lancer genererCle() dans l’éditeur Apps Script');
  return k;
}

// ── Jeton : « identifiant.environnement.version.expiration.signature » ──
function signer_(texte) { return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(texte, cleJeton_())).replace(/=+$/, ''); }
function fabriquerJeton_(id, ver) {
  const corps = id + '.' + codeEnv_() + '.' + ver + '.' + (maintenant_() + DUREE_JETON_JOURS * 24 * 3600 * 1000);
  return corps + '.' + signer_(corps);
}
// { id, ver, exp } si la signature est bonne, l'environnement le bon et le jeton pas expiré ; sinon null.
// cleJeton_() peut lever une erreur (clé absente) : c'est voulu (réponse « ERREUR », pas « session terminée »)
function lireJeton_(jeton) {
  const m = String(jeton || '').match(/^([a-z0-9_-]{2,30})\.([pt])\.(\d{1,9})\.(\d{10,16})\.([A-Za-z0-9_-]{20,})$/);
  if (!m) return null;
  if (!egaux_(signer_(m[1] + '.' + m[2] + '.' + m[3] + '.' + m[4]), m[5])) return null;
  if (m[2] !== codeEnv_()) return null;
  if (Number(m[4]) < maintenant_()) return null;
  return { id: m[1], ver: Number(m[3]), exp: Number(m[4]) };
}

// ── Onglet Utilisateurs, lu une fois par requête ──
let UTILISATEURS_ = null;
function utilisateurs_() {
  if (UTILISATEURS_) return UTILISATEURS_;
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_UTILISATEURS);
  if (!sh) throw new Error('Onglet « ' + SHEET_UTILISATEURS + ' » absent : lancer preparerOngletsLot2()');
  const lignes = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, COL_U.etat).getValues() : [];
  const parId = {}, vus = {}, doublons = {};
  lignes.forEach((r, i) => {
    const id = normaliserId_(r[COL_U.id - 1]);
    if (!id) return;
    if (vus[id]) doublons[id] = true;
    vus[id] = true;
    parId[id] = { ligne: i + 2, id: id, brut: String(r[COL_U.id - 1]), nom: String(r[COL_U.nom - 1] || '').trim(),
      role: String(r[COL_U.role - 1] || '').trim(), actif: r[COL_U.actif - 1] === true,
      tousCoche: r[COL_U.tous - 1] === true, valeurs: r };
  });
  UTILISATEURS_ = { sh: sh, lignes: lignes, parId: parId, doublons: doublons };
  return UTILISATEURS_;
}
function compteUtilisable_(u, id) {
  const l = u.parId[id];
  return !!l && !u.doublons[id] && l.actif && ROLES.indexOf(l.role) > -1 && idCompteValide_(id);
}
function profil_(ligne) {
  return { id: ligne.id, nom: ligne.nom, role: ligne.role,
    tous: ROLES_TOUS_CHANTIERS.indexOf(ligne.role) > -1 || ligne.tousCoche,
    conducteur: ROLES_TOUS_CHANTIERS.indexOf(ligne.role) > -1 };
}
function ecrireEtat_(ligne, texte) {
  try { utilisateurs_().sh.getRange(ligne, COL_U.etat).setValue(cellule_(texte)); } catch (e) { console.error('ecrireEtat_ :', e.message); }
}

// ── Qui fait la requête ? ──
// Renvoie { compte } (profil + jetonNeuf éventuel), { sans: true } (pas de jeton, transition ouverte) ou { refus: réponse }
// Codes : JETON_INVALIDE (la page efface le jeton), CONNEXION_REQUISE, COMPTE_REFUSE (jeton gardé),
// COMPTES_INDISPONIBLES (problème du serveur : jeton gardé, la page réessaie comme après une coupure de réseau)
const REFUS_INDISPONIBLE = { ok: false, code: 'COMPTES_INDISPONIBLES', message: MSG_ERREUR_COMPTES };
function identifier_(corps) {
  const jeton = corps && corps.jeton;
  let ouverte = false;
  try { ouverte = transitionOuverte_(); } catch (e) { return { refus: REFUS_INDISPONIBLE }; }
  if (!jeton) return ouverte ? { sans: true } : { refus: { ok: false, code: 'CONNEXION_REQUISE', message: MSG_CONNEXION } };
  try {
    // Jeton faux, expiré ou révoqué (« Déconnecter », « Réinitialiser », nouveau mot de passe) : la page l'efface.
    // Pendant la transition, la requête passe quand même « sans compte » (comme une page qui n'a pas de jeton).
    const invalide = () => ouverte ? { sans: true, jetonInvalide: true }
      : { refus: { ok: false, code: 'JETON_INVALIDE', message: MSG_JETON } };
    const lu = lireJeton_(jeton);
    if (!lu) return invalide();
    const u = utilisateurs_();
    if (!u.parId[lu.id]) return invalide();                               // ligne supprimée
    const c = lireCompte_(lu.id);
    if (Number(c.ver || 1) !== lu.ver) return invalide();
    // Ligne en double, décochée « Actif », rôle mal tapé : refus, mais le jeton est GARDÉ (une faute de saisie dans le
    // Sheet, une fois corrigée, ne doit pas obliger à réinitialiser la personne). Pour révoquer : « Déconnecter ».
    // Les fiches et photos d'un compte refusé sont quand même acceptées (« désactive ») : la dernière fiche d'un gars
    // qui part ne reste pas bloquée dans son téléphone, et envoyer une fiche ne révèle rien.
    const ligneU = u.parId[lu.id];
    const recent = !c.inactifDepuis || maintenant_() - c.inactifDepuis < JOURS_FICHES_APRES_DESACTIVATION * 24 * 3600 * 1000;
    if (!compteUtilisable_(u, lu.id)) return { desactive: !ligneU.actif && !recent ? '' : lu.id, refus: { ok: false, code: 'COMPTE_REFUSE',
      message: 'Compte refusé pour l’instant (désactivé ou mal rempli dans le Sheet) : voyez avec le bureau. Vos fiches sont gardées.' } };
    const compte = profil_(u.parId[lu.id]);
    if (lu.exp - maintenant_() < (DUREE_JETON_JOURS - PROLONGER_APRES_JOURS) * 24 * 3600 * 1000) compte.jetonNeuf = fabriquerJeton_(lu.id, lu.ver);
    return { compte: compte };
  } catch (err) {
    // Onglet illisible, clé absente, Propriétés indisponibles : problème du SERVEUR, le téléphone garde son jeton.
    // Pendant la transition, une fiche passe quand même « sans compte ».
    console.error('identifier_ :', err.message);
    return { refus: REFUS_INDISPONIBLE, sansPossible: ouverte };
  }
}
// Ajoute le jeton neuf (prolongation) à une réponse
function avecJeton_(rep, compte) {
  if (compte && compte.jetonNeuf) rep.jeton = compte.jetonNeuf;
  return rep;
}

// ── Essais ratés : cache du script (pas de quota journalier ; une perte du cache remet seulement un compteur à zéro) ──
function cacheScript_() { return CacheService.getScriptCache(); }
function minutesBlocage_(id) {
  const jusqua = Number(cacheScript_().get('BLOQUE_' + id) || 0);
  return jusqua > maintenant_() ? Math.ceil((jusqua - maintenant_()) / 60000) : 0;
}
function noterEchec_(id) {
  const cache = cacheScript_();
  const heure = 'ECHECS_H_' + Math.floor(maintenant_() / 3600000);
  const globaux = Number(cache.get(heure) || 0) + 1;
  cache.put(heure, String(globaux), 3700);
  if (globaux > ECHECS_GLOBAUX_HEURE) {
    alerte_('Plus de ' + ECHECS_GLOBAUX_HEURE + ' connexions ratées en une heure sur Loué App (dernier identifiant essayé : « '
      + String(id).slice(0, 30) + ' »). Si personne de l’équipe n’est en train de se tromper, quelqu’un essaie de deviner des mots de passe : '
      + 'les identifiants visés se bloquent 15 min à chaque série de 5 essais. Les téléphones déjà connectés ne sont pas touchés.', 'connexions');
  }
  if (!idCompteValide_(id)) return;
  const n = Number(cache.get('ECHECS_' + id) || 0) + 1;
  if (n >= ESSAIS_AVANT_BLOCAGE) {
    cache.put('BLOQUE_' + id, String(maintenant_() + BLOCAGE_MIN * 60000), BLOCAGE_MIN * 60 + 60);
    cache.remove('ECHECS_' + id);
    // État écrit tout de suite dans le Sheet (sinon au passage suivant de traiterComptes, jusqu'à 10 min) ;
    // seulement pour un compte qui existe (un identifiant inventé n'écrit rien). traiterComptes l'effacera au déblocage.
    try {
      const l = utilisateurs_().parId[id];
      if (l) {
        // Sous le verrou du script (le même que traiterComptes) : jamais d'État écrit en même temps que « Réinitialiser » ;
        // verrou pas libre en 2 s : traiterComptes écrira l'état à son passage
        const v = LockService.getScriptLock();
        const deja = !!(v.hasLock && v.hasLock());
        if (deja || v.tryLock(2000)) {
          try { ecrireEtat_(l.ligne, 'bloqué ' + BLOCAGE_MIN + ' min (5 essais ratés) — « Réinitialiser » débloque'); }
          finally { if (!deja) v.releaseLock(); }
        }
      }
    } catch (e) { console.error('noterEchec_ :', e.message); }
  } else {
    cache.put('ECHECS_' + id, String(n), BLOCAGE_MIN * 60);
  }
}
function effacerEchecs_(id) { const c = cacheScript_(); c.remove('ECHECS_' + id); c.remove('BLOQUE_' + id); }

// ── Connexion ──
const MSG_FAUX = 'Identifiant ou mot de passe incorrect.';
function refusConnexion_(message, code) { return { ok: false, code: code || 'REFUS', message: message }; }

// Vérifie identifiant + mot de passe (choisi ou provisoire). Renvoie { ligne, compte, provisoire } ou { refus }
function verifierIdentite_(identifiant, mdp) {
  const id = normaliserId_(identifiant);
  mdp = String(mdp || '');
  if (!idCompteValide_(id) || !mdp || mdp.length > 200) { noterEchec_(id); return { refus: refusConnexion_(MSG_FAUX) }; }
  let u, c;
  try { u = utilisateurs_(); cleJeton_(); c = u.parId[id] ? lireCompte_(id) : null; }
  catch (err) { console.error('verifierIdentite_ :', err.message); return { refus: { ok: false, code: 'COMPTES_INDISPONIBLES', message: 'Serveur indisponible : réessayez dans quelques minutes.' } }; }
  const ligne = u.parId[id];
  // Blocage d'abord, pour TOUT essai (provisoire compris) ; un essai pendant le blocage compte dans l'alerte globale.
  // « Réinitialiser » débloque.
  const bloque = minutesBlocage_(id);
  if (bloque) {
    noterEchec_('');
    return { refus: refusConnexion_('Trop d’essais : identifiant bloqué encore ' + bloque + ' min. '
      + 'Le bureau peut le débloquer tout de suite (case « Réinitialiser le mot de passe »).', 'BLOQUE') };
  }
  // Toujours deux calculs d'empreinte (provisoire et mot de passe, ou calculs factices) : le temps de réponse ne dit rien
  const n = iterations_();
  const provBon = c && c.prov ? verifierEmpreinte_(mdp, c.prov) : (empreinte_(mdp, 'calcul-factice-1', n), false);
  const empBon = c && c.emp ? verifierEmpreinte_(mdp, c) : (empreinte_(mdp, 'calcul-factice-2', n), false);
  const provOk = provBon && c.prov.exp > maintenant_();
  if (provBon && !provOk) return { refus: refusConnexion_('Mot de passe provisoire expiré (48 h) : demandez-en un autre au bureau.', 'PROVISOIRE_EXPIRE') };
  const bon = provOk || empBon;
  if (!bon) { noterEchec_(id); return { refus: refusConnexion_(MSG_FAUX) }; }
  // Bon mot de passe : on peut dire pourquoi ça bloque encore
  if (u.doublons[id]) return { refus: refusConnexion_('Cet identifiant est en double dans le Sheet : prévenez le bureau.') };
  if (!ligne.actif) return { refus: refusConnexion_('Compte désactivé : voyez avec le bureau.') };
  if (ROLES.indexOf(ligne.role) < 0) return { refus: refusConnexion_('Rôle du compte non rempli dans le Sheet : prévenez le bureau.') };
  effacerEchecs_(id);
  return { ligne: ligne, compte: c, provisoire: provOk };
}

function connexion_(corps) {
  const v = verifierIdentite_(corps.identifiant, corps.motDePasse);
  if (v.refus) return v.refus;
  if (v.provisoire) return { ok: false, code: 'NOUVEAU_MDP', message: 'Choisissez votre mot de passe (8 caractères au moins).' };
  noterPremiereConnexion_();
  ecrireEtat_(v.ligne.ligne, 'connecté le ' + texteDate_(maintenant_()));
  return { ok: true, code: 'CONNECTE', message: 'Connecté', data: { jeton: fabriquerJeton_(v.ligne.id, Number(v.compte.ver || 1)), profil: profil_(v.ligne) } };
}

// Changer de mot de passe (premier choix après un provisoire, ou changement volontaire)
function motDePasse_(corps) {
  const v = verifierIdentite_(corps.identifiant, corps.ancien);
  if (v.refus) return v.refus;
  const nouveau = String(corps.nouveau || '');
  const raison = refusMotDePasse_(nouveau, v.ligne.id) || (nouveau === String(corps.ancien) ? 'Choisissez un mot de passe différent de l’ancien.' : '');
  if (raison) return { ok: false, code: 'MDP_REFUSE', message: raison };
  const verrou = LockService.getScriptLock();   // court : deux téléphones qui changent le même mot de passe en même temps
  if (!verrou.tryLock(10000)) return { ok: false, code: 'COMPTES_INDISPONIBLES', message: 'Serveur occupé : réessayez dans une minute.' };
  let c;
  try {
    c = lireCompte_(v.ligne.id);
    const e = nouvelleEmpreinte_(nouveau);
    c.emp = e.emp; c.sel = e.sel; c.n = e.n;
    delete c.prov;
    c.ver = Number(c.ver || 1) + 1;           // les autres téléphones de la personne devront se reconnecter
    ecrireCompte_(v.ligne.id, c);
  } finally { verrou.releaseLock(); }
  try {
    utilisateurs_().sh.getRange(v.ligne.ligne, COL_U.provisoire, 1, 2).setValues([['', '']]);
  } catch (e) { console.error('motDePasse_ :', e.message); }
  noterPremiereConnexion_();
  ecrireEtat_(v.ligne.ligne, 'mot de passe choisi le ' + texteDate_(maintenant_()));
  return { ok: true, code: 'CONNECTE', message: 'Mot de passe enregistré', data: { jeton: fabriquerJeton_(v.ligne.id, c.ver), profil: profil_(v.ligne) } };
}

// ── Chantiers visibles par un compte ──
function lignesChantiers_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CHANTIERS);
  if (!sh || sh.getLastRow() < 2) return [];
  const larg = Math.max(4, Math.min(11, sh.getLastColumn ? sh.getLastColumn() : 4));
  return sh.getRange(2, 1, sh.getLastRow() - 1, larg).getValues().filter(r => String(r[0] || '').trim());
}
// Noms des chantiers cochés pour un identifiant dans « Accès chantiers » (en minuscules)
function chantiersCoches_(id) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ACCES);
  if (!sh || sh.getLastRow() < 2) return {};
  const larg = sh.getLastColumn();
  const entetes = sh.getRange(1, 1, 1, larg).getValues()[0].map(normaliserId_);
  const col = entetes.indexOf(id);
  if (col < 2) return {};
  const res = {};
  sh.getRange(2, 1, sh.getLastRow() - 1, larg).getValues().forEach(r => { if (r[col] === true) res[cleChantier_(r[0])] = true; });
  return res;
}
function chantierObjet_(r) {
  return { nom: String(r[0] || '').trim(), reference: String(r[1] || ''), statut: String(r[2] || ''), conducteur: String(r[3] || ''),
    numero: String(r[4] || ''), nomCourt: String(r[5] || ''), adresse: String(r[6] || '') };
}
function chantiersVisibles_(compte) {
  const lignes = lignesChantiers_();
  if (compte.tous) {
    const moi = String(compte.nom || '').trim().toLowerCase();
    return lignes.map(r => Object.assign(chantierObjet_(r), {
      mien: compte.conducteur ? String(r[3] || '').trim().toLowerCase() === moi : String(r[2] || '').trim() !== 'Terminé' }));
  }
  const coches = chantiersCoches_(compte.id);
  return lignes.filter(r => coches[cleChantier_(r[0])] && String(r[2] || '').trim() !== 'Terminé')
    .map(r => Object.assign(chantierObjet_(r), { mien: true }));
}
function peutLireChantier_(compte, nom) {
  if (compte.tous) return true;
  return !!chantiersCoches_(compte.id)[cleChantier_(nom)];
}

// ── Actions de l'API réservées aux comptes ──
function moi_(compte) {
  return avecJeton_({ ok: true, code: 'OK', message: 'Bonjour ' + compte.nom, data: {
    profil: { id: compte.id, nom: compte.nom, role: compte.role, tous: compte.tous, conducteur: compte.conducteur },
    chantiers: chantiersVisibles_(compte),
    transitionJusquau: finTransition_() } }, compte);
}
function listes_(compte) {
  const d = donneesListes_();
  d.chantiers = chantiersVisibles_(compte);
  d.partiel = !compte.tous;   // la page demande confirmation pour un chantier hors de la liste
  return avecJeton_({ ok: true, code: 'OK', message: 'Listes', data: d }, compte);
}
function dossiersCompte_(compte, nom) {
  if (nom !== '__PLANNING__' && !peutLireChantier_(compte, nom)) {
    return { ok: false, code: 'INTERDIT', message: 'Ce chantier ne fait pas partie de vos chantiers : voyez avec le bureau.' };
  }
  return avecJeton_({ ok: true, code: 'OK', message: 'Documents', data: { dossiers: lireDossiers_(nom) } }, compte);
}

// ══════════════════════════════════════════════════════════
// PÉRIODE DE TRANSITION : 15 jours où l'ancienne façon d'envoyer (sans compte) reste acceptée
// ══════════════════════════════════════════════════════════
// Première connexion réussie = les pages du lot 2 sont en service (sert au rappel « transition pas démarrée »)
function noterPremiereConnexion_() {
  try {
    const props = PropertiesService.getScriptProperties();
    if (!props.getProperty('PREMIERE_CONNEXION')) props.setProperty('PREMIERE_CONNEXION', String(maintenant_()));
  } catch (e) {}
}
function transitionOublieeDepuis_() {
  const pc = Number(propriete_('PREMIERE_CONNEXION') || 0);
  return !finTransition_() && pc && maintenant_() - pc > 7 * 24 * 3600 * 1000 ? pc : 0;
}
function finTransition_() { const v = Number(propriete_('FIN_TRANSITION') || 0); return v || null; }
// Pas encore commencée (fin non posée) : tout ce qui marchait au lot 1 continue de marcher
function transitionOuverte_() { const fin = finTransition_(); return !fin || maintenant_() < fin; }

function demarrerTransition() {
  const props = PropertiesService.getScriptProperties();
  if (finTransition_()) {
    const m = 'La transition a déjà commencé : fin le ' + texteDate_(finTransition_()) + '. (prolongerTransition() pour ajouter 7 jours.)';
    Logger.log(m); return m;
  }
  props.setProperty('FIN_TRANSITION', String(maintenant_() + DUREE_TRANSITION_JOURS * 24 * 3600 * 1000));
  props.deleteProperty('ALERTE_TRANSITION_FAITE');
  const m = '✅ Transition commencée : sans compte, l’appli marche encore jusqu’au ' + texteDate_(finTransition_())
    + '. Vous recevrez un mail 3 jours avant. Qui utilise encore l’appli sans compte : onglet « ' + SHEET_SANS_COMPTE + ' ».';
  Logger.log(m); return m;
}
function prolongerTransition() {
  const fin = finTransition_();
  if (!fin) { const m = 'La transition n’a pas commencé : rien à prolonger (demarrerTransition()).'; Logger.log(m); return m; }
  PropertiesService.getScriptProperties().setProperty('FIN_TRANSITION', String(Math.max(fin, maintenant_()) + 7 * 24 * 3600 * 1000));
  PropertiesService.getScriptProperties().deleteProperty('ALERTE_TRANSITION_FAITE');
  const m = '✅ Transition prolongée jusqu’au ' + texteDate_(finTransition_()) + '.';
  Logger.log(m); return m;
}
// Copie TEST seulement : pour essayer ce qui se passe après la transition
function finirTransitionMaintenant() {
  if (propriete_('ENVIRONNEMENT') !== 'TEST') {
    const m = 'Refusé : finirTransitionMaintenant() ne sert qu’à la copie TEST (propriété ENVIRONNEMENT = TEST).';
    Logger.log(m); return m;
  }
  PropertiesService.getScriptProperties().setProperty('FIN_TRANSITION', String(maintenant_() - 1000));
  const m = '✅ TEST : transition terminée, les requêtes sans compte sont maintenant refusées.';
  Logger.log(m); return m;
}

// ── Journal « Sans compte » ──
// fiche : une ligne (200 par jour au plus) ; lectures : un compteur par jour dans le cache, recopié par traiterComptes()
const SORTES_LECTURE = ['listes', 'dossiers', 'planning', 'photo'];
function noterSansCompte_(sorte, donnees) {
  try {
    const cache = cacheScript_();
    if (sorte !== 'fiche') {
      const cle = 'SC_' + jour_() + '_' + sorte;
      cache.put(cle, String(Number(cache.get(cle) || 0) + 1), 6 * 3600);
      return;
    }
    const cleF = 'SCF_' + jour_();
    const n = Number(cache.get(cleF) || 0) + 1;
    cache.put(cleF, String(n), 6 * 3600);
    if (n > MAX_SANS_COMPTE_PAR_JOUR) return;
    const d = donnees || {};
    const nomSaisi = [d.auteur, d.redacteur, d.poseur, d.demandeur, d.nomLoue, d.signataireLoue].filter(Boolean).map(String).join(' / ').slice(0, 100);
    feuille_(SHEET_SANS_COMPTE, ['Date', 'Sorte', 'Fiche', 'Chantier', 'Nom saisi dans la fiche', 'Nombre'])
      .appendRow([new Date(maintenant_()), 'fiche', String(d.type || ''), String(d.chantier || ''), nomSaisi, 1].map(cellule_));
  } catch (e) { console.error('noterSansCompte_ :', e.message); }
}
function recopierCompteursSansCompte_() {
  const cache = cacheScript_();
  const jours = [jour_(), Utilities.formatDate(new Date(maintenant_() - 24 * 3600 * 1000), 'Europe/Paris', 'yyyy-MM-dd')];
  let sh = null, valeurs = null;
  jours.forEach(j => SORTES_LECTURE.forEach(sorte => {
    const cle = 'SC_' + j + '_' + sorte;
    const n = Number(cache.get(cle) || 0);
    if (!n) return;
    if (!sh) {
      sh = feuille_(SHEET_SANS_COMPTE, ['Date', 'Sorte', 'Fiche', 'Chantier', 'Nom saisi dans la fiche', 'Nombre']);
      valeurs = sh.getLastRow() > 1 ? sh.getRange(2, 2, sh.getLastRow() - 1, 5).getValues() : [];   // lu une seule fois
    }
    const etiquette = 'lectures ' + sorte + ' du ' + j;
    let i = valeurs.length - 1;
    while (i >= 0 && valeurs[i][0] !== etiquette) i--;
    if (i >= 0) { valeurs[i][4] = Number(valeurs[i][4] || 0) + n; sh.getRange(i + 2, 6).setValue(valeurs[i][4]); }
    else { sh.appendRow([new Date(maintenant_()), etiquette, '', '', '', n]); valeurs.push([etiquette, '', '', '', n]); }
    // Écrit : on retire du cache ce qui vient d'être recopié (ce qui est arrivé entre-temps reste compté)
    cache.put(cle, String(Math.max(0, Number(cache.get(cle) || 0) - n)), 6 * 3600);
  }));
}

// ══════════════════════════════════════════════════════════
// CASES DU SHEET : Réinitialiser, Déconnecter ; onglet « Accès chantiers » ; alerte de fin de transition
// Lancé par le déclencheur « à la modification » (immédiat sur PC) et toutes les 10 min (secours, téléphone)
// ══════════════════════════════════════════════════════════
function surModificationSheet(e) {
  try {
    const r = e && e.range;
    if (!r || r.getSheet().getName() !== SHEET_UTILISATEURS || r.getColumn() > COL_U.tous) return;   // rien à voir : arrêt immédiat
  } catch (err) { return; }
  traiterComptes();
}

function traiterComptes() {
  const verrou = LockService.getScriptLock();   // le même que motDePasse_ : jamais les deux en même temps sur un compte
  if (!verrou.tryLock(20000)) return 'occupé';
  try {
    UTILISATEURS_ = null;
    const u = utilisateurs_();
    const maintenant = maintenant_();
    u.lignes.forEach((r, i) => {
      const ligne = i + 2;
      const id = normaliserId_(r[COL_U.id - 1]);
      if (!id) return;
      const etatAvant = String(r[COL_U.etat - 1] || '');
      let etat = etatAvant;
      // Seules les cases TRAITÉES sont réécrites (jamais toute la ligne : une case cochée par Franck pendant ce passage
      // n'est pas effacée ; elle sera traitée au passage suivant)
      const ecrire = (col, v) => { const p = u.sh.getRange(ligne, col); if (col === COL_U.provisoire || col === COL_U.valable) p.setNumberFormat('@'); p.setValue(v); };
      const actifBrut = r[COL_U.actif - 1];
      if (/^identifiant (invalide|en double)|^« Actif »/.test(etat)) etat = '';   // problème corrigé depuis : message effacé
      if (!idCompteValide_(id)) { etat = 'identifiant invalide : minuscules, chiffres, - ou _ seulement (2 à 30)'; }
      else if (u.doublons[id]) { etat = 'identifiant en double : corrigez l’une des lignes'; }
      else if (actifBrut !== true && actifBrut !== false && String(actifBrut).trim() !== '') {
        etat = '« Actif » n’est pas une case à cocher : sélectionnez la case, puis Insertion → Case à cocher';
      } else {
        // Date de désactivation (les fiches du téléphone sont encore acceptées 7 jours après)
        const cc = lireCompte_(id);
        if (actifBrut !== true && !cc.inactifDepuis) { cc.inactifDepuis = maintenant; ecrireCompte_(id, cc); }
        if (actifBrut === true && cc.inactifDepuis) { delete cc.inactifDepuis; ecrireCompte_(id, cc); }
        const reinit = r[COL_U.reinit - 1] === true, deco = r[COL_U.deconnecter - 1] === true;
        let c = lireCompte_(id);
        const expire = !reinit && c.prov && c.prov.exp <= maintenant;
        let prov = '';
        if (reinit || deco || expire) {
          c = lireCompte_(id);   // relu juste avant d'écrire (un mot de passe vient peut-être d'être choisi)
          if (reinit) {
            prov = motDePasseProvisoire_();
            c.prov = Object.assign(nouvelleEmpreinte_(prov), { exp: maintenant + DUREE_PROVISOIRE_H * 3600 * 1000 });
            delete c.emp; delete c.sel; delete c.n;   // l'ancien mot de passe ne marche plus (téléphone volé, mot de passe divulgué)
            c.ver = Number(c.ver || 1) + 1;
            effacerEchecs_(id);
          } else if (expire && c.prov && c.prov.exp <= maintenant) delete c.prov;
          if (deco) c.ver = Number(c.ver || 1) + 1;
          ecrireCompte_(id, c);
        }
        if (reinit) {
          ecrire(COL_U.provisoire, prov); ecrire(COL_U.valable, texteDate_(c.prov.exp)); ecrire(COL_U.reinit, false);
          etat = 'provisoire créé le ' + texteDate_(maintenant) + ' : à donner à la personne (valable 48 h)';
        } else if (expire) {
          ecrire(COL_U.provisoire, ''); ecrire(COL_U.valable, '');
          etat = c.emp ? 'provisoire expiré (son mot de passe actuel marche toujours)' : 'provisoire expiré : cochez « Réinitialiser » pour en créer un autre';
        }
        if (deco) { ecrire(COL_U.deconnecter, false); etat = 'téléphones déconnectés le ' + texteDate_(maintenant); }
        const bloque = minutesBlocage_(id);
        if (bloque && etat.indexOf('bloqué') < 0) etat = 'bloqué ' + bloque + ' min (5 essais ratés) — « Réinitialiser » débloque';
        else if (!bloque && /^bloqué/.test(etat)) etat = '';
        if (!c.emp && !c.prov && !etat) etat = 'pas encore de mot de passe : cochez « Réinitialiser »';
      }
      if (etat !== etatAvant) u.sh.getRange(ligne, COL_U.etat).setValue(cellule_(etat));
    });
    synchroniserAcces_(u);
    recopierCompteursSansCompte_();
    alerteFinTransition_();
    if (transitionOublieeDepuis_()) alerte_('Les comptes Loué App servent depuis le ' + texteDate_(transitionOublieeDepuis_())
      + ', mais la période de transition n’est pas démarrée : l’appli accepte toujours les envois sans compte. '
      + 'Quand tous les gars sont connectés, lancez demarrerTransition() dans l’éditeur Apps Script (voir docs/lot2-procedure.md).', 'demarrage');
    return 'ok';
  } catch (err) {
    console.error('traiterComptes :', err.message);
    return 'erreur : ' + err.message;
  } finally {
    UTILISATEURS_ = null;
    verrou.releaseLock();
  }
}

// Onglet « Accès chantiers » : une ligne par chantier, une colonne par poseur / atelier ; ajouts seulement
function synchroniserAcces_(u) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_ACCES);
  if (!sh) {
    sh = feuille_(SHEET_ACCES, ['Chantier', 'Remarque (appli)']);
    try { sh.setFrozenColumns(2); } catch (e) {}
  }
  let larg = Math.max(2, sh.getLastColumn());
  const entetes = sh.getRange(1, 1, 1, larg).getValues()[0].map(normaliserId_);
  // Colonnes manquantes : poseurs / atelier actifs, sans la case « Tous les chantiers »
  const besoin = Object.keys(u.parId).filter(id => {
    const l = u.parId[id];
    return compteUtilisable_(u, id) && ROLES_TOUS_CHANTIERS.indexOf(l.role) < 0 && !l.tousCoche;
  }).filter(id => entetes.indexOf(id) < 0);
  const nbLignes = Math.max(0, sh.getLastRow() - 1);
  besoin.forEach(id => {
    larg++;
    if (sh.getMaxColumns && sh.getMaxColumns() < larg) sh.insertColumnsAfter(sh.getMaxColumns(), larg - sh.getMaxColumns());
    sh.getRange(1, larg).setValue(id).setFontWeight('bold');
    if (nbLignes) sh.getRange(2, larg, nbLignes, 1).insertCheckboxes();
  });
  // Lignes : chantiers manquants ajoutés, lignes orphelines signalées
  const chantiers = lignesChantiers_().map(r => String(r[0]).trim());
  const connus = {};
  chantiers.forEach(n => { connus[cleChantier_(n)] = true; });
  const presents = {};
  if (nbLignes) {
    const lignes = sh.getRange(2, 1, nbLignes, 2).getValues();
    lignes.forEach((r, i) => {
      const cle = cleChantier_(r[0]);
      if (!cle) return;
      presents[cle] = true;
      const remarque = connus[cle] ? '' : 'chantier absent de l’onglet Chantiers (renommé ?)';
      if (String(r[1]) !== remarque) sh.getRange(i + 2, 2).setValue(remarque);
    });
  }
  chantiers.filter(n => !presents[cleChantier_(n)]).forEach(n => {
    sh.appendRow([cellule_(n), '']);
    if (larg > 2) sh.getRange(sh.getLastRow(), 3, 1, larg - 2).insertCheckboxes();
  });
}

function alerteFinTransition_() {
  const fin = finTransition_();
  const props = PropertiesService.getScriptProperties();
  if (!fin || maintenant_() < fin - 3 * 24 * 3600 * 1000 || maintenant_() > fin || props.getProperty('ALERTE_TRANSITION_FAITE')) return;
  props.setProperty('ALERTE_TRANSITION_FAITE', '1');
  alerte_('La période de transition de Loué App se termine le ' + texteDate_(fin) + '. Ensuite, une fiche envoyée sans compte sera refusée '
    + '(elle reste gardée dans le téléphone). Utilisations sans compte des 3 derniers jours (au moins) : ' + resumeSansCompte_(3) + '. '
    + 'Détail dans l’onglet « ' + SHEET_SANS_COMPTE + ' ». Pour ajouter 7 jours : prolongerTransition() dans l’éditeur Apps Script.', 'transition');
}
function resumeSansCompte_(jours) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SANS_COMPTE);
  if (!sh || sh.getLastRow() < 2) return 'aucune';
  const limite = maintenant_() - jours * 24 * 3600 * 1000;
  let fiches = 0, lectures = 0;
  sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues().forEach(r => {
    if (!(r[0] instanceof Date) || r[0].getTime() < limite) return;
    if (r[1] === 'fiche') fiches++; else lectures += Number(r[5] || 0);
  });
  return fiches + ' fiche(s), ' + lectures + ' lecture(s)';
}

// ══════════════════════════════════════════════════════════
// MISE EN PLACE (une fois) : onglets et colonnes du lot 2
// ══════════════════════════════════════════════════════════
function preparerOngletsLot2() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lignes = [];
  // Utilisateurs
  const regle = l => SpreadsheetApp.newDataValidation().requireValueInList(l).setAllowInvalid(true).build();
  let sh = ss.getSheetByName(SHEET_UTILISATEURS);
  if (!sh) {
    sh = feuille_(SHEET_UTILISATEURS, ENTETES_UTILISATEURS);
    try { sh.setFrozenColumns(1); } catch (e) {}
    // Listes et cases sur 200 lignes, SEULEMENT à la création : dans Sheets, insertCheckboxes() remet chaque case à FAUX,
    // relancer la fonction décocherait les comptes
    const n = Math.min(199, sh.getMaxRows() - 1);
    sh.getRange(2, COL_U.role, n, 1).setDataValidation(regle(ROLES));
    const contacts = ss.getSheetByName(SHEET_CONTACTS);
    if (contacts && contacts.getMaxRows() > 1) sh.getRange(2, COL_U.nom, n, 1).setDataValidation(SpreadsheetApp.newDataValidation()
      .requireValueInRange(contacts.getRange(2, 1, contacts.getMaxRows() - 1, 1), true).setAllowInvalid(true).build());
    [COL_U.actif, COL_U.reinit, COL_U.deconnecter, COL_U.tous].forEach(c => sh.getRange(2, c, n, 1).insertCheckboxes());
    sh.getRange(2, COL_U.provisoire, n, 2).setNumberFormat('@');
    lignes.push('✅ Onglet « ' + SHEET_UTILISATEURS + ' » créé (cases et listes sur 200 lignes)');
  } else {
    lignes.push('Onglet « ' + SHEET_UTILISATEURS + ' » déjà présent (non modifié)');
    const remplies = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, COL_U.tous).getValues().filter(l => String(l[0]).trim()) : [];
    const sansCase = [COL_U.actif, COL_U.reinit, COL_U.deconnecter, COL_U.tous].filter(c => remplies.some(l => l[c - 1] !== true && l[c - 1] !== false));
    if (sansCase.length) lignes.push('❌ Colonne(s) ' + sansCase.map(c => String.fromCharCode(64 + c)).join(', ')
      + ' sans cases à cocher sur certaines lignes : sélectionnez ces cellules, puis Insertion → Case à cocher.');
  }
  // Accès chantiers
  if (!ss.getSheetByName(SHEET_ACCES)) {
    const a = feuille_(SHEET_ACCES, ['Chantier', 'Remarque (appli)']);
    try { a.setFrozenColumns(2); } catch (e) {}
    lignes.push('✅ Onglet « ' + SHEET_ACCES + ' » créé (rempli automatiquement dans les 10 min)');
  }
  // Intervenants (9a)
  if (!ss.getSheetByName(SHEET_INTERVENANTS)) { feuille_(SHEET_INTERVENANTS, ENTETES_INTERVENANTS); lignes.push('✅ Onglet « ' + SHEET_INTERVENANTS + ' » créé'); }
  // Chantiers : colonnes E à K, seulement si elles sont vides
  const ch = ss.getSheetByName(SHEET_CHANTIERS);
  if (ch) {
    const titres = ch.getRange(1, 5, 1, ENTETES_CHANTIERS_9A.length).getValues()[0];
    const occupees = titres.map((v, i) => String(v).trim() && String(v).trim() !== ENTETES_CHANTIERS_9A[i] ? String.fromCharCode(69 + i) + '1 (« ' + v + ' »)' : '').filter(Boolean);
    if (occupees.length) lignes.push('❌ Onglet Chantiers : cases déjà utilisées, rien n’est écrit : ' + occupees.join(', ') + '. Dites-le à Claude.');
    else {
      ch.getRange(1, 5, 1, ENTETES_CHANTIERS_9A.length).setValues([ENTETES_CHANTIERS_9A]).setFontWeight('bold');
      lignes.push('✅ Onglet Chantiers : colonnes E à K (' + ENTETES_CHANTIERS_9A.join(', ') + ')');
    }
    const statuts = {};
    if (ch.getLastRow() > 1) ch.getRange(2, 3, ch.getLastRow() - 1, 1).getValues().forEach(r => { const s = String(r[0]).trim(); if (s) statuts[s] = (statuts[s] || 0) + 1; });
    const autres = Object.keys(statuts).filter(s => STATUTS_CHANTIER.indexOf(s) < 0);
    ch.getRange(2, 3, Math.max(1, Math.min(ch.getLastRow() + 200, ch.getMaxRows() - 1)), 1).setDataValidation(regle(STATUTS_CHANTIER));
    lignes.push('Statuts : liste « ' + STATUTS_CHANTIER.join(' / ') + ' » (avertissement seulement).'
      + (autres.length ? ' Valeurs actuelles hors liste, à corriger à la main : ' + autres.join(', ') + '.' : ''));
  }
  // Envois : colonne « Auteur (compte) »
  const env = ss.getSheetByName(SHEET_ENVOIS);
  if (env && !String(env.getRange(1, 7).getValue()).trim()) { env.getRange(1, 7).setValue('Auteur (compte)'); lignes.push('✅ Envois : colonne G « Auteur (compte) »'); }
  lignes.push(propriete_('CLE_JETON') ? '✅ Clé des jetons présente' : '❌ Clé des jetons absente : lancer genererCle()');
  const m = lignes.join('\n');
  Logger.log(m); return m;
}

// Contrôles du lot 2, ajoutés à verifierConfig()
function verifierComptes_() {
  const lignes = [];
  const ok = (cond, texte) => lignes.push((cond ? '✅ ' : '❌ ') + texte);
  ok(!!propriete_('CLE_JETON'), 'Clé des jetons (sinon lancer genererCle)');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  [SHEET_UTILISATEURS, SHEET_ACCES].forEach(n => ok(!!ss.getSheetByName(n), 'Onglet « ' + n + ' » (sinon lancer preparerOngletsLot2)'));
  try {
    const u = utilisateurs_();
    const n = Object.keys(u.parId).filter(id => compteUtilisable_(u, id)).length;
    lignes.push('Comptes actifs : ' + n + (Object.keys(u.doublons).length ? ' — ❌ en double : ' + Object.keys(u.doublons).join(', ') : ''));
  } catch (e) {}
  try {
    const moi = [emailAdmin_(), Session.getEffectiveUser().getEmail()].concat(ss.getOwner ? [ss.getOwner() && ss.getOwner().getEmail()] : [])
      .map(e => String(e || '').toLowerCase());
    const autres = ss.getEditors().map(x => String(x.getEmail()).toLowerCase()).filter(e => e && moi.indexOf(e) < 0);
    ok(!autres.length, autres.length ? 'Le Sheet peut être modifié par d’autres comptes (' + autres.join(', ')
      + ') : ils peuvent lire la clé secrète. Retirez-les du partage.' : 'Sheet modifiable par Franck seul');
  } catch (e) { lignes.push('Partage du Sheet : non vérifiable (' + e.message + ')'); }
  const fin = finTransition_();
  lignes.push(!fin ? (transitionOublieeDepuis_() ? '❌ ' : '') + 'Transition : pas commencée (tout marche encore sans compte ; demarrerTransition() quand tous les gars sont connectés)'
    : (maintenant_() < fin ? 'Transition : sans compte accepté jusqu’au ' + texteDate_(fin) : 'Transition terminée le ' + texteDate_(fin) + ' : sans compte refusé'));
  try {
    const recent = resumeSansCompte_(2);
    if (recent !== 'aucune' && recent !== '0 fiche(s), 0 lecture(s)') lignes.push('⚠ Utilisation sans compte dans les dernières 48 h : ' + recent + ' (onglet « ' + SHEET_SANS_COMPTE + ' »)');
  } catch (e) {}
  lignes.push('Hachage : ' + iterations_() + ' itérations (mesurerHachage pour régler)');
  return lignes.join('\n');
}

// Mesure du temps de hachage (à lancer sur TEST) : conseille un nombre d'itérations pour ≈ 0,3 s
function mesurerHachage() {
  const essai = 1000;
  const debut = Date.now();
  empreinte_('mesure-du-temps', 'sel-de-mesure', essai);
  const ms = Math.max(1, Date.now() - debut);
  const conseil = Math.max(200, Math.round(essai * 300 / ms / 100) * 100);
  const m = essai + ' itérations : ' + ms + ' ms. Conseil pour ≈ 0,3 s : HACHAGE_ITERATIONS = ' + conseil
    + ' (Paramètres du projet → Propriétés du script). Les comptes existants gardent leur réglage.';
  Logger.log(m); return m;
}

// ████ Api.gs ████
// ═══════════════════════════════════════════════════════════════
// Loué App — Api.gs : points d'entrée (doGet, doPost), contacts, dossiers Drive
// Les fichiers .gs du projet partagent les mêmes constantes et fonctions.
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// GET — contacts, chantiers, planning, listes
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
    // Lot 5c : le planning n'est plus servi sans compte (seuls les comptes de l'appli le lisent), même pendant la transition
    if (e.parameter.chantier === '__PLANNING__') return sortieJson_({ erreur: 'CONNEXION_REQUISE', message: 'Connectez-vous pour voir le planning' }, cb);
    noterSansCompte_('dossiers');
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
  // Bordereau matériaux (lot 1 R2) : types et matériaux proposés par défaut — une ligne par matériau, le type répété
  const smb = ss.getSheetByName(SHEET_MAT_BORDEREAU);
  // Texte affiché par Sheets (getDisplayValues) : une quantité 2,5 reste « 2,5 » (et pas « 2.5 » ou une date)
  const materiauxBordereau = smb && smb.getLastRow() > 1 ? smb.getRange(2, 1, smb.getLastRow() - 1, 3).getDisplayValues()
    .map(r => ({ type: String(r[0]||'').trim(), materiau: String(r[1]||'').trim(), quantite: String(r[2]||'').trim() }))
    .filter(x => x.type) : [];

  return {
    contacts, chantiers, contactNotes,
    materiaux  : getList(SHEET_MATERIAUX),
    finitions  : getList(SHEET_FINITIONS),
    quincaille : getList(SHEET_QUINCAILLE),
    fonctions  : getList(SHEET_FONCTIONS),
    types      : getList(SHEET_TYPES),
    materiauxBordereau,
  };
}

// ── Planning de l'équipe (et, pour les anciennes pages, la liste vide des plans d'un chantier) ──
function getDossiers(chantierNom, callback) {
  return sortieJson_({ dossiers: lireDossiers_(chantierNom) }, callback);
}
// Le planning (__PLANNING__) : { planning: [...] } ; pour un chantier : { plans: [] }
function lireDossiers_(chantierNom) {
  // Un chantier : plus rien à lire. La tuile « Plans » est retirée (lot 4b) : les plans se lisent dans le carnet.
  // Le Drive n'est pas ouvert, et plus aucun fichier du dossier Plans n'est mis en partage par lien.
  // La liste vide (sans erreur) est pour les anciennes pages encore gardées dans les téléphones.
  if (chantierNom !== '__PLANNING__') return { plans: [] };

  // Planning de l'équipe (lot 5c) : AUCUN lien de partage. Les fichiers sont lus par le serveur et envoyés au seul
  // compte connecté (action planningFichier). Un fichier trouvé partagé (par lien, ou public) est remis en privé.
  const result = {};
  try {
    const planningFolder = DriveApp.getFolderById(drivePlanningId_());
    const restes = [];
    // Le dossier lui-même partagé par lien ouvrirait tous ses fichiers : il est remis en privé aussi
    if (!planningPrive_(planningFolder)) restes.push('le dossier « ' + planningFolder.getName() + ' »');
    const files = planningFolder.getFiles();
    const docs = [];
    while(files.hasNext()) {
      const f = files.next();
      try { if (f.isTrashed()) continue; } catch(e){}
      const mime = f.getMimeType();
      if (mime === PLANNING_RACCOURCI) continue;   // un raccourci Drive n'a pas de contenu à envoyer : pas listé
      if (!planningPrive_(f)) restes.push('« ' + f.getName() + ' »');
      let type = 'link';
      if(mime.includes('pdf'))   type='pdf';
      else if(mime.includes('image')) type='image';
      else if(mime.includes('spreadsheet')||mime.includes('excel')) type='xls';
      else if(mime.includes('presentation')) type='ppt';
      else if(mime.includes('document'))     type='doc';
      let taille = 0;
      try { taille = f.getSize(); } catch(e){}
      docs.push({ id:f.getId(), nom:f.getName(), type, taille, date:Utilities.formatDate(f.getLastUpdated(),'Europe/Paris','dd/MM/yyyy') });
    }
    docs.sort(parDateDecroissante_);
    result.planning = docs;
    // Partage impossible à retirer (fichier d'un autre propriétaire, partage hérité d'un dossier au-dessus) : Franck est prévenu
    if (restes.length) alerte_('Le planning est encore lisible par lien : ' + restes.join(', ') + '. Le serveur n’a pas pu retirer ce partage. '
      + 'Dans Drive : clic droit → Partager → « Accès limité », sur ces éléments ET sur les dossiers au-dessus du dossier Planning.', 'planning');
  } catch(err){ console.error('Planning:', err.message); result.planning=[]; }
  return result;
}
// Remet en privé un fichier ou un dossier partagé par lien (ou public). Rend true s'il est privé ensuite.
function planningPrive_(el) {
  const ouvert = () => { const a = el.getSharingAccess(); return a === DriveApp.Access.ANYONE_WITH_LINK || a === DriveApp.Access.ANYONE; };
  try {
    if (!ouvert()) return true;
    el.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
    return !ouvert();   // relu : un partage hérité d'un dossier au-dessus ne se retire pas ici
  } catch (e) { console.error('Planning, partage :', e.message); return false; }
}
// À lancer une fois dans l'éditeur, juste après la mise en production : retire tout de suite les partages du planning
// (sans attendre qu'un poseur ouvre le planning) et dit ce qui reste ouvert.
function fermerPartagesPlanning() {
  const n = (lireDossiers_('__PLANNING__').planning || []).length;
  const dossier = DriveApp.getFolderById(drivePlanningId_());
  const encore = [];
  if (!planningPrive_(dossier)) encore.push('le dossier');
  const it = dossier.getFiles();
  while (it.hasNext()) { const f = it.next(); if (!f.isTrashed() && f.getMimeType() !== PLANNING_RACCOURCI && !planningPrive_(f)) encore.push('« ' + f.getName() + ' »'); }
  let parent = '';
  try { const p = dossier.getParents(); if (p.hasNext()) { const d = p.next(); if (d.getSharingAccess() !== DriveApp.Access.PRIVATE) parent = d.getName(); } } catch (e) {}
  const m = (encore.length ? '❌ Encore partagé par lien : ' + encore.join(', ') + '. Retire le partage à la main dans Drive.'
    : '✅ Planning : ' + n + ' document(s), aucun partagé par lien.')
    + (parent ? ' ⚠ Le dossier au-dessus (« ' + parent + ' ») est partagé : vérifie qu’il ne donne pas accès au planning.' : '');
  Logger.log(m);
  return m;
}

// ── Lot 5c : un fichier du planning, envoyé au compte connecté (jamais par un lien) ──
const PLANNING_RACCOURCI = 'application/vnd.google-apps.shortcut';
const MAX_PLANNING_OCTETS = 5 * 1024 * 1024;   // 5 Mo au plus par fichier (une barre de réseau)
function planningFichier_(compte, corps) {
  const id = String(corps.id || '');
  const refus = (code, message) => avecJeton_({ ok: false, code: code, message: message }, compte);
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) return refus('DONNEES_INVALIDES', 'Document du planning inconnu');
  let dossier;
  try { dossier = DriveApp.getFolderById(drivePlanningId_()); }
  catch (e) { console.error('Planning:', e.message); return refus('INDISPONIBLE', 'Planning indisponible : voyez avec le bureau.'); }
  // Le fichier doit être DIRECTEMENT dans le dossier Planning (rien d'autre du Drive ne sort par ici) et pas à la corbeille
  let fichier = null;
  const it = dossier.getFiles();
  while (it.hasNext()) { const f = it.next(); if (f.getId() === id) { fichier = f; break; } }
  let jete = false;
  try { jete = !!fichier && fichier.isTrashed(); } catch (e) {}
  if (!fichier || jete || fichier.getMimeType() === PLANNING_RACCOURCI) return refus('INTROUVABLE', 'Ce document n’est plus dans le planning : rouvrez le planning.');
  const tropGros = refus.bind(null, 'TROP_GROS', 'Document trop lourd pour le téléphone (plus de 5 Mo) : voyez avec le bureau.');
  let taille = 0;
  try { taille = fichier.getSize(); } catch (e) {}
  if (taille > MAX_PLANNING_OCTETS) return tropGros();
  // Un fichier Google (Sheets, Docs, Slides) est converti en PDF par getBlob : le type et le nom suivent le contenu réel
  const blob = fichier.getBlob();
  const octets = blob.getBytes();
  if (octets.length > MAX_PLANNING_OCTETS) return tropGros();
  const mime = String(blob.getContentType() || fichier.getMimeType() || 'application/octet-stream');
  let nom = fichier.getName();
  if (mime === 'application/pdf' && !/\.pdf$/i.test(nom)) nom += '.pdf';
  return avecJeton_({ ok: true, code: 'OK', message: 'Document du planning',
    data: { id: id, nom: nom, mime: mime, b64: Utilities.base64Encode(octets) } }, compte);
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
  'signalement'        : 'traiterSignalement',   // lot 7 (Signalements.gs)
  'note-chantier'      : 'traiterNoteChantier',  // lot 3 (Notes.gs) : un nouvel élément de la liste du chantier
  'note-action'        : 'traiterNoteAction',    // lot 3 : un geste sur un élément (modifier, cocher, décocher)
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
// contexte (lot 7, facultatif) : { id, auteurId, auteurNom } — ce que le SERVEUR sait de la fiche (numéro, compte vérifié
// par le jeton). Jamais lu dans les données du téléphone. Absent pour l'ancien format (pages d'avant le lot 1).
function traiterFiche_(brut, contexte) {
  const nom = brut && Object.prototype.hasOwnProperty.call(TRAITEMENTS, brut.type) ? TRAITEMENTS[brut.type] : '';
  if (!nom) throw new Error('Type de fiche inconnu');
  globalThis[nom](preparerDonnees_(brut), brut, contexte);
}

// Lot 2 : chaque action (sauf ping, connexion, motDePasse) passe par identifier_ : jeton valable, ou transition ouverte
function routerV5_(corps) {
  try {
    UTILISATEURS_ = null;   // l'onglet Utilisateurs est relu à chaque requête (un changement agit tout de suite)
    if (corps.action === 'ping') {
      let fin = null;
      try { fin = finTransition_(); } catch (e) {}
      return { ok: true, code: 'OK', message: 'Loué App API ' + VERSION_API, data: { version: VERSION_API, comptes: true,
        transitionJusquau: fin, transitionOuverte: !fin || maintenant_() < fin,
        // Empreinte du code réellement déployé (écrite par outils/construire.js) : sert à vérifier un envoi
        empreinte: typeof EMPREINTE_SERVEUR === 'string' ? EMPREINTE_SERVEUR : '' } };
    }
    // Outils d'essai de la copie TEST : la fonction n'existe QUE dans le serveur envoyé sur TEST
    // (apps-script-test/OutilsTest.gs). En production, cette action est donc une action inconnue comme une autre.
    if (corps.action === 'outilTest' && typeof outilTest_ === 'function') return outilTest_(corps);
    if (corps.action === 'connexion')  return connexion_(corps);
    if (corps.action === 'motDePasse') return motDePasse_(corps);
    if (['photo', 'fiche', 'moi', 'listes', 'dossiers', 'signalements', 'signalementStatut',
      'notes', 'notesNouvelles', 'notesVues', 'carnet', 'carnetTuiles', 'planningFichier'].indexOf(corps.action) < 0) return { ok: false, code: 'ACTION_INCONNUE', message: 'Action inconnue' };
    let qui = identifier_(corps);
    const envoi = corps.action === 'photo' || corps.action === 'fiche';
    // Lot 3 : une note de chantier (ou un geste sur une note) demande TOUJOURS un compte en règle : ni « compte désactivé »,
    // ni « sans compte ». Elle attend dans le téléphone (jamais de note sans auteur, rien dans l'onglet « Sans compte »).
    const estNote = corps.action === 'fiche' && /^note-/.test(String((corps.donnees || {}).type || ''));
    // Fiche ou photo d'un compte désactivé : acceptée, notée « (compte désactivé) »
    if (qui.refus && qui.desactive && envoi && !estNote) qui = { compte: { id: qui.desactive, etiquette: qui.desactive + ' (compte désactivé)' } };
    // Comptes illisibles (panne) pendant la transition : la fiche passe « sans compte »
    if (qui.refus && qui.sansPossible && envoi && !estNote) qui = { sans: true };
    if (estNote && qui.sans) {
      const rep = { ok: false, code: 'CONNEXION_REQUISE', message: 'Connectez-vous depuis l’accueil : c’est gardé dans le téléphone et partira ensuite.' };
      if (qui.jetonInvalide) rep.jetonInvalide = true;
      return rep;
    }
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
    if (corps.action === 'planningFichier') return planningFichier_(qui.compte, corps);   // lot 5c : tout compte actif
    // Lot 7 : suivi des signalements (réservé aux comptes ; droits vérifiés dans Signalements.gs)
    if (corps.action === 'signalements')      return listerSignalements_(qui.compte, corps);
    if (corps.action === 'signalementStatut') return changerStatutSignalement_(qui.compte, corps);
    // Lot 3 : notes de chantier (droits vérifiés dans Notes.gs)
    if (corps.action === 'notes')          return listerNotes_(qui.compte, corps);
    if (corps.action === 'notesNouvelles') return notesNouvelles_(qui.compte);
    if (corps.action === 'notesVues')      return marquerNotesVues_(qui.compte, corps);
    // Lot 4 : carnet de chantier (droits vérifiés dans Carnet.gs)
    if (corps.action === 'carnet')       return carnetLister_(qui.compte, corps);
    if (corps.action === 'carnetTuiles') return carnetTuiles_(qui.compte, corps);
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
  // Lot 7 : un signalement invalide est refusé pour de bon, AVANT de réserver un numéro (ni nouveaux essais, ni alerte)
  if (donnees.type === 'signalement') {
    const refus = validerSignalement_(donnees);
    if (refus) return { ok: false, code: 'DONNEES_INVALIDES', message: refus };
  }

  // Auteur : le compte qui envoie (et celui qui était connecté quand la fiche a été rangée, s'il est différent)
  const saisiPar = normaliserId_(corps.saisiPar);
  // Lot 3 : notes de chantier. Tout est contrôlé ICI, avant de réserver un numéro : aucun nouvel essai inutile, aucune alerte.
  const estNote = /^note-/.test(String(donnees.type));
  if (estNote) {
    // Renvoi après une réponse perdue : déjà enregistrée → on le dit, sans recontrôler des droits qui ont pu changer
    // (ni qui tient le téléphone : la note est arrivée, elle doit quitter la file)
    const shEnvois = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ENVOIS);
    const deja = shEnvois ? chercherEnvoi_(shEnvois, corps.id) : 0;
    if (deja && String(shEnvois.getRange(deja, 5).getValue()).indexOf('traité') === 0) return { ok: true, code: 'DEJA_RECU', message: 'Déjà enregistré', data: { id: corps.id } };
    // Téléphone partagé : ce qu'a écrit X ne part jamais sous le nom de Y (cela attend que X se reconnecte)
    if (compte && saisiPar && saisiPar !== compte.id) return { ok: false, code: 'COMPTE_REFUSE',
      message: 'En attente : écrit par « ' + saisiPar + ' ». Cela partira quand cette personne se reconnectera sur ce téléphone.' };
    let refusNote;
    // onglet des notes aux titres changés : même réponse pour un ajout et pour un geste (le téléphone garde et réessaie)
    try { refusNote = refusNote_(donnees, compte); }
    catch (err) { if (err && err.occupe) return { ok: false, code: 'SERVEUR_OCCUPE', message: err.message }; throw err; }
    if (refusNote) return { ok: false, code: refusNote.code, message: refusNote.message };
  }
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
  if (!estNote) try {   // une note de chantier n'a jamais de photo : pas de recherche dans Drive pour elle
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
    // Ce que le serveur sait de la fiche : son numéro, et le compte vérifié par le jeton (vide si sans compte)
    traiterFiche_(brut, { id: corps.id, auteurId: compte && compte.id ? compte.id : '',
      auteurNom: compte ? (compte.nom || compte.etiquette || compte.id) : 'sans compte', compte: compte || null });
  } catch (err) {
    // Lot 3 (notes) : « occupé » → le téléphone réessaie ; « refus » → définitif. Ni l'un ni l'autre ne prévient Franck
    // par mail (une seule alerte « fiche non traitée » part par jour : elle doit rester pour les vraies fiches).
    if (err && (err.occupe || err.refusDefinitif)) {
      sh.getRange(ligne, 5, 1, 2).setValues([[err.occupe ? 'erreur' : 'refusé', String(err.message).slice(0, 300)]]);
      RAPPORT_ = null;
      return err.occupe ? { ok: false, code: 'SERVEUR_OCCUPE', message: err.message }
                        : { ok: false, code: 'DONNEES_INVALIDES', message: err.message };
    }
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
  sh.getRange(ligne, 5, 1, 2).setValues([['traité', estNote ? 'note de chantier (aucun mail)' : detail]]);
  // aucun mail pour une note : pas de « 0 mail envoyé » alarmant sur le téléphone
  if (estNote) return { ok: true, code: 'ENREGISTRE', message: 'Enregistré', data: { id: corps.id } };
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
// PDF D'UN MODÈLE, CONTRÔLÉ (lot 1, retouche R1)
// Le modèle place les photos d'après une ESTIMATION de la hauteur du contenu (photo de la page 1) et la zone utile
// d'une page A4 (pages de photos). Le moteur PDF de Google n'est pas exactement celui de l'aperçu : on compte les pages
// du PDF obtenu. Une page de plus que prévu (photo rejetée, page blanche) → on refait le PDF UNE fois, avec le format
// de page réel, la photo de la page 1 sur une page à elle et des pages de photos moins hautes, et on garde celui des
// deux qui a le moins de pages. (Quelques secondes de plus, rarement ; aussi pour un texte de plusieurs pages.)
// ═══════════════════════════════════════════════════════════════
function pdfDuModele_(modele, d, nom) {
  const html = modele(d, esc_);
  const blob = HtmlService.createHtmlOutput(html).getAs('application/pdf').setName(nom);
  if (html.indexOf('data-mep=') < 0) return blob;   // pas de photo : rien à contrôler
  const info = infoPdf_(blob);
  if (!info.pages) { console.log('Mise en page : nombre de pages illisible dans le PDF de Google, contrôle impossible'); return blob; }
  const prevues = pagesPrevues_(html);
  if (info.pages <= prevues) return blob;
  const d2 = Object.assign({}, d, { _mepSansPage1: true, _mepMargeEnPlus: 10 });
  if (info.l && info.h) d2._mepFormat = { l: info.l, h: info.h };
  const html2 = modele(d2, esc_);
  const blob2 = HtmlService.createHtmlOutput(html2).getAs('application/pdf').setName(nom);
  const info2 = infoPdf_(blob2);
  // On compare les pages EN TROP (le PDF refait a normalement une page prévue de plus : la photo de la page 1
  // y a sa propre page) ; à égalité, le PDF refait est gardé (pages de photos moins hautes, format réel)
  const enTrop = info.pages - prevues, enTrop2 = info2.pages ? info2.pages - pagesPrevues_(html2) : Infinity;
  const garde2 = enTrop2 <= enTrop;
  console.log('Mise en page : ' + info.pages + ' pages pour ' + prevues + ' prévues (format ' + info.l + ' × ' + info.h + ' mm) ; '
    + 'refait : ' + (info2.pages || '?') + ' pages pour ' + pagesPrevues_(html2) + ' prévues → ' + (garde2 ? 'PDF refait gardé' : 'premier PDF gardé'));
  return garde2 ? blob2 : blob;
}
// Pages prévues : pages du contenu (estimées par le modèle) + une par saut de page des photos
function pagesPrevues_(html) {
  const contenu = Number((html.match(/data-mep-contenu="(\d+)"/) || [])[1] || 1);
  return contenu + (html.match(/page-break-before:always/g) || []).length;
}
// Nombre de pages et format (mm) d'un PDF, lus dans le fichier ; {} si illisible
function infoPdf_(blob) {
  let t = '';
  try { t = blob.getDataAsString('ISO-8859-1'); } catch (e) { return {}; }
  const pages = (t.match(/\/Type\s*\/Page(?![s\w])/g) || []).length;
  const m = t.match(/\/MediaBox\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]/);
  const mm = x => Math.round(Number(x) * 25.4 / 72);
  return { pages: pages, l: m ? mm(m[3] - m[1]) : 0, h: m ? mm(m[4] - m[2]) : 0 };
}

// ═══════════════════════════════════════════════════════════════
// NOTE DE RÉUNION
// ═══════════════════════════════════════════════════════════════
function traiterNoteReunion(data, brut) {
  const now = new Date();
  // Lot 1 : PDF fabriqué par le modèle unique (modeles/note.js, copié dans Modeles.gs), le même que l'aperçu de la page
  const d = validerImages_(brut);
  if (!d.date) d.date = Utilities.formatDate(now, 'Europe/Paris', 'dd/MM/yyyy');
  const nomPDF = nomFichier_(`Note_${brut.chantier||'—'}_${String(d.date).replace(/\//g,'-')}.pdf`);
  const blob   = pdfDuModele_(modele_note, d, nomPDF);   // fabriqué une seule fois (contrôlé : R1)

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
  const blob = pdfDuModele_(modele_bordereau, validerImages_(brut), nomPDF);
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
  const blob = pdfDuModele_(modele_quitus, validerImages_(brut), nomPDF);
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
  const nomPDF = nomFichier_(`Fab_${brut.chantier||'—'}${brut.serie?'_S'+brut.serie:''}_${brut.date||''}.pdf`);
  const blobPdf = pdfDuModele_(modele_fabrication, validerImages_(brut), nomPDF);

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
  const nomFichier = nomFichier_(`Reception_${String(brut.chantier||'').replace(/ /g,'_')}_${String(brut.lotLabel||'').replace(/ /g,'_')}.pdf`);
  const blobPDF = pdfDuModele_(modele_reception, validerImages_(brut), nomFichier);   // fabriqué une seule fois

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
  const nomFichier = nomFichier_(`Attestation_${String(brut.typeLabel||'').replace(/ /g,'_')}_${String(brut.chantier||'').replace(/ /g,'_')}.pdf`);
  const blob = pdfDuModele_(modele_attestation, d, nomFichier);   // fabriqué une seule fois (contrôlé : R1)
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
const DOSSIER_A_CLASSER = '_À CLASSER';   // lot 2 : documents d'un chantier inconnu (commence par « _ » : jamais pris pour un chantier)

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
    'signalement':         '05 - CHANTIER/SIGNALEMENTS',
    'carnet':              'CARNET',
    'plans':               'Plans',   // ancien dossier des plans : plus lu ni créé par l'appli (lot 4b) ; sert à listerPartagesPlans()
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
    'signalement': 'SIGNALEMENT',
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
  // Le cache est commun à tous les déploiements du projet : un ancien serveur encore en service peut y avoir rangé une
  // configuration SANS les clés ajoutées depuis (lot 7 : « signalement »). On complète donc toujours par les valeurs par défaut.
  if (enCache) {
    try {
      const c = JSON.parse(enCache);
      return { version: c.version || 1,
        documents: Object.assign({}, DOSSIERS_DEFAUT.documents, c.documents || {}),
        hors_chantier: Object.assign({}, DOSSIERS_DEFAUT.hors_chantier, c.hors_chantier || {}),
        intitules: Object.assign({}, DOSSIERS_DEFAUT.intitules, c.intitules || {}) };
    } catch (e) {}
  }
  let conf = DOSSIERS_DEFAUT;
  try {
    const racine = DriveApp.getFolderById(driveRootId_());
    const fichier = fichierDossiers_(racine);
    if (fichier) {
      const lu = JSON.parse(fichier.getBlob().getDataAsString());
      // Valeurs du fichier par-dessus les valeurs par défaut : une clé oubliée ne casse rien
      conf = {
        version: lu.version || 1,
        documents: cheminsSurs_(DOSSIERS_DEFAUT.documents, lu.documents),
        hors_chantier: cheminsSurs_(DOSSIERS_DEFAUT.hors_chantier, lu.hors_chantier),
        intitules: cheminsSurs_(DOSSIERS_DEFAUT.intitules, lu.intitules),
      };
    } else {
      racine.createFile(NOM_FICHIER_DOSSIERS, JSON.stringify(DOSSIERS_DEFAUT, null, 2), 'application/json');
    }
  } catch (err) {
    // Fichier illisible (virgule oubliée…) : on range avec les valeurs par défaut et on prévient Franck
    console.error('dossiers.json :', err.message);
    alerte_('Le fichier dossiers.json du Drive de l’appli est illisible (' + err.message +
      '). Les documents sont rangés avec les noms par défaut en attendant. Lancez verifierConfig() pour le détail.', 'dossiers');
  }
  try { cache.put('dossiers.json', JSON.stringify(conf), 600); } catch (e) {}
  return conf;
}

// dossiers.json de la racine (un fichier mis à la corbeille ne compte pas)
function fichierDossiers_(racine) {
  const it = racine.getFilesByName(NOM_FICHIER_DOSSIERS);
  while (it.hasNext()) { const f = it.next(); if (!f.isTrashed()) return f; }
  return null;
}
// Valeurs de Franck par-dessus les valeurs par défaut ; un nom vide ou contenant « .. » garde la valeur par défaut
function cheminsSurs_(defaut, lu) {
  const r = Object.assign({}, defaut);
  Object.keys(lu || {}).forEach(k => {
    const v = String(lu[k] == null ? '' : lu[k]).trim();
    if (v && v.split('/').every(m => m.trim() !== '..')) r[k] = v;
  });
  return r;
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
    if (n && (n.indexOf(cle) > -1 || cle.indexOf(n) > -1)) trouves.push(f);
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
    if (!d.isTrashed() && !estDossierTechnique_(d)) { if (creer) noterDossierChantier_(nom, d, 'nom exact'); return d; }
  }
  // 3. Une seule ressemblance : utilisée, mais notée « à vérifier »
  const proches = ressemblances_(racine, nom);
  if (proches.length === 1) { if (creer) noterDossierChantier_(nom, proches[0], 'ressemblance'); return proches[0]; }
  if (!creer) return null;
  // 4. Nouveau dossier (plusieurs ressemblances : on ne devine pas)
  // (plus de sous-dossier « Plans » créé d'office : les plans passent par le carnet, lot 4b)
  const d = racine.createFolder(nom);
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
  // Lot 2 (9a) : le « nom court » de l'onglet Chantiers (colonne F) s'il est rempli, sinon le nom du chantier
  const ligne = chantier ? ligneChantier_(chantier) : null;
  const court = ligne && ligne.length > 5 ? String(ligne[5] || '').trim() : '';
  const morceaux = [intitule, court || String(chantier || '').trim(), String(complement || '').trim(), dateIso_(dateTexte)].filter(Boolean);
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
    } else if (String(chantier || '').trim() && !ligneChantier_(chantier) && !dossierChantier_(chantier, false)) {
      // Lot 2 : nom absent de l'onglet Chantiers et sans dossier existant (faute de frappe, chantier pas encore saisi) :
      // aucun dossier de chantier n'est créé ; le PDF attend dans « _À CLASSER » et Franck est prévenu
      dossier = dossierParChemin_(DriveApp.getFolderById(driveRootId_()), DOSSIER_A_CLASSER, true);
      alerte_('Un document « ' + type + ' » a été fait pour le chantier « ' + String(chantier).slice(0, 80) + ' », absent de l’onglet Chantiers. '
        + 'Il est rangé dans le dossier « ' + DOSSIER_A_CLASSER + ' » du Drive : déplacez-le (et ajoutez le chantier à l’onglet s’il est nouveau). '
        + 'Les mails sont partis normalement.', 'aclasser');
    } else {
      dossier = dossierParChemin_(dossierChantier_(chantier, true), conf.documents[type] || 'Divers', true);
    }
    const nom = nomLibre_(dossier, nomDocument_(type, conf.hors_chantier[type] ? '' : chantier, complement, dateTexte));
    return dossier.createFile(blob.copyBlob().setName(nom));
  } catch (err) {
    console.error('classerDocument_ (' + type + ') :', err.message);
    alerte_('Un document « ' + type + ' » (chantier « ' + String(chantier || '—') + ' ») n’a pas pu être rangé dans Drive (' +
      err.message + '). Le mail part quand même ; le PDF est en pièce jointe.', 'rangement');
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
  { nom: 'Note/Réunion/Réunion', regles: [[/^note[_ ]/i, 'note']] },
  { nom: 'Quitus',               regles: [[/^quitus/i, 'quitus'], [/^bordereau[_ ]orga/i, 'bordereau-orga'], [/^bordereau[_ ]mat/i, 'bordereau-materiaux']] },
  { nom: 'Bordereaux',           regles: [[/^bordereau[_ ]orga/i, 'bordereau-orga'], [/^bordereau[_ ]mat/i, 'bordereau-materiaux']] },
  { nom: 'Réceptions Support',   regles: [[/^r[ée]ception[_ ]/i, 'reception-support']] },
  { nom: 'Attestations',         regles: [[/^attestation[_ ]/i, 'attestation']] },
];
const ENTETES_MIGRATION = ['Dossier chantier', 'Ancien dossier', 'Fichier', 'Identifiant du fichier', 'Type', 'Nouveau dossier', 'Action', 'État', 'Date'];

// 1) Liste ce qui serait déplacé, SANS RIEN DÉPLACER, dans l'onglet « Migration (lot 1) ».
//    Remplit aussi « Dossiers chantiers » pour les chantiers du Sheet. Peut être relancée sans risque.
function planMigration() {
  const deja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_MIGRATION);
  if (deja && deja.getLastRow() > 1 && deja.getRange(2, 8, deja.getLastRow() - 1, 1).getValues().some(l => l[0] === 'déplacé')) {
    const m = 'Des documents ont déjà été déplacés : l’onglet « ' + SHEET_MIGRATION + ' » sert au retour arrière (annulerMigration). ' +
      'Pour refaire un plan, renommez d’abord cet onglet (par exemple « Migration (lot 1) faite »).';
    Logger.log(m); return m;
  }
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
    const exacts = racine.getFoldersByName(nom);
    let exact = null;
    while (exacts.hasNext() && !exact) { const d = exacts.next(); if (!d.isTrashed() && !estDossierTechnique_(d)) exact = d; }
    if (exact) { noterDossierChantier_(nom, exact, 'nom exact'); return; }
    const proches = ressemblances_(racine, nom);
    if (proches.length === 1) noterDossierChantier_(nom, proches[0], 'ressemblance');
    else sansDossier.push(nom + (proches.length ? ' (' + proches.length + ' dossiers ressemblants)' : ''));
  });

  const bilan = [
    'Plan de migration écrit dans l’onglet « ' + SHEET_MIGRATION + ' » (rien n’a été déplacé).',
    aDeplacer + ' document(s) à déplacer, ' + aTrier + ' à trier à la main (ils restent où ils sont).',
    'Vérifiez l’onglet « ' + SHEET_DOSSIERS + ' » : les lignes « À vérifier » doivent désigner le bon dossier (sinon corrigez l’identifiant ou supprimez la ligne).',
    sansDossier.length ? 'Chantiers sans dossier retenu (un dossier au nom exact sera créé au premier document ; s’il existe déjà sous un autre nom, ajoutez une ligne dans « ' + SHEET_DOSSIERS + ' » avec son identifiant) : ' + sansDossier.join(', ') : 'Tous les chantiers du Sheet ont un dossier.',
    'Pour ne pas déplacer un document : remplacez « DÉPLACER » par « IGNORER » dans la colonne Action.',
    coupe ? '⚠ Arrêt avant la limite de temps de Google : relancez planMigration().' : 'Ensuite : executerMigration().',
  ].join('\n');
  Logger.log(bilan);
  return bilan;
}

// Une seule migration à la fois, SANS prendre le verrou du script : les fiches continuent d'arriver pendant ce temps
function prendreMigration_() {
  const props = PropertiesService.getScriptProperties();
  const depuis = Number(props.getProperty('MIGRATION_EN_COURS') || 0);
  if (depuis && Date.now() - depuis < 7 * 60 * 1000) return false;   // au-delà de 7 min : exécution morte, on reprend
  props.setProperty('MIGRATION_EN_COURS', String(Date.now()));
  return true;
}
function rendreMigration_() { PropertiesService.getScriptProperties().deleteProperty('MIGRATION_EN_COURS'); }

// 2) Déplace les documents marqués « DÉPLACER » (et pas encore faits). Relancer tant qu'il en reste.
function executerMigration() {
  if (!prendreMigration_()) { Logger.log('Une migration est déjà en cours : relancez dans quelques minutes.'); return 'occupé'; }
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
  } finally { rendreMigration_(); }
}

// 3) RETOUR ARRIÈRE : remet dans leur ancien dossier les documents marqués « déplacé » (relancer tant qu'il en reste).
//    Les nouveaux dossiers vides restent (rien n'est supprimé). La ligne passe à « remis en place ».
function annulerMigration() {
  if (!prendreMigration_()) { Logger.log('Une migration est déjà en cours : relancez dans quelques minutes.'); return 'occupé'; }
  try {
    const debut = Date.now();
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_MIGRATION);
    if (!sh || sh.getLastRow() < 2) { Logger.log('Aucune migration à annuler.'); return 'rien'; }
    const lignes = sh.getRange(2, 1, sh.getLastRow() - 1, ENTETES_MIGRATION.length).getValues();
    let remis = 0, problemes = 0, restants = 0;
    for (let i = 0; i < lignes.length; i++) {
      const l = lignes[i];
      if (l[7] !== 'déplacé') continue;
      if (Date.now() - debut > DUREE_MAX_MS) { restants++; continue; }
      let etat;
      try {
        const f = DriveApp.getFileById(String(l[3]));
        // Le dossier chantier est celui qui contient le nouveau dossier actuel du fichier
        let dossier = f.getParents().next();
        const profondeur = String(l[5]).split('/').map(x => x.trim()).filter(Boolean).length;
        for (let n = 0; n < profondeur; n++) dossier = dossier.getParents().next();
        f.moveTo(trouverOuCreerAncien_(dossier, String(l[1])));
        etat = 'remis en place'; remis++;
      } catch (err) { etat = 'déplacé (retour impossible : ' + err.message + ')'; problemes++; }
      sh.getRange(i + 2, 8, 1, 2).setValues([[etat, new Date()]]);
    }
    const bilan = remis + ' document(s) remis dans leur ancien dossier, ' + problemes + ' erreur(s).' +
      (restants ? ' Il en reste ' + restants + ' : relancez annulerMigration().' : ' Retour arrière terminé.');
    Logger.log(bilan);
    return bilan;
  } finally { rendreMigration_(); }
}
// Ancien dossier (son nom peut contenir « / », ex. « Note/Réunion/Réunion » : ce n'est PAS un chemin)
function trouverOuCreerAncien_(chantier, nom) {
  const it = chantier.getFoldersByName(nom);
  while (it.hasNext()) { const d = it.next(); if (!d.isTrashed()) return d; }
  return chantier.createFolder(nom);
}

// Contrôle pour verifierConfig()
function verifierDossiers_() {
  try {
    CacheService.getScriptCache().remove('dossiers.json');
    const racine = DriveApp.getFolderById(driveRootId_());
    const f = fichierDossiers_(racine);
    if (!f) { dossiers_(); return '✅ dossiers.json créé avec les noms par défaut'; }
    JSON.parse(f.getBlob().getDataAsString());
    const aVerifier = lignesDossiers_().slice(1).filter(l => String(l[4] || '').indexOf('OUI') === 0).length;
    return '✅ dossiers.json lisible' + (aVerifier ? ' — ⚠ ' + aVerifier + ' dossier(s) chantier « à vérifier » (onglet ' + SHEET_DOSSIERS + ')' : '');
  } catch (err) {
    return '❌ dossiers.json illisible : ' + err.message + ' (vérifiez les guillemets et les virgules)';
  }
}

// ████ Signalements.gs ████
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// LOT 7 — SIGNALEMENTS (casse / manquant / à recommander)
//
// Un signalement arrive comme une fiche (actions « photo » puis « fiche », type « signalement ») : numéro unique,
// photos, onglet Envois, tout cela est commun (Api.gs). Ce fichier ajoute :
//   - validerSignalement_ : refus DÉFINITIF des données invalides, avant tout traitement ;
//   - traiterSignalement  : une ligne dans l'onglet « Signalements » (écrite EN PREMIER, jamais deux fois),
//                           un PDF (informations + photos) rangé dans le dossier du chantier, le mail ;
//   - listerSignalements_ / changerStatutSignalement_ : le suivi, selon le rôle ;
//   - installerLot7Test / installerLot7Production.
// Décisions : D7-1 à D7-3 (DECISIONS.md), plan : docs/lot7-plan.md.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
const SHEET_SIGNALEMENTS = 'Signalements';
const SIG_TYPES    = ['Casse', 'Manquant', 'À recommander'];
const SIG_URGENCES = ['Bloquant', 'Cette semaine', 'Pas urgent'];
const SIG_STATUTS  = ['À traiter', 'Commandé', 'Livré', 'Clos'];
const SIG_ROLES_SUIVI = ['Conducteur', 'Admin', 'Atelier'];   // voient tous les signalements et changent le statut
const SIG_MAX_LEGENDE = 80;
const SIG_MAX_PHOTOS = 3, SIG_MAX_REPERE = 120, SIG_MAX_COMMENTAIRE = 2000, SIG_MAX_CHANTIER = 150, SIG_MAX_LISTE = 100;
const SIG_ENTETES = ['Numéro', 'Reçu le', 'Chantier', 'Auteur (identifiant)', 'Auteur', 'Type', 'Urgence', 'Repère', 'Commentaire', 'Photos',
  'Atelier prévenu', 'Remarque', 'Statut', 'Statut modifié par l’appli le', 'Statut modifié par l’appli par', 'Mail à la réception', 'Saisi le'];
const COL_S = { id: 1, recu: 2, chantier: 3, auteurId: 4, auteur: 5, type: 6, urgence: 7, repere: 8, commentaire: 9, photos: 10,
  atelier: 11, remarque: 12, statut: 13, modifLe: 14, modifPar: 15, mail: 16, saisi: 17 };

// ── Contrôle des données : '' si tout va bien, sinon la raison du refus (code DONNEES_INVALIDES, définitif) ──
// photosJointes : vrai quand le serveur a déjà remplacé les références des photos par leurs images (2e passage)
function validerSignalement_(d, photosJointes) {
  d = d || {};
  const texte = v => (typeof v === 'string' ? v.trim() : '');
  // Caractères de contrôle et séparateurs de ligne Unicode (la page les remplace par une espace avant l'envoi)
  const CONTROLE = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/, CONTROLE_SAUF_LIGNES = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u2028\u2029]/;
  if (typeof d.date !== 'string' || !/^\d{2}\/\d{2}\/\d{4}$/.test(d.date)) return 'Date invalide';
  if (typeof d.heure !== 'string' || !/^\d{2}h\d{2}$/.test(d.heure)) return 'Heure invalide';
  if (SIG_TYPES.indexOf(d.type_signalement) < 0) return 'Type de signalement inconnu';
  if (SIG_URGENCES.indexOf(d.urgence) < 0) return 'Urgence inconnue';
  const chantier = texte(d.chantier);
  if (!chantier) return 'Chantier manquant';
  if (chantier.length > SIG_MAX_CHANTIER) return 'Nom de chantier trop long';
  if (CONTROLE.test(chantier)) return 'Nom de chantier invalide';
  if (d.repere != null && typeof d.repere !== 'string') return 'Repère invalide';
  if (d.commentaire != null && typeof d.commentaire !== 'string') return 'Commentaire invalide';
  if (CONTROLE.test(texte(d.repere))) return 'Repère invalide';
  if (CONTROLE_SAUF_LIGNES.test(texte(d.commentaire))) return 'Commentaire invalide';
  if (texte(d.repere).length > SIG_MAX_REPERE) return 'Repère trop long (' + SIG_MAX_REPERE + ' caractères au plus)';
  if (texte(d.commentaire).length > SIG_MAX_COMMENTAIRE) return 'Commentaire trop long (' + SIG_MAX_COMMENTAIRE + ' caractères au plus)';
  const photos = d.photosBase64 == null ? [] : d.photosBase64;
  if (!Array.isArray(photos)) return 'Photos invalides';
  if (photos.length > SIG_MAX_PHOTOS) return SIG_MAX_PHOTOS + ' photos au plus pour un signalement';
  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    if (!p || typeof p !== 'object' || Array.isArray(p)) return 'Photo invalide';
    if (p.label != null && (typeof p.label !== 'string' || p.label.length > SIG_MAX_LEGENDE || CONTROLE.test(p.label))) return 'Légende de photo invalide';
    // À la réception : seulement une référence à une photo déposée par l'action « photo » (jamais une image glissée dans la fiche)
    if (!photosJointes && (!idValide_(p.photoRef) || Object.keys(p).some(k => k !== 'photoRef' && k !== 'label'))) return 'Photo invalide';
  }
  if (!texte(d.repere) && !texte(d.commentaire) && !photos.length) return 'Signalement vide : il faut un repère, un commentaire ou une photo';
  if (d.atelier != null && d.atelier !== true && d.atelier !== false) return 'Case « atelier » invalide';
  return '';
}

// ── Onglet ──
function feuilleSignalements_() {
  const existait = !!SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SIGNALEMENTS);
  const sh = feuille_(SHEET_SIGNALEMENTS, SIG_ENTETES);
  if (!existait) preparerOngletSignalements_(sh);
  return sh;
}
// Liste déroulante des statuts, et colonnes de texte en « texte brut » : sans cela Sheets transformerait un repère
// « 1/2 » en date ou un identifiant « 0123 » en nombre (et le poseur ne retrouverait plus « les siens »)
function preparerOngletSignalements_(sh) {
  const lignes = Math.max(1, sh.getMaxRows() - 1);
  [COL_S.id, COL_S.chantier, COL_S.auteurId, COL_S.auteur, COL_S.repere, COL_S.commentaire, COL_S.remarque, COL_S.saisi]
    .forEach(c => sh.getRange(2, c, lignes, 1).setNumberFormat('@'));
  sh.getRange(2, COL_S.statut, lignes, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(SIG_STATUTS).setAllowInvalid(true).build());
}
// Ligne d'un signalement d'après son numéro (colonne A), ou 0. Jamais par position : Franck peut trier l'onglet.
function chercherSignalement_(sh, id) {
  const derniere = sh.getLastRow();
  if (derniere < 2) return 0;
  const ids = sh.getRange(2, COL_S.id, derniere - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return 0;
}
function statutLu_(v) { const s = String(v || '').trim(); return SIG_STATUTS.indexOf(s) > -1 ? s : SIG_STATUTS[0]; }

// Adresses de TOUS les chefs d'atelier (onglet Contacts, colonne G « ChefAtelier » = O), sans doublon
function chefsAtelier_() {
  const vues = {}, res = [];
  getContactsRaw().filter(r => String(r[6] || '').trim().toUpperCase() === 'O').forEach(r => {
    decouperAdresses_(r[2]).forEach(a => { const c = a.toLowerCase(); if (!vues[c]) { vues[c] = true; res.push(a); } });
  });
  return res;
}

// ── Traitement d'un signalement reçu (appelé par traiterFiche_) ──
// contexte : { id (numéro de la fiche), auteurId (identifiant VÉRIFIÉ par le jeton, '' si sans compte), auteurNom }
// Ordre : la ligne d'abord (un PDF ou un mail en panne ne fait jamais perdre le signalement), puis PDF, rangement, mail.
// Rappelé après une panne, il retrouve la ligne par son numéro et ne la réécrit pas.
function traiterSignalement(data, brut, contexte) {
  if (!contexte || !contexte.id) throw new Error('Signalement refusé : numéro de fiche absent (page trop ancienne)');
  const refus = validerSignalement_(brut, true);
  if (refus) throw new Error(refus);
  const texte = v => (typeof v === 'string' ? v.trim() : '');
  const chantier = texte(brut.chantier), type = brut.type_signalement, urgence = brut.urgence;
  const repere = texte(brut.repere), commentaire = texte(brut.commentaire);
  const photos = Array.isArray(brut.photosBase64) ? brut.photosBase64 : [];
  const atelier = brut.atelier === true;
  const saisi = (texte(brut.date) + ' ' + texte(brut.heure)).trim().slice(0, 30);
  const auteurNom = contexte.auteurNom || 'sans compte';

  // Toutes les lectures du Sheet AVANT le PDF et le mail
  const chefs = atelier ? chefsAtelier_() : [];
  const remarque = atelier && !chefs.length ? 'aucun chef d’atelier dans l’onglet Contacts (colonne ChefAtelier = O)' : '';
  const conducteur = emailConducteurChantier_(chantier) || emailAdmin_();

  // 1. La ligne, une seule fois (onglet créé sous verrou s'il manque)
  const verrou = LockService.getScriptLock();
  if (!verrou.tryLock(15000)) throw new Error('Serveur occupé (onglet Signalements)');
  let sh, dejaTraite = false;
  try {
    sh = feuilleSignalements_();
    const existante = chercherSignalement_(sh, contexte.id);
    // Nouvel essai après une coupure : si le mail de ce signalement est déjà parti (ou reporté), on ne refait ni PDF ni mail
    if (existante) dejaTraite = String(sh.getRange(existante, COL_S.mail).getValue()) !== 'en cours';
    else {
      const ligne = [];
      for (let c = 1; c <= SIG_ENTETES.length; c++) ligne.push('');
      ligne[COL_S.id - 1] = contexte.id; ligne[COL_S.recu - 1] = new Date(); ligne[COL_S.chantier - 1] = chantier;
      ligne[COL_S.auteurId - 1] = contexte.auteurId || ''; ligne[COL_S.auteur - 1] = auteurNom;
      ligne[COL_S.type - 1] = type; ligne[COL_S.urgence - 1] = urgence; ligne[COL_S.repere - 1] = repere; ligne[COL_S.commentaire - 1] = commentaire;
      ligne[COL_S.photos - 1] = photos.length; ligne[COL_S.atelier - 1] = atelier ? 'Oui' : 'Non'; ligne[COL_S.remarque - 1] = remarque;
      ligne[COL_S.statut - 1] = SIG_STATUTS[0]; ligne[COL_S.mail - 1] = 'en cours'; ligne[COL_S.saisi - 1] = saisi;
      sh.appendRow(ligne.map(cellule_));
    }
  } finally { verrou.releaseLock(); }
  if (dejaTraite) return;

  // 2. Le PDF (informations + photos), rangé dans le dossier du chantier
  const heure = texte(brut.heure).replace(/[^0-9]/g, 'h').replace(/h+$/, '');
  const nomPDF = nomFichier_('Signalement_' + type + '_' + chantier + '_' + texte(brut.date).replace(/\//g, '-') + '.pdf');
  const pourPdf = Object.assign(validerImages_(brut), { type: type, auteur: auteurNom, chantier: chantier, repere: repere, commentaire: commentaire, atelier: atelier });
  const blob = pdfDuModele_(modele_signalement, pourPdf, nomPDF);
  const fichier = classerDocument_('signalement', blob, chantier, brut.date, (type + ' ' + heure).trim());

  // 3. Le mail : conducteur du chantier (sinon Franck), et les chefs d'atelier si la case est cochée
  const corps = [
    'Signalement — ' + type + ' — ' + urgence,
    'Chantier : ' + chantier,
    repere ? 'Repère : ' + repere : '',
    commentaire ? 'Commentaire : ' + commentaire : '',
    'Signalé par : ' + auteurNom + (saisi ? ', le ' + texte(brut.date) + ' à ' + texte(brut.heure) : ''),
    'Photos : ' + (photos.length ? photos.length + ' (dans le PDF joint)' : 'aucune'),
    'Atelier prévenu : ' + (atelier ? 'oui' : 'non'),
    '',
    'Suivi : appli Loué, tuile « Signalements ».',
    '',
    'Loué App',
  ].filter((l, i, t) => l !== '' || (i > 0 && t[i - 1] !== '')).join('\n');
  distribuer_({
    fiche: 'signalement', chantier: chantier, adresses: [conducteur].concat(chefs),
    sujet: '[Loué App] Signalement — ' + type + ' — ' + chantier, texte: corps,
    fichier: fichier, nomPDF: nomPDF, faireBlob: () => blob,
  });

  // 4. Ce qui s'est passé pour le mail, noté sur la ligne (retrouvée par son numéro)
  const n = k => (RAPPORT_ && RAPPORT_[k] ? RAPPORT_[k].length : 0);
  const mail = n('envoyé') && n('reporté') ? 'envoyé et reporté' : n('reporté') ? 'reporté' : n('envoyé') ? 'envoyé' : 'aucun';
  try {
    const ligne = chercherSignalement_(sh, contexte.id);
    if (ligne) sh.getRange(ligne, COL_S.mail).setValue(mail);
  } catch (e) { console.error('traiterSignalement (colonne Mail) :', e.message); }
}

// ── Suivi : lecture ──
// Qui voit quoi : Conducteur, Admin, Atelier → tous ; Poseur → les siens (identifiant vérifié à l'envoi).
// Le filtre par rôle passe AVANT tout autre ; aucun total n'est rendu.
function listerSignalements_(compte, corps) {
  const voitTout = SIG_ROLES_SUIVI.indexOf(compte.role) > -1;
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SIGNALEMENTS);
  const derniere = sh ? sh.getLastRow() : 0;
  const lignes = derniere > 1 ? sh.getRange(2, 1, derniere - 1, SIG_ENTETES.length).getValues() : [];
  const chantier = typeof corps.chantier === 'string' ? corps.chantier.trim().toLowerCase().slice(0, SIG_MAX_CHANTIER) : '';
  const tout = corps.tout === true;
  const date = v => (v instanceof Date ? texteDate_(v.getTime()) : String(v || ''));
  const res = [];
  for (let i = lignes.length - 1; i >= 0 && res.length < SIG_MAX_LISTE; i--) {   // les plus récents d'abord
    const r = lignes[i];
    const id = String(r[COL_S.id - 1] || '');
    if (!id) continue;
    const mien = !!compte.id && String(r[COL_S.auteurId - 1] || '') === compte.id;
    if (!voitTout && !mien) continue;
    if (chantier && String(r[COL_S.chantier - 1] || '').trim().toLowerCase() !== chantier) continue;
    const statut = statutLu_(r[COL_S.statut - 1]);
    if (!tout && statut === 'Clos') continue;
    res.push({ id: id, recu: date(r[COL_S.recu - 1]), saisi: String(r[COL_S.saisi - 1] || ''), chantier: String(r[COL_S.chantier - 1] || ''),
      auteur: String(r[COL_S.auteur - 1] || ''), type: String(r[COL_S.type - 1] || ''), urgence: String(r[COL_S.urgence - 1] || ''),
      repere: String(r[COL_S.repere - 1] || ''), commentaire: String(r[COL_S.commentaire - 1] || ''), photos: Number(r[COL_S.photos - 1]) || 0,
      atelier: String(r[COL_S.atelier - 1] || '') === 'Oui', statut: statut,
      mailReporte: /reporté/.test(String(r[COL_S.mail - 1] || '')),
      modifLe: date(r[COL_S.modifLe - 1]), modifPar: String(r[COL_S.modifPar - 1] || ''), mien: mien });
  }
  return avecJeton_({ ok: true, code: 'OK', message: res.length + ' signalement(s)',
    data: { signalements: res, peutChanger: voitTout, statuts: SIG_STATUTS, plein: res.length >= SIG_MAX_LISTE } }, compte);
}

// ── Suivi : changement de statut (Conducteur, Admin, Atelier) ──
// Même réponse pour « inconnu » et « interdit » : on n'apprend pas qu'un numéro existe.
function changerStatutSignalement_(compte, corps) {
  const REFUS = { ok: false, code: 'INTERDIT', message: 'Signalement introuvable, ou vous ne pouvez pas changer son statut.' };
  if (SIG_ROLES_SUIVI.indexOf(compte.role) < 0) return avecJeton_(REFUS, compte);
  if (typeof corps.statut !== 'string' || SIG_STATUTS.indexOf(corps.statut) < 0) return avecJeton_({ ok: false, code: 'DONNEES_INVALIDES', message: 'Statut inconnu' }, compte);
  if (typeof corps.id !== 'string' || !idValide_(corps.id)) return avecJeton_(REFUS, compte);
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SIGNALEMENTS);
  if (!sh) return avecJeton_(REFUS, compte);
  const verrou = LockService.getScriptLock();
  if (!verrou.tryLock(15000)) return avecJeton_({ ok: false, code: 'SERVEUR_OCCUPE', message: 'Serveur occupé : réessayez dans un instant.' }, compte);
  try {
    const ligne = chercherSignalement_(sh, corps.id);   // cherché sous verrou, par son numéro
    if (!ligne) return avecJeton_(REFUS, compte);
    const maintenant = new Date();
    sh.getRange(ligne, COL_S.statut, 1, 3).setValues([[corps.statut, maintenant, cellule_(compte.nom || compte.id)]]);
    return avecJeton_({ ok: true, code: 'OK', message: 'Statut enregistré : ' + corps.statut,
      data: { id: corps.id, statut: corps.statut, modifLe: texteDate_(maintenant.getTime()), modifPar: compte.nom || compte.id } }, compte);
  } finally { verrou.releaseLock(); }
}

// ── Installation du lot 7 (une fonction par environnement ; relançable sans danger) ──
function etapesLot7_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const regleStatut = sh => {
    try { return sh.getRange(2, COL_S.statut).getDataValidation(); } catch (e) { return null; }
  };
  return [
    { nom: 'Onglet « ' + SHEET_SIGNALEMENTS + ' » (titres et liste déroulante des statuts)',
      fait: () => {
        const sh = ss.getSheetByName(SHEET_SIGNALEMENTS);
        if (!sh) return false;
        const titres = sh.getRange(1, 1, 1, SIG_ENTETES.length).getValues()[0];
        return SIG_ENTETES.every((t, i) => String(titres[i]) === t) && !!regleStatut(sh);
      },
      action: () => {
        const sh = ss.getSheetByName(SHEET_SIGNALEMENTS);
        if (!sh) { feuilleSignalements_(); return 'onglet créé'; }   // titres, liste des statuts, colonnes de texte en texte brut
        // Onglet déjà là (créé par un premier signalement, ou par quelqu'un) : jamais rien réécrire par-dessus des données
        const titres = sh.getRange(1, 1, 1, SIG_ENTETES.length).getValues()[0];
        if (!SIG_ENTETES.every((t, i) => String(titres[i]) === t)) {
          if (sh.getLastRow() > 1 || titres.some(t => String(t).trim() !== '')) throw new Error('un onglet « ' + SHEET_SIGNALEMENTS + ' » existe déjà avec d’autres titres : le renommer, puis relancer');
          sh.getRange(1, 1, 1, SIG_ENTETES.length).setValues([SIG_ENTETES]);
        }
        preparerOngletSignalements_(sh);
        return 'onglet prêt';
      } },
  ];
}
// Informations utiles à Franck (jamais bloquantes) : chantiers en cours sans conducteur, chefs d'atelier
function infosLot7_() {
  const sans = lignesChantiers_().filter(r => String(r[2] || '').trim() === STATUTS_CHANTIER[1] && !emailContact_(r[3])).map(r => String(r[0]));
  const chefs = chefsAtelier_().length;
  return [
    sans.length ? 'ℹ ' + sans.length + ' chantier(s) « ' + STATUTS_CHANTIER[1] + ' » sans conducteur connu (onglet Chantiers, colonne D vide ou nom absent de Contacts) : leurs signalements arriveront à Franck'
                : 'ℹ Tous les chantiers « ' + STATUTS_CHANTIER[1] + ' » ont un conducteur connu.',
    chefs ? 'ℹ Chef(s) d’atelier (Contacts, ChefAtelier = O) : ' + chefs + ' adresse(s).'
          : 'ℹ Aucun chef d’atelier dans Contacts (colonne ChefAtelier = O) : la case « Prévenir l’atelier » n’enverra de mail à personne.',
  ].join('\n');
}
function installerLot7_(attendu) {
  const r = installer_('Lot 7', attendu, etapesLot7_());
  let infos = '';
  if (r.ok) { try { infos = '\n' + infosLot7_(); } catch (e) { infos = '\n(informations indisponibles : ' + e.message + ')'; } Logger.log(infos); }
  return r.texte + infos;
}
function installerLot7Test() { return installerLot7_('TEST'); }
function installerLot7Production() { return installerLot7_('PRODUCTION'); }

// ████ Notes.gs ████
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// LOT 3 — NOTES DE CHANTIER : la liste des choses à faire d'un chantier (façon « Google Keep ») ; aucun mail
//
// Un élément = une ligne de texte et une case à cocher. Pas de suppression : un élément coché passe dans
// « Éléments terminés », d'où on peut le décocher. À l'écran : ni auteur, ni date. Le Sheet garde qui a fait quoi
// et quand (onglet « Notes historique »), comme filet de sécurité.
//
// Un nouvel élément et chaque geste arrivent comme une fiche (action « fiche ») : numéro unique, renvoi automatique,
// onglet Envois, tout cela est commun (Api.gs). Deux types de fiche :
//   « note-chantier » : un nouvel élément { chantier, texte } ;
//   « note-action »   : un geste { note, geste: modifier | fait | defaire, texte? } sur un élément existant.
// Ce fichier ajoute :
//   - refusNote_          : contrôle des données ET des droits, AVANT de réserver un numéro (refus définitif) ;
//   - traiterNoteChantier / traiterNoteAction : l'écriture, sous verrou, ligne retrouvée par son numéro ;
//   - listerNotes_, notesNouvelles_, marquerNotesVues_ : les lectures (droits vérifiés ici) ;
//   - installerLot3Test / installerLot3Production.
// Droits : lire, ajouter, modifier, cocher, décocher = toute personne qui a accès au chantier ;
//          vue « Tous chantiers » = conducteurs et admin.
// Plan : docs/lot3-plan.md (chapitre 14). Décisions : D3-… (DECISIONS.md).
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
const SHEET_NOTES = 'Notes';
const SHEET_NOTES_HISTO = 'Notes historique';
const SHEET_NOTES_VUES = 'Notes vues';
const NOTE_GESTES = ['modifier', 'fait', 'defaire'];
const NOTE_MAX_TEXTE = 2000, NOTE_MAX_CHANTIER = 150;
const NOTE_MAX_A_FAIRE = 300, NOTE_MAX_TERMINES = 300, NOTE_MAX_TOUS = 300;
const NOTE_ENTETES = ['Numéro', 'Chantier', 'Texte', 'Fait', 'Créé le', 'Créé par', 'Texte modifié le', 'Texte modifié par (identifiant)', 'Coché le', 'Coché par'];
const COL_N = { id: 1, chantier: 2, texte: 3, fait: 4, cree: 5, creePar: 6, texteLe: 7, texteParId: 8, cocheLe: 9, cochePar: 10 };
const NOTE_COLONNES_TEXTE = [COL_N.id, COL_N.chantier, COL_N.texte, COL_N.creePar, COL_N.texteParId, COL_N.cochePar];
const NOTE_HISTO_ENTETES = ['Le', 'Numéro', 'Chantier', 'Geste', 'Ancien texte', 'Nouveau texte', 'Par', 'Par (identifiant)'];
const NOTE_HISTO_TEXTE = [2, 3, 4, 5, 6, 7, 8];
const NOTE_VUES_ENTETES = ['Identifiant', 'Chantier', 'Vue le'];
const NOTE_REFUS_DROIT = 'Cet élément n’existe pas, ou ce chantier ne fait pas partie de vos chantiers.';

// ── Petits outils ──
function noteTexte_(v) { return typeof v === 'string' ? v.trim() : ''; }
// Texte d'un élément : une seule ligne. Un retour à la ligne ou une tabulation devient une espace (jamais un refus :
// une dictée ou un collage ne doit pas faire perdre l'élément).
function noteLigne_(v) { return typeof v === 'string' ? v.replace(/[\r\n\t\u2028\u2029]+/g, ' ').replace(/ {2,}/g, ' ').trim() : ''; }
// Erreurs que recevoirFiche_ ne signale PAS à Franck par mail : « occupé » (le téléphone réessaie) et « refus » (définitif)
function noteOccupe_() { return Object.assign(new Error('Serveur occupé, nouvel essai automatique'), { occupe: true }); }
function noteRefus_(message) { return Object.assign(new Error(message), { refusDefinitif: true }); }
function noteChef_(compte) { return !!compte && ROLES_TOUS_CHANTIERS.indexOf(compte.role) > -1; }
function noteMs_(v) { return v instanceof Date ? v.getTime() : 0; }
function noteQui_(compte) { return (compte.nom || compte.id) + ' (' + compte.id + ')'; }
// Nom du chantier tel qu'il est écrit dans l'onglet Chantiers ('' s'il n'y est pas)
function noteChantierConnu_(nom) { const l = ligneChantier_(nom); return l ? String(l[0]).trim() : ''; }
// Accès au chantier : conducteurs et admin partout, les autres seulement si la case du chantier est cochée
function notePeutLire_(compte, chantier) { return !!compte && !!compte.id && !!chantier && peutLireChantier_(compte, chantier); }

// ── Onglets ──
// Colonnes de texte en « texte brut » : Sheets ne transforme pas « 1/2 » en date ni « 0123 » en nombre
function noteFormats_(sh, colonnesTexte) {
  const lignes = Math.max(1, sh.getMaxRows() - 1);
  colonnesTexte.forEach(c => sh.getRange(2, c, lignes, 1).setNumberFormat('@'));
}
function noteFeuille_(nom, entetes, colonnesTexte) {
  const existait = !!SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nom);
  const sh = feuille_(nom, entetes);
  if (!existait) noteFormats_(sh, colonnesTexte);
  return sh;
}
// Un onglet du même nom mais aux autres titres (première version du lot, restée sur la copie TEST) n'est JAMAIS lu ni
// écrit : le téléphone réessaiera, et l'installation dira quoi faire.
function noteTitresBons_(sh, entetes) {
  if (sh.getLastColumn() < entetes.length) return false;   // onglet plus étroit que prévu : pas les bons titres (et pas de lecture hors limites)
  const titres = sh.getRange(1, 1, 1, entetes.length).getValues()[0];
  return entetes.every((t, i) => String(titres[i]) === t);
}
// Titres changés (un titre de colonne renommé à la main, ou la première version restée sur la copie TEST) : rien n'est lu ni
// écrit, les téléphones gardent tout et réessaient, et Franck est prévenu par mail (une fois par jour) : sans cela, toutes
// les listes seraient bloquées sans que personne le sache.
function noteOngletVerifie_(sh, entetes) {
  if (noteTitresBons_(sh, entetes)) return sh;
  alerte_('Les listes « Notes » des chantiers sont bloquées : la ligne de titres de l’onglet « ' + sh.getName() + ' » n’est plus celle attendue ('
    + entetes.join(' | ') + '). Remettez ces titres, ou renommez l’onglet puis lancez installerLot3Production. Rien n’est perdu : les téléphones gardent tout et réessaient.', 'notes');
  throw Object.assign(new Error('Les onglets des notes ne sont pas à jour sur le serveur (titres changés, ou installation du lot 3 à faire).'), { occupe: true });
}
function feuilleNotes_() { return noteOngletVerifie_(noteFeuille_(SHEET_NOTES, NOTE_ENTETES, NOTE_COLONNES_TEXTE), NOTE_ENTETES); }
function feuilleNotesHisto_() { return noteOngletVerifie_(noteFeuille_(SHEET_NOTES_HISTO, NOTE_HISTO_ENTETES, NOTE_HISTO_TEXTE), NOTE_HISTO_ENTETES); }
function feuilleNotesVues_() { return noteFeuille_(SHEET_NOTES_VUES, NOTE_VUES_ENTETES, [1, 2]); }
// Nouvelle ligne en bas de l'onglet, colonnes de texte mises en « texte brut » AVANT l'écriture (au-delà des lignes
// formatées à l'installation, Sheets transformerait « 12/11 » en date). À appeler sous verrou.
function noteAjouterLigne_(sh, valeurs, colonnesTexte) {
  const ligne = sh.getLastRow() + 1;
  if (ligne > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 50);
  // colonnes voisines regroupées : une seule demande à Sheets par groupe
  for (let i = 0; i < colonnesTexte.length; i++) {
    let n = 1;
    while (i + n < colonnesTexte.length && colonnesTexte[i + n] === colonnesTexte[i] + n) n++;
    sh.getRange(ligne, colonnesTexte[i], 1, n).setNumberFormat('@');
    i += n - 1;
  }
  sh.getRange(ligne, 1, 1, valeurs.length).setValues([valeurs.map(cellule_)]);
  return ligne;
}
// Le filet de sécurité : une ligne par geste (qui, quand, quoi). Jamais lu par l'appli. À appeler sous verrou.
function noteHistorique_(id, chantier, geste, ancien, nouveau, compte) {
  noteAjouterLigne_(feuilleNotesHisto_(), [new Date(), id, chantier, geste, ancien, nouveau, compte.nom || compte.id, compte.id], NOTE_HISTO_TEXTE);
}

// Toutes les lignes de l'onglet Notes (sans les titres), de la plus ancienne à la plus récente d'après « Créé le »
// (jamais d'après leur position : Franck peut trier l'onglet) ; [] si l'onglet n'existe pas encore
function lignesNotes_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NOTES);
  if (sh) noteOngletVerifie_(sh, NOTE_ENTETES);
  const derniere = sh ? sh.getLastRow() : 0;
  const lignes = derniere > 1 ? sh.getRange(2, 1, derniere - 1, NOTE_ENTETES.length).getValues() : [];
  return lignes.filter(r => String(r[COL_N.id - 1] || '')).map((r, i) => ({ r: r, i: i, t: noteMs_(r[COL_N.cree - 1]) }))
    .sort((a, b) => (a.t - b.t) || (a.i - b.i)).map(x => x.r);
}
// Ligne d'un élément d'après son numéro (colonne A), ou 0. Jamais par position : Franck peut trier l'onglet.
function chercherNote_(sh, id) {
  const derniere = sh ? sh.getLastRow() : 0;
  if (derniere < 2) return 0;
  const ids = sh.getRange(2, COL_N.id, derniere - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return 0;
}
function noteLue_(id) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NOTES);
  if (sh) noteOngletVerifie_(sh, NOTE_ENTETES);
  const ligne = chercherNote_(sh, id);
  return ligne ? { sh: sh, ligne: ligne, r: sh.getRange(ligne, 1, 1, NOTE_ENTETES.length).getValues()[0] } : null;
}
function noteFaite_(r) { return String(r[COL_N.fait - 1] || '') === 'Oui'; }

// ── Contrôle AVANT tout traitement : null si tout va bien, sinon { code, message } ──
// DONNEES_INVALIDES = refus définitif (la fiche reste dans le téléphone, marquée « à vérifier ») ;
// CONNEXION_REQUISE = la fiche attend dans le téléphone que la personne se reconnecte (jamais d'élément sans auteur).
function refusNote_(d, compte) {
  d = d || {};
  const refus = m => ({ code: 'DONNEES_INVALIDES', message: m });
  const CONTROLE = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;   // après nettoyage des retours à la ligne : plus aucun caractère invisible
  if (!compte || !compte.id) return { code: 'CONNEXION_REQUISE', message: 'Connectez-vous depuis l’accueil : c’est gardé dans le téléphone et partira ensuite.' };
  if (d.texte != null && typeof d.texte !== 'string') return refus('Texte invalide');
  const texte = noteLigne_(d.texte);
  if (texte.length > NOTE_MAX_TEXTE) return refus('Texte trop long (' + NOTE_MAX_TEXTE + ' caractères au plus)');
  if (CONTROLE.test(texte)) return refus('Texte invalide');

  if (d.type === 'note-chantier') {
    const chantier = noteTexte_(d.chantier);
    if (!chantier || chantier.length > NOTE_MAX_CHANTIER || CONTROLE.test(chantier)) return refus('Chantier manquant ou invalide');
    if (!texte) return refus('Élément vide : écrivez un texte');
    // Même réponse pour « chantier inconnu » et « chantier interdit » : on n'apprend pas qu'un chantier existe
    const connu = noteChantierConnu_(chantier);
    if (!connu || !notePeutLire_(compte, connu)) return refus('Ce chantier ne fait pas partie de vos chantiers : l’élément n’est pas enregistré. Voyez avec le bureau.');
    return null;
  }

  if (d.type === 'note-action') {
    if (NOTE_GESTES.indexOf(d.geste) < 0) return refus('Geste inconnu');
    if (typeof d.note !== 'string' || !idValide_(d.note)) return refus('Numéro d’élément invalide');
    const n = noteLue_(d.note);
    if (!n || !notePeutLire_(compte, String(n.r[COL_N.chantier - 1]))) return refus(NOTE_REFUS_DROIT);
    if (d.geste === 'modifier' && !texte) return refus('Le texte ne peut pas être vide (un élément ne se supprime pas : cochez-le)');
    return null;
  }
  return refus('Type de fiche inconnu');
}

// ── Nouvel élément (appelé par traiterFiche_) ──
// contexte : { id (numéro de la fiche = numéro de l'élément), compte (profil vérifié par le jeton) }
function traiterNoteChantier(data, brut, contexte) {
  if (!contexte || !contexte.id) throw new Error('Élément refusé : numéro de fiche absent (page trop ancienne)');
  const compte = contexte.compte;
  const refus = refusNote_(brut, compte);
  if (refus) throw noteRefus_(refus.message);
  const chantier = noteChantierConnu_(brut.chantier), texte = noteLigne_(brut.texte);
  const verrou = LockService.getScriptLock();
  if (!verrou.tryLock(15000)) throw noteOccupe_();
  try {
    const sh = feuilleNotes_();
    feuilleNotesHisto_();   // vérifié AVANT d'écrire : jamais un élément sans sa ligne d'historique
    if (chercherNote_(sh, contexte.id)) return;   // déjà écrit (nouvel essai après une coupure) : rien à refaire
    const maintenant = new Date(), ligne = [];
    for (let c = 1; c <= NOTE_ENTETES.length; c++) ligne.push('');
    ligne[COL_N.id - 1] = contexte.id; ligne[COL_N.chantier - 1] = chantier; ligne[COL_N.texte - 1] = texte;
    ligne[COL_N.cree - 1] = maintenant; ligne[COL_N.creePar - 1] = noteQui_(compte);
    ligne[COL_N.texteLe - 1] = maintenant; ligne[COL_N.texteParId - 1] = compte.id;
    // L'historique d'abord : si une panne coupe entre les deux écritures, le nouvel essai refait le tout
    // (une ligne d'historique en double vaut mieux qu'un élément sans trace de son auteur)
    noteHistorique_(contexte.id, chantier, 'création', '', texte, compte);
    noteAjouterLigne_(sh, ligne, NOTE_COLONNES_TEXTE);
  } finally { verrou.releaseLock(); }
}

// ── Geste sur un élément (appelé par traiterFiche_) : modifier le texte, cocher, décocher ──
// Deux personnes modifient le même élément : la dernière modification reçue l'emporte (heure du serveur) ;
// l'historique garde les deux textes. Un geste répété ne change rien.
function traiterNoteAction(data, brut, contexte) {
  const compte = contexte && contexte.compte;
  const refus = refusNote_(brut, compte);
  if (refus) throw noteRefus_(refus.message);
  const verrou = LockService.getScriptLock();
  if (!verrou.tryLock(15000)) throw noteOccupe_();
  try {
    feuilleNotesHisto_();   // vérifié AVANT d'écrire : jamais un geste sans sa ligne d'historique
    const n = noteLue_(brut.note);   // relu sous verrou
    if (!n) throw noteRefus_(NOTE_REFUS_DROIT);
    const r = n.r, maintenant = new Date(), chantier = String(r[COL_N.chantier - 1] || '');
    const ecrire = (col, valeurs) => n.sh.getRange(n.ligne, col, 1, valeurs.length).setValues([valeurs.map(cellule_)]);
    if (brut.geste === 'modifier') {
      const texte = noteLigne_(brut.texte), ancien = String(r[COL_N.texte - 1] || '');
      if (texte === ancien) return;
      // « vu » = le texte que le téléphone avait sous les yeux. S'il n'est plus le texte actuel, quelqu'un d'autre l'a changé
      // entre-temps : la modification reçue l'emporte quand même, et l'historique le dit (rien à l'écran).
      const enMemeTemps = typeof brut.vu === 'string' && noteLigne_(brut.vu) !== ancien && String(r[COL_N.texteParId - 1] || '') !== compte.id;
      noteHistorique_(brut.note, chantier, enMemeTemps ? 'modification en même temps' : 'modification', ancien, texte, compte);   // l'historique d'abord
      ecrire(COL_N.texte, [texte]);
      ecrire(COL_N.texteLe, [maintenant, compte.id]);
    } else if (brut.geste === 'fait') {
      if (noteFaite_(r)) return;
      noteHistorique_(brut.note, chantier, 'coché', '', '', compte);
      ecrire(COL_N.fait, ['Oui']);
      ecrire(COL_N.cocheLe, [maintenant, noteQui_(compte)]);
    } else {
      if (!noteFaite_(r)) return;
      noteHistorique_(brut.note, chantier, 'décoché', '', '', compte);
      ecrire(COL_N.fait, ['']);
      ecrire(COL_N.cocheLe, ['', '']);
    }
  } finally { verrou.releaseLock(); }
}

// ── Notes vues (chiffre rouge « nouveau » de l'accueil) ──
// Dernière visite de chaque chantier par ce compte : { cléDuChantier: millisecondes }
function notesVues_(id) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NOTES_VUES);
  const res = {};
  if (!sh || sh.getLastRow() < 2) return res;
  sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues().forEach(r => {
    if (String(r[0]) === id) res[cleChantier_(r[1])] = Math.max(res[cleChantier_(r[1])] || 0, noteMs_(r[2]));
  });
  return res;
}
// « Nouveau » pour ce compte : un élément À FAIRE dont le texte a été écrit ou modifié par quelqu'un d'autre
// après sa dernière visite du chantier
function noteNouvelle_(r, compte, vues) {
  if (noteFaite_(r) || String(r[COL_N.texteParId - 1] || '') === compte.id) return false;
  return noteMs_(r[COL_N.texteLe - 1]) > (vues[cleChantier_(r[COL_N.chantier - 1])] || 0);
}
// Action « notesVues » { chantier, jusqua } : envoyée par la page APRÈS l'affichage de la liste, avec l'heure du serveur
// de cette liste (jamais celle du téléphone). La visite ne recule jamais et ne dépasse jamais l'heure du serveur.
// Avec { tous: true } (conducteurs et admin, depuis la vue « Tous chantiers ») : tous les chantiers qui ont des éléments.
function marquerNotesVues_(compte, corps) {
  const REFUS = { ok: false, code: 'INTERDIT', message: 'Ce chantier ne fait pas partie de vos chantiers : voyez avec le bureau.' };
  let chantiers;
  if (corps.tous === true) {
    if (!noteChef_(compte)) return avecJeton_(REFUS, compte);
    const vus = {};
    lignesNotes_().forEach(r => { const n = String(r[COL_N.chantier - 1] || '').trim(); if (n) vus[cleChantier_(n)] = n; });
    chantiers = Object.keys(vus).map(k => vus[k]);
  } else {
    const chantier = noteChantierConnu_(typeof corps.chantier === 'string' ? corps.chantier.trim().slice(0, NOTE_MAX_CHANTIER) : '');
    if (!chantier || !notePeutLire_(compte, chantier)) return avecJeton_(REFUS, compte);
    chantiers = [chantier];
  }
  const maintenant = Date.now();
  const jusqua = typeof corps.jusqua === 'number' && isFinite(corps.jusqua) && corps.jusqua > 0 ? Math.min(corps.jusqua, maintenant) : maintenant;
  const verrou = LockService.getScriptLock();
  if (!verrou.tryLock(5000)) return avecJeton_({ ok: false, code: 'SERVEUR_OCCUPE', message: 'Serveur occupé' }, compte);
  try {
    const sh = feuilleNotesVues_(), derniere = sh.getLastRow();
    const lignes = derniere > 1 ? sh.getRange(2, 1, derniere - 1, 3).getValues() : [];
    const nouvelles = [];
    chantiers.forEach(chantier => {
      for (let i = 0; i < lignes.length; i++) {
        if (String(lignes[i][0]) !== compte.id || cleChantier_(lignes[i][1]) !== cleChantier_(chantier)) continue;
        if (noteMs_(lignes[i][2]) < jusqua) sh.getRange(i + 2, 3).setValue(new Date(jusqua));
        return;
      }
      nouvelles.push([cellule_(compte.id), cellule_(chantier), new Date(jusqua)]);
    });
    // Les nouvelles lignes en UNE écriture (50 chantiers d'un coup ne tiennent pas le verrou du script 20 secondes)
    if (nouvelles.length) {
      const debut = sh.getLastRow() + 1, manque = debut + nouvelles.length - 1 - sh.getMaxRows();
      if (manque > 0) sh.insertRowsAfter(sh.getMaxRows(), manque + 50);
      sh.getRange(debut, 1, nouvelles.length, 2).setNumberFormat('@');
      sh.getRange(debut, 1, nouvelles.length, 3).setValues(nouvelles);
    }
  } finally { verrou.releaseLock(); }
  return avecJeton_({ ok: true, code: 'OK', message: 'Visite notée' }, compte);
}

// ── Lecture ──
// Ce que l'appli reçoit d'un élément : son numéro, son texte, s'il est fait, s'il est nouveau. Ni auteur, ni date.
function noteObjet_(r, compte, vues, avecChantier) {
  const o = { id: String(r[COL_N.id - 1]), texte: String(r[COL_N.texte - 1] || ''), fait: noteFaite_(r), nouveau: noteNouvelle_(r, compte, vues) };
  if (avecChantier) o.chantier = String(r[COL_N.chantier - 1] || '');
  return o;
}
// corps : { chantier?, recherche?, nouveau?, termines? }.
// Avec un chantier (accès au chantier) : ses éléments à faire (dans l'ordre où ils ont été ajoutés), puis ses éléments terminés
// (les derniers cochés en haut). Sans chantier : vue « Tous chantiers », réservée aux conducteurs et à l'admin ;
// les éléments terminés n'y sont rendus que sur demande (termines: true).
// Les filtres sont appliqués ICI, avant les plafonds : la recherche porte sur tous les éléments.
function listerNotes_(compte, corps) {
  const REFUS = { ok: false, code: 'INTERDIT', message: 'Ce chantier ne fait pas partie de vos chantiers : voyez avec le bureau.' };
  const demande = typeof corps.chantier === 'string' ? corps.chantier.trim().slice(0, NOTE_MAX_CHANTIER) : '';
  let chantier = '';
  if (demande) {
    chantier = noteChantierConnu_(demande);
    if (!chantier || !notePeutLire_(compte, chantier)) return avecJeton_(REFUS, compte);
  } else if (!noteChef_(compte)) {
    return avecJeton_({ ok: false, code: 'INTERDIT', message: 'La vue « Tous chantiers » est réservée aux conducteurs : ouvrez les notes depuis un chantier.' }, compte);
  }
  const minus = v => String(v || '').toLowerCase();
  const recherche = typeof corps.recherche === 'string' ? minus(corps.recherche.trim().slice(0, 100)) : '';
  const nouveau = corps.nouveau === true, avecTermines = !!demande || corps.termines === true;
  const heure = Date.now();   // heure du serveur de cette liste : la page la renvoie dans « notesVues »
  const vues = notesVues_(compte.id), lignes = lignesNotes_();
  const maxAFaire = demande ? NOTE_MAX_A_FAIRE : NOTE_MAX_TOUS, aFaire = [], termines = [];
  let plein = false;
  for (let i = lignes.length - 1; i >= 0; i--) {   // du plus récent au plus ancien : au-delà du plafond, ce sont les plus anciens qui manquent
    const r = lignes[i];
    if (demande && cleChantier_(r[COL_N.chantier - 1]) !== cleChantier_(chantier)) continue;
    if (recherche && minus(r[COL_N.texte - 1]).indexOf(recherche) < 0 && minus(r[COL_N.chantier - 1]).indexOf(recherche) < 0) continue;
    if (nouveau && !noteNouvelle_(r, compte, vues)) continue;
    if (noteFaite_(r)) { if (avecTermines) termines.push(r); continue; }
    if (aFaire.length < maxAFaire) aFaire.push(noteObjet_(r, compte, vues, !demande)); else plein = true;
  }
  aFaire.reverse();   // affichés comme une liste dictée : le plus ancien en haut, le dernier ajouté en bas
  // Éléments terminés : les derniers cochés en haut ; le nombre total est rendu même au-delà du plafond
  termines.sort((a, b) => noteMs_(b[COL_N.cocheLe - 1]) - noteMs_(a[COL_N.cocheLe - 1]));
  return avecJeton_({ ok: true, code: 'OK', message: aFaire.length + ' élément(s) à faire',
    data: { aFaire: aFaire, termines: termines.slice(0, NOTE_MAX_TERMINES).map(r => noteObjet_(r, compte, vues, !demande)), nbTermines: termines.length,
      chantier: chantier, heure: heure, plein: plein } }, compte);
}
// Nombre d'éléments nouveaux par chantier visible (chiffres rouges de l'accueil)
function notesNouvelles_(compte) {
  const visibles = {};   // les chantiers que l'accueil montre à ce compte (un poseur ne voit pas un chantier « Terminé »)
  chantiersVisibles_(compte).forEach(c => { visibles[cleChantier_(c.nom)] = true; });
  const vues = notesVues_(compte.id), parChantier = {};
  let total = 0;
  lignesNotes_().forEach(r => {
    if (!visibles[cleChantier_(r[COL_N.chantier - 1])] || !noteNouvelle_(r, compte, vues)) return;
    const nom = String(r[COL_N.chantier - 1]).trim();
    parChantier[nom] = (parChantier[nom] || 0) + 1; total++;
  });
  return avecJeton_({ ok: true, code: 'OK', message: total + ' élément(s) nouveau(x)', data: { parChantier: parChantier, total: total } }, compte);
}

// ── Installation du lot 3 (une fonction par environnement ; relançable sans danger) ──
function etapesLot3_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const etape = (nom, entetes, colonnesTexte) => ({
    nom: 'Onglet « ' + nom + ' »',
    fait: () => { const sh = ss.getSheetByName(nom); return !!sh && noteTitresBons_(sh, entetes); },
    action: () => {
      const sh = ss.getSheetByName(nom);
      if (!sh) { noteFeuille_(nom, entetes, colonnesTexte); return 'onglet créé'; }
      // Onglet déjà là : jamais rien réécrire par-dessus des données
      const titres = sh.getRange(1, 1, 1, Math.max(entetes.length, sh.getLastColumn())).getValues()[0];
      if (sh.getLastRow() > 1 || titres.some(t => String(t).trim() !== '')) throw new Error('un onglet « ' + nom + ' » existe déjà avec d’autres titres : le renommer, puis relancer');
      sh.getRange(1, 1, 1, entetes.length).setValues([entetes]);
      noteFormats_(sh, colonnesTexte);
      return 'onglet prêt';
    } });
  return [
    etape(SHEET_NOTES, NOTE_ENTETES, NOTE_COLONNES_TEXTE),
    etape(SHEET_NOTES_HISTO, NOTE_HISTO_ENTETES, NOTE_HISTO_TEXTE),
    etape(SHEET_NOTES_VUES, NOTE_VUES_ENTETES, [1, 2]),
  ];
}
function installerLot3_(attendu) { return installer_('Lot 3', attendu, etapesLot3_()).texte; }
function installerLot3Test() { return installerLot3_('TEST'); }
function installerLot3Production() { return installerLot3_('PRODUCTION'); }

// ████ Carnet.gs ████
// ═══════════════════════════════════════════════════════════════════════════
//  Carnet.gs — Lot 4 : carnet de chantier (plans et documents en pages-images)
//
//  Lu par la page carnet.html (commun/carnet.js). Mesuré sur la copie TEST le 13/11/2026 : docs/lot4-etape0.md.
//
//  Ce que le programme de dépôt écrit dans le dossier de chaque chantier (clé « carnet » de dossiers.json) :
//    CARNET/carnet.json                      la liste des documents (lue ici, jamais écrite par le serveur)
//    CARNET/<dossier du document>/…          les images : aperçu léger, aperçu net, et des PAQUETS de tuiles voisines
//  Un paquet est un fichier où les tuiles sont mises bout à bout ; carnet.json dit où commence chaque tuile.
//  Le serveur lit un paquet en entier avec DriveApp (aucune nouvelle autorisation) et n'en rend que les tuiles demandées.
//
//  Règles :
//   - droit vérifié à chaque demande (accès au chantier, comme les notes) ; même réponse pour « inconnu » et « interdit » ;
//   - ce fichier (le carnet) ne supprime RIEN et n'écrit rien dans le carnet. Seul le lot 5 (Purges.gs) met des dossiers
//     du carnet à la CORBEILLE de Drive, et seulement sur une case cochée par Franck dans l'onglet « Purges » : les anciens
//     indices que plus aucun document montré ne désigne, ou le carnet d'un chantier terminé. Jamais de suppression définitive ;
//   - aucun identifiant Drive ne part vers les téléphones ; un nom de fichier reçu n'est jamais utilisé : seuls les noms
//     écrits dans carnet.json le sont.
// ═══════════════════════════════════════════════════════════════════════════

const CARNET_FICHIER = 'carnet.json';
const CARNET_MAX_LECTURE = 300 * 1024;    // octets d'images par réponse, en lecture (une barre de réseau)
const CARNET_MAX_MASSE = 1500 * 1024;     // … et pour « Tout télécharger » (Wi-Fi)
const CARNET_MAX_TUILES = 64;             // tuiles demandées en une fois
const CARNET_CACHE_IDS_S = 21600;         // identifiants Drive gardés 6 h (le maximum du cache)
const CARNET_CACHE_LISTE_S = 600;         // liste gardée 10 min : un document déposé apparaît au plus tard 10 min après
const CARNET_CACHE_MAX = 30000;           // caractères par morceau (une valeur du cache ne dépasse pas 100 Ko, accents compris)
const CARNET_CACHE_MORCEAUX = 30;         // jusqu'à 900 000 caractères de liste ; au-delà, elle est relue à chaque demande
const CARNET_NOM_SUR = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;   // noms des fichiers d'images : jamais un chemin
const CARNET_REFUS = 'Ce chantier ne fait pas partie de vos chantiers : voyez avec le bureau.';

function carnetErreur_(code, message) { return Object.assign(new Error(message), { carnet: code }); }

// Le chantier demandé et son dossier CARNET (null : pas encore de carnet). Refus : chantier inconnu ou interdit.
function carnetChantier_(compte, corps) {
  const demande = typeof corps.chantier === 'string' ? corps.chantier.trim().slice(0, NOTE_MAX_CHANTIER) : '';
  const chantier = demande ? noteChantierConnu_(demande) : '';
  if (!chantier || !notePeutLire_(compte, chantier)) return null;
  const dossier = dossierChantier_(chantier, false);
  return { chantier: chantier, dossier: dossier ? dossier.getName() : '', carnet: dossier ? dossierParChemin_(dossier, dossiers_().documents.carnet, false) : null };
}

// La liste carnet.json du dossier CARNET : { liste, maj, doublon }. Deux fichiers de ce nom (Drive pour ordinateur en
// fabrique parfois) : le plus récent est pris, et « doublon » le signale.
function carnetListe_(carnet) {
  const cache = cacheScript_(), cle = 'carnet:liste:1:' + carnet.getId();
  const nombreGarde = Number(cache.get(cle + ':n')) || 0;
  if (nombreGarde > 0 && nombreGarde <= CARNET_CACHE_MORCEAUX) {
    const cles = []; for (let i = 0; i < nombreGarde; i++) cles.push(cle + ':' + i);
    const morceaux = cache.getAll(cles);
    if (cles.every(k => typeof morceaux[k] === 'string')) { try { return JSON.parse(cles.map(k => morceaux[k]).join('')); } catch (e) {} }
  }
  const it = carnet.getFilesByName(CARNET_FICHIER);
  let fichier = null, nombre = 0;
  while (it.hasNext()) {
    const f = it.next();
    if (f.isTrashed()) continue;
    nombre++;
    if (!fichier || f.getLastUpdated().getTime() > fichier.getLastUpdated().getTime()) fichier = f;
  }
  if (!fichier) {
    const sous = carnet.getFolders();
    while (sous.hasNext()) { if (!sous.next().isTrashed()) throw carnetErreur_('CARNET_ARRIVE', 'La liste du carnet est en cours d’arrivée : réessayez dans quelques minutes.'); }
    return { liste: { documents: [] }, maj: 0, doublon: false };
  }
  let liste;
  try { liste = JSON.parse(fichier.getBlob().getDataAsString('UTF-8')); } catch (e) { throw carnetErreur_('CARNET_ARRIVE', 'La liste du carnet est en cours d’arrivée : réessayez dans quelques minutes.'); }
  if (!liste || !Array.isArray(liste.documents)) throw carnetErreur_('CARNET_ARRIVE', 'La liste du carnet est en cours d’arrivée : réessayez dans quelques minutes.');
  const rendu = { liste: liste, maj: fichier.getLastUpdated().getTime(), doublon: nombre > 1 };
  // gardée par morceaux (une valeur du cache ne dépasse pas 100 Ko ; la liste d'un chantier riche en grands plans, si)
  const texte = JSON.stringify(rendu), parts = Math.ceil(texte.length / CARNET_CACHE_MAX);
  if (parts <= CARNET_CACHE_MORCEAUX) {
    const valeurs = {};
    for (let i = 0; i < parts; i++) valeurs[cle + ':' + i] = texte.slice(i * CARNET_CACHE_MAX, (i + 1) * CARNET_CACHE_MAX);
    valeurs[cle + ':n'] = String(parts);
    try { cache.putAll(valeurs, CARNET_CACHE_LISTE_S); } catch (e) {}
  }
  return rendu;
}

// Les documents montrés : jamais un document retiré, et pour chaque code seulement le DERNIER déposé (dernier indice)
function carnetDocuments_(liste, chantier, dossier) {
  // le programme de dépôt écrit le nom du chantier, ou à défaut celui de son dossier : les deux sont acceptés
  if (liste.chantier && cleChantier_(liste.chantier) !== cleChantier_(chantier) && cleChantier_(liste.chantier) !== cleChantier_(dossier)) throw carnetErreur_('CARNET_ARRIVE', 'Le carnet de ce dossier appartient à un autre chantier : prévenez le bureau.');
  const parCode = {}, ordre = [];
  liste.documents.forEach(d => {
    if (!d || d.retire === true || typeof d.id !== 'string' || !CARNET_NOM_SUR.test(d.id) || typeof d.dossier !== 'string' || !Array.isArray(d.pages)) return;
    if (/[\/\\]/.test(d.dossier) || !d.dossier.trim()) return;
    const code = String(d.code || d.id);
    if (!parCode[code]) ordre.push(code);
    parCode[code] = d;
  });
  return ordre.map(c => parCode[c]);
}

// Action « carnet » : la liste des documents du chantier ET leur description (pages, niveaux, paquets), en une demande
function carnetLister_(compte, corps) {
  const debut = Date.now(), ou = carnetChantier_(compte, corps);
  if (!ou) return avecJeton_({ ok: false, code: 'INTERDIT', message: CARNET_REFUS }, compte);
  try {
    const lu = ou.carnet ? carnetListe_(ou.carnet) : { liste: { documents: [] }, maj: 0, doublon: false };
    // « empreinte » : change dès qu'un document est redéposé sous le même identifiant (le téléphone efface alors ce qu'il en gardait)
    const empreinte = d => String(d.depose || [d.poids, d.pages.length, d.pages[0] && d.pages[0].leger && d.pages[0].leger.o, d.pages[0] && d.pages[0].net && d.pages[0].net.o, d.date].join('-'));
    const docs = carnetDocuments_(lu.liste, ou.chantier, ou.dossier).map(d => ({ id: d.id, code: String(d.code || ''), indice: String(d.indice || ''),
      intitule: String(d.intitule || ''), date: String(d.date || ''), poids: Number(d.poids) || 0, empreinte: empreinte(d), pages: d.pages }));
    return avecJeton_({ ok: true, code: 'OK', message: docs.length + ' document(s)',
      data: { chantier: ou.chantier, documents: docs, maj: lu.maj, heure: Date.now(), ms: Date.now() - debut } }, compte);
  } catch (e) {
    if (e && e.carnet) return avecJeton_({ ok: false, code: e.carnet, message: e.message }, compte);
    throw e;
  }
}

// Un fichier d'images du document, retrouvé par son nom (écrit dans carnet.json) puis par son identifiant gardé en cache.
// La clé du cache change avec la date de carnet.json : un nouveau dépôt ne sert jamais un ancien fichier.
function carnetFichier_(carnet, maj, doc, nom, taille) {
  if (typeof nom !== 'string' || !CARNET_NOM_SUR.test(nom)) throw carnetErreur_('CARNET_ARRIVE', 'Ce document est incomplet : prévenez le bureau.');
  const cache = cacheScript_(), cle = 'carnet:f:1:' + carnet.getId() + ':' + maj + ':' + doc.id + ':' + nom;
  const bon = f => !!f && !f.isTrashed() && (!taille || f.getSize() === taille);
  const id = cache.get(cle);
  if (id) { try { const f = DriveApp.getFileById(id); if (bon(f)) return f; } catch (e) {} cache.remove(cle); }
  const dossiers = carnet.getFoldersByName(doc.dossier);
  while (dossiers.hasNext()) {
    const d = dossiers.next();
    if (d.isTrashed()) continue;
    const it = d.getFilesByName(nom);
    while (it.hasNext()) { const f = it.next(); if (bon(f)) { cache.put(cle, f.getId(), CARNET_CACHE_IDS_S); return f; } }
  }
  throw carnetErreur_('CARNET_ARRIVE', 'Ce document est en cours d’arrivée : réessayez dans quelques minutes.');
}

// Action « carnetTuiles » : { chantier, doc, page (à partir de 1), quoi: 'leger' | 'net' | 'tuiles', niveau, tuiles: [[colonne, ligne], …], masse }
// Rend les images en base64. Pour les tuiles : autant que le plafond le permet (au moins une), le reste dans « reste ».
function carnetTuiles_(compte, corps) {
  const debut = Date.now(), ou = carnetChantier_(compte, corps);
  if (!ou || !ou.carnet) return avecJeton_({ ok: false, code: 'INTERDIT', message: CARNET_REFUS }, compte);
  try {
    const lu = carnetListe_(ou.carnet);
    const doc = carnetDocuments_(lu.liste, ou.chantier, ou.dossier).filter(d => d.id === corps.doc)[0];
    const page = doc && doc.pages[Number(corps.page) - 1];
    if (!page) return avecJeton_({ ok: false, code: 'CARNET_INCONNU', message: 'Ce document n’est plus au carnet : rouvrez la liste.' }, compte);
    const rendre = (images, reste, lus) => avecJeton_({ ok: true, code: 'OK', message: images.length + ' image(s)',
      data: { images: images, reste: reste, maj: lu.maj, ms: Date.now() - debut, octetsLus: lus } }, compte);
    if (corps.quoi === 'leger' || corps.quoi === 'net') {
      const im = page[corps.quoi];
      if (!im || !im.f) return avecJeton_({ ok: false, code: 'CARNET_INCONNU', message: 'Image absente : rouvrez la liste.' }, compte);
      const octets = carnetFichier_(ou.carnet, lu.maj, doc, im.f, Number(im.o) || 0).getBlob().getBytes();
      return rendre([{ quoi: corps.quoi, b64: Utilities.base64Encode(octets) }], [], octets.length);
    }
    const niveau = (Array.isArray(page.niveaux) ? page.niveaux : []).filter(n => n && n.z === Number(corps.niveau))[0];
    const voulues = Array.isArray(corps.tuiles) ? corps.tuiles.slice(0, CARNET_MAX_TUILES) : [];
    if (corps.quoi !== 'tuiles' || !niveau || !voulues.length) return avecJeton_({ ok: false, code: 'CARNET_INCONNU', message: 'Demande incomprise : rouvrez la liste.' }, compte);
    // Où est chaque tuile : « colonne,ligne » → [paquet, début, longueur]
    const ou2 = {};
    (niveau.paquets || []).forEach((p, i) => (p.tuiles || []).forEach(t => { ou2[t[0] + ',' + t[1]] = [i, Number(t[2]), Number(t[3])]; }));
    const plafond = corps.masse === true ? CARNET_MAX_MASSE : CARNET_MAX_LECTURE;
    const ouverts = {}, images = [], reste = [];
    let total = 0, lus = 0;
    voulues.forEach(v => {
      const cle = Array.isArray(v) ? Number(v[0]) + ',' + Number(v[1]) : '', place = ou2[cle];
      if (!place) return;                                              // tuile inconnue : ignorée
      if (images.length && total + place[2] > plafond) { reste.push([Number(v[0]), Number(v[1])]); return; }
      if (!ouverts[place[0]]) {
        const p = niveau.paquets[place[0]];
        ouverts[place[0]] = carnetFichier_(ou.carnet, lu.maj, doc, p.f, Number(p.o) || 0).getBlob().getBytes();
        lus += ouverts[place[0]].length;
      }
      const octets = ouverts[place[0]];
      if (!(place[1] >= 0) || !(place[2] > 0) || place[1] + place[2] > octets.length) throw carnetErreur_('CARNET_ARRIVE', 'Ce document est incomplet : prévenez le bureau.');
      images.push({ c: Number(v[0]), l: Number(v[1]), b64: Utilities.base64Encode(octets.slice(place[1], place[1] + place[2])) });
      total += place[2];
    });
    return rendre(images, reste, lus);
  } catch (e) {
    if (e && e.carnet) return avecJeton_({ ok: false, code: e.carnet, message: e.message }, compte);
    throw e;
  }
}

// ████ Stockage.gs ████
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

// ████ Purges.gs ████
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// LOT 5 — PURGES : libérer la place des chantiers terminés et des anciens indices du carnet, sans rien perdre.
// Les fiches sont d'abord recopiées dans le dossier du chantier sur le PC (que MEGA sauvegarde). La mesure et les alertes sont dans Stockage.gs.
//
// CE QUE CE FICHIER NE FAIT JAMAIS :
//   - aucune suppression définitive : il met à la CORBEILLE de Drive (30 jours), rien d'autre ;
//   - aucune mise à la corbeille sans une case cochée par Franck dans l'onglet « Purges » ;
//   - jamais le dossier d'un chantier, jamais le relevé releve-pc.json, jamais un fichier hors des dossiers de l'appli ;
//   - il ne prend jamais le verrou du script (celui des fiches) : une purge ne retarde jamais une fiche.
//
// Deux sortes de lignes dans l'onglet « Purges », proposées par la mesure de la nuit (prgProposerChantier_) :
//   « Anciens indices du carnet » : les dossiers de documents que carnet.json connaît et qu'AUCUN document montré dans
//       l'appli ne désigne (même fonction que le carnet des téléphones : carnetDocuments_) ;
//   « Chantier terminé » : fiches et photos (fichier par fichier, comparées une à une au relevé releve-pc.json du
//       programme du PC), puis le carnet (dossier de chaque document, carnet.json en dernier).
// traiterPurges() (toutes les 30 minutes) traite les cases : elle sort tout de suite s'il n'y a rien à faire ; sinon
// elle REVÉRIFIE tout, écrit chaque élément « à faire » dans « Purges détail » AVANT de le mettre à la corbeille,
// puis le marque « fait ». La case « Annuler » (25 jours) sort de la corbeille exactement ce que la ligne y a mis.
// Chaque ligne a une clé fixe (dernière colonne) : le serveur la retrouve par sa clé, même si Franck trie l'onglet,
// et n'efface ni ne déplace jamais une ligne.
// Plan : docs/lot5-plan.md (chapitre 4). Décisions : D5-… (DECISIONS.md).
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
const SHEET_PURGES = 'Purges';
const SHEET_PURGES_DETAIL = 'Purges détail';
const PRG_RELEVE = 'releve-pc.json';        // relevé de présence écrit par le programme du PC (seul nom accepté)
// Durée de conservation dans Drive après la clôture : un chantier « Terminé » n'est proposé à la purge qu'au bout de ce
// nombre de jours (décision de Franck du 14/11/2026 ; à changer ici, et nulle part ailleurs, s'il veut une autre durée)
const PRG_JOURS_APRES_TERMINE = 30;
// Le relevé releve-pc.json est refait par la recopie automatique du PC (toutes les heures), donc au moins une fois par jour :
const PRG_RELEVE_PROPOSITION_JOURS = 7;     // âge maximal du relevé pour PROPOSER la purge d'un chantier terminé
const PRG_RELEVE_PURGE_HEURES = 48;         // … et au moment où la case est traitée
const PRG_FICHIER_A_VOIR = 'CHANTIERPRO - A VOIR.txt';   // sur le PC : le fichier où la recopie automatique dit ce qui ne va pas
const PRG_ANNULATION_JOURS = 25;            // la case « Annuler » sert 25 jours
const PRG_CORBEILLE_JOURS = 30;             // Drive vide sa corbeille au bout de 30 jours : la place est libérée à ce moment-là
const PRG_PAQUET = 10;                      // fichiers (ou dossiers du carnet) journalisés puis mis à la corbeille par paquet
const PRG_MAX_MINUTES_JOUR = 30;            // temps passé à purger, par jour, toutes exécutions confondues (quota de 90 min de déclencheurs)
const PRG_DEPOT_RECENT_H = 24;              // un dossier du carnet modifié depuis moins de 24 h n'est pas touché (dépôt en cours ?)
const PRG_VERROU_MS = 7 * 60 * 1000;
const PRG_JOUR_MS = 24 * 3600 * 1000;
const PRG_QUOI = { indices: 'Anciens indices du carnet', termine: 'Chantier terminé', mails: 'Mails envoyés de plus de 3 mois' };
const PRG_COURT = { indices: 'anciens indices', termine: 'chantier terminé', mails: 'mails envoyés' };
const PRG_ETAT = { propose: 'Proposé', impossible: 'Impossible', enCours: 'En cours', fait: 'Fait', mail: 'Fait (mail à envoyer)',
  annulation: 'Annulation en cours', annule: 'Annulé' };
const PRG_ENTETES = ['Chantier', 'Quoi', 'Poids (Mo)', 'Fichiers', 'Possible ?', 'Pourquoi (ou ce qui manque)', 'Mettre à la corbeille', 'État', 'Message',
  'Mis à la corbeille le', 'Fichiers mis à la corbeille', 'Place libérée le', 'Annuler', 'Annulation possible jusqu’au', 'Mise à jour le', 'Clé (ne pas modifier)'];
const COL_P = { chantier: 1, quoi: 2, poids: 3, fichiers: 4, possible: 5, pourquoi: 6, corbeille: 7, etat: 8, message: 9, faitLe: 10, nbFaits: 11,
  libere: 12, annuler: 13, jusquau: 14, maj: 15, cle: 16 };
const PRG_COLONNES_TEXTE = [COL_P.chantier, COL_P.quoi, COL_P.possible, COL_P.pourquoi, COL_P.etat, COL_P.message, COL_P.cle];
const PRG_COLONNES_DATE = [COL_P.faitLe, COL_P.libere, COL_P.jusquau, COL_P.maj];
const PRG_DETAIL_ENTETES = ['Clé de la ligne', 'Type', 'Identifiant', 'Chemin', 'Taille (octets)', 'Fichiers', 'Noté le', 'État', 'Mis à jour le'];
const COL_D = { cle: 1, type: 2, id: 3, chemin: 4, taille: 5, fichiers: 6, note: 7, etat: 8, maj: 9 };
const PRG_RECOPIE = 'vérifie que la recopie automatique tourne sur le PC (fichier « ' + PRG_FICHIER_A_VOIR + ' »)';
const PRG_AVANT_DE_COCHER = 'Avant de cocher : vérifie sur le PC que MEGA a fini de sauvegarder le dossier du chantier. Le relevé devra avoir moins de '
  + PRG_RELEVE_PURGE_HEURES + ' heures au moment du traitement. Après la mise à la corbeille, la place n’est rendue que ' + PRG_CORBEILLE_JOURS + ' jours plus tard.';

// ── Onglets (titres contrôlés avant toute lecture et toute écriture) ──
function prgFeuille_(nom, entetes, colonnesTexte, colonnesDate, avertir) {
  const existait = !!SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nom);
  const sh = noteFeuille_(nom, entetes, colonnesTexte);
  if (!existait) {
    const lignes = Math.max(1, sh.getMaxRows() - 1);
    colonnesDate.forEach(c => sh.getRange(2, c, lignes, 1).setNumberFormat('dd/MM/yyyy HH:mm'));
    avertir.forEach(x => stkAvertir_(sh.getRange(1, x[0], sh.getMaxRows(), x[1]), 'Colonnes remplies par Loué App : ne pas les modifier (seules les cases se cochent ; le tri est permis).'));
  }
  if (!noteTitresBons_(sh, entetes)) throw stkOngletModifie_(nom);
  return sh;
}
function feuillePurges_() {
  // avertissement sur tout sauf les deux colonnes de cases
  return prgFeuille_(SHEET_PURGES, PRG_ENTETES, PRG_COLONNES_TEXTE, PRG_COLONNES_DATE,
    [[1, COL_P.corbeille - 1], [COL_P.etat, COL_P.annuler - COL_P.etat], [COL_P.jusquau, COL_P.cle - COL_P.jusquau + 1]]);
}
function feuillePurgesDetail_() {
  return prgFeuille_(SHEET_PURGES_DETAIL, PRG_DETAIL_ENTETES, [COL_D.cle, COL_D.type, COL_D.id, COL_D.chemin, COL_D.etat], [COL_D.note, COL_D.maj],
    [[1, PRG_DETAIL_ENTETES.length]]);
}
// Toutes les lignes de l'onglet Purges : [{ ligne, r }] (lignes sans clé ignorées)
function prgLignes_(sh) {
  const derniere = sh.getLastRow();
  if (derniere < 2) return [];
  return sh.getRange(2, 1, derniere - 1, PRG_ENTETES.length).getValues().map((r, i) => ({ ligne: i + 2, r: r })).filter(x => String(x.r[COL_P.cle - 1] || ''));
}
// Ligne d'une clé (0 si absente). Relu avant chaque écriture : Franck peut avoir trié l'onglet entre-temps.
function prgLigne_(sh, cle) {
  const derniere = sh.getLastRow();
  if (derniere < 2) return 0;
  const cles = sh.getRange(2, COL_P.cle, derniere - 1, 1).getValues();
  for (let i = 0; i < cles.length; i++) if (String(cles[i][0]) === cle) return i + 2;
  return 0;
}
// Écrit des cellules de la ligne d'une clé : { numéroDeColonne: valeur }. Rien d'autre n'est touché sur la ligne.
// siLibre : ne rien écrire si la ligne est entre-temps passée « En cours », « Annulation en cours » ou « Fait » (la mesure
// de la nuit et le traitement des cases peuvent se croiser).
function prgEcrire_(sh, cle, cellules, siLibre) {
  const ligne = prgLigne_(sh, cle);
  if (!ligne) return false;
  if (siLibre) { const e = sh.getRange(ligne, COL_P.etat).getValue(); if (prgEstFait_(e) || prgEstOccupe_(e)) return false; }
  cellules[COL_P.maj] = new Date(maintenant_());
  Object.keys(cellules).forEach(c => sh.getRange(ligne, Number(c)).setValue(cellule_(cellules[c])));
  return true;
}
// Clé d'une ligne : nature | chantier | identifiant du dossier | numéro (1, puis 2 quand une purge faite est suivie d'une autre)
function prgCleBase_(nature, c, idDossier) { return nature + '|' + c.cle + '|' + idDossier; }
function prgLireCle_(cle) {
  const m = String(cle).split('|');
  if (m.length < 4 || !PRG_QUOI[m[0]] || !/^\d+$/.test(m[m.length - 1])) return null;
  return { nature: m[0], chantier: m.slice(1, m.length - 2).join('|'), dossier: m[m.length - 2], n: Number(m[m.length - 1]) };
}
function prgEstFait_(etat) { return /^fait/i.test(String(etat)); }
function prgEstOccupe_(etat) { return /^(en cours|annulation en cours)/i.test(String(etat)); }

// ── Ce que le serveur sait, lu une fois par exécution ──
function prgEnvironnement_() {
  const ou = environnementReel_();
  if (ou.env === 'INCOHERENT') return 'environnement incohérent (la propriété ENVIRONNEMENT et le nom du Sheet ne disent pas la même chose) : aucune purge';
  let nom;
  try { nom = DriveApp.getFolderById(driveRootId_()).getName(); } catch (e) { return 'dossier racine du Drive introuvable : aucune purge'; }
  // La copie TEST et la production sont dans le même compte : la racine doit être celle de CET environnement
  if (ou.env === 'TEST' && !/TEST/i.test(nom)) return 'ce serveur est la copie TEST, mais son dossier racine ne s’appelle pas « … TEST … » : aucune purge';
  if (ou.env === 'PRODUCTION' && /TEST/i.test(nom)) return 'ce serveur est la production, mais son dossier racine s’appelle « … TEST … » : aucune purge';
  return '';
}
function prgContexte_(chantiers, cats) {
  let planning = '';
  try { planning = drivePlanningId_(); } catch (e) {}
  const lignesDossiers = stkLignesDossiers_(), idsDossiers = {};
  lignesDossiers.forEach(l => { if (l.id && !idsDossiers[l.id]) idsDossiers[l.id] = l.chantier; });   // identifiant de dossier → chantier
  return { racineId: driveRootId_(), planningId: planning, chantiers: chantiers || stkChantiers_(), lignesDossiers: lignesDossiers, idsDossiers: idsDossiers,
    cats: cats || stkCategories_(), carnetChemin: stkConf_().documents.carnet, env: prgEnvironnement_(), sousRacine: {} };
}

// Vrai si TOUS les dossiers qui contiennent l'élément mènent au dossier « cible » (jamais vrai pour la cible elle-même)
function prgDescendDe_(el, cibleId, cache) {
  const monter = (x, niveau) => {
    if (niveau > 25) return false;
    const it = x.getParents();
    let n = 0, bon = true;
    while (it.hasNext()) {
      const p = it.next(), id = p.getId();
      n++;
      if (id === cibleId) continue;
      if (cache[id] === undefined) { cache[id] = false; cache[id] = monter(p, niveau + 1); }
      if (!cache[id]) bon = false;
    }
    return n > 0 && bon;
  };
  return el.getId() !== cibleId && monter(el, 0);
}

// §4.1 — Le dossier du chantier : une ligne explicite de « Dossiers chantiers », sans « À vérifier », dont l'identifiant
// n'est porté par aucun autre chantier ; jamais par ressemblance de nom ; et bien dans le Drive de cet environnement.
function prgDossierSur_(c, ctx) {
  const non = raison => ({ ok: false, raison: raison });
  if (ctx.env) return non(ctx.env);
  if (!c || !c.lignes) return non('chantier absent de l’onglet Chantiers');
  if (c.lignes > 1) return non('deux lignes portent ce nom dans l’onglet Chantiers : corrige-le');
  const lignes = ctx.lignesDossiers.filter(l => l.cle === c.cle && l.id);
  if (!lignes.length) return non('le dossier de ce chantier n’est pas noté dans l’onglet « ' + SHEET_DOSSIERS + ' » (il n’est jamais pris par ressemblance de nom) : ajoute-y une ligne avec son identifiant');
  const ids = lignes.map(l => l.id).filter((x, i, t) => t.indexOf(x) === i);
  if (ids.length > 1) return non('plusieurs dossiers sont notés pour ce chantier dans « ' + SHEET_DOSSIERS + ' » : n’en garde qu’un');
  if (lignes.some(l => l.aVerifier)) return non('la ligne de ce chantier dans « ' + SHEET_DOSSIERS + ' » porte la mention « À vérifier » : vérifie que c’est le bon dossier, puis efface cette mention');
  const autres = ctx.lignesDossiers.filter(l => l.id === ids[0] && l.cle !== c.cle);
  if (autres.length) return non('le même dossier est noté pour un autre chantier (« ' + autres[0].chantier + ' ») dans « ' + SHEET_DOSSIERS + ' »');
  let d;
  try { d = DriveApp.getFolderById(ids[0]); } catch (e) { return non('le dossier noté dans « ' + SHEET_DOSSIERS + ' » est introuvable dans Drive'); }
  if (d.isTrashed()) return non('le dossier du chantier est à la corbeille');
  if (ids[0] === ctx.racineId || ids[0] === ctx.planningId || estDossierTechnique_(d)) return non('le dossier noté dans « ' + SHEET_DOSSIERS + ' » n’est pas un dossier de chantier');
  if (!prgDescendDe_(d, ctx.racineId, ctx.sousRacine)) return non('le dossier du chantier n’est pas dans le Drive de cet environnement');
  const dessus = prgChantierAuDessus_(d, ctx);
  if (dessus) return non('le dossier de ce chantier est rangé dans le dossier d’un autre chantier (« ' + dessus + ' ») : sors-le de là');
  return { ok: true, dossier: d, id: ids[0] };
}
// Le dossier est-il rangé, à n'importe quelle profondeur, dans le dossier d'un autre chantier ? Rend le nom de ce chantier, ou ''.
function prgChantierAuDessus_(dossier, ctx) {
  let niveau = [dossier];
  for (let n = 0; n < 25 && niveau.length; n++) {
    const suivants = [];
    for (let i = 0; i < niveau.length; i++) {
      const it = niveau[i].getParents();
      while (it.hasNext()) {
        const p = it.next(), id = p.getId();
        if (id === ctx.racineId) continue;
        if (ctx.idsDossiers[id]) return ctx.idsDossiers[id];
        suivants.push(p);
      }
    }
    niveau = suivants;
  }
  return '';
}

// §4.3-1 — « Terminé » depuis au moins PRG_JOURS_APRES_TERMINE jours : '' si c'est le cas, sinon ce qui manque
function prgTermineDepuis_(c) {
  if (!c || c.statut !== STATUTS_CHANTIER[2]) return 'le chantier n’est pas au statut « Terminé »';
  if (c.termine === null) return 'pas de date « Terminé » dans l’onglet Chantiers (elle se pose toute seule à la prochaine mesure, puis il faut attendre ' + PRG_JOURS_APRES_TERMINE + ' jours)';
  if (isNaN(c.termine)) return 'date « Terminé » illisible dans l’onglet Chantiers : écris-la sous la forme 31/12/2026';
  const maintenant = maintenant_();
  if (c.termine > maintenant) return 'date « Terminé » dans le futur (' + stkJour_(c.termine) + ') : elle est ignorée, corrige-la';
  const possible = c.termine + PRG_JOURS_APRES_TERMINE * PRG_JOUR_MS;
  if (possible > maintenant) return 'terminé depuis le ' + stkJour_(c.termine) + ' : purge possible à partir du ' + stkJour_(possible) + ' (' + PRG_JOURS_APRES_TERMINE + ' jours après la clôture)';
  return '';
}

// §4.3-2 — Le relevé releve-pc.json : ce qui est dans le dossier du chantier sur le PC (format : docs/contrat-skills.md) à la racine du dossier du chantier.
// ageMaxMs : âge maximal du relevé, en millisecondes. Rend { ok, raison, lignes: { '/chemin': [tailles] }, date }.
function prgReleve_(dossier, c, ageMaxMs) {
  const non = raison => ({ ok: false, raison: raison });
  const relancer = ' : ' + PRG_RECOPIE + ', puis attends la prochaine mesure';
  const it = dossier.getFilesByName(PRG_RELEVE), trouves = [];
  while (it.hasNext()) { const f = it.next(); if (!f.isTrashed()) trouves.push(f); }
  if (!trouves.length) return non('pas de relevé « ' + PRG_RELEVE + ' » dans le dossier du chantier' + relancer);
  if (trouves.length > 1) return non('deux relevés « ' + PRG_RELEVE + ' » dans le dossier du chantier : supprime le plus ancien' + relancer);
  let lu;
  try { lu = JSON.parse(trouves[0].getBlob().getDataAsString('UTF-8')); } catch (e) { return non('relevé « ' + PRG_RELEVE + ' » illisible' + relancer); }
  if (!lu || typeof lu !== 'object' || Number(lu.version) !== 1 || !Array.isArray(lu.fichiers)) return non('relevé « ' + PRG_RELEVE + ' » d’un format inconnu' + relancer);
  if (typeof lu.chantier !== 'string' || cleChantier_(stkNfc_(lu.chantier)) !== cleChantier_(stkNfc_(c.nom))) {
    return non('le relevé « ' + PRG_RELEVE + ' » est celui d’un autre chantier (« ' + String(lu.chantier).slice(0, 80) + ' ») : rien n’est proposé');
  }
  const date = typeof lu.releve_le === 'string' ? Date.parse(lu.releve_le) : NaN;
  if (isNaN(date)) return non('date du relevé illisible' + relancer);
  const maintenant = maintenant_();
  if (date > maintenant + 3600 * 1000) return non('relevé daté du futur (' + stkJour_(date) + ') : vérifie l’horloge du PC' + relancer);
  const limite = ageMaxMs >= 3 * PRG_JOUR_MS ? Math.round(ageMaxMs / PRG_JOUR_MS) + ' jours' : Math.round(ageMaxMs / 3600000) + ' heures';
  if (maintenant - date > ageMaxMs) return non('relevé du ' + texteDate_(date) + ' : il a plus de ' + limite + relancer);
  const lignes = {};
  for (let i = 0; i < lu.fichiers.length; i++) {
    const f = lu.fichiers[i];
    if (!f || typeof f.chemin !== 'string' || typeof f.taille !== 'number' || !(f.taille >= 0)) return non('relevé « ' + PRG_RELEVE + ' » mal rempli (ligne ' + (i + 1) + ')' + relancer);
    const cle = '/' + stkNfc_(f.chemin);   // accents comparés sans tenir compte de leur codage
    (lignes[cle] = lignes[cle] || []).push(f.taille);
  }
  return { ok: true, raison: '', lignes: lignes, date: date };
}
// §4.3-3 — Chaque fiche du Drive correspond à UNE ligne distincte du relevé : même chemin, même taille.
function prgComparer_(liste, releve) {
  const reste = {}, vus = {}, r = { absents: [], tailles: [], doublons: [] };
  Object.keys(releve.lignes).forEach(k => { reste[k] = releve.lignes[k].slice(); });
  liste.forEach(f => {
    const cle = '/' + f.chemin;
    if (vus[cle]) { if (r.doublons.indexOf(f.chemin) < 0) r.doublons.push(f.chemin); }
    vus[cle] = true;
    const t = reste[cle];
    if (!t) { r.absents.push(f.chemin); return; }
    const i = t.indexOf(f.taille);
    if (i < 0) { r.tailles.push(f.chemin); return; }
    t.splice(i, 1);   // une ligne du relevé ne sert qu'une fois
  });
  return r;
}
// §4.3-4 — Envois en attente ou abandonnés pour ce chantier (onglet « Mails en attente », lu seulement)
function prgEnvoisEnAttente_(c) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ATTENTE);
  if (!sh || sh.getLastRow() < 2) return 0;
  return sh.getRange(2, 1, sh.getLastRow() - 1, 11).getValues()
    .filter(r => cleChantier_(r[2]) === c.cle && (r[10] === 'en attente' || r[10] === 'abandonné')).length;
}

// §4.2 — Le carnet d'un chantier, vu PAR DOSSIER de document, avec la même lecture que celle des téléphones.
// Rend { existe, erreur, dossier, id, maj, json, manquants: [documents montrés sans dossier], anciens: [dossiers que plus aucun document montré ne désigne],
//        tous: [dossiers connus de carnet.json], laisses: [textes] }.
// Un dossier inconnu de carnet.json (dépôt en cours, posé à la main), mal décrit, ou en double : jamais rendu.
function prgCarnet_(dossierChantier, c, ctx) {
  const r = { existe: false, erreur: '', dossier: null, id: '', maj: 0, json: null, anciens: [], tous: [], laisses: [], manquants: [] };
  const carnets = sousDossiersParChemin_(dossierChantier, ctx.carnetChemin);
  if (!carnets.length) return r;
  r.existe = true;
  if (carnets.length > 1) { r.erreur = 'deux dossiers « ' + ctx.carnetChemin + ' » dans ce chantier : le carnet n’est pas touché'; return r; }
  r.dossier = carnets[0]; r.id = r.dossier.getId();
  cacheScript_().remove('carnet:liste:1:' + r.id + ':n');   // jamais la liste gardée 10 minutes : relue dans Drive
  let lu, montres;
  try { lu = carnetListe_(r.dossier); montres = carnetDocuments_(lu.liste, c.nom, dossierChantier.getName()); }
  catch (e) { if (!e || !e.carnet) throw e; r.erreur = 'carnet : ' + e.message; return r; }
  if (lu.doublon) { r.erreur = 'deux listes « ' + CARNET_FICHIER + ' » dans le carnet : supprime la plus ancienne'; return r; }
  r.maj = lu.maj;
  const fichiers = r.dossier.getFilesByName(CARNET_FICHIER);
  while (fichiers.hasNext()) { const f = fichiers.next(); if (!f.isTrashed()) r.json = f; }
  const large = s => stkNfc_(s).trim().toLowerCase();
  const montresParNom = {}, connus = {}, douteux = {};
  montres.forEach(d => { montresParNom['/' + large(d.dossier)] = true; });
  lu.liste.documents.forEach(d => {
    if (!d || typeof d.dossier !== 'string') return;
    const bon = typeof d.id === 'string' && CARNET_NOM_SUR.test(d.id) && Array.isArray(d.pages) && !/[\/\\]/.test(d.dossier) && !!d.dossier.trim();
    if (bon) connus['/' + stkNfc_(d.dossier)] = true; else douteux['/' + large(d.dossier)] = true;
  });
  const sous = [], compte = {};
  const it = r.dossier.getFolders();
  while (it.hasNext()) {
    const d = it.next();
    if (d.isTrashed()) continue;
    const nom = stkNfc_(d.getName());
    sous.push({ id: d.getId(), nom: nom, api: d });
    compte['/' + large(nom)] = (compte['/' + large(nom)] || 0) + 1;
  }
  sous.forEach(x => {
    const cle = '/' + large(x.nom);
    if (compte[cle] > 1) r.laisses.push('« ' + x.nom + ' » (deux dossiers de ce nom)');
    else if (douteux[cle]) r.laisses.push('« ' + x.nom + ' » (mal décrit dans la liste du carnet)');
    else if (!connus['/' + x.nom]) r.laisses.push('« ' + x.nom + ' » (inconnu de la liste du carnet : dépôt en cours ?)');
    else if (prgRecent_(x.api)) r.laisses.push('« ' + x.nom + ' » (modifié depuis moins de ' + PRG_DEPOT_RECENT_H + ' heures : dépôt en cours ?)');
    else { r.tous.push(x); if (!montresParNom[cle]) r.anciens.push(x); }
  });
  // Les documents MONTRÉS dans l'appli dont le dossier d'images manque ou est à la corbeille
  montres.forEach(d => { if (!compte['/' + large(d.dossier)]) r.manquants.push({ id: String(d.id), dossier: stkNfc_(d.dossier) }); });
  return r;
}
function prgElementsCarnet_(dossiers, ctx, depasse, r) {
  const aucun = { carnet: '', photos: '', fiches: [] };
  dossiers.forEach(x => {
    const p = stkInventaire_(x.api, aucun, depasse, false, ctx.idsDossiers);
    if (!p.complet && r.raisons.indexOf(PRG_TROP_GROS) < 0) r.raisons.push(PRG_TROP_GROS);
    if (p.etrangers.length) r.raisons.push(prgEtrangers_(p.etrangers));
    r.items.push({ type: 'dossier', id: x.id, chemin: ctx.cats.carnet + '/' + x.nom, taille: p.total, fichiers: p.fichiers });
    r.octets += p.total; r.nb += p.fichiers;
  });
}
const PRG_TROP_GROS = 'dossier trop gros pour être lu en un passage : rien n’est proposé';
function prgLaisses_(car) {
  return car.laisses.length ? car.laisses.length + ' dossier(s) du carnet laissé(s) en place : ' + stkCourt_(car.laisses) : '';
}

// Un dossier de document du carnet touché depuis moins de 24 heures (lui-même ou l'un de ses fichiers) : un dépôt est
// peut-être en cours de synchronisation, il n'est ni proposé ni mis à la corbeille
function prgRecent_(dossier) {
  const limite = maintenant_() - PRG_DEPOT_RECENT_H * 3600 * 1000;
  try {
    if (dossier.getLastUpdated().getTime() > limite) return true;
    const it = dossier.getFiles();
    while (it.hasNext()) { const f = it.next(); if (!f.isTrashed() && f.getLastUpdated().getTime() > limite) return true; }
  } catch (e) { return true; }   // date illisible : dans le doute, on n'y touche pas
  return false;
}

// Garde appelée juste avant CHAQUE mise à la corbeille : '' si elle est permise, sinon la raison du refus
function prgGarde_(dossierChantier, ctx, carnet) {
  const cache = {}, idChantier = dossierChantier.getId(), idCarnet = carnet ? carnet.getId() : '';
  let sousRacine = null;   // la remontée « dossier du chantier → racine » n'est faite qu'une fois par exécution
  return (api, item) => {
    const id = api.getId();
    if (id === idChantier || id === ctx.racineId || id === ctx.planningId || id === idCarnet) return 'dossier protégé';
    if (api.getName() === PRG_RELEVE) return 'le relevé n’est jamais mis à la corbeille';
    if (api.isTrashed()) return 'déjà à la corbeille';
    if (item.type === 'fichier' && Number(api.getSize()) !== item.taille) return 'taille changée depuis la comparaison';
    if (item.type === 'dossier' || item.liste) {
      // un dossier de document, et la liste du carnet, sont directement dans le dossier du carnet
      const it = api.getParents();
      let n = 0, bon = true;
      while (it.hasNext()) { n++; if (it.next().getId() !== idCarnet) bon = false; }
      if (!idCarnet || !n || !bon) return 'hors du dossier du carnet';
    }
    if (item.type === 'dossier' && prgRecent_(api)) return 'modifié depuis moins de ' + PRG_DEPOT_RECENT_H + ' heures (dépôt en cours ?)';
    if (item.liste) {
      // carnet.json en dernier, et seulement s'il ne reste plus aucun dossier dans le carnet
      const it = carnet.getFolders();
      while (it.hasNext()) if (!it.next().isTrashed()) return 'des dossiers du carnet sont restés en place : la liste est gardée';
    }
    if (!prgDescendDe_(api, idChantier, cache)) return 'hors du dossier du chantier';
    // « descend de la racine de cet environnement » (la copie TEST et la production sont dans le même compte)
    if (sousRacine === null) sousRacine = !ctx.env && prgDescendDe_(dossierChantier, ctx.racineId, ctx.sousRacine);
    if (!sousRacine) return 'hors du Drive de cet environnement';
    return '';
  };
}
function prgEtrangers_(etrangers) {
  return 'le dossier d’un autre chantier (« ' + etrangers[0].nom + ' ») est rangé dans ce dossier (« ' + etrangers[0].chemin + ' ») : sors-le de là ; rien n’est proposé tant qu’il y est';
}

// ── Les deux examens. Chacun rend { possible, raisons, infos, items, octets, nb, dossierId, garde, carnet } ──
// items : ce qui serait mis à la corbeille, dans l'ordre. LECTURE SEULE.
function prgExaminerIndices_(c, ctx, depasse, dossierMesure) {
  const r = { possible: false, raisons: [], infos: [], items: [], octets: 0, nb: 0, dossierId: '', garde: null, carnet: null };
  const ident = prgDossierSur_(c, ctx);
  if (!ident.ok) r.raisons.push(ident.raison); else r.dossierId = ident.id;
  const dossier = ident.ok ? ident.dossier : dossierMesure;
  if (!dossier) return r;
  const car = r.carnet = prgCarnet_(dossier, c, ctx);
  if (car.erreur) { r.raisons.push(car.erreur); return r; }
  prgElementsCarnet_(car.anciens, ctx, depasse, r);
  if (prgLaisses_(car)) r.infos.push(prgLaisses_(car));
  if (!r.items.length && !r.raisons.length) r.raisons.push('aucun ancien indice à mettre à la corbeille');
  if (ident.ok) r.garde = prgGarde_(ident.dossier, ctx, car.dossier);
  r.possible = ident.ok && !r.raisons.length && r.items.length > 0;
  return r;
}
function prgExaminerTermine_(c, ctx, ageReleveMs, depasse, inv, dossierMesure) {
  const r = { possible: false, raisons: [], infos: [], items: [], octets: 0, nb: 0, dossierId: '', garde: null, carnet: null };
  const quand = prgTermineDepuis_(c);
  if (quand) r.raisons.push(quand);
  const ident = prgDossierSur_(c, ctx);
  if (!ident.ok) { r.raisons.push(ident.raison); return r; }   // sans dossier sûr, rien d'autre n'est lu
  r.dossierId = ident.id;
  const attente = prgEnvoisEnAttente_(c);
  if (attente) r.raisons.push(attente + ' envoi(s) en attente ou abandonné(s) pour ce chantier (onglet « ' + SHEET_ATTENTE + ' ») : attends qu’ils partent, ou règle-les');
  const releve = prgReleve_(ident.dossier, c, ageReleveMs);
  if (!releve.ok) r.raisons.push(releve.raison);
  if (!inv || !dossierMesure || dossierMesure.getId() !== ident.id) inv = stkInventaire_(ident.dossier, ctx.cats, depasse, true, ctx.idsDossiers);
  if (!inv.complet) r.raisons.push(PRG_TROP_GROS);
  // Le dossier d'un AUTRE chantier rangé quelque part dans celui-ci : ses fiches ne sont jamais lues comme celles de ce
  // chantier (le parcours n'y descend pas), et la purge est bloquée tant qu'il y est
  if (inv.etrangers && inv.etrangers.length) r.raisons.push(prgEtrangers_(inv.etrangers));
  if (releve.ok) {
    const cmp = prgComparer_(inv.liste, releve), exemples = t => stkCourt_(t.slice(0, 3).map(x => '« ' + x + ' »')) + (t.length > 3 ? '…' : '');
    if (cmp.doublons.length) r.raisons.push('deux fichiers de même nom dans un dossier du Drive (' + exemples(cmp.doublons) + ') : renomme-en un, puis attends la prochaine recopie du PC et la prochaine mesure');
    if (cmp.absents.length) r.raisons.push(cmp.absents.length + ' fiche(s) ou photo(s) absente(s) du relevé (' + exemples(cmp.absents) + ') : ' + PRG_RECOPIE + ', puis attends la prochaine mesure');
    if (cmp.tailles.length) r.raisons.push(cmp.tailles.length + ' fichier(s) dont la taille n’est pas celle du relevé (' + exemples(cmp.tailles) + ') : ' + PRG_RECOPIE + ', puis attends la prochaine mesure');
  }
  // Fiches et photos : fichier par fichier, seulement ceux qui viennent d'être comparés. Les dossiers restent en place.
  inv.liste.forEach(f => { r.items.push({ type: 'fichier', id: f.id, chemin: f.chemin, taille: f.taille, fichiers: 1 }); r.octets += f.taille; r.nb++; });
  // Le carnet : le dossier de chaque document, puis carnet.json en dernier
  const car = r.carnet = prgCarnet_(ident.dossier, c, ctx);
  if (car.erreur) r.raisons.push(car.erreur);
  else if (car.existe) {
    prgElementsCarnet_(car.tous, ctx, depasse, r);
    if (prgLaisses_(car)) r.infos.push(prgLaisses_(car) + ' ; la liste « ' + CARNET_FICHIER + ' » est gardée');
    else if (car.json) {
      const t = Number(car.json.getSize()) || 0;
      r.items.push({ type: 'fichier', id: car.json.getId(), chemin: ctx.cats.carnet + '/' + CARNET_FICHIER, taille: t, fichiers: 1, liste: true });
      r.octets += t; r.nb++;
    }
  }
  if (inv.nb.autres) r.infos.push(inv.nb.autres + ' fichier(s) hors des dossiers de l’appli (relevé compris) : laissé(s) en place');
  if (!r.items.length && !r.raisons.length) r.raisons.push('rien à mettre à la corbeille : ni fiche, ni photo, ni carnet dans ce dossier');
  r.garde = prgGarde_(ident.dossier, ctx, car.dossier);
  r.possible = !r.raisons.length && r.items.length > 0;
  return r;
}
function prgExaminer_(nature, c, ctx, ageReleveMs, depasse, inv, dossierMesure) {
  return nature === 'termine' ? prgExaminerTermine_(c, ctx, ageReleveMs, depasse, inv, dossierMesure) : prgExaminerIndices_(c, ctx, depasse, dossierMesure);
}
function prgPourquoi_(nature, exam) {
  const phrase = t => t.charAt(0).toUpperCase() + t.slice(1);
  if (exam.possible && exam.pourquoi) return exam.pourquoi;
  if (exam.possible) {
    return ['Possible : ' + exam.nb + ' fichier(s) partiraient à la corbeille.'].concat(exam.infos.map(x => phrase(x) + '.'))
      .concat(nature === 'termine' ? [PRG_AVANT_DE_COCHER] : ['Ces indices ne sont plus montrés dans l’appli ; les PDF d’origine sont dans le dossier du chantier sur le PC.']).join(' ');
  }
  return exam.raisons.concat(exam.infos).map(x => phrase(x) + '.').join(' ');
}

// ── Propositions : appelée par la mesure de la nuit pour chaque dossier porté par UN chantier ──
// Rend ce que l'onglet « Stockage » affiche : { indices, indicesMo, depot, texte }.
function prgProposerChantier_(u, inv, ctx, depasse) {
  const sh = feuillePurges_();
  const c = ctx.chantiers[u.cles[0]] || { nom: u.noms[0], cle: u.cles[0], statut: '', termine: null, lignes: 0 };
  const rendu = { indices: '', indicesMo: '', depot: '', texte: '' }, textes = [];
  const exI = prgExaminerIndices_(c, ctx, depasse, u.dossier);
  const carnetLu = exI.carnet && exI.carnet.existe && !exI.carnet.erreur;
  if (carnetLu) {
    rendu.depot = exI.carnet.maj ? new Date(exI.carnet.maj) : '';
    rendu.indices = exI.items.length; rendu.indicesMo = stkMo_(exI.octets);
  }
  textes.push(prgProposer_(sh, 'indices', c, u.id, exI, exI.items.length > 0));
  // Un document MONTRÉ dans l'appli dont le dossier d'images manque ou est à la corbeille (un ancien indice purgé redevient
  // le document montré quand le nouvel indice est retiré) : dit dans Stockage, et sur la ou les lignes « Fait » qui ont mis
  // ce dossier à la corbeille (retrouvées par le journal) — jamais sur une ligne « Proposé », où « Annuler » ne ferait rien
  if (carnetLu && exI.carnet.manquants.length) {
    const ids = stkCourt_(exI.carnet.manquants.map(x => x.id)), chemins = {}, cles = {};
    exI.carnet.manquants.forEach(x => { chemins['/' + ctx.cats.carnet + '/' + x.dossier] = true; });
    const shD = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PURGES_DETAIL);
    if (shD) prgDetail_(shD).forEach(x => { if (String(x.r[COL_D.etat - 1]) === 'fait' && chemins['/' + x.r[COL_D.chemin - 1]]) cles['/' + x.r[COL_D.cle - 1]] = true; });
    const faites = prgLignes_(sh).filter(x => cles['/' + x.r[COL_P.cle - 1]] && prgEstFait_(x.r[COL_P.etat - 1]));
    const lesquelles = faites.map(x => '« ' + x.r[COL_P.quoi - 1] + ' »' + (stkEstDate_(x.r[COL_P.faitLe - 1]) ? ' mise à la corbeille le ' + stkJour_(x.r[COL_P.faitLe - 1].getTime()) : ''));
    textes.unshift('⚠ ' + exI.carnet.manquants.length + ' document(s) du carnet montré(s) dans l’appli sans leurs images (' + ids + ') : '
      + (faites.length ? 'coche « Annuler » sur la ligne ' + lesquelles.join(', ou ') + ' de ce chantier (onglet « ' + SHEET_PURGES + ' »), ou redépose le document'
        : 'redépose le document (aucune purge annulable ne contient ses images)'));
    const alerte = '⚠ Cette purge a emporté les images d’un document que l’appli montre de nouveau (' + ids + ') : coche « Annuler » sur CETTE ligne, ou redépose le document.';
    faites.forEach(x => {
      const message = String(x.r[COL_P.message - 1] || '');
      if (message.indexOf(alerte) > -1) return;
      const m = {};
      m[COL_P.message] = alerte + ' ' + message;
      prgEcrire_(sh, String(x.r[COL_P.cle - 1]), m);
    });
  }
  const termine = c.statut === STATUTS_CHANTIER[2];
  const active = prgActive_(prgLignes_(sh), prgCleBase_('termine', c, u.id));
  if (termine || (active && !prgEstFait_(active.r[COL_P.etat - 1]))) {
    textes.push(prgProposer_(sh, 'termine', c, u.id, prgExaminerTermine_(c, ctx, PRG_RELEVE_PROPOSITION_JOURS * PRG_JOUR_MS, depasse, inv, u.dossier), termine));
  }
  rendu.texte = textes.filter(Boolean).join(' ; ');
  return rendu;
}
// La ligne en service d'une base de clé : celle du plus grand numéro
function prgActive_(lignes, base) {
  let active = null;
  lignes.forEach(x => {
    const cle = String(x.r[COL_P.cle - 1]);
    if (cle.indexOf(base + '|') !== 0) return;
    const n = Number(cle.slice(base.length + 1));
    if (n > 0 && (!active || n > active.n)) active = { ligne: x.ligne, r: x.r, n: n, cle: cle };
  });
  return active;
}
// Plus grand numéro déjà utilisé pour cette base dans le journal « Purges détail » (une ligne « Fait » supprimée de l'onglet
// Purges ne doit jamais faire réutiliser sa clé : le journal de l'ancienne purge se mélangerait à la nouvelle)
function prgNumeroJournal_(base) {
  const shD = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PURGES_DETAIL);
  let max = 0;
  if (!shD || shD.getLastRow() < 2) return max;
  shD.getRange(2, COL_D.cle, shD.getLastRow() - 1, 1).getValues().forEach(v => {
    const cle = String(v[0]);
    if (cle.indexOf(base + '|') !== 0) return;
    const n = Number(cle.slice(base.length + 1));
    if (n > max) max = n;
  });
  return max;
}
// Écrit la proposition : une nouvelle ligne si la base n'en a pas (ou si la précédente est « Fait » et qu'il y a de nouveau
// quelque chose), sinon ses cellules de proposition sont mises à jour. Les cases, les dates d'une purge faite, les lignes
// en cours : jamais touchées. creer : faut-il une ligne s'il n'y en a pas ?
function prgProposer_(sh, nature, c, idDossier, exam, creer) {
  const base = prgCleBase_(nature, c, idDossier), active = prgActive_(prgLignes_(sh), base);
  const etat = active ? String(active.r[COL_P.etat - 1]) : '', court = PRG_COURT[nature];
  if (active && prgEstOccupe_(etat)) return court + ' : purge en cours';
  const fait = active && prgEstFait_(etat);
  const quand = fait && stkEstDate_(active.r[COL_P.faitLe - 1]) ? ' le ' + stkJour_(active.r[COL_P.faitLe - 1].getTime()) : '';
  if (fait && !exam.items.length) return court + ' : mis à la corbeille' + quand;
  if (!active && !creer) return '';
  const cellules = {};
  cellules[COL_P.chantier] = c.nom; cellules[COL_P.quoi] = PRG_QUOI[nature];
  cellules[COL_P.poids] = stkMo_(exam.octets); cellules[COL_P.fichiers] = exam.nb;
  cellules[COL_P.possible] = exam.possible ? 'oui' : 'non'; cellules[COL_P.pourquoi] = prgPourquoi_(nature, exam);
  cellules[COL_P.etat] = exam.possible ? PRG_ETAT.propose : PRG_ETAT.impossible;
  if (!active || fait) {
    const cle = base + '|' + (Math.max(active ? active.n : 0, prgNumeroJournal_(base)) + 1), ligne = sh.getLastRow() + 1;
    stkAssurerLignes_(sh, ligne);
    PRG_COLONNES_TEXTE.forEach(col => sh.getRange(ligne, col).setNumberFormat('@'));
    sh.getRange(ligne, COL_P.corbeille).insertCheckboxes(); sh.getRange(ligne, COL_P.annuler).insertCheckboxes();
    const valeurs = PRG_ENTETES.map((t, i) => cellules[i + 1] === undefined ? '' : cellules[i + 1]);
    valeurs[COL_P.corbeille - 1] = false; valeurs[COL_P.annuler - 1] = false;
    valeurs[COL_P.maj - 1] = new Date(maintenant_()); valeurs[COL_P.cle - 1] = cle;
    sh.getRange(ligne, 1, 1, PRG_ENTETES.length).setValues([valeurs.map(cellule_)]);
  } else if (!prgEcrire_(sh, active.cle, cellules, true)) return court + ' : purge en cours';   // l'état a changé entre la lecture et l'écriture
  return court + (exam.possible ? ' : purge possible (onglet « ' + SHEET_PURGES + ' »)' : ' : purge impossible pour l’instant (onglet « ' + SHEET_PURGES + ' »)');
}

// ── Journal « Purges détail » ──
function prgElement_(type, id) { return type === 'mail' ? prgMailElement_(id) : type === 'dossier' ? DriveApp.getFolderById(id) : DriveApp.getFileById(id); }
// Les mots de la ligne et du mail, selon que la purge porte sur Drive ou sur les mails envoyés
function prgMots_(cle, texte) {
  const k = prgLireCle_(cle);
  if (!k || k.nature !== 'mails') return texte;
  return texte.replace(/fichier\(s\) ou dossier\(s\)/g, 'mail(s)').replace(/fichier\(s\)/g, 'mail(s)').replace(/corbeille de Drive/g, 'corbeille de Gmail')
    .replace(/ ; ils sont dans le dossier du chantier sur le PC/g, ' ; leurs PDF sont dans le dossier du chantier sur le PC');
}
function prgDetail_(shD) {
  const derniere = shD.getLastRow();
  return derniere < 2 ? [] : shD.getRange(2, 1, derniere - 1, PRG_DETAIL_ENTETES.length).getValues().map((r, i) => ({ ligne: i + 2, r: r }));
}
function prgEcrireDetail_(shD, ligne, etat) { shD.getRange(ligne, COL_D.etat, 1, 2).setValues([[cellule_(etat), new Date(maintenant_())]]); }
// Ce que la ligne a réellement mis à la corbeille (d'après le journal) ; « autres » : refusés ou en échec ;
// « premier » : la date de la PLUS ANCIENNE mise à la corbeille de cette purge (0 s'il n'y en a pas). Google supprime
// chaque fichier, chaque mail, 30 jours après SA mise à la corbeille : c'est cette date qui fixe les délais de la ligne.
function prgTotaux_(shD, cle) {
  const t = { elements: 0, fichiers: 0, octets: 0, autres: 0, premier: 0 };
  prgDetail_(shD).forEach(x => {
    if (String(x.r[COL_D.cle - 1]) !== cle) return;
    const etat = String(x.r[COL_D.etat - 1]);
    if (etat === 'fait') {
      t.elements++; t.fichiers += Number(x.r[COL_D.fichiers - 1]) || 0; t.octets += Number(x.r[COL_D.taille - 1]) || 0;
      const note = x.r[COL_D.note - 1];
      if (stkEstDate_(note) && (!t.premier || note.getTime() < t.premier)) t.premier = note.getTime();
    } else if (/^(refusé|échec)/.test(etat)) t.autres++;
  });
  return t;
}
// Le journal d'ABORD : chaque paquet est écrit « à faire » (et réellement enregistré : flush) avant sa première mise à la
// corbeille ; puis chaque fichier ou dossier est marqué « fait », « refusé : … » ou « échec : … ». Le temps est regardé
// avant CHAQUE mise à la corbeille : ce qui reste du paquet est alors marqué « non fait ». Rend false si le temps a manqué.
function prgExecuter_(shD, cle, items, garde, depasse) {
  for (let i = 0; i < items.length; i += PRG_PAQUET) {
    if (depasse()) return false;
    const paquet = items.slice(i, i + PRG_PAQUET), date = new Date(maintenant_());
    const debut = shD.getLastRow() + 1;
    stkAssurerLignes_(shD, debut + paquet.length - 1);
    shD.getRange(debut, 1, paquet.length, COL_D.chemin).setNumberFormat('@');
    shD.getRange(debut, 1, paquet.length, PRG_DETAIL_ENTETES.length)
      .setValues(paquet.map(x => [cle, x.type, x.id, x.chemin, x.taille, x.fichiers, date, 'à faire', date].map(cellule_)));
    SpreadsheetApp.flush();
    let coupe = false;
    const etats = paquet.map(x => {
      if (coupe || depasse()) { coupe = true; return 'non fait (temps écoulé)'; }
      try {
        const api = prgElement_(x.type, x.id), refus = garde(api, x);
        if (refus) return 'refusé : ' + refus;
        api.setTrashed(true);      // la corbeille de Drive, jamais une suppression définitive
        return 'fait';
      } catch (e) { return 'échec : ' + (e && e.message ? e.message : e); }
    });
    prgMarquer_(shD, cle, debut, paquet, etats);
    SpreadsheetApp.flush();
    if (coupe) return false;
  }
  return true;
}
// Marque un paquet. Ses lignes sont en principe là où elles viennent d'être écrites ; si l'onglet a bougé entre-temps,
// chaque ligne est retrouvée par sa clé et son identifiant.
function prgMarquer_(shD, cle, debut, paquet, etats) {
  const date = new Date(maintenant_());
  const ids = shD.getRange(debut, COL_D.id, paquet.length, 1).getValues();
  if (paquet.every((x, i) => String(ids[i][0]) === x.id)) {
    shD.getRange(debut, COL_D.etat, paquet.length, 2).setValues(etats.map(e => [cellule_(e), date]));
    return;
  }
  const lignes = prgDetail_(shD);
  paquet.forEach((x, i) => {
    const l = lignes.filter(y => String(y.r[COL_D.cle - 1]) === cle && String(y.r[COL_D.id - 1]) === x.id && String(y.r[COL_D.etat - 1]) === 'à faire')[0];
    if (l) prgEcrireDetail_(shD, l.ligne, etats[i]);
  });
}
// Reprise après une exécution coupée : une ligne restée « à faire » dit si son fichier est parti à la corbeille ou non.
// Appelée à CHAQUE traitement d'une clé, quel que soit l'état affiché par la ligne.
function prgReprendre_(shD, cle) {
  prgDetail_(shD).forEach(x => {
    if (String(x.r[COL_D.cle - 1]) !== cle || String(x.r[COL_D.etat - 1]) !== 'à faire') return;
    let etat;
    try { etat = prgElement_(String(x.r[COL_D.type - 1]), String(x.r[COL_D.id - 1])).isTrashed() ? 'fait' : 'non fait (exécution coupée)'; }
    catch (e) { etat = 'introuvable (exécution coupée)'; }
    prgEcrireDetail_(shD, x.ligne, etat);
  });
}
// Avant une nouvelle purge sur la même clé (après une annulation) : les lignes « remis » de l'annulation précédente sont
// rangées, pour que le bilan de la prochaine annulation ne compte que ses propres lignes
function prgRanger_(shD, cle) {
  prgDetail_(shD).forEach(x => {
    const etat = String(x.r[COL_D.etat - 1]);
    if (String(x.r[COL_D.cle - 1]) === cle && /^(remis|non remis)/.test(etat) && etat.indexOf(PRG_AVANT) < 0) prgEcrireDetail_(shD, x.ligne, etat + PRG_AVANT);
  });
}
const PRG_AVANT = ' — purge précédente';

// ── Verrou de la purge : une propriété datée, JAMAIS le verrou du script (celui des fiches) ──
function prgPrendre_() {
  const props = PropertiesService.getScriptProperties(), depuis = Number(props.getProperty('PURGE_EN_COURS') || 0);
  if (depuis && Math.abs(Date.now() - depuis) < PRG_VERROU_MS) return false;   // au-delà de 7 min : exécution morte, on reprend
  props.setProperty('PURGE_EN_COURS', String(Date.now()));
  return true;
}
function prgRendre_() { PropertiesService.getScriptProperties().deleteProperty('PURGE_EN_COURS'); }
// ── Plafond par jour du temps passé à purger (les 90 minutes de déclencheurs du compte servent aussi aux fiches) ──
// Propriété PURGE_TEMPS : { jour, ms }. Rend les millisecondes encore permises aujourd'hui.
function prgBudget_() {
  let t = {};
  try { t = JSON.parse(PropertiesService.getScriptProperties().getProperty('PURGE_TEMPS') || '{}') || {}; } catch (e) { t = {}; }
  return PRG_MAX_MINUTES_JOUR * 60 * 1000 - (t.jour === jour_() ? Number(t.ms) || 0 : 0);
}
function prgCompter_(ms) {
  const utilise = PRG_MAX_MINUTES_JOUR * 60 * 1000 - prgBudget_() + Math.max(0, ms);
  PropertiesService.getScriptProperties().setProperty('PURGE_TEMPS', JSON.stringify({ jour: jour_(), ms: utilise }));
}
const PRG_SUITE_DEMAIN = 'Temps de purge du jour épuisé (' + PRG_MAX_MINUTES_JOUR + ' minutes par jour, pour ne jamais gêner l’envoi des fiches) : la suite demain, toute seule.';

// ── Le traitement des cases (déclencheur dédié, toutes les 30 minutes) ──
function traiterPurges() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PURGES);
  if (!sh || sh.getLastRow() < 2) return 'rien';
  if (!noteTitresBons_(sh, PRG_ENTETES)) { stkAlerteOnglet_(SHEET_PURGES); return 'onglet modifié'; }
  // Rien à faire (aucune case cochée, aucune purge à reprendre, aucun mail à renvoyer) : on sort tout de suite
  const lignes = prgLignes_(sh);
  const aFaire = lignes.filter(x => x.r[COL_P.corbeille - 1] === true || x.r[COL_P.annuler - 1] === true
    || prgEstOccupe_(x.r[COL_P.etat - 1]) || String(x.r[COL_P.etat - 1]) === PRG_ETAT.mail);
  if (!aFaire.length) return 'rien';
  if (!prgPrendre_()) return 'occupé';
  const debut = chronoMs_();
  let traitees = 0;
  try {
    let shD;
    try { shD = feuillePurgesDetail_(); } catch (e) { return 'onglet modifié'; }   // sans journal, aucune mise à la corbeille
    // Une clé présente deux fois (ligne copiée-collée) : aucune de ses lignes n'est traitée, elles le disent
    const compte = {}, cles = [];
    lignes.forEach(x => { const k = '/' + x.r[COL_P.cle - 1]; compte[k] = (compte[k] || 0) + 1; });
    aFaire.forEach(x => {
      const cle = String(x.r[COL_P.cle - 1]);
      if (compte['/' + cle] > 1) { prgDoublon_(sh, x.ligne, cle); traitees++; }
      else if (cles.indexOf(cle) < 0) cles.push(cle);
    });
    const ctx = prgContexte_(), budget = prgBudget_();
    const depasse = () => chronoMs_() - debut > STK_DUREE_MAX_MS;
    const temps = { depasse: depasse, depassePurge: () => depasse() || chronoMs_() - debut > budget, epuise: () => chronoMs_() - debut > budget };
    for (let i = 0; i < cles.length; i++) {
      if (depasse()) break;
      try { prgTraiterLigne_(sh, shD, cles[i], ctx, temps); }
      catch (e) {
        console.error('traiterPurges :', e && e.message);
        prgArreter_(sh, shD, cles[i], 'Erreur le ' + texteDate_(maintenant_()) + ' : ' + (e && e.message ? e.message : e) + '.');
      }
      traitees++;
    }
  } finally { prgCompter_(chronoMs_() - debut); prgRendre_(); }
  return traitees + ' ligne(s) traitée(s)';
}
// Une ligne dont la clé existe en double : cases décochées, message. Écrit par numéro de ligne, après avoir relu la clé.
function prgDoublon_(sh, ligne, cle) {
  if (String(sh.getRange(ligne, COL_P.cle).getValue()) !== cle) return;
  const message = 'Cette ligne existe en double (copier-coller ?) : rien n’est fait sur aucune des deux. Supprime la copie, puis recoche.';
  if (sh.getRange(ligne, COL_P.corbeille).getValue() === true) sh.getRange(ligne, COL_P.corbeille).setValue(false);
  if (sh.getRange(ligne, COL_P.annuler).getValue() === true) sh.getRange(ligne, COL_P.annuler).setValue(false);
  if (String(sh.getRange(ligne, COL_P.message).getValue()) !== message) sh.getRange(ligne, COL_P.message).setValue(message);
}

function prgTraiterLigne_(sh, shD, cle, ctx, temps) {
  if (!prgLigne_(sh, cle)) return;
  prgReprendre_(shD, cle);   // toujours : un journal resté « à faire » est tranché d'après l'état réel des fichiers
  const lire = () => { const l = prgLigne_(sh, cle); return l ? sh.getRange(l, 1, 1, PRG_ENTETES.length).getValues()[0] : null; };
  let r = lire();
  if (!r) return;
  const k = prgLireCle_(cle), c = !k ? null : k.nature === 'mails' ? PRG_MAILS_C : ctx.chantiers[k.chantier];
  const corbeille = r[COL_P.corbeille - 1] === true, annuler = r[COL_P.annuler - 1] === true, etat = String(r[COL_P.etat - 1]);
  const enCours = /^en cours/i.test(etat), annulation = /^annulation en cours/i.test(etat);
  let fait = prgEstFait_(etat);
  const dire = (message, autres) => { const m = autres || {}; m[COL_P.message] = message; prgEcrire_(sh, cle, m); };
  const decocher = () => { const m = {}; m[COL_P.corbeille] = false; m[COL_P.annuler] = false; return m; };
  // Le journal dit que des fichiers sont à la corbeille alors que la ligne ne dit ni « En cours » ni « Fait » (état
  // écrasé pendant une purge) : la ligne est remise en ordre, pour que « Annuler » marche
  if (!fait && !enCours && !annulation && prgTotaux_(shD, cle).elements > 0) {
    prgFinir_(sh, shD, cle, 'Ligne remise en ordre : une purge avait commencé sur cette ligne.');
    return;
  }
  // La ligne affichée ne correspond plus à sa clé (tri d'une partie des colonnes) : jamais de purge ni d'annulation « à l'aveugle »
  if (!k || cleChantier_(r[COL_P.chantier - 1]) !== k.chantier || String(r[COL_P.quoi - 1]).trim() !== PRG_QUOI[k.nature]) {
    if (enCours) { prgFinir_(sh, shD, cle, 'Arrêtée : la ligne ne correspondait plus à sa clé (onglet trié en partie ?).'); return; }
    const m = decocher();
    if (k) { m[COL_P.chantier] = c ? c.nom : k.chantier; m[COL_P.quoi] = PRG_QUOI[k.nature]; }
    if (!fait && !annulation) { m[COL_P.etat] = PRG_ETAT.impossible; m[COL_P.possible] = 'non'; }
    dire('Cette ligne avait été mélangée (tri d’une partie des colonnes ?) : le chantier affiché n’était plus celui de sa clé. Rien n’a été fait. '
      + 'Le chantier et « Quoi » sont remis ; attends la prochaine mesure avant de recocher.', m);
    return;
  }
  if (corbeille && annuler && !enCours && !annulation) {
    dire('Les deux cases étaient cochées : rien n’a été fait, et elles ont été décochées. Coches-en une seule.', decocher());
    return;
  }
  // « Annuler » cochée pendant une purge en plusieurs passages : la purge s'arrête là, puis ce qui est parti est annulé
  if (annuler && enCours) {
    fait = prgFinir_(sh, shD, cle, 'Purge arrêtée : « Annuler » a été cochée.', true);
    if (!fait) { const m = {}; m[COL_P.annuler] = false; prgEcrire_(sh, cle, m); return; }
    r = lire();
    if (r) prgAnnuler_(sh, shD, cle, r, false, temps.depasse);
    return;
  }
  if (annulation || annuler) {
    if (!fait && !annulation) { dire('Rien à annuler sur cette ligne : rien n’a été mis à la corbeille.', decocher()); return; }
    prgAnnuler_(sh, shD, cle, r, annulation, temps.depasse);
    return;
  }
  if (corbeille || enCours) {
    if (fait) { dire('Déjà fait : rien de plus n’a été mis à la corbeille. S’il reste des fichiers, une nouvelle ligne sera proposée à la prochaine mesure.', decocher()); return; }
    // La case n'agit que sur une ligne « Proposé » : ce que tu as lu à l'écran est ce qui est fait
    if (!enCours && etat !== PRG_ETAT.propose) {
      dire('Cette ligne n’est pas « ' + PRG_ETAT.propose + ' » : rien n’a été fait, la case est décochée. Attends la prochaine mesure (cette nuit) ; si elle dit « Possible ? oui », recoche.', decocher());
      return;
    }
    if (temps.epuise()) { if (String(r[COL_P.message - 1]) !== PRG_SUITE_DEMAIN) dire(PRG_SUITE_DEMAIN); return; }
    prgPurger_(sh, shD, cle, k, c, enCours, corbeille, ctx, temps);
    return;
  }
  if (etat === PRG_ETAT.mail) prgMailPurge_(sh, shD, cle);   // le mail d'une purge faite n'était pas parti : nouvel essai
}

// Une case « Mettre à la corbeille » : tout est REVÉRIFIÉ, puis journal, puis corbeille
function prgPurger_(sh, shD, cle, k, c, enCours, cochee, ctx, temps) {
  if (k.nature === 'mails') { prgPurgerMails_(sh, shD, cle, enCours, cochee, ctx, temps); return; }
  if (enCours && !cochee) { prgFinir_(sh, shD, cle, 'Arrêtée : la case a été décochée pendant la purge.'); return; }
  let refus = '', exam = null;
  if (!c) refus = 'Ce chantier n’est plus dans l’onglet Chantiers.';
  else {
    exam = prgExaminer_(k.nature, c, ctx, PRG_RELEVE_PURGE_HEURES * 3600 * 1000, temps.depasse, null, null);
    if (exam.dossierId && exam.dossierId !== k.dossier) refus = 'Le dossier du chantier n’est plus celui de cette ligne.';
    else if (!exam.possible) refus = prgPourquoi_(k.nature, exam);
  }
  if (refus) {
    if (enCours) { prgFinir_(sh, shD, cle, 'Arrêtée avant la fin : ' + refus); return; }
    const cellules = {};
    cellules[COL_P.corbeille] = false; cellules[COL_P.possible] = 'non'; cellules[COL_P.pourquoi] = refus; cellules[COL_P.etat] = PRG_ETAT.impossible;
    cellules[COL_P.message] = 'Refusé le ' + texteDate_(maintenant_()) + ' : les conditions ne sont plus réunies. Rien n’a été mis à la corbeille.';
    prgEcrire_(sh, cle, cellules);
    return;
  }
  if (!enCours) prgRanger_(shD, cle);
  const cellules = {};
  cellules[COL_P.etat] = PRG_ETAT.enCours; cellules[COL_P.message] = 'Mise à la corbeille en cours depuis le ' + texteDate_(maintenant_()) + '.';
  prgEcrire_(sh, cle, cellules);
  SpreadsheetApp.flush();
  const fini = prgExecuter_(shD, cle, exam.items, exam.garde, temps.depassePurge);
  if (exam.carnet && exam.carnet.id) cacheScript_().remove('carnet:liste:1:' + exam.carnet.id + ':n');   // les téléphones relisent le carnet
  if (!fini) { prgEnCours_(sh, shD, cle, temps.epuise() ? PRG_SUITE_DEMAIN : 'En cours : la suite au prochain passage (30 minutes au plus).'); return; }
  prgFinir_(sh, shD, cle, '');
}
// Une purge qui continuera à un autre passage (ou un autre jour) : la ligne le dit, avec les vrais délais, comptés depuis
// la PREMIÈRE mise à la corbeille de cette purge
function prgEnCours_(sh, shD, cle, message) {
  const t = prgTotaux_(shD, cle), m = {};
  m[COL_P.message] = message;
  if (t.premier) {
    m[COL_P.libere] = new Date(t.premier + PRG_CORBEILLE_JOURS * PRG_JOUR_MS); m[COL_P.jusquau] = new Date(t.premier + PRG_ANNULATION_JOURS * PRG_JOUR_MS);
    m[COL_P.message] = prgMots_(cle, message + ' Déjà ' + t.fichiers + ' fichier(s) à la corbeille, depuis le ' + stkJour_(t.premier) + ' : pour tout annuler, coche « Annuler » avant le '
      + stkJour_(t.premier + PRG_ANNULATION_JOURS * PRG_JOUR_MS) + ' (les délais se comptent depuis les premières mises à la corbeille).');
  }
  prgEcrire_(sh, cle, m);
}
// Fin d'une purge (complète, ou arrêtée) : la ligne dit ce qui a été fait d'après le journal, et le mail part.
// sansMail : la purge est arrêtée pour être annulée aussitôt. Rend true si quelque chose est à la corbeille.
function prgFinir_(sh, shD, cle, remarque, sansMail) {
  const t = prgTotaux_(shD, cle), maintenant = maintenant_(), cellules = {};
  cellules[COL_P.corbeille] = false;
  if (!t.elements) {
    cellules[COL_P.etat] = PRG_ETAT.impossible;
    cellules[COL_P.message] = prgMots_(cle, [remarque, 'Rien n’a été mis à la corbeille' + (t.autres ? ' (' + t.autres + ' fichier(s) ou dossier(s) refusé(s) ou en échec : voir « ' + SHEET_PURGES_DETAIL + ' »).' : '.')].filter(Boolean).join(' '));
    prgEcrire_(sh, cle, cellules);
    return false;
  }
  cellules[COL_P.etat] = sansMail ? PRG_ETAT.fait : PRG_ETAT.mail;
  // Les délais se comptent depuis la PLUS ANCIENNE mise à la corbeille de cette purge (elle a pu s'étaler sur plusieurs jours)
  const depuis = t.premier || maintenant, etale = stkJour_(depuis) !== stkJour_(maintenant);
  cellules[COL_P.faitLe] = new Date(depuis); cellules[COL_P.nbFaits] = t.fichiers;
  cellules[COL_P.libere] = new Date(depuis + PRG_CORBEILLE_JOURS * PRG_JOUR_MS);
  cellules[COL_P.jusquau] = new Date(depuis + PRG_ANNULATION_JOURS * PRG_JOUR_MS);
  cellules[COL_P.message] = prgMots_(cle, [remarque, t.fichiers + ' fichier(s) à la corbeille (' + String(stkMo_(t.octets)).replace('.', ',') + ' Mo)'
    + (t.autres ? ' ; ' + t.autres + ' fichier(s) ou dossier(s) laissé(s) en place (voir « ' + SHEET_PURGES_DETAIL + ' »)' : '') + '.'
    + (etale ? ' Purge commencée le ' + stkJour_(depuis) + ', finie le ' + stkJour_(maintenant) + ' : les délais se comptent depuis le début.' : '')
    + ' Pour annuler : coche « Annuler » avant le ' + stkJour_(depuis + PRG_ANNULATION_JOURS * PRG_JOUR_MS) + '.'].filter(Boolean).join(' '));
  prgEcrire_(sh, cle, cellules);   // si la ligne a été supprimée entre-temps, le mail part quand même
  if (!sansMail) prgMailPurge_(sh, shD, cle);
  return true;
}
// Un mail à Franck à chaque mise à la corbeille ; s'il ne part pas, la ligne reste « Fait (mail à envoyer) » et il repartira.
// Le chantier et la sorte de purge viennent de la CLÉ (jamais du texte affiché, que Franck peut avoir trié ou modifié) ;
// le mail part même si la ligne a disparu de l'onglet.
function prgMailPurge_(sh, shD, cle) {
  const ligne = prgLigne_(sh, cle), v = ligne ? sh.getRange(ligne, 1, 1, PRG_ENTETES.length).getValues()[0] : null;
  const t = prgTotaux_(shD, cle), k = prgLireCle_(cle), maintenant = maintenant_();
  const connu = k ? stkChantiers_()[k.chantier] : null;
  const chantier = connu ? connu.nom : (k ? k.chantier : cle), quoi = k ? PRG_QUOI[k.nature] : '';
  const jour = (cellule, defaut) => stkJour_(v && stkEstDate_(cellule) ? cellule.getTime() : defaut);
  const faitLe = jour(v && v[COL_P.faitLe - 1], maintenant), libere = jour(v && v[COL_P.libere - 1], maintenant + PRG_CORBEILLE_JOURS * PRG_JOUR_MS);
  const jusquau = jour(v && v[COL_P.jusquau - 1], maintenant + PRG_ANNULATION_JOURS * PRG_JOUR_MS);
  const mails = !!k && k.nature === 'mails';
  const texte = prgMots_(cle, ['Tu as coché « Mettre à la corbeille » dans l’onglet « ' + SHEET_PURGES + ' » du Sheet.', '',
    mails ? 'Compte Gmail de l’appli' : 'Chantier : ' + chantier, 'Quoi : ' + quoi,
    'Mis à la corbeille de Drive le ' + faitLe + ' : ' + t.fichiers + ' fichier(s), ' + String(stkMo_(t.octets)).replace('.', ',') + ' Mo'
      + (t.autres ? ' (' + t.autres + ' fichier(s) ou dossier(s) laissé(s) en place : voir l’onglet « ' + SHEET_PURGES_DETAIL + ' »)' : '') + '.', '',
    'Rien n’est supprimé définitivement : tout est dans la corbeille de Drive, et la liste exacte est dans l’onglet « ' + SHEET_PURGES_DETAIL + ' ».',
    'La place sera vraiment libérée le ' + libere + ' (la corbeille compte dans les 15 Go pendant ' + PRG_CORBEILLE_JOURS + ' jours).', '',
    v ? 'POUR ANNULER : dans l’onglet « ' + SHEET_PURGES + ' », coche la case « Annuler » de cette ligne avant le ' + jusquau + '. Tout ressort de la corbeille dans la demi-heure.'
      : 'ATTENTION : la ligne de cette purge n’est plus dans l’onglet « ' + SHEET_PURGES + ' » (supprimée ?) : la case « Annuler » n’existe donc plus. Pour annuler, restaure les fichiers à la main dans la corbeille de Drive.',
    'Jusqu’au ' + libere + ', c’est aussi possible à la main dans la corbeille de Drive.', '',
    mails ? 'Ce sont des mails de fiches de chantier : les PDF de ces fiches sont rangés dans le Drive et recopiés dans le dossier du chantier sur le PC '
        + '(pour chaque mail, le PDF a été retrouvé dans le dossier Drive du chantier avant la mise à la corbeille). ' + PRG_MAILS_JAMAIS_VISES
      : 'Si MEGA n’avait pas fini de sauvegarder le dossier du chantier sur le PC, annule, laisse MEGA finir, puis recommence.'].join('\n'));
  const parti = stkMail_('[Loué App] Mise à la corbeille — ' + chantier + ' — ' + quoi, texte);
  if (v) { const cellules = {}; cellules[COL_P.etat] = parti ? PRG_ETAT.fait : PRG_ETAT.mail; prgEcrire_(sh, cle, cellules); }
}
// Une erreur inattendue pendant le traitement d'une ligne : la ligne le dit, les cases sont décochées (pas de nouvel essai
// toutes les 30 minutes), et ce qui est déjà parti à la corbeille reste annulable
function prgArreter_(sh, shD, cle, message) {
  try {
    const ligne = prgLigne_(sh, cle);
    if (!ligne) return;
    const r = sh.getRange(ligne, 1, 1, PRG_ENTETES.length).getValues()[0], etat = String(r[COL_P.etat - 1]);
    if (/^en cours/i.test(etat)) { prgReprendre_(shD, cle); prgFinir_(sh, shD, cle, message); return; }
    const cellules = {};
    cellules[COL_P.corbeille] = false; cellules[COL_P.annuler] = false; cellules[COL_P.message] = message + ' Les cases ont été décochées.';
    if (/^annulation en cours/i.test(etat)) cellules[COL_P.etat] = PRG_ETAT.fait;   // ce qui n'est pas revenu reste annulable
    prgEcrire_(sh, cle, cellules);
  } catch (e) { console.error('prgArreter_ :', e && e.message); }
}

// La case « Annuler » : sort de la corbeille exactement ce que la ligne y a mis, et dit ce qui n'a pas pu revenir
function prgAnnuler_(sh, shD, cle, r, reprise, depasse) {
  const maintenant = maintenant_(), faitLe = r[COL_P.faitLe - 1];
  if (!reprise && stkEstDate_(faitLe) && maintenant > faitLe.getTime() + PRG_ANNULATION_JOURS * PRG_JOUR_MS) {
    const cellules = {};
    cellules[COL_P.annuler] = false;
    cellules[COL_P.message] = 'Annulation refusée : le délai de ' + PRG_ANNULATION_JOURS + ' jours est passé (purge du ' + stkJour_(faitLe.getTime()) + '). Jusqu’au '
      + stkJour_(faitLe.getTime() + PRG_CORBEILLE_JOURS * PRG_JOUR_MS) + ', c’est encore possible à la main dans la corbeille de Drive (liste dans « ' + SHEET_PURGES_DETAIL + ' »).';
    cellules[COL_P.message] = prgMots_(cle, cellules[COL_P.message]);
    prgEcrire_(sh, cle, cellules);
    return;
  }
  if (!reprise) { const c = {}; c[COL_P.etat] = PRG_ETAT.annulation; c[COL_P.message] = 'Annulation en cours depuis le ' + texteDate_(maintenant) + '.'; prgEcrire_(sh, cle, c); SpreadsheetApp.flush(); }
  // Dans l'ordre inverse de la purge : la liste du carnet d'abord, puis les dossiers, puis les fiches
  const lignes = prgDetail_(shD).filter(x => String(x.r[COL_D.cle - 1]) === cle && String(x.r[COL_D.etat - 1]) === 'fait').reverse();
  let coupe = false;
  for (let i = 0; i < lignes.length; i++) {
    if (depasse()) { coupe = true; break; }
    const x = lignes[i];
    let etat;
    try {
      const api = prgElement_(String(x.r[COL_D.type - 1]), String(x.r[COL_D.id - 1]));
      if (api.isTrashed()) api.setTrashed(false);
      etat = api.isTrashed() ? 'non remis (encore à la corbeille)' : 'remis';
    } catch (e) { etat = 'non remis (introuvable : corbeille vidée ?)'; }
    prgEcrireDetail_(shD, x.ligne, etat);
    if (i % PRG_PAQUET === PRG_PAQUET - 1) SpreadsheetApp.flush();
  }
  if (coupe) { const m = {}; m[COL_P.message] = 'Annulation en cours : la suite au prochain passage (30 minutes au plus).'; prgEcrire_(sh, cle, m); return; }
  // Bilan de CETTE annulation d'après le journal (les lignes d'une annulation précédente sont rangées à part)
  let remis = 0, perdus = 0;
  prgDetail_(shD).forEach(x => {
    const etat = String(x.r[COL_D.etat - 1]);
    if (String(x.r[COL_D.cle - 1]) !== cle || etat.indexOf(PRG_AVANT) > -1) return;
    const n = Number(x.r[COL_D.fichiers - 1]) || 1;
    if (etat === 'remis') remis += n; else if (/^non remis/.test(etat)) perdus += n;
  });
  const k = prgLireCle_(cle);
  try { if (k) { const d = DriveApp.getFolderById(k.dossier); sousDossiersParChemin_(d, stkConf_().documents.carnet).forEach(x => cacheScript_().remove('carnet:liste:1:' + x.getId() + ':n')); } } catch (e) {}
  const cellules = {};
  cellules[COL_P.annuler] = false; cellules[COL_P.corbeille] = false; cellules[COL_P.etat] = PRG_ETAT.annule;
  cellules[COL_P.faitLe] = ''; cellules[COL_P.nbFaits] = ''; cellules[COL_P.libere] = ''; cellules[COL_P.jusquau] = '';
  cellules[COL_P.message] = 'Annulé le ' + texteDate_(maintenant_()) + ' : ' + remis + ' fichier(s) remis en place.'
    + (perdus ? ' ⚠ ' + perdus + ' fichier(s) n’ont PAS pu revenir (corbeille vidée à la main entre-temps ?) : voir « ' + SHEET_PURGES_DETAIL + ' » ; ils sont dans le dossier du chantier sur le PC.' : '')
    + ' La ligne sera proposée de nouveau à la prochaine mesure.';
  cellules[COL_P.message] = prgMots_(cle, cellules[COL_P.message]);
  prgEcrire_(sh, cle, cellules);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// MAILS ENVOYÉS DE PLUS DE 3 MOIS (décision de Franck du 16/11/2026) — une seule ligne de l'onglet « Purges »
//
// Chaque fiche part par mail avec son PDF, et Gmail garde une copie dans « Messages envoyés », qui compte dans les 15 Go.
// Cette ligne propose de mettre à la CORBEILLE DE GMAIL (vidée par Google au bout de 30 jours) les mails des FICHES DE
// CHANTIER que l'appli a envoyés il y a plus de 90 jours. Même case, même journal écrit avant, même annulation de 25 jours.
//
// Quels mails, et seulement ceux-là (chaque mail est lu une fois, juste avant le journal et la corbeille) :
//   - dans « Messages envoyés », envoyé PAR CE COMPTE sous le nom de l'entreprise (c'est ainsi que l'appli envoie) ;
//   - objet « [Loué App] <fiche> — … » où <fiche> est dans la liste FERMÉE PRG_MAILS_FICHES (les fiches de chantier) ;
//     un transfert ou une réponse commence par « TR: », « RE: »… : jamais touché ; une demande d'absence : jamais ;
//   - l'objet nomme un chantier de l'onglet Chantiers dont le dossier Drive est sûr (mêmes règles que pour une purge), ET le
//     PDF de la fiche est retrouvé dans ce dossier (un fichier de la même taille que la pièce jointe) : une fiche d'un
//     chantier inconnu (rangée dans « _À CLASSER ») ou dont le rangement a échoué n'est donc jamais visée — son PDF
//     n'existe peut-être que dans le mail. Dans le doute, le mail n'est PAS visé ;
//   - avec au moins une pièce jointe ; de plus de 90 jours ;
//   - jamais un brouillon, un mail suivi (étoile), « Important », portant un libellé, présent dans la boîte de réception,
//     ni un mail dont ce compte est lui-même destinataire (c'est aussi un mail REÇU).
// Mail par mail, jamais par fil de discussion : une réponse reçue dans le même fil n'est jamais touchée.
// Les mails « Loué Menuiserie — … » envoyés aux adresses tapées à la main ne sont pas visés.
//
// Copie TEST : elle est dans le MÊME compte Google que la production, et rien ne distingue un mail de l'une d'un mail de
// l'autre. Sur la copie TEST, seuls les mails dont l'objet contient « CHANTIER TEST AUTO » (le chantier d'essai, qui
// n'existe pas en production) sont visés ; l'âge peut y être réduit par la propriété PURGE_MAILS_JOURS_TEST (ignorée ailleurs).
// Service utilisé : le service avancé Gmail (à activer dans l'éditeur s'il ne l'est pas : verifierConfig le dit), qui sait
// agir mail par mail et sortir un mail de la corbeille. Seulement Messages.list, get, trash et untrash.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
const PRG_MAILS_JOURS = 90;                          // « plus de 3 mois »
const PRG_MAILS_OBJET = '[Loué App] ';               // début de l'objet de tous les mails de fiches envoyés par l'appli
// LISTE FERMÉE des fiches de chantier dont le mail peut être visé : le texte qui suit « [Loué App] » dans l'objet.
// Un nouveau type de fiche n'y entre que sur décision (un test échoue s'il manque ici ET dans PRG_MAILS_JAMAIS).
const PRG_MAILS_FICHES = ['Note de réunion', 'Bordereau Organigramme', 'Bordereau Matériaux', 'Quitus', 'Prise de cotes', 'Fiche fabrication',
  'Réception Support', 'Attestation', 'Signalement'];
const PRG_MAILS_JAMAIS = ["Demande d'absence"];      // PDF rangé hors chantier, jamais recopié sur le PC : jamais visé
const PRG_MAILS_CHANTIER_TEST = 'CHANTIER TEST AUTO';
const PRG_MAILS_C = { nom: '(tout le compte)', cle: '(tout le compte)' }, PRG_MAILS_ID = 'envoyes';
const PRG_MAILS_MAX_LISTE = 2000;                    // mails comptés au plus pour la proposition (au-delà : « plus de 2000 »)
const PRG_MAILS_ECHANTILLON = 30;                    // mails lus pour estimer le nombre et le poids
const PRG_MAILS_PAR_PASSAGE = 200;                   // mails lus (une seule lecture chacun) par passage
const PRG_MAILS_JAMAIS_VISES = 'Jamais visés : les demandes d’absence, les fiches d’un chantier inconnu ou mal rangées, les mails aux adresses tapées à la main, '
  + 'les mails reçus, transférés, suivis (étoile), « Important » ou portant un libellé.';

function prgGmailPresent_() { return typeof Gmail !== 'undefined' && !!Gmail && !!Gmail.Users && !!Gmail.Users.Messages; }
function prgMailsCompte_() { return String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase(); }
// Adresse sans son « +quelquechose » (franck+contact1@… arrive dans la boîte de franck@…)
function prgAdresseNue_(a) { return String(a || '').trim().toLowerCase().replace(/\+[^@]*@/, '@'); }
function prgMailsRegles_(depasse) {
  const test = environnementReel_().env === 'TEST';
  let jours = PRG_MAILS_JOURS;
  if (test) { const j = Number(propriete_('PURGE_MAILS_JOURS_TEST')); if (j >= 1) jours = j; }
  return { test: test, jours: jours, limite: maintenant_() - jours * PRG_JOUR_MS, compte: prgMailsCompte_(), depasse: depasse || (() => false),
    dossiers: {}, tailles: {} };   // par chantier, pour cette exécution : son dossier sûr, et les tailles de ses fiches dans Drive
}
// La recherche Gmail : large filet, chaque mail est ensuite lu et passé à la règle (prgMailRefus_)
function prgMailsRequete_(regles) {
  const avant = Utilities.formatDate(new Date(regles.limite), 'Europe/Paris', 'yyyy/MM/dd');
  return 'in:sent has:attachment subject:"' + PRG_MAILS_OBJET.trim() + '" before:' + avant + ' -in:inbox -is:starred'
    + ' -to:' + regles.compte + ' -cc:' + regles.compte + ' -bcc:' + regles.compte
    + (regles.test ? ' subject:"' + PRG_MAILS_CHANTIER_TEST + '"' : '');
}
// Identifiants des mails trouvés (max au plus) ; « plus » : il y en a davantage
function prgMailsListe_(regles, max) {
  const ids = [];
  let jeton = null, plus = false;
  do {
    const o = { q: prgMailsRequete_(regles), maxResults: Math.min(500, max - ids.length) };
    if (jeton) o.pageToken = jeton;
    const rep = Gmail.Users.Messages.list('me', o) || {};
    (rep.messages || []).forEach(m => { if (ids.length < max) ids.push(String(m.id)); });
    jeton = rep.nextPageToken || null;
    if (jeton && ids.length >= max) plus = true;
  } while (jeton && ids.length < max);
  return { ids: ids, plus: plus };
}
// Un mail, lu dans Gmail : { id, labels, taille, date, de, a, objet, pj: [tailles des pièces jointes] }
function prgMailLu_(id) {
  const m = Gmail.Users.Messages.get('me', id, { format: 'full' }) || {};
  const entetes = {}, pj = [];
  ((m.payload && m.payload.headers) || []).forEach(h => { const n = String(h.name || '').toLowerCase(); entetes[n] = (entetes[n] ? entetes[n] + ', ' : '') + String(h.value || ''); });
  const parcourir = p => { if (!p) return; if (String(p.filename || '') !== '') pj.push(Number(p.body && p.body.size) || 0); (p.parts || []).forEach(parcourir); };
  parcourir(m.payload);
  return { id: String(id), labels: m.labelIds || [], taille: Number(m.sizeEstimate) || 0, date: Number(m.internalDate) || 0,
    de: entetes.from || '', a: [entetes.to, entetes.cc, entetes.bcc].filter(Boolean).join(', '), objet: entetes.subject || '', pj: pj };
}
// Le type de fiche et le chantier nommés par l'objet « [Loué App] <fiche> — … — <chantier> — … » ; null si ce n'est pas sûr
function prgMailFiche_(objet, ctx) {
  if (objet.indexOf(PRG_MAILS_OBJET) !== 0) return null;
  const reste = objet.slice(PRG_MAILS_OBJET.length);
  const fiche = PRG_MAILS_FICHES.filter(f => reste.indexOf(f + ' — ') === 0)[0];
  if (!fiche) return { fiche: '', jamais: PRG_MAILS_JAMAIS.some(f => reste.indexOf(f) === 0) };
  const morceaux = reste.slice(fiche.length).split(' — ').map(x => x.trim()).filter(Boolean);
  let c = null;
  for (let i = 0; i < morceaux.length && !c; i++) c = ctx.chantiers[cleChantier_(morceaux[i])] || null;
  return { fiche: fiche, chantier: c };
}
// '' si ce mail peut aller à la corbeille, sinon la raison. C'est LA règle : tout ce qui n'est pas sûr est refusé.
// avecDrive : vérifier aussi que le PDF de la fiche est dans le dossier Drive du chantier (lecture du dossier, une fois par chantier).
function prgMailRefus_(m, regles, ctx, avecDrive) {
  const a = l => m.labels.indexOf(l) > -1;
  if (!a('SENT')) return 'pas dans les messages envoyés';
  if (a('TRASH')) return 'déjà à la corbeille';
  if (a('DRAFT')) return 'brouillon';
  if (a('INBOX')) return 'aussi dans la boîte de réception (mail reçu)';
  if (a('STARRED')) return 'mail suivi (étoile)';
  if (a('SPAM')) return 'indésirable';
  if (a('IMPORTANT')) return 'marqué « Important »';
  // tout autre libellé (créé par l'utilisateur, ou inconnu) : le mail compte pour quelqu'un, il n'est pas visé
  const autres = m.labels.filter(l => l !== 'SENT' && !/^CATEGORY_/.test(l));
  if (autres.length) return 'porte un libellé';
  if (!regles.compte || m.de.toLowerCase().indexOf(regles.compte) < 0) return 'pas envoyé par ce compte';
  if (m.de.indexOf(NOM_ENTREPRISE) < 0) return 'pas envoyé par l’appli (nom de l’expéditeur)';
  const f = prgMailFiche_(m.objet, ctx);
  if (!f) return 'objet qui ne commence pas par « ' + PRG_MAILS_OBJET.trim() + ' »';
  if (!f.fiche) return f.jamais ? 'demande d’absence : jamais visée' : 'pas une fiche de chantier de la liste';
  if (regles.test && m.objet.indexOf(PRG_MAILS_CHANTIER_TEST) < 0) return 'copie TEST : seuls les mails du chantier d’essai sont visés';
  if (!m.pj.length) return 'sans pièce jointe';
  if (!(m.date > 0) || m.date > regles.limite) return 'envoyé depuis moins de ' + regles.jours + ' jours';
  const destinataires = (m.a.match(/[^\s<>,;"]+@[^\s<>,;"]+/g) || []).map(prgAdresseNue_);
  if (!destinataires.length) return 'destinataires illisibles';
  if (destinataires.indexOf(prgAdresseNue_(regles.compte)) > -1) return 'ce compte est lui-même destinataire (mail reçu)';
  if (!f.chantier) return 'chantier inconnu de l’onglet Chantiers (fiche rangée dans « ' + DOSSIER_A_CLASSER + ' » ?)';
  const cle = f.chantier.cle;
  if (!regles.dossiers[cle]) regles.dossiers[cle] = prgDossierSur_(f.chantier, ctx);
  if (!regles.dossiers[cle].ok) return 'dossier Drive du chantier non sûr';
  if (!avecDrive) return '';
  if (!regles.tailles[cle]) {
    const inv = stkInventaire_(regles.dossiers[cle].dossier, ctx.cats, regles.depasse, true, ctx.idsDossiers), t = { complet: inv.complet };
    inv.liste.forEach(x => { t['/' + x.taille] = true; });
    regles.tailles[cle] = t;
  }
  if (!regles.tailles[cle].complet) return 'dossier Drive du chantier pas lu en entier';
  if (!m.pj.some(t => t > 0 && regles.tailles[cle]['/' + t])) return 'PDF de la fiche introuvable dans le dossier Drive du chantier (rangement échoué, ou chantier déjà purgé)';
  return '';
}
// Un mail vu comme un fichier de Drive par la reprise et l'annulation
function prgMailElement_(id) {
  return { getId: () => id,
    isTrashed: () => (Gmail.Users.Messages.get('me', id, { format: 'minimal' }).labelIds || []).indexOf('TRASH') > -1,
    setTrashed: v => { if (v) Gmail.Users.Messages.trash('me', id); else Gmail.Users.Messages.untrash('me', id); } };   // corbeille de Gmail, rien d'autre
}
// Pourquoi la ligne ne peut rien faire sur ce serveur ('' si elle le peut)
function prgMailsBloque_(ctx) {
  if (ctx.env) return ctx.env;
  if (!prgGmailPresent_()) return 'le service avancé Gmail n’est pas activé sur ce serveur : dans l’éditeur Apps Script, « Services » (le +) → « Gmail API » → Ajouter (à faire une fois)';
  if (!prgMailsCompte_()) return 'adresse du compte illisible : aucun mail n’est visé';
  return '';
}
// La proposition (mesure de la nuit) : compte et estime sur un échantillon, sans lire les dossiers de Drive. LECTURE SEULE.
function prgExaminerMails_(ctx, depasse) {
  const r = { possible: false, raisons: [], infos: [], items: [], octets: 0, nb: 0, dossierId: PRG_MAILS_ID, garde: null, carnet: null, pourquoi: '' };
  const bloque = prgMailsBloque_(ctx);
  if (bloque) { r.raisons.push(bloque); return r; }
  const regles = prgMailsRegles_(depasse), liste = prgMailsListe_(regles, PRG_MAILS_MAX_LISTE);
  let bons = 0, octets = 0, lus = 0;
  for (let i = 0; i < liste.ids.length && lus < PRG_MAILS_ECHANTILLON && !depasse(); i++) {
    const m = prgMailLu_(liste.ids[i]);
    lus++;
    if (!prgMailRefus_(m, regles, ctx, false)) { bons++; octets += m.taille; }
  }
  const nombre = lus ? Math.round(liste.ids.length * bons / lus) : 0;
  r.nb = nombre; r.octets = bons ? Math.round(octets / bons * nombre) : 0;
  for (let i = 0; i < nombre; i++) r.items.push(null);   // seul le nombre compte pour une proposition
  if (!nombre) { r.raisons.push('aucun mail de fiche de chantier de plus de ' + regles.jours + ' jours à mettre à la corbeille'); return r; }
  r.possible = true;
  r.pourquoi = 'Possible : au plus ' + (liste.plus ? 'plus de ' : 'environ ') + nombre + ' mail(s) de fiches de chantier envoyé(s) par l’appli avant le ' + stkJour_(regles.limite)
    + ' (environ ' + String(stkMo_(r.octets)).replace('.', ',') + ' Mo, estimation). Un mail ne part que si le PDF de sa fiche est retrouvé dans le dossier Drive de son chantier : '
    + 'les PDF de ces fiches sont rangés dans le Drive et recopiés dans le dossier du chantier sur le PC. ' + PRG_MAILS_JAMAIS_VISES
    + (regles.test ? ' Sur la copie TEST : seulement les mails du chantier d’essai.' : '')
    + ' Avant de cocher : vérifie que tu n’as plus besoin de retrouver ces mails dans Gmail, et purge les mails AVANT de purger un chantier terminé (après, ses mails ne sont plus visés). '
    + 'Après la mise à la corbeille, Gmail ne rend la place que ' + PRG_CORBEILLE_JOURS + ' jours plus tard.';
  return r;
}
// Appelée par la mesure de la nuit, à la fin d'un tour : la ligne n'est créée que s'il y a quelque chose à gagner
function prgProposerMails_(ctx, depasse) {
  const sh = feuillePurges_();
  const exam = prgExaminerMails_(ctx, depasse);
  return prgProposer_(sh, 'mails', PRG_MAILS_C, PRG_MAILS_ID, exam, exam.possible);
}
// Un passage sur des mails : chacun est LU UNE FOIS, passé à la règle ; seuls ceux qui passent sont écrits « à faire » au
// journal (identifiant, date, début de l'objet — rien d'un mail non visé), puis mis à la corbeille, puis marqués.
// Rend { coupe (temps écoulé), refuses (mails lus et non visés) }.
function prgExecuterMails_(shD, cle, ids, regles, ctx, depasse) {
  const rendu = { coupe: false, refuses: 0 };
  for (let i = 0; i < ids.length && !rendu.coupe; i += PRG_PAQUET) {
    const vises = [];
    for (let j = i; j < Math.min(ids.length, i + PRG_PAQUET); j++) {
      if (depasse()) { rendu.coupe = true; break; }
      let m = null, refus;
      try { m = prgMailLu_(ids[j]); refus = prgMailRefus_(m, regles, ctx, true); } catch (e) { refus = 'illisible'; }
      if (refus) rendu.refuses++;
      else vises.push({ type: 'mail', id: m.id, chemin: texteDate_(m.date) + ' — ' + m.objet.slice(0, 80), taille: m.taille, fichiers: 1 });
    }
    if (!vises.length) continue;
    const date = new Date(maintenant_()), debut = shD.getLastRow() + 1;
    stkAssurerLignes_(shD, debut + vises.length - 1);
    shD.getRange(debut, 1, vises.length, COL_D.chemin).setNumberFormat('@');
    shD.getRange(debut, 1, vises.length, PRG_DETAIL_ENTETES.length)
      .setValues(vises.map(x => [cle, x.type, x.id, x.chemin, x.taille, x.fichiers, date, 'à faire', date].map(cellule_)));
    SpreadsheetApp.flush();   // le journal d'abord
    const etats = vises.map(x => {
      if (rendu.coupe || depasse()) { rendu.coupe = true; return 'non fait (temps écoulé)'; }
      try { prgMailElement_(x.id).setTrashed(true); return 'fait'; }
      catch (e) { return 'échec : ' + (e && e.message ? e.message : e); }
    });
    prgMarquer_(shD, cle, debut, vises, etats);
    SpreadsheetApp.flush();
  }
  return rendu;
}
// La case « Mettre à la corbeille » de la ligne des mails : par passages de PRG_MAILS_PAR_PASSAGE mails lus
function prgPurgerMails_(sh, shD, cle, enCours, cochee, ctx, temps) {
  const props = PropertiesService.getScriptProperties();
  if (enCours && !cochee) { props.deleteProperty('PURGE_MAILS_SAUT'); prgFinir_(sh, shD, cle, 'Arrêtée : la case a été décochée pendant la purge.'); return; }
  const refuser = raison => {
    props.deleteProperty('PURGE_MAILS_SAUT');
    if (enCours) { prgFinir_(sh, shD, cle, 'Arrêtée avant la fin : ' + raison); return; }
    const c = {};
    c[COL_P.corbeille] = false; c[COL_P.possible] = 'non'; c[COL_P.pourquoi] = raison; c[COL_P.etat] = PRG_ETAT.impossible;
    c[COL_P.message] = 'Refusé le ' + texteDate_(maintenant_()) + ' : les conditions ne sont plus réunies. Rien n’a été mis à la corbeille.';
    prgEcrire_(sh, cle, c);
  };
  const bloque = prgMailsBloque_(ctx);
  if (bloque) { refuser(bloque.charAt(0).toUpperCase() + bloque.slice(1) + '.'); return; }
  if (!enCours) { prgRanger_(shD, cle); props.deleteProperty('PURGE_MAILS_SAUT'); }
  // Les mails lus et non visés restent dans la recherche : « saut » dit combien en passer au passage suivant
  const saut = Math.max(0, Number(props.getProperty('PURGE_MAILS_SAUT')) || 0);
  const regles = prgMailsRegles_(temps.depasse), liste = prgMailsListe_(regles, saut + PRG_MAILS_PAR_PASSAGE + 1);
  const ids = liste.ids.slice(saut, saut + PRG_MAILS_PAR_PASSAGE), encore = liste.plus || liste.ids.length > saut + PRG_MAILS_PAR_PASSAGE;
  if (!enCours && !ids.length) { refuser('Aucun mail de fiche de chantier de plus de ' + regles.jours + ' jours à mettre à la corbeille.'); return; }
  const c = {};
  c[COL_P.etat] = PRG_ETAT.enCours; c[COL_P.message] = 'Mise à la corbeille en cours depuis le ' + texteDate_(maintenant_()) + '.';
  prgEcrire_(sh, cle, c);
  SpreadsheetApp.flush();
  const r = prgExecuterMails_(shD, cle, ids, regles, ctx, temps.depassePurge);
  if (r.coupe || encore) {
    props.setProperty('PURGE_MAILS_SAUT', String(saut + r.refuses));
    prgEnCours_(sh, shD, cle, temps.epuise() ? PRG_SUITE_DEMAIN : 'En cours : la suite au prochain passage (30 minutes au plus).');
    return;
  }
  props.deleteProperty('PURGE_MAILS_SAUT');
  prgFinir_(sh, shD, cle, '');
}

// ── Installation du lot 5 (une fonction par environnement ; relançable sans danger) ──
function etapesLot5_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const etape = (nom, bons, creer) => ({
    nom: 'Onglet « ' + nom + ' »',
    fait: () => { const sh = ss.getSheetByName(nom); return !!sh && bons(sh); },
    action: () => {
      // Onglet déjà là avec d'autres titres : jamais rien réécrire par-dessus
      if (ss.getSheetByName(nom)) throw new Error('un onglet « ' + nom + ' » existe déjà avec d’autres titres : le renommer, puis relancer');
      creer();
      return 'onglet créé';
    } });
  return [
    etape(SHEET_STOCKAGE, stkTitresBons_, stkCreerOnglet_),
    etape(SHEET_PURGES, sh => noteTitresBons_(sh, PRG_ENTETES), feuillePurges_),
    etape(SHEET_PURGES_DETAIL, sh => noteTitresBons_(sh, PRG_DETAIL_ENTETES), feuillePurgesDetail_),
    // Sur TEST, les déclencheurs ne sont posés que pendant les essais (quota partagé avec la production)
    { nom: 'Déclencheurs ' + DECLENCHEURS.join(', ') + ' (installerDeclencheurs)', seulement: 'PRODUCTION',
      fait: () => { const p = ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction()); return DECLENCHEURS.every(d => p.indexOf(d) > -1); },
      action: () => installerDeclencheurs() },
  ];
}
// Informations utiles à Franck (jamais bloquantes)
function infosLot5_() {
  const place = placeCompte_();
  return ['Place du compte : ' + stkPlaceTexte_(place) + ' — chiffre lu par : ' + place.source + '.',
    place.source === 'DriveApp' ? 'Service avancé Drive : non activé. Compare ce chiffre avec celui de one.google.com/storage : s’ils diffèrent, active-le (docs/lot5-procedure.md).'
      : 'Service avancé Drive : activé (total du compte, part de Drive et de la corbeille).',
    'Première mesure : dans la nuit, ou tout de suite en lançant mesurerStockage (à relancer tant que le journal dit « À suivre »).',
    'Service avancé Gmail (pour la ligne « ' + PRG_QUOI.mails + ' ») : ' + (prgGmailPresent_() ? 'présent.' : 'ABSENT — dans l’éditeur : « Services » (le +) → « Gmail API » → Ajouter.'),
    'Rien n’est jamais mis à la corbeille sans une case cochée dans l’onglet « ' + SHEET_PURGES + ' ».'].join('\n');
}
function installerLot5_(attendu) {
  const r = installer_('Lot 5', attendu, etapesLot5_());
  let infos = '';
  if (r.ok) { try { infos = '\n' + infosLot5_(); } catch (e) { infos = '\n(informations indisponibles : ' + e.message + ')'; } Logger.log(infos); }
  return r.texte + infos;
}
function installerLot5Test() { return installerLot5_('TEST'); }
function installerLot5Production() { return installerLot5_('PRODUCTION'); }

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

// À lancer après le déploiement (le relancer ne crée pas de doublon : chaque déclencheur est supprimé puis recréé)
//  - renvoyerMailsEnAttente toutes les 2 h (lot 0)
//  - traiterComptes toutes les 10 min, et surModificationSheet à chaque modification du Sheet (lot 2 : cases
//    « Réinitialiser » et « Déconnecter », onglet « Accès chantiers »)
//  - mesurerStockage chaque nuit vers 2 h, poursuivreMesureStockage une heure plus tard (ne fait quelque chose que si le
//    tour de mesure n'est pas fini), traiterPurges toutes les 30 min (sort tout de suite s'il n'y a rien à faire) (lot 5)
const DECLENCHEURS = ['renvoyerMailsEnAttente', 'traiterComptes', 'surModificationSheet', 'mesurerStockage', 'poursuivreMesureStockage', 'traiterPurges'];
function installerDeclencheurs() {
  ScriptApp.getProjectTriggers()
    .filter(t => DECLENCHEURS.indexOf(t.getHandlerFunction()) > -1)
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('renvoyerMailsEnAttente').timeBased().everyHours(2).create();
  ScriptApp.newTrigger('traiterComptes').timeBased().everyMinutes(10).create();
  ScriptApp.newTrigger('surModificationSheet').forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet()).onEdit().create();
  ScriptApp.newTrigger('mesurerStockage').timeBased().atHour(2).nearMinute(0).everyDays(1).create();
  ScriptApp.newTrigger('poursuivreMesureStockage').timeBased().atHour(3).nearMinute(15).everyDays(1).create();
  ScriptApp.newTrigger('traiterPurges').timeBased().everyMinutes(30).create();
  const m = 'Déclencheurs installés : renvoyerMailsEnAttente (2 h), traiterComptes (10 min), surModificationSheet (à chaque modification), '
    + 'mesurerStockage (chaque nuit vers 2 h), poursuivreMesureStockage (vers 3 h), traiterPurges (30 min).';
  Logger.log(m); return m;
}

// Retire les déclencheurs de l'appli (à lancer sur la copie TEST après les essais : les 90 min de déclencheurs par jour
// sont partagées par tout le compte Google, production comprise)
function retirerDeclencheurs() {
  let n = 0;
  ScriptApp.getProjectTriggers().filter(t => DECLENCHEURS.indexOf(t.getHandlerFunction()) > -1)
    .forEach(t => { ScriptApp.deleteTrigger(t); n++; });
  const m = n + ' déclencheur(s) retiré(s). (installerDeclencheurs pour les remettre.)';
  Logger.log(m); return m;
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
  // Lot 7 : onglet des signalements (créé par installerLot7Test / installerLot7Production)
  ok(!!ss.getSheetByName(SHEET_SIGNALEMENTS), 'Onglet « ' + SHEET_SIGNALEMENTS + ' » (sinon lancer installerLot7Test ou installerLot7Production)');
  // Lot 1 R2 : onglet des matériaux proposés par le bordereau matériaux (créé vide, avec ses titres)
  if (!ss.getSheetByName(SHEET_MAT_BORDEREAU)) {
    feuille_(SHEET_MAT_BORDEREAU, ['Type', 'Matériau', 'Quantité']);
    lignes.push('✅ Onglet « ' + SHEET_MAT_BORDEREAU + ' » créé (vide) : une ligne par matériau — A le type, B le matériau, C la quantité');
  } else ok(true, 'Onglet « ' + SHEET_MAT_BORDEREAU + ' »');
  const presents = ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction());
  // Sur la copie TEST, les déclencheurs ne sont posés que pendant les essais (quota partagé avec la production) :
  // leur absence n'y est pas une erreur
  const surTest = environnementReel_().env === 'TEST';
  DECLENCHEURS.forEach(d => {
    if (presents.indexOf(d) > -1) ok(true, 'Déclencheur ' + d + (surTest ? ' (copie TEST : à retirer après les essais, retirerDeclencheurs)' : ''));
    else if (surTest) lignes.push('➖ Déclencheur ' + d + ' : absent (normal sur la copie TEST hors essais)');
    else ok(false, 'Déclencheur ' + d + ' (sinon lancer installerDeclencheurs)');
  });
  lignes.push(verifierComptes_());    // lot 2 : comptes, clé, partage du Sheet, transition
  lignes.push(verifierStockage_());   // lot 5 : onglets Stockage et Purges, place du compte
  // Outillage : les outils d'essai (porte de service et sa clé) ne doivent exister que sur la copie TEST
  const ou = environnementReel_(), porte = typeof outilTest_ === 'function', cleOutils = !!propriete_('CLE_OUTILS_TEST');
  if (ou.env === 'INCOHERENT') ok(false, 'Environnement incohérent : la propriété ENVIRONNEMENT et le nom du Sheet « ' + ou.sheet + ' » ne disent pas la même chose');
  if (ou.env !== 'TEST' && porte) ok(false, 'Ce serveur contient les OUTILS D’ESSAI (porte de service) : il ne doit tourner que sur la copie TEST. Recoller le Code.gs de production');
  if (ou.env !== 'TEST' && cleOutils) ok(false, 'La propriété CLE_OUTILS_TEST ne doit exister que sur la copie TEST : la supprimer ici');
  // Un déclencheur des outils d'essai resté en place (son code n'existe plus après un envoi « sans porte ») échouerait en boucle
  const restes = presents.filter(d => /^outilTest/.test(d));
  if (restes.length) ok(false, 'Déclencheur d’essai resté en place (' + restes.join(', ') + ') : le supprimer (éditeur → icône réveil « Déclencheurs » → ⋮ → Supprimer)');
  if (ou.env === 'TEST' && (porte || cleOutils)) lignes.push('Outils d’essai (copie TEST) : porte ' + (porte ? 'présente' : 'absente') + ', clé ' + (cleOutils ? 'présente' : 'absente'));
  lignes.push("Mails encore possibles aujourd'hui : " + MailApp.getRemainingDailyQuota());
  Logger.log(lignes.join('\n'));
  return lignes.join('\n');
}


// ══════════════════════════════════════════════════════════
// ESSAI DE MISE EN PAGE DES PHOTOS (lot 1, retouche R1) — à lancer sur TEST, AUCUN mail envoyé
// Fabrique 3 PDF d'essai à la racine du Drive de l'appli (« _ESSAI MISE EN PAGE … ») et écrit dans le journal,
// pour chacun : le format de page réel du PDF de Google, le nombre de pages obtenu et le nombre prévu.
// Si une ligne dit « refait », le contrôle automatique a dû corriger : envoyer le journal à Claude.
// ══════════════════════════════════════════════════════════
const ESSAI_PHOTO_JPEG = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAGAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDEooor9dPyQ//Z';
const ESSAI_CROQUIS_PNG = 'iVBORw0KGgoAAAANSUhEUgAAACIAAAAVCAIAAACsWquAAAAAZUlEQVR4nL3NOw7AIAwEUQ7h+1/VKYIERJbjzy5TTPuGXGmIiKq+J7UYqnQwPMxgGJLNwDGPAWL/DEQKMX0swXSwNFOTKkwBqzMpqcXEMQATwWCMLyEZB8MzJsZiPhKR2bHJXOgBFDn9wGtZlnUAAAAASUVORK5CYII=';
function essaiMiseEnPage() {
  const racine = DriveApp.getFolderById(driveRootId_());
  const photo = label => ({ data: ESSAI_PHOTO_JPEG, mimeType: 'image/jpeg', label: label || '' });
  const croquis = { data: ESSAI_CROQUIS_PNG, mimeType: 'image/png', label: 'Croquis' };
  const ligne = (i, n) => ({ repere: 'R' + i, qte: 2, long: 2040, larg: 830, haut: 40, section: '40x40', materiau: 'Médium', finition: 'BLANC', quincaillerie: 'Paumelles', observations: n });
  const cas = [
    ['fabrication', modele_fabrication, { chantier: 'ESSAI MISE EN PAGE', date: '01/01/2026', auteur: 'Essai', chefAtelier: 'Essai', conducteur: 'Essai', delai: 'Essai',
      blocs: [{ id: 1, type: 'divers', rows: [ligne(1, 'photo en page 1'), ligne(2, 'croquis en page 2')] }], photosBase64: [photo('Photo : toute la place sous le tableau'), croquis] }],
    ['quitus', modele_quitus, { chantier: 'ESSAI MISE EN PAGE', date: '01/01/2026', heure: '12h00', intervenant: 'Essai', solde: 'OUI',
      description: 'Essai : 1 photo en page 1 sous les signatures, 2 photos sur la page 2.', photosBase64: [photo('1'), photo('2'), photo('3')] }],
    ['bordereau', modele_bordereau, { type: 'bordereau-materiaux', chantier: 'ESSAI MISE EN PAGE', date: '01/01/2026', heure: '12h00', soussigne: 'Essai', preneur: 'Essai',
      entreprise: 'Essai', typeDoc: 'Kit', nombre: '1', listeMateriaux: '2 × Vis\n1 × Mousse', photosBase64: [photo('Photo en page 1')] }],
  ];
  const lignes = ['Essai de mise en page (' + VERSION_API + ')'];
  cas.forEach(([nom, modele, d]) => {
    const html = modele(d, esc_);
    const brut = HtmlService.createHtmlOutput(html).getAs('application/pdf');
    const info = infoPdf_(brut);
    const prevues = pagesPrevues_(html);
    const blob = pdfDuModele_(modele, d, '_ESSAI MISE EN PAGE ' + nom + '.pdf');
    const refait = info.pages && info.pages > prevues;
    const anciens = racine.getFilesByName(blob.getName());
    while (anciens.hasNext()) anciens.next().setTrashed(true);
    racine.createFile(blob);
    lignes.push((refait ? '⚠ ' : '✅ ') + nom + ' : format ' + (info.l ? info.l + ' × ' + info.h + ' mm' : 'illisible')
      + ', ' + (info.pages || '?') + ' page(s) pour ' + prevues + ' prévue(s)' + (refait ? ' → contrôle : PDF refait (voir le journal d’exécution)' : ''));
  });
  lignes.push('PDF à ouvrir à la racine du Drive de l’appli : « _ESSAI MISE EN PAGE … » (à supprimer ensuite).');
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
      // Lot 5c : le planning n'est plus gardé partagé (il est envoyé par le serveur aux seuls comptes de l'appli)
      const garder = morceaux[0] === 'RACINE' && SOUS_DOSSIERS_PARTAGES.indexOf(morceaux[2]) > -1;
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
// PARTAGES PAR LIEN RESTÉS DANS LES DOSSIERS « Plans » (lot 4b) — LECTURE SEULE
// Jusqu'au lot 4b, ouvrir la tuile « Plans » mettait chaque fichier du dossier Plans d'un chantier en partage
// « toute personne disposant du lien ». La tuile est retirée et l'appli ne pose plus ces partages, mais ceux
// déjà posés restent : c'est Franck qui décide de les retirer (à la main dans Drive).
// listerPartagesPlans() écrit dans l'onglet « Partages Plans » les fichiers et dossiers encore partagés.
// Elle ne modifie RIEN dans le Drive (aucun partage changé, rien de supprimé, rien de déplacé).
// Si le journal dit « À suivre », la relancer : elle reprend où elle s'était arrêtée.
// ══════════════════════════════════════════════════════════
const SHEET_PARTAGES_PLANS = 'Partages Plans';
const ENTETES_PARTAGES_PLANS = ['Chantier', 'Chemin', 'Nom', 'Élément', 'Type de partage', 'Modifié le', 'Identifiant'];
const TEXTES_PARTAGE = {
  ANYONE_WITH_LINK: 'toute personne disposant du lien', ANYONE: 'public (trouvable sur Internet)',
  DOMAIN_WITH_LINK: 'toute personne du domaine disposant du lien', DOMAIN: 'toute personne du domaine',
};
const TEXTES_DROIT = { VIEW: 'lecture', COMMENT: 'commentaire', EDIT: 'modification' };

function listerPartagesPlans() {
  const debut = Date.now();
  const tempsDepasse = () => Date.now() - debut > DUREE_MAX_MS;
  const props = PropertiesService.getScriptProperties();
  const sh = feuille_(SHEET_PARTAGES_PLANS, ENTETES_PARTAGES_PLANS);
  let suite = null;
  try { suite = JSON.parse(props.getProperty('PARTAGES_PLANS_SUITE') || 'null'); } catch (e) {}
  // Une reprise n'est suivie que si elle est récente ET si l'onglet contient exactement ce qu'elle y avait écrit :
  // sinon (relance des jours plus tard, onglet supprimé ou modifié entre-temps) la liste serait annoncée « terminée »
  // alors qu'il y manquerait les premiers chantiers. Dans le doute, on repart de zéro.
  if (suite && (!(Date.now() - Number(suite.debut) < 3600000) || Math.max(0, sh.getLastRow() - 1) !== Number(suite.lignes))) suite = null;
  if (!suite) {
    // Nouvelle liste : l'ancienne est effacée (cet onglet n'est qu'un état des lieux, il ne sert à aucun retour arrière)
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, ENTETES_PARTAGES_PLANS.length).clearContent();
    suite = { apres: '', chantiers: 0, sansPlans: 0, incomplets: 0, partages: 0, lignes: 0, debut: Date.now() };
  }
  const chantiers = dossiersChantiersConnus_();
  // Nom du dossier Plans : celui de dossiers.json s'il existe (sinon le nom par défaut, sans créer le fichier : lecture seule)
  const cheminPlans = fichierDossiers_(DriveApp.getFolderById(driveRootId_())) ? dossiers_().documents.plans : DOSSIERS_DEFAUT.documents.plans;
  const cheminsPlans = [cheminPlans, DOSSIERS_DEFAUT.documents.plans, 'Plans'].filter((c, i, t) => c && t.indexOf(c) === i);
  let fini = true, faitsCePassage = 0;
  for (let i = 0; i < chantiers.length; i++) {
    const ch = chantiers[i];
    if (suite.apres && ch.id <= suite.apres) continue;   // déjà fait lors d'un passage précédent
    if (tempsDepasse()) { fini = false; break; }
    const lignes = [];
    // 4 : le dossier du chantier lui-même, s'il est partagé (tout ce qu'il contient l'est alors aussi)
    partageDe_(ch.dossier, ch.nom, '', 'dossier du chantier', lignes);
    const plans = [];
    cheminsPlans.forEach(c => sousDossiersParChemin_(ch.dossier, c).forEach(d => { if (!plans.some(x => x.getId() === d.getId())) plans.push(d); }));
    let complet = true;
    for (let k = 0; k < plans.length && complet; k++) complet = partagesDuDossier_(plans[k], ch.nom, plans[k].getName(), lignes, tempsDepasse);
    // Limite de temps au milieu d'un chantier : il sera refait en entier au passage suivant. S'il est le premier
    // du passage, il ne tiendra jamais dans un passage : ce qui a été vu est écrit, avec une ligne « liste incomplète »
    if (!complet && faitsCePassage) { fini = false; break; }
    suite.partages += lignes.length;
    if (!complet) { lignes.push([ch.nom, '', '⚠ liste incomplète pour ce chantier (trop d’éléments pour un seul passage)', '', '', '', '']); suite.incomplets++; }
    // Les lignes sont écrites AVANT de noter où l'on en est : rien n'est perdu si l'exécution est coupée
    if (lignes.length) sh.getRange(sh.getLastRow() + 1, 1, lignes.length, ENTETES_PARTAGES_PLANS.length).setValues(lignes.map(l => l.map(cellule_)));
    suite.apres = ch.id; suite.chantiers++; faitsCePassage++; suite.lignes += lignes.length;
    if (!plans.length) suite.sansPlans++;
    props.setProperty('PARTAGES_PLANS_SUITE', JSON.stringify(suite));
  }
  const n = suite.partages;   // les éléments partagés (les lignes « ⚠ liste incomplète » ne comptent pas)
  let msg;
  if (!fini) {
    msg = 'À suivre : ' + suite.chantiers + ' dossier(s) de chantier parcouru(s) sur ' + chantiers.length + ', ' + n
      + ' ligne(s) dans l’onglet « ' + SHEET_PARTAGES_PLANS + ' ». Relancer listerPartagesPlans() pour continuer.';
  } else {
    props.deleteProperty('PARTAGES_PLANS_SUITE');
    msg = ['Liste terminée : ' + n + ' ligne(s) dans l’onglet « ' + SHEET_PARTAGES_PLANS + ' » (fichiers et dossiers encore partagés par lien dans les dossiers « ' + cheminPlans + ' » des chantiers).',
      suite.chantiers + ' dossier(s) de chantier parcouru(s), dont ' + suite.sansPlans + ' sans dossier « ' + cheminPlans + ' ».',
      suite.incomplets ? '⚠ ' + suite.incomplets + ' chantier(s) avec une liste incomplète (voir les lignes ⚠ de l’onglet).' : '',
      'Rien n’a été modifié dans le Drive : c’est vous qui décidez de retirer ces partages (dans Drive : clic droit → Partager → « Accès limité »).',
      'Un élément peut être partagé seulement parce que le dossier qui le contient l’est : commencez par les dossiers, du plus haut au plus bas, puis relancez cette liste pour voir ce qui reste.',
      'Les raccourcis ne sont pas suivis : seul le partage du raccourci est lu, pas celui du fichier qu’il désigne.',
    ].filter(Boolean).join('\n');
  }
  Logger.log(msg);
  return msg;
}

// Dossiers de chantier connus : ceux de l'onglet « Dossiers chantiers » et les sous-dossiers de la racine
// (hors dossiers techniques et corbeille), sans doublon, toujours dans le même ordre (par identifiant) pour la reprise
function dossiersChantiersConnus_() {
  const parId = {};
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_DOSSIERS);   // lu seulement : jamais créé ici
  (sh ? sh.getDataRange().getValues().slice(1) : []).forEach(l => {
    const id = String(l[2] || '').trim();
    if (!id || parId[id]) return;
    try { const d = DriveApp.getFolderById(id); if (!d.isTrashed()) parId[id] = { id: id, nom: String(l[0] || d.getName()), dossier: d }; } catch (e) {}
  });
  const it = DriveApp.getFolderById(driveRootId_()).getFolders();
  while (it.hasNext()) {
    const d = it.next();
    if (d.isTrashed() || estDossierTechnique_(d) || parId[d.getId()]) continue;
    parId[d.getId()] = { id: d.getId(), nom: d.getName(), dossier: d };
  }
  return Object.keys(parId).sort().map(id => parId[id]);
}

// Tous les sous-dossiers « A/B » d'un dossier (Drive accepte plusieurs dossiers du même nom : aucun n'est oublié)
function sousDossiersParChemin_(parent, chemin) {
  const morceaux = String(chemin || '').split('/').map(x => x.trim()).filter(Boolean);
  if (!morceaux.length) return [];
  let niveau = [parent];
  morceaux.forEach(nom => {
    const suivants = [];
    niveau.forEach(d => { const it = d.getFoldersByName(nom); while (it.hasNext()) { const x = it.next(); if (!x.isTrashed()) suivants.push(x); } });
    niveau = suivants;
  });
  return niveau;
}

// Ajoute à « lignes » l'élément (dossier ou fichier) s'il est partagé ; LECTURE SEULE.
function partageDe_(el, chantier, chemin, type, lignes) {
  let acces, droit = '';
  try { acces = String(el.getSharingAccess()); droit = String(el.getSharingPermission()); }
  catch (e) { acces = 'ILLISIBLE'; droit = e.message; }
  if (acces === 'PRIVATE') return;
  const texte = acces === 'ILLISIBLE' ? 'partage illisible (' + droit + ') : à regarder dans Drive'
    : (TEXTES_PARTAGE[acces] || acces) + (TEXTES_DROIT[droit] ? ' — ' + TEXTES_DROIT[droit] : '');
  let date = '';
  try { date = Utilities.formatDate(el.getLastUpdated(), 'Europe/Paris', 'dd/MM/yyyy'); } catch (e) {}
  lignes.push([chantier, chemin, el.getName(), type, texte, date, el.getId()]);
}
// Ajoute à « lignes » le dossier (s'il est partagé), ses fichiers partagés, puis ses sous-dossiers ; LECTURE SEULE.
// Renvoie false si la limite de temps est atteinte avant la fin.
function partagesDuDossier_(dossier, chantier, chemin, lignes, tempsDepasse) {
  const SEP = ' › ';   // comme l'onglet du lot 0 (« / » apparaît dans certains noms)
  const noter = (el, type) => partageDe_(el, chantier, chemin, type, lignes);
  noter(dossier, 'dossier');
  const fichiers = dossier.getFiles();
  while (fichiers.hasNext()) {
    if (tempsDepasse()) return false;
    const f = fichiers.next();
    if (!f.isTrashed()) noter(f, 'fichier');
  }
  const sous = dossier.getFolders();
  while (sous.hasNext()) {
    if (tempsDepasse()) return false;
    const d = sous.next();
    if (!d.isTrashed() && !partagesDuDossier_(d, chantier, chemin + SEP + d.getName(), lignes, tempsDepasse)) return false;
  }
  return true;
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

// ████ Installation.gs ████
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// INSTALLATION D'UN LOT EN UNE SEULE FONCTION (outillage, décision O-4)
//
// Au lieu de lancer 5 fonctions une par une, Franck lance UNE fonction par lot :
//   installerLotNTest()        sur la copie TEST
//   installerLotNProduction()  en production
// Chacune refuse de tourner dans le mauvais environnement.
//
// Une installation est une liste d'ÉTAPES. Chaque étape a deux parties :
//   fait()   → répond à « est-ce déjà fait ? » en LISANT l'état réel (propriété, onglet, déclencheur…)
//   action() → fait le travail ; lancée SEULEMENT si fait() répond non
// Conséquences : on peut relancer l'installation sans danger (rien de déjà fait n'est rejoué ni réécrit),
// et elle s'arrête à la première erreur (les étapes suivantes ne sont pas lancées).
// Le bilan est écrit dans le journal de l'éditeur et dans l'onglet « Installation » (50 dernières lignes).
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
const SHEET_INSTALLATION = 'Installation';
const INSTALLATION_LIGNES_GARDEES = 50;

// Où sommes-nous ? TEST = propriété ENVIRONNEMENT à TEST ET Sheet nommé « … TEST … ».
// PRODUCTION = ni l'un ni l'autre. Un seul des deux : INCOHÉRENT, on ne touche à rien.
function environnementReel_() {
  const nom = SpreadsheetApp.getActiveSpreadsheet().getName();
  const propTest = propriete_('ENVIRONNEMENT') === 'TEST', nomTest = /TEST/i.test(nom);
  return { sheet: nom, env: propTest && nomTest ? 'TEST' : (!propTest && !nomTest ? 'PRODUCTION' : 'INCOHERENT') };
}

// lot : texte (« Lot 7 »). attendu : 'TEST' ou 'PRODUCTION' (ignoré en contrôle seul).
// etapes : [{ nom, fait: () => vrai/faux, action: () => texte, seulement: 'TEST' | 'PRODUCTION' (facultatif) }]
// options.controleSeul : pose seulement les questions « déjà fait ? », ne lance AUCUNE action.
function installer_(lot, attendu, etapes, options) {
  options = options || {};
  const ou = environnementReel_();
  const mode = options.controleSeul ? 'contrôle seul' : 'installation';
  const lignes = [lot + ' — ' + mode + ' — environnement : ' + ou.env + ' — Sheet « ' + ou.sheet + ' » — serveur ' + VERSION_API];
  const finir = (reussi) => {
    const texte = lignes.join('\n');
    Logger.log(texte);
    try { ecrireBilanInstallation_(lot, ou.env, mode, lignes); }
    catch (e) { Logger.log('(bilan non écrit dans l’onglet « ' + SHEET_INSTALLATION + ' » : ' + e.message + ')'); }
    return { ok: reussi, texte: texte, lignes: lignes };
  };

  if (ou.env === 'INCOHERENT') {
    lignes.push('❌ Refusé : la propriété ENVIRONNEMENT et le nom du Sheet ne disent pas la même chose (TEST = propriété ENVIRONNEMENT à TEST ET Sheet nommé « … TEST … »). Rien n’a été fait.');
    return finir(false);
  }
  if (!options.controleSeul && ou.env !== attendu) {
    lignes.push('❌ Refusé : cette fonction est prévue pour ' + attendu + ', et ce projet est ' + ou.env + '. Rien n’a été fait.');
    return finir(false);
  }

  let aFaire = 0;
  for (let i = 0; i < etapes.length; i++) {
    const e = etapes[i], n = (i + 1) + '/' + etapes.length + ' ' + e.nom;
    if (e.seulement && e.seulement !== ou.env) { lignes.push('➖ ' + n + ' : non concerné sur ' + ou.env); continue; }
    try {
      if (e.fait()) { lignes.push('✅ ' + n + ' : déjà fait'); continue; }
      if (options.controleSeul) { lignes.push('⬜ ' + n + ' : à faire'); aFaire++; continue; }
      if (typeof e.action !== 'function') throw new Error('pas d’action automatique pour cette étape');
      const retour = e.action();
      if (!e.fait()) throw new Error('l’action a tourné mais l’étape n’est toujours pas faite' + (retour ? ' (' + String(retour).slice(0, 200) + ')' : ''));
      lignes.push('✅ ' + n + ' : fait' + (retour ? ' — ' + String(retour).split('\n')[0].slice(0, 200) : ''));
    } catch (err) {
      lignes.push('❌ ' + n + ' : ' + (err && err.message ? err.message : err));
      const reste = etapes.length - i - 1;
      lignes.push('⛔ Arrêt à cette étape' + (reste ? ' : les ' + reste + ' étape(s) suivante(s) n’ont PAS été lancées.' : '.') + ' Envoyer ce bilan à Claude.');
      return finir(false);
    }
  }
  lignes.push(options.controleSeul
    ? (aFaire ? 'Contrôle terminé : ' + aFaire + ' étape(s) à faire. Rien n’a été modifié.' : 'Contrôle terminé : tout est en place. Rien n’a été modifié.')
    : '✅ ' + lot + ' : installation terminée.');
  return finir(true);
}

// Onglet « Installation » : Date, Lot, Environnement, Mode, Ligne — on ne garde que les 50 dernières lignes
function ecrireBilanInstallation_(lot, env, mode, lignes) {
  const sh = feuille_(SHEET_INSTALLATION, ['Date', 'Lot', 'Environnement', 'Mode', 'Bilan']);
  const date = new Date();
  // Écrit juste sous la dernière ligne remplie (appendRow se placerait sous des lignes vidées plus bas)
  const debut = sh.getLastRow() + 1, manque = debut + lignes.length - 1 - sh.getMaxRows();
  if (manque > 0) sh.insertRowsAfter(sh.getMaxRows(), manque);
  if (lignes.length) sh.getRange(debut, 1, lignes.length, 5).setValues(lignes.map(l => [date, lot, env, mode, l]));
  const derniere = sh.getLastRow(), enTrop = derniere - 1 - INSTALLATION_LIGNES_GARDEES;
  if (enTrop > 0) {
    const gardees = sh.getRange(2 + enTrop, 1, INSTALLATION_LIGNES_GARDEES, 5).getValues();
    sh.getRange(2, 1, derniere - 1, 5).clearContent();
    sh.getRange(2, 1, INSTALLATION_LIGNES_GARDEES, 5).setValues(gardees);
  }
}

// ── Lot 2 : CONTRÔLE SEUL ────────────────────────────────────────────────────────────────────────────────
// Le lot 2 a été installé à la main (procédure du lot 2). Cette fonction ne réinstalle rien : elle vérifie
// seulement que chaque étape est en place, et n'écrit rien d'autre que son bilan. Elle ne lance jamais
// preparerOngletsLot2, installerDeclencheurs ni mesurerHachage.
function etapesLot2_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return [
    { nom: 'Clé des jetons (genererCle)', fait: () => !!propriete_('CLE_JETON') },
    { nom: 'Onglets « ' + SHEET_UTILISATEURS + ' » et « ' + SHEET_ACCES + ' » (preparerOngletsLot2)',
      fait: () => !!ss.getSheetByName(SHEET_UTILISATEURS) && !!ss.getSheetByName(SHEET_ACCES) },
    // Sur TEST, les déclencheurs ne sont posés que pendant les essais (quota partagé avec la production)
    { nom: 'Déclencheurs ' + DECLENCHEURS.join(', ') + ' (installerDeclencheurs)', seulement: 'PRODUCTION',
      fait: () => { const p = ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction()); return DECLENCHEURS.every(d => p.indexOf(d) > -1); } },
    { nom: 'Propriété HACHAGE_ITERATIONS (mesurerHachage)', fait: () => !!propriete_('HACHAGE_ITERATIONS') },
  ];
}
function controlerInstallationLot2() {
  return installer_('Lot 2', null, etapesLot2_(), { controleSeul: true }).texte;
}

// ████ Modeles.gs ████
// ═══════════════════════════════════════════════════════════════
// FICHIER GÉNÉRÉ AUTOMATIQUEMENT — NE PAS MODIFIER À LA MAIN
// Copie des modèles de PDF du dossier modeles/ (node outils/construire.js).
// Pour changer un PDF : modifier modeles/<document>.js, relancer la commande, recoller ce fichier.
// ═══════════════════════════════════════════════════════════════

// ── modeles/absence.js ──
// ═══════════════════════════════════════════════════════════════
// MODÈLE UNIQUE du PDF « Demande d'absence »
// Utilisé tel quel par la page (aperçu, impression sur PC) ET par le serveur (PDF envoyé par mail) :
// apps-script/Modeles.gs est une COPIE générée par « node outils/construire.js » — ne jamais la modifier à la main.
// Règles : tableaux et styles en ligne seulement (le convertisseur PDF de Google ne connaît ni flex ni grid),
// pas de backticks imbriqués, tout texte saisi passe par esc().
// d : données de la fiche (textes bruts ; images déjà contrôlées) ; esc : fonction d'échappement
// ═══════════════════════════════════════════════════════════════
function modele_absence(d, esc) {
  var CASE = 'padding:7px 10px;border:1px solid #D8D4CE;';
  var ETIQ = CASE + 'font-weight:700;background:#FAFAF8;font-size:9px;color:#6A6460;text-transform:uppercase;width:38%';
  var TEXTE = 'white-space:pre-wrap;word-break:break-word;overflow-wrap:break-word;';
  var depot = d.dateDepot || '';
  function ligne(titre, valeur, gras) {
    return '<tr><td style="' + ETIQ + '">' + titre + '</td><td style="' + CASE + 'font-size:12px;' + TEXTE + (gras ? 'font-weight:700' : '') + '">'
      + esc(valeur || '—') + '</td></tr>';
  }
  // Case à cocher dessinée par un tableau (le convertisseur PDF ne connaît pas flex)
  function caseACocher(texte) {
    return '<td style="width:16px;height:16px;border:1.5px solid #333333"></td><td style="padding:0 24px 0 8px;font-size:12px">' + texte + '</td>';
  }
  function zoneSignature(titre, contenu, legende, hauteur) {
    return '<td style="width:50%;padding-right:8px;vertical-align:top">'
      + '<div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:4px">' + titre + '</div>'
      + '<div style="border:1px solid #D8D4CE;border-radius:4px;height:' + hauteur + 'px;background:#FAFAF8;text-align:center;padding:4px">' + contenu + '</div>'
      + '<div style="font-size:9px;color:#6A6460;margin-top:3px">' + legende + '</div></td><td style="width:50%"></td>';
  }
  var signature = d.signature ? '<img src="' + d.signature + '" style="max-width:100%;max-height:72px;">' : '';

  return '<html><head><meta charset="utf-8"><style>@page{size:A4;margin:1.5cm}body{font-family:Arial,sans-serif;font-size:10px;margin:0}*{box-sizing:border-box}</style></head><body>'
    + '<table style="width:100%;border-collapse:collapse;margin-bottom:16px;border-bottom:3px solid #B87A00"><tr>'
    + '<td style="vertical-align:middle;width:45%;padding-bottom:10px"><div style="font-weight:800;font-size:16px;color:#1A2B4A">Loué Menuiserie</div>'
    + '<div style="font-size:9px;color:#6A6460">Menuiserie · Charpente · Agencement</div></td>'
    + '<td style="text-align:center;vertical-align:middle;padding-bottom:10px"><div style="font-weight:800;font-size:14px;color:#B87A00">DEMANDE D’ABSENCE</div>'
    + '<div style="font-size:10px;color:#6A6460;margin-top:3px">Déposée le ' + esc(depot || '—') + '</div></td>'
    + '</tr></table>'
    + '<table style="width:100%;border-collapse:collapse;margin-bottom:12px">'
    + ligne('Demandeur', d.nom, true)
    + ligne('Date d’absence', d.dateAbsence)
    + ligne('Durée', d.duree)
    + ligne('Imputation', d.imputation)
    + ligne('Motif', d.motif)
    + (d.precisions ? ligne('Précisions', d.precisions) : '')
    + '</table>'
    + '<div style="padding:8px 12px;background:#FFF3CC;border:1px solid #B87A00;border-radius:4px;font-size:10px;color:#8A5B00;margin-bottom:14px">'
    + 'Les absences seront prises sur votre compteur selon l’imputation choisie.<br>'
    + 'Acceptation selon l’accord de la Direction (voir coupon réponse ci-dessous).</div>'
    + '<table style="width:100%;border-collapse:collapse;margin-bottom:16px;page-break-inside:avoid"><tr>'
    + zoneSignature('Signature du demandeur', signature, 'Fait le ' + esc(depot || '—') + ' à St Mathurin', 80)
    + '</tr></table>'
    + '<div style="border-top:2px dashed #D8D4CE;margin-bottom:14px"></div>'
    + '<div style="page-break-inside:avoid">'
    + '<div style="text-align:center;font-weight:800;font-size:13px;color:#1A2B4A;margin-bottom:14px;letter-spacing:.5px">COUPON RÉPONSE DE LA DIRECTION</div>'
    + '<table style="border-collapse:collapse;margin-bottom:12px"><tr>' + caseACocher('Demande acceptée') + caseACocher('Demande refusée') + '</tr></table>'
    + '<div style="font-size:12px;margin-bottom:16px">Motif du refus : ______________________________________________________</div>'
    + '<table style="width:100%;border-collapse:collapse"><tr>'
    + zoneSignature('Signature de la Direction', '', 'Fait le ________________ à St Mathurin', 70)
    + '</tr></table></div>'
    + '</body></html>';
}

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

  var qualite = d.qualite ? ', en qualité de ' + esc(d.qualite) : '';

  // ── Photos (modeles/mise-en-page.js) : la 1re sous la signature, dans toute la place restante de la page 1,
  // les autres en pleine page (deux par page si elles y gardent leur taille). Hauteur du contenu mesurée dans Chrome :
  // 87,9 mm + 4,94 par ligne d'objet ; contrôle DAS 129,9 + 7,2 par point ; référence 3,7 ; chantier long 4,2 par ligne.
  var estime;
  if (type === 'das') {
    estime = 129.9;
    (d.dasPoints || []).forEach(function (p) { estime += 7.17 + 3.5 * (mep_lignes(p && p.label, 120, 10) - 1); });
    estime += 3.5 * (mep_lignes(d.dasLocalisation, 110, 10) + mep_lignes(d.asservissements, 110, 10) - 2);
  } else estime = 87.9 + 4.94 * mep_lignes(d.objet || '—', 168, 11);
  estime += (d.ref ? 3.7 : 0) + 4.2 * (mep_lignes(chantier, 110, 10) - 1)
    + 5 * (mep_lignes('Je soussigné ' + (d.signataire || '') + (d.qualite ? ', en qualité de ' + d.qualite : '') + ', certifie que :', 175, 12) - 1);
  var zone = mep_zone(d, 210, 297, 15);
  var photosHtml = mep_photos(photos, { largeur: zone.largeur, hauteur: zone.hauteur, reste: mep_reste(zone, estime), estime: estime, esc: esc });
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
    + '<table style="width:100%;border-collapse:collapse;margin-top:14px;page-break-inside:avoid"><tr>'
    + '<td style="width:50%;padding-right:8px;vertical-align:top">'
    + '<div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:4px">Signature</div>'
    + '<div style="border:1px solid #D8D4CE;border-radius:4px;height:80px;background:#FAFAF8;text-align:center;padding:4px">'
    + (d.signature ? '<img src="' + d.signature + '" style="max-width:100%;max-height:72px;">' : '') + '</div>'
    + '<div style="font-size:9px;color:#6A6460;margin-top:3px">' + esc(d.signataire || '') + ' — ' + esc(d.date || '') + '</div>'
    + '</td><td style="width:50%"></td></tr></table>'
    + photosHtml
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
  // Matériaux remis (bordereau matériaux, lot 1 R2) : proposés d'après le Type (onglet « Matériaux bordereau »), modifiables
  var liste = !orga && d.listeMateriaux ? String(d.listeMateriaux).replace(/\s+$/, '') : '';
  var listeHtml = liste ? '<br><span style="font-weight:700">Matériaux remis :</span><br><span style="word-break:break-word;white-space:pre-wrap">' + esc(liste) + '</span>' : '';

  // ── Photos (modeles/mise-en-page.js) : la 1re sous les signatures, dans toute la place restante de la page 1,
  // les autres en pleine page (deux par page si elles y gardent leur taille). Hauteur du contenu mesurée dans Chrome :
  // 72,4 mm ; mention de l'organigramme 22,5 ; chaque ligne de commentaire ou de matériau 5,5 ; ligne du preneur ou
  // du type trop longue : 5,5 par ligne en plus ; chantier long dans l'en-tête : 3 par ligne en plus.
  var estime = 72.4 + (orga ? 22.5 : 0) + 5.53 * ((d.commentaires ? mep_lignes(d.commentaires, 168, 11) : 0) + (liste ? 1 + mep_lignes(liste, 168, 11) : 0))
    + 5.53 * (mep_lignes('déclare par la présente avoir remis en main propre à ' + (d.preneur || '—') + ' (' + (d.fonction || '') + ') — ' + (d.entreprise || '') + ' :', 168, 11) - 1)
    + 5.53 * (mep_lignes((d.nombre || '—') + ' × ' + (d.typeDoc || '—'), 168, 11) - 1)
    + 5.53 * (mep_lignes('Je soussigné(e) ' + (d.soussigne || '—') + ', Entreprise Loué Menuiserie,', 168, 11) - 1)
    + 3 * (mep_lignes('Chantier : ' + (d.chantier || '—'), 70, 10) - 1);
  var zone = mep_zone(d, 210, 297, 15);
  var photosHtml = mep_photos(d.photosBase64, { largeur: zone.largeur, hauteur: zone.hauteur, reste: mep_reste(zone, estime), estime: estime, esc: esc });

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
    + '<strong>' + esc(d.nombre || '—') + ' × ' + esc(d.typeDoc || '—') + '</strong>' + listeHtml + commentaires
    + '</div>'
    + '<table style="width:100%;border-collapse:collapse;margin-top:14px;page-break-inside:avoid"><tr>'
    + signature('Signature Entreprise Loué', d.sigLoue) + signature('Signature Preneur', d.sigPreneur)
    + '</tr></table>'
    + mention
    + photosHtml
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

  // ── Photos et croquis (modeles/mise-en-page.js) : la 1re photo sous les blocs, en page 1, dans toute la place
  // restante ; chaque croquis sur une page entière ; les autres photos en pleine page (ou deux par page) ──
  // Hauteur estimée du contenu de la page 1 (mm), mesurée dans Chrome : en-tête 44 (tableau des temps), ou le cartouche
  // de gauche + 4 s'il est plus haut (31,2 ; chantier : 4,5 par ligne en plus ; zone 8,8 + 2,9 par ligne en plus ;
  // précision du délai 3,5 + 3,1 par ligne en plus) ; bloc 26 (porte 25,7) + 5,3 par ligne en plus ; bloc vide 17,2 ;
  // commentaires 8,2 + 1,5 × la taille de la police par ligne (4 mm en taille normale, 5,6 « agrandi »).
  // Les blocs ne se coupent pas d'une page à l'autre.
  var cartouche = 31.2 + 4.5 * (mep_lignes(String(d.chantier || '—') + (d.refChantier ? ' / ' + d.refChantier : ''), 68, 12) - 1)
    + (d.zone ? 8.8 + 2.9 * (mep_lignes(d.zone, 84, 10) - 1) : 0)
    + (d.delaiPrecision ? 3.5 + 3.1 * (mep_lignes(d.delaiPrecision, 40, 10) - 1) : 0);
  var estime = Math.max(44, cartouche + 4);
  (d.blocs || []).forEach(function (b) {
    if (b.type === 'photo') return;
    var rows = b.rows || [];
    if (!rows.length) { estime += 17.2; return; }
    estime += (b.type === 'porte' ? 25.7 : 26.2) + 5.3 * (rows.length - 1);
    rows.forEach(function (r) {   // texte long dans une case : lignes en plus
      var plusLong = 0;
      Object.keys(r).forEach(function (k) { if (typeof r[k] === 'string' || typeof r[k] === 'number') plusLong = Math.max(plusLong, String(r[k]).length); });
      if (plusLong > 40) estime += 3.4 * Math.ceil((plusLong - 40) / 40);
    });
  });
  if (commentaireSection) {
    estime += 8.2;
    // Le champ éditable du téléphone écrit « Ligne 1<div>Ligne 2</div><div><br></div>… » : chaque <div>/<p> ouvre une
    // ligne, un <br> seul dans un bloc est une ligne vide (comptée : elle prend sa place à l'écran)
    String(commentaires).replace(/<br\s*\/?>\s*(<\/div>|<\/p>)/gi, '$1').replace(/<(div|p)\b[^>]*>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(div|p)>/gi, '').replace(/^\n/, '').replace(/\n+$/, '').split('\n').forEach(function (ligne) {
      var tailles = [10];   // taille de police la plus grande de la ligne (px), « agrandi » = 1,4 em
      (ligne.match(/font-size:\s*[\d.]+(em|px|%)/gi) || []).forEach(function (t) {
        var n = parseFloat(t.replace(/font-size:\s*/i, ''));
        tailles.push(/em/i.test(t) ? n * 10 : /%/.test(t) ? n / 10 : n);
      });
      var px = Math.min(40, Math.max.apply(null, tailles));
      estime += mep_lignes(mep_texteBrut(ligne), 260, px) * px * 1.5 * MEP_PX_MM;
    });
  }
  var zone = mep_zone(d, 297, 210, 10);
  var photosSection = mep_photos(d.photosBase64, { largeur: zone.largeur, hauteur: zone.hauteur, reste: mep_reste(zone, estime), estime: estime, esc: esc,
    pagesContenu: mep_pages(zone, estime), croquisParLegende: true });

  return '<html><head><meta charset="utf-8"><style>@page{size:landscape;margin:1cm}body{font-family:Arial,sans-serif;font-size:10px;margin:0}*{box-sizing:border-box}</style></head><body>'
    + enTete + blocsHtml + commentaireSection + photosSection
    + '</body></html>';
}

// ── modeles/mise-en-page.js ──
// ═══════════════════════════════════════════════════════════════
// MISE EN PAGE COMMUNE des photos et croquis dans les PDF (retouche R1 du lot 1)
// Utilisée par tous les modèles de modeles/ : par la page (aperçu, impression sur PC) ET par le serveur
// (apps-script/Modeles.gs en est une COPIE générée par « node outils/construire.js »).
// Le PDF du serveur est fabriqué sans JavaScript : tout est calculé ici, en millimètres.
// Règles :
//  1. la première photo se place sous le contenu de la page 1 et prend toute la place restante
//     (s'il reste trop peu de place, elle part sur une page à elle) ;
//  2. un croquis (image PNG dessinée dans l'appli) a toujours une page entière ;
//  3. les autres photos : une par page, ou deux si elles y gardent presque leur taille (90 % de leurs côtés).
// Les tailles sont calculées à partir de la taille réelle de l'image (lue dans ses premiers octets) :
// une petite image est AGRANDIE (max-width / max-height ne le font jamais).
// ═══════════════════════════════════════════════════════════════
var MEP_PX_MM = 25.4 / 96;          // 1 pixel CSS = 0,2646 mm
var MEP_LEGENDE_MM = 6;             // place d'une légende sous la photo
var MEP_ECART_MM = 4;               // espace entre deux photos d'une même page
var MEP_MIN_PAGE1_MM = 60;          // en dessous, la première photo ne reste pas en page 1
var MEP_PAIRE = 0.8;                // deux photos par page seulement si chacune garde 80 % de sa surface seule (90 % de ses côtés)
var MEP_MARGE_PAGE_MM = 8;          // place gardée libre sur une page de photos (moteur PDF de Google pas mesuré)

// Largeur et hauteur (pixels) d'une image en base64, lues dans ses premiers octets ; null si inconnues
function mep_taille(p) {
  if (p && p.mepTaille !== undefined) return p.mepTaille;   // déjà lue (une photo est mesurée plusieurs fois)
  var t = mep_lireTaille(p);
  try { if (p) p.mepTaille = t; } catch (e) {}
  return t;
}
function mep_lireTaille(p) {
  var b64 = p && typeof p.data === 'string' ? p.data.replace(/\s/g, '') : '';
  if (!b64) return null;
  var ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  // Décode seulement le début (un JPEG produit par l'appli a sa taille dans les 1 000 premiers octets)
  function octets(n) {
    var sortie = [], tampon = 0, bits = 0, fin = Math.min(b64.length, Math.ceil(n / 3) * 4);
    for (var i = 0; i < fin; i++) {
      var c = b64.charAt(i);
      if (c === '=') break;
      var v = ALPHA.indexOf(c);
      if (v < 0) return sortie;
      tampon = (tampon << 6) | v; bits += 6;
      if (bits >= 8) { bits -= 8; sortie.push((tampon >> bits) & 255); }
    }
    return sortie;
  }
  var o = octets(24);
  if (o.length >= 24 && o[0] === 0x89 && o[1] === 0x50 && o[2] === 0x4E && o[3] === 0x47) {   // PNG : bloc IHDR
    var w = ((o[16] << 24) | (o[17] << 16) | (o[18] << 8) | o[19]) >>> 0;
    var h = ((o[20] << 24) | (o[21] << 16) | (o[22] << 8) | o[23]) >>> 0;
    return w && h ? { w: w, h: h } : null;
  }
  if (o.length >= 4 && o[0] === 0xFF && o[1] === 0xD8) {                                       // JPEG : marqueur SOF
    o = octets(65536);
    var i = 2;
    while (i + 9 < o.length) {
      if (o[i] !== 0xFF) { i++; continue; }
      var m = o[i + 1];
      if (m === 0xFF) { i++; continue; }
      if (m === 0xD8 || m === 0x01 || (m >= 0xD0 && m <= 0xD7)) { i += 2; continue; }
      var long = (o[i + 2] << 8) | o[i + 3];
      if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
        var hj = (o[i + 5] << 8) | o[i + 6], wj = (o[i + 7] << 8) | o[i + 8];
        return wj && hj ? { w: wj, h: hj } : null;
      }
      if (m === 0xDA || long < 2) return null;   // début de l'image sans taille trouvée
      i += 2 + long;
    }
  }
  return null;
}

// Croquis = image PNG (croquis dessiné dans l'appli ; les photos sont toujours en JPEG) ou photo dont la légende
// contient « croquis » (photo d'un croquis sur papier)
// (la légende ne compte que pour la fiche de fabrication : option croquisParLegende de mep_photos)
function mep_estCroquis(p, parLegende) {
  return !!(p && (p.croquis === true || /png/i.test(p.mimeType || p.mime || '') || (parLegende && /croquis/i.test(p.label || ''))));
}

// Taille (mm) d'une image qui tient dans une boîte l * h en gardant ses proportions ; null si taille inconnue
function mep_ajuster(p, l, h) {
  var t = mep_taille(p);
  if (!t) return null;
  var r = Math.min(l / t.w, h / t.h);
  return { l: Math.floor(t.w * r * 10) / 10, h: Math.floor(t.h * r * 10) / 10 };
}

// Balise <img> d'une photo qui tient dans une boîte l * h (mm), avec sa légende.
// Seule la LARGEUR est imposée (hauteur automatique) : les proportions sont toujours gardées, et
// max-width:100% évite tout débordement dans l'aperçu d'un petit écran.
function mep_image(p, l, h, esc) {
  var src = 'data:' + (p.mimeType || p.mime || 'image/jpeg') + ';base64,' + p.data;
  var t = mep_ajuster(p, l, h);
  var style = t ? 'width:' + t.l + 'mm;max-width:100%;height:auto'
                : 'max-width:100%;max-height:' + Math.floor(h) + 'mm;width:auto;height:auto';
  return '<img src="' + src + '" style="' + style + ';display:block;margin:0 auto;border:1px solid #ddd">'
    + (p.label ? '<div style="font-size:9px;color:#666;margin-top:2px;text-align:center">' + esc(p.label) + '</div>' : '');
}

// Surface (mm²) qu'occupe une photo dans une boîte : sert à décider si deux photos partagent une page
function mep_surface(p, l, h) {
  var t = mep_ajuster(p, l, h);
  return t ? t.l * t.h : 0;
}

// Tout le bloc « photos » d'un document.
// photos : [{ data, mimeType, label, croquis? }] ; o : {
//   largeur, hauteur : zone utile d'une page (mm, sans les marges),
//   reste            : place libre (mm) sous le contenu de la page 1 (0 ou moins = la page 1 est pleine),
//   estime           : hauteur estimée du contenu de la page 1 (mm), notée dans le document (contrôles),
//   esc              : fonction d'échappement,
//   titre(i, n)      : (facultatif) titre affiché en haut de chaque page de photos,
//   page1Titre       : (facultatif) titre au-dessus de la photo de la page 1,
//   pagesContenu     : (facultatif) nombre de pages estimé du contenu (contrôle du serveur), 1 par défaut,
//   croquisParLegende: (facultatif) une photo dont la légende contient « croquis » est un croquis }
function mep_photos(photos, o) {
  photos = (photos || []).filter(function (p) { return p && p.data; });
  if (!photos.length) return '';
  var esc = o.esc, L = o.largeur, H = o.hauteur;
  var titreH = o.titre ? 9 : 0;                         // hauteur du titre d'une page de photos
  // Repère invisible pour le contrôle du serveur : nombre de pages du contenu avant les photos
  var html = '<div data-mep-contenu="' + Math.max(1, Math.round(o.pagesContenu || 1)) + '" style="display:none"></div>';
  var reste = photos.slice();
  var croquis = function (p) { return mep_estCroquis(p, o.croquisParLegende); };

  // 1. Première photo (pas un croquis) sous le contenu de la page 1
  var place = (o.reste || 0) - (o.page1Titre ? 9 : 0) - 3;
  var premiere = -1;
  for (var i = 0; i < reste.length; i++) if (!croquis(reste[i])) { premiere = i; break; }
  if (premiere > -1 && place >= MEP_MIN_PAGE1_MM) {
    var p0 = reste.splice(premiere, 1)[0];
    var h0 = place - (p0.label ? MEP_LEGENDE_MM : 0);
    html += '<div data-mep="page1" data-estime="' + Math.round(o.estime || 0) + '" style="margin-top:3mm;page-break-inside:avoid">' + (o.page1Titre || '') + mep_image(p0, L, h0, esc) + '</div>';
  }

  // 2 et 3. Pages de photos : croquis seul, photos par une ou par deux
  var hPage = H - titreH - MEP_MARGE_PAGE_MM;
  var pages = [];
  while (reste.length) {
    var a = reste.shift();
    var hA = hPage - (a.label ? MEP_LEGENDE_MM : 0);
    if (!croquis(a) && reste.length && !croquis(reste[0])) {
      var b = reste[0];
      // Deux photos : l'une sous l'autre (page debout) ou côte à côte (page couchée)
      var debout = H >= L;
      var lD = debout ? L : (L - MEP_ECART_MM) / 2;
      var hD = debout ? (hPage - MEP_ECART_MM) / 2 : hPage;
      var hDa = hD - (a.label ? MEP_LEGENDE_MM : 0), hDb = hD - (b.label ? MEP_LEGENDE_MM : 0);
      var seuleA = mep_surface(a, L, hA), seuleB = mep_surface(b, L, hPage - (b.label ? MEP_LEGENDE_MM : 0));
      if (seuleA && seuleB && mep_surface(a, lD, hDa) >= MEP_PAIRE * seuleA && mep_surface(b, lD, hDb) >= MEP_PAIRE * seuleB) {
        reste.shift();
        pages.push(debout
          ? mep_image(a, lD, hDa, esc) + '<div style="height:' + MEP_ECART_MM + 'mm"></div>' + mep_image(b, lD, hDb, esc)
          : '<table style="width:100%;border-collapse:collapse"><tr>'
            + '<td style="width:50%;vertical-align:top;text-align:center;padding:0">' + mep_image(a, lD, hDa, esc) + '</td>'
            + '<td style="width:50%;vertical-align:top;text-align:center;padding:0">' + mep_image(b, lD, hDb, esc) + '</td></tr></table>');
        continue;
      }
    }
    pages.push(mep_image(a, L, hA, esc));
  }
  pages.forEach(function (contenu, n) {
    html += '<div data-mep="photos" style="page-break-before:always;page-break-inside:avoid">'
      + (o.titre ? o.titre(n, pages.length) : '') + contenu + '</div>';
  });
  return html;
}

// Nombre de lignes d'un texte dans une largeur (mm) pour une taille de police (px) — estimation prudente (Arial)
function mep_lignes(texte, largeurMm, policePx) {
  var parLigne = Math.max(1, Math.floor(largeurMm / (policePx * MEP_PX_MM * 0.56)));
  return String(texte === undefined || texte === null ? '' : texte).split('\n').reduce(function (n, l) {
    return n + Math.max(1, Math.ceil(l.length / parLigne));
  }, 0);
}
// Hauteur (mm) d'un texte : lignes × police × interligne
function mep_hauteurTexte(texte, largeurMm, policePx, interligne) {
  return mep_lignes(texte, largeurMm, policePx) * policePx * (interligne || 1.2) * MEP_PX_MM;
}

// Zone utile d'une page (mm) : format prévu par le modèle, ou format réel du PDF mesuré par le serveur
// (d._mepFormat = { l, h } en mm) quand le premier PDF a débordé ; d._mepSansPage1 : photo de la page 1 interdite.
function mep_zone(d, l, h, marge) {
  var f = d && d._mepFormat;
  var paysage = l > h;
  if (f && f.l > 50 && f.h > 50) { l = paysage ? Math.max(f.l, f.h) : Math.min(f.l, f.h); h = paysage ? Math.min(f.l, f.h) : Math.max(f.l, f.h); }
  // d._mepMargeEnPlus : le serveur a trouvé une page de trop → pages de photos un peu moins hautes
  var enPlus = d && d._mepMargeEnPlus > 0 ? Math.min(40, Number(d._mepMargeEnPlus)) : 0;
  // hauteurContenu : sans la marge en plus (sert seulement à compter les pages du contenu)
  return { largeur: l - 2 * marge, hauteur: h - 2 * marge - enPlus, hauteurContenu: h - 2 * marge, sansPage1: !!(d && d._mepSansPage1) };
}
// Nombre de pages estimé d'un contenu (contrôle du serveur)
function mep_pages(zone, estime) { return Math.max(1, Math.ceil((estime || 0) / (zone.hauteurContenu || zone.hauteur))); }
// Place libre sous un contenu estimé (marge de sécurité de 6 mm), 0 si le contenu ne tient pas sur la page 1
function mep_reste(zone, estime) {
  if (zone.sansPage1) return 0;
  var reste = zone.hauteur - estime - 6;
  return reste > 0 ? reste : 0;
}
// Texte d'un champ mis en forme (commentaires de la fabrication) : retours à la ligne gardés, balises retirées
function mep_texteBrut(html) {
  return String(html || '').replace(/<br\s*\/?>|<\/(div|p)>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, 'x').replace(/\n+$/, '');
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
  var TEXTE = 'white-space:pre-wrap;word-break:break-word;overflow-wrap:break-word;';
  var ETIQ = 'font-size:7.5px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:2px';


  var commentaires = d.commentaires
    ? '<div style="padding:10px 12px;background:#F0F5F4;border:1.5px solid #0D7A6B;border-radius:5px;margin-bottom:10px">'
      + '<div style="font-size:8px;font-weight:700;text-transform:uppercase;color:#0D7A6B;margin-bottom:6px;letter-spacing:.5px">Notes &amp; commentaires</div>'
      + '<div style="font-size:11px;line-height:1.7;' + TEXTE + '">' + esc(d.commentaires) + '</div></div>'
    : '';

  // ── Photos (modeles/mise-en-page.js) : la 1re sous les notes si elles tiennent sur la page 1, dans toute la place
  // restante ; les autres en pleine page (deux par page si elles y gardent leur taille). Hauteur mesurée dans Chrome :
  // en-tête 36 mm (chantier long : 4,5 par ligne en plus, rédacteur : 3,2 ; objet long : 4,2) ; notes 12,5 + 4,94 par ligne.
  var estime = 36 + Math.max(4.5 * (mep_lignes(d.chantier || '—', 35, 12) - 1) + 3.2 * (mep_lignes(d.auteur || '—', 39, 11) - 1),
    4.2 * (d.objet ? mep_lignes(d.objet, 100, 11) - 1 : 0))
    + (d.commentaires ? 12.5 + 4.94 * mep_lignes(d.commentaires, 168, 11) : 0);
  var zone = mep_zone(d, 210, 297, 15);
  var photosHtml = mep_photos(d.photosBase64, { largeur: zone.largeur, hauteur: zone.hauteur, reste: mep_reste(zone, estime), estime: estime, esc: esc,
    pagesContenu: mep_pages(zone, estime) });

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

  // ── Photos (modeles/mise-en-page.js) : la 1re sous les signatures, dans toute la place restante de la page 1,
  // les autres en pleine page (deux par page si elles y gardent leur taille). Hauteur du contenu mesurée dans Chrome :
  // 66,4 mm sans description ; description 12,2 + 5 mm par ligne ; chantier long : 4,2 mm par ligne en plus.
  var estime = 66.4 + (d.description ? 12.2 + 4.95 * mep_lignes(d.description, 168, 11) : 0)
    + 4.2 * (mep_lignes(chantier, 70, 11) - 1);
  var zone = mep_zone(d, 210, 297, 15);
  var photosHtml = mep_photos(d.photosBase64, { largeur: zone.largeur, hauteur: zone.hauteur, reste: mep_reste(zone, estime), estime: estime, esc: esc });

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
    + '<table style="width:100%;border-collapse:collapse;margin-top:14px;page-break-inside:avoid"><tr>'
    + signature('Signature Entreprise Loué', d.sigLoue) + signature('Signature Client', d.sigIntervenant)
    + '</tr></table>'
    + photosHtml
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

  // Photos de chaque point (modeles/mise-en-page.js) : pages à part, titre du point en haut de chaque page,
  // chaque photo en pleine page (deux par page si elles y gardent leur taille)
  var zone = mep_zone(d, 210, 297, 15);
  // Pages du contenu (contrôle du serveur) : estimation basse (en-tête et signature 60 mm, 7 mm par point)
  var pagesContenu = mep_pages(zone, 60 + 7 * points.length);
  var photosHtml = points.map(function (p, n) {
    var titre = function (n, total) {
      return '<div style="font-weight:700;font-size:11px;color:#0D7A6B;border-bottom:2px solid #0D7A6B;padding-bottom:4px;margin-bottom:2mm;height:7mm;overflow:hidden">'
        + 'Photos — ' + esc(p.label || '') + (total > 1 ? ' (' + (n + 1) + '/' + total + ')' : '') + '</div>';
    };
    return mep_photos(p.photos, { largeur: zone.largeur, hauteur: zone.hauteur, reste: 0, esc: esc, titre: titre, pagesContenu: pagesContenu });
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

// ── modeles/signalement.js ──
// ═══════════════════════════════════════════════════════════════
// MODÈLE du PDF « Signalement » (casse / manquant / à recommander) — lot 7
// Utilisé par le serveur (PDF joint au mail et rangé dans le dossier du chantier) :
// apps-script/Modeles.gs est une COPIE générée par « node outils/construire.js » — ne jamais la modifier à la main.
// Règles : tableaux et styles en ligne seulement (le convertisseur PDF de Google ne connaît ni flex ni grid),
// pas de backticks imbriqués, tout texte saisi passe par esc().
// d : données du signalement (textes bruts ; images déjà contrôlées), plus d.auteur (nom donné par le serveur) ;
// esc : fonction d'échappement
// ═══════════════════════════════════════════════════════════════
function modele_signalement(d, esc) {
  var urgent = d.urgence === 'Bloquant';
  var couleur = urgent ? '#B32E2E' : '#1A2B4A';
  var fond = urgent ? '#FAE8E8' : '#E8EDF5';
  function bloc(titre, texte) {
    if (!texte) return '';
    return '<div style="padding:10px 12px;background:#F7F5F1;border:1px solid #D8D4CE;border-radius:5px;margin-bottom:10px">'
      + '<div style="font-size:8px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:5px">' + titre + '</div>'
      + '<div style="font-size:11px;line-height:1.7;white-space:pre-wrap;word-break:break-word;overflow-wrap:break-word">' + esc(texte) + '</div></div>';
  }
  // ── Photos (modeles/mise-en-page.js) : la 1re dans la place restante de la page 1, les autres en pleine page.
  // Hauteur du contenu estimée comme le quitus : en-tête et bandeaux 62 mm ; chaque bloc de texte 12,2 mm + 5 mm par ligne.
  var estime = 62
    + (d.repere ? 12.2 + 4.95 * mep_lignes(d.repere, 168, 11) : 0)
    + (d.commentaire ? 12.2 + 4.95 * mep_lignes(d.commentaire, 168, 11) : 0)
    + 4.2 * (mep_lignes(d.chantier || '—', 70, 11) - 1);
  var zone = mep_zone(d, 210, 297, 15);
  var photosHtml = mep_photos(d.photosBase64, { largeur: zone.largeur, hauteur: zone.hauteur, reste: mep_reste(zone, estime), estime: estime, esc: esc });

  return '<html><head><meta charset="utf-8"><style>@page{size:A4;margin:1.5cm}body{font-family:Arial,sans-serif;font-size:10px;margin:0}*{box-sizing:border-box}</style></head><body>'
    + '<table style="width:100%;border-collapse:collapse;margin-bottom:14px;border-bottom:3px solid ' + couleur + ';padding-bottom:10px"><tr>'
    + '<td style="vertical-align:middle;width:40%"><div style="font-weight:800;font-size:16px;color:#1A2B4A">Loué Menuiserie</div>'
    + '<div style="font-size:9px;color:#6A6460">Menuiserie · Charpente · Agencement</div></td>'
    + '<td style="vertical-align:middle;text-align:center;width:40%"><div style="font-weight:800;font-size:15px;color:' + couleur + '">SIGNALEMENT</div>'
    + '<div style="font-size:11px;color:#6A6460;margin-top:4px">Chantier : <b>' + esc(d.chantier || '—') + '</b></div>'
    + '<div style="font-size:11px;color:#6A6460">Le ' + esc(d.date || '—') + ' à ' + esc(d.heure || '—') + '</div></td>'
    + '<td style="vertical-align:middle;text-align:right;width:20%"><div style="font-size:9px;color:#6A6460">Signalé par</div>'
    + '<div style="font-size:10px;font-weight:700">' + esc(d.auteur || '—') + '</div></td>'
    + '</tr></table>'
    + '<table style="width:100%;border-collapse:collapse;margin-bottom:12px"><tr>'
    + '<td style="padding:10px 14px;background:#E8EDF5;border:1.5px solid #1A2B4A;border-radius:8px;width:50%">'
    + '<div style="font-size:8px;font-weight:700;text-transform:uppercase;color:#6A6460">Type</div>'
    + '<div style="font-size:14px;font-weight:800;color:#1A2B4A">' + esc(d.type || '—') + '</div></td>'
    + '<td style="width:8px"></td>'
    + '<td style="padding:10px 14px;background:' + fond + ';border:1.5px solid ' + couleur + ';border-radius:8px;width:50%">'
    + '<div style="font-size:8px;font-weight:700;text-transform:uppercase;color:#6A6460">Urgence</div>'
    + '<div style="font-size:14px;font-weight:800;color:' + couleur + '">' + esc(d.urgence || '—') + '</div></td>'
    + '</tr></table>'
    + bloc('Repère', d.repere)
    + bloc('Commentaire', d.commentaire)
    + '<div style="font-size:10px;color:#6A6460;margin-bottom:6px">Atelier prévenu : <b>' + (d.atelier === true ? 'oui' : 'non') + '</b></div>'
    + photosHtml
    + '</body></html>';
}
