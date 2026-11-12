// Tests des outils du PC (lien de demande de fusion, copie d'essai) : node tests/outils.test.js
// Tout se passe dans un dossier temporaire : aucun appel à GitHub, rien n'est modifié dans le dépôt.
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const lien = require('../outils/lien-fusion.js');
const essai = require('../outils/essai.js');
const pub = require('../outils/publier-essai.js');

const RACINE = path.join(__dirname, '..');
let reussis = 0;
const attente = [];
function test(nom, fn) {
  attente.push(async () => {
    try { await fn(); reussis++; console.log('  ✓ ' + nom); }
    catch (e) { process.exitCode = 1; console.log('  ✗ ' + nom + '\n    ' + (e.stack || e).split('\n').slice(0, 4).join('\n    ')); }
  });
}
const git = (dossier, ...args) => execFileSync('git', ['-C', dossier].concat(args), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const ecrire = (f, t) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, t); };

// ── Un faux monde : un faux dépôt de production, un faux « GitHub » (dépôts nus), un dossier voisin ──────
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'loue-outils-')).replace(/\\/g, '/');
const CIBLE = { organisation: 'org-essai', depot: 'chantier-pro', nom: 'org-essai/chantier-pro',
  adresseGit: TMP + '/github.com/org-essai/chantier-pro.git', adresseSite: 'https://org-essai.github.io/chantier-pro/' };
function depotNu(nom) {   // un dépôt « sur GitHub », avec un README sur main (comme celui que Franck crée)
  const nu = TMP + '/github.com/' + nom + '.git', graine = TMP + '/graine-' + nom.replace('/', '-');
  fs.mkdirSync(nu, { recursive: true });
  execFileSync('git', ['init', '--quiet', '--bare', '--initial-branch=main', nu]);
  fs.mkdirSync(graine, { recursive: true });
  execFileSync('git', ['init', '--quiet', '--initial-branch=main', graine]);
  ecrire(graine + '/README.md', '# vide\n');
  git(graine, 'add', '-A');
  git(graine, '-c', 'user.name=t', '-c', 'user.email=t@loue.test', 'commit', '--quiet', '-m', 'README');
  git(graine, 'push', '--quiet', nu, 'main');
  return nu;
}
function fauxDepotProd() {
  const r = TMP + '/monde/chantier-pro';
  ecrire(r + '/index.html', '<!DOCTYPE html>\n<html lang="fr">\n<head>\n<meta charset="UTF-8">\n<title>Loué</title>\n</head><body></body></html>\n');
  ecrire(r + '/quitus.html', '<!DOCTYPE html>\n<html lang="fr">\n<head>\n<meta charset="UTF-8">\n</head><body></body></html>\n');
  fs.copyFileSync(RACINE + '/manifest.json', r + '/manifest.json');
  ecrire(r + '/sw.js', '// sw\n');
  ecrire(r + '/icone-192.png', 'png');
  fs.cpSync(RACINE + '/commun', r + '/commun', { recursive: true });   // le VRAI commun/config.js : la transformation est testée dessus
  ecrire(r + '/modeles/quitus.js', '// modèle\n');
  ecrire(r + '/apps-script/Code.gs', '// serveur : ne doit PAS être copié\n');
  ecrire(r + '/.gitignore', '.clasprc.json\ncreds*.json\nThumbs.db\n');
  ecrire(r + '/_prive/secret.txt', 'ne doit PAS être copié\n');
  execFileSync('git', ['init', '--quiet', '--initial-branch=main', r]);
  git(r, 'config', 'user.name', 'Essai'); git(r, 'config', 'user.email', 'essai@loue.test');
  git(r, 'config', 'core.autocrlf', 'false');
  git(r, 'add', '-A'); git(r, 'commit', '--quiet', '-m', 'faux dépôt');
  return r;
}
const NU_ESSAI = depotNu('org-essai/chantier-pro');
const NU_PROD = depotNu('chantiersloue/chantier-pro');
const PROD = fauxDepotProd();
const VOISIN = TMP + '/monde/chantier-pro-essai';

