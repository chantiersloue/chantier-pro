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
// Règles des gestes :
//   - ils n'écrivent que sur QUATRE COMPTES D'ESSAI FIXES (auto-poseur, auto-conducteur, auto-admin, auto-atelier), un chantier
//     d'essai (« CHANTIER TEST AUTO ») et les réglages d'essai de TEST (déclencheurs, transition) ;
//   - un geste qui n'a pas eu son effet répond ok:false (jamais « fait » à tort) ;
//   - ce qui est changé pour un essai peut être remis : la transition d'origine est mémorisée (retablirTransition),
//     au bout de 2 h, les déclencheurs posés se retirent et les sessions d'essai se ferment tout seuls ;
//   - les réponses ne contiennent ni mot de passe provisoire, ni nom de personne, ni nom de vrai chantier ;
//   - aucun geste ne touche à Drive : avant d'en ajouter un, refuser aussi si le dossier racine ne s'appelle pas « … TEST … ».
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
const OUTIL_TEST_CLE_MIN = 32;
const OUTIL_TEST_COMPTES = { 'auto-poseur': 'Poseur', 'auto-conducteur': 'Conducteur', 'auto-admin': 'Admin', 'auto-atelier': 'Atelier' };
const OUTIL_TEST_CASES = { reinit: 'reinit', deconnecter: 'deconnecter', actif: 'actif' };   // nom reçu → colonne de COL_U
const OUTIL_TEST_CHANTIER = 'CHANTIER TEST AUTO';
const OUTIL_TEST_RETRAIT_AUTO_H = 2;
function outilTestRefus_() { return { ok: false, code: 'REFUSE', message: 'Refusé' }; }   // un objet neuf à chaque fois

function outilTest_(corps) {
  let autorise = false;
  try {
    const ou = environnementReel_();
    if (ou.env !== 'TEST') return outilTestRefus_();
    const cle = propriete_('CLE_OUTILS_TEST');
    if (!cle || cle.length < OUTIL_TEST_CLE_MIN) return outilTestRefus_();
    if (typeof corps.cle !== 'string' || !egaux_(corps.cle, cle)) return outilTestRefus_();
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
          transitionARetablir: propriete_('OUTIL_TEST_FIN_AVANT') !== '',
          mailsPossibles: MailApp.getRemainingDailyQuota() });
      case 'lireEnvois':    return ok('Dernières lignes de l’onglet Envois (numéro, date, type, statut)', { lignes: outilTestDernieresLignes_(SHEET_ENVOIS, corps.n, [1, 2, 3, 5]) });
      case 'lireBilan':     return ok('Dernières lignes de l’onglet Installation', { lignes: outilTestDernieresLignes_(SHEET_INSTALLATION, corps.n, [1, 2, 3, 4, 5]) });
      case 'lireChantiers': { const noms = lignesChantiers_().map(r => String(r[0]).trim());
        return ok('Chantiers de la copie TEST', { nombre: noms.length, chantierEssai: OUTIL_TEST_CHANTIER, chantierEssaiPresent: noms.indexOf(OUTIL_TEST_CHANTIER) > -1 }); }
      case 'lireCompte':    return ok('Compte d’essai', outilTestLireCompte_(outilTestIdFixe_(corps.id)));
      // Lot 7 : numéro, reçu le, auteur (identifiant), type, urgence, photos, atelier, statut, mail — ni chantier, ni nom, ni texte saisi
      case 'lireSignalements': return ok('Dernières lignes de l’onglet Signalements', { lignes: outilTestDernieresLignes_(SHEET_SIGNALEMENTS, corps.n,
        [COL_S.id, COL_S.recu, COL_S.auteurId, COL_S.type, COL_S.urgence, COL_S.photos, COL_S.atelier, COL_S.statut, COL_S.mail])
        // l'identifiant d'un vrai compte de la copie TEST n'est pas rendu : seuls ceux des comptes d'essai le sont
        .map((l, i) => { if (i > 0 && l[2] && !Object.prototype.hasOwnProperty.call(OUTIL_TEST_COMPTES, l[2])) l[2] = '(compte réel)'; return l; }) });
      case 'destinatairesEssai': return ok('À qui partiraient les mails d’un essai (aucune adresse n’est donnée)', outilTestDestinataires_());

      // ── Lancer (fonctions existantes, sans paramètre) : ok seulement si l'effet est constaté ──
      case 'controlerLot2':        return ok(controlerInstallationLot2());
      // (le bilan seul : les informations « chantiers sans conducteur » de installerLot7Test restent dans l'éditeur)
      case 'installerLot7': { const r = installer_('Lot 7', 'TEST', etapesLot7_()); if (!r.ok) throw new Error('installation du lot 7 non terminée : ' + r.texte); return ok(r.texte); }
      case 'poserDeclencheurs':    return ok(outilTestPoserDeclencheurs_());
      case 'retirerDeclencheurs':  return ok(outilTestRetirerDeclencheurs_());
      case 'traiterComptes': { const r = traiterComptes(); if (r !== 'ok') throw new Error('traiterComptes n’a pas tourné : ' + r); return ok('traiterComptes : fait'); }
      case 'finirTransition': { const origine = outilTestEtatTransition_(), m = finirTransitionMaintenant();
        if (transitionOuverte_()) throw new Error('la transition est encore ouverte : ' + m);
        outilTestMemoriserTransition_(origine); return ok(m); }
      case 'prolongerTransition': { const origine = outilTestEtatTransition_(), avant = finTransition_(), m = prolongerTransition();
        if (!transitionOuverte_() || !finTransition_() || finTransition_() === avant) throw new Error('rien n’a été prolongé : ' + m);
        outilTestMemoriserTransition_(origine); return ok(m); }
      case 'retablirTransition':   return ok(outilTestRetablirTransition_());
      case 'essaiDeclencheur':     return outilTestEssaiDeclencheur_();

      // ── Écrire : seulement les comptes d'essai et le chantier d'essai ──
      case 'preparerComptes':  return ok('Comptes d’essai', outilTestSousVerrou_(outilTestPreparerComptes_));
      case 'preparerChantier': return ok('Chantier d’essai', outilTestSousVerrou_(outilTestPreparerChantier_));
      case 'cocher': { const id = outilTestIdFixe_(corps.id);
        return ok('Case modifiée', outilTestSousVerrou_(() => outilTestCocher_(id, corps.case, corps.valeur))); }
      case 'session': { const id = outilTestIdFixe_(corps.id);
        return ok('Session d’essai ouverte', outilTestSousVerrou_(() => outilTestSession_(id))); }
      case 'fermerSessions':   return ok('Sessions d’essai fermées, comptes d’essai désactivés', outilTestSousVerrou_(outilTestFermerSessions_));
      default:
        return outilTestRefus_();
    }
  } catch (e) {
    if (!autorise) return outilTestRefus_();   // jamais de détail technique pour qui n'a pas la clé
    return { ok: false, code: 'ERREUR_OUTIL', message: 'Outil d’essai : ' + (e && e.message ? e.message : e) };
  }
}

