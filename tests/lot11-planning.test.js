// Tests du lot 11.1 — le PROGRAMME DU PLANNING (planning/Planning.gs, attaché au Sheet) dans un faux Google :
//   node tests/lot11-planning.test.js
// Tous les noms sont inventés. Rien n'est envoyé nulle part.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { creerFaux, charger } = require('./faux-google-planning');

const j = x => JSON.stringify(x);
const egal = (a, b, m) => assert.strictEqual(j(a), j(b), m);
let reussis = 0;
function test(nom, fn) {
  try { fn(); reussis++; console.log('  ✓ ' + nom); }
  catch (e) { console.log('  ✗ ' + nom + '\n    ' + String(e.stack || e.message).split('\n').slice(0, 7).join('\n    ')); process.exitCode = 1; }
}
const LISTES = () => [
  ['N°', 'Chantier', 'Nom court (affiche)', 'Liste de saisie', '', 'Véhicule', 'Couleur', '', 'Autres cas', '', 'Tâches', '', 'Liste des chantiers', 'jamais mise à jour'],
  ['901', 'LES TILLEULS', 'Tilleuls', '', '', 'Plateau 1', '#FFE0B2', '', 'Absent', '', 'Huisseries', '', 'Mettre à jour maintenant', false],
  ['903', 'LES LILAS', '', '', '', 'Fourgon 2', '#C8E6C9', '', 'Congés', '', 'Placards', '', '', ''],
  ['920', 'MAIRIE', '', '', '', '', '', '', 'École', '', '', '', '', ''],
  ['', '', '', '', '', '', '', '', 'Formation', '', '', '', '', ''],
  ['', '', '', '', '', '', '', '', 'Férié', '', '', '', '', ''],
  ['', '', '', '', '', '', '', '', 'Atelier', '', '', '', '', ''],
  ['', '', '', '', '', '', '', '', 'Bureau', '', '', '', '', ''],
  ['', '', '', '', '', '', '', '', 'SAV / divers', '', '', '', '', ''],
];
const SALARIES = () => [['Nom', 'Équipe', 'Véhicule habituel', 'Compte de l’appli'], ['Kévin L.', 'Pose', 'Plateau 1', 'poseur01'], ['Éric A.', 'Pose', 'Fourgon 2', '']];
// Un classeur « Planning Loué » avec une semaine (2026-S47, celle du 16/11/2026 : « aujourd'hui » est le jeudi 19/11/2026)
function planning(extra) {
  const g = creerFaux(Object.assign({ classeurs: { PLANNING: { nom: 'Planning Loué', onglets: { 'LISTES': LISTES(), 'SALARIÉS': SALARIES() } } }, actif: 'PLANNING' }, extra || {}));
  const ctx = charger(g, ['Regles.gs', 'Affiche.gs', 'Planning.gs']);
  g.ss = g.classeurs.PLANNING.api;
  return { g: g, ctx: ctx, ss: g.ss };
}
function avecSemaine() {
  const p = planning();
  const s = { lundi: '2026-11-16', publier: false, etat: '',
    pose: [{ nom: 'Bruno M.', vehicule: 'Fourgon 2', jours: ['903 LES LILAS', 'Mr DUPONT', 'École', 'Formation', 'Férié'], vehiculesJour: ['', '', '', '', ''] },
      { nom: 'Kévin L.', vehicule: 'Plateau 1', jours: ['901 LES TILLEULS', '901 LES TILLEULS', '½ 901 LES TILLEULS\n½ 903 LES LILAS', 'Absent', 'Congés'], vehiculesJour: ['', '', 'Fourgon 2', '', ''] }],
    atelier: [{ nom: 'Thomas R.', jours: ['Huisseries 901, 903', '', 'Bureau', '', ''] }] };
  const sh = p.ss.insertSheet('2026-S47', 0);
  p.ctx.plgEcrireSemaine_(p.ss, sh, s, p.ctx.plgListes_(p.ss));
  p.ss.setActiveSheet(sh);
  p.sh = sh; p.f = p.g.onglet('PLANNING', '2026-S47');
  return p;
}
const valeurs = f => f.lignes.map(l => Array.from({ length: 8 }, (_, i) => (l[i] === undefined ? '' : l[i])));

