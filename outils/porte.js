// Outils de la « porte de service » de la copie TEST (utilisés par Claude, depuis le PC) :
//   node outils/porte.js --creer-cle       → fabrique la clé et l'écrit dans _prive/cle-outils-test.txt, SANS l'afficher
//   node outils/porte.js etat              → demande son état au serveur TEST (version, empreinte, déclencheurs…)
//   node outils/porte.js essaiDeclencheur  → essai de faisabilité : poser puis retirer un déclencheur
// La clé n'est jamais affichée, ni écrite ailleurs que dans _prive/ (dossier exclu de GitHub) : Franck la copie
// de ce fichier vers la propriété CLE_OUTILS_TEST du projet Apps Script de la copie TEST (jamais en production).
// Ces appels ne vont QUE vers l'adresse de la copie TEST (URL_TEST de commun/config.js).
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { deploiementTest } = require('./envoyer-test.js');

const RACINE = path.join(__dirname, '..');
const fichierCle = prive => path.join(prive || path.join(RACINE, '_prive'), 'cle-outils-test.txt');

function creerCle(prive) {
  const f = fichierCle(prive);
  if (fs.existsSync(f) && fs.readFileSync(f, 'utf8').trim().length >= 32) return { cree: false, fichier: f };
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, crypto.randomBytes(36).toString('base64url') + '\n');   // 48 caractères, lettres, chiffres, - et _
  return { cree: true, fichier: f };
}
function lireCle(prive) {
  const f = fichierCle(prive);
  if (!fs.existsSync(f)) throw new Error('Clé absente : lancer « node outils/porte.js --creer-cle »');
  const cle = fs.readFileSync(f, 'utf8').trim();
  if (cle.length < 32) throw new Error('Clé trop courte dans ' + f);
  return cle;
}
// Appelle la porte. La réponse ne contient jamais la clé ; en cas d'erreur réseau, le message non plus.
async function appeler(geste, donnees, o) {
  o = o || {};
  const url = o.url || deploiementTest(o.racine || RACINE).url;
  const envoyer = o.envoyer || (async (u, corps) => {
    const r = await fetch(u, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(corps) });
    return r.json();
  });
  return envoyer(url, Object.assign({}, donnees || {}, { action: 'outilTest', v: 5, geste: geste, cle: lireCle(o.prive) }));
}

module.exports = { creerCle, lireCle, appeler, fichierCle };
if (require.main === module) {
  (async () => {
    const a = process.argv.slice(2);
    if (a[0] === '--creer-cle') {
      const r = creerCle();
      console.log((r.cree ? 'Clé fabriquée et écrite' : 'La clé existe déjà') + ' dans _prive/cle-outils-test.txt (elle n’est pas affichée).');
      return;
    }
    if (['etat', 'essaiDeclencheur'].indexOf(a[0]) < 0) throw new Error('Usage : node outils/porte.js --creer-cle | etat | essaiDeclencheur');
    const rep = await appeler(a[0]);
    console.log(JSON.stringify(rep, null, 2));
    if (!rep || !rep.ok) process.exitCode = 1;
  })().catch(e => { console.error('❌ ' + e.message); process.exit(1); });
}
