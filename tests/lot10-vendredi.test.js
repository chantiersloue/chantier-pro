// Tests du lot 10b, côté serveur (le « point du vendredi » : un mail par semaine à Franck) : node tests/lot10-vendredi.test.js
// Faux Google (tests/gas-harness.js) avec une HORLOGE RÉGLABLE (g.now) et l'heure calculée dans le fuseau demandé
// (option « fuseaux ») : les tests donnent le même résultat quel que soit le jour où on les lance et le réglage du PC.
// Noms inventés (« Poseur A », « CHANTIER TEST 1 ») : le dépôt est public.
'use strict';
const VERSION_SERVEUR = (/VERSION_API = '([^']+)'/.exec(require('fs').readFileSync(require('path').join(__dirname, '..', 'apps-script', 'Config.gs'), 'utf8')) || [])[1];
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { creerGoogle, chargerScript } = require('./gas-harness');
const RACINE = path.join(__dirname, '..');

// Un instant donné à l'heure de PARIS : P('2026-11-20 14:00') (hiver, UTC+1) ; P('2026-10-23 14:00', 'ete') (été, UTC+2)
const P = (texte, saison) => Date.parse(texte.replace(' ', 'T') + ':00' + (saison === 'ete' ? '+02:00' : '+01:00'));
const MARDI = '2026-11-17', JEUDI = '2026-11-19', VENDREDI = '2026-11-20', SAMEDI = '2026-11-21', LUNDI = '2026-11-23', VENDREDI_2 = '2026-11-27', VENDREDI_3 = '2026-12-04';
const TITRES_SIG = ['Numéro', 'Reçu le', 'Chantier', 'Auteur (identifiant)', 'Auteur', 'Type', 'Urgence', 'Repère', 'Commentaire', 'Photos',
  'Atelier prévenu', 'Remarque', 'Statut', 'Statut modifié par l’appli le', 'Statut modifié par l’appli par', 'Mail à la réception', 'Saisi le'];

function environnement(o = {}) {
  const g = creerGoogle({
    fuseaux: true,
    nomSheet: o.test ? 'ChantierPro TEST' : 'ChantierPro',
    quota: o.quota,
    proprietes: Object.assign({ DRIVE_ROOT_ID: 'RACINE', DRIVE_PLANNING_ID: 'PLANNING', HACHAGE_ITERATIONS: '200', EMAIL_ADMIN: 'bureau@loue.test' },
      o.test ? { ENVIRONNEMENT: 'TEST' } : {}, o.proprietes || {}),
    feuilles: Object.assign({
      'Contacts': [['Nom', 'Role', 'Email', 'ChefEquipe', 'Destinataire', 'ConducteurDefaut', 'ChefAtelier', 'absenceNotif'],
        ['Conducteur Essai', 'Conducteur de travaux', 'bureau@loue.test', 'O', 'N', 'O', 'N', 'O'],
        ['Autre Conducteur', 'Conducteur de travaux', 'autre@loue.test', 'O', 'N', 'N', 'N', 'N']],
      'Contacts notes': [['Nom', 'Email']],
      'Chantiers': [['Nom', 'Référence', 'Statut', 'Conducteur'], ['CHANTIER TEST 1', 'LIEU 1', 'En cours', 'Conducteur Essai'], ['CHANTIER TEST 2', 'LIEU 2', 'En cours', 'Autre Conducteur']],
    }, o.sansSignalements ? {} : { 'Signalements': [TITRES_SIG] }, o.feuilles || {}),
  });
  g.creerElement('dossier', 'Loué Menuiserie - Chantiers', null, { id: 'RACINE' });
  g.creerElement('dossier', 'Planning', null, { id: 'PLANNING' });
  g.ctx = chargerScript(g, o.codeUnique);
  g.now = P(MARDI + ' 09:00');
  g.ctx.maintenant_ = () => g.now;   // l'horloge du serveur, réglable
  g.ctx.genererCle(); g.ctx.preparerOngletsLot2();
  const u = g.feuilles['Utilisateurs'];
  u.lignes[1] = ['poseura', 'Poseur A', 'Poseur', true, false, '', '', false, false, ''];
  u.lignes[2] = ['poseurb', 'Poseur B', 'Poseur', true, false, '', '', false, false, ''];
  g.ctx.traiterComptes();
  if (!o.sansInstallation) assert.ok(/installation terminée/.test((o.test ? g.ctx.installerLot10Test : g.ctx.installerLot10Production)()));
  if (!o.arrete) assert.ok(/mis en service/.test(g.ctx.demarrerPointDuVendredi()));
  g.mails.length = 0;
  return g;
}
const reveil = (g, quand) => { if (quand) g.now = quand; return g.ctx.traiterComptes(); };   // un passage du réveil des 10 minutes
const points = g => g.mails.filter(m => /Point du vendredi/.test(m.sujet));
const recaps = g => g.mails.filter(m => /^À commander — /.test(m.sujet));
const etat = g => JSON.parse(g.proprietes.VENDREDI_POINT || '{}');
const j = x => JSON.stringify(x);
let numero = 0;
// Une ligne de l'onglet « Signalements », écrite comme le fait le serveur (Signalements.gs)
function signalement(g, o) {
  const l = new Array(17).fill('');
  l[0] = 'fiche-sig-' + String(++numero).padStart(6, '0'); l[1] = new Date(o.recu); l[2] = o.chantier || 'CHANTIER TEST 1';
  l[3] = o.auteurId || 'poseura'; l[4] = o.auteur || 'Poseur A'; l[5] = o.type || 'Casse'; l[6] = o.urgence || 'Cette semaine';
  l[7] = o.repere || 'F12'; l[8] = o.commentaire || ''; l[9] = 0; l[10] = 'Non'; l[12] = o.statut === undefined ? 'À traiter' : o.statut; l[15] = 'envoyé';
  g.feuilles['Signalements'].lignes.push(l);
  return l;
}
const envoi = (g, recu, type, statut, chantier) => {
  if (!g.feuilles['Envois']) g.ctx.feuille_('Envois', ['Numéro', 'Reçu le', 'Type', 'Chantier', 'Statut', 'Détail']);
  g.feuilles['Envois'].lignes.push(['fiche-env-' + String(++numero).padStart(6, '0'), new Date(recu), type, chantier || 'CHANTIER TEST 1', statut, '', 'poseura']);
};
const attente = (g, quand, statut) => {
  if (!g.feuilles['Mails en attente']) g.ctx.feuille_('Mails en attente', ['Horodatage', 'Fiche', 'Chantier', 'Destinataire', 'Copie cachée', 'Sujet', 'Texte', 'HTML', 'ID du PDF', 'Nom de la pièce jointe', 'Statut', 'Essais', 'Dernier essai', 'Mode']);
  g.feuilles['Mails en attente'].lignes.push([new Date(quand), 'quitus', 'CHANTIER TEST 1', 'client@exemple.invalid', '', 'Sujet', 'Texte', '', 'idpdf', 'doc.pdf', statut, 1, '', 'connue']);
};
const stockage = (place, date) => ({ 'Stockage': [['Stockage du compte Google', 'Tout va bien'], ['Place utilisée', place], ['Mesurée le', date]] });
// Les trois parties du texte du mail (sans l'en-tête ni le pied)
const parties = m => { const t = m.texte; return { semaine: t.slice(t.indexOf('SIGNALEMENTS DE LA SEMAINE'), t.indexOf('RAPPEL — ')).trim(),
  rappel: t.slice(t.indexOf('RAPPEL — '), t.indexOf('POINT DE SANTÉ')).trim(), sante: t.slice(t.indexOf('POINT DE SANTÉ'), t.indexOf('Ce mail part tous les vendredis')).trim() }; };

