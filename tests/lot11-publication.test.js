// Tests du lot 11.1 — le PROGRAMME DE PUBLICATION (planning/Publication.gs) dans un faux Google, puis DE BOUT EN BOUT avec le
// vrai serveur de l'appli (lot 12 : les chantiers du planning mis en favoris) : node tests/lot11-publication.test.js
// Tous les noms sont inventés. Rien n'est envoyé nulle part.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { creerFaux, charger } = require('./faux-google-planning');
const { creerGoogle, chargerScript } = require('./gas-harness');

const j = x => JSON.stringify(x);
const egal = (a, b, m) => assert.strictEqual(j(a), j(b), m);
let reussis = 0;
function test(nom, fn) {
  try { fn(); reussis++; console.log('  ✓ ' + nom); }
  catch (e) { console.log('  ✗ ' + nom + '\n    ' + String(e.stack || e.message).split('\n').slice(0, 7).join('\n    ')); process.exitCode = 1; }
}
const JEUDI = Date.UTC(2026, 10, 19, 15, 10);          // jeudi 19/11/2026, 16 h 10 à Paris : la semaine en cours est 2026-S47 (lundi 16/11)
const JOUR = 86400000;
const LISTES = () => [
  ['N°', 'Chantier', 'Nom court (affiche)', 'Liste de saisie', '', 'Véhicule', 'Couleur', '', 'Autres cas', '', 'Tâches', '', 'Liste des chantiers', 'jamais mise à jour'],
  ['0501', 'CHANTIER TEST 1', 'Test 1', '0501 CHANTIER TEST 1', '', 'Plateau 1', '#FFE0B2', '', 'Absent', '', '', '', 'Mettre à jour maintenant', false],
  ['0502', 'CHANTIER TEST 2', '', '0502 CHANTIER TEST 2', '', 'Fourgon 2', '#C8E6C9', '', 'Congés', '', '', '', '', ''],
  ['901', 'CHANTIER 901', '', '901 CHANTIER 901', '', '', '', '', 'École', '', '', '', '', ''],
];
const SALARIES = () => [['Nom', 'Équipe', 'Véhicule habituel', 'Compte de l’appli'], ['Kévin E.', 'Pose', 'Plateau 1', 'kevin'], ['Thomas E.', 'Pose', 'Fourgon 2', 'thomas27'], ['Sans C.', 'Pose', '', ''], ['Marc E.', 'Atelier', '', 'atelier1']];
const CHANTIERS_APPLI = () => [['Nom', 'Référence', 'Statut', 'Conducteur', 'N°', 'Nom court'],
  ['CHANTIER TEST 1', 'LIEU 1', 'En cours', 'Sébastien ESSAI', '0501', 'Test un'], ['CHANTIER TEST 2', 'LIEU 2', 'En cours', 'Franck ESSAI', '0502', 'Test deux'],
  ['CHANTIER FINI', 'LIEU 3', 'Terminé', '', '0503', ''], ['CHANTIER 901', 'LIEU 9', 'En cours', '', '901', ''], ['CHANTIER NEUF', 'LIEU 10', 'En cours', '', '0510', '']];
const semaineModele = lundi => ({ lundi: lundi, publier: false, etat: '',
  pose: [{ nom: 'Kévin E.', vehicule: 'Plateau 1', jours: ['0501 CHANTIER TEST 1', '0501 CHANTIER TEST 1', '½ 0501 CHANTIER TEST 1\n½ 0502 CHANTIER TEST 2', 'Absent', 'Mr DUPONT'], vehiculesJour: ['', '', 'Fourgon 2', '', ''] },
    { nom: 'Sans C.', vehicule: '', jours: ['901 CHANTIER 901', '', '', '', ''], vehiculesJour: ['', '', '', '', ''] },
    { nom: 'Thomas E.', vehicule: 'Fourgon 2', jours: ['901 CHANTIER 901', 'Congés', '', '', ''], vehiculesJour: ['', '', '', '', ''] }],
  atelier: [{ nom: 'Marc E.', jours: ['Huisseries 0501', '', '', '', ''] }] });

