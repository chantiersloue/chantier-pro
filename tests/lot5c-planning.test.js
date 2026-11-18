// Tests du lot 5c (planning lisible par les seuls comptes de l'appli) : node tests/lot5c-planning.test.js
// Le serveur ne met plus aucun fichier du planning en partage par lien, remet en privé ceux qui le sont,
// et n'envoie un fichier du dossier Planning qu'à un compte connecté et actif.
'use strict';
const assert = require('assert');
const { creerGoogle, chargerScript } = require('./gas-harness');

function environnement() {
  const google = creerGoogle({
    proprietes: { DRIVE_ROOT_ID: 'RACINE', DRIVE_PLANNING_ID: 'PLANNING', HACHAGE_ITERATIONS: '200' },
    feuilles: {
      'Contacts': [['Nom', 'Role', 'Email', 'ChefEquipe', 'Destinataire', 'ConducteurDefaut', 'ChefAtelier', 'absenceNotif'],
        ['Franck PAVAGEAU', 'Conducteur de travaux', 'franck@loue.test', 'O', 'N', 'O', 'N', 'O']],
      'Contacts notes': [['Nom', 'Email']],
      'Chantiers': [['Nom', 'Référence', 'Statut', 'Conducteur'], ['CHANTIER TEST 1', 'LIEU 1', 'En cours', 'Franck PAVAGEAU']],
    },
  });
  google.racine = google.creerElement('dossier', 'Loué Menuiserie - Chantiers', null, { id: 'RACINE' });
  google.planning = google.creerElement('dossier', 'Planning', null, { id: 'PLANNING' });
  google.ctx = chargerScript(google);
  google.t = Date.now();
  google.ctx.maintenant_ = () => google.t;
  google.ctx.genererCle();
  google.ctx.preparerOngletsLot2();
  const u = google.feuilles['Utilisateurs'];
  u.lignes[1] = ['thomas27', 'Thomas', 'Poseur', true, false, '', '', false, false, ''];
  u.lignes[2] = ['franck', 'Franck PAVAGEAU', 'Admin', true, false, '', '', false, false, ''];
  google.ctx.traiterComptes();
  return google;
}
const poster = (g, corps) => JSON.parse(g.ctx.doPost({ postData: { contents: JSON.stringify(corps) } }).contenu);
const ligneU = (g, id) => g.feuilles['Utilisateurs'].lignes.find(l => l[0] === id);
function activer(g, id) {
  ligneU(g, id)[4] = true;
  g.ctx.traiterComptes();
  const prov = ligneU(g, id)[5];
  assert.strictEqual(poster(g, { action: 'connexion', identifiant: id, motDePasse: prov }).code, 'NOUVEAU_MDP');
  const r = poster(g, { action: 'motDePasse', identifiant: id, ancien: prov, nouveau: 'BonMotDePasse9' });
  assert.strictEqual(r.code, 'CONNECTE', JSON.stringify(r));
  return r.data.jeton;
}
// Un vrai PDF n'est pas nécessaire : des octets quelconques, y compris au-delà de 127 (octets signés chez Google)
const OCTETS = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0xe9, 0xff, 0x00, 0x80, 0x0a]);
function deposer(g, nom, options) {
  const f = g.creerElement('fichier', nom, (options && options.dans) || g.planning, { contenu: OCTETS, mime: (options && options.mime) || 'application/pdf' });
  if (options && options.acces) { f.acces = options.acces; f.permission = 'VIEW'; }
  return f;
}

let reussis = 0, echecs = 0;
function test(nom, fn) {
  try { fn(); reussis++; console.log('  ✓ ' + nom); }
  catch (e) { echecs++; console.log('  ✗ ' + nom + '\n    ' + String(e && e.message).split('\n').join('\n    ')); }
}

console.log('Lot 5c — le planning, réservé aux comptes de l’appli');

