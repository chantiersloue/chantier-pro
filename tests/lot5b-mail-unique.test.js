// Tests du lot 5b (« un seul mail par fiche » pour les adresses CONNUES du Sheet) : node tests/lot5b-mail-unique.test.js
// Tout se passe dans le faux Google (tests/gas-harness.js) : aucun vrai mail n'est envoyé.
// Le réglage MAIL_UNIQUE est une « propriété du script » : non (défaut) | cache | conducteur.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { creerGoogle, chargerScript } = require('./gas-harness');

const RACINE = path.join(__dirname, '..');
const FRANCK = 'franck@loue.test', SEB = 'seb@loue.test', ATELIER = 'atelier@loue.test', ARCHI = 'archi@externe.test';
const CHANTIER = 'CHANTIER TEST 1', SANS_CONDUCTEUR = 'CHANTIER SANS CONDUCTEUR';
// c1@connu.test … c60@connu.test : des adresses connues du Sheet (onglet « Contacts notes »)
const connus = n => Array.from({ length: n }, (_, i) => 'c' + (i + 1) + '@connu.test');

// o.mode : valeur de la propriété MAIL_UNIQUE (absente si non donné) ; o.quota : mails encore possibles aujourd'hui
function environnement(o = {}) {
  const proprietes = { DRIVE_ROOT_ID: 'RACINE', DRIVE_PLANNING_ID: 'PLANNING' };
  if (o.mode !== undefined) proprietes.MAIL_UNIQUE = o.mode;
  const g = creerGoogle(Object.assign({
    proprietes: proprietes, quota: o.quota,
    feuilles: {
      'Contacts': [
        ['Nom', 'Role', 'Email', 'ChefEquipe', 'Destinataire', 'ConducteurDefaut', 'ChefAtelier', 'absenceNotif'],
        ['Franck PAVAGEAU', 'Conducteur de travaux', FRANCK, 'O', 'N', 'O', 'N', 'O'],
        ["Sébastien L'ÉQUIPE", 'Conducteur de travaux', SEB, 'O', 'N', 'N', 'N', 'N'],
        ['Thomas', "Chef d'atelier", ATELIER, 'N', 'N', 'N', 'O', 'N'],
      ],
      'Contacts notes': [['Nom', 'Email'], ['Archi', ARCHI]].concat(connus(60).map((e, i) => ['Contact ' + (i + 1), e])),
      'Chantiers': [['Nom', 'Référence', 'Statut', 'Conducteur'], [CHANTIER, 'LIEU', 'En cours', "Sébastien L'ÉQUIPE"], [SANS_CONDUCTEUR, 'LIEU', 'En cours', '']],
      'Prise de Cote': [['', 'REF']],
      'Fabrication': [['Ref']],
    },
  }, o.options || {}));
  g.racine = g.creerElement('dossier', 'Loué Menuiserie - Chantiers', null, { id: 'RACINE' });
  g.creerElement('dossier', 'Planning', null, { id: 'PLANNING' });
  g.ctx = chargerScript(g);
  // combien de fois le PDF est fabriqué
  g.pdfFabriques = 0;
  const vrai = g.contexte.HtmlService.createHtmlOutput;
  g.contexte.HtmlService.createHtmlOutput = html => { g.pdfFabriques++; return vrai(html); };
  return g;
}
let numero = 0;
const idFiche = () => 'fiche-' + String(++numero).padStart(4, '0') + '-abcd';
const poster = (g, corps) => JSON.parse(g.ctx.doPost({ postData: { contents: JSON.stringify(corps) } }).contenu);
const envoyer = (g, donnees, id) => poster(g, { action: 'fiche', id: id || idFiche(), donnees: donnees });
// Un quitus : le serveur ajoute toujours le conducteur du chantier (ici Sébastien), ou Franck si le chantier n'en a pas
const quitus = (destinataires, chantier) => ({ type: 'quitus', chantier: chantier || CHANTIER, date: '30/10/2026', intervenant: 'Client',
  solde: 'OUI', destinataires: destinataires, photosBase64: [] });
const note = destinataires => ({ type: 'note', chantier: CHANTIER, auteur: 'Franck', date: '12/11/2026', objet: 'Réunion de chantier',
  commentaires: 'Pose des châssis du R+1', destinataires: destinataires, photosBase64: [] });
