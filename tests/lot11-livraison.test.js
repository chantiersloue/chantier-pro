// Tests du lot 11.1 — les deux fichiers « à coller » du planning : node tests/lot11-livraison.test.js
// Ils doivent être à jour, et chacun doit tourner SEUL (les deux programmes vivent dans deux projets Apps Script séparés).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { creerFaux, charger } = require('./faux-google-planning');
const { construire, SORTIE } = require('../outils/construire-planning');

let reussis = 0;
function test(nom, fn) {
  try { fn(); reussis++; console.log('  ✓ ' + nom); }
  catch (e) { console.log('  ✗ ' + nom + '\n    ' + String(e.stack || e.message).split('\n').slice(0, 6).join('\n    ')); process.exitCode = 1; }
}
const lire = f => fs.readFileSync(path.join(SORTIE, f), 'utf8');

console.log('Lot 11.1 — la livraison du planning');
test('les deux fichiers à coller sont à jour (sinon : node outils/construire-planning.js)', () => {
  construire(true).forEach(r => assert.ok(r.aJour, r.fichier + ' n’est pas à jour'));
});
test('le programme du planning tourne seul, et Google ne lui donne que le droit de toucher CE Sheet (@OnlyCurrentDoc)', () => {
  const code = lire('1-Programme-du-planning.gs');
  assert.ok(/^\/\*\*\n \* @OnlyCurrentDoc\n \*\//.test(code), 'annotation @OnlyCurrentDoc en tête');
  ['function onOpen(', 'function onEdit(', 'function menuSemaineSuivante(', 'function plCompleter_(', 'function plEcrireAffiche_('].forEach(t => assert.ok(code.indexOf(t) > -1, t));
  ['function passagePublication(', 'DriveApp', 'UrlFetchApp', 'openById'].forEach(t => assert.ok(code.replace(/\/\/.*$/gm, '').indexOf(t) < 0, t + ' ne doit pas être dans le programme du planning'));
  const g = creerFaux({ classeurs: { P: { nom: 'Planning Loué', onglets: { 'Feuille 1': [] } } }, actif: 'P' });
  const ctx = charger(g, [path.join(SORTIE, '1-Programme-du-planning.gs')]);
  ctx.onOpen();
  assert.ok(ctx.plgInstaller_(g.classeurs.P.api).length === 3);
  assert.deepStrictEqual(g.noms('P').slice().sort(), ['2026-S47', 'Feuille 1', 'LISTES', 'SALARIÉS']);
});
test('le programme de publication tourne seul ; il n’a ni menu ni saisie', () => {
  const code = lire('2-Programme-de-publication.gs');
  ['function passagePublication(', 'function passageDeNuit(', 'function installerPublication(', 'function verifierPublication(', 'function plEcrireAffiche_('].forEach(t => assert.ok(code.indexOf(t) > -1, t));
  ['function onOpen(', 'function onEdit(', 'getUi()'].forEach(t => assert.ok(code.indexOf(t) < 0, t + ' ne doit pas être dans le programme de publication'));
  const g = creerFaux({ classeurs: { P: { nom: 'Planning Loué', onglets: { 'LISTES': [['N°']] } } }, proprietes: { PLANNING_ID: 'P' } });
  const ctx = charger(g, [path.join(SORTIE, '2-Programme-de-publication.gs')]);
  assert.strictEqual(ctx.passagePublication(), 'rien à faire');
  assert.ok(/programme de publication/.test(ctx.verifierPublication()));
});
test('aucune adresse, aucun identifiant Google dans les fichiers à coller (le dépôt est public)', () => {
  ['1-Programme-du-planning.gs', '2-Programme-de-publication.gs'].forEach(f => {
    const code = lire(f);
    assert.ok(!/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/.test(code), f + ' : une adresse e-mail');
    assert.ok(!/[-\w]{40,}/.test(code.replace(/[═─]+/g, '')), f + ' : une longue chaîne qui ressemble à un identifiant');
  });
});

console.log('\n' + reussis + ' test(s) réussi(s)' + (process.exitCode ? ' — DES TESTS ONT ÉCHOUÉ' : ''));
