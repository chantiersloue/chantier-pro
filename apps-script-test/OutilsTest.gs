// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// OUTILS D'ESSAI — « PORTE DE SERVICE » DE LA COPIE TEST (outillage, décisions O-3 à O-5)
//
// CE FICHIER N'EXISTE QUE DANS LE SERVEUR ENVOYÉ SUR LA COPIE TEST. Il n'est pas dans le dossier apps-script/,
// n'entre jamais dans A-COLLER-DANS-APPS-SCRIPT/Code.gs, et outils/construire.js refuse de fabriquer un
// serveur de production qui le contiendrait.
//
// Il permet à Claude, depuis le PC, de lancer sur TEST quelques gestes d'une LISTE FERMÉE (écrits ci-dessous
// en toutes lettres : aucune fonction du serveur n'est appelable par son nom), au lieu de demander à Franck
// de cliquer dans l'éditeur. Conditions, toutes obligatoires :
//   1. propriété ENVIRONNEMENT = TEST et Sheet nommé « … TEST … » (environnementReel_) ;
//   2. propriété CLE_OUTILS_TEST d'au moins 32 caractères, et la même clé dans le corps de l'appel ;
//   3. un geste de la liste.
// Tout autre appel reçoit la même réponse « Refusé », sans détail (même si une erreur survient avant le contrôle de la clé).
//
// Les gestes qui écrivent ne touchent qu'à TROIS COMPTES D'ESSAI FIXES (auto-poseur, auto-conducteur, auto-admin)
// et aux réglages d'essai de la copie TEST (déclencheurs, transition). Aucun geste ne touche à Drive : avant d'en
// ajouter un, refuser aussi si le dossier racine ne s'appelle pas « … TEST … ».
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
const OUTIL_TEST_CLE_MIN = 32;
const OUTIL_TEST_REFUS = { ok: false, code: 'REFUSE', message: 'Refusé' };
const OUTIL_TEST_COMPTES = { 'auto-poseur': 'Poseur', 'auto-conducteur': 'Conducteur', 'auto-admin': 'Admin' };
const OUTIL_TEST_CASES = { reinit: 'reinit', deconnecter: 'deconnecter', actif: 'actif' };   // nom reçu → colonne de COL_U

function outilTest_(corps) {
  let autorise = false;
  try {
    const ou = environnementReel_();
    if (ou.env !== 'TEST') return OUTIL_TEST_REFUS;
    const cle = propriete_('CLE_OUTILS_TEST');
    if (!cle || cle.length < OUTIL_TEST_CLE_MIN) return OUTIL_TEST_REFUS;
    if (typeof corps.cle !== 'string' || !egaux_(corps.cle, cle)) return OUTIL_TEST_REFUS;
    autorise = true;
    const ok = (message, data) => ({ ok: true, code: 'OK', message: message, data: data || {} });

    switch (corps.geste) {
      // ── Lire ──
      case 'etat':
        return ok('Outils d’essai : prêts', {
          environnement: ou.env, sheet: ou.sheet, version: VERSION_API,
          empreinte: typeof EMPREINTE_SERVEUR === 'string' ? EMPREINTE_SERVEUR : '',
          declencheurs: ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction()).sort(),
          transitionOuverte: transitionOuverte_(), transitionJusquau: finTransition_(),
          mailsPossibles: MailApp.getRemainingDailyQuota() });
      case 'lireEnvois':    return ok('Dernières lignes de l’onglet Envois', { lignes: outilTestDernieresLignes_(SHEET_ENVOIS, corps.n) });
      case 'lireBilan':     return ok('Dernières lignes de l’onglet Installation', { lignes: outilTestDernieresLignes_(SHEET_INSTALLATION, corps.n) });
      case 'lireChantiers': return ok('Chantiers de la copie TEST', { chantiers: lignesChantiers_().slice(0, 30).map(r => ({ nom: String(r[0]), statut: String(r[2] || ''), conducteur: String(r[3] || '') })) });
      case 'lireCompte':    return ok('Compte d’essai', outilTestLireCompte_(outilTestIdFixe_(corps.id)));

      // ── Lancer (fonctions existantes, sans paramètre) ──
      case 'controlerLot2':        return ok(controlerInstallationLot2());
      case 'poserDeclencheurs':    return ok(installerDeclencheurs());
      case 'retirerDeclencheurs':  return ok(retirerDeclencheurs());
      case 'traiterComptes':       return ok('traiterComptes : ' + (traiterComptes() || 'fait'));
      case 'finirTransition':      return ok(finirTransitionMaintenant());
      case 'prolongerTransition':  return ok(prolongerTransition());
      case 'essaiDeclencheur':     return outilTestEssaiDeclencheur_();

      // ── Écrire : seulement les trois comptes d'essai fixes ──
      case 'preparerComptes':  return ok('Comptes d’essai', outilTestPreparerComptes_());
      case 'cocher':           return ok('Case modifiée', outilTestCocher_(outilTestIdFixe_(corps.id), corps.case, corps.valeur));
      case 'session':          return ok('Session d’essai ouverte', outilTestSession_(outilTestIdFixe_(corps.id)));
      case 'fermerSessions':   return ok('Sessions d’essai fermées', outilTestFermerSessions_());
      default:
        return OUTIL_TEST_REFUS;
    }
  } catch (e) {
    if (!autorise) return OUTIL_TEST_REFUS;   // jamais de détail technique pour qui n'a pas la clé
    return { ok: false, code: 'ERREUR_OUTIL', message: 'Outil d’essai : ' + (e && e.message ? e.message : e) };
  }
}

