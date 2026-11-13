// Tests du lot 3, côté serveur (notes de chantier : la liste des choses à faire, façon Keep) : node tests/lot3-notes.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { creerGoogle, chargerScript } = require('./gas-harness');

function environnement(options = {}) {
  const g = creerGoogle({
    nomSheet: options.test ? 'ChantierPro TEST' : 'ChantierPro',
    proprietes: Object.assign({ DRIVE_ROOT_ID: 'RACINE', DRIVE_PLANNING_ID: 'PLANNING', HACHAGE_ITERATIONS: '200' }, options.test ? { ENVIRONNEMENT: 'TEST' } : {}),
    feuilles: {
      'Contacts': [['Nom', 'Role', 'Email', 'ChefEquipe', 'Destinataire', 'ConducteurDefaut', 'ChefAtelier', 'absenceNotif'],
        ['Franck PAVAGEAU', 'Conducteur de travaux', 'franck@loue.test', 'O', 'N', 'O', 'N', 'O'],
        ['Sébastien', 'Conducteur de travaux', 'seb@loue.test', 'O', 'N', 'N', 'N', 'N']],
      'Contacts notes': [['Nom', 'Email']],
      'Chantiers': [['Nom', 'Référence', 'Statut', 'Conducteur'],
        ['CHANTIER TEST 1', 'LIEU 1', 'En cours', 'Sébastien'],
        ['CHANTIER TEST 2', 'LIEU 2', 'En cours', 'Franck PAVAGEAU'],
        ['CHANTIER FINI', 'LIEU 3', 'Terminé', 'Sébastien']],
    },
  });
  g.creerElement('dossier', 'Loué Menuiserie - Chantiers', null, { id: 'RACINE' });
  g.creerElement('dossier', 'Planning', null, { id: 'PLANNING' });
  g.ctx = chargerScript(g);
  g.ctx.genererCle(); g.ctx.preparerOngletsLot2();
  const u = g.feuilles['Utilisateurs'];
  u.lignes[1] = ['thomas27', 'Thomas', 'Poseur', true, false, '', '', false, false, ''];
  u.lignes[2] = ['seb', 'Sébastien', 'Conducteur', true, false, '', '', false, false, ''];
  u.lignes[3] = ['franck', 'Franck PAVAGEAU', 'Admin', true, false, '', '', false, false, ''];
  u.lignes[4] = ['atelier1', 'Marc', 'Atelier', true, false, '', '', false, false, ''];
  u.lignes[5] = ['kevin', 'Kévin', 'Poseur', true, false, '', '', false, false, ''];
  u.lignes[6] = ['partout', 'Paul', 'Poseur', true, false, '', '', false, true, ''];   // poseur avec la case « Tous les chantiers »
  u.lignes[7] = ['lucas', 'Lucas', 'Poseur', true, false, '', '', false, false, ''];
  g.ctx.traiterComptes();
  // Accès : thomas27, lucas et atelier1 sur CHANTIER TEST 1 ; thomas27 aussi sur CHANTIER FINI ; kevin sur rien
  const a = g.feuilles['Accès chantiers'];
  const cocher = (id, chantier) => { const col = a.lignes[0].indexOf(id); assert.ok(col > 1, 'colonne ' + id); a.lignes.forEach(l => { if (l[0] === chantier) l[col] = true; }); };
  cocher('thomas27', 'CHANTIER TEST 1'); cocher('lucas', 'CHANTIER TEST 1'); cocher('atelier1', 'CHANTIER TEST 1'); cocher('thomas27', 'CHANTIER FINI');
  if (!options.sansInstallation) (options.test ? g.ctx.installerLot3Test : g.ctx.installerLot3Production)();
  return g;
}
const poster = (g, corps) => JSON.parse(g.ctx.doPost({ postData: { contents: JSON.stringify(corps) } }).contenu);
const jeton = (g, id) => g.ctx.fabriquerJeton_(id, 1);
const N = g => (g.feuilles['Notes'] ? g.feuilles['Notes'].lignes.slice(1).filter(l => l[0]) : []);
const H = g => (g.feuilles['Notes historique'] ? g.feuilles['Notes historique'].lignes.slice(1).filter(l => l[1]) : []);
const V = g => (g.feuilles['Notes vues'] ? g.feuilles['Notes vues'].lignes.slice(1).filter(l => l[0]) : []);
const E = g => (g.feuilles['Envois'] ? g.feuilles['Envois'].lignes.slice(1) : []);
const estDate = v => Object.prototype.toString.call(v) === '[object Date]';
// Une date fabriquée ici doit être du même « monde » JavaScript que celles du faux Apps Script (sinon le serveur ne la reconnaît pas)
const dateServeur = (modele, ms) => new modele.constructor(ms);
let numero = 0;
const idFiche = () => 'fiche-lot3-' + String(++numero).padStart(6, '0');
const element = extra => Object.assign({ type: 'note-chantier', chantier: 'CHANTIER TEST 1', texte: 'Penser aux cales de 5' }, extra || {});
const geste = (idNote, g2, extra) => Object.assign({ type: 'note-action', chantier: 'CHANTIER TEST 1', note: idNote, geste: g2 }, extra || {});
// envoi d'une fiche par « qui » (le téléphone déclare la même personne, comme le fait la file d'attente)
const envoyer = (g, qui, donnees, id, saisiPar) => poster(g, Object.assign({ action: 'fiche', id: id || idFiche(), donnees: donnees, saisiPar: saisiPar === undefined ? qui : saisiPar },
  qui ? { jeton: jeton(g, qui) } : {}));
