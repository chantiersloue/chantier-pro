// Envoi hors-ligne dans un VRAI Chrome (essai 12 du lot 2) : node tests/hors-ligne.test.js
// Demande playwright-cli (npm i -g @playwright/cli) et Python sur le PC ; sinon le test est sauté.
// Lance lui-même le site (http://127.0.0.1:8781) et le faux serveur (8782), puis vérifie :
//  1. hors-ligne, service worker actif : le quitus avec photo est rangé dans le téléphone (« ⏳ 1 ») ;
//  2. un AUTRE onglet de l'appli garde la mémoire du téléphone occupée (comme un onglet figé par Android) :
//     le bouton n'est plus jamais bloqué sur « Rangement dans le téléphone… » (message clair, texte gardé),
//     et l'écriture qui finit en retard est défaite (pas de fiche en double).
// Avant le correctif 5.1.1 / 6.0.1, le cas 2 laissait le bouton bloqué sans fin : ce test l'aurait attrapé.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { spawn, spawnSync } = require('child_process');

const racine = path.join(__dirname, '..');
const outil = spawnSync('playwright-cli', ['--version'], { shell: true, encoding: 'utf8' });
const python = spawnSync('python', ['--version'], { shell: true, encoding: 'utf8' });
if (outil.status !== 0 || python.status !== 0) { console.log('Hors-ligne : playwright-cli ou Python absent, test sauté'); process.exit(0); }

const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'loue-hl-'));
// Une photo PNG unie (l'appli la recompresse en JPEG comme une vraie photo)
function png(w, h) {
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = b => { let c = 0xFFFFFFFF; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const bloc = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([Buffer.from(t), d]))); return Buffer.concat([l, Buffer.from(t), d, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const ligne = Buffer.alloc(1 + 3 * w, 120); ligne[0] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), bloc('IHDR', ihdr),
    bloc('IDAT', zlib.deflateSync(Buffer.concat(Array.from({ length: h }, () => ligne)))), bloc('IEND', Buffer.alloc(0))]);
}
const PHOTO = path.join(dossier, 'photo.png');
fs.writeFileSync(PHOTO, png(800, 600));

const SITE = 'http://127.0.0.1:8781/', API = 'http://127.0.0.1:8782/exec';
const site = spawn('python', ['-m', 'http.server', '8781', '--bind', '127.0.0.1', '--directory', racine], { stdio: 'ignore' });
const faux = spawn('node', [path.join(__dirname, 'faux-serveur.js'), '8782'], { stdio: 'ignore' });

