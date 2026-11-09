// Tests du lot 1.1 (API v5 : réponse lisible, numéro unique, photos une par une) : node tests/lot1-api.test.js
'use strict';
const assert = require('assert');
const { creerGoogle, chargerScript } = require('./gas-harness');

const FRANCK = 'franck@loue.test', SEB = 'seb@loue.test';
// Début réel d'un fichier JPEG (FF D8 FF) : le serveur vérifie que c'est bien une photo
const PHOTO_B64 = Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), Buffer.from('fausse-photo-jpeg')]).toString('base64');
const PNG_B64 = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), Buffer.from('faux-croquis')]).toString('base64');

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
  // Contenu qui n'est pas une photo, même annoncé comme JPEG (il serait synchronisé sur le PC de Franck)
  assert.strictEqual(poster(g, { action: 'photo', id: 'photo-0021-abcd', fiche: 'fiche-0020-abcd', mime: 'image/jpeg', data: Buffer.from('<script>x</script>').toString('base64') }).code, 'DONNEES_INVALIDES');
  assert.strictEqual(poster(g, { action: 'photo', id: 'photo-0022-abcd', fiche: 'fiche-0020-abcd', mime: 'image/png', data: PHOTO_B64 }).code, 'DONNEES_INVALIDES', 'JPEG annoncé PNG');
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
  poster(g, { action: 'photo', id: 'photo-0602-abcd', fiche: 'fiche-0603-abcd', mime: 'image/png', data: PNG_B64 });
  const r = poster(g, { action: 'fiche', id: 'fiche-0603-abcd', donnees: fabrication({
    blocs: [{ id: 1, type: 'divers', rows: [{ repere: '<img src=x onerror=alert(1)>', qte: '1' }] }, { id: 2, type: 'photo', rows: [] }],
    photosBase64: [{ photoRef: 'photo-0602-abcd', label: 'Croquis' }] }) });
  assert.strictEqual(r.code, 'ENREGISTRE', JSON.stringify(r));
  const html = pdfDe(g);
  assert.ok(html.indexOf('<img src=x') < 0 && html.indexOf('&lt;img src=x') > -1, 'repère échappé');
  assert.ok(html.indexOf('data:image/png;base64,' + PNG_B64) > -1, 'croquis dans le PDF');
  assert.ok(html.indexOf('Croquis') > -1);
});

