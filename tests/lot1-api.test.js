// Tests du lot 1.1 (API v5 : réponse lisible, numéro unique, photos une par une) : node tests/lot1-api.test.js
'use strict';
const assert = require('assert');
const { creerGoogle, chargerScript } = require('./gas-harness');

const FRANCK = 'franck@loue.test', SEB = 'seb@loue.test';
const PHOTO_B64 = Buffer.from('fausse-photo-jpeg').toString('base64');

function environnement(options = {}) {
  const google = creerGoogle(Object.assign({
    proprietes: { DRIVE_ROOT_ID: 'RACINE', DRIVE_PLANNING_ID: 'PLANNING' },
    feuilles: {
      'Contacts': [['Nom', 'Role', 'Email', 'ChefEquipe', 'Destinataire', 'ConducteurDefaut', 'ChefAtelier', 'absenceNotif'],
        ['Franck PAVAGEAU', 'Conducteur de travaux', FRANCK, 'O', 'N', 'O', 'N', 'O'],
        ['Sébastien', 'Conducteur de travaux', SEB, 'O', 'N', 'N', 'N', 'N']],
      'Contacts notes': [['Nom', 'Email']],
      'Chantiers': [['Nom', 'Référence', 'Statut', 'Conducteur'], ['CHANTIER TEST 1', 'LIEU', 'En cours', 'Sébastien']],
    },
  }, options));
  google.racine = google.creerElement('dossier', 'Loué Menuiserie - Chantiers', null, { id: 'RACINE' });
  google.creerElement('dossier', 'Planning', null, { id: 'PLANNING' });
  google.ctx = chargerScript(google);
  return google;
}
const poster = (g, corps) => JSON.parse(g.ctx.doPost({ postData: { contents: JSON.stringify(corps) } }).contenu);
const quitus = extra => Object.assign({ type: 'quitus', chantier: 'CHANTIER TEST 1', date: '30/10/2026', intervenant: 'Client',
  solde: 'OUI', destinataires: [FRANCK], photosBase64: [] }, extra || {});

let reussis = 0;
function test(nom, fn) {
  try { fn(); reussis++; console.log('  ✓ ' + nom); }
  catch (e) { console.log('  ✗ ' + nom + '\n    ' + e.message); process.exitCode = 1; }
}

console.log('Lot 1.1 — API v5');

test('ping : version lisible', () => {
  const r = poster(environnement(), { action: 'ping' });
  assert.ok(r.ok && /v5/.test(r.data.version));
});

test('fiche : réponse « ENREGISTRE » avec le bilan des mails', () => {
  const g = environnement();
  const r = poster(g, { action: 'fiche', id: 'fiche-0001-abcd', donnees: quitus({ destinataires: [FRANCK, SEB] }) });
  assert.strictEqual(r.code, 'ENREGISTRE', JSON.stringify(r));
  assert.strictEqual(r.data.envoyes, 2);
  assert.ok(/2 mail\(s\) envoyé\(s\)/.test(r.message), r.message);
  assert.strictEqual(g.feuilles['Envois'].lignes[1][4], 'traité');
});

test('même fiche renvoyée (réponse perdue) : « DEJA_RECU », aucun second mail', () => {
  const g = environnement();
  poster(g, { action: 'fiche', id: 'fiche-0002-abcd', donnees: quitus() });
  const apres1 = g.mails.length;
  const r = poster(g, { action: 'fiche', id: 'fiche-0002-abcd', donnees: quitus() });
  assert.strictEqual(r.code, 'DEJA_RECU');
  assert.ok(r.ok, 'la page doit considérer la fiche comme envoyée');
  assert.strictEqual(g.mails.length, apres1, 'aucun mail de plus');
  assert.strictEqual(g.feuilles['Envois'].lignes.length, 2, 'une seule ligne dans Envois');
});

