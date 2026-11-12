// Tests du lot 7, côté serveur (signalements) : node tests/lot7-signalement.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { creerGoogle, chargerScript } = require('./gas-harness');

const FRANCK = 'franck@loue.test', SEB = 'seb@loue.test', ATELIER = 'atelier@loue.test', ATELIER2 = 'atelier2@loue.test';
const PHOTO = '/9j/4AAQSkZJRg==';

function environnement(options = {}) {
  const g = creerGoogle(Object.assign({
    nomSheet: options.test ? 'ChantierPro TEST' : 'ChantierPro',
    proprietes: Object.assign({ DRIVE_ROOT_ID: 'RACINE', DRIVE_PLANNING_ID: 'PLANNING', HACHAGE_ITERATIONS: '200' }, options.test ? { ENVIRONNEMENT: 'TEST' } : {}),
    feuilles: {
      'Contacts': [['Nom', 'Role', 'Email', 'ChefEquipe', 'Destinataire', 'ConducteurDefaut', 'ChefAtelier', 'absenceNotif'],
        ['Franck PAVAGEAU', 'Conducteur de travaux', FRANCK, 'O', 'N', 'O', 'N', 'O'],
        ['Sébastien', 'Conducteur de travaux', SEB, 'O', 'N', 'N', 'N', 'N'],
        ['Thomas', 'Poseur', 'thomas@loue.test', 'N', 'N', 'N', 'N', 'N']]
        .concat(options.sansChef ? [] : [['Marc', "Chef d'atelier", ATELIER + ', ' + ATELIER2, 'N', 'N', 'N', 'O', 'N'],
          ['Paul', "Chef d'atelier adjoint", 'ATELIER@loue.test', 'N', 'N', 'N', 'o', 'N']]),   // même adresse, autre casse : pas de doublon
      'Contacts notes': [['Nom', 'Email']],
      'Chantiers': [['Nom', 'Référence', 'Statut', 'Conducteur'],
        ['CHANTIER TEST 1', 'LIEU 1', 'En cours', 'Sébastien'],
        ['CHANTIER TEST 2', 'LIEU 2', 'En cours', 'Franck PAVAGEAU'],
        ['CHANTIER SANS CONDUCTEUR', 'LIEU 3', 'En cours', '']],
    },
  }, options.google || {}));
  g.creerElement('dossier', 'Loué Menuiserie - Chantiers', null, { id: 'RACINE' });
  g.creerElement('dossier', 'Planning', null, { id: 'PLANNING' });
  g.ctx = chargerScript(g);
  g.ctx.genererCle(); g.ctx.preparerOngletsLot2();
  const u = g.feuilles['Utilisateurs'];
  u.lignes[1] = ['thomas27', 'Thomas', 'Poseur', true, false, '', '', false, false, ''];
  u.lignes[2] = ['seb', 'Sébastien', 'Conducteur', true, false, '', '', false, false, ''];
  u.lignes[3] = ['franck', 'Franck PAVAGEAU', 'Admin', true, false, '', '', false, false, ''];
  u.lignes[4] = ['atelier1', 'Marc', 'Atelier', true, false, '', '', false, false, ''];
  u.lignes[5] = ['kevin', 'Kévin', 'Poseur', true, false, '', '', false, false, ''];
  if (!options.sansInstallation) (options.test ? g.ctx.installerLot7Test : g.ctx.installerLot7Production)();
  return g;
}
const poster = (g, corps) => JSON.parse(g.ctx.doPost({ postData: { contents: JSON.stringify(corps) } }).contenu);
const jeton = (g, id) => g.ctx.fabriquerJeton_(id, 1);
const S = g => (g.feuilles['Signalements'] ? g.feuilles['Signalements'].lignes.slice(1).filter(l => l[0]) : []);
const E = g => (g.feuilles['Envois'] ? g.feuilles['Envois'].lignes.slice(1) : []);
const destinataires = g => g.mails.map(m => m.to).sort();
const estDate = v => Object.prototype.toString.call(v) === '[object Date]';   // les dates viennent d'un autre « monde » JavaScript
let numero = 0;
const idFiche = () => 'fiche-lot7-' + String(++numero).padStart(6, '0');
const sig = extra => Object.assign({ type: 'signalement', chantier: 'CHANTIER TEST 1', date: '12/11/2026', heure: '14h05',
  type_signalement: 'Casse', urgence: 'Bloquant', repere: 'Porte P12, 2e étage', commentaire: 'Vitrage fêlé à la livraison',
  atelier: false, photosBase64: [] }, extra || {});
