// Tests du lot 13, côté serveur (« Mes notes » : les notes que le compte a écrites lui-même, tous chantiers) : node tests/lot13-notes.test.js
// Le VRAI code d'apps-script/ tourne avec les services Google simulés (tests/gas-harness.js) : rien ne part chez Google.
// Noms, chantiers et adresses : tous fictifs (dépôt public).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { creerGoogle, chargerScript } = require('./gas-harness');

function environnement(options = {}) {
  const g = creerGoogle({
    nomSheet: 'ChantierPro',
    proprietes: { DRIVE_ROOT_ID: 'RACINE', DRIVE_PLANNING_ID: 'PLANNING', HACHAGE_ITERATIONS: '200' },
    feuilles: {
      'Contacts': [['Nom', 'Role', 'Email', 'ChefEquipe', 'Destinataire', 'ConducteurDefaut', 'ChefAtelier', 'absenceNotif'],
        ['Franck ESSAI', 'Conducteur de travaux', 'franck@loue.test', 'O', 'N', 'O', 'N', 'O']],
      'Contacts notes': [['Nom', 'Email']],
      'Chantiers': [['Nom', 'Référence', 'Statut', 'Conducteur', 'N°'],
        ['CHANTIER TEST 1', 'LIEU 1', 'En cours', 'Sébastien ESSAI', '0501'],
        ['CHANTIER TEST 2', 'LIEU 2', 'En cours', 'Franck ESSAI', '0502'],
        ['CHANTIER TEST 3', 'LIEU 3', 'En cours', 'Franck ESSAI', '0503'],
        ['CHANTIER FINI', 'LIEU 4', 'Terminé', 'Sébastien ESSAI', '0400']],
    },
  });
  g.creerElement('dossier', 'Loué Menuiserie - Chantiers', null, { id: 'RACINE' });
  g.creerElement('dossier', 'Planning', null, { id: 'PLANNING' });
  g.ctx = options.codeGs ? chargerScript(g, path.join(__dirname, '..', 'A-COLLER-DANS-APPS-SCRIPT', 'Code.gs')) : chargerScript(g);
  g.ctx.genererCle(); g.ctx.preparerOngletsLot2();
  const u = g.feuilles['Utilisateurs'];
  u.lignes[1] = ['thomas27', 'Thomas ESSAI', 'Poseur', true, false, '', '', false, false, ''];
  u.lignes[2] = ['seb', 'Sébastien ESSAI', 'Conducteur', true, false, '', '', false, false, ''];
  u.lignes[3] = ['kevin', 'Faux (thomas27)', 'Poseur', true, false, '', '', false, false, ''];   // un nom qui imite l'identifiant d'un autre
  g.ctx.traiterComptes();
  const a = g.feuilles['Accès chantiers'];
  g.cocher = (id, chantier, v) => { const col = a.lignes[0].indexOf(id); assert.ok(col > 1, 'colonne ' + id); a.lignes.forEach(l => { if (l[0] === chantier) l[col] = v !== false; }); };
  ['CHANTIER TEST 1', 'CHANTIER TEST 2', 'CHANTIER FINI'].forEach(c => g.cocher('thomas27', c));
  ['CHANTIER TEST 1', 'CHANTIER TEST 2'].forEach(c => g.cocher('kevin', c));
  g.ctx.installerLot3Production();
  g.ctx.installerLot12Production();
  return g;
}
const poster = (g, corps) => JSON.parse(g.ctx.doPost({ postData: { contents: JSON.stringify(corps) } }).contenu);
const jeton = (g, id) => g.ctx.fabriquerJeton_(id, 1);
let numero = 0;
const idFiche = () => 'fiche-lot13-' + String(++numero).padStart(6, '0');
const ajouter = (g, qui, chantier, texte) => { const id = idFiche(); const r = poster(g, { action: 'fiche', id: id, saisiPar: qui, jeton: jeton(g, qui), donnees: { type: 'note-chantier', chantier: chantier, texte: texte } }); assert.ok(r.ok, JSON.stringify(r)); return id; };
const geste = (g, qui, chantier, note, nom) => poster(g, { action: 'fiche', id: idFiche(), saisiPar: qui, jeton: jeton(g, qui), donnees: { type: 'note-action', chantier: chantier, note: note, geste: nom } });
const miennes = (g, qui, extra) => poster(g, Object.assign({ action: 'notes', miennes: true }, extra || {}, qui ? { jeton: jeton(g, qui) } : {}));
const textes = r => r.data.aFaire.map(n => n.texte);
const j = x => JSON.stringify(x);

let reussis = 0;
function test(nom, fn) {
  try { fn(); reussis++; console.log('  ✓ ' + nom); }
  catch (e) { console.log('  ✗ ' + nom + '\n    ' + String(e.stack || e.message).split('\n').slice(0, 6).join('\n    ')); process.exitCode = 1; }
}

