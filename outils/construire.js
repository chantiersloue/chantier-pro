// Prépare une livraison. À lancer après CHAQUE modification de commun/, modeles/ ou d'une page :
//   node outils/construire.js           → met tout à jour
//   node outils/construire.js --verifier → échoue si quelque chose n'est pas à jour (utilisé par les tests)
// Ce que fait la commande :
//  1. apps-script/Modeles.gs = copie des modèles uniques de modeles/*.js (le PDF du serveur et l'aperçu
//     de la page viennent ainsi du MÊME modèle) ;
//  2. numéro de version « ?v=… » ajouté à chaque fichier commun dans les pages (une page charge toujours
//     les scripts de SA version, même hors réseau) ;
//  3. sw.js : VERSION et liste des fichiers à garder dans le téléphone ;
//  4. A-COLLER-DANS-APPS-SCRIPT/Code.gs : TOUT le serveur en un seul fichier, à coller tel quel dans
//     l'éditeur Apps Script (un seul collage pour Franck, comme au lot 0).
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const racine = path.join(__dirname, '..');
const lire = f => fs.readFileSync(path.join(racine, f), 'utf8').replace(/\r\n/g, '\n');
const liste = (dossier, ext) => fs.readdirSync(path.join(racine, dossier)).filter(f => f.endsWith(ext)).sort().map(f => dossier + '/' + f);

// 1. Modeles.gs
function fabriquerModeles() {
  const morceaux = liste('modeles', '.js').map(f => '// ── ' + f + ' ──\n' + lire(f).trim() + '\n');
  return '// ═══════════════════════════════════════════════════════════════\n'
    + '// FICHIER GÉNÉRÉ AUTOMATIQUEMENT — NE PAS MODIFIER À LA MAIN\n'
    + '// Copie des modèles de PDF du dossier modeles/ (node outils/construire.js).\n'
    + '// Pour changer un PDF : modifier modeles/<document>.js, relancer la commande, recoller ce fichier.\n'
    + '// ═══════════════════════════════════════════════════════════════\n\n'
    + morceaux.join('\n');
}

// 2. Numéro de version : empreinte de tous les fichiers communs et modèles
const communs = liste('commun', '.js').concat(liste('commun', '.css'), liste('modeles', '.js'));
const empreinte = crypto.createHash('sha1').update(communs.map(f => f + '\n' + lire(f)).join('\n')).digest('hex').slice(0, 10);
const REF = /((?:src|href)=")((?:commun|modeles)\/[^"?]+)(?:\?v=[0-9a-f]+)?"/g;
function pageVersionnee(contenu) { return contenu.replace(REF, '$1$2?v=' + empreinte + '"'); }

// 3. sw.js
function swVersionne(contenu) {
  const entrees = communs.map(f => "'" + f + '?v=' + empreinte + "'").join(', ');
  return contenu
    .replace(/const VERSION = 'loue-[^']*';/, "const VERSION = 'loue-" + empreinte + "';")
    .replace(/\/\*COMMUNS\*\/.*$/m, '/*COMMUNS*/ ' + entrees + ',');
}