test('liste du planning avec un compte : nom, sorte, date, taille, numéro ; AUCUN lien ; les fichiers partagés sont remis en privé', () => {
  const g = environnement();
  const jeton = activer(g, 'thomas27');
  const s45 = deposer(g, 'S45.pdf', { acces: 'ANYONE_WITH_LINK' }); s45.maj = new Date(2026, 10, 2).getTime();
  const s46 = deposer(g, 'S46.xlsx', { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', acces: 'ANYONE' }); s46.maj = new Date(2026, 10, 9).getTime();
  const prive = deposer(g, 'S47.pdf'); prive.maj = new Date(2026, 10, 16).getTime();
  const r = poster(g, { action: 'dossiers', chantier: '__PLANNING__', jeton: jeton });
  assert.strictEqual(r.ok, true, JSON.stringify(r));
  const docs = r.data.dossiers.planning;
  assert.deepStrictEqual(docs.map(d => [d.nom, d.type, d.date]), [['S47.pdf', 'pdf', '16/11/2026'], ['S46.xlsx', 'xls', '09/11/2026'], ['S45.pdf', 'pdf', '02/11/2026']]);
  assert.ok(docs.every(d => !('url' in d) && typeof d.id === 'string' && d.id && d.taille === OCTETS.length), JSON.stringify(docs));
  assert.deepStrictEqual([s45.acces, s46.acces, prive.acces], ['PRIVATE', 'PRIVATE', 'PRIVATE']);
  assert.ok(!/drive\.google\.com/.test(JSON.stringify(r)), 'aucune adresse Drive dans la réponse');
});

test('un fichier du planning est envoyé à un compte connecté, octets intacts', () => {
  const g = environnement();
  const jeton = activer(g, 'thomas27');
  const f = deposer(g, 'S46.pdf');
  const r = poster(g, { action: 'planningFichier', id: f.api.getId(), jeton: jeton });
  assert.strictEqual(r.ok, true, JSON.stringify(r).slice(0, 300));
  assert.deepStrictEqual([r.data.nom, r.data.mime], ['S46.pdf', 'application/pdf']);
  assert.ok(Buffer.from(r.data.b64, 'base64').equals(OCTETS), 'les octets sont ceux du fichier');
  assert.strictEqual(f.acces, 'PRIVATE', 'le fichier reste privé');
});

test('sans compte : refusé (même pendant la période sans compte), rien n’est envoyé', () => {
  const g = environnement();
  const f = deposer(g, 'S46.pdf');
  const r = poster(g, { action: 'planningFichier', id: f.api.getId() });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'CONNEXION_REQUISE', JSON.stringify(r));
  assert.ok(!('data' in r) || !r.data || !r.data.b64);
  const faux = poster(g, { action: 'planningFichier', id: f.api.getId(), jeton: 'jeton.invente.ici' });
  assert.ok(!faux.ok && !(faux.data && faux.data.b64), JSON.stringify(faux));
});

test('compte désactivé : refusé', () => {
  const g = environnement();
  const jeton = activer(g, 'thomas27');
  const f = deposer(g, 'S46.pdf');
  ligneU(g, 'thomas27')[3] = false;
  g.ctx.traiterComptes();
  const r = poster(g, { action: 'planningFichier', id: f.api.getId(), jeton: jeton });
  assert.ok(!r.ok && !(r.data && r.data.b64), JSON.stringify(r));
});

test('un fichier HORS du dossier Planning (autre dossier, sous-dossier, inconnu, à la corbeille) : refusé', () => {
  const g = environnement();
  const jeton = activer(g, 'thomas27');
  const ailleurs = deposer(g, 'secret.pdf', { dans: g.racine });
  const sous = g.creerElement('dossier', 'Archives', g.planning);
  const dansSous = deposer(g, 'S30.pdf', { dans: sous });
  const jete = deposer(g, 'S44.pdf'); jete.corbeille = true;
  [ailleurs.api.getId(), dansSous.api.getId(), 'inconnu123456', jete.api.getId()].forEach(id => {
    const r = poster(g, { action: 'planningFichier', id: id, jeton: jeton });
    assert.deepStrictEqual([r.ok, r.code], [false, 'INTROUVABLE'], id + ' : ' + JSON.stringify(r).slice(0, 200));
  });
  ['', '../RACINE', 'a b', '<x>', 'x'.repeat(101)].forEach(id => {
    const r = poster(g, { action: 'planningFichier', id: id, jeton: jeton });
    assert.deepStrictEqual([r.ok, r.code], [false, 'DONNEES_INVALIDES'], JSON.stringify(id));
  });
  const liste = poster(g, { action: 'dossiers', chantier: '__PLANNING__', jeton: jeton }).data.dossiers.planning;
  assert.deepStrictEqual(liste.map(d => d.nom), [], 'ni le sous-dossier, ni le fichier à la corbeille dans la liste');
});

test('plus de 10 Mo : refusé avec un message clair', () => {
  const g = environnement();
  const jeton = activer(g, 'thomas27');
  const f = deposer(g, 'Gros.pdf'); f.taille = 10 * 1024 * 1024 + 1;
  const r = poster(g, { action: 'planningFichier', id: f.api.getId(), jeton: jeton });
  assert.deepStrictEqual([r.ok, r.code], [false, 'TROP_GROS'], JSON.stringify(r));
  assert.ok(/10 Mo/.test(r.message));
});

test('dossier Planning introuvable : réponse claire, pas d’erreur du serveur', () => {
  const g = environnement();
  const jeton = activer(g, 'thomas27');
  g.ctx.drivePlanningId_ = () => 'ABSENT';
  const r = poster(g, { action: 'planningFichier', id: 'quelconque12', jeton: jeton });
  assert.deepStrictEqual([r.ok, r.code], [false, 'INDISPONIBLE'], JSON.stringify(r));
});

test('le DOSSIER Planning partagé par lien (ses fichiers en héritent) : remis en privé à la lecture', () => {
  const g = environnement();
  const jeton = activer(g, 'thomas27');
  g.planning.acces = 'ANYONE_WITH_LINK'; g.planning.permission = 'VIEW';
  deposer(g, 'S46.pdf');
  poster(g, { action: 'dossiers', chantier: '__PLANNING__', jeton: jeton });
  assert.strictEqual(g.planning.acces, 'PRIVATE');
});

test('aucun autre fichier du Drive n’est partagé ni rendu privé par la lecture du planning', () => {
  const g = environnement();
  const jeton = activer(g, 'thomas27');
  const autre = deposer(g, 'partage-volontaire.pdf', { dans: g.racine, acces: 'ANYONE_WITH_LINK' });
  poster(g, { action: 'dossiers', chantier: '__PLANNING__', jeton: jeton });
  assert.strictEqual(autre.acces, 'ANYONE_WITH_LINK', 'hors du planning : on n’y touche pas');
});

console.log(reussis + ' test(s) réussi(s)' + (echecs ? ' — DES TESTS ÉCHOUENT' : ''));
if (echecs) process.exit(1);
