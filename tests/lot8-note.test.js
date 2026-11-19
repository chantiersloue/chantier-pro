// Tests du lot 8b, côté serveur (onglet « Comptes rendus » : une ligne par note de réunion, sans numéro) : node tests/lot8-note.test.js
// Le VRAI code d'apps-script/ tourne avec les services Google simulés (tests/gas-harness.js) : rien ne part chez Google.
// Noms, chantiers et adresses : tous fictifs (dépôt public).
'use strict';
// Le numéro de version du serveur est lu dans apps-script/Config.gs : un nouveau lot ne fait plus changer ce fichier de tests
const VERSION_SERVEUR = (/VERSION_API = '([^']+)'/.exec(require('fs').readFileSync(require('path').join(__dirname, '..', 'apps-script', 'Config.gs'), 'utf8')) || [])[1];
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
// Une note comme la page l'envoie depuis le lot 8 : « remarques » = le texte saisi ; « commentaires » = copie lisible par un ancien serveur
const nouvelle = extra => {
  const d = Object.assign({ remarques: 'Pose des châssis du R+1' }, extra || {});
  return ancienne(Object.assign({ commentaires: 'COPIE POUR ANCIEN SERVEUR\n\n' + d.remarques }, d));
};
const envoyer = (g, qui, donnees, id) => poster(g, Object.assign({ action: 'fiche', id: id || idFiche(), donnees: donnees || nouvelle() }, qui ? { jeton: jeton(g, qui) } : {}));
const CR = g => (g.feuilles['Comptes rendus'] ? g.feuilles['Comptes rendus'].lignes.slice(1).filter(l => l[0]) : []);
const E = g => (g.feuilles['Envois'] ? g.feuilles['Envois'].lignes.slice(1) : []);
const C = { fiche: 0, chantier: 1, numChantier: 2, date: 3, objet: 4, auteur: 5, compte: 6, pdf: 7, recu: 8, remarque: 9 };
const TITRES = ['Numéro de fiche', 'Chantier', 'N° du chantier', 'Date de la réunion', 'Objet', 'Rédigé par', 'Compte qui a envoyé', 'Nom du PDF', 'Reçu le', 'Remarque de l’appli'];
const dernierPdf = g => { const m = g.mails[g.mails.length - 1]; return m ? String(m.opts.attachments[0].contenu) : ''; };
const fichiersRanges = g => Object.values(g.elements).filter(e => e.type === 'fichier' && /^COMPTE RENDU /.test(e.nom) && !e.corbeille).map(e => e.nom).sort();
const numeroChantier = (g, nom, n) => { const l = g.feuilles['Chantiers'].lignes.find(x => x[0] === nom); l[4] = n; };

let reussis = 0;
function test(nom, fn) {
  try { fn(); reussis++; console.log('  ✓ ' + nom); }
  catch (e) { console.log('  ✗ ' + nom + '\n    ' + String(e.stack || e.message).split('\n').slice(0, 6).join('\n    ')); process.exitCode = 1; }
}