// ══ Lien pré-rempli ═══════════════════════════════════════════════════════════════════════════════════════
test('lien : le dépôt est lu dans l’adresse de GitHub (https ou ssh)', () => {
  assert.strictEqual(lien.depotDepuisAdresse('https://github.com/chantiersloue/chantier-pro.git'), 'chantiersloue/chantier-pro');
  assert.strictEqual(lien.depotDepuisAdresse('git@github.com:chantiersloue/chantier-pro.git\n'), 'chantiersloue/chantier-pro');
  assert.strictEqual(lien.depotDepuisAdresse('https://github.com/chantiersloue/chantier-pro'), 'chantiersloue/chantier-pro');
  ['https://exemple.test/x/y.git', 'https://pasgithub.com/a/b', 'C:/tmp/github.com/a/b.git', 'https://github.com/a/b?x=1', 'https://github.com/a/b/c']
    .forEach(a => assert.throws(() => lien.depotDepuisAdresse(a), /non reconnue/, a));
});
test('lien : accents, guillemets, retours à la ligne et « & » survivent à l’adresse', () => {
  const titre = 'Lot 7 — Signalement : casse / manquant & « à recommander »';
  const corps = 'Ligne 1 : été, où, ça\n\n**Serveur** : inchangé #1 ?\n100 % sûr';
  const u = new URL(lien.construireLien({ depot: 'chantiersloue/chantier-pro', branche: 'livraison/lot-7', titre: titre, corps: corps }));
  assert.strictEqual(u.origin + u.pathname, 'https://github.com/chantiersloue/chantier-pro/compare/main...livraison/lot-7');
  assert.strictEqual(u.searchParams.get('quick_pull'), '1');
  assert.strictEqual(u.searchParams.get('title'), titre);
  assert.strictEqual(u.searchParams.get('body'), corps);
  assert.strictEqual(u.hash, '', 'un # dans le texte ne coupe pas l’adresse');
});
test('lien : refus d’un titre vide, d’un nom de branche douteux, d’une adresse trop longue', () => {
  const base = { depot: 'a/b', branche: 'livraison/x', titre: 'T' };
  assert.throws(() => lien.construireLien(Object.assign({}, base, { titre: '  ' })), /titre/);
  ['x?quick_pull=1', 'a b', '../main', '-x', 'x&y', 'a#b', ''].forEach(b =>
    assert.throws(() => lien.construireLien(Object.assign({}, base, { branche: b })), /refusé/, b));
  assert.throws(() => lien.construireLien(Object.assign({}, base, { corps: 'é'.repeat(2000) })), /trop long/);
  assert.ok(lien.construireLien(Object.assign({}, base, { corps: 'x'.repeat(3000) })).length <= lien.LONGUEUR_MAX);
});
test('lien : la description dit clairement si le serveur et les pages changent', () => {
  const o = { nbFichiers: 3, empreinteServeur: 'abc123abc123', date: '12/11/2026' };
  const rien = lien.construireCorps(Object.assign({ serveurChange: false, pagesChangent: false }, o));
  assert.ok(/Serveur\*\* : inchangé \(rien à faire dans Apps Script\)/.test(rien) && /Pages de l’appli\*\* : inchangées/.test(rien));
  const tout = lien.construireCorps(Object.assign({ serveurChange: true, pagesChangent: true, versionAppli: '6.1', texte: 'Lot 7', procedure: 'docs/lot7-procedure.md' }, o));
  assert.ok(/`Code.gs` MODIFIÉ, à mettre dans Apps Script avant de fusionner — empreinte `abc123abc123`/.test(tout));
  assert.ok(/version 6\.1 dans « À propos »/.test(tout) && /`docs\/lot7-procedure\.md`/.test(tout) && /^Lot 7\n/.test(tout));
});
test('lien : l’empreinte ne dépend pas des fins de ligne ; les pages sont bien reconnues', () => {
  assert.strictEqual(lien.empreinte('a\r\nb\r\n'), lien.empreinte('a\nb\n'));
  assert.notStrictEqual(lien.empreinte('a\nb\n'), lien.empreinte('a\nc\n'));
  ['index.html', 'sw.js', 'manifest.json', 'commun/api.js', 'modeles/quitus.js', 'logo.png'].forEach(f => assert.ok(lien.estPage(f), f));
  ['docs/x.md', 'outils/essai.js', 'apps-script/Api.gs', 'A-COLLER-DANS-APPS-SCRIPT/Code.gs', 'tests/a.html', 'CHANGELOG.md'].forEach(f => assert.ok(!lien.estPage(f), f));
});
test('lien : la commande refuse une branche absente du PC, sans interroger GitHub', () => {
  let sortie = '';
  try { execFileSync(process.execPath, [RACINE + '/outils/lien-fusion.js', 'branche-qui-n-existe-pas', '--titre', 'x'], { encoding: 'utf8', stdio: 'pipe' }); }
  catch (e) { sortie = String(e.stderr) + e.status; }
  assert.ok(/❌ .*n’existe pas sur ce PC/.test(sortie) && /1$/.test(sortie), sortie);
});

