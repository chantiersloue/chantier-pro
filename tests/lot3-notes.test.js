// Tests du lot 3, côté serveur (notes de chantier) : node tests/lot3-notes.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { creerGoogle, chargerScript } = require('./gas-harness');

const PHOTO = '/9j/4AAQSkZJRg==';

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
const H = g => (g.feuilles['Notes historique'] ? g.feuilles['Notes historique'].lignes.slice(1).filter(l => l[0]) : []);
const V = g => (g.feuilles['Notes vues'] ? g.feuilles['Notes vues'].lignes.slice(1).filter(l => l[0]) : []);
const E = g => (g.feuilles['Envois'] ? g.feuilles['Envois'].lignes.slice(1) : []);
const estDate = v => Object.prototype.toString.call(v) === '[object Date]';
let numero = 0;
const idFiche = () => 'fiche-lot3-' + String(++numero).padStart(6, '0');
const note = extra => Object.assign({ type: 'note-chantier', chantier: 'CHANTIER TEST 1', date: '12/11/2026', heure: '14h05', texte: 'Penser aux cales de 5', photos: [] }, extra || {});
const geste = (idNote, g2, extra) => Object.assign({ type: 'note-action', chantier: 'CHANTIER TEST 1', note: idNote, geste: g2 }, extra || {});
// envoi d'une fiche par « qui » (le téléphone déclare la même personne, comme le fait la file d'attente)
const envoyer = (g, qui, donnees, id, saisiPar) => poster(g, Object.assign({ action: 'fiche', id: id || idFiche(), donnees: donnees, saisiPar: saisiPar === undefined ? qui : saisiPar },
  qui ? { jeton: jeton(g, qui) } : {}));
const creer = (g, qui, extra) => { const id = idFiche(); const r = envoyer(g, qui, note(extra), id); assert.ok(r.ok, JSON.stringify(r)); return id; };
const lire = (g, qui, extra) => poster(g, Object.assign({ action: 'notes', jeton: jeton(g, qui) }, extra || {}));
const C = { id: 0, chantier: 1, auteurId: 2, auteur: 3, cree: 4, texte: 5, photos: 6, fait: 7, faitPar: 8, faitLe: 9, modifPar: 10, modifLe: 11, supprPar: 12, supprLe: 13,
  version: 14, remarque: 15, saisi: 16, texteLe: 17, texteParId: 18 };

let reussis = 0;
function test(nom, fn) {
  try { fn(); reussis++; console.log('  ✓ ' + nom); }
  catch (e) { console.log('  ✗ ' + nom + '\n    ' + String(e.stack || e.message).split('\n').slice(0, 5).join('\n    ')); process.exitCode = 1; }
}

