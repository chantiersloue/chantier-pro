// Lot 8 — page « Note de réunion » dans un VRAI Chrome, en largeur téléphone (375 px) puis en largeur PC :
//   node tests/lot8-page.test.js
// Demande playwright-cli (npm i -g @playwright/cli) et Python sur le PC ; sinon le test est sauté.
// Lance lui-même le site (http://127.0.0.1:8793) et le faux serveur (8794) : jamais la copie TEST, jamais la production.
//  8a : annotation qu'on peut rouvrir (tracer, gommer un trait sans toucher la photo, valider, rouvrir, modifier, poids),
//       brouillon (ancien brouillon restauré, photo annotée gardée avec ses traits, pas de faux « brouillon retrouvé »).
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { spawn, spawnSync } = require('child_process');

const racine = path.join(__dirname, '..');
const outil = spawnSync('playwright-cli', ['--version'], { shell: true, encoding: 'utf8' });
const python = spawnSync('python', ['--version'], { shell: true, encoding: 'utf8' });
if (outil.status !== 0 || python.status !== 0) { console.log('Lot 8, page : playwright-cli ou Python absent, test sauté'); process.exit(0); }

const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'loue-l8-'));
// Photos d'essai fabriquées ici : une image grise unie (on y lit la couleur d'un point), et une image de « bruit »
// (la plus lourde qui soit une fois en JPEG : elle met la limite de poids à l'épreuve)
function png(w, h, bruit) {
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = b => { let c = 0xFFFFFFFF; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const bloc = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([Buffer.from(t), d]))); return Buffer.concat([l, Buffer.from(t), d, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  let graine = 12345;
  const hasard = () => { graine = (graine * 1103515245 + 12345) & 0x7fffffff; return graine >> 16 & 255; };
  const lignes = Array.from({ length: h }, () => { const l = Buffer.alloc(1 + 3 * w, 120); l[0] = 0; if (bruit) for (let i = 1; i < l.length; i++) l[i] = hasard(); return l; });
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), bloc('IHDR', ihdr),
    bloc('IDAT', zlib.deflateSync(Buffer.concat(lignes), { level: 1 })), bloc('IEND', Buffer.alloc(0))]);
}
const PHOTO = path.join(dossier, 'photo.png'), BRUIT = path.join(dossier, 'bruit.png');
fs.writeFileSync(PHOTO, png(800, 600, false));
fs.writeFileSync(BRUIT, png(1600, 1200, true));

const SITE = 'http://127.0.0.1:8793/', SERVEUR = 'http://127.0.0.1:8794', API = SERVEUR + '/exec';
const site = spawn('python', ['-m', 'http.server', '8793', '--bind', '127.0.0.1', '--directory', racine], { stdio: 'ignore' });
let faux = spawn('node', [path.join(__dirname, 'faux-serveur.js'), '8794'], { stdio: 'ignore' });