const creer = (g, qui, extra) => { const id = idFiche(); const r = envoyer(g, qui, element(extra), id); assert.ok(r.ok, JSON.stringify(r)); return id; };
const lire = (g, qui, extra) => poster(g, Object.assign({ action: 'notes', jeton: jeton(g, qui) }, extra || {}));
const C = { id: 0, chantier: 1, texte: 2, fait: 3, cree: 4, creePar: 5, texteLe: 6, texteParId: 7, cocheLe: 8, cochePar: 9 };
const HC = { le: 0, id: 1, chantier: 2, geste: 3, ancien: 4, nouveau: 5, par: 6, parId: 7 };

let reussis = 0;
function test(nom, fn) {
  try { fn(); reussis++; console.log('  ✓ ' + nom); }
  catch (e) { console.log('  ✗ ' + nom + '\n    ' + String(e.stack || e.message).split('\n').slice(0, 5).join('\n    ')); process.exitCode = 1; }
}

console.log('Lot 3 — ajouter un élément');
test('un élément : une ligne dans Notes, une ligne « création » dans l’historique, aucun mail, Envois « traité »', () => {
  const g = environnement(), id = idFiche();
  const r = envoyer(g, 'thomas27', element(), id);
  assert.deepStrictEqual([r.ok, r.code, r.message, r.data.envoyes, Object.keys(r.data).join()], [true, 'ENREGISTRE', 'Enregistré', undefined, 'id'], JSON.stringify(r));
  const l = N(g);
  assert.strictEqual(l.length, 1);
  assert.deepStrictEqual([l[0][C.id], l[0][C.chantier], l[0][C.texte], l[0][C.fait], l[0][C.creePar], l[0][C.texteParId], l[0][C.cocheLe], l[0][C.cochePar]],
    [id, 'CHANTIER TEST 1', 'Penser aux cales de 5', '', 'Thomas (thomas27)', 'thomas27', '', '']);
  assert.ok(estDate(l[0][C.cree]) && estDate(l[0][C.texteLe]));
  assert.strictEqual(l[0].length, 10, 'dix colonnes, pas une de plus');
  const h = H(g);
  assert.deepStrictEqual(h.map(x => [x[HC.id], x[HC.chantier], x[HC.geste], x[HC.ancien], x[HC.nouveau], x[HC.par], x[HC.parId], estDate(x[HC.le])]),
    [[id, 'CHANTIER TEST 1', 'création', '', 'Penser aux cales de 5', 'Thomas', 'thomas27', true]]);
  assert.strictEqual(g.mails.length, 0, 'aucun mail');
  assert.deepStrictEqual([E(g)[0][4], E(g)[0][5]], ['traité', 'note de chantier (aucun mail)']);
});
test('le même élément renvoyé (réponse perdue) : « déjà reçu », une seule ligne ; même si la case du chantier a été décochée entre-temps', () => {
  const g = environnement(), id = idFiche();
  assert.ok(envoyer(g, 'thomas27', element(), id).ok);
  const a = g.feuilles['Accès chantiers'], col = a.lignes[0].indexOf('thomas27');
  a.lignes.forEach(l => { if (l[0] === 'CHANTIER TEST 1') l[col] = false; });
  const r = envoyer(g, 'thomas27', element(), id);
  assert.deepStrictEqual([r.ok, r.code], [true, 'DEJA_RECU'], JSON.stringify(r));
  assert.deepStrictEqual([N(g).length, H(g).length], [1, 1]);
});
test('le nom du chantier est celui de l’onglet Chantiers ; un texte sur plusieurs lignes devient une seule ligne (jamais un refus)', () => {
  const g = environnement();
  creer(g, 'thomas27', { chantier: '  chantier test 1 ', texte: 'ligne 1\nligne 2\tsuite\r\nfin' });
  assert.deepStrictEqual([N(g)[0][C.chantier], N(g)[0][C.texte]], ['CHANTIER TEST 1', 'ligne 1 ligne 2 suite fin']);
});
test('un reste de la première version (champs photos, date, heure) dans la fiche est ignoré : l’élément est enregistré', () => {
  const g = environnement();
  const r = envoyer(g, 'thomas27', element({ photos: [], date: '12/11/2026', heure: '14h05' }));
  assert.ok(r.ok, JSON.stringify(r));
  assert.strictEqual(N(g)[0].length, 10);
});
test('données invalides : refus définitif, rien d’écrit, pas de ligne dans Envois, pas de mail d’alerte', () => {
  const g = environnement();
  const NUL = String.fromCharCode(0);
  [{ texte: '' }, { texte: '   ' }, { texte: '\n\n' }, { texte: 'x'.repeat(2001) }, { texte: 12 }, { texte: 'a' + NUL + 'b' }, { chantier: '' },
    { chantier: 'CHANTIER' + String.fromCharCode(9) + 'TEST 1' }].forEach(extra => {
    const r = envoyer(g, 'thomas27', element(extra));
    assert.deepStrictEqual([r.ok, r.code], [false, 'DONNEES_INVALIDES'], JSON.stringify(extra) + ' → ' + JSON.stringify(r));
  });
  assert.deepStrictEqual([N(g).length, H(g).length, E(g).length, g.mails.length], [0, 0, 0, 0]);
});
test('un texte de 2 000 caractères passe ; un texte du genre formule est neutralisé dans le Sheet et revient tel quel à l’appli', () => {
  const g = environnement();
  creer(g, 'thomas27', { texte: 'x'.repeat(2000) });
  creer(g, 'thomas27', { texte: '=IMPORTDATA("http://x")' });
  assert.strictEqual(N(g)[0][C.texte].length, 2000);
  assert.strictEqual(N(g)[1][C.texte], "'=IMPORTDATA(\"http://x\")");
});

