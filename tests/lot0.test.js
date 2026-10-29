// Tests du lot 0 (sécurité) : node tests/lot0.test.js
'use strict';
const assert = require('assert');
const { creerGoogle, chargerScript } = require('./gas-harness');

const FRANCK = 'franck@loue.test', SEB = 'seb@loue.test', ATELIER = 'atelier@loue.test', ARCHI = 'archi@externe.test';
const SIG = 'data:image/png;base64,iVBORw0KGgo=';
const PHOTO = { data: '/9j/4AAQSkZJRg==', mimeType: 'image/jpeg', label: 'Photo 1' };

function environnement(options = {}) {
  const google = creerGoogle(Object.assign({
    proprietes: { DRIVE_ROOT_ID: 'RACINE', DRIVE_PLANNING_ID: 'PLANNING' },
    feuilles: {
      'Contacts': [
        ['Nom', 'Role', 'Email', 'ChefEquipe', 'Destinataire', 'ConducteurDefaut', 'ChefAtelier', 'absenceNotif'],
        ['Franck PAVAGEAU', 'Conducteur de travaux', FRANCK, 'O', 'N', 'O', 'N', 'O'],
        ["Sébastien L'ÉQUIPE", 'Conducteur de travaux', SEB, 'O', 'N', 'N', 'N', 'N'],
        ['Thomas', "Chef d'atelier", ATELIER, 'N', 'N', 'N', 'O', 'N'],
      ],
      'Contacts notes': [['Nom', 'Email'], ['Archi', ARCHI]],
      'Chantiers': [['Nom', 'Référence', 'Statut', 'Conducteur'], ['CHANTIER TEST 1', 'LIEU', 'En cours', "Sébastien L'ÉQUIPE"]],
      'Prise de Cote': [['', 'REF']],
      'Fabrication': [['Ref']],
    },
  }, options));
  const racine = google.creerElement('dossier', 'Loué Menuiserie - Chantiers', null, { id: 'RACINE' });
  google.creerElement('dossier', 'Planning', null, { id: 'PLANNING' });
  google.racine = racine;
  google.ctx = chargerScript(google);
  return google;
}
function poster(g, payload) {
  return JSON.parse(g.ctx.doPost({ postData: { contents: JSON.stringify(payload) } }).contenu);
}
const destinatairesDe = g => g.mails.map(m => m.to).sort();
const journal = g => (g.feuilles['Journal'] ? g.feuilles['Journal'].lignes.slice(1) : []);
const pdfHtml = g => g.mails.length ? g.mails[0].opts.attachments[0].contenu : '';

let reussis = 0;
function test(nom, fn) {
  try { fn(); reussis++; console.log('  ✓ ' + nom); }
  catch (e) { console.log('  ✗ ' + nom + '\n    ' + e.message); process.exitCode = 1; }
}

console.log('Lot 0 — envois normaux (adresses du Sheet), comme avant');

test('note de réunion : destinataires du Sheet servis normalement', () => {
  const g = environnement();
  const r = poster(g, { type: 'note', chantier: 'CHANTIER TEST 1', auteur: 'Franck', date: '29/10/2026', objet: 'Réunion',
    commentaires: 'RAS', destinataires: [FRANCK, ARCHI], photosBase64: [PHOTO] });
  assert.strictEqual(r.status, 'ok');
  assert.deepStrictEqual(destinatairesDe(g), [ARCHI, FRANCK].sort());
  assert.ok(g.mails.every(m => m.sujet.indexOf('Note de réunion') > -1 && !m.opts.bcc));
  assert.strictEqual(journal(g).length, 0);
});

test('cotes : conducteur calculé par le serveur, ligne écrite dans le Sheet', () => {
  const g = environnement();
  poster(g, { type: 'cotes', chantier: 'CHANTIER TEST 1', batiment: 'A', auteur: 'Killian', conducteur: "Sébastien L'ÉQUIPE",
    date: '29/10/2026', socle: 'NON', commentaires: '', lignes: [{ logt: '12', piece: 'Chambre', haut: '2495', lep: '-5' }] });
  assert.deepStrictEqual(destinatairesDe(g), [SEB]);
  const ligne = g.feuilles['Prise de Cote'].lignes[1];
  assert.strictEqual(ligne[1], 'CHANTIER TEST 1');
  assert.strictEqual(ligne[8], '-5', 'une cote négative reste une cote');
});