console.log('Règle 3 — appels Apps Script anonymes');
test('aucune page n\'appelle Apps Script en JSONP seul (fetch sans cookies d\'abord)', () => {
  const fs = require('fs'), path = require('path');
  const racine = path.join(__dirname, '..');
  const fautives = fs.readdirSync(racine).filter(f => f.endsWith('.html')).filter(f => {
    const s = fs.readFileSync(path.join(racine, f), 'utf8');
    const jsonp = /createElement\(\s*['"]script['"]\s*\)/.test(s);
    const anonyme = /credentials\s*:\s*['"]omit['"]/.test(s);
    return jsonp && !anonyme;
  });
  assert.deepStrictEqual(fautives, [], 'pages en JSONP seul : ' + fautives.join(', '));
});

console.log('Lot 1.3 — attestation');
const SIG_PNG = 'data:image/png;base64,' + Buffer.from('signature').toString('base64');
const attestation = extra => Object.assign({ type: 'attestation', typeAttest: 'mise-oeuvre', typeLabel: 'Mise en œuvre',
  chantier: 'CHANTIER TEST 1', precision: 'Bât. A', signataire: 'Franck PAVAGEAU', date: '09/11/2026', ref: 'PV-OPR-014',
  objet: 'Pose des menuiseries conforme au DTU', signature: SIG_PNG, photos: [] }, extra || {});

test('mise en œuvre : fiche enregistrée, PDF complet, mail au conducteur du chantier, Sheet et Drive', () => {
  const g = environnement();
  const r = poster(g, { action: 'fiche', id: 'fiche-0700-abcd', donnees: attestation() });
  assert.strictEqual(r.code, 'ENREGISTRE', JSON.stringify(r));
  const html = pdfDe(g);
  ['ATTESTATION DE MISE EN ŒUVRE', 'CHANTIER TEST 1 — Bât. A', 'Franck PAVAGEAU', 'en qualité de Conducteur de travaux',
    'Pose des menuiseries conforme au DTU', 'PV-OPR-014', '09/11/2026', SIG_PNG].forEach(t => assert.ok(html.indexOf(t) > -1, t));
  assert.deepStrictEqual(g.mails.map(m => m.to), [SEB], 'conducteur du chantier (onglet Chantiers, colonne D)');
  const f = g.feuilles['Attestations'].lignes;
  assert.deepStrictEqual(Array.from(f[0]), ['Horodatage', 'Type', 'Chantier', 'Précision', 'Signataire', 'Date', 'Référence', 'Objet/DAS N°']);
  assert.deepStrictEqual(Array.from(f[1]).slice(1), ['Mise en œuvre', 'CHANTIER TEST 1', 'Bât. A', 'Franck PAVAGEAU', '09/11/2026', 'PV-OPR-014', 'Pose des menuiseries conforme au DTU']);
  const dossier = g.racine.enfants.find(e => e.nom === 'CHANTIER TEST 1').enfants.find(e => e.nom === '05 - CHANTIER').enfants.find(e => e.nom === 'OPR - RESERVES - QUITUS');
  assert.strictEqual(dossier.enfants.length, 1, 'PDF rangé dans OPR - RESERVES - QUITUS (lot 1.5)');
  assert.ok(/^ATTESTATION CHANTIER TEST 1 .*2026-11-09\.pdf$/.test(dossier.enfants[0].nom), dossier.enfants[0].nom);
});

test('textes piégés échappés ; la fonction du signataire vient du Sheet, pas de la page ; adresse de la page ignorée', () => {
  const g = environnement();
  poster(g, { action: 'fiche', id: 'fiche-0701-abcd', donnees: attestation({ typeAttest: 'autre', typeLabel: 'Vis 4" <90 cm',
    objet: '<script>alert(1)</script>', precision: '<img src=x onerror=alert(1)>', qualite: '<b>Pirate</b>',
    conducteurEmail: 'pirate@ext.test', signataire: 'Inconnu' }) });
  const html = pdfDe(g);
  assert.ok(html.indexOf('<script>alert') < 0 && html.indexOf('&lt;script&gt;alert(1)&lt;/script&gt;') > -1, 'objet échappé');
  assert.ok(html.indexOf('<img src=x') < 0, 'précision échappée');
  assert.ok(html.indexOf('VIS 4&quot; &lt;90 CM') > -1, 'titre « autre » échappé');
  assert.ok(html.indexOf('Pirate') < 0 && html.indexOf('en qualité de') < 0, 'qualité envoyée par la page ignorée');
  assert.deepStrictEqual(g.mails.map(m => m.to), [SEB], 'aucun mail à l’adresse envoyée par la page');
});

test('contrôle DAS : points, bilan et TOUTES les photos (envoyées à part) dans le PDF', () => {
  const g = environnement();
  const b64 = n => Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), Buffer.from('photo-das-' + n)]).toString('base64');
  for (let i = 1; i <= 3; i++) poster(g, { action: 'photo', id: 'photo-071' + i + '-abcd', fiche: 'fiche-0710-abcd', mime: 'image/jpeg', data: b64(i) });
  const r = poster(g, { action: 'fiche', id: 'fiche-0710-abcd', donnees: attestation({ typeAttest: 'das', typeLabel: 'Contrôle DAS',
    dasNumero: 'BP-07', dasEtage: 'R+1', dasLocalisation: 'Hall', asservissements: 'Détecteur de fumée, Électro-aimant',
    dasPoints: [{ label: 'Joint coupe-feu en bon état', state: 'ok' }, { label: 'Seuil (aucun obstacle)', state: 'nc' }, { label: 'Signalétique conforme', state: 'so' }],
    photos: [1, 2, 3].map(i => ({ photoRef: 'photo-071' + i + '-abcd' })) }) });
  assert.strictEqual(r.code, 'ENREGISTRE', JSON.stringify(r));
  const html = pdfDe(g);
  ['ATTESTATION DE CONTRÔLE — BLOC PORTE DAS', 'BP-07', 'R+1', 'Hall', 'Détecteur de fumée, Électro-aimant', 'Joint coupe-feu en bon état',
    '1 conforme(s) · 1 non conforme(s) · 1 sans objet'].forEach(t => assert.ok(html.indexOf(t) > -1, t));
  [1, 2, 3].forEach(i => assert.ok(html.indexOf(b64(i)) > -1, 'photo ' + i + ' dans le PDF'));
  assert.strictEqual(g.feuilles['Attestations'].lignes[1][7], 'BP-07', 'n° du bloc porte dans la colonne H');
});

