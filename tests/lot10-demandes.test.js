// Tests des lots 10a-1 et 10a-2, côté serveur (« À commander » : demandes des poseurs, récapitulatif de 15 h 45, liste « Articles ») : node tests/lot10-demandes.test.js
// Faux Google (tests/gas-harness.js) avec une HORLOGE RÉGLABLE (g.now) et l'heure calculée dans le fuseau demandé
// (option « fuseaux ») : les tests donnent le même résultat quel que soit le réglage du PC, heure d'été comprise.
// Noms inventés (« Poseur A », « Poseur B ») : le dépôt est public.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { creerGoogle, chargerScript } = require('./gas-harness');
const construire = require('../outils/construire.js');
const RACINE = path.join(__dirname, '..');

// Un instant donné à l'heure de PARIS : P('2026-11-17 15:40') (hiver, UTC+1) ; P('2026-10-23 15:50', 'ete') (été, UTC+2)
const P = (texte, saison) => Date.parse(texte.replace(' ', 'T') + ':00' + (saison === 'ete' ? '+02:00' : '+01:00'));
const MARDI = '2026-11-17', MERCREDI = '2026-11-18', VENDREDI = '2026-11-20', SAMEDI = '2026-11-21', DIMANCHE = '2026-11-22', LUNDI = '2026-11-23';

function environnement(o = {}) {
  const g = creerGoogle({
    fuseaux: true,
    nomSheet: o.test ? 'ChantierPro TEST' : 'ChantierPro',
    quota: o.quota,
    proprietes: Object.assign({ DRIVE_ROOT_ID: 'RACINE', DRIVE_PLANNING_ID: 'PLANNING', HACHAGE_ITERATIONS: '200', EMAIL_ADMIN: 'bureau@loue.test' },
      o.test ? { ENVIRONNEMENT: 'TEST' } : {}, o.proprietes || {}),
    feuilles: Object.assign({
      'Contacts': [['Nom', 'Role', 'Email', 'ChefEquipe', 'Destinataire', 'ConducteurDefaut', 'ChefAtelier', 'absenceNotif'],
        ['Conducteur Essai', 'Conducteur de travaux', 'bureau@loue.test', 'O', 'N', 'O', 'N', 'O']],
      'Contacts notes': [['Nom', 'Email']],
      'Chantiers': [['Nom', 'Référence', 'Statut', 'Conducteur'], ['CHANTIER TEST 1', 'LIEU 1', 'En cours', 'Conducteur Essai']],
    }, o.feuilles || {}),
  });
  g.creerElement('dossier', 'Loué Menuiserie - Chantiers', null, { id: 'RACINE' });
  g.creerElement('dossier', 'Planning', null, { id: 'PLANNING' });
  g.ctx = chargerScript(g);
  g.now = P(MARDI + ' 09:00');
  g.ctx.maintenant_ = () => g.now;   // l'horloge du serveur, réglable
  g.ctx.genererCle(); g.ctx.preparerOngletsLot2();
  const u = g.feuilles['Utilisateurs'];
  u.lignes[1] = ['poseura', 'Poseur A', 'Poseur', true, false, '', '', false, false, ''];
  u.lignes[2] = ['poseurb', 'Poseur B', 'Poseur', true, false, '', '', false, false, ''];
  u.lignes[3] = ['bureau', 'Conducteur Essai', 'Admin', true, false, '', '', false, false, ''];
  g.ctx.traiterComptes();
  if (!o.sansInstallation) { const t = (o.test ? g.ctx.installerLot10Test : g.ctx.installerLot10Production)(); assert.ok(/installation terminée/.test(t), t); }
  g.mails.length = 0;
  return g;
}
const poster = (g, corps) => JSON.parse(g.ctx.doPost({ postData: { contents: JSON.stringify(corps) } }).contenu);
const jeton = (g, id) => g.ctx.fabriquerJeton_(id, 1);
let numero = 0;
const idFiche = () => 'fiche-lot10-' + String(++numero).padStart(6, '0');
const demande = extra => Object.assign({ type: 'demande', sorte: 'commander', quoi: 'Vis 4×40', quantite: '2 boîtes' }, extra || {});
// envoi d'une demande par « qui » (le téléphone déclare la même personne, comme le fait la file d'attente)
const envoyer = (g, qui, donnees, id, saisiPar) => poster(g, Object.assign({ action: 'fiche', id: id || idFiche(), donnees: donnees || demande(), saisiPar: saisiPar === undefined ? qui : saisiPar },
  qui ? { jeton: jeton(g, qui) } : {}));
const mes = (g, qui) => poster(g, Object.assign({ action: 'demandes' }, qui ? { jeton: jeton(g, qui) } : {}));
// lot 10a-2 : la page dit quelle liste « Articles » elle garde déjà (son empreinte ; '' : aucune)
const mesAvec = (g, qui, empreinte) => poster(g, Object.assign({ action: 'demandes', articles: empreinte || '' }, qui ? { jeton: jeton(g, qui) } : {}));
const articles = (g, lignes) => { g.feuilles['Articles'].lignes = lignes.map(t => [t]); };
const reveil = (g, quand) => { if (quand) g.now = quand; return g.ctx.traiterComptes(); };   // un passage du réveil des 10 minutes
const D = g => (g.feuilles['Demandes'] ? g.feuilles['Demandes'].lignes.slice(1).filter(l => l[8]) : []);
const E = g => (g.feuilles['Envois'] ? g.feuilles['Envois'].lignes.slice(1) : []);
const C = { date: 0, poseur: 1, type: 2, quoi: 3, quantite: 4, commande: 5, recap: 6, compte: 7, fiche: 8 };
const TITRES = ['Date', 'Poseur', 'Type', 'Quoi', 'Quantité', 'Commandé', 'Récapitulatif du', 'Compte', 'N° de fiche'];
const recaps = g => g.mails.filter(m => /^À commander — /.test(m.sujet));
const estDate = v => Object.prototype.toString.call(v) === '[object Date]';
const j = x => JSON.stringify(x);

let reussis = 0;
function test(nom, fn) {
  try { fn(); reussis++; console.log('  ✓ ' + nom); }
  catch (e) { console.log('  ✗ ' + nom + '\n    ' + String(e.stack || e.message).split('\n').slice(0, 6).join('\n    ')); process.exitCode = 1; }
}

