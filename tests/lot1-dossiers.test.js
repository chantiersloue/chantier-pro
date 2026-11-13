// Tests du lot 1.5 (rangement Drive : dossiers.json, dossier de chaque chantier, migration) : node tests/lot1-dossiers.test.js
'use strict';
const assert = require('assert');
const { creerGoogle, chargerScript } = require('./gas-harness');

function environnement(options = {}) {
  const google = creerGoogle(Object.assign({
    proprietes: { DRIVE_ROOT_ID: 'RACINE', DRIVE_PLANNING_ID: 'PLANNING', EMAIL_ADMIN: 'franck@loue.test' },
    feuilles: {
      'Contacts': [['Nom', 'Role', 'Email', 'ChefEquipe', 'Destinataire', 'ConducteurDefaut', 'ChefAtelier', 'absenceNotif']],
      'Chantiers': [['Nom', 'Référence', 'Statut', 'Conducteur'], ['CHANTIER TEST 1', 'LIEU', 'En cours', ''], ['EHPAD', '', 'En cours', '']],
    },
  }, options));
  google.racine = google.creerElement('dossier', 'Loué Menuiserie - Chantiers', null, { id: 'RACINE' });
  google.creerElement('dossier', 'Planning', google.racine, { id: 'PLANNING' });
  google.ctx = chargerScript(google);
  return google;
}
const pdf = (g, nom) => g.ctx.Utilities.newBlob(Buffer.from('%PDF essai'), 'application/pdf', nom || 'x.pdf');
const enfant = (el, nom) => el.enfants.find(e => e.nom === nom && !e.corbeille);
const chemin = (el, ...noms) => noms.reduce((d, n) => d && enfant(d, n), el);

let reussis = 0;
function test(nom, fn) {
  try { fn(); reussis++; console.log('  ✓ ' + nom); }
  catch (e) { console.log('  ✗ ' + nom + '\n    ' + e.message); process.exitCode = 1; }
}

console.log('Lot 1.5 — dossiers.json et classement');
test('dossiers.json créé au premier document, quitus rangé dans 05 - CHANTIER/OPR - RESERVES - QUITUS avec le nouveau nom', () => {
  const g = environnement();
  g.creerElement('dossier', 'CHANTIER TEST 1', g.racine);
  const f = g.ctx.classerDocument_('quitus', pdf(g), 'CHANTIER TEST 1', '09/11/2026', 'appt 12');
  assert.ok(f, 'fichier créé');
  assert.ok(enfant(g.racine, 'dossiers.json'), 'dossiers.json créé à la racine');
  const d = chemin(g.racine, 'CHANTIER TEST 1', '05 - CHANTIER', 'OPR - RESERVES - QUITUS');
  assert.ok(d, 'dossier créé');
  assert.deepStrictEqual(d.enfants.map(e => e.nom), ['QUITUS CHANTIER TEST 1 appt 12 2026-11-09.pdf']);
  const f2 = g.ctx.classerDocument_('quitus', pdf(g), 'CHANTIER TEST 1', '09/11/2026', 'appt 12');
  assert.strictEqual(f2.getName(), 'QUITUS CHANTIER TEST 1 appt 12 2026-11-09_V2.pdf', 'jamais écrasé');
});