console.log('Lot 11.1 — installer le planning');
test('dans un classeur vide : LISTES, SALARIÉS et la semaine en cours sont créés ; la colonne « Compte de l’appli » est verrouillée', () => {
  const g = creerFaux({ classeurs: { PLANNING: { nom: 'Planning Loué', onglets: { 'Feuille 1': [] } } }, actif: 'PLANNING' });
  const ctx = charger(g, ['Regles.gs', 'Affiche.gs', 'Planning.gs']);
  const r = ctx.plgInstaller_(g.classeurs.PLANNING.api);
  egal(g.noms('PLANNING'), ['2026-S47', 'Feuille 1', 'LISTES', 'SALARIÉS']);
  assert.ok(r.every(l => /^✅/.test(l)), r.join('\n'));
  const li = g.onglet('PLANNING', 'LISTES');
  egal(li.lignes[0].slice(0, 3), ['N°', 'Chantier', 'Nom court (affiche)']);
  egal(li.lignes.slice(1, 1 + ctx.lire('PL_CAS').length).map(l => l[8]), ctx.lire('PL_CAS'));
  egal(li.lignes[1][13], false, 'la case « Mettre à jour maintenant »');
  const pr = g.onglet('PLANNING', 'SALARIÉS').protections;
  egal([pr.length, pr[0].c, pr[0].editeurs, pr[0].domaine], [1, 4, [], false]);
  const sem = ctx.plLireSemaine_(valeurs(g.onglet('PLANNING', '2026-S47')));
  egal([sem.lundi, sem.pose.length, sem.atelier.length], ['2026-11-16', 0, 0]);
});
test('relancé : rien n’est remplacé (ni les listes, ni les salariés, ni les semaines)', () => {
  const p = avecSemaine();
  const avant = j([p.g.onglet('PLANNING', 'LISTES').lignes, p.g.onglet('PLANNING', 'SALARIÉS').lignes, p.f.lignes]);
  const r = p.ctx.plgInstaller_(p.ss);
  assert.ok(r.every(l => /^•/.test(l)), r.join('\n'));
  egal(j([p.g.onglet('PLANNING', 'LISTES').lignes, p.g.onglet('PLANNING', 'SALARIÉS').lignes, p.f.lignes]), avant);
});
test('le menu « Planning Loué » propose les sept commandes', () => {
  const p = planning(); p.ctx.onOpen();
  egal(p.g.ui.menus[0].items.map(i => i[1]), ['menuSemaineSuivante', 'menuAjouterGars', 'menuRetirerGars', 'menuVerifier', 'menuAffiche', 'menuInstaller', 'menuAPropos']);
  p.g.ui.menus[0].items.forEach(i => assert.strictEqual(typeof p.ctx[i[1]], 'function', i[1]));
});

