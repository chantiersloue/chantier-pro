// Tests du lot 8d, côté serveur (récapitulatif des notes de réunion par chantier) : node tests/lot8d-recap.test.js
// Le VRAI code d'apps-script/ tourne avec les services Google simulés (tests/gas-harness.js) : rien ne part chez Google.
// Noms, chantiers et adresses : tous fictifs (dépôt public).
'use strict';
// Le numéro de version du serveur est lu dans apps-script/Config.gs : un nouveau lot ne fait plus changer ce fichier de tests
const VERSION_SERVEUR = (/VERSION_API = '([^']+)'/.exec(require('fs').readFileSync(require('path').join(__dirname, '..', 'apps-script', 'Config.gs'), 'utf8')) || [])[1];
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { creerGoogle, chargerScript } = require('./gas-harness');

const FRANCK = 'franck@loue.test', SEB = 'seb@loue.test';
const PREFIXE = 'RÉCAPITULATIF DES NOTES - ';

function environnement(options = {}) {
  const g = creerGoogle(Object.assign({
    nomSheet: options.test ? 'ChantierPro TEST' : 'ChantierPro',
    proprietes: Object.assign({ DRIVE_ROOT_ID: 'RACINE', DRIVE_PLANNING_ID: 'PLANNING', HACHAGE_ITERATIONS: '200' }, options.test ? { ENVIRONNEMENT: 'TEST' } : {}),
    feuilles: {
      'Contacts': [['Nom', 'Role', 'Email', 'ChefEquipe', 'Destinataire', 'ConducteurDefaut', 'ChefAtelier', 'absenceNotif'],
        ['Franck ESSAI', 'Conducteur de travaux', FRANCK, 'O', 'N', 'O', 'N', 'O'],
        ['Sébastien ESSAI', 'Conducteur de travaux', SEB, 'O', 'N', 'N', 'N', 'N'],
        ['Thomas ESSAI', 'Poseur', 'thomas@loue.test', 'N', 'N', 'N', 'N', 'N']],
      'Contacts notes': [['Nom', 'Email']],
      'Chantiers': [['Nom', 'Référence', 'Statut', 'Conducteur'],
        ['CHANTIER TEST 1', 'LIEU 1', 'En cours', 'Sébastien ESSAI'],
        ['CHANTIER TEST 2', 'LIEU 2', 'En cours', 'Franck ESSAI'],
        ['CHANTIER TEST 3', 'LIEU 3', 'En cours', 'Franck ESSAI'],
        ['CHANTIER TEST 4', 'LIEU 4', 'En cours', 'Franck ESSAI'],
        ['CHANTIER TEST 5', 'LIEU 5', 'En cours', 'Franck ESSAI'],
        ['CHANTIER TEST 6', 'LIEU 6', 'En cours', 'Franck ESSAI']],
    },
  }, options.google || {}));
  g.creerElement('dossier', 'Loué Menuiserie - Chantiers', null, { id: 'RACINE' });
  g.creerElement('dossier', 'Planning', null, { id: 'PLANNING' });
  g.ctx = options.codeGs ? chargerScript(g, path.join(__dirname, '..', 'A-COLLER-DANS-APPS-SCRIPT', 'Code.gs')) : chargerScript(g);
  g.ctx.genererCle(); g.ctx.preparerOngletsLot2();
  const u = g.feuilles['Utilisateurs'];
  u.lignes[1] = ['thomas27', 'Thomas ESSAI', 'Poseur', true, false, '', '', false, false, ''];
  u.lignes[2] = ['seb', 'Sébastien ESSAI', 'Conducteur', true, false, '', '', false, false, ''];
  u.lignes[3] = ['franck', 'Franck ESSAI', 'Admin', true, false, '', '', false, false, ''];
  u.lignes[4] = ['kevin', 'Kévin ESSAI', 'Poseur', true, false, '', '', false, false, ''];
  g.ctx.traiterComptes();
  // Accès : thomas27 sur CHANTIER TEST 1 ; kevin sur rien
  const a = g.feuilles['Accès chantiers'], col = a.lignes[0].indexOf('thomas27');
  assert.ok(col > 1, 'colonne thomas27');
  a.lignes.forEach(l => { if (l[0] === 'CHANTIER TEST 1') l[col] = true; });
  if (!options.sansLot8) (options.test ? g.ctx.installerLot8Test : g.ctx.installerLot8Production)();
  if (!options.sansLot8 && !options.sansLot8d) (options.test ? g.ctx.installerLot8dTest : g.ctx.installerLot8dProduction)();
  g.mails.length = 0;
  return g;
}
const poster = (g, corps) => JSON.parse(g.ctx.doPost({ postData: { contents: JSON.stringify(corps) } }).contenu);
const jeton = (g, id) => g.ctx.fabriquerJeton_(id, 1);
let compteur = 0;
const idFiche = () => 'fiche-lot8d-' + String(++compteur).padStart(6, '0');
const note = extra => {
  const d = Object.assign({ type: 'note', chantier: 'CHANTIER TEST 1', auteur: 'Franck ESSAI', date: '12/11/2026', objet: 'Réunion de chantier',
    remarques: 'Pose des châssis du R+1', destinataires: [], photosBase64: [] }, extra || {});
  if (!('commentaires' in d)) d.commentaires = d.remarques;
  return d;
};
const envoyer = (g, qui, donnees, id) => poster(g, Object.assign({ action: 'fiche', id: id || idFiche(), donnees: donnees || note() }, qui ? { jeton: jeton(g, qui) } : {}));
const lire = (g, qui, chantier) => poster(g, Object.assign({ action: 'recapNotes', chantier: chantier }, qui ? { jeton: jeton(g, qui) } : {}));
const CR = g => (g.feuilles['Comptes rendus'] ? g.feuilles['Comptes rendus'].lignes.slice(1).filter(l => l[0]) : []);
const recaps = (g, avecCorbeille) => Object.values(g.elements).filter(e => e.type === 'fichier' && e.nom.indexOf(PREFIXE) === 0 && (avecCorbeille || !e.corbeille));
const attente = g => JSON.parse(g.proprietes.RECAP_A_REFAIRE || '{}');
const dossierNotes = g => Object.values(g.elements).find(e => e.type === 'dossier' && e.nom === 'COMPTE RENDU');
const numeroChantier = (g, nom, n) => { const l = g.feuilles['Chantiers'].lignes.find(x => x[0] === nom); l[4] = n; };
const j = x => JSON.stringify(x);

