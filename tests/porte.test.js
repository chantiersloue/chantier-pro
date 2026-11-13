// Tests de l'étape C de l'outillage : node tests/porte.test.js
//   - la porte de service (apps-script-test/OutilsTest.gs) dans le faux Apps Script ;
//   - les garde-fous de construction (la porte n'est jamais dans le serveur de production) ;
//   - la commande d'envoi sur TEST (outils/envoyer-test.js) avec un FAUX clasp : aucun appel à Google.
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');
const { creerGoogle, chargerScript } = require('./gas-harness');
const construire = require('../outils/construire.js');
const envoi = require('../outils/envoyer-test.js');
const porte = require('../outils/porte.js');

const RACINE = path.join(__dirname, '..');
const CLE = 'k'.repeat(48);
let reussis = 0;
const attente = [];
function test(nom, fn) {
  attente.push(async () => {
    try { await fn(); reussis++; console.log('  ✓ ' + nom); }
    catch (e) { process.exitCode = 1; console.log('  ✗ ' + nom + '\n    ' + (e.stack || e).split('\n').slice(0, 4).join('\n    ')); }
  });
}

// ── Faux Apps Script, avec ou sans la porte ──────────────────────────────────────────────────────────────
function serveur(options, avecPorte) {
  const g = creerGoogle(Object.assign({ feuilles: { 'Chantiers': [['Nom', 'Référence', 'Statut', 'Conducteur']] } }, options));
  g.ctx = chargerScript(g);
  if (avecPorte) vm.runInContext(fs.readFileSync(path.join(RACINE, construire.PORTE), 'utf8'), g.ctx, { filename: 'OutilsTest.gs' });
  return g;
}
const poster = (g, corps) => JSON.parse(g.ctx.doPost({ postData: { contents: JSON.stringify(corps) } }).contenu);
const TEST = cle => ({ nomSheet: 'ChantierPro TEST', proprietes: Object.assign({ ENVIRONNEMENT: 'TEST', DRIVE_ROOT_ID: 'R', DRIVE_PLANNING_ID: 'P' }, cle === undefined ? { CLE_OUTILS_TEST: CLE } : (cle ? { CLE_OUTILS_TEST: cle } : {})) });
const PROD = { nomSheet: 'ChantierPro', proprietes: { CLE_OUTILS_TEST: CLE, DRIVE_ROOT_ID: 'R', DRIVE_PLANNING_ID: 'P' } };
const appel = (geste, cle) => ({ action: 'outilTest', v: 5, geste: geste, cle: cle === undefined ? CLE : cle });

test('porte : sur TEST, avec la bonne clé, « etat » répond', () => {
  const r = poster(serveur(TEST(), true), appel('etat'));
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.data.environnement, 'TEST');
  assert.strictEqual(r.data.sheet, 'ChantierPro TEST');
  assert.ok(/^v\d/.test(r.data.version) && Array.isArray(r.data.declencheurs));
  assert.ok(JSON.stringify(r).indexOf(CLE) < 0, 'la réponse ne contient jamais la clé');
});
test('porte : clé fausse, absente, vide, trop courte, ou d’un autre type = « Refusé », sans détail', () => {
  const refus = r => assert.deepStrictEqual(r, { ok: false, code: 'REFUSE', message: 'Refusé' });
  const g = serveur(TEST(), true);
  [CLE + 'x', CLE.slice(1), '', null, 12345, true, { a: 1 }, [CLE]].forEach(c => refus(poster(g, appel('etat', c))));
  refus(poster(g, { action: 'outilTest', v: 5, geste: 'etat' }));
  // propriété absente : même une clé vide ou « undefined » ne passe pas
  const sans = serveur(TEST(''), true);
  ['', 'undefined', 'null', CLE].forEach(c => refus(poster(sans, appel('etat', c))));
  refus(poster(sans, { action: 'outilTest', v: 5, geste: 'etat' }));
  // propriété trop courte (31 caractères) : refus même avec la « bonne » valeur
  const courte = 'c'.repeat(31);
  refus(poster(serveur(TEST(courte), true), appel('etat', courte)));
});
test('porte : hors de TEST (production, ou environnement incohérent) = « Refusé », même avec la bonne clé', () => {
  const refus = r => assert.deepStrictEqual(r, { ok: false, code: 'REFUSE', message: 'Refusé' });
  refus(poster(serveur(PROD, true), appel('etat')));
  refus(poster(serveur({ nomSheet: 'ChantierPro', proprietes: { ENVIRONNEMENT: 'TEST', CLE_OUTILS_TEST: CLE } }, true), appel('etat')));
  refus(poster(serveur({ nomSheet: 'ChantierPro TEST', proprietes: { CLE_OUTILS_TEST: CLE } }, true), appel('etat')));
  const g = serveur(PROD, true);
  refus(poster(g, appel('essaiDeclencheur')));
  assert.strictEqual(g.declencheurs.length, 0);
});
test('porte : une erreur interne AVANT le contrôle de la clé ne donne aucun détail à un inconnu', () => {
  const g = serveur(TEST(), true);
  g.ctx.environnementReel_ = () => { throw new Error('DÉTAIL INTERNE À NE PAS MONTRER'); };
  [appel('etat'), appel('etat', 'mauvaise'), { action: 'outilTest', v: 5 }].forEach(c =>
    assert.deepStrictEqual(poster(g, c), { ok: false, code: 'REFUSE', message: 'Refusé' }));
  // après le contrôle de la clé, l'erreur est dite (à celui qui a la clé)
  const g2 = serveur(TEST(), true);
  g2.ctx.MailApp.getRemainingDailyQuota = () => { throw new Error('quota illisible'); };
  const r = poster(g2, appel('etat'));
  assert.ok(r.code === 'ERREUR_OUTIL' && /quota illisible/.test(r.message) && JSON.stringify(r).indexOf(CLE) < 0);
});
test('porte : seuls les gestes de la liste existent (aucune fonction du serveur n’est appelable par son nom)', () => {
  const g = serveur(TEST(), true);
  ['verifierConfig', 'changerCle', 'genererCle', 'installerDeclencheurs', 'demarrerTransition', 'executerMigration', 'anonymiserCopieTest', 'retirerPartages', 'preparerOngletsLot2',
    'outilTestSession_', 'constructor', '__proto__', 'toString', 'hasOwnProperty', '', null, undefined, 42, ['etat']]
    .forEach(geste => assert.deepStrictEqual(poster(g, appel(geste)), { ok: false, code: 'REFUSE', message: 'Refusé' }, String(geste)));
  assert.strictEqual(g.declencheurs.length, 0);
});
test('porte : l’essai de faisabilité pose puis retire un déclencheur, sans toucher aux autres', () => {
  const g = serveur(TEST(), true);
  g.declencheurs.push('traiterComptes');   // un déclencheur déjà en place doit y rester
  const r = poster(g, appel('essaiDeclencheur'));
  assert.strictEqual(r.ok, true, JSON.stringify(r));
  assert.deepStrictEqual([r.data.pose, r.data.retire], [true, true]);
  assert.strictEqual(r.message, 'déclencheur posé ; déclencheur retiré');
  assert.deepStrictEqual(Array.from(g.declencheurs), ['traiterComptes'], 'les autres déclencheurs ne sont pas touchés');
});
// ── Porte complète : un serveur TEST avec le lot 2 en place ──
function serveurLot2(extra) {
  const g = creerGoogle({ nomSheet: 'ChantierPro TEST',
    proprietes: Object.assign({ ENVIRONNEMENT: 'TEST', CLE_OUTILS_TEST: CLE, DRIVE_ROOT_ID: 'R', DRIVE_PLANNING_ID: 'P', HACHAGE_ITERATIONS: '200' }, extra || {}),
    feuilles: { 'Contacts': [['Nom', 'Role', 'Email']], 'Contacts notes': [['Nom', 'Email']],
      'Chantiers': [['Nom', 'Référence', 'Statut', 'Conducteur'], ['CHANTIER TEST 1', 'LIEU', 'En cours', 'Franck']],
      'Envois': [['Numéro', 'Reçu le', 'Type', 'Chantier', 'Statut', 'Détail', 'Compte']].concat(Array.from({ length: 30 }, (_, i) => ['id' + i, 'date', 'quitus', 'CHANTIER TEST 1', 'traité', '', 'x'])) } });
  g.ctx = chargerScript(g);
  vm.runInContext(fs.readFileSync(path.join(RACINE, construire.PORTE), 'utf8'), g.ctx, { filename: 'OutilsTest.gs' });
  g.ctx.genererCle(); g.ctx.preparerOngletsLot2();
  g.feuilles['Utilisateurs'].lignes[1] = ['poseur01', 'Vrai Poseur de TEST', 'Poseur', true, false, '', '', false, false, ''];
  return g;
}
const geste = (g, nom, donnees) => poster(g, Object.assign({ action: 'outilTest', v: 5, geste: nom, cle: CLE }, donnees || {}));
const U = g => g.feuilles['Utilisateurs'].lignes;