console.log('Lot 11.1 — une semaine dans son onglet');
test('écrite puis relue : la même ; case « Publier » à cocher ; colonne H cachée ; listes de choix en « avertissement seulement »', () => {
  const p = avecSemaine();
  const s = p.ctx.plgLireSemaine_(p.sh);
  egal(s.pose.map(g => g.nom), ['Bruno M.', 'Kévin L.']);
  egal(s.pose[1].vehiculesJour, ['', '', 'Fourgon 2', '', '']);
  egal(p.f.lignes[1].slice(0, 3), ['Publier pour les gars', false, 'Pas encore publié']);
  assert.ok(p.f.cases['2:2'], 'B2 est une vraie case à cocher');
  egal(p.f.cachees, [8]);
  assert.ok(p.f.validations.length >= 5 && p.f.validations.every(v => v.v.invalide === true), 'la saisie libre est toujours acceptée');
  // une case de pose : la couleur du véhicule du jour (mercredi : Fourgon 2), sinon de la semaine (Plateau 1)
  egal([p.f.fonds['7:3'], p.f.fonds['7:5'], p.f.fonds['5:3']], ['#FFE0B2', '#C8E6C9', '#C8E6C9']);
});
test('saisie : « 901 » devient « 901 LES TILLEULS », « 901 + 920 » deux demi-journées ; une saisie libre reste telle quelle', () => {
  const p = avecSemaine();
  const taper = (l, c, v) => { p.sh.getRange(l, c).setValue(v); p.ctx.onEdit({ range: p.sh.getRange(l, c), source: p.ss }); return p.f.lignes[l - 1][c - 1]; };
  egal(taper(5, 4, 901), '901 LES TILLEULS');
  egal(taper(5, 5, '901 + 920'), '½ 901 LES TILLEULS\n½ 920 MAIRIE');
  egal(taper(5, 6, 'cong'), 'Congés');
  egal(taper(5, 7, 'Mr MARTIN, 12 rue des Lilas'), 'Mr MARTIN, 12 rue des Lilas');
  egal(taper(9, 3, '901'), '901', 'une case de l’atelier n’est pas complétée');
});
test('saisie : un mot à éviter passe en rouge ; le véhicule du jour change la couleur de la case', () => {
  const p = avecSemaine();
  p.sh.getRange(5, 3).setValue('arrêt maladie'); p.ctx.onEdit({ range: p.sh.getRange(5, 3), source: p.ss });
  egal(p.f.textes['5:3'], '#CC0000');
  egal(p.f.lignes[4][2], 'arrêt maladie', 'jamais refusé ni effacé : seulement signalé');
  p.sh.getRange(6, 4).setValue('Plateau 1'); p.ctx.onEdit({ range: p.sh.getRange(6, 4), source: p.ss });
  egal([p.f.fonds['5:4'], p.f.fonds['5:5']], ['#FFE0B2', '#C8E6C9'], 'mardi en Plateau 1, mercredi toujours en Fourgon 2');
});
test('saisie hors d’une semaine (LISTES), sans événement, ou dans un onglet illisible : rien ne se passe, aucune erreur', () => {
  const p = avecSemaine();
  const li = p.ss.getSheetByName('LISTES');
  const avant = j(p.g.onglet('PLANNING', 'LISTES').lignes);
  p.ctx.onEdit({ range: li.getRange(2, 1), source: p.ss }); p.ctx.onEdit(); p.ctx.onEdit({});
  egal(j(p.g.onglet('PLANNING', 'LISTES').lignes), avant);
  p.g.classeurs.PLANNING.onglets = p.g.classeurs.PLANNING.onglets.filter(o => o.nom !== 'LISTES');     // LISTES supprimé par erreur
  p.ctx.onEdit({ range: p.sh.getRange(5, 3), source: p.ss });
  assert.ok(p.g.journal.some(l => l[0] === 'console' && /onEdit/.test(l[2])), 'l’erreur est notée, pas montrée');
});
test('un collage de plusieurs cases est complété d’un coup', () => {
  const p = avecSemaine();
  p.sh.getRange(5, 3, 1, 3).setValues([['901', '903', 'abs']]);
  p.ctx.onEdit({ range: p.sh.getRange(5, 3, 1, 3), source: p.ss });
  egal(p.f.lignes[4].slice(2, 5), ['901 LES TILLEULS', '903 LES LILAS', 'Absent']);
});

