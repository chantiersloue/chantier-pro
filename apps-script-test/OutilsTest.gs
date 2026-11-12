// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// OUTILS D'ESSAI — « PORTE DE SERVICE » DE LA COPIE TEST (outillage, décisions O-3 et O-4)
//
// CE FICHIER N'EXISTE QUE DANS LE SERVEUR ENVOYÉ SUR LA COPIE TEST. Il n'est pas dans le dossier apps-script/,
// n'entre jamais dans A-COLLER-DANS-APPS-SCRIPT/Code.gs, et outils/construire.js refuse de fabriquer un
// serveur de production qui le contiendrait.
//
// Il permet à Claude, depuis le PC, de lancer sur TEST quelques gestes d'une LISTE FERMÉE (écrits ci-dessous
// en toutes lettres), au lieu de demander à Franck de cliquer dans l'éditeur. Conditions, toutes obligatoires :
//   1. propriété ENVIRONNEMENT = TEST et Sheet nommé « … TEST … » (environnementReel_) ;
//   2. propriété CLE_OUTILS_TEST d'au moins 32 caractères, et la même clé dans le corps de l'appel ;
//   3. un geste de la liste.
// Tout autre appel reçoit la même réponse « Refusé », sans détail (même si une erreur survient avant le contrôle de la clé).
// À FAIRE avant d'ajouter un geste qui touche à Drive : refuser aussi si le dossier racine ne s'appelle pas « … TEST … ».
//
// VERSION MINIMALE (essai de faisabilité n° 1) : deux gestes seulement, « etat » et « essaiDeclencheur ».
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
const OUTIL_TEST_CLE_MIN = 32;
const OUTIL_TEST_REFUS = { ok: false, code: 'REFUSE', message: 'Refusé' };

function outilTest_(corps) {
  let autorise = false;
  try {
    const ou = environnementReel_();
    if (ou.env !== 'TEST') return OUTIL_TEST_REFUS;
    const cle = propriete_('CLE_OUTILS_TEST');
    if (!cle || cle.length < OUTIL_TEST_CLE_MIN) return OUTIL_TEST_REFUS;
    if (typeof corps.cle !== 'string' || !egaux_(corps.cle, cle)) return OUTIL_TEST_REFUS;
    autorise = true;

    switch (corps.geste) {
      case 'etat':
        return { ok: true, code: 'OK', message: 'Outils d’essai : prêts', data: {
          environnement: ou.env, sheet: ou.sheet, version: VERSION_API,
          empreinte: typeof EMPREINTE_SERVEUR === 'string' ? EMPREINTE_SERVEUR : '',
          declencheurs: ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction()).sort(),
          mailsPossibles: MailApp.getRemainingDailyQuota() } };
      case 'essaiDeclencheur':
        return outilTestEssaiDeclencheur_();
      default:
        return OUTIL_TEST_REFUS;
    }
  } catch (e) {
    if (!autorise) return OUTIL_TEST_REFUS;   // jamais de détail technique pour qui n'a pas la clé
    return { ok: false, code: 'ERREUR_OUTIL', message: 'Outil d’essai : ' + (e && e.message ? e.message : e) };
  }
}

// Essai de faisabilité n° 1 : un appel de l'appli peut-il poser PUIS retirer un déclencheur ?
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