let reussis = 0;
function test(nom, fn) {
  try { fn(); reussis++; console.log('  ✓ ' + nom); }
  catch (e) { console.log('  ✗ ' + nom + '\n    ' + String(e.stack || e.message).split('\n').slice(0, 6).join('\n    ')); process.exitCode = 1; }
}

console.log('Lot 8d — tant que la colonne n’est pas installée, rien ne change');
test('serveur v11.1 sans installation du 8d : la ligne garde ses 10 colonnes, aucun texte gardé, aucun récapitulatif, même après le passage', () => {
  const g = environnement({ sansLot8d: true });
  const r = envoyer(g, 'seb');
  assert.deepStrictEqual([r.ok, r.code], [true, 'ENREGISTRE'], j(r));
  assert.strictEqual(g.feuilles['Comptes rendus'].lignes[0].length, 10);
  assert.strictEqual(CR(g)[0].length, 10);
  assert.ok(!('RECAP_A_REFAIRE' in g.proprietes));
  g.ctx.traiterComptes();
  assert.strictEqual(recaps(g, true).length, 0);
  const l = lire(g, 'seb', 'CHANTIER TEST 1');
  assert.deepStrictEqual([l.ok, l.data.notes.length, l.data.notes[0].sansTexte, l.data.notes[0].texte, l.data.notes[0].date], [true, 1, true, '', '12/11/2026'], j(l));
});
test('sans onglet « Comptes rendus » (lot 8 pas installé non plus) : la lecture rend une liste vide, pas une erreur', () => {
  const g = environnement({ sansLot8: true });
  const l = lire(g, 'seb', 'CHANTIER TEST 1');
  assert.deepStrictEqual([l.ok, l.code, l.data.notes.length], [true, 'OK', 0], j(l));
});