function monde(o = {}) {
  const g = creerFaux({ maintenant: JEUDI,
    classeurs: { PLANNING: { nom: 'Planning Loué', onglets: { 'LISTES': LISTES(), 'SALARIÉS': SALARIES() } }, APPLI: { nom: 'ChantierPro', onglets: { 'Chantiers': CHANTIERS_APPLI(), 'Utilisateurs': [['Identifiant']] } } },
    dossiers: { DOSSIER: 'Planning', SAUV: 'Sauvegardes du planning' }, actif: 'PLANNING',
    proprietes: Object.assign({ PLANNING_ID: 'PLANNING', APPLI_SHEET_ID: 'APPLI', DOSSIER_PLANNING_ID: 'DOSSIER' }, o.proprietes || {}) });
  const ctx = charger(g, ['Regles.gs', 'Affiche.gs', 'Planning.gs', 'Publication.gs']);
  const ss = g.classeurs.PLANNING.api;
  const m = { g: g, ctx: ctx, ss: ss };
  m.creer = (lundi, modele) => { const sh = ss.insertSheet(ctx.plNomOnglet_(lundi), 0); ctx.plgEcrireSemaine_(ss, sh, modele || semaineModele(lundi), ctx.plgListes_(ss)); return sh; };
  m.f = nom => g.onglet('PLANNING', nom);
  m.cocher = nom => { m.f(nom).api.getRange(2, 2).setValue(true); };
  m.etat = nom => m.f(nom).lignes[1][2];
  m.coche = nom => m.f(nom).lignes[1][1];
  m.pdf = () => g.fichiersDe('DOSSIER').map(f => f.nom).sort();
  m.appli = () => m.f('APPLI').lignes.slice(1).filter(l => l[0]).map(l => l.slice(0, 5));
  m.ecrituresAppli = () => g.classeurs.APPLI.onglets.reduce((n, f) => n + f.ecritures, 0);
  (o.semaines || ['2026-11-16']).forEach(l => m.creer(l));
  return m;
}