const envoyer = (g, qui, donnees, id) => poster(g, Object.assign({ action: 'fiche', id: id || idFiche(), donnees: donnees || sig() }, qui ? { jeton: jeton(g, qui) } : {}));
const lire = (g, qui, extra) => poster(g, Object.assign({ action: 'signalements', jeton: jeton(g, qui) }, extra || {}));
const C = { id: 0, recu: 1, chantier: 2, auteurId: 3, auteur: 4, type: 5, urgence: 6, repere: 7, commentaire: 8, photos: 9, atelier: 10, remarque: 11, statut: 12, modifLe: 13, modifPar: 14, mail: 15, saisi: 16 };

let reussis = 0;
function test(nom, fn) {
  try { fn(); reussis++; console.log('  ✓ ' + nom); }
  catch (e) { console.log('  ✗ ' + nom + '\n    ' + String(e.stack || e.message).split('\n').slice(0, 5).join('\n    ')); process.exitCode = 1; }
}

console.log('Lot 7 — recevoir un signalement');
test('un signalement : une ligne dans Signalements, un mail au conducteur du chantier, un PDF, Envois « traité »', () => {
  const g = environnement(), id = idFiche();
  const r = envoyer(g, 'thomas27', sig(), id);
  assert.deepStrictEqual([r.ok, r.code, r.data.envoyes, r.data.reportes], [true, 'ENREGISTRE', 1, 0], JSON.stringify(r));
  const l = S(g);
  assert.strictEqual(l.length, 1);
  assert.deepStrictEqual([l[0][C.id], l[0][C.chantier], l[0][C.auteurId], l[0][C.auteur], l[0][C.type], l[0][C.urgence], l[0][C.repere], l[0][C.commentaire],
    l[0][C.photos], l[0][C.atelier], l[0][C.remarque], l[0][C.statut], l[0][C.mail], l[0][C.saisi]],
    [id, 'CHANTIER TEST 1', 'thomas27', 'Thomas', 'Casse', 'Bloquant', 'Porte P12, 2e étage', 'Vitrage fêlé à la livraison', 0, 'Non', '', 'À traiter', 'envoyé', '12/11/2026 14h05']);
  assert.ok(estDate(l[0][C.recu]));
  assert.deepStrictEqual(destinataires(g), [SEB], 'le conducteur du chantier, et lui seul');
  const m = g.mails[0];
  assert.strictEqual(m.sujet, '[Loué App] Signalement — Casse — CHANTIER TEST 1');
  ['Signalement — Casse — Bloquant', 'Chantier : CHANTIER TEST 1', 'Repère : Porte P12, 2e étage', 'Commentaire : Vitrage fêlé à la livraison',
    'Signalé par : Thomas, le 12/11/2026 à 14h05', 'Photos : aucune', 'Atelier prévenu : non'].forEach(t => assert.ok(m.texte.indexOf(t) > -1, t + '\n' + m.texte));
  const pdf = m.opts.attachments[0];
  assert.ok(/SIGNALEMENT/.test(pdf.contenu) && /Casse/.test(pdf.contenu) && /Bloquant/.test(pdf.contenu) && /Porte P12/.test(pdf.contenu) && /Thomas/.test(pdf.contenu));
  assert.ok(/^Signalement_Casse_CHANTIER TEST 1_12-11-2026\.pdf$/.test(pdf.nom || pdf.getName()), pdf.nom);
  const e = E(g).find(x => x[0] === id);
  assert.deepStrictEqual([e[2], e[3], e[4], e[6]], ['signalement', 'CHANTIER TEST 1', 'traité', 'thomas27']);
});
test('« Bloquant » ne déclenche rien de plus : mêmes destinataires, sujet sans marque (D7-1)', () => {
  const g = environnement();
  envoyer(g, 'thomas27', sig({ urgence: 'Bloquant', chantier: 'CHANTIER TEST 1' }));
  envoyer(g, 'thomas27', sig({ urgence: 'Pas urgent', chantier: 'CHANTIER TEST 1' }));
  assert.deepStrictEqual(destinataires(g), [SEB, SEB]);
  assert.strictEqual(g.mails[0].sujet, g.mails[1].sujet);
});
test('« Prévenir l’atelier » : tous les chefs d’atelier du Sheet en plus, sans doublon ; non coché : aucun', () => {
  const g = environnement();
  const r = envoyer(g, 'thomas27', sig({ atelier: true }));
  assert.strictEqual(r.data.envoyes, 3, JSON.stringify(r));
  assert.deepStrictEqual(destinataires(g), [ATELIER, ATELIER2, SEB].sort());
  assert.deepStrictEqual([S(g)[0][C.atelier], S(g)[0][C.remarque]], ['Oui', '']);
  assert.ok(g.mails.every(m => /Atelier prévenu : oui/.test(m.texte)));
  const g2 = environnement();
  envoyer(g2, 'thomas27', sig({ atelier: false }));
  assert.deepStrictEqual(destinataires(g2), [SEB]);
});
test('case cochée mais aucun chef d’atelier dans Contacts : le mail part au conducteur, la remarque le dit', () => {
  const g = environnement({ sansChef: true });
  const r = envoyer(g, 'thomas27', sig({ atelier: true }));
  assert.ok(r.ok && r.data.envoyes === 1);
  assert.deepStrictEqual(destinataires(g), [SEB]);
  assert.ok(/aucun chef d’atelier/.test(S(g)[0][C.remarque]) && S(g)[0][C.atelier] === 'Oui');
});
test('chantier sans conducteur connu : le mail part à Franck', () => {
  const g = environnement();
  envoyer(g, 'thomas27', sig({ chantier: 'CHANTIER SANS CONDUCTEUR' }));
  assert.deepStrictEqual(destinataires(g), [FRANCK]);
});
test('sans photo, sans repère, avec un seul commentaire : accepté ; photo jamais obligatoire (D7-1)', () => {
  const g = environnement();
  assert.ok(envoyer(g, 'thomas27', sig({ repere: '', commentaire: 'Il manque 3 poignées', type_signalement: 'Manquant', urgence: 'Cette semaine' })).ok);
  assert.ok(envoyer(g, 'thomas27', sig({ repere: 'P3', commentaire: '', type_signalement: 'À recommander', urgence: 'Pas urgent' })).ok);
  assert.strictEqual(S(g).length, 2);
});
test('avec 2 photos : elles sont dans le PDF, la ligne dit 2', () => {
  const g = environnement(), id = idFiche();
  ['photo-lot7-aaaa0001', 'photo-lot7-aaaa0002'].forEach(p =>
    assert.ok(poster(g, { action: 'photo', id: p, fiche: id, mime: 'image/jpeg', data: PHOTO, jeton: jeton(g, 'thomas27') }).ok));
  const r = envoyer(g, 'thomas27', sig({ photosBase64: [{ photoRef: 'photo-lot7-aaaa0001', label: '' }, { photoRef: 'photo-lot7-aaaa0002', label: 'vue large' }] }), id);
  assert.ok(r.ok, JSON.stringify(r));
  assert.strictEqual(S(g)[0][C.photos], 2);
  const html = g.mails[0].opts.attachments[0].contenu;
  assert.strictEqual((html.match(/<img /g) || []).length, 2);
  assert.ok(/data-mep=/.test(html) && /vue large/.test(html));
  assert.ok(/Photos : 2 \(dans le PDF joint\)/.test(g.mails[0].texte));
});

