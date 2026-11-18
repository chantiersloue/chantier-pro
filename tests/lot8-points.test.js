// Tests du lot 8c, côté serveur (note de réunion en points, reprise des points ouverts) : node tests/lot8-points.test.js
// Le VRAI code d'apps-script/ tourne avec les services Google simulés (tests/gas-harness.js) : rien ne part chez Google.
// Noms, chantiers et adresses : tous fictifs (dépôt public).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { creerGoogle, chargerScript } = require('./gas-harness');

const FRANCK = 'franck@loue.test', SEB = 'seb@loue.test';

function environnement(options = {}) {
  const g = creerGoogle(Object.assign({
    nomSheet: options.test ? 'ChantierPro TEST' : 'ChantierPro',
    proprietes: Object.assign({ DRIVE_ROOT_ID: 'RACINE', DRIVE_PLANNING_ID: 'PLANNING', HACHAGE_ITERATIONS: '200' }, options.test ? { ENVIRONNEMENT: 'TEST' } : {}),
    feuilles: {
      'Contacts': [['Nom', 'Role', 'Email', 'ChefEquipe', 'Destinataire', 'ConducteurDefaut', 'ChefAtelier', 'absenceNotif'],
        ['Franck ESSAI', 'Conducteur de travaux', FRANCK, 'O', 'N', 'O', 'N', 'O'],
        ['Sébastien ESSAI', 'Conducteur de travaux', SEB, 'O', 'N', 'N', 'N', 'N'],
        ['Thomas ESSAI', 'Poseur', 'thomas@loue.test', 'N', 'N', 'N', 'N', 'N']],
      'Contacts notes': [['Nom', 'Email'], ['Architecte ESSAI', 'archi@ext.test']],
      'Chantiers': [['Nom', 'Référence', 'Statut', 'Conducteur'],
        ['CHANTIER TEST 1', 'LIEU 1', 'En cours', 'Sébastien ESSAI'],
        ['CHANTIER TEST 2', 'LIEU 2', 'En cours', 'Franck ESSAI']],
    },
  }, options.google || {}));
  g.creerElement('dossier', 'Loué Menuiserie - Chantiers', null, { id: 'RACINE' });
  g.creerElement('dossier', 'Planning', null, { id: 'PLANNING' });
  g.ctx = chargerScript(g);
  g.ctx.genererCle(); g.ctx.preparerOngletsLot2();
  const u = g.feuilles['Utilisateurs'];
  u.lignes[1] = ['thomas27', 'Thomas ESSAI', 'Poseur', true, false, '', '', false, false, ''];
  u.lignes[2] = ['seb', 'Sébastien ESSAI', 'Conducteur', true, false, '', '', false, false, ''];
  u.lignes[3] = ['franck', 'Franck ESSAI', 'Admin', true, false, '', '', false, false, ''];
  u.lignes[4] = ['kevin', 'Kévin ESSAI', 'Poseur', true, false, '', '', false, false, ''];
  g.ctx.traiterComptes();
  // thomas27 est poseur SUR le chantier 1 ; kevin n'a aucun chantier
  const a = g.feuilles['Accès chantiers'], col = a.lignes[0].indexOf('thomas27');
  a.lignes.forEach(l => { if (l[0] === 'CHANTIER TEST 1') l[col] = true; });
  if (!options.sansInstallation) (options.test ? g.ctx.installerLot8Test : g.ctx.installerLot8Production)();
  return g;
}
const poster = (g, corps) => JSON.parse(g.ctx.doPost({ postData: { contents: JSON.stringify(corps) } }).contenu);
const jeton = (g, id) => g.ctx.fabriquerJeton_(id, 1);
let compteur = 0;
const idFiche = () => 'fiche-pts-' + String(++compteur).padStart(6, '0');
let nPoint = 0;
const idPoint = () => 'pt-essai-' + String(++nPoint).padStart(6, '0');
// Une note comme la page 10.2 l'envoie : « points » = { base, gestes }, « remarques » = texte saisi, « commentaires » = copie lisible
const note = (base, gestes, extra) => Object.assign({ type: 'note', chantier: 'CHANTIER TEST 1', auteur: 'Franck ESSAI', date: '12/11/2026', objet: 'Réunion de chantier',
  remarques: 'Remarque générale', commentaires: 'COPIE POUR ANCIEN SERVEUR', destinataires: [], photosBase64: [], points: { base: base || '', gestes: gestes || [] } }, extra || {});
const nouveau = (t, extra) => Object.assign({ id: idPoint(), g: 'nouveau', t: t }, extra || {});
const envoyer = (g, qui, donnees, id) => poster(g, Object.assign({ action: 'fiche', id: id || idFiche(), donnees: donnees }, qui ? { jeton: jeton(g, qui) } : {}));
const lire = (g, qui, chantier) => poster(g, Object.assign({ action: 'compteRendu', chantier: chantier === undefined ? 'CHANTIER TEST 1' : chantier }, qui ? { jeton: jeton(g, qui) } : {}));
const CR = g => (g.feuilles['Comptes rendus'] ? g.feuilles['Comptes rendus'].lignes.slice(1).filter(l => l[0]) : []);
const C = { fiche: 0, chantier: 1, numChantier: 2, date: 3, objet: 4, auteur: 5, compte: 6, pdf: 7, recu: 8, remarque: 9, ouverts: 10, clos: 11, donnees: 12, suite: 13 };
const dernierPdf = g => { const m = g.mails[g.mails.length - 1]; return m ? String(m.opts.attachments[0].contenu) : ''; };
const textePdf = g => dernierPdf(g).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const ouverts = (g, qui) => lire(g, qui || 'seb').data.ouverts.map(p => p.t);
const clos = (g, qui) => lire(g, qui || 'seb').data.clos.map(p => p.t);
// Trois points ouverts par une première note du 05/11/2026 ; rend { g, base, A, B, C } (identifiants)
function depart(options) {
  const g = environnement(options);
  const A = idPoint(), B = idPoint(), Cc = idPoint(), id = idFiche();
  const r = envoyer(g, 'seb', note('', [{ id: A, g: 'nouveau', t: 'Point A' }, { id: B, g: 'nouveau', t: 'Point B' }, { id: Cc, g: 'nouveau', t: 'Point C' }], { date: '05/11/2026' }), id);
  assert.strictEqual(r.code, 'ENREGISTRE', JSON.stringify(r));
  return { g, base: id, A, B, C: Cc };
}

