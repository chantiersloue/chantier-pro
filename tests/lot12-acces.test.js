// Tests du lot 12, côté serveur : node tests/lot12-acces.test.js
//   - le réglage « Tous les comptes ouvrent tous les chantiers » (onglet Réglages), livré éteint ;
//   - les chantiers du planning mis en favoris (onglet Planifiés), éteint tant que le planning n'existe pas.
// Le VRAI code d'apps-script/ tourne avec les services Google simulés (tests/gas-harness.js) : rien ne part chez Google.
// Noms, chantiers et adresses : tous fictifs (dépôt public).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { creerGoogle, chargerScript } = require('./gas-harness');
const VERSION_SERVEUR = (/VERSION_API = '([^']+)'/.exec(fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Config.gs'), 'utf8')) || [])[1];

const REGLAGE = 'Tous les comptes ouvrent tous les chantiers';
const MERCREDI = new Date(2026, 10, 25, 10, 0, 0).getTime();     // mercredi 25/11/2026, 10 h : la semaine en cours commence le lundi 23/11
const S47 = '2026-11-16', S48 = '2026-11-23', S49 = '2026-11-30', S50 = '2026-12-07', S51 = '2026-12-14';
const ENTETE_PLANNING = marque => ['Sorte', 'Lundi', 'Compte de l’appli', 'N° du chantier', 'Publié le', '', 'Dernière mise à jour', marque];