console.log('Lot 7 — jamais deux fois, jamais perdu');
test('le même numéro renvoyé : « déjà reçu », une seule ligne, un seul mail', () => {
  const g = environnement(), id = idFiche();
  assert.strictEqual(envoyer(g, 'thomas27', sig(), id).code, 'ENREGISTRE');
  assert.strictEqual(envoyer(g, 'thomas27', sig(), id).code, 'DEJA_RECU');
  assert.deepStrictEqual([S(g).length, g.mails.length], [1, 1]);
});
test('panne du PDF après l’écriture de la ligne : le signalement est gardé ; le nouvel essai ne l’écrit pas deux fois', () => {
  const g = environnement(), id = idFiche();
  const vrai = g.ctx.pdfDuModele_;
  g.ctx.pdfDuModele_ = () => { throw new Error('conversion PDF en panne'); };
  const r1 = envoyer(g, 'thomas27', sig(), id);
  assert.deepStrictEqual([r1.ok, r1.code], [false, 'ERREUR']);
  assert.deepStrictEqual([S(g).length, S(g)[0][C.mail], S(g)[0][C.statut]], [1, 'en cours', 'À traiter'], 'la ligne existe déjà : rien d’oublié');
  assert.strictEqual(g.mails.filter(m => /Signalement/.test(m.sujet)).length, 0);
  g.ctx.pdfDuModele_ = vrai;
  const r2 = envoyer(g, 'thomas27', sig(), id);
  assert.ok(r2.ok && r2.code === 'ENREGISTRE', JSON.stringify(r2));
  assert.deepStrictEqual([S(g).length, S(g)[0][C.mail]], [1, 'envoyé']);
  assert.strictEqual(g.mails.filter(m => /Signalement/.test(m.sujet)).length, 1);
});
test('quota de mails presque atteint : signalement enregistré, mail « reporté », et le suivi le montre', () => {
  const g = environnement({ google: { quota: 5 } });
  const r = envoyer(g, 'thomas27', sig());
  assert.deepStrictEqual([r.ok, r.data.envoyes, r.data.reportes], [true, 0, 1], JSON.stringify(r));
  assert.strictEqual(S(g)[0][C.mail], 'reporté');
  assert.strictEqual(lire(g, 'seb').data.signalements[0].mailReporte, true);
});