console.log('Lot 3 — écrire une note');
test('une note : une ligne dans Notes, aucun mail, réponse « Note enregistrée », Envois « traité »', () => {
  const g = environnement(), id = idFiche();
  const r = envoyer(g, 'thomas27', note(), id);
  assert.deepStrictEqual([r.ok, r.code, r.message, r.data.note, r.data.envoyes], [true, 'ENREGISTRE', 'Note enregistrée', true, undefined], JSON.stringify(r));
  const l = N(g);
  assert.strictEqual(l.length, 1);
  assert.deepStrictEqual([l[0][C.id], l[0][C.chantier], l[0][C.auteurId], l[0][C.auteur], l[0][C.texte], l[0][C.photos], l[0][C.fait], l[0][C.version], l[0][C.saisi], l[0][C.texteParId]],
    [id, 'CHANTIER TEST 1', 'thomas27', 'Thomas', 'Penser aux cales de 5', '', '', 1, '12/11/2026 14h05', 'thomas27']);
  assert.ok(estDate(l[0][C.cree]) && estDate(l[0][C.texteLe]));
  assert.strictEqual(g.mails.length, 0, 'aucun mail');
  assert.deepStrictEqual([E(g)[0][4], E(g)[0][5]], ['traité', 'note de chantier (aucun mail)']);
});
test('la même note renvoyée (réponse perdue) : « déjà reçu », une seule ligne ; même si la case du chantier a été décochée entre-temps', () => {
  const g = environnement(), id = idFiche();
  assert.ok(envoyer(g, 'thomas27', note(), id).ok);
  const a = g.feuilles['Accès chantiers'], col = a.lignes[0].indexOf('thomas27');
  a.lignes.forEach(l => { if (l[0] === 'CHANTIER TEST 1') l[col] = false; });
  const r = envoyer(g, 'thomas27', note(), id);
  assert.deepStrictEqual([r.ok, r.code], [true, 'DEJA_RECU'], JSON.stringify(r));
  assert.strictEqual(N(g).length, 1);
});
test('le nom du chantier est enregistré comme dans l’onglet Chantiers (casse et espaces du téléphone ignorés)', () => {
  const g = environnement();
  creer(g, 'thomas27', { chantier: '  chantier test 1 ' });
  assert.strictEqual(N(g)[0][C.chantier], 'CHANTIER TEST 1');
});
test('avec 2 photos : rangées dans le dossier du chantier (PHOTOS CHANTIER/NOTES), une seule fois même après un nouvel essai', () => {
  const g = environnement(), id = idFiche();
  ['photo-lot3-aaaa0001', 'photo-lot3-aaaa0002'].forEach(p =>
    assert.ok(poster(g, { action: 'photo', id: p, fiche: id, mime: 'image/jpeg', data: PHOTO, jeton: jeton(g, 'thomas27') }).ok));
  const d = note({ texte: '', photos: [{ photoRef: 'photo-lot3-aaaa0001' }, { photoRef: 'photo-lot3-aaaa0002' }] });
  assert.ok(envoyer(g, 'thomas27', d, id).ok);
  const ids = String(N(g)[0][C.photos]).split(' ');
  assert.strictEqual(ids.length, 2);
  const fichiers = Object.values(g.elements).filter(e => e.type === 'fichier' && /^NOTE /.test(e.nom) && !e.corbeille);
  assert.deepStrictEqual(fichiers.map(f => f.nom).sort(), ['NOTE ' + id + '-1.jpeg', 'NOTE ' + id + '-2.jpeg']);
  const chemin = e => { const t = []; let x = e.parents[0]; while (x) { t.unshift(x.nom); x = x.parents[0]; } return t.join('/'); };
  assert.ok(/CHANTIER TEST 1\/05 - CHANTIER\/PHOTOS CHANTIER\/NOTES$/.test(chemin(fichiers[0])), chemin(fichiers[0]));
  // la ligne effacée (panne simulée juste avant l'écriture) puis nouvel essai : les photos ne sont pas rangées deux fois
  g.feuilles['Notes'].lignes.length = 1;
  g.feuilles['Envois'].lignes[1][4] = 'erreur';
  ['photo-lot3-aaaa0001', 'photo-lot3-aaaa0002'].forEach(p => poster(g, { action: 'photo', id: p, fiche: id, mime: 'image/jpeg', data: PHOTO, jeton: jeton(g, 'thomas27') }));
  assert.ok(envoyer(g, 'thomas27', d, id).ok);
  assert.strictEqual(Object.values(g.elements).filter(e => e.type === 'fichier' && /^NOTE /.test(e.nom) && !e.corbeille).length, 2);
  assert.strictEqual(N(g).length, 1);
});
test('données invalides : refus définitif, rien d’écrit, pas de ligne dans Envois, pas de mail d’alerte', () => {
  const g = environnement();
  const SEP = String.fromCharCode(0x2028), NUL = String.fromCharCode(0);
  [{ texte: '', photos: [] }, { texte: 'x'.repeat(2001) }, { texte: 12 }, { texte: 'a' + NUL + 'b' }, { texte: 'a' + SEP + 'b' }, { chantier: '' }, { chantier: 'CHANTIER' + String.fromCharCode(9) + 'TEST 1' },
    { date: '2026-11-12' }, { heure: '14:05' }, { photos: 'x' }, { photos: [1, 2, 3, 4].map(n => ({ photoRef: 'photo-lot3-bbbb000' + n })) },
    { photos: [{ photoRef: 'photo-lot3-cccc0001', data: PHOTO }] }, { photos: [{ data: PHOTO, mime: 'image/jpeg' }] }].forEach(extra => {
    const r = envoyer(g, 'thomas27', note(extra));
    assert.deepStrictEqual([r.ok, r.code], [false, 'DONNEES_INVALIDES'], JSON.stringify(extra) + ' → ' + JSON.stringify(r));
  });
  assert.strictEqual(N(g).length, 0);
  assert.strictEqual(E(g).length, 0);
  assert.strictEqual(g.mails.length, 0);
});
test('un texte sur plusieurs lignes est accepté ; un texte du genre formule est neutralisé dans le Sheet', () => {
  const g = environnement();
  creer(g, 'thomas27', { texte: 'ligne 1\nligne 2' });
  creer(g, 'thomas27', { texte: '=IMPORTDATA("http://x")' });
  assert.strictEqual(N(g)[0][C.texte], 'ligne 1\nligne 2');
  assert.strictEqual(N(g)[1][C.texte], "'=IMPORTDATA(\"http://x\")");
});