console.log('Lot 11.1 — le passage de 10 minutes');
test('rien de coché : « rien à faire », aucun fichier, aucun classeur provisoire, le Sheet de l’appli n’est même pas ouvert', () => {
  const m = monde();
  egal(m.ctx.passagePublication(), 'rien à faire');
  egal([m.pdf(), m.g.crees.length, m.g.classeurs.APPLI.ouvertures, m.g.exports.length], [[], 0, 0, 0]);
  egal(m.etat('2026-S47'), 'Pas encore publié');
});
test('sans réglage (PLANNING_ID absent) : « pas réglé », rien ne se passe ; serveur occupé : « occupé »', () => {
  const m = monde(); delete m.g.proprietes.PLANNING_ID; m.cocher('2026-S47');
  egal(m.ctx.passagePublication(), 'pas réglé');
  m.g.proprietes.PLANNING_ID = 'PLANNING'; m.g.verrouOccupe = true;
  egal(m.ctx.passagePublication(), 'occupé');
  egal(m.pdf(), []);
});
test('« Publier » coché : le PDF est dans le dossier Planning, au nom clair ; la case est décochée ; l’état dit « Publié le 19/11 à 16 h 10 »', () => {
  const m = monde(); m.cocher('2026-S47');
  egal(m.ctx.passagePublication(), '2026-S47 : publiée');
  egal(m.pdf(), ['Planning S47 du 16 au 20-11.pdf']);
  egal([m.coche('2026-S47'), m.etat('2026-S47')], [false, 'Publié le 19/11 à 16 h 10']);
  // l'export : l'onglet du classeur provisoire, en A4 paysage, avec le jeton du compte de Loué
  egal(m.g.exports.length, 1);
  assert.ok(/\/spreadsheets\/d\/classeur\d+\/export\?format=pdf&gid=\d+&size=A4&portrait=false/.test(m.g.exports[0].url), m.g.exports[0].url);
  egal(m.g.exports[0].entetes.Authorization, 'Bearer jeton-faux');
  // le classeur provisoire est à la corbeille, et il contenait bien l'affiche compacte
  egal(m.g.crees.map(id => m.g.fichiers[id].corbeille), [true]);
  const affiche = m.g.classeurs[m.g.crees[0]].onglets[0].lignes;
  egal(affiche[0][0], 'PLANNING LOUÉ — Semaine 47 — du 16 au 20/11/2026');
  egal(affiche[3].slice(0, 5), ['Plateau 1', 'Kévin E.', '0501 Test 1', '0501 Test 1', '½ 0501 Test 1 / ½ 0502 CHANTIER TEST 2 [Fou.]']);
});
test('… et l’onglet APPLI dit à l’appli qui est planifié où (pose seulement, gars avec un compte, chantiers à numéro)', () => {
  const m = monde(); m.cocher('2026-S47'); m.ctx.passagePublication();
  egal(m.f('APPLI').lignes[0].slice(0, 5), ['Sorte', 'Lundi', 'Compte', 'N° du chantier', 'Publié le']);
  egal(m.f('APPLI').lignes[0][7], String(JEUDI), 'H1 : la marque que l’appli compare');
  egal(m.appli(), [['SEMAINE', '2026-11-16', '', '', '19/11 à 16 h 10'], ['PLANIFIE', '2026-11-16', 'kevin', '0501', '19/11 à 16 h 10'],
    ['PLANIFIE', '2026-11-16', 'kevin', '0502', '19/11 à 16 h 10'], ['PLANIFIE', '2026-11-16', 'thomas27', '901', '19/11 à 16 h 10']]);
});
test('republier après un changement : le nouveau PDF remplace l’ancien (corbeille) ; un fichier posé à la main dans le dossier n’est jamais touché', () => {
  const m = monde(); m.cocher('2026-S47'); m.ctx.passagePublication();
  const premier = m.g.fichiersDe('DOSSIER')[0].id;
  m.g.fichiers.main = { id: 'main', nom: 'Planning S47 du 16 au 20-11.pdf', contenu: 'posé à la main', mime: 'application/pdf', corbeille: false, dossier: 'DOSSIER' };
  m.f('2026-S47').api.getRange(5, 4).setValue('0502 CHANTIER TEST 2');
  m.g.maintenant += 20 * 60000; m.cocher('2026-S47');
  egal(m.ctx.passagePublication(), '2026-S47 : publiée');
  egal([m.g.fichiers[premier].corbeille, m.g.fichiers.main.corbeille, m.g.fichiersDe('DOSSIER').length], [true, false, 2]);
  egal(m.etat('2026-S47'), 'Publié le 19/11 à 16 h 30');
  egal(m.appli().filter(l => l[0] === 'SEMAINE').length, 1, 'une seule ligne SEMAINE par semaine');
  assert.notStrictEqual(m.f('APPLI').lignes[0][7], String(JEUDI), 'la marque a changé');
});
test('semaine modifiée après sa publication : l’état prévient (« les gars voient encore l’ancienne version ») ; remise comme avant : l’avertissement part', () => {
  const m = monde(); m.cocher('2026-S47'); m.ctx.passagePublication();
  egal(m.ctx.passagePublication(), 'rien à faire'); egal(m.etat('2026-S47'), 'Publié le 19/11 à 16 h 10');
  m.f('2026-S47').api.getRange(5, 7).setValue('0502 CHANTIER TEST 2');
  m.ctx.passagePublication();
  assert.ok(/^⚠ Modifié depuis la publication du 19\/11 à 16 h 10 .*Recoche « Publier »/.test(m.etat('2026-S47')), m.etat('2026-S47'));
  egal(m.pdf().length, 1, 'rien n’est republié tout seul');
  m.f('2026-S47').api.getRange(5, 7).setValue('Mr DUPONT');
  m.ctx.passagePublication();
  egal(m.etat('2026-S47'), 'Publié le 19/11 à 16 h 10');
});
test('la semaine en cours et la suivante publiées : deux PDF, deux semaines dans l’onglet APPLI', () => {
  const m = monde({ semaines: ['2026-11-16', '2026-11-23'] });
  m.cocher('2026-S47'); m.cocher('2026-S48');
  egal(m.ctx.passagePublication(), '2026-S47 : publiée ; 2026-S48 : publiée');
  egal(m.pdf(), ['Planning S47 du 16 au 20-11.pdf', 'Planning S48 du 23 au 27-11.pdf']);
  egal(m.appli().filter(l => l[0] === 'SEMAINE').map(l => l[1]), ['2026-11-16', '2026-11-23']);
  egal(m.g.crees.every(id => m.g.fichiers[id].corbeille), true);
});
test('une semaine passée cochée par erreur n’est pas publiée ; une semaine trop lointaine (plus de 5 semaines) non plus', () => {
  const m = monde({ semaines: ['2026-11-09', '2026-11-16', '2027-01-04'] });
  m.cocher('2026-S46'); m.cocher('2027-S01');
  egal(m.ctx.passagePublication(), '2026-S46 : semaine passée');
  egal([m.pdf(), m.coche('2026-S46'), m.coche('2027-S01')], [[], false, true]);
  assert.ok(/Semaine passée/.test(m.etat('2026-S46')));
});
test('onglet illisible (colonne H effacée) : pas publié, la case est décochée, l’état dit quoi faire', () => {
  const m = monde(); m.cocher('2026-S47');
  m.f('2026-S47').lignes.forEach((l, i) => { if (i > 1) l[7] = ''; });
  egal(m.ctx.passagePublication(), '2026-S47 : illisible');
  egal([m.pdf(), m.coche('2026-S47')], [[], false]);
  assert.ok(/Onglet illisible.*Vérifier la semaine/.test(m.etat('2026-S47')), m.etat('2026-S47'));
});