console.log('Lot 7 — refus');
test('données invalides : refus DÉFINITIF avant tout (ni ligne dans Envois, ni dans Signalements, ni mail, ni alerte)', () => {
  const g = environnement();
  [{ type_signalement: 'Vol' }, { type_signalement: undefined }, { urgence: 'Urgent' }, { urgence: '' }, { chantier: '   ' }, { chantier: 'x'.repeat(151) },
    { repere: 'r'.repeat(121) }, { commentaire: 'c'.repeat(2001) }, { repere: '', commentaire: '  ', photosBase64: [] }, { repere: 12 }, { commentaire: { a: 1 } },
    { atelier: 'oui' }, { photosBase64: 'x' }, { photosBase64: [1, 2, 3, 4].map(n => ({ photoRef: 'photo-lot7-bbbb000' + n })) },
    // relecture : date et heure au bon format, photos = références seulement, légendes bornées, pas de caractères de contrôle
    { date: 'x'.repeat(50000) }, { date: { a: 1 } }, { date: '12-11-2026' }, { date: undefined }, { heure: '14:05' }, { heure: 'h'.repeat(50000) }, { heure: 1405 },
    { repere: '', commentaire: '', photosBase64: ['abc', null, 42] }, { photosBase64: [null] }, { photosBase64: [['photo-lot7-cccc0001']] },
    { photosBase64: [{ data: '/9j/4AAQSkZJRg==', mimeType: 'image/jpeg' }] }, { photosBase64: [{ photoRef: 'photo-lot7-cccc0001', data: '/9j/4AAQSkZJRg==' }] },
    { photosBase64: [{ photoRef: '../x' }] }, { photosBase64: [{ photoRef: 'photo-lot7-cccc0001', label: 'l'.repeat(81) }] }, { photosBase64: [{ photoRef: 'photo-lot7-cccc0001', label: 7 }] },
    { chantier: 'CHANTIER TEST 1\nBcc: x@y.fr' }, { chantier: 'CHANTIER\tTEST' }, { repere: 'P12\r\nSubject: x' }, { commentaire: 'a\u0000b' },
    { chantier: 'CHANTIER\u0085TEST' }, { repere: 'P12\u2028Bcc: x' }, { repere: 'P12\u2029x' }, { commentaire: 'a\u2028b' }].forEach(extra => {
    const r = envoyer(g, 'thomas27', sig(extra));
    assert.deepStrictEqual([r.ok, r.code], [false, 'DONNEES_INVALIDES'], JSON.stringify(extra) + ' → ' + JSON.stringify(r));
  });
  assert.deepStrictEqual([S(g).length, E(g).length, g.mails.length], [0, 0, 0]);
});
test('un commentaire sur plusieurs lignes est accepté ; un repère « 1/2 » ou « 0123 » reste un texte', () => {
  const g = environnement();
  assert.ok(envoyer(g, 'thomas27', sig({ repere: '1/2', commentaire: 'ligne 1\nligne 2\n\tretrait' })).ok);
  assert.ok(envoyer(g, 'thomas27', sig({ repere: '0123' })).ok);
  assert.deepStrictEqual(S(g).map(l => l[C.repere]), ['1/2', '0123']);
  assert.ok(/ligne 1\nligne 2/.test(g.mails[0].texte));
});
test('après une coupure, si le mail est déjà parti, le nouvel essai ne refait ni PDF ni mail', () => {
  const g = environnement(), id = idFiche();
  assert.ok(envoyer(g, 'thomas27', sig(), id).ok);
  // comme après une exécution tuée par Google : l'onglet Envois est resté « en cours » depuis plus de 7 minutes
  const e = E(g).find(x => x[0] === id); e[4] = 'en cours'; e[1] = new Date(Date.now() - 10 * 60 * 1000);
  let pdf = 0; const vrai = g.ctx.pdfDuModele_; g.ctx.pdfDuModele_ = function () { pdf++; return vrai.apply(null, arguments); };
  const r = envoyer(g, 'thomas27', sig(), id);
  assert.ok(r.ok, JSON.stringify(r));
  assert.deepStrictEqual([S(g).length, g.mails.length, pdf, S(g)[0][C.mail]], [1, 1, 0, 'envoyé'], 'ni 2e ligne, ni 2e mail, ni 2e PDF');
});
test('l’auteur vient du jeton, jamais des données du téléphone', () => {
  const g = environnement();
  envoyer(g, 'thomas27', sig({ auteurId: 'franck', auteur: 'Franck PAVAGEAU', auteurNom: 'Franck', statut: 'Clos', mail: 'envoyé' }));
  assert.deepStrictEqual([S(g)[0][C.auteurId], S(g)[0][C.auteur], S(g)[0][C.statut]], ['thomas27', 'Thomas', 'À traiter']);
});
test('sans compte, pendant la transition : accepté, auteur « sans compte », visible des conducteurs mais d’aucun poseur', () => {
  const g = environnement();
  const r = envoyer(g, null, sig());
  assert.ok(r.ok, JSON.stringify(r));
  assert.deepStrictEqual([S(g)[0][C.auteurId], S(g)[0][C.auteur]], ['', 'sans compte']);
  assert.strictEqual(lire(g, 'thomas27').data.signalements.length, 0);
  assert.strictEqual(lire(g, 'seb').data.signalements.length, 1);
});
test('ancien format (page d’avant le lot 1, sans numéro de fiche) : refusé, rien n’est écrit', () => {
  const g = environnement();
  const rep = JSON.parse(g.ctx.doPost({ postData: { contents: JSON.stringify(sig()) } }).contenu);
  assert.strictEqual(rep.status, 'error');
  assert.deepStrictEqual([S(g).length, g.mails.filter(m => /Signalement/.test(m.sujet)).length], [0, 0]);
});
test('texte hostile : neutralisé dans le Sheet, échappé dans le PDF', () => {
  const g = environnement();
  envoyer(g, 'thomas27', sig({ repere: '=HYPERLINK("http://x.test";"clic")', commentaire: '<script>alert(1)</script> & <img src=x onerror=alert(2)>' }));
  assert.ok(!/^=/.test(String(S(g)[0][C.repere])), 'pas de formule dans la cellule : ' + S(g)[0][C.repere]);
  const html = g.mails[0].opts.attachments[0].contenu;
  assert.ok(html.indexOf('<script>alert(1)') < 0 && html.indexOf('<img src=x') < 0 && /&lt;script&gt;/.test(html));
});

