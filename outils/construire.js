// Fabrique apps-script/Modeles.gs à partir des modèles uniques de modeles/*.js.
//   node outils/construire.js           → écrit apps-script/Modeles.gs
//   node outils/construire.js --verifier → échoue si Modeles.gs n'est pas à jour (utilisé par les tests)
// Ainsi, le PDF envoyé par le serveur et l'aperçu de la page viennent du MÊME modèle.
'use strict';
const fs = require('fs');
const path = require('path');

const racine = path.join(__dirname, '..');
const dossier = path.join(racine, 'modeles');
const cible = path.join(racine, 'apps-script', 'Modeles.gs');

function fabriquer() {
  const fichiers = fs.readdirSync(dossier).filter(f => f.endsWith('.js')).sort();
  const morceaux = fichiers.map(f => '// ── modeles/' + f + ' ──\n' + fs.readFileSync(path.join(dossier, f), 'utf8').replace(/\r\n/g, '\n').trim() + '\n');
  return '// ═══════════════════════════════════════════════════════════════\n'
    + '// FICHIER GÉNÉRÉ AUTOMATIQUEMENT — NE PAS MODIFIER À LA MAIN\n'
    + '// Copie des modèles de PDF du dossier modeles/ (node outils/construire.js).\n'
    + '// Pour changer un PDF : modifier modeles/<document>.js, relancer la commande, recoller ce fichier.\n'
    + '// ═══════════════════════════════════════════════════════════════\n\n'
    + morceaux.join('\n');
}

const contenu = fabriquer();
if (process.argv.includes('--verifier')) {
  const actuel = fs.existsSync(cible) ? fs.readFileSync(cible, 'utf8').replace(/\r\n/g, '\n') : '';
  if (actuel !== contenu) { console.error('apps-script/Modeles.gs n\'est pas à jour : lancer « node outils/construire.js »'); process.exit(1); }
  console.log('Modeles.gs à jour');
} else {
  fs.writeFileSync(cible, contenu);
  console.log('apps-script/Modeles.gs fabriqué (' + contenu.split('\n').length + ' lignes)');
}
