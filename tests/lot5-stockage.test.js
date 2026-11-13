// Tests du lot 5, côté serveur (suivi du stockage, alertes, purge sur case cochée) : node tests/lot5-stockage.test.js
// Tout se passe dans le faux Google (tests/gas-harness.js) : rien n'est lu ni écrit chez Google.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { creerGoogle, chargerScript } = require('./gas-harness');
const construire = require('../outils/construire.js');

const RACINE = path.join(__dirname, '..');
const MO = 1024 * 1024, GO = 1024 * MO, JOUR = 24 * 3600 * 1000;
const MAINTENANT = new Date(2026, 10, 13, 10, 0).getTime();
const TITRES_CHANTIERS = ['Nom', 'Référence', 'Statut', 'Conducteur', 'N°', 'Nom court', 'Adresse', 'Client', 'Architecte', 'Date « Terminé »', 'Chemin MEGA'];
const TITRES_DOSSIERS = ['Chantier', 'Dossier Drive', 'Identifiant du dossier', 'Trouvé par', 'À vérifier'];
const QUITUS = '05 - CHANTIER/OPR - RESERVES - QUITUS', PHOTOS = '05 - CHANTIER/PHOTOS CHANTIER';
const RELEVE = 'releve-pc.json';

function environnement(o = {}) {
  const g = creerGoogle({
    nomSheet: o.test ? 'ChantierPro TEST' : 'ChantierPro',
    proprietes: Object.assign({ DRIVE_ROOT_ID: 'RACINE', DRIVE_PLANNING_ID: 'PLANNING', EMAIL_ADMIN: 'franck@loue.test' }, o.test ? { ENVIRONNEMENT: 'TEST' } : {}, o.proprietes || {}),
    feuilles: Object.assign({ 'Chantiers': [TITRES_CHANTIERS], 'Dossiers chantiers': [TITRES_DOSSIERS] }, o.feuilles || {}),
    stockage: o.stockage, driveAvance: o.driveAvance,
  });
  g.racine = g.creerElement('dossier', o.nomRacine || (o.test ? 'CHANTIERPRO-TEST' : 'Loué Menuiserie - Chantiers'), null, { id: 'RACINE' });
  g.creerElement('dossier', 'Planning', null, { id: 'PLANNING' });
  g.ctx = chargerScript(g);
  g.now = MAINTENANT;
  g.ctx.maintenant_ = () => g.now;   // l'horloge du serveur, réglable
  return g;
}
// ── Fabrique de dossiers et de fichiers ──
function sous(g, parent, chemin) {
  let d = parent;
  chemin.split('/').forEach(nom => { d = d.enfants.filter(e => e.type === 'dossier' && e.nom === nom)[0] || g.creerElement('dossier', nom, d); });
  return d;
}
const fichier = (g, parent, nom, taille, extra) => g.creerElement('fichier', nom, parent, Object.assign(taille === undefined ? {} : { taille: taille }, extra || {}));
function chantier(g, nom, o = {}) {
  const d = g.creerElement('dossier', o.nomDossier || nom, o.parent === undefined ? g.racine : o.parent, { id: o.id || 'D-' + nom.replace(/[^A-Za-z0-9]+/g, '') });
  if (!o.sansChantier) g.feuilles['Chantiers'].lignes.push([nom, 'LIEU', o.statut || 'En cours', 'Franck', '', '', '', '', '', o.termine === undefined ? '' : o.termine, '']);
  if (!o.sansLigne) g.feuilles['Dossiers chantiers'].lignes.push([nom, d.nom, d.id, o.trouvePar || 'créé', o.aVerifier || '']);
  return d;
}
const doc = (id, code, indice, dossier, extra) => Object.assign({ id: id, code: code, indice: indice, intitule: 'PLAN', dossier: dossier, date: '2026-01-01', poids: 1, pages: [] }, extra || {});
const liste = (nom, documents) => JSON.stringify({ version: 1, chantier: nom, documents: documents });
function releve(g, dossier, nom, fichiers, quand, nomFichier) {
  return fichier(g, dossier, nomFichier || RELEVE, undefined, { contenu: JSON.stringify({ version: 1, chantier: nom, numero: '12',
    releve_le: new Date(quand === undefined ? g.now - 2 * JOUR : quand).toISOString(), fichiers: fichiers.map(f => ({ chemin: f[0], taille: f[1] })) }) });
}
// Un chantier terminé depuis 200 jours où TOUT est réuni pour la purge. o.sans : ce qu'on ne fabrique pas.
function chantierFini(g, nom, o = {}) {
  const x = {};
  x.d = chantier(g, nom, Object.assign({ statut: 'Terminé', termine: new Date(g.now - 200 * JOUR) }, o));
  x.quitus = sous(g, x.d, QUITUS); x.photos = sous(g, x.d, PHOTOS);
  x.f1 = fichier(g, x.quitus, 'QUITUS A 2026-01-10.pdf', 1000);
  x.f2 = fichier(g, x.quitus, 'QUITUS B 2026-01-11.pdf', 2000);
  x.p1 = fichier(g, x.photos, 'photo 1.jpg', 5000);
  x.divers = fichier(g, sous(g, x.d, 'Divers'), 'note à moi.txt', 300);
  x.carnet = sous(g, x.d, 'CARNET');
  x.docA = sous(g, x.carnet, '101 A PLAN'); x.imageA = fichier(g, x.docA, 'p1-leger.webp', 700);
  x.docB = sous(g, x.carnet, '101 B PLAN'); x.imageB = fichier(g, x.docB, 'p1-leger.webp', 800);
  x.json = fichier(g, x.carnet, 'carnet.json', undefined, { contenu: liste(nom, [doc('101-A', '101', 'A', '101 A PLAN'), doc('101-B', '101', 'B', '101 B PLAN')]) });
  x.lignesReleve = [[QUITUS + '/QUITUS A 2026-01-10.pdf', 1000], [QUITUS + '/QUITUS B 2026-01-11.pdf', 2000], [PHOTOS + '/photo 1.jpg', 5000]];
  if (o.releve !== false) x.releve = releve(g, x.d, o.chantierReleve || nom, o.lignesReleve || x.lignesReleve, o.dateReleve, o.nomReleve);
  return x;
}
// ── Lecture des onglets ──
const K = { nom: 0, statut: 1, termine: 2, total: 3, carnet: 4, fiches: 5, photos: 6, autres: 7, fichiers: 8, depot: 9, indices: 10, indicesMo: 11, mesure: 12, purge: 13, cle: 14 };
const P = { chantier: 0, quoi: 1, poids: 2, fichiers: 3, possible: 4, pourquoi: 5, corbeille: 6, etat: 7, message: 8, faitLe: 9, nbFaits: 10, libere: 11, annuler: 12, jusquau: 13, maj: 14, cle: 15 };
const D = { cle: 0, type: 1, id: 2, chemin: 3, taille: 4, fichiers: 5, note: 6, etat: 7, maj: 8 };
const resume = g => g.feuilles['Stockage'].lignes.slice(0, 9).map(l => l[1]);
const tableau = g => g.feuilles['Stockage'].lignes.slice(11).filter(l => l && l[K.cle]);
const ligneS = (g, cle) => tableau(g).filter(l => l[K.cle] === cle)[0];
const purges = g => (g.feuilles['Purges'] ? g.feuilles['Purges'].lignes.slice(1).filter(l => l && l[P.cle]) : []);
const ligneP = (g, nom, quoi) => purges(g).filter(l => l[P.chantier] === nom && l[P.quoi] === (quoi || 'Chantier terminé')).pop();
const termines = g => purges(g).filter(l => l[P.quoi] === 'Chantier terminé');
const detail = g => (g.feuilles['Purges détail'] ? g.feuilles['Purges détail'].lignes.slice(1).filter(l => l && l[D.cle]) : []);
const cocher = (g, nom, quoi, colonne) => { ligneP(g, nom, quoi)[colonne === undefined ? P.corbeille : colonne] = true; };
const corbeille = x => x.api.isTrashed();
const mesurer = g => g.ctx.mesurerStockage();
const mailsDe = (g, motif) => g.mails.filter(m => motif.test(m.sujet));