console.log('Lot 10a-1 — recevoir une demande');
test('une demande : une ligne dans « Demandes » (9 colonnes, nom du COMPTE, case « Commandé » posée et décochée), aucun mail, Envois « traité »', () => {
  const g = environnement(), id = idFiche();
  const r = envoyer(g, 'poseura', demande(), id);
  assert.deepStrictEqual([r.ok, r.code, r.data.id, r.data.recap.aujourdhui, r.data.recap.jour], [true, 'ENREGISTRE', id, true, 'mardi 17/11'], j(r));
  assert.strictEqual(r.data.recap.texte, '✓ Elle part dans le récapitulatif d’aujourd’hui (vers 15 h 45).');
  assert.deepStrictEqual(Array.from(g.feuilles['Demandes'].lignes[0]), TITRES);
  const l = D(g);
  assert.strictEqual(l.length, 1);
  assert.deepStrictEqual(Array.from(l[0].slice(1)), ['Poseur A', 'À commander', 'Vis 4×40', '2 boîtes', false, '', 'poseura', id]);
  assert.ok(estDate(l[0][C.date]) && l[0][C.date].getTime() === g.now);
  assert.strictEqual(l[0].length, 9, 'neuf colonnes, pas une de plus');
  assert.strictEqual(g.feuilles['Demandes'].cases, 1, 'une seule case posée : celle de la nouvelle ligne');
  assert.strictEqual(g.mails.length, 0, 'aucun mail à l’envoi');
  assert.deepStrictEqual([E(g)[0][0], E(g)[0][2], E(g)[0][4], E(g)[0][5], E(g)[0][6]], [id, 'demande', 'traité', 'demande « À commander » (aucun mail à l’envoi)', 'poseura']);
});
test('« Outil en panne » : le second champ est une précision facultative ; un nom tapé dans les données est ignoré (le poseur est celui du compte)', () => {
  const g = environnement();
  assert.ok(envoyer(g, 'poseurb', demande({ sorte: 'panne', quoi: 'Visseuse à choc', quantite: '', poseur: 'Quelqu’un d’autre', auteur: 'Faux nom' })).ok);
  assert.ok(envoyer(g, 'poseurb', { type: 'demande', sorte: 'panne', quoi: 'Scie sauteuse' }).ok, 'précision absente : acceptée');
  assert.deepStrictEqual(D(g).map(l => l.slice(1, 5).concat([l[C.compte]])), [['Poseur B', 'Outil en panne', 'Visseuse à choc', '', 'poseurb'], ['Poseur B', 'Outil en panne', 'Scie sauteuse', '', 'poseurb']]);
});
test('la même demande renvoyée deux fois (réponse perdue) : une seule ligne, « déjà reçue », et la case cochée entre-temps n’est pas décochée', () => {
  const g = environnement(), id = idFiche();
  assert.ok(envoyer(g, 'poseura', demande(), id).ok);
  g.feuilles['Demandes'].lignes[1][C.commande] = true;   // Franck a coché tout de suite
  const r2 = envoyer(g, 'poseura', demande(), id), r3 = envoyer(g, 'poseura', demande(), id);
  assert.deepStrictEqual([r2.ok, r2.code, r3.code, r2.data.recap.aujourdhui], [true, 'DEJA_RECU', 'DEJA_RECU', true], j(r2));
  assert.deepStrictEqual([D(g).length, D(g)[0][C.commande], E(g).length], [1, true, 1]);
  // renvoyée après le récapitulatif : la réponse dit dans lequel elle est partie
  reveil(g, P(MARDI + ' 15:50'));
  const r4 = envoyer(g, 'poseura', demande(), id);
  assert.deepStrictEqual([r4.code, r4.data.recap.texte], ['DEJA_RECU', '✓ Demande déjà reçue : elle est dans le récapitulatif du 17/11.'], j(r4));
  assert.strictEqual(D(g).length, 1);
});
test('la ligne existe mais l’onglet Envois dit « en cours » (panne au milieu) : le renvoi ne l’écrit pas deux fois', () => {
  const g = environnement(), id = idFiche();
  assert.ok(envoyer(g, 'poseura', demande(), id).ok);
  g.feuilles['Envois'].lignes[1][4] = 'erreur';
  const r = envoyer(g, 'poseura', demande(), id);
  assert.deepStrictEqual([r.ok, r.code, D(g).length], [true, 'ENREGISTRE', 1], j(r));
});
test('texte : retour à la ligne et tabulation deviennent une espace ; un texte qui commence par « = » ne devient pas une formule', () => {
  const g = environnement();
  assert.ok(envoyer(g, 'poseura', demande({ quoi: '  Cartouches\nsilicone\tblanc  ', quantite: '=1+1' })).ok);
  assert.ok(envoyer(g, 'poseura', demande({ quoi: '=IMPORTDATA("http://exemple.invalid")', quantite: '+33' })).ok);
  assert.deepStrictEqual(D(g).map(l => [l[C.quoi], l[C.quantite]]), [['Cartouches silicone blanc', "'=1+1"], ["'=IMPORTDATA(\"http://exemple.invalid\")", "'+33"]]);
});

console.log('Lot 10a-1 — compte obligatoire, téléphone partagé');
test('sans compte (transition ouverte ou finie) : « connexion requise », rien d’écrit nulle part ; jeton faux : pareil', () => {
  const g = environnement();
  let r = envoyer(g, '', demande());
  assert.deepStrictEqual([r.ok, r.code], [false, 'CONNEXION_REQUISE'], j(r));
  g.proprietes.FIN_TRANSITION = String(g.now - 1000);
  r = envoyer(g, '', demande());
  assert.deepStrictEqual([r.ok, r.code], [false, 'CONNEXION_REQUISE'], j(r));
  r = poster(g, { action: 'fiche', id: idFiche(), donnees: demande(), jeton: 'poseura.p.1.9999999999999.signaturefaussesignaturefausse', saisiPar: 'poseura' });
  assert.deepStrictEqual([r.ok, r.code], [false, 'JETON_INVALIDE'], j(r));
  assert.deepStrictEqual([D(g).length, E(g).length, !!g.feuilles['Sans compte'], g.mails.length], [0, 0, false, 0]);
  r = mes(g, '');
  assert.deepStrictEqual([r.ok, r.code], [false, 'CONNEXION_REQUISE'], j(r));
});
test('téléphone partagé : ce qu’a écrit Poseur A ne part pas sous le nom de Poseur B (cela attend) ; compte désactivé : refusé, gardé dans le téléphone', () => {
  const g = environnement(), id = idFiche();
  let r = envoyer(g, 'poseurb', demande(), id, 'poseura');
  assert.deepStrictEqual([r.ok, r.code], [false, 'COMPTE_REFUSE'], j(r));
  assert.ok(/écrit par « poseura »/.test(r.message), r.message);
  assert.strictEqual(D(g).length, 0);
  r = envoyer(g, 'poseura', demande(), id, 'poseura');
  assert.ok(r.ok && D(g)[0][C.poseur] === 'Poseur A');
  g.feuilles['Utilisateurs'].lignes[2][3] = false; g.ctx.traiterComptes();
  r = envoyer(g, 'poseurb', demande());
  assert.deepStrictEqual([r.ok, r.code, D(g).length], [false, 'COMPTE_REFUSE', 1], j(r));
});
test('ancien format (page d’avant le lot 1, sans numéro de fiche) : refusé, rien d’écrit', () => {
  const g = environnement();
  const r = poster(g, demande());
  assert.strictEqual(r.status, 'error', j(r));
  assert.strictEqual(D(g).length, 0);
});

console.log('Lot 10a-1 — limites');
test('« Quoi ? » : 80 caractères acceptés, 81 refusés, vide refusé ; quantité : 30 acceptés, 31 refusés ; choix inconnu refusé — refus définitifs, rien d’écrit', () => {
  const g = environnement();
  assert.ok(envoyer(g, 'poseura', demande({ quoi: 'x'.repeat(80), quantite: 'y'.repeat(30) })).ok);
  const refus = [demande({ quoi: 'x'.repeat(81) }), demande({ quoi: '   ' }), demande({ quoi: 12 }), demande({ quantite: 'y'.repeat(31) }), demande({ quantite: 3 }),
    demande({ sorte: 'autre' }), demande({ sorte: undefined }), demande({ quoi: 'Vis\u0000' })];
  refus.forEach(d => { const r = envoyer(g, 'poseura', d); assert.deepStrictEqual([r.ok, r.code], [false, 'DONNEES_INVALIDES'], j([d, r])); });
  assert.deepStrictEqual([D(g).length, E(g).length, g.mails.length], [1, 1, 0], 'un refus ne réserve aucun numéro et ne prévient personne');
});
test('30 demandes par compte et par jour : la 31e est refusée (message clair), un autre compte n’est pas touché, le lendemain c’est reparti', () => {
  const g = environnement(), ids = [];
  for (let i = 0; i < 30; i++) { const id = idFiche(); ids.push(id); assert.ok(envoyer(g, 'poseura', demande({ quoi: 'Article ' + i }), id).ok, 'demande ' + i); }
  const r = envoyer(g, 'poseura', demande({ quoi: 'La 31e' }));
  assert.deepStrictEqual([r.ok, r.code], [false, 'DONNEES_INVALIDES'], j(r));
  assert.ok(/^30 demandes par jour au plus/.test(r.message), r.message);
  assert.strictEqual(envoyer(g, 'poseura', demande({ quoi: 'Article 3' }), ids[3]).code, 'DEJA_RECU', 'un renvoi n’est pas compté');
  assert.ok(envoyer(g, 'poseurb', demande()).ok, 'autre compte');
  assert.strictEqual(D(g).length, 31);
  g.now = P(MERCREDI + ' 00:05');
  assert.ok(envoyer(g, 'poseura', demande({ quoi: 'Le lendemain' })).ok);
  // le jour compté est celui de PARIS : 23 h 30 la veille (22 h 30 en temps universel) compte pour la veille
  const h = environnement();
  h.now = P(MARDI + ' 23:30');
  for (let i = 0; i < 30; i++) assert.ok(envoyer(h, 'poseura', demande({ quoi: 'Soir ' + i })).ok);
  h.now = P(MARDI + ' 23:59');
  assert.strictEqual(envoyer(h, 'poseura', demande()).code, 'DONNEES_INVALIDES');
  h.now = P(MERCREDI + ' 00:01');
  assert.ok(envoyer(h, 'poseura', demande()).ok);
});