let reussis = 0;
function test(nom, fn) {
  try { fn(); reussis++; console.log('  ✓ ' + nom); }
  catch (e) { console.log('  ✗ ' + nom + '\n    ' + String(e.stack || e.message).split('\n').slice(0, 6).join('\n    ')); process.exitCode = 1; }
}

console.log('Lot 10b — quand part le point du vendredi');
test('jeudi : rien ; vendredi avant 14 h : rien ; premier passage après 14 h : UN mail, à Franck seul, sans pièce jointe ; passages suivants et samedi : aucun second mail', () => {
  const g = environnement({ quota: 100 });
  signalement(g, { recu: P(MARDI + ' 10:00') });
  ['08:00', '14:10', '15:50', '23:50'].forEach(h => reveil(g, P(JEUDI + ' ' + h)));
  ['00:05', '08:00', '13:50', '13:59'].forEach(h => reveil(g, P(VENDREDI + ' ' + h)));
  assert.deepStrictEqual([g.mails.length, etat(g).fait], [0, undefined], 'pas avant l’heure');
  assert.strictEqual(reveil(g, P(VENDREDI + ' 14:00')), 'ok');
  const m = points(g);
  assert.strictEqual(m.length, 1);
  assert.deepStrictEqual([m[0].to, m[0].sujet, m[0].opts.attachments, m[0].opts.bcc, m[0].opts.cc, g.mails.length],
    ['bureau@loue.test', 'Point du vendredi 20/11 — 1 signalement, rien d’autre à signaler', undefined, undefined, undefined, 1]);
  assert.deepStrictEqual([etat(g).fait, etat(g).envoi, etat(g).actif], [VENDREDI, P(VENDREDI + ' 14:00'), true]);
  assert.strictEqual(g.etat.quota, 99, 'un seul destinataire pris sur le quota');
  ['14:10', '14:20', '15:50', '17:59', '18:00', '23:50'].forEach(h => reveil(g, P(VENDREDI + ' ' + h)));
  ['00:10', '14:00', '14:10'].forEach(h => reveil(g, P(SAMEDI + ' ' + h)));
  reveil(g, P(LUNDI + ' 14:10'));
  assert.strictEqual(points(g).length, 1, 'jamais deux mails la même semaine');
});
test('semaine vide : le mail part quand même, « rien à signaler » partout', () => {
  const g = environnement();
  reveil(g, P(VENDREDI + ' 14:05'));
  const m = points(g)[0], p = parties(m);
  assert.strictEqual(m.sujet, 'Point du vendredi 20/11 — rien à signaler');
  assert.strictEqual(p.semaine, 'SIGNALEMENTS DE LA SEMAINE (depuis le 13/11 à 14 h 05) : 0\n  rien à signaler');
  assert.strictEqual(p.rappel, 'RAPPEL — « BLOQUANT » RESTÉS « À TRAITER » DEPUIS 7 JOURS OU PLUS : 0\n  rien à signaler');
  assert.strictEqual(p.sante, ['POINT DE SANTÉ', '  Mails reportés encore en attente : rien à signaler', '  Place du compte Google : pas encore mesurée (onglet « Stockage » absent)',
    '  Fiches arrivées au bureau mais pas traitées : rien à signaler'].join('\n'));
  assert.ok(/^Point du vendredi 20\/11\/2026\n/.test(m.texte) && /même quand il n’y a rien à signaler/.test(m.texte) && /Loué App$/.test(m.texte), m.texte);
  assert.ok(/rien à signaler/.test(m.opts.htmlBody) && /POINT DE SANTÉ/.test(m.opts.htmlBody));
});
test('pas mis en service (demarrerPointDuVendredi pas lancée) : aucun mail ; mis en service : il part ; arrêté : plus rien', () => {
  const g = environnement({ arrete: true });
  reveil(g, P(VENDREDI + ' 14:05'));
  assert.deepStrictEqual([g.mails.length, g.proprietes.VENDREDI_POINT], [0, undefined]);
  assert.ok(/⚠ Point du vendredi : PAS en service \(lancer demarrerPointDuVendredi\)/.test(g.ctx.verifierConfig()));
  const t = g.ctx.demarrerPointDuVendredi();
  assert.ok(/✅ Point du vendredi mis en service : un mail à bureau@loue\.test, le vendredi, .* après 14 h 00/.test(t) && !/⚠/.test(t), t);
  assert.ok(/déjà en service/.test(g.ctx.demarrerPointDuVendredi()));
  reveil(g, P(VENDREDI + ' 14:15'));
  assert.strictEqual(points(g).length, 1);
  assert.ok(/arrêté/.test(g.ctx.arreterPointDuVendredi()));
  reveil(g, P(VENDREDI_2 + ' 14:05'));
  assert.strictEqual(points(g).length, 1);
  // remis en service : le mail suivant reprend depuis le dernier mail parti (rien n'est oublié)
  g.ctx.demarrerPointDuVendredi();
  reveil(g, P(VENDREDI_3 + ' 14:05'));
  assert.ok(points(g).length === 2 && /depuis le 20\/11 à 14 h 15/.test(points(g)[1].texte), points(g)[1].texte);
  // sans le réveil des 10 minutes (copie TEST hors essais) : la mise en service le dit
  const h = environnement({ test: true, arrete: true });
  assert.ok(/⚠ Le réveil des 10 minutes \(traiterComptes\) n’est pas posé ici/.test(h.ctx.demarrerPointDuVendredi()));
});
test('changement d’heure : 14 h À PARIS, en été (UTC+2) comme en hiver (UTC+1)', () => {
  const g = environnement();
  reveil(g, P('2026-10-23 13:59', 'ete'));   // vendredi 23/10/2026, heure d'été : 13 h 59 à Paris = 11 h 59 en temps universel
  assert.strictEqual(g.mails.length, 0);
  reveil(g, P('2026-10-23 14:00', 'ete'));
  assert.deepStrictEqual([points(g).length, points(g)[0].sujet], [1, 'Point du vendredi 23/10 — rien à signaler']);
  // dimanche 25/10 : passage à l'heure d'hiver. Vendredi 30/10 : 13 h 59 à Paris = 12 h 59 en temps universel
  reveil(g, P('2026-10-30 13:59'));
  assert.strictEqual(points(g).length, 1, 'hiver, 13 h 59 : trop tôt');
  reveil(g, P('2026-10-30 14:00'));
  assert.deepStrictEqual([points(g).length, points(g)[1].sujet], [2, 'Point du vendredi 30/10 — rien à signaler']);
  assert.ok(/depuis le 23\/10 à 14 h 00/.test(points(g)[1].texte), 'la semaine se compte en instants, pas en heures d’horloge');
  // un jeudi à 23 h 30 en temps universel d'été est déjà vendredi à Paris (1 h 30) : toujours trop tôt
  const h = environnement();
  reveil(h, Date.parse('2026-07-09T23:30:00Z'));
  assert.strictEqual(h.mails.length, 0);
});
test('deux passages au même instant (réveil des 10 minutes et réveil « à la modification ») : un seul mail, un seul verrou demandé par passage', () => {
  const g = environnement();
  g.now = P(VENDREDI + ' 14:05');
  const avant = g.etat.verrousScript;
  g.ctx.traiterComptes();
  assert.strictEqual(g.etat.verrousScript - avant, 1, 'le point du vendredi ne redemande pas le verrou');
  g.ctx.traiterComptes();
  g.ctx.surModificationSheet({ range: { getSheet: () => ({ getName: () => 'Utilisateurs' }), getColumn: () => 4 } });
  assert.strictEqual(points(g).length, 1);
});
test('coût quand il n’y a rien à faire : du samedi au jeudi et le vendredi avant 14 h, ni lecture de mémoire ni lecture du Sheet ; après le mail, une lecture de mémoire par passage, aucune du Sheet', () => {
  const g = environnement();
  signalement(g, { recu: P(MARDI + ' 10:00') });
  let memoire = 0, sheet = 0;
  const etatVrai = g.ctx.venEtat_, mailVrai = g.ctx.venMail_;
  g.ctx.venEtat_ = () => { memoire++; return etatVrai(); };
  g.ctx.venMail_ = (a, b, c) => { sheet++; return mailVrai(a, b, c); };
  [MARDI + ' 14:10', JEUDI + ' 14:10', VENDREDI + ' 09:00', VENDREDI + ' 13:59', SAMEDI + ' 14:10'].forEach(q => reveil(g, P(q)));
  assert.deepStrictEqual([memoire, sheet], [0, 0]);
  reveil(g, P(VENDREDI + ' 14:00'));
  assert.deepStrictEqual([memoire, sheet, points(g).length], [1, 1, 1]);
  reveil(g, P(VENDREDI + ' 14:10')); reveil(g, P(VENDREDI + ' 16:00'));
  assert.deepStrictEqual([memoire, sheet], [3, 1], 'déjà fait : la mémoire seulement');
});