// Un identifiant reçu n'est accepté que s'il est EXACTEMENT l'un des trois comptes d'essai
function outilTestIdFixe_(id) {
  if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(OUTIL_TEST_COMPTES, id)) throw new Error('compte refusé (seuls ' + Object.keys(OUTIL_TEST_COMPTES).join(', ') + ')');
  return id;
}
// Les n dernières lignes d'un onglet (20 au plus), telles qu'affichées, titres en premier
function outilTestDernieresLignes_(nomOnglet, n) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nomOnglet);
  if (!sh || sh.getLastRow() < 1) return [];
  const combien = Math.max(1, Math.min(20, Math.floor(Number(n)) || 5));
  const derniere = sh.getLastRow(), largeur = Math.max(1, Math.min(12, sh.getLastColumn()));
  const titres = sh.getRange(1, 1, 1, largeur).getDisplayValues();
  if (derniere < 2) return titres;
  const debut = Math.max(2, derniere - combien + 1);
  return titres.concat(sh.getRange(debut, 1, derniere - debut + 1, largeur).getDisplayValues());
}
function outilTestLireCompte_(id) {
  UTILISATEURS_ = null;
  const u = utilisateurs_(), l = u.parId[id];
  if (!l) return { id: id, existe: false };
  return { id: id, existe: true, ligne: l.ligne, role: l.role, actif: l.actif, utilisable: compteUtilisable_(u, id),
    etat: String(l.valeurs[COL_U.etat - 1] || ''), reinit: l.valeurs[COL_U.reinit - 1] === true, deconnecter: l.valeurs[COL_U.deconnecter - 1] === true,
    aProvisoire: String(l.valeurs[COL_U.provisoire - 1] || '') !== '',   // le mot de passe provisoire lui-même n'est jamais renvoyé
    versionSession: Number(lireCompte_(id).ver || 1) };
}
// Crée les comptes d'essai qui manquent (une ligne chacun, à la suite). Ne modifie jamais une ligne existante.
function outilTestPreparerComptes_() {
  UTILISATEURS_ = null;
  const u = utilisateurs_(), crees = [], presents = [];
  Object.keys(OUTIL_TEST_COMPTES).forEach(id => {
    if (u.parId[id]) { presents.push(id); return; }
    const ligne = u.sh.getLastRow() + 1, role = OUTIL_TEST_COMPTES[id];
    const valeurs = []; for (let c = 1; c <= COL_U.etat; c++) valeurs.push('');
    valeurs[COL_U.id - 1] = id; valeurs[COL_U.nom - 1] = 'AUTO ' + role; valeurs[COL_U.role - 1] = role;
    valeurs[COL_U.actif - 1] = true; valeurs[COL_U.reinit - 1] = false; valeurs[COL_U.deconnecter - 1] = false; valeurs[COL_U.tous - 1] = false;
    valeurs[COL_U.etat - 1] = 'compte d’essai automatique (outillage)';
    u.sh.getRange(ligne, 1, 1, COL_U.etat).setValues([valeurs]);
    crees.push(id);
  });
  UTILISATEURS_ = null;
  return { crees: crees, dejaPresents: presents };
}
function outilTestCocher_(id, nomCase, valeur) {
  if (typeof nomCase !== 'string' || !Object.prototype.hasOwnProperty.call(OUTIL_TEST_CASES, nomCase)) throw new Error('case refusée (reinit, deconnecter ou actif)');
  if (valeur !== true && valeur !== false) throw new Error('valeur refusée (vrai ou faux)');
  UTILISATEURS_ = null;
  const u = utilisateurs_(), l = u.parId[id];
  if (!l) throw new Error('compte d’essai absent : geste preparerComptes d’abord');
  u.sh.getRange(l.ligne, COL_U[OUTIL_TEST_CASES[nomCase]]).setValue(valeur);
  UTILISATEURS_ = null;
  return { id: id, case: nomCase, valeur: valeur };
}
// Session d'essai : un jeton normal du serveur TEST, pour un compte d'essai utilisable. Aucun mot de passe n'existe.
// Un jeton fabriqué ici est refusé par la production (autre clé de signature, autre marque d'environnement).
function outilTestSession_(id) {
  UTILISATEURS_ = null;
  const u = utilisateurs_();
  if (!compteUtilisable_(u, id)) throw new Error('compte d’essai absent ou inutilisable : geste preparerComptes d’abord');
  const ver = Number(lireCompte_(id).ver || 1);
  return { id: id, profil: profil_(u.parId[id]), jeton: fabriquerJeton_(id, ver) };
}
// Annule côté serveur toutes les sessions des comptes d'essai (comme la case « Déconnecter ses téléphones »)
function outilTestFermerSessions_() {
  const fermees = [];
  Object.keys(OUTIL_TEST_COMPTES).forEach(id => {
    const c = lireCompte_(id);
    c.ver = Number(c.ver || 1) + 1;
    ecrireCompte_(id, c);
    fermees.push(id);
  });
  return { comptes: fermees };
}