console.log('Lot 10a-1 — le récapitulatif de 15 h 45');
test('avant 15 h 45 : rien ne part ; au premier passage après : UN mail au bureau, sans pièce jointe, puis la date sur les lignes, puis la marque du jour', () => {
  const g = environnement({ quota: 100 });
  envoyer(g, 'poseura', demande());
  envoyer(g, 'poseurb', demande({ quoi: 'Cartouches silicone blanc', quantite: '6' }));
  envoyer(g, 'poseura', demande({ sorte: 'panne', quoi: 'Visseuse à choc', quantite: 'ne charge plus' }));
  assert.strictEqual(reveil(g, P(MARDI + ' 15:40')), 'ok');
  assert.deepStrictEqual([g.mails.length, g.proprietes.DEMANDES_PASSAGE], [0, undefined], 'pas avant l’heure');
  assert.strictEqual(reveil(g, P(MARDI + ' 15:50')), 'ok');
  const m = recaps(g);
  assert.strictEqual(m.length, 1);
  assert.deepStrictEqual([m[0].to, m[0].sujet, m[0].opts.attachments, m[0].opts.bcc], ['bureau@loue.test', 'À commander — mardi 17/11 (3 demandes)', undefined, undefined]);
  assert.strictEqual(m[0].texte.split('\n\n')[0], ['À COMMANDER', '  Poseur A — Vis 4×40 — 2 boîtes', '  Poseur B — Cartouches silicone blanc — 6', 'OUTIL EN PANNE', '  Poseur A — Visseuse à choc — ne charge plus'].join('\n'));
  assert.ok(!/chantier|signalement/i.test(m[0].texte.split('\n\n')[0]), 'ni chantier, ni signalements');
  assert.ok(/<b>À COMMANDER<\/b>/.test(m[0].opts.htmlBody) && /Cartouches silicone blanc/.test(m[0].opts.htmlBody));
  assert.deepStrictEqual(D(g).map(l => l[C.recap]), ['17/11/2026', '17/11/2026', '17/11/2026']);
  assert.strictEqual(g.proprietes.DEMANDES_PASSAGE, MARDI);
  assert.strictEqual(g.etat.quota, 99, 'un seul destinataire pris sur le quota');
  // les passages suivants du même jour ne renvoient rien
  reveil(g, P(MARDI + ' 16:00')); reveil(g, P(MARDI + ' 17:40')); reveil(g, P(MARDI + ' 23:50'));
  assert.strictEqual(recaps(g).length, 1);
});
test('une demande arrivée APRÈS le passage du jour : la réponse nomme le jour suivant ; elle part dans le récapitulatif de ce jour-là, seule', () => {
  const g = environnement();
  envoyer(g, 'poseura', demande());
  reveil(g, P(MARDI + ' 15:50'));
  g.now = P(MARDI + ' 15:52');
  const r = envoyer(g, 'poseurb', demande({ quoi: 'Mousse expansive', quantite: '3' }));
  assert.deepStrictEqual([r.data.recap.aujourdhui, r.data.recap.jour, r.data.recap.texte],
    [false, 'mercredi 18/11', '✓ Le récapitulatif d’aujourd’hui est déjà parti : elle sera dans celui de mercredi 18/11.'], j(r));
  assert.deepStrictEqual(D(g).map(l => l[C.recap]), ['17/11/2026', '']);
  reveil(g, P(MERCREDI + ' 15:46'));
  const m = recaps(g);
  assert.strictEqual(m.length, 2);
  assert.strictEqual(m[1].sujet, 'À commander — mercredi 18/11 (1 demande)');
  assert.ok(/Mousse expansive/.test(m[1].texte) && !/Vis 4×40/.test(m[1].texte) && !/NON ENVOYÉES/.test(m[1].texte), m[1].texte);
  assert.deepStrictEqual(D(g).map(l => l[C.recap]), ['17/11/2026', '18/11/2026']);
});
test('c’est la MARQUE du jour qui compte, pas l’horloge : à 15 h 47, tant que le réveil n’est pas passé, la demande part aujourd’hui', () => {
  const g = environnement();
  g.now = P(MARDI + ' 15:47');
  const r = envoyer(g, 'poseura', demande());
  assert.strictEqual(r.data.recap.aujourdhui, true, j(r));
  reveil(g, P(MARDI + ' 15:53'));
  assert.ok(recaps(g).length === 1 && /Vis 4×40/.test(recaps(g)[0].texte));
});
test('aucune demande : aucun mail, mais le passage du jour est marqué (une demande qui arrive ensuite part le lendemain)', () => {
  const g = environnement();
  reveil(g, P(MARDI + ' 15:50'));
  assert.deepStrictEqual([g.mails.length, g.proprietes.DEMANDES_PASSAGE], [0, MARDI]);
  g.now = P(MARDI + ' 16:10');
  const r = envoyer(g, 'poseura', demande());
  assert.deepStrictEqual([r.data.recap.aujourdhui, r.data.recap.jour], [false, 'mercredi 18/11'], j(r));
  reveil(g, P(MARDI + ' 16:20'));
  assert.strictEqual(g.mails.length, 0);
  // l'onglet n'existe pas encore (lot pas installé) : le passage ne plante pas et ne crée rien
  const h = environnement({ sansInstallation: true });
  assert.strictEqual(reveil(h, P(MARDI + ' 15:50')), 'ok');
  assert.deepStrictEqual([h.mails.length, h.proprietes.DEMANDES_PASSAGE, !!h.feuilles['Demandes']], [0, MARDI, false]);
});
test('vendredi après le passage, samedi, dimanche : la réponse dit « lundi 23/11 » ; aucun récapitulatif le week-end ; lundi, tout part', () => {
  const g = environnement();
  reveil(g, P(VENDREDI + ' 15:50'));
  g.now = P(VENDREDI + ' 16:30');
  let r = envoyer(g, 'poseura', demande({ quoi: 'Vendredi soir' }));
  assert.deepStrictEqual([r.data.recap.aujourdhui, r.data.recap.jour], [false, 'lundi 23/11'], j(r));
  assert.ok(/déjà parti : elle sera dans celui de lundi 23\/11\.$/.test(r.data.recap.texte), r.data.recap.texte);
  g.now = P(SAMEDI + ' 10:00');
  r = envoyer(g, 'poseura', demande({ quoi: 'Samedi' }));
  assert.deepStrictEqual([r.data.recap.aujourdhui, r.data.recap.texte], [false, '✓ Elle sera dans le récapitulatif de lundi 23/11.'], j(r));
  g.now = P(DIMANCHE + ' 20:00');
  r = envoyer(g, 'poseurb', demande({ quoi: 'Dimanche' }));
  assert.strictEqual(r.data.recap.jour, 'lundi 23/11');
  reveil(g, P(SAMEDI + ' 16:00')); reveil(g, P(DIMANCHE + ' 16:00'));
  assert.deepStrictEqual([g.mails.length, g.proprietes.DEMANDES_PASSAGE], [0, VENDREDI], 'rien le week-end');
  g.now = P(LUNDI + ' 08:00');
  r = envoyer(g, 'poseurb', demande({ quoi: 'Lundi matin' }));
  assert.deepStrictEqual([r.data.recap.aujourdhui, r.data.recap.jour], [true, 'lundi 23/11'], j(r));
  reveil(g, P(LUNDI + ' 15:45'));
  const m = recaps(g);
  assert.deepStrictEqual([m.length, m[0].sujet], [1, 'À commander — lundi 23/11 (4 demandes)']);
  assert.ok(['Vendredi soir', 'Samedi', 'Dimanche', 'Lundi matin'].every(t => m[0].texte.indexOf(t) > -1) && !/NON ENVOYÉES/.test(m[0].texte), m[0].texte);
});
test('changement d’heure : l’heure limite est 15 h 45 À PARIS, en été (UTC+2) comme en hiver (UTC+1)', () => {
  // vendredi 23/10/2026, heure d'été : 15 h 40 à Paris = 13 h 40 en temps universel
  const g = environnement();
  g.now = P('2026-10-23 10:00', 'ete');
  envoyer(g, 'poseura', demande());
  reveil(g, P('2026-10-23 15:40', 'ete'));
  assert.strictEqual(g.mails.length, 0, 'été, 15 h 40 : trop tôt');
  reveil(g, P('2026-10-23 15:50', 'ete'));
  assert.deepStrictEqual([recaps(g).length, recaps(g)[0].sujet, D(g)[0][C.recap]], [1, 'À commander — vendredi 23/10 (1 demande)', '23/10/2026']);
  // dimanche 25/10 : passage à l'heure d'hiver. Lundi 26/10 : 15 h 40 à Paris = 14 h 40 en temps universel
  g.now = P('2026-10-26 09:00');
  const r = envoyer(g, 'poseura', demande({ quoi: 'Après le changement d’heure' }));
  assert.deepStrictEqual([r.data.recap.aujourdhui, r.data.recap.jour], [true, 'lundi 26/10'], j(r));
  reveil(g, P('2026-10-26 15:40'));
  assert.strictEqual(recaps(g).length, 1, 'hiver, 15 h 40 : trop tôt');
  reveil(g, P('2026-10-26 15:50'));
  assert.deepStrictEqual([recaps(g).length, recaps(g)[1].sujet], [2, 'À commander — lundi 26/10 (1 demande)']);
  // et au printemps : vendredi 27/03/2026 (hiver), lundi 30/03/2026 (été)
  const h = environnement();
  h.now = P('2026-03-27 12:00'); envoyer(h, 'poseura', demande());
  reveil(h, P('2026-03-27 15:44')); assert.strictEqual(h.mails.length, 0);
  reveil(h, P('2026-03-27 15:45')); assert.strictEqual(recaps(h).length, 1);
  h.now = P('2026-03-30 12:00', 'ete'); envoyer(h, 'poseura', demande());
  reveil(h, P('2026-03-30 15:44', 'ete')); assert.strictEqual(recaps(h).length, 1);
  reveil(h, P('2026-03-30 15:45', 'ete')); assert.strictEqual(recaps(h).length, 2);
});
test('deux passages au même instant : un seul mail', () => {
  const g = environnement();
  envoyer(g, 'poseura', demande());
  g.now = P(MARDI + ' 15:50');
  g.ctx.traiterComptes(); g.ctx.traiterComptes();
  g.ctx.surModificationSheet({ range: { getSheet: () => ({ getName: () => 'Utilisateurs' }), getColumn: () => 4 } });   // le réveil « à la modification » lance le même traitement
  assert.strictEqual(recaps(g).length, 1);
});
test('panne pendant l’écriture des dates, après l’envoi du mail : le passage suivant écrit les dates SANS renvoyer le mail', () => {
  const g = environnement();
  g.now = P(MARDI + ' 10:00'); envoyer(g, 'poseura', demande());
  const vraie = g.ctx.demMarquer_;
  g.ctx.demMarquer_ = () => { throw new Error('panne du Sheet'); };
  reveil(g, P(MARDI + ' 15:50'));
  assert.strictEqual(recaps(g).length, 1, 'le mail est parti');
  assert.strictEqual(D(g)[0][C.recap], '', 'la date n’a pas pu être écrite');
  reveil(g, P(MARDI + ' 16:00'));
  assert.strictEqual(recaps(g).length, 1, 'panne qui dure : toujours un seul mail');
  // une demande arrive après l'envoi du mail : elle ne doit PAS être datée d'aujourd'hui
  g.now = P(MARDI + ' 16:05'); envoyer(g, 'poseurb', demande({ quoi: 'Cales' }));
  g.ctx.demMarquer_ = vraie;
  reveil(g, P(MARDI + ' 16:10'));
  assert.strictEqual(recaps(g).length, 1, 'réparé : les dates sont écrites, aucun second mail');
  assert.deepStrictEqual(D(g).map(l => [l[C.quoi], l[C.recap]]), [['Vis 4×40', '17/11/2026'], ['Cales', '']]);
  reveil(g, P(MERCREDI + ' 15:50'));
  assert.strictEqual(recaps(g).length, 2);
  assert.ok(/Cales/.test(recaps(g)[1].texte || recaps(g)[1].corps || j(recaps(g)[1])) && !/Vis 4×40/.test(j(recaps(g)[1])), 'le mail du lendemain ne porte que la demande arrivée après');
});
test('texte hostile : échappé dans le HTML du mail', () => {
  const g = environnement();
  g.now = P(MARDI + ' 10:00'); envoyer(g, 'poseura', demande({ quoi: '<img src=x onerror=alert(1)>', quantite: '<b>2</b>' }));
  reveil(g, P(MARDI + ' 15:50'));
  const m = String(recaps(g)[0].opts.htmlBody);
  assert.ok(!/<img src=x/.test(m) && !/<b>2<\/b>/.test(m), m);
  assert.ok(/&lt;img src=x onerror=alert\(1\)&gt;/.test(m) && /&lt;b&gt;2&lt;\/b&gt;/.test(m), m);
});
test('quota de mails presque épuisé (5 restants, sous la réserve du bureau) : le récapitulatif part quand même, il est pris sur cette réserve', () => {
  const g = environnement({ quota: 5 });
  envoyer(g, 'poseura', demande());
  reveil(g, P(MARDI + ' 15:50'));
  assert.deepStrictEqual([recaps(g).length, g.etat.quota], [1, 4]);
});
test('l’onglet a été trié pendant la journée : chaque ligne est retrouvée par son N° de fiche', () => {
  const g = environnement();
  ['Article 1', 'Article 2', 'Article 3'].forEach(q => { g.now += 60000; envoyer(g, 'poseura', demande({ quoi: q })); });
  const f = g.feuilles['Demandes'];
  f.lignes = [f.lignes[0], f.lignes[3], f.lignes[1], f.lignes[2]];
  reveil(g, P(MARDI + ' 15:50'));
  assert.deepStrictEqual(D(g).map(l => [l[C.quoi], l[C.recap]]), [['Article 3', '17/11/2026'], ['Article 1', '17/11/2026'], ['Article 2', '17/11/2026']]);
  assert.ok(/Article 1[\s\S]*Article 2[\s\S]*Article 3/.test(recaps(g)[0].texte), 'dans le mail : par poseur, puis dans l’ordre d’arrivée');
});