console.log('Lot 10b — ce que dit le mail');
test('signalements de la semaine (chantier, type, urgence, auteur, état), rappel des « Bloquant » restés « À traiter », point de santé ; l’objet résume', () => {
  const g = environnement({ feuilles: stockage('3,2 Go sur 15 Go (21 %)', '19/11/2026') });
  // la semaine : depuis 7 jours la première fois (vendredi 13/11 à 14 h 05)
  signalement(g, { recu: P('2026-11-13 14:00'), chantier: 'CHANTIER TEST 2', commentaire: 'juste avant la semaine' });
  signalement(g, { recu: P('2026-11-13 14:06'), chantier: 'CHANTIER TEST 2', type: 'Manquant', urgence: 'Pas urgent', auteur: 'Poseur B', statut: 'Commandé' });
  signalement(g, { recu: P(MARDI + ' 10:00'), type: 'Casse', urgence: 'Bloquant', statut: 'À traiter' });
  signalement(g, { recu: P(MARDI + ' 11:00'), type: 'À recommander', urgence: 'Cette semaine', statut: 'Livré' });
  signalement(g, { recu: P(JEUDI + ' 16:00'), chantier: 'CHANTIER TEST 2', type: 'Casse', urgence: 'Bloquant', auteur: 'Poseur B', statut: 'Clos' });
  // plus anciens : un « Bloquant » resté « À traiter » (rappel), un « Bloquant » commandé (pas de rappel), un « Pas urgent » à traiter (pas de rappel)
  signalement(g, { recu: P('2026-11-02 08:30'), chantier: 'CHANTIER TEST 2', type: 'Manquant', urgence: 'Bloquant', auteur: 'Poseur B', statut: 'À traiter' });
  signalement(g, { recu: P('2026-11-03 08:30'), urgence: 'Bloquant', statut: 'Commandé' });
  signalement(g, { recu: P('2026-11-03 09:30'), urgence: 'Pas urgent', statut: 'À traiter' });
  // santé : deux mails encore en attente (et un envoyé, un abandonné), des fiches en erreur ou en attente de leurs photos
  attente(g, P('2026-11-18 09:12'), 'en attente'); attente(g, P(JEUDI + ' 17:00'), 'en attente'); attente(g, P('2026-11-10 10:00'), 'envoyé'); attente(g, P('2026-11-09 10:00'), 'abandonné');
  envoi(g, P('2026-11-18 16:20'), 'quitus', 'erreur'); envoi(g, P(JEUDI + ' 08:05'), 'signalement', 'en attente de photos', 'CHANTIER TEST 2');
  envoi(g, P(JEUDI + ' 08:10'), 'cotes', 'en attente de photos'); envoi(g, P(JEUDI + ' 09:00'), 'note', 'traité'); envoi(g, P(JEUDI + ' 09:05'), 'demande', 'refusé');
  envoi(g, P(JEUDI + ' 09:10'), 'quitus', 'traité (incomplet)'); envoi(g, P(VENDREDI + ' 14:04'), 'quitus', 'en cours'); envoi(g, P('2026-10-01 09:00'), 'quitus', 'erreur');
  const avant = j([g.feuilles['Signalements'].lignes, g.feuilles['Envois'].lignes, g.feuilles['Mails en attente'].lignes, g.feuilles['Stockage'].lignes]);
  reveil(g, P(VENDREDI + ' 14:05'));
  const m = points(g)[0], p = parties(m);
  assert.strictEqual(m.sujet, 'Point du vendredi 20/11 — 4 signalements, 1 bloquant en retard, santé à regarder');
  assert.strictEqual(p.semaine, ['SIGNALEMENTS DE LA SEMAINE (depuis le 13/11 à 14 h 05) : 4', '  CHANTIER TEST 1 — Casse — Bloquant — Poseur A — À traiter',
    '  CHANTIER TEST 1 — À recommander — Cette semaine — Poseur A — Livré', '  CHANTIER TEST 2 — Manquant — Pas urgent — Poseur B — Commandé',
    '  CHANTIER TEST 2 — Casse — Bloquant — Poseur B — Clos'].join('\n'));
  assert.strictEqual(p.rappel, ['RAPPEL — « BLOQUANT » RESTÉS « À TRAITER » DEPUIS 7 JOURS OU PLUS : 1', '  CHANTIER TEST 2 — Manquant — Poseur B — le 02/11 — 18 jours'].join('\n'));
  assert.strictEqual(p.sante, ['POINT DE SANTÉ', '  Mails reportés encore en attente : 2 mails (le plus ancien : 18/11 à 9 h 12) — voir l’onglet « Mails en attente »',
    '  Place du compte Google : 3,2 Go sur 15 Go (21 %), mesurée le 19/11/2026',
    '  Fiches arrivées au bureau mais pas traitées : 1 en erreur, 2 en attente de leurs photos (la plus ancienne : 18/11 à 16 h 20) — voir l’onglet « Envois »',
    '  Quitus — CHANTIER TEST 1 — en erreur — reçue le 18/11 à 16 h 20', '  Signalement — CHANTIER TEST 2 — en attente de ses photos — reçue le 19/11 à 8 h 05',
    '  Prise de cotes — CHANTIER TEST 1 — en attente de ses photos — reçue le 19/11 à 8 h 10'].join('\n'));
  assert.ok(!/comptes? bloqué|dernière connexion|dans un téléphone/i.test(m.texte), 'rien que le serveur ne sait pas');
  assert.ok(/<th [^>]*>Chantier<\/th>/.test(m.opts.htmlBody) && /<td [^>]*>CHANTIER TEST 2<\/td><td [^>]*>Manquant<\/td>/.test(m.opts.htmlBody));
  assert.strictEqual(j([g.feuilles['Signalements'].lignes, g.feuilles['Envois'].lignes, g.feuilles['Mails en attente'].lignes, g.feuilles['Stockage'].lignes]), avant, 'le mail ne fait que LIRE : aucun onglet n’est modifié');
});
test('textes saisis par les poseurs : échappés dans le tableau HTML, sur une seule ligne dans le texte ; un état inconnu est lu « À traiter » ; une ligne sans date est ignorée', () => {
  const g = environnement();
  signalement(g, { recu: P(MARDI + ' 10:00'), chantier: 'CHANTIER <b>X</b> & "fils"', auteur: '<script>alert(1)</script>', type: 'Casse', statut: 'En cours de je ne sais quoi' });
  const sansDate = signalement(g, { recu: P(MARDI + ' 10:00'), chantier: 'SANS DATE' }); sansDate[1] = 'pas une date';
  const sansNumero = signalement(g, { recu: P(MARDI + ' 10:00'), chantier: 'SANS NUMERO' }); sansNumero[0] = '';
  reveil(g, P(VENDREDI + ' 14:05'));
  const m = points(g)[0];
  assert.ok(m.opts.htmlBody.indexOf('CHANTIER &lt;b&gt;X&lt;/b&gt; &amp; &quot;fils&quot;') > -1 && m.opts.htmlBody.indexOf('&lt;script&gt;alert(1)&lt;/script&gt;') > -1, m.opts.htmlBody);
  assert.ok(!/<script>|<b>X/.test(m.opts.htmlBody), 'aucune balise venue du Sheet');
  assert.ok(/ {2}CHANTIER <b>X<\/b> & "fils" — Casse — Cette semaine — <script>alert\(1\)<\/script> — À traiter/.test(m.texte), m.texte);
  assert.ok(!/SANS DATE|SANS NUMERO/.test(m.texte) && /Point du vendredi 20\/11 — 1 signalement,/.test(m.sujet), m.sujet);
});
test('beaucoup de signalements : 60 lignes au plus dans le mail, le reste est compté', () => {
  const g = environnement();
  for (let i = 0; i < 75; i++) signalement(g, { recu: P(MARDI + ' 10:00') + i * 60000, commentaire: 'n° ' + i });
  reveil(g, P(VENDREDI + ' 14:05'));
  const m = points(g)[0], p = parties(m);
  assert.strictEqual(m.sujet, 'Point du vendredi 20/11 — 75 signalements, rien d’autre à signaler');
  assert.deepStrictEqual([p.semaine.split('\n').length, /… et 15 autre\(s\) : voir l’onglet « Signalements »$/.test(p.semaine)], [62, true], p.semaine.slice(-200));
});
test('place du compte à 80 % ou plus : « santé à regarder » ; date de mesure écrite comme une vraie date : lue de même', () => {
  const g = environnement({ feuilles: stockage('12,3 Go sur 15 Go (82 %)', new Date(P(JEUDI + ' 02:10'))) });
  reveil(g, P(VENDREDI + ' 14:05'));
  const m = points(g)[0];
  assert.strictEqual(m.sujet, 'Point du vendredi 20/11 — santé à regarder');
  assert.ok(/Place du compte Google : 12,3 Go sur 15 Go \(82 %\), mesurée le 19\/11\/2026\n/.test(m.texte), m.texte);
  // onglet créé, mesure pas encore faite
  const h = environnement({ feuilles: stockage('', '') });
  reveil(h, P(VENDREDI + ' 14:05'));
  assert.ok(/Place du compte Google : pas encore mesurée\n/.test(points(h)[0].texte) && points(h)[0].sujet === 'Point du vendredi 20/11 — rien à signaler');
});

