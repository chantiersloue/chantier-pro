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
    try { ecrireBilanInstallation_(lot, ou.env, mode, lignes.slice(1)); }
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
  if (lignes.length) sh.getRange(sh.getLastRow() + 1, 1, lignes.length, 5).setValues(lignes.map(l => [date, lot, env, mode, l]));
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