console.log('Lot 8d — installation');
test('installerLot8dProduction : pose la colonne K « Texte de la note » ; relancée, ne touche à rien ; refuse sur la copie TEST ; installe aussi le lot 8 s’il manque', () => {
  const g = environnement({ sansLot8d: true });
  envoyer(g, 'seb');
  const t1 = g.ctx.installerLot8dProduction();
  assert.ok(/✅ 1\/2 Onglet « Comptes rendus » : déjà fait/.test(t1) && /✅ 2\/2 Colonne « Texte de la note »[^\n]*: fait/.test(t1) && /installation terminée/.test(t1), t1);
  assert.strictEqual(g.feuilles['Comptes rendus'].lignes[0][10], 'Texte de la note');
  assert.strictEqual(CR(g).length, 1, 'la note déjà là n’est pas touchée');
  const t2 = g.ctx.installerLot8dProduction();
  assert.ok(/2\/2[^\n]*déjà fait/.test(t2), t2);
  const gTest = environnement({ test: true, sansLot8: true });
  assert.ok(/Refusé/.test(gTest.ctx.installerLot8dProduction()) && !gTest.feuilles['Comptes rendus']);
  const t3 = gTest.ctx.installerLot8dTest();
  assert.ok(/installation terminée/.test(t3) && gTest.feuilles['Comptes rendus'].lignes[0][10] === 'Texte de la note', t3);
});
test('colonne K déjà occupée par autre chose : l’installation refuse et n’écrit rien', () => {
  const g = environnement({ sansLot8d: true });
  envoyer(g, 'seb');
  g.feuilles['Comptes rendus'].lignes[0][10] = 'Ma colonne';
  g.feuilles['Comptes rendus'].lignes[1][10] = 'note perso';
  const t = g.ctx.installerLot8dProduction();
  assert.ok(/contient déjà autre chose/.test(t) && !/installation terminée/.test(t), t);
  assert.deepStrictEqual([g.feuilles['Comptes rendus'].lignes[0][10], g.feuilles['Comptes rendus'].lignes[1][10]], ['Ma colonne', 'note perso']);
});