console.log('Lot 7 — suivi : qui voit quoi');
function monde() {
  const g = environnement();
  envoyer(g, 'thomas27', sig({ repere: 'A', chantier: 'CHANTIER TEST 1' }));
  envoyer(g, 'kevin', sig({ repere: 'B', chantier: 'CHANTIER TEST 2', atelier: true }));
  envoyer(g, 'thomas27', sig({ repere: 'C', chantier: 'CHANTIER TEST 2' }));
  envoyer(g, 'seb', sig({ repere: 'D', chantier: 'CHANTIER TEST 1' }));
  return g;
}
const reperes = r => r.data.signalements.map(s => s.repere).join('');
test('poseur : les siens seulement ; conducteur, admin, atelier : tous ; les plus récents d’abord', () => {
  const g = monde();
  const t = lire(g, 'thomas27');
  assert.deepStrictEqual([reperes(t), t.data.peutChanger], ['CA', false]);
  assert.ok(t.data.signalements.every(s => s.mien === true));
  assert.strictEqual(reperes(lire(g, 'kevin')), 'B');
  ['seb', 'franck', 'atelier1'].forEach(id => { const r = lire(g, id); assert.deepStrictEqual([reperes(r), r.data.peutChanger], ['DCBA', true], id); });
  const s = lire(g, 'seb').data.signalements;
  assert.deepStrictEqual(s.map(x => x.mien), [true, false, false, false]);
  assert.deepStrictEqual(s.map(x => x.atelier), [false, false, true, false]);
  assert.deepStrictEqual(Object.keys(s[0]).sort(), ['atelier', 'auteur', 'chantier', 'commentaire', 'id', 'mailReporte', 'mien', 'modifLe', 'modifPar', 'photos', 'recu', 'repere', 'saisi', 'statut', 'type', 'urgence'].sort(),
    'aucun champ de trop (ni identifiant de l’auteur, ni adresse)');
});
test('filtre par chantier : après le filtre par rôle (un poseur n’apprend rien des chantiers des autres)', () => {
  const g = monde();
  assert.strictEqual(reperes(lire(g, 'seb', { chantier: 'chantier test 2 ' })), 'CB');
  assert.strictEqual(reperes(lire(g, 'thomas27', { chantier: 'CHANTIER TEST 2' })), 'C');
  assert.strictEqual(reperes(lire(g, 'kevin', { chantier: 'CHANTIER TEST 1' })), '');
  assert.strictEqual(reperes(lire(g, 'seb', { chantier: 12 })), 'DCBA', 'un filtre qui n’est pas du texte est ignoré');
  const r = lire(g, 'kevin', { chantier: 'CHANTIER TEST 1' });
  assert.ok(!('total' in r.data) && r.message === '0 signalement(s)');
});
test('sans compte : connexion demandée ; jeton faux après la transition : refusé', () => {
  const g = monde();
  assert.strictEqual(poster(g, { action: 'signalements' }).code, 'CONNEXION_REQUISE');
  assert.strictEqual(poster(g, { action: 'signalementStatut', id: S(g)[0][C.id], statut: 'Clos' }).code, 'CONNEXION_REQUISE');
  g.proprietes.FIN_TRANSITION = String(Date.now() - 1000);
  assert.strictEqual(poster(g, { action: 'signalements', jeton: 'thomas27.p.1.9999999999999.' + 'x'.repeat(30) }).code, 'JETON_INVALIDE');
  assert.strictEqual(S(g)[0][C.statut], 'À traiter');
});
test('au plus 100 signalements rendus, les plus récents ; « Clos » masqués sauf si on demande tout', () => {
  const g = environnement();
  const sh = g.feuilles['Signalements'];
  for (let i = 1; i <= 130; i++) sh.lignes.push(['fiche-vieux-' + String(i).padStart(6, '0'), new Date(2026, 0, 1), 'CHANTIER TEST 1', 'thomas27', 'Thomas', 'Casse', 'Pas urgent',
    'R' + i, '', 0, 'Non', '', i % 10 === 0 ? 'Clos' : 'À traiter', '', '', 'envoyé', '']);
  const r = lire(g, 'seb');
  assert.deepStrictEqual([r.data.signalements.length, r.data.plein, r.data.signalements[0].repere], [100, true, 'R129']);
  assert.ok(r.data.signalements.every(s => s.statut !== 'Clos'));
  assert.strictEqual(lire(g, 'seb', { tout: true }).data.signalements[0].repere, 'R130');
  assert.strictEqual(lire(g, 'seb', { tout: 'oui' }).data.signalements[0].repere, 'R129', '« tout » doit être vrai, pas un texte');
});