console.log('Lot 3 — qui peut écrire');
test('poseur sur un chantier qui n’est pas coché pour lui : refus définitif ; chantier inexistant : même réponse, pour tout le monde', () => {
  const g = environnement();
  const r1 = envoyer(g, 'kevin', note());
  const r2 = envoyer(g, 'thomas27', note({ chantier: 'CHANTIER TEST 2' }));
  const r3 = envoyer(g, 'seb', note({ chantier: 'CHANTIER INVENTE' }));
  const r4 = envoyer(g, 'partout', note({ chantier: 'CHANTIER INVENTE' }));
  [r1, r2, r3, r4].forEach(r => assert.deepStrictEqual([r.ok, r.code], [false, 'DONNEES_INVALIDES'], JSON.stringify(r)));
  assert.strictEqual(r1.message, r3.message, 'même message pour « interdit » et « inconnu »');
  assert.strictEqual(N(g).length, 0);
  assert.ok(!Object.values(g.elements).some(e => e.type === 'dossier' && e.nom === 'CHANTIER INVENTE'), 'aucun dossier Drive créé');
});
test('atelier sur un chantier coché, conducteur et admin partout, poseur « tous les chantiers » : acceptés', () => {
  const g = environnement();
  assert.ok(envoyer(g, 'atelier1', note()).ok);
  assert.ok(envoyer(g, 'seb', note({ chantier: 'CHANTIER TEST 2' })).ok);
  assert.ok(envoyer(g, 'franck', note()).ok);
  assert.ok(envoyer(g, 'partout', note({ chantier: 'CHANTIER TEST 2' })).ok);
  assert.strictEqual(N(g).length, 4);
});
test('sans compte (même pendant la transition) : la note attend la connexion, rien dans « Sans compte », rien d’écrit', () => {
  const g = environnement();
  const avant = (g.feuilles['Sans compte'] ? g.feuilles['Sans compte'].lignes.length : 0);
  const r = envoyer(g, null, note(), undefined, 'thomas27');
  assert.deepStrictEqual([r.ok, r.code], [false, 'CONNEXION_REQUISE'], JSON.stringify(r));
  const r2 = poster(g, { action: 'fiche', id: idFiche(), donnees: note(), jeton: 'jeton.faux', saisiPar: 'thomas27' });
  assert.deepStrictEqual([r2.ok, r2.code, r2.jetonInvalide], [false, 'CONNEXION_REQUISE', true], JSON.stringify(r2));
  assert.strictEqual(N(g).length, 0);
  assert.strictEqual(g.feuilles['Sans compte'] ? g.feuilles['Sans compte'].lignes.length : 0, avant);
});
test('compte désactivé : sa note en attente n’est pas acceptée (une fiche ordinaire l’est encore)', () => {
  const g = environnement();
  g.feuilles['Utilisateurs'].lignes[1][3] = false;   // thomas27 décoché « Actif »
  const r = envoyer(g, 'thomas27', note());
  assert.deepStrictEqual([r.ok, r.code], [false, 'COMPTE_REFUSE'], JSON.stringify(r));
  assert.strictEqual(N(g).length, 0);
  const q = envoyer(g, 'thomas27', { type: 'quitus', chantier: 'CHANTIER TEST 1', date: '12/11/2026', destinataires: [] });
  assert.deepStrictEqual([q.ok, q.code], [true, 'ENREGISTRE'], 'la fiche ordinaire du même compte passe encore : ' + JSON.stringify(q));
});
test('téléphone partagé : une note rangée par Thomas ne part pas sous le nom de Lucas connecté ensuite', () => {
  const g = environnement(), id = idFiche();
  const r = envoyer(g, 'lucas', note(), id, 'thomas27');
  assert.deepStrictEqual([r.ok, r.code], [false, 'COMPTE_REFUSE'], JSON.stringify(r));
  assert.ok(/thomas27/.test(r.message));
  assert.strictEqual(N(g).length, 0);
  assert.ok(envoyer(g, 'thomas27', note(), id, 'thomas27').ok, 'elle part quand Thomas se reconnecte');
  assert.strictEqual(N(g)[0][C.auteurId], 'thomas27');
  // déjà arrivée, renvoyée depuis le téléphone où Lucas est maintenant connecté : « déjà reçu », elle quitte la file
  assert.strictEqual(envoyer(g, 'lucas', note(), id, 'thomas27').code, 'DEJA_RECU');
});