test('cotes : conducteur inconnu → Franck (plus de destinataire vide)', () => {
  const g = environnement();
  poster(g, { type: 'cotes', chantier: 'X', conducteur: 'Personne', lignes: [] });
  assert.deepStrictEqual(destinatairesDe(g), [FRANCK]);
});

test('fabrication : chef d\'atelier + conducteur, PDF unique par mail', () => {
  const g = environnement();
  poster(g, { type: 'fabrication', chantier: 'CHANTIER TEST 1', auteur: 'Franck', conducteur: 'Franck PAVAGEAU',
    chefAtelier: 'Thomas', date: '29/10/2026', delai: 'S48', commentaires: '<span style="color: rgb(179, 46, 46);">Urgent</span>',
    photosBase64: [], blocs: [] });
  assert.deepStrictEqual(destinatairesDe(g), [ATELIER, FRANCK].sort());
  assert.ok(pdfHtml(g).indexOf('<span style="color:rgb(179, 46, 46)">Urgent</span>') > -1, 'la mise en forme autorisée est gardée');
});

test('fabrication : un mail en échec ne fait plus planter la fiche (reporté)', () => {
  const g = environnement({ mailEnPanne: true });
  const r = poster(g, { type: 'fabrication', chantier: 'CHANTIER TEST 1', conducteur: 'Franck PAVAGEAU', blocs: [] });
  assert.strictEqual(r.status, 'ok');
  assert.strictEqual(g.feuilles['Fabrication'].lignes.length, 2, 'la fiche est enregistrée');
  assert.strictEqual(g.feuilles['Mails en attente'].lignes.length, 3, '2 mails reportés');
});

['bordereau-orga', 'bordereau-materiaux'].forEach(type => test(type + ' : envoi et dossier « Bordereaux »', () => {
  const g = environnement();
  poster(g, { type, chantier: 'CHANTIER TEST 1', date: '29/10/2026', heure: '10:00', soussigne: 'Franck', preneur: 'M. X',
    typeDoc: 'Pass GENERAL', nombre: '2', sigLoue: SIG, sigPreneur: SIG, destinataires: [FRANCK], photosBase64: [PHOTO] });
  assert.deepStrictEqual(destinatairesDe(g), [FRANCK]);
  const chantier = g.racine.enfants.find(e => e.nom === 'CHANTIER TEST 1');
  assert.ok(chantier.enfants.find(e => e.nom === 'Bordereaux').enfants.length === 1, 'PDF rangé dans Bordereaux');
  assert.ok(pdfHtml(g).indexOf(SIG) > -1, 'la signature est dans le PDF');
}));

test('quitus : envoi normal', () => {
  const g = environnement();
  poster(g, { type: 'quitus', chantier: 'CHANTIER TEST 1', date: '29/10/2026', intervenant: 'Client', solde: 'OUI',
    sigLoue: SIG, sigIntervenant: SIG, destinataires: [SEB], photosBase64: [] });
  assert.deepStrictEqual(destinatairesDe(g), [SEB]);
});

test('absence : destinataires « absenceNotif » calculés + email perso connu', () => {
  const g = environnement();
  poster(g, { type: 'absence', nom: 'Killian', dateAbsence: '30/10/2026', signature: SIG, emailPerso: SEB, destinataires: [] });
  assert.deepStrictEqual(destinatairesDe(g), [FRANCK, SEB].sort());
});

test('réception support : conducteur + destinataire supplémentaire connus', () => {
  const g = environnement();
  poster(g, { type: 'reception-support', chantier: 'CHANTIER TEST 1', lotLabel: 'Menuiserie Intérieure', signature: SIG,
    points: [{ label: 'Planéité', state: 'ok', comment: '', photos: [] }], conducteurEmail: SEB, destSupp: FRANCK });
  assert.deepStrictEqual(destinatairesDe(g), [FRANCK, SEB].sort());
});

test('attestation : conducteur absent → conducteur du chantier', () => {
  const g = environnement();
  poster(g, { type: 'attestation', typeAttest: 'autre', typeLabel: 'Mise en œuvre', chantier: 'CHANTIER TEST 1',
    signataire: 'Franck PAVAGEAU', objet: 'Pose OK', photos: [], signature: SIG, conducteurEmail: '' });
  assert.deepStrictEqual(destinatairesDe(g), [SEB]);
});

console.log('Lot 0 — adresses tapées à la main (« libres »)');