console.log('Lot 10a-1 — le mail ne peut pas partir');
test('mail en échec à 15 h 50 : la marque n’est PAS posée, les lignes restent vides ; le passage suivant le reprend, avec les demandes arrivées entre-temps', () => {
  const g = environnement();
  envoyer(g, 'poseura', demande());
  g.etat.mailEnPanne = true;
  assert.strictEqual(reveil(g, P(MARDI + ' 15:50')), 'ok', 'le traitement des comptes n’est pas gêné');
  assert.deepStrictEqual([g.mails.length, g.proprietes.DEMANDES_PASSAGE, D(g)[0][C.recap]], [0, undefined, '']);
  g.now = P(MARDI + ' 15:55');
  const r = envoyer(g, 'poseurb', demande({ quoi: 'Arrivée entre deux essais' }));
  assert.strictEqual(r.data.recap.aujourdhui, true, 'le passage du jour n’est pas fait : elle part aujourd’hui');
  g.etat.mailEnPanne = false;
  reveil(g, P(MARDI + ' 16:00'));
  assert.deepStrictEqual([recaps(g).length, recaps(g)[0].sujet, g.proprietes.DEMANDES_PASSAGE], [1, 'À commander — mardi 17/11 (2 demandes)', MARDI]);
  assert.ok(!/NON ENVOYÉES/.test(recaps(g)[0].texte));
  assert.deepStrictEqual(D(g).map(l => l[C.recap]), ['17/11/2026', '17/11/2026']);
});
test('quota épuisé toute l’après-midi : essais jusqu’à 17 h 30, puis abandon pour ce jour (marque posée, lignes vides, une ligne au Journal) ; le lendemain : « DEMANDES NON ENVOYÉES HIER » en tête', () => {
  const g = environnement({ quota: 0 });
  envoyer(g, 'poseura', demande());
  envoyer(g, 'poseurb', demande({ sorte: 'panne', quoi: 'Perceuse', quantite: 'mandrin cassé' }));
  ['15:50', '16:00', '16:40', '17:20', '17:29'].forEach(h => { reveil(g, P(MARDI + ' ' + h)); assert.strictEqual(g.proprietes.DEMANDES_PASSAGE, undefined, h); });
  assert.strictEqual(g.mails.length, 0);
  reveil(g, P(MARDI + ' 17:30'));
  assert.strictEqual(g.proprietes.DEMANDES_PASSAGE, MARDI, 'abandon : passage du jour marqué');
  assert.deepStrictEqual(JSON.parse(g.proprietes.DEMANDES_REPORT), { jour: MARDI, ms: P(MARDI + ' 17:30') });
  assert.deepStrictEqual(D(g).map(l => l[C.recap]), ['', ''], 'lignes laissées vides');
  const journal = g.feuilles['Journal'].lignes.slice(1);
  assert.ok(journal.length === 1 && journal[0][4] === 'reporté' && /pas parti avant 17 h 30/.test(journal[0][5]), j(journal));
  // une demande du soir part normalement le lendemain (elle n'est pas « non envoyée »)
  g.now = P(MARDI + ' 18:00');
  const r = envoyer(g, 'poseura', demande({ quoi: 'Demande du soir' }));
  assert.deepStrictEqual([r.data.recap.aujourdhui, r.data.recap.jour], [false, 'mercredi 18/11'], j(r));
  reveil(g, P(MARDI + ' 18:10'));
  g.etat.quota = 100;
  reveil(g, P(MERCREDI + ' 15:50'));
  const m = recaps(g);
  assert.deepStrictEqual([m.length, m[0].sujet], [1, 'À commander — mercredi 18/11 (3 demandes)']);
  assert.strictEqual(m[0].texte.split('\n\n')[0] + '\n\n' + m[0].texte.split('\n\n')[1], ['DEMANDES NON ENVOYÉES HIER', '  À COMMANDER', '    Poseur A — Vis 4×40 — 2 boîtes',
    '  OUTIL EN PANNE', '    Poseur B — Perceuse — mandrin cassé', '', 'DEMANDES DU JOUR', '  À COMMANDER', '    Poseur A — Demande du soir — 2 boîtes'].join('\n'));
  assert.deepStrictEqual(D(g).map(l => l[C.recap]), ['18/11/2026', '18/11/2026', '18/11/2026']);
  assert.strictEqual(g.proprietes.DEMANDES_REPORT, undefined, 'le report est soldé');
  // le jour d'après : plus de mention
  g.now = P('2026-11-19 09:00'); envoyer(g, 'poseura', demande({ quoi: 'Jeudi' }));
  reveil(g, P('2026-11-19 15:50'));
  assert.ok(!/NON ENVOYÉES/.test(recaps(g)[1].texte));
});
test('abandon un vendredi : lundi, le titre dit « DEMANDES NON ENVOYÉES DU 20/11 »', () => {
  const g = environnement({ quota: 0 });
  g.now = P(VENDREDI + ' 11:00'); envoyer(g, 'poseura', demande());
  reveil(g, P(VENDREDI + ' 15:50')); reveil(g, P(VENDREDI + ' 17:35'));
  assert.strictEqual(g.proprietes.DEMANDES_PASSAGE, VENDREDI);
  g.etat.quota = 100;
  reveil(g, P(LUNDI + ' 15:50'));
  assert.ok(/^DEMANDES NON ENVOYÉES DU 20\/11\n {2}À COMMANDER\n {4}Poseur A — Vis 4×40 — 2 boîtes\n\n/.test(recaps(g)[0].texte), recaps(g)[0].texte);
  assert.ok(/NON ENVOYÉES DU 20\/11/.test(recaps(g)[0].opts.htmlBody));
});
test('le réveil ne tourne pas entre 15 h 45 et 17 h 30 (panne chez Google) : au premier passage après 17 h 30, on n’envoie plus, c’est reporté au lendemain', () => {
  const g = environnement();
  envoyer(g, 'poseura', demande());
  reveil(g, P(MARDI + ' 17:45'));
  assert.deepStrictEqual([g.mails.length, g.proprietes.DEMANDES_PASSAGE, D(g)[0][C.recap]], [0, MARDI, '']);
  g.now = P(MARDI + ' 17:50');
  assert.strictEqual(envoyer(g, 'poseurb', demande()).data.recap.jour, 'mercredi 18/11');
  reveil(g, P(MERCREDI + ' 15:50'));
  assert.ok(/NON ENVOYÉES HIER/.test(recaps(g)[0].texte) && /DEMANDES DU JOUR/.test(recaps(g)[0].texte));
  // après 17 h 30 sans passage du jour : la réponse n'annonce plus « aujourd'hui »
  const h = environnement();
  h.now = P(MARDI + ' 17:31');
  const r = envoyer(h, 'poseura', demande());
  assert.deepStrictEqual([r.data.recap.aujourdhui, r.data.recap.texte], [false, '✓ Elle sera dans le récapitulatif de mercredi 18/11.'], j(r));
});