// Début commun à tous les scénarios : outils pour dessiner, lire un point de l'image, vider le téléphone
const DEBUT = `async page => {
  const BASE = ${JSON.stringify(SITE)}, SERVEUR = ${JSON.stringify(SERVEUR)}, q = 'api=${API}&sw=1';
  const PHOTO = ${JSON.stringify(PHOTO.replace(/\\/g, '/'))}, BRUIT = ${JSON.stringify(BRUIT.replace(/\\/g, '/'))};
  const NOTE = BASE + 'note-reunion.html?' + q + '&chantier=CHANTIER%20TEST%201';
  const ctx = page.context(), r = {};
  // Les questions « confirm » de la page reçoivent toujours « oui » (une fenêtre de question arrêterait le scénario)
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.addInitScript(() => { window.confirm = () => true; });
  const file = () => page.evaluate(() => LOUE.stockage.tout('file').then(l => l.length));
  const attendreFileVide = async n => { for (let i = 0; i < (n || 60); i++) { await page.waitForTimeout(500); if (!(await file())) return true; } return false; };
  const message = () => page.evaluate(() => (document.getElementById('loue-message') || {}).textContent || '');
  const etatServeur = () => page.evaluate(u => fetch(u + '/etat').then(x => x.json()), SERVEUR);
  const reglage = m => page.evaluate(u => fetch(u).then(x => x.text()), SERVEUR + '/reglage?mode=' + m);
  const bandeau = async () => { const b = await page.$('.loue-brouillon:not(.loue-maj)'); return b ? (await b.textContent()) : ''; };
  // Le téléphone remis à neuf : ni fiche en attente, ni brouillon (courant ou mis de côté)
  const toutVider = async () => {
    await page.goto(BASE + 'index.html?' + q); await page.waitForTimeout(1200);
    await page.evaluate(async () => {
      for (const e of await LOUE.stockage.tout('file')) await LOUE.abandonner(e.id);
      Object.keys(localStorage).filter(k => /brouillon/.test(k)).forEach(k => localStorage.removeItem(k));
      await LOUE.stockage.supprimer('brouillons', 'brouillon_note'); await LOUE.stockage.supprimer('brouillons', 'brouillon_note_mis_de_cote');
    });
  };
  const ouvrirNote = async () => { await page.goto(NOTE); await page.waitForTimeout(2500); };
  const restaurer = async () => { const b = await page.$('.loue-brouillon [data-oui]'); if (b) { await b.click(); await page.waitForTimeout(1800); } return !!b; };
  const boite = () => page.evaluate(() => { const c = document.getElementById('annot-canvas'), b = c.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height, W: c.width, H: c.height }; });
  // Un trait : points donnés en fractions de la photo (0 à 1)
  const trait = async pts => { const b = await boite();
    await page.mouse.move(b.x + pts[0][0] * b.w, b.y + pts[0][1] * b.h); await page.mouse.down();
    for (const p of pts.slice(1)) await page.mouse.move(b.x + p[0] * b.w, b.y + p[1] * b.h);
    await page.mouse.up(); await page.waitForTimeout(120); };
  const ligne = (x0, y0, x1, y1, n) => Array.from({ length: (n || 10) + 1 }, (_, i) => [x0 + (x1 - x0) * i / (n || 10), y0 + (y1 - y0) * i / (n || 10)]);
  const choisir = o => page.click('.annot-outil[data-outil="' + o + '"]');
  const ouvrir = async i => { await page.evaluate(k => ouvrirAnnotation(k), i || 0); await page.waitForTimeout(800); };
  const valider = async () => { await page.evaluate(() => fermerAnnotation(true)); await page.waitForTimeout(1200); };
  // Couleur d'un point de l'image finale (ou de l'origine) de la photo i
  const point = (quoi, fx, fy, i) => page.evaluate(async a => { const p = photos[a[3] || 0], bmp = await createImageBitmap(a[0] === 'origine' ? p.origine : p.blob);
    const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height; const x = c.getContext('2d'); x.drawImage(bmp, 0, 0);
    return Array.from(x.getImageData(Math.round(a[1] * bmp.width), Math.round(a[2] * bmp.height), 1, 1).data).slice(0, 3); }, [quoi, fx, fy, i]);
  const etatPhoto = i => page.evaluate(k => { const p = photos[k || 0]; if (!p) return null;
    return { annotee: p.annotee, anciens: !!p.anciens, traits: p.traits ? p.traits.length : null, outils: p.traits ? p.traits.map(f => f.o).join('') : '',
      origine: p.origine ? p.origine.size : 0, poids: p.blob.size, car: p.traits ? JSON.stringify(p.traits).length : 0,
      entiers: p.traits ? p.traits.every(f => f.p.every(Number.isInteger)) : null, points: p.traits ? p.traits.map(f => f.p.length / 2) : [], legende: p.label }; }, i);
  await page.setViewportSize({ width: 375, height: 812 });
  await ctx.setOffline(false);
  await page.goto(BASE + 'index.html?' + q);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => 1));
  await page.reload(); await page.waitForTimeout(1500);
  await page.evaluate(() => { if (LOUE.deconnecter) LOUE.deconnecter(); });
  await toutVider();
`;