console.log('Lot 8d — le texte gardé et le fichier refait');
test('une note : son texte en colonne K (retours à la ligne gardés) ; le fichier n’est PAS fait pendant l’envoi, il l’est au passage suivant, dans le dossier des notes du chantier', () => {
  const g = environnement();
  const r = envoyer(g, 'seb', note({ remarques: 'Premier point\nDeuxième point\r\n\r\nTroisième' }));
  assert.deepStrictEqual([r.ok, r.code], [true, 'ENREGISTRE'], j(r));
  assert.strictEqual(CR(g)[0][10], 'Premier point\nDeuxième point\n\nTroisième');
  assert.strictEqual(recaps(g, true).length, 0, 'rien pendant l’envoi');
  assert.deepStrictEqual(Object.keys(attente(g)).length, 1);
  const mailsAvant = g.mails.length;
  g.ctx.traiterComptes();
  const f = recaps(g);
  assert.deepStrictEqual(f.map(e => e.nom), [PREFIXE + 'CHANTIER TEST 1.pdf']);
  assert.strictEqual(f[0].parents[0], dossierNotes(g), 'dans 05 - CHANTIER/COMPTE RENDU');
  const html = String(f[0].contenu);
  assert.ok(/RÉCAPITULATIF DES NOTES DE RÉUNION/.test(html) && /CHANTIER TEST 1/.test(html) && /Réunion du 12\/11\/2026 — Réunion de chantier/.test(html)
    && /Premier point\nDeuxième point\n\nTroisième/.test(html) && /Rédigé par Franck ESSAI/.test(html) && /1 note,/.test(html), html.slice(0, 900));
  assert.ok(!/<img/.test(html), 'pas de photo');
  assert.ok(!('RECAP_A_REFAIRE' in g.proprietes), 'plus rien en attente');
  assert.strictEqual(g.mails.length, mailsAvant, 'le récapitulatif n’envoie aucun mail');
});
test('trois notes : la plus récente en haut (date de réunion, puis ordre d’arrivée) ; le fichier est remplacé, l’ancien est à la corbeille, jamais deux fichiers du même nom', () => {
  const g = environnement();
  envoyer(g, 'seb', note({ date: '05/11/2026', remarques: 'TEXTE-A', objet: 'A' }));
  g.ctx.traiterComptes();
  const premier = recaps(g)[0];
  envoyer(g, 'seb', note({ date: '19/11/2026', remarques: 'TEXTE-B', objet: 'B' }));
  envoyer(g, 'seb', note({ date: '12/11/2026', remarques: 'TEXTE-C', objet: 'C' }));   // restée sans réseau : arrive après, date plus ancienne
  envoyer(g, 'seb', note({ date: '19/11/2026', remarques: 'TEXTE-D', objet: 'D' }));   // même jour que B, arrivée après
  g.ctx.traiterComptes();
  const f = recaps(g);
  assert.strictEqual(f.length, 1);
  assert.ok(premier.corbeille && f[0] !== premier, 'l’ancien est à la corbeille');
  const html = String(f[0].contenu), ordre = ['TEXTE-D', 'TEXTE-B', 'TEXTE-C', 'TEXTE-A'].map(t => html.indexOf(t));
  assert.ok(ordre.every(p => p > -1) && ordre.join() === ordre.slice().sort((a, b) => a - b).join(), j(ordre));
  assert.ok(/4 notes,/.test(html));
  const l = lire(g, 'seb', 'CHANTIER TEST 1');
  assert.deepStrictEqual(l.data.notes.map(n => n.texte), ['TEXTE-D', 'TEXTE-B', 'TEXTE-C', 'TEXTE-A']);
});
test('note renvoyée par le téléphone (même numéro de fiche) : une seule fois dans le récapitulatif', () => {
  const g = environnement(), id = idFiche();
  envoyer(g, 'seb', note({ remarques: 'UNE-FOIS' }), id);
  const r = envoyer(g, 'seb', note({ remarques: 'UNE-FOIS' }), id);
  assert.strictEqual(r.code, 'DEJA_RECU', j(r));
  g.ctx.traiterComptes();
  assert.strictEqual(String(recaps(g)[0].contenu).split('UNE-FOIS').length - 1, 1);
});
test('texte qui commence par un tiret, ou qui ressemble à une formule : jamais une formule dans le Sheet, et rendu tel qu’il a été tapé', () => {
  const g = environnement();
  envoyer(g, 'seb', note({ date: '10/11/2026', remarques: '- joints à reprendre\n- vitrage fêlé' }));
  envoyer(g, 'seb', note({ date: '11/11/2026', remarques: '=IMPORTDATA("https://exemple.test")' }));
  assert.ok(CR(g).every(l => /^'/.test(l[10])), j(CR(g).map(l => l[10])));
  const l = lire(g, 'seb', 'CHANTIER TEST 1');
  assert.deepStrictEqual(l.data.notes.map(n => n.texte), ['=IMPORTDATA("https://exemple.test")', '- joints à reprendre\n- vitrage fêlé']);
  g.ctx.traiterComptes();
  const html = String(recaps(g)[0].contenu);
  assert.ok(/- joints à reprendre/.test(html) && /=IMPORTDATA\(&quot;https:\/\/exemple\.test&quot;\)/.test(html), html.slice(-600));
});
test('du HTML tapé dans une note reste du texte dans le fichier (échappé)', () => {
  const g = environnement();
  envoyer(g, 'seb', note({ remarques: '<script>alert(1)</script> <b>gras</b>', objet: '<i>objet</i>' }));
  g.ctx.traiterComptes();
  const html = String(recaps(g)[0].contenu);
  assert.ok(html.indexOf('<script>alert(1)</script>') < 0 && html.indexOf('&lt;script&gt;') > -1 && html.indexOf('&lt;i&gt;objet') > -1, html.slice(-500));
});
test('texte très long : coupé à 20 000 caractères dans l’onglet, avec la mention ; la note elle-même part entière', () => {
  const g = environnement();
  const r = envoyer(g, 'seb', note({ remarques: 'x'.repeat(25000) }));
  assert.strictEqual(r.ok, true, j(r));
  const garde = CR(g)[0][10];
  assert.ok(garde.length < 20100 && /texte coupé : la suite est dans le PDF de la note\]$/.test(garde), garde.slice(-80));
});
test('note reçue AVANT l’installation du 8d (sans texte) : elle figure avec sa date et « Texte dans le PDF de la note »', () => {
  const g = environnement({ sansLot8d: true });
  envoyer(g, 'seb', note({ date: '03/11/2026', remarques: 'ANCIEN-TEXTE' }));
  g.ctx.installerLot8dProduction();
  envoyer(g, 'seb', note({ date: '17/11/2026', remarques: 'NOUVEAU-TEXTE' }));
  g.ctx.traiterComptes();
  const html = String(recaps(g)[0].contenu);
  assert.ok(html.indexOf('ANCIEN-TEXTE') < 0 && /Réunion du 03\/11\/2026/.test(html) && /Texte dans le PDF de la note \(COMPTE RENDU CHANTIER TEST 1 2026-11-03\.pdf\)/.test(html)
    && /NOUVEAU-TEXTE/.test(html) && /2 notes,/.test(html), html.slice(-800));
  const l = lire(g, 'seb', 'CHANTIER TEST 1');
  assert.deepStrictEqual(l.data.notes.map(n => [n.date, n.sansTexte]), [['17/11/2026', false], ['03/11/2026', true]]);
});
test('ancienne page (texte dans « commentaires », pas de « remarques ») : le texte est gardé aussi', () => {
  const g = environnement();
  const d = note(); delete d.remarques; d.commentaires = 'TEXTE-ANCIENNE-PAGE';
  envoyer(g, 'seb', d);
  assert.strictEqual(CR(g)[0][10], 'TEXTE-ANCIENNE-PAGE');
});
test('chantier tapé à la main, absent de la liste : la note part, aucun récapitulatif n’est demandé', () => {
  const g = environnement();
  const r = envoyer(g, 'seb', note({ chantier: 'CHANTIER INCONNU' }));
  assert.strictEqual(r.ok, true, j(r));
  assert.ok(!('RECAP_A_REFAIRE' in g.proprietes));
  g.ctx.traiterComptes();
  assert.strictEqual(recaps(g, true).length, 0);
});
test('chantier renommé (il a un N°) : le récapitulatif suit le chantier ; le fichier à l’ancien nom part à la corbeille ; aucun autre fichier du dossier n’est touché', () => {
  const g = environnement();
  numeroChantier(g, 'CHANTIER TEST 1', '0501');
  envoyer(g, 'seb', note({ date: '05/11/2026', remarques: 'AVANT-RENOMMAGE' }));
  g.ctx.traiterComptes();
  const dossier = dossierNotes(g);
  const perso = g.creerElement('fichier', 'Récapitulatif des notes - perso.pdf', dossier, { contenu: 'à Franck' });
  const autre = g.creerElement('fichier', PREFIXE + 'brouillon.docx', dossier, { contenu: 'à Franck' });
  // Franck renomme le chantier et son dossier Drive (le serveur retrouve le dossier par le nom du chantier)
  g.feuilles['Chantiers'].lignes.find(x => x[0] === 'CHANTIER TEST 1')[0] = 'CHANTIER RENOMMÉ';
  Object.values(g.elements).filter(e => e.type === 'dossier' && e.nom === 'CHANTIER TEST 1').forEach(e => { e.nom = 'CHANTIER RENOMMÉ'; });
  envoyer(g, 'seb', note({ chantier: 'CHANTIER RENOMMÉ', date: '19/11/2026', remarques: 'APRÈS-RENOMMAGE' }));
  g.ctx.traiterComptes();
  const f = recaps(g).filter(e => /\.pdf$/.test(e.nom));
  assert.deepStrictEqual(f.map(e => e.nom), [PREFIXE + 'CHANTIER RENOMMÉ.pdf'], j(recaps(g, true).map(e => [e.nom, e.corbeille])));
  assert.ok(/AVANT-RENOMMAGE/.test(String(f[0].contenu)) && /APRÈS-RENOMMAGE/.test(String(f[0].contenu)));
  assert.ok(!perso.corbeille && !autre.corbeille, 'les fichiers de Franck ne sont pas touchés');
  const pdfNotes = Object.values(g.elements).filter(e => e.type === 'fichier' && /^COMPTE RENDU /.test(e.nom));
  assert.ok(pdfNotes.length === 2 && pdfNotes.every(e => !e.corbeille), 'les PDF des notes ne sont jamais touchés');
});

console.log('Lot 8d — pannes et limites');
test('le fichier ne peut pas être créé : l’ancien revient de la corbeille, le chantier reste en attente ; 6 échecs : un seul mail d’alerte ; puis ça remarche', () => {
  const g = environnement();
  envoyer(g, 'seb', note({ remarques: 'V1' }));
  g.ctx.traiterComptes();
  const v1 = recaps(g)[0], dossier = dossierNotes(g), creer = dossier.api.createFile;
  envoyer(g, 'seb', note({ date: '13/11/2026', remarques: 'V2' }));
  dossier.api.createFile = () => { throw new Error('Drive en panne'); };
  g.mails.length = 0;
  for (let i = 0; i < 5; i++) g.ctx.traiterComptes();
  assert.ok(!v1.corbeille && recaps(g).length === 1, 'l’ancien fichier est toujours là');
  assert.strictEqual(Object.values(attente(g))[0].essais, 5);
  assert.strictEqual(g.mails.length, 0);
  g.ctx.traiterComptes(); g.ctx.traiterComptes();
  const alertes = g.mails.filter(m => /Récapitulatif des notes en retard/.test(m.sujet));
  assert.strictEqual(alertes.length, 1, j(g.mails.map(m => m.sujet)));
  assert.ok(/CHANTIER TEST 1/.test(alertes[0].texte) && /Drive en panne/.test(alertes[0].texte), j(alertes[0]));
  dossier.api.createFile = creer;
  g.ctx.traiterComptes();
  assert.ok(v1.corbeille && recaps(g).length === 1 && /V2/.test(String(recaps(g)[0].contenu)));
  assert.ok(!('RECAP_A_REFAIRE' in g.proprietes));
});
test('une note arrive PENDANT la fabrication : le chantier reste en attente et le fichier est refait au passage suivant', () => {
  const g = environnement();
  envoyer(g, 'seb', note({ remarques: 'N1' }));
  const cle = Object.keys(attente(g))[0], vue = attente(g)[cle];
  envoyer(g, 'seb', note({ date: '13/11/2026', remarques: 'N2' }));          // arrive après la lecture de la liste d'attente
  g.ctx.recapSolder_(cle, vue, '');
  assert.strictEqual(Object.keys(attente(g)).length, 1, 'toujours en attente');
  g.ctx.traiterComptes();
  assert.ok(/N2/.test(String(recaps(g)[0].contenu)) && !('RECAP_A_REFAIRE' in g.proprietes));
});
test('six chantiers en attente : quatre fichiers au plus par passage, les autres au passage suivant', () => {
  const g = environnement();
  for (let i = 1; i <= 6; i++) envoyer(g, 'seb', note({ chantier: 'CHANTIER TEST ' + i }));
  assert.strictEqual(g.ctx.recapPassage_(), 4);
  assert.strictEqual(recaps(g).length, 4);
  assert.strictEqual(g.ctx.recapPassage_(), 2);
  assert.strictEqual(recaps(g).length, 6);
  assert.strictEqual(g.ctx.recapPassage_(), 0);
});
test('liste d’attente illisible (propriété abîmée) : le passage ne plante pas, la prochaine note redemande le fichier', () => {
  const g = environnement();
  g.proprietes.RECAP_A_REFAIRE = '{pas du json';
  assert.strictEqual(g.ctx.traiterComptes(), 'ok');
  envoyer(g, 'seb');
  g.ctx.traiterComptes();
  assert.strictEqual(recaps(g).length, 1);
});
test('onglet aux titres changés : la note part quand même (lot 8), aucun récapitulatif, le passage ne plante pas', () => {
  const g = environnement();
  envoyer(g, 'seb');
  g.feuilles['Comptes rendus'].lignes[0][3] = 'Date';
  assert.strictEqual(g.ctx.traiterComptes(), 'ok');
  assert.strictEqual(recaps(g).length, 0);
  const r = envoyer(g, 'seb');
  assert.strictEqual(r.ok, true, j(r));
  const l = lire(g, 'seb', 'CHANTIER TEST 1');
  assert.deepStrictEqual([l.ok, l.data.notes.length], [true, 0]);
});

console.log('Lot 8d — qui peut lire le récapitulatif dans l’appli');
test('conducteur et admin : tout chantier ; poseur : seulement un chantier de sa liste ; chantier inconnu et chantier interdit : la même réponse', () => {
  const g = environnement();
  envoyer(g, 'seb', note({ remarques: 'SECRET-1' }));
  envoyer(g, 'seb', note({ chantier: 'CHANTIER TEST 2', remarques: 'SECRET-2' }));
  assert.strictEqual(lire(g, 'franck', 'CHANTIER TEST 2').data.notes[0].texte, 'SECRET-2');
  assert.strictEqual(lire(g, 'thomas27', 'CHANTIER TEST 1').data.notes[0].texte, 'SECRET-1');
  const interdit = lire(g, 'thomas27', 'CHANTIER TEST 2'), inconnu = lire(g, 'thomas27', 'CHANTIER QUI N’EXISTE PAS'), rien = lire(g, 'kevin', 'CHANTIER TEST 1');
  [interdit, inconnu, rien].forEach(r => { assert.deepStrictEqual([r.ok, r.code, r.message], [false, 'INTERDIT', 'Ce chantier n’est pas dans votre liste.'], j(r)); assert.ok(!r.data); });
  assert.ok(JSON.stringify(interdit).indexOf('SECRET') < 0);
});
test('sans compte, ou avec un jeton faux : refusé, aucun texte rendu ; la réponse ne contient ni nom de fichier ni compte', () => {
  const g = environnement();
  envoyer(g, 'seb', note({ remarques: 'SECRET-1' }));
  const sans = lire(g, '', 'CHANTIER TEST 1');
  assert.ok(!sans.ok && /CONNEXION_REQUISE|JETON_INVALIDE/.test(sans.code) && JSON.stringify(sans).indexOf('SECRET') < 0, j(sans));
  const faux = poster(g, { action: 'recapNotes', chantier: 'CHANTIER TEST 1', jeton: 'seb.1.9999999999999.faux' });
  assert.ok(!faux.ok && JSON.stringify(faux).indexOf('SECRET') < 0, j(faux));
  const bon = lire(g, 'seb', 'CHANTIER TEST 1');
  assert.deepStrictEqual(Object.keys(bon.data.notes[0]).sort(), ['auteur', 'date', 'objet', 'sansTexte', 'texte']);
});
test('compte désactivé : refusé', () => {
  const g = environnement();
  envoyer(g, 'seb');
  g.feuilles['Utilisateurs'].lignes[1][3] = false;
  const r = lire(g, 'thomas27', 'CHANTIER TEST 1');
  assert.ok(!r.ok && !r.data, j(r));
});

console.log('Lot 8d — après la relecture indépendante');
test('deux chantiers de MÊME N° (deux lots d’une opération) : chacun son récapitulatif, et un compte qui n’a droit qu’à l’un ne lit jamais les notes de l’autre', () => {
  const g = environnement();
  const ch = g.feuilles['Chantiers'].lignes;
  ch.find(x => x[0] === 'CHANTIER TEST 1')[4] = '0700';
  ch.find(x => x[0] === 'CHANTIER TEST 2')[4] = '0700';
  envoyer(g, 'seb', note({ chantier: 'CHANTIER TEST 1', remarques: 'TEXTE-DU-UN' }));
  envoyer(g, 'seb', note({ chantier: 'CHANTIER TEST 2', remarques: 'SECRET-DU-DEUX' }));
  const un = lire(g, 'thomas27', 'CHANTIER TEST 1');              // thomas27 n'a que CHANTIER TEST 1
  assert.deepStrictEqual(un.data.notes.map(n => n.texte), ['TEXTE-DU-UN'], j(un));
  assert.strictEqual(lire(g, 'thomas27', 'CHANTIER TEST 2').code, 'INTERDIT');
  assert.strictEqual(Object.keys(attente(g)).length, 2, 'deux chantiers en attente, pas un');
  g.ctx.traiterComptes();
  const f = recaps(g).map(e => [e.nom, String(e.contenu)]);
  assert.strictEqual(f.length, 2, j(f.map(x => x[0])));
  const duUn = f.find(x => x[0] === PREFIXE + 'CHANTIER TEST 1.pdf')[1], duDeux = f.find(x => x[0] === PREFIXE + 'CHANTIER TEST 2.pdf')[1];
  assert.ok(/TEXTE-DU-UN/.test(duUn) && !/SECRET-DU-DEUX/.test(duUn) && /SECRET-DU-DEUX/.test(duDeux) && !/TEXTE-DU-UN/.test(duDeux));
});
test('deux chantiers sans N° dont les noms ne diffèrent que par une espace (« LOT 1 2 » et « LOT 12 ») : jamais confondus', () => {
  const g = environnement();
  g.feuilles['Chantiers'].lignes.push(['LOT 1 2', 'LIEU', 'En cours', 'Franck ESSAI'], ['LOT 12', 'LIEU', 'En cours', 'Franck ESSAI']);
  envoyer(g, 'seb', note({ chantier: 'LOT 1 2', remarques: 'TEXTE-LOT-1-2' }));
  envoyer(g, 'seb', note({ chantier: 'LOT 12', remarques: 'TEXTE-LOT-12' }));
  assert.deepStrictEqual(lire(g, 'seb', 'LOT 1 2').data.notes.map(n => n.texte), ['TEXTE-LOT-1-2']);
  assert.deepStrictEqual(lire(g, 'seb', 'LOT 12').data.notes.map(n => n.texte), ['TEXTE-LOT-12']);
  g.ctx.traiterComptes();
  assert.strictEqual(recaps(g).length, 2);
});
test('chantier renommé ENTRE la note et le passage (il a un N°) : le fichier est fait quand même, au nouveau nom', () => {
  const g = environnement();
  numeroChantier(g, 'CHANTIER TEST 3', '0803');
  envoyer(g, 'seb', note({ chantier: 'CHANTIER TEST 3', remarques: 'AVANT-LE-PASSAGE' }));
  g.feuilles['Chantiers'].lignes.find(x => x[0] === 'CHANTIER TEST 3')[0] = 'CHANTIER TROIS RENOMMÉ';
  Object.values(g.elements).filter(e => e.type === 'dossier' && e.nom === 'CHANTIER TEST 3').forEach(e => { e.nom = 'CHANTIER TROIS RENOMMÉ'; });
  g.ctx.traiterComptes();
  const f = recaps(g);
  assert.deepStrictEqual(f.map(e => e.nom), [PREFIXE + 'CHANTIER TROIS RENOMMÉ.pdf']);
  assert.ok(/AVANT-LE-PASSAGE/.test(String(f[0].contenu)));
});
test('deux passages en même temps : le second ne fait rien (jamais deux fichiers du même nom) ; la marque tombe quand le premier a fini', () => {
  const g = environnement();
  envoyer(g, 'seb');
  g.ctx.cacheScript_().put('recap:passage', '1', 360);            // un passage est en cours
  assert.strictEqual(g.ctx.recapPassage_(), 0);
  assert.strictEqual(recaps(g, true).length, 0);
  g.ctx.cacheScript_().remove('recap:passage');
  assert.strictEqual(g.ctx.recapPassage_(), 1);
  assert.strictEqual(recaps(g).length, 1);
  assert.strictEqual(g.ctx.cacheScript_().get('recap:passage'), null, 'la marque est retirée à la fin');
});
test('objet et rédacteur qui commencent par un tiret ou un « + » : rendus tels qu’ils ont été tapés', () => {
  const g = environnement();
  envoyer(g, 'seb', note({ objet: '- point sécurité', auteur: '+33 Dupont' }));
  const n = lire(g, 'seb', 'CHANTIER TEST 1').data.notes[0];
  assert.deepStrictEqual([n.objet, n.auteur], ['- point sécurité', '+33 Dupont']);
});
test('une nouvelle note ne remet pas à zéro le compteur d’échecs : l’alerte part même sur un chantier où les notes arrivent sans arrêt', () => {
  const g = environnement();
  envoyer(g, 'seb');
  g.ctx.traiterComptes();
  const dossier = dossierNotes(g);
  dossier.api.createFile = () => { throw new Error('Drive en panne'); };
  g.mails.length = 0;
  for (let i = 0; i < 6; i++) { envoyer(g, 'seb', note({ date: '1' + i + '/11/2026' })); g.ctx.traiterComptes(); }
  assert.strictEqual(g.mails.filter(m => /Récapitulatif des notes en retard/.test(m.sujet)).length, 1, j(g.mails.map(m => m.sujet)));
});
test('liste d’attente trop longue pour une propriété du script (9 000 caractères) : le chantier de trop n’est pas noté, rien ne casse', () => {
  const g = environnement();
  const gros = {};
  for (let i = 0; i < 70; i++) gros['c:chantier au nom très long numéro ' + i + ' ' + 'x'.repeat(60)] = { nom: 'CHANTIER AU NOM TRÈS LONG NUMÉRO ' + i + ' ' + 'X'.repeat(60), numero: '', n: 1, essais: 29 };
  g.proprietes.RECAP_A_REFAIRE = JSON.stringify(gros);
  const avant = g.proprietes.RECAP_A_REFAIRE.length;
  assert.ok(avant > 8000);
  const r = envoyer(g, 'seb');
  assert.strictEqual(r.ok, true, j(r));
  assert.strictEqual(g.proprietes.RECAP_A_REFAIRE.length, avant, 'rien n’est ajouté au-delà de la limite');
});

console.log('Lot 8d — livraison');
test('livraison : le serveur à coller contient le lot 8d, dans la version de Config.gs, Recapitulatif.gs après ComptesRendus.gs, sans les outils d’essai', () => {
  const code = fs.readFileSync(path.join(__dirname, '..', 'A-COLLER-DANS-APPS-SCRIPT', 'Code.gs'), 'utf8');
  ["const VERSION_API = '" + VERSION_SERVEUR + "'", 'function recapPassage_(', 'function recapLire_(', 'function installerLot8dTest(', 'function installerLot8dProduction(', "'recapNotes'"]
    .forEach(t => assert.ok(code.indexOf(t) > -1, t));
  assert.ok(code.indexOf('function crEnregistrer_(') < code.indexOf('function recapPassage_('));
  assert.ok(code.indexOf('function outilTest_(') < 0);
  assert.ok(code.indexOf(String.fromCharCode(0x2028)) < 0 && code.indexOf(String.fromCharCode(0x2029)) < 0, 'aucun séparateur de ligne brut dans le fichier à coller');
});
test('le serveur à coller, chargé SEUL : il garde le texte d’une note et refait le fichier', () => {
  const g = environnement({ codeGs: true });
  assert.strictEqual(envoyer(g, 'seb', note({ remarques: 'DEPUIS-CODE-GS' })).ok, true);
  g.ctx.traiterComptes();
  assert.ok(/DEPUIS-CODE-GS/.test(String(recaps(g)[0].contenu)));
});

console.log('\n' + reussis + ' test(s) réussi(s)' + (process.exitCode ? ' — DES TESTS ÉCHOUENT' : ''));