console.log('Lot 13 — « Mes notes » : les notes que le compte a écrites lui-même');
test('un poseur : ses notes de tous ses chantiers, la plus récente en haut, avec le chantier et la date ; jamais celles d’un autre', () => {
  const g = environnement();
  ajouter(g, 'thomas27', 'CHANTIER TEST 1', 'T1 première');
  ajouter(g, 'kevin', 'CHANTIER TEST 1', 'note de Kévin');
  ajouter(g, 'thomas27', 'CHANTIER TEST 2', 'T2 deuxième');
  ajouter(g, 'seb', 'CHANTIER TEST 2', 'note du conducteur');
  ajouter(g, 'thomas27', 'CHANTIER TEST 1', 'T1 troisième');
  const r = miennes(g, 'thomas27');
  assert.ok(r.ok, j(r));
  assert.deepStrictEqual(textes(r), ['T1 troisième', 'T2 deuxième', 'T1 première']);
  assert.deepStrictEqual(r.data.aFaire.map(n => n.chantier), ['CHANTIER TEST 1', 'CHANTIER TEST 2', 'CHANTIER TEST 1']);
  assert.ok(r.data.aFaire.every(n => typeof n.cree === 'number' && n.cree > 0 && n.fait === false), j(r.data.aFaire));
  assert.deepStrictEqual(textes(miennes(g, 'kevin')), ['note de Kévin']);
  assert.deepStrictEqual(textes(miennes(g, 'seb')), ['note du conducteur'], 'un conducteur aussi : seulement les siennes');
});
test('l’auteur est l’identifiant noté par le SERVEUR à la création : un nom de compte qui se termine par « (thomas27) » ne trompe pas', () => {
  const g = environnement();
  ajouter(g, 'kevin', 'CHANTIER TEST 1', 'écrite par kevin, dont le nom imite thomas27');
  assert.ok(/\(thomas27\) \(kevin\)$/.test(g.feuilles['Notes'].lignes[1][5]), g.feuilles['Notes'].lignes[1][5]);
  assert.deepStrictEqual(textes(miennes(g, 'thomas27')), []);
  assert.strictEqual(textes(miennes(g, 'kevin')).length, 1);
  // ce que dit le téléphone ne compte pas : « saisiPar » ou un champ « auteur » ne changent rien
  const r = poster(g, { action: 'notes', miennes: true, jeton: jeton(g, 'thomas27'), saisiPar: 'kevin', auteur: 'kevin', compte: 'kevin' });
  assert.deepStrictEqual(textes(r), []);
});
test('une note cochée (par lui ou par un autre) passe dans les terminées ; décochée, elle revient', () => {
  const g = environnement();
  const a = ajouter(g, 'thomas27', 'CHANTIER TEST 1', 'à cocher'), b = ajouter(g, 'thomas27', 'CHANTIER TEST 2', 'reste à faire');
  assert.ok(geste(g, 'thomas27', 'CHANTIER TEST 1', a, 'fait').ok);
  let r = miennes(g, 'thomas27');
  assert.deepStrictEqual([textes(r), r.data.termines.map(n => n.texte), r.data.nbTermines], [['reste à faire'], ['à cocher'], 1]);
  assert.ok(r.data.termines[0].chantier === 'CHANTIER TEST 1' && r.data.termines[0].fait === true && r.data.termines[0].cree > 0);
  assert.ok(geste(g, 'kevin', 'CHANTIER TEST 2', b, 'fait').ok, 'un autre gars du chantier coche sa note');
  r = miennes(g, 'thomas27');
  assert.deepStrictEqual([textes(r), r.data.nbTermines], [[], 2]);
  assert.ok(geste(g, 'thomas27', 'CHANTIER TEST 1', a, 'defaire').ok);
  assert.deepStrictEqual(textes(miennes(g, 'thomas27')), ['à cocher']);
});
test('chantier retiré de ses cases, ou passé « Terminé » : ses notes de ce chantier ne sont plus rendues (ni cochables)', () => {
  const g = environnement();
  const a = ajouter(g, 'thomas27', 'CHANTIER TEST 2', 'sur le chantier 2');
  ajouter(g, 'thomas27', 'CHANTIER TEST 1', 'sur le chantier 1');
  g.cocher('thomas27', 'CHANTIER TEST 2', false);
  assert.deepStrictEqual(textes(miennes(g, 'thomas27')), ['sur le chantier 1']);
  assert.ok(!geste(g, 'thomas27', 'CHANTIER TEST 2', a, 'fait').ok, 'le geste est refusé comme avant');
  g.feuilles['Chantiers'].lignes.find(l => l[0] === 'CHANTIER TEST 1')[2] = 'Terminé';
  assert.deepStrictEqual(textes(miennes(g, 'thomas27')), []);
});
test('réglage « tous les chantiers » allumé (lot 12) : ses notes de tout chantier en cours, toujours pas celles d’un chantier terminé', () => {
  const g = environnement();
  ajouter(g, 'seb', 'CHANTIER TEST 3', 'note du conducteur sur le 3');
  g.feuilles['Réglages'].lignes[1][1] = true;
  ajouter(g, 'thomas27', 'CHANTIER TEST 3', 'écrite grâce au réglage');
  ajouter(g, 'thomas27', 'CHANTIER FINI', 'sur un chantier terminé');
  assert.deepStrictEqual(textes(miennes(g, 'thomas27')), ['écrite grâce au réglage']);
  g.feuilles['Réglages'].lignes[1][1] = false;
  assert.deepStrictEqual(textes(miennes(g, 'thomas27')), [], 'réglage éteint : le chantier 3 n’est plus à lui');
});
test('sans compte, jeton faux, compte désactivé : refusés ; rien n’est rendu', () => {
  const g = environnement();
  ajouter(g, 'thomas27', 'CHANTIER TEST 1', 'SECRET');
  [miennes(g, ''), poster(g, { action: 'notes', miennes: true, jeton: 'thomas27.1.9999999999999.faux' })].forEach(r => assert.ok(!r.ok && j(r).indexOf('SECRET') < 0, j(r)));
  g.feuilles['Utilisateurs'].lignes[1][3] = false;
  const r = miennes(g, 'thomas27');
  assert.ok(!r.ok && j(r).indexOf('SECRET') < 0, j(r));
});
test('ce qui existait ne change pas : la liste d’un chantier (ordre, sans date), et la vue « tous chantiers » toujours réservée aux conducteurs', () => {
  const g = environnement();
  ajouter(g, 'thomas27', 'CHANTIER TEST 1', 'un'); ajouter(g, 'kevin', 'CHANTIER TEST 1', 'deux');
  const liste = poster(g, { action: 'notes', chantier: 'CHANTIER TEST 1', jeton: jeton(g, 'thomas27') });
  assert.deepStrictEqual(textes(liste), ['un', 'deux'], 'le plus ancien en haut, tout le monde');
  assert.ok(liste.data.aFaire.every(n => !('cree' in n) && !('chantier' in n)));
  const avecChantier = poster(g, { action: 'notes', chantier: 'CHANTIER TEST 1', miennes: true, jeton: jeton(g, 'thomas27') });
  assert.deepStrictEqual(textes(avecChantier), ['un', 'deux'], '« miennes » avec un chantier : c’est la liste du chantier');
  const tous = poster(g, { action: 'notes', jeton: jeton(g, 'thomas27') });
  assert.deepStrictEqual([tous.ok, tous.code], [false, 'INTERDIT']);
  const conducteur = poster(g, { action: 'notes', jeton: jeton(g, 'seb') });
  assert.ok(conducteur.ok && textes(conducteur).length === 2);
});
test('recherche dans « Mes notes » ; plus de 300 notes : les 300 plus récentes, et la page le sait', () => {
  const g = environnement();
  ajouter(g, 'thomas27', 'CHANTIER TEST 1', 'Cales de 5'); ajouter(g, 'thomas27', 'CHANTIER TEST 2', 'Seuil A12');
  assert.deepStrictEqual(textes(miennes(g, 'thomas27', { recherche: 'seuil' })), ['Seuil A12']);
  const sh = g.feuilles['Notes'];
  // (une date fabriquée ici doit être du même « monde » JavaScript que celles du faux Apps Script, sinon le serveur ne la reconnaît pas)
  const DateServeur = sh.lignes[1][4].constructor, depart = Date.now() + 60000;
  for (let i = 0; i < 305; i++) sh.lignes.push(['note-x' + i, 'CHANTIER TEST 1', 'n' + i, '', new DateServeur(depart + i * 1000), 'Thomas ESSAI (thomas27)', '', '', '', '']);
  const r = miennes(g, 'thomas27');
  assert.ok(r.data.aFaire.length === 300 && r.data.plein === true && r.data.aFaire[0].texte === 'n304', j([r.data.aFaire.length, r.data.plein, r.data.aFaire[0]]));
});
test('livraison : le serveur à coller contient la lecture « les miennes » ; chargé seul, il la sert', () => {
  const code = fs.readFileSync(path.join(__dirname, '..', 'A-COLLER-DANS-APPS-SCRIPT', 'Code.gs'), 'utf8');
  ['function noteAuteurId_(', 'corps.miennes === true'].forEach(t => assert.ok(code.indexOf(t) > -1, t));
  assert.ok(code.indexOf('function outilTest_(') < 0);
  const g = environnement({ codeGs: true });
  ajouter(g, 'thomas27', 'CHANTIER TEST 1', 'depuis Code.gs');
  assert.deepStrictEqual(textes(miennes(g, 'thomas27')), ['depuis Code.gs']);
});

console.log('\n' + reussis + ' test(s) réussi(s)' + (process.exitCode ? ' — DES TESTS ÉCHOUENT' : ''));