// 4. Code.gs unique : ordre fixe (réglages d'abord) ; Modeles.gs est pris dans sa version à jour
const ORDRE_GS = ['Config.gs', 'Securite.gs', 'Comptes.gs', 'Api.gs', 'Documents.gs', 'Dossiers.gs', 'Signalements.gs', 'Notes.gs', 'Admin.gs', 'Installation.gs', 'Modeles.gs'];
// La « porte de service » (outils d'essai) vit dans un dossier À PART : elle n'entre JAMAIS dans le Code.gs de
// production. Seul outils/envoyer-test.js assemble un serveur « avec porte », directement dans le dossier clasp
// de la copie TEST (hors du dépôt).
const PORTE = 'apps-script-test/OutilsTest.gs';
const MARQUE_PORTE = /function\s+outilTest_\s*\(/;
// Toute façon de DÉFINIR la porte ou ses fonctions (function, function*, const/let/var, affectation, globalThis…).
// La ligne d'accroche du serveur (« typeof outilTest_ === 'function' … return outilTest_(corps) ») n'en est pas une.
const DEFINITION_PORTE = /function\s*\*?\s*outilTest\w*\s*\(|(?:const|let|var)\s+(?:outilTest\w*|OUTIL_TEST_\w*)\b|outilTest\w*\s*=(?!=)|OUTIL_TEST_\w*\s*=(?!=)|\[\s*['"]outilTest/;
function contientPorte(code) { return DEFINITION_PORTE.test(code); }
// Rend { code, empreinte }. avecPorte : seulement pour la copie TEST.
function assembler(avecPorte) {
  const presents = fs.readdirSync(path.join(racine, 'apps-script')).filter(f => f.endsWith('.gs')).sort();
  const oublies = presents.filter(f => ORDRE_GS.indexOf(f) < 0);
  if (oublies.length) throw new Error('Fichier(s) Apps Script absent(s) de ORDRE_GS dans outils/construire.js : ' + oublies.join(', '));
  // Version du serveur : empreinte de ses propres sources (deux livraisons différentes n'ont jamais le même numéro)
  const sources = ORDRE_GS.filter(f => presents.indexOf(f) > -1).map(f => f === 'Modeles.gs' ? fabriquerModeles() : lire('apps-script/' + f));
  const porte = avecPorte ? lire(PORTE) : '';
  if (avecPorte && !MARQUE_PORTE.test(porte)) throw new Error(PORTE + ' ne contient pas la fonction outilTest_');
  if (sources.some(contientPorte)) throw new Error('La porte de service (outilTest_) ne doit JAMAIS être dans apps-script/ : elle partirait en production');
  const versionServeur = crypto.createHash('sha1').update(sources.concat(avecPorte ? [porte] : []).join('\n')).digest('hex').slice(0, 10);
  const trait = '// ═══════════════════════════════════════════════════════════════\n';
  const entete = trait
    + '// LOUÉ APP — SERVEUR COMPLET, À COLLER DANS APPS SCRIPT (fichier « Code.gs », tout remplacer)\n'
    + '// FICHIER GÉNÉRÉ AUTOMATIQUEMENT par « node outils/construire.js » — NE PAS MODIFIER À LA MAIN :\n'
    + '// les sources sont dans le dossier apps-script/ du dépôt. Version du serveur ' + versionServeur + ' (pages ' + empreinte + ')\n'
    + trait + '\n';
  // L'empreinte est écrite dans le serveur : il la renvoie (action ping), ce qui permet de vérifier que le
  // déploiement en ligne exécute bien CE fichier (le numéro de version, lui, ne change pas entre deux envois d'un lot)
  const code = entete + "const EMPREINTE_SERVEUR = '" + versionServeur + "';\n\n"
    + ORDRE_GS.filter(f => presents.indexOf(f) > -1).map(f => {
      const contenu = f === 'Modeles.gs' ? fabriquerModeles() : lire('apps-script/' + f);
      return '// ████ ' + f + ' ████\n' + contenu.trim() + '\n';
    }).join('\n')
    + (avecPorte ? '\n// ████ OutilsTest.gs — COPIE TEST SEULEMENT, JAMAIS EN PRODUCTION ████\n' + porte.trim() + '\n' : '');
  if (!avecPorte && contientPorte(code)) throw new Error('Le Code.gs de production contient la porte de service : refusé');
  return { code: code, empreinte: versionServeur };
}
function codeUnique() { return assembler(false).code; }

const cibles = [['apps-script/Modeles.gs', () => fabriquerModeles()], ['sw.js', () => swVersionne(lire('sw.js'))],
  ['A-COLLER-DANS-APPS-SCRIPT/Code.gs', () => codeUnique()]]
  .concat(fs.readdirSync(racine).filter(f => f.endsWith('.html')).map(f => [f, () => pageVersionnee(lire(f))]));

module.exports = { assembler, contientPorte, PORTE, MARQUE_PORTE };
if (require.main !== module) return;   // chargé par un autre outil (envoyer-test.js) : on ne fabrique rien

const verifier = process.argv.includes('--verifier');
const pasAJour = [];
cibles.forEach(([fichier, fabriquer]) => {
  const actuel = fs.existsSync(path.join(racine, fichier)) ? lire(fichier) : '';
  const attendu = fabriquer();
  if (actuel !== attendu) {
    if (verifier) pasAJour.push(fichier);
    else { fs.mkdirSync(path.dirname(path.join(racine, fichier)), { recursive: true }); fs.writeFileSync(path.join(racine, fichier), attendu); }
  }
});
// Garde-fous (relecture du lot 2) : aucun marqueur de conflit oublié après une fusion, et des scripts lisibles par le
// navigateur (un service worker illisible ne s'installe pas : les téléphones resteraient sur l'ancienne version)
function garderFous() {
  const erreurs = [];
  const suivis = require('child_process').execFileSync('git', ['ls-files'], { cwd: racine }).toString().split('\n')
    .filter(f => /\.(js|gs|html|css|json|md)$/.test(f) && fs.existsSync(path.join(racine, f)));
  suivis.forEach(f => {
    const t = lire(f);   // « ======= » seul peut souligner un titre Markdown : il ne compte qu'avec un « <<<<<<< »
    if (/^(<{7}|>{7}) /m.test(t) || (/^<{7}/m.test(t) && /^={7}$/m.test(t))) erreurs.push('marqueur de conflit dans ' + f);
  });
  const vm = require('vm');
  ['sw.js'].concat(liste('commun', '.js'), liste('modeles', '.js'), ['A-COLLER-DANS-APPS-SCRIPT/Code.gs']).forEach(f => {
    try { new vm.Script(lire(f), { filename: f }); } catch (e) { erreurs.push('syntaxe : ' + f + ' — ' + e.message); }
  });
  // Le fichier à coller en production ne contient jamais la porte de service
  if (contientPorte(lire('A-COLLER-DANS-APPS-SCRIPT/Code.gs'))) erreurs.push('A-COLLER-DANS-APPS-SCRIPT/Code.gs contient la porte de service (outilTest_) : il ne doit JAMAIS aller en production');
  return erreurs;
}
const fous = garderFous();
if (fous.length) { console.error('❌ ' + fous.join('\n❌ ')); process.exit(1); }
if (verifier) {
  if (pasAJour.length) { console.error('Pas à jour : ' + pasAJour.join(', ') + ' → lancer « node outils/construire.js »'); process.exit(1); }
  console.log('Livraison à jour (version ' + empreinte + ')');
} else {
  console.log('Livraison préparée : version ' + empreinte + ' (Modeles.gs, sw.js, les pages et A-COLLER-DANS-APPS-SCRIPT/Code.gs mis à jour)');
}