test('tous les types vont dans le bon dossier ; absence hors chantier dans ADMINISTRATIF/ABSENCES', () => {
  const g = environnement();
  const attendu = {
    'cotes': ['05 - CHANTIER', 'PRISE DE COTES'], 'fabrication': ['07 - ATELIER'], 'note': ['05 - CHANTIER', 'COMPTE RENDU'],
    'attestation': ['05 - CHANTIER', 'OPR - RESERVES - QUITUS'], 'reception-support': ['05 - CHANTIER', 'OPR - RESERVES - QUITUS'],
    'bordereau-orga': ['05 - CHANTIER', 'ORGANIGRAMME'], 'bordereau-materiaux': ['05 - CHANTIER', 'BORDEREAUX MATERIAUX'],
  };
  Object.keys(attendu).forEach(t => {
    assert.ok(g.ctx.classerDocument_(t, pdf(g), 'CHANTIER TEST 1', '01/02/2026', ''), t);
    const d = chemin(g.racine, 'CHANTIER TEST 1', ...attendu[t]);
    assert.ok(d && d.enfants.some(e => e.nom.indexOf('2026-02-01') > -1), t + ' rangé');
  });
  g.ctx.classerDocument_('absence', pdf(g), '', '03/02/2026', 'Jean DUPONT');
  const abs = chemin(g.racine, 'ADMINISTRATIF', 'ABSENCES');
  assert.deepStrictEqual(abs.enfants.map(e => e.nom), ['ABSENCE Jean DUPONT 2026-02-03.pdf']);
  // Lot 4b : plus de sous-dossier « Plans » créé d'office (les plans passent par le carnet)
  const cree = enfant(g.racine, 'CHANTIER TEST 1');
  assert.ok(!chemin(g.racine, 'CHANTIER TEST 1', 'Plans'), 'un nouveau dossier chantier ne reçoit plus « Plans »');
  assert.deepStrictEqual(cree.enfants.map(e => e.nom).sort(), ['05 - CHANTIER', '07 - ATELIER'], 'seuls les dossiers des documents rangés existent');
  assert.strictEqual(g.feuilles['Dossiers chantiers'].lignes[1][3], 'créé');
});

test('dossiers.json existant avec la clé « plans » (ou sans) : toujours lisible, aucun dossier Plans créé', () => {
  [{ plans: 'PLANS VALIDES', quitus: 'QUITUS' }, { quitus: 'QUITUS' }].forEach(documents => {
    const g = environnement();
    g.creerElement('fichier', 'dossiers.json', g.racine, { contenu: JSON.stringify({ version: 1, documents: documents }) });
    assert.ok(g.ctx.classerDocument_('quitus', pdf(g), 'CHANTIER TEST 1', '09/11/2026', ''));
    assert.deepStrictEqual(enfant(g.racine, 'CHANTIER TEST 1').enfants.map(e => e.nom), ['QUITUS']);
    assert.strictEqual(g.ctx.dossiers_().documents.plans, documents.plans || 'Plans', 'le nom du dossier Plans reste connu (listerPartagesPlans)');
    assert.ok(/✅ dossiers.json lisible/.test(g.ctx.verifierDossiers_()));
  });
});

test('dossiers.json modifié par Franck : pris en compte (une clé oubliée garde sa valeur par défaut)', () => {
  const g = environnement();
  g.creerElement('fichier', 'dossiers.json', g.racine, { contenu: JSON.stringify({ documents: { quitus: '05 - CHANTIER/QUITUS SIGNES' } }) });
  g.ctx.classerDocument_('quitus', pdf(g), 'CHANTIER TEST 1', '09/11/2026');
  g.ctx.classerDocument_('cotes', pdf(g), 'CHANTIER TEST 1', '09/11/2026');
  assert.ok(chemin(g.racine, 'CHANTIER TEST 1', '05 - CHANTIER', 'QUITUS SIGNES'));
  assert.ok(chemin(g.racine, 'CHANTIER TEST 1', '05 - CHANTIER', 'PRISE DE COTES'));
});

test('dossiers.json illisible : rangement avec les noms par défaut, une seule alerte à Franck par jour', () => {
  const g = environnement();
  g.creerElement('fichier', 'dossiers.json', g.racine, { contenu: '{ "documents": { "quitus": "A", } ' });
  g.ctx.classerDocument_('quitus', pdf(g), 'CHANTIER TEST 1', '09/11/2026');
  Object.keys(g.cache).forEach(k => delete g.cache[k]);
  g.ctx.classerDocument_('quitus', pdf(g), 'CHANTIER TEST 1', '09/11/2026');
  assert.ok(chemin(g.racine, 'CHANTIER TEST 1', '05 - CHANTIER', 'OPR - RESERVES - QUITUS'));
  assert.strictEqual(g.mails.filter(m => m.sujet.indexOf('dossiers.json') > -1).length, 1);
  assert.ok(g.ctx.verifierDossiers_().indexOf('❌') === 0);
});