function environnement(options = {}) {
  const g = creerGoogle({
    nomSheet: options.test ? 'ChantierPro TEST' : 'ChantierPro',
    proprietes: Object.assign({ DRIVE_ROOT_ID: 'RACINE', DRIVE_PLANNING_ID: 'PLANNING', HACHAGE_ITERATIONS: '200' },
      options.test ? { ENVIRONNEMENT: 'TEST' } : {}, options.planning ? { PLANNING_SHEET_ID: 'PLAN' } : {}),
    feuilles: {
      'Contacts': [['Nom', 'Role', 'Email', 'ChefEquipe', 'Destinataire', 'ConducteurDefaut', 'ChefAtelier', 'absenceNotif'],
        ['Franck ESSAI', 'Conducteur de travaux', 'franck@loue.test', 'O', 'N', 'O', 'N', 'O'],
        ['Sébastien ESSAI', 'Conducteur de travaux', 'seb@loue.test', 'O', 'N', 'N', 'N', 'N']],
      'Contacts notes': [['Nom', 'Email']],
      'Chantiers': [['Nom', 'Référence', 'Statut', 'Conducteur', 'N°'],
        ['CHANTIER TEST 1', 'LIEU 1', 'En cours', 'Sébastien ESSAI', '0501'],
        ['CHANTIER TEST 2', 'LIEU 2', 'En cours', 'Franck ESSAI', '0502'],
        ['CHANTIER FINI', 'LIEU 3', 'Terminé', 'Sébastien ESSAI', '0503'],
        ['CHANTIER TEST 4', 'LIEU 4', 'En cours', 'Franck ESSAI', '0504'],
        ['CHANTIER TEST 5', 'LIEU 5', 'En cours', 'Franck ESSAI', '0505'],
        ['CHANTIER TEST 6', 'LIEU 6', 'En cours', 'Franck ESSAI', '0506'],
        ['CHANTIER TEST 7', 'LIEU 7', 'En cours', 'Franck ESSAI', '0507'],
        ['CHANTIER 90', 'LIEU 8', 'En cours', 'Franck ESSAI', '90'],
        ['CHANTIER 901', 'LIEU 9', 'En cours', 'Franck ESSAI', '901'],
        ['CHANTIER DOUBLE A', 'LIEU 10', 'En cours', 'Franck ESSAI', '0600'],
        ['CHANTIER DOUBLE B', 'LIEU 11', 'En cours', 'Franck ESSAI', '0600']],
    },
    classeurs: options.planning ? { PLAN: { 'APPLI': [ENTETE_PLANNING('')], 'Autre onglet': [['x']] } } : {},
  });
  g.creerElement('dossier', 'Loué Menuiserie - Chantiers', null, { id: 'RACINE' });
  g.creerElement('dossier', 'Planning', null, { id: 'PLANNING' });
  g.ctx = options.codeGs ? chargerScript(g, path.join(__dirname, '..', 'A-COLLER-DANS-APPS-SCRIPT', 'Code.gs')) : chargerScript(g);
  g.now = MERCREDI;
  g.ctx.maintenant_ = () => g.now;
  g.ctx.genererCle(); g.ctx.preparerOngletsLot2();
  const u = g.feuilles['Utilisateurs'];
  u.lignes[1] = ['thomas27', 'Thomas ESSAI', 'Poseur', true, false, '', '', false, false, ''];
  u.lignes[2] = ['seb', 'Sébastien ESSAI', 'Conducteur', true, false, '', '', false, false, ''];
  u.lignes[3] = ['franck', 'Franck ESSAI', 'Admin', true, false, '', '', false, false, ''];
  u.lignes[4] = ['kevin', 'Kévin ESSAI', 'Poseur', true, false, '', '', false, false, ''];
  u.lignes[5] = ['atelier1', 'Marc ESSAI', 'Atelier', true, false, '', '', false, false, ''];
  u.lignes[6] = ['parti', 'Ancien ESSAI', 'Poseur', false, false, '', '', false, false, ''];
  g.ctx.traiterComptes();
  // Cases : thomas27 sur CHANTIER TEST 1 et CHANTIER FINI ; kevin et atelier1 sur rien
  const a = g.feuilles['Accès chantiers'], col = a.lignes[0].indexOf('thomas27');
  assert.ok(col > 1, 'colonne thomas27');
  a.lignes.forEach(l => { if (l[0] === 'CHANTIER TEST 1' || l[0] === 'CHANTIER FINI') l[col] = true; });
  g.ctx.installerLot3Production && !options.test && g.ctx.installerLot3Production();
  if (!options.sansInstallation) (options.test ? g.ctx.installerLot12Test : g.ctx.installerLot12Production)();
  g.mails.length = 0;
  return g;
}
const poster = (g, corps) => JSON.parse(g.ctx.doPost({ postData: { contents: JSON.stringify(corps) } }).contenu);
const jeton = (g, id) => g.ctx.fabriquerJeton_(id, 1);
const appel = (g, qui, corps) => poster(g, Object.assign({}, corps, qui ? { jeton: jeton(g, qui) } : {}));
const moi = (g, qui) => appel(g, qui, { action: 'moi' });
const noms = r => (r.data.chantiers || []).map(c => c.nom);
const R = g => g.feuilles['Réglages'];
const regler = (g, v) => { const l = R(g).lignes.find(x => x[0] === REGLAGE); l[1] = v; };
const j = x => JSON.stringify(x);
// Toutes les lectures « par chantier » d'un compte, d'un coup : vrai = le serveur accepte
const lectures = (g, qui, chantier) => ({
  notes: appel(g, qui, { action: 'notes', chantier: chantier }).ok,
  carnet: appel(g, qui, { action: 'carnet', chantier: chantier }).ok,
  dossiers: appel(g, qui, { action: 'dossiers', chantier: chantier }).ok,
  recap: appel(g, qui, { action: 'recapNotes', chantier: chantier }).ok,
});
const TOUT = { notes: true, carnet: true, dossiers: true, recap: true }, RIEN = { notes: false, carnet: false, dossiers: false, recap: false };
// Le planning : on pose son contenu directement (ce ne sont pas des écritures de l'appli)
const planning = (g, marque, lignes) => { g.classeurs.PLAN.feuilles['APPLI'].lignes = [ENTETE_PLANNING(marque)].concat(lignes); };
const semaine = (lundi, publie) => ['SEMAINE', lundi, '', '', publie || 'publié ' + lundi];
const planifie = (lundi, compte, numero) => ['PLANIFIE', lundi, compte, numero, ''];
const passage = (g, minutes) => { g.now += (minutes === undefined ? 31 : minutes) * 60000; return g.ctx.planifPassage_(); };
const P = g => (g.feuilles['Planifiés'] ? g.feuilles['Planifiés'].lignes.slice(1).filter(l => l[0]).map(l => l.slice(0, 5)) : []);
const aVoir = g => (g.feuilles['Planifiés'] ? g.feuilles['Planifiés'].lignes.slice(1).map(l => l[7]).filter(Boolean) : []);
const ecrituresPlanning = g => Object.values(g.classeurs.PLAN.feuilles).reduce((n, f) => n + (f.ecritures || 0), 0);
const planifies = (g, qui) => { const o = {}; moi(g, qui).data.chantiers.forEach(c => { if (c.planifie) o[c.nom] = c.planifie; }); return o; };

let reussis = 0;
function test(nom, fn) {
  try { fn(); reussis++; console.log('  ✓ ' + nom); }
  catch (e) { console.log('  ✗ ' + nom + '\n    ' + String(e.stack || e.message).split('\n').slice(0, 6).join('\n    ')); process.exitCode = 1; }
}