console.log('Lot 10a-1 — la case « Commandé » et « Mes demandes »');
test('case cochée AVANT le récapitulatif : la ligne reste dans le mail avec « déjà commandé » ; le poseur voit « ✓ Commandé » ; décochée : la mention disparaît', () => {
  const g = environnement();
  const a = idFiche(), b = idFiche();
  envoyer(g, 'poseura', demande(), a);
  envoyer(g, 'poseura', demande({ quoi: 'Mèches béton', quantite: '' }), b);
  let r = mes(g, 'poseura');
  assert.deepStrictEqual(r.data.demandes.map(d => [d.id, d.etat, d.etatTexte]), [[b, 'attente', 'partira dans le prochain récapitulatif'], [a, 'attente', 'partira dans le prochain récapitulatif']], j(r));
  g.feuilles['Demandes'].lignes[1][C.commande] = true;
  g.feuilles['Demandes'].lignes[2][C.commande] = true;
  r = mes(g, 'poseura');
  assert.deepStrictEqual(r.data.demandes.map(d => d.etatTexte), ['✓ Commandé', '✓ Commandé']);
  reveil(g, P(MARDI + ' 15:50'));
  assert.ok(/ {2}Poseur A — Vis 4×40 — 2 boîtes \(déjà commandé\)\n {2}Poseur A — Mèches béton — \(déjà commandé\)/.test(recaps(g)[0].texte), recaps(g)[0].texte);
  assert.deepStrictEqual(D(g).map(l => [l[C.commande], l[C.recap]]), [[true, '17/11/2026'], [true, '17/11/2026']], 'la case n’est pas touchée par le récapitulatif');
  g.feuilles['Demandes'].lignes[1][C.commande] = false;
  r = mes(g, 'poseura');
  assert.deepStrictEqual(r.data.demandes.map(d => [d.quoi, d.etat, d.etatTexte]), [['Mèches béton', 'commande', '✓ Commandé'], ['Vis 4×40', 'recap', 'récapitulatif du 17/11']]);
});
test('case cochée APRÈS le récapitulatif : « ✓ Commandé » ; une cellule sans case (« oui », « x », vide, autre texte) est tolérée', () => {
  const g = environnement();
  ['A', 'B', 'C', 'D', 'E'].forEach(q => envoyer(g, 'poseura', demande({ quoi: q })));
  reveil(g, P(MARDI + ' 15:50'));
  const l = g.feuilles['Demandes'].lignes;
  l[1][C.commande] = true; l[2][C.commande] = 'Oui'; l[3][C.commande] = ' x '; l[4][C.commande] = ''; l[5][C.commande] = 'à voir';
  const r = mes(g, 'poseura');
  assert.deepStrictEqual(r.data.demandes.map(d => [d.quoi, d.etat]).sort(), [['A', 'commande'], ['B', 'commande'], ['C', 'commande'], ['D', 'recap'], ['E', 'recap']], j(r));
  // et le récapitulatif suivant ne plante pas sur ces cellules
  g.now = P(MERCREDI + ' 09:00'); envoyer(g, 'poseura', demande({ quoi: 'F' }));
  g.feuilles['Demandes'].lignes[6][C.commande] = 'oui';
  reveil(g, P(MERCREDI + ' 15:50'));
  assert.ok(/Poseur A — F — 2 boîtes \(déjà commandé\)/.test(recaps(g)[1].texte), recaps(g)[1].texte);
});
test('« Mes demandes » : un poseur ne voit que les siennes (le bureau non plus ne voit pas celles des autres ici), les plus récentes d’abord, 90 jours', () => {
  const g = environnement();
  g.now = P('2026-08-10 10:00', 'ete'); envoyer(g, 'poseura', demande({ quoi: 'Trop ancienne' }));    // 99 jours avant
  g.now = P('2026-08-25 10:00', 'ete'); envoyer(g, 'poseura', demande({ quoi: 'Dans les 90 jours' }));
  g.now = P(MARDI + ' 08:00'); envoyer(g, 'poseura', demande({ quoi: 'Ce matin' }));
  g.now = P(MARDI + ' 08:05'); envoyer(g, 'poseurb', demande({ quoi: 'Celle de B' }));
  g.now = P(MARDI + ' 09:00');
  const a = mes(g, 'poseura'), b = mes(g, 'poseurb'), c = mes(g, 'bureau');
  assert.deepStrictEqual(a.data.demandes.map(d => d.quoi), ['Ce matin', 'Dans les 90 jours'], j(a));
  assert.deepStrictEqual([b.data.demandes.map(d => d.quoi), c.data.demandes.length], [['Celle de B'], 0]);
  const d = a.data.demandes[0];
  assert.deepStrictEqual([Object.keys(d).sort().join(), d.sorte, d.type, d.quantite, d.date], ['date,etat,etatTexte,id,quantite,quoi,sorte,type', 'commander', 'À commander', '2 boîtes', P(MARDI + ' 08:00')]);
  assert.ok(!/Poseur|poseura/.test(j(a.data)), 'ni nom ni identifiant dans la réponse');
  assert.deepStrictEqual([a.data.prochain.aujourdhui, a.data.prochain.jour, a.data.heure], [true, 'mardi 17/11', g.now]);
  // onglet absent (lot pas installé) : liste vide, sans erreur
  const h = environnement({ sansInstallation: true });
  assert.deepStrictEqual([mes(h, 'poseura').ok, mes(h, 'poseura').data.demandes.length], [true, 0]);
});

