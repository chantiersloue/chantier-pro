// Fabrique la COPIE D'ESSAI d'un lot : node outils/essai.js
// (en pratique, on lance « node outils/publier-essai.js », qui fabrique PUIS publie)
//
// La copie d'essai ne vit plus dans ce dépôt. Elle est fabriquée dans un dossier VOISIN, hors du dépôt :
//   ..\chantier-pro-essai\      (une copie de travail du dépôt d'essai de l'organisation GitHub)
// et publiée à l'adresse  https://<organisation>.github.io/<dépôt>/   (réglée dans outils/essai-cible.json).
// Pour le téléphone, c'est un AUTRE site que la vraie appli : sa mémoire (brouillons, file d'envoi, session)
// est séparée de celle du vrai site.
// Cette copie est TOUJOURS en mode TEST (bandeau rouge, copie TEST du Sheet et du Drive) : impossible
// d'y envoyer quoi que ce soit en production. Le vrai site n'est pas modifié.
//
// SÉCURITÉ : la commande vide le dossier voisin avant de le remplir. Elle REFUSE donc de toucher à un dossier
// qui n'est pas exactement une copie de travail du dépôt d'essai (voir controlerDossier), et ne touche jamais
// à son dossier .git.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { depotDepuisAdresse } = require('./lien-fusion.js');

const RACINE = path.join(__dirname, '..');
const NOM_DOSSIER = 'chantier-pro-essai';
const MARQUE = 'essai-version.txt';   // écrit par publier-essai.js : permet de vérifier que la publication est arrivée