console.log('Lot 1.5 — dossier de chaque chantier');
test('le dossier retenu dans « Dossiers chantiers » est utilisé même s’il a été renommé', () => {
  const g = environnement();
  const d = g.creerElement('dossier', 'CHANTIER TEST 1', g.racine);
  g.ctx.classerDocument_('note', pdf(g), 'CHANTIER TEST 1', '09/11/2026');
  const lignes = g.feuilles['Dossiers chantiers'].lignes;
  assert.strictEqual(lignes[1][2], d.id);
  assert.strictEqual(lignes[1][3], 'nom exact');
  d.nom = '012 - TEST 1';   // renommé par Franck
  g.ctx.classerDocument_('note', pdf(g), 'CHANTIER TEST 1', '10/11/2026');
  assert.strictEqual(g.racine.enfants.filter(e => e.type === 'dossier' && /TEST 1/.test(e.nom)).length, 1, 'pas de nouveau dossier');
  assert.strictEqual(chemin(d, '05 - CHANTIER', 'COMPTE RENDU').enfants.length, 2);
});

test('une seule ressemblance : utilisée et notée « à vérifier » ; plusieurs : aucun choix au hasard', () => {
  const g = environnement();
  const proche = g.creerElement('dossier', 'EHPAD LES TILLEULS', g.racine);
  g.ctx.classerDocument_('quitus', pdf(g), 'EHPAD', '09/11/2026');
  assert.ok(chemin(proche, '05 - CHANTIER', 'OPR - RESERVES - QUITUS'), 'rangé dans le dossier ressemblant');
  const l = g.feuilles['Dossiers chantiers'].lignes[1];
  assert.strictEqual(l[3], 'ressemblance'); assert.ok(/^OUI/.test(l[4]));
  assert.ok(g.ctx.verifierDossiers_().indexOf('à vérifier') > -1);

  const g2 = environnement();
  g2.creerElement('dossier', 'EHPAD NORD', g2.racine); g2.creerElement('dossier', 'EHPAD SUD', g2.racine);
  g2.ctx.classerDocument_('quitus', pdf(g2), 'EHPAD', '09/11/2026');
  assert.ok(enfant(g2.racine, 'EHPAD'), 'nouveau dossier au nom exact');
  assert.ok(/plusieurs/.test(g2.feuilles['Dossiers chantiers'].lignes[1][3]));
});

test('les dossiers techniques (_PHOTOS EN COURS, DOSSIER BASE, Planning) ne passent jamais pour un chantier', () => {
  const g = environnement({ feuilles: { 'Chantiers': [['Nom'], ['PHOTOS'], ['BASE'], ['PLANNING']] } });
  ['_PHOTOS EN COURS', 'DOSSIER BASE'].forEach(n => g.creerElement('dossier', n, g.racine));
  ['PHOTOS', 'BASE', 'PLANNING'].forEach(c => g.ctx.classerDocument_('note', pdf(g), c, '09/11/2026'));
  ['PHOTOS', 'BASE', 'PLANNING'].forEach(c => assert.ok(enfant(g.racine, c), c + ' a son propre dossier'));
});

