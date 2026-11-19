// Tests du lot 12, les étoiles de « Mes chantiers » (commun/favoris.js), sans navigateur : node tests/lot12-favoris.test.js
// Noms et chantiers : tous fictifs (dépôt public).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// La brique est chargée comme dans une page : un faux « window » avec un faux localStorage
function charger(env) {
  const magasin = {};
  const fenetre = { LOUE_CONFIG: { env: env || 'test' }, localStorage: {
    getItem: k => (k in magasin ? magasin[k] : null), setItem: (k, v) => { magasin[k] = String(v); }, removeItem: k => { delete magasin[k]; } } };
  fenetre.window = fenetre;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'commun', 'favoris.js'), 'utf8'), fenetre);
  return { F: fenetre.LOUE.favoris, magasin: magasin };
}
const ch = (nom, numero, extra) => Object.assign({ nom: nom, numero: numero || '', statut: 'En cours' }, extra || {});
const j = x => JSON.stringify(x);
const etoiles = e => Object.keys(e.etoiles).sort();

let reussis = 0;
function test(nom, fn) {
  try { fn(); reussis++; console.log('  ✓ ' + nom); }
  catch (e) { console.log('  ✗ ' + nom + '\n    ' + String(e.stack || e.message).split('\n').slice(0, 6).join('\n    ')); process.exitCode = 1; }
}