test('adresse libre : mail au contenu imposé, PJ renommée, copie cachée au conducteur, journal', () => {
  const g = environnement();
  poster(g, { type: 'quitus', chantier: 'CHANTIER TEST 1', intervenant: 'Client <b>gras</b>',
    description: 'Cliquez sur http://arnaque.test', destinataires: ['client@gmail.test'], photosBase64: [] });
  assert.strictEqual(g.mails.length, 1);
  const m = g.mails[0];
  assert.strictEqual(m.to, 'client@gmail.test');
  assert.strictEqual(m.sujet, 'Loué Menuiserie — Quitus — CHANTIER TEST 1');
  assert.ok(m.texte.indexOf('arnaque') < 0 && !m.opts.htmlBody, 'aucun texte libre dans le mail');
  assert.strictEqual(m.opts.bcc, SEB, 'conducteur du chantier en copie cachée');
  assert.ok(/^Loue Menuiserie - Quitus - \d{4}-\d{2}-\d{2}\.pdf$/.test(m.opts.attachments[0].nom));
  assert.deepStrictEqual(journal(g).map(l => l[4]), ['envoyé']);
});

test('adresse libre : chantier inventé → absent du sujet, copie à Franck', () => {
  const g = environnement();
  poster(g, { type: 'quitus', chantier: 'Gagnez un iPhone !', destinataires: ['x@y.test'], photosBase64: [] });
  assert.strictEqual(g.mails[0].sujet, 'Loué Menuiserie — Quitus');
  assert.strictEqual(g.mails[0].opts.bcc, FRANCK);
});

test('adresse libre : 3e adresse sur une fiche refusée, une seule alerte par jour', () => {
  const g = environnement();
  poster(g, { type: 'note', chantier: 'CHANTIER TEST 1', destinataires: ['a@x.test', 'b@x.test', 'c@x.test', 'd@x.test'] });
  const libres = g.mails.filter(m => m.to !== FRANCK);
  assert.strictEqual(libres.length, 2);
  const alertes = g.mails.filter(m => m.to === FRANCK && m.sujet.indexOf('Envoi refusé') > -1);
  assert.strictEqual(alertes.length, 1, 'une seule alerte');
  assert.deepStrictEqual(journal(g).map(l => l[4]).sort(), ['envoyé', 'envoyé', 'refusé', 'refusé']);
});

test('adresse libre : plafond de 10 par jour pour toute l\'appli', () => {
  const g = environnement({ quota: 100 });
  for (let i = 0; i < 6; i++) {
    poster(g, { type: 'quitus', chantier: 'CHANTIER TEST 1', destinataires: ['p' + i + '@x.test', 'q' + i + '@x.test'] });
  }
  const envoyes = journal(g).filter(l => l[4] === 'envoyé').length;
  const refuses = journal(g).filter(l => l[4] === 'refusé').length;
  assert.strictEqual(envoyes, 10);
  assert.strictEqual(refuses, 2);
});

test('adresse mal formée : refusée sans envoi', () => {
  const g = environnement();
  poster(g, { type: 'quitus', chantier: 'CHANTIER TEST 1', destinataires: ['pas une adresse', 'a@b'] });
  assert.strictEqual(g.mails.filter(m => m.to !== FRANCK).length, 0);
});

console.log('Lot 0 — quota de mails');

test('quota bas : mails reportés, ceux de Franck partent ; renvoi automatique ensuite', () => {
  const g = environnement({ quota: 21 });
  poster(g, { type: 'note', chantier: 'CHANTIER TEST 1', destinataires: [FRANCK, ARCHI] });
  assert.deepStrictEqual(destinatairesDe(g), [FRANCK], 'seul Franck reçoit');
  const attente = g.feuilles['Mails en attente'].lignes;
  assert.strictEqual(attente.length, 2);
  assert.strictEqual(attente[1][3], ARCHI);
  g.etat.quota = 100;
  g.ctx.renvoyerMailsEnAttente();
  assert.deepStrictEqual(destinatairesDe(g), [ARCHI, FRANCK].sort());
  assert.strictEqual(g.feuilles['Mails en attente'].lignes[1][10], 'envoyé');
});

