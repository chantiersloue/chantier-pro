// Lot 4a — la VRAIE page de la copie d'essai, contre le VRAI serveur de la copie TEST, en « 3G lente » :
//   node tests/reel-lot4-page.js
// (lancé par Claude, après un envoi « --avec-porte », un dépôt dans le chantier d'essai et la publication de la copie d'essai ;
//  ce n'est PAS un test automatique de la série : il parle à Google et à GitHub)
// Le réseau du navigateur est bridé comme le réglage « 3G lente » de Chrome (400 ms d'aller-retour, 50 Ko/s en réception).
// Le compte d'essai « auto-poseur » est connecté par la porte de service ; son jeton n'est jamais affiché, et le fichier
// temporaire qui le contient est supprimé à la fin. Rien n'est écrit sur le serveur ; aucun mail.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const porte = require('../outils/porte.js');
const essai = require('../outils/essai.js');

const CHANTIER = 'CHANTIER TEST AUTO';
const geste = (nom, donnees) => porte.appeler(nom, donnees || null, { maxMs: 150000 });
const s1 = ms => (ms / 1000).toFixed(1).replace('.', ',') + ' s';

(async () => {
  const cible = essai.lireCible();
  const BASE = String(cible.adresse || cible.url || 'https://loue-essai.github.io/chantier-pro/').replace(/\/?$/, '/');
  console.log('Lot 4a — la page de la copie d’essai en « 3G lente », contre la copie TEST (' + new Date().toLocaleString('fr-FR') + ')');
  const etat = await geste('etat');
  if (!etat.ok || etat.data.environnement !== 'TEST') throw new Error('porte ou environnement inattendus');
  await geste('preparerComptes'); await geste('preparerChantier');
  const s = await geste('session', { id: 'auto-poseur' });
  if (!s.ok) throw new Error('session : ' + s.message);
  await geste('traiterComptes');
  await geste('accesChantier', { id: 'auto-poseur', valeur: true });
  const jeton = porte.lireSession().jeton;
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'loue-l4r-'));
  const scenario = `async page => {
  const BASE = ${JSON.stringify(BASE)}, r = {};
  const cdp = await page.context().newCDPSession(page);
  const brider = oui => cdp.send('Network.emulateNetworkConditions', oui ? { offline: false, latency: 400, downloadThroughput: 50 * 1024, uploadThroughput: 50 * 1024 } : { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await cdp.send('Network.enable');
  await page.goto(BASE + 'index.html'); await page.waitForTimeout(1500);
  r.env = await page.evaluate(() => LOUE.env);
  await page.evaluate(a => { LOUE.deconnecter(); LOUE.enregistrerCompte(a[0], { id: 'auto-poseur', nom: 'Essai automatique', role: 'Poseur' }, []); }, [${JSON.stringify(jeton)}]);
  const attendre = async (cond, maxS) => { const d = Date.now(); while (Date.now() - d < maxS * 1000) { if (await page.evaluate(cond)) return Date.now() - d; await page.waitForTimeout(200); } return -1; };
  await brider(true);
  let d = Date.now();
  await page.goto(BASE + 'carnet.html?chantier=' + encodeURIComponent(${JSON.stringify(CHANTIER)}));
  r.pageMs = Date.now() - d;
  r.listeMs = await attendre(() => document.querySelectorAll('#docs .doc').length > 0, 60);
  r.liste = await page.evaluate(() => ({ docs: Array.from(document.querySelectorAll('#docs .doc')).map(b => b.dataset.doc), info: document.getElementById('info').textContent }));
  // le grand plan : page 2 (la plus lourde)
  await page.evaluate(() => { ouvrirDoc('104-B', 2); });
  r.legerMs = await attendre(() => V.apercu === 'leger' || V.apercu === 'net', 90);
  r.netMs = await attendre(() => V.apercu === 'net', 120);
  await page.waitForTimeout(500);
  d = Date.now();
  await page.evaluate(() => { for (let i = 0; i < 4; i++) zoomerAutour(2, 190, 330); });
  await page.waitForTimeout(600);
  r.tuilesMs = await attendre(() => document.querySelectorAll('#monde div img').length > 0 && Object.keys(V.tuiles).every(k => V.tuiles[k] !== 'demandée'), 120);
  r.zoom = await page.evaluate(() => ({ tuiles: document.querySelectorAll('#monde div img').length, chargees: Array.from(document.querySelectorAll('#monde div img')).filter(i => i.naturalWidth > 0).length,
    info: document.getElementById('vue-info').hidden ? '' : document.getElementById('vue-info').textContent, s: V.s }));
  // la même zone une seconde fois : tout vient du téléphone
  await page.evaluate(() => { fermerVue(); }); await page.waitForTimeout(500);
  await page.evaluate(() => { ouvrirDoc('104-B', 2); });
  r.legerGardeMs = await attendre(() => V.apercu === 'net', 30);
  await page.evaluate(() => { for (let i = 0; i < 4; i++) zoomerAutour(2, 190, 330); }); await page.waitForTimeout(600);
  r.tuilesGardeesMs = await attendre(() => document.querySelectorAll('#monde div img').length > 0 && Object.keys(V.tuiles).every(k => V.tuiles[k] !== 'demandée'), 30);
  await brider(false);
  await page.evaluate(() => { fermerVue(); LOUE.deconnecter(); });
  return JSON.stringify(r);
}`;
  const f = path.join(dossier, 'scenario.js');
  fs.writeFileSync(f, scenario);
  let r = null, erreur = '';
  try {
    spawnSync('playwright-cli', ['-s=loue-l4r', 'close'], { shell: true });
    spawnSync('playwright-cli', ['-s=loue-l4r', 'open', '--browser=chrome', '--mobile', 'about:blank'], { shell: true, encoding: 'utf8' });
    const sortie = spawnSync('playwright-cli', ['-s=loue-l4r', '--raw', 'run-code', '--filename=' + f], { shell: true, encoding: 'utf8', timeout: 500000 });
    const ligne = (sortie.stdout || '').split(/\r?\n/).map(l => l.trim()).filter(l => /^"\{/.test(l)).pop();
    if (ligne) r = JSON.parse(JSON.parse(ligne)); else erreur = String(sortie.stdout || sortie.stderr || '').replace(jeton, '…').slice(-600);
  } finally {
    spawnSync('playwright-cli', ['-s=loue-l4r', 'close'], { shell: true });
    fs.rmSync(dossier, { recursive: true, force: true });
    await geste('accesChantier', { id: 'auto-poseur', valeur: false }); await geste('fermerSessions'); await geste('retirerDeclencheurs');
  }
  if (!r) throw new Error('scénario sans résultat : ' + erreur);
  let echecs = 0;
  const verifier = (nom, cond, detail) => { console.log((cond ? '  ✓ ' : '  ✗ ') + nom + (cond ? '' : '\n      ' + JSON.stringify(detail).slice(0, 400))); if (!cond) echecs++; };
  verifier('copie d’essai réglée sur la copie TEST', r.env === 'test', r.env);
  verifier('liste des documents affichée en ' + s1(r.listeMs) + ' après l’ouverture de la page (objectif 8 s ; page chargée en ' + s1(r.pageMs) + ')', r.listeMs >= 0 && r.listeMs <= 8000 && r.liste.docs.indexOf('104-B') > -1, r);
  verifier('grand plan : aperçu léger affiché en ' + s1(r.legerMs) + ' (objectif 10 s), aperçu net ' + s1(Math.max(0, r.netMs)) + ' plus tard', r.legerMs >= 0 && r.legerMs <= 10000 && r.netMs >= 0, r);
  verifier('zoom au niveau le plus fin : ' + r.zoom.tuiles + ' tuiles affichées en ' + s1(r.tuilesMs) + ' (objectif 15 s)', r.tuilesMs >= 0 && r.tuilesMs <= 15000 && r.zoom.tuiles > 0 && r.zoom.chargees === r.zoom.tuiles, r);
  verifier('la même page et la même zone une seconde fois : tout vient du téléphone (' + s1(r.legerGardeMs) + ' et ' + s1(r.tuilesGardeesMs) + ')', r.legerGardeMs >= 0 && r.legerGardeMs < 2000 && r.tuilesGardeesMs >= 0 && r.tuilesGardeesMs < 2000, r);
  console.log(echecs ? echecs + ' point(s) hors objectif' : 'Tous les objectifs « 3G lente » sont tenus');
  if (echecs) process.exitCode = 1;
})().catch(e => { console.error('❌ ' + e.message); process.exit(1); });