test('porte : preparerComptes crée les trois comptes d’essai une seule fois, sans toucher aux lignes existantes', () => {
  const g = serveurLot2(), avant = JSON.stringify(U(g)[1]);
  const r = geste(g, 'preparerComptes');
  assert.ok(r.ok, JSON.stringify(r));
  assert.deepStrictEqual(Array.from(r.data.crees), ['auto-poseur', 'auto-conducteur', 'auto-admin', 'auto-atelier']);
  assert.strictEqual(JSON.stringify(U(g)[1]), avant, 'la ligne du vrai compte de TEST n’est pas modifiée');
  const lignes = U(g).filter(l => /^auto-/.test(String(l[0])));
  assert.deepStrictEqual(lignes.map(l => [l[0], l[2], l[3]]), [['auto-poseur', 'Poseur', false], ['auto-conducteur', 'Conducteur', false], ['auto-admin', 'Admin', false], ['auto-atelier', 'Atelier', false]], 'créés désactivés');
  assert.deepStrictEqual([3, 4, 5, 6].map(n => U(g)[n - 1][0]), ['auto-poseur', 'auto-conducteur', 'auto-admin', 'auto-atelier'], 'juste sous les comptes existants, là où il y a des cases à cocher');
  const r2 = geste(g, 'preparerComptes');
  assert.deepStrictEqual([Array.from(r2.data.crees), Array.from(r2.data.dejaPresents).length], [[], 4]);
  assert.strictEqual(U(g).filter(l => /^auto-/.test(String(l[0]))).length, 4, 'pas de doublon');
});
test('porte : session d’essai — le jeton marche sur ce serveur, puis fermerSessions l’annule', () => {
  const g = serveurLot2(); geste(g, 'preparerComptes');
  const s1 = geste(g, 'session', { id: 'auto-admin' });
  assert.ok(s1.ok && s1.data.profil.role === 'Admin' && /^auto-admin\.t\.\d+\.\d+\./.test(s1.data.jeton), JSON.stringify(s1));
  const moi = poster(g, { action: 'moi', v: 5, jeton: s1.data.jeton });
  assert.ok(moi.ok && moi.data.profil.id === 'auto-admin', JSON.stringify(moi));
  g.ctx.finirTransitionMaintenant();   // transition finie : un jeton annulé est vraiment refusé
  assert.ok(poster(g, { action: 'moi', v: 5, jeton: s1.data.jeton }).ok);
  assert.strictEqual(geste(g, 'lireCompte', { id: 'auto-admin' }).data.actif, true, 'le compte est activé le temps de la session');
  const f1 = geste(g, 'fermerSessions');
  assert.deepStrictEqual(Array.from(f1.data.comptes), ['auto-poseur', 'auto-conducteur', 'auto-admin', 'auto-atelier']);
  assert.strictEqual(poster(g, { action: 'moi', v: 5, jeton: s1.data.jeton }).code, 'JETON_INVALIDE');
  assert.strictEqual(geste(g, 'lireCompte', { id: 'auto-admin' }).data.actif, false, 'puis désactivé');
  // sans compte créé, fermerSessions n'écrit rien
  const vide = serveurLot2(), propsAvant = JSON.stringify(vide.proprietes);
  assert.deepStrictEqual(Array.from(geste(vide, 'fermerSessions').data.comptes), []);
  assert.strictEqual(JSON.stringify(vide.proprietes), propsAvant);
  assert.ok(JSON.stringify(geste(g, 'lireCompte', { id: 'auto-admin' })).indexOf(s1.data.jeton) < 0);
});
test('porte : un jeton de session d’essai fabriqué sur TEST est refusé par un serveur de production (même clé de signature volée ou non)', () => {
  const g = serveurLot2(); geste(g, 'preparerComptes');
  const jeton = geste(g, 'session', { id: 'auto-admin' }).data.jeton;
  // production : autre environnement ; on lui donne même la clé de signature de TEST et un compte du même nom
  const p = creerGoogle({ nomSheet: 'ChantierPro', proprietes: { CLE_JETON: g.proprietes.CLE_JETON, DRIVE_ROOT_ID: 'R', DRIVE_PLANNING_ID: 'P' },
    feuilles: { 'Contacts': [['Nom']], 'Contacts notes': [['Nom']], 'Chantiers': [['Nom', 'Référence', 'Statut', 'Conducteur']] } });
  p.ctx = chargerScript(p); p.ctx.preparerOngletsLot2();
  p.feuilles['Utilisateurs'].lignes[1] = ['auto-admin', 'X', 'Admin', true, false, '', '', false, false, ''];
  p.ctx.finirTransitionMaintenant = null; p.proprietes.FIN_TRANSITION = String(Date.now() - 1000);
  assert.strictEqual(poster(p, { action: 'moi', v: 5, jeton: jeton }).code, 'JETON_INVALIDE');
});
test('porte : session, cocher et lireCompte ne servent QUE les trois comptes d’essai', () => {
  const g = serveurLot2(); geste(g, 'preparerComptes');
  const avant = JSON.stringify(U(g)[1]);
  ['poseur01', 'franck', 'AUTO-ADMIN', 'auto-admin ', 'auto-autre', '', null, undefined, 12, ['auto-admin'], { id: 'auto-admin' }, '__proto__', 'constructor'].forEach(id => {
    ['session', 'lireCompte'].forEach(nom => {
      const r = geste(g, nom, { id: id });
      assert.ok(!r.ok && r.code === 'ERREUR_OUTIL' && /compte refusé/.test(r.message) && !r.data, nom + ' ' + JSON.stringify(id));
    });
    assert.ok(!geste(g, 'cocher', { id: id, case: 'actif', valeur: false }).ok);
  });
  assert.strictEqual(JSON.stringify(U(g)[1]), avant, 'le vrai compte de TEST n’a pas été touché');
});
test('porte : cocher n’accepte que trois cases et vrai/faux ; « Réinitialiser » puis traiterComptes donne un provisoire, jamais renvoyé', () => {
  const g = serveurLot2(); geste(g, 'preparerComptes');
  ['provisoire', 'id', 'role', 'etat', 'tous', '__proto__', 5, null].forEach(c => assert.ok(!geste(g, 'cocher', { id: 'auto-poseur', case: c, valeur: true }).ok, String(c)));
  ['oui', 1, null, undefined, 'true'].forEach(v => assert.ok(!geste(g, 'cocher', { id: 'auto-poseur', case: 'reinit', valeur: v }).ok, String(v)));
  assert.ok(geste(g, 'cocher', { id: 'auto-poseur', case: 'reinit', valeur: true }).ok);
  assert.strictEqual(geste(g, 'lireCompte', { id: 'auto-poseur' }).data.reinit, true);
  geste(g, 'cocher', { id: 'auto-poseur', case: 'actif', valeur: true });
  const t = geste(g, 'traiterComptes');
  assert.ok(t.ok, JSON.stringify(t));
  const c = geste(g, 'lireCompte', { id: 'auto-poseur' });
  assert.ok(c.ok && c.data.aProvisoire === true && c.data.reinit === false && c.data.utilisable === true, JSON.stringify(c));
  const provisoire = String(U(g).find(l => l[0] === 'auto-poseur')[5]);
  assert.ok(provisoire.length === 8 && JSON.stringify(c).indexOf(provisoire) < 0, 'le mot de passe provisoire n’est jamais dans la réponse');
  assert.ok(geste(g, 'cocher', { id: 'auto-poseur', case: 'actif', valeur: false }).ok);
  assert.ok(geste(g, 'session', { id: 'auto-poseur' }).ok && geste(g, 'lireCompte', { id: 'auto-poseur' }).data.actif === true, 'ouvrir une session réactive le compte d’essai');
});
test('porte : lectures bornées (20 lignes au plus), déclencheurs, transition, contrôle du lot 2', () => {
  const g = serveurLot2();
  assert.strictEqual(geste(g, 'lireEnvois').data.lignes.length, 6, '5 lignes par défaut + les titres');
  assert.strictEqual(geste(g, 'lireEnvois', { n: 1000 }).data.lignes.length, 21);
  assert.strictEqual(geste(g, 'lireEnvois', { n: 'x' }).data.lignes.length, 6);
  const l = geste(g, 'lireEnvois', { n: 2 }).data.lignes;
  assert.deepStrictEqual([l[0][0], l[1][0], l[2][0]], ['Numéro', 'id28', 'id29']);
  const ch = geste(g, 'lireChantiers');
  assert.deepStrictEqual([ch.data.nombre, ch.data.chantierEssaiPresent], [1, false]);
  assert.ok(JSON.stringify(ch).indexOf('CHANTIER TEST 1') < 0 && JSON.stringify(ch).indexOf('Franck') < 0, 'ni nom de chantier, ni nom de personne dans la réponse');
  assert.deepStrictEqual(Array.from(geste(g, 'lireEnvois', { n: 1 }).data.lignes[1]), ['id29', 'date', 'quitus', 'traité'], 'seulement numéro, date, type, statut');
  const pc = geste(g, 'preparerChantier');
  assert.ok(pc.ok && pc.data.cree === true && geste(g, 'preparerChantier').data.cree === false);
  assert.deepStrictEqual(g.feuilles['Chantiers'].lignes[2].slice(0, 3), ['CHANTIER TEST AUTO', 'ESSAIS AUTOMATIQUES (outillage)', 'En cours']);
  assert.strictEqual(g.feuilles['Chantiers'].lignes[1][0], 'CHANTIER TEST 1', 'la ligne existante n’est pas touchée');
  assert.strictEqual(geste(g, 'lireChantiers').data.chantierEssaiPresent, true);
  assert.ok(geste(g, 'poserDeclencheurs').ok);
  assert.deepStrictEqual(Array.from(geste(g, 'etat').data.declencheurs), ['outilTestFinEssaiAuto', 'renvoyerMailsEnAttente', 'surModificationSheet', 'traiterComptes'], 'avec la fin d’essai automatique dans 2 h');
  geste(g, 'poserDeclencheurs');
  assert.strictEqual(geste(g, 'etat').data.declencheurs.length, 4, 'reposer ne les double pas');
  geste(g, 'preparerComptes'); const jeton = geste(g, 'session', { id: 'auto-admin' }).data.jeton;
  assert.strictEqual(geste(g, 'etat').data.declencheurs.filter(d => d === 'outilTestFinEssaiAuto').length, 1, 'une seule fin d’essai programmée');
  g.ctx.outilTestFinEssaiAuto();   // ce que fait le déclencheur de fin d'essai
  assert.strictEqual(geste(g, 'etat').data.declencheurs.length, 0, 'la fin d’essai automatique retire tout, elle comprise');
  assert.strictEqual(geste(g, 'lireCompte', { id: 'auto-admin' }).data.actif, false, 'et ferme les sessions d’essai');
  g.ctx.finirTransitionMaintenant();
  assert.strictEqual(poster(g, { action: 'moi', v: 5, jeton: jeton }).code, 'JETON_INVALIDE');
  delete g.proprietes.FIN_TRANSITION;
  assert.ok(/^function outilTestFinEssaiAuto\(\)/m.test(fs.readFileSync(path.join(RACINE, construire.PORTE), 'utf8')), 'nom sans « _ » final : appelable par un déclencheur');
  geste(g, 'poserDeclencheurs');
  assert.ok(geste(g, 'retirerDeclencheurs').ok);
  assert.strictEqual(geste(g, 'etat').data.declencheurs.length, 0);
  // transition : pas commencée au départ ; les essais la modifient ; retablirTransition la remet comme avant
  let e = geste(g, 'etat').data;
  assert.deepStrictEqual([e.transitionOuverte, e.transitionJusquau, e.transitionARetablir], [true, null, false]);
  const pas = geste(g, 'prolongerTransition');
  assert.ok(!pas.ok && /rien n’a été prolongé/.test(pas.message), 'prolonger une transition pas commencée n’est pas annoncé comme réussi');
  assert.strictEqual(geste(g, 'etat').data.transitionARetablir, false, 'un geste raté ne laisse rien à rétablir');
  assert.ok(geste(g, 'finirTransition').ok);
  e = geste(g, 'etat').data;
  assert.deepStrictEqual([e.transitionOuverte, e.transitionARetablir], [false, true]);
  assert.ok(geste(g, 'prolongerTransition').ok);
  assert.strictEqual(geste(g, 'etat').data.transitionOuverte, true);
  const ret = geste(g, 'retablirTransition');
  assert.ok(ret.ok && /pas commencée/.test(ret.message), ret.message);
  e = geste(g, 'etat').data;
  assert.deepStrictEqual([e.transitionOuverte, e.transitionJusquau, e.transitionARetablir], [true, null, false]);
  assert.ok(!g.proprietes.FIN_TRANSITION && !g.proprietes.OUTIL_TEST_FIN_AVANT && !g.proprietes.OUTIL_TEST_FIN_POSEE);
  assert.ok(/Rien à rétablir/.test(geste(g, 'retablirTransition').message));
  // une transition déjà commencée (cas de la vraie copie TEST) retrouve exactement sa date
  g.proprietes.FIN_TRANSITION = '1794933622155';
  g.proprietes.ALERTE_TRANSITION_FAITE = '1';   // l'alerte « fin dans 3 jours » était déjà partie
  geste(g, 'finirTransition'); geste(g, 'prolongerTransition');
  assert.ok(!g.proprietes.ALERTE_TRANSITION_FAITE, 'prolonger efface le drapeau d’alerte…');
  assert.ok(!/ATTENTION/.test(geste(g, 'retablirTransition').message));
  assert.deepStrictEqual([g.proprietes.FIN_TRANSITION, g.proprietes.ALERTE_TRANSITION_FAITE], ['1794933622155', '1'], '… et rétablir le remet : aucun mail d’alerte en double');
  // Franck a modifié la transition à la main entre un essai et le rétablissement : c'est dit
  geste(g, 'finirTransition'); g.proprietes.FIN_TRANSITION = '1899999999999';
  assert.ok(/ATTENTION : elle avait été modifiée à la main/.test(geste(g, 'retablirTransition').message));
  assert.strictEqual(g.proprietes.FIN_TRANSITION, '1794933622155');
  delete g.proprietes.FIN_TRANSITION; delete g.proprietes.ALERTE_TRANSITION_FAITE;
  const c = geste(g, 'controlerLot2');
  assert.ok(c.ok && /Lot 2 — contrôle seul — environnement : TEST/.test(c.message) && /HACHAGE_ITERATIONS.* : déjà fait/.test(c.message), c.message);
  assert.ok(geste(g, 'lireBilan').data.lignes.length >= 2);
});
test('porte : un geste qui n’a pas eu son effet répond ok:false (traiterComptes occupé ou en erreur)', () => {
  const occupe = creerGoogle({ nomSheet: 'ChantierPro TEST', verrouOccupe: true, proprietes: { ENVIRONNEMENT: 'TEST', CLE_OUTILS_TEST: CLE },
    feuilles: { 'Chantiers': [['Nom']] } });
  occupe.ctx = chargerScript(occupe);
  vm.runInContext(fs.readFileSync(path.join(RACINE, construire.PORTE), 'utf8'), occupe.ctx, { filename: 'OutilsTest.gs' });
  const r = geste(occupe, 'traiterComptes');
  assert.ok(!r.ok && r.code === 'ERREUR_OUTIL' && /n’a pas tourné : occupé/.test(r.message), JSON.stringify(r));
  assert.ok(!geste(occupe, 'preparerComptes').ok, 'les écritures attendent le verrou, et renoncent');
  const g = serveurLot2();
  g.ctx.synchroniserAcces_ = () => { throw new Error('boum'); };
  const r2 = geste(g, 'traiterComptes');
  assert.ok(!r2.ok && /n’a pas tourné : erreur : boum/.test(r2.message), JSON.stringify(r2));
});
test('porte : une ligne tapée à la main qui ressemble à un compte d’essai n’est jamais adoptée', () => {
  [[' AUTO-Admin ', 'Poseur'], ['auto-admin', 'Poseur'], ['Auto-Admin', 'Admin']].forEach(([brut, role]) => {
    const g = serveurLot2();
    U(g)[2] = [brut, 'Quelqu’un', role, false, false, '', '', false, false, ''];
    const avant = JSON.stringify(U(g)[2]);
    ['preparerComptes', 'session', 'lireCompte', 'fermerSessions'].forEach(nom => {
      const r = geste(g, nom, { id: 'auto-admin' });
      assert.ok(!r.ok && /n’est pas un compte d’essai conforme/.test(r.message), nom + ' ' + brut + ' : ' + JSON.stringify(r));
    });
    assert.ok(!geste(g, 'cocher', { id: 'auto-admin', case: 'actif', valeur: true }).ok);
    assert.strictEqual(JSON.stringify(U(g)[2]), avant, 'la ligne n’a pas été modifiée');
  });
  // en double : refusé aussi
  const g = serveurLot2(); geste(g, 'preparerComptes');
  geste(g, 'session', { id: 'auto-poseur' }); geste(g, 'session', { id: 'auto-conducteur' });
  U(g)[10] = ['auto-admin', 'AUTO Admin', 'Admin', true, false, '', '', false, false, ''];
  assert.ok(!geste(g, 'session', { id: 'auto-admin' }).ok);
  // un compte non conforme n'empêche pas de fermer les sessions des autres ; l'échec est dit
  const fs1 = geste(g, 'fermerSessions');
  assert.ok(!fs1.ok && /sessions fermées pour auto-poseur, auto-conducteur, auto-atelier ; échec pour auto-admin/.test(fs1.message), JSON.stringify(fs1));
  assert.deepStrictEqual(['auto-poseur', 'auto-conducteur'].map(id => geste(g, 'lireCompte', { id: id }).data.actif), [false, false]);
  // mémoire de transition dans un ancien format : rétablie sans erreur
  const h = serveurLot2();
  h.proprietes.OUTIL_TEST_FIN_AVANT = 'absente'; h.proprietes.FIN_TRANSITION = '1899999999999';
  assert.ok(geste(h, 'retablirTransition').ok && !h.proprietes.FIN_TRANSITION && !h.proprietes.OUTIL_TEST_FIN_AVANT);
  h.proprietes.OUTIL_TEST_FIN_AVANT = '1794933622155'; h.proprietes.FIN_TRANSITION = '1';
  assert.ok(geste(h, 'retablirTransition').ok && h.proprietes.FIN_TRANSITION === '1794933622155');
});
test('porte, lot 7 : installation, lecture des signalements sans texte saisi, destinataires d’un essai sans aucune adresse', () => {
  const g = serveurLot2();
  g.feuilles['Contacts'].lignes.push(['Vrai Chef', 'Chef atelier', 'vrai.chef@loue.test', 'N', 'N', 'N', 'O', 'N']);
  g.feuilles['Chantiers'].lignes.push(['VRAI CHANTIER SANS CONDUCTEUR', 'LIEU', 'En cours', '']);
  const i = geste(g, 'installerLot7');
  assert.ok(!/VRAI CHANTIER|ℹ/.test(JSON.stringify(i)), 'aucun nom de chantier dans la réponse de la porte');
  assert.ok(i.ok && /Lot 7 — installation — environnement : TEST/.test(i.message) && /installation terminée/.test(i.message), i.message);
  assert.ok(g.feuilles['Signalements'], 'onglet créé');
  assert.ok(geste(g, 'installerLot7').ok, 'relançable');
  // un signalement envoyé par un compte d'essai, puis lu par la porte
  geste(g, 'preparerComptes'); geste(g, 'preparerChantier');
  const jeton = geste(g, 'session', { id: 'auto-poseur' }).data.jeton;
  const r = poster(g, { action: 'fiche', id: 'fiche-auto-porte-0001', jeton: jeton, donnees: { type: 'signalement', chantier: 'CHANTIER TEST AUTO', date: '12/11/2026', heure: '10h00',
    type_signalement: 'Casse', urgence: 'Pas urgent', repere: 'REPÈRE SECRET', commentaire: 'COMMENTAIRE SECRET', atelier: false, photosBase64: [] } });
  assert.ok(r.ok, JSON.stringify(r));
  const l = geste(g, 'lireSignalements', { n: 1 });
  assert.deepStrictEqual(Array.from(l.data.lignes[0]), ['Numéro', 'Reçu le', 'Auteur (identifiant)', 'Type', 'Urgence', 'Photos', 'Atelier prévenu', 'Statut', 'Mail à la réception']);
  const ligne = Array.from(l.data.lignes[1]);
  assert.deepStrictEqual([ligne[0], ligne[2], ligne[3], ligne[4], ligne[6], ligne[7], ligne[8]], ['fiche-auto-porte-0001', 'auto-poseur', 'Casse', 'Pas urgent', 'Non', 'À traiter', 'envoyé']);
  assert.ok(!/SECRET|CHANTIER TEST AUTO|AUTO Poseur/.test(JSON.stringify(l)), 'ni texte saisi, ni chantier, ni nom dans la réponse');
  // l'identifiant d'un vrai compte de la copie TEST est masqué
  g.feuilles['Signalements'].lignes.push(['fiche-vrai-compte-0001', new Date(), 'X', 'poseur01', 'Vrai Poseur', 'Casse', 'Pas urgent', '', '', 0, 'Non', '', 'À traiter', '', '', 'envoyé', '']);
  const l2 = geste(g, 'lireSignalements', { n: 1 });
  assert.ok(Array.from(l2.data.lignes[1])[2] === '(compte réel)' && !/poseur01/.test(JSON.stringify(l2)), JSON.stringify(l2));
  // destinataires : la copie TEST a un « vrai » chef d'atelier → l'essai avec atelier ne doit pas être joué
  const d = geste(g, 'destinatairesEssai');
  assert.deepStrictEqual([d.data.chefsAtelier, d.data.chefsAtelierSontFranck, d.data.conducteurChantierEssai, d.data.chantierEssaiPresent], [1, false, 'aucun (le mail part à Franck)', true]);
  assert.ok(!/@/.test(JSON.stringify(d)), 'aucune adresse dans la réponse');
  g.feuilles['Contacts'].lignes.pop();
  g.feuilles['Contacts'].lignes.push(['Franck', 'Chef atelier (essai)', 'FRANCK@loue.test', 'N', 'N', 'N', 'O', 'N']);
  assert.strictEqual(geste(g, 'destinatairesEssai').data.chefsAtelierSontFranck, true, 'le chef d’atelier de TEST porte l’adresse de Franck : essai possible');
  g.feuilles['Contacts'].lignes.pop();
  assert.deepStrictEqual([geste(g, 'destinatairesEssai').data.chefsAtelier, geste(g, 'destinatairesEssai').data.chefsAtelierSontFranck], [0, false]);
});
test('porte, lot 3 : installation ; accès au chantier d’essai pour un compte d’essai seulement, sans toucher aux autres cases', () => {
  const g = serveurLot2();
  g.feuilles['Chantiers'].lignes.push(['VRAI CHANTIER', 'LIEU', 'En cours', '']);
  const i = geste(g, 'installerLot3');
  assert.ok(i.ok && /Lot 3 — installation — environnement : TEST/.test(i.message) && /installation terminée/.test(i.message), i.message);
  ['Notes', 'Notes historique', 'Notes vues'].forEach(n => assert.ok(g.feuilles[n], n));
  assert.ok(geste(g, 'installerLot3').ok, 'relançable');
  geste(g, 'preparerComptes'); geste(g, 'preparerChantier');
  assert.strictEqual(geste(g, 'accesChantier', { id: 'auto-poseur', valeur: true }).ok, false, 'colonne pas encore créée : refus clair');
  assert.ok(geste(g, 'session', { id: 'auto-poseur' }).ok);   // le compte d'essai est activé : traiterComptes lui donne sa colonne
  assert.ok(geste(g, 'traiterComptes').ok);
  const a = g.feuilles['Accès chantiers'], avant = JSON.stringify(a.lignes);
  const r = geste(g, 'accesChantier', { id: 'auto-poseur', valeur: true });
  assert.ok(r.ok && r.data.acces === true && r.data.chantier === 'CHANTIER TEST AUTO', JSON.stringify(r));
  const col = a.lignes[0].indexOf('auto-poseur'), lig = a.lignes.findIndex(l => l[0] === 'CHANTIER TEST AUTO');
  assert.strictEqual(a.lignes[lig][col], true);
  const sauf = JSON.parse(JSON.stringify(a.lignes)); sauf[lig][col] = JSON.parse(avant)[lig][col];
  assert.strictEqual(JSON.stringify(sauf), avant, 'aucune autre case modifiée');
  assert.strictEqual(geste(g, 'accesChantier', { id: 'poseur-reel', valeur: true }).ok, false, 'un vrai compte est refusé');
  assert.strictEqual(geste(g, 'accesChantier', { id: 'auto-poseur', valeur: 'oui' }).ok, false);
  assert.ok(geste(g, 'accesChantier', { id: 'auto-poseur', valeur: false }).ok);
  assert.strictEqual(a.lignes[lig][col], false);
});
test('porte, lot 3 : onglets de la première version renommés sans rien effacer ; éléments des essais automatiques retirés, et eux seuls', () => {
  const g = serveurLot2();
  // onglets laissés par la première version du lot 3 (autres titres), avec des lignes
  g.ctx.SpreadsheetApp.getActiveSpreadsheet().insertSheet('Notes').appendRow(['Numéro', 'Chantier', 'Auteur (identifiant)', 'Auteur']);
  g.feuilles['Notes'].lignes.push(['fiche-ancienne-0001', 'CHANTIER TEST AUTO', 'franck01', 'Franck']);
  g.ctx.SpreadsheetApp.getActiveSpreadsheet().insertSheet('Notes historique').appendRow(['Numéro', 'Enregistrée le']);
  const refus = geste(g, 'installerLot3');
  assert.ok(!refus.ok && /existe déjà avec d’autres titres/.test(refus.message), 'l’installation refuse d’écrire par-dessus : ' + refus.message);
  const r = geste(g, 'rangerAnciennesNotes');
  assert.ok(r.ok && JSON.stringify(r.data.renommes) === JSON.stringify(['Notes', 'Notes historique']), JSON.stringify(r));
  const anciens = Object.keys(g.feuilles).filter(n => /^Notes.* \(ancienne version /.test(n));
  assert.strictEqual(anciens.length, 2);
  assert.ok(anciens.some(n => g.feuilles[n].lignes.length === 2 && g.feuilles[n].lignes[1][0] === 'fiche-ancienne-0001'), 'les lignes sont gardées');
  assert.ok(geste(g, 'installerLot3').ok, 'l’installation passe ensuite');
  assert.deepStrictEqual(geste(g, 'rangerAnciennesNotes').data.renommes, [], 'relancé : rien à renommer');
  // éléments d'essai et vrais éléments mêlés
  const n = g.feuilles['Notes'], h = g.feuilles['Notes historique'];
  n.lignes.push(['fiche-auto-abc-a', 'CHANTIER TEST AUTO', 'essai'], ['fiche-vraie-0000001', 'CHANTIER TEST AUTO', 'à garder'], ['fiche-auto-abc-b', 'CHANTIER TEST AUTO', 'essai']);
  h.lignes.push([new Date(), 'fiche-auto-abc-a', 'x'], [new Date(), 'fiche-vraie-0000001', 'x']);
  const p = geste(g, 'purgerNotesEssai');
  assert.ok(p.ok && p.data.lignesRetirees === 3, JSON.stringify(p));
  assert.deepStrictEqual(n.lignes.slice(1).map(l => l[0]), ['fiche-vraie-0000001']);
  assert.deepStrictEqual(h.lignes.slice(1).map(l => l[1]), ['fiche-vraie-0000001']);
});
test('porte complète hors de TEST : tous les gestes sont refusés, rien n’est écrit', () => {
  const g = serveurLot2();
  g.proprietes.ENVIRONNEMENT = '';   // même projet, mais plus « TEST » : environnement incohérent
  const avant = JSON.stringify([U(g), g.proprietes, g.declencheurs]);
  ['etat', 'preparerComptes', 'session', 'fermerSessions', 'cocher', 'poserDeclencheurs', 'retirerDeclencheurs', 'traiterComptes', 'finirTransition', 'prolongerTransition',
    'lireEnvois', 'lireBilan', 'lireChantiers', 'lireCompte', 'controlerLot2', 'essaiDeclencheur', 'retablirTransition', 'preparerChantier',
    'installerLot7', 'lireSignalements', 'destinatairesEssai', 'installerLot3', 'accesChantier', 'rangerAnciennesNotes', 'purgerNotesEssai', 'dossierChantierEssai'].forEach(nom =>
    assert.deepStrictEqual(geste(g, nom, { id: 'auto-admin', case: 'actif', valeur: true }), { ok: false, code: 'REFUSE', message: 'Refusé' }, nom));
  assert.strictEqual(JSON.stringify([U(g), g.proprietes, g.declencheurs]), avant);
});
test('serveur SANS la porte (production) : l’action « outilTest » est une action inconnue, même avec la bonne clé', () => {
  [TEST(), PROD].forEach(o => {
    const r = poster(serveur(o, false), appel('etat'));
    assert.strictEqual(r.code, 'ACTION_INCONNUE');
    assert.ok(JSON.stringify(r).indexOf(CLE) < 0);
  });
});
test('ping : renvoie l’empreinte quand elle est écrite dans le serveur, vide sinon ; rien d’autre ne change', () => {
  const g = serveur(PROD, false);
  const r = poster(g, { action: 'ping', v: 5 });
  assert.ok(r.ok && r.data.comptes === true && r.data.empreinte === '');
  vm.runInContext("var EMPREINTE_SERVEUR = 'abc1234567';", g.ctx);
  assert.strictEqual(poster(g, { action: 'ping', v: 5 }).data.empreinte, 'abc1234567');
  assert.ok(/^Loué App API v[\d.]+ OK$/.test(g.ctx.doGet({ parameter: {} }).contenu), 'le texte de l’adresse ne change pas');
});
test('verifierConfig : ❌ si la porte ou sa clé sont hors de TEST ; simple information sur TEST', () => {
  const lignes = g => g.ctx.verifierConfig().split('\n').filter(l => /OUTILS D’ESSAI|CLE_OUTILS_TEST|Outils d’essai|incohérent/.test(l));
  assert.deepStrictEqual(lignes(serveur({ nomSheet: 'ChantierPro', proprietes: {} }, false)), [], 'production propre : aucune ligne');
  const prodSale = lignes(serveur(PROD, true));
  assert.strictEqual(prodSale.length, 2);
  assert.ok(prodSale.every(l => /^❌ /.test(l)), prodSale.join(' | '));
  assert.ok(/^❌ La propriété CLE_OUTILS_TEST/.test(lignes(serveur(PROD, false))[0]));
  assert.deepStrictEqual(lignes(serveur(TEST(), true)), ['Outils d’essai (copie TEST) : porte présente, clé présente']);
  assert.ok(/^❌ Environnement incohérent/.test(lignes(serveur({ nomSheet: 'ChantierPro', proprietes: { ENVIRONNEMENT: 'TEST' } }, false))[0]));
  // un déclencheur d'essai resté en place est signalé partout
  const g = serveur({ nomSheet: 'ChantierPro', proprietes: {} }, false);
  g.declencheurs.push('outilTestRien_');
  assert.ok(g.ctx.verifierConfig().split('\n').some(l => /^❌ Déclencheur d’essai resté en place \(outilTestRien_\)/.test(l)));
});
test('construction : toute façon de définir la porte est reconnue ; la ligne d’accroche ne l’est pas', () => {
  ['function outilTest_(c){}', 'function* outilTest_ (c){}', 'const outilTest_ = function(){}', 'outilTest_ = c => 1', 'globalThis.outilTest_ = 1',
    'const OUTIL_TEST_REFUS = {}', 'function outilTestRien_(){}', 'this["outilTest_"] = 1'].forEach(c => assert.ok(construire.contientPorte(c), c));
  ["if (corps.action === 'outilTest' && typeof outilTest_ === 'function') return outilTest_(corps);", '// outilTest_ en commentaire', 'x == outilTest_']
    .forEach(c => assert.ok(!construire.contientPorte(c), c));
});

// ── Construction ─────────────────────────────────────────────────────────────────────────────────────────
test('construction : le Code.gs de production ne contient pas la porte ; l’assemblage TEST la contient ; empreintes différentes', () => {
  const sans = construire.assembler(false), avec = construire.assembler(true);
  assert.ok(!construire.MARQUE_PORTE.test(sans.code) && construire.MARQUE_PORTE.test(avec.code));
  assert.notStrictEqual(sans.empreinte, avec.empreinte);
  [sans, avec].forEach(s => { assert.ok(s.code.indexOf("const EMPREINTE_SERVEUR = '" + s.empreinte + "';") > -1); new vm.Script(s.code); });
  const colle = fs.readFileSync(path.join(RACINE, 'A-COLLER-DANS-APPS-SCRIPT', 'Code.gs'), 'utf8').replace(/\r\n/g, '\n');
  assert.strictEqual(colle, sans.code, 'le fichier à coller est exactement l’assemblage sans porte');
  assert.ok(!fs.existsSync(path.join(RACINE, 'apps-script', 'OutilsTest.gs')), 'la porte n’est pas dans apps-script/');
  assert.ok(/typeof outilTest_ === 'function'/.test(sans.code), 'la ligne d’accroche, elle, est partout');
});
test('construction : chargés SEULS, les deux assemblages répondent ; seule la version TEST ouvre la porte', () => {
  const charger = (code, o) => { const g = creerGoogle(Object.assign({ feuilles: { 'Chantiers': [['Nom']] } }, o));
    g.ctx = vm.createContext(g.contexte); vm.runInContext(code, g.ctx); return g; };
  const sans = construire.assembler(false), avec = construire.assembler(true);
  const gs = charger(sans.code, TEST()), ga = charger(avec.code, TEST());
  assert.strictEqual(poster(gs, { action: 'ping', v: 5 }).data.empreinte, sans.empreinte);
  assert.strictEqual(poster(ga, { action: 'ping', v: 5 }).data.empreinte, avec.empreinte);
  assert.strictEqual(poster(gs, appel('etat')).code, 'ACTION_INCONNUE');
  const e = poster(ga, appel('etat'));
  assert.ok(e.ok && e.data.empreinte === avec.empreinte);
});
test('construction : une porte glissée dans apps-script/ est refusée (elle partirait en production)', () => {
  const intrus = path.join(RACINE, 'apps-script', 'Zzz-intrus-de-test.gs');
  fs.writeFileSync(intrus, 'function outilTest_(c) { return c; }\n');
  try { assert.throws(() => construire.assembler(false), /absent\(s\) de ORDRE_GS|ne doit JAMAIS/); }
  finally { fs.rmSync(intrus, { force: true }); }
});

// ── Envoi sur TEST, avec un faux clasp ───────────────────────────────────────────────────────────────────
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'loue-envoi-'));
const CIBLE = envoi.deploiementTest(RACINE);
const MANIFESTE = JSON.stringify({ timeZone: 'Europe/Paris', webapp: { access: 'ANYONE_ANONYMOUS', executeAs: 'USER_DEPLOYING' } });
let numero = 0;
function monde(reglages) {
  const d = path.join(TMP, 'm' + (++numero));
  const o = { dossierClasp: path.join(d, 'clasp'), dossierJeton: path.join(d, 'maison'), dossierPrive: path.join(d, 'prive'), fichierMonde: path.join(d, 'monde.json') };
  [o.dossierClasp, o.dossierJeton, o.dossierPrive].forEach(x => fs.mkdirSync(x, { recursive: true }));
  fs.writeFileSync(path.join(o.dossierClasp, '.clasp.json'), JSON.stringify({ scriptId: 'SCRIPT-TEST-123', rootDir: '' }));
  const m = Object.assign({ jeton: path.join(o.dossierJeton, '.clasprc.json'), deploiements: ['AKfycbHEAD', CIBLE.id],
    enLigne: { 'Code.js': '// ancien serveur TEST\n', 'appsscript.json': MANIFESTE }, deploye: '// ancien serveur TEST\n' }, reglages || {});
  fs.writeFileSync(o.fichierMonde, JSON.stringify(m));
  o.lire = () => JSON.parse(fs.readFileSync(o.fichierMonde, 'utf8'));
  o.options = extra => Object.assign({ avecPorte: true, dossierClasp: o.dossierClasp, dossierJeton: o.dossierJeton, dossierPrive: o.dossierPrive,
    claspCmd: [process.execPath, path.join(__dirname, 'faux-clasp.js')], env: { FAUX_CLASP_MONDE: o.fichierMonde, clasp_config_project: 'C:/ailleurs/.clasp.json' }, dire: () => {}, pasMs: 5, maxMs: 300,
    etatDepot: () => ({ propre: true, source: 'outillage abc1234' }), sansSignaux: true, demander: async () => ' SCRIPT-TEST-123\n',
    porte: async () => ({ ok: false, code: 'ACTION_INCONNUE' }),   // JAMAIS la vraie porte dans les tests
    appeler: async () => { const c = o.lire().deploye, e = /const EMPREINTE_SERVEUR = '([0-9a-f]+)'/.exec(c); return { ok: true, data: { version: 'v-test', empreinte: e ? e[1] : '' } }; } }, extra || {});
  return o;
}

