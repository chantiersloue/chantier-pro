// Tests du lot 4, côté serveur (carnet de chantier : liste des documents et images) : node tests/lot4-carnet.test.js
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const { creerGoogle, chargerScript } = require('./gas-harness');

function environnement() {
  const g = creerGoogle({
    nomSheet: 'ChantierPro',
    proprietes: { DRIVE_ROOT_ID: 'RACINE', DRIVE_PLANNING_ID: 'PLANNING', HACHAGE_ITERATIONS: '200' },
    feuilles: {
      'Contacts': [['Nom', 'Role', 'Email', 'ChefEquipe', 'Destinataire', 'ConducteurDefaut', 'ChefAtelier', 'absenceNotif'],
        ['Sébastien', 'Conducteur de travaux', 'seb@loue.test', 'O', 'N', 'O', 'N', 'N']],
      'Contacts notes': [['Nom', 'Email']],
      'Chantiers': [['Nom', 'Référence', 'Statut', 'Conducteur'],
        ['CHANTIER TEST 1', 'LIEU 1', 'En cours', 'Sébastien'],
        ['CHANTIER TEST 2', 'LIEU 2', 'En cours', 'Sébastien']],
    },
  });
  const racine = g.creerElement('dossier', 'Loué Menuiserie - Chantiers', null, { id: 'RACINE' });
  g.creerElement('dossier', 'Planning', null, { id: 'PLANNING' });
  g.ctx = chargerScript(g);
  g.ctx.genererCle(); g.ctx.preparerOngletsLot2();
  const u = g.feuilles['Utilisateurs'];
  u.lignes[1] = ['thomas27', 'Thomas', 'Poseur', true, false, '', '', false, false, ''];
  u.lignes[2] = ['seb', 'Sébastien', 'Conducteur', true, false, '', '', false, false, ''];
  u.lignes[3] = ['kevin', 'Kévin', 'Poseur', true, false, '', '', false, false, ''];
  g.ctx.traiterComptes();
  const a = g.feuilles['Accès chantiers'], col = a.lignes[0].indexOf('thomas27');
  a.lignes.forEach(l => { if (l[0] === 'CHANTIER TEST 1') l[col] = true; });
  g.racine = racine;
  return g;
}
// Un document déposé comme le fera le programme de dépôt : aperçus, et des paquets de tuiles mises bout à bout
function deposer(g, options = {}) {
  const chantier = g.creerElement('dossier', options.chantier || 'CHANTIER TEST 1', g.racine);
  const carnet = g.creerElement('dossier', 'CARNET', chantier);
  const dossier = g.creerElement('dossier', '105 A PLANS DE RESERVATIONS', carnet);
  const octets = n => crypto.randomBytes(n);
  const tuiles = {}, paquets = [];
  const cols = 4, ligs = 4, ko = options.ko || 40;
  for (let p = 0; p < 2; p++) {   // deux paquets de 8 tuiles
    const liste = []; let contenu = Buffer.alloc(0);
    for (let l = p * 2; l < p * 2 + 2; l++) for (let c = 0; c < cols; c++) {
      const t = octets(ko * 1024 + c);
      liste.push([c, l, contenu.length, t.length]); tuiles[c + ',' + l] = t; contenu = Buffer.concat([contenu, t]);
    }
    const nom = 'p1-z0-' + p + '.pak';
    g.creerElement('fichier', nom, dossier, { contenu: contenu });
    paquets.push({ f: nom, o: contenu.length, tuiles: liste });
  }
  const leger = octets(3000), net = octets(9000);
  g.creerElement('fichier', 'p1-leger.webp', dossier, { contenu: leger });
  g.creerElement('fichier', 'p1-net.webp', dossier, { contenu: net });
  const page = { l: 2048, h: 2048, leger: { f: 'p1-leger.webp', o: 3000 }, net: { f: 'p1-net.webp', o: 9000 }, niveaux: [{ z: 0, cols: cols, ligs: ligs, paquets: paquets }] };
  const liste = { version: 1, chantier: options.nomDansListe || 'CHANTIER TEST 1', documents: [
    { id: '105-A', code: '105', indice: 'A', intitule: 'PLANS DE RESERVATIONS', dossier: '105 A PLANS DE RESERVATIONS', date: '2026-11-13', poids: 12345, pages: [page] },
  ].concat(options.autres || []) };
  const fichier = g.creerElement('fichier', 'carnet.json', carnet, { contenu: JSON.stringify(liste) });
  return { carnet, dossier, tuiles, leger, net, liste, fichier, page };
}
const poster = (g, corps) => JSON.parse(g.ctx.doPost({ postData: { contents: JSON.stringify(corps) } }).contenu);
const jeton = (g, id) => g.ctx.fabriquerJeton_(id, 1);
const lister = (g, qui, chantier) => poster(g, { action: 'carnet', jeton: jeton(g, qui), chantier: chantier || 'CHANTIER TEST 1' });
const images = (g, qui, extra) => poster(g, Object.assign({ action: 'carnetTuiles', jeton: jeton(g, qui), chantier: 'CHANTIER TEST 1', doc: '105-A', page: 1 }, extra));
const b64 = b => Buffer.from(b).toString('base64');
const viderCache = g => Object.keys(g.cache).forEach(k => { if (/^carnet:/.test(k)) delete g.cache[k]; });