// Essai de faisabilité n° 1 (réussi le 12/11/2026) : un appel de l'appli peut poser PUIS retirer un déclencheur.
// Le déclencheur posé appelle une fonction qui ne fait rien, et il est retiré dans le même appel.
function outilTestRien_() {}
function outilTestEssaiDeclencheur_() {
  const NOM = 'outilTestRien_';
  const presents = () => ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === NOM);
  const etapes = [];
  let pose = false, retire = false;
  try {
    presents().forEach(t => ScriptApp.deleteTrigger(t));   // reste d'un essai interrompu
    ScriptApp.newTrigger(NOM).timeBased().everyHours(12).create();
    pose = presents().length === 1;
    etapes.push(pose ? 'déclencheur posé' : 'déclencheur NON posé (aucune erreur, mais il n’apparaît pas)');
  } catch (e) { etapes.push('pose refusée : ' + e.message); }
  try {
    presents().forEach(t => ScriptApp.deleteTrigger(t));
    retire = presents().length === 0;
    etapes.push(retire ? 'déclencheur retiré' : 'déclencheur NON retiré : le retirer à la main (éditeur → Déclencheurs)');
  } catch (e) { etapes.push('retrait refusé : ' + e.message); }
  return { ok: pose && retire, code: pose && retire ? 'OK' : 'ECHEC', message: etapes.join(' ; '), data: { pose: pose, retire: retire } };
}