console.log('Lot 10b — un onglet absent ou illisible ne fait pas échouer le mail');
test('onglet « Stockage » absent : « pas encore mesurée », le reste est rempli', () => {
  const g = environnement();
  signalement(g, { recu: P(MARDI + ' 10:00') });
  assert.ok(!g.feuilles['Stockage']);
  reveil(g, P(VENDREDI + ' 14:05'));
  const m = points(g)[0];
  assert.ok(/Place du compte Google : pas encore mesurée \(onglet « Stockage » absent\)/.test(m.texte) && /CHANTIER TEST 1 — Casse/.test(m.texte), m.texte);
  assert.strictEqual(m.sujet, 'Point du vendredi 20/11 — 1 signalement, rien d’autre à signaler');
});
test('onglet « Signalements » illisible : ses deux parties disent « indisponible », le point de santé est rempli, le mail part', () => {
  const g = environnement({ feuilles: stockage('3,2 Go sur 15 Go (21 %)', '19/11/2026') });
  signalement(g, { recu: P(MARDI + ' 10:00') });
  attente(g, P(JEUDI + ' 17:00'), 'en attente');
  g.feuilles['Signalements'].api.getRange = () => { throw new Error('Service Spreadsheets indisponible'); };
  assert.strictEqual(reveil(g, P(VENDREDI + ' 14:05')), 'ok');
  const m = points(g)[0], p = parties(m);
  assert.strictEqual(m.sujet, 'Point du vendredi 20/11 — santé à regarder');
  assert.strictEqual(p.semaine, 'SIGNALEMENTS DE LA SEMAINE (depuis le 13/11 à 14 h 05)\n  indisponible (Service Spreadsheets indisponible)');
  assert.ok(/^RAPPEL — .* OU PLUS\n {2}indisponible \(Service Spreadsheets indisponible\)$/.test(p.rappel), p.rappel);
  assert.ok(/Mails reportés encore en attente : 1 mail \(le plus ancien : 19\/11 à 17 h 00\)/.test(p.sante) && /3,2 Go sur 15 Go/.test(p.sante), p.sante);
  assert.strictEqual(etat(g).fait, VENDREDI, 'le mail est parti : la semaine est réglée');
});
test('onglet « Signalements » absent, ou aux titres changés : « indisponible », avec la raison (rien n’est deviné)', () => {
  const g = environnement({ sansSignalements: true });
  reveil(g, P(VENDREDI + ' 14:05'));
  assert.ok(/SIGNALEMENTS DE LA SEMAINE \(depuis le 13\/11 à 14 h 05\)\n {2}indisponible \(onglet « Signalements » absent\)/.test(points(g)[0].texte), points(g)[0].texte);
  const h = environnement();
  signalement(h, { recu: P(MARDI + ' 10:00'), urgence: 'Bloquant' });
  h.feuilles['Signalements'].lignes[0][12] = 'État';
  reveil(h, P(VENDREDI + ' 14:05'));
  assert.ok(/indisponible \(les titres de l’onglet « Signalements » ont changé\)/.test(points(h)[0].texte) && !/CHANTIER TEST 1/.test(points(h)[0].texte), points(h)[0].texte);
});
test('onglets « Mails en attente », « Envois » ou « Stockage » illisibles : seule leur ligne dit « indisponible »', () => {
  const g = environnement({ feuilles: stockage('3,2 Go sur 15 Go (21 %)', '19/11/2026') });
  signalement(g, { recu: P(MARDI + ' 10:00') });
  attente(g, P(JEUDI + ' 17:00'), 'en attente'); envoi(g, P(JEUDI + ' 08:05'), 'quitus', 'erreur');
  ['Mails en attente', 'Envois', 'Stockage'].forEach(n => { g.feuilles[n].api.getRange = () => { throw new Error('panne de lecture'); }; });
  reveil(g, P(VENDREDI + ' 14:05'));
  const m = points(g)[0], p = parties(m);
  assert.strictEqual(p.sante, ['POINT DE SANTÉ', '  Mails reportés encore en attente : indisponible (panne de lecture)', '  Place du compte Google : indisponible (panne de lecture)',
    '  Fiches arrivées au bureau mais pas traitées : indisponible (panne de lecture)'].join('\n'));
  assert.ok(/CHANTIER TEST 1 — Casse/.test(p.semaine) && m.sujet === 'Point du vendredi 20/11 — 1 signalement, santé à regarder', m.sujet);
  // titres du haut de l'onglet « Stockage » changés : rien n'est deviné
  const h = environnement({ feuilles: { 'Stockage': [['Stockage'], ['Autre titre', '99 Go'], ['Mesurée le', '19/11/2026']] } });
  reveil(h, P(VENDREDI + ' 14:05'));
  assert.ok(/Place du compte Google : indisponible \(les titres de l’onglet « Stockage » ont changé\)/.test(points(h)[0].texte), points(h)[0].texte);
});