test('photos envoyées une par une puis fiche : les photos sont dans le PDF et le dossier temporaire part à la corbeille', () => {
  const g = environnement();
  const p1 = poster(g, { action: 'photo', id: 'photo-0001-abcd', fiche: 'fiche-0003-abcd', mime: 'image/jpeg', data: PHOTO_B64 });
  assert.strictEqual(p1.code, 'PHOTO_RECUE');
  const p1bis = poster(g, { action: 'photo', id: 'photo-0001-abcd', fiche: 'fiche-0003-abcd', mime: 'image/jpeg', data: PHOTO_B64 });
  assert.ok(p1bis.ok, 'une photo renvoyée est acceptée sans doublon');
  const r = poster(g, { action: 'fiche', id: 'fiche-0003-abcd',
    donnees: quitus({ photosBase64: [{ photoRef: 'photo-0001-abcd', label: 'Porte' }] }) });
  assert.strictEqual(r.code, 'ENREGISTRE', JSON.stringify(r));
  const pdf = g.mails[0].opts.attachments[0].contenu;
  assert.ok(pdf.indexOf(PHOTO_B64) > -1, 'photo intégrée au PDF');
  const temp = g.racine.enfants.find(e => e.nom === '_PHOTOS EN COURS').enfants.find(e => e.nom === 'fiche-0003-abcd');
  assert.strictEqual(temp.enfants.length, 1, 'pas de doublon de photo');
  assert.ok(temp.corbeille, 'dossier temporaire à la corbeille');
});

test('photo pas encore reçue : « PHOTOS_MANQUANTES », rien n\'est envoyé, la fiche repartira', () => {
  const g = environnement();
  const r = poster(g, { action: 'fiche', id: 'fiche-0004-abcd', donnees: quitus({ photosBase64: [{ photoRef: 'photo-0009-abcd' }] }) });
  assert.strictEqual(r.code, 'PHOTOS_MANQUANTES');
  assert.deepStrictEqual(r.data.manquantes, ['photo-0009-abcd']);
  assert.strictEqual(g.mails.length, 0);
  poster(g, { action: 'photo', id: 'photo-0009-abcd', fiche: 'fiche-0004-abcd', mime: 'image/jpeg', data: PHOTO_B64 });
  const r2 = poster(g, { action: 'fiche', id: 'fiche-0004-abcd', donnees: quitus({ photosBase64: [{ photoRef: 'photo-0009-abcd' }] }) });
  assert.strictEqual(r2.code, 'ENREGISTRE');
});

test('réception support : photos par point (champ « photos »/« mime ») jointes', () => {
  const g = environnement();
  poster(g, { action: 'photo', id: 'photo-0010-abcd', fiche: 'fiche-0005-abcd', mime: 'image/jpeg', data: PHOTO_B64 });
  const r = poster(g, { action: 'fiche', id: 'fiche-0005-abcd', donnees: { type: 'reception-support', chantier: 'CHANTIER TEST 1',
    lotLabel: 'Menuiserie', conducteurEmail: SEB, points: [{ label: 'Planéité', state: 'nok', photos: [{ photoRef: 'photo-0010-abcd' }] }] } });
  assert.strictEqual(r.code, 'ENREGISTRE', JSON.stringify(r));
  assert.ok(g.mails[0].opts.attachments[0].contenu.indexOf(PHOTO_B64) > -1);
});

test('adresse libre refusée : la page reçoit la liste des refus', () => {
  const g = environnement();
  const r = poster(g, { action: 'fiche', id: 'fiche-0006-abcd', donnees: quitus({ destinataires: ['a@x.test', 'b@x.test', 'c@x.test'] }) });
  assert.deepStrictEqual(r.data.refuses, ['c@x.test']);
  assert.ok(/1 adresse\(s\) refusée\(s\)/.test(r.message));
});

test('quota bas : la page apprend que des mails sont reportés', () => {
  const g = environnement({ quota: 10 });
  const r = poster(g, { action: 'fiche', id: 'fiche-0007-abcd', donnees: quitus({ destinataires: [SEB] }) });
  assert.strictEqual(r.data.reportes, 1);
  assert.ok(/reporté/.test(r.message));
});