const adresses = v => String(v || '').split(/[,;\s]+/).filter(Boolean);
// Les mails de fiche (pas les alertes à Franck) : [« À », [copies cachées]]
const fiches = g => g.mails.filter(m => !/Envoi refusé|Document à classer|Fiche non traitée/.test(m.sujet));
const resume = g => fiches(g).map(m => [m.to, adresses(m.opts.bcc)]);
const journal = g => (g.feuilles['Journal'] ? g.feuilles['Journal'].lignes.slice(1) : []);
const attente = g => (g.feuilles['Mails en attente'] ? g.feuilles['Mails en attente'].lignes.slice(1) : []);
const unParAdresse = liste => liste.map(a => [a, []]);
// Copie « à plat » d'une valeur lue dans le faux Sheet (les tableaux du serveur simulé viennent d'un autre contexte)
const clair = x => JSON.parse(JSON.stringify(x));

let reussis = 0;
function test(nom, fn) {
  try { fn(); reussis++; console.log('  ✓ ' + nom); }
  catch (e) { console.log('  ✗ ' + nom + '\n    ' + String(e.stack || e.message).split('\n').slice(0, 8).join('\n    ')); process.exitCode = 1; }
}

console.log('Lot 5b — le faux Google compte comme le vrai');
test('quota : chaque adresse réelle de « À », « Copie » et « Copie cachée » compte pour 1 ; un « À » vide compte 0', () => {
  const g = environnement();
  g.contexte.GmailApp.sendEmail('', 'objet', 'texte', { bcc: 'a@x.test, b@x.test, c@x.test' });
  assert.strictEqual(g.etat.quota, 97);
  g.contexte.GmailApp.sendEmail('a@x.test', 'objet', 'texte', { cc: 'b@x.test', bcc: 'c@x.test;d@x.test' });
  assert.strictEqual(g.etat.quota, 93);
  g.contexte.GmailApp.sendEmail('a@x.test, b@x.test', 'objet', 'texte');
  assert.strictEqual(g.etat.quota, 91);
  g.etat.quota = 2;
  assert.throws(() => g.contexte.GmailApp.sendEmail('', 'objet', 'texte', { bcc: 'a@x.test, b@x.test, c@x.test' }), /Quota/);
  assert.strictEqual(g.etat.quota, 2, 'un mail refusé ne consomme rien');
});
test('plus de 50 destinataires dans un mail : refusé, comme chez Google ; aucun destinataire : refusé', () => {
  const g = environnement({ quota: 1000 });
  g.contexte.GmailApp.sendEmail('', 'objet', 'texte', { bcc: connus(50).join(', ') });
  assert.strictEqual(g.mails.length, 1, '50 : accepté');
  assert.throws(() => g.contexte.GmailApp.sendEmail('', 'objet', 'texte', { bcc: connus(51).join(', ') }), /Limit Exceeded/);
  assert.throws(() => g.contexte.GmailApp.sendEmail('', 'objet', 'texte', {}), /no recipient/);
  assert.strictEqual(g.mails.length, 1);
  assert.strictEqual(g.etat.quota, 950);
});

console.log('Lot 5b — le réglage MAIL_UNIQUE (propriété du script)');
test('réglage absent : exactement comme aujourd’hui — un mail par adresse connue, sans copie cachée', () => {
  const g = environnement();
  const r = envoyer(g, quitus([FRANCK, ARCHI]));
  assert.strictEqual(g.ctx.modeMailUnique_(), 'non');
  assert.deepStrictEqual(resume(g), unParAdresse([FRANCK, ARCHI, SEB]));
  assert.strictEqual(g.etat.quota, 97);
  assert.deepStrictEqual([r.code, r.data.envoyes, r.data.reportes], ['ENREGISTRE', 3, 0]);
  assert.strictEqual(journal(g).length, 0);
});
test('réglage « non », vide ou inconnu (« oui », « true », « bcc »…) : lu comme « non »', () => {
  ['non', 'NON', '', '  ', 'oui', 'true', 'bcc', 'cache conducteur', '1'].forEach(v => {
    const g = environnement({ mode: v });
    envoyer(g, quitus([FRANCK, ARCHI]));
    assert.strictEqual(g.ctx.modeMailUnique_(), 'non', '« ' + v + ' »');
    assert.deepStrictEqual(resume(g), unParAdresse([FRANCK, ARCHI, SEB]), '« ' + v + ' »');
  });
});
test('« cache » et « conducteur » sont reconnus quelle que soit la casse, avec des espaces ou un accent', () => {
  [[' Cache ', 'cache'], ['CACHE', 'cache'], ['caché', 'cache'], ['Conducteur', 'conducteur'], ['conducteur ', 'conducteur']].forEach(c => {
    assert.strictEqual(environnement({ mode: c[0] }).ctx.modeMailUnique_(), c[1], '« ' + c[0] + ' »');
  });
});
test('le changement est immédiat, sans nouveau déploiement : non → cache → non sur le même serveur', () => {
  const g = environnement({ mode: 'non' });
  envoyer(g, quitus([FRANCK, ARCHI]));
  assert.strictEqual(fiches(g).length, 3);
  g.proprietes.MAIL_UNIQUE = 'cache';
  envoyer(g, quitus([FRANCK, ARCHI]));
  assert.strictEqual(fiches(g).length, 4, 'un seul mail de plus');
  g.proprietes.MAIL_UNIQUE = 'non';   // le retour arrière
  envoyer(g, quitus([FRANCK, ARCHI]));
  assert.strictEqual(fiches(g).length, 7);
  delete g.proprietes.MAIL_UNIQUE;
  envoyer(g, quitus([FRANCK, ARCHI]));
  assert.strictEqual(fiches(g).length, 10);
});
test('verifierConfig affiche la valeur lue, et signale une valeur inconnue', () => {
  const ligne = mode => environnement(mode === undefined ? {} : { mode: mode }).ctx.verifierConfig().split('\n').filter(l => /MAIL_UNIQUE/.test(l));
  assert.deepStrictEqual(ligne(undefined).length, 1);
  assert.ok(/^✅ .*MAIL_UNIQUE.* : non — un mail par adresse connue/.test(ligne(undefined)[0]), ligne(undefined)[0]);
  assert.ok(/^✅ .*MAIL_UNIQUE.* : cache — un seul mail par fiche.*« À » vide/.test(ligne('cache')[0]), ligne('cache')[0]);
  assert.ok(/^✅ .*MAIL_UNIQUE.* : conducteur — un seul mail par fiche.*« À » = le conducteur/.test(ligne('Conducteur')[0]), ligne('Conducteur')[0]);
  assert.ok(/^❌ .*MAIL_UNIQUE.*« oui ».*lue comme « non »/.test(ligne('oui')[0]), ligne('oui')[0]);
});