console.log('Lot 8b — onglet « Comptes rendus » : une ligne par note, sans numéro');
test('trois notes du même chantier : trois lignes écrites d’un coup ; ni numéro dans la réponse, le PDF, l’objet du mail ou le nom du fichier', () => {
  const g = environnement();
  const r = [envoyer(g, 'seb'), envoyer(g, 'seb'), envoyer(g, 'thomas27')];
  assert.deepStrictEqual(r.map(x => [x.ok, x.code]), [[true, 'ENREGISTRE'], [true, 'ENREGISTRE'], [true, 'ENREGISTRE']], JSON.stringify(r));
  assert.ok(r.every(x => !('numeroCR' in x.data) && !('sansNumeroCR' in x.data)), JSON.stringify(r[2].data));
  assert.ok(/^Fiche enregistrée\. /.test(r[2].message), r[2].message);
  assert.deepStrictEqual(Array.from(g.feuilles['Comptes rendus'].lignes[0]), TITRES);
  assert.ok(dernierPdf(g).indexOf('Compte rendu n°') < 0 && dernierPdf(g).indexOf('NOTE DE RÉUNION') > -1, 'aucun numéro dans le PDF');
  assert.strictEqual(g.mails.slice(-1)[0].sujet, '[Loué App] Note de réunion — CHANTIER TEST 1 — Réunion de chantier');
  assert.deepStrictEqual(fichiersRanges(g), ['COMPTE RENDU CHANTIER TEST 1 2026-11-12.pdf', 'COMPTE RENDU CHANTIER TEST 1 2026-11-12_V2.pdf', 'COMPTE RENDU CHANTIER TEST 1 2026-11-12_V3.pdf']);
  const l = CR(g)[2];
  assert.deepStrictEqual([l[C.chantier], l[C.numChantier], l[C.date], l[C.objet], l[C.auteur], l[C.compte], l[C.pdf], l[C.remarque]],
    ['CHANTIER TEST 1', '', '12/11/2026', 'Réunion de chantier', 'Franck ESSAI', 'Thomas ESSAI (thomas27)', 'COMPTE RENDU CHANTIER TEST 1 2026-11-12_V3.pdf', '']);
  assert.strictEqual(Object.prototype.toString.call(l[C.recu]), '[object Date]');
  assert.ok(E(g).every(x => String(x[4]) === 'traité'), JSON.stringify(E(g)));
});
test('le texte saisi (« remarques ») est imprimé une seule fois ; la copie pour un ancien serveur n’est pas imprimée', () => {
  const g = environnement();
  envoyer(g, 'seb');
  const pdf = dernierPdf(g);
  assert.strictEqual(pdf.split('Pose des châssis du R+1').length - 1, 1);
  assert.ok(pdf.indexOf('COPIE POUR ANCIEN SERVEUR') < 0);
});
test('note renvoyée (réponse perdue) : « déjà reçue », une seule ligne, aucun mail de plus', () => {
  const g = environnement(), id = idFiche();
  envoyer(g, 'seb', nouvelle(), id);
  const mails = g.mails.length;
  const deux = envoyer(g, 'seb', nouvelle(), id);
  assert.deepStrictEqual([deux.ok, deux.code, deux.message], [true, 'DEJA_RECU', 'Fiche déjà reçue'], JSON.stringify(deux));
  assert.strictEqual(CR(g).length, 1);
  assert.strictEqual(g.mails.length, mails, 'aucun mail de plus');
});
test('PDF raté au premier essai, puis nouvel essai du téléphone : toujours une seule ligne', () => {
  const g = environnement(), id = idFiche();
  const vrai = g.contexte.HtmlService.createHtmlOutput;
  g.contexte.HtmlService.createHtmlOutput = () => { throw new Error('conversion PDF en panne'); };
  const rate = envoyer(g, 'seb', nouvelle(), id);
  assert.deepStrictEqual([rate.ok, rate.code], [false, 'ERREUR'], JSON.stringify(rate));
  assert.strictEqual(CR(g).length, 1, 'la ligne est écrite avant le PDF');
  g.contexte.HtmlService.createHtmlOutput = vrai;
  const bon = envoyer(g, 'seb', nouvelle(), id);
  assert.deepStrictEqual([bon.ok, bon.code], [true, 'ENREGISTRE'], JSON.stringify(bon));
  assert.strictEqual(CR(g).length, 1);
  assert.strictEqual(CR(g)[0][C.pdf], 'COMPTE RENDU CHANTIER TEST 1 2026-11-12.pdf');
});
test('deux notes en même temps (la seconde arrive pendant l’envoi des mails de la première) : deux lignes', () => {
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
  assert.deepStrictEqual(CR(g).map(l => l[C.objet]), ['Première', 'Arrivée pendant la première']);
});
test('serveur occupé dès la réception (verrou de recevoirFiche_) : la note est refusée « occupé », rien n’est écrit, le téléphone réessaiera', () => {
  const g = environnement({ google: { verrouOccupe: true }, sansInstallation: true });
  const r = envoyer(g, 'seb');
  assert.deepStrictEqual([r.ok, r.code], [false, 'SERVEUR_OCCUPE'], JSON.stringify(r));
  assert.strictEqual(CR(g).length, 0);
  assert.strictEqual(g.mails.length, 0);
});