console.log('Lot 11.1 — quand Google fait défaut');
test('l’adresse d’export répond une erreur (ou n’existe plus) : la méthode officielle prend le relais, le PDF est publié quand même', () => {
  ['code', 'exception'].forEach(cas => {
    const m = monde(); m.cocher('2026-S47');
    if (cas === 'code') m.g.exportCode = 500; else m.g.exportErreur = 'Address unavailable';
    egal(m.ctx.passagePublication(), '2026-S47 : publiée', cas);
    egal(m.pdf(), ['Planning S47 du 16 au 20-11.pdf']);
    assert.ok(/^PDF officiel de Planning \(provisoire\)/.test(m.g.fichiersDe('DOSSIER')[0].contenu), m.g.fichiersDe('DOSSIER')[0].contenu);
    egal(m.g.crees.map(id => m.g.fichiers[id].corbeille), [true]);
  });
});
test('le dossier Planning est indisponible : l’état le dit, la case reste cochée (nouvel essai) ; au 3e échec elle est décochée ; jamais de classeur provisoire oublié', () => {
  const m = monde(); m.cocher('2026-S47'); m.g.dossiers.DOSSIER.enPanne = true;
  egal(m.ctx.passagePublication(), '2026-S47 : échec');
  assert.ok(/^⚠ Pas encore publié \(Dossier introuvable\) : nouvel essai dans 10 minutes/.test(m.etat('2026-S47')), m.etat('2026-S47'));
  egal(m.coche('2026-S47'), true);
  m.ctx.passagePublication();
  egal(m.coche('2026-S47'), true);
  m.ctx.passagePublication();
  egal(m.coche('2026-S47'), false);
  assert.ok(/^⚠ Publication impossible .*Dépose le PDF à la main/.test(m.etat('2026-S47')), m.etat('2026-S47'));
  egal([m.g.crees.length, m.g.crees.every(id => m.g.fichiers[id].corbeille)], [3, true]);
  egal(m.f('APPLI'), null, 'rien n’est annoncé à l’appli tant que le PDF n’est pas déposé');
  // le dossier revient : en recochant, la publication passe
  m.g.dossiers.DOSSIER.enPanne = false; m.cocher('2026-S47');
  egal(m.ctx.passagePublication(), '2026-S47 : publiée');
});
test('une semaine en échec n’empêche pas la suivante d’être publiée', () => {
  const m = monde({ semaines: ['2026-11-16', '2026-11-23'] });
  m.cocher('2026-S47'); m.cocher('2026-S48');
  m.f('2026-S47').lignes.forEach((l, i) => { if (i > 1) l[7] = ''; });
  egal(m.ctx.passagePublication(), '2026-S47 : illisible ; 2026-S48 : publiée');
  egal(m.pdf(), ['Planning S48 du 23 au 27-11.pdf']);
});
test('copie de sauvegarde : dans un AUTRE dossier si elle est réglée ; jamais si c’est le dossier Planning lui-même', () => {
  const m = monde({ proprietes: { DOSSIER_SAUVEGARDE_ID: 'SAUV' } }); m.cocher('2026-S47'); m.ctx.passagePublication();
  egal(m.g.fichiersDe('SAUV').map(f => f.nom), ['Planning S47 du 16 au 20-11 (publié le 2026-11-19).pdf']);
  const n = monde({ proprietes: { DOSSIER_SAUVEGARDE_ID: 'DOSSIER' } }); n.cocher('2026-S47'); n.ctx.passagePublication();
  egal(n.pdf(), ['Planning S47 du 16 au 20-11.pdf']);
  assert.ok(/❌ Copie de sauvegarde : c’est le même dossier/.test(n.ctx.verifierPublication()));
});

