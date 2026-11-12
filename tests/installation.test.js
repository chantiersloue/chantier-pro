// Tests du moteur d'installation d'un lot (apps-script/Installation.gs) : node tests/installation.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { creerGoogle, chargerScript } = require('./gas-harness');

function environnement(options = {}) {
  const google = creerGoogle(Object.assign({
    proprietes: { DRIVE_ROOT_ID: 'RACINE', DRIVE_PLANNING_ID: 'PLANNING' },
    feuilles: { 'Chantiers': [['Nom', 'Référence', 'Statut', 'Conducteur']] },
  }, options));
  google.ctx = chargerScript(google);
  return google;
}
const TEST = { nomSheet: 'ChantierPro TEST', proprietes: { ENVIRONNEMENT: 'TEST' } };
const PROD = { nomSheet: 'ChantierPro', proprietes: {} };
// Les listes venues du faux Apps Script vivent dans un autre « monde » JavaScript : on compare leur contenu
const memes = (a, b, m) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), m);
const bilan = g => (g.feuilles['Installation'] ? g.feuilles['Installation'].lignes.slice(1) : []);
// Trois étapes d'essai : chacune pose une propriété ; « traces » note ce qui a réellement tourné
function etapes(g, traces, casse) {
  const prop = k => g.ctx.PropertiesService.getScriptProperties();
  const etape = (cle, extra) => Object.assign({
    nom: 'Étape ' + cle,
    fait: () => !!prop().getProperty(cle),
    action: () => { traces.push(cle); if (casse === cle) throw new Error('panne de ' + cle); prop().setProperty(cle, 'oui'); return 'posée'; },
  }, extra || {});
  return [etape('A'), etape('B'), etape('C')];
}

let reussis = 0;
function test(nom, fn) {
  try { fn(); reussis++; console.log('  ✓ ' + nom); }
  catch (e) { process.exitCode = 1; console.log('  ✗ ' + nom + '\n    ' + (e.stack || e).split('\n').slice(0, 4).join('\n    ')); }
}