// Le même verrou que traiterComptes et le choix d'un mot de passe : jamais deux écritures en même temps sur un compte
function outilTestSousVerrou_(fn) {
  const verrou = LockService.getScriptLock();
  if (!verrou.tryLock(15000)) throw new Error('serveur occupé (verrou) : réessayer');
  try { return fn(); } finally { verrou.releaseLock(); }
}
// Un identifiant reçu n'est accepté que s'il est EXACTEMENT l'un des trois comptes d'essai
function outilTestIdFixe_(id) {
  if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(OUTIL_TEST_COMPTES, id)) throw new Error('compte refusé (seuls ' + Object.keys(OUTIL_TEST_COMPTES).join(', ') + ')');
  return id;
}
// La ligne d'un compte d'essai dans « Utilisateurs » : écrite EXACTEMENT comme attendu (identifiant, rôle), sans doublon.
// Une ligne tapée à la main qui lui ressemble (« AUTO-Admin », autre rôle) n'est jamais adoptée.
function outilTestLigne_(id, facultative) {
  UTILISATEURS_ = null;
  const u = utilisateurs_(), l = u.parId[id];
  if (!l) { if (facultative) return null; throw new Error('compte d’essai absent : geste preparerComptes d’abord'); }
  if (u.doublons[id] || l.brut !== id || l.role !== OUTIL_TEST_COMPTES[id]) throw new Error('la ligne « ' + id + ' » de l’onglet Utilisateurs n’est pas un compte d’essai conforme (identifiant, rôle ou doublon) : refusé');
  return { u: u, l: l };
}
// Avant un essai qui envoie des mails ou range un PDF : à qui cela irait-il ? Répond sans donner aucune adresse.
// Sur une copie du vrai Sheet, le chef d'atelier ou le conducteur pourraient être de vraies personnes.
function outilTestDestinataires_() {
  const admin = String(emailAdmin_() || '').toLowerCase();
  const chefs = chefsAtelier_().map(a => a.toLowerCase());
  const conducteur = String(emailConducteurChantier_(OUTIL_TEST_CHANTIER) || '').toLowerCase();
  let racine = '';
  try { racine = DriveApp.getFolderById(driveRootId_()).getName(); } catch (e) {}
  return {
    chefsAtelier: chefs.length,
    chefsAtelierSontFranck: chefs.length > 0 && chefs.every(a => a === admin),      // tous les chefs d'atelier ont l'adresse de l'admin
    conducteurChantierEssai: !conducteur ? 'aucun (le mail part à Franck)' : conducteur === admin ? 'Franck' : 'AUTRE PERSONNE',
    racineDriveNommeeTest: /TEST/i.test(racine),                                    // le PDF sera rangé dans le Drive de TEST
    chantierEssaiPresent: lignesChantiers_().some(r => String(r[0]).trim() === OUTIL_TEST_CHANTIER),
  };
}
// Les n dernières lignes d'un onglet (20 au plus), telles qu'affichées, titres en premier ; seulement les colonnes demandées
function outilTestDernieresLignes_(nomOnglet, n, colonnes) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nomOnglet);
  if (!sh || sh.getLastRow() < 1) return [];
  const combien = Math.max(1, Math.min(20, Math.floor(Number(n)) || 5));
  const derniere = sh.getLastRow(), largeur = Math.max.apply(null, colonnes);
  const garder = l => colonnes.map(c => l[c - 1]);
  const titres = sh.getRange(1, 1, 1, largeur).getDisplayValues().map(garder);
  if (derniere < 2) return titres;
  const debut = Math.max(2, derniere - combien + 1);
  return titres.concat(sh.getRange(debut, 1, derniere - debut + 1, largeur).getDisplayValues().map(garder));
}
function outilTestLireCompte_(id) {
  const x = outilTestLigne_(id, true);
  if (!x) return { id: id, existe: false };
  const l = x.l;
  return { id: id, existe: true, ligne: l.ligne, role: l.role, actif: l.actif, utilisable: compteUtilisable_(x.u, id),
    etat: String(l.valeurs[COL_U.etat - 1] || ''), reinit: l.valeurs[COL_U.reinit - 1] === true, deconnecter: l.valeurs[COL_U.deconnecter - 1] === true,
    aProvisoire: String(l.valeurs[COL_U.provisoire - 1] || '') !== '',   // le mot de passe provisoire lui-même n'est jamais renvoyé
    versionSession: Number(lireCompte_(id).ver || 1) };
}
// Première ligne libre d'un onglet à partir de la ligne 2 (ses 10 premières colonnes vides, ou des cases décochées :
// rien de ce que Franck aurait laissé sur une ligne sans identifiant n'est écrasé) ; en ajoute une s'il n'y en a pas
function outilTestLigneLibre_(sh) {
  const max = sh.getMaxRows();
  if (max >= 2) {
    const v = sh.getRange(2, 1, max - 1, Math.min(10, sh.getMaxColumns ? sh.getMaxColumns() : 10)).getValues();
    for (let i = 0; i < v.length; i++) if (v[i].every(c => c === false || String(c).trim() === '')) return i + 2;
  }
  sh.insertRowsAfter(max, 1);
  return max + 1;
}
// Crée les comptes d'essai qui manquent (une ligne chacun, dans la première ligne libre). Ne modifie jamais une ligne existante.
function outilTestPreparerComptes_() {
  const crees = [], presents = [];
  Object.keys(OUTIL_TEST_COMPTES).forEach(id => {
    if (outilTestLigne_(id, true)) { presents.push(id); return; }
    const u = utilisateurs_(), ligne = outilTestLigneLibre_(u.sh), role = OUTIL_TEST_COMPTES[id];
    const valeurs = []; for (let c = 1; c <= COL_U.etat; c++) valeurs.push('');
    valeurs[COL_U.id - 1] = id; valeurs[COL_U.nom - 1] = 'AUTO ' + role; valeurs[COL_U.role - 1] = role;
    valeurs[COL_U.actif - 1] = false; valeurs[COL_U.reinit - 1] = false; valeurs[COL_U.deconnecter - 1] = false; valeurs[COL_U.tous - 1] = false;
    valeurs[COL_U.etat - 1] = 'compte d’essai automatique (outillage) — activé seulement pendant un essai';
    u.sh.getRange(ligne, 1, 1, COL_U.etat).setValues([valeurs]);
    if (String(u.sh.getRange(ligne, COL_U.id).getValue()) !== id) throw new Error('la ligne du compte ' + id + ' n’a pas été écrite');
    crees.push(id);
  });
  UTILISATEURS_ = null;
  return { crees: crees, dejaPresents: presents };
}
// Crée la ligne « CHANTIER TEST AUTO » dans l'onglet Chantiers si elle manque. Ne modifie jamais une ligne existante.
function outilTestPreparerChantier_() {
  if (lignesChantiers_().some(r => String(r[0]).trim() === OUTIL_TEST_CHANTIER)) return { chantier: OUTIL_TEST_CHANTIER, cree: false };
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CHANTIERS);
  if (!sh) throw new Error('onglet Chantiers absent');
  const ligne = outilTestLigneLibre_(sh);
  sh.getRange(ligne, 1, 1, 3).setValues([[OUTIL_TEST_CHANTIER, 'ESSAIS AUTOMATIQUES (outillage)', STATUTS_CHANTIER[1]]]);
  return { chantier: OUTIL_TEST_CHANTIER, cree: true, ligne: ligne };
}
function outilTestCocher_(id, nomCase, valeur) {
  if (typeof nomCase !== 'string' || !Object.prototype.hasOwnProperty.call(OUTIL_TEST_CASES, nomCase)) throw new Error('case refusée (reinit, deconnecter ou actif)');
  if (valeur !== true && valeur !== false) throw new Error('valeur refusée (vrai ou faux)');
  const x = outilTestLigne_(id);
  // relu juste avant d'écrire : si l'onglet a été trié entre-temps, on ne touche pas la ligne d'un autre compte
  if (String(x.u.sh.getRange(x.l.ligne, COL_U.id).getValue()) !== id) throw new Error('l’onglet Utilisateurs a bougé pendant l’écriture : réessayer');
  x.u.sh.getRange(x.l.ligne, COL_U[OUTIL_TEST_CASES[nomCase]]).setValue(valeur);
  UTILISATEURS_ = null;
  return { id: id, case: nomCase, valeur: valeur };
}
// Session d'essai : le compte d'essai est activé, puis reçoit un jeton normal du serveur TEST. Aucun mot de passe n'existe.
// Un jeton fabriqué ici est refusé par la production (autre marque d'environnement, autre clé de signature).
// fermerSessions l'annule et désactive le compte.
function outilTestSession_(id) {
  let x = outilTestLigne_(id);
  if (!x.l.actif) { outilTestCocher_(id, 'actif', true); x = outilTestLigne_(id); }
  if (!compteUtilisable_(x.u, id)) throw new Error('compte d’essai inutilisable');
  const c = lireCompte_(id);
  if (c.inactifDepuis) { delete c.inactifDepuis; ecrireCompte_(id, c); }
  outilTestPoserFinEssai_();   // la session sera fermée toute seule dans 2 h si fermerSessions n'est pas appelé
  return { id: id, profil: profil_(x.l), jeton: fabriquerJeton_(id, Number(c.ver || 1)) };
}
// Annule côté serveur toutes les sessions des comptes d'essai (comme « Déconnecter ses téléphones ») et les désactive
function outilTestFermerSessions_() {
  const fermees = [];
  const erreurs = [];
  Object.keys(OUTIL_TEST_COMPTES).forEach(id => {
    try {
      const x = outilTestLigne_(id, true);
      if (!x) return;   // compte jamais créé : rien à fermer, rien à écrire
      const c = lireCompte_(id);
      c.ver = Number(c.ver || 1) + 1;
      ecrireCompte_(id, c);
      if (x.l.actif) outilTestCocher_(id, 'actif', false);
      fermees.push(id);
    } catch (e) { erreurs.push(id + ' : ' + e.message); }   // les autres comptes sont fermés quand même
  });
  if (erreurs.length) throw new Error('sessions fermées pour ' + (fermees.join(', ') || 'aucun compte') + ' ; échec pour ' + erreurs.join(' ; '));
  return { comptes: fermees };
}