let reussis = 0;
function test(nom, fn) {
  try { fn(); reussis++; console.log('  ✓ ' + nom); }
  catch (e) { console.log('  ✗ ' + nom + '\n    ' + String(e.stack || e.message).split('\n').slice(0, 6).join('\n    ')); process.exitCode = 1; }
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
console.log('Lot 5 — la mesure');
function driveDeMesure(o) {
  const g = environnement(Object.assign({ stockage: { utilise: 100 * MO } }, o || {}));
  const a = chantier(g, 'ALPHA');
  fichier(g, sous(g, a, QUITUS), 'QUITUS ALPHA.pdf', 2 * MO);
  fichier(g, sous(g, a, PHOTOS), 'photo.jpg', 3 * MO);
  fichier(g, sous(g, a, 'CARNET/101 A PLAN'), 'p1.webp', 4 * MO);
  fichier(g, sous(g, a, 'CARNET'), 'carnet.json', undefined, { contenu: liste('ALPHA', [doc('101-A', '101', 'A', '101 A PLAN')]), maj: MAINTENANT - 5 * JOUR });
  fichier(g, sous(g, a, 'Divers'), 'devis.pdf', 1 * MO);
  const jete = fichier(g, sous(g, a, QUITUS), 'QUITUS JETÉ.pdf', 50 * MO); jete.corbeille = true;
  const dossierJete = sous(g, a, 'ANCIEN'); fichier(g, dossierJete, 'gros.pdf', 60 * MO); dossierJete.corbeille = true;
  fichier(g, sous(g, g.racine, '_À CLASSER'), 'a classer.pdf', 1 * MO);
  fichier(g, g.racine, 'note de la racine.txt', 1 * MO);
  fichier(g, sous(g, g.racine, 'VIEUX DOSSIER'), 'vieux.pdf', 2 * MO);
  const b = chantier(g, 'BETA', { sansLigne: true });   // dossier au nom exact du chantier, sans ligne dans « Dossiers chantiers »
  fichier(g, b, 'plan.pdf', 1 * MO);
  g.feuilles['Chantiers'].lignes.push(['GAMMA SANS DOSSIER', 'LIEU', 'En préparation', 'Franck', '', '', '', '', '', '', '']);
  g.alpha = a;
  return g;
}
test('poids par chantier et par sous-dossier, lignes datées, corbeille non comptée, dossiers techniques, dossier sans chantier, chantier sans dossier, « reste »', () => {
  const g = driveDeMesure();
  const m = mesurer(g);
  assert.ok(/^Tour de mesure terminé/.test(m), m);
  const a = ligneS(g, 'chantier:' + g.alpha.id);
  assert.deepStrictEqual([a[K.nom], a[K.statut], a[K.total], a[K.carnet], a[K.fiches], a[K.photos], a[K.autres], a[K.fichiers]], ['ALPHA', 'En cours', 10, 4, 2, 3, 1, 5]);
  assert.strictEqual(a[K.mesure].getTime(), MAINTENANT, 'ligne datée');
  assert.strictEqual(a[K.depot].getTime(), MAINTENANT - 5 * JOUR, 'date du dernier dépôt au carnet');
  assert.deepStrictEqual([a[K.indices], a[K.indicesMo]], [0, 0], 'aucun ancien indice');
  const b = ligneS(g, 'chantier:D-BETA');
  assert.deepStrictEqual([b[K.nom], b[K.total]], ['BETA', 1]);
  const tech = ligneS(g, 'special:techniques'), orph = ligneS(g, 'special:orphelins'), sans = ligneS(g, 'special:sans-dossier'), reste = ligneS(g, 'special:reste');
  assert.ok(/^Dossiers techniques/.test(tech[K.nom]) && /_À CLASSER/.test(tech[K.nom]) && tech[K.total] === 2 && tech[K.fichiers] === 2, JSON.stringify(tech));
  assert.ok(/aucun chantier \(1\) : VIEUX DOSSIER/.test(orph[K.nom]) && orph[K.total] === 2, JSON.stringify(orph));
  assert.ok(/^Chantiers sans dossier \(1\) : GAMMA SANS DOSSIER/.test(sans[K.nom]), sans[K.nom]);
  assert.ok(/^Reste du compte/.test(reste[K.nom]) && reste[K.total] === 85, 'reste = 100 − 10 − 1 − 2 − 2 : ' + reste[K.total]);
  const r = resume(g);
  assert.ok(/^Tout va bien : 0 %/.test(r[0]), r[0]);
  assert.strictEqual(r[1], '0,1 Go sur 15 Go (0 %)');
  assert.strictEqual(r[2].getTime(), MAINTENANT);
  assert.ok(/^DriveApp/.test(r[3]) && /one\.google\.com\/storage/.test(r[3]) && /non activé/.test(r[3]), r[3]);
  assert.ok(/non connu/.test(r[4]) && /non connu/.test(r[5]) && /non connu/.test(r[6]), 'sans le service avancé : parts inconnues');
  assert.ok(/tour complet du 13\/11\/2026/.test(r[7]), r[7]);
  assert.ok(/Messages envoyés/.test(r[8]) && /Gmail/.test(r[8]), 'rappel fixe sur Gmail');
  assert.strictEqual(g.proprietes.STOCKAGE_SUITE, undefined, 'tour fini : plus de reprise en attente');
  assert.strictEqual(g.proprietes.STOCKAGE_EN_COURS, undefined, 'verrou de la mesure rendu');
});
test('la mesure est en lecture seule dans Drive (rien créé, rien déplacé, rien mis à la corbeille, pas de dossiers.json) et ne prend pas le verrou des fiches', () => {
  const g = driveDeMesure();
  const avant = Object.keys(g.elements).map(id => id + ':' + g.elements[id].nom + ':' + g.elements[id].corbeille + ':' + (g.elements[id].parents[0] || {}).id).join('|');
  mesurer(g); mesurer(g);
  const apres = Object.keys(g.elements).map(id => id + ':' + g.elements[id].nom + ':' + g.elements[id].corbeille + ':' + (g.elements[id].parents[0] || {}).id).join('|');
  assert.strictEqual(apres, avant);
  assert.strictEqual(g.etat.corbeilles.length, 0);
  assert.strictEqual(g.etat.verrousScript, 0, 'le verrou du script n’est jamais demandé');
  assert.strictEqual(tableau(g).filter(l => l[K.cle] === 'chantier:' + g.alpha.id).length, 1, 'deux tours : toujours une seule ligne par chantier');
});
test('reprise après arrêt (4 minutes) : sans doublon ni oubli ; « reste » seulement après un tour complet ; le second déclencheur ne fait rien sans tour en cours', () => {
  const g = environnement({ stockage: { utilise: 500 * MO } });
  const noms = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'];
  noms.forEach((n, i) => { const d = chantier(g, n); fichier(g, sous(g, d, QUITUS), 'q.pdf', (i + 1) * MO); fichier(g, sous(g, d, PHOTOS), 'p.jpg', MO); });
  assert.ok(/^Rien à poursuivre/.test(g.ctx.poursuivreMesureStockage()), 'aucun tour en cours : rien');
  assert.ok(!g.feuilles['Stockage'], 'et rien n’est écrit');
  let appels = 0;
  g.ctx.chronoMs_ = () => (++appels > 12 ? 10 * 60 * 1000 : 0);   // le temps « saute » après 12 regards à la montre
  let m = mesurer(g), passages = 1;
  assert.ok(/^À suivre/.test(m), m);
  assert.ok(g.proprietes.STOCKAGE_SUITE, 'où l’on en est : noté');
  assert.ok(!ligneS(g, 'special:reste'), 'pas de « reste » avant la fin du tour');
  assert.ok(/^Mesure en cours : \d+ dossier\(s\) sur 6/.test(resume(g)[0]), resume(g)[0]);
  const faitsAuPremier = tableau(g).length;
  assert.ok(faitsAuPremier >= 1 && faitsAuPremier < 6, 'une partie seulement : ' + faitsAuPremier);
  while (/^À suivre/.test(m) && passages < 20) { appels = 0; m = g.ctx.poursuivreMesureStockage(); passages++; }
  assert.ok(/^Tour de mesure terminé : 6 dossier/.test(m) && passages >= 2, passages + ' passages : ' + m);
  noms.forEach((n, i) => {
    const l = tableau(g).filter(x => x[K.nom] === n);
    assert.strictEqual(l.length, 1, n + ' : une seule ligne');
    assert.strictEqual(l[0][K.total], i + 2, n + ' : poids juste');
  });
  assert.strictEqual(ligneS(g, 'special:reste')[K.total], 500 - 27, 'reste après le tour complet');
  assert.ok(!/incomplète/.test(tableau(g).map(l => l[K.nom]).join()), 'aucun dossier mesuré en partie');
  assert.ok(/^Rien à poursuivre/.test(g.ctx.poursuivreMesureStockage()));
});
test('un dossier trop gros pour un passage : mesuré en partie, la ligne et le « reste » le disent, aucune purge proposée', () => {
  const g = environnement({ stockage: { utilise: 10 * MO } });
  const x = chantierFini(g, 'GROS');
  for (let i = 0; i < 12; i++) fichier(g, sous(g, x.d, 'Divers/sous ' + i), 'f.pdf', 1000);
  let appels = 0;
  g.ctx.chronoMs_ = () => (++appels > 5 ? 10 * 60 * 1000 : 0);
  let m = mesurer(g), n = 0;
  while (/^À suivre/.test(m) && n++ < 10) { appels = 0; m = g.ctx.poursuivreMesureStockage(); }
  assert.ok(/mesure incomplète/.test(ligneS(g, 'chantier:' + x.d.id)[K.nom]));
  assert.ok(/approximatif/.test(ligneS(g, 'special:reste')[K.nom]));
  assert.strictEqual(ligneP(g, 'GROS')[P.possible], 'non');
  assert.ok(/trop gros/.test(ligneP(g, 'GROS')[P.pourquoi]), ligneP(g, 'GROS')[P.pourquoi]);
});
test('« reste du compte » : jamais négatif', () => {
  const g = driveDeMesure({ stockage: { utilise: 3 * MO } });
  mesurer(g);
  assert.strictEqual(ligneS(g, 'special:reste')[K.total], 0);
});
test('avec le service avancé Drive : total du compte, part de Drive, de Gmail et Photos, de la corbeille ; en panne : repli sur DriveApp, et l’onglet le dit', () => {
  const g = driveDeMesure({ stockage: { utilise: 4 * GO }, driveAvance: { usage: 9 * GO, usageInDrive: 6 * GO, usageInDriveTrash: 1 * GO, limit: 15 * GO } });
  mesurer(g);
  let r = resume(g);
  assert.strictEqual(r[1], '9 Go sur 15 Go (60 %)', 'le total vient du service avancé, pas de DriveApp');
  assert.ok(/^Service avancé Drive/.test(r[3]), r[3]);
  assert.deepStrictEqual([r[4], r[5], r[6]], ['6 Go', '3 Go', '1 Go']);
  assert.strictEqual(ligneS(g, 'special:reste')[K.total], 9 * 1024 - 15, 'reste = total du compte − ce qui a été mesuré');
  g.etat.driveAvance = null;   // le service répond par une erreur
  mesurer(g);
  r = resume(g);
  assert.strictEqual(r[1], '4 Go sur 15 Go (26 %)');
  assert.ok(/^DriveApp/.test(r[3]) && /en panne/.test(r[3]), r[3]);
});
test('onglet « Stockage » aux titres modifiés à la main : arrêt, rien n’est écrit, un mail (un seul par jour)', () => {
  const g = driveDeMesure();
  mesurer(g);
  const f = g.feuilles['Stockage'];
  f.lignes[10][3] = 'Poids';   // un titre renommé
  const avant = JSON.stringify(f.lignes), mails = g.mails.length;
  const m = mesurer(g);
  assert.ok(/^Mesure arrêtée/.test(m) && /titres/.test(m), m);
  assert.strictEqual(JSON.stringify(f.lignes), avant, 'rien écrit');
  assert.strictEqual(g.mails.length, mails + 1);
  assert.ok(/Onglet « Stockage » modifié/.test(g.mails[mails].sujet) && g.mails[mails].to === 'franck@loue.test');
  mesurer(g);
  assert.strictEqual(g.mails.length, mails + 1, 'pas de second mail le même jour');
  assert.strictEqual(g.proprietes.STOCKAGE_EN_COURS, undefined, 'verrou rendu malgré l’arrêt');
});
test('onglet « Purges » aux titres modifiés : ni mesure, ni traitement des cases', () => {
  const g = environnement();
  const x = chantierFini(g, 'FINI');
  mesurer(g);
  cocher(g, 'FINI');
  g.feuilles['Purges'].lignes[0][6] = 'Corbeille ?';
  assert.ok(/^Mesure arrêtée/.test(mesurer(g)));
  assert.strictEqual(g.ctx.traiterPurges(), 'onglet modifié');
  assert.ok(!corbeille(x.f1) && g.etat.corbeilles.length === 0, 'rien à la corbeille');
  assert.strictEqual(mailsDe(g, /Onglet « Purges » modifié/).length, 1);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
console.log('\nLot 5 — les alertes de place');
const placer = (g, pourcent) => { g.etat.stockage.utilise = Math.round(15 * GO * (pourcent + 0.2) / 100); return mesurer(g); };
const alertes = g => mailsDe(g, /Place Google|URGENT/);
test('70 %, 85 %, 95 % : un mail par seuil franchi ; deux mails par mois au plus pour 70 et 85 ; 95 part toujours, puis un rappel par semaine', () => {
  const g = environnement();
  placer(g, 50);
  assert.strictEqual(alertes(g).length, 0);
  assert.ok(/Mail d’alerte envoyé \(seuil 70 %\)/.test(placer(g, 72)));
  assert.strictEqual(alertes(g).length, 1);
  assert.ok(/72 %/.test(alertes(g)[0].sujet) && alertes(g)[0].to === 'franck@loue.test' && /onglet « Purges »/.test(alertes(g)[0].texte));
  assert.ok(/^Attention : 72 %/.test(resume(g)[0]), resume(g)[0]);
  placer(g, 73);
  assert.strictEqual(alertes(g).length, 1, 'même seuil : pas de second mail');
  placer(g, 86);
  assert.strictEqual(alertes(g).length, 2, '85 % : deuxième mail du mois');
  placer(g, 60); placer(g, 72);
  assert.strictEqual(alertes(g).length, 2, 'troisième franchissement du mois : pas de mail');
  assert.strictEqual(JSON.parse(g.proprietes.STOCKAGE_ALERTES).niveau, 0, 'et le seuil n’est pas noté « prévenu »');
  assert.ok(/^Attention : 72 %/.test(resume(g)[0]), 'mais l’onglet le dit toujours');
  placer(g, 96);
  assert.strictEqual(alertes(g).length, 3, '95 % : toujours envoyé');
  assert.ok(/URGENT/.test(alertes(g)[2].sujet) && /PLUS AUCUN MAIL NE PART NI N’ARRIVE/.test(alertes(g)[2].texte));
  assert.ok(/^URGENT : 96 %/.test(resume(g)[0]), resume(g)[0]);
  placer(g, 96);
  assert.strictEqual(alertes(g).length, 3, 'pas tous les jours');
  g.now += 8 * JOUR; placer(g, 97);
  assert.strictEqual(alertes(g).length, 4, 'rappel au bout d’une semaine');
  assert.ok(/^Rappel/.test(alertes(g)[3].texte));
  g.now += 30 * JOUR; placer(g, 60); placer(g, 71);
  assert.strictEqual(alertes(g).length, 5, 'mois suivant : le compteur repart');
});
test('la marque « prévenu » n’est posée qu’après l’envoi réussi : mail en panne, puis quota épuisé → le mail part au passage suivant', () => {
  const g = environnement();
  g.etat.mailEnPanne = true;
  placer(g, 88);
  assert.strictEqual(alertes(g).length, 0);
  assert.ok(!g.proprietes.STOCKAGE_ALERTES || JSON.parse(g.proprietes.STOCKAGE_ALERTES).niveau === 0, 'seuil pas marqué');
  g.etat.mailEnPanne = false; g.etat.quota = 0;
  placer(g, 88);
  assert.strictEqual(alertes(g).length, 0, 'quota épuisé : rien, et rien de marqué');
  g.etat.quota = 50;
  placer(g, 88);
  assert.strictEqual(alertes(g).length, 1);
  assert.strictEqual(JSON.parse(g.proprietes.STOCKAGE_ALERTES).niveau, 85);
});
test('déjà au-dessus d’un seuil à l’installation : le mail part à la première mesure', () => {
  const g = environnement({ stockage: { utilise: Math.round(15 * GO * 0.9) } });
  assert.ok(/installation terminée/.test(g.ctx.installerLot5Production()));
  assert.strictEqual(alertes(g).length, 0, 'l’installation n’envoie rien');
  mesurer(g);
  assert.strictEqual(alertes(g).length, 1);
  assert.ok(/90 %/.test(alertes(g)[0].sujet));
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
console.log('\nLot 5 — la date « Terminé »');
test('posée quand le statut passe à « Terminé », effacée s’il repasse à un autre statut, jamais remplacée si elle est saisie', () => {
  const g = environnement();
  const saisie = new Date(2025, 0, 15);
  g.feuilles['Chantiers'].lignes.push(['A', '', 'Terminé', '', '', '', '', '', '', '', ''], ['B', '', 'En cours', '', '', '', '', '', '', new Date(2026, 5, 1), ''],
    ['C', '', 'Terminé', '', '', '', '', '', '', saisie, ''], ['D', '', 'En préparation', '', '', '', '', '', '', '', '']);
  const m = mesurer(g);
  const l = g.feuilles['Chantiers'].lignes;
  assert.strictEqual(l[1][9].getTime(), MAINTENANT, 'A : date posée');
  assert.strictEqual(l[2][9], '', 'B : date effacée');
  assert.strictEqual(l[3][9], saisie, 'C : date saisie gardée');
  assert.strictEqual(l[4][9], '', 'D : rien');
  assert.ok(/1 posée\(s\), 1 effacée\(s\)/.test(m), m);
  l[1][2] = 'En cours'; mesurer(g);
  assert.strictEqual(l[1][9], '', 'A repasse « En cours » : date effacée');
  l[1][2] = 'Terminé'; g.now += 3 * JOUR; mesurer(g);
  assert.strictEqual(l[1][9].getTime(), MAINTENANT + 3 * JOUR, 'A de nouveau « Terminé » : nouvelle date');
  assert.deepStrictEqual(l.map(x => x.slice(0, 9).join()), ['Nom,Référence,Statut,Conducteur,N°,Nom court,Adresse,Client,Architecte', 'A,,Terminé,,,,,,', 'B,,En cours,,,,,,', 'C,,Terminé,,,,,,', 'D,,En préparation,,,,,,'], 'aucune autre cellule touchée');
});
test('colonne « Date « Terminé » » absente ou déplacée : rien n’est écrit dans l’onglet Chantiers', () => {
  const g = environnement({ feuilles: { 'Chantiers': [['Nom', 'Référence', 'Statut', 'Conducteur', 'N°', 'Nom court', 'Adresse', 'Client', 'Architecte', 'Autre chose', '']] } });
  g.feuilles['Chantiers'].lignes.push(['A', '', 'Terminé', '', '', '', '', '', '', '', '']);
  mesurer(g);
  assert.strictEqual(g.feuilles['Chantiers'].lignes[1][9], '');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
console.log('\nLot 5 — propositions : anciens indices du carnet');
function carnetIndices(g) {
  const d = chantier(g, 'INDICES'), c = sous(g, d, 'CARNET'), x = { d: d, carnet: c };
  x.ancien = sous(g, c, '101 A PLAN'); fichier(g, x.ancien, 'p1.webp', 3 * MO); fichier(g, x.ancien, 'p1-z0-0.pak', 2 * MO);
  x.dernier = sous(g, c, '101 B PLAN'); fichier(g, x.dernier, 'p1.webp', 3 * MO);
  x.redepose = sous(g, c, '102 A NOTICE'); fichier(g, x.redepose, 'p1.webp', MO);          // retiré puis redéposé : même dossier
  x.inconnu = sous(g, c, 'DEPOT EN COURS'); fichier(g, x.inconnu, 'p1.webp', MO);           // inconnu de carnet.json
  x.double1 = g.creerElement('dossier', '103 A COUPE', c); fichier(g, x.double1, 'p1.webp', MO);   // deux dossiers de même nom
  x.double2 = g.creerElement('dossier', '103 A COUPE', c); fichier(g, x.double2, 'p1.webp', MO);
  x.json = fichier(g, c, 'carnet.json', undefined, { contenu: liste('INDICES', [doc('101-A', '101', 'A', '101 A PLAN'), doc('101-B', '101', 'B', '101 B PLAN'),
    doc('102-A', '102', 'A', '102 A NOTICE', { retire: true }), doc('102-A2', '102', 'A', '102 A NOTICE'),
    doc('103-A', '103', 'A', '103 A COUPE'), doc('103-B', '103', 'B', '103 B COUPE')]) });
  return x;
}
test('seul l’ancien indice que plus aucun document montré ne désigne est proposé : jamais le dernier indice, un document retiré puis redéposé, un dossier inconnu, deux dossiers de même nom', () => {
  const g = environnement(), x = carnetIndices(g);
  mesurer(g);
  const l = ligneP(g, 'INDICES', 'Anciens indices du carnet');
  assert.deepStrictEqual([l[P.possible], l[P.etat], l[P.poids], l[P.fichiers], l[P.corbeille], l[P.annuler]], ['oui', 'Proposé', 5, 2, false, false], l[P.pourquoi]);
  assert.ok(/^Possible : 1 élément\(s\), 2 fichier\(s\)/.test(l[P.pourquoi]) && /laissé\(s\) en place/.test(l[P.pourquoi]) && /DEPOT EN COURS/.test(l[P.pourquoi]) && /deux dossiers de ce nom/.test(l[P.pourquoi]), l[P.pourquoi]);
  assert.strictEqual(l[P.cle], 'indices|indices|' + x.d.id + '|1', 'clé fixe : nature, chantier, identifiant du dossier');
  const s = ligneS(g, 'chantier:' + x.d.id);
  assert.deepStrictEqual([s[K.indices], s[K.indicesMo]], [1, 5]);
  assert.ok(/anciens indices : purge possible/.test(s[K.purge]), s[K.purge]);
  assert.strictEqual(purges(g).length, 1, 'chantier « En cours » : pas de ligne « Chantier terminé »');
  // la purge : le dossier de l'ancien indice, et lui seul
  cocher(g, 'INDICES', 'Anciens indices du carnet');
  assert.strictEqual(g.ctx.traiterPurges(), '1 ligne(s) traitée(s)');
  assert.deepStrictEqual([x.ancien, x.dernier, x.redepose, x.inconnu, x.double1, x.double2, x.json, x.carnet, x.d].map(corbeille), [true, false, false, false, false, false, false, false, false]);
  assert.deepStrictEqual(g.etat.corbeilles.map(c => c.nom), ['101 A PLAN'], 'une seule mise à la corbeille : le dossier entier du document');
  const apres = ligneP(g, 'INDICES', 'Anciens indices du carnet');
  assert.deepStrictEqual([apres[P.etat], apres[P.nbFaits], apres[P.corbeille]], ['Fait', 2, false]);
  // les téléphones voient toujours les mêmes documents
  const montres = g.ctx.carnetDocuments_(g.ctx.carnetListe_(x.carnet.api).liste, 'INDICES', 'INDICES').map(d => d.id);
  assert.deepStrictEqual(Array.from(montres), ['101-B', '102-A2', '103-B']);
});
test('carnet sans ancien indice : aucune ligne ; liste carnet.json en double, ou carnet d’un autre chantier : rien n’est proposé', () => {
  let g = environnement();
  let d = chantier(g, 'NEUF'), c = sous(g, d, 'CARNET');
  fichier(g, sous(g, c, '101 B PLAN'), 'p1.webp', MO);
  fichier(g, c, 'carnet.json', undefined, { contenu: liste('NEUF', [doc('101-B', '101', 'B', '101 B PLAN')]) });
  mesurer(g);
  assert.strictEqual(purges(g).length, 0);
  g = environnement(); let x = carnetIndices(g);
  fichier(g, x.carnet, 'carnet.json', undefined, { contenu: liste('INDICES', []) });
  mesurer(g);
  assert.strictEqual(purges(g).length, 0, 'deux listes : rien');
  g = environnement(); x = carnetIndices(g);
  x.json.contenu = liste('UN AUTRE CHANTIER', JSON.parse(x.json.contenu).documents);
  mesurer(g);
  assert.strictEqual(purges(g).length, 0, 'carnet d’un autre chantier : rien');
});
test('anciens indices : dossier du chantier trouvé par son nom seulement (pas de ligne dans « Dossiers chantiers ») → jamais « possible »', () => {
  const g = environnement(), x = carnetIndices(g);
  g.feuilles['Dossiers chantiers'].lignes.pop();
  mesurer(g);
  const l = ligneP(g, 'INDICES', 'Anciens indices du carnet');
  assert.strictEqual(l[P.possible], 'non');
  assert.ok(/jamais pris par ressemblance/.test(l[P.pourquoi]), l[P.pourquoi]);
  cocher(g, 'INDICES', 'Anciens indices du carnet');
  g.ctx.traiterPurges();
  assert.ok(!corbeille(x.ancien) && g.etat.corbeilles.length === 0, 'case cochée quand même : refusé, rien à la corbeille');
  assert.ok(/^Refusé le/.test(ligneP(g, 'INDICES', 'Anciens indices du carnet')[P.message]));
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
console.log('\nLot 5 — propositions : chantier terminé');
test('tout est réuni : proposé, avec le poids, le nombre de fichiers et le rappel sur MEGA', () => {
  const g = environnement(), x = chantierFini(g, 'FINI');
  mesurer(g);
  const l = ligneP(g, 'FINI');
  assert.deepStrictEqual([l[P.possible], l[P.etat], l[P.fichiers], l[P.corbeille], l[P.annuler]], ['oui', 'Proposé', 6, false, false], l[P.pourquoi]);
  assert.ok(/^Possible : 6 élément\(s\), 6 fichier\(s\)/.test(l[P.pourquoi]), l[P.pourquoi]);
  assert.ok(/MEGA a fini de synchroniser le dossier du chantier/.test(l[P.pourquoi]) && /1 fichier\(s\) hors des dossiers de l’appli/.test(l[P.pourquoi]) === false, l[P.pourquoi]);
  assert.ok(/2 fichier\(s\) hors des dossiers de l’appli \(relevé compris\)/.test(l[P.pourquoi]), l[P.pourquoi]);
  assert.strictEqual(l[P.cle], 'termine|fini|' + x.d.id + '|1');
  assert.ok(/chantier terminé : purge possible/.test(ligneS(g, 'chantier:' + x.d.id)[K.purge]));
  assert.strictEqual(g.etat.corbeilles.length, 0, 'proposer ne met rien à la corbeille');
});
const refuse = (nom, o, motif, apres) => test('jamais proposé : ' + nom, () => {
  const g = environnement(o.env || {}), x = chantierFini(g, 'FINI', o);
  if (apres) apres(g, x);
  mesurer(g);
  const l = ligneP(g, 'FINI');
  assert.ok(l, 'une ligne dit ce qui manque');
  assert.deepStrictEqual([l[P.possible], l[P.etat]], ['non', 'Impossible'], l[P.pourquoi]);
  assert.ok(motif.test(l[P.pourquoi]), l[P.pourquoi]);
  // et même si Franck coche la case : refusé, rien ne part
  cocher(g, 'FINI');
  g.ctx.traiterPurges();
  assert.strictEqual(g.etat.corbeilles.length, 0, 'rien à la corbeille');
  assert.strictEqual(ligneP(g, 'FINI')[P.corbeille], false, 'case décochée');
});
refuse('« Terminé » depuis moins de 6 mois (la ligne dit à partir de quand)', { termine: new Date(MAINTENANT - 100 * JOUR) }, /purge possible à partir du \d\d\/\d\d\/2027 \(6 mois\)/);
refuse('date « Terminé » dans le futur : ignorée', { termine: new Date(MAINTENANT + 10 * JOUR) }, /dans le futur/);
refuse('date « Terminé » illisible', { termine: 'l’an dernier' }, /illisible/);
refuse('statut « Terminé » sans date (elle vient d’être posée : 6 mois à attendre)', { termine: '' }, /terminé depuis le 13\/11\/2026/i);
refuse('pas de relevé', { releve: false }, /Pas de relevé « releve-pc\.json ».*relancez le programme du PC, puis attendez la prochaine mesure/);
refuse('relevé sous l’ancien nom mega-index.json : pas accepté', { nomReleve: 'mega-index.json' }, /Pas de relevé « releve-pc\.json »/);
refuse('relevé de plus de 30 jours', { dateReleve: MAINTENANT - 31 * JOUR }, /plus de 30 jours/);
refuse('relevé daté du futur', { dateReleve: MAINTENANT + 3 * JOUR }, /daté du futur/);
refuse('relevé d’un autre chantier', { chantierReleve: 'UN AUTRE CHANTIER' }, /celui d’un autre chantier \(« UN AUTRE CHANTIER »\)/);
refuse('relevé illisible', {}, /illisible/, (g, x) => { x.releve.contenu = '{ pas du json'; });
refuse('deux relevés', {}, /Deux relevés/, (g, x) => releve(g, x.d, 'FINI', x.lignesReleve));
refuse('une fiche absente du relevé (la ligne dit quoi faire)', { lignesReleve: [[QUITUS + '/QUITUS A 2026-01-10.pdf', 1000], [PHOTOS + '/photo 1.jpg', 5000]] },
  /1 fiche\(s\) ou photo\(s\) absente\(s\) du relevé \(« .*QUITUS B 2026-01-11\.pdf »\) : relancez le programme du PC, puis attendez la prochaine mesure/);
refuse('une fiche dont la taille n’est pas celle du relevé', { lignesReleve: [[QUITUS + '/QUITUS A 2026-01-10.pdf', 1000], [QUITUS + '/QUITUS B 2026-01-11.pdf', 2001], [PHOTOS + '/photo 1.jpg', 5000]] }, /taille n’est pas celle du relevé/);
refuse('deux fichiers de même nom dans un dossier du Drive (bloqué, avec le nom), même si le relevé a deux lignes',
  { lignesReleve: [[QUITUS + '/QUITUS A 2026-01-10.pdf', 1000], [QUITUS + '/QUITUS A 2026-01-10.pdf', 1000], [QUITUS + '/QUITUS B 2026-01-11.pdf', 2000], [PHOTOS + '/photo 1.jpg', 5000]] },
  /Deux fichiers de même nom dans un dossier du Drive \(« .*QUITUS A 2026-01-10\.pdf »\)/, (g, x) => fichier(g, x.quitus, 'QUITUS A 2026-01-10.pdf', 1000));
refuse('un envoi en attente pour ce chantier', {}, /1 envoi\(s\) en attente ou abandonné\(s\)/, g => {
  g.feuilles['Mails en attente'] = { lignes: [] };
  g.ctx.SpreadsheetApp.getActiveSpreadsheet().insertSheet('Mails en attente').appendRow(['Horodatage', 'Fiche', 'Chantier', 'Destinataire', 'Copie cachée', 'Sujet', 'Texte', 'HTML', 'PDF', 'Nom', 'État', 'Essais', 'Dernier essai']);
  g.feuilles['Mails en attente'].lignes.push([new Date(), 'quitus', 'fini', 'a@b.fr', '', 's', 't', '', 'idpdf', 'n.pdf', 'en attente', 1, new Date()]);
});
refuse('un envoi abandonné pour ce chantier', {}, /en attente ou abandonné/, g => {
  g.ctx.SpreadsheetApp.getActiveSpreadsheet().insertSheet('Mails en attente').appendRow(['Horodatage']);
  g.feuilles['Mails en attente'].lignes.push([new Date(), 'quitus', 'FINI', 'a@b.fr', '', 's', 't', '', 'idpdf', 'n.pdf', 'abandonné', 12, new Date()]);
});
refuse('dossier trouvé par ressemblance de nom (aucune ligne dans « Dossiers chantiers »)', { sansLigne: true }, /jamais pris par ressemblance de nom/);
refuse('ligne « À vérifier » dans « Dossiers chantiers »', { trouvePar: 'ressemblance', aVerifier: 'OUI — vérifiez que c’est le bon dossier' }, /« À vérifier »/);
test('jamais proposé : identifiant du dossier porté par deux chantiers (aucune ligne dans « Purges », l’onglet Stockage le dit)', () => {
  const g = environnement(), x = chantierFini(g, 'FINI');
  g.feuilles['Chantiers'].lignes.push(['AUTRE', '', 'En cours', '', '', '', '', '', '', '', '']);
  g.feuilles['Dossiers chantiers'].lignes.push(['AUTRE', 'FINI', x.d.id, 'créé', '']);
  mesurer(g);
  assert.strictEqual(purges(g).length, 0);
  const s = ligneS(g, 'chantier:' + x.d.id);
  assert.ok(s[K.nom] === 'FINI + AUTRE' && /porté par plusieurs chantiers : aucune purge proposée/.test(s[K.purge]), JSON.stringify(s));
  const ctx = g.ctx.prgContexte_(), r = g.ctx.prgDossierSur_(ctx.chantiers['fini'], ctx);
  assert.ok(!r.ok && /noté pour un autre chantier \(« AUTRE »\)/.test(r.raison), r.raison);
  assert.strictEqual(g.ctx.prgExaminerTermine_(ctx.chantiers['fini'], ctx, 30, () => false, null, null).possible, false);
});
refuse('deux dossiers notés pour le chantier', {}, /plusieurs dossiers/i, (g, x) => {
  const autre = g.creerElement('dossier', 'FINI BIS', g.racine, { id: 'D-BIS' });
  g.feuilles['Dossiers chantiers'].lignes.push(['FINI', 'FINI BIS', autre.id, 'créé', '']);
});
refuse('deux lignes du même nom dans l’onglet Chantiers', {}, /deux lignes portent ce nom/i, g => g.feuilles['Chantiers'].lignes.push(['fini', '', 'Terminé', '', '', '', '', '', '', new Date(MAINTENANT - 300 * JOUR), '']));
refuse('dossier du chantier hors de la racine du Drive de cet environnement', { parent: null }, /n’est pas dans le Drive de cet environnement/);
refuse('copie TEST dont le dossier racine ne s’appelle pas « … TEST … »', { env: { test: true, nomRacine: 'Loué Menuiserie - Chantiers' } }, /copie TEST.*aucune purge/);
refuse('production dont le dossier racine s’appelle « … TEST … »', { env: { nomRacine: 'CHANTIERPRO-TEST' } }, /production.*aucune purge/);
refuse('carnet en cours d’arrivée (liste illisible)', {}, /Carnet : /, (g, x) => { x.json.contenu = '{'; });
test('chantier qui n’est pas « Terminé » : aucune ligne « Chantier terminé » ; s’il repasse « En cours », sa ligne devient « Impossible »', () => {
  const g = environnement(), x = chantierFini(g, 'FINI', { statut: 'En cours' });
  mesurer(g);
  assert.ok(!ligneP(g, 'FINI'));
  const l = g.feuilles['Chantiers'].lignes[1];
  l[2] = 'Terminé'; l[9] = new Date(MAINTENANT - 200 * JOUR); mesurer(g);
  assert.strictEqual(ligneP(g, 'FINI')[P.possible], 'oui');
  l[2] = 'En cours'; mesurer(g);
  assert.strictEqual(termines(g).length, 1, 'la même ligne, jamais effacée');
  assert.strictEqual(ligneP(g, 'FINI')[P.possible], 'non');
  assert.ok(/n’est pas au statut « Terminé »/.test(ligneP(g, 'FINI')[P.pourquoi]));
  assert.ok(!corbeille(x.f1));
});
test('accents : un nom décomposé (NFD) dans Drive et composé (NFC) dans le relevé se correspondent ; comparaison un pour un (une ligne du relevé ne sert qu’une fois)', () => {
  const g = environnement(), x = chantierFini(g, 'FINI', { releve: false });
  fichier(g, x.quitus, 'RE\u0301CEPTION E\u0301TE\u0301.pdf', 4000);   // « É » écrit en deux caractères
  releve(g, x.d, 'FINI', x.lignesReleve.concat([[QUITUS + '/RÉCEPTION ÉTÉ.pdf', 4000]]));
  mesurer(g);
  assert.strictEqual(ligneP(g, 'FINI')[P.possible], 'oui', ligneP(g, 'FINI')[P.pourquoi]);
  const r = g.ctx.prgComparer_([{ chemin: 'a.pdf', taille: 1 }, { chemin: 'a.pdf', taille: 1 }, { chemin: 'b.pdf', taille: 2 }], { lignes: { '/a.pdf': [1], '/b.pdf': [3] } });
  assert.deepStrictEqual([Array.from(r.doublons), Array.from(r.tailles), r.absents.length + r.tailles.length], [['a.pdf'], ['a.pdf', 'b.pdf'], 2]);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
console.log('\nLot 5 — la purge');
test('rien sans case cochée : traiterPurges sort tout de suite, sans verrou, sans rien toucher', () => {
  const g = environnement(), x = chantierFini(g, 'FINI');
  assert.strictEqual(g.ctx.traiterPurges(), 'rien', 'pas d’onglet : rien');
  mesurer(g);
  const avant = JSON.stringify(g.feuilles['Purges'].lignes), proprietes = JSON.stringify(g.proprietes);
  assert.strictEqual(g.ctx.traiterPurges(), 'rien');
  assert.strictEqual(JSON.stringify(g.feuilles['Purges'].lignes), avant);
  assert.strictEqual(JSON.stringify(g.proprietes), proprietes, 'aucune propriété écrite (pas même son verrou)');
  assert.ok(g.etat.corbeilles.length === 0 && detail(g).length === 0 && !corbeille(x.f1));
});
test('chantier terminé : fiches et photos fichier par fichier, dossiers gardés, carnet par dossier puis carnet.json en dernier ; jamais le dossier du chantier, le relevé ni le reste ; journal écrit AVANT ; mail ; dates', () => {
  const g = environnement(), x = chantierFini(g, 'FINI');
  mesurer(g);
  cocher(g, 'FINI');
  const fautes = [];
  g.etat.avantCorbeille = (el, valeur) => {
    if (!valeur) return;
    const l = detail(g).filter(d => d[D.id] === el.id)[0];
    if (!l || l[D.etat] !== 'à faire') fautes.push(el.nom + ' : pas noté « à faire » avant sa mise à la corbeille');
    if (!g.etat.flush) fautes.push(el.nom + ' : journal pas encore enregistré (flush)');
    if (ligneP(g, 'FINI')[P.etat] !== 'En cours') fautes.push('la ligne ne dit pas « En cours »');
  };
  const mails = g.mails.length;
  assert.strictEqual(g.ctx.traiterPurges(), '1 ligne(s) traitée(s)');
  assert.deepStrictEqual(fautes, []);
  assert.deepStrictEqual([x.f1, x.f2, x.p1, x.docA, x.docB, x.json].map(corbeille), [true, true, true, true, true, true]);
  assert.deepStrictEqual([x.d, x.quitus, x.photos, x.carnet, x.releve, x.divers, g.racine].map(corbeille), [false, false, false, false, false, false, false],
    'restent en place : dossier du chantier, dossiers des fiches et des photos, dossier CARNET, relevé, fichier hors des dossiers de l’appli');
  const ordre = g.etat.corbeilles.map(c => c.nom);
  assert.strictEqual(ordre.length, 6, 'six mises à la corbeille, pas une de plus : ' + ordre.join());
  assert.strictEqual(ordre[5], 'carnet.json', 'carnet.json en dernier');
  assert.deepStrictEqual(ordre.slice(3, 5).sort(), ['101 A PLAN', '101 B PLAN'], 'les dossiers des documents avant lui');
  assert.ok(g.etat.corbeilles.every(c => c.valeur === true));
  const d = detail(g);
  assert.strictEqual(d.length, 6);
  assert.ok(d.every(l => l[D.etat] === 'fait' && l[D.cle] === 'termine|fini|' + x.d.id + '|1'), JSON.stringify(d.map(l => l[D.etat])));
  assert.deepStrictEqual(d.filter(l => l[D.id] === x.f2.id).map(l => [l[D.type], l[D.chemin], l[D.taille]])[0], ['fichier', QUITUS + '/QUITUS B 2026-01-11.pdf', 2000]);
  const l = ligneP(g, 'FINI');
  assert.deepStrictEqual([l[P.etat], l[P.nbFaits], l[P.corbeille], l[P.annuler]], ['Fait', 6, false, false]);
  assert.strictEqual(l[P.faitLe].getTime(), MAINTENANT);
  assert.strictEqual(l[P.libere].getTime(), MAINTENANT + 30 * JOUR, 'place libérée 30 jours plus tard');
  assert.strictEqual(l[P.jusquau].getTime(), MAINTENANT + 25 * JOUR, 'annulation possible 25 jours');
  assert.ok(/6 fichier\(s\) à la corbeille/.test(l[P.message]) && /cochez « Annuler » avant le 08\/12\/2026/.test(l[P.message]), l[P.message]);
  assert.strictEqual(g.mails.length, mails + 1, 'un mail');
  const m = g.mails[mails];
  assert.strictEqual(m.to, 'franck@loue.test');
  assert.ok(/Mise à la corbeille — FINI — Chantier terminé/.test(m.sujet), m.sujet);
  assert.ok(/6 fichier\(s\)/.test(m.texte) && /POUR ANNULER/.test(m.texte) && /avant le 08\/12\/2026/.test(m.texte) && /libérée le 13\/12\/2026/.test(m.texte) && /Rien n’est supprimé définitivement/.test(m.texte), m.texte);
  assert.strictEqual(g.proprietes.PURGE_EN_COURS, undefined, 'verrou de la purge rendu');
  assert.strictEqual(g.etat.verrousScript, 0, 'le verrou des fiches n’a jamais été demandé');
  assert.strictEqual(g.ctx.traiterPurges(), 'rien', 'passage suivant : plus rien à faire');
  // mesure suivante : la ligne reste « Fait », aucune nouvelle ligne tant qu'il n'y a rien de nouveau
  g.now += JOUR; mesurer(g);
  assert.strictEqual(termines(g).length, 1);
  assert.deepStrictEqual([ligneP(g, 'FINI', 'Anciens indices du carnet')[P.possible], ligneP(g, 'FINI', 'Anciens indices du carnet')[P.etat]], ['non', 'Impossible'], 'l’ancien indice est parti avec le chantier : plus rien à proposer');
  assert.strictEqual(ligneP(g, 'FINI')[P.etat], 'Fait');
  assert.ok(/mis à la corbeille le 13\/11\/2026/.test(ligneS(g, 'chantier:' + x.d.id)[K.purge]), ligneS(g, 'chantier:' + x.d.id)[K.purge]);
  // une fiche arrive plus tard d'un téléphone : elle retrouve son dossier, et sera proposée sur une NOUVELLE ligne
  const tard = fichier(g, x.quitus, 'QUITUS TARDIF.pdf', 900);
  x.releve.contenu = JSON.stringify({ version: 1, chantier: 'FINI', releve_le: new Date(g.now).toISOString(), fichiers: [{ chemin: QUITUS + '/QUITUS TARDIF.pdf', taille: 900 }] });
  mesurer(g);
  assert.strictEqual(termines(g).length, 2);
  assert.deepStrictEqual([ligneP(g, 'FINI')[P.cle], ligneP(g, 'FINI')[P.possible], ligneP(g, 'FINI')[P.fichiers]], ['termine|fini|' + x.d.id + '|2', 'oui', 1]);
  assert.ok(!corbeille(tard));
});
test('conditions revérifiées quand la case est traitée : un relevé de plus de 7 jours (proposé, car de moins de 30) est refusé', () => {
  const g = environnement(), x = chantierFini(g, 'FINI', { dateReleve: MAINTENANT - 10 * JOUR });
  mesurer(g);
  assert.strictEqual(ligneP(g, 'FINI')[P.possible], 'oui');
  cocher(g, 'FINI');
  g.ctx.traiterPurges();
  const l = ligneP(g, 'FINI');
  assert.deepStrictEqual([l[P.possible], l[P.etat], l[P.corbeille]], ['non', 'Impossible', false]);
  assert.ok(/plus de 7 jours/.test(l[P.pourquoi]) && /^Refusé le/.test(l[P.message]) && /Rien n’a été mis à la corbeille/.test(l[P.message]), l[P.pourquoi] + ' / ' + l[P.message]);
  assert.strictEqual(g.etat.corbeilles.length, 0);
  assert.strictEqual(detail(g).length, 0);
  assert.strictEqual(g.mails.length, 0, 'pas de mail : rien n’est parti');
});
test('fichier arrivé entre la proposition et la case : refus ; fichier arrivé PENDANT la purge (après la comparaison) : laissé en place', () => {
  let g = environnement(), x = chantierFini(g, 'FINI');
  mesurer(g);
  const nouveau = fichier(g, x.quitus, 'QUITUS ARRIVÉ APRÈS.pdf', 1234);
  cocher(g, 'FINI');
  g.ctx.traiterPurges();
  assert.ok(/absente\(s\) du relevé/.test(ligneP(g, 'FINI')[P.pourquoi]));
  assert.ok(g.etat.corbeilles.length === 0 && !corbeille(nouveau) && !corbeille(x.f1));
  g = environnement(); x = chantierFini(g, 'FINI');
  mesurer(g); cocher(g, 'FINI');
  let pendant = null;
  g.etat.avantCorbeille = () => { if (!pendant) pendant = fichier(g, x.quitus, 'QUITUS ARRIVÉ PENDANT.pdf', 4321); };
  g.ctx.traiterPurges();
  assert.ok(pendant && !corbeille(pendant), 'jamais comparé : jamais touché');
  assert.ok(corbeille(x.f1) && corbeille(x.f2) && corbeille(x.p1));
  assert.strictEqual(detail(g).filter(l => l[D.id] === pendant.id).length, 0);
  assert.strictEqual(ligneP(g, 'FINI')[P.nbFaits], 6);
});
test('exécution coupée au milieu, puis reprise : rien à la corbeille sans trace, rien fait deux fois, tout est fini au passage suivant', () => {
  const g = environnement(), x = chantierFini(g, 'FINI');
  mesurer(g); cocher(g, 'FINI');
  // La coupure : au 3e fichier, l'exécution meurt (plus aucune ligne de code ne tourne ensuite)
  const marquer = g.ctx.prgMarquer_, arreter = g.ctx.prgArreter_;
  let n = 0;
  g.etat.avantCorbeille = () => { if (++n >= 3) { g.ctx.prgMarquer_ = () => { throw new Error('COUPURE'); }; g.ctx.prgArreter_ = () => {}; throw new Error('COUPURE'); } };
  g.ctx.traiterPurges();
  g.ctx.prgMarquer_ = marquer; g.ctx.prgArreter_ = arreter; g.etat.avantCorbeille = null;
  const partis = g.etat.corbeilles.map(c => c.id);
  assert.strictEqual(partis.length, 2, 'deux fichiers partis avant la coupure');
  assert.ok(partis.every(id => detail(g).some(l => l[D.id] === id && l[D.etat] === 'à faire')), 'chacun a sa ligne « à faire » dans le journal');
  assert.strictEqual(ligneP(g, 'FINI')[P.etat], 'En cours');
  assert.strictEqual(ligneP(g, 'FINI')[P.corbeille], true, 'la case reste cochée');
  // un passage lancé alors que le précédent tourne encore : rien
  g.proprietes.PURGE_EN_COURS = String(Date.now());
  assert.strictEqual(g.ctx.traiterPurges(), 'occupé');
  assert.strictEqual(g.etat.corbeilles.length, 2);
  // 8 minutes plus tard, l'exécution précédente est morte : la suivante reprend
  g.proprietes.PURGE_EN_COURS = String(Date.now() - 8 * 60 * 1000);
  assert.strictEqual(g.ctx.traiterPurges(), '1 ligne(s) traitée(s)');
  assert.deepStrictEqual([x.f1, x.f2, x.p1, x.docA, x.docB, x.json].map(corbeille), [true, true, true, true, true, true]);
  assert.strictEqual(g.etat.corbeilles.length, 6, 'aucun élément mis deux fois à la corbeille');
  const d = detail(g);
  assert.strictEqual(d.filter(l => l[D.etat] === 'fait').length, 6);
  assert.strictEqual(d.filter(l => l[D.etat] === 'à faire').length, 0, 'plus rien « à faire »');
  assert.ok(d.filter(l => /^non fait \(exécution coupée\)/.test(l[D.etat])).length >= 1, 'ce qui était noté sans être parti le dit');
  const l = ligneP(g, 'FINI');
  assert.deepStrictEqual([l[P.etat], l[P.nbFaits], l[P.corbeille]], ['Fait', 6, false]);
  assert.strictEqual(mailsDe(g, /Mise à la corbeille/).length, 1);
});
test('limite de temps pendant une purge : elle s’arrête proprement et continue au passage suivant', () => {
  const g = environnement(), x = chantierFini(g, 'FINI');
  for (let i = 0; i < 100; i++) { fichier(g, x.photos, 'p' + i + '.jpg', 10 + i); x.lignesReleve.push([PHOTOS + '/p' + i + '.jpg', 10 + i]); }
  x.releve.contenu = JSON.stringify({ version: 1, chantier: 'FINI', releve_le: new Date(g.now - JOUR).toISOString(), fichiers: x.lignesReleve.map(f => ({ chemin: f[0], taille: f[1] })) });
  mesurer(g); cocher(g, 'FINI');
  let t = 0;
  g.ctx.chronoMs_ = () => t;
  g.etat.avantCorbeille = () => { if (g.etat.corbeilles.length === 50) t = 10 * 60 * 1000; };   // les 4 minutes sont passées pendant le 2e paquet
  g.ctx.traiterPurges();
  assert.strictEqual(g.etat.corbeilles.length, 80, 'le paquet en cours est fini, le suivant n’est pas commencé');
  assert.deepStrictEqual([ligneP(g, 'FINI')[P.etat], ligneP(g, 'FINI')[P.corbeille]], ['En cours', true]);
  assert.ok(/suite au prochain passage/.test(ligneP(g, 'FINI')[P.message]));
  assert.strictEqual(detail(g).filter(l => l[D.etat] === 'à faire').length, 0);
  t = 0; g.etat.avantCorbeille = null;
  g.ctx.traiterPurges();
  assert.strictEqual(g.etat.corbeilles.length, 106);
  assert.deepStrictEqual([ligneP(g, 'FINI')[P.etat], ligneP(g, 'FINI')[P.nbFaits]], ['Fait', 106]);
});
test('annulation : tout ressort de la corbeille ; la ligne est proposée de nouveau à la mesure suivante', () => {
  const g = environnement(), x = chantierFini(g, 'FINI');
  mesurer(g); cocher(g, 'FINI'); g.ctx.traiterPurges();
  g.now += 10 * JOUR;
  cocher(g, 'FINI', undefined, P.annuler);
  assert.strictEqual(g.ctx.traiterPurges(), '1 ligne(s) traitée(s)');
  assert.deepStrictEqual([x.f1, x.f2, x.p1, x.docA, x.docB, x.json, x.imageA].map(corbeille), [false, false, false, false, false, false, false]);
  const l = ligneP(g, 'FINI');
  assert.deepStrictEqual([l[P.etat], l[P.annuler], l[P.corbeille], l[P.faitLe], l[P.libere], l[P.jusquau]], ['Annulé', false, false, '', '', '']);
  assert.ok(/^Annulé le .* : 6 fichier\(s\) remis en place\./.test(l[P.message]) && !/PAS pu revenir/.test(l[P.message]), l[P.message]);
  assert.ok(detail(g).every(d => d[D.etat] === 'remis'));
  x.releve.contenu = x.releve.contenu.replace(/"releve_le":"[^"]+"/, '"releve_le":"' + new Date(g.now).toISOString() + '"');
  mesurer(g);
  assert.strictEqual(termines(g).length, 1, 'la même ligne');
  assert.deepStrictEqual([ligneP(g, 'FINI')[P.etat], ligneP(g, 'FINI')[P.possible]], ['Proposé', 'oui']);
  // seconde purge puis seconde annulation : seuls les éléments de CETTE purge sont comptés
  cocher(g, 'FINI'); g.ctx.traiterPurges();
  assert.deepStrictEqual([ligneP(g, 'FINI')[P.etat], ligneP(g, 'FINI')[P.nbFaits]], ['Fait', 6]);
});
test('annulation après une corbeille vidée à la main : ce qui peut revenir revient, et la ligne dit combien n’ont pas pu', () => {
  const g = environnement(), x = chantierFini(g, 'FINI');
  mesurer(g); cocher(g, 'FINI'); g.ctx.traiterPurges();
  delete g.elements[x.f2.id];   // supprimé définitivement dans la corbeille de Drive, à la main
  cocher(g, 'FINI', undefined, P.annuler);
  g.ctx.traiterPurges();
  assert.deepStrictEqual([x.f1, x.p1, x.docA, x.docB, x.json].map(corbeille), [false, false, false, false, false]);
  const l = ligneP(g, 'FINI');
  assert.strictEqual(l[P.etat], 'Annulé');
  assert.ok(/5 fichier\(s\) remis en place/.test(l[P.message]) && /1 fichier\(s\) n’ont PAS pu revenir/.test(l[P.message]), l[P.message]);
  assert.strictEqual(detail(g).filter(d => /^non remis \(introuvable/.test(d[D.etat])).length, 1);
});
test('annulation fermée au bout de 25 jours ; « Annuler » sur une ligne jamais purgée : rien', () => {
  const g = environnement(), x = chantierFini(g, 'FINI');
  mesurer(g);
  cocher(g, 'FINI', undefined, P.annuler);
  g.ctx.traiterPurges();
  assert.ok(/Rien à annuler/.test(ligneP(g, 'FINI')[P.message]) && ligneP(g, 'FINI')[P.annuler] === false);
  cocher(g, 'FINI'); g.ctx.traiterPurges();
  g.now += 26 * JOUR;
  cocher(g, 'FINI', undefined, P.annuler);
  g.ctx.traiterPurges();
  const l = ligneP(g, 'FINI');
  assert.ok(/Annulation refusée : le délai de 25 jours est passé/.test(l[P.message]) && /à la main dans la corbeille de Drive/.test(l[P.message]), l[P.message]);
  assert.deepStrictEqual([l[P.etat], l[P.annuler]], ['Fait', false]);
  assert.ok(corbeille(x.f1), 'rien n’est ressorti');
});
test('les deux cases cochées en même temps : rien n’est fait, la ligne le dit', () => {
  const g = environnement(), x = chantierFini(g, 'FINI');
  mesurer(g);
  cocher(g, 'FINI'); cocher(g, 'FINI', undefined, P.annuler);
  g.ctx.traiterPurges();
  const l = ligneP(g, 'FINI');
  assert.ok(/Les deux cases étaient cochées : rien n’a été fait/.test(l[P.message]), l[P.message]);
  assert.deepStrictEqual([l[P.etat], l[P.corbeille], l[P.annuler]], ['Proposé', false, false]);
  assert.ok(g.etat.corbeilles.length === 0 && !corbeille(x.f1));
});
test('lignes triées par Franck (avant, et pendant le traitement) : la bonne ligne est retrouvée par sa clé, l’autre chantier n’est pas touché', () => {
  const g = environnement(), x = chantierFini(g, 'FINI X'), y = chantierFini(g, 'FINI Y');
  mesurer(g);
  cocher(g, 'FINI X');
  const trier = (nom, titres) => { const f = g.feuilles[nom], n = titres || 1; f.lignes = f.lignes.slice(0, n).concat(f.lignes.slice(n).reverse()); };   // Franck trie les données, sous les titres
  trier('Purges'); trier('Stockage', 11);
  let n = 0;
  g.etat.avantCorbeille = () => { if (++n === 2) { trier('Purges'); trier('Purges détail'); } };
  g.ctx.traiterPurges();
  assert.deepStrictEqual([x.f1, x.f2, x.p1, x.docA, x.docB, x.json].map(corbeille), [true, true, true, true, true, true]);
  assert.deepStrictEqual([y.f1, y.f2, y.p1, y.docA, y.docB, y.json].map(corbeille), [false, false, false, false, false, false]);
  assert.deepStrictEqual([ligneP(g, 'FINI X')[P.etat], ligneP(g, 'FINI X')[P.nbFaits], ligneP(g, 'FINI X')[P.corbeille]], ['Fait', 6, false]);
  assert.deepStrictEqual([ligneP(g, 'FINI Y')[P.etat], ligneP(g, 'FINI Y')[P.nbFaits], ligneP(g, 'FINI Y')[P.corbeille]], ['Proposé', '', false]);
  assert.strictEqual(detail(g).filter(l => l[D.etat] === 'fait').length, 6, 'journal complet malgré le tri');
  assert.strictEqual(purges(g).length, 4, 'aucune ligne effacée ni ajoutée (deux par chantier : anciens indices, chantier terminé)');
  // la mesure suivante retrouve aussi ses lignes
  mesurer(g);
  assert.strictEqual(purges(g).length, 4);
  assert.strictEqual(tableau(g).filter(l => /^chantier:/.test(l[K.cle])).length, 2);
});
test('fichier sorti du dossier du chantier après la comparaison (hors de la racine de l’environnement) : refusé, laissé en place, noté', () => {
  const g = environnement(), x = chantierFini(g, 'FINI');
  mesurer(g); cocher(g, 'FINI');
  const ailleurs = g.creerElement('dossier', 'AILLEURS, HORS DE L’APPLI', null);
  let deplace = null;
  g.etat.avantCorbeille = el => { if (!deplace) { deplace = [x.f1, x.f2, x.p1].filter(f => f !== el)[0]; deplace.api.moveTo(ailleurs.api); } };
  g.ctx.traiterPurges();
  assert.ok(deplace && !corbeille(deplace), 'le fichier déplacé n’est pas mis à la corbeille');
  assert.ok(/^refusé : hors du dossier du chantier/.test(detail(g).filter(l => l[D.id] === deplace.id)[0][D.etat]));
  const l = ligneP(g, 'FINI');
  assert.deepStrictEqual([l[P.etat], l[P.nbFaits]], ['Fait', 5]);
  assert.ok(/1 élément\(s\) laissé\(s\) en place/.test(l[P.message]), l[P.message]);
  // la garde elle-même : jamais le dossier du chantier, le relevé, le dossier CARNET, la racine
  const ctx = g.ctx.prgContexte_(), garde = g.ctx.prgGarde_(x.d.api, ctx, x.carnet.api);
  assert.strictEqual(garde(x.d.api, { type: 'dossier' }), 'dossier protégé');
  assert.strictEqual(garde(x.carnet.api, { type: 'dossier' }), 'dossier protégé');
  assert.strictEqual(garde(g.racine.api, { type: 'dossier' }), 'dossier protégé');
  assert.ok(/relevé/.test(garde(x.releve.api, { type: 'fichier', taille: x.releve.api.getSize() })));
  assert.strictEqual(garde(x.quitus.api, { type: 'dossier' }), 'hors du dossier du carnet', 'un dossier de fiches n’est jamais mis à la corbeille');
  assert.strictEqual(garde(x.divers.api, { type: 'fichier', taille: 301 }), 'taille changée depuis la comparaison');
});
test('panne de mise à la corbeille sur un fichier : les autres partent, la ligne et le journal le disent, tout reste annulable', () => {
  const g = environnement(), x = chantierFini(g, 'FINI');
  mesurer(g); cocher(g, 'FINI');
  g.etat.avantCorbeille = el => { if (el === x.f2) throw new Error('Service Drive indisponible'); };
  g.ctx.traiterPurges();
  assert.ok(!corbeille(x.f2) && corbeille(x.f1) && corbeille(x.p1));
  assert.strictEqual(detail(g).filter(l => l[D.id] === x.f2.id)[0][D.etat], 'échec : Service Drive indisponible');
  assert.deepStrictEqual([ligneP(g, 'FINI')[P.etat], ligneP(g, 'FINI')[P.nbFaits]], ['Fait', 5]);
  g.etat.avantCorbeille = null;
  cocher(g, 'FINI', undefined, P.annuler); g.ctx.traiterPurges();
  assert.deepStrictEqual([x.f1, x.f2, x.p1, x.docA, x.docB, x.json].map(corbeille), [false, false, false, false, false, false]);
});
test('carnet d’un chantier terminé : un dossier inconnu de carnet.json reste en place, et la liste carnet.json est alors gardée', () => {
  const g = environnement(), x = chantierFini(g, 'FINI');
  const inconnu = sous(g, x.carnet, 'DEPOT EN COURS'); fichier(g, inconnu, 'p1.webp', 100);
  mesurer(g);
  assert.ok(/la liste « carnet\.json » est gardée/.test(ligneP(g, 'FINI')[P.pourquoi]), ligneP(g, 'FINI')[P.pourquoi]);
  cocher(g, 'FINI'); g.ctx.traiterPurges();
  assert.deepStrictEqual([x.docA, x.docB, inconnu, x.json, x.carnet].map(corbeille), [true, true, false, false, false]);
  assert.strictEqual(ligneP(g, 'FINI')[P.nbFaits], 5);
});
test('mail de la purge en panne : la ligne reste « Fait (mail à envoyer) », et le mail part au passage suivant', () => {
  const g = environnement(), x = chantierFini(g, 'FINI');
  mesurer(g); cocher(g, 'FINI');
  g.etat.mailEnPanne = true;
  g.ctx.traiterPurges();
  assert.ok(corbeille(x.f1));
  assert.strictEqual(ligneP(g, 'FINI')[P.etat], 'Fait (mail à envoyer)');
  assert.strictEqual(g.mails.length, 0);
  g.etat.mailEnPanne = false;
  assert.strictEqual(g.ctx.traiterPurges(), '1 ligne(s) traitée(s)');
  assert.strictEqual(mailsDe(g, /Mise à la corbeille — FINI/).length, 1);
  assert.strictEqual(ligneP(g, 'FINI')[P.etat], 'Fait');
  assert.strictEqual(g.etat.corbeilles.length, 6, 'rien de plus à la corbeille');
  assert.strictEqual(g.ctx.traiterPurges(), 'rien');
});
test('case cochée sur une ligne déjà « Fait » : rien de plus ; chantier retiré de l’onglet Chantiers : refusé', () => {
  let g = environnement(), x = chantierFini(g, 'FINI');
  mesurer(g); cocher(g, 'FINI'); g.ctx.traiterPurges();
  cocher(g, 'FINI'); g.ctx.traiterPurges();
  assert.ok(/^Déjà fait/.test(ligneP(g, 'FINI')[P.message]) && ligneP(g, 'FINI')[P.corbeille] === false);
  assert.strictEqual(g.etat.corbeilles.length, 6);
  g = environnement(); x = chantierFini(g, 'FINI');
  mesurer(g); cocher(g, 'FINI');
  g.feuilles['Chantiers'].lignes.pop();
  g.ctx.traiterPurges();
  assert.ok(/n’est plus dans l’onglet Chantiers/.test(ligneP(g, 'FINI')[P.pourquoi]));
  assert.ok(g.etat.corbeilles.length === 0 && !corbeille(x.f1));
});
test('le verrou du script (celui des fiches) n’est jamais pris par la mesure ni par la purge', () => {
  const g = environnement(), x = chantierFini(g, 'FINI');
  carnetIndices(g);
  mesurer(g); cocher(g, 'FINI'); cocher(g, 'INDICES', 'Anciens indices du carnet');
  g.ctx.traiterPurges();
  cocher(g, 'FINI', undefined, P.annuler); g.ctx.traiterPurges(); g.ctx.poursuivreMesureStockage();
  assert.ok(corbeille(x.f1) === false && g.etat.corbeilles.length > 0);
  assert.strictEqual(g.etat.verrousScript, 0);
  ['Stockage.gs', 'Purges.gs'].forEach(f => {
    const code = fs.readFileSync(path.join(RACINE, 'apps-script', f), 'utf8').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    assert.ok(!/LockService/.test(code), f + ' ne touche pas à LockService');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
console.log('\nLot 5 — jamais de suppression définitive ; installation ; livraison');
test('aucun appel de suppression définitive dans A-COLLER-DANS-APPS-SCRIPT/Code.gs, ni dans les sources du lot 5', () => {
  const INTERDITS = /Drive\s*\.\s*Files\s*\.\s*(remove|delete|emptyTrash|trash|update|patch)|emptyTrash|permanentlyDelete|Files\s*\.\s*remove|\.removeFile\s*\(|\.removeFolder\s*\(|\bUrlFetchApp\b|googleapis\.com\/drive/;
  ['A-COLLER-DANS-APPS-SCRIPT/Code.gs', 'apps-script/Stockage.gs', 'apps-script/Purges.gs', 'apps-script-test/OutilsTest.gs'].forEach(f => {
    const code = fs.readFileSync(path.join(RACINE, f), 'utf8');
    const m = code.match(INTERDITS);
    assert.ok(!m, f + ' contient « ' + (m && m[0]) + ' »');
  });
  // dans le lot 5, le seul geste qui retire quelque chose de Drive est setTrashed(true), à un seul endroit
  const purges = fs.readFileSync(path.join(RACINE, 'apps-script/Purges.gs'), 'utf8'), stockage = fs.readFileSync(path.join(RACINE, 'apps-script/Stockage.gs'), 'utf8');
  assert.strictEqual((purges.match(/setTrashed\(true\)/g) || []).length, 1);
  assert.ok(!/setTrashed|moveTo|createFile|createFolder|setContent|setSharing/.test(stockage), 'Stockage.gs ne modifie rien dans Drive');
  assert.ok(!/moveTo|createFile|createFolder|setContent|setSharing|\.delete\w*\(/.test(purges.replace(/deleteProperty/g, '')), 'Purges.gs : ni déplacement, ni création, ni suppression');
  // la porte de service (copie TEST) n'a aucun geste de mise à la corbeille pour le lot 5
  const porte = fs.readFileSync(path.join(RACINE, 'apps-script-test/OutilsTest.gs'), 'utf8');
  assert.ok(!/traiterPurges|prgPurger_|prgExecuter_|prgAnnuler_/.test(porte));
});
test('installerLot5Production : trois onglets, cases, avertissements, déclencheurs ; relançable ; refusée sur la copie TEST', () => {
  const g = environnement();
  const r = g.ctx.installerLot5Production();
  assert.ok(/✅ Lot 5 : installation terminée/.test(r) && /Place du compte/.test(r) && /Service avancé Drive : non activé/.test(r), r);
  ['Stockage', 'Purges', 'Purges détail'].forEach(n => assert.ok(g.feuilles[n], n));
  assert.strictEqual(g.feuilles['Purges'].lignes[0].length, 16);
  assert.deepStrictEqual(g.feuilles['Stockage'].lignes[10].slice(0, 3), ['Chantier', 'Statut', 'Date « Terminé »']);
  assert.ok(g.feuilles['Purges'].protections.length === 3 && g.feuilles['Purges'].protections.every(p => p.avertissement === true), 'avertissement seulement : Franck n’est pas bloqué');
  assert.ok(g.feuilles['Purges'].protections.every(p => !(p.c <= 7 && p.c + p.nc > 7) && !(p.c <= 13 && p.c + p.nc > 13)), 'les deux colonnes de cases ne sont pas sous avertissement');
  assert.deepStrictEqual(Array.from(g.declencheurs).sort(), ['mesurerStockage', 'poursuivreMesureStockage', 'renvoyerMailsEnAttente', 'surModificationSheet', 'traiterComptes', 'traiterPurges']);
  const avant = JSON.stringify([g.feuilles['Stockage'].lignes, g.feuilles['Purges'].lignes, g.declencheurs]);
  const r2 = g.ctx.installerLot5Production();
  assert.ok((r2.match(/déjà fait/g) || []).length === 4, r2);
  assert.strictEqual(JSON.stringify([g.feuilles['Stockage'].lignes, g.feuilles['Purges'].lignes, g.declencheurs]), avant, 'relancer ne change rien');
  assert.ok(/Refusé : cette fonction est prévue pour TEST/.test(g.ctx.installerLot5Test()));
  const v = g.ctx.verifierConfig();
  assert.ok(/✅ Onglet « Stockage »/.test(v) && /✅ Onglet « Purges »/.test(v) && /✅ Déclencheur traiterPurges/.test(v) && /Place du compte/.test(v), v);
});
test('installerLot5Test : onglets créés, AUCUN déclencheur posé ; un onglet « Purges » aux autres titres n’est jamais réécrit', () => {
  let g = environnement({ test: true });
  const r = g.ctx.installerLot5Test();
  assert.ok(/installation terminée/.test(r) && /non concerné sur TEST/.test(r), r);
  assert.strictEqual(g.declencheurs.length, 0);
  assert.ok(/Refusé/.test(g.ctx.installerLot5Production()));
  g = environnement({ feuilles: { 'Purges': [['Mes notes', 'à moi'], ['ne pas', 'toucher']] } });
  const r2 = g.ctx.installerLot5Production();
  assert.ok(/existe déjà avec d’autres titres : le renommer/.test(r2) && /Arrêt à cette étape/.test(r2), r2);
  assert.deepStrictEqual(g.feuilles['Purges'].lignes, [['Mes notes', 'à moi'], ['ne pas', 'toucher']]);
  assert.strictEqual(g.declencheurs.length, 0, 'les étapes suivantes ne sont pas lancées');
});
test('copie TEST : la purge marche dans le Drive de TEST (racine « … TEST … »)', () => {
  const g = environnement({ test: true }), x = chantierFini(g, 'CHANTIER TEST AUTO');
  g.ctx.installerLot5Test(); mesurer(g);
  assert.strictEqual(ligneP(g, 'CHANTIER TEST AUTO')[P.possible], 'oui', ligneP(g, 'CHANTIER TEST AUTO')[P.pourquoi]);
  cocher(g, 'CHANTIER TEST AUTO'); g.ctx.traiterPurges();
  assert.ok(corbeille(x.f1) && ligneP(g, 'CHANTIER TEST AUTO')[P.etat] === 'Fait');
});
test('porte de service (copie TEST) : installerLot5 et des lectures seulement — aucun geste ne met à la corbeille, aucun nom de chantier réel n’est rendu', () => {
  const CLE = 'k'.repeat(48);
  const g = environnement({ test: true, proprietes: { CLE_OUTILS_TEST: CLE }, stockage: { utilise: 3 * GO } });
  vm.runInContext(fs.readFileSync(path.join(RACINE, construire.PORTE), 'utf8'), g.ctx, { filename: 'OutilsTest.gs' });
  const geste = (nom) => JSON.parse(g.ctx.doPost({ postData: { contents: JSON.stringify({ action: 'outilTest', v: 5, geste: nom, cle: CLE }) } }).contenu);
  const x = chantierFini(g, 'CHANTIER TEST AUTO'), reel = chantierFini(g, 'VRAI CHANTIER DUPONT');
  let r = geste('installerLot5');
  assert.ok(r.ok && /installation terminée/.test(r.message), JSON.stringify(r));
  r = geste('placeCompte');
  assert.deepStrictEqual([r.ok, r.data.source, r.data.utilise, r.data.serviceAvancePresent, r.data.driveApp.utilise], [true, 'DriveApp', 3 * GO, false, 3 * GO]);
  r = geste('mesurerStockage');
  assert.ok(r.ok && /^Tour de mesure terminé/.test(r.message) && !/DUPONT/.test(JSON.stringify(r)), JSON.stringify(r));
  r = geste('lireStockage');
  assert.ok(r.ok && r.data.titresBons && r.data.resume.length === 9 && !/DUPONT/.test(JSON.stringify(r)), JSON.stringify(r));
  r = geste('lirePurgesEssai');
  assert.ok(r.ok && r.data.lignes.length === 2 && r.data.lignesEnTout === 4 && !/DUPONT/.test(JSON.stringify(r)) && JSON.stringify(r).indexOf(x.d.id) < 0, JSON.stringify(r));
  r = geste('examinerPurgeEssai');
  assert.ok(r.ok && r.data.terminePurge.possible === true && r.data.terminePurge.fichiers === 6 && r.data.indices.possible === true && r.data.indices.elements === 1, JSON.stringify(r));
  assert.strictEqual(g.etat.corbeilles.length, 0, 'aucun geste n’a rien mis à la corbeille');
  assert.ok(!corbeille(x.f1) && !corbeille(reel.f1));
  ['traiterPurges', 'purger', 'annulerPurge', 'viderCorbeille'].forEach(n => assert.strictEqual(geste(n).code, 'REFUSE', n));
});
test('livraison : le serveur à coller contient le lot 5 en version v10.0, dans le bon ordre, sans les outils d’essai', () => {
  const code = fs.readFileSync(path.join(RACINE, 'A-COLLER-DANS-APPS-SCRIPT', 'Code.gs'), 'utf8');
  ["const VERSION_API = 'v10.0'", 'function mesurerStockage(', 'function poursuivreMesureStockage(', 'function traiterPurges(', 'function installerLot5Test(', 'function installerLot5Production(',
    "const PRG_RELEVE = 'releve-pc.json'", '████ Stockage.gs ████', '████ Purges.gs ████'].forEach(t => assert.ok(code.indexOf(t) > -1, t));
  assert.ok(code.indexOf('████ Carnet.gs ████') < code.indexOf('████ Stockage.gs ████') && code.indexOf('████ Purges.gs ████') < code.indexOf('████ Admin.gs ████'));
  assert.ok(!/mega-index/.test(code), 'l’ancien nom du relevé n’est plus dans le serveur');
  assert.ok(!/function\s+outilTest_\s*\(/.test(code));
  // chargé SEUL, comme dans l'éditeur Apps Script : il mesure
  const g = creerGoogle({ proprietes: { DRIVE_ROOT_ID: 'RACINE', DRIVE_PLANNING_ID: 'PLANNING' }, feuilles: { 'Chantiers': [TITRES_CHANTIERS] } });
  g.creerElement('dossier', 'Loué Menuiserie - Chantiers', null, { id: 'RACINE' }); g.creerElement('dossier', 'Planning', null, { id: 'PLANNING' });
  const ctx = chargerScript(g, path.join(RACINE, 'A-COLLER-DANS-APPS-SCRIPT', 'Code.gs'));
  assert.ok(/^Tour de mesure terminé/.test(ctx.mesurerStockage()));
});
test('textes : ni caractère de contrôle, ni U+2028/U+2029 bruts dans les fichiers du lot 5', () => {
  ['apps-script/Stockage.gs', 'apps-script/Purges.gs', 'tests/lot5-stockage.test.js', 'docs/lot5-procedure.md', 'docs/lot5-plan.md'].forEach(f => {
    if (!fs.existsSync(path.join(RACINE, f))) return;
    const m = fs.readFileSync(path.join(RACINE, f), 'utf8').match(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u2028\u2029]/);
    assert.ok(!m, f + ' : caractère U+' + (m ? m[0].charCodeAt(0).toString(16) : ''));
  });
});

console.log('\n' + reussis + ' test(s) réussi(s)' + (process.exitCode ? ' — DES TESTS ÉCHOUENT' : ''));