test('envoi : le chemin normal envoie le serveur AVEC porte, met à jour le déploiement TEST, vérifie, efface le jeton', async () => {
  const m = monde(), r = await envoi.envoyer(m.options());
  assert.strictEqual(r.ok, true, r.rapport.join('\n'));
  const etat = m.lire(), attendu = construire.assembler(true);
  assert.strictEqual(etat.enLigne['Code.js'], attendu.code);
  assert.deepStrictEqual(Object.keys(etat.enLigne).sort(), ['Code.js', 'appsscript.json'], 'un seul fichier de code part');
  assert.strictEqual(etat.enLigne['appsscript.json'], MANIFESTE, 'le manifeste n’est pas modifié');
  assert.strictEqual(etat.deploye, attendu.code);
  assert.deepStrictEqual(etat.journal.map(c => c.split(' ')[0]), ['login', 'list-deployments', 'pull', 'push', 'update-deployment', 'logout']);
  assert.ok(etat.journal.every(c => !/--force|-f\b/.test(c)), 'jamais --force');
  assert.ok(etat.journal[4].indexOf('update-deployment ' + CIBLE.id + ' --description') === 0);
  assert.ok(!fs.existsSync(etat.jeton) && r.jetonRestant === false, 'jeton effacé');
  const sauvegardes = fs.readdirSync(m.dossierPrive).filter(f => /^Code-TEST-avant-\d{8}-\d{6}\.gs$/.test(f));
  assert.strictEqual(sauvegardes.length, 1);
  assert.strictEqual(fs.readFileSync(path.join(m.dossierPrive, sauvegardes[0]), 'utf8'), '// ancien serveur TEST\n', 'la sauvegarde est le serveur d’AVANT');
  assert.strictEqual(fs.readFileSync(path.join(m.dossierPrive, 'script-test-id.txt'), 'utf8').trim(), 'SCRIPT-TEST-123');
  const cr = fs.readdirSync(path.join(m.dossierPrive, 'envois'));
  assert.ok(cr.length === 1 && /-reussi\.txt$/.test(cr[0]));
  const texte = fs.readFileSync(path.join(m.dossierPrive, 'envois', cr[0]), 'utf8');
  assert.ok(/✅ Envoi réussi/.test(texte) && /Jeton Google effacé/.test(texte) && texte.indexOf('FAUX-JETON') < 0 && texte.indexOf('SCRIPT-TEST-123') < 0, 'aucun secret dans le compte rendu');
});
test('envoi : --sans-porte envoie exactement le fichier de production', async () => {
  const m = monde(), r = await envoi.envoyer(m.options({ avecPorte: false }));
  assert.ok(r.ok, r.rapport.join('\n'));
  assert.strictEqual(m.lire().enLigne['Code.js'], construire.assembler(false).code);
  assert.ok(!construire.MARQUE_PORTE.test(m.lire().deploye));
});
test('envoi --sans-porte : la copie TEST est d’abord remise en ordre par la porte encore en place ; sinon l’envoi est annulé', async () => {
  // une fausse porte, avec son état
  const fausse = (etat, pannes) => { const appels = []; return { appels: appels, porte: async g => { appels.push(g);
    if (pannes && pannes[g]) return { ok: false, code: 'ERREUR_OUTIL', message: 'panne de ' + g };
    if (g === 'etat') return { ok: true, data: JSON.parse(JSON.stringify(etat)) };
    if (g === 'retirerDeclencheurs') etat.declencheurs = [];
    if (g === 'retablirTransition') etat.transitionARetablir = false;
    return { ok: true, data: {} }; } }; };
  // 1. déclencheurs posés + transition modifiée : tout est rangé AVANT la connexion Google, puis l'envoi se fait
  let f = fausse({ declencheurs: ['traiterComptes', 'outilTestFinEssaiAuto'], transitionARetablir: true });
  let m = monde(), r = await envoi.envoyer(m.options({ avecPorte: false, porte: f.porte }));
  assert.ok(r.ok, r.rapport.join('\n'));
  assert.deepStrictEqual(f.appels, ['etat', 'retirerDeclencheurs', 'fermerSessions', 'retablirTransition', 'etat']);
  assert.ok(r.rapport.some(l => /copie TEST en ordre \(retirer les déclencheurs d’essai ; fermer les sessions d’essai ; rétablir la période sans compte\)/.test(l)), r.rapport.join('\n'));
  assert.ok(r.rapport.findIndex(l => /copie TEST en ordre/.test(l)) < r.rapport.findIndex(l => /1\/6 Connexion Google/.test(l)), 'rangé avant la connexion');
  // 2. le retrait des déclencheurs échoue : envoi annulé, clasp jamais lancé
  f = fausse({ declencheurs: ['traiterComptes'], transitionARetablir: false }, { retirerDeclencheurs: true });
  m = monde(); r = await envoi.envoyer(m.options({ avecPorte: false, porte: f.porte }));
  assert.ok(!r.ok && /Impossible de retirer les déclencheurs d’essai.*envoi « sans porte » annulé/.test(r.erreur), r.erreur);
  assert.strictEqual((m.lire().journal || []).length, 0);
  // 3. rien à ranger : seules les sessions sont fermées par précaution
  f = fausse({ declencheurs: [], transitionARetablir: false });
  assert.ok((await envoi.envoyer(monde().options({ avecPorte: false, porte: f.porte }))).ok);
  assert.deepStrictEqual(f.appels, ['etat', 'fermerSessions', 'etat']);
  // 4. porte en version minimale (sans session ni transition), ou déjà absente, ou injoignable : on continue
  f = fausse({ declencheurs: [] });
  assert.ok((await envoi.envoyer(monde().options({ avecPorte: false, porte: f.porte }))).ok);
  assert.deepStrictEqual(f.appels, ['etat']);
  assert.ok((await envoi.envoyer(monde().options({ avecPorte: false, porte: async () => ({ ok: false, code: 'ACTION_INCONNUE' }) }))).ok, 'serveur déjà sans porte');
  // clé refusée ou absente du PC : rien n'est faisable à distance, on continue en demandant un contrôle à la main
  for (const code of ['REFUSE', 'CLE_ABSENTE']) {
    const r4 = await envoi.envoyer(monde().options({ avecPorte: false, porte: async () => ({ ok: false, code: code }) }));
    assert.ok(r4.ok && r4.rapport.some(l => /À CONTRÔLER après l’envoi : ▶ verifierConfig/.test(l)), code);
  }
  // panne passagère (pas de réponse, réponse illisible, erreur de la porte) : on NE SAIT PAS, donc on n'envoie pas
  for (const panne of [async () => { throw new Error('réseau coupé'); }, async () => null, async () => 'page d’erreur',
    async () => ({ ok: false, code: 'ERREUR_OUTIL', message: 'quota illisible' }), async () => ({ ok: true })]) {
    const m5 = monde(), r5 = await envoi.envoyer(m5.options({ avecPorte: false, porte: panne }));
    assert.ok(!r5.ok && /Envoi « sans porte » annulé.*Relance la commande/i.test(r5.erreur), r5.erreur);
    assert.strictEqual((m5.lire().journal || []).length, 0, 'clasp n’a pas été lancé');
  }
  // un déclencheur d'un autre nom (posé à la main, ancien lot) ne bloque pas, et il est cité
  f = fausse({ declencheurs: ['autreChoseDeFranck'], transitionARetablir: false });
  const r6 = await envoi.envoyer(monde().options({ avecPorte: false, porte: f.porte }));
  assert.ok(r6.ok && r6.rapport.some(l => /autre\(s\) déclencheur\(s\) présent\(s\), non touché\(s\) : autreChoseDeFranck/.test(l)), r6.rapport.join('\n'));
  assert.ok(f.appels.indexOf('retirerDeclencheurs') < 0);
  // 5. avec porte : la porte n'est pas consultée
  f = fausse({ declencheurs: ['traiterComptes'], transitionARetablir: true });
  assert.ok((await envoi.envoyer(monde().options({ avecPorte: true, porte: f.porte }))).ok);
  assert.deepStrictEqual(f.appels, []);
  // 6. un test qui oublierait la fausse porte est refusé, au lieu d'appeler la vraie
  const o = monde().options({ avecPorte: false }); delete o.porte;
  assert.ok(/test mal monté/.test((await envoi.envoyer(o)).erreur));
});
test('envoi : un projet qui ne contient pas le déploiement TEST (la production, par exemple) = rien n’est envoyé', async () => {
  const m = monde({ deploiements: ['AKfycbHEAD', 'AKfycbPRODUCTION'] }), r = await envoi.envoyer(m.options());
  const etat = m.lire();
  assert.strictEqual(r.ok, false);
  assert.ok(/ne contient PAS le déploiement de la copie TEST/.test(r.erreur), r.erreur);
  assert.deepStrictEqual(etat.journal.map(c => c.split(' ')[0]), ['login', 'list-deployments', 'logout'], 'ni pull, ni push');
  assert.strictEqual(etat.enLigne['Code.js'], '// ancien serveur TEST\n');
  assert.ok(!fs.existsSync(etat.jeton), 'jeton effacé malgré l’échec');
  assert.ok(!fs.existsSync(path.join(m.dossierPrive, 'script-test-id.txt')), 'un mauvais projet n’est pas mémorisé');
});
test('envoi : PREMIER envoi — l’identifiant collé par Franck doit être celui du dossier clasp, sinon refus AVANT toute connexion', async () => {
  const m = monde();
  const r = await envoi.envoyer(m.options({ demander: async () => 'ID-DU-VRAI-SHEET-DE-PRODUCTION' }));
  assert.ok(!r.ok && /identifiant collé n’est pas celui du dossier clasp/.test(r.erreur), r.erreur);
  assert.strictEqual((m.lire().journal || []).length, 0, 'clasp n’a pas été lancé');
  assert.ok(!fs.existsSync(path.join(m.dossierPrive, 'script-test-id.txt')));
  // 2e envoi : plus aucune question
  const m2 = monde(); let demandes = 0;
  assert.ok((await envoi.envoyer(m2.options({ demander: async () => { demandes++; return 'SCRIPT-TEST-123'; } }))).ok);
  m2.lire(); fs.writeFileSync(m2.fichierMonde, JSON.stringify(Object.assign(m2.lire(), { journal: [] })));
  assert.ok((await envoi.envoyer(m2.options({ avecPorte: false, demander: async () => { demandes++; return 'x'; } }))).ok);
  assert.strictEqual(demandes, 1, 'la question n’est posée qu’au premier envoi');
});
test('envoi : le projet contient le déploiement de PRODUCTION = refus, même s’il contient aussi celui de TEST', async () => {
  const m = monde({ deploiements: ['AKfycbHEAD', CIBLE.id, CIBLE.idProduction] }), r = await envoi.envoyer(m.options());
  assert.ok(!r.ok && /contient le déploiement de PRODUCTION/.test(r.erreur), r.erreur);
  assert.deepStrictEqual(m.lire().journal.map(c => c.split(' ')[0]), ['login', 'list-deployments', 'logout']);
  assert.ok(!fs.existsSync(path.join(m.dossierPrive, 'script-test-id.txt')));
});
test('envoi : l’identifiant TEST cité dans la DESCRIPTION d’un déploiement d’un autre projet ne trompe pas le contrôle', async () => {
  const m = monde({ deploiements: ['AKfycbHEAD', 'AKfycbAUTREPROJET'], descriptions: ['', 'copie de ' + CIBLE.id + ' @3'] });
  const r = await envoi.envoyer(m.options());
  assert.ok(!r.ok && /ne contient PAS le déploiement de la copie TEST/.test(r.erreur), r.erreur);
  assert.deepStrictEqual(envoi.lireDeploiements('Found 2 deployments.\r\n- AKfycbA @HEAD \r\n- AKfycbB @12 - Lot 2 - AKfycbC @1\n'), ['AKfycbA', 'AKfycbB']);
});
test('envoi : URL_TEST identique à URL_PRODUCTION dans commun/config.js = refus avant tout', async () => {
  const racine = path.join(TMP, 'config-fausse'); fs.mkdirSync(path.join(racine, 'commun'), { recursive: true });
  const vraie = fs.readFileSync(path.join(RACINE, 'commun', 'config.js'), 'utf8');
  const prod = /var URL_PRODUCTION = '([^']+)'/.exec(vraie)[1];
  fs.writeFileSync(path.join(racine, 'commun', 'config.js'), vraie.replace(/var URL_TEST = '[^']+'/, "var URL_TEST = '" + prod + "'"));
  assert.throws(() => envoi.deploiementTest(racine), /même adresse que URL_PRODUCTION : REFUSÉ/);
  const m = monde(), r = await envoi.envoyer(m.options({ racine: racine }));
  assert.ok(!r.ok && /REFUSÉ/.test(r.erreur) && (m.lire().journal || []).length === 0);
});
test('envoi : dossier clasp détourné (rootDir) ou fichier .claspignore = refus avant toute connexion', async () => {
  let m = monde();
  fs.writeFileSync(path.join(m.dossierClasp, '.clasp.json'), JSON.stringify({ scriptId: 'SCRIPT-TEST-123', rootDir: 'C:/ailleurs' }));
  let r = await envoi.envoyer(m.options());
  assert.ok(!r.ok && /rootDir/.test(r.erreur) && (m.lire().journal || []).length === 0, r.erreur);
  m = monde(); fs.writeFileSync(path.join(m.dossierClasp, '.claspignore'), 'Code.js\n');
  r = await envoi.envoyer(m.options());
  assert.ok(!r.ok && /\.claspignore/.test(r.erreur) && (m.lire().journal || []).length === 0, r.erreur);
});
test('envoi : le jeton est rangé dans un dossier temporaire de la commande, jamais à l’endroit habituel ; les réglages clasp_config_* hérités sont retirés', async () => {
  const m = monde();
  let pendant = null;
  const r = await envoi.envoyer(m.options({ appeler: async () => { pendant = fs.existsSync(m.lire().jeton); const c = m.lire().deploye, e = /const EMPREINTE_SERVEUR = '([0-9a-f]+)'/.exec(c); return { data: { version: 'v', empreinte: e[1] } }; } }));
  assert.ok(r.ok, r.rapport.join('\n'));
  assert.strictEqual(pendant, false, 'pendant l’envoi, rien à l’endroit habituel');
  assert.ok(!r.jetonRestant && !fs.existsSync(m.lire().jeton));
  assert.strictEqual(fs.readdirSync(os.tmpdir()).filter(d => /^loue-clasp-/.test(d)).length, 0, 'le dossier temporaire du jeton est supprimé');
});
test('envoi : un clasp qui range quand même le jeton à l’endroit habituel est rattrapé (filet de sécurité)', async () => {
  const m = monde({ ignoreAuth: true, logoutSansEffet: true }), r = await envoi.envoyer(m.options());
  assert.ok(r.ok, r.rapport.join('\n'));
  assert.ok(!fs.existsSync(m.lire().jeton) && !r.jetonRestant);
});
test('envoi : connexion trop longue — clasp est ARRÊTÉ, il ne peut plus écrire le jeton après « Jeton effacé »', async () => {
  const m = monde({ ignoreAuth: true, loginLent: 2500 });
  const r = await envoi.envoyer(m.options({ maxMsClasp: 400 }));
  assert.ok(!r.ok && /clasp login : trop long/.test(r.erreur), r.erreur);
  assert.ok(r.rapport.some(l => /Jeton Google effacé du PC/.test(l)) && !r.jetonRestant);
  await new Promise(x => setTimeout(x, 3500));   // le faux clasp, s'il vivait encore, écrirait le jeton maintenant
  assert.ok(!fs.existsSync(m.lire().jeton), 'aucun jeton écrit après coup');
});
test('envoi : une étape qui se fige est arrêtée à sa durée limite ; le jeton est effacé', async () => {
  const m = monde({ lent: { push: 3000 } });
  const t0 = Date.now(), r = await envoi.envoyer(m.options({ maxMsClasp: 500 }));
  assert.ok(!r.ok && /clasp push : trop long/.test(r.erreur), r.erreur);
  assert.ok(Date.now() - t0 < 2800, 'la commande n’attend pas la fin du programme figé');
  assert.ok(!r.jetonRestant && r.rapport.some(l => /état intermédiaire/.test(l)));
});
test('envoi : interruption (Ctrl+C) pendant la connexion puis pendant l’envoi — clasp arrêté, jeton effacé, compte rendu écrit', async () => {
  // La commande tourne dans un programme à part, qui reçoit le signal d'interruption au bout d'une seconde
  const lanceur = path.join(TMP, 'lanceur.js');
  fs.writeFileSync(lanceur, [
    "const envoi = require(" + JSON.stringify(path.join(RACINE, 'outils', 'envoyer-test.js')) + ");",
    "const o = JSON.parse(process.argv[2]);",
    "o.etatDepot = () => ({ propre: true, source: 'x' }); o.demander = async () => 'SCRIPT-TEST-123'; o.dire = () => {};",
    "o.appeler = async () => ({ data: { empreinte: '' } });",
    "setTimeout(() => process.emit('SIGINT'), 1000);",
    "envoi.envoyer(o).then(() => process.exit(0));",
  ].join('\n'));
  for (const [reglages, attendu] of [[{ ignoreAuth: true, loginLent: 4000 }, /Rien n’a été envoyé/], [{ ignoreAuth: true, lent: { push: 4000 } }, /état intermédiaire/]]) {
    const m = monde(reglages), o = m.options();
    ['dire', 'appeler', 'etatDepot', 'demander', 'sansSignaux'].forEach(k => { delete o[k]; });
    let code = 0;
    try { execFileSync(process.execPath, [lanceur, JSON.stringify(o)], { stdio: 'pipe', timeout: 20000 }); } catch (e) { code = e.status; }
    assert.strictEqual(code, 1, 'la commande interrompue sort en erreur');
    await new Promise(x => setTimeout(x, 4500));   // un clasp encore vivant écrirait ou garderait le jeton
    assert.ok(!fs.existsSync(m.lire().jeton), 'aucun jeton à l’endroit habituel');
    const cr = fs.readdirSync(path.join(m.dossierPrive, 'envois'));
    assert.ok(cr.length === 1 && /-INTERROMPU\.txt$/.test(cr[0]), cr.join());
    const texte = fs.readFileSync(path.join(m.dossierPrive, 'envois', cr[0]), 'utf8');
    assert.ok(/Commande interrompue/.test(texte) && attendu.test(texte) && /Jeton Google effacé du PC/.test(texte), texte);
  }
  assert.strictEqual(fs.readdirSync(os.tmpdir()).filter(d => /^loue-clasp-/.test(d)).length, 0, 'aucun dossier de jeton oublié');
});
test('envoi : le jeton est effacé AVANT la vérification en ligne ; un fichier vide laissé par « clasp logout » ne déclenche pas d’alerte', async () => {
  const m = monde({ ignoreAuth: true });
  fs.writeFileSync(m.lire().jeton, '{"tokens":{}}');   // ce que laisse « clasp logout » après l'installation
  let pendantVerification = null;
  const r = await envoi.envoyer(m.options({ appeler: async () => { pendantVerification = fs.existsSync(m.lire().jeton);
    const e = /const EMPREINTE_SERVEUR = '([0-9a-f]+)'/.exec(m.lire().deploye); return { data: { version: 'v', empreinte: e[1] } }; } }));
  assert.ok(r.ok, r.rapport.join('\n'));
  assert.strictEqual(pendantVerification, false, 'plus de jeton pendant la vérification en ligne');
  assert.ok(!r.rapport.some(l => /était resté sur le PC/.test(l)), 'pas de fausse alerte');
  assert.strictEqual(m.lire().journal.filter(c => c === 'logout').length, 1);
  // un vrai jeton oublié, lui, est signalé
  const m2 = monde(); fs.writeFileSync(m2.lire().jeton, '{"tokens":{"default":{"refresh_token":"x"}}}');
  assert.ok((await envoi.envoyer(m2.options())).rapport.some(l => /était resté sur le PC/.test(l)));
});
test('envoi : .clasp.json avec srcDir détourné = refus ; les champs écrits par clasp lui-même sont acceptés', async () => {
  let m = monde();
  fs.writeFileSync(path.join(m.dossierClasp, '.clasp.json'), JSON.stringify({ scriptId: 'SCRIPT-TEST-123', srcDir: 'sous-dossier' }));
  let r = await envoi.envoyer(m.options());
  assert.ok(!r.ok && /srcDir/.test(r.erreur) && (m.lire().journal || []).length === 0, r.erreur);
  m = monde();
  fs.writeFileSync(path.join(m.dossierClasp, '.clasp.json'), JSON.stringify({ scriptId: 'SCRIPT-TEST-123', rootDir: '', scriptExtensions: ['.js', '.gs'],
    htmlExtensions: ['.html'], jsonExtensions: ['.json'], filePushOrder: [], skipSubdirectories: false }));
  assert.ok((await envoi.envoyer(m.options())).ok);
});
test('envoi : .clasp.json modifié pendant l’envoi = arrêt avant le push', async () => {
  const m = monde();
  const r = await envoi.envoyer(m.options({ demander: undefined, etatDepot: () => ({ propre: true, source: 'x' }) , claspCmd: [process.execPath, path.join(__dirname, 'faux-clasp.js')] ,
    env: { FAUX_CLASP_MONDE: m.fichierMonde, FAUX_CLASP_CHANGE_PROJET: '1' } , demander: async () => 'SCRIPT-TEST-123' }));
  assert.ok(!r.ok && /a changé pendant l’envoi/.test(r.erreur), r.erreur);
  assert.ok(m.lire().journal.every(c => c.indexOf('push') !== 0), 'aucun push');
});
test('envoi : dossier clasp relié à un autre projet que celui mémorisé = refus AVANT toute connexion', async () => {
  const m = monde();
  fs.writeFileSync(path.join(m.dossierPrive, 'script-test-id.txt'), 'UN-AUTRE-SCRIPT\n');
  const r = await envoi.envoyer(m.options());
  assert.ok(!r.ok && /n’est PAS relié au projet de la copie TEST mémorisé/.test(r.erreur));
  assert.strictEqual((m.lire().journal || []).length, 0, 'clasp n’a même pas été lancé');
});
test('envoi : un fichier en trop dans le dossier clasp, ou un manifeste inattendu = rien n’est envoyé', async () => {
  let m = monde(); fs.writeFileSync(path.join(m.dossierClasp, 'Autre.js'), '// intrus');
  let r = await envoi.envoyer(m.options());
  assert.ok(!r.ok && /en trop : Autre\.js/.test(r.erreur), r.erreur);
  assert.ok(m.lire().journal.every(c => c.indexOf('push') !== 0));
  m = monde({ enLigne: { 'Code.js': '// x\n', 'appsscript.json': JSON.stringify({ webapp: { access: 'MYSELF', executeAs: 'USER_DEPLOYING' } }) } });
  r = await envoi.envoyer(m.options());
  assert.ok(!r.ok && /manifeste/.test(r.erreur) && m.lire().journal.every(c => c.indexOf('push') !== 0));
  m = monde({ enLigne: { 'Code.js': '// x\n', 'Vieux.js': '// y\n', 'appsscript.json': MANIFESTE } });
  r = await envoi.envoyer(m.options());
  assert.ok(!r.ok && /en trop : Vieux\.js/.test(r.erreur));
});
test('envoi : si le manifeste devait changer, clasp n’envoie rien et la commande s’arrête', async () => {
  const m = monde({ question: true }), r = await envoi.envoyer(m.options());
  assert.ok(!r.ok && /refusé d’envoyer \(le manifeste/.test(r.erreur), r.erreur);
  assert.strictEqual(m.lire().enLigne['Code.js'], '// ancien serveur TEST\n');
  assert.ok(m.lire().journal.every(c => c.indexOf('update-deployment') !== 0));
});
test('envoi : déploiement non pris en compte (règle 2 de CLAUDE.md) = échec signalé, jeton effacé', async () => {
  const m = monde({ deploiementFige: true }), r = await envoi.envoyer(m.options());
  assert.ok(!r.ok && /n’a pas été prise/.test(r.erreur), r.erreur);
  assert.ok(r.rapport.some(l => /état intermédiaire/.test(l)));
  assert.ok(!fs.existsSync(m.lire().jeton));
});
test('envoi : panne à chaque étape = le jeton est toujours effacé, même si « clasp logout » ne fait rien', async () => {
  for (const etape of ['login', 'list-deployments', 'pull', 'push', 'update-deployment']) {
    const m = monde({ pannes: { [etape]: true }, logoutSansEffet: true });
    if (etape !== 'login') fs.writeFileSync(m.lire().jeton, 'jeton oublié d’une séance précédente');
    const r = await envoi.envoyer(m.options());
    assert.strictEqual(r.ok, false, etape);
    assert.ok(!fs.existsSync(m.lire().jeton) && !r.jetonRestant, 'jeton effacé après une panne de ' + etape);
    if (etape !== 'login') assert.ok(r.rapport.some(l => /était resté sur le PC/.test(l)));
  }
});
test('envoi : il faut dire --avec-porte ou --sans-porte ; l’adresse TEST est lue dans commun/config.js', async () => {
  await assert.rejects(() => envoi.envoyer({}), /--avec-porte ou --sans-porte/);
  assert.ok(/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(CIBLE.url) && CIBLE.url.indexOf(CIBLE.id) > 0);
  const prod = /var URL_PRODUCTION = '([^']+)'/.exec(fs.readFileSync(path.join(RACINE, 'commun', 'config.js'), 'utf8'))[1];
  assert.notStrictEqual(CIBLE.url, prod, 'jamais l’adresse de production');
});
test('envoi : la vérification en ligne attend la bonne empreinte et abandonne sinon', async () => {
  let n = 0;
  const ok = await envoi.attendreEmpreinte('u', 'bonne', { pasMs: 1, maxMs: 500, appeler: async () => ({ data: { version: 'v', empreinte: ++n < 3 ? 'vieille' : 'bonne' } }) });
  assert.deepStrictEqual([ok.ok, n], [true, 3]);
  const ko = await envoi.attendreEmpreinte('u', 'bonne', { pasMs: 1, maxMs: 20, appeler: async () => { throw new Error('réseau'); } });
  assert.ok(!ko.ok && /pas de réponse/.test(ko.vue));
});

