// FAUX clasp pour les tests de outils/envoyer-test.js (le vrai clasp n'est jamais appelé par les tests).
// Il imite les commandes utilisées : login, list-deployments, pull, push, update-deployment, logout.
// Son « monde » est un fichier JSON (variable FAUX_CLASP_MONDE) :
//   { jeton: chemin du fichier jeton, deploiements: [ids], enLigne: { 'Code.js': …, 'appsscript.json': … },
//     deploye: code servi par l'adresse, pannes: { push: true, … }, question: true (clasp demande pour le manifeste),
//     journal: [commandes reçues] }
'use strict';
const fs = require('fs');
const path = require('path');
const fichier = process.env.FAUX_CLASP_MONDE;
const monde = JSON.parse(fs.readFileSync(fichier, 'utf8'));
const args = process.argv.slice(2), cmd = args[0];
const finir = code => { fs.writeFileSync(fichier, JSON.stringify(monde)); process.exit(code || 0); };
monde.journal = (monde.journal || []).concat([args.join(' ')]);
const connecte = () => fs.existsSync(monde.jeton);

if (monde.pannes && monde.pannes[cmd]) { console.error('panne simulée de ' + cmd); finir(1); }
if (cmd === 'login') { fs.writeFileSync(monde.jeton, '{"jeton":"FAUX-JETON-DE-TEST"}'); console.log('Authorization successful.'); finir(); }
if (cmd === 'logout') { if (!monde.logoutSansEffet) fs.rmSync(monde.jeton, { force: true }); finir(); }
if (!connecte()) { console.error('Could not read API credentials. Are you logged in globally?'); finir(1); }
if (cmd === 'list-deployments') {
  console.log(monde.deploiements.length + ' Deployments.');
  monde.deploiements.forEach((d, i) => console.log('- ' + d + ' @' + (i ? i : 'HEAD')));
  finir();
}
if (cmd === 'pull') {
  Object.keys(monde.enLigne).forEach(f => fs.writeFileSync(path.join(process.cwd(), f), monde.enLigne[f]));
  console.log('Pulled ' + Object.keys(monde.enLigne).length + ' files.');
  finir();
}
if (cmd === 'push') {
  if (args.indexOf('--force') > -1 || args.indexOf('-f') > -1) { console.error('--force interdit'); finir(1); }
  if (monde.question) { console.log('? Manifest file has been updated. Do you want to push and overwrite? (y/N)'); console.log('Skipping push.'); finir(); }
  monde.enLigne = {};
  fs.readdirSync(process.cwd()).filter(f => /\.(js|gs|json|html)$/.test(f) && f !== '.clasp.json').forEach(f => { monde.enLigne[f] = fs.readFileSync(path.join(process.cwd(), f), 'utf8'); });
  console.log('Pushed ' + Object.keys(monde.enLigne).length + ' files.');
  finir();
}
if (cmd === 'update-deployment') {
  if (monde.deploiements.indexOf(args[1]) < 0) { console.error('deployment not found'); finir(1); }
  if (!monde.deploiementFige) monde.deploye = monde.enLigne['Code.js'];
  monde.description = args[args.indexOf('--description') + 1];
  console.log('Updated deployment ' + args[1]);
  finir();
}
console.error('commande inconnue du faux clasp : ' + cmd); finir(1);