// ── 8a : annotation et brouillon ──
function scenarioAnnotation() {
  return DEBUT + `
  // 0. Page ouverte et pas touchée : aucun brouillon n'est proposé à l'ouverture suivante
  await ouvrirNote(); await page.waitForTimeout(5000);
  await ouvrirNote();
  r.fauxBrouillon = await bandeau();
  r.largeur375 = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

  // 1. Une photo, un trait rouge au milieu, « Valider »
  await page.setInputFiles('#photo-galerie', PHOTO); await page.waitForTimeout(2500);
  r.photoSeule = await etatPhoto();
  await ouvrir();
  r.boite = await boite();
  r.boutons = await page.evaluate(() => Array.from(document.querySelectorAll('#annot button')).map(b => b.getBoundingClientRect()).every(b => b.width >= 48 && b.height >= 48));
  await trait(ligne(0.2, 0.5, 0.8, 0.5));
  await valider();
  r.unTrait = await etatPhoto();
  r.rougeFinal = await point('final', 0.5, 0.5); r.grisOrigine = await point('origine', 0.5, 0.5);
  r.toileRendue = await page.evaluate(() => document.getElementById('annot').hidden && document.getElementById('annot-canvas').width === 1);

  // 2. Rouvrir : le trait est retrouvé. Un long tracé en zigzag (300 points) et 18 traits de plus : poids des traits mesuré
  await ouvrir();
  r.formesRouvertes = await page.evaluate(() => ANNOT.formes.length);
  await trait(Array.from({ length: 301 }, (_, i) => [0.05 + 0.9 * i / 300, 0.8 + 0.08 * Math.sin(i / 12)]));
  for (let k = 0; k < 6; k++) { await choisir('fleche'); await trait(ligne(0.05 + k * 0.15, 0.05, 0.12 + k * 0.15, 0.15, 4)); }
  for (let k = 0; k < 6; k++) { await choisir('rect'); await trait(ligne(0.05 + k * 0.15, 0.18, 0.15 + k * 0.15, 0.26, 4)); }
  await choisir('stylo');
  for (let k = 0; k < 6; k++) await trait(ligne(0.05 + k * 0.15, 0.3, 0.15 + k * 0.15, 0.36, 12));
  await valider();
  r.charge = await etatPhoto();
  await page.evaluate(() => BROUILLON.sauverMaintenant()); await page.waitForTimeout(800);
  r.brouillonCar = await page.evaluate(() => (localStorage.getItem('loue_brouillon_' + LOUE_CONFIG.env + '_note') || '').length);

  // 3. Rouvrir, gommer le premier trait en son milieu : le trait disparaît là, la photo dessous est intacte
  await ouvrir(); await choisir('gomme');
  await trait(ligne(0.5, 0.42, 0.5, 0.58));
  await valider();
  r.gomme = await etatPhoto();
  r.milieuGomme = await point('final', 0.5, 0.5); r.resteRouge = await point('final', 0.3, 0.5);

  // 4. « Valider » sans rien changer : l'image n'est pas refaite (aucune recompression)
  await page.evaluate(() => { window.__image = photos[0].blob; window.__origine = photos[0].origine; });
  await ouvrir(); await valider();
  r.memeImage = await page.evaluate(() => photos[0].blob === window.__image && photos[0].origine === window.__origine);

  // 5. Le téléphone n'arrive pas à fabriquer l'image (mémoire) : rien n'est changé, l'annotation reste ouverte
  await ouvrir(); await choisir('stylo'); await trait(ligne(0.2, 0.65, 0.8, 0.65));
  await page.evaluate(() => { window.__toBlob = HTMLCanvasElement.prototype.toBlob; HTMLCanvasElement.prototype.toBlob = function (cb) { cb(null); }; });
  await valider();
  r.echec = await page.evaluate(() => ({ ouverte: !document.getElementById('annot').hidden, memeImage: photos[0].blob === window.__image, traits: photos[0].traits.length,
    message: (document.getElementById('loue-message') || {}).textContent || '' }));
  await page.evaluate(() => { HTMLCanvasElement.prototype.toBlob = window.__toBlob; fermerAnnotation(false); }); await page.waitForTimeout(500);
  r.apresEchec = await etatPhoto();

  // 6. Brouillon : la page est fermée puis rouverte, la photo revient avec ses traits, encore modifiables
  await page.fill('#meta-objet', 'Réunion essai'); await page.fill('.photo-legende', 'Façade nord');
  await page.evaluate(() => BROUILLON.sauverMaintenant()); await page.waitForTimeout(1000);
  await ouvrirNote();
  r.bandeauBrouillon = await bandeau();
  await restaurer();
  r.restaure = Object.assign(await etatPhoto(), { objet: await page.inputValue('#meta-objet'), photos: await page.evaluate(() => photos.length) });
  r.resteRougeRestaure = await point('final', 0.3, 0.5);
  await ouvrir(); await choisir('gomme'); await trait(ligne(0.3, 0.42, 0.3, 0.58)); await valider();
  r.gommeApresBrouillon = await point('final', 0.3, 0.5);
  r.apresBrouillon = await etatPhoto();

  // 7. Copie de secours du brouillon (texte seul) plus récente que la copie complète : l'image finale est refaite depuis l'origine
  await page.evaluate(() => BROUILLON.sauverMaintenant()); await page.waitForTimeout(800);
  await page.goto(BASE + 'index.html?' + q); await page.waitForTimeout(1200);
  await page.evaluate(async () => {
    const cle = 'loue_brouillon_' + LOUE_CONFIG.env + '_note', local = JSON.parse(localStorage.getItem(cle));
    const base = await LOUE.stockage.lire('brouillons', 'brouillon_note');
    // la copie complète revient à l'état « un seul trait » ; la copie de secours, plus récente, garde tous les traits
    window.__attendu = local.extra.photos[0].traits.length;
    base.extra.photos[0].traits = base.extra.photos[0].traits.slice(0, 1); base.extra.photos[0].blob = base.extra.photos[0].origine.blob; base.t -= 5000;
    await LOUE.stockage.ecrire('brouillons', base);
    local.t += 5000; localStorage.setItem(cle, JSON.stringify(local));
    sessionStorage.setItem('attendu', String(window.__attendu));
  });
  await ouvrirNote(); await restaurer(); await page.waitForTimeout(2500);
  r.secours = Object.assign(await etatPhoto(), { attendu: Number(await page.evaluate(() => sessionStorage.getItem('attendu'))) });
  r.secoursTraitRefait = await point('final', 0.7, 0.5);   // le trait rouge (non gommé à cet endroit) est de nouveau dans l'image finale

  // 8. Tout annuler : la photo redevient la photo d'origine, telle quelle
  await ouvrir();
  for (let k = 0; k < 40; k++) await page.evaluate(() => annulerTrait());
  await page.waitForTimeout(300); await valider();
  r.toutAnnule = await etatPhoto();
  r.grisRevenu = await point('final', 0.7, 0.5);

  // 9. Photo très lourde (bruit) : jamais au-dessus de la limite du serveur, avant comme après annotation
  await page.setInputFiles('#photo-galerie', BRUIT); await page.waitForTimeout(6000);
  r.lourde = await etatPhoto(1);
  r.messageLourde = await message();
  if (r.lourde) { await ouvrir(1); await trait(ligne(0.2, 0.5, 0.8, 0.5)); await valider(); await page.waitForTimeout(2500);
    r.lourdeAnnotee = await etatPhoto(1); r.lourdeOuverte = await page.evaluate(() => !document.getElementById('annot').hidden);
    if (r.lourdeOuverte) { await page.evaluate(() => fermerAnnotation(false)); await page.waitForTimeout(400); } }

  // 10. ANCIEN brouillon (page d'avant le lot 8) : texte, destinataire, photo annotée sans traits gardés
  await toutVider();
  await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 300; const x = c.getContext('2d');
    x.fillStyle = '#787878'; x.fillRect(0, 0, 400, 300); x.strokeStyle = '#E53E3E'; x.lineWidth = 12; x.beginPath(); x.moveTo(40, 150); x.lineTo(360, 150); x.stroke();
    const blob = await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.85));
    const e = { cle: 'brouillon_note', t: Date.now() - 60000, champs: { 'meta-chantier': { v: 'CHANTIER TEST 1' }, 'meta-auteur': { v: 'Ancien Rédacteur' },
      'meta-objet': { v: 'Ancienne page' }, 'meta-commentaires': { v: 'Texte de l’ancienne page' } },
      extra: { destinataires: ['archi@ext.test'], photos: [{ id: 'photo-ancienne-000001', blob: blob, label: 'Ancienne légende', annotee: true }] } };
    localStorage.setItem('loue_brouillon_' + LOUE_CONFIG.env + '_note', JSON.stringify(e, (k, v) => v instanceof Blob ? null : v));
    await LOUE.stockage.ecrire('brouillons', e);
  });
  await ouvrirNote();
  r.ancienBandeau = await bandeau();
  await restaurer();
  r.ancien = Object.assign(await etatPhoto(), { objet: await page.inputValue('#meta-objet'), texte: await page.inputValue('#meta-commentaires'),
    auteur: await page.inputValue('#meta-auteur'), dest: await page.evaluate(() => DEST.liste().join(',')), photos: await page.evaluate(() => photos.length) });
  await ouvrir();
  r.ancienMessage = await message();
  await page.click('.annot-couleur[data-couleur="#1454A0"]'); await trait(ligne(0.2, 0.25, 0.8, 0.25)); await valider();
  r.ancienAnnote = await etatPhoto();
  r.ancienRouge = await point('final', 0.5, 0.5); r.ancienBleu = await point('final', 0.5, 0.25);
  await ouvrir(); await page.evaluate(() => annulerTrait()); await page.waitForTimeout(200); await valider();
  r.ancienSansNouveau = await etatPhoto();
  r.ancienRougeGarde = await point('final', 0.5, 0.5);

  // 11. Largeur PC : l'annotation tient dans la fenêtre, on y dessine
  await page.setViewportSize({ width: 1280, height: 800 });
  await ouvrir(); r.pcBoite = await boite();
  await trait(ligne(0.2, 0.75, 0.8, 0.75)); await valider();
  r.pc = await etatPhoto();
  r.pcLargeur = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  await page.setViewportSize({ width: 375, height: 812 });

  // 12. Envoi : la note part avec sa photo annotée ; ensuite, plus aucun brouillon n'est proposé
  await page.evaluate(() => envoyer());
  r.envoyee = await attendreFileVide();
  await page.waitForTimeout(800);
  r.messageEnvoi = await message();
  const e1 = await etatServeur();
  r.envois = e1.envois.slice(1).map(l => [l[2], l[4]].join(':'));
  r.photosEnAttente = await page.evaluate(() => LOUE.stockage.tout('photos').then(l => l.length));
  await page.waitForTimeout(4500);
  await ouvrirNote();
  r.bandeauApresEnvoi = await bandeau();

  // 13. Réseau lent (6 s par réponse) : une note avec une photo annotée finit par partir
  await page.fill('#meta-auteur', 'Rédacteur Lent');
  await page.setInputFiles('#photo-galerie', PHOTO); await page.waitForTimeout(2500);
  await ouvrir(); await trait(ligne(0.2, 0.5, 0.8, 0.5)); await valider();
  await reglage('lent');
  await page.evaluate(() => envoyer());
  r.lent = await attendreFileVide(120);
  await reglage('normal');
  const e2 = await etatServeur();
  r.envoisLent = e2.envois.slice(1).map(l => [l[2], l[4]].join(':'));
  return JSON.stringify(r);
}`;
}