console.log('Lot 5b — mode « cache » : un seul mail, « À » vide, tout le monde en copie cachée');
test('1 adresse connue : rien à grouper, le mail d’aujourd’hui (« À » = l’adresse, pas de copie cachée)', () => {
  const g = environnement({ mode: 'cache' });
  const r = envoyer(g, quitus([]));
  assert.deepStrictEqual(resume(g), [[SEB, []]]);
  assert.strictEqual(r.data.envoyes, 1);
});
test('3 adresses connues : 1 mail, 3 copies cachées, le PDF une fois, 3 destinataires comptés au quota et dans la réponse, rien au Journal', () => {
  const g = environnement({ mode: 'cache' }), h = environnement();
  const r = envoyer(g, quitus([FRANCK, ARCHI]));
  envoyer(h, quitus([FRANCK, ARCHI]));
  assert.deepStrictEqual(resume(g), [['', [FRANCK, ARCHI, SEB]]]);
  const m = fiches(g)[0], avant = fiches(h)[0];
  // objet, texte, mise en forme, nom d'expéditeur et pièce jointe : ceux du mail d'aujourd'hui
  assert.deepStrictEqual([m.sujet, m.texte, m.opts.htmlBody, m.opts.name, m.opts.attachments.length, m.opts.attachments[0].nom, m.opts.cc],
    [avant.sujet, avant.texte, avant.opts.htmlBody, 'Loué Menuiserie', 1, avant.opts.attachments[0].nom, undefined]);
  assert.ok(/^\[Loué App\] Quitus/.test(m.sujet), m.sujet);
  assert.strictEqual(g.etat.quota, 97, 'Google compte les destinataires, pas les mails');
  assert.strictEqual(g.pdfFabriques, 1);
  assert.deepStrictEqual([r.ok, r.code, r.data.envoyes, r.data.reportes, r.data.refuses], [true, 'ENREGISTRE', 3, 0, []]);
  assert.strictEqual(r.message, 'Fiche enregistrée. Envoyé à 3 destinataire(s).');
  assert.deepStrictEqual(clair(g.feuilles['Envois'].lignes[1].slice(4, 6)), ['traité', 'envoyé à 3 destinataire(s)']);
  assert.strictEqual(journal(g).length, 0, 'comme aujourd’hui : rien au Journal pour une adresse connue servie');
  assert.strictEqual(attente(g).length, 0);
});
test('10 adresses connues : 1 mail, 10 copies cachées', () => {
  const g = environnement({ mode: 'cache' });
  const r = envoyer(g, quitus(connus(9)));
  assert.deepStrictEqual(resume(g), [['', connus(9).concat([SEB])]]);
  assert.deepStrictEqual([g.etat.quota, r.data.envoyes], [90, 10]);
});
test('40 adresses connues (le maximum d’un mail groupé) : 1 mail, 40 copies cachées', () => {
  const g = environnement({ mode: 'cache' });
  const r = envoyer(g, quitus(connus(39)));
  assert.deepStrictEqual(resume(g), [['', connus(39).concat([SEB])]]);
  assert.deepStrictEqual([g.etat.quota, r.data.envoyes, r.data.reportes], [60, 40, 0]);
});
test('41 adresses connues : trop pour un mail groupé → le chemin d’aujourd’hui, un mail par adresse', () => {
  const g = environnement({ mode: 'cache' });
  const r = envoyer(g, quitus(connus(40)));
  assert.deepStrictEqual(resume(g), unParAdresse(connus(40).concat([SEB])));
  assert.deepStrictEqual([g.etat.quota, r.data.envoyes, r.data.reportes], [59, 41, 0]);
  assert.strictEqual(journal(g).length, 0);
});
test('60 adresses connues : un mail par adresse, jamais un mail à plus de 50 destinataires ; les derniers sont reportés (réserve de Franck)', () => {
  const g = environnement({ mode: 'cache', quota: 70 });
  const r = envoyer(g, quitus(connus(59)));
  assert.ok(g.mails.every(m => adresses(m.to).length + adresses(m.opts.bcc).length === 1));
  assert.deepStrictEqual(resume(g), unParAdresse(connus(50)), '50 partent (70 − 50 = 20 : la réserve)');
  assert.deepStrictEqual([g.etat.quota, r.data.envoyes, r.data.reportes], [20, 50, 10]);
  assert.deepStrictEqual(attente(g).map(l => [l[3], l[4], l[13]]), connus(59).slice(50).concat([SEB]).map(a => [a, '', 'connue']));
});
test('la même adresse deux fois (majuscules, liste « a, b ») : une seule copie cachée, comme aujourd’hui un seul mail', () => {
  const g = environnement({ mode: 'cache' });
  envoyer(g, quitus([ARCHI, ARCHI.toUpperCase(), 'c1@connu.test, ' + ARCHI, SEB]));
  assert.deepStrictEqual(resume(g), [['', [ARCHI, 'c1@connu.test', SEB]]]);
});