test('attestation : l’ancien format (photos en base64 dans la fiche) marche toujours', () => {
  const g = environnement();
  const r = poster(g, attestation({ photos: [{ data: PHOTO_B64, mime: 'image/jpeg' }], conducteurEmail: SEB }));
  assert.strictEqual(r.status, 'ok');
  assert.ok(pdfDe(g).indexOf(PHOTO_B64) > -1);
});

console.log('Lot 1.3 — réception support');
const reception = extra => Object.assign({ type: 'reception-support', chantier: 'CHANTIER TEST 1', precision: 'Bât. B',
  signataire: 'Franck PAVAGEAU', date: '09/11/2026', lot: 'men-int', lotLabel: 'Menuiserie Intérieure',
  observations: 'Reprise des bandes\nau R+1', signature: SIG_PNG, destinataires: [],
  points: [{ label: 'Aplomb', state: 'ok', comment: '', photos: [] }, { label: 'Planéité', state: 'nok', comment: 'Bosse de 5 mm', photos: [] },
    { label: 'Sol posé', state: 'so', comment: '', photos: [] }, { label: 'Peinture mur', state: '', comment: '', photos: [] }] }, extra || {});

test('fiche enregistrée : PDF complet, Sheet (mêmes colonnes), Drive, conducteur + destinataires choisis', () => {
  const g = environnement();
  const r = poster(g, { action: 'fiche', id: 'fiche-0800-abcd', donnees: reception({ destinataires: [FRANCK] }) });
  assert.strictEqual(r.code, 'ENREGISTRE', JSON.stringify(r));
  const html = pdfDe(g);
  ['RÉCEPTION SUPPORT', 'Menuiserie Intérieure', 'CHANTIER TEST 1', 'Bât. B', 'Franck PAVAGEAU', '09/11/2026', 'Bosse de 5 mm',
    '✓ Conforme', '✗ Non conforme', '— Sans objet', 'Non évalué', '1 conforme(s) · 1 non conforme(s) · 1 sans objet',
    'Reprise des bandes\nau R+1', SIG_PNG].forEach(t => assert.ok(html.indexOf(t) > -1, t));
  assert.deepStrictEqual(g.mails.map(m => m.to).sort(), [FRANCK, SEB].sort());
  const f = g.feuilles['Réceptions Support'].lignes;
  assert.deepStrictEqual(Array.from(f[0]), ['Horodatage', 'Chantier', 'Précision', 'Signataire', 'Date', 'Lot', 'Nb OK', 'Nb NOK', 'Nb SO', 'Observations']);
  assert.deepStrictEqual(Array.from(f[1]).slice(1), ['CHANTIER TEST 1', 'Bât. B', 'Franck PAVAGEAU', '09/11/2026', 'Menuiserie Intérieure', 1, 1, 1, 'Reprise des bandes\nau R+1']);
  const dossier = g.racine.enfants.find(e => e.nom === 'CHANTIER TEST 1').enfants.find(e => e.nom === '05 - CHANTIER').enfants.find(e => e.nom === 'OPR - RESERVES - QUITUS');
  assert.strictEqual(dossier.enfants.length, 1, 'PDF rangé dans OPR - RESERVES - QUITUS (lot 1.5)');
});