console.log('Lot 3 — qui peut écrire');
test('poseur sur un chantier qui n’est pas coché pour lui : refus définitif ; chantier inexistant : même réponse, pour tout le monde', () => {
  const g = environnement();
  const r1 = envoyer(g, 'kevin', element());
  const r2 = envoyer(g, 'thomas27', element({ chantier: 'CHANTIER TEST 2' }));
  const r3 = envoyer(g, 'seb', element({ chantier: 'CHANTIER INVENTE' }));
  const r4 = envoyer(g, 'partout', element({ chantier: 'CHANTIER INVENTE' }));
  [r1, r2, r3, r4].forEach(r => assert.deepStrictEqual([r.ok, r.code], [false, 'DONNEES_INVALIDES'], JSON.stringify(r)));
  assert.strictEqual(r1.message, r3.message, 'même message pour « interdit » et « inconnu »');
  assert.strictEqual(N(g).length, 0);
});
test('atelier sur un chantier coché, conducteur et admin partout, poseur « tous les chantiers » : acceptés', () => {
  const g = environnement();
  assert.ok(envoyer(g, 'atelier1', element()).ok);
  assert.ok(envoyer(g, 'seb', element({ chantier: 'CHANTIER TEST 2' })).ok);
  assert.ok(envoyer(g, 'franck', element()).ok);
  assert.ok(envoyer(g, 'partout', element({ chantier: 'CHANTIER TEST 2' })).ok);
  assert.strictEqual(N(g).length, 4);
});
test('sans compte (même pendant la transition) : l’élément attend la connexion, rien dans « Sans compte », rien d’écrit', () => {
  const g = environnement();
  const avant = (g.feuilles['Sans compte'] ? g.feuilles['Sans compte'].lignes.length : 0);
  const r = envoyer(g, null, element(), undefined, 'thomas27');
  assert.deepStrictEqual([r.ok, r.code], [false, 'CONNEXION_REQUISE'], JSON.stringify(r));
  const r2 = poster(g, { action: 'fiche', id: idFiche(), donnees: element(), jeton: 'jeton.faux', saisiPar: 'thomas27' });
  assert.deepStrictEqual([r2.ok, r2.code, r2.jetonInvalide], [false, 'CONNEXION_REQUISE', true], JSON.stringify(r2));
  assert.strictEqual(N(g).length, 0);
  assert.strictEqual(g.feuilles['Sans compte'] ? g.feuilles['Sans compte'].lignes.length : 0, avant);
});
test('compte désactivé : son élément en attente n’est pas accepté (une fiche ordinaire l’est encore)', () => {
  const g = environnement();
  g.feuilles['Utilisateurs'].lignes[1][3] = false;   // thomas27 décoché « Actif »
  const r = envoyer(g, 'thomas27', element());
  assert.deepStrictEqual([r.ok, r.code], [false, 'COMPTE_REFUSE'], JSON.stringify(r));
  assert.strictEqual(N(g).length, 0);
  const q = envoyer(g, 'thomas27', { type: 'quitus', chantier: 'CHANTIER TEST 1', date: '12/11/2026', destinataires: [] });
  assert.deepStrictEqual([q.ok, q.code], [true, 'ENREGISTRE'], 'la fiche ordinaire du même compte passe encore : ' + JSON.stringify(q));
});
test('téléphone partagé : ce qu’a écrit Thomas ne part pas sous le nom de Lucas connecté ensuite', () => {
  const g = environnement(), id = idFiche();
  const r = envoyer(g, 'lucas', element(), id, 'thomas27');
  assert.deepStrictEqual([r.ok, r.code], [false, 'COMPTE_REFUSE'], JSON.stringify(r));
  assert.ok(/thomas27/.test(r.message));
  assert.strictEqual(N(g).length, 0);
  assert.ok(envoyer(g, 'thomas27', element(), id, 'thomas27').ok, 'cela part quand Thomas se reconnecte');
  assert.strictEqual(N(g)[0][C.texteParId], 'thomas27');
  // déjà arrivé, renvoyé depuis le téléphone où Lucas est maintenant connecté : « déjà reçu », cela quitte la file
  assert.strictEqual(envoyer(g, 'lucas', element(), id, 'thomas27').code, 'DEJA_RECU');
});