console.log('Lot 5b — adresses connues ET tapées à la main sur la même fiche');
const TEXTE_IMPOSE = 'Bonjour,\n\nVeuillez trouver ci-joint le document « Note de réunion » établi par Loué Menuiserie.\n\nCordialement,\nLoué Menuiserie';
const estLibre = a => /gmail\.test|orange\.test|x\.test/.test(String(a));
test('1 mail groupé pour les adresses connues + les mails séparés des adresses tapées à la main, inchangés (texte imposé, 2 par fiche, copie cachée au conducteur)', () => {
  const g = environnement({ mode: 'cache' });
  const r = envoyer(g, note([FRANCK, ARCHI, 'client@gmail.test', 'voisin@orange.test', 'troisieme@x.test']));
  assert.deepStrictEqual(resume(g), [['', [FRANCK, ARCHI, SEB]], ['client@gmail.test', [SEB]], ['voisin@orange.test', [SEB]]]);
  const libres = g.mails.filter(m => estLibre(m.to));
  assert.deepStrictEqual(libres.map(m => [m.sujet, m.texte, !!m.opts.htmlBody, m.opts.attachments.length]),
    [0, 1].map(() => ['Loué Menuiserie — Note de réunion — CHANTIER TEST 1', TEXTE_IMPOSE, false, 1]));
  assert.ok(libres.every(m => /^Loue Menuiserie - Note de réunion - \d{4}-\d{2}-\d{2}\.pdf$/.test(m.opts.attachments[0].nom)));
  // une adresse tapée à la main n'est JAMAIS dans le mail groupé
  assert.ok(!adresses(fiches(g)[0].opts.bcc).some(estLibre));
  assert.deepStrictEqual(journal(g).map(l => [l[3], l[4]]), [['client@gmail.test', 'envoyé'], ['voisin@orange.test', 'envoyé'], ['troisieme@x.test', 'refusé']]);
  assert.strictEqual(g.mails.filter(m => m.to === FRANCK && /Envoi refusé/.test(m.sujet)).length, 1, 'une alerte à Franck');
  assert.strictEqual(g.etat.quota, 100 - 3 - 2 * 2 - 1);
  assert.deepStrictEqual([r.data.envoyes, r.data.refuses], [5, ['troisieme@x.test']]);
  assert.strictEqual(g.pdfFabriques, 1, 'le PDF n’est fabriqué qu’une fois pour tous les mails');
});
test('plafond de 10 adresses tapées à la main par jour : inchangé en mode « cache »', () => {
  const g = environnement({ mode: 'cache' });
  for (let i = 0; i < 6; i++) envoyer(g, quitus([ARCHI, 'p' + i + '@x.test', 'q' + i + '@x.test']));
  assert.strictEqual(g.mails.filter(m => estLibre(m.to)).length, 10);
  assert.strictEqual(journal(g).filter(l => l[4] === 'refusé' && /plafond de 10 adresses libres par jour/.test(l[5])).length, 2);
  assert.strictEqual(fiches(g).filter(m => m.to === '').length, 6, 'un mail groupé par fiche');
});