// ══ Copie d'essai : contrôle du dossier ═══════════════════════════════════════════════════════════════════
test('essai : la cible est lue et contrôlée (nom d’organisation mal écrit = refus)', () => {
  const f = TMP + '/cible.json';
  ecrire(f, JSON.stringify({ organisation: 'Loue-Essai', depot: 'chantier-pro' }));
  const c = essai.lireCible(f);
  assert.strictEqual(c.nom, 'Loue-Essai/chantier-pro');
  assert.strictEqual(c.adresseSite, 'https://loue-essai.github.io/chantier-pro/');
  assert.strictEqual(c.adresseGit, 'https://github.com/Loue-Essai/chantier-pro.git');
  [{ organisation: '', depot: 'x' }, { organisation: 'a/b', depot: 'x' }, { organisation: 'a', depot: '..' }, { organisation: 'a b', depot: 'x' }, {}]
    .forEach(o => { ecrire(f, JSON.stringify(o)); assert.throws(() => essai.lireCible(f), /mal écrit/); });
  assert.throws(() => essai.lireCible(TMP + '/absent.json'), /pas encore réglée/);
  [['chantiersloue', 'chantier-pro'], ['ChantiersLoue', 'Chantier-Pro']].forEach(([o, d]) => {
    ecrire(f, JSON.stringify({ organisation: o, depot: d }));
    assert.throws(() => essai.lireCible(f), /dépôt de PRODUCTION/, 'la cible ne peut pas être le dépôt de production');
  });
  assert.strictEqual(essai.adresseNormale('git@github.com:Loue-Essai/Chantier-Pro.git'), essai.adresseNormale('https://github.com/loue-essai/chantier-pro/'));
});
test('essai : dossier absent, mal nommé, dans le dépôt, ou sans Git = refus, et rien n’est effacé', () => {
  assert.throws(() => essai.fabriquer({ racine: PROD, cible: CIBLE, dossier: VOISIN }), /Dossier absent/);
  const autre = TMP + '/monde/autre-dossier'; ecrire(autre + '/precieux.txt', 'x');
  assert.throws(() => essai.fabriquer({ racine: PROD, cible: CIBLE, dossier: autre }), /doit s’appeler/);
  const dedans = PROD + '/chantier-pro-essai'; ecrire(dedans + '/precieux.txt', 'x');
  assert.throws(() => essai.fabriquer({ racine: PROD, cible: CIBLE, dossier: dedans }), /HORS du dépôt/);
  fs.rmSync(dedans, { recursive: true });
  const sansGit = TMP + '/sans-git/chantier-pro-essai'; ecrire(sansGit + '/precieux.txt', 'x');
  assert.throws(() => essai.fabriquer({ racine: PROD, cible: CIBLE, dossier: sansGit }), /pas une copie de travail Git/);
  [autre, sansGit].forEach(d => assert.ok(fs.existsSync(d + '/precieux.txt'), 'fichier intact dans ' + d));
});
test('essai : dossier relié au dépôt de PRODUCTION = refus, et rien n’est effacé', () => {
  const d = TMP + '/relie-prod/chantier-pro-essai';
  execFileSync('git', ['clone', '--quiet', NU_PROD, d]);
  ecrire(d + '/precieux.txt', 'x');
  assert.throws(() => essai.fabriquer({ racine: PROD, cible: CIBLE, dossier: d }), /Dossier refusé : il est relié à « .*chantiersloue\/chantier-pro\.git » et non à « .*org-essai\/chantier-pro\.git »/);
  assert.throws(() => pub.publier({ racine: PROD, cible: CIBLE, dossier: d, sansVerifier: true }), /relié à/);
  assert.ok(fs.existsSync(d + '/precieux.txt') && fs.existsSync(d + '/README.md'));
});
test('essai : sous-dossier d’un autre dépôt = refus', () => {
  const parent = TMP + '/parent';
  execFileSync('git', ['clone', '--quiet', NU_ESSAI, parent]);
  const d = parent + '/chantier-pro-essai'; ecrire(d + '/.git/faux', 'x'); ecrire(d + '/precieux.txt', 'x');
  assert.throws(() => essai.fabriquer({ racine: PROD, cible: CIBLE, dossier: d }), /refusé/);
  assert.ok(fs.existsSync(d + '/precieux.txt'));
});