test('absence reportée : PDF gardé dans _MAILS EN ATTENTE puis mis à la corbeille après envoi', () => {
  const g = environnement({ quota: 5 });
  poster(g, { type: 'absence', nom: 'Killian', dateAbsence: '30/10/2026', emailPerso: '', destinataires: [SEB] });
  const dossier = g.racine.enfants.find(e => e.nom === '_MAILS EN ATTENTE');
  assert.ok(dossier && dossier.enfants.length === 1);
  g.etat.quota = 100;
  g.ctx.renvoyerMailsEnAttente();
  assert.ok(dossier.enfants[0].corbeille, 'PDF temporaire à la corbeille');
});

console.log('Lot 0 — injection de texte');

test('texte piégé échappé dans le PDF, signature et image extérieures supprimées', () => {
  const g = environnement();
  poster(g, { type: 'quitus', chantier: 'CHANTIER TEST 1', intervenant: '<script>alert(1)</script>', description: 'passage < 90 cm "OK"',
    sigLoue: 'https://evil.test/x.png', sigIntervenant: SIG,
    photosBase64: [{ data: '"><img src=x onerror=alert(1)>', mimeType: 'text/html' }], destinataires: [FRANCK] });
  const html = pdfHtml(g);
  assert.ok(html.indexOf('<script>') < 0 && html.indexOf('&lt;script&gt;') > -1);
  assert.ok(html.indexOf('passage &lt; 90 cm &quot;OK&quot;') > -1, 'un « < » ne coupe plus le texte');
  assert.ok(html.indexOf('evil.test') < 0 && html.indexOf('onerror') < 0);
});

test('fabrication : commentaires — balises dangereuses retirées, mise en forme gardée', () => {
  const g = environnement();
  poster(g, { type: 'fabrication', chantier: 'CHANTIER TEST 1', conducteur: 'Franck PAVAGEAU', blocs: [],
    commentaires: '<b>Gras</b><img src=x onerror=alert(1)><a href="http://x">lien</a><span style="font-size:1.4em;background:url(x)">Grand</span>' });
  const html = pdfHtml(g);
  assert.ok(html.indexOf('<b>Gras</b>') > -1);
  assert.ok(html.indexOf('<img') < 0 && html.indexOf('href') < 0 && html.indexOf('url(') < 0);
  assert.ok(html.indexOf('<span style="font-size:1.4em">Grand</span>') > -1);
});

test('Sheet : une formule saisie est neutralisée', () => {
  const g = environnement();
  poster(g, { type: 'cotes', chantier: '=HYPERLINK("http://x")', conducteur: 'Franck PAVAGEAU', lignes: [{ logt: '+33', piece: '@moi' }] });
  const l = g.feuilles['Prise de Cote'].lignes[1];
  assert.strictEqual(l[1], "'=HYPERLINK(\"http://x\")");
  assert.strictEqual(l[5], "'+33");
  assert.strictEqual(l[6], "'@moi");
});

test('type de fiche inconnu : refusé (avant, il était traité comme une fiche de cotes)', () => {
  const g = environnement();
  const r = poster(g, { type: 'spam', destinataires: [ARCHI] });
  assert.strictEqual(r.status, 'error');
  assert.strictEqual(g.mails.length, 0);
});

console.log('Lot 0 — consultation et partages Drive');

test('doGet : version, callback JSONP contrôlé', () => {
  const g = environnement();
  assert.strictEqual(g.ctx.doGet({ parameter: {} }).contenu, 'Loué App API v4.1 OK');
  const r = g.ctx.doGet({ parameter: { action: 'getContacts', callback: 'alert(1);x' } });
  assert.ok(r.contenu.charAt(0) === '{', 'callback invalide ignoré : JSON simple');
});

test('getDossiers : seul « Plans » est listé (et partagé) ; Accès n\'est plus partagé', () => {
  const g = environnement();
  const ch = g.creerElement('dossier', 'CHANTIER TEST 1', g.racine);
  const plans = g.creerElement('dossier', 'Plans', ch);
  const acces = g.creerElement('dossier', 'Accès', ch);
  const p1 = g.creerElement('fichier', 'plan.pdf', plans);
  const a1 = g.creerElement('fichier', 'codes.pdf', acces);
  const r = JSON.parse(g.ctx.doGet({ parameter: { action: 'getDossiers', chantier: 'CHANTIER TEST 1' } }).contenu);
  assert.deepStrictEqual(Object.keys(r.dossiers), ['plans']);
  assert.strictEqual(p1.acces, 'ANYONE_WITH_LINK');
  assert.strictEqual(a1.acces, 'PRIVATE');
});