console.log('Lot 3 — lire');
test('lecture d’un chantier : éléments à faire dans l’ordre d’ajout, sans auteur ni date ; terminés à part, avec leur nombre', () => {
  const g = environnement();
  const a = creer(g, 'thomas27', { texte: 'premier' }), b = creer(g, 'seb', { texte: 'second' }), c = creer(g, 'lucas', { texte: 'troisième' });
  assert.ok(envoyer(g, 'lucas', geste(b, 'fait')).ok);
  const r = lire(g, 'lucas', { chantier: 'chantier test 1' });
  assert.ok(r.ok, JSON.stringify(r));
  assert.deepStrictEqual(r.data.aFaire, [{ id: a, texte: 'premier', fait: false, nouveau: true }, { id: c, texte: 'troisième', fait: false, nouveau: false }]);
  assert.deepStrictEqual(r.data.termines, [{ id: b, texte: 'second', fait: true, nouveau: false }]);
  assert.deepStrictEqual([r.data.nbTermines, r.data.chantier, typeof r.data.heure, r.data.plein], [1, 'CHANTIER TEST 1', 'number', false]);
  assert.ok(!/Thomas|Sébastien|Lucas|thomas27|"seb"|2026/.test(JSON.stringify(r.data)), 'ni nom, ni identifiant, ni date dans la réponse');
});
test('Franck trie l’onglet : la liste reste dans l’ordre d’ajout, jamais dans celui des lignes ; les gestes retrouvent l’élément par son numéro', () => {
  const g = environnement();
  const a = creer(g, 'seb', { texte: 'ANCIEN' }), b = creer(g, 'seb', { texte: 'RECENT' });
  const f = g.feuilles['Notes'].lignes;
  f[1][C.cree] = dateServeur(f[1][C.cree], Date.now() - 60000);
  const x = f[1]; f[1] = f[2]; f[2] = x;          // onglet trié à l'envers
  assert.deepStrictEqual(lire(g, 'seb', { chantier: 'CHANTIER TEST 1' }).data.aFaire.map(n => n.id), [a, b]);
  assert.ok(envoyer(g, 'thomas27', geste(a, 'fait')).ok);
  assert.deepStrictEqual(N(g).map(l => [l[C.id], l[C.fait]]), [[b, ''], [a, 'Oui']]);
});
test('lecture refusée : chantier non coché, chantier inexistant (même réponse), sans compte ; vue « Tous chantiers » réservée aux conducteurs', () => {
  const g = environnement();
  creer(g, 'thomas27');
  const r1 = lire(g, 'kevin', { chantier: 'CHANTIER TEST 1' }), r2 = lire(g, 'kevin', { chantier: 'CHANTIER INVENTE' });
  assert.deepStrictEqual([r1.ok, r1.code, r1.message], [false, 'INTERDIT', r2.message]);
  assert.strictEqual(poster(g, { action: 'notes', chantier: 'CHANTIER TEST 1' }).code, 'CONNEXION_REQUISE');
  ['thomas27', 'partout', 'atelier1'].forEach(q => assert.strictEqual(lire(g, q).code, 'INTERDIT', q));
  ['seb', 'franck'].forEach(q => assert.strictEqual(lire(g, q).data.aFaire.length, 1, q));
});
test('vue « Tous chantiers » : chaque élément porte son chantier ; recherche, « nouveaux » et « avec les terminés » appliqués par le serveur', () => {
  const g = environnement();
  creer(g, 'thomas27', { texte: 'Commander des CALES' });
  creer(g, 'seb', { chantier: 'CHANTIER TEST 2', texte: 'Appeler le plaquiste' });
  const c = creer(g, 'lucas', { texte: 'Seuil à reprendre' });
  assert.ok(envoyer(g, 'lucas', geste(c, 'fait')).ok);
  const vue = extra => lire(g, 'franck', extra).data;
  assert.deepStrictEqual(vue().aFaire.map(n => [n.chantier, n.texte]), [['CHANTIER TEST 1', 'Commander des CALES'], ['CHANTIER TEST 2', 'Appeler le plaquiste']]);
  assert.deepStrictEqual([vue().termines.length, vue().nbTermines], [0, 0], 'sans demande, les terminés ne sont pas rendus');
  assert.deepStrictEqual(vue({ termines: true }).termines.map(n => n.texte), ['Seuil à reprendre']);
  assert.deepStrictEqual(vue({ recherche: 'cales' }).aFaire.map(n => n.texte), ['Commander des CALES']);
  assert.deepStrictEqual(vue({ recherche: 'test 2' }).aFaire.map(n => n.texte), ['Appeler le plaquiste'], 'la recherche porte aussi sur le nom du chantier');
  assert.deepStrictEqual(vue({ chantier: 'CHANTIER TEST 2' }).aFaire.map(n => n.texte), ['Appeler le plaquiste']);
  assert.deepStrictEqual(vue({ nouveau: true }).aFaire.length, 2);
  assert.deepStrictEqual(lire(g, 'seb', { nouveau: true }).data.aFaire.map(n => n.texte), ['Commander des CALES'], 'le sien n’est pas nouveau pour lui');
});
test('chantier « Terminé » : sa liste reste lisible par qui y a accès, sans chiffre rouge pour un poseur', () => {
  const g = environnement();
  creer(g, 'seb', { chantier: 'CHANTIER FINI' });
  assert.strictEqual(lire(g, 'thomas27', { chantier: 'CHANTIER FINI' }).data.aFaire.length, 1);
  const n = poster(g, { action: 'notesNouvelles', jeton: jeton(g, 'thomas27') });
  assert.deepStrictEqual([n.ok, n.data.total, n.data.parChantier['CHANTIER FINI']], [true, 0, undefined], JSON.stringify(n));
});
test('plus de 300 éléments à faire : les 300 derniers sont rendus, et la réponse le dit', () => {
  const g = environnement();
  creer(g, 'seb', { texte: 'élément 0' });
  const f = g.feuilles['Notes'].lignes, modele = f[1];
  for (let i = 1; i <= 305; i++) { const l = modele.slice(); l[C.id] = 'fiche-masse-' + String(i).padStart(6, '0'); l[C.texte] = 'élément ' + i; l[C.cree] = dateServeur(modele[C.cree], modele[C.cree].getTime() + i); f.push(l); }
  const d = lire(g, 'seb', { chantier: 'CHANTIER TEST 1' }).data;
  assert.deepStrictEqual([d.aFaire.length, d.plein, d.aFaire[0].texte, d.aFaire[299].texte], [300, true, 'élément 6', 'élément 305']);
});