// ══ Copie d'essai : fabrication et publication ════════════════════════════════════════════════════════════
test('publier --preparer : copie le dépôt d’essai dans le dossier voisin (une fois)', () => {
  const p = pub.preparer({ racine: PROD, cible: CIBLE, dossier: VOISIN, adresseGit: NU_ESSAI });
  assert.strictEqual(p.deja, false);
  assert.ok(fs.existsSync(VOISIN + '/README.md') && fs.existsSync(VOISIN + '/.git'));
  assert.strictEqual(pub.preparer({ racine: PROD, cible: CIBLE, dossier: VOISIN, adresseGit: NU_ESSAI }).deja, true);
});
test('essai : la copie est en mode TEST forcé, sans adresse de production, et .git n’est pas touché', () => {
  const avant = git(VOISIN, 'rev-parse', 'HEAD');
  ecrire(VOISIN + '/vieux-fichier.html', 'reste d’une ancienne copie');
  const r = essai.fabriquer({ racine: PROD, cible: CIBLE, dossier: VOISIN });
  assert.strictEqual(git(VOISIN, 'rev-parse', 'HEAD'), avant, '.git intact');
  assert.ok(!fs.existsSync(VOISIN + '/vieux-fichier.html'), 'l’ancienne copie est vidée');
  const c = fs.readFileSync(VOISIN + '/commun/config.js', 'utf8');
  const prod = /var URL_PRODUCTION = '([^']+)'/.exec(fs.readFileSync(RACINE + '/commun/config.js', 'utf8'))[1];
  assert.ok(prod.length > 60 && c.indexOf(prod) < 0, 'l’adresse de production n’est nulle part dans la copie');
  assert.ok(c.indexOf("var URL_PRODUCTION = '';") > -1 && c.indexOf('var enTest = true;') > -1 && c.indexOf('COPIE D’ESSAI') > -1);
  assert.ok(c.indexOf("ecrire('loue_env'") < 0, '?env=prod ne peut plus changer le mode');
  assert.ok(/var URL_TEST = 'https:\/\/script\.google\.com\//.test(c), 'l’adresse TEST est gardée');
  const m = JSON.parse(fs.readFileSync(VOISIN + '/manifest.json', 'utf8'));
  assert.deepStrictEqual([m.short_name, m.start_url, m.scope, m.id], ['Loué ESSAI', '/chantier-pro/', '/chantier-pro/', '/chantier-pro/']);
  assert.ok(m.icons.length > 0 && !/^\//.test(m.icons[0].src), 'icônes en chemin relatif');
  ['index.html', 'quitus.html'].forEach(f => assert.ok(/<head>\n<meta name="robots" content="noindex, nofollow">/.test(fs.readFileSync(VOISIN + '/' + f, 'utf8')), f));
  assert.ok(fs.existsSync(VOISIN + '/.nojekyll') && /COPIE D’ESSAI/.test(fs.readFileSync(VOISIN + '/README.md', 'utf8')));
  assert.ok(fs.existsSync(VOISIN + '/modeles/quitus.js') && fs.existsSync(VOISIN + '/sw.js') && fs.existsSync(VOISIN + '/icone-192.png'));
  assert.ok(!fs.existsSync(VOISIN + '/apps-script') && !fs.existsSync(VOISIN + '/_prive'), 'ni le serveur ni _prive ne sont copiés');
  assert.strictEqual(r.dossier.replace(/\\/g, '/'), VOISIN);
  assert.strictEqual(git(PROD, 'status', '--porcelain'), '', 'le dépôt de production n’est pas modifié');
});
test('essai : un fichier ignoré par Git (jeton clasp, Thumbs.db) n’est JAMAIS copié ni publié', () => {
  ecrire(PROD + '/.clasprc.json', '{"jeton":"SECRET-DE-TEST"}');
  ecrire(PROD + '/creds-loue.json', '{"cle":"SECRET-DE-TEST"}');
  ecrire(PROD + '/commun/Thumbs.db', 'x');
  try {
    assert.strictEqual(git(PROD, 'status', '--porcelain'), '', 'Git ne voit pas ces fichiers : la garde « modifications non enregistrées » ne suffit pas');
    essai.fabriquer({ racine: PROD, cible: CIBLE, dossier: VOISIN });
    ['.clasprc.json', 'creds-loue.json', 'commun/Thumbs.db', '.gitignore'].forEach(f => assert.ok(!fs.existsSync(VOISIN + '/' + f), f + ' ne doit pas être copié'));
    assert.ok(fs.existsSync(VOISIN + '/commun/config.js') && fs.existsSync(VOISIN + '/manifest.json'));
  } finally { ['.clasprc.json', 'creds-loue.json', 'commun/Thumbs.db'].forEach(f => fs.rmSync(PROD + '/' + f, { force: true })); }
  ['index.html', 'sw.js', 'manifest.json', 'icone-192.png', 'commun/api.js', 'modeles/quitus.js'].forEach(f => assert.ok(essai.estPublie(f), f));
  ['.clasprc.json', 'docs/x.json', 'apps-script/Code.gs', '_prive/a.png', 'outils/essai-cible.json', 'tests/e2e-file.html', 'CHANGELOG.md'].forEach(f => assert.ok(!essai.estPublie(f), f));
});
test('publier : enregistre et pousse dans le dépôt d’essai, jamais ailleurs ; 2e fois = rien à publier', () => {
  const prodAvant = git(NU_PROD, 'rev-parse', 'main');
  const r = pub.publier({ racine: PROD, cible: CIBLE, dossier: VOISIN, sansVerifier: true });
  assert.strictEqual(r.publie, true);
  assert.ok(/^appli \S+ — source main [0-9a-f]{7,}$/.test(r.marque), r.marque);
  assert.strictEqual(git(NU_ESSAI, 'show', 'main:essai-version.txt'), r.marque);
  assert.ok(/var enTest = true;/.test(git(NU_ESSAI, 'show', 'main:commun/config.js')));
  assert.strictEqual(git(NU_ESSAI, 'rev-list', '--count', 'main'), '2', 'un enregistrement de plus, l’historique est gardé');
  assert.ok(/Copie d’essai — appli/.test(git(NU_ESSAI, 'log', '-1', '--format=%s', 'main')));
  assert.strictEqual(git(NU_PROD, 'rev-parse', 'main'), prodAvant, 'le dépôt de production n’a rien reçu');
  assert.strictEqual(pub.publier({ racine: PROD, cible: CIBLE, dossier: VOISIN, sansVerifier: true }).publie, false);
  assert.strictEqual(git(NU_ESSAI, 'rev-list', '--count', 'main'), '2');
});
test('publier : refus si le dépôt a des modifications non enregistrées ; une fabrication non publiée est reprise proprement', () => {
  ecrire(PROD + '/index.html', fs.readFileSync(PROD + '/index.html', 'utf8').replace('<title>Loué</title>', '<title>Loué 2</title>'));
  assert.throws(() => pub.publier({ racine: PROD, cible: CIBLE, dossier: VOISIN, sansVerifier: true }), /ne sont pas enregistrées/);
  git(PROD, 'add', '-A'); git(PROD, 'commit', '--quiet', '-m', 'page modifiée');
  essai.fabriquer({ racine: PROD, cible: CIBLE, dossier: VOISIN });   // fabriquée, pas publiée
  ecrire(VOISIN + '/reste.txt', 'x');
  const r = pub.publier({ racine: PROD, cible: CIBLE, dossier: VOISIN, sansVerifier: true });
  assert.strictEqual(r.publie, true);
  assert.ok(/Loué 2/.test(git(NU_ESSAI, 'show', 'main:index.html')));
  assert.throws(() => git(NU_ESSAI, 'show', 'main:reste.txt'), 'le reste d’une fabrication non publiée ne part pas');
  assert.strictEqual(git(NU_ESSAI, 'rev-list', '--count', 'main'), '3');
});
test('publier : si GitHub a avancé sans nous, on repart de son état ; rien n’est écrasé', () => {
  const autre = TMP + '/autre-clone';
  execFileSync('git', ['clone', '--quiet', NU_ESSAI, autre]);
  ecrire(autre + '/ailleurs.txt', 'x'); git(autre, 'add', '-A');
  git(autre, '-c', 'user.name=t', '-c', 'user.email=t@loue.test', 'commit', '--quiet', '-m', 'ailleurs'); git(autre, 'push', '--quiet', 'origin', 'main');
  // notre dossier a un enregistrement local jamais poussé : l'avance rapide est impossible
  ecrire(VOISIN + '/local.txt', 'x'); git(VOISIN, 'add', '-A');
  git(VOISIN, '-c', 'user.name=t', '-c', 'user.email=t@loue.test', 'commit', '--quiet', '-m', 'local');
  const avant = git(NU_ESSAI, 'rev-parse', 'main'), n = Number(git(NU_ESSAI, 'rev-list', '--count', 'main'));
  const r = pub.publier({ racine: PROD, cible: CIBLE, dossier: VOISIN, sansVerifier: true });
  assert.strictEqual(r.publie, true);
  assert.strictEqual(Number(git(NU_ESSAI, 'rev-list', '--count', 'main')), n + 1, 'un enregistrement de plus');
  git(NU_ESSAI, 'merge-base', '--is-ancestor', avant, 'main');   // lève une erreur si l'état de « GitHub » avait été écrasé
  assert.throws(() => git(NU_ESSAI, 'show', 'main:local.txt'), 'l’enregistrement local jamais poussé ne part pas');
});
test('publier : un envoi refusé par GitHub donne un message clair, et la relance réussit', () => {
  ecrire(PROD + '/index.html', fs.readFileSync(PROD + '/index.html', 'utf8').replace('Loué 2', 'Loué 3'));
  git(PROD, 'add', '-A'); git(PROD, 'commit', '--quiet', '-m', 'page modifiée 3');
  const crochet = NU_ESSAI + '/hooks/pre-receive';
  ecrire(crochet, '#!/bin/sh\necho "refus de test" >&2\nexit 1\n'); fs.chmodSync(crochet, 0o755);
  const avant = git(NU_ESSAI, 'rev-parse', 'main');
  assert.throws(() => pub.publier({ racine: PROD, cible: CIBLE, dossier: VOISIN, sansVerifier: true }), /GitHub a refusé l’envoi.*relancer la commande sans risque.*Remove restrictions/);
  assert.strictEqual(git(NU_ESSAI, 'rev-parse', 'main'), avant);
  fs.rmSync(crochet);
  const r = pub.publier({ racine: PROD, cible: CIBLE, dossier: VOISIN, sansVerifier: true });
  assert.strictEqual(r.publie, true, 'la relance n’est pas bloquée par l’envoi raté');
  assert.ok(/Loué 3/.test(git(NU_ESSAI, 'show', 'main:index.html')));
});
test('essai : adresse d’ENVOI réglée vers un autre dépôt = refus (rien ne part ailleurs)', () => {
  git(VOISIN, 'remote', 'set-url', '--push', 'origin', NU_PROD);
  const prodAvant = git(NU_PROD, 'rev-parse', 'main');
  try {
    assert.throws(() => pub.publier({ racine: PROD, cible: CIBLE, dossier: VOISIN, sansVerifier: true }), /Dossier refusé : il est relié à/);
    assert.throws(() => essai.fabriquer({ racine: PROD, cible: CIBLE, dossier: VOISIN }), /Dossier refusé : il est relié à/);
  } finally { git(VOISIN, 'config', '--unset', 'remote.origin.pushurl'); }
  assert.strictEqual(git(NU_PROD, 'rev-parse', 'main'), prodAvant);
  essai.controlerDossier(VOISIN, CIBLE, PROD);   // de nouveau accepté
});
test('essai : cible = le dépôt d’où l’on fabrique (la production) = refus, même avec un dossier voisin « correct »', () => {
  const monde = TMP + '/monde2', prod = monde + '/chantier-pro', voisin = monde + '/chantier-pro-essai';
  execFileSync('git', ['clone', '--quiet', NU_PROD, prod]);
  execFileSync('git', ['clone', '--quiet', NU_PROD, voisin]);
  ecrire(voisin + '/precieux.txt', 'x');
  const cibleProd = Object.assign({}, CIBLE, { nom: 'x/y', adresseGit: NU_PROD });
  assert.throws(() => essai.fabriquer({ racine: prod, cible: cibleProd, dossier: voisin }), /cible de la copie d’essai est le dépôt de PRODUCTION/);
  assert.throws(() => pub.publier({ racine: prod, cible: cibleProd, dossier: voisin, sansVerifier: true }), /dépôt de PRODUCTION/);
  assert.ok(fs.existsSync(voisin + '/precieux.txt') && fs.existsSync(voisin + '/README.md'), 'rien n’est effacé');
  // et par son nom, quelle que soit l'adresse du dépôt d'où l'on fabrique
  const parNom = Object.assign({}, CIBLE, { adresseGit: 'git@github.com:ChantiersLoue/Chantier-Pro.git' });
  assert.throws(() => essai.controlerDossier(VOISIN, parNom, PROD), /dépôt de PRODUCTION/);
});

