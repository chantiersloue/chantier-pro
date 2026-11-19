// ═══════════════════════════════════════════════════════════════
// Loué App — Apps Script v4.1 (lot 0 : sécurité)
// Loué Menuiserie
// ═══════════════════════════════════════════════════════════════

const VERSION_API = 'v11.3';   // 11.3 : lot 10a-2 (onglet « Articles » : la liste d'articles proposés pendant la frappe) ; 11.2 : lot 10a-1 (« À commander » : onglet « Demandes », récapitulatif de 15 h 45) ; la v11.1 (lot 8c, points) a été retirée le 19/11/2026 avant toute mise en production ; 11.0 : lot 8b (onglet « Comptes rendus », une ligne par note de réunion) ; 10.1 : lot 5c (planning lisible par les seuls comptes, plus aucun lien de partage) ; 10.0 : lot 5 (suivi du stockage, purge sur case cochée) ; 9.1 : retrait de la lecture du dossier Plans (lot 4b) ; 9.0 : lot 4a (carnet de chantier) ; 8.0 : lot 3 (notes de chantier) ; 7.0 : lot 7 (signalements) ; 6.0 : lot 2 (comptes)

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

// ── LOT 10 — « À COMMANDER » (petit matériel des poseurs) : les réglages. Les heures sont à l'heure de Paris, été comme hiver ──
const DEMANDES_HEURE_LIMITE  = '15:45';  // du lundi au vendredi : le récapitulatif part au premier passage du réveil des 10 minutes après cette heure
const DEMANDES_FIN_ESSAIS    = '17:30';  // si le mail n'a pas pu partir : nouvel essai toutes les 10 minutes jusqu'à cette heure, puis report au récapitulatif suivant
const DEMANDES_MAX_PAR_JOUR  = 30;       // demandes acceptées par compte et par jour
const DEMANDES_JOURS_LISTE   = 90;       // « Mes demandes » : les 90 derniers jours

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