console.log('Lot 5b — quota du jour');
test('quota juste suffisant (3 destinataires, 23 possibles : la réserve de 20 reste entière) : mail groupé', () => {
  const g = environnement({ mode: 'cache', quota: 23 });
  envoyer(g, quitus([ARCHI, 'c1@connu.test']));
  assert.deepStrictEqual(resume(g), [['', [ARCHI, 'c1@connu.test', SEB]]]);
  assert.strictEqual(g.etat.quota, 20);
});
test('quota insuffisant pour tout le groupe (22 possibles) : le chemin d’aujourd’hui — les premiers partent, le dernier est reporté, aucune ligne groupée en attente', () => {
  const g = environnement({ mode: 'cache', quota: 22 }), h = environnement({ quota: 22 });
  const r = envoyer(g, quitus([ARCHI, 'c1@connu.test']));
  envoyer(h, quitus([ARCHI, 'c1@connu.test']));
  assert.deepStrictEqual(resume(g), unParAdresse([ARCHI, 'c1@connu.test']));
  assert.deepStrictEqual(attente(g).map(l => [l[3], l[4], l[10], l[13]]), [[SEB, '', 'en attente', 'connue']]);
  assert.deepStrictEqual([r.data.envoyes, r.data.reportes, g.etat.quota], [2, 1, 20]);
  assert.strictEqual(r.message, 'Fiche enregistrée. Envoyé à 2 destinataire(s), 1 reporté(s).');
  // exactement ce que fait le serveur sans le mail unique
  assert.deepStrictEqual(resume(g), resume(h));
  assert.deepStrictEqual(clair(attente(g).map(l => l.slice(1, 8).concat(l.slice(9, 12)))), clair(attente(h).map(l => l.slice(1, 8).concat(l.slice(9, 12)))));
  assert.deepStrictEqual(clair(journal(g).map(l => l.slice(1))), clair(journal(h).map(l => l.slice(1))));
  assert.strictEqual(journal(g).length, 1, 'une ligne « reporté », comme sans le mail unique');
});
test('sous la réserve de 20 (15 possibles), Franck + 2 autres : Franck est servi seul, les 2 autres sont reportés chacun sur sa ligne, puis renvoyés un par un', () => {
  const g = environnement({ mode: 'cache', quota: 15 });
  const r = envoyer(g, quitus([FRANCK, ARCHI]));
  assert.deepStrictEqual(resume(g), [[FRANCK, []]]);
  assert.deepStrictEqual(attente(g).map(l => [l[3], l[4], l[10]]), [[ARCHI, '', 'en attente'], [SEB, '', 'en attente']]);
  assert.deepStrictEqual([r.data.envoyes, r.data.reportes, g.etat.quota], [1, 2, 14]);
  g.etat.quota = 100;
  g.ctx.renvoyerMailsEnAttente();
  assert.deepStrictEqual(resume(g), unParAdresse([FRANCK, ARCHI, SEB]));
  assert.deepStrictEqual(attente(g).map(l => l[10]), ['envoyé', 'envoyé']);
});
test('quota à zéro : tout est reporté, une ligne par adresse', () => {
  const g = environnement({ mode: 'cache', quota: 0 });
  const r = envoyer(g, quitus([FRANCK, ARCHI]));
  assert.strictEqual(g.mails.length, 0);
  assert.deepStrictEqual(attente(g).map(l => [l[3], l[4]]), [[FRANCK, ''], [ARCHI, ''], [SEB, '']]);
  assert.deepStrictEqual([r.data.envoyes, r.data.reportes], [0, 3]);
});