console.log('Lot 12a — le réglage est livré éteint : rien ne change');
test('sans onglet « Réglages » (serveur déployé, installation pas encore lancée) : exactement le comportement d’avant', () => {
  const g = environnement({ sansInstallation: true });
  assert.ok(!R(g));
  assert.deepStrictEqual(noms(moi(g, 'thomas27')), ['CHANTIER TEST 1'], 'ses cases, sans le chantier terminé');
  assert.deepStrictEqual(noms(moi(g, 'kevin')), []);
  assert.deepStrictEqual(lectures(g, 'thomas27', 'CHANTIER TEST 1'), TOUT);
  assert.deepStrictEqual(lectures(g, 'thomas27', 'CHANTIER TEST 2'), RIEN);
  assert.deepStrictEqual(lectures(g, 'kevin', 'CHANTIER TEST 1'), RIEN);
  assert.strictEqual(noms(moi(g, 'seb')).length, 11, 'conducteur : tout, comme avant');
});
test('installerLot12Production : crée l’onglet et la ligne, case DÉCOCHÉE ; relancée, ne touche à rien ; refuse sur la copie TEST', () => {
  const g = environnement({ sansInstallation: true });
  const t1 = g.ctx.installerLot12Production();
  assert.ok(/✅ 1\/1 Onglet « Réglages »[^\n]*: fait/.test(t1) && /installation terminée/.test(t1), t1);
  assert.strictEqual(j(R(g).lignes.map(l => l.slice(0, 3))), j([['Réglage', 'Allumé', 'État (écrit par l’appli)'], [REGLAGE, false, 'Éteint']]));
  regler(g, true);
  const t2 = g.ctx.installerLot12Production();
  assert.ok(/déjà fait/.test(t2) && R(g).lignes[1][1] === true && R(g).lignes.length === 2, 'relancée : la case cochée par Franck n’est pas décochée');
  const gTest = environnement({ test: true, sansInstallation: true });
  assert.ok(/Refusé/.test(gTest.ctx.installerLot12Production()) && !R(gTest));
  assert.ok(/installation terminée/.test(gTest.ctx.installerLot12Test()) && R(gTest).lignes[1][1] === false);
});
test('réglage installé et éteint : identique à avant ; les lectures d’un autre chantier restent refusées', () => {
  const g = environnement();
  assert.deepStrictEqual(noms(moi(g, 'thomas27')), ['CHANTIER TEST 1']);
  assert.deepStrictEqual(moi(g, 'thomas27').data.chantiers[0].mien, true);
  assert.deepStrictEqual(lectures(g, 'thomas27', 'CHANTIER TEST 2'), RIEN);
  assert.deepStrictEqual(noms(appel(g, 'thomas27', { action: 'listes' })), ['CHANTIER TEST 1']);
});