console.log('Lot 10b — le mail ne peut pas partir');
test('mail en échec à 14 h : la marque n’est pas posée ; le passage suivant le reprend (un seul mail), avec les signalements arrivés entre-temps', () => {
  const g = environnement();
  signalement(g, { recu: P(MARDI + ' 10:00') });
  g.etat.mailEnPanne = true;
  assert.strictEqual(reveil(g, P(VENDREDI + ' 14:00')), 'ok', 'le traitement des comptes n’est pas gêné');
  reveil(g, P(VENDREDI + ' 14:10'));
  assert.deepStrictEqual([g.mails.length, etat(g).fait, etat(g).envoi, /Service Gmail indisponible/.test(etat(g).echec)], [0, undefined, undefined, true]);
  assert.ok(/⚠ Dernier essai raté du point du vendredi : erreur : Service Gmail indisponible/.test(g.ctx.verifierConfig()));
  signalement(g, { recu: P(VENDREDI + ' 14:15'), chantier: 'CHANTIER TEST 2' });
  g.etat.mailEnPanne = false;
  reveil(g, P(VENDREDI + ' 14:20'));
  assert.deepStrictEqual([points(g).length, points(g)[0].sujet, etat(g).fait, etat(g).envoi, etat(g).echec],
    [1, 'Point du vendredi 20/11 — 2 signalements, rien d’autre à signaler', VENDREDI, P(VENDREDI + ' 14:20'), undefined]);
  reveil(g, P(VENDREDI + ' 14:30'));
  assert.strictEqual(points(g).length, 1);
});
test('quota épuisé tout l’après-midi : essais jusqu’à 18 h, puis abandon pour la semaine (une ligne au Journal), rien le samedi ; le vendredi suivant reprend depuis le dernier mail PARTI', () => {
  const g = environnement();
  reveil(g, P('2026-11-13 14:05'));   // le vendredi d'avant : un mail est parti
  assert.strictEqual(points(g).length, 1);
  signalement(g, { recu: P(MARDI + ' 10:00'), commentaire: 'semaine du mail abandonné' });
  g.etat.quota = 0;
  ['14:00', '14:10', '15:50', '17:00', '17:59'].forEach(h => { reveil(g, P(VENDREDI + ' ' + h)); assert.strictEqual(etat(g).fait, '2026-11-13', h); });
  assert.strictEqual(etat(g).echec, 'quota de mails du jour épuisé');
  reveil(g, P(VENDREDI + ' 18:00'));
  assert.deepStrictEqual([etat(g).fait, etat(g).envoi, etat(g).echec, points(g).length], [VENDREDI, P('2026-11-13 14:05'), undefined, 1], 'abandon : semaine réglée, sans mail');
  const journal = g.feuilles['Journal'].lignes.slice(1);
  assert.ok(journal.length === 1 && journal[0][1] === 'point du vendredi' && journal[0][4] === 'abandonné' && /pas parti avant 18 h 00 \(quota de mails du jour épuisé\) : pas de point cette semaine/.test(journal[0][5]), j(journal));
  assert.ok(/⚠ Le point du vendredi 20\/11\/2026 n’a pas pu partir \(abandonné à 18 h 00/.test(g.ctx.verifierConfig()));
  g.etat.quota = 100;
  ['18:10', '23:50'].forEach(h => reveil(g, P(VENDREDI + ' ' + h)));
  ['09:00', '14:05'].forEach(h => reveil(g, P(SAMEDI + ' ' + h)));
  assert.strictEqual(points(g).length, 1, 'pas de mail le samedi');
  signalement(g, { recu: P(LUNDI + ' 09:00'), chantier: 'CHANTIER TEST 2' });
  reveil(g, P(VENDREDI_2 + ' 14:05'));
  const m = points(g)[1];
  assert.ok(m && m.sujet === 'Point du vendredi 27/11 — 2 signalements, rien d’autre à signaler' && /depuis le 13\/11 à 14 h 05/.test(m.texte), m && m.sujet);
  assert.ok(!/n’a pas pu partir/.test(g.ctx.verifierConfig()));
});
test('le réveil ne tourne pas de 14 h à 18 h (panne chez Google) : au premier passage après 18 h, on n’envoie plus, la semaine est abandonnée', () => {
  const g = environnement();
  reveil(g, P(VENDREDI + ' 18:20'));
  assert.deepStrictEqual([g.mails.length, etat(g).fait, g.feuilles['Journal'].lignes.length], [0, VENDREDI, 2]);
});
test('vendredi suivant : un nouveau mail, avec les signalements créés depuis le mail précédent SEULEMENT ; un « Bloquant » de la semaine d’avant resté « À traiter » passe en rappel', () => {
  const g = environnement();
  signalement(g, { recu: P(MARDI + ' 10:00'), urgence: 'Bloquant', commentaire: 'première semaine' });
  reveil(g, P(VENDREDI + ' 14:05'));
  assert.ok(/1 signalement, rien d’autre à signaler/.test(points(g)[0].sujet));
  signalement(g, { recu: P(VENDREDI + ' 14:04'), chantier: 'AVANT LE MAIL' });   // arrivé une minute avant le mail : il y était
  signalement(g, { recu: P(VENDREDI + ' 14:06'), chantier: 'CHANTIER TEST 2', type: 'Manquant' });
  signalement(g, { recu: P(LUNDI + ' 08:00'), chantier: 'CHANTIER TEST 2', urgence: 'Bloquant', statut: 'Commandé' });
  reveil(g, P(VENDREDI_2 + ' 14:00'));
  const m = points(g)[1], p = parties(m);
  assert.strictEqual(m.sujet, 'Point du vendredi 27/11 — 2 signalements, 1 bloquant en retard, rien d’autre à signaler');
  assert.strictEqual(p.semaine, ['SIGNALEMENTS DE LA SEMAINE (depuis le 20/11 à 14 h 05) : 2', '  CHANTIER TEST 2 — Manquant — Cette semaine — Poseur A — À traiter',
    '  CHANTIER TEST 2 — Casse — Bloquant — Poseur A — Commandé'].join('\n'));
  assert.strictEqual(p.rappel.split('\n')[1], '  CHANTIER TEST 1 — Casse — Poseur A — le 17/11 — 10 jours');
  assert.strictEqual(points(g).length, 2);
  // le bloquant passe « Commandé » : plus de rappel la semaine suivante
  g.feuilles['Signalements'].lignes[1][12] = 'Commandé';
  reveil(g, P(VENDREDI_3 + ' 14:00'));
  assert.strictEqual(points(g)[2].sujet, 'Point du vendredi 04/12 — rien à signaler');
});
test('quota restant sous la réserve du bureau (5) : le mail part quand même, il est pris sur cette réserve', () => {
  const g = environnement({ quota: 5 });
  reveil(g, P(VENDREDI + ' 14:05'));
  assert.deepStrictEqual([points(g).length, g.etat.quota], [1, 4]);
  const h = environnement({ quota: 1 });
  reveil(h, P(VENDREDI + ' 14:05'));
  assert.deepStrictEqual([points(h).length, h.etat.quota], [1, 0]);
});

console.log('Lot 10b — les comptes, le récapitulatif « À commander » et le point du vendredi ne se gênent pas');
const demander = g => JSON.parse(g.ctx.doPost({ postData: { contents: JSON.stringify({ action: 'fiche', id: 'fiche-dem-' + String(++numero).padStart(6, '0'), saisiPar: 'poseura',
  jeton: g.ctx.fabriquerJeton_('poseura', 1), donnees: { type: 'demande', sorte: 'commander', quoi: 'Vis 4×40', quantite: '2 boîtes' } }) } }).contenu);
test('le point du vendredi plante : les comptes sont traités (mot de passe provisoire créé), le récapitulatif « À commander » part, le verrou est rendu', () => {
  const g = environnement();
  g.now = P(VENDREDI + ' 10:00');
  assert.ok(demander(g).ok);
  g.ctx.venPasser_ = () => { throw new Error('panne simulée du point du vendredi'); };
  g.feuilles['Utilisateurs'].lignes[2][4] = true;   // case « Réinitialiser » de Poseur B
  assert.strictEqual(reveil(g, P(VENDREDI + ' 15:50')), 'ok');
  const l = g.feuilles['Utilisateurs'].lignes[2];
  assert.ok(l[4] === false && String(l[5]).length === 8, j(l));
  assert.deepStrictEqual([recaps(g).length, points(g).length], [1, 0]);
  // la lecture de l'heure de Paris en panne dans le point du vendredi seulement (demHeure_ rétablie pour le récapitulatif)
  const h = environnement();
  h.now = P(VENDREDI + ' 10:00'); demander(h);
  h.ctx.venMail_ = () => { throw new Error('fabrication du mail en panne'); };
  assert.strictEqual(reveil(h, P(VENDREDI + ' 15:50')), 'ok');
  assert.deepStrictEqual([recaps(h).length, points(h).length, etat(h).fait], [1, 0, undefined], 'pas de marque : nouvel essai au passage suivant');
});
test('le récapitulatif « À commander » plante : le point du vendredi part quand même ; le traitement des comptes plante : les deux mails partent', () => {
  const g = environnement();
  g.now = P(VENDREDI + ' 10:00'); demander(g);
  g.ctx.demRecapituler_ = () => { throw new Error('panne simulée du récapitulatif'); };
  assert.strictEqual(reveil(g, P(VENDREDI + ' 15:50')), 'ok');
  assert.deepStrictEqual([recaps(g).length, points(g).length, etat(g).fait], [0, 1, VENDREDI]);
  const h = environnement();
  h.now = P(VENDREDI + ' 10:00'); demander(h);
  h.ctx.synchroniserAcces_ = () => { throw new Error('panne simulée des comptes'); };
  assert.ok(/^erreur : panne simulée des comptes/.test(reveil(h, P(VENDREDI + ' 15:50'))));
  assert.deepStrictEqual([recaps(h).length, points(h).length], [1, 1]);
});
test('vendredi à 15 h 45, les deux mails sont à faire au même passage : ils partent tous les deux (demandes + vendredi), chacun marqué, deux destinataires pris sur le quota', () => {
  const g = environnement({ quota: 100 });
  signalement(g, { recu: P(MARDI + ' 10:00') });
  g.now = P(VENDREDI + ' 10:00'); demander(g);
  g.etat.mailEnPanne = true;   // le point de 14 h n'a pas pu partir
  reveil(g, P(VENDREDI + ' 14:00')); reveil(g, P(VENDREDI + ' 15:40'));
  assert.strictEqual(g.mails.length, 0);
  g.etat.mailEnPanne = false;
  reveil(g, P(VENDREDI + ' 15:50'));
  assert.deepStrictEqual(g.mails.map(m => m.sujet), ['À commander — vendredi 20/11 (1 demande)', 'Point du vendredi 20/11 — 1 signalement, rien d’autre à signaler']);
  assert.deepStrictEqual([g.proprietes.DEMANDES_PASSAGE, etat(g).fait, g.etat.quota, g.feuilles['Demandes'].lignes[1][6]], [VENDREDI, VENDREDI, 98, '20/11/2026']);
  reveil(g, P(VENDREDI + ' 16:00'));
  assert.strictEqual(g.mails.length, 2, 'aucun doublon au passage suivant');
  // il ne reste qu'UN mail dans le quota : le récapitulatif des demandes passe d'abord, le point du vendredi réessaie ensuite
  const h = environnement({ quota: 1 });
  h.now = P(VENDREDI + ' 10:00'); demander(h);
  reveil(h, P(VENDREDI + ' 15:50'));
  assert.deepStrictEqual([recaps(h).length, points(h).length, etat(h).fait, etat(h).echec], [1, 0, undefined, 'quota de mails du jour épuisé']);
  h.etat.quota = 10;
  reveil(h, P(VENDREDI + ' 16:00'));
  assert.deepStrictEqual([recaps(h).length, points(h).length], [1, 1]);
});
test('verrou du script occupé : rien à ce passage (« occupé »), le passage suivant s’en charge', () => {
  const h = creerGoogle({ fuseaux: true, verrouOccupe: true, proprietes: { DRIVE_ROOT_ID: 'RACINE', DRIVE_PLANNING_ID: 'PLANNING', VENDREDI_POINT: '{"actif":true}' } });
  h.ctx = chargerScript(h);
  h.ctx.maintenant_ = () => P(VENDREDI + ' 14:05');
  assert.strictEqual(h.ctx.traiterComptes(), 'occupé');
  assert.deepStrictEqual([h.mails.length, h.proprietes.VENDREDI_POINT], [0, '{"actif":true}']);
});

console.log('Lot 10b — essai à la demande, vérification, livraison');
test('essaiPointDuVendredi : le mail du moment, à Franck seul, « [ESSAI] » dans l’objet, une ligne au Journal ; la marque de la semaine n’est pas touchée, le vrai mail part quand même', () => {
  const g = environnement({ test: true });
  signalement(g, { recu: P(MARDI + ' 10:00') });
  g.now = P(JEUDI + ' 11:00');
  const avant = g.proprietes.VENDREDI_POINT;
  const t = g.ctx.essaiPointDuVendredi();
  assert.ok(/^✅ Essai du point du vendredi \(TEST\) : mail envoyé à bureau@loue\.test seulement/.test(t) && /SIGNALEMENTS DE LA SEMAINE \(depuis le 12\/11 à 11 h 00\) : 1/.test(t), t);
  assert.deepStrictEqual([g.mails.length, g.mails[0].to, g.mails[0].sujet, g.mails[0].opts.attachments, g.proprietes.VENDREDI_POINT],
    [1, 'bureau@loue.test', '[ESSAI] Point du vendredi 19/11 — 1 signalement, rien d’autre à signaler', undefined, avant]);
  const journal = g.feuilles['Journal'].lignes.slice(1);
  assert.ok(journal.length === 1 && journal[0][4] === 'essai' && /essaiPointDuVendredi/.test(journal[0][5]), j(journal));
  reveil(g, P(VENDREDI + ' 14:05'));
  assert.ok(g.mails.length === 2 && g.mails[1].sujet === 'Point du vendredi 20/11 — 1 signalement, rien d’autre à signaler', j(g.mails.map(m => m.sujet)));
  // marche aussi sans la mise en service, et en production ; mail en panne : il le dit ; environnement incohérent : refus
  const h = environnement({ arrete: true });
  assert.ok(/^✅ Essai du point du vendredi \(PRODUCTION\)/.test(h.ctx.essaiPointDuVendredi()) && h.mails.length === 1 && h.proprietes.VENDREDI_POINT === undefined);
  h.etat.mailEnPanne = true;
  assert.ok(/^❌ Essai du point du vendredi : le mail n’est pas parti \(erreur : Service Gmail indisponible\)/.test(h.ctx.essaiPointDuVendredi()));
  const k = environnement({ proprietes: { ENVIRONNEMENT: 'TEST' }, arrete: true, sansInstallation: true });   // propriété TEST, mais Sheet de production
  assert.ok(/^❌ Refusé/.test(k.ctx.essaiPointDuVendredi()) && k.mails.length === 0);
});
test('verifierConfig : en service ou non, heure, dernier mail parti', () => {
  const g = environnement();
  let t = g.ctx.verifierConfig();
  assert.ok(/✅ Point du vendredi : en service — le vendredi, au premier passage du réveil des 10 minutes \(traiterComptes\) après 14 h 00 ; dernier mail parti : jamais/.test(t), t);
  reveil(g, P(VENDREDI + ' 14:05'));
  t = g.ctx.verifierConfig();
  assert.ok(/dernier mail parti : 20\/11 à 14 h 05/.test(t) && !/n’a pas pu partir|Dernier essai raté/.test(t), t);
});
test('réglages : 14 h, 18 h et 7 jours sont dans Config.gs ; une marque illisible en mémoire ne fait pas planter le passage', () => {
  const g = environnement();
  assert.deepStrictEqual(['VENDREDI_HEURE', 'VENDREDI_FIN_ESSAIS', 'VENDREDI_RAPPEL_JOURS'].map(n => vm.runInContext(n, g.ctx)), ['14:00', '18:00', 7]);
  g.proprietes.VENDREDI_POINT = 'pas du JSON';
  assert.strictEqual(reveil(g, P(VENDREDI + ' 14:05')), 'ok');
  assert.strictEqual(g.mails.length, 0, 'marque illisible : comme « pas en service », rien ne part');
  g.proprietes.VENDREDI_POINT = j({ actif: true, envoi: 'n’importe quoi', fait: 12 });
  reveil(g, P(VENDREDI + ' 14:15'));
  assert.ok(points(g).length === 1 && /depuis le 13\/11 à 14 h 15/.test(points(g)[0].texte), 'date du dernier mail illisible : depuis 7 jours');
});
test('livraison : le serveur à coller contient le lot 10b, dans la version de Config.gs, PointVendredi.gs à sa place, sans les outils d’essai ; chargé seul, il envoie le point du vendredi', () => {
  const code = fs.readFileSync(path.join(RACINE, 'A-COLLER-DANS-APPS-SCRIPT', 'Code.gs'), 'utf8');
  ["const VERSION_API = '" + VERSION_SERVEUR + "'", "const VENDREDI_HEURE      = '14:00';", "const VENDREDI_FIN_ESSAIS = '18:00';", 'const VENDREDI_RAPPEL_JOURS = 7;', 'function venPasser_(', 'function venMail_(',
    'function demarrerPointDuVendredi(', 'function arreterPointDuVendredi(', 'function essaiPointDuVendredi(', 'function verifierVendredi_(', 'try { venPasser_(); }', '████ PointVendredi.gs ████']
    .forEach(t => assert.ok(code.indexOf(t) > -1, t));
  assert.ok(code.indexOf('████ Demandes.gs ████') < code.indexOf('████ PointVendredi.gs ████') && code.indexOf('████ PointVendredi.gs ████') < code.indexOf('████ Admin.gs ████'));
  assert.ok(code.indexOf('try { demRecapituler_(); }') < code.indexOf('try { venPasser_(); }') && code.indexOf('try { venPasser_(); }') < code.indexOf('verrou.releaseLock();', code.indexOf('try { venPasser_(); }')));
  assert.ok(!/function\s+outilTest_\s*\(/.test(code));
  const morceau = code.slice(code.indexOf('████ PointVendredi.gs ████'), code.indexOf('████ ComptesRendus.gs ████'));
  assert.ok(!/getScriptTimeZone|getSpreadsheetTimeZone/.test(morceau), 'jamais le fuseau du projet');
  assert.ok(!/\.(setValue|setValues|appendRow|deleteRow|clearContent|insertSheet)\(/.test(morceau), 'le point du vendredi n’écrit dans aucun onglet');
  const g = environnement({ codeUnique: path.join(RACINE, 'A-COLLER-DANS-APPS-SCRIPT', 'Code.gs') });
  assert.strictEqual(g.ctx.doGet({ parameter: {} }).contenu, 'Loué App API ' + VERSION_SERVEUR + ' OK');
  signalement(g, { recu: P(MARDI + ' 10:00') });
  reveil(g, P(VENDREDI + ' 14:05'));
  assert.strictEqual(points(g)[0].sujet, 'Point du vendredi 20/11 — 1 signalement, rien d’autre à signaler');
});

console.log(reussis + ' test(s) réussi(s)' + (process.exitCode ? ' — DES TESTS ÉCHOUENT' : ''));