console.log('Lot 8b — chantier de la note, ordre d’arrivée');
test('N° du chantier (colonne E de l’onglet Chantiers) recopié dans la ligne ; nom tapé avec une autre casse : le nom du bureau est noté', () => {
  const g = environnement();
  numeroChantier(g, 'CHANTIER TEST 1', '0403');
  envoyer(g, 'seb', nouvelle({ chantier: '  chantier test 1 ' }));
  assert.deepStrictEqual([CR(g)[0][C.chantier], CR(g)[0][C.numChantier]], ['CHANTIER TEST 1', '0403']);
});
test('chantier HORS LISTE : note envoyée et notée, avec la remarque « chantier hors liste »', () => {
  const g = environnement();
  const r = envoyer(g, 'seb', nouvelle({ chantier: 'CHANTIER INCONNU' }));
  assert.deepStrictEqual([r.ok, r.code, r.data.envoyes], [true, 'ENREGISTRE', 1], JSON.stringify(r));
  assert.deepStrictEqual(CR(g).map(l => [l[C.chantier], l[C.remarque]]), [['CHANTIER INCONNU', 'chantier hors liste']]);
});
test('ordre d’arrivée : une note datée d’avant la précédente du même chantier porte la remarque « reçu après le compte rendu du … »', () => {
  const g = environnement();
  envoyer(g, 'seb', nouvelle({ date: '12/11/2026' }));
  envoyer(g, 'seb', nouvelle({ date: '10/11/2026', chantier: 'CHANTIER TEST 2' }));
  envoyer(g, 'seb', nouvelle({ date: '06/11/2026' }));
  assert.deepStrictEqual(CR(g).map(l => l[C.remarque]), ['', '', 'reçu après le compte rendu du 12/11/2026']);
});
test('chantier RENOMMÉ qui a un N° : la note suivante est rattachée aux précédentes (par le N° du chantier) ; sans N°, elle ne l’est pas', () => {
  const g = environnement();
  numeroChantier(g, 'CHANTIER TEST 1', '403');
  envoyer(g, 'seb', nouvelle({ date: '12/11/2026' }));
  g.feuilles['Chantiers'].lignes.find(x => x[0] === 'CHANTIER TEST 1')[0] = 'RESIDENCE ESSAI';
  envoyer(g, 'seb', nouvelle({ chantier: 'RESIDENCE ESSAI', date: '06/11/2026' }));
  assert.deepStrictEqual(CR(g).map(l => [l[C.chantier], l[C.numChantier], l[C.remarque]]), [['CHANTIER TEST 1', '403', ''], ['RESIDENCE ESSAI', '403', 'reçu après le compte rendu du 12/11/2026']]);
  const h = environnement();
  envoyer(h, 'seb', nouvelle({ date: '12/11/2026' }));
  h.feuilles['Chantiers'].lignes.find(x => x[0] === 'CHANTIER TEST 1')[0] = 'RESIDENCE ESSAI';
  envoyer(h, 'seb', nouvelle({ chantier: 'RESIDENCE ESSAI', date: '06/11/2026' }));
  assert.strictEqual(CR(h)[1][C.remarque], '', 'limite connue, dite dans la procédure');
});
test('onglet trié à l’envers par Franck : la « dernière note » du chantier reste la dernière ARRIVÉE (colonne « Reçu le »), pas la plus basse', () => {
  const g = environnement();
  envoyer(g, 'seb', nouvelle({ date: '01/11/2026' })); envoyer(g, 'seb', nouvelle({ date: '20/11/2026' }));
  const sh = g.feuilles['Comptes rendus'];
  sh.lignes[1][C.recu] = new Date(Date.now() - 86400000); sh.lignes[2][C.recu] = new Date(Date.now() - 3600000);
  sh.lignes = [sh.lignes[0], sh.lignes[2], sh.lignes[1]];
  envoyer(g, 'seb', nouvelle({ date: '10/11/2026' }));
  assert.strictEqual(CR(g)[2][C.remarque], 'reçu après le compte rendu du 20/11/2026');
});