test('textes piégés échappés (point ajouté, commentaire, observations) ; formule neutralisée dans le Sheet', () => {
  const g = environnement();
  poster(g, { action: 'fiche', id: 'fiche-0801-abcd', donnees: reception({ observations: '=HYPERLINK("x")',
    points: [{ label: 'Vis 4" <90 cm', state: 'nok', comment: '<script>alert(1)</script>', photos: [] }] }) });
  const html = pdfDe(g);
  assert.ok(html.indexOf('<script>alert') < 0 && html.indexOf('&lt;script&gt;') > -1, 'commentaire échappé');
  assert.ok(html.indexOf('Vis 4&quot; &lt;90 cm') > -1, 'point échappé');
  assert.strictEqual(g.feuilles['Réceptions Support'].lignes[1][9], '\'=HYPERLINK("x")');
});

test('photos de chaque point envoyées à part : toutes remises dans le PDF, sous leur point', () => {
  const g = environnement();
  const b64 = n => Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), Buffer.from('photo-point-' + n)]).toString('base64');
  for (let i = 1; i <= 3; i++) poster(g, { action: 'photo', id: 'photo-081' + i + '-abcd', fiche: 'fiche-0810-abcd', mime: 'image/jpeg', data: b64(i) });
  const r = poster(g, { action: 'fiche', id: 'fiche-0810-abcd', donnees: reception({ points: [
    { label: 'Planéité', state: 'nok', comment: 'Bosse', photos: [{ photoRef: 'photo-0811-abcd' }, { photoRef: 'photo-0812-abcd' }, { photoRef: 'photo-0813-abcd' }] },
    { label: 'Aplomb', state: 'ok', comment: '', photos: [] }] }) });
  assert.strictEqual(r.code, 'ENREGISTRE', JSON.stringify(r));
  const html = pdfDe(g);
  assert.ok(html.indexOf('Photos — Planéité') > -1);
  assert.ok(html.indexOf('Photos — Aplomb') < 0, 'pas de page photo pour un point sans photo');
  [1, 2, 3].forEach(i => assert.ok(html.indexOf(b64(i)) > -1, 'photo ' + i));
});

console.log('Lot 1.3 — note de réunion');
const note = extra => Object.assign({ type: 'note', chantier: 'CHANTIER TEST 1', auteur: 'Franck PAVAGEAU', date: '09/11/2026',
  objet: 'Réunion de chantier n° 12', commentaires: 'Pose des châssis R+1\nlundi prochain', destinataires: [], photosBase64: [] }, extra || {});
const dossierNotes = g => {
  const ch = g.racine.enfants.find(e => e.nom === 'CHANTIER TEST 1');
  const cr = ch && ch.enfants.find(e => e.nom === '05 - CHANTIER');
  return cr && cr.enfants.find(e => e.nom === 'COMPTE RENDU');
};

test('fiche enregistrée : PDF complet, mail aux destinataires + conducteur du chantier, rangée dans COMPTE RENDU', () => {
  const g = environnement();
  const r = poster(g, { action: 'fiche', id: 'fiche-0900-abcd', donnees: note({ destinataires: [FRANCK] }) });
  assert.strictEqual(r.code, 'ENREGISTRE', JSON.stringify(r));
  const html = pdfDe(g);
  ['NOTE DE RÉUNION', '09/11/2026', 'CHANTIER TEST 1', 'Franck PAVAGEAU', 'Réunion de chantier n° 12', 'Pose des châssis R+1\nlundi prochain']
    .forEach(t => assert.ok(html.indexOf(t) > -1, t));
  assert.deepStrictEqual(g.mails.map(m => m.to).sort(), [FRANCK, SEB].sort(), 'conducteur du chantier ajouté par le serveur');
  assert.ok(g.mails.every(m => /Note de réunion — CHANTIER TEST 1 — Réunion de chantier n° 12/.test(m.sujet)));
  const dossier = dossierNotes(g);
  assert.ok(dossier && dossier.enfants.length === 1, 'PDF rangé dans 05 - CHANTIER/COMPTE RENDU (lot 1.5)');
  assert.strictEqual(dossier.enfants[0].nom, 'COMPTE RENDU CHANTIER TEST 1 2026-11-09.pdf');
  assert.ok(!g.racine.enfants.find(e => e.nom === 'CHANTIER TEST 1').enfants.some(e => e.nom === 'Note/Réunion/Réunion'), 'plus d’ancien dossier');
  // Deuxième note le même jour : rien n'est écrasé
  poster(g, { action: 'fiche', id: 'fiche-0901-abcd', donnees: note() });
  assert.deepStrictEqual(dossierNotes(g).enfants.map(e => e.nom).sort(),
    ['COMPTE RENDU CHANTIER TEST 1 2026-11-09.pdf', 'COMPTE RENDU CHANTIER TEST 1 2026-11-09_V2.pdf']);
});