test('les étapes sont lancées dans l’ordre, et le bilan le dit ligne par ligne', () => {
  const g = environnement(TEST), t = [];
  const r = g.ctx.installer_('Lot X', 'TEST', etapes(g, t));
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(t, ['A', 'B', 'C']);
  assert.ok(/^Lot X — installation — environnement : TEST — Sheet « ChantierPro TEST » — serveur v/.test(r.lignes[0]), r.lignes[0]);
  memes(r.lignes.slice(1, 4), ['✅ 1/3 Étape A : fait — posée', '✅ 2/3 Étape B : fait — posée', '✅ 3/3 Étape C : fait — posée']);
  assert.strictEqual(r.lignes[4], '✅ Lot X : installation terminée.');
});
test('relancer ne rejoue rien : tout est « déjà fait »', () => {
  const g = environnement(TEST), t = [];
  g.ctx.installer_('Lot X', 'TEST', etapes(g, t));
  const r = g.ctx.installer_('Lot X', 'TEST', etapes(g, t));
  assert.deepStrictEqual(t, ['A', 'B', 'C'], 'aucune action relancée');
  assert.ok(r.ok && r.lignes.slice(1, 4).every(l => / : déjà fait$/.test(l)), r.texte);
});
test('une étape déjà faite à la main n’est pas rejouée, les autres le sont', () => {
  const g = environnement({ nomSheet: 'ChantierPro TEST', proprietes: { ENVIRONNEMENT: 'TEST', B: 'réglage fait à la main' } }), t = [];
  g.ctx.installer_('Lot X', 'TEST', etapes(g, t));
  assert.deepStrictEqual(t, ['A', 'C']);
  assert.strictEqual(g.proprietes.B, 'réglage fait à la main', 'la valeur existante n’est pas écrasée');
});
test('arrêt à la première erreur : les étapes suivantes ne sont pas lancées ; relance = reprise', () => {
  const g = environnement(TEST), t = [];
  const r = g.ctx.installer_('Lot X', 'TEST', etapes(g, t, 'B'));
  assert.strictEqual(r.ok, false);
  assert.deepStrictEqual(t, ['A', 'B']);
  assert.ok(/^❌ 2\/3 Étape B : panne de B$/.test(r.lignes[2]) && /^⛔ Arrêt à cette étape : les 1 étape\(s\) suivante\(s\) n’ont PAS été lancées/.test(r.lignes[3]), r.texte);
  assert.ok(!g.proprietes.C);
  const t2 = [], r2 = g.ctx.installer_('Lot X', 'TEST', etapes(g, t2));
  assert.ok(r2.ok); assert.deepStrictEqual(t2, ['B', 'C'], 'A, déjà faite, n’est pas rejouée');
});
test('une action qui tourne sans rien faire est signalée (❌), pas validée', () => {
  const g = environnement(TEST);
  const r = g.ctx.installer_('Lot X', 'TEST', [{ nom: 'Menteuse', fait: () => false, action: () => 'tout va bien' }]);
  assert.strictEqual(r.ok, false);
  assert.ok(/toujours pas faite \(tout va bien\)/.test(r.lignes[1]), r.texte);
});
test('mauvais environnement = refus, rien n’est lancé (dans les deux sens)', () => {
  const g = environnement(PROD), t = [];
  const r = g.ctx.installer_('Lot X', 'TEST', etapes(g, t));
  assert.ok(!r.ok && /prévue pour TEST, et ce projet est PRODUCTION\. Rien n’a été fait/.test(r.texte), r.texte);
  const g2 = environnement(TEST), t2 = [];
  const r2 = g2.ctx.installer_('Lot X', 'PRODUCTION', etapes(g2, t2));
  assert.ok(!r2.ok && /prévue pour PRODUCTION, et ce projet est TEST/.test(r2.texte));
  assert.deepStrictEqual(t.concat(t2), []);
});
test('environnement incohérent (propriété TEST sur un Sheet non TEST, ou l’inverse) = refus partout', () => {
  [{ nomSheet: 'ChantierPro', proprietes: { ENVIRONNEMENT: 'TEST' } }, { nomSheet: 'ChantierPro TEST', proprietes: {} }].forEach(o => {
    ['TEST', 'PRODUCTION'].forEach(attendu => {
      const g = environnement(o), t = [];
      const r = g.ctx.installer_('Lot X', attendu, etapes(g, t));
      assert.ok(!r.ok && /ne disent pas la même chose/.test(r.texte), r.texte);
      assert.deepStrictEqual(t, []);
      assert.ok(!g.ctx.installer_('Lot X', null, etapes(g, t), { controleSeul: true }).ok);
    });
  });
});
test('contrôle seul : aucune action, aucune propriété écrite, le bilan dit ce qui reste à faire', () => {
  const g = environnement({ nomSheet: 'ChantierPro', proprietes: { A: 'oui' } }), t = [];
  const avant = JSON.stringify(g.proprietes);
  const r = g.ctx.installer_('Lot X', null, etapes(g, t), { controleSeul: true });
  assert.deepStrictEqual(t, []);
  assert.strictEqual(JSON.stringify(g.proprietes), avant);
  memes(r.lignes.slice(1), ['✅ 1/3 Étape A : déjà fait', '⬜ 2/3 Étape B : à faire', '⬜ 3/3 Étape C : à faire',
    'Contrôle terminé : 2 étape(s) à faire. Rien n’a été modifié.']);
});
test('une étape réservée à la production est sautée sur TEST (et l’inverse)', () => {
  const g = environnement(TEST), t = [];
  const e = etapes(g, t); e[1].seulement = 'PRODUCTION';
  const r = g.ctx.installer_('Lot X', 'TEST', e);
  assert.deepStrictEqual(t, ['A', 'C']);
  assert.strictEqual(r.lignes[2], '➖ 2/3 Étape B : non concerné sur TEST');
});
test('le bilan est écrit dans l’onglet « Installation », qui ne garde que les 50 dernières lignes', () => {
  const g = environnement(TEST), t = [];
  g.ctx.installer_('Lot X', 'TEST', etapes(g, t));
  let b = bilan(g);
  assert.strictEqual(b.length, 4);
  memes(b[0].slice(1), ['Lot X', 'TEST', 'installation', '✅ 1/3 Étape A : fait — posée']);
  for (let i = 0; i < 20; i++) g.ctx.installer_('Lot ' + i, 'TEST', etapes(g, t));
  b = bilan(g).filter(l => l.some(v => v !== '' && v !== undefined));
  assert.strictEqual(b.length, 50);
  assert.strictEqual(b[49][1], 'Lot 19', 'les plus récentes sont gardées');
  assert.strictEqual(b[49][4], '✅ Lot 19 : installation terminée.');
});
test('si l’onglet du bilan ne peut pas être écrit, l’installation rend quand même son résultat', () => {
  const g = environnement(TEST), t = [];
  g.ctx.feuille_ = () => { throw new Error('onglet protégé'); };
  const r = g.ctx.installer_('Lot X', 'TEST', etapes(g, t));
  assert.ok(r.ok && t.length === 3);
});
test('lot 2 : controlerInstallationLot2 ne modifie rien et dit ce qui est en place', () => {
  const g = environnement({ nomSheet: 'ChantierPro TEST', proprietes: { ENVIRONNEMENT: 'TEST', CLE_JETON: 'x'.repeat(96), HACHAGE_ITERATIONS: '3000' },
    feuilles: { 'Chantiers': [['Nom']], 'Utilisateurs': [['Identifiant']], 'Accès chantiers': [['Chantier']] } });
  const propsAvant = JSON.stringify(g.proprietes), onglets = Object.keys(g.feuilles).sort().join();
  const lignesAvant = JSON.stringify(['Chantiers', 'Utilisateurs', 'Accès chantiers'].map(n => g.feuilles[n].lignes));
  const texte = g.ctx.controlerInstallationLot2();
  assert.ok(/Lot 2 — contrôle seul — environnement : TEST/.test(texte), texte);
  assert.ok(/✅ 1\/4 Clé des jetons.* : déjà fait/.test(texte) && /✅ 2\/4 Onglets.* : déjà fait/.test(texte));
  assert.ok(/➖ 3\/4 Déclencheurs.* : non concerné sur TEST/.test(texte) && /✅ 4\/4 Propriété HACHAGE_ITERATIONS.* : déjà fait/.test(texte));
  assert.ok(/Contrôle terminé : tout est en place\. Rien n’a été modifié\./.test(texte));
  assert.strictEqual(JSON.stringify(g.proprietes), propsAvant, 'aucune propriété touchée');
  assert.strictEqual(g.declencheurs.length, 0, 'aucun déclencheur posé');
  assert.strictEqual(Object.keys(g.feuilles).sort().join(), (onglets + ',Installation').split(',').sort().join(), 'seul l’onglet Installation est créé');
  assert.strictEqual(JSON.stringify(['Chantiers', 'Utilisateurs', 'Accès chantiers'].map(n => g.feuilles[n].lignes)), lignesAvant);
});
test('lot 2 en production : déclencheurs manquants et propriété manquante sont signalés, sans rien installer', () => {
  const g = environnement({ nomSheet: 'ChantierPro', proprietes: { CLE_JETON: 'x'.repeat(96) },
    feuilles: { 'Chantiers': [['Nom']], 'Utilisateurs': [['Identifiant']], 'Accès chantiers': [['Chantier']] } });
  let texte = g.ctx.controlerInstallationLot2();
  assert.ok(/⬜ 3\/4 Déclencheurs.* : à faire/.test(texte) && /⬜ 4\/4 Propriété HACHAGE_ITERATIONS.* : à faire/.test(texte) && /2 étape\(s\) à faire/.test(texte), texte);
  assert.strictEqual(g.declencheurs.length, 0);
  g.ctx.installerDeclencheurs();
  texte = g.ctx.controlerInstallationLot2();
  assert.ok(/✅ 3\/4 Déclencheurs.* : déjà fait/.test(texte), texte);
});
test('livraison : Installation.gs est dans le serveur à coller, et il n’existe pas d’installation du lot 2 pour la production', () => {
  const code = fs.readFileSync(path.join(__dirname, '..', 'A-COLLER-DANS-APPS-SCRIPT', 'Code.gs'), 'utf8');
  assert.ok(/function installer_\(/.test(code) && /function controlerInstallationLot2\(/.test(code));
  assert.ok(!/function installerLot2/.test(code));
});
console.log('\n' + reussis + ' test(s) réussi(s)' + (process.exitCode ? ' — DES TESTS ÉCHOUENT' : ''));