let reussis = 0;
function test(nom, fn) {
  try { fn(); reussis++; console.log('  ✓ ' + nom); }
  catch (e) { console.log('  ✗ ' + nom + '\n    ' + String(e.stack || e.message).split('\n').slice(0, 5).join('\n    ')); process.exitCode = 1; }
}

console.log('Lot 4 — la liste du carnet');
test('un poseur du chantier reçoit la liste et la description du document, sans aucun identifiant Drive', () => {
  const g = environnement(), d = deposer(g);
  const r = lister(g, 'thomas27');
  assert.strictEqual(r.ok, true, JSON.stringify(r));
  assert.deepStrictEqual(r.data.documents.map(x => [x.id, x.code, x.indice, x.intitule, x.poids, x.pages.length]), [['105-A', '105', 'A', 'PLANS DE RESERVATIONS', 12345, 1]]);
  const texte = JSON.stringify(r);
  Object.keys(g.elements).forEach(id => { if (id !== 'RACINE' && id !== 'PLANNING') assert.ok(texte.indexOf(id) < 0, 'identifiant Drive rendu : ' + id); });
  assert.ok(d.fichier);
});
test('chantier interdit et chantier inconnu : le même refus ; conducteur : accepté ; sans carnet : liste vide', () => {
  const g = environnement(); deposer(g);
  const interdit = lister(g, 'kevin'), inconnu = lister(g, 'kevin', 'CHANTIER QUI N’EXISTE PAS');
  assert.deepStrictEqual([interdit.ok, interdit.code, interdit.message], [false, 'INTERDIT', inconnu.message]);
  assert.strictEqual(inconnu.code, 'INTERDIT');
  assert.strictEqual(lister(g, 'seb').ok, true);
  const vide = lister(g, 'seb', 'CHANTIER TEST 2');
  assert.deepStrictEqual([vide.ok, vide.data.documents.length], [true, 0]);
  assert.strictEqual(poster(g, { action: 'carnet', chantier: 'CHANTIER TEST 1' }).ok, false, 'sans compte : refusé');
});
test('un document retiré est masqué ; pour un même code, seul le dernier déposé est montré', () => {
  const g = environnement(), p = { l: 10, h: 10 };
  deposer(g, { autres: [
    { id: '106-A', code: '106', indice: 'A', intitule: 'REPERAGE', dossier: '106 A REPERAGE', pages: [p] },
    { id: '106-B', code: '106', indice: 'B', intitule: 'REPERAGE', dossier: '106 B REPERAGE', pages: [p] },
    { id: '108-A', code: '108', indice: 'A', intitule: 'BAL', dossier: '108 A BAL', pages: [p], retire: true },
    { id: '../x', code: '109', dossier: '109', pages: [p] }, { id: '110-A', code: '110', dossier: 'a/b', pages: [p] },
  ] });
  assert.deepStrictEqual(lister(g, 'thomas27').data.documents.map(x => x.id), ['105-A', '106-B']);
});
test('le carnet d’un autre chantier posé dans ce dossier n’est pas servi', () => {
  const g = environnement(); deposer(g, { nomDansListe: 'CHANTIER TEST 2' });
  const r = lister(g, 'thomas27');
  assert.deepStrictEqual([r.ok, r.code], [false, 'CARNET_ARRIVE'], JSON.stringify(r));
});
test('liste coupée (fichier en cours d’arrivée) : réponse « en cours d’arrivée », pas une erreur', () => {
  const g = environnement(), d = deposer(g);
  d.fichier.contenu = '{"version":1,"documents":[{"id":"105';
  const r = lister(g, 'thomas27');
  assert.deepStrictEqual([r.ok, r.code], [false, 'CARNET_ARRIVE'], JSON.stringify(r));
});

