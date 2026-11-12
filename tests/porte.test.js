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
test('porte : seuls les gestes de la liste existent (aucune fonction du serveur n’est appelable par son nom)', () => {
  const g = serveur(TEST(), true);
  ['verifierConfig', 'changerCle', 'genererCle', 'installerDeclencheurs', 'retirerDeclencheurs', 'executerMigration', 'constructor', '__proto__', 'toString', '', null, undefined, 42]
    .forEach(geste => assert.deepStrictEqual(poster(g, appel(geste)), { ok: false, code: 'REFUSE', message: 'Refusé' }, String(geste)));
  assert.strictEqual(g.declencheurs.length, 0);
});
test('porte : l’essai de faisabilité pose puis retire un déclencheur, sans toucher aux autres', () => {
  const g = serveur(TEST(), true);
  const r = poster(g, appel('essaiDeclencheur'));
  assert.strictEqual(r.ok, true, JSON.stringify(r));
  assert.deepStrictEqual([r.data.pose, r.data.retire], [true, true]);
  assert.strictEqual(r.message, 'déclencheur posé ; déclencheur retiré');
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
    claspCmd: [process.execPath, path.join(__dirname, 'faux-clasp.js')], env: { FAUX_CLASP_MONDE: o.fichierMonde }, dire: () => {}, pasMs: 5, maxMs: 300,
    appeler: async () => { const c = o.lire().deploye, e = /const EMPREINTE_SERVEUR = '([0-9a-f]+)'/.exec(c); return { ok: true, data: { version: 'v-test', empreinte: e ? e[1] : '' } }; } }, extra || {});
  return o;
}
const propre = () => execFileSync('git', ['-C', RACINE, 'status', '--porcelain'], { encoding: 'utf8' }).trim() === '';

test('envoi : le chemin normal envoie le serveur AVEC porte, met à jour le déploiement TEST, vérifie, efface le jeton', async () => {
  if (!propre()) { console.log('    (dépôt avec des modifications en cours : test d’envoi sauté)'); return; }
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
  if (!propre()) return;
  const m = monde(), r = await envoi.envoyer(m.options({ avecPorte: false }));
  assert.ok(r.ok, r.rapport.join('\n'));
  assert.strictEqual(m.lire().enLigne['Code.js'], construire.assembler(false).code);
  assert.ok(!construire.MARQUE_PORTE.test(m.lire().deploye));
});
test('envoi : un projet qui ne contient pas le déploiement TEST (la production, par exemple) = rien n’est envoyé', async () => {
  if (!propre()) return;
  const m = monde({ deploiements: ['AKfycbHEAD', 'AKfycbPRODUCTION'] }), r = await envoi.envoyer(m.options());
  const etat = m.lire();
  assert.strictEqual(r.ok, false);
  assert.ok(/ne contient PAS le déploiement de la copie TEST/.test(r.erreur), r.erreur);
  assert.deepStrictEqual(etat.journal.map(c => c.split(' ')[0]), ['login', 'list-deployments', 'logout'], 'ni pull, ni push');
  assert.strictEqual(etat.enLigne['Code.js'], '// ancien serveur TEST\n');
  assert.ok(!fs.existsSync(etat.jeton), 'jeton effacé malgré l’échec');
  assert.ok(!fs.existsSync(path.join(m.dossierPrive, 'script-test-id.txt')), 'un mauvais projet n’est pas mémorisé');
});
test('envoi : dossier clasp relié à un autre projet que celui mémorisé = refus AVANT toute connexion', async () => {
  if (!propre()) return;
  const m = monde();
  fs.writeFileSync(path.join(m.dossierPrive, 'script-test-id.txt'), 'UN-AUTRE-SCRIPT\n');
  const r = await envoi.envoyer(m.options());
  assert.ok(!r.ok && /n’est PAS relié au projet de la copie TEST mémorisé/.test(r.erreur));
  assert.strictEqual((m.lire().journal || []).length, 0, 'clasp n’a même pas été lancé');
});
test('envoi : un fichier en trop dans le dossier clasp, ou un manifeste inattendu = rien n’est envoyé', async () => {
  if (!propre()) return;
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
test('envoi : si clasp pose une question sur le manifeste, la réponse est NON et l’envoi est annulé', async () => {
  if (!propre()) return;
  const m = monde({ question: true }), r = await envoi.envoyer(m.options());
  assert.ok(!r.ok && /question sur le manifeste/.test(r.erreur), r.erreur);
  assert.strictEqual(m.lire().enLigne['Code.js'], '// ancien serveur TEST\n');
  assert.ok(m.lire().journal.every(c => c.indexOf('update-deployment') !== 0));
});
test('envoi : déploiement non pris en compte (règle 2 de CLAUDE.md) = échec signalé, jeton effacé', async () => {
  if (!propre()) return;
  const m = monde({ deploiementFige: true }), r = await envoi.envoyer(m.options());
  assert.ok(!r.ok && /n’a pas été prise/.test(r.erreur), r.erreur);
  assert.ok(r.rapport.some(l => /état intermédiaire/.test(l)));
  assert.ok(!fs.existsSync(m.lire().jeton));
});
test('envoi : panne à chaque étape = le jeton est toujours effacé, même si « clasp logout » ne fait rien', async () => {
  if (!propre()) return;
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
  const sortie = execFileSync(process.execPath, ['-e', "const p=require(process.argv[1]);const r=p.creerCle(process.argv[2]);console.log(r.cree)", path.join(RACINE, 'outils', 'porte.js'), path.join(TMP, 'cle2')], { encoding: 'utf8' });
  assert.ok(sortie.indexOf(porte.lireCle(path.join(TMP, 'cle2'))) < 0);
});

(async () => {
  for (const t of attente) await t();
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  console.log('\n' + reussis + ' test(s) réussi(s)' + (process.exitCode ? ' — DES TESTS ÉCHOUENT' : ''));
})();