console.log('Lot 11.1 — chaque nuit');
test('la liste des chantiers est recopiée de l’appli : chantiers non terminés à numéro ; nom court du planning gardé, sinon celui de l’appli ; liste de saisie refaite', () => {
  const m = monde();
  const r = m.ctx.passageDeNuit();
  assert.ok(/liste des chantiers : 4 chantiers/.test(r), r);
  const li = m.f('LISTES').lignes;
  egal(li.slice(1, 5).map(l => l.slice(0, 3)), [['0501', 'CHANTIER TEST 1', 'Test 1'], ['0502', 'CHANTIER TEST 2', 'Test deux'], ['0510', 'CHANTIER NEUF', ''], ['901', 'CHANTIER 901', '']]);
  egal(li.slice(1, 8).map(l => l[3]), ['0501 CHANTIER TEST 1', '0502 CHANTIER TEST 2', '0510 CHANTIER NEUF', '901 CHANTIER 901', 'Absent', 'Congés', 'École']);
  egal(li[0][13], 'à jour du 19/11 à 16 h 10 (4 chantiers)');
  egal(li.slice(1, 3).map(l => [l[5], l[6], l[8]]), [['Plateau 1', '#FFE0B2', 'Absent'], ['Fourgon 2', '#C8E6C9', 'Congés']], 'véhicules et autres cas intacts');
});
test('le Sheet de l’appli est SEULEMENT LU : aucune écriture, jamais, quoi que fasse le programme', () => {
  const m = monde({ semaines: ['2026-11-16', '2026-11-23'] });
  m.cocher('2026-S47'); m.ctx.passagePublication(); m.ctx.passageDeNuit();
  m.f('LISTES').api.getRange(2, 14).setValue(true); m.ctx.passagePublication(); m.ctx.verifierPublication();
  egal(m.ecrituresAppli(), 0);
  assert.ok(m.g.classeurs.APPLI.ouvertures >= 3);
  // dans le programme : une seule fonction ouvre le Sheet de l'appli
  const code = fs.readFileSync(path.join(__dirname, '..', 'planning', 'Publication.gs'), 'utf8').replace(/\/\/.*$/gm, '');
  egal((code.match(/pubProp_\(PUB_PROP\.appli\)/g) || []).length, 1);
  assert.ok(/function pubLireAppli_\(onglet, nbCol, facultatif\) \{[^}]*pubProp_\(PUB_PROP\.appli\)/.test(code));
  assert.ok(!/GmailApp|MailApp/.test(code), 'aucun mail');
});
test('liste illisible (Sheet de l’appli indisponible, onglet absent, ou liste vide) : l’ancienne liste est gardée, l’état le dit, le reste de la nuit se fait', () => {
  const pannes = [m => { m.g.classeurs.APPLI.enPanne = true; }, m => { m.g.classeurs.APPLI.onglets = m.g.classeurs.APPLI.onglets.filter(o => o.nom !== 'Chantiers'); },
    m => { m.g.onglet('APPLI', 'Chantiers').lignes.length = 1; }, m => { delete m.g.proprietes.APPLI_SHEET_ID; }];
  pannes.forEach((panne, i) => {
    const m = monde(); panne(m);
    const avant = j(m.f('LISTES').lignes.slice(1).map(l => l.slice(0, 4)));
    const r = m.ctx.passageDeNuit();
    assert.ok(/liste des chantiers : ⚠/.test(r) && /historique : 0 semaine/.test(r), i + ' : ' + r);
    egal(j(m.f('LISTES').lignes.slice(1).map(l => l.slice(0, 4))), avant, 'panne ' + i);
    assert.ok(/^⚠ pas mise à jour le 19\/11 à 16 h 10 .*l’ancienne liste est gardée/.test(m.f('LISTES').lignes[0][13]), m.f('LISTES').lignes[0][13]);
  });
});
test('case « Mettre à jour maintenant » de LISTES : la liste est refaite au passage de 10 minutes, la case est décochée', () => {
  const m = monde();
  m.f('LISTES').api.getRange(2, 14).setValue(true);
  egal(m.ctx.passagePublication(), 'liste : 4 chantiers');
  egal([m.f('LISTES').lignes[1][13], m.f('LISTES').lignes[3][1]], [false, 'CHANTIER NEUF']);
  m.g.classeurs.APPLI.enPanne = true; m.f('LISTES').api.getRange(2, 14).setValue(true);
  assert.ok(/^liste : ⚠/.test(m.ctx.passagePublication()));
  egal(m.f('LISTES').lignes[1][13], false, 'décochée même en cas d’échec (pas d’essai sans fin)');
});
test('le lundi suivant, le PDF de la semaine terminée sort du dossier (corbeille) ; ceux des semaines en cours restent ; un fichier posé à la main n’est jamais touché', () => {
  const m = monde({ semaines: ['2026-11-16', '2026-11-23'] });
  m.cocher('2026-S47'); m.cocher('2026-S48'); m.ctx.passagePublication();
  m.g.fichiers.main = { id: 'main', nom: 'Planning S47 à la main.pdf', contenu: '', mime: 'application/pdf', corbeille: false, dossier: 'DOSSIER' };
  m.g.maintenant = JEUDI + 2 * JOUR; assert.ok(/0 retiré/.test(m.ctx.passageDeNuit()), 'samedi : rien');
  m.g.maintenant = JEUDI + 4 * JOUR;
  assert.ok(/PDF des semaines terminées : 1 retiré/.test(m.ctx.passageDeNuit()), 'lundi 23/11');
  egal(m.pdf(), ['Planning S47 à la main.pdf', 'Planning S48 du 23 au 27-11.pdf']);
  assert.ok(/0 retiré/.test(m.ctx.passageDeNuit()), 'une seule fois');
});
test('une semaine de plus de deux mois va dans HISTORIQUE (une ligne par gars) et son onglet est supprimé ; les semaines récentes restent', () => {
  const m = monde({ semaines: ['2026-09-07', '2026-11-16'] });
  const r = m.ctx.passageDeNuit();
  assert.ok(/historique : 1 semaine\(s\) rangée\(s\)/.test(r), r);
  egal(m.g.noms('PLANNING').filter(n => /^\d{4}-S/.test(n)), ['2026-S47']);
  const h = m.f('HISTORIQUE').lignes;
  egal(h[0].slice(0, 4), ['Lundi', 'Équipe', 'Nom', 'Lundi']);
  egal(h.slice(1).map(l => l.slice(0, 3)), [['2026-09-07', 'Pose', 'Kévin E.'], ['2026-09-07', 'Pose', 'Sans C.'], ['2026-09-07', 'Pose', 'Thomas E.'], ['2026-09-07', 'Atelier', 'Marc E.']]);
  egal(h[1].slice(3, 6), ['0501 CHANTIER TEST 1', '0501 CHANTIER TEST 1', '½ 0501 CHANTIER TEST 1 / ½ 0502 CHANTIER TEST 2']);
});
test('… une vieille semaine illisible n’est PAS supprimée ; l’historique de plus de 12 mois est effacé', () => {
  const m = monde({ semaines: ['2026-09-07', '2026-08-31', '2026-11-16'] });
  m.f('2026-S36').lignes.forEach((l, i) => { if (i > 1) l[7] = ''; });
  const hs = m.ss.insertSheet('HISTORIQUE', 9);
  hs.getRange(1, 1, 4, 8).setValues([['Lundi', 'Équipe', 'Nom', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'],
    ['2025-11-10', 'Pose', 'Ancien A.', 'x', '', '', '', ''], ['2025-11-17', 'Pose', 'Ancien A.', 'x', '', '', '', ''], ['2025-11-24', 'Pose', 'Ancien A.', 'y', '', '', '', '']]);
  const r = m.ctx.passageDeNuit();
  assert.ok(/1 semaine\(s\) rangée\(s\), 2 ligne\(s\) de plus de 12 mois effacée\(s\)/.test(r), r);
  egal(m.g.noms('PLANNING').filter(n => /^\d{4}-S/.test(n)).sort(), ['2026-S36', '2026-S47']);
  egal(m.f('HISTORIQUE').lignes.slice(1).map(l => l[0]), ['2025-11-24', '2026-09-07', '2026-09-07', '2026-09-07', '2026-09-07']);
});

console.log('Lot 11.1 — installer et vérifier');
test('installerPublication pose les deux minuteries, une seule fois ; verifierPublication dit ce qui est réglé ; arreterPublication les retire', () => {
  const m = monde();
  m.ctx.installerPublication(); const texte = m.ctx.installerPublication();
  egal(m.g.declencheurs.map(t => [t.fonction, t.regle]), [['passagePublication', ['minutes:10']], ['passageDeNuit', ['heure:3', 'jours:1']]]);
  ['✅ Planning (PLANNING_ID) : « Planning Loué », 1 semaine(s)', '✅ Sheet de l’appli (APPLI_SHEET_ID), lu seulement : 5 ligne(s)', '✅ Dossier « Planning » de l’appli (DOSSIER_PLANNING_ID) : « Planning »',
    '• Copie de sauvegarde (DOSSIER_SAUVEGARDE_ID) : pas réglée', '✅ Minuterie passagePublication : posée', '✅ Minuterie passageDeNuit : posée'].forEach(l => assert.ok(texte.indexOf(l) > -1, l + '\n' + texte));
  egal(m.ctx.arreterPublication(), '2 minuterie(s) retirée(s)');
  egal(m.g.declencheurs.length, 0);
  const n = monde(); delete n.g.proprietes.DOSSIER_PLANNING_ID; n.g.classeurs.APPLI.enPanne = true;
  const t2 = n.ctx.verifierPublication();
  assert.ok(/❌ Sheet de l’appli/.test(t2) && /❌ Dossier « Planning »/.test(t2) && /❌ Minuterie passagePublication : absente/.test(t2), t2);
  egal([n.pdf(), n.g.declencheurs.length], [[], 0], 'vérifier ne modifie rien');
});

console.log('Lot 11.1 — de bout en bout : le planning publié, lu par le VRAI serveur de l’appli (lot 12)');
test('le serveur de l’appli lit l’onglet APPLI écrit par la publication : les chantiers arrivent en « planifié » pour le bon compte, et l’appli n’écrit rien dans le planning', () => {
  const m = monde({ semaines: ['2026-11-16', '2026-11-23'] });
  m.cocher('2026-S47'); m.cocher('2026-S48'); m.ctx.passagePublication();
  // L'appli, avec son propre faux Google ; son « planning » est l'onglet APPLI que la publication vient d'écrire
  const lignesAppli = m.f('APPLI').lignes.map(l => Array.from({ length: 8 }, (_, i) => (l[i] === undefined ? '' : l[i])));
  const a = creerGoogle({ nomSheet: 'ChantierPro', proprietes: { DRIVE_ROOT_ID: 'RACINE', DRIVE_PLANNING_ID: 'PLANNING', HACHAGE_ITERATIONS: '200', PLANNING_SHEET_ID: 'PLAN' },
    feuilles: { 'Contacts': [['Nom', 'Role', 'Email', 'ChefEquipe', 'Destinataire', 'ConducteurDefaut', 'ChefAtelier', 'absenceNotif'], ['Franck ESSAI', 'Conducteur de travaux', 'franck@loue.test', 'O', 'N', 'O', 'N', 'O']],
      'Contacts notes': [['Nom', 'Email']], 'Chantiers': CHANTIERS_APPLI().map(l => l.slice(0, 5)) },
    classeurs: { PLAN: { 'APPLI': lignesAppli } } });
  a.creerElement('dossier', 'Loué Menuiserie - Chantiers', null, { id: 'RACINE' }); a.creerElement('dossier', 'Planning', null, { id: 'PLANNING' });
  a.ctx = chargerScript(a);
  a.now = JEUDI; a.ctx.maintenant_ = () => a.now;
  a.ctx.genererCle(); a.ctx.preparerOngletsLot2();
  const u = a.feuilles['Utilisateurs'];
  u.lignes[1] = ['kevin', 'Kévin ESSAI', 'Poseur', true, false, '', '', false, false, ''];
  u.lignes[2] = ['thomas27', 'Thomas ESSAI', 'Poseur', true, false, '', '', false, false, ''];
  a.ctx.traiterComptes(); a.ctx.installerLot12Production();
  a.now += 31 * 60000;
  // (le passage de l'appli a déjà lu le planning une première fois pendant traiterComptes : celui-ci le trouve « inchangé »)
  assert.ok(/^(lu|inchangé)/.test(a.ctx.planifPassage_()), 'le passage de l’appli lit le planning');
  const planifies = a.feuilles['Planifiés'].lignes.slice(1).filter(l => l[0]).map(l => l.slice(0, 5));
  egal(planifies.map(l => [l[0], l[1], l[3], l[4]]).sort(), [['kevin', '0501', '2026-11-16', '2026-11-23'], ['kevin', '0502', '2026-11-16', '2026-11-23'], ['thomas27', '901', '2026-11-16', '2026-11-23']]);
  egal(Object.values(a.classeurs.PLAN.feuilles).reduce((n, f) => n + (f.ecritures || 0), 0), 0, 'l’appli n’écrit jamais dans le planning');
});

console.log('\n' + reussis + ' test(s) réussi(s)' + (process.exitCode ? ' — DES TESTS ONT ÉCHOUÉ' : ''));