console.log('Lot 7 — suivi : changer le statut');
const changer = (g, qui, id, statut) => poster(g, { action: 'signalementStatut', id: id, statut: statut, jeton: jeton(g, qui) });
test('conducteur, admin et atelier changent le statut ; la ligne note quand et par qui', () => {
  const g = monde(), id = S(g)[0][C.id];
  const r = changer(g, 'seb', id, 'Commandé');
  assert.deepStrictEqual([r.ok, r.data.statut, r.data.modifPar], [true, 'Commandé', 'Sébastien'], JSON.stringify(r));
  const l = S(g).find(x => x[C.id] === id);
  assert.ok(l[C.statut] === 'Commandé' && estDate(l[C.modifLe]) && l[C.modifPar] === 'Sébastien');
  assert.ok(changer(g, 'atelier1', id, 'Livré').ok);
  assert.ok(changer(g, 'franck', id, 'Clos').ok);
  assert.strictEqual(S(g).find(x => x[C.id] === id)[C.statut], 'Clos');
  assert.strictEqual(S(g).filter(x => x[C.id] !== id).every(x => x[C.statut] === 'À traiter'), true, 'les autres lignes ne bougent pas');
  assert.strictEqual(g.mails.filter(m => !/Signalement — /.test(m.sujet)).length, 0, 'aucun mail au changement de statut');
});
test('poseur (même auteur) : refusé ; numéro inconnu : MÊME réponse (on n’apprend pas qu’un numéro existe)', () => {
  const g = monde(), id = S(g)[0][C.id];
  const a = changer(g, 'thomas27', id, 'Clos'), b = changer(g, 'thomas27', 'fiche-inconnue-000001', 'Clos'), c = changer(g, 'seb', 'fiche-inconnue-000001', 'Clos'),
    d = changer(g, 'seb', '../../x', 'Clos');
  [a, b, c, d].forEach(r => assert.deepStrictEqual([r.ok, r.code, r.message], [false, 'INTERDIT', a.message], JSON.stringify(r)));
  assert.strictEqual(S(g)[0][C.statut], 'À traiter');
});
test('statut hors liste : refusé ; un statut tapé à la main dans le Sheet et inconnu est lu « À traiter »', () => {
  const g = monde(), id = S(g)[0][C.id];
  ['Annulé', '', null, 3, ['Clos'], 'clos'].forEach(s => assert.strictEqual(changer(g, 'seb', id, s).code, 'DONNEES_INVALIDES', String(s)));
  assert.strictEqual(changer(g, 'seb', [id], 'Clos').code, 'INTERDIT', 'le numéro doit être un texte');
  S(g)[0][C.statut] = 'en attente fournisseur';
  assert.strictEqual(lire(g, 'seb').data.signalements.find(x => x.id === id).statut, 'À traiter');
});
test('l’onglet trié par Franck entre-temps : le bon signalement est modifié (retrouvé par son numéro)', () => {
  const g = monde(), sh = g.feuilles['Signalements'];
  const id = S(g)[0][C.id];
  const titres = sh.lignes[0], donnees = sh.lignes.slice(1).filter(l => l[0]).reverse();
  sh.lignes = [titres].concat(donnees);
  assert.ok(changer(g, 'seb', id, 'Livré').ok);
  assert.deepStrictEqual(S(g).map(l => [l[C.id] === id, l[C.statut]]).filter(x => x[0]).map(x => x[1]), ['Livré']);
  assert.strictEqual(S(g).filter(l => l[C.statut] !== 'À traiter').length, 1);
});
test('serveur occupé : le changement de statut le dit, rien n’est écrit', () => {
  const g = monde(), id = S(g)[0][C.id];
  g.contexte.LockService.getScriptLock = () => ({ tryLock: () => false, releaseLock: () => {} });
  assert.strictEqual(changer(g, 'seb', id, 'Clos').code, 'SERVEUR_OCCUPE');
  assert.strictEqual(S(g)[0][C.statut], 'À traiter');
});