test('PDF produits : plus jamais partagés publiquement', () => {
  const g = environnement();
  poster(g, { type: 'quitus', chantier: 'CHANTIER TEST 1', destinataires: [FRANCK] });
  const quitus = g.racine.enfants.find(e => e.nom === 'CHANTIER TEST 1').enfants.find(e => e.nom === 'Quitus');
  assert.strictEqual(quitus.enfants[0].acces, 'PRIVATE');
});

test('lister / retirer / remettre les partages : Plans et Planning gardés, hors appli intact', () => {
  const g = environnement();
  const partager = el => { el.acces = 'ANYONE_WITH_LINK'; el.permission = 'VIEW'; return el; };
  const ch = g.creerElement('dossier', 'CHANTIER TEST 1', g.racine);
  const plan = partager(g.creerElement('fichier', 'plan.pdf', g.creerElement('dossier', 'Plans', ch)));
  const codes = partager(g.creerElement('fichier', 'codes.pdf', g.creerElement('dossier', 'Accès', ch)));
  const dossierSecu = partager(g.creerElement('dossier', 'Sécurité', ch));
  const planning = partager(g.creerElement('fichier', 'S45.pdf', g.elements['PLANNING']));
  const perso = partager(g.creerElement('fichier', 'vacances.jpg', g.creerElement('dossier', 'Perso', null)));
  assert.ok(/Liste terminée/.test(g.ctx.listerPartages()));
  const lignes = g.feuilles['Partages (lot 0)'].lignes.slice(1).filter(l => l[0]);
  assert.strictEqual(lignes.length, 4, 'le fichier perso hors appli n\'est pas listé');
  const decision = nom => lignes.find(l => l[1] === nom)[6];
  assert.strictEqual(decision('plan.pdf'), 'garder');
  assert.strictEqual(decision('S45.pdf'), 'garder');
  assert.strictEqual(decision('codes.pdf'), 'à retirer');
  assert.strictEqual(decision('Sécurité'), 'à retirer');
  g.ctx.retirerPartages();
  assert.strictEqual(codes.acces, 'PRIVATE');
  assert.strictEqual(dossierSecu.acces, 'PRIVATE');
  assert.strictEqual(plan.acces, 'ANYONE_WITH_LINK');
  assert.strictEqual(planning.acces, 'ANYONE_WITH_LINK');
  assert.strictEqual(perso.acces, 'ANYONE_WITH_LINK');
  g.ctx.remettrePartages();
  assert.strictEqual(codes.acces, 'ANYONE_WITH_LINK');
  assert.strictEqual(codes.permission, 'VIEW');
});

test('retirerPartages refuse de tourner si la liste n\'est pas terminée', () => {
  const g = environnement();
  g.ctx.retirerPartages();
  assert.ok(!g.feuilles['Partages (lot 0)']);
});

test('installerDeclencheurs + verifierConfig', () => {
  const g = environnement();
  g.ctx.installerDeclencheurs();
  g.ctx.installerDeclencheurs();
  assert.deepStrictEqual(g.declencheurs, ['renvoyerMailsEnAttente']);
  const rapport = g.ctx.verifierConfig();
  assert.ok(rapport.indexOf('❌') < 0, rapport);
});

test('propriété DRIVE_ROOT_ID manquante : verifierConfig le signale', () => {
  const g = environnement({ proprietes: {} });
  assert.ok(g.ctx.verifierConfig().indexOf('❌ DRIVE_ROOT_ID') > -1);
});


console.log('Copie TEST');
test('anonymiserCopieTest : refuse sur le vrai Sheet, remplace sur TEST', () => {
  const g = environnement();
  assert.ok(/Refusé/.test(g.ctx.anonymiserCopieTest()));
  assert.strictEqual(g.feuilles['Contacts'].lignes[1][2], FRANCK);
  const t = environnement({ proprietes: { DRIVE_ROOT_ID: 'RACINE', DRIVE_PLANNING_ID: 'PLANNING', ENVIRONNEMENT: 'TEST' } });
  t.contexte.SpreadsheetApp.getActiveSpreadsheet().getName = () => 'ChantierPro TEST';
  assert.ok(/4 adresse/.test(t.ctx.anonymiserCopieTest()));
  assert.strictEqual(t.feuilles['Contacts'].lignes[2][2], 'franck+contact2@loue.test');
  assert.strictEqual(t.feuilles['Contacts notes'].lignes[1][1], 'franck+contact4@loue.test');
});