console.log('Lot 3 — lire');
test('lecture d’un chantier : les plus récentes en haut, droits et marques par personne, aucun identifiant Drive rendu', () => {
  const g = environnement();
  const a = creer(g, 'thomas27', { texte: 'première' }), b = creer(g, 'seb', { texte: 'seconde' });
  const r = lire(g, 'lucas', { chantier: 'chantier test 1' });
  assert.ok(r.ok, JSON.stringify(r));
  assert.deepStrictEqual(r.data.notes.map(n => n.id), [b, a]);
  assert.deepStrictEqual(r.data.notes.map(n => [n.auteur, n.mien, n.peutModifier, n.nouveau]), [['Sébastien', false, false, true], ['Thomas', false, false, true]]);
  assert.deepStrictEqual([r.data.chantier, r.data.chef, typeof r.data.heure], ['CHANTIER TEST 1', false, 'number']);
  const t = lire(g, 'thomas27', { chantier: 'CHANTIER TEST 1' }).data.notes;
  assert.deepStrictEqual(t.map(n => [n.mien, n.peutModifier, n.nouveau]), [[false, false, true], [true, true, false]]);
  const s = lire(g, 'seb', { chantier: 'CHANTIER TEST 1' }).data;
  assert.deepStrictEqual([s.chef, s.notes.every(n => n.peutModifier)], [true, true]);
  assert.ok(!/RACINE|photos"?:"/.test(JSON.stringify(r)));
});
test('lecture refusée : chantier non coché, chantier inexistant (même réponse), sans compte ; vue « Tous chantiers » réservée aux conducteurs', () => {
  const g = environnement();
  creer(g, 'thomas27');
  const r1 = lire(g, 'kevin', { chantier: 'CHANTIER TEST 1' }), r2 = lire(g, 'kevin', { chantier: 'CHANTIER INVENTE' });
  assert.deepStrictEqual([r1.ok, r1.code, r1.message], [false, 'INTERDIT', r2.message]);
  assert.strictEqual(poster(g, { action: 'notes', chantier: 'CHANTIER TEST 1' }).code, 'CONNEXION_REQUISE');
  ['thomas27', 'partout', 'atelier1'].forEach(q => assert.strictEqual(lire(g, q).code, 'INTERDIT', q));
  ['seb', 'franck'].forEach(q => assert.strictEqual(lire(g, q).data.notes.length, 1, q));
});
test('vue « Tous chantiers » : filtres appliqués par le serveur (recherche dans le texte, auteur, non fait, nouveau, chantier)', () => {
  const g = environnement();
  const a = creer(g, 'thomas27', { texte: 'Commander des CALES' });
  creer(g, 'seb', { chantier: 'CHANTIER TEST 2', texte: 'Appeler le plaquiste' });
  const c = creer(g, 'lucas', { texte: 'Seuil à reprendre' });
  assert.ok(envoyer(g, 'lucas', geste(c, 'fait')).ok);
  const ids = extra => lire(g, 'franck', extra).data.notes.map(n => n.texte);
  assert.deepStrictEqual(ids({ recherche: 'cales' }), ['Commander des CALES']);
  assert.deepStrictEqual(ids({ auteur: 'sébastien' }), ['Appeler le plaquiste']);
  assert.deepStrictEqual(ids({ nonFait: true }), ['Appeler le plaquiste', 'Commander des CALES']);
  assert.deepStrictEqual(ids({ chantier: 'CHANTIER TEST 2' }), ['Appeler le plaquiste']);
  assert.strictEqual(ids({ nouveau: true }).length, 3);
  assert.ok(lire(g, 'franck').data.notes.find(n => n.id === a).chantier === 'CHANTIER TEST 1');
});
test('chantier « Terminé » : ses notes restent lisibles par qui y a accès, sans badge pour un poseur', () => {
  const g = environnement();
  creer(g, 'seb', { chantier: 'CHANTIER FINI' });
  assert.strictEqual(lire(g, 'thomas27', { chantier: 'CHANTIER FINI' }).data.notes.length, 1);
  const n = poster(g, { action: 'notesNouvelles', jeton: jeton(g, 'thomas27') });
  assert.deepStrictEqual([n.ok, n.data.total, n.data.parChantier['CHANTIER FINI']], [true, 0, undefined], JSON.stringify(n));
});