test('chantier tapé à la main (hors Sheet) : copie à Franck ; date absente : date du jour', () => {
  const g = environnement();
  const r = poster(g, { action: 'fiche', id: 'fiche-0902-abcd', donnees: note({ chantier: 'CHANTIER INCONNU', date: '' }) });
  assert.strictEqual(r.code, 'ENREGISTRE', JSON.stringify(r));
  assert.deepStrictEqual(g.mails.map(m => m.to), [FRANCK]);
  assert.ok(/\d{2}\/\d{2}\/\d{4}/.test(pdfDe(g)), 'date du jour dans le PDF');
});

test('textes piégés échappés dans le PDF et dans le mail', () => {
  const g = environnement();
  poster(g, { action: 'fiche', id: 'fiche-0903-abcd', donnees: note({ objet: '<script>alert(1)</script>', auteur: 'Vis 4" <90 cm',
    commentaires: '<img src=x onerror=alert(1)>', destinataires: [FRANCK] }) });
  const html = pdfDe(g);
  assert.ok(html.indexOf('<script>alert') < 0 && html.indexOf('&lt;script&gt;alert(1)&lt;/script&gt;') > -1, 'objet échappé');
  assert.ok(html.indexOf('<img src=x') < 0 && html.indexOf('&lt;img src=x') > -1, 'commentaires échappés');
  assert.ok(html.indexOf('Vis 4&quot; &lt;90 cm') > -1, 'rédacteur échappé');
  const corps = g.mails.map(m => m.opts.htmlBody || '').join('');
  assert.ok(corps.indexOf('<script>alert') < 0 && corps.indexOf('&lt;script&gt;') > -1, 'mail échappé');
});

test('photos envoyées à part : toutes remises dans le PDF avec leur légende (une seule : sous les notes)', () => {
  const g = environnement();
  const b64 = n => Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), Buffer.from('photo-note-' + n)]).toString('base64');
  for (let i = 1; i <= 3; i++) poster(g, { action: 'photo', id: 'photo-091' + i + '-abcd', fiche: 'fiche-0910-abcd', mime: 'image/jpeg', data: b64(i) });
  const r = poster(g, { action: 'fiche', id: 'fiche-0910-abcd', donnees: note({ photosBase64: [1, 2, 3].map(i =>
    ({ photoRef: 'photo-091' + i + '-abcd', label: i === 2 ? 'Appui <fenêtre>' : 'Légende ' + i })) }) });
  assert.strictEqual(r.code, 'ENREGISTRE', JSON.stringify(r));
  const html = pdfDe(g);
  [1, 2, 3].forEach(i => assert.ok(html.indexOf(b64(i)) > -1, 'photo ' + i));
  ['Légende 1', 'Appui &lt;fenêtre&gt;', 'Légende 3', 'Photos / Croquis 1 &amp; 2', 'Photos / Croquis 3'].forEach(t => assert.ok(html.indexOf(t) > -1, t));
  const g2 = environnement();
  poster(g2, { action: 'photo', id: 'photo-0920-abcd', fiche: 'fiche-0920-abcd', mime: 'image/jpeg', data: b64(9) });
  poster(g2, { action: 'fiche', id: 'fiche-0920-abcd', donnees: note({ photosBase64: [{ photoRef: 'photo-0920-abcd', label: 'Seule' }] }) });
  const h2 = pdfDe(g2);
  assert.ok(h2.indexOf(b64(9)) > -1 && h2.indexOf('Seule') > -1 && h2.indexOf('page-break-before') < 0, 'une seule photo : sous les notes, page 1');
});

test('note : l’ancien format (photos en base64 dans la fiche) marche toujours', () => {
  const g = environnement();
  const r = poster(g, note({ photosBase64: [{ data: PHOTO_B64, mimeType: 'image/jpeg', label: 'Porte' }], destinataires: [FRANCK] }));
  assert.strictEqual(r.status, 'ok');
  assert.ok(pdfDe(g).indexOf(PHOTO_B64) > -1);
});