console.log('Lot 12 — les étoiles de « Mes chantiers »');
const { F } = charger();
test('premier jour (rien dans le téléphone) : les chantiers signalés « mien » par le serveur deviennent les étoiles ; rien ne disparaît de l’écran', () => {
  const liste = [ch('A', '0501', { mien: true }), ch('B', '0502', { mien: true }), ch('C', '0503', { mien: false })];
  const r = F.integrer(null, liste);
  assert.ok(r.change);
  assert.deepStrictEqual(etoiles(r.etat), ['n:0501', 'n:0502']);
  assert.deepStrictEqual(F.ranger(r.etat, liste).mes.map(c => c.nom), ['A', 'B']);
});
test('une étoile retirée à la main ne revient pas tant que le serveur ne signale rien de nouveau', () => {
  const liste = [ch('A', '0501', { mien: true }), ch('B', '0502', { mien: true })];
  let e = F.integrer(null, liste).etat;
  e = F.basculer(e, 'n:0501', false);
  const r = F.integrer(e, liste);
  assert.ok(!r.change);
  assert.deepStrictEqual(etoiles(r.etat), ['n:0502']);
});
test('un chantier nouvellement coché arrive tout seul ; décoché puis recoché, il revient', () => {
  let e = F.integrer(null, [ch('A', '0501', { mien: true })]).etat;
  e = F.integrer(e, [ch('A', '0501', { mien: true }), ch('B', '0502', { mien: true })]).etat;
  assert.deepStrictEqual(etoiles(e), ['n:0501', 'n:0502']);
  e = F.basculer(e, 'n:0502', false);
  e = F.integrer(e, [ch('A', '0501', { mien: true })]).etat;                                   // B décoché (réglage éteint : il sort de la liste)
  e = F.integrer(e, [ch('A', '0501', { mien: true }), ch('B', '0502', { mien: true })]).etat;  // B recoché
  assert.deepStrictEqual(etoiles(e), ['n:0501', 'n:0502']);
  e = F.basculer(e, 'n:0502', false);
  e = F.integrer(e, [ch('A', '0501', { mien: true }), ch('B', '0502', { mien: false })]).etat; // réglage allumé : B reste dans la liste, plus « mien »
  e = F.integrer(e, [ch('A', '0501', { mien: true }), ch('B', '0502', { mien: true })]).etat;
  assert.deepStrictEqual(etoiles(e), ['n:0501', 'n:0502']);
});
test('planning : une série nouvelle met une étoile ; retirée, elle ne revient pas tant que la série continue ; elle revient à la série suivante (après une coupure)', () => {
  const liste = d => [ch('A', '0501', { mien: false, planifie: d }), ch('B', '0502', { mien: false })];
  let e = F.integrer(null, liste('2026-11-23')).etat;
  assert.deepStrictEqual(etoiles(e), ['n:0501']);
  e = F.basculer(e, 'n:0501', false);
  let r = F.integrer(e, liste('2026-11-23'));
  assert.ok(!r.change && etoiles(r.etat).length === 0, 'la série continue : rien ne revient');
  r = F.integrer(r.etat, [ch('A', '0501', { mien: false }), ch('B', '0502', { mien: false })]);   // plus planifié : rien ne bouge
  assert.ok(etoiles(r.etat).length === 0);
  r = F.integrer(r.etat, liste('2026-12-14'));
  assert.deepStrictEqual(etoiles(r.etat), ['n:0501'], 'nouvelle série : l’étoile revient');
});
test('le planning ne retire jamais rien : plus planifié, l’étoile reste', () => {
  let e = F.integrer(null, [ch('A', '0501', { planifie: '2026-11-23' })]).etat;
  e = F.integrer(e, [ch('A', '0501', {})]).etat;
  assert.deepStrictEqual(etoiles(e), ['n:0501']);
});
test('une liste VIDE (panne, pas encore chargée) ne fait rien oublier : les étoiles retirées ne reviennent pas à la liste suivante', () => {
  const liste = [ch('A', '0501', { mien: true }), ch('B', '0502', { mien: true })];
  let e = F.integrer(null, liste).etat;
  e = F.basculer(e, 'n:0501', false);
  const vide = F.integrer(e, []);
  assert.ok(!vide.change);
  assert.deepStrictEqual(etoiles(F.integrer(vide.etat, liste).etat), ['n:0502']);
  const tout = F.integrer(null, []);
  assert.ok(tout.change && etoiles(tout.etat).length === 0, 'premier lancement sans liste : un état vide, puis la vraie liste');
  assert.deepStrictEqual(etoiles(F.integrer(tout.etat, liste).etat), ['n:0501', 'n:0502']);
});
test('chantier renommé : son étoile le suit (il a un numéro) ; deux chantiers de même numéro : chacun sa clé, par son nom', () => {
  let e = F.integrer(null, [ch('LES TILLEULS', '0501', { mien: true })]).etat;
  const apres = [ch('RÉSIDENCE LES TILLEULS', '0501', { mien: true })];
  assert.deepStrictEqual(F.ranger(F.integrer(e, apres).etat, apres).mes.map(c => c.nom), ['RÉSIDENCE LES TILLEULS']);
  const doubles = [ch('LOT A', '0600'), ch('LOT B', '0600')];
  assert.strictEqual(j(F.cles(doubles)), j({ 'LOT A': 'c:lot a', 'LOT B': 'c:lot b' }));
  e = F.basculer(F.vide(), 'c:lot a', true);
  assert.deepStrictEqual(F.ranger(e, doubles).mes.map(c => c.nom), ['LOT A']);
});
test('classement par NUMÉRO (90 avant 403 avant 1201), les chantiers sans numéro à la fin par ordre alphabétique', () => {
  const liste = [ch('ZÈBRE'), ch('D', '1201'), ch('B', '403'), ch('AMANDE'), ch('C', '90'), ch('A', '0403 bis')];
  assert.deepStrictEqual(F.trier(liste).map(c => c.nom), ['C', 'A', 'B', 'D', 'AMANDE', 'ZÈBRE']);
});
test('chantier « Terminé » : il sort de « Mes chantiers », et il est en bas de « Tous les chantiers »', () => {
  const liste = [ch('A', '0501', { mien: true }), ch('FINI', '0400', { statut: 'Terminé' }), ch('B', '0502')];
  let e = F.integrer(null, liste).etat;
  e = F.basculer(e, 'n:0400', true);
  const r = F.ranger(e, liste);
  assert.deepStrictEqual(r.mes.map(c => c.nom), ['A']);
  assert.deepStrictEqual(r.tous.map(c => c.nom), ['A', 'B', 'FINI']);
});
test('rangé dans le téléphone PAR COMPTE et par mode (test, production) ; un état abîmé est ignoré sans erreur', () => {
  const a = charger('test');
  a.F.ecrire('poseur1', a.F.basculer(a.F.vide(), 'n:0501', true));
  assert.deepStrictEqual(etoiles(a.F.lire('poseur1')), ['n:0501']);
  assert.strictEqual(a.F.lire('poseur2'), null);
  assert.deepStrictEqual(Object.keys(a.magasin), ['loue_favoris_test_poseur1']);
  a.magasin['loue_favoris_test_poseur1'] = '{pas du json';
  assert.strictEqual(a.F.lire('poseur1'), null);
  a.magasin['loue_favoris_test_poseur1'] = '{"etoiles":[1,2],"vus":"x"}';
  assert.deepStrictEqual(j(a.F.lire('poseur1')), j({ etoiles: {}, vus: {}, series: {}, v: 1 }));
  assert.strictEqual(a.F.ecrire('', a.F.vide()), false);
});
test('la page charge la brique, et le service worker la garde hors réseau', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8'), sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  assert.ok(/<script src="commun\/favoris\.js\?v=[0-9a-f]+"><\/script>/.test(index) && /commun\/favoris\.js\?v=/.test(sw));
  ['voirTous', 'noterRecent', 'cleRecents', 'basculerTous()', 'id="btn-tous"'].forEach(t => assert.ok(index.indexOf(t) < 0, 'code orphelin : ' + t));
});

console.log('\n' + reussis + ' test(s) réussi(s)' + (process.exitCode ? ' — DES TESTS ÉCHOUENT' : ''));