console.log('Lot 1.5 — migration');
function avecAnciens() {
  const g = environnement();
  const ch = g.creerElement('dossier', 'CHANTIER TEST 1', g.racine);
  const fiches = g.creerElement('dossier', 'Fiches', ch);
  const ids = {
    cotes: g.creerElement('fichier', 'Cotes_CHANTIER TEST 1_01-02-2026.pdf', fiches).id,
    fab: g.creerElement('fichier', 'Fab_CHANTIER TEST 1_S3_01-02-2026.pdf', fiches).id,
    perso: g.creerElement('fichier', 'photo perso.jpg', fiches).id,
    note: g.creerElement('fichier', 'Note_CHANTIER TEST 1_02-02-2026.pdf', g.creerElement('dossier', 'Note/Réunion/Réunion', ch)).id,
  };
  const quitus = g.creerElement('dossier', 'Quitus', ch);
  ids.quitus = g.creerElement('fichier', 'Quitus_CHANTIER TEST 1_03-02-2026.pdf', quitus).id;
  ids.bord = g.creerElement('fichier', 'Bordereau_Orga_CHANTIER TEST 1_04-02-2026.pdf', quitus).id;
  ids.att = g.creerElement('fichier', 'Attestation_X.pdf', g.creerElement('dossier', 'Attestations', ch)).id;
  ids.plan = g.creerElement('fichier', 'PLAN RDC.pdf', g.creerElement('dossier', 'Plans', ch)).id;
  g.creerElement('dossier', '_PHOTOS EN COURS', g.racine);
  return { g, ch, ids };
}

test('planMigration : liste sans rien déplacer, classe chaque fichier, laisse Plans et l’inconnu', () => {
  const { g, ch, ids } = avecAnciens();
  const avant = JSON.stringify(ch.enfants.map(e => [e.nom, e.enfants.length]));
  const bilan = g.ctx.planMigration();
  assert.strictEqual(JSON.stringify(ch.enfants.map(e => [e.nom, e.enfants.length])), avant, 'rien n’a bougé');
  const lignes = g.feuilles['Migration (lot 1)'].lignes.slice(1);
  const par = id => lignes.find(l => l[3] === id);
  assert.strictEqual(par(ids.cotes)[5], '05 - CHANTIER/PRISE DE COTES');
  assert.strictEqual(par(ids.fab)[5], '07 - ATELIER');
  assert.strictEqual(par(ids.note)[5], '05 - CHANTIER/COMPTE RENDU');
  assert.strictEqual(par(ids.quitus)[5], '05 - CHANTIER/OPR - RESERVES - QUITUS');
  assert.strictEqual(par(ids.bord)[5], '05 - CHANTIER/ORGANIGRAMME', 'bordereau rangé par erreur dans Quitus avant le lot 0');
  assert.strictEqual(par(ids.att)[6], 'DÉPLACER');
  assert.strictEqual(par(ids.perso)[6], 'À TRIER À LA MAIN');
  assert.ok(!par(ids.plan), 'Plans ne bouge pas');
  assert.ok(/6 document\(s\) à déplacer, 1 à trier/.test(bilan), bilan);
  const dossiers = g.feuilles['Dossiers chantiers'].lignes;
  assert.ok(dossiers.some(l => l[0] === 'CHANTIER TEST 1' && l[2] === ch.id), 'dossier du chantier noté');
  assert.ok(/EHPAD/.test(bilan), 'chantier sans dossier signalé');
});