console.log('Lot 8b — onglet « Comptes rendus » vérifié avant écriture');
test('titres de l’onglet changés à la main : la note part quand même (PDF et mails normaux), rien n’est écrit, Franck prévenu une fois par jour ; titres remis : les lignes reprennent', () => {
  const g = environnement();
  envoyer(g, 'seb');
  const mails = g.mails.length, fichiers = fichiersRanges(g).length;
  g.feuilles['Comptes rendus'].lignes[0][3] = 'Date';
  const r = envoyer(g, 'seb', nouvelle({ objet: 'Note à ne pas bloquer' }));
  assert.deepStrictEqual([r.ok, r.code, r.data.envoyes], [true, 'ENREGISTRE', 1], JSON.stringify(r));
  assert.strictEqual(CR(g).length, 1, 'aucune ligne écrite dans un onglet aux titres changés');
  assert.strictEqual(fichiersRanges(g).length, fichiers + 1, 'le PDF est rangé');
  const nouveaux = g.mails.slice(mails);
  assert.deepStrictEqual(nouveaux.map(m => [m.to, m.sujet]), [
    [FRANCK, '[Loué App] Notes de réunion non notées — titres de l’onglet « Comptes rendus » changés'],
    [SEB, '[Loué App] Note de réunion — CHANTIER TEST 1 — Note à ne pas bloquer']], JSON.stringify(nouveaux.map(m => m.sujet)));
  assert.ok(/lancez installerLot8Production\./.test(nouveaux[0].texte) && /envoyées normalement/.test(nouveaux[0].texte), nouveaux[0].texte);
  assert.ok(E(g).every(x => String(x[4]) === 'traité'), 'onglet Envois : « traité »');
  envoyer(g, 'seb');
  assert.strictEqual(g.mails.filter(m => /non notées/.test(m.sujet)).length, 1, 'une seule alerte par jour');
  g.feuilles['Comptes rendus'].lignes[0][3] = 'Date de la réunion';
  envoyer(g, 'seb');
  assert.strictEqual(CR(g).length, 2, 'titres remis : la note est de nouveau notée');
});
test('sur la copie TEST, le mail d’alerte nomme installerLot8Test', () => {
  const g = environnement({ test: true });
  g.feuilles['Comptes rendus'].lignes[0][0] = 'Autre';
  envoyer(g, 'seb');
  const alerte = g.mails.find(m => /non notées/.test(m.sujet));
  assert.ok(alerte && /lancez installerLot8Test\./.test(alerte.texte) && !/installerLot8Production/.test(alerte.texte), alerte && alerte.texte);
});
test('onglet absent (installation pas encore lancée) : créé avec ses titres à la première note', () => {
  const g = environnement({ sansInstallation: true });
  assert.ok(!g.feuilles['Comptes rendus']);
  envoyer(g, 'seb');
  assert.deepStrictEqual(Array.from(g.feuilles['Comptes rendus'].lignes[0]), TITRES);
  assert.strictEqual(CR(g).length, 1);
});
test('réponse « déjà reçue » quand l’onglet a été abîmé depuis : la réponse part quand même', () => {
  const g = environnement(), id = idFiche();
  envoyer(g, 'seb', nouvelle(), id);
  g.feuilles['Comptes rendus'].lignes[0][0] = 'Autre titre';
  const r = envoyer(g, 'seb', nouvelle(), id);
  assert.deepStrictEqual([r.ok, r.code], [true, 'DEJA_RECU'], JSON.stringify(r));
});
test('texte piégé (formule) dans l’objet et le rédacteur : écrit comme du texte', () => {
  const g = environnement();
  envoyer(g, 'seb', nouvelle({ objet: '=IMPORTDATA("x")', auteur: '+33 6' }));
  const l = CR(g)[0];
  assert.deepStrictEqual([l[C.objet], l[C.auteur]], ["'=IMPORTDATA(\"x\")", "'+33 6"]);
});