console.log('Lot 7 — installation et livraison');
test('installerLot7Test : onglet créé avec ses titres et la liste des statuts ; relancée : « déjà fait »', () => {
  const g = environnement({ test: true, sansInstallation: true });
  assert.ok(!g.feuilles['Signalements']);
  const t1 = g.ctx.installerLot7Test();
  assert.ok(/Lot 7 — installation — environnement : TEST/.test(t1) && /✅ 1\/1 Onglet « Signalements ».* : fait/.test(t1) && /✅ Lot 7 : installation terminée/.test(t1), t1);
  assert.strictEqual(g.feuilles['Signalements'].lignes[0].slice(0, 3).join('|'), 'Numéro|Reçu le|Chantier');
  assert.strictEqual(g.feuilles['Signalements'].lignes[0].length, 17);
  const v = g.feuilles['Signalements'].validations[0];
  assert.deepStrictEqual([v.c, Array.from(v.v.liste)], [13, ['À traiter', 'Commandé', 'Livré', 'Clos']]);
  assert.ok(/ℹ 1 chantier\(s\) « En cours » sans conducteur connu/.test(t1) && /ℹ Chef\(s\) d’atelier.* : 2 adresse\(s\)/.test(t1), t1);
  assert.ok(!/CHANTIER SANS CONDUCTEUR|@/.test(t1), 'ni nom de chantier ni adresse dans le bilan');
  const t2 = g.ctx.installerLot7Test();
  assert.ok(/1\/1 Onglet .* : déjà fait/.test(t2), t2);
  assert.strictEqual(g.feuilles['Signalements'].validations.length, 1, 'rien de réécrit');
});
test('mauvais environnement : chaque fonction refuse l’autre ; rien n’est créé', () => {
  const g = environnement({ test: true, sansInstallation: true });
  assert.ok(/Refusé : cette fonction est prévue pour PRODUCTION/.test(g.ctx.installerLot7Production()));
  const p = environnement({ sansInstallation: true });
  assert.ok(/Refusé : cette fonction est prévue pour TEST/.test(p.ctx.installerLot7Test()));
  assert.ok(!g.feuilles['Signalements'] && !p.feuilles['Signalements']);
});
test('un onglet « Signalements » déjà là avec d’autres titres et des données : ❌, rien n’est écrasé', () => {
  const g = environnement({ sansInstallation: true, google: undefined });
  g.ctx.feuille_('Signalements', ['Mes notes', 'Autre']);
  g.feuilles['Signalements'].lignes.push(['important', 'à garder']);
  const t = g.ctx.installerLot7Production();
  assert.ok(/❌ 1\/1 .*existe déjà avec d’autres titres/.test(t) && /⛔ Arrêt/.test(t), t);
  assert.deepStrictEqual(g.feuilles['Signalements'].lignes, [['Mes notes', 'Autre'], ['important', 'à garder']]);
});
test('cache des noms de dossiers rempli par un ANCIEN déploiement encore en service : le PDF n’est jamais rangé dans « Divers »', () => {
  const g = environnement();
  const remettreAncienCache = () => {   // ce que fait l'ancien serveur (lot 2) toutes les 10 minutes
    const ancien = JSON.parse(JSON.stringify(g.ctx.dossiers_()));
    delete ancien.documents.signalement; delete ancien.intitules.signalement; ancien.documents.quitus = 'DOSSIER DE FRANCK';
    g.cache['dossiers.json'] = JSON.stringify(ancien);
  };
  remettreAncienCache();
  assert.strictEqual(g.ctx.dossiers_().documents.signalement, '05 - CHANTIER/SIGNALEMENTS');
  assert.strictEqual(g.ctx.dossiers_().intitules.signalement, 'SIGNALEMENT');
  assert.strictEqual(g.ctx.dossiers_().documents.quitus, 'DOSSIER DE FRANCK', 'les noms choisis par Franck sont gardés');
  let dossierVu = '';
  const vrai = g.ctx.dossierParChemin_;
  g.ctx.dossierParChemin_ = function (parent, chemin) { dossierVu = chemin; return vrai.apply(null, arguments); };
  remettreAncienCache();
  assert.ok(envoyer(g, 'thomas27', sig()).ok);
  assert.strictEqual(dossierVu, '05 - CHANTIER/SIGNALEMENTS');
});
test('onglet créé par un premier signalement AVANT l’installation : l’installation le complète sans rien écraser', () => {
  const g = environnement({ sansInstallation: true });
  assert.ok(envoyer(g, 'thomas27', sig()).ok);
  const avant = JSON.stringify(S(g));
  const t = g.ctx.installerLot7Production();
  assert.ok(/installation terminée/.test(t), t);
  assert.strictEqual(JSON.stringify(S(g)), avant);
  assert.ok(g.feuilles['Signalements'].validations.length >= 1);
});
test('neutralisation des formules : « -1+IMPORTDATA(…) » est neutralisé, un nombre négatif reste un nombre', () => {
  const g = environnement();
  assert.strictEqual(g.ctx.cellule_('-1+IMPORTDATA("http://x.test")'), "'-1+IMPORTDATA(\"http://x.test\")");
  assert.strictEqual(g.ctx.cellule_('-12,5'), '-12,5');
  assert.strictEqual(g.ctx.cellule_('-3'), '-3');
  assert.strictEqual(g.ctx.cellule_('- à voir'), "'- à voir");
  assert.strictEqual(g.ctx.cellule_('=1+1'), "'=1+1");
  assert.strictEqual(g.ctx.cellule_('Porte P12'), 'Porte P12');
  assert.strictEqual(g.ctx.cellule_(-4), -4);
});
test('aucun chef d’atelier : l’installation le dit (information, pas une erreur)', () => {
  const g = environnement({ sansChef: true, sansInstallation: true });
  const t = g.ctx.installerLot7Production();
  assert.ok(/installation terminée/.test(t) && /ℹ Aucun chef d’atelier dans Contacts/.test(t), t);
});
test('sans l’onglet (installation oubliée) : le premier signalement le crée ; verifierConfig signale l’oubli avant', () => {
  const g = environnement({ sansInstallation: true });
  assert.ok(/❌ Onglet « Signalements »/.test(g.ctx.verifierConfig()));
  assert.ok(envoyer(g, 'thomas27', sig()).ok);
  assert.strictEqual(S(g).length, 1);
});
test('livraison : le serveur à coller contient le lot 7, sans les outils d’essai', () => {
  const code = fs.readFileSync(path.join(__dirname, '..', 'A-COLLER-DANS-APPS-SCRIPT', 'Code.gs'), 'utf8');
  ['function traiterSignalement(', 'function installerLot7Test(', 'function installerLot7Production(', 'function modele_signalement(']
    .forEach(t => assert.ok(code.indexOf(t) > -1, t));
  assert.ok(!/function\s+outilTest_\s*\(/.test(code));
});
console.log('\n' + reussis + ' test(s) réussi(s)' + (process.exitCode ? ' — DES TESTS ÉCHOUENT' : ''));