// ── Transition : l'état d'origine de TEST est mémorisé au premier geste, et remis par retablirTransition ──
// (la date de fin ET le drapeau « alerte déjà envoyée » : sans lui, un mail d'alerte pourrait repartir après un essai)
function outilTestEtatTransition_() {
  const props = PropertiesService.getScriptProperties();
  return { fin: props.getProperty('FIN_TRANSITION') || '', alerte: props.getProperty('ALERTE_TRANSITION_FAITE') || '' };
}
// origine : l'état lu AVANT le geste ; n'est mémorisé qu'une fois, et seulement si le geste a réussi
function outilTestMemoriserTransition_(origine) {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('OUTIL_TEST_FIN_AVANT')) props.setProperty('OUTIL_TEST_FIN_AVANT', JSON.stringify(origine));
  props.setProperty('OUTIL_TEST_FIN_POSEE', props.getProperty('FIN_TRANSITION') || '');   // dernière valeur posée par les essais
}
function outilTestRetablirTransition_() {
  const props = PropertiesService.getScriptProperties(), brut = props.getProperty('OUTIL_TEST_FIN_AVANT');
  if (!brut) return 'Rien à rétablir : la transition de TEST n’a pas été modifiée par les essais.';
  let avant;
  try { avant = JSON.parse(brut); } catch (e) { avant = null; }
  if (!avant || typeof avant !== 'object') avant = { fin: brut === 'absente' || !/^\d+$/.test(brut) ? '' : brut, alerte: '' };   // ancien format
  // Franck a-t-il changé la transition lui-même depuis le dernier essai ? On le dit (et on remet quand même l'état d'origine)
  const changeeAlaMain = (props.getProperty('FIN_TRANSITION') || '') !== (props.getProperty('OUTIL_TEST_FIN_POSEE') || '');
  if (avant.fin) props.setProperty('FIN_TRANSITION', avant.fin); else props.deleteProperty('FIN_TRANSITION');
  if (avant.alerte) props.setProperty('ALERTE_TRANSITION_FAITE', avant.alerte); else props.deleteProperty('ALERTE_TRANSITION_FAITE');
  props.deleteProperty('OUTIL_TEST_FIN_AVANT'); props.deleteProperty('OUTIL_TEST_FIN_POSEE');
  const fin = finTransition_();
  return 'Transition de TEST remise comme avant les essais : ' + (fin ? 'fin le ' + texteDate_(fin) : 'pas commencée') + '.'
    + (changeeAlaMain ? ' ATTENTION : elle avait été modifiée à la main depuis le dernier essai ; ce changement est annulé.' : '');
}