// Scénario exécuté dans Chrome (playwright-cli run-code)
function scenario(verrou) {
  return `async page => {
  const BASE = ${JSON.stringify(SITE)}, q = 'api=${API}&sw=1', PHOTO = ${JSON.stringify(PHOTO.replace(/\\/g, '/'))};
  const ctx = page.context(), r = {};
  page.on('dialog', d => d.accept().catch(() => {}));
  await ctx.setOffline(false);
  await page.goto(BASE + 'index.html?' + q);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => 1));
  await page.reload(); await page.waitForTimeout(1500);
  await page.evaluate(async () => { for (const e of await LOUE.stockage.tout('file')) await LOUE.abandonner(e.id); });
  const nomBase = await page.evaluate(() => LOUE.env === 'prod' ? 'loue' : 'loue_' + LOUE.env);
  const url = BASE + 'quitus.html?' + q + '&chantier=CHANTIER%20TEST%201';
  await page.goto(url); await page.waitForTimeout(2000);
  let autre = null;
  if (${verrou}) {
    autre = await ctx.newPage();
    await autre.goto(BASE + 'index.html?' + q); await autre.waitForTimeout(1500);
    await autre.evaluate(nom => new Promise(ok => { const o = indexedDB.open(nom, 2); o.onsuccess = () => {
      const tx = o.result.transaction('file', 'readwrite');
      const boucle = () => { if (!window.__liberer) tx.objectStore('file').get('rien').onsuccess = boucle; }; boucle(); ok(); }; }), nomBase);
    await page.bringToFront();
  }
  await ctx.setOffline(true);
  await page.goto(url); await page.waitForTimeout(2500);
  const b = await page.$('.loue-brouillon [data-non]'); if (b) await b.click();
  if (!(await page.inputValue('#meta-chantier'))) await page.fill('#meta-chantier', 'CHANTIER TEST 1');
  await page.fill('#meta-intervenant', 'Client hors ligne');
  await page.fill('#meta-description', 'Essai automatique');
  await page.click('#solde-oui');
  await page.setInputFiles('#photo-galerie', PHOTO); await page.waitForTimeout(1500);
  await page.evaluate(() => { envoyer(); });
  let texte = '';
  for (let i = 0; i < 45; i++) { await page.waitForTimeout(1000); texte = await page.textContent('#btn-envoyer'); if (!/Rangement|Envoi direct/.test(texte)) break; }
  r.bouton = texte.trim();
  r.message = await page.evaluate(() => (document.getElementById('loue-message') || {}).textContent || '');
  r.texteGarde = await page.evaluate(() => Object.keys(localStorage).some(k => /brouillon/.test(k) && /Client hors ligne/.test(localStorage.getItem(k))));
  if (autre) { await autre.evaluate(() => { window.__liberer = true; }); await page.waitForTimeout(3000); await autre.close(); }
  r.fiches = await page.evaluate(() => LOUE.stockage.tout('file').then(l => l.length));
  await ctx.setOffline(false);
  return JSON.stringify(r);
}`;
}
function lancer(verrou) {
  const f = path.join(dossier, 'scenario-' + verrou + '.js');
  fs.writeFileSync(f, scenario(verrou));
  spawnSync('playwright-cli', ['-s=loue-hl', 'close'], { shell: true });
  spawnSync('playwright-cli', ['-s=loue-hl', 'open', '--browser=chrome', '--mobile', 'about:blank'], { shell: true, encoding: 'utf8' });
  const sortie = spawnSync('playwright-cli', ['-s=loue-hl', '--raw', 'run-code', '--filename=' + f], { shell: true, encoding: 'utf8', timeout: 240000 });
  // --raw renvoie la valeur du scénario encodée en JSON (une chaîne qui contient elle-même du JSON)
  const ligne = (sortie.stdout || '').split(/\r?\n/).map(l => l.trim()).filter(l => /^"\{/.test(l)).pop();
  if (!ligne) throw new Error('scénario sans résultat : ' + (sortie.stdout || sortie.stderr || '').slice(0, 300));
  return JSON.parse(JSON.parse(ligne));
}

let reussis = 0, echecs = 0;
function verifier(nom, cond, detail) {
  if (cond) { reussis++; console.log('  ✓ ' + nom); } else { echecs++; console.log('  ✗ ' + nom + '\n    ' + detail); }
}
setTimeout(() => {
  try {
    console.log('Hors-ligne dans un vrai Chrome (service worker actif)');
    const a = lancer(false);
    verifier('mode avion : quitus avec photo rangé dans le téléphone', a.bouton === 'Envoyer le quitus' && a.fiches === 1, JSON.stringify(a));
    const b = lancer(true);
    verifier('mémoire occupée par un autre onglet : bouton libéré, message clair', !/Rangement|Envoi direct/.test(b.bouton) && /n’arrive pas à ranger/.test(b.message), JSON.stringify(b));
    verifier('… le texte de la fiche reste dans le brouillon', b.texteGarde === true, JSON.stringify(b));
    verifier('… l’écriture arrivée en retard est défaite (pas de doublon)', b.fiches === 0, JSON.stringify(b));
  } catch (e) { echecs++; console.log('  ✗ ' + e.message); }
  spawnSync('playwright-cli', ['-s=loue-hl', 'close'], { shell: true });
  site.kill(); faux.kill();
  fs.rmSync(dossier, { recursive: true, force: true });
  console.log(reussis + ' test(s) réussi(s)' + (echecs ? ' — DES TESTS ÉCHOUENT' : ''));
  if (echecs) process.exitCode = 1;
}, 2500);