console.log('Lot 12a — réglage allumé');
test('poseur : tous les chantiers, « Terminé » compris (avec son statut) ; « mien » seulement pour ses cases non terminées', () => {
  const g = environnement();
  regler(g, true);
  const r = moi(g, 'thomas27');
  assert.strictEqual(noms(r).length, 11, j(noms(r)));
  assert.deepStrictEqual(r.data.chantiers.filter(c => c.mien).map(c => c.nom), ['CHANTIER TEST 1']);
  assert.strictEqual(r.data.chantiers.find(c => c.nom === 'CHANTIER FINI').statut, 'Terminé');
  assert.deepStrictEqual(r.data.chantiers.filter(c => c.mien).length, 1);
  assert.strictEqual(noms(moi(g, 'kevin')).length, 11);
  assert.strictEqual(moi(g, 'kevin').data.chantiers.filter(c => c.mien).length, 0);
  assert.strictEqual(moi(g, 'thomas27').data.profil.tous, false, 'le profil ne change pas (le téléchargement des plans en Wi-Fi non plus)');
});
test('poseur et atelier : toutes les lectures d’un chantier sont ouvertes, sur tout chantier de la liste (terminé compris)', () => {
  const g = environnement();
  regler(g, true);
  ['thomas27', 'kevin', 'atelier1'].forEach(qui => ['CHANTIER TEST 1', 'CHANTIER TEST 2', 'CHANTIER FINI'].forEach(ch =>
    assert.deepStrictEqual(lectures(g, qui, ch), TOUT, qui + ' / ' + ch)));
});
test('chantier inconnu, sans compte, compte inactif, jeton faux : toujours refusés', () => {
  const g = environnement();
  regler(g, true);
  assert.deepStrictEqual(lectures(g, 'kevin', 'CHANTIER QUI N’EXISTE PAS'), RIEN);
  assert.deepStrictEqual(lectures(g, '', 'CHANTIER TEST 1'), RIEN);
  assert.deepStrictEqual(lectures(g, 'parti', 'CHANTIER TEST 1'), RIEN);
  assert.ok(!moi(g, 'parti').ok && !moi(g, '').ok);
  assert.ok(!poster(g, { action: 'notes', chantier: 'CHANTIER TEST 1', jeton: 'kevin.1.9999999999999.faux' }).ok);
  g.feuilles['Utilisateurs'].lignes[4][3] = false;                 // kevin désactivé pendant que le réglage est allumé
  assert.deepStrictEqual(lectures(g, 'kevin', 'CHANTIER TEST 1'), RIEN);
});
test('les fiches ne proposent toujours pas un chantier « Terminé » à un poseur ; un conducteur garde sa liste entière', () => {
  const g = environnement();
  regler(g, true);
  const l = appel(g, 'kevin', { action: 'listes' });
  assert.ok(l.ok && noms(l).length === 10 && noms(l).indexOf('CHANTIER FINI') < 0 && l.data.partiel === true, j(noms(l)));
  assert.strictEqual(noms(appel(g, 'seb', { action: 'listes' })).length, 11);
});
test('conducteur et admin : rien ne change, allumé comme éteint', () => {
  const g = environnement();
  const avant = j([moi(g, 'seb').data.chantiers, moi(g, 'franck').data.chantiers]);
  regler(g, true);
  assert.strictEqual(j([moi(g, 'seb').data.chantiers, moi(g, 'franck').data.chantiers]), avant);
  assert.deepStrictEqual(moi(g, 'seb').data.chantiers.filter(c => c.mien).map(c => c.nom), ['CHANTIER TEST 1', 'CHANTIER FINI'], 'ses chantiers de conducteur (colonne D)');
});
test('signalements : les droits restent par RÔLE (un poseur ne change pas un statut, même réglage allumé)', () => {
  const g = environnement();
  regler(g, true);
  const r = appel(g, 'kevin', { action: 'signalementStatut', id: 'sig-inconnu', statut: 'Traité' });
  assert.ok(!r.ok && r.code === 'INTERDIT', j(r));
});
test('le réglage agit tout de suite, dans les deux sens ; les cases reprennent leur effet telles quelles', () => {
  const g = environnement();
  const cases = j(g.feuilles['Accès chantiers'].lignes);
  regler(g, true);
  assert.deepStrictEqual(lectures(g, 'kevin', 'CHANTIER TEST 2'), TOUT);
  regler(g, false);
  assert.deepStrictEqual(lectures(g, 'kevin', 'CHANTIER TEST 2'), RIEN);
  assert.deepStrictEqual(noms(moi(g, 'thomas27')), ['CHANTIER TEST 1']);
  assert.strictEqual(j(g.feuilles['Accès chantiers'].lignes), cases, 'aucune case n’a été touchée');
});
test('tout ce qui n’est pas « une seule ligne, case cochée » vaut ÉTEINT : texte « oui », « VRAI » en texte, deux lignes, ligne renommée', () => {
  const g = environnement();
  ['oui', 'VRAI', 'TRUE', 1, 'x'].forEach(v => { regler(g, v); assert.deepStrictEqual(lectures(g, 'kevin', 'CHANTIER TEST 2'), RIEN, String(v)); });
  regler(g, true);
  R(g).lignes.push([REGLAGE, true, '']);
  assert.deepStrictEqual(lectures(g, 'kevin', 'CHANTIER TEST 2'), RIEN, 'deux lignes');
  assert.ok(/plusieurs lignes/.test(g.ctx.installerLot12Production()), 'et l’installation le dit');
  R(g).lignes.pop();
  R(g).lignes[1][0] = 'Tous les comptes ouvrent tous les chantiers (désactivé)';
  assert.deepStrictEqual(lectures(g, 'kevin', 'CHANTIER TEST 2'), RIEN, 'ligne renommée');
});
test('le passage de 10 minutes écrit ce que l’appli a compris (onglet Réglages), et prévient dans l’onglet des cases ; ajouts de chantiers et de comptes intacts', () => {
  const g = environnement();
  const a = g.feuilles['Accès chantiers'];
  assert.strictEqual(a.lignes[0][1], 'Remarque (appli)');
  regler(g, true);
  assert.strictEqual(g.ctx.traiterComptes(), 'ok');
  assert.ok(/^Allumé depuis le 25\/11\/2026 10:00 : tout compte actif ouvre tous les chantiers$/.test(R(g).lignes[1][2]), R(g).lignes[1][2]);
  assert.ok(/CASES SANS EFFET/.test(a.lignes[0][1]), a.lignes[0][1]);
  const etat = R(g).lignes[1][2];
  g.now += 600000; g.ctx.traiterComptes();
  assert.strictEqual(R(g).lignes[1][2], etat, 'rien n’a changé : rien n’est réécrit');
  // un chantier et un compte ajoutés pendant que le réglage est allumé : l'onglet des cases continue d'être tenu
  g.feuilles['Chantiers'].lignes.push(['CHANTIER NOUVEAU', 'LIEU', 'En cours', 'Franck ESSAI', '0599']);
  g.feuilles['Utilisateurs'].lignes.push(['lucas', 'Lucas ESSAI', 'Poseur', true, false, '', '', false, false, '']);
  g.ctx.traiterComptes();
  assert.ok(a.lignes.some(l => l[0] === 'CHANTIER NOUVEAU') && a.lignes[0].indexOf('lucas') > 1);
  assert.deepStrictEqual(lectures(g, 'thomas27', 'CHANTIER TEST 1'), TOUT, 'les cases de thomas27 sont toujours lues à la bonne colonne');
  regler(g, false);
  g.now += 600000; g.ctx.traiterComptes();
  assert.ok(/^Éteint depuis le 25\/11\/2026 10:20/.test(R(g).lignes[1][2]) && a.lignes[0][1] === 'Remarque (appli)', j([R(g).lignes[1][2], a.lignes[0][1]]));
  assert.deepStrictEqual(lectures(g, 'thomas27', 'CHANTIER TEST 1'), TOUT);
  assert.deepStrictEqual(lectures(g, 'thomas27', 'CHANTIER TEST 2'), RIEN);
});
test('aucun autre chemin : le réglage et les cases ne sont lus que dans les deux fonctions d’accès de Comptes.gs', () => {
  const dossier = path.join(__dirname, '..', 'apps-script');
  const sources = fs.readdirSync(dossier).filter(f => f.endsWith('.gs') && f !== 'Modeles.gs').map(f => [f, fs.readFileSync(path.join(dossier, f), 'utf8')]);
  const appels = (nom) => sources.map(([f, s]) => [f, (s.match(new RegExp('[^_A-Za-z]' + nom + '\\(', 'g')) || []).length]).filter(x => x[1]);
  assert.deepStrictEqual(appels('tousChantiersOuverts_'), [['Comptes.gs', 2], ['Reglages.gs', 1]], 'deux appels dans Comptes.gs, la définition dans Reglages.gs');
  assert.deepStrictEqual(appels('chantiersCoches_'), [['Comptes.gs', 3]], 'la définition et deux appels, tous dans Comptes.gs');
  const comptes = sources.find(x => x[0] === 'Comptes.gs')[1];
  const visibles = comptes.slice(comptes.indexOf('function chantiersVisibles_('), comptes.indexOf('// ── Actions de l\'API réservées aux comptes'));
  assert.strictEqual((visibles.match(/tousChantiersOuverts_\(/g) || []).length, 2, 'dans chantiersVisibles_ et peutLireChantier_');
  assert.strictEqual((visibles.match(/chantiersCoches_\(/g) || []).length, 2);
});

console.log('Lot 12 — les chantiers du planning en favoris : éteint tant que le planning n’existe pas');
test('sans la propriété PLANNING_SHEET_ID : rien n’est lu, rien n’est écrit, aucun « planifie » envoyé', () => {
  const g = environnement();
  assert.strictEqual(g.ctx.planifPassage_(), 'éteint');
  assert.strictEqual(g.ctx.traiterComptes(), 'ok');
  assert.ok(!g.feuilles['Planifiés'] && !('PLANIF_ETAT' in g.proprietes));
  assert.ok(moi(g, 'thomas27').data.chantiers.every(c => !('planifie' in c)));
});

console.log('Lot 12 — les chantiers du planning en favoris');
test('une semaine publiée : le gars planifié reçoit « planifie » sur ce chantier, les autres rien ; une ligne dans l’onglet Planifiés', () => {
  const g = environnement({ planning: true });
  regler(g, true);
  planning(g, 'm1', [semaine(S48), planifie(S48, 'thomas27', '0502'), planifie(S48, 'Thomas27 ', ' 0504'), planifie(S48, 'kevin', '0502')]);
  assert.ok(/^lu : 1 semaine/.test(passage(g)), 'passage');
  assert.deepStrictEqual(P(g), [['kevin', '0502', 'CHANTIER TEST 2', S48, S48], ['thomas27', '0502', 'CHANTIER TEST 2', S48, S48], ['thomas27', '0504', 'CHANTIER TEST 4', S48, S48]]);
  assert.deepStrictEqual(planifies(g, 'thomas27'), { 'CHANTIER TEST 2': S48, 'CHANTIER TEST 4': S48 });
  assert.deepStrictEqual(planifies(g, 'kevin'), { 'CHANTIER TEST 2': S48 });
  assert.deepStrictEqual(planifies(g, 'atelier1'), {});
  assert.strictEqual(g.mails.length, 0);
});
test('le planning ne donne AUCUN accès : réglage éteint, un chantier planifié mais pas coché ne s’affiche pas et ne se lit pas', () => {
  const g = environnement({ planning: true });
  planning(g, 'm1', [semaine(S48), planifie(S48, 'kevin', '0502'), planifie(S48, 'thomas27', '0501')]);
  passage(g);
  assert.deepStrictEqual(noms(moi(g, 'kevin')), []);
  assert.deepStrictEqual(lectures(g, 'kevin', 'CHANTIER TEST 2'), RIEN);
  assert.deepStrictEqual(planifies(g, 'thomas27'), { 'CHANTIER TEST 1': S48 }, 'sur un chantier coché, le favori du planning arrive');
});
test('ce qui est ignoré, et listé « à voir » : compte inconnu ou inactif, numéro inexistant, numéro de deux chantiers, chantier terminé ; « 90 » ne vaut pas pour « 901 »', () => {
  const g = environnement({ planning: true });
  regler(g, true);
  planning(g, 'm1', [semaine(S48), planifie(S48, 'inconnu', '0502'), planifie(S48, 'parti', '0502'), planifie(S48, 'kevin', '9999'), planifie(S48, 'kevin', '0600'),
    planifie(S48, 'kevin', '0503'), planifie(S48, 'kevin', '90'), planifie(S48, 'kevin', ''), ['PLANIFIE', 'pas une date', 'kevin', '0502', ''], ['AUTRE', S48, 'kevin', '0504', '']]);
  passage(g);
  assert.deepStrictEqual(P(g), [['kevin', '90', 'CHANTIER 90', S48, S48]]);
  assert.deepStrictEqual(planifies(g, 'kevin'), { 'CHANTIER 90': S48 });
  const v = aVoir(g).join(' / ');
  ['« inconnu »', '« parti »', '« 9999 »', '« 0600 »', '« 0503 »'].forEach(t => assert.ok(v.indexOf(t) > -1, t + ' dans : ' + v));
});
test('la série continue d’une semaine publiée à la suivante : le début ne bouge pas (un favori retiré ne revient pas)', () => {
  const g = environnement({ planning: true });
  regler(g, true);
  planning(g, 'm1', [semaine(S48), planifie(S48, 'kevin', '0502')]);
  passage(g);
  planning(g, 'm2', [semaine(S48), planifie(S48, 'kevin', '0502'), semaine(S49), planifie(S49, 'kevin', '0502')]);
  passage(g);
  assert.deepStrictEqual(P(g), [['kevin', '0502', 'CHANTIER TEST 2', S48, S49]]);
  assert.deepStrictEqual(planifies(g, 'kevin'), { 'CHANTIER TEST 2': S48 });
});
test('une COUPURE (semaine publiée sans lui sur ce chantier) puis une nouvelle planification : nouvelle série, le favori revient', () => {
  const g = environnement({ planning: true });
  regler(g, true);
  planning(g, 'm1', [semaine(S48), planifie(S48, 'kevin', '0502')]);
  passage(g);
  planning(g, 'm2', [semaine(S48), planifie(S48, 'kevin', '0502'), semaine(S49), planifie(S49, 'kevin', '0504')]);
  passage(g);
  planning(g, 'm3', [semaine(S49), planifie(S49, 'kevin', '0504'), semaine(S50), planifie(S50, 'kevin', '0502')]);
  passage(g);
  assert.deepStrictEqual(planifies(g, 'kevin'), { 'CHANTIER TEST 2': S50, 'CHANTIER TEST 4': S49 });
});
test('une semaine NON publiée entre deux n’est pas une coupure : la série continue', () => {
  const g = environnement({ planning: true });
  regler(g, true);
  planning(g, 'm1', [semaine(S48), planifie(S48, 'kevin', '0502')]);
  passage(g);
  planning(g, 'm2', [semaine(S48), planifie(S48, 'kevin', '0502'), semaine(S50), planifie(S50, 'kevin', '0502'), planifie(S49, 'kevin', '0504')]);   // S49 jamais publiée (ses lignes sont ignorées)
  passage(g);
  assert.deepStrictEqual(P(g), [['kevin', '0502', 'CHANTIER TEST 2', S48, S50]]);
});
test('retiré du chantier le mardi et remis le jeudi de la même semaine (semaine republiée) : la série continue, rien ne revient tout seul', () => {
  const g = environnement({ planning: true });
  regler(g, true);
  planning(g, 'm1', [semaine(S48, 'p1'), planifie(S48, 'kevin', '0502')]);
  passage(g);
  planning(g, 'm2', [semaine(S48, 'p2')]);
  passage(g);
  planning(g, 'm3', [semaine(S48, 'p3'), planifie(S48, 'kevin', '0502')]);
  passage(g);
  assert.deepStrictEqual(P(g), [['kevin', '0502', 'CHANTIER TEST 2', S48, S48]]);
});
test('plafond : 5 chantiers nouveaux pour un gars dans la semaine → AUCUN n’est ajouté pour lui, UN mail à Franck (pas un par passage) ; les autres gars sont traités ; 4 passent', () => {
  const g = environnement({ planning: true });
  regler(g, true);
  const cinq = ['0501', '0502', '0504', '0505', '0506'].map(n => planifie(S48, 'kevin', n));
  planning(g, 'm1', [semaine(S48, 'p1')].concat(cinq, [planifie(S48, 'thomas27', '0502')]));
  passage(g);
  assert.deepStrictEqual(P(g), [['thomas27', '0502', 'CHANTIER TEST 2', S48, S48]]);
  assert.deepStrictEqual(planifies(g, 'kevin'), {});
  const alertes = () => g.mails.filter(m => /Planning : trop de chantiers nouveaux/.test(m.sujet));
  assert.strictEqual(alertes().length, 1, j(g.mails.map(m => m.sujet)));
  assert.ok(alertes()[0].to === 'franck@loue.test' && /Kévin ESSAI/.test(alertes()[0].sujet) && /5 chantiers nouveaux/.test(alertes()[0].texte) && /23\/11\/2026/.test(alertes()[0].texte), j(alertes()[0]));
  assert.ok(/5 chantiers nouveaux pour « kevin »/.test(aVoir(g).join(' ')));
  // le lendemain (relecture complète du matin), et après une republication à l'identique : pas de second mail
  g.now += 24 * 3600000; g.ctx.planifPassage_();
  planning(g, 'm2', [semaine(S48, 'p2')].concat(cinq, [planifie(S48, 'thomas27', '0502')]));
  passage(g);
  assert.strictEqual(alertes().length, 1);
  // Franck corrige : 4 chantiers → ils passent
  planning(g, 'm3', [semaine(S48, 'p3')].concat(cinq.slice(0, 4)));
  passage(g);
  assert.strictEqual(Object.keys(planifies(g, 'kevin')).length, 4);
  assert.strictEqual(alertes().length, 1);
});
test('une lecture toutes les 30 minutes au plus ; planning inchangé : une seule cellule lue, rien n’est réécrit ; une fois par jour, tout est relu', () => {
  const g = environnement({ planning: true });
  regler(g, true);
  planning(g, 'm1', [semaine(S48), planifie(S48, 'kevin', '0502')]);
  assert.ok(/^lu/.test(passage(g)));
  assert.strictEqual(passage(g, 10), 'trop tôt');
  assert.strictEqual(passage(g, 25), 'inchangé');
  const avant = j(g.feuilles['Planifiés'].lignes);
  g.feuilles['Utilisateurs'].lignes[1][3] = true;
  planning(g, 'm1', [semaine(S48), planifie(S48, 'kevin', '0502'), planifie(S48, 'thomas27', '0504')]);   // changé SANS que la marque change (ne devrait pas arriver)
  assert.strictEqual(passage(g), 'inchangé');
  assert.strictEqual(j(g.feuilles['Planifiés'].lignes), avant);
  g.now += 24 * 3600000;
  assert.ok(/^lu/.test(g.ctx.planifPassage_()), 'le lendemain : relu en entier');
  assert.deepStrictEqual(planifies(g, 'thomas27'), { 'CHANTIER TEST 4': S48 });
});
test('SENS UNIQUE : l’appli n’écrit JAMAIS dans le planning (aucune écriture dans aucun de ses onglets), quoi qu’il arrive', () => {
  const g = environnement({ planning: true });
  regler(g, true);
  planning(g, 'm1', [semaine(S48)].concat(['0501', '0502', '0504', '0505', '0506'].map(n => planifie(S48, 'kevin', n)), [planifie(S48, 'inconnu', '0502'), planifie(S48, 'thomas27', '0502')]));
  passage(g); g.ctx.traiterComptes(); moi(g, 'thomas27');
  planning(g, 'm2', [semaine(S48, 'p2'), semaine(S49), planifie(S49, 'thomas27', '0502')]);
  passage(g);
  assert.strictEqual(ecrituresPlanning(g), 0);
  assert.ok(g.classeurs.PLAN.ouvertures >= 2);
  const source = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Planifies.gs'), 'utf8');
  assert.strictEqual((source.match(/openById\(/g) || []).length, 1, 'une seule fonction ouvre le planning');
  const tout = fs.readdirSync(path.join(__dirname, '..', 'apps-script')).filter(f => f.endsWith('.gs')).map(f => fs.readFileSync(path.join(__dirname, '..', 'apps-script', f), 'utf8')).join('\n');
  assert.strictEqual((tout.match(/openById\(/g) || []).length, 1, 'et nulle part ailleurs dans le serveur');
  const lire = source.slice(source.indexOf('function planifLire_('), source.indexOf('// ── Le passage'));
  assert.ok(!/set(Value|Values|Formula|NumberFormat)|appendRow|clear|insert|delete|protect/.test(lire), 'planifLire_ ne contient aucune commande d’écriture');
});
test('planning introuvable, onglet « APPLI » absent, ou propriété fausse : le passage ne plante pas, traiterComptes rend « ok », et ça reprend quand le planning revient', () => {
  const g = environnement({ planning: true });
  regler(g, true);
  planning(g, 'm1', [semaine(S48), planifie(S48, 'kevin', '0502')]);
  g.classeurs.PLAN.enPanne = true;
  assert.ok(/^planning illisible/.test(passage(g)));
  assert.strictEqual(g.ctx.traiterComptes(), 'ok');
  g.classeurs.PLAN.enPanne = false;
  const onglet = g.classeurs.PLAN.feuilles['APPLI']; delete g.classeurs.PLAN.feuilles['APPLI'];
  assert.ok(/onglet « APPLI » absent/.test(passage(g)));
  g.classeurs.PLAN.feuilles['APPLI'] = onglet;
  assert.ok(/^lu/.test(passage(g)));
  assert.deepStrictEqual(planifies(g, 'kevin'), { 'CHANTIER TEST 2': S48 });
});
test('une série terminée depuis plus de 8 semaines n’est plus envoyée au téléphone ; l’état gardé reste petit', () => {
  const g = environnement({ planning: true });
  regler(g, true);
  planning(g, 'm1', [semaine(S48), planifie(S48, 'kevin', '0502')]);
  passage(g);
  g.now += 100 * 24 * 3600000;
  assert.deepStrictEqual(planifies(g, 'kevin'), {});
  planning(g, 'm2', []);
  g.ctx.planifPassage_();
  assert.deepStrictEqual(JSON.parse(g.proprietes.PLANIF_ETAT).semaines, {}, 'les semaines de plus de 12 semaines sont oubliées');
});
test('texte hostile venu du planning (formule dans un compte) : jamais une formule dans le Sheet de l’appli', () => {
  const g = environnement({ planning: true });
  regler(g, true);
  planning(g, 'm1', [semaine(S48), planifie(S48, '=IMPORTDATA("x")', '0502'), planifie(S48, 'kevin', '=1+1')]);
  passage(g);
  assert.ok(g.feuilles['Planifiés'].lignes.every(l => l.every(c => typeof c !== 'string' || !/^[=+@]/.test(c))), j(g.feuilles['Planifiés'].lignes));
});

console.log('Lot 12 — livraison');
test('livraison : le serveur à coller contient le lot 12, dans la version de Config.gs, sans les outils d’essai', () => {
  const code = fs.readFileSync(path.join(__dirname, '..', 'A-COLLER-DANS-APPS-SCRIPT', 'Code.gs'), 'utf8');
  ["const VERSION_API = '" + VERSION_SERVEUR + "'", 'function tousChantiersOuverts_(', 'function installerLot12Test(', 'function installerLot12Production(', 'function planifPassage_(', 'function planifLire_(']
    .forEach(t => assert.ok(code.indexOf(t) > -1, t));
  assert.ok(code.indexOf('function outilTest_(') < 0);
  assert.ok(code.indexOf(String.fromCharCode(0x2028)) < 0 && code.indexOf(String.fromCharCode(0x2029)) < 0, 'aucun séparateur de ligne brut dans le fichier à coller');
});
test('le serveur à coller, chargé SEUL : réglage éteint puis allumé, et un favori du planning', () => {
  const g = environnement({ codeGs: true, planning: true });
  assert.deepStrictEqual(lectures(g, 'kevin', 'CHANTIER TEST 2'), RIEN);
  regler(g, true);
  assert.deepStrictEqual(lectures(g, 'kevin', 'CHANTIER TEST 2'), TOUT);
  planning(g, 'm1', [semaine(S48), planifie(S48, 'kevin', '0502')]);
  passage(g);
  assert.deepStrictEqual(planifies(g, 'kevin'), { 'CHANTIER TEST 2': S48 });
});

console.log('\n' + reussis + ' test(s) réussi(s)' + (process.exitCode ? ' — DES TESTS ÉCHOUENT' : ''));