console.log('Lot 5b — l’envoi groupé échoue : repli immédiat sur un mail par adresse');
test('Google refuse le mail groupé (par exemple un « À » vide) : un mail par adresse, personne servi deux fois, une ligne « repli » au Journal', () => {
  const g = environnement({ mode: 'cache' });
  g.etat.avantMail = to => { if (!to) throw new Error('Failed to send email: no recipient'); };
  const r = envoyer(g, quitus([FRANCK, ARCHI]));
  assert.deepStrictEqual(resume(g), unParAdresse([FRANCK, ARCHI, SEB]));
  assert.deepStrictEqual([r.code, r.data.envoyes, r.data.reportes, g.etat.quota], ['ENREGISTRE', 3, 0, 97]);
  assert.deepStrictEqual(journal(g).map(l => [l[1], l[2], l[3], l[4]]), [['quitus', CHANTIER, '3 adresses connues', 'repli']]);
  assert.ok(/mail groupé impossible \(Failed to send email: no recipient\) : un mail par adresse/.test(journal(g)[0][5]), journal(g)[0][5]);
  assert.strictEqual(g.pdfFabriques, 1);
});
test('Gmail en panne pour tout : le mail groupé échoue, puis chaque mail est reporté sur sa ligne (comme aujourd’hui)', () => {
  const g = environnement({ mode: 'cache' });
  g.etat.mailEnPanne = true;
  const r = envoyer(g, quitus([FRANCK, ARCHI]));
  assert.strictEqual(g.mails.length, 0);
  assert.deepStrictEqual(attente(g).map(l => [l[3], l[4], l[10]]), [[FRANCK, '', 'en attente'], [ARCHI, '', 'en attente'], [SEB, '', 'en attente']]);
  assert.deepStrictEqual([r.data.envoyes, r.data.reportes], [0, 3]);
  g.etat.mailEnPanne = false;
  g.ctx.renvoyerMailsEnAttente();
  assert.deepStrictEqual(resume(g), unParAdresse([FRANCK, ARCHI, SEB]));
});
test('la fabrication du PDF échoue : pas de mail groupé, et la suite est celle d’aujourd’hui', () => {
  const g = environnement({ mode: 'cache' }), h = environnement();
  [g, h].forEach(x => { x.contexte.HtmlService.createHtmlOutput = () => { throw new Error('conversion PDF en panne'); }; });
  const r = envoyer(g, quitus([FRANCK, ARCHI])), s = envoyer(h, quitus([FRANCK, ARCHI]));
  assert.deepStrictEqual([r.ok, r.code], [s.ok, s.code]);
  assert.strictEqual(g.mails.length, h.mails.length);
  assert.deepStrictEqual(attente(g).map(l => l[3]), attente(h).map(l => l[3]));
});

console.log('Lot 5b — fiche renvoyée, ancienne ligne en attente');
test('fiche renvoyée deux fois par le téléphone (réponse perdue) : « déjà reçue », aucun second mail', () => {
  const g = environnement({ mode: 'cache' }), id = idFiche();
  envoyer(g, quitus([FRANCK, ARCHI]), id);
  const deux = envoyer(g, quitus([FRANCK, ARCHI]), id), trois = envoyer(g, quitus([FRANCK, ARCHI]), id);
  assert.deepStrictEqual([deux.ok, deux.code, trois.code], [true, 'DEJA_RECU', 'DEJA_RECU']);
  assert.deepStrictEqual(resume(g), [['', [FRANCK, ARCHI, SEB]]]);
  assert.strictEqual(g.etat.quota, 97);
});
test('une ligne en attente écrite AVANT le mail unique est renvoyée telle quelle après (une adresse, pas de copie cachée)', () => {
  const g = environnement({ mode: 'non', quota: 21 });
  envoyer(g, quitus([FRANCK, ARCHI]));                     // l'ancien fonctionnement : Franck servi, Archi et Sébastien reportés
  assert.deepStrictEqual(attente(g).map(l => l[3]), [ARCHI, SEB]);
  g.proprietes.MAIL_UNIQUE = 'cache';                      // le mail unique est allumé entre-temps
  g.etat.quota = 100;
  g.ctx.renvoyerMailsEnAttente();
  assert.deepStrictEqual(resume(g), unParAdresse([FRANCK, ARCHI, SEB]));
  assert.deepStrictEqual(attente(g).map(l => l[10]), ['envoyé', 'envoyé']);
  assert.ok(journal(g).filter(l => l[4] === 'envoyé').every(l => /mail reporté, envoyé au 1e essai/.test(l[5])));
});