console.log('Lot 1.3 — demande d’absence');
const absence = extra => Object.assign({ type: 'absence', nom: 'Killian MARTIN', emailPerso: '', dateDepot: '09/11/2026',
  dateAbsence: 'Du 01/12/2026 au 05/12/2026', duree: 'Journée entière', imputation: 'Repos compensateur, Congés payés',
  motif: 'Mariage', precisions: 'Mariage de ma sœur\nà Nantes', signature: SIG_PNG }, extra || {});
const dossierAbsences = g => {
  const adm = g.racine.enfants.find(e => e.nom === 'ADMINISTRATIF');
  return adm && adm.enfants.find(e => e.nom === 'ABSENCES');
};

test('demande enregistrée : PDF complet, mails « absenceNotif » + e-mail perso, Sheet (mêmes colonnes), rangée dans ADMINISTRATIF/ABSENCES', () => {
  const g = environnement();
  const r = poster(g, { action: 'fiche', id: 'fiche-1000-abcd', donnees: absence({ emailPerso: SEB }) });
  assert.strictEqual(r.code, 'ENREGISTRE', JSON.stringify(r));
  const html = pdfDe(g);
  ['DEMANDE D’ABSENCE', 'Déposée le 09/11/2026', 'Killian MARTIN', 'Du 01/12/2026 au 05/12/2026', 'Journée entière',
    'Repos compensateur, Congés payés', 'Mariage de ma sœur\nà Nantes', 'Fait le 09/11/2026 à St Mathurin', 'COUPON RÉPONSE DE LA DIRECTION',
    'Demande acceptée', 'Demande refusée', SIG_PNG].forEach(t => assert.ok(html.indexOf(t) > -1, t));
  assert.deepStrictEqual(g.mails.map(m => m.to).sort(), [FRANCK, SEB].sort());
  assert.ok(g.mails.every(m => m.sujet === "[Loué App] Demande d'absence — Killian MARTIN — Du 01/12/2026 au 05/12/2026"));
  const f = g.feuilles['Absences'].lignes;
  assert.deepStrictEqual(Array.from(f[0]), ['Horodatage', 'Demandeur', 'Date dépôt', 'Date absence', 'Durée', 'Imputation', 'Motif', 'Précisions', 'Email perso']);
  assert.deepStrictEqual(Array.from(f[1]).slice(1), ['Killian MARTIN', '09/11/2026', 'Du 01/12/2026 au 05/12/2026', 'Journée entière',
    'Repos compensateur, Congés payés', 'Mariage', 'Mariage de ma sœur\nà Nantes', SEB]);
  const dossier = dossierAbsences(g);
  assert.ok(dossier && dossier.enfants.length === 1, 'PDF rangé dans ADMINISTRATIF/ABSENCES (lot 1.5, avant : pas gardé)');
  assert.strictEqual(dossier.enfants[0].nom, 'ABSENCE Killian MARTIN 2026-11-09.pdf');
});

test('destinataires calculés par le serveur seul : la liste envoyée par la page est ignorée ; aucun contact « absenceNotif » → Franck', () => {
  const g = environnement();
  poster(g, { action: 'fiche', id: 'fiche-1001-abcd', donnees: absence({ destinataires: ['pirate@ext.test', SEB] }) });
  assert.deepStrictEqual(g.mails.map(m => m.to), [FRANCK]);
  const g2 = environnement();
  g2.feuilles['Contacts'].lignes.forEach((l, i) => { if (i) l[7] = 'N'; });
  poster(g2, { action: 'fiche', id: 'fiche-1002-abcd', donnees: absence() });
  assert.deepStrictEqual(g2.mails.map(m => m.to), [FRANCK], 'jamais sans destinataire');
});