console.log('Lot 11.1 — créer la semaine suivante');
test('nouvel onglet « 2026-S48 », juste après ; chantiers recopiés, absences et véhicules du jour non ; « Publier » décoché', () => {
  const p = avecSemaine();
  p.sh.getRange(2, 2).setValue(true);
  const r = p.ctx.plgCreerSuivante_(p.ss);
  assert.ok(r.ok && r.nom === '2026-S48', j(r));
  egal(p.g.noms('PLANNING').slice(0, 2), ['2026-S47', '2026-S48']);
  const s = p.ctx.plLireSemaine_(valeurs(p.g.onglet('PLANNING', '2026-S48')));
  egal([s.lundi, s.publier], ['2026-11-23', false]);
  egal(s.pose[1].jours, ['901 LES TILLEULS', '901 LES TILLEULS', '½ 901 LES TILLEULS\n½ 903 LES LILAS', '', '']);
  egal(s.pose[1].vehiculesJour, ['', '', '', '', '']);
  egal(s.pose[0].jours, ['903 LES LILAS', 'Mr DUPONT', '', '', '']);
  egal(p.g.onglet('PLANNING', '2026-S48').lignes[2].slice(2, 4), ['Lundi 23/11', 'Mardi 24/11']);
  egal(p.ss.getActiveSheet().getName(), '2026-S48');
});
test('elle existe déjà : rien n’est modifié, elle est seulement ouverte', () => {
  const p = avecSemaine();
  p.ctx.plgCreerSuivante_(p.ss);
  const f48 = p.g.onglet('PLANNING', '2026-S48');
  f48.api.getRange(5, 3).setValue('920 MAIRIE');
  p.ss.setActiveSheet(p.sh);
  const avant = j(f48.lignes), r = p.ctx.plgCreerSuivante_(p.ss);
  assert.ok(!r.ok && /existe déjà/.test(r.message));
  egal(j(f48.lignes), avant);
  egal(p.g.noms('PLANNING').filter(n => /^2026-S/.test(n)), ['2026-S47', '2026-S48']);
});
test('passage d’année : la semaine suivante de 2026-S53 est 2027-S01', () => {
  const p = planning();
  const sh = p.ss.insertSheet('2026-S53', 0);
  p.ctx.plgEcrireSemaine_(p.ss, sh, { lundi: '2026-12-28', publier: false, etat: '', pose: [], atelier: [] }, p.ctx.plgListes_(p.ss));
  p.ss.setActiveSheet(sh);
  egal(p.ctx.plgCreerSuivante_(p.ss).nom, '2027-S01');
  egal(p.g.onglet('PLANNING', '2027-S01').lignes[0][1], 'Semaine 1 — du 04 au 08/01/2027');
});
test('onglet de semaine illisible (colonne H effacée) : la commande s’arrête avec un message clair, rien n’est créé', () => {
  const p = avecSemaine();
  p.f.lignes.forEach(l => { l[7] = ''; });
  p.g.ui.reponses = [];
  const r = p.ctx.menuSemaineSuivante();
  egal(r, null);
  assert.ok(/Pas fait : l’onglet « 2026-S47 » n’est pas lisible/.test(p.g.ui.alertes[0].texte), p.g.ui.alertes[0].texte);
  egal(p.g.noms('PLANNING').filter(n => /^2026-S/.test(n)), ['2026-S47']);
});