console.log('Lot 5b — mode « conducteur » : « À » = le conducteur du chantier s’il est destinataire, les autres en copie cachée');
test('le conducteur du chantier est dans la liste : il est en « À », les autres en copie cachée ; aucun destinataire de plus', () => {
  const g = environnement({ mode: 'conducteur' });
  const r = envoyer(g, quitus([FRANCK, ARCHI]));
  assert.deepStrictEqual(resume(g), [[SEB, [FRANCK, ARCHI]]]);
  assert.deepStrictEqual([g.etat.quota, r.data.envoyes], [97, 3]);
});
test('le conducteur du chantier n’est pas destinataire de la fiche : « À » vide, personne n’est ajouté', () => {
  const g = environnement({ mode: 'conducteur' });
  // fiche de fabrication : chef d'atelier + le conducteur NOMMÉ dans la fiche (Franck), alors que le chantier est à Sébastien
  const r = envoyer(g, { type: 'fabrication', chantier: CHANTIER, auteur: 'Franck', conducteur: 'Franck PAVAGEAU', chefAtelier: 'Thomas',
    date: '29/10/2026', delai: 'S48', commentaires: '', photosBase64: [], blocs: [] });
  assert.deepStrictEqual(resume(g).map(m => [m[0], m[1].slice().sort()]), [['', [ATELIER, FRANCK].sort()]]);
  assert.deepStrictEqual([g.etat.quota, r.data.envoyes], [98, 2]);
});
test('chantier sans conducteur connu : « À » vide, tout le monde en copie cachée', () => {
  const g = environnement({ mode: 'conducteur' });
  envoyer(g, quitus([ARCHI, 'c1@connu.test'], SANS_CONDUCTEUR));
  assert.deepStrictEqual(resume(g), [['', [ARCHI, 'c1@connu.test', FRANCK]]]);
  const h = environnement({ mode: 'conducteur' });
  envoyer(h, quitus([ARCHI, 'c1@connu.test'], 'Chantier tapé à la main'));
  assert.deepStrictEqual(resume(h), [['', [ARCHI, 'c1@connu.test', FRANCK]]]);
});
test('mode « conducteur » : mêmes replis (une adresse, quota, réserve de Franck)', () => {
  const g = environnement({ mode: 'conducteur' });
  envoyer(g, quitus([]));
  assert.deepStrictEqual(resume(g), [[SEB, []]]);
  const h = environnement({ mode: 'conducteur', quota: 15 });
  envoyer(h, quitus([FRANCK, ARCHI]));
  assert.deepStrictEqual(resume(h), [[FRANCK, []]]);
  assert.deepStrictEqual(attente(h).map(l => [l[3], l[4]]), [[ARCHI, ''], [SEB, '']]);
});

console.log('Lot 5b — la note de réunion du lot 8 en mode « cache »');
test('note à 10 destinataires de la liste (le plafond de la page) + le conducteur : 1 mail, 11 copies cachées, le PDF joint une seule fois', () => {
  const g = environnement({ mode: 'cache' });
  const r = envoyer(g, note(connus(10)));
  assert.deepStrictEqual(resume(g), [['', connus(10).concat([SEB])]]);
  const m = fiches(g)[0];
  assert.deepStrictEqual([m.sujet, m.opts.attachments.length, !!m.opts.htmlBody], ['[Loué App] Note de réunion — CHANTIER TEST 1 — Réunion de chantier', 1, true]);
  assert.ok(m.opts.attachments[0].contenu.indexOf('Pose des châssis du R+1') > -1, 'le PDF de la note');
  assert.strictEqual(g.pdfFabriques, 1);
  assert.deepStrictEqual([r.code, r.data.envoyes, r.data.reportes, g.etat.quota], ['ENREGISTRE', 11, 0, 89]);
  assert.strictEqual(r.message, 'Fiche enregistrée. Envoyé à 11 destinataire(s).');
  assert.strictEqual(g.feuilles['Comptes rendus'].lignes.length, 2, 'la note est notée dans l’onglet « Comptes rendus », comme avant');
});
test('note déjà en attente dans un téléphone avec plus de 10 adresses connues (ancienne page) : toutes servies, dans un seul mail', () => {
  const g = environnement({ mode: 'cache' });
  const r = envoyer(g, note(connus(14)));
  assert.deepStrictEqual(resume(g), [['', connus(14).concat([SEB])]]);
  assert.strictEqual(r.data.envoyes, 15);
});
test('le conducteur déjà choisi dans la page : compté une fois (la page annonce « 3 destinataires »)', () => {
  const g = environnement({ mode: 'cache' });
  const r = envoyer(g, note([ARCHI, SEB, 'c1@connu.test']));
  assert.deepStrictEqual(resume(g), [['', [ARCHI, SEB, 'c1@connu.test']]]);
  assert.strictEqual(r.data.envoyes, 3);
});