// ── Clé et appel de la porte ─────────────────────────────────────────────────────────────────────────────
test('clé : fabriquée une fois (48 caractères), jamais refaite, jamais affichée ; l’appel l’envoie dans le corps, pas dans l’adresse', async () => {
  const prive = path.join(TMP, 'cle');
  const a = porte.creerCle(prive);
  assert.strictEqual(a.cree, true);
  const cle = porte.lireCle(prive);
  assert.ok(/^[A-Za-z0-9_-]{48}$/.test(cle));
  assert.strictEqual(porte.creerCle(prive).cree, false);
  assert.strictEqual(porte.lireCle(prive), cle, 'la clé existante est gardée');
  let recu;
  const rep = await porte.appeler('etat', null, { prive: prive, url: 'https://exemple.test/exec', envoyer: async (u, corps) => { recu = { u, corps }; return { ok: true }; } });
  assert.ok(rep.ok && recu.u === 'https://exemple.test/exec' && recu.u.indexOf(cle) < 0);
  assert.deepStrictEqual(recu.corps, { action: 'outilTest', v: 5, geste: 'etat', cle: cle });
  assert.throws(() => porte.lireCle(path.join(TMP, 'absent')), /Clé absente/);
  // le jeton d'une session d'essai n'est jamais dans la réponse rendue : il est rangé dans _prive/
  const JETON = 'auto-admin.t.2.1799999999999.SIGNATURE-SECRETE-DE-TEST';
  const s = await porte.appeler('session', { id: 'auto-admin' }, { prive: prive, url: 'https://exemple.test/exec',
    envoyer: async () => ({ ok: true, code: 'OK', data: { id: 'auto-admin', profil: { role: 'Admin' }, jeton: JETON } }) });
  assert.ok(JSON.stringify(s).indexOf('SIGNATURE-SECRETE') < 0 && /rangé dans _prive/.test(s.data.jeton), JSON.stringify(s));
  assert.strictEqual(porte.lireSession(prive).jeton, JETON);
  await porte.appeler('fermerSessions', null, { prive: prive, url: 'https://exemple.test/exec', envoyer: async () => ({ ok: true, data: {} }) });
  assert.strictEqual(porte.lireSession(prive), null, 'le jeton rangé est effacé à la fermeture des sessions');
  // un jeton placé ailleurs dans une réponse (message d'erreur, objet imbriqué) est masqué aussi
  const ailleurs = porte.masquerJetons({ ok: false, message: 'refus de ' + JETON, data: { liste: [{ j: JETON }], profil: { id: 'auto-admin' } } });
  assert.ok(JSON.stringify(ailleurs).indexOf('SIGNATURE-SECRETE') < 0 && ailleurs.data.profil.id === 'auto-admin');
  assert.deepStrictEqual(porte.lireParametres(['n=3', 'valeur=true', 'id=auto-poseur', 'case=reinit']), { n: 3, valeur: true, id: 'auto-poseur', case: 'reinit' });
  ['cle=x', 'geste=etat', 'action=ping', 'sansegal'].forEach(a => assert.throws(() => porte.lireParametres([a]), /réservé|mal écrit/));
  const sortie = execFileSync(process.execPath, ['-e', "const p=require(process.argv[1]);const r=p.creerCle(process.argv[2]);console.log(r.cree)", path.join(RACINE, 'outils', 'porte.js'), path.join(TMP, 'cle2')], { encoding: 'utf8' });
  assert.ok(sortie.indexOf(porte.lireCle(path.join(TMP, 'cle2'))) < 0);
});

(async () => {
  for (const t of attente) await t();
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  console.log('\n' + reussis + ' test(s) réussi(s)' + (process.exitCode ? ' — DES TESTS ÉCHOUENT' : ''));
})();