// ══ Lien pré-rempli : la commande entière, dans un faux dépôt (aucun appel à GitHub) ══════════════════════
function fauxDepotLien() {
  const nu = TMP + '/lien/nu.git', r = TMP + '/lien/chantier-pro';
  fs.mkdirSync(nu, { recursive: true });
  execFileSync('git', ['init', '--quiet', '--bare', '--initial-branch=main', nu]);
  ecrire(r + '/A-COLLER-DANS-APPS-SCRIPT/Code.gs', '// serveur v1\n');
  ecrire(r + '/commun/config.js', "var VERSION_APPLI = '6.0.1';\n");
  ecrire(r + '/index.html', '<html></html>\n');
  ecrire(r + '/docs/lot7-procedure.md', '# procédure\n');
  execFileSync('git', ['init', '--quiet', '--initial-branch=main', r]);
  git(r, 'config', 'user.name', 'Essai'); git(r, 'config', 'user.email', 'essai@loue.test'); git(r, 'config', 'core.autocrlf', 'false');
  // l'adresse affichée est celle de GitHub ; les échanges vont en réalité vers le dépôt nu local
  git(r, 'remote', 'add', 'origin', 'https://github.com/chantiersloue/chantier-pro.git');
  git(r, 'config', 'url.' + nu + '.insteadOf', 'https://github.com/chantiersloue/chantier-pro.git');
  git(r, 'add', '-A'); git(r, 'commit', '--quiet', '-m', 'départ'); git(r, 'push', '--quiet', 'origin', 'main');
  return r;
}
const LIEN = fauxDepotLien();
function demander(args) {   // lance la commande sans rien afficher ; rend le lien ou lève l'erreur
  const log = console.log; console.log = () => {};
  try { return lien.principal(args, { racine: LIEN, sansVerifier: true }); } finally { console.log = log; }
}
test('lien (commande) : branche de documents seuls → lien donné, « serveur inchangé », « pages inchangées »', () => {
  git(LIEN, 'checkout', '--quiet', '-b', 'livraison/docs');
  ecrire(LIEN + '/docs/note.md', 'été\n'); git(LIEN, 'add', '-A'); git(LIEN, 'commit', '--quiet', '-m', 'docs');
  assert.throws(() => demander(['livraison/docs', '--titre', 'Docs']), /n’est pas sur GitHub/);
  git(LIEN, 'push', '--quiet', 'origin', 'livraison/docs');
  const u = new URL(demander(['livraison/docs', '--titre', 'Outillage — documents', '--texte', 'Ligne 1\nLigne 2', '--procedure', 'docs/lot7-procedure.md']));
  assert.strictEqual(u.pathname, '/chantiersloue/chantier-pro/compare/main...livraison/docs');
  const corps = u.searchParams.get('body');
  assert.ok(/^Ligne 1\nLigne 2\n\n\*\*Fichiers modifiés\*\* : 1\n/.test(corps), corps);
  assert.ok(/Serveur\*\* : inchangé/.test(corps) && /Pages de l’appli\*\* : inchangées/.test(corps) && /`docs\/lot7-procedure\.md`/.test(corps), corps);
  assert.ok(corps.indexOf('empreinte `' + lien.empreinte('// serveur v1\n') + '`') > -1, 'empreinte du serveur qui sera dans main');
});
test('lien (commande) : serveur et pages modifiés → la description le dit, avec la nouvelle version', () => {
  git(LIEN, 'checkout', '--quiet', '-b', 'livraison/lot-7', 'main');
  ecrire(LIEN + '/A-COLLER-DANS-APPS-SCRIPT/Code.gs', '// serveur v2\n');
  ecrire(LIEN + '/commun/config.js', "var VERSION_APPLI = '7.0';\n");
  git(LIEN, 'add', '-A'); git(LIEN, 'commit', '--quiet', '-m', 'lot 7'); git(LIEN, 'push', '--quiet', 'origin', 'livraison/lot-7');
  const corps = new URL(demander(['livraison/lot-7', '--titre', 'Lot 7'])).searchParams.get('body');
  assert.ok(/`Code.gs` MODIFIÉ, à mettre dans Apps Script avant de fusionner/.test(corps) && /version 7\.0 dans « À propos »/.test(corps), corps);
  assert.ok(corps.indexOf(lien.empreinte('// serveur v2\n')) > -1);
});
test('lien (commande) : refus si la branche du PC a avancé, si des modifications traînent, si on n’est pas dessus', () => {
  ecrire(LIEN + '/index.html', '<html>x</html>\n');
  assert.throws(() => demander(['livraison/lot-7', '--titre', 'Lot 7']), /ne sont pas enregistrées/);
  git(LIEN, 'add', '-A'); git(LIEN, 'commit', '--quiet', '-m', 'suite');
  assert.throws(() => demander(['livraison/lot-7', '--titre', 'Lot 7']), /sont différentes : pousser d’abord/);
  git(LIEN, 'push', '--quiet', 'origin', 'livraison/lot-7');
  git(LIEN, 'checkout', '--quiet', 'livraison/docs');
  assert.throws(() => demander(['livraison/lot-7', '--titre', 'Lot 7']), /Se placer d’abord sur la branche/);
  assert.throws(() => demander(['main', '--titre', 'x']), /ne peut pas être main/);
});
test('lien (commande) : main a avancé sans la branche (même sans conflit) → refus, il faut d’abord amener main', () => {
  // un correctif du serveur entre dans main ; la branche de documents ne l'a pas
  git(LIEN, 'checkout', '--quiet', 'main');
  ecrire(LIEN + '/A-COLLER-DANS-APPS-SCRIPT/Code.gs', '// serveur v1 corrigé\n');
  git(LIEN, 'add', '-A'); git(LIEN, 'commit', '--quiet', '-m', 'correctif'); git(LIEN, 'push', '--quiet', 'origin', 'main');
  git(LIEN, 'checkout', '--quiet', 'livraison/docs');
  assert.throws(() => demander(['livraison/docs', '--titre', 'Docs']), /main a avancé.*amener main dans la branche/);
  git(LIEN, 'merge', '--quiet', '--no-edit', 'origin/main'); git(LIEN, 'push', '--quiet', 'origin', 'livraison/docs');
  const corps = new URL(demander(['livraison/docs', '--titre', 'Docs'])).searchParams.get('body');
  assert.ok(/Serveur\*\* : inchangé/.test(corps) && corps.indexOf(lien.empreinte('// serveur v1 corrigé\n')) > -1, 'l’empreinte annoncée est celle du serveur de main');
  // une fois fusionnée, plus rien à demander
  git(LIEN, 'checkout', '--quiet', 'main'); git(LIEN, 'merge', '--quiet', '--ff-only', 'livraison/docs'); git(LIEN, 'push', '--quiet', 'origin', 'main');
  git(LIEN, 'checkout', '--quiet', 'livraison/docs');
  assert.throws(() => demander(['livraison/docs', '--titre', 'Docs']), /Rien à fusionner/);
});
test('lien (commande) : une option sans valeur est refusée clairement', () => {
  assert.throws(() => lien.lireArguments(['b', '--titre', '--texte', 'x']), /Il manque la valeur de --titre/);
  assert.throws(() => lien.lireArguments(['b', '--titre']), /Il manque la valeur de --titre/);
  assert.throws(() => lien.lireArguments(['b', '--force']), /Option inconnue/);
  assert.throws(() => lien.lireArguments(['a', 'b']), /Un seul nom de branche/);
});
test('publier : l’attente de publication reconnaît la bonne version et abandonne sinon', async () => {
  let n = 0; const vues = [];
  const ok = await pub.attendrePublication('https://x.test/c/', 'appli 6.1 — source main abc1234',
    { pasMs: 1, lire: async u => { vues.push(u); return ++n < 3 ? 'appli 6.0 — source main 0000000\n' : 'appli 6.1 — source main abc1234\n'; } });
  assert.strictEqual(ok, true); assert.strictEqual(n, 3);
  assert.ok(/^https:\/\/x\.test\/c\/essai-version\.txt\?t=\d+$/.test(vues[0]), 'cache de GitHub contourné');
  assert.strictEqual(await pub.attendrePublication('https://x.test/c/', 'jamais', { pasMs: 1, maxMs: 20, lire: async () => { throw new Error('réseau'); } }), false);
});
test('dépôt : plus de dossier essai/ ; les nouveaux outils passent le contrôle de syntaxe', () => {
  assert.ok(!fs.existsSync(RACINE + '/essai'), 'le dossier essai/ ne doit plus exister dans le dépôt de production');
  ['lien-fusion.js', 'essai.js', 'publier-essai.js'].forEach(f => execFileSync(process.execPath, ['--check', RACINE + '/outils/' + f]));
});

(async () => {
  for (const t of attente) await t();
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  console.log('\n' + reussis + ' test(s) réussi(s)' + (process.exitCode ? ' — DES TESTS ÉCHOUENT' : ''));
})();