function lancer(nom, texte) {
  const f = path.join(dossier, 'scenario-' + nom + '.js');
  fs.writeFileSync(f, texte);
  spawnSync('playwright-cli', ['-s=loue-l8', 'close'], { shell: true });
  spawnSync('playwright-cli', ['-s=loue-l8', 'open', '--browser=chrome', '--mobile', 'about:blank'], { shell: true, encoding: 'utf8' });
  const sortie = spawnSync('playwright-cli', ['-s=loue-l8'].concat(process.env.LOUE_DEBUG ? [] : ['--raw'], ['run-code', '--filename=' + f]), { shell: true, encoding: 'utf8', timeout: 600000 });
  // Pour comprendre un échec : LOUE_DEBUG=<fichier> garde la sortie brute du navigateur
  if (process.env.LOUE_DEBUG) fs.writeFileSync(process.env.LOUE_DEBUG + '-' + nom + '.json', JSON.stringify({ status: sortie.status, out: sortie.stdout, err: sortie.stderr }, null, 1));
  // --raw renvoie la valeur du scénario encodée en JSON (une chaîne qui contient elle-même du JSON)
  const ligne = (sortie.stdout || '').split(/\r?\n/).map(l => l.trim()).filter(l => /^"\{/.test(l)).pop();
  if (!ligne) throw new Error('scénario « ' + nom + ' » sans résultat : ' + (sortie.stdout || sortie.stderr || '').slice(0, 600));
  return JSON.parse(JSON.parse(ligne));
}

let reussis = 0, echecs = 0;
function verifier(nom, cond, detail) {
  if (cond) { reussis++; console.log('  ✓ ' + nom); } else { echecs++; console.log('  ✗ ' + nom + '\n    ' + detail); }
}
const j = x => JSON.stringify(x);
const rouge = c => c && c[0] > 180 && c[1] < 110 && c[2] < 110;
const gris = c => c && Math.abs(c[0] - 120) < 25 && Math.abs(c[1] - 120) < 25 && Math.abs(c[2] - 120) < 25;
const bleu = c => c && c[2] > 120 && c[0] < 90;
const LIMITE = 1.5 * 1024 * 1024;

function partieAnnotation() {
  console.log('Lot 8a — annotation des photos qu’on peut rouvrir (vrai Chrome, 375 px)');
  const a = lancer('annotation', scenarioAnnotation());
  verifier('page ouverte et pas touchée : aucun « Brouillon retrouvé », pas de défilement horizontal à 375 px', a.fauxBrouillon === '' && a.largeur375 === true, j([a.fauxBrouillon, a.largeur375]));
  verifier('l’annotation se fait à la résolution de la photo (toile de 800 × 600 pour une photo de 800 × 600), boutons de 48 px au moins',
    a.boite.W === 800 && a.boite.H === 600 && a.boite.w <= 375 && a.boutons === true, j([a.boite, a.boutons]));
  verifier('un trait validé : image finale avec le trait, photo d’origine gardée intacte, trait gardé à part',
    a.photoSeule.annotee === false && a.photoSeule.traits === null && a.unTrait.annotee === true && a.unTrait.traits === 1 && a.unTrait.origine === a.photoSeule.poids
    && rouge(a.rougeFinal) && gris(a.grisOrigine), j([a.photoSeule, a.unTrait, a.rougeFinal, a.grisOrigine]));
  verifier('après « Valider », la grande toile rend sa mémoire (1 × 1)', a.toileRendue === true, j(a.toileRendue));
  verifier('rouvrir : le trait est retrouvé ; 20 traits en tout sont gardés un par un', a.formesRouvertes === 1 && a.charge.traits === 20 && a.charge.outils === 's' + 's' + 'ffffff' + 'rrrrrr' + 'ssssss', j(a.charge));
  verifier('poids des traits maîtrisé : coordonnées entières, zigzag de 301 points élagué, 20 traits en moins de 6 000 caractères (mesuré : '
    + a.charge.car + ' ; zigzag : ' + a.charge.points[1] + ' points ; copie texte du brouillon : ' + a.brouillonCar + ' caractères)',
    a.charge.entiers === true && a.charge.points[1] < 150 && a.charge.points[1] >= 20 && a.charge.car < 6000 && a.brouillonCar < 12000, j([a.charge, a.brouillonCar]));
  verifier('la gomme efface le trait, pas la photo : le gris de la photo revient sous la gomme, le reste du trait est intact',
    gris(a.milieuGomme) && rouge(a.resteRouge) && a.gomme.traits === 21 && /g$/.test(a.gomme.outils) && a.gomme.origine === a.unTrait.origine, j([a.milieuGomme, a.resteRouge, a.gomme]));
  verifier('« Valider » sans changement : l’image n’est pas refaite (pas de recompression en chaîne)', a.memeImage === true, j(a.memeImage));
  verifier('échec de fabrication de l’image (mémoire) : message clair, annotation restée ouverte, photo et traits d’avant gardés',
    a.echec.ouverte === true && a.echec.memeImage === true && a.echec.traits === 21 && /Annotation impossible/.test(a.echec.message) && a.apresEchec.traits === 21, j([a.echec, a.apresEchec]));
  verifier('brouillon : la photo annotée revient avec sa légende, son origine et ses 21 traits',
    /Brouillon retrouvé/.test(a.bandeauBrouillon) && a.restaure.photos === 1 && a.restaure.traits === 21 && a.restaure.origine === a.unTrait.origine && a.restaure.annotee === true
    && a.restaure.objet === 'Réunion essai' && a.restaure.legende === 'Façade nord' && rouge(a.resteRougeRestaure), j([a.bandeauBrouillon, a.restaure]));
  verifier('… et ses traits se gomment encore après la restauration', gris(a.gommeApresBrouillon) && a.apresBrouillon.traits === 22, j([a.gommeApresBrouillon, a.apresBrouillon]));
  verifier('copie de secours du brouillon plus récente que la copie complète : tous les traits reviennent et l’image finale est refaite depuis l’origine',
    a.secours.traits === a.secours.attendu && a.secours.attendu === 22 && a.secours.origine === a.unTrait.origine && a.secours.poids !== a.secours.origine && rouge(a.secoursTraitRefait), j([a.secours, a.secoursTraitRefait]));
  verifier('tous les traits annulés : la photo redevient la photo d’origine, octet pour octet (même poids), plus « annotée »',
    a.toutAnnule.annotee === false && a.toutAnnule.traits === null && a.toutAnnule.poids === a.unTrait.origine && gris(a.grisRevenu), j([a.toutAnnule, a.grisRevenu]));
  verifier('photo la plus lourde possible (bruit, 1 600 px) : sous la limite du serveur (1,5 Mo) avant et après annotation, ou refusée avec un message (mesuré : '
    + (a.lourde ? Math.round(a.lourde.poids / 1024) + ' Ko, annotée ' + (a.lourdeAnnotee ? Math.round(a.lourdeAnnotee.poids / 1024) : '?') + ' Ko' : 'refusée') + ')',
    a.lourde ? a.lourde.poids < LIMITE && a.lourdeAnnotee.poids < LIMITE : /trop lourde/.test(a.messageLourde), j([a.lourde, a.lourdeAnnotee, a.messageLourde]));
  verifier('ANCIEN brouillon (page d’avant le lot 8) restauré tel quel : texte, rédacteur, destinataire, photo annotée et sa légende',
    /Brouillon retrouvé/.test(a.ancienBandeau) && a.ancien.objet === 'Ancienne page' && a.ancien.texte === 'Texte de l’ancienne page' && a.ancien.auteur === 'Ancien Rédacteur'
    && a.ancien.dest === 'archi@ext.test' && a.ancien.photos === 1 && a.ancien.annotee === true && a.ancien.traits === null && a.ancien.legende === 'Ancienne légende', j([a.ancienBandeau, a.ancien]));
  verifier('… photo annotée avant la mise à jour : message « Les anciens traits de cette photo ne s’effacent plus », les nouveaux traits se gardent et s’annulent',
    /anciens traits de cette photo ne s’effacent plus/.test(a.ancienMessage) && a.ancienAnnote.traits === 1 && a.ancienAnnote.anciens === true && rouge(a.ancienRouge) && bleu(a.ancienBleu)
    && a.ancienSansNouveau.traits === null && a.ancienSansNouveau.annotee === true && rouge(a.ancienRougeGarde), j([a.ancienMessage, a.ancienAnnote, a.ancienBleu, a.ancienSansNouveau]));
  verifier('largeur PC (1 280 px) : l’annotation tient dans la fenêtre et on y dessine', a.pcBoite.w <= 1280 && a.pcBoite.h <= 800 && a.pcBoite.w > 400 && a.pc.traits === 1 && a.pcLargeur === true, j([a.pcBoite, a.pc]));
  verifier('envoi : la note part avec sa photo annotée, plus rien en attente dans le téléphone', a.envoyee === true && a.envois.join() === 'note:traité' && a.photosEnAttente === 0, j([a.envois, a.messageEnvoi]));
  verifier('après l’envoi : aucun « Brouillon retrouvé » à l’ouverture suivante', a.bandeauApresEnvoi === '', j(a.bandeauApresEnvoi));
  verifier('réseau lent (6 s par réponse) : la note et sa photo annotée finissent par partir', a.lent === true && a.envoisLent.join() === 'note:traité,note:traité', j(a.envoisLent));
  return a;
}

setTimeout(() => {
  try {
    partieAnnotation();
  } catch (e) { echecs++; console.log('  ✗ ' + e.message); }
  spawnSync('playwright-cli', ['-s=loue-l8', 'close'], { shell: true });
  site.kill(); faux.kill();
  fs.rmSync(dossier, { recursive: true, force: true });
  console.log(reussis + ' test(s) réussi(s)' + (echecs ? ' — DES TESTS ÉCHOUENT' : ''));
  if (echecs) process.exitCode = 1;
}, 2500);
