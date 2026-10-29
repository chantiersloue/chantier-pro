// Prépare une livraison. À lancer après CHAQUE modification de commun/, modeles/ ou d'une page :
//   node outils/construire.js           → met tout à jour
//   node outils/construire.js --verifier → échoue si quelque chose n'est pas à jour (utilisé par les tests)
// Ce que fait la commande :
//  1. apps-script/Modeles.gs = copie des modèles uniques de modeles/*.js (le PDF du serveur et l'aperçu
//     de la page viennent ainsi du MÊME modèle) ;
//  2. numéro de version « ?v=… » ajouté à chaque fichier commun dans les pages (une page charge toujours
//     les scripts de SA version, même hors réseau) ;
//  3. sw.js : VERSION et liste des fichiers à garder dans le téléphone.
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

const cibles = [['apps-script/Modeles.gs', () => fabriquerModeles()], ['sw.js', () => swVersionne(lire('sw.js'))]]
  .concat(fs.readdirSync(racine).filter(f => f.endsWith('.html')).map(f => [f, () => pageVersionnee(lire(f))]));

const verifier = process.argv.includes('--verifier');
const pasAJour = [];
cibles.forEach(([fichier, fabriquer]) => {
  const actuel = fs.existsSync(path.join(racine, fichier)) ? lire(fichier) : '';
  const attendu = fabriquer();
  if (actuel !== attendu) {
    if (verifier) pasAJour.push(fichier);
    else fs.writeFileSync(path.join(racine, fichier), attendu);
  }
});
if (verifier) {
  if (pasAJour.length) { console.error('Pas à jour : ' + pasAJour.join(', ') + ' → lancer « node outils/construire.js »'); process.exit(1); }
  console.log('Livraison à jour (version ' + empreinte + ')');
} else {
  console.log('Livraison préparée : version ' + empreinte + ' (Modeles.gs, sw.js et les pages mis à jour)');
}