console.log('Lot 8b — compatibilité et droits');
test('fiche de l’ANCIEN format (déjà en attente dans un téléphone) : acceptée, notée, son texte imprimé tel quel', () => {
  const g = environnement();
  const r = envoyer(g, 'seb', ancienne({ commentaires: 'Texte de l’ancienne page', destinataires: [ARCHI] }));
  assert.deepStrictEqual([r.ok, r.code, r.data.envoyes], [true, 'ENREGISTRE', 2], JSON.stringify(r));
  assert.ok(dernierPdf(g).indexOf('Texte de l’ancienne page') > -1);
  assert.deepStrictEqual(g.mails.map(m => m.to).sort(), [ARCHI, SEB].sort());
  assert.strictEqual(CR(g).length, 1);
});
test('fiche de la page 10.1 des essais (numéro et présents dans ses données) : acceptée ; numéro et présents ne sont ni imprimés ni notés', () => {
  const g = environnement();
  const r = envoyer(g, 'seb', nouvelle({ numeroCR: '999', presents: ['Alice ESSAI', 'Bruno ESSAI'], commentaires: 'Présents : Alice ESSAI, Bruno ESSAI\n\nPose des châssis du R+1' }));
  assert.deepStrictEqual([r.ok, r.code], [true, 'ENREGISTRE'], JSON.stringify(r));
  const pdf = dernierPdf(g);
  assert.ok(pdf.indexOf('999') < 0 && pdf.indexOf('Alice ESSAI') < 0 && pdf.indexOf('Pose des châssis du R+1') > -1, 'ni numéro ni présents');
  assert.ok(JSON.stringify(CR(g)).indexOf('Alice') < 0);
});
test('page d’avant le lot 1 (aucun numéro de fiche) : la note part comme avant, sans ligne', () => {
  const g = environnement();
  const r = poster(g, ancienne({ destinataires: [ARCHI] }));
  assert.strictEqual(r.status, 'ok', JSON.stringify(r));
  assert.strictEqual(CR(g).length, 0);
  assert.ok(g.mails.length === 2 && g.mails.every(m => m.sujet.indexOf('[Loué App] Note de réunion — CHANTIER TEST 1') === 0), g.mails.map(m => m.sujet).join(' | '));
});
test('droits inchangés : un poseur sans accès au chantier envoie toujours sa note ; sans compte (transition) aussi', () => {
  const g = environnement();
  const p = envoyer(g, 'thomas27', nouvelle({ chantier: 'CHANTIER TEST 2' }));
  const s = envoyer(g, null, nouvelle({ chantier: 'CHANTIER TEST 2' }));
  assert.deepStrictEqual([p.ok, p.code, s.ok, s.code], [true, 'ENREGISTRE', true, 'ENREGISTRE'], JSON.stringify([p, s]));
  assert.deepStrictEqual(CR(g).map(l => l[C.compte]), ['Thomas ESSAI (thomas27)', 'sans compte']);
});
test('adresse tapée à la main : objet et pièce jointe imposés par le lot 0', () => {
  const g = environnement();
  envoyer(g, 'seb', nouvelle({ destinataires: [LIBRE] }));
  const m = g.mails.find(x => x.to === LIBRE);
  assert.strictEqual(m.sujet, 'Loué Menuiserie — Note de réunion — CHANTIER TEST 1');
  assert.ok(/^Loue Menuiserie - Note de réunion - /.test(m.opts.attachments[0].nom), m.opts.attachments[0].nom);
});
test('25 adresses connues sur une note : toutes servies, comme avant (le plafond de 10 est tenu par la page, pas par le serveur)', () => {
  const g = environnement({ contactsEnPlus: 25 });
  const adresses = Array.from({ length: 25 }, (_, i) => 'contact' + (i + 1) + '@ext.test');
  const r = envoyer(g, 'seb', nouvelle({ destinataires: adresses }));
  assert.strictEqual(r.data.envoyes, 26, JSON.stringify(r.data));
  assert.strictEqual((r.data.refuses || []).length, 0);
});
test('quota de mails presque atteint : le mail est reporté, la note est notée', () => {
  const g = environnement({ google: { quota: 10 } });
  const r = envoyer(g, 'thomas27');
  assert.deepStrictEqual([r.ok, r.code, r.data.envoyes, r.data.reportes], [true, 'ENREGISTRE', 0, 1], JSON.stringify(r));
  assert.strictEqual(CR(g).length, 1);
  const attente = g.feuilles['Mails en attente'].lignes.slice(1);
  assert.ok(attente.length === 1 && String(attente[0][5]).indexOf('Note de réunion — CHANTIER TEST 1') > -1, JSON.stringify(attente.map(l => l[5])));
});
test('les autres fiches ne reçoivent aucune ligne', () => {
  const g = environnement();
  const r = envoyer(g, 'seb', { type: 'quitus', chantier: 'CHANTIER TEST 1', date: '12/11/2026', heure: '10h00', intervenant: 'Client ESSAI', description: 'Essai', solde: 'OUI', destinataires: [], photosBase64: [] });
  assert.deepStrictEqual([r.ok, r.code], [true, 'ENREGISTRE'], JSON.stringify(r));
  assert.strictEqual(CR(g).length, 0);
});

