// Lot 4 — page « Carnet » (plans en pages-images) dans un VRAI Chrome, en largeur téléphone : node tests/lot4-page.test.js
// Demande playwright-cli (npm i -g @playwright/cli), Python, Pillow et pypdfium2 sur le PC ; sinon le test est sauté.
// La chaîne entière est jouée : un PDF fabriqué ici est déposé par le VRAI programme (outils/depot_carnet.py) dans un faux
// « Drive de l'appli » (dossier temporaire), que le faux serveur (vrai code Apps Script) sert à la vraie page.
// Lance lui-même le site (http://127.0.0.1:8787) et le faux serveur (8788) : jamais la copie TEST, jamais la production.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const racine = path.join(__dirname, '..');
const outil = spawnSync('playwright-cli', ['--version'], { shell: true, encoding: 'utf8' });
const modules = spawnSync('python', ['-c', 'import pypdfium2, PIL'], { encoding: 'utf8' });
if (outil.status !== 0 || modules.status !== 0) { console.log('Lot 4, page : playwright-cli, Python, Pillow ou pypdfium2 absent, test sauté'); process.exit(0); }

const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'loue-l4-'));
// ── Le faux Drive de l'appli, rempli par le vrai programme de dépôt ──
const drive = path.join(dossier, 'drive');
fs.mkdirSync(path.join(drive, 'CHANTIER TEST 1'), { recursive: true });
fs.writeFileSync(path.join(drive, 'dossiers.json'), JSON.stringify({ version: 1, documents: { carnet: 'CARNET' } }));
const fabrique = [
  'import sys',
  'from PIL import Image, ImageDraw',
  'def page(l, h, texte):',
  '    im = Image.new("RGB", (l, h), "white"); d = ImageDraw.Draw(im)',
  '    for x in range(0, l, 100): d.line([(x, 0), (x, h)], fill=(120, 140, 200), width=2)',
  '    for y in range(0, h, 100): d.line([(0, y), (l, y)], fill=(200, 120, 120), width=2)',
  '    d.rectangle([40, 40, 400, 160], fill=(26, 43, 74)); d.text((60, 80), texte, fill="white")',
  '    return im',
  'page(2000, 1400, "GRAND PLAN").save(sys.argv[1], "PDF", resolution=72, save_all=True, append_images=[page(595, 842, "PAGE 2")])',
  'page(595, 842, "PPSPS").save(sys.argv[2], "PDF", resolution=72)',
].join('\n');
const plan = path.join(dossier, 'plan.pdf'), texte = path.join(dossier, 'ppsps.pdf');
const f1 = spawnSync('python', ['-c', fabrique, plan, texte], { encoding: 'utf8' });
if (f1.status !== 0) { console.log('  ✗ PDF d’essai non fabriqué : ' + f1.stderr); process.exit(1); }
function deposer(pdf, code, indice, intitule, ou) {
  const r = spawnSync('python', [path.join(racine, 'outils', 'depot_carnet.py'), '--racine', ou || drive, '--dossier', 'CHANTIER TEST 1', '--pdf', pdf, '--code', code, '--indice', indice, '--intitule', intitule],
    { encoding: 'utf8', cwd: racine, env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8' }) });
  if (r.status !== 0) throw new Error('dépôt ' + code + ' ' + indice + ' : ' + (r.stdout || '') + (r.stderr || ''));
}
// Second état du Drive (joué plus tard) : le 105-A REDÉPOSÉ avec un autre PDF sous le même identifiant, et le PPSPS passé à l'indice B
const drive2 = path.join(dossier, 'drive2');
fs.mkdirSync(path.join(drive2, 'CHANTIER TEST 1'), { recursive: true });
fs.writeFileSync(path.join(drive2, 'dossiers.json'), JSON.stringify({ version: 1, documents: { carnet: 'CARNET' } }));
try {
  deposer(plan, '105', 'A', 'PLANS DE RESERVATIONS'); deposer(texte, '001', 'A', 'PPSPS');
  deposer(texte, '105', 'A', 'PLANS DE RESERVATIONS', drive2); deposer(texte, '001', 'A', 'PPSPS', drive2); deposer(texte, '001', 'B', 'PPSPS', drive2);
}
catch (e) { console.log('  ✗ ' + e.message); fs.rmSync(dossier, { recursive: true, force: true }); process.exit(1); }

const SITE = 'http://127.0.0.1:8787/', SERVEUR = 'http://127.0.0.1:8788', API = SERVEUR + '/exec';
const site = spawn('python', ['-m', 'http.server', '8787', '--bind', '127.0.0.1', '--directory', racine], { stdio: 'ignore' });
const faux = spawn('node', [path.join(__dirname, 'faux-serveur.js'), '8788'], { stdio: 'ignore', env: Object.assign({}, process.env, { LOUE_RACINE_ESSAI: drive, LOUE_RACINE_ESSAI_2: drive2 }) });

function scenario() {
  return `async page => {
  const BASE = ${JSON.stringify(SITE)}, SERVEUR = ${JSON.stringify(SERVEUR)}, q = 'api=${API}&sw=1', MDP = 'Essai-' + '2026';
  const CARNET = BASE + 'carnet.html?' + q + '&chantier=CHANTIER%20TEST%201';
  const ctx = page.context(), r = {};
  const connecter = id => page.evaluate(a => { LOUE.deconnecter(); return LOUE.connexion(a[0], a[1]).then(x => x.code); }, [id, MDP]);
  const reglage = m => page.evaluate(u => fetch(u).then(x => x.text()), SERVEUR + '/reglage?mode=' + m);
  const liste = () => page.evaluate(() => ({
    docs: Array.from(document.querySelectorAll('#docs .doc')).map(b => ({ id: b.dataset.doc, texte: b.textContent, h: b.getBoundingClientRect().height })),
    visible: getComputedStyle(document.getElementById('docs')).display !== 'none',
    info: document.getElementById('info').textContent, entete: document.getElementById('entete').textContent, place: document.getElementById('place').textContent,
    largeur: document.documentElement.scrollWidth <= innerWidth }));
  const vue = () => page.evaluate(() => {
    const ims = Array.from(document.querySelectorAll('#monde div img')), fond = document.getElementById('vue-apercu');
    const s = document.getElementById('scene').getBoundingClientRect();
    return { ouverte: getComputedStyle(document.getElementById('vue')).display !== 'none', titre: document.getElementById('vue-titre').textContent, page: document.getElementById('vue-page').textContent,
      apercu: V.apercu, fondCharge: !!fond && fond.naturalWidth > 0, fondLargeur: fond ? fond.naturalWidth : 0,
      tuiles: ims.length, tuilesChargees: ims.filter(i => i.naturalWidth > 0).length, niveaux: Array.from(new Set(ims.map(i => i.parentNode.dataset.z))).sort(),
      // une tuile est à sa place si son coin haut-gauche (dans le plan) est un multiple de sa taille, et si elle touche l'écran
      // chaque tuile est posée sur un multiple de sa taille dans le plan, et occupe à l'écran sa taille × le grossissement
      malPlacees: ims.filter(i => { const z = Number(i.parentNode.dataset.z), cote = 512 * Math.pow(2, z), t = i.dataset.t.split(',').map(Number), b = i.getBoundingClientRect();
        const l = parseFloat(i.style.width), h = parseFloat(i.style.height);
        const bon = parseFloat(i.style.left) === t[0] * cote && parseFloat(i.style.top) === t[1] * cote && l > 0 && l <= cote && h > 0 && h <= cote
          && i.naturalWidth * Math.pow(2, z) === l && i.naturalHeight * Math.pow(2, z) === h
          && (V.r !== 0 || (Math.abs(b.width - l * V.s) < 1 && Math.abs(b.height - h * V.s) < 1));
        return !bon; }).length,
      aLEcran: ims.filter(i => { const b = i.getBoundingClientRect(); return b.right > s.left && b.left < s.right && b.bottom > s.top && b.top < s.bottom; }).length,
      transform: document.getElementById('monde').style.transform, r: V.r, s: V.s,
      centre: versPlan(s.width / 2, s.height / 2).map(Math.round), info: document.getElementById('vue-info').hidden ? '' : document.getElementById('vue-info').textContent,
      boutons: Array.from(document.querySelectorAll('#vue .vue-btn')).every(b => b.getBoundingClientRect().width >= 48 && b.getBoundingClientRect().height >= 48),
      piedDansEcran: document.querySelector('.vue-pied').getBoundingClientRect().bottom <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth,
      avant: document.getElementById('vue-avant').disabled, apres: document.getElementById('vue-apres').disabled };
  });
  const demandes = [];
  page.on('request', q2 => { if (q2.method() === 'POST' && q2.url().indexOf('/exec') > -1) { try { const c = JSON.parse(q2.postData() || '{}'); if (/^carnet/.test(c.action)) demandes.push(c.action + ':' + (c.quoi || '') + ':' + ((c.tuiles || []).length)); } catch (e) {} } });
  const attendre = async (cond, max) => { for (let i = 0; i < (max || 40); i++) { if (await page.evaluate(cond)) return true; await page.waitForTimeout(250); } return false; };
  const ouvrir = async id => { await page.evaluate(d => document.querySelector('#docs .doc[data-doc="' + d + '"]').click(), id); await attendre(() => V.apercu === 'net' || !document.getElementById('vue-info').hidden && /pas de réseau/i.test(document.getElementById('vue-info').textContent)); await page.waitForTimeout(600); };
  const zoomerSur = async (x, y, fois) => { for (let i = 0; i < fois; i++) await page.evaluate(a => zoomerAutour(2, a[0], a[1]), [x, y]); await page.waitForTimeout(400);
    await attendre(() => Array.from(document.querySelectorAll('#monde div img')).length > 0 && Object.keys(V.tuiles).every(k => V.tuiles[k] !== 'demandée'), 60); await page.waitForTimeout(300); };

  await ctx.setOffline(false);
  await page.goto(BASE + 'index.html?' + q);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => 1));
  await page.reload(); await page.waitForTimeout(1500);
  r.connexion = await connecter('poseur1');
  await page.reload(); await page.waitForTimeout(1500);
  r.tuile = await page.evaluate(() => { const t = document.getElementById('tuile-carnet'); return { existe: !!t, texte: t ? t.textContent.replace(/\\s+/g, ' ').trim() : '' }; });

  // 1. La liste
  await page.goto(CARNET); await attendre(() => document.querySelectorAll('#docs .doc').length > 0);
  r.liste = await liste();
  // 2. Ouverture du grand plan : aperçu, pas de tuile tant que la page entière est à l'écran
  await ouvrir('105-A');
  r.ouvert = await vue(); r.demandesOuverture = demandes.slice();
  // 3. Zoom : les tuiles de la zone regardée arrivent
  await zoomerSur(120, 200, 3);
  r.zoom = await vue(); r.demandesZoom = demandes.slice(r.demandesOuverture.length);
  // 4. Rotation : le point au centre de l'écran y reste
  await page.evaluate(() => tourner()); await page.waitForTimeout(1500);
  r.tourne = await vue();
  await page.evaluate(() => { tourner(); tourner(); tourner(); }); await page.waitForTimeout(800);
  r.retourne = await vue();
  // 5. Un doigt déplace le plan (vrais événements de pointeur)
  const avantGlisse = await vue();
  await page.evaluate(() => { const s = document.getElementById('scene'), b = s.getBoundingClientRect();
    const ev = (t, x, y) => s.dispatchEvent(new PointerEvent(t, { pointerId: 7, pointerType: 'touch', clientX: b.left + x, clientY: b.top + y, bubbles: true }));
    ev('pointerdown', 200, 300); ev('pointermove', 180, 280); ev('pointermove', 140, 240); ev('pointerup', 140, 240); });
  await page.waitForTimeout(300);
  r.glisse = { avant: avantGlisse.centre, apres: (await vue()).centre, s: avantGlisse.s };
  // 6. Page suivante (petite page : aperçu seul), puis retour à la liste
  await page.evaluate(() => changerPage(1)); await attendre(() => V.apercu === 'net'); await page.waitForTimeout(400);
  r.page2 = await vue();
  await page.evaluate(() => fermerVue()); await page.waitForTimeout(800);
  r.listeApres = await liste();
  r.occupation = await page.evaluate(() => LOUE.carnet.occupation());

  // 7. HORS RÉSEAU : la liste gardée, le plan déjà ouvert et la zone déjà regardée se relisent ; une zone jamais vue le dit
  await ctx.setOffline(true);
  await page.goto(CARNET); await attendre(() => document.querySelectorAll('#docs .doc').length > 0);
  r.horsReseauListe = await liste();
  await ouvrir('105-A');
  r.horsReseauOuvert = await vue();
  await zoomerSur(120, 200, 3);
  r.horsReseauZoom = await vue();
  await page.evaluate(() => { cadrer(); }); await page.waitForTimeout(300);
  await page.evaluate(() => { for (let i = 0; i < 3; i++) zoomerAutour(2, 330, 420); }); await page.waitForTimeout(2500);
  r.horsReseauAilleurs = await vue();
  await page.evaluate(() => fermerVue()); await page.waitForTimeout(500);
  // un document jamais ouvert, sans réseau
  await page.evaluate(() => document.querySelector('#docs .doc[data-doc="001-A"]').click()); await page.waitForTimeout(2500);
  r.horsReseauJamaisVu = await vue();
  await page.evaluate(() => fermerVue()); await page.waitForTimeout(300);
  await ctx.setOffline(false);

  // 8. « Signaler ici » : chantier et repère déjà remplis
  await page.goto(CARNET); await attendre(() => document.querySelectorAll('#docs .doc').length > 0);
  await ouvrir('105-A');
  await page.evaluate(() => signalerIci()); await page.waitForTimeout(2500);
  r.signaler = await page.evaluate(() => ({ page: location.pathname.split('/').pop(), chantier: (document.getElementById('meta-chantier') || {}).value, repere: (document.getElementById('meta-repere') || {}).value,
    banniere: !!document.querySelector('.brouillon-banniere, #brouillon-banniere') && getComputedStyle(document.querySelector('.brouillon-banniere, #brouillon-banniere')).display !== 'none' }));

  // 9. Carnet PLEIN : le carnet fait son ménage, les images s'affichent quand même, et une fiche est toujours gardée par le téléphone
  await page.goto(CARNET); await attendre(() => document.querySelectorAll('#docs .doc').length > 0);
  // a) presque plein : ouvrir un AUTRE document fait partir les images les plus anciennes du premier
  const occupe = await page.evaluate(() => LOUE.carnet.occupation());
  const avant105 = (await page.evaluate(() => LOUE.carnet.etat('CHANTIER TEST 1', '105-A'))).images;
  await page.evaluate(o => { LOUE.carnet.PLAFOND = o + 2048; }, occupe);
  await ouvrir('001-A');
  const autre = await vue();
  await page.evaluate(() => fermerVue()); await page.waitForTimeout(300);
  r.menage = { plafond: occupe + 2048, occupation: await page.evaluate(() => LOUE.carnet.occupation()), apercu: autre.fondCharge, avant105: avant105,
    apres105: (await page.evaluate(() => LOUE.carnet.etat('CHANTIER TEST 1', '105-A'))).images, garde001: (await page.evaluate(() => LOUE.carnet.etat('CHANTIER TEST 1', '001-A'))).images };
  // b) plus de place du tout : rien n'est gardé, mais tout s'affiche
  await page.evaluate(() => { LOUE.carnet.PLAFOND = 1024; });
  await ouvrir('105-A');
  await zoomerSur(200, 300, 3);
  const plein = await vue();
  r.plein = { tuiles: plein.tuilesChargees, apercu: plein.fondCharge, occupation: await page.evaluate(() => LOUE.carnet.occupation()), pleinLe: await page.evaluate(() => LOUE.carnet.pleinLe > 0) };
  r.fichePendantPlein = await page.evaluate(() => LOUE.stockage.tout('file').then(avant => LOUE.mettreEnFile('note-chantier', { chantier: 'CHANTIER TEST 1', texte: 'Fiche gardée pendant que le carnet est plein' }, [], 'Note')
    .then(() => LOUE.stockage.tout('file')).then(apres => ({ avant: avant.length, apres: apres.length }))).catch(e => ({ erreur: String(e && e.message) })));
  await page.evaluate(() => fermerVue()); await page.waitForTimeout(300);

  // 10. Session expirée du même compte : le carnet gardé reste ; un AUTRE compte sur ce téléphone : tout est effacé
  await page.evaluate(() => { LOUE.carnet.PLAFOND = 400 * 1024 * 1024; });
  await page.goto(CARNET); await attendre(() => document.querySelectorAll('#docs .doc').length > 0);
  await ouvrir('105-A'); await page.evaluate(() => fermerVue()); await page.waitForTimeout(300);
  const avantExpiration = await page.evaluate(() => LOUE.carnet.etat('CHANTIER TEST 1', '105-A'));
  await reglage('deconnecter&id=poseur1');
  await page.evaluate(() => charger()); await page.waitForTimeout(2500);
  r.expiree = { liste: await liste(), compte: await page.evaluate(() => !!LOUE.compte()) };
  await ouvrir('105-A');
  r.expireeOuvert = await vue();
  await page.evaluate(() => fermerVue()); await page.waitForTimeout(300);
  r.reconnexion = await page.evaluate(a => LOUE.connexion(a[0], a[1]).then(x => x.code), ['poseur1', MDP]);
  await page.waitForTimeout(1500);
  r.apresExpiration = { avant: avantExpiration.images, apres: (await page.evaluate(() => LOUE.carnet.etat('CHANTIER TEST 1', '105-A'))).images };
  r.connexion2 = await connecter('poseur2');
  await page.goto(CARNET); await attendre(() => document.querySelectorAll('#docs .doc').length > 0);
  r.autreCompte = { images: (await page.evaluate(() => LOUE.carnet.etat('CHANTIER TEST 1', '105-A'))).images, liste: await liste() };
  // 11. Accès retiré : refus affiché, et ce que ce compte avait gardé de ce chantier est effacé
  await ouvrir('105-A'); await page.evaluate(() => fermerVue()); await page.waitForTimeout(300);
  const avantRefus = (await page.evaluate(() => LOUE.carnet.etat('CHANTIER TEST 1', '105-A'))).images;
  await reglage('acces&id=poseur2&valeur=0');
  await page.evaluate(() => charger()); await page.waitForTimeout(2500);
  r.refus = { avant: avantRefus, apres: (await page.evaluate(() => LOUE.carnet.etat('CHANTIER TEST 1', '105-A'))).images, liste: await liste() };
  await reglage('acces&id=poseur2&valeur=1');
  // ── Lot 4b : « Tout télécharger » (compte poseur2, rien de gardé pour l'instant) ──
  await page.goto(CARNET); await attendre(() => document.querySelectorAll('#docs .doc').length > 0);
  const boutons = () => page.evaluate(() => ({ dl: Array.from(document.querySelectorAll('#docs .dl')).map(t => ({ id: t.dataset.dl, texte: t.textContent, h: t.getBoundingClientRect().height, inactif: t.disabled })),
    tout: { visible: getComputedStyle(document.getElementById('dl-tout')).display !== 'none', texte: document.getElementById('dl-tout').textContent },
    auto: getComputedStyle(document.getElementById('auto-wifi')).display !== 'none', info: document.getElementById('info').textContent, enCours: !!TELE }));
  const bilan = id => page.evaluate(d => LOUE.carnet.bilan('CHANTIER TEST 1', DOCS.filter(x => x.id === d)[0]), id);
  const finTele = () => attendre(() => !TELE, 240);
  r.b_avant = await boutons();
  // a) un document seul
  let debutDemandes = demandes.length;
  await page.evaluate(() => document.querySelector('#docs .dl[data-dl="001-A"]').click()); await finTele(); await page.waitForTimeout(400);
  r.b_un = { bilan: await bilan('001-A'), boutons: await boutons(), liste: await liste(), demandes: demandes.slice(debutDemandes) };
  // b) le chantier entier, arrêté en route (serveur lent), puis repris
  await reglage('lent');
  await page.evaluate(() => toutTelecharger()); await page.waitForTimeout(1500);
  r.b_enCours = await boutons();
  await page.evaluate(() => charger()); await page.waitForTimeout(300);
  r.b_actualiser = (await boutons()).info;
  await page.evaluate(() => toutTelecharger());   // second appui = arrêter
  await finTele(); await page.waitForTimeout(400);
  r.b_arrete = { bilan: await bilan('105-A'), boutons: await boutons() };
  await reglage('normal');
  debutDemandes = demandes.length;
  await page.evaluate(() => document.querySelector('#docs .dl[data-dl="105-A"]').click()); await finTele(); await page.waitForTimeout(400);
  r.b_repris = { bilan: await bilan('105-A'), boutons: await boutons(), liste: await liste(), demandes: demandes.slice(debutDemandes) };
  // c) HORS RÉSEAU : une zone jamais regardée s'affiche, à tous les grossissements
  await ctx.setOffline(true);
  await page.goto(CARNET); await attendre(() => document.querySelectorAll('#docs .doc').length > 0);
  await ouvrir('105-A');
  await zoomerSur(330, 420, 3);
  const loin = await vue();
  await page.evaluate(() => { cadrer(); for (let i = 0; i < 2; i++) zoomerAutour(2, 60, 500); }); await page.waitForTimeout(2500);
  r.b_horsReseau = { loin: loin, ailleurs: await vue(), liste: null };
  await page.evaluate(() => fermerVue()); await page.waitForTimeout(300);
  r.b_horsReseau.liste = await liste();
  await ctx.setOffline(false);
  // d) le téléphone a fait du ménage dans un document complet : « plus disponible en entier »
  await page.evaluate(() => new Promise((ok, ko) => { const q = indexedDB.open('loue_carnet_' + LOUE.env); q.onsuccess = () => { const db = q.result, tx = db.transaction(['index', 'octets'], 'readwrite');
    const g = tx.objectStore('index').getAllKeys(); g.onsuccess = () => { const k = g.result.filter(x => x.indexOf('|105-A|1|z0:') > -1)[0]; tx.objectStore('index').delete(k); tx.objectStore('octets').delete(k); };
    tx.oncomplete = () => { db.close(); ok(); }; tx.onerror = ko; }; q.onerror = ko; }));
  await page.goto(CARNET); await attendre(() => document.querySelectorAll('#docs .doc').length > 0);
  r.b_perdu = { liste: await liste(), boutons: await boutons() };
  // e) carnet plein pendant un téléchargement : il s'arrête, le dit, et une fiche est toujours gardée
  //    Le PPSPS (001-A) est complet ; le plan 105-A ne l'est plus. Le carnet n'a pas la place du reste : refus AVANT de
  //    commencer, et le document complet n'est pas touché (deux documents ne se chassent pas l'un l'autre).
  const occupeAvant = await page.evaluate(() => LOUE.carnet.occupation());
  await page.evaluate(o => { LOUE.carnet.PLAFOND = o + 100; }, occupeAvant);
  await page.evaluate(() => document.querySelector('#docs .dl[data-dl="105-A"]').click()); await finTele(); await page.waitForTimeout(400);
  r.b_plein = { boutons: await boutons(), bilan: await bilan('105-A'), autre: await bilan('001-A'), occupeAvant: occupeAvant, occupeApres: await page.evaluate(() => LOUE.carnet.occupation()) };
  r.b_fichePlein = await page.evaluate(() => LOUE.stockage.tout('file').then(avant => LOUE.mettreEnFile('note-chantier', { chantier: 'CHANTIER TEST 1', texte: 'Fiche gardée pendant un téléchargement arrêté par manque de place' }, [], 'Note')
    .then(() => LOUE.stockage.tout('file')).then(apres => apres.length - avant.length)).catch(e => String(e && e.message)));
  await page.evaluate(async () => { LOUE.carnet.PLAFOND = 400 * 1024 * 1024; for (const e of await LOUE.stockage.tout('file')) await LOUE.abandonner(e.id); });
  // f) Wi-Fi (Android) : case décochée → rien ne part ; case cochée → le document incomplet se télécharge tout seul
  await page.evaluate(() => { Object.defineProperty(navigator, 'connection', { value: { type: 'wifi', saveData: false }, configurable: true }); LOUE.carnet.reglerAuto(false); });
  await page.evaluate(() => charger()); await page.waitForTimeout(2500);
  r.b_wifiNon = await boutons();
  await page.evaluate(() => { LOUE.carnet.reglerAuto(true); charger(); }); await page.waitForTimeout(1200);
  await finTele(); await page.waitForTimeout(400);
  r.b_wifiOui = { boutons: await boutons(), bilan: await bilan('105-A'), liste: await liste() };
  // g) en données mobiles : rien ne part tout seul
  await page.evaluate(() => { Object.defineProperty(navigator, 'connection', { value: { type: 'cellular', saveData: false }, configurable: true }); });
  r.b_mobile = await page.evaluate(() => ({ wifi: LOUE.carnet.wifi(), sait: LOUE.carnet.saitWifi() }));
  await page.evaluate(() => { delete navigator.connection; });

  // 12. Liste absente du Drive (en cours d'arrivée), redépôt sous le même identifiant, nouvel indice, compte désactivé
  r.connexion3 = await connecter('poseur1');
  await page.goto(CARNET); await attendre(() => document.querySelectorAll('#docs .doc').length > 0);
  await ouvrir('105-A'); await zoomerSur(120, 200, 3); await page.evaluate(() => fermerVue()); await page.waitForTimeout(300);
  await ouvrir('001-A'); await page.evaluate(() => fermerVue()); await page.waitForTimeout(300);
  const images = id => page.evaluate(d => LOUE.carnet.etat('CHANTIER TEST 1', d).then(e => e.images), id);
  const avant = { a105: await images('105-A'), a001: await images('001-A'), largeur: await page.evaluate(() => DOCS.filter(d => d.id === '105-A')[0].pages[0].l) };
  await reglage('carnet-sans-liste');
  await page.evaluate(() => charger()); await page.waitForTimeout(2500);
  r.sansListe = { liste: await liste(), a105: await images('105-A'), avant: avant.a105 };
  await reglage('carnet-liste');
  await reglage('carnet-introuvable');   // dossier CARNET introuvable : le serveur rend une liste vide
  await page.evaluate(() => charger()); await page.waitForTimeout(2500);
  await page.evaluate(() => charger()); await page.waitForTimeout(2500);   // deux fois de suite : toujours rien d'effacé
  r.introuvable = { liste: await liste(), a105: await images('105-A'), avant: avant.a105 };
  await reglage('carnet-retrouve');
  await reglage('carnet-2');
  await page.evaluate(() => charger()); await page.waitForTimeout(2500);
  r.second = { liste: await liste(), a105: await images('105-A'), a001: await images('001-A'), avant: avant };
  await ouvrir('105-A');
  r.redepose = Object.assign(await vue(), { largeurPlan: await page.evaluate(() => V.desc.l), ancienne: avant.largeur });
  await page.evaluate(() => fermerVue()); await page.waitForTimeout(300);
  await ouvrir('001-A');   // l'ancien indice, gardé dans le téléphone, se rouvre
  r.ancienOuvert = await vue();
  await page.evaluate(() => fermerVue()); await page.waitForTimeout(300);
  await ouvrir('001-B'); await page.evaluate(() => fermerVue()); await page.waitForTimeout(300);
  await page.evaluate(() => charger()); await page.waitForTimeout(2500);
  r.apresNouvelIndice = { liste: await liste(), a001: await images('001-A') };
  await reglage('desactiver&id=poseur1');
  await page.evaluate(() => charger()); await page.waitForTimeout(2500);
  r.desactive = { liste: await liste(), occupation: await page.evaluate(() => LOUE.carnet.occupation()) };
  // 13. Sans compte
  await page.evaluate(() => LOUE.deconnecter()); await page.goto(CARNET); await page.waitForTimeout(1500);
  r.sansCompte = await liste();
  return JSON.stringify(r);
}`;
}

function lancer() {
  const f = path.join(dossier, 'scenario.js');
  fs.writeFileSync(f, scenario());
  spawnSync('playwright-cli', ['-s=loue-l4', 'close'], { shell: true });
  spawnSync('playwright-cli', ['-s=loue-l4', 'open', '--browser=chrome', '--mobile', 'about:blank'], { shell: true, encoding: 'utf8' });
  const sortie = spawnSync('playwright-cli', ['-s=loue-l4'].concat(process.env.LOUE_DEBUG ? [] : ['--raw'], ['run-code', '--filename=' + f]), { shell: true, encoding: 'utf8', timeout: 400000 });
  if (process.env.LOUE_DEBUG) {
    fs.writeFileSync(process.env.LOUE_DEBUG, JSON.stringify({ status: sortie.status, signal: sortie.signal, out: sortie.stdout, err: sortie.stderr }, null, 1));
    fs.copyFileSync(f, process.env.LOUE_DEBUG + '.scenario.js');
  }
  const ligne = (sortie.stdout || '').split(/\r?\n/).map(l => l.trim()).filter(l => /^"\{/.test(l)).pop();
  if (!ligne) throw new Error('scénario sans résultat : ' + String((sortie.error && sortie.error.message) || '') + ' ' + (sortie.stdout || sortie.stderr || '').slice(-900));
  return JSON.parse(JSON.parse(ligne));
}

let reussis = 0, echecs = 0;
function verifier(nom, cond, detail) {
  if (cond) { reussis++; console.log('  ✓ ' + nom); } else { echecs++; console.log('  ✗ ' + nom + '\n    ' + String(detail).slice(0, 1200)); }
}
setTimeout(() => {
  try {
    console.log('Lot 4 — page « Carnet » dans un vrai Chrome, largeur téléphone (service worker actif, faux serveur, vrai programme de dépôt)');
    const r = lancer(), j = x => JSON.stringify(x);
    const proche = (a, b, tol) => Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol;
    verifier('accueil : la tuile « Carnet » existe', r.connexion === 'CONNECTE' && r.tuile.existe && /Carnet/.test(r.tuile.texte), j([r.connexion, r.tuile]));
    verifier('liste : les deux documents déposés, avec indice, pages, poids, « nouveau » et « demande du réseau » ; lignes d’au moins 48 px ; pas de défilement horizontal',
      r.liste.docs.length === 2 && /PLANS DE RESERVATIONS.*indice A.*nouveau/.test(r.liste.docs[0].texte) && /105 · \d\d\/\d\d\/\d{4} · 2 pages · [\d,]+ (Ko|Mo)/.test(r.liste.docs[0].texte)
      && /demande du réseau/.test(r.liste.docs[0].texte) && r.liste.docs.every(d => d.h >= 48) && r.liste.largeur === true && /CHANTIER TEST 1/.test(r.liste.entete), j(r.liste));
    verifier('ouverture : aperçu net affiché, « 1 / 2 », aucune tuile demandée tant que la page entière tient à l’écran ; boutons d’au moins 48 px, tout tient dans l’écran',
      r.ouvert.ouverte && r.ouvert.apercu === 'net' && r.ouvert.fondCharge && r.ouvert.page === '1 / 2' && r.ouvert.tuiles === 0 && r.ouvert.boutons === true && r.ouvert.piedDansEcran === true
      && r.ouvert.avant === true && r.ouvert.apres === false && j(r.demandesOuverture) === j(['carnet::0', 'carnetTuiles:leger:0', 'carnetTuiles:net:0']), j([r.ouvert, r.demandesOuverture]));
    verifier('zoom : les tuiles de la zone regardée arrivent, toutes chargées, chacune à sa place et à sa taille ; peu de demandes',
      r.zoom.tuiles > 0 && r.zoom.tuilesChargees === r.zoom.tuiles && r.zoom.malPlacees === 0 && r.zoom.aLEcran >= Math.min(r.zoom.tuiles, 2) && r.demandesZoom.length >= 1 && r.demandesZoom.length <= 4
      && r.demandesZoom.every(d => /^carnetTuiles:tuiles:[1-8]$/.test(d)), j([r.zoom, r.demandesZoom]));
    verifier('bouton de rotation : le plan tourne d’un quart de tour, le point au centre de l’écran y reste ; quatre appuis ramènent à l’endroit',
      r.tourne.r === 90 && /rotate\(90deg\)/.test(r.tourne.transform) && proche(r.tourne.centre, r.zoom.centre, 3) && r.retourne.r === 0 && proche(r.retourne.centre, r.zoom.centre, 3), j([r.zoom.centre, r.tourne, r.retourne.centre]));
    verifier('un doigt déplace le plan dans le sens du doigt', r.glisse.apres[0] > r.glisse.avant[0] && r.glisse.apres[1] > r.glisse.avant[1]
      && proche([r.glisse.apres[0] - r.glisse.avant[0], r.glisse.apres[1] - r.glisse.avant[1]], [60 / r.glisse.s, 60 / r.glisse.s], 3), j(r.glisse));
    verifier('page suivante : « 2 / 2 », aperçu de la petite page, bouton « suivante » inactif', r.page2.page === '2 / 2' && r.page2.fondCharge && r.page2.apres === true && r.page2.avant === false, j(r.page2));
    verifier('retour à la liste : le document est marqué « déjà ouvert », la place occupée est affichée', /déjà ouvert/.test(r.listeApres.docs[0].texte) && !/nouveau/.test(r.listeApres.docs[0].texte)
      && /nouveau/.test(r.listeApres.docs[1].texte) && r.occupation > 0 && /Plans gardés dans ce téléphone/.test(r.listeApres.place), j([r.listeApres, r.occupation]));
    verifier('HORS RÉSEAU : la liste gardée s’affiche avec sa date', r.horsReseauListe.docs.length === 2 && /Pas de réseau : liste du/.test(r.horsReseauListe.info), j(r.horsReseauListe));
    verifier('HORS RÉSEAU : le plan déjà ouvert se rouvre, la zone déjà regardée est nette', r.horsReseauOuvert.fondCharge && r.horsReseauOuvert.apercu === 'net'
      && r.horsReseauZoom.tuiles > 0 && r.horsReseauZoom.tuilesChargees === r.horsReseauZoom.tuiles, j([r.horsReseauOuvert, r.horsReseauZoom]));
    verifier('HORS RÉSEAU : une zone jamais regardée le dit clairement (l’aperçu reste)', /Pas de réseau : cette zone/.test(r.horsReseauAilleurs.info) && r.horsReseauAilleurs.fondCharge, j(r.horsReseauAilleurs));
    verifier('HORS RÉSEAU : un document jamais ouvert le dit clairement', /pas de réseau/i.test(r.horsReseauJamaisVu.info) && !r.horsReseauJamaisVu.fondCharge, j(r.horsReseauJamaisVu));
    verifier('« Signaler ici » : la page de signalement s’ouvre avec le chantier et le repère (document, indice, page)', r.signaler.page === 'signaler.html' && r.signaler.chantier === 'CHANTIER TEST 1'
      && r.signaler.repere === 'PLANS DE RESERVATIONS indice A, page 1', j(r.signaler));
    verifier('carnet presque plein : ouvrir un autre document efface d’abord les images les plus anciennes ; le carnet reste sous son plafond', r.menage.occupation <= r.menage.plafond && r.menage.apercu === true
      && r.menage.apres105 < r.menage.avant105 && r.menage.garde001 > 0, j(r.menage));
    verifier('carnet PLEIN : plus rien n’est gardé, mais les images s’affichent quand même', r.plein.tuiles > 0 && r.plein.apercu === true && r.plein.pleinLe === true && r.plein.occupation <= r.menage.plafond, j(r.plein));
    verifier('carnet PLEIN : une fiche est quand même gardée par le téléphone', r.fichePendantPlein.apres === r.fichePendantPlein.avant + 1, j(r.fichePendantPlein));
    verifier('session terminée : ce qui est gardé reste lisible, avec « reconnectez-vous » ; au retour du MÊME compte, tout est encore là', r.expiree.compte === false && /Session terminée : reconnectez-vous/.test(r.expiree.liste.info)
      && r.expiree.liste.docs.length === 2 && r.expireeOuvert.fondCharge === true && r.reconnexion === 'CONNECTE' && r.apresExpiration.avant > 0 && r.apresExpiration.apres === r.apresExpiration.avant, j([r.expiree, r.reconnexion, r.apresExpiration]));
    verifier('un AUTRE compte sur le même téléphone : rien de ce que le premier avait gardé', r.connexion2 === 'CONNECTE' && r.autreCompte.images === 0 && /demande du réseau/.test(r.autreCompte.liste.docs[0].texte), j(r.autreCompte));
    verifier('accès au chantier retiré : refus affiché, plans de ce chantier effacés du téléphone', r.refus.avant > 0 && r.refus.apres === 0 && r.refus.liste.visible === false && /ne fait pas partie de vos chantiers/.test(r.refus.liste.info), j(r.refus));
    console.log('  — lot 4b : hors réseau complet —');
    const masse = d => /^carnetTuiles:(leger|net|tuiles):\d+$/.test(d);
    verifier('un bouton « Tout télécharger » par document (poids annoncé, au moins 48 px) et un pour le chantier ; pas de case Wi-Fi quand le téléphone ne sait pas dire s’il est en Wi-Fi',
      r.b_avant.dl.length === 2 && r.b_avant.dl.every(t => /^⬇ Tout télécharger \([\d,]+ (Ko|Mo)\)$/.test(t.texte) && t.h >= 48) && r.b_avant.tout.visible
      && /Tout télécharger pour ce chantier \([\d,]+ (Ko|Mo)\)/.test(r.b_avant.tout.texte) && r.b_avant.auto === false && r.b_avant.enCours === false, j(r.b_avant));
    verifier('un document téléchargé en entier : « disponible sans réseau, en entier », son bouton disparaît, message de fin', r.b_un.bilan.complet === true && r.b_un.bilan.gardees === r.b_un.bilan.total
      && r.b_un.boutons.dl.length === 1 && /disponible sans réseau, en entier/.test(r.b_un.liste.docs.filter(d => d.id === '001-A')[0].texte) && /Téléchargement terminé/.test(r.b_un.boutons.info)
      && r.b_un.demandes.length >= 2 && r.b_un.demandes.every(masse), j(r.b_un));
    verifier('téléchargement du chantier en cours : bouton « Arrêter », les autres boutons attendent, « Actualiser » ne casse rien', r.b_enCours.enCours === true && /Arrêter le téléchargement du chantier/.test(r.b_enCours.tout.texte)
      && r.b_enCours.dl.some(t => /^⏸ Arrêter — \d+ % téléchargé$/.test(t.texte)) && /arrêtez-le pour actualiser/.test(r.b_actualiser), j([r.b_enCours, r.b_actualiser]));
    verifier('arrêt en route : message clair, ce qui est déjà là est gardé, le bouton redevient « Tout télécharger » avec un poids plus petit', /Téléchargement arrêté/.test(r.b_arrete.boutons.info) && r.b_arrete.boutons.enCours === false
      && r.b_arrete.bilan.complet === false && r.b_arrete.bilan.gardees > 0 && r.b_arrete.boutons.dl.length === 1, j(r.b_arrete));
    verifier('reprise : ce qui était déjà gardé n’est pas redemandé, le document finit complet', r.b_repris.bilan.complet === true && r.b_repris.boutons.dl.length === 0 && r.b_repris.boutons.tout.visible === false
      && r.b_repris.demandes.length >= 1 && r.b_repris.demandes.every(masse) && r.b_repris.demandes.filter(d => /:leger:/.test(d)).length === 1, j(r.b_repris.demandes));   // l'aperçu léger de la page 1, déjà gardé, n'est pas redemandé (celui de la page 2, si)
    verifier('HORS RÉSEAU après téléchargement complet : des zones jamais regardées s’affichent nettes, sans message d’absence', r.b_horsReseau.loin.tuiles > 0 && r.b_horsReseau.loin.tuilesChargees === r.b_horsReseau.loin.tuiles
      && r.b_horsReseau.loin.info === '' && r.b_horsReseau.ailleurs.tuiles > 0 && r.b_horsReseau.ailleurs.info === '' && r.b_horsReseau.liste.docs.every(d => /disponible sans réseau, en entier/.test(d.texte)), j(r.b_horsReseau));
    verifier('le téléphone a fait du ménage dans un document complet : « ⚠ plus disponible en entier sans réseau », et le bouton revient', /plus disponible en entier sans réseau/.test(r.b_perdu.liste.docs.filter(d => d.id === '105-A')[0].texte)
      && r.b_perdu.boutons.dl.length === 1 && r.b_perdu.boutons.dl[0].id === '105-A', j(r.b_perdu));
    verifier('pas assez de place pour finir un document : refus AVANT de commencer, avec les poids ; rien n’est effacé, l’autre document reste complet ; une fiche est quand même gardée', /Pas assez de place : il reste [0-9,]+ (Ko|Mo) à télécharger/.test(r.b_plein.boutons.info)
      && /Rien n’a été effacé/.test(r.b_plein.boutons.info) && r.b_plein.bilan.complet === false && r.b_plein.autre.complet === true && r.b_plein.occupeApres === r.b_plein.occupeAvant
      && r.b_plein.boutons.enCours === false && r.b_fichePlein === 1, j([r.b_plein, r.b_fichePlein]));
    verifier('Wi-Fi, case décochée : la case est proposée, rien ne part tout seul', r.b_wifiNon.auto === true && r.b_wifiNon.enCours === false && r.b_wifiNon.dl.length === 1 && !/Wi-Fi/.test(r.b_wifiNon.info), j(r.b_wifiNon));
    verifier('Wi-Fi, case cochée : le document incomplet se télécharge tout seul jusqu’au bout', r.b_wifiOui.bilan.complet === true && r.b_wifiOui.boutons.dl.length === 0 && /Téléchargement terminé/.test(r.b_wifiOui.boutons.info), j(r.b_wifiOui));
    verifier('en données mobiles, le téléphone n’est pas « en Wi-Fi »', r.b_mobile.wifi === false && r.b_mobile.sait === true, j(r.b_mobile));
    console.log('  — suite du lot 4a —');
    verifier('liste absente du Drive (en cours d’arrivée) : le serveur le dit, la liste gardée reste affichée, aucun plan gardé n’est effacé', r.connexion3 === 'CONNECTE' && r.sansListe.avant > 0
      && r.sansListe.a105 === r.sansListe.avant && r.sansListe.liste.docs.length === 2 && /en cours d’arrivée/.test(r.sansListe.liste.info) && !/Pas de réseau/.test(r.sansListe.liste.info), j(r.sansListe));
    verifier('carnet introuvable côté serveur (liste vide), deux fois de suite : la liste gardée reste affichée avec un message, aucun plan n’est effacé', r.introuvable.a105 === r.introuvable.avant
      && r.introuvable.liste.docs.length === 2 && /ne trouve plus le carnet de ce chantier/.test(r.introuvable.liste.info), j(r.introuvable));
    verifier('document REDÉPOSÉ sous le même identifiant : ce que le téléphone en gardait est effacé, le nouveau plan est demandé au serveur', r.second.avant.a105 > 0 && r.second.a105 === 0
      && r.redepose.fondCharge === true && r.redepose.largeurPlan !== r.redepose.ancienne, j([r.second.avant, r.second.a105, r.redepose.largeurPlan, r.redepose.ancienne]));
    verifier('NOUVEL INDICE pas encore ouvert : l’ancien reste lisible, marqué « ANCIEN INDICE — l’indice B est sorti »', r.second.a001 === r.second.avant.a001 && r.second.liste.docs.length === 3
      && r.second.liste.docs.some(d => d.id === '001-A' && /ANCIEN INDICE — l’indice B est sorti/.test(d.texte)) && r.second.liste.docs.some(d => d.id === '001-B' && /nouvel indice/.test(d.texte))
      && r.ancienOuvert.fondCharge === true && /ANCIEN/.test(r.ancienOuvert.titre) && /Nouvel indice : PPSPS/.test(r.second.liste.info), j([r.second.liste, r.second.a001, r.ancienOuvert.titre]));
    verifier('… une fois le nouvel indice ouvert, l’ancien disparaît de la liste et du téléphone', r.apresNouvelIndice.liste.docs.length === 2 && r.apresNouvelIndice.a001 === 0
      && !r.apresNouvelIndice.liste.docs.some(d => d.id === '001-A'), j(r.apresNouvelIndice));
    verifier('compte désactivé : refus affiché (pas « pas de réseau »), tous les plans gardés sont effacés', r.desactive.liste.visible === false && r.desactive.occupation === 0
      && r.desactive.liste.info.length > 0 && !/Pas de réseau/.test(r.desactive.liste.info), j(r.desactive));
    verifier('sans compte : rien n’est affiché, connexion demandée', r.sansCompte.visible === false && /Connectez-vous/.test(r.sansCompte.entete), j(r.sansCompte));
  } catch (e) { echecs++; console.log('  ✗ ' + e.message); }
  spawnSync('playwright-cli', ['-s=loue-l4', 'close'], { shell: true });
  site.kill(); faux.kill();
  fs.rmSync(dossier, { recursive: true, force: true });
  console.log(reussis + ' test(s) réussi(s)' + (echecs ? ' — DES TESTS ÉCHOUENT' : ''));
  if (echecs) process.exitCode = 1;
}, 2500);
