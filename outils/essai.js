// Fabrique la COPIE D'ESSAI d'un lot : node outils/essai.js
// Le site complet est copié dans le dossier essai/ ; une fois sur GitHub, il s'ouvre à l'adresse
//   https://chantiersloue.github.io/chantier-pro/essai/
// Cette copie est TOUJOURS en mode TEST (bandeau rouge, copie TEST du Sheet et du Drive) : impossible
// d'y envoyer quoi que ce soit en production. Le vrai site (à la racine) n'est pas modifié.
// Le dossier essai/ est retiré quand le lot passe en production.
'use strict';
const fs = require('fs');
const path = require('path');

const racine = path.join(__dirname, '..');
const cible = path.join(racine, 'essai');
const A_COPIER = fs.readdirSync(racine).filter(f => /\.(html|json|png)$/.test(f) || f === 'sw.js').concat(['commun', 'modeles']);

fs.rmSync(cible, { recursive: true, force: true });
fs.mkdirSync(cible);
A_COPIER.forEach(f => fs.cpSync(path.join(racine, f), path.join(cible, f), { recursive: true }));

// Mode TEST forcé : l'adresse de production est retirée de la copie
const config = path.join(cible, 'commun', 'config.js');
let c = fs.readFileSync(config, 'utf8');
const avant = c;
c = c.replace(/var URL_PRODUCTION = '[^']*';/, "var URL_PRODUCTION = ''; // copie d'essai : jamais la production")
     .replace(/var enTest = [^;]*;/, "var enTest = true; // copie d'essai : toujours en mode TEST")
     // ?env=… ignoré : le mode est mémorisé pour TOUTE l'adresse chantiersloue.github.io, vrai site compris
     .replace(/ {2}if \(demande === 'test'\) ecrire\('loue_env', 'test'\);\n {2}if \(demande === 'prod'\) ecrire\('loue_env', null\);\n/,
              "  // copie d'essai : ?env=test / ?env=prod sans effet (ne doit jamais changer le mode du vrai site)\n")
     .replace(/'MODE TEST — copie TEST — pour revenir : ajouter \?env=prod à l’adresse'/,
              "'COPIE D’ESSAI — données de la copie TEST uniquement — la vraie appli : chantiersloue.github.io/chantier-pro'");
if (c === avant || c.indexOf('var enTest = true;') < 0 || c.indexOf('COPIE D’ESSAI') < 0 || c.indexOf("ecrire('loue_env'") > -1) throw new Error('commun/config.js a changé : adapter outils/essai.js');
fs.writeFileSync(config, c);

// Installée sur l'écran d'accueil, la copie d'essai s'ouvre sur elle-même (et pas sur le vrai site)
const manifeste = path.join(cible, 'manifest.json');
const m = JSON.parse(fs.readFileSync(manifeste, 'utf8'));
m.name = 'Loué App ESSAI'; m.short_name = 'Loué ESSAI'; m.start_url = m.id = m.scope = '/chantier-pro/essai/';
fs.writeFileSync(manifeste, JSON.stringify(m, null, 2) + '\n');

console.log('Copie d’essai fabriquée dans essai/ (' + A_COPIER.length + ' éléments), toujours en mode TEST.');