console.log('Lot 11.1 — ajouter et retirer un gars');
test('ajouter : dans la semaine ouverte ET les suivantes, à sa place ; véhicule habituel repris de SALARIÉS ; rien dans les semaines passées', () => {
  const p = avecSemaine();
  p.ctx.plgCreerSuivante_(p.ss);                       // S48 (active)
  const r = p.ctx.plgAjouter_(p.ss, 'Éric A.', 'pose');
  assert.ok(r.ok, j(r));
  const noms = n => p.ctx.plLireSemaine_(valeurs(p.g.onglet('PLANNING', n))).pose.map(g => g.nom + ' / ' + g.vehicule);
  egal(noms('2026-S48'), ['Bruno M. / Fourgon 2', 'Éric A. / Fourgon 2', 'Kévin L. / Plateau 1']);
  egal(noms('2026-S47'), ['Bruno M. / Fourgon 2', 'Kévin L. / Plateau 1'], 'la semaine passée ne change pas');
  // les saisies des autres n'ont pas bougé
  egal(p.ctx.plLireSemaine_(valeurs(p.g.onglet('PLANNING', '2026-S48'))).pose[2].jours[0], '901 LES TILLEULS');
});
test('ajouter un gars inconnu de SALARIÉS : il y est noté (sans compte de l’appli) ; le même deux fois : refusé', () => {
  const p = avecSemaine();
  assert.ok(p.ctx.plgAjouter_(p.ss, 'Paul N.', 'atelier').ok);
  egal(p.g.onglet('PLANNING', 'SALARIÉS').lignes[3].slice(0, 3), ['Paul N.', 'Atelier', '']);
  egal(p.ctx.plLireSemaine_(valeurs(p.f)).atelier.map(g => g.nom), ['Paul N.', 'Thomas R.']);
  const r = p.ctx.plgAjouter_(p.ss, 'paul n.', 'pose');
  assert.ok(!r.ok && /déjà dans cette semaine/.test(r.message), j(r));
  egal(p.g.onglet('PLANNING', 'SALARIÉS').lignes.length, 4);
});
test('par le menu : le nom, puis « Oui = pose, Non = atelier » ; Annuler ne fait rien', () => {
  const p = avecSemaine();
  p.g.ui.reponses = [{ bouton: 'OK', texte: ' Paul N. ' }, 'NO', 'OK'];
  assert.ok(p.ctx.menuAjouterGars().ok);
  egal(p.ctx.plLireSemaine_(valeurs(p.f)).atelier.map(g => g.nom), ['Paul N.', 'Thomas R.']);
  const avant = j(p.f.lignes);
  p.g.ui.reponses = [{ bouton: 'CANCEL', texte: 'Quelqu’un' }];
  egal(p.ctx.menuAjouterGars(), null);
  p.g.ui.reponses = [{ bouton: 'OK', texte: 'Quelqu’un' }, 'CANCEL'];
  egal(p.ctx.menuAjouterGars(), null);
  egal(j(p.f.lignes), avant);
});
test('retirer : demande confirmation et prévient si des saisies seront effacées ; « Non » ne retire rien', () => {
  const p = avecSemaine();
  const avant = j(p.f.lignes);
  p.g.ui.reponses = [{ bouton: 'OK', texte: 'kévin l.' }, 'NO'];
  egal(p.ctx.menuRetirerGars(), null);
  assert.ok(/Ce qui est écrit sur ses lignes sera effacé/.test(p.g.ui.alertes[1].texte), p.g.ui.alertes[1].texte);
  egal(j(p.f.lignes), avant);
  p.g.ui.reponses = [{ bouton: 'OK', texte: 'kévin l.' }, 'YES', 'OK'];
  assert.ok(p.ctx.menuRetirerGars().ok);
  egal(p.ctx.plLireSemaine_(valeurs(p.f)).pose.map(g => g.nom), ['Bruno M.']);
  // aucune ligne orpheline ne reste sous le tableau
  egal(p.f.lignes.filter(l => l[7] === 'V').length, 1);
  egal(p.f.lignes.slice(8).every(l => l.every(v => v === '' || v === undefined)), true);
});
test('retirer un inconnu : message, rien ne change', () => {
  const p = avecSemaine(), avant = j(p.f.lignes);
  p.g.ui.reponses = [{ bouton: 'OK', texte: 'Personne' }];
  assert.ok(!p.ctx.menuRetirerGars().ok);
  egal(j(p.f.lignes), avant);
});
test('quelqu’un d’autre lance une commande au même moment : « réessaie dans une minute », rien n’est fait', () => {
  const p = avecSemaine(); p.g.verrouOccupe = true;
  egal(p.ctx.menuSemaineSuivante(), null);
  assert.ok(/Réessaie dans une minute/.test(p.g.ui.alertes[0].texte));
  egal(p.g.noms('PLANNING').filter(n => /^2026-S/.test(n)), ['2026-S47']);
});

console.log('Lot 11.1 — vérifier la semaine');
test('saisies complétées, ordre alphabétique rétabli, liste de saisie refaite, remarques affichées', () => {
  const p = avecSemaine();
  // on dérègle : une saisie non complétée (collage), un mot à éviter, un véhicule hors liste
  p.sh.getRange(7, 3).setValue('901+903'); p.sh.getRange(5, 4).setValue('accident'); p.sh.getRange(5, 1).setValue('Camion X');
  p.g.ui.reponses = ['OK'];
  const r = p.ctx.menuVerifier();
  const s = p.ctx.plLireSemaine_(valeurs(p.f));
  egal(s.pose[1].jours[0], '½ 901 LES TILLEULS\n½ 903 LES LILAS', 'une saisie collée sans passer par la complétion est rattrapée');
  const tout = r.remarques.join(' | ');
  assert.ok(/Bruno M\., mardi : le mot « accident »/.test(tout), tout);
  assert.ok(/Bruno M\. : le véhicule « Camion X » n’est pas dans la liste/.test(tout), tout);
  egal(p.g.onglet('PLANNING', 'LISTES').lignes.slice(1, 5).map(l => l[3]), ['901 LES TILLEULS', '903 LES LILAS', '920 MAIRIE', 'Absent']);
  assert.ok(/remise d’aplomb/.test(p.g.ui.alertes[0].texte));
});