console.log('Lot 5b — la protection du lot 0 et la livraison');
// Le texte d'une fonction du serveur (de « function nom( » à la ligne « } » qui la ferme)
const fonction = (code, nom) => { const d = code.indexOf('\nfunction ' + nom + '('); const f = code.indexOf('\n}\n', d); return d < 0 || f < 0 ? null : code.slice(d, f + 3); };
test('envoyer_, differer_ et la boucle des adresses tapées à la main : texte identique à celui du serveur d’avant (lot 8)', () => {
  const avant = spawnSync('git', ['show', '01e9956:apps-script/Securite.gs'], { cwd: RACINE, encoding: 'utf8' });
  if (avant.status !== 0 || !avant.stdout) { console.log('    (historique Git absent : comparaison sautée)'); return; }
  const norm = t => String(t).replace(/\r\n/g, '\n');
  const ancien = norm(avant.stdout), nouveau = norm(fs.readFileSync(path.join(RACINE, 'apps-script', 'Securite.gs'), 'utf8'));
  ['envoyer_', 'differer_', 'reserverLibre_', 'journal_', 'noter_'].forEach(f => {
    assert.ok(fonction(ancien, f), f);
    assert.strictEqual(fonction(nouveau, f), fonction(ancien, f), f + ' a changé');
  });
  const boucle = t => { const d = t.indexOf('  libres.forEach((email, i) => {'); return d < 0 ? null : t.slice(d, t.indexOf('\n}\n', d)); };
  assert.ok(boucle(ancien));
  assert.strictEqual(boucle(nouveau), boucle(ancien), 'la boucle des adresses tapées à la main a changé');
  // … et la ligne d'aujourd'hui pour les adresses connues est toujours là, mot pour mot : c'est elle qui sert en repli
  const ligne = "servies.forEach(email => envoyer_(o, email, { sujet: o.sujet, texte: o.texte, html: o.html || '', bcc: '' }, 'connue'));";
  assert.ok(ancien.indexOf(ligne) > -1 && nouveau.indexOf(ligne) > -1);
  // renvoyerMailsEnAttente (Admin.gs) : inchangée elle aussi
  const adminAvant = spawnSync('git', ['show', '01e9956:apps-script/Admin.gs'], { cwd: RACINE, encoding: 'utf8' });
  assert.strictEqual(fonction(norm(fs.readFileSync(path.join(RACINE, 'apps-script', 'Admin.gs'), 'utf8')), 'renvoyerMailsEnAttente'), fonction(norm(adminAvant.stdout), 'renvoyerMailsEnAttente'));
});
test('essai E1 (essaiMailUnique) : refusé hors de la copie TEST ; sur la copie TEST, un mail sans « À » aux seules adresses de la propriété ESSAI_MAIL_UNIQUE', () => {
  const prod = environnement();
  prod.proprietes.ESSAI_MAIL_UNIQUE = 'a@moi.test, b@moi.test';
  assert.ok(/seulement sur la copie TEST/.test(prod.ctx.essaiMailUnique()));
  assert.strictEqual(prod.mails.length, 0);
  const t = o => { const g = environnement({ options: { nomSheet: 'ChantierPro TEST' } }); g.proprietes.ENVIRONNEMENT = 'TEST'; Object.assign(g.proprietes, o || {}); return g; };
  const sans = t();
  assert.ok(/ESSAI_MAIL_UNIQUE/.test(sans.ctx.essaiMailUnique()) && sans.mails.length === 0, 'sans adresses : rien ne part');
  const une = t({ ESSAI_MAIL_UNIQUE: 'a@moi.test' });
  assert.ok(/2 à 5 adresses/.test(une.ctx.essaiMailUnique()) && une.mails.length === 0);
  const g = t({ ESSAI_MAIL_UNIQUE: 'a@moi.test, b@moi.test' });
  const texte = g.ctx.essaiMailUnique();
  assert.deepStrictEqual(g.mails.map(m => [m.to, m.opts.bcc, m.opts.attachments.length]), [['', 'a@moi.test, b@moi.test', 1]]);
  assert.ok(/E1 : ✅/.test(texte) && /E4 : ✅ .*100 avant, 98 après.*2 destinataire/.test(texte), texte);
  const refus = t({ ESSAI_MAIL_UNIQUE: 'a@moi.test, b@moi.test' });
  refus.etat.avantMail = to => { if (!to) throw new Error('Failed to send email: no recipient'); };
  assert.ok(/E1 : ❌ .*no recipient.*laisser MAIL_UNIQUE à « non »/.test(refus.ctx.essaiMailUnique()));
});
test('livraison : le serveur à coller contient le lot 5b, en version v11.2, éteint par défaut', () => {
  const code = fs.readFileSync(path.join(RACINE, 'A-COLLER-DANS-APPS-SCRIPT', 'Code.gs'), 'utf8');
  ["const VERSION_API = 'v11.2'", 'function envoyerGroupe_(', 'function modeMailUnique_(', 'const MAX_GROUPE_MAIL = 40;', "propriete_('MAIL_UNIQUE')", 'function essaiMailUnique('].forEach(t => assert.ok(code.indexOf(t) > -1, t));
  assert.ok(!/MAIL_UNIQUE\s*=\s*(true|'cache'|'conducteur')/.test(code), 'aucune valeur allumée écrite dans le code');
  const config = fs.readFileSync(path.join(RACINE, 'commun', 'config.js'), 'utf8');
  assert.ok(/VERSION_APPLI = '10\.3'/.test(config));
});

console.log('\n' + reussis + ' test(s) réussi(s)' + (process.exitCode ? ' — DES TESTS ONT ÉCHOUÉ' : ''));