test('erreurs claires : type inconnu, numéro invalide, action inconnue, données illisibles', () => {
  const g = environnement();
  assert.strictEqual(poster(g, { action: 'fiche', id: 'fiche-0008-abcd', donnees: { type: 'spam' } }).code, 'TYPE_INCONNU');
  assert.strictEqual(poster(g, { action: 'fiche', id: '../x', donnees: quitus() }).code, 'DONNEES_INVALIDES');
  assert.strictEqual(poster(g, { action: 'pirater' }).code, 'ACTION_INCONNUE');
  const r = JSON.parse(g.ctx.doPost({ postData: { contents: '{pas du json' } }).contenu);
  assert.strictEqual(r.code, 'DONNEES_INVALIDES');
  assert.strictEqual(g.mails.length, 0);
});

test('photo refusée : format non image, trop lourde', () => {
  const g = environnement();
  assert.strictEqual(poster(g, { action: 'photo', id: 'photo-0020-abcd', fiche: 'fiche-0020-abcd', mime: 'text/html', data: PHOTO_B64 }).code, 'DONNEES_INVALIDES');
  const gros = 'A'.repeat(4.2 * 1024 * 1024);
  assert.strictEqual(poster(g, { action: 'photo', id: 'photo-0021-abcd', fiche: 'fiche-0020-abcd', mime: 'image/jpeg', data: gros }).code, 'TROP_GROS');
});

test('serveur occupé : « SERVEUR_OCCUPE », rien n\'est enregistré', () => {
  const g = environnement({ verrouOccupe: true });
  const r = poster(g, { action: 'fiche', id: 'fiche-0030-abcd', donnees: quitus() });
  assert.strictEqual(r.code, 'SERVEUR_OCCUPE');
  assert.strictEqual(g.mails.length, 0);
});

test('l\'ancien format (pages pas encore refondues) marche toujours', () => {
  const g = environnement();
  const r = poster(g, quitus());
  assert.strictEqual(r.status, 'ok');
  assert.deepStrictEqual(g.mails.map(m => m.to).sort(), [FRANCK, SEB].sort());
});

test('erreur du serveur : code ERREUR (réessayé par le téléphone) et alerte à Franck', () => {
  const g = environnement();
  g.contexte.HtmlService.createHtmlOutput = () => { throw new Error('Service error: Drive'); };
  const r = poster(g, { action: 'fiche', id: 'fiche-0040-abcd', donnees: quitus() });
  assert.strictEqual(r.code, 'ERREUR');
  assert.ok(/nouvel essai/.test(r.message));
  assert.ok(g.mails.some(m => m.to === FRANCK), 'alerte envoyée à Franck');
});

test('photos : 15 au maximum par fiche', () => {
  const g = environnement();
  for (let i = 0; i < 15; i++) poster(g, { action: 'photo', id: 'photo-01' + String(i).padStart(2, '0') + '-abcd', fiche: 'fiche-0050-abcd', mime: 'image/jpeg', data: PHOTO_B64 });
  const r = poster(g, { action: 'photo', id: 'photo-0199-abcd', fiche: 'fiche-0050-abcd', mime: 'image/jpeg', data: PHOTO_B64 });
  assert.strictEqual(r.code, 'LIMITE');
});

test('photos de fiches abandonnées : corbeille après 7 jours', () => {
  const g = environnement();
  poster(g, { action: 'photo', id: 'photo-0300-abcd', fiche: 'fiche-0300-abcd', mime: 'image/jpeg', data: PHOTO_B64 });
  const enCours = g.racine.enfants.find(e => e.nom === '_PHOTOS EN COURS');
  enCours.enfants[0].cree = Date.now() - 8 * 24 * 3600 * 1000;
  g.ctx.renvoyerMailsEnAttente();
  assert.ok(enCours.enfants[0].corbeille);
});

console.log('Lot 1.3 / lot 6 — fiche de fabrication');
const pdfDe = g => (g.mails.find(m => m.opts && m.opts.attachments) || { opts: { attachments: [{ contenu: '' }] } }).opts.attachments[0].contenu;
const fabrication = extra => Object.assign({ type: 'fabrication', chantier: 'CHANTIER TEST 1', auteur: 'Franck', conducteur: 'Franck PAVAGEAU',
  date: '30/10/2026', delai: 'Semaine S46', delaiPrecision: 'impératif avant la pose', blocs: [] }, extra || {});