test('executerMigration : déplace (même identifiant), respecte IGNORER, ne supprime rien, peut être relancée', () => {
  const { g, ch, ids } = avecAnciens();
  g.ctx.planMigration();
  const sh = g.feuilles['Migration (lot 1)'];
  const iQuitus = sh.lignes.findIndex(l => l[3] === ids.quitus);
  sh.lignes[iQuitus][6] = 'IGNORER';
  const bilan = g.ctx.executerMigration();
  assert.ok(/5 document\(s\) déplacé\(s\), 0 erreur/.test(bilan), bilan);
  assert.strictEqual(g.elements[ids.cotes].parents[0].nom, 'PRISE DE COTES');
  assert.strictEqual(g.elements[ids.fab].parents[0], chemin(ch, '07 - ATELIER'));
  assert.strictEqual(g.elements[ids.quitus].parents[0].nom, 'Quitus', 'ignoré : pas bougé');
  assert.strictEqual(g.elements[ids.perso].parents[0].nom, 'Fiches', 'à trier : pas bougé');
  assert.ok(enfant(ch, 'Fiches') && enfant(ch, 'Note/Réunion/Réunion'), 'anciens dossiers gardés');
  assert.strictEqual(sh.lignes.find(l => l[3] === ids.cotes)[7], 'déplacé');
  assert.ok(/0 document\(s\) déplacé/.test(g.ctx.executerMigration()), 'relance sans effet');
  // Fichier rangé à la main entre le plan et l'exécution : pas touché
  const { g: g2, ids: ids2 } = avecAnciens();
  g2.ctx.planMigration();
  const ailleurs = g2.creerElement('dossier', 'Ailleurs', g2.racine);
  g2.elements[ids2.note].api.moveTo(ailleurs.api);
  g2.ctx.executerMigration();
  assert.strictEqual(g2.elements[ids2.note].parents[0], ailleurs);
  assert.ok(/ignoré/.test(g2.feuilles['Migration (lot 1)'].lignes.find(l => l[3] === ids2.note)[7]));
});

test('annulerMigration : chaque document revient dans son ancien dossier (même identifiant), relance sans effet', () => {
  const { g, ch, ids } = avecAnciens();
  g.ctx.planMigration();
  g.ctx.executerMigration();
  assert.strictEqual(g.elements[ids.note].parents[0].nom, 'COMPTE RENDU');
  const bilan = g.ctx.annulerMigration();
  assert.ok(/6 document\(s\) remis/.test(bilan), bilan);
  assert.strictEqual(g.elements[ids.note].parents[0], enfant(ch, 'Note/Réunion/Réunion'), 'nom avec « / » : pas un chemin');
  assert.strictEqual(g.elements[ids.cotes].parents[0], enfant(ch, 'Fiches'));
  assert.strictEqual(g.elements[ids.bord].parents[0], enfant(ch, 'Quitus'));
  assert.strictEqual(g.elements[ids.att].parents[0], enfant(ch, 'Attestations'));
  assert.ok(/0 document\(s\) remis/.test(g.ctx.annulerMigration()));
  assert.strictEqual(g.feuilles['Migration (lot 1)'].lignes.find(l => l[3] === ids.cotes)[7], 'remis en place');
});

test('executerMigration sans plan, ou verrou occupé : ne fait rien', () => {
  const { g, ids } = avecAnciens();
  assert.strictEqual(g.ctx.executerMigration(), 'pas de plan');
  const g2 = environnement();
  g2.proprietes.MIGRATION_EN_COURS = String(Date.now() - 60000);   // une autre migration tourne depuis 1 min
  assert.strictEqual(g2.ctx.executerMigration(), 'occupé');
  const g3 = environnement({ verrouOccupe: true });
  assert.strictEqual(g3.ctx.executerMigration(), 'pas de plan', 'le verrou des fiches ne bloque pas la migration');
  assert.strictEqual(g.elements[ids.cotes].parents[0].nom, 'Fiches');
});

console.log('Relecture du lot 1 — corrections du rangement');
test('planMigration refuse de repartir de zéro après un déplacement (le retour arrière reste possible)', () => {
  const { g, ids } = avecAnciens();
  g.ctx.planMigration(); g.ctx.executerMigration();
  assert.ok(/déjà été déplacés/.test(g.ctx.planMigration()));
  assert.ok(/remis/.test(g.ctx.annulerMigration()));
  assert.strictEqual(g.elements[ids.cotes].parents[0].nom, 'Fiches');
});