console.log('Lot 3 — « nouveau » et visites');
test('lire ne marque rien ; « notesVues » envoyée après l’affichage efface les « nouveau » ; la visite suit la personne', () => {
  const g = environnement();
  creer(g, 'seb', { texte: 'une' }); creer(g, 'seb', { texte: 'deux' });
  const nouvelles = () => poster(g, { action: 'notesNouvelles', jeton: jeton(g, 'thomas27') }).data;
  assert.deepStrictEqual([nouvelles().total, nouvelles().parChantier['CHANTIER TEST 1']], [2, 2]);
  const liste = lire(g, 'thomas27', { chantier: 'CHANTIER TEST 1' });
  assert.strictEqual(V(g).length, 0, 'la lecture seule ne note pas la visite');
  assert.strictEqual(nouvelles().total, 2);
  const v = poster(g, { action: 'notesVues', chantier: 'CHANTIER TEST 1', jusqua: liste.data.heure, jeton: jeton(g, 'thomas27') });
  assert.ok(v.ok, JSON.stringify(v));
  assert.deepStrictEqual([V(g).length, V(g)[0][0], V(g)[0][1]], [1, 'thomas27', 'CHANTIER TEST 1']);
  assert.strictEqual(nouvelles().total, 0);
  assert.ok(lire(g, 'thomas27', { chantier: 'CHANTIER TEST 1' }).data.notes.every(n => !n.nouveau));
  // répété : toujours une seule ligne ; une heure du futur est ramenée à l'heure du serveur ; la visite ne recule pas
  poster(g, { action: 'notesVues', chantier: 'CHANTIER TEST 1', jusqua: Date.now() + 9e9, jeton: jeton(g, 'thomas27') });
  poster(g, { action: 'notesVues', chantier: 'CHANTIER TEST 1', jusqua: 1000, jeton: jeton(g, 'thomas27') });
  assert.strictEqual(V(g).length, 1);
  assert.ok(V(g)[0][2].getTime() <= Date.now() && V(g)[0][2].getTime() > Date.now() - 60000);
  // les autres ne sont pas touchés ; ma propre note n'est jamais « nouvelle » pour moi
  assert.strictEqual(poster(g, { action: 'notesNouvelles', jeton: jeton(g, 'lucas') }).data.total, 2);
  assert.strictEqual(poster(g, { action: 'notesNouvelles', jeton: jeton(g, 'seb') }).data.total, 0);
  assert.strictEqual(poster(g, { action: 'notesVues', chantier: 'CHANTIER TEST 1', jeton: jeton(g, 'kevin') }).code, 'INTERDIT');
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
test('une note modifiée par quelqu’un d’autre après ma visite redevient « nouvelle »', () => {
  const g = environnement();
  const id = creer(g, 'thomas27');
  poster(g, { action: 'notesVues', chantier: 'CHANTIER TEST 1', jeton: jeton(g, 'lucas') });
  assert.strictEqual(poster(g, { action: 'notesNouvelles', jeton: jeton(g, 'lucas') }).data.total, 0);
  g.feuilles['Notes vues'].lignes[1][2] = new Date(Date.now() - 5000);   // la visite date de 5 secondes
  assert.ok(envoyer(g, 'seb', geste(id, 'modifier', { texte: 'Cales de 8', base: 1 })).ok);
  assert.strictEqual(poster(g, { action: 'notesNouvelles', jeton: jeton(g, 'lucas') }).data.total, 1);
  assert.strictEqual(poster(g, { action: 'notesNouvelles', jeton: jeton(g, 'seb') }).data.total, 0);
});

console.log('Lot 3 — gestes');
test('« Fait » par n’importe qui sur le chantier, puis « défaire » ; répété, il ne change rien', () => {
  const g = environnement();
  const id = creer(g, 'thomas27');
  const r = envoyer(g, 'lucas', geste(id, 'fait'));
  assert.deepStrictEqual([r.ok, r.message], [true, 'Enregistré'], JSON.stringify(r));
  assert.deepStrictEqual([N(g)[0][C.fait], N(g)[0][C.faitPar], estDate(N(g)[0][C.faitLe])], ['Oui', 'Lucas', true]);
  const le = N(g)[0][C.faitLe];
  assert.ok(envoyer(g, 'atelier1', geste(id, 'fait')).ok);
  assert.deepStrictEqual([N(g)[0][C.faitPar], N(g)[0][C.faitLe]], ['Lucas', le]);
  assert.ok(envoyer(g, 'thomas27', geste(id, 'defaire')).ok);
  assert.deepStrictEqual([N(g)[0][C.fait], N(g)[0][C.faitPar], N(g)[0][C.faitLe]], ['', '', '']);
  assert.strictEqual(envoyer(g, 'kevin', geste(id, 'fait')).code, 'DONNEES_INVALIDES');
  assert.strictEqual(N(g)[0][C.version], 1, '« Fait » ne change pas la version du texte');
});
test('modifier : l’auteur et les conducteurs ; un autre poseur est refusé ; l’ancien texte va dans l’historique', () => {
  const g = environnement();
  const id = creer(g, 'thomas27', { texte: 'v1' });
  const refus = envoyer(g, 'lucas', geste(id, 'modifier', { texte: 'pirate', base: 1 }));
  assert.deepStrictEqual([refus.ok, refus.code], [false, 'DONNEES_INVALIDES']);
  assert.strictEqual(envoyer(g, 'partout', geste(id, 'modifier', { texte: 'pirate', base: 1 })).code, 'DONNEES_INVALIDES', 'poseur « tous les chantiers » : pas conducteur');
  assert.ok(envoyer(g, 'thomas27', geste(id, 'modifier', { texte: 'v2', base: 1 })).ok);
  assert.ok(envoyer(g, 'seb', geste(id, 'modifier', { texte: 'v3', base: 2 })).ok);
  const l = N(g)[0];
  assert.deepStrictEqual([l[C.texte], l[C.version], l[C.modifPar], l[C.remarque], l[C.texteParId], estDate(l[C.modifLe])], ['v3', 3, 'Sébastien', '', 'seb', true]);
  assert.deepStrictEqual(H(g).map(h => [h[0], h[2], h[3], h[4], h[5], h[6]]),
    [[id, 1, 'v1', 'Thomas', 'Thomas', 'modification'], [id, 2, 'v2', 'Thomas', 'Sébastien', 'modification']]);
  const vide = envoyer(g, 'thomas27', geste(id, 'modifier', { texte: '  ', base: 3 }));
  assert.strictEqual(vide.code, 'DONNEES_INVALIDES', 'une note sans photo ne peut pas devenir vide');
});
test('conflit : deux personnes modifient la même version ; la dernière reçue gagne, l’autre est dans l’historique, la note le dit', () => {
  const g = environnement();
  const id = creer(g, 'thomas27', { texte: 'origine' });
  assert.ok(envoyer(g, 'seb', geste(id, 'modifier', { texte: 'version de Seb', base: 1 })).ok);
  assert.ok(envoyer(g, 'thomas27', geste(id, 'modifier', { texte: 'version de Thomas', base: 1 })).ok);   // écrite hors réseau, arrive après
  const l = N(g)[0];
  assert.deepStrictEqual([l[C.texte], l[C.version], l[C.remarque]], ['version de Thomas', 3, 'modifiée en même temps par Sébastien']);
  assert.deepStrictEqual(H(g).map(h => [h[3], h[6]]), [['origine', 'modification'], ['version de Seb', 'modification en même temps']]);
  const lu = lire(g, 'lucas', { chantier: 'CHANTIER TEST 1' }).data.notes[0];
  assert.strictEqual(lu.remarque, 'modifiée en même temps par Sébastien');
  // la modification normale suivante efface la mention
  assert.ok(envoyer(g, 'seb', geste(id, 'modifier', { texte: 'accord', base: 3 })).ok);
  assert.strictEqual(N(g)[0][C.remarque], '');
});
test('conflit puis 2e modification du même téléphone sur l’ancienne base : la mention de conflit reste', () => {
  const g = environnement();
  const id = creer(g, 'thomas27', { texte: 'origine' });
  assert.ok(envoyer(g, 'seb', geste(id, 'modifier', { texte: 'version de Seb', base: 1 })).ok);
  assert.ok(envoyer(g, 'thomas27', geste(id, 'modifier', { texte: 'Thomas 1', base: 1 })).ok);
  assert.ok(envoyer(g, 'thomas27', geste(id, 'modifier', { texte: 'Thomas 2', base: 1 })).ok);
  assert.deepStrictEqual([N(g)[0][C.texte], N(g)[0][C.remarque]], ['Thomas 2', 'modifiée en même temps par Sébastien']);
});
test('la même personne modifie deux fois hors réseau (même base) : pas de faux conflit', () => {
  const g = environnement();
  const id = creer(g, 'thomas27', { texte: 'a' });
  assert.ok(envoyer(g, 'thomas27', geste(id, 'modifier', { texte: 'b', base: 1 })).ok);
  assert.ok(envoyer(g, 'thomas27', geste(id, 'modifier', { texte: 'c', base: 1 })).ok);
  assert.deepStrictEqual([N(g)[0][C.texte], N(g)[0][C.remarque]], ['c', '']);
});
test('supprimer : auteur ou conducteur ; la ligne reste (corbeille) ; restaurer : conducteurs seulement', () => {
  const g = environnement();
  const id = creer(g, 'thomas27');
  assert.strictEqual(envoyer(g, 'lucas', geste(id, 'supprimer')).code, 'DONNEES_INVALIDES');
  assert.ok(envoyer(g, 'thomas27', geste(id, 'supprimer')).ok);
  assert.deepStrictEqual([N(g).length, N(g)[0][C.supprPar], estDate(N(g)[0][C.supprLe])], [1, 'Thomas', true]);
  assert.strictEqual(lire(g, 'thomas27', { chantier: 'CHANTIER TEST 1' }).data.notes.length, 0);
  assert.strictEqual(lire(g, 'thomas27', { chantier: 'CHANTIER TEST 1', corbeille: true }).code, 'INTERDIT');
  assert.strictEqual(lire(g, 'partout', { chantier: 'CHANTIER TEST 1', corbeille: true }).code, 'INTERDIT');
  const c = lire(g, 'seb', { chantier: 'CHANTIER TEST 1', corbeille: true }).data.notes;
  assert.deepStrictEqual(c.map(n => [n.id, n.supprPar]), [[id, 'Thomas']]);
  assert.strictEqual(envoyer(g, 'thomas27', geste(id, 'restaurer')).code, 'DONNEES_INVALIDES');
  assert.ok(envoyer(g, 'franck', geste(id, 'restaurer')).ok);
  assert.deepStrictEqual([N(g)[0][C.supprPar], N(g)[0][C.supprLe]], ['', '']);
  assert.strictEqual(lire(g, 'thomas27', { chantier: 'CHANTIER TEST 1' }).data.notes.length, 1);
});
test('modification reçue après la suppression : le texte est gardé dans l’historique, la note reste à la corbeille', () => {
  const g = environnement();
  const id = creer(g, 'thomas27', { texte: 'avant' });
  assert.ok(envoyer(g, 'seb', geste(id, 'supprimer')).ok);
  assert.ok(envoyer(g, 'thomas27', geste(id, 'modifier', { texte: 'écrit hors réseau', base: 1 })).ok);
  assert.deepStrictEqual([N(g)[0][C.texte], N(g)[0][C.supprPar]], ['avant', 'Sébastien']);
  assert.deepStrictEqual(H(g).map(h => [h[3], h[6]]), [['écrit hors réseau', 'reçue après suppression (texte non appliqué)']]);
});
test('geste invalide ou sur une note inconnue : refus définitif, même message que « pas le droit »', () => {
  const g = environnement();
  const id = creer(g, 'thomas27');
  const inconnu = envoyer(g, 'thomas27', geste('fiche-lot3-inconnue1', 'fait'));
  const interdit = envoyer(g, 'kevin', geste(id, 'fait'));
  assert.deepStrictEqual([inconnu.code, inconnu.message], ['DONNEES_INVALIDES', interdit.message]);
  [{ geste: 'effacer' }, { note: 'x' }, { note: 12 }, { base: 0 }, { base: 1.5 }, { base: 'un' }].forEach(extra =>
    assert.strictEqual(envoyer(g, 'thomas27', Object.assign(geste(id, 'modifier', { texte: 'ok' }), extra)).code, 'DONNEES_INVALIDES', JSON.stringify(extra)));
});
test('Franck trie l’onglet : la liste et le PDF restent dans l’ordre des dates, jamais dans celui des lignes', () => {
  const g = environnement();
  const a = creer(g, 'seb', { texte: 'ANCIENNE' }), b = creer(g, 'seb', { texte: 'RECENTE' });
  const f = g.feuilles['Notes'].lignes;
  f[1][C.cree] = new Date(Date.now() - 60000);   // la première a une minute de plus
  const x = f[1]; f[1] = f[2]; f[2] = x;          // onglet trié à l'envers
  assert.deepStrictEqual(lire(g, 'seb', { chantier: 'CHANTIER TEST 1' }).data.notes.map(n => n.id), [b, a]);
  const r = poster(g, { action: 'notesPdf', chantier: 'CHANTIER TEST 1', jeton: jeton(g, 'seb') });
  const html = String(Object.values(g.elements).find(e => e.type === 'fichier' && e.nom === r.data.nom).contenu);
  assert.ok(html.indexOf('ANCIENNE') > -1 && html.indexOf('ANCIENNE') < html.indexOf('RECENTE'));
});
test('Franck trie l’onglet : les gestes retrouvent la note par son numéro', () => {
  const g = environnement();
  const a = creer(g, 'thomas27', { texte: 'A' }), b = creer(g, 'thomas27', { texte: 'B' });
  const f = g.feuilles['Notes'].lignes; const x = f[1]; f[1] = f[2]; f[2] = x;
  assert.ok(envoyer(g, 'thomas27', geste(a, 'fait')).ok);
  assert.deepStrictEqual(N(g).map(l => [l[C.id], l[C.fait]]), [[b, ''], [a, 'Oui']]);
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

console.log('Lot 3 — photos, historique, PDF');
function avecPhoto(g, qui) {
  const id = idFiche(), p = 'photo-lot3-' + String(++numero).padStart(8, '0');
  assert.ok(poster(g, { action: 'photo', id: p, fiche: id, mime: 'image/jpeg', data: PHOTO, jeton: jeton(g, qui) }).ok);
  assert.ok(envoyer(g, qui, note({ texte: 'avec photo', photos: [{ photoRef: p }] }), id).ok);
  return id;
}
test('photo d’une note : rendue seulement à qui a accès au chantier ; rang invalide ou note inconnue : même refus', () => {
  const g = environnement();
  const id = avecPhoto(g, 'thomas27');
  const r = poster(g, { action: 'notePhoto', note: id, rang: 1, jeton: jeton(g, 'lucas') });
  assert.deepStrictEqual([r.ok, r.data.mime, r.data.data], [true, 'image/jpeg', PHOTO], JSON.stringify(r).slice(0, 200));
  const refus = [poster(g, { action: 'notePhoto', note: id, rang: 1, jeton: jeton(g, 'kevin') }), poster(g, { action: 'notePhoto', note: id, rang: 2, jeton: jeton(g, 'lucas') }),
    poster(g, { action: 'notePhoto', note: id, rang: 'x', jeton: jeton(g, 'lucas') }), poster(g, { action: 'notePhoto', note: 'fiche-lot3-inconnue1', rang: 1, jeton: jeton(g, 'lucas') })];
  refus.forEach(x => assert.deepStrictEqual([x.ok, x.code, x.message], [false, 'INTERDIT', refus[0].message]));
  assert.strictEqual(poster(g, { action: 'notePhoto', note: id, rang: 1 }).code, 'CONNEXION_REQUISE');
  assert.strictEqual(lire(g, 'lucas', { chantier: 'CHANTIER TEST 1' }).data.notes[0].photos, 1);
});
test('note supprimée : sa photo et son historique ne sont plus lisibles que par les conducteurs', () => {
  const g = environnement();
  const id = avecPhoto(g, 'thomas27');
  assert.ok(envoyer(g, 'thomas27', geste(id, 'modifier', { texte: 'retouche', base: 1 })).ok);
  assert.strictEqual(poster(g, { action: 'noteHistorique', note: id, jeton: jeton(g, 'lucas') }).data.versions.length, 1);
  assert.ok(envoyer(g, 'thomas27', geste(id, 'supprimer')).ok);
  ['thomas27', 'lucas'].forEach(q => {
    assert.strictEqual(poster(g, { action: 'notePhoto', note: id, rang: 1, jeton: jeton(g, q) }).code, 'INTERDIT', q);
    assert.strictEqual(poster(g, { action: 'noteHistorique', note: id, jeton: jeton(g, q) }).code, 'INTERDIT', q);
  });
  assert.ok(poster(g, { action: 'notePhoto', note: id, rang: 1, jeton: jeton(g, 'seb') }).ok);
  const h = poster(g, { action: 'noteHistorique', note: id, jeton: jeton(g, 'seb') });
  assert.deepStrictEqual(h.data.versions.map(v => [v.version, v.texte, v.par, v.remplacePar, v.motif]), [[1, 'avec photo', 'Thomas', 'Thomas', 'modification']]);
});
test('export PDF : conducteurs et admin seulement ; rangé dans COMPTE RENDU du chantier ; les notes supprimées n’y sont pas', () => {
  const g = environnement();
  avecPhoto(g, 'thomas27');
  const b = creer(g, 'seb', { texte: 'à <b>ne pas</b> interpréter' });
  const s = creer(g, 'lucas', { texte: 'SUPPRIMEE' });
  assert.ok(envoyer(g, 'lucas', geste(s, 'supprimer')).ok);
  assert.ok(envoyer(g, 'lucas', geste(b, 'fait')).ok);
  ['thomas27', 'partout', 'atelier1'].forEach(q => assert.strictEqual(poster(g, { action: 'notesPdf', chantier: 'CHANTIER TEST 1', jeton: jeton(g, q) }).code, 'INTERDIT', q));
  const r = poster(g, { action: 'notesPdf', chantier: 'chantier test 1', jeton: jeton(g, 'seb') });
  assert.deepStrictEqual([r.ok, r.data.notes, r.data.photosNonReprises], [true, 2, 0], JSON.stringify(r));
  const f = Object.values(g.elements).find(e => e.type === 'fichier' && e.nom === r.data.nom);
  assert.ok(f && /^NOTES DE CHANTIER CHANTIER TEST 1 \d{4}-\d{2}-\d{2}\.pdf$/.test(f.nom), r.data.nom);
  assert.strictEqual(f.parents[0].nom, 'COMPTE RENDU');
  const html = String(f.contenu);
  assert.ok(html.indexOf('à &lt;b&gt;ne pas&lt;/b&gt; interpréter') > -1 && html.indexOf('<b>ne pas</b>') < 0, 'texte échappé');
  assert.ok(html.indexOf('SUPPRIMEE') < 0 && html.indexOf('avec photo') > -1 && html.indexOf('data:image/jpeg;base64,' + PHOTO) > -1);
  assert.ok(html.indexOf('avec photo') < html.indexOf('interpréter'), 'de la plus ancienne à la plus récente');
  assert.strictEqual(g.mails.length, 0);
  assert.strictEqual(poster(g, { action: 'notesPdf', chantier: 'CHANTIER TEST 2', jeton: jeton(g, 'seb') }).code, 'VIDE');
  assert.strictEqual(poster(g, { action: 'notesPdf', chantier: 'CHANTIER INVENTE', jeton: jeton(g, 'seb') }).code, 'INTERDIT');
});

console.log('Lot 3 — installation et livraison');
test('installation : trois onglets créés ; relancée, elle ne change rien ; refuse le mauvais environnement', () => {
  const g = environnement({ sansInstallation: true });
  const t1 = g.ctx.installerLot3Production();
  assert.ok(/installation terminée/.test(t1), t1);
  ['Notes', 'Notes historique', 'Notes vues'].forEach(n => assert.ok(g.feuilles[n], n));
  assert.strictEqual(g.feuilles['Notes'].lignes[0].length, 19);
  creer(g, 'thomas27');
  const t2 = g.ctx.installerLot3Production();
  assert.ok(/installation terminée/.test(t2) && !/créé/.test(t2), t2);
  assert.strictEqual(N(g).length, 1);
  assert.ok(!/installation terminée/.test(g.ctx.installerLot3Test()), 'refusée : pas l’environnement TEST');
  const gt = environnement({ sansInstallation: true, test: true });
  assert.ok(/installation terminée/.test(gt.ctx.installerLot3Test()));
});
test('sans installation : la première note crée l’onglet toute seule', () => {
  const g = environnement({ sansInstallation: true });
  creer(g, 'thomas27');
  assert.strictEqual(N(g).length, 1);
  assert.deepStrictEqual(lire(g, 'thomas27', { chantier: 'CHANTIER TEST 1' }).data.notes.length, 1);
});
test('les fiches existantes ne changent pas : un quitus sans compte passe toujours pendant la transition, avec son mail', () => {
  const g = environnement();
  const r = poster(g, { action: 'fiche', id: idFiche(), donnees: { type: 'quitus', chantier: 'CHANTIER TEST 1', date: '12/11/2026', destinataires: [] } });
  assert.deepStrictEqual([r.ok, r.code, r.data.note], [true, 'ENREGISTRE', undefined], JSON.stringify(r));
  assert.ok(r.data.envoyes >= 1);
});
test('livraison : le serveur à coller contient le lot 3, en version v8.0, sans les outils d’essai', () => {
  const code = fs.readFileSync(path.join(__dirname, '..', 'A-COLLER-DANS-APPS-SCRIPT', 'Code.gs'), 'utf8');
  ['function traiterNoteChantier(', 'function traiterNoteAction(', 'function installerLot3Test(', 'function installerLot3Production(', 'function modele_notes_chantier(',
    "const VERSION_API = 'v8.0'", 'function traiterSignalement('].forEach(t => assert.ok(code.indexOf(t) > -1, t));
  assert.ok(!/function\s+outilTest_\s*\(/.test(code));
});
console.log('\n' + reussis + ' test(s) réussi(s)' + (process.exitCode ? ' — DES TESTS ÉCHOUENT' : ''));