console.log('Lot 8b — verrou de l’écriture, rejeu (après relecture)');
// Un faux verrou qui ne refuse QUE dans crEnregistrer_ (le verrou de la réception, lui, est accordé), et qui note l'ordre des gestes
function verrouDeLOnglet(g) {
  const etat = { refuser: false, journal: [] };
  const dedans = () => /crEnregistrer_/.test(String(new Error().stack));
  g.contexte.LockService = { getScriptLock: () => ({
    tryLock: () => !(etat.refuser && dedans()),
    releaseLock: () => { if (dedans()) etat.journal.push('verrou rendu'); } }),
    getDocumentLock: () => ({ tryLock: () => true, releaseLock: () => {} }) };
  const vrai = g.contexte.SpreadsheetApp.flush;
  g.contexte.SpreadsheetApp.flush = () => { etat.journal.push('écriture poussée'); return vrai(); };
  return etat;
}
test('verrou de l’onglet pris par une autre note : ni ligne, ni PDF, ni mail ; au nouvel essai, la note passe, une seule ligne', () => {
  const g = environnement(), id = idFiche();
  envoyer(g, 'seb');
  const v = verrouDeLOnglet(g), mails = g.mails.length, fichiers = fichiersRanges(g).length;
  v.refuser = true;
  const r = envoyer(g, 'thomas27', nouvelle({ objet: 'Arrivée pendant une écriture' }), id);
  assert.deepStrictEqual([r.ok, r.code], [false, 'SERVEUR_OCCUPE'], JSON.stringify(r));
  assert.strictEqual(CR(g).length, 1);
  assert.strictEqual(g.mails.length, mails); assert.strictEqual(fichiersRanges(g).length, fichiers);
  v.refuser = false;
  const bon = envoyer(g, 'thomas27', nouvelle({ objet: 'Arrivée pendant une écriture' }), id);
  assert.strictEqual(bon.code, 'ENREGISTRE', JSON.stringify(bon));
  assert.strictEqual(CR(g).length, 2);
});
test('la ligne est poussée dans le Sheet (flush) AVANT que le verrou soit rendu', () => {
  const g = environnement(), v = verrouDeLOnglet(g);
  envoyer(g, 'seb');
  assert.deepStrictEqual(v.journal, ['écriture poussée', 'verrou rendu']);
});
test('rejeu, directement sur l’écriture : le même numéro de fiche retrouve sa ligne (rien n’est ajouté)', () => {
  const g = environnement(), brut = nouvelle();
  const a = g.ctx.crEnregistrer_('fiche-directe-000001', brut, 'x');
  g.ctx.crEnregistrer_('fiche-directe-000002', brut, 'x');
  const b = g.ctx.crEnregistrer_('fiche-directe-000001', brut, 'x');
  assert.deepStrictEqual([a.dejaLa, b.dejaLa], [false, true]);
  assert.strictEqual(CR(g).length, 2);
});

console.log('Lot 8b — installation et livraison');
test('installerLot8Production : crée l’onglet avec ses titres ; relancée, ne touche à rien ; refuse sur la copie TEST', () => {
  const g = environnement({ sansInstallation: true });
  const t1 = g.ctx.installerLot8Production();
  assert.ok(/✅ 1\/1 Onglet « Comptes rendus » : fait/.test(t1) && /installation terminée/.test(t1), t1);
  assert.deepStrictEqual(Array.from(g.feuilles['Comptes rendus'].lignes[0]), TITRES);
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
test('livraison : le serveur à coller contient le lot 8, dans la version de Config.gs, sans numéro de compte rendu ni présents, sans les outils d’essai', () => {
  const code = fs.readFileSync(path.join(__dirname, '..', 'A-COLLER-DANS-APPS-SCRIPT', 'Code.gs'), 'utf8');
  ["const VERSION_API = '" + VERSION_SERVEUR + "'", 'function crEnregistrer_(', 'SpreadsheetApp.flush();', 'function installerLot8Test(', 'function installerLot8Production(', 'ComptesRendus.gs'].forEach(t => assert.ok(code.indexOf(t) > -1, t));
  ['numeroCR', 'crReserver_', 'crPresents_', 'Compte rendu n°', 'CR n°'].forEach(t => assert.ok(code.indexOf(t) < 0, 'reste : ' + t));
  assert.ok(code.indexOf('function outilTest_(') < 0);
  assert.ok(code.indexOf(String.fromCharCode(0x2028)) < 0 && code.indexOf(String.fromCharCode(0x2029)) < 0, 'aucun séparateur de ligne brut dans le fichier à coller');
});

console.log(reussis + ' test(s) réussi(s)' + (process.exitCode ? ' — DES TESTS ÉCHOUENT' : ''));