console.log('Lot 3 — « nouveau » et visites');
test('lire ne marque rien ; « notesVues » envoyée après l’affichage efface les « nouveau » ; la visite suit la personne', () => {
  const g = environnement();
  creer(g, 'seb', { texte: 'un' }); creer(g, 'seb', { texte: 'deux' });
  const nouvelles = () => poster(g, { action: 'notesNouvelles', jeton: jeton(g, 'thomas27') }).data;
  assert.deepStrictEqual([nouvelles().total, nouvelles().parChantier['CHANTIER TEST 1']], [2, 2]);
  const liste = lire(g, 'thomas27', { chantier: 'CHANTIER TEST 1' });
  assert.strictEqual(V(g).length, 0, 'la lecture seule ne note pas la visite');
  assert.strictEqual(nouvelles().total, 2);
  const v = poster(g, { action: 'notesVues', chantier: 'CHANTIER TEST 1', jusqua: liste.data.heure, jeton: jeton(g, 'thomas27') });
  assert.ok(v.ok, JSON.stringify(v));
  assert.deepStrictEqual([V(g).length, V(g)[0][0], V(g)[0][1]], [1, 'thomas27', 'CHANTIER TEST 1']);
  assert.strictEqual(nouvelles().total, 0);
  assert.ok(lire(g, 'thomas27', { chantier: 'CHANTIER TEST 1' }).data.aFaire.every(n => !n.nouveau));
  // répété : toujours une seule ligne ; une heure du futur est ramenée à l'heure du serveur ; la visite ne recule pas
  poster(g, { action: 'notesVues', chantier: 'CHANTIER TEST 1', jusqua: Date.now() + 9e9, jeton: jeton(g, 'thomas27') });
  poster(g, { action: 'notesVues', chantier: 'CHANTIER TEST 1', jusqua: 1000, jeton: jeton(g, 'thomas27') });
  assert.strictEqual(V(g).length, 1);
  assert.ok(V(g)[0][2].getTime() <= Date.now() && V(g)[0][2].getTime() > Date.now() - 60000);
  // les autres ne sont pas touchés ; mon propre élément n'est jamais « nouveau » pour moi
  assert.strictEqual(poster(g, { action: 'notesNouvelles', jeton: jeton(g, 'lucas') }).data.total, 2);
  assert.strictEqual(poster(g, { action: 'notesNouvelles', jeton: jeton(g, 'seb') }).data.total, 0);
  assert.strictEqual(poster(g, { action: 'notesVues', chantier: 'CHANTIER TEST 1', jeton: jeton(g, 'kevin') }).code, 'INTERDIT');
});
test('un élément modifié par quelqu’un d’autre après ma visite redevient « nouveau » ; un élément coché ne l’est plus', () => {
  const g = environnement();
  const id = creer(g, 'thomas27');
  poster(g, { action: 'notesVues', chantier: 'CHANTIER TEST 1', jeton: jeton(g, 'lucas') });
  const nouvelles = q => poster(g, { action: 'notesNouvelles', jeton: jeton(g, q) }).data.total;
  assert.strictEqual(nouvelles('lucas'), 0);
  g.feuilles['Notes vues'].lignes[1][2] = dateServeur(g.feuilles['Notes vues'].lignes[1][2], Date.now() - 5000);   // la visite date de 5 secondes
  assert.ok(envoyer(g, 'seb', geste(id, 'modifier', { texte: 'Cales de 8' })).ok);
  assert.deepStrictEqual([nouvelles('lucas'), nouvelles('seb')], [1, 0]);
  assert.ok(envoyer(g, 'seb', geste(id, 'fait')).ok);
  assert.strictEqual(nouvelles('lucas'), 0, 'coché : plus rien à signaler');
});
test('« tout marquer comme lu » (vue Tous chantiers) : conducteurs et admin seulement, tous les chantiers d’un coup', () => {
  const g = environnement();
  creer(g, 'thomas27'); creer(g, 'franck', { chantier: 'CHANTIER TEST 2' });
  const nouvelles = () => poster(g, { action: 'notesNouvelles', jeton: jeton(g, 'seb') }).data.total;
  assert.strictEqual(nouvelles(), 2);
  assert.strictEqual(poster(g, { action: 'notesVues', tous: true, jeton: jeton(g, 'thomas27') }).code, 'INTERDIT');
  assert.strictEqual(poster(g, { action: 'notesVues', tous: true, jeton: jeton(g, 'partout') }).code, 'INTERDIT');
  assert.ok(poster(g, { action: 'notesVues', tous: true, jeton: jeton(g, 'seb') }).ok);
  assert.strictEqual(nouvelles(), 0);
  assert.deepStrictEqual(V(g).map(l => [l[0], l[1]]).sort(), [['seb', 'CHANTIER TEST 1'], ['seb', 'CHANTIER TEST 2']]);
  assert.ok(poster(g, { action: 'notesVues', tous: true, jeton: jeton(g, 'seb') }).ok);
  assert.strictEqual(V(g).length, 2, 'répété : pas de ligne en double');
});