console.log('Lot 10a-1 — titres de l’onglet changés');
test('un titre changé ou une colonne déplacée : rien n’est lu ni écrit, le téléphone garde la demande et réessaie, UN mail d’alerte par jour ; réparé : tout repart', () => {
  const g = environnement();
  envoyer(g, 'poseura', demande({ quoi: 'Avant la casse' }));
  const titres = g.feuilles['Demandes'].lignes[0];
  titres[5] = 'Commandé ?';
  const id = idFiche();
  let r = envoyer(g, 'poseura', demande({ quoi: 'Pendant' }), id);
  assert.deepStrictEqual([r.ok, r.code], [false, 'SERVEUR_OCCUPE'], j(r));
  r = envoyer(g, 'poseurb', demande());
  assert.strictEqual(r.code, 'SERVEUR_OCCUPE');
  r = mes(g, 'poseura');
  assert.deepStrictEqual([r.ok, r.code], [false, 'SERVEUR_OCCUPE'], j(r));
  assert.deepStrictEqual([D(g).length, E(g).length], [1, 1], 'rien d’écrit, aucun numéro réservé');
  const alertes = g.mails.filter(m => /titres de l’onglet « Demandes » changés/.test(m.sujet));
  assert.strictEqual(alertes.length, 1, 'une seule alerte');
  assert.ok(alertes[0].to === 'bureau@loue.test' && /installerLot10Production/.test(alertes[0].texte) && /Rien n’est perdu/.test(alertes[0].texte)
    && alertes[0].texte.indexOf(TITRES.join(' | ')) > -1, alertes[0].texte);
  // le récapitulatif ne part pas, et ne marque pas le jour : il réessaie
  reveil(g, P(MARDI + ' 15:50'));
  assert.deepStrictEqual([recaps(g).length, g.proprietes.DEMANDES_PASSAGE], [0, undefined]);
  // réparé à 16 h : la demande du téléphone repart (même numéro), le récapitulatif part
  titres[5] = 'Commandé';
  g.now = P(MARDI + ' 16:00');
  r = envoyer(g, 'poseura', demande({ quoi: 'Pendant' }), id);
  assert.deepStrictEqual([r.ok, r.code, D(g).length], [true, 'ENREGISTRE', 2], j(r));
  reveil(g, P(MARDI + ' 16:05'));
  assert.deepStrictEqual([recaps(g).length, recaps(g)[0].sujet], [1, 'À commander — mardi 17/11 (2 demandes)']);
  // colonne déplacée (deux titres échangés) : même protection ; pas réparé à 17 h 30 : abandon du jour, report
  const h = environnement();
  envoyer(h, 'poseura', demande());
  const t = h.feuilles['Demandes'].lignes[0]; t[3] = 'Quantité'; t[4] = 'Quoi';
  assert.strictEqual(envoyer(h, 'poseura', demande()).code, 'SERVEUR_OCCUPE');
  reveil(h, P(MARDI + ' 16:00')); assert.strictEqual(h.proprietes.DEMANDES_PASSAGE, undefined);
  reveil(h, P(MARDI + ' 17:30'));
  assert.deepStrictEqual([h.proprietes.DEMANDES_PASSAGE, recaps(h).length, !!h.proprietes.DEMANDES_REPORT], [MARDI, 0, true]);
  t[3] = 'Quoi'; t[4] = 'Quantité';
  reveil(h, P(MERCREDI + ' 15:50'));
  assert.ok(/^DEMANDES NON ENVOYÉES HIER\n/.test(recaps(h)[0].texte), recaps(h)[0].texte);
});
test('sur la copie TEST, le mail d’alerte nomme installerLot10Test', () => {
  const g = environnement({ test: true });
  g.feuilles['Demandes'].lignes[0][0] = 'Date de la demande';
  envoyer(g, 'poseura', demande());
  const a = g.mails.find(m => /« Demandes » changés/.test(m.sujet));
  assert.ok(a && /lance installerLot10Test /.test(a.texte) && !/installerLot10Production/.test(a.texte), a && a.texte);
});

console.log('Lot 10a-1 — le récapitulatif et le traitement des comptes ne se gênent pas');
test('le récapitulatif plante : les comptes sont traités quand même (un mot de passe provisoire est créé), le verrou est rendu', () => {
  const g = environnement();
  envoyer(g, 'poseura', demande());
  g.ctx.demRecapituler_ = () => { throw new Error('panne simulée du récapitulatif'); };
  g.feuilles['Utilisateurs'].lignes[2][4] = true;   // case « Réinitialiser » de Poseur B
  g.now = P(MARDI + ' 15:50');
  assert.strictEqual(g.ctx.traiterComptes(), 'ok');
  const l = g.feuilles['Utilisateurs'].lignes[2];
  assert.ok(l[4] === false && String(l[5]).length === 8 && /^provisoire créé/.test(l[9]), j(l));
  // l'heure de Paris est illisible (panne de Google) : même chose
  const h = environnement();
  h.ctx.demHeure_ = () => { throw new Error('heure illisible'); };
  h.feuilles['Utilisateurs'].lignes[2][4] = true;
  assert.strictEqual(h.ctx.traiterComptes(), 'ok');
  assert.ok(String(h.feuilles['Utilisateurs'].lignes[2][5]).length === 8);
});
test('le traitement des comptes plante (onglet « Utilisateurs » illisible) : le récapitulatif part quand même', () => {
  const g = environnement();
  envoyer(g, 'poseura', demande());
  g.ctx.synchroniserAcces_ = () => { throw new Error('panne simulée des comptes'); };
  g.now = P(MARDI + ' 15:50');
  assert.ok(/^erreur : panne simulée des comptes/.test(g.ctx.traiterComptes()));
  assert.deepStrictEqual([recaps(g).length, g.proprietes.DEMANDES_PASSAGE, D(g)[0][C.recap]], [1, MARDI, '17/11/2026']);
});
test('verrou du script occupé : ni comptes ni récapitulatif à ce passage (« occupé »), le passage suivant s’en charge ; le verrou n’est pas repris par le récapitulatif', () => {
  const o = { verrouOccupe: false };
  const g = environnement();
  envoyer(g, 'poseura', demande());
  // verrou compté : traiterComptes le demande UNE fois, le récapitulatif ne le redemande pas
  const avant = g.etat.verrousScript;
  reveil(g, P(MARDI + ' 15:50'));
  assert.strictEqual(g.etat.verrousScript - avant, 1, 'un seul verrou demandé pour comptes + récapitulatif');
  assert.strictEqual(recaps(g).length, 1);
  // verrou occupé
  const h = creerGoogle({ fuseaux: true, verrouOccupe: true, proprietes: { DRIVE_ROOT_ID: 'RACINE', DRIVE_PLANNING_ID: 'PLANNING' } });
  h.ctx = chargerScript(h);
  h.ctx.maintenant_ = () => P(MARDI + ' 15:50');
  assert.strictEqual(h.ctx.traiterComptes(), 'occupé');
  assert.deepStrictEqual([h.mails.length, h.proprietes.DEMANDES_PASSAGE], [0, undefined]);
  assert.ok(o);
});