let reussis = 0;
function test(nom, fn) {
  try { fn(); reussis++; console.log('  ✓ ' + nom); }
  catch (e) { console.log('  ✗ ' + nom + '\n    ' + String(e.stack || e.message).split('\n').slice(0, 7).join('\n    ')); process.exitCode = 1; }
}

console.log('Lot 8c — une note en points : nouveaux points, lecture, PDF');
test('première note : trois nouveaux points (dont un réglé pendant la réunion) ; la réponse rend la liste ; onglet, PDF et lecture d’accord', () => {
  const g = environnement(), id = idFiche();
  const r = envoyer(g, 'seb', note('', [nouveau('Fuite sur le châssis du R+1'), nouveau('Plinthes du hall à reprendre', { regle: true }), nouveau('Porte palière B12\nserrure à changer')]), id);
  assert.deepStrictEqual([r.ok, r.code, r.data.envoyes], [true, 'ENREGISTRE', 1], JSON.stringify(r));
  assert.deepStrictEqual([r.data.points.base, r.data.points.date, r.data.points.ouverts.map(p => p.t), r.data.points.clos.map(p => p.t)],
    [id, '12/11/2026', ['Fuite sur le châssis du R+1', 'Porte palière B12\nserrure à changer'], ['Plinthes du hall à reprendre']]);
  assert.ok(!('remarqueCR' in r.data) && !('pointsNonSuivis' in r.data), JSON.stringify(r.data));
  const l = CR(g)[0];
  assert.strictEqual(l[C.ouverts], '• Fuite sur le châssis du R+1\n• Porte palière B12 / serrure à changer');
  assert.strictEqual(l[C.clos], '• Plinthes du hall à reprendre');
  assert.ok(/^\{"o":\[/.test(l[C.donnees]) && l[C.suite] === '' && l[C.remarque] === '', JSON.stringify(l.slice(9)));
  const pdf = textePdf(g);
  assert.ok(/Points \(3\) — 2 ouverts, 1 clos/.test(pdf), pdf);
  assert.ok(/1 Fuite sur le châssis du R\+1 nouveau point OUVERT 2 Plinthes du hall à reprendre nouveau point, réglé pendant la réunion CLOS 3 Porte palière B12 serrure à changer nouveau point OUVERT/.test(pdf), pdf);
  assert.ok(/Remarques générales Remarque générale/.test(pdf) && pdf.indexOf('COPIE POUR ANCIEN SERVEUR') < 0, 'remarques une fois, sans la copie pour ancien serveur');
  const lu = lire(g, 'seb');
  assert.deepStrictEqual([lu.ok, lu.data.base, lu.data.date, lu.data.chantier, lu.data.ouverts.length, lu.data.clos.length, typeof lu.data.mailsRestants], [true, id, '12/11/2026', 'CHANTIER TEST 1', 2, 1, 'number'], JSON.stringify(lu));
  assert.deepStrictEqual(Object.keys(lu.data.ouverts[0]).sort(), ['d', 'id', 't']);
  assert.strictEqual(lu.data.ouverts[0].d, '12/11/2026');
});
test('chantier sans aucun compte rendu : lecture vide (base vide), sans erreur ; onglet pas encore créé : pareil', () => {
  const g = environnement();
  const lu = lire(g, 'seb');
  assert.deepStrictEqual([lu.ok, lu.data.base, lu.data.ouverts, lu.data.clos], [true, '', [], []], JSON.stringify(lu));
  const h = environnement({ sansInstallation: true });
  assert.deepStrictEqual([lire(h, 'seb').ok, lire(h, 'seb').data.base, !!h.feuilles['Comptes rendus']], [true, '', false], 'la lecture ne crée pas l’onglet');
});
test('texte piégé dans un point (balise, formule) : échappé dans le PDF, écrit comme du texte dans le Sheet ; 2 000 caractères au plus ; retours à la ligne gardés', () => {
  const g = environnement();
  envoyer(g, 'seb', note('', [nouveau('<b>gras</b> & <script>x</script>'), nouveau('=IMPORTDATA("x")'), nouveau('x'.repeat(2500)), nouveau('  ligne 1 \r\n\r\n\r\n\r\n ligne 2  ')]));
  assert.ok(dernierPdf(g).indexOf('&lt;b&gt;gras&lt;/b&gt; &amp; &lt;script&gt;') > -1 && dernierPdf(g).indexOf('<script>x') < 0, 'échappé');
  const l = CR(g)[0];
  assert.ok(String(l[C.ouverts]).indexOf('• =IMPORTDATA("x")') > -1 && String(l[C.ouverts]).charAt(0) === '•', 'la cellule ne commence pas par une formule');
  const o = lire(g, 'seb').data.ouverts;
  assert.deepStrictEqual([o[2].t.length, o[3].t], [2000, 'ligne 1\n\nligne 2']);
});

console.log('Lot 8c — chaque geste');
test('« rien » : le point reste ouvert, repris dans le PDF avec « ouvert depuis le … » ; le texte du BUREAU est imprimé, pas celui du téléphone', () => {
  const { g, base, A, B, C: Cc } = depart();
  envoyer(g, 'seb', note(base, [{ id: A, g: 'rien', t: 'Texte périmé du téléphone' }, { id: B, g: 'rien', t: 'Point B' }, { id: Cc, g: 'rien', t: 'Point C' }]));
  assert.deepStrictEqual(ouverts(g), ['Point A', 'Point B', 'Point C']);
  assert.ok(/1 Point A ouvert depuis le 05\/11\/2026 OUVERT/.test(textePdf(g)) && textePdf(g).indexOf('Texte périmé') < 0, textePdf(g));
  assert.strictEqual(CR(g)[1][C.remarque], '');
});
test('« complete » : le texte est remplacé (le PDF de chaque note garde sa version) ; « clos » : le point quitte les points ouverts', () => {
  const { g, base, A, B, C: Cc } = depart();
  const r = envoyer(g, 'seb', note(base, [{ id: A, g: 'complete', t: 'Point A, complété le 12' }, { id: B, g: 'clos', t: 'Point B' }, { id: Cc, g: 'rien', t: 'Point C' }]));
  assert.deepStrictEqual([r.data.points.ouverts.map(p => p.t), r.data.points.clos.map(p => [p.t, p.d, p.k])], [['Point A, complété le 12', 'Point C'], [['Point B', '05/11/2026', '12/11/2026']]]);
  const pdf = textePdf(g);
  assert.ok(/1 Point A, complété le 12 complété · ouvert depuis le 05\/11\/2026 OUVERT 2 Point B clos · ouvert depuis le 05\/11\/2026 CLOS 3 Point C ouvert depuis le 05\/11\/2026 OUVERT/.test(pdf), pdf);
  assert.deepStrictEqual([CR(g)[1][C.ouverts], CR(g)[1][C.clos]], ['• Point A, complété le 12\n• Point C', '• Point B']);
  assert.strictEqual(lire(g, 'seb').data.ouverts[0].d, '05/11/2026', 'la date d’ouverture ne change pas');
});
test('« clos » avec un texte modifié (complété puis clos dans la même note) : le texte modifié est gardé', () => {
  const { g, base, A } = depart();
  envoyer(g, 'seb', note(base, [{ id: A, g: 'clos', t: 'Point A, réglé par le plaquiste', m: true }]));
  assert.deepStrictEqual(clos(g), ['Point A, réglé par le plaquiste']);
});
test('« rouvert » : un point clos revient dans les points ouverts, avec sa date d’ouverture d’origine', () => {
  const { g, base, A } = depart();
  const id2 = idFiche();
  envoyer(g, 'seb', note(base, [{ id: A, g: 'clos', t: 'Point A' }], { date: '12/11/2026' }), id2);
  assert.deepStrictEqual([ouverts(g), clos(g)], [['Point B', 'Point C'], ['Point A']]);
  envoyer(g, 'seb', note(id2, [{ id: A, g: 'rouvert', t: 'Point A' }], { date: '19/11/2026' }));
  assert.deepStrictEqual([ouverts(g), clos(g)], [['Point B', 'Point C', 'Point A'], []]);
  assert.ok(/Point A rouvert \(clos par le compte rendu du 12\/11\/2026\) · ouvert depuis le 05\/11\/2026 OUVERT/.test(textePdf(g)), textePdf(g));
  assert.strictEqual(lire(g, 'seb').data.ouverts[2].d, '05/11/2026');
});
test('« Clos récemment » : un point clos reste rouvrable pendant les 3 comptes rendus suivants, puis il ne revient plus dans la lecture', () => {
  const { g, base, A } = depart();
  let b = idFiche();
  envoyer(g, 'seb', note(base, [{ id: A, g: 'clos', t: 'Point A' }]), b);
  for (let k = 1; k <= 2; k++) { const s = idFiche(); envoyer(g, 'seb', note(b, []), s); b = s; assert.deepStrictEqual(clos(g), ['Point A'], 'encore rouvrable après ' + k + ' compte(s) rendu(s)'); }
  // le 3e compte rendu peut encore le rouvrir…
  const h = JSON.parse(JSON.stringify(CR(g).map(l => l.slice())));   // (photo de l'onglet, pour rejouer l'autre branche)
  const s3 = idFiche();
  envoyer(g, 'seb', note(b, [{ id: A, g: 'rouvert', t: 'Point A' }]), s3);
  assert.ok(ouverts(g).indexOf('Point A') > -1, 'rouvert par le 3e compte rendu');
  assert.strictEqual(h.length, 4);
  // … et, s'il ne le fait pas, le point sort de « Clos récemment » : seul son identifiant est gardé
  const g2 = depart(); let b2 = idFiche();
  envoyer(g2.g, 'seb', note(g2.base, [{ id: g2.A, g: 'clos', t: 'Point A' }]), b2);
  for (let k = 1; k <= 3; k++) { const s = idFiche(); envoyer(g2.g, 'seb', note(b2, []), s); b2 = s; }
  assert.deepStrictEqual(clos(g2.g), []);
  const etat = JSON.parse(CR(g2.g)[4][C.donnees]);
  assert.deepStrictEqual([etat.c.length, etat.f], [0, [g2.A]]);
  // un téléphone resté longtemps sans réseau envoie « rien » sur ce point : il n'est PAS rouvert
  envoyer(g2.g, 'thomas27', note(g2.base, [{ id: g2.A, g: 'rien', t: 'Point A' }, { id: g2.B, g: 'rien', t: 'Point B' }]));
  assert.deepStrictEqual(ouverts(g2.g), ['Point B', 'Point C']);
  assert.ok(/Point A déjà clos par un compte rendu précédent CLOS/.test(textePdf(g2.g)), textePdf(g2.g));
  // … mais « rouvert » le rouvre, avec le texte du téléphone
  envoyer(g2.g, 'seb', note(lire(g2.g, 'seb').data.base, [{ id: g2.A, g: 'rouvert', t: 'Point A, de retour' }]));
  assert.ok(ouverts(g2.g).indexOf('Point A, de retour') > -1);
});

console.log('Lot 8c — liste périmée, gestes croisés');
test('liste PÉRIMÉE : un téléphone resté sans réseau envoie « rien » partout ; il ne rouvre pas un point clos entre-temps et n’écrase pas un texte complété', () => {
  const { g, base, A, B, C: Cc } = depart();
  // Franck, au bureau : clôt A, complète B
  envoyer(g, 'franck', note(base, [{ id: A, g: 'clos', t: 'Point A' }, { id: B, g: 'complete', t: 'Point B, complété par Franck' }, { id: Cc, g: 'rien', t: 'Point C' }], { date: '07/11/2026' }));
  // Thomas, trois jours sans réseau, avec la liste du 05/11 : il n'a rien fait sur A ni B, et ajoute un point
  const r = envoyer(g, 'thomas27', note(base, [{ id: A, g: 'rien', t: 'Point A' }, { id: B, g: 'rien', t: 'Point B' }, { id: Cc, g: 'rien', t: 'Point C' }, nouveau('Point D, vu par Thomas')], { date: '08/11/2026' }));
  assert.deepStrictEqual(r.data.points.ouverts.map(p => p.t), ['Point B, complété par Franck', 'Point C', 'Point D, vu par Thomas']);
  assert.deepStrictEqual(r.data.points.clos.map(p => p.t), ['Point A']);
  assert.strictEqual(r.data.remarqueCR, 'Rédigé sans connaître le compte rendu du 07/11/2026');
  const pdf = textePdf(g);
  assert.ok(/Rédigé sans connaître le compte rendu du 07\/11\/2026/.test(pdf), 'ligne en tête du PDF');
  assert.ok(/1 Point A déjà clos par le compte rendu du 07\/11\/2026 CLOS 2 Point B, complété par Franck ouvert depuis le 05\/11\/2026 OUVERT/.test(pdf), pdf);
  assert.strictEqual(CR(g)[2][C.remarque], 'Rédigé sans connaître le compte rendu du 07/11/2026');
});
test('« complete » sur un point clos entre-temps : le texte reste dans le PDF de cette note, avec une remarque ; le point RESTE clos', () => {
  const { g, base, A } = depart();
  envoyer(g, 'franck', note(base, [{ id: A, g: 'clos', t: 'Point A' }], { date: '07/11/2026' }));
  envoyer(g, 'thomas27', note(base, [{ id: A, g: 'complete', t: 'Point A : le joint fuit encore' }], { date: '08/11/2026' }));
  assert.deepStrictEqual([ouverts(g), clos(g)], [['Point B', 'Point C'], ['Point A']]);
  assert.ok(/Point A : le joint fuit encore déjà clos par le compte rendu du 07\/11\/2026 : ce texte n’est gardé que dans ce compte rendu CLOS/.test(textePdf(g)), textePdf(g));
  assert.strictEqual(CR(g)[2][C.remarque], 'Rédigé sans connaître le compte rendu du 07/11/2026 ; un point complété était déjà clos (compte rendu du 07/11/2026)');
});
test('deux « complete » croisés sur le même point : le dernier arrivé donne le texte, l’autre reste dans son PDF ; la seconde note porte la remarque', () => {
  const { g, base, A } = depart();
  envoyer(g, 'franck', note(base, [{ id: A, g: 'complete', t: 'Point A, version de Franck' }], { date: '07/11/2026' }));
  const pdfFranck = textePdf(g);
  const r = envoyer(g, 'thomas27', note(base, [{ id: A, g: 'complete', t: 'Point A, version de Thomas' }], { date: '08/11/2026' }));
  assert.strictEqual(ouverts(g)[0], 'Point A, version de Thomas');
  assert.ok(/Point A, version de Franck/.test(pdfFranck));
  assert.strictEqual(r.data.remarqueCR, 'Rédigé sans connaître le compte rendu du 07/11/2026');
});
test('« clos » sur un point déjà clos : rien ne change ; note partie d’une liste À JOUR : aucune remarque', () => {
  const { g, base, A } = depart();
  const id2 = idFiche();
  envoyer(g, 'franck', note(base, [{ id: A, g: 'clos', t: 'Point A' }], { date: '07/11/2026' }), id2);
  const r = envoyer(g, 'thomas27', note(id2, [{ id: A, g: 'clos', t: 'Point A' }], { date: '08/11/2026' }));
  assert.deepStrictEqual([clos(g), 'remarqueCR' in r.data, CR(g)[2][C.remarque], CR(g)[2][C.clos]], [['Point A'], false, '', '']);
  assert.strictEqual(lire(g, 'seb').data.clos[0].k, '07/11/2026', 'la date de clôture reste celle du premier');
});
test('note de l’ANCIEN format (sans points) sur un chantier qui a des points ouverts : ils restent ouverts, aucune remarque ; elle compte comme un compte rendu', () => {
  const { g } = depart();
  const r = envoyer(g, 'seb', { type: 'note', chantier: 'CHANTIER TEST 1', auteur: 'Franck ESSAI', date: '12/11/2026', objet: 'Ancienne page', commentaires: 'Texte libre', destinataires: [], photosBase64: [] });
  assert.deepStrictEqual([r.code, r.data.points.ouverts.length, CR(g)[1][C.remarque]], ['ENREGISTRE', 3, '']);
  assert.ok(textePdf(g).indexOf('Points (') < 0 && /Notes &amp; commentaires|Notes & commentaires/.test(dernierPdf(g)), 'PDF d’avant le lot 8c');
  assert.deepStrictEqual(ouverts(g), ['Point A', 'Point B', 'Point C']);
});
test('note en points sans liste connue (téléphone sans réseau ni liste gardée) : ses nouveaux points s’ajoutent, les anciens restent ouverts, remarque écrite', () => {
  const { g } = depart();
  const r = envoyer(g, 'thomas27', note('', [nouveau('Point D')], { date: '12/11/2026' }));
  assert.deepStrictEqual(ouverts(g), ['Point A', 'Point B', 'Point C', 'Point D']);
  assert.strictEqual(r.data.remarqueCR, 'Rédigé sans connaître le compte rendu du 05/11/2026');
});

console.log('Lot 8c — identifiants forgés, inconnus, d’un autre chantier');
test('geste sur un identifiant INCONNU (note précédente abandonnée dans un téléphone) : il devient un nouveau point avec son texte, rien n’est perdu', () => {
  const { g, base } = depart();
  const X = idPoint(), Y = idPoint();
  envoyer(g, 'seb', note(base, [{ id: X, g: 'rien', t: 'Point de la note abandonnée' }, { id: Y, g: 'clos', t: 'Autre point, déjà réglé' }]));
  assert.ok(ouverts(g).indexOf('Point de la note abandonnée') > -1);
  assert.deepStrictEqual(clos(g), ['Autre point, déjà réglé']);
  assert.ok(/Point de la note abandonnée nouveau point \(repris d’une note que le bureau n’a pas reçue\) OUVERT/.test(textePdf(g)), textePdf(g));
});
test('identifiant d’un AUTRE chantier : traité comme un nouveau point de CE chantier ; le point de l’autre chantier n’est pas touché', () => {
  const { g, A } = depart();
  envoyer(g, 'seb', note('', [{ id: A, g: 'clos', t: 'Point A, vu du chantier 2' }], { chantier: 'CHANTIER TEST 2' }));
  assert.deepStrictEqual(ouverts(g), ['Point A', 'Point B', 'Point C'], 'chantier 1 intact');
  assert.deepStrictEqual(lire(g, 'seb', 'CHANTIER TEST 2').data.clos.map(p => p.t), ['Point A, vu du chantier 2']);
});
test('« nouveau » sous un identifiant déjà pris : le point existant n’est pas remplacé, le nouveau reçoit un autre identifiant', () => {
  const { g, base, A } = depart();
  envoyer(g, 'seb', note(base, [{ id: A, g: 'nouveau', t: 'Faux nouveau point' }]));
  const o = lire(g, 'seb').data.ouverts;
  assert.deepStrictEqual(o.map(p => p.t), ['Point A', 'Point B', 'Point C', 'Faux nouveau point']);
  assert.ok(o[3].id !== A && /^pt-srv-/.test(o[3].id), o[3].id);
});
test('gestes mal formés (pas une liste, geste inconnu, identifiant illisible, doublon, texte vide) : nettoyés, la note part toujours', () => {
  const { g, base, A } = depart();
  const r1 = envoyer(g, 'seb', note(base, 'pas une liste'));
  assert.strictEqual(r1.code, 'ENREGISTRE');
  const r2 = envoyer(g, 'seb', Object.assign(note(lire(g, 'seb').data.base, []), { points: { base: 12, gestes: [null, 7, { id: A, g: 'supprimer', t: 'x' }, { id: '../../etc', g: 'nouveau', t: 'Identifiant illisible' },
    { id: A, g: 'complete', t: 'Point A complété' }, { id: A, g: 'clos', t: 'doublon ignoré' }, { id: idPoint(), g: 'nouveau', t: '   ' }] } }));
  assert.strictEqual(r2.code, 'ENREGISTRE', JSON.stringify(r2));
  assert.deepStrictEqual(ouverts(g), ['Point A complété', 'Point B', 'Point C', 'Identifiant illisible']);
});
test('plus de 40 nouveaux points dans une note : 40 sont suivis, les suivants sont dans le PDF avec la mention « non suivi », remarque écrite', () => {
  const g = environnement();
  const r = envoyer(g, 'seb', note('', Array.from({ length: 43 }, (_, i) => nouveau('Point ' + (i + 1)))));
  assert.strictEqual(r.code, 'ENREGISTRE');
  assert.strictEqual(ouverts(g).length, 40);
  assert.ok(/43 Point 43 point non suivi \(plus de 40 nouveaux points dans cette note\)/.test(textePdf(g)), 'le 43e est imprimé');
  assert.ok(/plus de 40 nouveaux points/.test(CR(g)[0][C.remarque]));
  // la limite ne porte que sur les NOUVEAUX points : 45 points ouverts repris ne gênent pas
  const b = lire(g, 'seb').data;
  envoyer(g, 'seb', note(b.base, b.ouverts.map(p => ({ id: p.id, g: 'rien', t: p.t })).concat(Array.from({ length: 5 }, (_, i) => nouveau('Suite ' + i)))));
  assert.strictEqual(ouverts(g).length, 45);
});

console.log('Lot 8c — droits');
test('lecture : un poseur du chantier et un conducteur lisent ; un poseur hors chantier et un chantier inconnu reçoivent le MÊME refus ; sans compte : connexion demandée', () => {
  const { g } = depart();
  assert.strictEqual(lire(g, 'thomas27').ok, true);
  assert.strictEqual(lire(g, 'franck').ok, true);
  const interdit = lire(g, 'kevin'), inconnu = lire(g, 'kevin', 'CHANTIER QUI N EXISTE PAS'), inconnuChef = lire(g, 'seb', 'CHANTIER QUI N EXISTE PAS');
  assert.deepStrictEqual([interdit.ok, interdit.code], [false, 'INTERDIT']);
  assert.deepStrictEqual([inconnu.code, inconnu.message, inconnuChef.code], [interdit.code, interdit.message, 'INTERDIT']);
  assert.ok(!interdit.data, 'aucune donnée dans un refus');
  const sans = lire(g, null);
  assert.deepStrictEqual([sans.ok, sans.code], [false, 'CONNEXION_REQUISE'], JSON.stringify(sans));
});
test('poseur SANS accès au chantier : sa note part, seuls ses NOUVEAUX points sont pris ; ses gestes sur les points existants sont ignorés ; il ne reçoit pas la liste', () => {
  const { g, base, A, B } = depart();
  const r = envoyer(g, 'kevin', note(base, [{ id: A, g: 'clos', t: 'Point A' }, { id: B, g: 'complete', t: 'Point B saboté' }, nouveau('Point de Kévin')]));
  assert.deepStrictEqual([r.ok, r.code, 'points' in r.data], [true, 'ENREGISTRE', false], JSON.stringify(r));
  assert.deepStrictEqual([ouverts(g), clos(g)], [['Point A', 'Point B', 'Point C', 'Point de Kévin'], []]);
  assert.ok(/gestes sur des points existants ignorés \(pas d’accès au chantier\)/.test(CR(g)[1][C.remarque]));
  assert.ok(/Point B saboté geste non pris en compte : ce compte n’a pas accès aux points de ce chantier/.test(textePdf(g)), textePdf(g));
});
test('SANS compte (période de transition) : la note part, seuls ses nouveaux points sont pris', () => {
  const { g, base, A } = depart();
  const r = envoyer(g, null, note(base, [{ id: A, g: 'clos', t: 'Point A' }, nouveau('Point sans compte')]));
  assert.deepStrictEqual([r.ok, r.code, 'points' in r.data], [true, 'ENREGISTRE', false], JSON.stringify(r));
  assert.deepStrictEqual([ouverts(g), clos(g)], [['Point A', 'Point B', 'Point C', 'Point sans compte'], []]);
  assert.strictEqual(CR(g)[1][C.compte], 'sans compte');
});
test('poseur DU chantier : il clôt et complète les points de son chantier (droit gardé, réponse 7 de Franck)', () => {
  const { g, base, A, B } = depart();
  const r = envoyer(g, 'thomas27', note(base, [{ id: A, g: 'clos', t: 'Point A' }, { id: B, g: 'complete', t: 'Point B, vu par Thomas' }]));
  assert.deepStrictEqual([r.data.points.ouverts.map(p => p.t), r.data.points.clos.map(p => p.t)], [['Point B, vu par Thomas', 'Point C'], ['Point A']]);
});

console.log('Lot 8c — écriture coupée, onglet, chantier hors liste');
test('PDF raté après l’écriture de la ligne, puis nouvel essai du téléphone : une seule ligne, les gestes ne sont pas appliqués deux fois, le PDF est le même', () => {
  const { g, base, A } = depart();
  const id = idFiche(), n = note(base, [{ id: A, g: 'clos', t: 'Point A' }, nouveau('Point D')]);
  const vrai = g.contexte.HtmlService.createHtmlOutput;
  g.contexte.HtmlService.createHtmlOutput = () => { throw new Error('conversion PDF en panne'); };
  assert.strictEqual(envoyer(g, 'seb', n, id).code, 'ERREUR');
  assert.strictEqual(CR(g).length, 2, 'la ligne est écrite avant le PDF');
  g.contexte.HtmlService.createHtmlOutput = vrai;
  const bon = envoyer(g, 'seb', n, id);
  assert.deepStrictEqual([bon.code, CR(g).length], ['ENREGISTRE', 2], JSON.stringify(bon));
  assert.deepStrictEqual([ouverts(g), clos(g)], [['Point B', 'Point C', 'Point D'], ['Point A']], 'un seul « Point D »');
  assert.ok(/1 Point A clos · ouvert depuis le 05\/11\/2026 CLOS 2 Point D nouveau point OUVERT/.test(textePdf(g)), textePdf(g));
  assert.deepStrictEqual(bon.data.points.ouverts.map(p => p.t), ['Point B', 'Point C', 'Point D']);
  // réponse perdue : « déjà reçue », rien de plus
  const encore = envoyer(g, 'seb', n, id);
  assert.deepStrictEqual([encore.code, CR(g).length, ouverts(g).length], ['DEJA_RECU', 2, 3]);
});
test('titres de l’onglet changés : la note part avec ses points imprimés, rien n’est suivi, la réponse le dit ; la lecture répond « indisponible » ; titres remis : tout reprend', () => {
  const { g, base, A } = depart();
  g.feuilles['Comptes rendus'].lignes[0][12] = 'Données';
  const r = envoyer(g, 'seb', note(base, [{ id: A, g: 'clos', t: 'Point A' }, nouveau('Point pendant la panne')]));
  assert.deepStrictEqual([r.ok, r.code, r.data.pointsNonSuivis, 'points' in r.data], [true, 'ENREGISTRE', 'onglet', false], JSON.stringify(r));
  assert.ok(/Point pendant la panne nouveau point OUVERT/.test(textePdf(g)), textePdf(g));
  assert.strictEqual(CR(g).length, 1);
  const lu = lire(g, 'seb');
  assert.deepStrictEqual([lu.ok, lu.code], [false, 'INDISPONIBLE']);
  assert.ok(g.mails.some(m => /Comptes rendus/.test(m.sujet) && m.to === FRANCK));
  g.feuilles['Comptes rendus'].lignes[0][12] = 'Données de l’appli (ne pas modifier)';
  assert.deepStrictEqual(ouverts(g), ['Point A', 'Point B', 'Point C'], 'les points d’avant la panne sont toujours là');
});
test('chantier HORS LISTE : la note part, ses points sont imprimés mais pas suivis ; la réponse et la remarque le disent', () => {
  const g = environnement();
  const r = envoyer(g, 'seb', note('', [nouveau('Point d’un chantier inconnu')], { chantier: 'CHANTIER INCONNU' }));
  assert.deepStrictEqual([r.ok, r.code, r.data.pointsNonSuivis, 'points' in r.data], [true, 'ENREGISTRE', 'chantier', false], JSON.stringify(r));
  assert.deepStrictEqual([CR(g)[0][C.remarque], CR(g)[0][C.donnees], CR(g)[0][C.ouverts]], ['chantier hors liste : points non suivis', '', '']);
  assert.ok(/Point d’un chantier inconnu nouveau point OUVERT/.test(textePdf(g)));
});
test('chantier retiré de la liste puis remis : la note arrivée entre-temps ne fait pas repartir de zéro', () => {
  const { g } = depart();
  const lignes = g.feuilles['Chantiers'].lignes, i = lignes.findIndex(x => x[0] === 'CHANTIER TEST 1'), retiree = lignes.splice(i, 1)[0];
  envoyer(g, 'seb', note('', [nouveau('Point écrit hors liste')], { chantier: 'CHANTIER TEST 1' }));
  lignes.splice(i, 0, retiree);
  assert.deepStrictEqual(ouverts(g), ['Point A', 'Point B', 'Point C']);
});
test('chantier RENOMMÉ qui a un N° : ses points ouverts suivent (rattachement par le N° du chantier)', () => {
  const { g, base } = depart();
  g.feuilles['Chantiers'].lignes.find(x => x[0] === 'CHANTIER TEST 1')[4] = '403';
  envoyer(g, 'seb', note(base, []));
  g.feuilles['Chantiers'].lignes.find(x => x[0] === 'CHANTIER TEST 1')[0] = 'RESIDENCE ESSAI';
  assert.deepStrictEqual(lire(g, 'seb', 'RESIDENCE ESSAI').data.ouverts.map(p => p.t), ['Point A', 'Point B', 'Point C']);
});
test('cellule « Données de l’appli » abîmée à la main : la note suivante part, ses points repris par le téléphone sont recréés, Franck est prévenu', () => {
  const { g, base, A, B } = depart();
  g.feuilles['Comptes rendus'].lignes[1][C.donnees] = '{"o":[ cassé';
  const r = envoyer(g, 'seb', note(base, [{ id: A, g: 'rien', t: 'Point A' }, { id: B, g: 'clos', t: 'Point B' }]));
  assert.strictEqual(r.code, 'ENREGISTRE');
  assert.deepStrictEqual([ouverts(g), clos(g)], [['Point A'], ['Point B']]);
  assert.ok(/données du compte rendu précédent illisibles/.test(CR(g)[1][C.remarque]));
  assert.ok(g.mails.some(m => m.sujet === '[Loué App] Comptes rendus — points d’un chantier à regarder' && m.to === FRANCK));
});

console.log('Lot 8c — beaucoup de points, cellule pleine');
test('50 points ouverts de 1 500 caractères : la liste déborde dans la colonne « suite », rien n’est raccourci, Franck est prévenu ; relue à l’identique', () => {
  const g = environnement();
  let base = '';
  for (let k = 0; k < 2; k++) {
    const id = idFiche();
    envoyer(g, 'seb', note(base, Array.from({ length: 25 }, (_, i) => nouveau('P' + (k * 25 + i) + ' ' + 'x'.repeat(1490)))), id);
    base = id;
  }
  const l = CR(g)[1];
  assert.ok(String(l[C.donnees]).length === 45000 && /^~/.test(l[C.suite]) && String(l[C.suite]).length <= 45001, [String(l[C.donnees]).length, String(l[C.suite]).length].join());
  const o = lire(g, 'seb').data.ouverts;
  assert.deepStrictEqual([o.length, o[49].t.length, o[0].t.slice(0, 3)], [50, 1490 + 4, 'P0 ']);
  assert.ok(g.mails.some(m => m.sujet === '[Loué App] Comptes rendus — points d’un chantier à regarder' && /beaucoup de points ouverts/.test(m.texte)));
  assert.ok(String(l[C.ouverts]).length <= 45000 && /la suite est dans le PDF/.test(l[C.ouverts]), 'cellule lisible coupée proprement');
});
test('120 points ouverts de 1 500 caractères (plus que deux cellules) : la note n’est jamais refusée ; les textes gardés pour la suite sont raccourcis, les PDF gardent le texte complet', () => {
  const g = environnement();
  let base = '', r = null;
  for (let k = 0; k < 3; k++) {
    const id = idFiche();
    r = envoyer(g, 'seb', note(base, Array.from({ length: 40 }, (_, i) => nouveau('P' + (k * 40 + i) + ' ' + 'x'.repeat(1490)))), id);
    base = id;
  }
  assert.strictEqual(r.code, 'ENREGISTRE', JSON.stringify(r).slice(0, 300));
  const l = CR(g)[2], o = lire(g, 'seb').data.ouverts;
  assert.strictEqual(o.length, 120);
  assert.ok(o.every(p => p.t.length <= 1000) && /…$/.test(o[0].t), 'textes raccourcis');
  assert.ok(String(l[C.donnees]).length + String(l[C.suite]).length <= 90001);
  assert.ok(/textes gardés pour la suite sont raccourcis/.test(l[C.remarque]));
  assert.ok(dernierPdf(g).indexOf('x'.repeat(1490)) > -1, 'le PDF garde le texte complet');
});

console.log('Lot 8c — deux notes de suite sans réseau, note abandonnée');
test('deux notes écrites sans réseau, arrivées dans l’ordre : la seconde part de la première (base = son numéro de fiche) : aucune remarque, ses gestes portent sur les points de la première', () => {
  const { g, base, A } = depart();
  const idA = idFiche(), idB = idFiche(), N = idPoint();
  envoyer(g, 'thomas27', note(base, [{ id: A, g: 'clos', t: 'Point A' }, { id: N, g: 'nouveau', t: 'Point de la note 1' }], { date: '13/11/2026' }), idA);
  const r = envoyer(g, 'thomas27', note(idA, [{ id: N, g: 'complete', t: 'Point de la note 1, complété par la note 2' }, { id: A, g: 'rouvert', t: 'Point A' }], { date: '14/11/2026' }), idB);
  assert.deepStrictEqual(['remarqueCR' in r.data, CR(g)[2][C.remarque]], [false, '']);
  assert.deepStrictEqual([ouverts(g), clos(g)], [['Point B', 'Point C', 'Point de la note 1, complété par la note 2', 'Point A'], []]);
});
test('… la première ABANDONNÉE dans le téléphone : la seconde arrive seule, ses points repris de la première deviennent de nouveaux points, avec la remarque', () => {
  const { g, base } = depart();
  const N = idPoint();
  const r = envoyer(g, 'thomas27', note('fiche-jamais-arrivee-0001', [{ id: N, g: 'rien', t: 'Point de la note abandonnée' }], { date: '14/11/2026' }));
  assert.ok(ouverts(g).indexOf('Point de la note abandonnée') > -1);
  assert.strictEqual(r.data.remarqueCR, 'Rédigé sans connaître le compte rendu du 05/11/2026');
  assert.ok(base);
});

console.log('Lot 8c — installation et livraison');
test('installation : un onglet du lot 8b (10 colonnes) déjà rempli reçoit les 4 colonnes des points, ses lignes sont gardées ; relancée : « déjà fait »', () => {
  const titres8b = ['Numéro de fiche', 'Chantier', 'N° du chantier', 'Date de la réunion', 'Objet', 'Rédigé par', 'Compte qui a envoyé', 'Nom du PDF', 'Reçu le', 'Remarque de l’appli'];
  const g = environnement({ sansInstallation: true, google: { feuilles: { 'Comptes rendus': [titres8b, ['fiche-8b-000001', 'CHANTIER TEST 1', '', '01/11/2026', 'Note du 8b', 'x', 'x', 'x.pdf', new Date(Date.now() - 86400000), '']] } } });
  // rappel : « feuilles » remplace les onglets de départ ; on remet ceux dont le serveur a besoin
  const t = g.ctx.installerLot8Production();
  assert.ok(/colonnes des points ajoutées|fait/.test(t) && /installation terminée/.test(t), t);
  assert.strictEqual(g.feuilles['Comptes rendus'].lignes[0].length, 14);
  assert.strictEqual(g.feuilles['Comptes rendus'].lignes[1][0], 'fiche-8b-000001');
  assert.ok(/déjà fait/.test(g.ctx.installerLot8Production()));
});
test('livraison : le serveur à coller contient le lot 8c, en version v11.3, sans les outils d’essai', () => {
  const code = fs.readFileSync(path.join(__dirname, '..', 'A-COLLER-DANS-APPS-SCRIPT', 'Code.gs'), 'utf8');
  ["const VERSION_API = 'v11.3'", 'function crAppliquer_(', 'function crLire_(', "corps.action === 'compteRendu'", 'function crEnregistrer_(', 'SpreadsheetApp.flush();'].forEach(t => assert.ok(code.indexOf(t) > -1, t));
  assert.ok(code.indexOf('function outilTest_(') < 0);
  assert.ok(code.indexOf(String.fromCharCode(0x2028)) < 0 && code.indexOf(String.fromCharCode(0x2029)) < 0, 'aucun séparateur de ligne brut dans le fichier à coller');
  const page = fs.readFileSync(path.join(__dirname, '..', 'note-reunion.html'), 'utf8');
  assert.ok(page.indexOf(String.fromCharCode(96)) < 0, 'aucun backtick dans la page de la note de réunion');
});

console.log(reussis + ' test(s) réussi(s)' + (process.exitCode ? ' — DES TESTS ÉCHOUENT' : ''));