console.log('Lot 3 — gestes : cocher, décocher, modifier');
test('cocher par n’importe qui sur le chantier, puis décocher ; répété, rien ne change ; l’historique dit qui et quand', () => {
  const g = environnement();
  const id = creer(g, 'thomas27');
  const r = envoyer(g, 'lucas', geste(id, 'fait'));
  assert.deepStrictEqual([r.ok, r.message], [true, 'Enregistré'], JSON.stringify(r));
  assert.deepStrictEqual([N(g)[0][C.fait], N(g)[0][C.cochePar], estDate(N(g)[0][C.cocheLe])], ['Oui', 'Lucas (lucas)', true]);
  const le = N(g)[0][C.cocheLe];
  assert.ok(envoyer(g, 'atelier1', geste(id, 'fait')).ok);
  assert.deepStrictEqual([N(g)[0][C.cochePar], N(g)[0][C.cocheLe]], ['Lucas (lucas)', le]);
  assert.ok(envoyer(g, 'thomas27', geste(id, 'defaire')).ok);
  assert.ok(envoyer(g, 'thomas27', geste(id, 'defaire')).ok);
  assert.deepStrictEqual([N(g)[0][C.fait], N(g)[0][C.cochePar], N(g)[0][C.cocheLe]], ['', '', '']);
  assert.deepStrictEqual(H(g).map(h => [h[HC.geste], h[HC.parId]]), [['création', 'thomas27'], ['coché', 'lucas'], ['décoché', 'thomas27']]);
  assert.strictEqual(envoyer(g, 'kevin', geste(id, 'fait')).code, 'DONNEES_INVALIDES');
});
test('modifier : toute personne qui a accès au chantier (pas seulement l’auteur) ; l’historique garde l’ancien et le nouveau texte', () => {
  const g = environnement();
  const id = creer(g, 'thomas27', { texte: 'v1' });
  assert.ok(envoyer(g, 'lucas', geste(id, 'modifier', { texte: 'v2', vu: 'v1' })).ok, 'un autre poseur du chantier');
  assert.ok(envoyer(g, 'atelier1', geste(id, 'modifier', { texte: 'v3\navec un retour', vu: 'v2' })).ok, 'l’atelier');
  assert.ok(envoyer(g, 'seb', geste(id, 'modifier', { texte: 'v4', vu: 'v3 avec un retour' })).ok, 'un conducteur');
  assert.strictEqual(envoyer(g, 'kevin', geste(id, 'modifier', { texte: 'pirate' })).code, 'DONNEES_INVALIDES', 'pas un poseur d’un autre chantier');
  assert.deepStrictEqual([N(g)[0][C.texte], N(g)[0][C.texteParId], N(g)[0][C.creePar]], ['v4', 'seb', 'Thomas (thomas27)']);
  assert.deepStrictEqual(H(g).slice(1).map(h => [h[HC.geste], h[HC.ancien], h[HC.nouveau], h[HC.par]]),
    [['modification', 'v1', 'v2', 'Lucas'], ['modification', 'v2', 'v3 avec un retour', 'Marc'], ['modification', 'v3 avec un retour', 'v4', 'Sébastien']]);
  const vide = envoyer(g, 'thomas27', geste(id, 'modifier', { texte: '  ' }));
  assert.deepStrictEqual([vide.code, N(g)[0][C.texte]], ['DONNEES_INVALIDES', 'v4'], 'un élément ne se vide pas (pas de suppression)');
  assert.ok(envoyer(g, 'thomas27', geste(id, 'modifier', { texte: 'v4' })).ok);
  assert.strictEqual(H(g).length, 4, 'même texte : rien de plus dans l’historique');
});
test('deux personnes modifient le même élément : la dernière reçue gagne, sans rien dans la réponse ; l’historique dit « en même temps »', () => {
  const g = environnement();
  const id = creer(g, 'thomas27', { texte: 'origine' });
  assert.ok(envoyer(g, 'seb', geste(id, 'modifier', { texte: 'version de Seb', vu: 'origine' })).ok);
  assert.ok(envoyer(g, 'thomas27', geste(id, 'modifier', { texte: 'version de Thomas', vu: 'origine' })).ok);   // écrite hors réseau, arrive après
  assert.strictEqual(N(g)[0][C.texte], 'version de Thomas');
  assert.deepStrictEqual(H(g).slice(1).map(h => [h[HC.geste], h[HC.ancien], h[HC.nouveau]]),
    [['modification', 'origine', 'version de Seb'], ['modification en même temps', 'version de Seb', 'version de Thomas']]);
  const lu = lire(g, 'lucas', { chantier: 'CHANTIER TEST 1' }).data.aFaire[0];
  assert.deepStrictEqual(Object.keys(lu).sort(), ['fait', 'id', 'nouveau', 'texte'], 'aucune mention de conflit à l’écran');
  // la même personne, deux fois hors réseau sur le même texte vu : pas « en même temps »
  assert.ok(envoyer(g, 'thomas27', geste(id, 'modifier', { texte: 'Thomas encore', vu: 'origine' })).ok);
  assert.strictEqual(H(g)[3][HC.geste], 'modification');
});
test('geste invalide, geste de la première version, élément inconnu : refus définitif, même message que « pas le droit »', () => {
  const g = environnement();
  const id = creer(g, 'thomas27');
  const inconnu = envoyer(g, 'thomas27', geste('fiche-lot3-inconnue1', 'fait'));
  const interdit = envoyer(g, 'kevin', geste(id, 'fait'));
  assert.deepStrictEqual([inconnu.code, inconnu.message], ['DONNEES_INVALIDES', interdit.message]);
  [{ geste: 'supprimer' }, { geste: 'restaurer' }, { geste: 'effacer' }, { note: 'x' }, { note: 12 }].forEach(extra =>
    assert.strictEqual(envoyer(g, 'seb', Object.assign(geste(id, 'modifier', { texte: 'ok' }), extra)).code, 'DONNEES_INVALIDES', JSON.stringify(extra)));
  assert.deepStrictEqual([N(g).length, N(g)[0][C.texte]], [1, 'Penser aux cales de 5'], 'rien n’est jamais supprimé');
});
test('serveur occupé pendant un geste : le téléphone réessaiera, et Franck ne reçoit PAS le mail « fiche non traitée »', () => {
  const g = environnement();
  const id = creer(g, 'thomas27'), idGeste = idFiche();
  // le contrôle d'entrée passe, puis le verrou est pris par quelqu'un d'autre au moment d'écrire
  const service = g.contexte.LockService.getScriptLock;
  let n = 0;
  g.contexte.LockService.getScriptLock = () => { const v = service(); n++; return n === 2 ? Object.assign({}, v, { tryLock: () => false, releaseLock: () => {} }) : v; };
  const r = envoyer(g, 'lucas', geste(id, 'fait'), idGeste);
  g.contexte.LockService.getScriptLock = service;
  assert.deepStrictEqual([r.ok, r.code], [false, 'SERVEUR_OCCUPE'], JSON.stringify(r));
  assert.strictEqual(g.mails.length, 0, 'aucune alerte');
  assert.strictEqual(N(g)[0][C.fait], '');
  assert.ok(envoyer(g, 'lucas', geste(id, 'fait'), idGeste).ok, 'le nouvel essai passe');
  assert.strictEqual(N(g)[0][C.fait], 'Oui');
});
test('éléments terminés : les derniers cochés en haut, le vrai nombre même au-delà de 300 ; un élément décoché reprend sa place', () => {
  const g = environnement();
  const a = creer(g, 'seb', { texte: 'A' }), b = creer(g, 'seb', { texte: 'B' }), c = creer(g, 'seb', { texte: 'C' });
  assert.ok(envoyer(g, 'seb', geste(b, 'fait')).ok);
  assert.ok(envoyer(g, 'seb', geste(a, 'fait')).ok);
  const f = g.feuilles['Notes'].lignes;
  const lb = f.find(l => l[C.id] === b); lb[C.cocheLe] = dateServeur(lb[C.cocheLe], Date.now() - 60000);   // B coché une minute avant A
  let d = lire(g, 'thomas27', { chantier: 'CHANTIER TEST 1' }).data;
  assert.deepStrictEqual([d.aFaire.map(n => n.texte), d.termines.map(n => n.texte), d.nbTermines], [['C'], ['A', 'B'], 2]);
  assert.ok(envoyer(g, 'thomas27', geste(a, 'defaire')).ok);
  d = lire(g, 'thomas27', { chantier: 'CHANTIER TEST 1' }).data;
  assert.deepStrictEqual([d.aFaire.map(n => n.texte), d.termines.map(n => n.texte)], [['A', 'C'], ['B']]);
  const modele = f.find(l => l[C.id] === b);
  for (let i = 1; i <= 305; i++) { const l = modele.slice(); l[C.id] = 'fiche-masse-' + String(i).padStart(6, '0'); l[C.cocheLe] = dateServeur(modele[C.cocheLe], modele[C.cocheLe].getTime() + i); f.push(l); }
  d = lire(g, 'thomas27', { chantier: 'CHANTIER TEST 1' }).data;
  assert.deepStrictEqual([d.termines.length, d.nbTermines], [300, 306]);
  void c;
});

