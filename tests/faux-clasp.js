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
// Comme le vrai clasp 3 : le jeton va dans le fichier donné par la variable clasp_config_auth, sinon à l'endroit habituel
const fichierJeton = process.env.clasp_config_auth || monde.jeton;
const connecte = () => fs.existsSync(fichierJeton);
const attendre = ms => { const fin = Date.now() + ms; while (Date.now() < fin) {} };

if (monde.pannes && monde.pannes[cmd]) { console.error('panne simulée de ' + cmd); finir(1); }
if (cmd === 'login') {
  if (monde.loginLent) attendre(monde.loginLent);   // l'utilisateur met du temps à cliquer « Autoriser »
  fs.writeFileSync(monde.ignoreAuth ? monde.jeton : fichierJeton, '{"jeton":"FAUX-JETON-DE-TEST"}');
  console.log('You are logged in as test@loue.test.'); finir();
}
if (cmd === 'logout') { if (!monde.logoutSansEffet) fs.rmSync(monde.ignoreAuth ? monde.jeton : fichierJeton, { force: true }); finir(); }
if (monde.ignoreAuth ? !fs.existsSync(monde.jeton) : false) { console.error('Could not read API credentials.'); finir(1); }
if (!monde.ignoreAuth && !connecte()) { console.error('Could not read API credentials. Are you logged in globally?'); finir(1); }
if (monde.lent && monde.lent[cmd]) attendre(monde.lent[cmd]);
if (cmd === 'list-deployments') {
  // format réel : « Found N deployments. » puis « - <id> @<version> - <description> »
  console.log('Found ' + monde.deploiements.length + ' deployments.');
  monde.deploiements.forEach((d, i) => console.log('- ' + d + ' @' + (i ? i : 'HEAD') + ' ' + (monde.descriptions && monde.descriptions[i] ? '- ' + monde.descriptions[i] : '')));
  finir();
}
if (cmd === 'pull') {
  Object.keys(monde.enLigne).forEach(f => fs.writeFileSync(path.join(process.cwd(), f), monde.enLigne[f]));
  if (process.env.FAUX_CLASP_CHANGE_PROJET) fs.writeFileSync(path.join(process.cwd(), '.clasp.json'), JSON.stringify({ scriptId: 'UN-AUTRE-PROJET' }));
  console.log('Pulled ' + Object.keys(monde.enLigne).length + ' files.');
  finir();
}
if (cmd === 'push') {
  if (args.indexOf('--force') > -1 || args.indexOf('-f') > -1) { console.error('--force interdit'); finir(1); }
  const local = {};
  fs.readdirSync(process.cwd()).filter(f => /\.(js|gs|json|html)$/.test(f) && f !== '.clasp.json').forEach(f => { local[f] = fs.readFileSync(path.join(process.cwd(), f), 'utf8'); });
  // Comme le vrai, lancé sans clavier : si le manifeste a changé, aucune question, « Skipping push. », code 0
  if (monde.question || local['appsscript.json'] !== monde.enLigne['appsscript.json']) { console.log('Skipping push.'); finir(); }
  if (JSON.stringify(local) === JSON.stringify(monde.enLigne)) { console.log('Script is already up to date.'); finir(); }
  monde.enLigne = local;
  console.log('Pushed ' + Object.keys(monde.enLigne).length + ' files at 10:00:00.');
  finir();
}
if (cmd === 'update-deployment') {
  if (monde.deploiements.indexOf(args[1]) < 0) { console.error('deployment not found'); finir(1); }
  if (!monde.deploiementFige) monde.deploye = monde.enLigne['Code.js'];
  monde.description = args[args.indexOf('--description') + 1];
  console.log('Redeployed ' + args[1] + ' @9');
  finir();
}
console.error('commande inconnue du faux clasp : ' + cmd); finir(1);