// ── Déclencheurs : posés pour un essai, ils se retirent tout seuls au bout de 2 h (quota partagé avec la production) ──
function outilTestPoserDeclencheurs_() {
  const m = installerDeclencheurs();
  const presents = ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction());
  if (!DECLENCHEURS.every(d => presents.indexOf(d) > -1)) throw new Error('les déclencheurs ne sont pas tous posés : ' + m);
  outilTestPoserFinEssai_();
  return m + ' Ils seront retirés automatiquement dans ' + OUTIL_TEST_RETRAIT_AUTO_H + ' h.';
}
function outilTestRetirerDeclencheurs_() {
  const m = retirerDeclencheurs();
  ScriptApp.getProjectTriggers().filter(t => /^outilTest/.test(t.getHandlerFunction())).forEach(t => ScriptApp.deleteTrigger(t));
  const restes = ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction()).filter(d => DECLENCHEURS.indexOf(d) > -1 || /^outilTest/.test(d));
  if (restes.length) throw new Error('déclencheurs encore en place : ' + restes.join(', '));
  return m;
}
// Fin d'essai automatique : un déclencheur unique, 2 h après le dernier « poserDeclencheurs » ou « session », retire les
// déclencheurs et ferme les sessions d'essai, même si la séance de Claude s'est interrompue.
// (Nom SANS « _ » final : une fonction appelée par un déclencheur doit être visible de l'éditeur.)
function outilTestPoserFinEssai_() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'outilTestFinEssaiAuto').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('outilTestFinEssaiAuto').timeBased().after(OUTIL_TEST_RETRAIT_AUTO_H * 3600 * 1000).create();
}
function outilTestFinEssaiAuto() {
  try { outilTestSousVerrou_(outilTestFermerSessions_); } catch (e) { console.error('outilTestFinEssaiAuto (sessions) :', e.message); }
  try { outilTestRetirerDeclencheurs_(); } catch (e) { console.error('outilTestFinEssaiAuto (déclencheurs) :', e.message); }
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