function lireCible(fichier) {
  fichier = fichier || path.join(__dirname, 'essai-cible.json');
  if (!fs.existsSync(fichier)) throw new Error('outils/essai-cible.json absent : l’organisation GitHub de la copie d’essai n’est pas encore réglée');
  const c = JSON.parse(fs.readFileSync(fichier, 'utf8'));
  const ok = x => typeof x === 'string' && /^[A-Za-z0-9][A-Za-z0-9-]*$/.test(x);
  const okDepot = x => typeof x === 'string' && /^[A-Za-z0-9._-]+$/.test(x) && !/^\.+$/.test(x);
  if (!ok(c.organisation) || !okDepot(c.depot)) throw new Error('outils/essai-cible.json : « organisation » ou « depot » manquant ou mal écrit');
  return { organisation: c.organisation, depot: c.depot,
           nom: c.organisation + '/' + c.depot,
           adresseGit: 'https://github.com/' + c.organisation + '/' + c.depot + '.git',
           adresseSite: 'https://' + c.organisation.toLowerCase() + '.github.io/' + c.depot + '/' };
}
function dossierVoisin(racine) { return path.resolve(racine || RACINE, '..', NOM_DOSSIER); }
// Chemin réel et complet (Windows donne parfois un nom court du type PAVAGE~1 : on compare les vrais noms)
function reel(p) { const r = path.resolve(p); try { return fs.realpathSync.native(r); } catch (e) { return r; } }
const memeChemin = (a, b) => reel(a).toLowerCase() === reel(b).toLowerCase();
const contient = (parent, enfant) => (reel(enfant) + path.sep).toLowerCase().indexOf((reel(parent) + path.sep).toLowerCase()) === 0;
function git(dossier) {
  return execFileSync('git', ['-C', dossier].concat(Array.prototype.slice.call(arguments, 1)),
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

// Refuse tout dossier qui n'est pas, sans aucun doute, la copie de travail du dépôt d'essai
function controlerDossier(dossier, cible, racine) {
  racine = racine || RACINE;
  const d = path.resolve(dossier), r = path.resolve(racine);
  if (path.basename(d) !== NOM_DOSSIER) throw new Error('Dossier refusé (il doit s’appeler ' + NOM_DOSSIER + ') : ' + d);
  if (contient(r, d) || contient(d, r)) throw new Error('Dossier refusé (il doit être HORS du dépôt de production) : ' + d);
  if (!fs.existsSync(d) || !fs.statSync(d).isDirectory()) throw new Error('Dossier absent : ' + d + ' — lancer « node outils/publier-essai.js --preparer »');
  if (!fs.existsSync(path.join(d, '.git'))) throw new Error('Dossier refusé (ce n’est pas une copie de travail Git) : ' + d);
  let sommet, origine;
  try { sommet = git(d, 'rev-parse', '--show-toplevel'); origine = git(d, 'remote', 'get-url', 'origin'); }
  catch (e) { throw new Error('Dossier refusé (Git ne le reconnaît pas ou il n’a pas d’« origin ») : ' + d); }
  if (!memeChemin(sommet, d)) throw new Error('Dossier refusé (il fait partie d’un autre dépôt : ' + sommet + ')');
  let depot;
  try { depot = depotDepuisAdresse(origine); } catch (e) { throw new Error('Dossier refusé (« origin » n’est pas un dépôt GitHub) : ' + origine); }
  if (depot.toLowerCase() !== cible.nom.toLowerCase()) throw new Error('Dossier refusé : il est relié à « ' + depot + ' » et non à « ' + cible.nom + ' »');
  return d;
}

// Vide le dossier SAUF .git (jamais touché), puis y fabrique la copie d'essai
function fabriquer(o) {
  o = o || {};
  const racine = o.racine || RACINE, cible = o.cible || lireCible();
  const dossier = controlerDossier(o.dossier || dossierVoisin(racine), cible, racine);

  fs.readdirSync(dossier).filter(f => f !== '.git').forEach(f => fs.rmSync(path.join(dossier, f), { recursive: true, force: true }));
  const aCopier = fs.readdirSync(racine).filter(f => /\.(html|json|png)$/.test(f) || f === 'sw.js').concat(['commun', 'modeles']);
  aCopier.forEach(f => fs.cpSync(path.join(racine, f), path.join(dossier, f), { recursive: true }));

  // Mode TEST forcé : l'adresse de production est retirée de la copie
  const config = path.join(dossier, 'commun', 'config.js');
  let c = fs.readFileSync(config, 'utf8').replace(/\r\n/g, '\n');   // fins de ligne Windows (CRLF) : comme construire.js
  const avant = c;
  c = c.replace(/var URL_PRODUCTION = '[^']*';/, "var URL_PRODUCTION = ''; // copie d'essai : jamais la production")
       .replace(/var enTest = [^;]*;/, "var enTest = true; // copie d'essai : toujours en mode TEST")
       .replace(/ {2}if \(demande === 'test'\) ecrire\('loue_env', 'test'\);\n {2}if \(demande === 'prod'\) ecrire\('loue_env', null\);\n/,
                "  // copie d'essai : ?env=test / ?env=prod sans effet (toujours en mode TEST)\n")
       .replace(/'MODE TEST — copie TEST — pour revenir : ajouter \?env=prod à l’adresse'/,
                "'COPIE D’ESSAI — données de la copie TEST uniquement — la vraie appli : chantiersloue.github.io/chantier-pro'");
  if (c === avant || c.indexOf('var enTest = true;') < 0 || c.indexOf('COPIE D’ESSAI') < 0 || c.indexOf("ecrire('loue_env'") > -1
      || c.indexOf("var URL_PRODUCTION = '';") < 0 || /AKfycb[\w-]+/.test(c.split('var URL_TEST')[0])) {
    throw new Error('commun/config.js a changé : adapter outils/essai.js (copie d’essai NON fabriquée)');
  }
  fs.writeFileSync(config, c);

  // Installée sur l'écran d'accueil, la copie d'essai porte son propre nom et s'ouvre sur elle-même
  const manifeste = path.join(dossier, 'manifest.json');
  const m = JSON.parse(fs.readFileSync(manifeste, 'utf8'));
  m.name = 'Loué App ESSAI'; m.short_name = 'Loué ESSAI'; m.start_url = m.id = m.scope = '/' + cible.depot + '/';
  fs.writeFileSync(manifeste, JSON.stringify(m, null, 2) + '\n');

  // La copie d'essai est publique en permanence : on demande aux moteurs de recherche de ne pas la référencer
  fs.readdirSync(dossier).filter(f => f.endsWith('.html')).forEach(f => {
    const p = path.join(dossier, f), h = fs.readFileSync(p, 'utf8');
    const h2 = h.replace(/<head>/i, '<head>\n<meta name="robots" content="noindex, nofollow">');
    if (h2 === h) throw new Error(f + ' : balise <head> introuvable (copie d’essai NON fabriquée)');
    fs.writeFileSync(p, h2);
  });
  fs.writeFileSync(path.join(dossier, '.nojekyll'), '');
  fs.writeFileSync(path.join(dossier, 'README.md'), [
    '# Loué App — COPIE D’ESSAI', '',
    'Ce dépôt ne contient que la **copie d’essai** de l’application de chantier de Loué Menuiserie.',
    'Elle est fabriquée automatiquement (`node outils/publier-essai.js`) à partir du dépôt `chantiersloue/chantier-pro` :',
    '**ne rien modifier ici à la main**, tout serait remplacé à la publication suivante.', '',
    '- Toujours en **mode TEST** : elle ne peut écrire que dans la copie TEST des données, jamais en production.',
    '- Adresse : ' + cible.adresseSite,
    '- La vraie application : https://chantiersloue.github.io/chantier-pro/', '',
  ].join('\n'));
  return { dossier: dossier, cible: cible, elements: aCopier.length };
}

module.exports = { lireCible, dossierVoisin, controlerDossier, fabriquer, NOM_DOSSIER, MARQUE };
if (require.main === module) {
  try {
    const r = fabriquer();
    console.log('Copie d’essai fabriquée dans ' + r.dossier + ' (' + r.elements + ' éléments), toujours en mode TEST.');
    console.log('Elle n’est PAS encore publiée : « node outils/publier-essai.js » fabrique et publie.');
  } catch (e) { console.error('❌ ' + e.message); process.exit(1); }
}