test('e-mail perso hors Sheet : adresse libre (texte imposé, Franck en copie cachée)', () => {
  const g = environnement();
  poster(g, { action: 'fiche', id: 'fiche-1003-abcd', donnees: absence({ emailPerso: 'killian.perso@ext.test' }) });
  const m = g.mails.find(x => x.to === 'killian.perso@ext.test');
  assert.ok(m, 'copie envoyée');
  assert.strictEqual(m.opts.bcc, FRANCK);
  assert.ok(/^Loué Menuiserie — Demande d'absence$/.test(m.sujet), m.sujet);
});

test('textes piégés échappés ; formule neutralisée dans le Sheet ; signature extérieure supprimée', () => {
  const g = environnement();
  poster(g, { action: 'fiche', id: 'fiche-1004-abcd', donnees: absence({ nom: '<script>alert(1)</script>', motif: 'Vis 4" <90 cm',
    precisions: '=HYPERLINK("x")', signature: 'https://evil.test/x.png' }) });
  const html = pdfDe(g);
  assert.ok(html.indexOf('<script>alert') < 0 && html.indexOf('&lt;script&gt;alert(1)&lt;/script&gt;') > -1, 'nom échappé');
  assert.ok(html.indexOf('Vis 4&quot; &lt;90 cm') > -1, 'motif échappé');
  assert.ok(html.indexOf('evil.test') < 0, 'signature extérieure supprimée');
  assert.strictEqual(g.feuilles['Absences'].lignes[1][7], '\'=HYPERLINK("x")');
});

test('absence : l’ancien format (sans numéro de fiche) marche toujours', () => {
  const g = environnement();
  const r = poster(g, absence({ dateAbsence: '2026-11-30', destinataires: [FRANCK] }));
  assert.strictEqual(r.status, 'ok');
  assert.ok(pdfDe(g).indexOf('Killian MARTIN') > -1);
  assert.deepStrictEqual(g.mails.map(m => m.to), [FRANCK]);
});


console.log('Relecture du lot 1 — corrections serveur');
test('photos d’une fiche abandonnée puis reprise après 7 jours : la fiche part quand même (plus de boucle sans fin)', () => {
  const g = environnement();
  poster(g, { action: 'photo', id: 'photo-1001-abcd', fiche: 'fiche-1001-abcd', mime: 'image/jpeg', data: PHOTO_B64 });
  const ancien = g.racine.enfants.find(e => e.nom === '_PHOTOS EN COURS').enfants.find(e => e.nom === 'fiche-1001-abcd');
  ancien.corbeille = true;   // nettoyage des 7 jours
  poster(g, { action: 'photo', id: 'photo-1001-abcd', fiche: 'fiche-1001-abcd', mime: 'image/jpeg', data: PHOTO_B64 });
  const r = poster(g, { action: 'fiche', id: 'fiche-1001-abcd', donnees: quitus({ photosBase64: [{ photoRef: 'photo-1001-abcd' }] }) });
  assert.strictEqual(r.code, 'ENREGISTRE', JSON.stringify(r));
});

test('erreur après le départ des premiers mails : fiche notée « traité (incomplet) », pas de renvoi en double', () => {
  const g = environnement();
  const vrai = g.ctx.envoyer_;
  let n = 0;
  g.ctx.envoyer_ = function () { if (++n === 2) throw new Error('Gmail indisponible'); return vrai.apply(this, arguments); };
  const corps = { action: 'fiche', id: 'fiche-1002-abcd', donnees: quitus({ destinataires: [FRANCK] }) };
  const r = poster(g, corps);
  assert.strictEqual(r.ok, true, JSON.stringify(r));
  assert.ok(r.data && r.data.incomplet);
  const avant = g.mails.filter(m => m.sujet.indexOf('Quitus') > -1).length;
  assert.strictEqual(poster(g, corps).code, 'DEJA_RECU', 'un renvoi du téléphone ne refait rien');
  assert.strictEqual(g.mails.filter(m => m.sujet.indexOf('Quitus') > -1).length, avant);
  assert.ok(g.feuilles['Envois'].lignes.some(l => l[4] === 'traité (incomplet)'));
  assert.ok(g.mails.some(m => /envoyée en partie/.test(m.texte)), 'Franck prévenu');
});

console.log('\n' + reussis + ' test(s) réussi(s)' + (process.exitCode ? ' — DES TESTS ÉCHOUENT' : ''));