test('délai : précision libre dans le PDF, le mail et la colonne 13 du Sheet', () => {
  const g = environnement();
  const r = poster(g, { action: 'fiche', id: 'fiche-0600-abcd', donnees: fabrication() });
  assert.strictEqual(r.code, 'ENREGISTRE', JSON.stringify(r));
  assert.ok(pdfDe(g).indexOf('impératif avant la pose') > -1, 'précision dans le PDF');
  assert.ok(g.mails.some(m => (m.opts.htmlBody || '').indexOf('impératif avant la pose') > -1), 'précision dans le mail');
  const f = g.feuilles['Fabrication'].lignes;
  assert.strictEqual(f[0][12], 'Précision délai');
  assert.strictEqual(f[1][12], 'impératif avant la pose');
  assert.strictEqual(f[1][6], 'Semaine S46', 'le délai reste en colonne G');
});

test('onglet Fabrication déjà rempli : la colonne « Précision délai » est ajoutée sans rien décaler', () => {
  const ancien = ['N° Série', 'Chantier', 'Auteur', 'Chef Atelier', 'Conducteur', 'Date', 'Délai', 'Zone', 'Réf. chantier', 'Nb Blocs', 'Commentaires', 'Horodatage'];
  const g = environnement({ feuilles: {
    'Contacts': [['Nom', 'Role', 'Email', 'ChefEquipe', 'Destinataire', 'ConducteurDefaut', 'ChefAtelier', 'absenceNotif'],
      ['Franck PAVAGEAU', 'Conducteur de travaux', FRANCK, 'O', 'N', 'O', 'O', 'O']],
    'Chantiers': [['Nom', 'Référence', 'Statut', 'Conducteur'], ['CHANTIER TEST 1', '', 'En cours', 'Franck PAVAGEAU']],
    'Fabrication': [ancien, ['', 'ANCIEN', 'X', '', '', '01/01/2026', 'Pour le 12/01', '', '', 1, '', 'h']],
  } });
  poster(g, { action: 'fiche', id: 'fiche-0601-abcd', donnees: fabrication() });
  const f = g.feuilles['Fabrication'].lignes;
  assert.strictEqual(f[0][11], 'Horodatage');
  assert.strictEqual(f[0][12], 'Précision délai');
  assert.strictEqual(f[1][1], 'ANCIEN', 'ancienne ligne intacte');
  assert.strictEqual(f[2][12], 'impératif avant la pose');
});

test('huisserie seule : hauteur, largeur du vantail et talon dans le PDF (oubliés avant)', () => {
  const g = environnement();
  poster(g, { action: 'fiche', id: 'fiche-0602-abcd', donnees: fabrication({ blocs: [
    { id: 1, type: 'porte', porteType: 'huisserie', rows: [{ repere: 'P12', qt: '2', hautVantail: '2040', largVantail: '830', talon: '3', support: 'Cloison' }] }] }) });
  const html = pdfDe(g);
  ['Haut. vantail', '2040', '830', 'Cloison', 'Huisserie seule'].forEach(t => assert.ok(html.indexOf(t) > -1, t));
});

test('textes des blocs échappés, croquis envoyé à part puis remis dans le PDF', () => {
  const g = environnement();
  poster(g, { action: 'photo', id: 'photo-0602-abcd', fiche: 'fiche-0603-abcd', mime: 'image/png', data: PHOTO_B64 });
  const r = poster(g, { action: 'fiche', id: 'fiche-0603-abcd', donnees: fabrication({
    blocs: [{ id: 1, type: 'divers', rows: [{ repere: '<img src=x onerror=alert(1)>', qte: '1' }] }, { id: 2, type: 'photo', rows: [] }],
    photosBase64: [{ photoRef: 'photo-0602-abcd', label: 'Croquis' }] }) });
  assert.strictEqual(r.code, 'ENREGISTRE', JSON.stringify(r));
  const html = pdfDe(g);
  assert.ok(html.indexOf('<img src=x') < 0 && html.indexOf('&lt;img src=x') > -1, 'repère échappé');
  assert.ok(html.indexOf('data:image/png;base64,' + PHOTO_B64) > -1, 'croquis dans le PDF');
  assert.ok(html.indexOf('Croquis') > -1);
});

console.log('\n' + reussis + ' test(s) réussi(s)' + (process.exitCode ? ' — DES TESTS ÉCHOUENT' : ''));