console.log('Lot 10a-2 — la liste « Articles » (onglet facultatif du Sheet)');
test('onglet créé VIDE par l’installation (un titre, rien d’autre) : liste vide, sans erreur ; une page d’avant le lot 10a-2 ne reçoit rien de plus', () => {
  const g = environnement();
  assert.deepStrictEqual(j(g.feuilles['Articles'].lignes), j([['Article']]));
  const r = mesAvec(g, 'poseura', '');
  assert.deepStrictEqual([r.ok, j(r.data.articles), typeof r.data.articlesEmpreinte, r.data.demandes.length], [true, '[]', 'string', 0], j(r));
  const ancien = mes(g, 'poseura');
  assert.ok(ancien.ok && !('articles' in ancien.data) && !('articlesEmpreinte' in ancien.data), j(ancien));
  assert.strictEqual(poster(g, { action: 'demandes', articles: 12, jeton: jeton(g, 'poseura') }).data.articles, undefined, 'une empreinte qui n’est pas un texte : comme une ancienne page');
});
test('liste remplie : rendue dans l’ordre du Sheet, à tous les comptes connectés ; la même empreinte renvoyée par le téléphone : la liste n’est pas retéléchargée ; liste changée : renvoyée', () => {
  const g = environnement();
  articles(g, ['Article', 'Vis 4×40', 'Cartouches silicone blanc', 'Embout de vissage']);
  envoyer(g, 'poseura', demande());
  const r = mesAvec(g, 'poseura', '');
  assert.deepStrictEqual([j(r.data.articles), r.data.demandes.length], [j(['Vis 4×40', 'Cartouches silicone blanc', 'Embout de vissage']), 1], j(r));
  const b = mesAvec(g, 'poseurb', ''), c = mesAvec(g, 'bureau', 'une-ancienne-empreinte');
  assert.deepStrictEqual([j(b.data.articles), b.data.articlesEmpreinte, j(c.data.articles), b.data.demandes.length], [j(r.data.articles), r.data.articlesEmpreinte, j(r.data.articles), 0]);
  const meme = mesAvec(g, 'poseura', r.data.articlesEmpreinte);
  assert.ok(meme.ok && !('articles' in meme.data) && meme.data.articlesEmpreinte === r.data.articlesEmpreinte && meme.data.demandes.length === 1, j(meme));
  g.feuilles['Articles'].lignes.push(['Mousse expansive']);
  const change = mesAvec(g, 'poseura', r.data.articlesEmpreinte);
  assert.deepStrictEqual([change.data.articles.length, change.data.articles[3], change.data.articlesEmpreinte !== r.data.articlesEmpreinte], [4, 'Mousse expansive', true], j(change));
  // un article retiré, un ordre changé : l'empreinte change aussi
  articles(g, ['Article', 'Cartouches silicone blanc', 'Vis 4×40', 'Embout de vissage']);
  assert.ok(mesAvec(g, 'poseura', r.data.articlesEmpreinte).data.articles, 'ordre changé');
});
test('onglet ABSENT (retiré par Franck, ou lot 10 pas installé) : liste vide, tout marche ; onglet fait à la main SANS titre : la première ligne est un article', () => {
  const g = environnement();
  delete g.feuilles['Articles'];
  let r = mesAvec(g, 'poseura', '');
  assert.deepStrictEqual([r.ok, j(r.data.articles)], [true, '[]'], j(r));
  assert.ok(envoyer(g, 'poseura', demande()).ok, 'les demandes ne dépendent pas de cet onglet');
  const h = environnement({ sansInstallation: true });
  r = mesAvec(h, 'poseura', '');
  assert.deepStrictEqual([r.ok, j(r.data.articles), r.data.demandes.length, !!h.feuilles['Articles']], [true, '[]', 0, false], j(r));
  const k = environnement({ feuilles: { 'Articles': [['Vis 4×40'], ['Chevilles 8 mm'], ['Article'], ['ARTICLES']] } });
  assert.deepStrictEqual(mesAvec(k, 'poseura', '').data.articles, ['Vis 4×40', 'Chevilles 8 mm', 'Article', 'ARTICLES'], 'seule la PREMIÈRE ligne peut être un titre');
  const m = environnement({ feuilles: { 'Articles': [['ARTICLES'], ['Vis 4×40']] } });
  assert.deepStrictEqual(mesAvec(m, 'poseura', '').data.articles, ['Vis 4×40'], 'un titre « ARTICLES » est reconnu');
});
test('onglet TRÈS LONG : 500 articles au plus (les 500 premiers), 2 000 lignes lues au plus ; un article de plus de 80 caractères est coupé à 80', () => {
  const g = environnement();
  articles(g, ['Article'].concat(Array.from({ length: 700 }, (_, i) => 'Article numéro ' + (i + 1))));
  let r = mesAvec(g, 'poseura', '');
  assert.deepStrictEqual([r.data.articles.length, r.data.articles[0], r.data.articles[499]], [500, 'Article numéro 1', 'Article numéro 500'], j(r.data.articles.slice(0, 3)));
  assert.ok(/⚠ liste trop longue : seuls les 500 premiers articles/.test(g.ctx.verifierConfig()));
  // 3 000 lignes, dont beaucoup de doublons : seules les 2 000 premières sont lues
  articles(g, Array.from({ length: 3000 }, (_, i) => (i < 2500 ? 'Toujours le même' : 'Trop loin ' + i)));
  r = mesAvec(g, 'poseura', '');
  assert.deepStrictEqual(r.data.articles, ['Toujours le même']);
  articles(g, ['Article', 'x'.repeat(80), 'y'.repeat(81), 'Début ' + 'z'.repeat(200)]);
  r = mesAvec(g, 'poseura', '');
  assert.deepStrictEqual(r.data.articles.map(t => t.length), [80, 80, 80], j(r.data.articles));
  assert.ok(JSON.stringify(r).length < 60000, 'la réponse reste légère');
});
test('DOUBLONS retirés (majuscules, accents, « x » et « × », espaces) ; lignes vides, formules en erreur et retours à la ligne tolérés ; un nombre est lu comme il est affiché', () => {
  const g = environnement();
  articles(g, ['Article', 'Vis 4×40', 'vis 4x40', 'VIS 4 X 40', '', 'Éclisse alu', 'eclisse ALU', '  Mousse   expansive ', 'Mousse expansive', '#REF!', '#N/A', 12.5, 'Cartouches\nsilicone\tblanc', '   ',
    'Sac\u0007 à gravats', '=IMPORTDATA("http://exemple.invalid")']);
  const r = mesAvec(g, 'poseura', '');
  assert.deepStrictEqual(r.data.articles, ['Vis 4×40', 'Éclisse alu', 'Mousse expansive', '12,5', 'Cartouches silicone blanc', 'Sac à gravats', '=IMPORTDATA("http://exemple.invalid")'], j(r.data.articles));
  assert.ok(/✅ Onglet « Articles » : 7 article\(s\) proposé\(s\)/.test(g.ctx.verifierConfig()));
});
test('SANS COMPTE (ou jeton faux) : aucune liste n’est donnée ; onglet « Demandes » aux titres changés : pas de liste non plus (le téléphone garde la sienne)', () => {
  const g = environnement();
  articles(g, ['Article', 'Vis 4×40']);
  let r = mesAvec(g, '', '');
  assert.deepStrictEqual([r.ok, r.code, /Vis 4×40|articles/.test(j(r))], [false, 'CONNEXION_REQUISE', false], j(r));
  g.proprietes.FIN_TRANSITION = String(g.now - 1000);
  r = mesAvec(g, '', '');
  assert.deepStrictEqual([r.ok, r.code, /Vis 4×40/.test(j(r))], [false, 'CONNEXION_REQUISE', false], j(r));
  r = poster(g, { action: 'demandes', articles: '', jeton: 'poseura.p.1.9999999999999.signaturefaussesignaturefausse' });
  assert.deepStrictEqual([r.ok, r.code, /Vis 4×40/.test(j(r))], [false, 'JETON_INVALIDE', false], j(r));
  // un compte désactivé non plus
  g.feuilles['Utilisateurs'].lignes[2][3] = false; g.ctx.traiterComptes();
  r = mesAvec(g, 'poseurb', '');
  assert.deepStrictEqual([r.ok, /Vis 4×40/.test(j(r))], [false, false], j(r));
  // la liste n'est donnée par aucune autre action (ni « listes », ni « moi », ni la lecture sans compte)
  assert.ok(!/Vis 4×40/.test(j(poster(g, { action: 'listes', jeton: jeton(g, 'poseura') })) + j(poster(g, { action: 'moi', jeton: jeton(g, 'poseura') })) + g.ctx.doGet({ parameter: { action: 'getContacts' } }).contenu));
  g.feuilles['Demandes'].lignes[0][0] = 'Autre titre';
  r = mesAvec(g, 'poseura', '');
  assert.deepStrictEqual([r.ok, r.code, /Vis 4×40/.test(j(r))], [false, 'SERVEUR_OCCUPE', false], j(r));
});
test('onglet « Articles » ILLISIBLE (panne de lecture) : « Mes demandes » répond quand même, sans liste ni empreinte (le téléphone garde celle qu’il a)', () => {
  const g = environnement();
  articles(g, ['Article', 'Vis 4×40']);
  envoyer(g, 'poseura', demande());
  g.feuilles['Articles'].api.getRange = () => { throw new Error('Service Spreadsheets indisponible'); };
  const r = mesAvec(g, 'poseura', 'ancienne');
  assert.ok(r.ok && r.data.demandes.length === 1 && !('articles' in r.data) && !('articlesEmpreinte' in r.data), j(r));
  assert.ok(/❌ Onglet « Articles » : illisible/.test(g.ctx.verifierConfig()));
});
test('installation relancée : un onglet « Articles » déjà rempli n’est JAMAIS touché ; verifierConfig dit s’il est absent (ce n’est pas une erreur)', () => {
  const g = environnement({ sansInstallation: true, feuilles: { 'Articles': [['Mes articles à moi'], ['Vis 4×40'], ['Chevilles 8 mm']] } });
  const t = g.ctx.installerLot10Production();
  assert.ok(/2\/3 Onglet « Articles » .* : déjà fait/.test(t) && /installation terminée/.test(t) && /Onglet « Articles » : facultatif\. Un article par ligne dans la colonne A \(500 au plus, 80 caractères au plus\)/.test(t), t);
  assert.deepStrictEqual(j(g.feuilles['Articles'].lignes), j([['Mes articles à moi'], ['Vis 4×40'], ['Chevilles 8 mm']]));
  const h = environnement({ sansInstallation: true });
  assert.ok(/➖ Onglet « Articles » : absent \(facultatif/.test(h.ctx.verifierConfig()));
  h.ctx.installerLot10Production();
  assert.ok(/✅ Onglet « Articles » : 0 article\(s\)/.test(h.ctx.verifierConfig()));
});

console.log('Lot 10a-1 — installation, vérification, livraison');
test('installerLot10Production : crée l’onglet avec ses titres ; relancée : « déjà fait » ; refuse sur la copie TEST ; pose le réveil des 10 minutes s’il manque', () => {
  const g = environnement({ sansInstallation: true });
  assert.ok(!g.feuilles['Demandes']);
  const t1 = g.ctx.installerLot10Production();
  assert.ok(/✅ 1\/3 Onglet « Demandes » : fait — onglet créé/.test(t1) && /✅ 2\/3 Onglet « Articles » .* : fait — onglet créé, vide/.test(t1) && /✅ 3\/3 Réveil des 10 minutes .* : fait/.test(t1) && /installation terminée/.test(t1) && /après 15 h 45/.test(t1), t1);
  assert.deepStrictEqual(j(g.feuilles['Demandes'].lignes), j([TITRES]));
  assert.ok(g.declencheurs.indexOf('traiterComptes') > -1);
  envoyer(g, 'poseura', demande());
  const t2 = g.ctx.installerLot10Production();
  assert.ok(/1\/3 Onglet « Demandes » : déjà fait/.test(t2) && /2\/3 Onglet « Articles » .* : déjà fait/.test(t2) && /3\/3 .* : déjà fait/.test(t2), t2);
  assert.strictEqual(D(g).length, 1, 'rien n’est effacé');
  assert.ok(/Refusé : cette fonction est prévue pour TEST/.test(g.ctx.installerLot10Test()));
});
test('installerLot10Test : onglet créé, AUCUN réveil posé ; refuse en production ; un onglet « Demandes » aux autres titres n’est jamais réécrit', () => {
  const g = environnement({ test: true, sansInstallation: true });
  const t = g.ctx.installerLot10Test();
  assert.ok(/✅ 1\/3 Onglet « Demandes » : fait/.test(t) && /✅ 2\/3 Onglet « Articles »/.test(t) && /➖ 3\/3 .* non concerné sur TEST/.test(t) && /retirerDeclencheurs/.test(t), t);
  assert.strictEqual(g.declencheurs.length, 0);
  assert.ok(/Refusé/.test(g.ctx.installerLot10Production()));
  const h = environnement({ sansInstallation: true, feuilles: { 'Demandes': [['Autre', 'Chose'], ['donnée', 'gardée']] } });
  const t2 = h.ctx.installerLot10Production();
  assert.ok(/❌ 1\/3 Onglet « Demandes » : un onglet « Demandes » existe déjà avec d’autres titres/.test(t2), t2);
  assert.deepStrictEqual(j(h.feuilles['Demandes'].lignes), j([['Autre', 'Chose'], ['donnée', 'gardée']]));
  // onglet vide créé à la main : les titres y sont écrits
  const k = environnement({ sansInstallation: true, feuilles: { 'Demandes': [] } });
  assert.ok(/onglet prêt/.test(k.ctx.installerLot10Production()));
  assert.deepStrictEqual(Array.from(k.feuilles['Demandes'].lignes[0]), TITRES);
});
test('verifierConfig : onglet « Demandes », heure du récapitulatif, dernier passage, demandes en attente, report signalé', () => {
  const g = environnement({ sansInstallation: true });
  let t = g.ctx.verifierConfig();
  assert.ok(/❌ Onglet « Demandes » \(sinon lancer installerLot10Test ou installerLot10Production\)/.test(t) && /après 15 h 45 ; dernier passage fait : jamais/.test(t), t);
  g.ctx.installerLot10Production();
  envoyer(g, 'poseura', demande());
  t = g.ctx.verifierConfig();
  assert.ok(/✅ Onglet « Demandes »/.test(t) && /dernier passage fait : jamais ; demandes en attente du prochain : 1/.test(t), t);
  g.etat.quota = 0; reveil(g, P(MARDI + ' 17:30'));
  t = g.ctx.verifierConfig();
  assert.ok(/dernier passage fait : 17\/11\/2026/.test(t) && /⚠ Le récapitulatif du 17\/11\/2026 n’a pas pu partir/.test(t), t);
});
test('porte de service (copie TEST) : installerLot10 ; lireDemandes ne rend ni nom, ni texte saisi, ni compte réel', () => {
  const CLE = 'k'.repeat(48);
  const g = environnement({ test: true, sansInstallation: true, proprietes: { CLE_OUTILS_TEST: CLE } });
  vm.runInContext(fs.readFileSync(path.join(RACINE, construire.PORTE), 'utf8'), g.ctx, { filename: 'OutilsTest.gs' });
  const geste = (nom) => JSON.parse(g.ctx.doPost({ postData: { contents: JSON.stringify({ action: 'outilTest', v: 5, geste: nom, cle: CLE }) } }).contenu);
  let r = geste('installerLot10');
  assert.ok(r.ok && /installation terminée/.test(r.message), j(r));
  envoyer(g, 'poseura', demande({ quoi: 'Texte secret du poseur' }));
  r = geste('lireDemandes');
  assert.ok(r.ok && r.data.lignes.length === 2 && !/secret|Poseur A|poseura|fiche-lot10/.test(j(r)) && /\(compte réel\)/.test(j(r)) && /\(demande réelle\)/.test(j(r)), j(r));
  // sans la porte (production), ces gestes n'existent pas
  const p = environnement();
  assert.strictEqual(poster(p, { action: 'outilTest', geste: 'installerLot10', cle: CLE }).code, 'ACTION_INCONNUE');
});
test('livraison : le serveur à coller contient les lots 10a-1 et 10a-2, en version v11.3, Demandes.gs à sa place, sans les outils d’essai ; chargé seul, il reçoit une demande et envoie le récapitulatif', () => {
  const code = fs.readFileSync(path.join(RACINE, 'A-COLLER-DANS-APPS-SCRIPT', 'Code.gs'), 'utf8');
  ["const VERSION_API = 'v11.3'", "const DEMANDES_HEURE_LIMITE  = '15:45';", "const DEMANDES_FIN_ESSAIS    = '17:30';", 'const DEMANDES_MAX_PAR_JOUR  = 30;', 'function traiterDemande(', 'function demRecapituler_(',
    'function listerDemandes_(', 'function demArticles_(', "const SHEET_ARTICLES = 'Articles';", 'const ART_MAX = 500;', 'listerDemandes_(qui.compte, corps)', 'function mailBureau_(', 'function installerLot10Test(', 'function installerLot10Production(', "'demande'            : 'traiterDemande'", "corps.action === 'demandes'",
    '████ Demandes.gs ████'].forEach(t => assert.ok(code.indexOf(t) > -1, t));
  assert.ok(code.indexOf('████ Notes.gs ████') < code.indexOf('████ Demandes.gs ████') && code.indexOf('████ Demandes.gs ████') < code.indexOf('████ Admin.gs ████'));
  assert.ok(!/function\s+outilTest_\s*\(/.test(code));
  assert.ok(!/getScriptTimeZone|getSpreadsheetTimeZone/.test(code.slice(code.indexOf('████ Demandes.gs ████'), code.indexOf('████ ComptesRendus.gs ████'))), 'jamais le fuseau du projet');
  const g = creerGoogle({ fuseaux: true, proprietes: { DRIVE_ROOT_ID: 'RACINE', DRIVE_PLANNING_ID: 'PLANNING', HACHAGE_ITERATIONS: '200', EMAIL_ADMIN: 'bureau@loue.test' },
    feuilles: { 'Contacts': [['Nom', 'Role', 'Email']], 'Chantiers': [['Nom', 'Référence', 'Statut', 'Conducteur']] } });
  g.creerElement('dossier', 'Loué Menuiserie - Chantiers', null, { id: 'RACINE' }); g.creerElement('dossier', 'Planning', null, { id: 'PLANNING' });
  g.ctx = chargerScript(g, path.join(RACINE, 'A-COLLER-DANS-APPS-SCRIPT', 'Code.gs'));
  g.now = P(MARDI + ' 10:00'); g.ctx.maintenant_ = () => g.now;
  g.ctx.genererCle(); g.ctx.preparerOngletsLot2();
  g.feuilles['Utilisateurs'].lignes[1] = ['poseura', 'Poseur A', 'Poseur', true, false, '', '', false, false, ''];
  g.ctx.traiterComptes();
  assert.ok(/installation terminée/.test(g.ctx.installerLot10Production()));
  assert.strictEqual(g.ctx.doGet({ parameter: {} }).contenu, 'Loué App API v11.3 OK');
  assert.ok(envoyer(g, 'poseura', demande()).ok);
  reveil(g, P(MARDI + ' 15:50'));
  assert.strictEqual(recaps(g)[0].sujet, 'À commander — mardi 17/11 (1 demande)');
});

console.log(reussis + ' test(s) réussi(s)' + (process.exitCode ? ' — DES TESTS ÉCHOUENT' : ''));
