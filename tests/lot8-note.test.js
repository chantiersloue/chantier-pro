// Tests du lot 8b, côté serveur (numéro du compte rendu, présents) : node tests/lot8-note.test.js
// Le VRAI code d'apps-script/ tourne avec les services Google simulés (tests/gas-harness.js) : rien ne part chez Google.
// Noms, chantiers et adresses : tous fictifs (dépôt public).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { creerGoogle, chargerScript } = require('./gas-harness');

const FRANCK = 'franck@loue.test', SEB = 'seb@loue.test', ARCHI = 'archi@ext.test', LIBRE = 'client@autre.test';

function environnement(options = {}) {
  const g = creerGoogle(Object.assign({
    nomSheet: options.test ? 'ChantierPro TEST' : 'ChantierPro',
    proprietes: Object.assign({ DRIVE_ROOT_ID: 'RACINE', DRIVE_PLANNING_ID: 'PLANNING', HACHAGE_ITERATIONS: '200' }, options.test ? { ENVIRONNEMENT: 'TEST' } : {}),
    feuilles: {
      'Contacts': [['Nom', 'Role', 'Email', 'ChefEquipe', 'Destinataire', 'ConducteurDefaut', 'ChefAtelier', 'absenceNotif'],
        ['Franck ESSAI', 'Conducteur de travaux', FRANCK, 'O', 'N', 'O', 'N', 'O'],
        ['Sébastien ESSAI', 'Conducteur de travaux', SEB, 'O', 'N', 'N', 'N', 'N'],
        ['Thomas ESSAI', 'Poseur', 'thomas@loue.test', 'N', 'N', 'N', 'N', 'N']],
      'Contacts notes': [['Nom', 'Email'], ['Architecte ESSAI', ARCHI]]
        .concat(Array.from({ length: options.contactsEnPlus || 0 }, (_, i) => ['Contact ' + (i + 1), 'contact' + (i + 1) + '@ext.test'])),
      'Chantiers': [['Nom', 'Référence', 'Statut', 'Conducteur'],
        ['CHANTIER TEST 1', 'LIEU 1', 'En cours', 'Sébastien ESSAI'],
        ['CHANTIER TEST 2', 'LIEU 2', 'En cours', 'Franck ESSAI'],
        ['CHANTIER TEST 3', 'LIEU 3', 'En cours', 'Franck ESSAI']],
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
  if (!options.sansInstallation) (options.test ? g.ctx.installerLot8Test : g.ctx.installerLot8Production)();
  return g;
}
const poster = (g, corps) => JSON.parse(g.ctx.doPost({ postData: { contents: JSON.stringify(corps) } }).contenu);
const jeton = (g, id) => g.ctx.fabriquerJeton_(id, 1);
let compteur = 0;
const idFiche = () => 'fiche-lot8-' + String(++compteur).padStart(6, '0');
// Une note au format d'AVANT le lot 8 (ce qu'une ancienne page, ou une fiche déjà en attente dans un téléphone, envoie)
const ancienne = extra => Object.assign({ type: 'note', chantier: 'CHANTIER TEST 1', auteur: 'Franck ESSAI', date: '12/11/2026',
  objet: 'Réunion de chantier', commentaires: 'Pose des châssis du R+1', destinataires: [], photosBase64: [] }, extra || {});
// Une note au format du lot 8b : « remarques » = le texte saisi ; « commentaires » = copie lisible par un ancien serveur
const nouvelle = extra => {
  const d = Object.assign({ remarques: 'Pose des châssis du R+1', presents: ['Alice ESSAI', 'Bruno ESSAI'] }, extra || {});
  return ancienne(Object.assign({ commentaires: 'Présents : ' + (Array.isArray(d.presents) ? d.presents : []).join(', ') + '\n\n' + d.remarques }, d));
};
const envoyer = (g, qui, donnees, id) => poster(g, Object.assign({ action: 'fiche', id: id || idFiche(), donnees: donnees || nouvelle() }, qui ? { jeton: jeton(g, qui) } : {}));
const CR = g => (g.feuilles['Comptes rendus'] ? g.feuilles['Comptes rendus'].lignes.slice(1).filter(l => l[0]) : []);
const E = g => (g.feuilles['Envois'] ? g.feuilles['Envois'].lignes.slice(1) : []);
const C = { fiche: 0, chantier: 1, numChantier: 2, numero: 3, date: 4, objet: 5, auteur: 6, compte: 7, presents: 8, pdf: 9, recu: 10, remarque: 11 };
const numeros = g => CR(g).map(l => l[C.numero]);
const dernierPdf = g => { const m = g.mails[g.mails.length - 1]; return m ? String(m.opts.attachments[0].contenu) : ''; };
const fichiersRanges = g => Object.values(g.elements).filter(e => e.type === 'fichier' && /^COMPTE RENDU /.test(e.nom) && !e.corbeille).map(e => e.nom).sort();
const numeroChantier = (g, nom, n) => { const l = g.feuilles['Chantiers'].lignes.find(x => x[0] === nom); l[4] = n; };

let reussis = 0;
function test(nom, fn) {
  try { fn(); reussis++; console.log('  ✓ ' + nom); }
  catch (e) { console.log('  ✗ ' + nom + '\n    ' + String(e.stack || e.message).split('\n').slice(0, 6).join('\n    ')); process.exitCode = 1; }
}

console.log('Lot 8b — numéro du compte rendu, donné par le serveur à la réception');
test('trois notes du même chantier : n° 1, 2, 3 ; numéro dans la réponse, le PDF, l’objet du mail, le nom du fichier et l’onglet', () => {
  const g = environnement();
  const r = [envoyer(g, 'seb'), envoyer(g, 'seb'), envoyer(g, 'thomas27')];
  assert.deepStrictEqual(r.map(x => [x.ok, x.code, x.data.numeroCR]), [[true, 'ENREGISTRE', 1], [true, 'ENREGISTRE', 2], [true, 'ENREGISTRE', 3]], JSON.stringify(r));
  assert.ok(/^Compte rendu n° 3 enregistré\. /.test(r[2].message), r[2].message);
  assert.deepStrictEqual(numeros(g), [1, 2, 3]);
  assert.ok(/Compte rendu n° 3</.test(dernierPdf(g)), 'numéro dans le PDF');
  assert.ok(g.mails.slice(-1)[0].sujet.indexOf('[Loué App] Note de réunion — CR n° 3 — CHANTIER TEST 1 — Réunion de chantier') === 0, g.mails.slice(-1)[0].sujet);
  assert.deepStrictEqual(fichiersRanges(g), ['COMPTE RENDU CHANTIER TEST 1 CR 1 2026-11-12.pdf', 'COMPTE RENDU CHANTIER TEST 1 CR 2 2026-11-12.pdf', 'COMPTE RENDU CHANTIER TEST 1 CR 3 2026-11-12.pdf']);
  const l = CR(g)[2];
  assert.deepStrictEqual([l[C.chantier], l[C.numChantier], l[C.date], l[C.objet], l[C.auteur], l[C.compte], l[C.presents], l[C.pdf], l[C.remarque]],
    ['CHANTIER TEST 1', '', '12/11/2026', 'Réunion de chantier', 'Franck ESSAI', 'Thomas ESSAI (thomas27)', 'Alice ESSAI ; Bruno ESSAI', 'COMPTE RENDU CHANTIER TEST 1 CR 3 2026-11-12.pdf', '']);
  assert.strictEqual(Object.prototype.toString.call(l[C.recu]), '[object Date]');
  assert.ok(E(g).every(x => String(x[4]) === 'traité'), JSON.stringify(E(g)));
});
test('deux chantiers : chacun sa série', () => {
  const g = environnement();
  const a = envoyer(g, 'seb'), b = envoyer(g, 'seb', nouvelle({ chantier: 'CHANTIER TEST 2' })), c = envoyer(g, 'seb');
  assert.deepStrictEqual([a.data.numeroCR, b.data.numeroCR, c.data.numeroCR], [1, 1, 2]);
});
test('note renvoyée (réponse perdue) : « déjà reçue » AVEC le même numéro, une seule ligne, aucun mail de plus', () => {
  const g = environnement(), id = idFiche();
  const un = envoyer(g, 'seb', nouvelle(), id);
  const mails = g.mails.length;
  const deux = envoyer(g, 'seb', nouvelle(), id);
  assert.deepStrictEqual([deux.ok, deux.code, deux.data.numeroCR, un.data.numeroCR], [true, 'DEJA_RECU', 1, 1], JSON.stringify(deux));
  assert.strictEqual(deux.message, 'Compte rendu n° 1 déjà reçu');
  assert.strictEqual(CR(g).length, 1);
  assert.strictEqual(g.mails.length, mails, 'aucun mail de plus');
  assert.strictEqual(envoyer(g, 'seb').data.numeroCR, 2, 'la note suivante prend bien le n° 2');
});
test('PDF raté au premier essai, puis nouvel essai du téléphone : le numéro réservé est réutilisé (une ligne, pas de trou)', () => {
  const g = environnement(), id = idFiche();
  const vrai = g.contexte.HtmlService.createHtmlOutput;
  g.contexte.HtmlService.createHtmlOutput = () => { throw new Error('conversion PDF en panne'); };
  const rate = envoyer(g, 'seb', nouvelle(), id);
  assert.deepStrictEqual([rate.ok, rate.code], [false, 'ERREUR'], JSON.stringify(rate));
  assert.deepStrictEqual(numeros(g), [1], 'le numéro est pris dès la réservation');
  g.contexte.HtmlService.createHtmlOutput = vrai;
  const bon = envoyer(g, 'seb', nouvelle(), id);
  assert.deepStrictEqual([bon.ok, bon.code, bon.data.numeroCR], [true, 'ENREGISTRE', 1], JSON.stringify(bon));
  assert.deepStrictEqual(numeros(g), [1]);
  assert.ok(/Compte rendu n° 1</.test(dernierPdf(g)));
});
test('deux notes en même temps (la seconde arrive pendant l’envoi des mails de la première) : deux numéros différents, deux lignes', () => {
  const g = environnement();
  const vrai = g.contexte.GmailApp.sendEmail;
  let seconde = null;
  g.contexte.GmailApp.sendEmail = (...a) => {
    if (!seconde) {
      seconde = 'en cours';
      // Chez Google, chaque demande tourne dans sa propre copie du serveur : le bilan des mails (variable RAPPORT_) de la
      // première est donc mis de côté pendant la seconde, puis remis
      vm.runInContext('globalThis.__rapport = RAPPORT_', g.ctx);
      seconde = envoyer(g, 'thomas27', nouvelle({ objet: 'Arrivée pendant la première' }));
      vm.runInContext('RAPPORT_ = globalThis.__rapport', g.ctx);
    }
    return vrai(...a);
  };
  const premiere = envoyer(g, 'seb', nouvelle({ objet: 'Première' }));
  g.contexte.GmailApp.sendEmail = vrai;
  assert.deepStrictEqual([premiere.code, seconde.code], ['ENREGISTRE', 'ENREGISTRE'], JSON.stringify([premiere, seconde]));
  assert.deepStrictEqual([premiere.data.numeroCR, seconde.data.numeroCR], [1, 2]);
  assert.deepStrictEqual(CR(g).map(l => [l[C.numero], l[C.objet]]), [[1, 'Première'], [2, 'Arrivée pendant la première']]);
});
test('serveur occupé dès la réception (verrou de recevoirFiche_) : la note est refusée « occupé », rien n’est écrit, le téléphone réessaiera', () => {
  const g = environnement({ google: { verrouOccupe: true }, sansInstallation: true });
  const r = envoyer(g, 'seb');
  assert.deepStrictEqual([r.ok, r.code], [false, 'SERVEUR_OCCUPE'], JSON.stringify(r));
  assert.strictEqual(CR(g).length, 0);
  assert.strictEqual(g.mails.length, 0);
});

console.log('Lot 8b — à quel chantier la série est rattachée');
test('chantier RENOMMÉ qui a un N° : la série continue (rattachement par le N° du chantier)', () => {
  const g = environnement();
  numeroChantier(g, 'CHANTIER TEST 1', '403');
  assert.strictEqual(envoyer(g, 'seb').data.numeroCR, 1);
  g.feuilles['Chantiers'].lignes.find(x => x[0] === 'CHANTIER TEST 1')[0] = 'RESIDENCE ESSAI';
  const r = envoyer(g, 'seb', nouvelle({ chantier: 'RESIDENCE ESSAI' }));
  assert.strictEqual(r.data.numeroCR, 2, JSON.stringify(r));
  assert.deepStrictEqual(CR(g).map(l => [l[C.chantier], l[C.numChantier], l[C.numero]]), [['CHANTIER TEST 1', '403', 1], ['RESIDENCE ESSAI', '403', 2]]);
});
test('chantier renommé SANS N° : la série repart à 1 (limite connue, dite dans la procédure)', () => {
  const g = environnement();
  envoyer(g, 'seb');
  g.feuilles['Chantiers'].lignes.find(x => x[0] === 'CHANTIER TEST 1')[0] = 'RESIDENCE ESSAI';
  assert.strictEqual(envoyer(g, 'seb', nouvelle({ chantier: 'RESIDENCE ESSAI' })).data.numeroCR, 1);
});
test('N° du chantier rempli APRÈS les premières notes (même nom) : la série continue', () => {
  const g = environnement();
  envoyer(g, 'seb'); envoyer(g, 'seb');
  numeroChantier(g, 'CHANTIER TEST 1', '403');
  assert.strictEqual(envoyer(g, 'seb').data.numeroCR, 3);
});
test('nom du chantier tapé avec une autre casse ou des espaces en trop : même série', () => {
  const g = environnement();
  envoyer(g, 'seb');
  assert.strictEqual(envoyer(g, 'seb', nouvelle({ chantier: '  chantier test 1 ' })).data.numeroCR, 2);
});
test('chantier HORS LISTE : note envoyée et notée, sans numéro ; la réponse le dit ; rien dans le PDF ni dans l’objet', () => {
  const g = environnement();
  const r = envoyer(g, 'seb', nouvelle({ chantier: 'CHANTIER INCONNU' }));
  assert.deepStrictEqual([r.ok, r.code, r.data.numeroCR, r.data.sansNumeroCR], [true, 'ENREGISTRE', undefined, 'chantier'], JSON.stringify(r));
  assert.deepStrictEqual(CR(g).map(l => [l[C.chantier], l[C.numero], l[C.remarque]]), [['CHANTIER INCONNU', '', 'chantier hors liste : pas de numéro']]);
  assert.ok(dernierPdf(g).indexOf('Compte rendu n°') < 0);
  assert.ok(g.mails.every(m => m.sujet.indexOf('CR n°') < 0), g.mails.map(m => m.sujet).join(' | '));
});
test('numéro dans l’ordre d’arrivée : une note datée d’avant la précédente reçoit le numéro suivant, avec une remarque', () => {
  const g = environnement();
  envoyer(g, 'seb', nouvelle({ date: '12/11/2026' }));
  const r = envoyer(g, 'seb', nouvelle({ date: '06/11/2026' }));
  assert.strictEqual(r.data.numeroCR, 2);
  assert.strictEqual(CR(g)[1][C.remarque], 'reçu après le CR n° 1 (daté du 12/11/2026)');
});

console.log('Lot 8b — onglet « Comptes rendus » vérifié avant écriture');
test('titres de l’onglet changés à la main : la note part quand même, SANS numéro (PDF et mails normaux), Franck prévenu une fois par jour ; titres remis : la série reprend', () => {
  const g = environnement();
  envoyer(g, 'seb');
  const mails = g.mails.length, fichiers = fichiersRanges(g).length;
  g.feuilles['Comptes rendus'].lignes[0][3] = 'Numéro';
  const r = envoyer(g, 'seb', nouvelle({ objet: 'Note à ne pas bloquer' }));
  assert.deepStrictEqual([r.ok, r.code, r.data.numeroCR, r.data.sansNumeroCR, r.data.envoyes], [true, 'ENREGISTRE', undefined, 'onglet', 1], JSON.stringify(r));
  assert.strictEqual(CR(g).length, 1, 'aucune ligne écrite dans un onglet aux titres changés');
  assert.strictEqual(fichiersRanges(g).length, fichiers + 1, 'le PDF est rangé');
  const nouveaux = g.mails.slice(mails);
  assert.deepStrictEqual(nouveaux.map(m => [m.to, m.sujet]), [
    [FRANCK, '[Loué App] Notes de réunion sans numéro — titres de l’onglet « Comptes rendus » changés'],
    [SEB, '[Loué App] Note de réunion — CHANTIER TEST 1 — Note à ne pas bloquer']], JSON.stringify(nouveaux.map(m => m.sujet)));
  assert.ok(/lancez installerLot8Production\./.test(nouveaux[0].texte) && /envoyées normalement/.test(nouveaux[0].texte), nouveaux[0].texte);
  assert.ok(dernierPdf(g).indexOf('Compte rendu n°') < 0 && dernierPdf(g).indexOf('Présents (2)') > -1, 'PDF sans numéro, complet');
  assert.ok(E(g).every(x => String(x[4]) === 'traité'), 'onglet Envois : « traité »');
  // Une autre note le même jour : elle part aussi, sans second mail d'alerte
  assert.strictEqual(envoyer(g, 'seb').data.sansNumeroCR, 'onglet');
  assert.strictEqual(g.mails.filter(m => /sans numéro/.test(m.sujet)).length, 1);
  g.feuilles['Comptes rendus'].lignes[0][3] = 'N° du compte rendu';
  assert.strictEqual(envoyer(g, 'seb').data.numeroCR, 2, 'titres remis : la série reprend après le dernier numéro noté');
});
test('sur la copie TEST, le mail d’alerte nomme installerLot8Test', () => {
  const g = environnement({ test: true });
  g.feuilles['Comptes rendus'].lignes[0][0] = 'Autre';
  envoyer(g, 'seb');
  const alerte = g.mails.find(m => /sans numéro/.test(m.sujet));
  assert.ok(alerte && /lancez installerLot8Test\./.test(alerte.texte) && !/installerLot8Production/.test(alerte.texte), alerte && alerte.texte);
});
test('onglet absent (installation pas encore lancée) : créé avec ses titres à la première note', () => {
  const g = environnement({ sansInstallation: true });
  assert.ok(!g.feuilles['Comptes rendus']);
  assert.strictEqual(envoyer(g, 'seb').data.numeroCR, 1);
  assert.deepStrictEqual(Array.from(g.feuilles['Comptes rendus'].lignes[0]), ['Numéro de fiche', 'Chantier', 'N° du chantier', 'N° du compte rendu', 'Date de la réunion', 'Objet',
    'Rédigé par', 'Compte qui a envoyé', 'Présents', 'Nom du PDF', 'Reçu le', 'Remarque de l’appli']);
});
test('réponse « déjà reçue » quand l’onglet a été abîmé depuis : la réponse part quand même, sans numéro', () => {
  const g = environnement(), id = idFiche();
  envoyer(g, 'seb', nouvelle(), id);
  g.feuilles['Comptes rendus'].lignes[0][0] = 'Autre titre';
  const r = envoyer(g, 'seb', nouvelle(), id);
  assert.deepStrictEqual([r.ok, r.code, r.data.numeroCR], [true, 'DEJA_RECU', undefined], JSON.stringify(r));
});
test('texte piégé (formule) dans l’objet, le rédacteur et les présents : écrit comme du texte', () => {
  const g = environnement();
  envoyer(g, 'seb', nouvelle({ objet: '=IMPORTDATA("x")', auteur: '+33 6', presents: ['=1+1', '@x'] }));
  const l = CR(g)[0];
  assert.deepStrictEqual([l[C.objet], l[C.auteur], l[C.presents]], ["'=IMPORTDATA(\"x\")", "'+33 6", "'=1+1 ; @x"]);
});

console.log('Lot 8b — présents saisis à la main');
test('présents : dans le PDF (bloc « Présents (2) ») et dans l’onglet ; le texte saisi n’est imprimé qu’une fois', () => {
  const g = environnement();
  envoyer(g, 'seb');
  const pdf = dernierPdf(g);
  assert.ok(pdf.indexOf('Présents (2)') > -1 && pdf.indexOf('Alice ESSAI, Bruno ESSAI') > -1, 'bloc des présents');
  assert.strictEqual(pdf.split('Pose des châssis du R+1').length - 1, 1, 'le texte saisi une seule fois');
  assert.ok(pdf.indexOf('Présents : Alice ESSAI') < 0, 'la copie pour ancien serveur n’est pas imprimée');
});
test('aucun présent : aucun bloc « Présents » dans le PDF, colonne vide', () => {
  const g = environnement();
  envoyer(g, 'seb', nouvelle({ presents: [] }));
  assert.ok(dernierPdf(g).indexOf('Présents') < 0);
  assert.strictEqual(CR(g)[0][C.presents], '');
});
test('présents mal formés (pas une liste, doublons, vides, texte hostile, trop nombreux) : nettoyés, la note part toujours', () => {
  const g = environnement();
  const SEPARATEUR = String.fromCharCode(0x2028);
  const r1 = envoyer(g, 'seb', nouvelle({ presents: 'Alice ESSAI' }));
  assert.strictEqual(r1.code, 'ENREGISTRE'); assert.strictEqual(CR(g)[0][C.presents], '');
  envoyer(g, 'seb', nouvelle({ presents: ['  Alice ESSAI ', 'alice essai', '', null, 12, '<b>Bruno</b>', 'Ligne' + SEPARATEUR + 'coupée\nen deux'] }));
  assert.strictEqual(CR(g)[1][C.presents], 'Alice ESSAI ; <b>Bruno</b> ; Ligne coupée en deux');
  assert.ok(dernierPdf(g).indexOf('&lt;b&gt;Bruno&lt;/b&gt;') > -1 && dernierPdf(g).indexOf('<b>Bruno</b>') < 0, 'échappé dans le PDF');
  envoyer(g, 'seb', nouvelle({ presents: Array.from({ length: 60 }, (_, i) => 'Présent Essai ' + i + ' ' + 'x'.repeat(100)) }));
  const liste = String(CR(g)[2][C.presents]).split(' ; ');
  assert.strictEqual(liste.length, 40); assert.ok(liste.every(n => n.length <= 80));
});
test('numéro écrit par le téléphone dans ses données : ignoré (seul le serveur numérote)', () => {
  const g = environnement();
  const r = envoyer(g, 'seb', nouvelle({ numeroCR: '999' }));
  assert.strictEqual(r.data.numeroCR, 1);
  assert.ok(dernierPdf(g).indexOf('n° 999') < 0 && /Compte rendu n° 1</.test(dernierPdf(g)));
  const h = envoyer(g, 'seb', nouvelle({ chantier: 'CHANTIER INCONNU', numeroCR: '999' }));
  assert.strictEqual(h.data.numeroCR, undefined);
  assert.ok(dernierPdf(g).indexOf('Compte rendu n°') < 0);
});

console.log('Lot 8b — compatibilité et droits');
test('fiche de l’ANCIEN format (déjà en attente dans un téléphone) : acceptée, numérotée, son texte imprimé tel quel', () => {
  const g = environnement();
  const r = envoyer(g, 'seb', ancienne({ commentaires: 'Texte de l’ancienne page', destinataires: [ARCHI] }));
  assert.deepStrictEqual([r.ok, r.code, r.data.numeroCR, r.data.envoyes], [true, 'ENREGISTRE', 1, 2], JSON.stringify(r));
  const pdf = dernierPdf(g);
  assert.ok(pdf.indexOf('Texte de l’ancienne page') > -1 && pdf.indexOf('Présents') < 0);
  assert.deepStrictEqual(g.mails.map(m => m.to).sort(), [ARCHI, SEB].sort());
});
test('page d’avant le lot 1 (aucun numéro de fiche) : la note part comme avant, sans numéro et sans ligne', () => {
  const g = environnement();
  const r = poster(g, ancienne({ destinataires: [ARCHI] }));
  assert.strictEqual(r.status, 'ok', JSON.stringify(r));
  assert.strictEqual(CR(g).length, 0);
  assert.ok(g.mails.length === 2 && g.mails.every(m => m.sujet.indexOf('[Loué App] Note de réunion — CHANTIER TEST 1') === 0), g.mails.map(m => m.sujet).join(' | '));
});
test('droits inchangés : un poseur sans accès au chantier envoie toujours sa note ; sans compte (transition) aussi, numérotée', () => {
  const g = environnement();
  const p = envoyer(g, 'thomas27', nouvelle({ chantier: 'CHANTIER TEST 2' }));
  assert.deepStrictEqual([p.ok, p.code, p.data.numeroCR], [true, 'ENREGISTRE', 1], JSON.stringify(p));
  const s = envoyer(g, null, nouvelle({ chantier: 'CHANTIER TEST 2' }));
  assert.deepStrictEqual([s.ok, s.code, s.data.numeroCR], [true, 'ENREGISTRE', 2], JSON.stringify(s));
  assert.deepStrictEqual(CR(g).map(l => l[C.compte]), ['Thomas ESSAI (thomas27)', 'sans compte']);
});
test('adresse tapée à la main : objet et pièce jointe imposés par le lot 0 (sans numéro) ; le numéro reste dans le PDF', () => {
  const g = environnement();
  envoyer(g, 'seb', nouvelle({ destinataires: [LIBRE] }));
  const m = g.mails.find(x => x.to === LIBRE);
  assert.strictEqual(m.sujet, 'Loué Menuiserie — Note de réunion — CHANTIER TEST 1');
  assert.ok(/^Loue Menuiserie - Note de réunion - /.test(m.opts.attachments[0].nom), m.opts.attachments[0].nom);
  assert.ok(/Compte rendu n° 1</.test(String(m.opts.attachments[0].contenu)));
});
test('25 adresses connues sur une note : toutes servies, comme avant (le plafond de 10 est tenu par la page, pas par le serveur)', () => {
  const g = environnement({ contactsEnPlus: 25 });
  const adresses = Array.from({ length: 25 }, (_, i) => 'contact' + (i + 1) + '@ext.test');
  const r = envoyer(g, 'seb', nouvelle({ destinataires: adresses }));
  assert.strictEqual(r.data.envoyes, 26, JSON.stringify(r.data));
  assert.strictEqual((r.data.refuses || []).length, 0);
});
test('les autres fiches ne reçoivent ni numéro ni ligne', () => {
  const g = environnement();
  const r = envoyer(g, 'seb', { type: 'quitus', chantier: 'CHANTIER TEST 1', date: '12/11/2026', heure: '10h00', intervenant: 'Client ESSAI', description: 'Essai', solde: 'OUI', destinataires: [], photosBase64: [] });
  assert.deepStrictEqual([r.ok, r.code, 'numeroCR' in r.data, 'sansNumeroCR' in r.data], [true, 'ENREGISTRE', false, false], JSON.stringify(r));
  assert.strictEqual(CR(g).length, 0);
});

console.log('Lot 8b — verrou de la réservation, rejeu, onglet trié (après relecture)');
// Un faux verrou qui ne refuse QUE dans crReserver_ (le verrou de la réception, lui, est accordé), et qui note l'ordre des gestes
function verrouDeReservation(g) {
  const etat = { refuser: false, journal: [] };
  const dansReservation = () => /crReserver_/.test(String(new Error().stack));
  g.contexte.LockService = { getScriptLock: () => ({
    tryLock: () => !(etat.refuser && dansReservation()),
    releaseLock: () => { if (dansReservation()) etat.journal.push('verrou rendu'); } }),
    getDocumentLock: () => ({ tryLock: () => true, releaseLock: () => {} }) };
  const vrai = g.contexte.SpreadsheetApp.flush;
  g.contexte.SpreadsheetApp.flush = () => { etat.journal.push('écriture poussée'); return vrai(); };
  return etat;
}
test('verrou de la RÉSERVATION pris par une autre note : aucun numéro donné, ni ligne, ni PDF, ni mail ; au nouvel essai, le numéro suivant, jamais un double', () => {
  const g = environnement(), id = idFiche();
  assert.strictEqual(envoyer(g, 'seb').data.numeroCR, 1);
  const v = verrouDeReservation(g), mails = g.mails.length, fichiers = fichiersRanges(g).length;
  v.refuser = true;
  const r = envoyer(g, 'thomas27', nouvelle({ objet: 'Arrivée pendant une réservation' }), id);
  assert.deepStrictEqual([r.ok, r.code], [false, 'SERVEUR_OCCUPE'], JSON.stringify(r));
  assert.deepStrictEqual(numeros(g), [1], 'aucune ligne, aucun numéro');
  assert.strictEqual(g.mails.length, mails); assert.strictEqual(fichiersRanges(g).length, fichiers);
  v.refuser = false;
  const bon = envoyer(g, 'thomas27', nouvelle({ objet: 'Arrivée pendant une réservation' }), id);
  assert.deepStrictEqual([bon.code, bon.data.numeroCR], ['ENREGISTRE', 2], JSON.stringify(bon));
  assert.deepStrictEqual(numeros(g), [1, 2]);
});
test('la ligne est poussée dans le Sheet (flush) AVANT que le verrou de la réservation soit rendu', () => {
  const g = environnement(), v = verrouDeReservation(g);
  envoyer(g, 'seb');
  assert.deepStrictEqual(v.journal, ['écriture poussée', 'verrou rendu']);
});
test('rejeu, directement sur la réservation : le même numéro de fiche retrouve sa ligne et son numéro (rien n’est ajouté)', () => {
  const g = environnement(), brut = nouvelle();
  const a = g.ctx.crReserver_('fiche-directe-000001', brut, 'x');
  const autre = g.ctx.crReserver_('fiche-directe-000002', brut, 'x');
  const b = g.ctx.crReserver_('fiche-directe-000001', brut, 'x');
  assert.deepStrictEqual([a.numero, a.dejaLa, autre.numero, b.numero, b.dejaLa], [1, false, 2, 1, true]);
  assert.strictEqual(CR(g).length, 2);
  assert.strictEqual(g.ctx.crNumeroDeLaFiche_('fiche-directe-000001'), 1);
  assert.strictEqual(g.ctx.crNumeroDeLaFiche_('fiche-inconnue-000009'), 0);
});
test('onglet trié à l’envers et un numéro manquant : la note suivante prend le PLUS GRAND numéro + 1 (pas le nombre de lignes)', () => {
  const g = environnement();
  envoyer(g, 'seb'); envoyer(g, 'seb'); envoyer(g, 'seb'); envoyer(g, 'seb', nouvelle({ chantier: 'CHANTIER TEST 2' }));
  const sh = g.feuilles['Comptes rendus'];
  const lignes = sh.lignes.slice(1).filter(l => l[0] && !(l[C.chantier] === 'CHANTIER TEST 1' && l[C.numero] === 2)).reverse();
  sh.lignes = [sh.lignes[0]].concat(lignes);
  assert.deepStrictEqual(numeros(g), [1, 3, 1]);
  assert.strictEqual(envoyer(g, 'seb').data.numeroCR, 4);
  assert.strictEqual(envoyer(g, 'seb', nouvelle({ chantier: 'CHANTIER TEST 2' })).data.numeroCR, 2);
});
test('quota de mails presque atteint : le mail est reporté, la note garde son numéro (réponse, onglet, mail en attente)', () => {
  const g = environnement({ google: { quota: 10 } });
  const r = envoyer(g, 'thomas27');
  assert.deepStrictEqual([r.ok, r.code, r.data.numeroCR, r.data.envoyes, r.data.reportes], [true, 'ENREGISTRE', 1, 0, 1], JSON.stringify(r));
  assert.deepStrictEqual(numeros(g), [1]);
  const attente = g.feuilles['Mails en attente'].lignes.slice(1);
  assert.ok(attente.length === 1 && String(attente[0][5]).indexOf('Note de réunion — CR n° 1 — CHANTIER TEST 1') > -1, JSON.stringify(attente.map(l => l[5])));
});
test('deux notes SANS numéro le même jour (chantier hors liste) : même nom de fichier, la seconde devient « _V2 », rien n’est écrasé', () => {
  const g = environnement();
  envoyer(g, 'seb', nouvelle({ chantier: 'CHANTIER INCONNU' })); envoyer(g, 'seb', nouvelle({ chantier: 'CHANTIER INCONNU' }));
  assert.deepStrictEqual(fichiersRanges(g), ['COMPTE RENDU CHANTIER INCONNU 2026-11-12.pdf', 'COMPTE RENDU CHANTIER INCONNU 2026-11-12_V2.pdf']);
});

console.log('Lot 8b — installation et livraison');
test('installerLot8Production : crée l’onglet avec ses 12 titres ; relancée, ne touche à rien ; refuse sur la copie TEST', () => {
  const g = environnement({ sansInstallation: true });
  const t1 = g.ctx.installerLot8Production();
  assert.ok(/✅ 1\/1 Onglet « Comptes rendus » : fait/.test(t1) && /installation terminée/.test(t1), t1);
  assert.strictEqual(g.feuilles['Comptes rendus'].lignes[0].length, 12);
  envoyer(g, 'seb');
  const t2 = g.ctx.installerLot8Production();
  assert.ok(/déjà fait/.test(t2), t2);
  assert.strictEqual(CR(g).length, 1);
  const gTest = environnement({ test: true, sansInstallation: true });
  assert.ok(/Refusé/.test(gTest.ctx.installerLot8Production()) && !gTest.feuilles['Comptes rendus']);
  assert.ok(/installation terminée/.test(gTest.ctx.installerLot8Test()));
});
test('installation : un onglet du même nom avec d’autres titres et des données n’est jamais réécrit', () => {
  const g = environnement({ sansInstallation: true, google: { feuilles: { 'Comptes rendus': [['Ancien', 'Titres'], ['donnée', 'gardée']] } } });
  const t = g.ctx.installerLot8Production();
  assert.ok(/❌/.test(t) && /existe déjà avec d’autres titres/.test(t), t);
  assert.deepStrictEqual(g.feuilles['Comptes rendus'].lignes, [['Ancien', 'Titres'], ['donnée', 'gardée']]);
});
test('livraison : le serveur à coller contient le lot 8b, en version v11.0, sans les outils d’essai', () => {
  const code = fs.readFileSync(path.join(__dirname, '..', 'A-COLLER-DANS-APPS-SCRIPT', 'Code.gs'), 'utf8');
  ["const VERSION_API = 'v11.0'", 'function crReserver_(', 'SpreadsheetApp.flush();', 'function installerLot8Test(', 'function installerLot8Production(', 'ComptesRendus.gs'].forEach(t => assert.ok(code.indexOf(t) > -1, t));
  assert.ok(code.indexOf('function outilTest_(') < 0);
  assert.ok(code.indexOf(String.fromCharCode(0x2028)) < 0 && code.indexOf(String.fromCharCode(0x2029)) < 0, 'aucun séparateur de ligne brut dans le fichier à coller');
});

console.log(reussis + ' test(s) réussi(s)' + (process.exitCode ? ' — DES TESTS ÉCHOUENT' : ''));