console.log('Lot 11.1 — l’affiche A3');
test('onglet « AFFICHE A3 » : une ligne par gars, pose et atelier ensemble, lien vers le PDF hors de la zone imprimée', () => {
  const p = avecSemaine();
  const r = p.ctx.plgAffiche_(p.ss);
  const a = p.g.onglet('PLANNING', 'AFFICHE A3');
  egal(a.lignes[0][0], 'PLANNING LOUÉ — Semaine 47 — du 16 au 20/11/2026');
  egal(a.lignes.slice(1).map(l => l[1]), ['Nom', '', 'Bruno M.', 'Kévin L.', '', 'Thomas R.']);
  egal(a.lignes[4].slice(0, 7), ['Plateau 1', 'Kévin L.', '901 Tilleuls', '901 Tilleuls', '½ 901 Tilleuls / ½ 903 LES LILAS [Fou.]', 'Absent', 'Congés']);
  egal(a.lignes[6].slice(1, 3), ['Thomas R.', 'Huisseries 901, 903']);
  egal([a.fonds['5:5'], a.fonds['5:3']], ['#C8E6C9', '#FFE0B2'], 'couleur du véhicule du jour');
  assert.ok(/^=HYPERLINK\("https:\/\/docs\.google\.com\/spreadsheets\/d\/PLANNING\/export\?format=pdf&gid=\d+&size=A3&portrait=false&scale=4.*&range=A1:G7";"Ouvrir le PDF de l’affiche"\)$/.test(a.formules['1:9']), a.formules['1:9']);
  assert.ok(/Semaine 2026-S47, préparée le 19\/11 à 16:10/.test(a.lignes[1][8]), a.lignes[1][8]);
  assert.ok(r.taille >= 14, 'texte en ' + r.taille + ' points');
  egal(Object.keys(a.largeurs).length >= 7, true);
});
test('refaite après un changement : l’ancienne affiche est entièrement remplacée (aucune ligne d’avant ne reste)', () => {
  const p = avecSemaine();
  p.ctx.plgAffiche_(p.ss);
  p.ss.setActiveSheet(p.sh);
  p.ctx.plgRetirer_(p.ss, 'Kévin L.', false); p.ctx.plgRetirer_(p.ss, 'Thomas R.', false);
  p.ctx.plgAffiche_(p.ss);
  const a = p.g.onglet('PLANNING', 'AFFICHE A3');
  egal(a.lignes.filter(l => l.some(v => v !== '' && v !== undefined)).map(l => l[1]), ['', 'Nom', '', 'Bruno M.']);
  egal(p.g.noms('PLANNING').filter(n => n === 'AFFICHE A3').length, 1);
});

console.log('Lot 11.1 — ce programme ne sort pas du Sheet');
test('le programme du planning n’appelle ni Drive, ni mail, ni adresse extérieure, ni un autre classeur', () => {
  const code = fs.readFileSync(path.join(__dirname, '..', 'planning', 'Planning.gs'), 'utf8').replace(/\/\/.*$/gm, '');
  ['DriveApp', 'GmailApp', 'MailApp', 'UrlFetchApp', 'openById', 'openByUrl', 'ScriptApp', 'PropertiesService'].forEach(m => assert.ok(code.indexOf(m) < 0, m + ' ne doit pas apparaître dans Planning.gs'));
  const p = avecSemaine();
  p.ctx.plgCreerSuivante_(p.ss); p.ctx.plgAffiche_(p.ss); p.ctx.plgVerifier_(p.ss);
  egal([Object.keys(p.g.fichiers).length, p.g.exports.length, p.g.crees.length, p.g.classeurs.PLANNING.ouvertures], [0, 0, 0, 0]);
});
test('aucun nom réel, aucun identifiant, aucune adresse dans les fichiers du planning (le dépôt est public)', () => {
  ['Regles.gs', 'Affiche.gs', 'Planning.gs', 'Publication.gs'].forEach(f => {
    const code = fs.readFileSync(path.join(__dirname, '..', 'planning', f), 'utf8');
    assert.ok(!/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/.test(code), f + ' : une adresse e-mail');
    assert.ok(!/[-\w]{40,}/.test(code.replace(/═+/g, '')), f + ' : une longue chaîne qui ressemble à un identifiant Google');
  });
});

console.log('\n' + reussis + ' test(s) réussi(s)' + (process.exitCode ? ' — DES TESTS ONT ÉCHOUÉ' : ''));