test('même nom à la casse ou aux espaces près : le dossier existant est retrouvé (pas de doublon)', () => {
  const g = environnement();
  const d = g.creerElement('dossier', 'Chantier Test 1 ', g.racine);
  g.ctx.classerDocument_('quitus', pdf(g), 'CHANTIER TEST 1', '09/11/2026');
  assert.ok(chemin(d, '05 - CHANTIER', 'OPR - RESERVES - QUITUS'), 'rangé dans le dossier existant');
  assert.ok(!enfant(g.racine, 'CHANTIER TEST 1'), 'pas de nouveau dossier');
});

test('un chantier nommé comme un dossier technique n’est jamais rangé dedans', () => {
  const g = environnement();
  const base = g.creerElement('dossier', 'DOSSIER BASE', g.racine);
  g.ctx.classerDocument_('quitus', pdf(g), 'DOSSIER BASE', '09/11/2026');
  assert.strictEqual(base.enfants.length, 0, 'dossier modèle intact');
});

test('dossiers.json : un chemin vide ou avec « .. » garde la valeur par défaut', () => {
  const g = environnement();
  g.creerElement('fichier', 'dossiers.json', g.racine, { contenu: JSON.stringify({ documents: { quitus: '../../x', cotes: '' }, hors_chantier: { absence: ' ' } }) });
  g.ctx.classerDocument_('quitus', pdf(g), 'CHANTIER TEST 1', '09/11/2026');
  g.ctx.classerDocument_('absence', pdf(g), '', '09/11/2026', 'X');
  assert.ok(chemin(g.racine, 'CHANTIER TEST 1', '05 - CHANTIER', 'OPR - RESERVES - QUITUS'));
  assert.ok(chemin(g.racine, 'ADMINISTRATIF', 'ABSENCES'), 'absence jamais dans un chantier');
});

test('migration : un fichier mis à la main dans « Attestations » ou « Note/Réunion/Réunion » reste où il est', () => {
  const { g, ch } = avecAnciens();
  const att = g.creerElement('fichier', 'Scan PV signé.pdf', enfant(ch, 'Attestations'));
  g.ctx.planMigration();
  assert.strictEqual(g.feuilles['Migration (lot 1)'].lignes.find(l => l[3] === att.id)[6], 'À TRIER À LA MAIN');
});

console.log('Livraison — Code.gs unique à coller');
test('A-COLLER-DANS-APPS-SCRIPT/Code.gs chargé SEUL : le serveur répond et range une fiche', () => {
  const google = creerGoogle({ proprietes: { DRIVE_ROOT_ID: 'RACINE', DRIVE_PLANNING_ID: 'PLANNING', EMAIL_ADMIN: 'franck@loue.test' },
    feuilles: { 'Contacts': [['Nom', 'Role', 'Email']], 'Contacts notes': [['Nom', 'Email']], 'Chantiers': [['Nom'], ['CHANTIER TEST 1']] } });
  google.racine = google.creerElement('dossier', 'Loué Menuiserie - Chantiers', null, { id: 'RACINE' });
  google.creerElement('dossier', 'Planning', google.racine, { id: 'PLANNING' });
  const ctx = chargerScript(google, require('path').join(__dirname, '..', 'A-COLLER-DANS-APPS-SCRIPT', 'Code.gs'));
  const ping = JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify({ action: 'ping' }) } }).contenu);
  assert.strictEqual(ping.ok, true);
  assert.ok(ctx.classerDocument_('quitus', ctx.Utilities.newBlob(Buffer.from('%PDF'), 'application/pdf', 'x.pdf'), 'CHANTIER TEST 1', '09/11/2026'));
  ['planMigration', 'executerMigration', 'verifierConfig', 'modele_quitus', 'traiterQuitus'].forEach(f => assert.strictEqual(typeof ctx[f], 'function', f));
});

console.log('\n' + reussis + ' test(s) réussi(s)' + (process.exitCode ? ' — DES TESTS ÉCHOUENT' : ''));