console.log('Lot 3 — onglets, installation, livraison');
test('un onglet « Notes » aux autres titres (première version, restée sur la copie TEST) n’est ni lu ni écrit : le téléphone réessaiera', () => {
  const g = environnement({ sansInstallation: true });
  g.ctx.SpreadsheetApp.getActiveSpreadsheet().insertSheet('Notes').appendRow(['Numéro', 'Chantier', 'Auteur (identifiant)', 'Auteur', 'Créée le', 'Texte']);
  g.feuilles['Notes'].lignes.push(['fiche-ancienne-0001', 'CHANTIER TEST 1', 'thomas27', 'Thomas', new Date(), 'ancienne note']);
  const ecriture = envoyer(g, 'thomas27', element());
  const unGeste = envoyer(g, 'thomas27', geste('fiche-ancienne-0001', 'fait'));
  [ecriture, unGeste].forEach(x => assert.deepStrictEqual([x.ok, x.code, /titres changés/.test(x.message)], [false, 'SERVEUR_OCCUPE', true], 'même réponse pour un ajout et pour un geste : ' + JSON.stringify(x)));
  const lecture = lire(g, 'thomas27', { chantier: 'CHANTIER TEST 1' });
  assert.ok(!lecture.ok && /installation du lot 3/.test(lecture.message), JSON.stringify(lecture));
  assert.deepStrictEqual(g.feuilles['Notes'].lignes.length, 2, 'l’ancien onglet n’est pas touché');
  assert.strictEqual(g.mails.length, 1, 'Franck est prévenu, une seule fois dans la journée');
  assert.ok(/Notes.*bloquées/.test(g.mails[0].sujet) && /Rien n’est perdu/.test(g.mails[0].texte), JSON.stringify(g.mails[0]));
  assert.ok(/❌/.test(g.ctx.installerLot3Production()), 'l’installation le dit');
});
test('un titre de l’onglet « Notes historique » changé à la main : rien n’est écrit sans sa ligne d’historique (ni ajout, ni coche)', () => {
  const g = environnement();
  const id = creer(g, 'thomas27');
  g.feuilles['Notes historique'].lignes[0][3] = 'Geste ?';
  const ajout = envoyer(g, 'thomas27', element({ texte: 'second' })), coche = envoyer(g, 'lucas', geste(id, 'fait'));
  assert.deepStrictEqual([ajout.code, coche.code], ['SERVEUR_OCCUPE', 'SERVEUR_OCCUPE']);
  assert.deepStrictEqual([N(g).length, N(g)[0][C.fait], H(g).length], [1, '', 1], 'ni élément écrit, ni case cochée, sans historique');
  g.feuilles['Notes historique'].lignes[0][3] = 'Geste';
  assert.ok(envoyer(g, 'lucas', geste(id, 'fait')).ok);
  assert.deepStrictEqual([N(g)[0][C.fait], H(g).map(h => h[HC.geste])], ['Oui', ['création', 'coché']]);
});
test('installation : trois onglets créés ; relancée, elle ne change rien ; refuse le mauvais environnement', () => {
  const g = environnement({ sansInstallation: true });
  const t1 = g.ctx.installerLot3Production();
  assert.ok(/installation terminée/.test(t1), t1);
  ['Notes', 'Notes historique', 'Notes vues'].forEach(n => assert.ok(g.feuilles[n], n));
  assert.deepStrictEqual([g.feuilles['Notes'].lignes[0].length, g.feuilles['Notes historique'].lignes[0].length], [10, 8]);
  creer(g, 'thomas27');
  const t2 = g.ctx.installerLot3Production();
  assert.ok(/installation terminée/.test(t2) && !/créé/.test(t2), t2);
  assert.strictEqual(N(g).length, 1);
  assert.ok(!/installation terminée/.test(g.ctx.installerLot3Test()), 'refusée : pas l’environnement TEST');
  const gt = environnement({ sansInstallation: true, test: true });
  assert.ok(/installation terminée/.test(gt.ctx.installerLot3Test()));
});
test('sans installation : le premier élément crée les onglets tout seul', () => {
  const g = environnement({ sansInstallation: true });
  creer(g, 'thomas27');
  assert.deepStrictEqual([N(g).length, H(g).length, lire(g, 'thomas27', { chantier: 'CHANTIER TEST 1' }).data.aFaire.length], [1, 1, 1]);
});
test('les fiches existantes ne changent pas : un quitus sans compte passe toujours pendant la transition, avec son mail', () => {
  const g = environnement();
  const r = poster(g, { action: 'fiche', id: idFiche(), donnees: { type: 'quitus', chantier: 'CHANTIER TEST 1', date: '12/11/2026', destinataires: [] } });
  assert.deepStrictEqual([r.ok, r.code, r.data.note], [true, 'ENREGISTRE', undefined], JSON.stringify(r));
  assert.ok(r.data.envoyes >= 1);
});
test('ce qui a été retiré n’existe plus : actions photo, historique et PDF des notes inconnues ; aucun dossier Drive créé par une note', () => {
  const g = environnement();
  const id = creer(g, 'seb');
  ['notePhoto', 'noteHistorique', 'notesPdf'].forEach(a => assert.strictEqual(poster(g, { action: a, note: id, rang: 1, chantier: 'CHANTIER TEST 1', jeton: jeton(g, 'seb') }).code, 'ACTION_INCONNUE', a));
  assert.ok(!Object.values(g.elements).some(e => /NOTES|CHANTIER TEST 1/.test(e.nom)), 'rien dans Drive');
  const conf = g.ctx.dossiers_();
  assert.ok(!('notes-photos' in conf.documents) && !('notes-chantier' in conf.documents) && !('notes-chantier' in conf.intitules));
});
test('livraison : le serveur à coller contient le lot 3 simplifié, en version v8.0, sans les outils d’essai ni le code retiré', () => {
  const code = fs.readFileSync(path.join(__dirname, '..', 'A-COLLER-DANS-APPS-SCRIPT', 'Code.gs'), 'utf8');
  ['function traiterNoteChantier(', 'function traiterNoteAction(', 'function installerLot3Test(', 'function installerLot3Production(',
    "const VERSION_API = 'v8.0'", 'function traiterSignalement('].forEach(t => assert.ok(code.indexOf(t) > -1, t));
  ['function modele_notes_chantier(', 'function photoNote_(', 'function exporterNotes_(', 'function historiqueNote_(', 'notes-photos', 'function outilTestRangerNotes_('].forEach(t =>
    assert.ok(code.indexOf(t) < 0, 'ne doit plus y être : ' + t));
  assert.ok(!/function\s+outilTest_\s*\(/.test(code));
});
console.log('\n' + reussis + ' test(s) réussi(s)' + (process.exitCode ? ' — DES TESTS ÉCHOUENT' : ''));