console.log('Lot 4 — les images');
test('aperçu léger et aperçu net rendus à l’octet près (octets au-dessus de 127 compris)', () => {
  const g = environnement(), d = deposer(g);
  const l = images(g, 'thomas27', { quoi: 'leger' }), n = images(g, 'thomas27', { quoi: 'net' });
  assert.strictEqual(l.data.images[0].b64, b64(d.leger));
  assert.strictEqual(n.data.images[0].b64, b64(d.net));
});
test('tuiles découpées dans leurs paquets à l’octet près ; un seul paquet lu quand elles sont voisines', () => {
  const g = environnement(), d = deposer(g);
  const r = images(g, 'thomas27', { quoi: 'tuiles', niveau: 0, tuiles: [[1, 0], [2, 1], [0, 0]] });
  assert.strictEqual(r.ok, true, JSON.stringify(r).slice(0, 300));
  assert.deepStrictEqual(r.data.images.map(i => i.c + ',' + i.l), ['1,0', '2,1', '0,0']);
  r.data.images.forEach(i => assert.strictEqual(i.b64, b64(d.tuiles[i.c + ',' + i.l]), 'tuile ' + i.c + ',' + i.l));
  assert.strictEqual(r.data.octetsLus, d.page.niveaux[0].paquets[0].o, 'un seul paquet lu');
  const deux = images(g, 'thomas27', { quoi: 'tuiles', niveau: 0, tuiles: [[0, 0], [0, 3]] });
  deux.data.images.forEach(i => assert.strictEqual(i.b64, b64(d.tuiles[i.c + ',' + i.l])));
  assert.strictEqual(deux.data.octetsLus, d.page.niveaux[0].paquets[0].o + d.page.niveaux[0].paquets[1].o);
});
test('plafond de 300 Ko en lecture : le surplus est rendu dans « reste » ; « masse » rend tout', () => {
  const g = environnement(), d = deposer(g), toutes = [];
  for (let l = 0; l < 4; l++) for (let c = 0; c < 4; c++) toutes.push([c, l]);
  const r = images(g, 'thomas27', { quoi: 'tuiles', niveau: 0, tuiles: toutes });
  const total = r.data.images.reduce((s, i) => s + Buffer.from(i.b64, 'base64').length, 0);
  assert.ok(total <= 300 * 1024 && r.data.images.length >= 1 && r.data.reste.length === 16 - r.data.images.length && r.data.reste.length > 0, r.data.images.length + ' images, ' + total + ' octets');
  const suite = images(g, 'thomas27', { quoi: 'tuiles', niveau: 0, tuiles: r.data.reste });
  suite.data.images.forEach(i => assert.strictEqual(i.b64, b64(d.tuiles[i.c + ',' + i.l])));
  const masse = images(g, 'thomas27', { quoi: 'tuiles', niveau: 0, tuiles: toutes, masse: true });
  assert.deepStrictEqual([masse.data.images.length, masse.data.reste.length], [16, 0]);
});
test('une tuile seule plus grosse que le plafond est quand même rendue', () => {
  const g = environnement(); deposer(g, { ko: 400 });
  const r = images(g, 'thomas27', { quoi: 'tuiles', niveau: 0, tuiles: [[0, 0], [1, 0]] });
  assert.deepStrictEqual([r.data.images.length, r.data.reste.length], [1, 1]);
});
test('droits sur les images : poseur hors chantier refusé ; document, page ou niveau inconnus : « rouvrez la liste »', () => {
  const g = environnement(); deposer(g);
  assert.strictEqual(images(g, 'kevin', { quoi: 'leger' }).code, 'INTERDIT');
  assert.strictEqual(images(g, 'thomas27', { quoi: 'leger', doc: '999-X' }).code, 'CARNET_INCONNU');
  assert.strictEqual(images(g, 'thomas27', { quoi: 'leger', page: 7 }).code, 'CARNET_INCONNU');
  assert.strictEqual(images(g, 'thomas27', { quoi: 'tuiles', niveau: 5, tuiles: [[0, 0]] }).code, 'CARNET_INCONNU');
  assert.strictEqual(images(g, 'thomas27', { quoi: 'n’importe quoi' }).code, 'CARNET_INCONNU');
  const inconnue = images(g, 'thomas27', { quoi: 'tuiles', niveau: 0, tuiles: [[9, 9], 'x', [0, 0]] });
  assert.deepStrictEqual(inconnue.data.images.map(i => i.c + ',' + i.l), ['0,0'], 'tuiles inconnues ignorées');
});
test('paquet pas encore arrivé, de mauvaise taille ou à la corbeille : « en cours d’arrivée », jamais un contenu faux', () => {
  const g = environnement(), d = deposer(g);
  const paquet = d.dossier.enfants.filter(e => e.nom === 'p1-z0-0.pak')[0];
  const entier = paquet.contenu;
  paquet.contenu = entier.slice(0, 1000);
  assert.strictEqual(images(g, 'thomas27', { quoi: 'tuiles', niveau: 0, tuiles: [[0, 0]] }).code, 'CARNET_ARRIVE');
  paquet.contenu = entier;
  assert.strictEqual(images(g, 'thomas27', { quoi: 'tuiles', niveau: 0, tuiles: [[0, 0]] }).ok, true);
  paquet.corbeille = true;   // l'identifiant est en cache : un fichier à la corbeille ne doit plus être servi
  assert.strictEqual(images(g, 'thomas27', { quoi: 'tuiles', niveau: 0, tuiles: [[0, 0]] }).code, 'CARNET_ARRIVE');
});
test('un nom de fichier qui serait un chemin, écrit dans la liste, n’est jamais suivi', () => {
  const g = environnement(), d = deposer(g);
  d.liste.documents[0].pages[0].leger.f = '../carnet.json';
  d.fichier.contenu = JSON.stringify(d.liste); viderCache(g);
  assert.strictEqual(images(g, 'thomas27', { quoi: 'leger' }).code, 'CARNET_ARRIVE');
});
test('le serveur n’écrit et ne supprime rien dans le carnet', () => {
  const g = environnement(), d = deposer(g);
  lister(g, 'thomas27');   // la toute première demande crée dossiers.json à la racine (lot 1) : hors du carnet
  const avant = Object.keys(g.elements).length, dansCarnet = d.carnet.enfants.length + d.dossier.enfants.length;
  lister(g, 'thomas27'); viderCache(g); images(g, 'thomas27', { quoi: 'net' }); images(g, 'thomas27', { quoi: 'tuiles', niveau: 0, tuiles: [[3, 3]] });
  assert.strictEqual(Object.keys(g.elements).length, avant);
  assert.ok(Object.values(g.elements).every(e => !e.corbeille));
  assert.strictEqual(d.carnet.enfants.length + d.dossier.enfants.length, dansCarnet);
});

test('une liste plus grosse qu’une valeur du cache est gardée par morceaux, et relue à l’identique', () => {
  const g = environnement(), gros = [];
  for (let i = 0; i < 40; i++) gros.push({ id: 'X' + i + '-A', code: 'X' + i, indice: 'A', intitule: 'é'.repeat(2500), dossier: 'X' + i, pages: [{ l: 10, h: 10 }] });
  deposer(g, { autres: gros });
  const a = lister(g, 'thomas27');
  const morceaux = Object.keys(g.cache).filter(k => /^carnet:liste:1:.*:[0-9]+$/.test(k));
  assert.ok(a.ok && a.data.documents.length === 41 && morceaux.length > 1, morceaux.length + ' morceau(x)');
  const b = lister(g, 'thomas27');
  assert.deepStrictEqual(b.data.documents, a.data.documents);
});

console.log('\n' + reussis + ' test(s) réussi(s)' + (process.exitCode ? ' — DES TESTS ÉCHOUENT' : ''));
