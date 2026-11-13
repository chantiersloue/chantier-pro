// FAUX clasp pour les tests du mode « second compte » de outils/envoyer-test.js (le vrai clasp n'est jamais appelé).
// Il ajoute au faux clasp d'origine (tests/faux-clasp.js, inchangé) les deux commandes de contrôle du compte :
//   show-authorized-user --json  → { loggedIn, email, clientId, clientType }, comme clasp 3.4.1
//   list-scripts --json          → [ { id, name }, … ], comme clasp 3.4.1
// Toutes les autres commandes (login, list-deployments, pull, push, update-deployment, logout) vont au faux clasp d'origine.
// Réglages en plus dans le « monde » (fichier JSON, variable FAUX_CLASP_MONDE) :
//   compte : l'adresse du compte auquel appartient le jeton (celui que « choisit » la personne à la connexion) ;
//   utilisateur : 'sansEmail' | 'inconnu' | 'illisible' | 'panne' (réponses anormales de show-authorized-user) ;
//   projets : [ { id, name } ] vus par le compte ; listeIllisible : true (réponse anormale de list-scripts).
'use strict';
const fs = require('fs');
const fichier = process.env.FAUX_CLASP_MONDE;
const args = process.argv.slice(2), cmd = args[0];
if (cmd !== 'show-authorized-user' && cmd !== 'list-scripts') {
  require('./faux-clasp.js');
} else {
  const monde = JSON.parse(fs.readFileSync(fichier, 'utf8'));
  monde.journal = (monde.journal || []).concat([args.join(' ')]);
  const finir = code => { fs.writeFileSync(fichier, JSON.stringify(monde)); process.exit(code || 0); };
  const json = args.indexOf('--json') > -1;
  const fichierJeton = process.env.clasp_config_auth || monde.jeton;   // comme le vrai : le fichier donné, sinon l'endroit habituel
  let connecte = false;
  try { connecte = fs.statSync(fichierJeton).size > 0; } catch (e) {}
  if (cmd === 'show-authorized-user') {
    if (monde.utilisateur === 'panne') { console.error('panne simulée de show-authorized-user'); finir(1); }
    if (monde.utilisateur === 'illisible') { console.log('<html>Erreur 502</html>'); finir(); }
    if (!json) { console.log(connecte ? 'You are logged in as ' + monde.compte + '.' : 'Not logged in.'); finir(); }
    const rep = { loggedIn: connecte, clientId: 'faux-client.apps.googleusercontent.com', clientType: 'google-provided' };
    if (connecte && monde.utilisateur === 'inconnu') rep.email = 'unknown user';
    else if (connecte && monde.utilisateur !== 'sansEmail') rep.email = monde.compte;
    console.log(JSON.stringify(rep, null, 2));
    finir();
  }
  // list-scripts
  if (!connecte) { console.error('Could not read API credentials. Are you logged in globally?'); finir(1); }
  if (monde.listeIllisible) { console.log('Finding your scripts...'); finir(); }
  const projets = monde.projets || [];
  if (json) { console.log(JSON.stringify(projets, null, 2)); finir(); }
  if (!projets.length) { console.log('No script files found.'); finir(); }
  console.log('Found ' + projets.length + ' scripts.');
  projets.forEach(p => console.log(p.name + ' - https://script.google.com/d/' + p.id + '/edit'));
  finir();
}