console.log('Corrections après la revue indépendante');
test('remettre puis retirer à nouveau : les partages sont bien retirés', () => {
  const g = environnement();
  const ch = g.creerElement('dossier', 'CHANTIER TEST 1', g.racine);
  const codes = g.creerElement('fichier', 'codes.pdf', g.creerElement('dossier', 'Accès', ch));
  codes.acces = 'ANYONE_WITH_LINK'; codes.permission = 'VIEW';
  g.ctx.listerPartages(); g.ctx.retirerPartages(); g.ctx.remettrePartages();
  assert.strictEqual(codes.acces, 'ANYONE_WITH_LINK');
  g.ctx.retirerPartages();
  assert.strictEqual(codes.acces, 'PRIVATE');
});
test('relancer listerPartages après un retrait : refusé (la liste sert au retour arrière)', () => {
  const g = environnement();
  const ch = g.creerElement('dossier', 'CHANTIER TEST 1', g.racine);
  const f = g.creerElement('fichier', 'codes.pdf', g.creerElement('dossier', 'Accès', ch));
  f.acces = 'ANYONE_WITH_LINK'; f.permission = 'VIEW';
  g.ctx.listerPartages(); g.ctx.retirerPartages();
  assert.ok(/Refusé/.test(g.ctx.listerPartages()));
  g.ctx.remettrePartages();
  assert.strictEqual(f.acces, 'ANYONE_WITH_LINK', 'le retour arrière marche toujours');
});
test('partage hérité : dossiers traités d\'abord, fichiers marqués « déjà privé »', () => {
  const g = environnement({ heritage: true });
  const ch = g.creerElement('dossier', 'CHANTIER TEST 1', g.racine);
  ch.acces = 'ANYONE_WITH_LINK'; ch.permission = 'VIEW';
  const plans = g.creerElement('dossier', 'Plans', ch);
  const plan = g.creerElement('fichier', 'plan.pdf', plans); plan.acces = 'ANYONE_WITH_LINK'; plan.permission = 'VIEW';
  const codes = g.creerElement('fichier', 'codes.pdf', g.creerElement('dossier', 'Accès', ch));
  g.ctx.listerPartages();
  const r = g.ctx.retirerPartages();
  assert.ok(/Terminé/.test(r), r);
  assert.strictEqual(ch.acces, 'PRIVATE');
  assert.strictEqual(g.contexte.DriveApp.getFileById(codes.id).getSharingAccess(), 'PRIVATE', 'codes.pdf plus accessible');
  assert.strictEqual(plan.acces, 'ANYONE_WITH_LINK', 'le plan reste partagé');
  const etats = g.feuilles['Partages (lot 0)'].lignes.slice(1).map(l => l[7]);
  assert.ok(etats.every(e => !/erreur/.test(e)), etats.join(' | '));
});
test('destinataires : une chaîne au lieu d\'un tableau est ignorée, 20 adresses au plus', () => {
  const g = environnement();
  poster(g, { type: 'note', chantier: 'CHANTIER TEST 1', destinataires: 'a@x.test' });
  assert.strictEqual(g.mails.length, 0);
  const beaucoup = Array.from({ length: 500 }, (_, i) => 'pirate' + i + '@x.test');
  poster(g, { type: 'note', chantier: 'CHANTIER TEST 1', destinataires: beaucoup });
  assert.ok(journal(g).length <= 20, 'journal borné : ' + journal(g).length);
});
test('cellule Contacts avec deux adresses : les deux sont servies comme avant', () => {
  const g = environnement();
  g.feuilles['Contacts'].lignes[2][2] = 'seb@loue.test, bureau@loue.test';
  poster(g, { type: 'cotes', chantier: 'CHANTIER TEST 1', conducteur: "Sébastien L'ÉQUIPE", lignes: [] });
  assert.deepStrictEqual(destinatairesDe(g), ['bureau@loue.test', 'seb@loue.test']);
  assert.strictEqual(journal(g).length, 0, "aucune n'est traitée comme adresse libre");
});
test('serveur occupé : l\'adresse libre est refusée avec le bon motif (pas « plafond »)', () => {
  const g = environnement({ verrouOccupe: true });
  poster(g, { type: 'quitus', chantier: 'CHANTIER TEST 1', destinataires: ['client@x.test'] });
  assert.ok(/serveur occupé/.test(journal(g)[0][5]));
});
console.log('\n' + reussis + ' test(s) réussi(s)' + (process.exitCode ? ' — DES TESTS ÉCHOUENT' : ''));
