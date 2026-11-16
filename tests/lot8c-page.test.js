// Lot 8c — page « Note de réunion » EN POINTS dans un VRAI Chrome, en largeur téléphone (375 px) puis en largeur PC :
//   node tests/lot8c-page.test.js
// Demande playwright-cli (npm i -g @playwright/cli) et Python sur le PC ; sinon le test est sauté.
// Lance lui-même le site (http://127.0.0.1:8795) et le faux serveur (8796) : jamais la copie TEST, jamais la production.
//  - points repris, clore, compléter, rouvrir, nouveaux points, photos d'un point, aperçu, PDF du (faux) bureau ;
//  - brouillon : seulement les gestes de la personne, pas de faux « Brouillon retrouvé », restauré face à une liste qui a changé ;
//  - hors réseau avec et sans liste gardée, deux notes de suite sans réseau, réponse perdue, réseau lent ;
//  - droits (accès retiré, sans compte), second compte sur le même téléphone, largeur PC ;
//  - NOUVELLE page avec l'ANCIEN serveur, et retour arrière de la page (page de repli : outils/repli-lot8/note-reunion.html).
// Noms, chantiers et adresses : tous fictifs (dépôt public).
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { spawn, spawnSync } = require('child_process');

const racine = path.join(__dirname, '..');
const outil = spawnSync('playwright-cli', ['--version'], { shell: true, encoding: 'utf8' });
const python = spawnSync('python', ['--version'], { shell: true, encoding: 'utf8' });
if (outil.status !== 0 || python.status !== 0) { console.log('Lot 8c, page : playwright-cli ou Python absent, test sauté'); process.exit(0); }

const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'loue-l8c-'));
// Photo d'essai fabriquée ici : une image grise unie
function png(w, h) {
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = b => { let c = 0xFFFFFFFF; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const bloc = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([Buffer.from(t), d]))); return Buffer.concat([l, Buffer.from(t), d, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const lignes = Array.from({ length: h }, () => { const l = Buffer.alloc(1 + 3 * w, 120); l[0] = 0; return l; });
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), bloc('IHDR', ihdr),
    bloc('IDAT', zlib.deflateSync(Buffer.concat(lignes), { level: 1 })), bloc('IEND', Buffer.alloc(0))]);
}
const PHOTO = path.join(dossier, 'photo.png');
fs.writeFileSync(PHOTO, png(800, 600));

const SITE = 'http://127.0.0.1:8795/', SERVEUR = 'http://127.0.0.1:8796', API = SERVEUR + '/exec';
// Le site est servi depuis une COPIE dans le dossier temporaire (la page de repli y est écrite à côté des autres)
const SITE_DIR = path.join(dossier, 'site');
fs.mkdirSync(SITE_DIR);
fs.readdirSync(racine).filter(n => /\.(html|js|json|png)$/.test(n)).forEach(n => fs.copyFileSync(path.join(racine, n), path.join(SITE_DIR, n)));
['commun', 'modeles'].forEach(d => fs.cpSync(path.join(racine, d), path.join(SITE_DIR, d), { recursive: true }));
fs.copyFileSync(path.join(racine, 'outils', 'repli-lot8', 'note-reunion.html'), path.join(SITE_DIR, 'note-reunion-repli.html'));
const site = spawn('python', ['-m', 'http.server', '8795', '--bind', '127.0.0.1', '--directory', SITE_DIR], { stdio: 'ignore' });
let faux = spawn('node', [path.join(__dirname, 'faux-serveur.js'), '8796'], { stdio: 'ignore' });

// Début commun à tous les scénarios
const DEBUT = `async page => {
  const BASE = ${JSON.stringify(SITE)}, SERVEUR = ${JSON.stringify(SERVEUR)}, q = 'api=${API}&sw=1';
  const PHOTO = ${JSON.stringify(PHOTO.replace(/\\/g, '/'))}, MDP = 'Essai-2026';
  const NOTE = BASE + 'note-reunion.html?' + q + '&chantier=CHANTIER%20TEST%201';
  const ctx = page.context(), r = {};
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.addInitScript(() => { window.confirm = () => true; });
  const file = () => page.evaluate(() => LOUE.stockage.tout('file').then(l => l.length));
  const attendreFileVide = async n => { for (let i = 0; i < (n || 60); i++) { await page.waitForTimeout(500); if (!(await file())) return true; } return false; };
  const message = () => page.evaluate(() => (document.getElementById('loue-message') || {}).textContent || '');
  const attendreMessage = async motif => { for (let i = 0; i < 40; i++) { const m = await message(); if (m.indexOf(motif) > -1) return m; await page.waitForTimeout(500); } return await message(); };
  const etatServeur = () => page.evaluate(u => fetch(u + '/etat').then(x => x.json()), SERVEUR);
  const reglage = m => page.evaluate(u => fetch(u).then(x => x.text()), SERVEUR + '/reglage?mode=' + m);
  const bandeau = async () => { const b = await page.$('.loue-brouillon:not(.loue-maj)'); return b ? (await b.textContent()) : ''; };
  const connecter = id => page.evaluate(a => { LOUE.deconnecter(); return LOUE.connexion(a[0], a[1]).then(x => x.code); }, [id, MDP]);
  // Le téléphone remis à neuf : ni fiche en attente, ni brouillon, ni liste de points gardée
  const toutVider = async () => {
    await page.goto(BASE + 'index.html?' + q); await page.waitForTimeout(1200);
    await page.evaluate(async () => {
      for (const e of await LOUE.stockage.tout('file')) await LOUE.abandonner(e.id);
      Object.keys(localStorage).filter(k => /brouillon/.test(k)).forEach(k => localStorage.removeItem(k));
      await LOUE.stockage.supprimer('brouillons', 'brouillon_note'); await LOUE.stockage.supprimer('brouillons', 'brouillon_note_mis_de_cote');
      await new Promise(ok => { const d = indexedDB.deleteDatabase('loue_cr_local'); d.onsuccess = d.onerror = d.onblocked = () => ok(); });
    });
  };
  const ouvrirNote = async attente => { await page.goto(NOTE); await page.waitForTimeout(attente || 3000); };
  const restaurer = async () => { const b = await page.$('.loue-brouillon [data-oui]'); if (b) { await b.click(); await page.waitForTimeout(2500); } return !!b; };
  const envoyer = async () => { await page.evaluate(() => envoyer()); for (let i = 0; i < 60; i++) { await page.waitForTimeout(500); if ((await page.textContent('#btn-envoyer')) === 'Envoyer la note') return; } };
  // Ce que montre l'écran des points
  const ecran = () => page.evaluate(() => ({
    titre: document.getElementById('points-titre').textContent, info: document.getElementById('points-info').hidden ? '' : document.getElementById('points-info').textContent,
    cartes: Array.from(document.querySelectorAll('#points-liste .pt')).map(c => ({ t: c.querySelector('.pt-texte').textContent, m: c.querySelector('.pt-mention').textContent,
      clos: c.classList.contains('clos'), plie: c.querySelector('.pt-corps').hidden, bouton: c.querySelector('.pt-action').textContent })),
    clos: Array.from(document.querySelectorAll('#points-clos .pt')).map(c => c.querySelector('.pt-texte').textContent + ' | ' + c.querySelector('.pt-mention').textContent),
    closVisible: !document.getElementById('points-clos-bloc').hidden,
    orphelins: Array.from(document.querySelectorAll('#points-orphelins .pt')).map(c => c.innerText.replace(/\\s+/g, ' ').trim()),
    nouveaux: Array.from(document.querySelectorAll('#nouveaux-liste .pt')).map(c => c.querySelector('textarea').value + (c.querySelector('[data-regle]').checked ? ' [réglé]' : '')),
    titreNouveaux: document.getElementById('nouveaux-titre').textContent }));
  const carte = t => page.evaluateHandle(x => Array.from(document.querySelectorAll('#points-liste .pt')).find(c => c.querySelector('.pt-texte').textContent.indexOf(x) === 0), t);
  const geste = async (t, g) => { await page.evaluate(a => { const c = Array.from(document.querySelectorAll('#points-liste .pt')).find(x => x.querySelector('.pt-texte').textContent.indexOf(a[0]) === 0);
    if (!c) throw new Error('carte « ' + a[0] + ' » absente pour « ' + a[1] + ' » : ' + document.getElementById('points-titre').textContent + ' | ' + document.getElementById('points-info').textContent + ' | ' + document.getElementById('points-liste').innerText.slice(0, 300));
    c.querySelector('[data-geste="' + a[1] + '"]').click(); }, [t, g]); await page.waitForTimeout(250); };
  const nouveau = async (texte, regle) => { await page.click('#btn-nouveau-point'); await page.waitForTimeout(300);
    const n = await page.evaluate(() => document.querySelectorAll('#nouveaux-liste .pt').length);
    await page.fill('#nouveaux-liste .pt:nth-child(' + n + ') textarea', texte);
    if (regle) await page.check('#nouveaux-liste .pt:nth-child(' + n + ') [data-regle]'); };
  const lignesCR = async () => (await etatServeur()).comptesRendus.slice(1).map(l => ({ objet: l[4], compte: l[6], remarque: l[9], ouverts: String(l[10]).split('\\n').filter(Boolean).join(' / '), clos: String(l[11]).split('\\n').filter(Boolean).join(' / ') }));
  const gardee = () => page.evaluate(() => LOUE.comptesRendus.gardee('CHANTIER TEST 1').then(g => g ? g.liste.ouverts.map(p => p.t.slice(0, 7)).join('|') : 'rien'));
  const dernierPdf = async () => { const e = await etatServeur(); return e.pdfs[e.pdfs.length - 1] || {}; };
  await page.setViewportSize({ width: 375, height: 812 });
  await ctx.setOffline(false);
  await page.goto(BASE + 'index.html?' + q);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => 1));
  await page.reload(); await page.waitForTimeout(1500);
  await toutVider();
`;

// ── A. Le parcours complet d'un conducteur : première note, reprise, gestes, brouillon, hors réseau ──
function scenarioPoints() {
  return DEBUT + `
  r.connexion = await connecter('conducteur1');
  // 0. Page ouverte et pas touchée (la liste du chantier est arrivée entre-temps) : aucun brouillon à l'ouverture suivante
  await ouvrirNote(); await page.waitForTimeout(5000);
  r.premier = await ecran();
  await ouvrirNote();
  r.fauxBrouillon = await bandeau();
  r.date = await page.inputValue('#meta-date');

  // 1. Trois nouveaux points (le 2e réglé pendant la réunion), une photo sur le 1er, une photo générale
  await page.fill('#meta-auteur', 'Rédacteur Essai'); await page.fill('#meta-objet', 'Première réunion'); await page.fill('#meta-commentaires', 'Remarque de la première réunion');
  await nouveau('Point A : fuite sur le châssis du R+1');
  await nouveau('Point B : plinthes du hall', true);
  await nouveau('Point C : porte palière B12');
  await page.evaluate(() => { photoPour = NOUVEAUX[0].id; }); await page.setInputFiles('#photo-galerie', PHOTO); await page.waitForTimeout(2500);
  await page.evaluate(() => { photoPour = ''; }); await page.setInputFiles('#photo-galerie', PHOTO); await page.waitForTimeout(2500);
  await page.evaluate(() => { photos[0].label = 'vue du châssis'; });
  r.nouveaux = await ecran();
  r.mesures = await page.evaluate(() => ({ largeur: document.documentElement.scrollWidth <= innerWidth,
    boutons: Array.from(document.querySelectorAll('#nouveaux-liste button, #nouveaux-liste .pt-regle, .bottom-bar .btn, .photo-btns .btn')).filter(b => b.offsetParent).map(b => b.getBoundingClientRect()).every(b => b.height >= 48 && b.width >= 48),
    plusVisible: (() => { const b = document.getElementById('btn-nouveau-point').getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight && b.width > 300; })(),
    photosDuPoint: document.querySelectorAll('#nouveaux-liste .pt:nth-child(1) .photo-item').length, photosGenerales: document.querySelectorAll('#photos-list .photo-item').length,
    compteur: document.getElementById('photos-compteur').textContent }));
  await page.evaluate(() => ouvrirApercu()); await page.waitForTimeout(1500);
  r.apercu = await page.evaluate(() => document.getElementById('apercu-cadre').srcdoc.replace(/base64,[^"]+/g, '').replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' '));
  await page.evaluate(() => fermerApercu());
  await envoyer(); r.partie1 = await attendreFileVide();
  r.message1 = await attendreMessage('Compte rendu');
  r.pdf1 = await dernierPdf();
  await page.waitForTimeout(1500);

  // 2. La note suivante : les points ouverts reviennent tout seuls, en cartes repliées
  r.repris = await ecran();
  r.cartes = await page.evaluate(() => ({ largeur: document.documentElement.scrollWidth <= innerWidth,
    boutons: Array.from(document.querySelectorAll('#points-liste .pt-action, #points-liste .pt-resume')).map(b => b.getBoundingClientRect()).every(b => b.height >= 48 && b.width >= 48),
    uneLigne: Array.from(document.querySelectorAll('#points-liste .pt-texte')).every(e => e.getBoundingClientRect().height < 30) }));
  await page.waitForTimeout(4500); await ouvrirNote();
  r.bandeauApresEnvoi = await bandeau();

  // 3. Les gestes : clore A, se raviser (rouvrir avant l'envoi), le clore de nouveau ; compléter C ; rouvrir B (clos récemment) ; nouveau point D
  await geste('Point A', 'clore'); r.clos = await ecran();
  await geste('Point A', 'rouvrir'); r.ravise = await ecran();
  r.brouillonVierge = await page.evaluate(() => JSON.stringify(pointsDuBrouillon()));
  await geste('Point A', 'clore');
  await geste('Point C', 'deplier'); await geste('Point C', 'completer');
  r.focus = await page.evaluate(() => document.activeElement.tagName + '|' + document.activeElement.value);
  await page.fill('#points-liste textarea', 'Point C : porte palière B12, serrure changée, reste le ferme-porte'); await page.waitForTimeout(200);
  await page.evaluate(() => document.getElementById('points-clos-bloc').open = true);
  await page.click('#points-clos [data-geste="rouvrir-clos"]'); await page.waitForTimeout(300);
  await nouveau('Point D : garde-corps du balcon');
  await page.fill('#meta-auteur', 'Rédacteur Essai'); await page.fill('#meta-objet', 'Deuxième réunion');
  r.gestes = await ecran();
  await page.evaluate(() => BROUILLON.sauverMaintenant()); await page.waitForTimeout(1000);
  r.brouillon = await page.evaluate(() => localStorage.getItem('loue_brouillon_' + LOUE_CONFIG.env + '_note') || '');

  // 4. Page rechargée : le brouillon revient, les gestes sont rejoués sur la liste du jour
  await ouvrirNote();
  r.bandeau = await bandeau();
  await restaurer();
  r.restaure = await ecran();
  await envoyer(); r.partie2 = await attendreFileVide();
  r.message2 = await attendreMessage('Compte rendu');
  r.pdf2 = await dernierPdf();
  r.lignes2 = await lignesCR();
  await page.waitForTimeout(1500);
  r.apres2 = await ecran();

  r.gardee2 = await gardee();
  if (${JSON.stringify(process.env.LOUE_ARRET || '')} === '5') return JSON.stringify(r);

  // 5. HORS RÉSEAU, avec la liste gardée : elle s'affiche avec sa date ; une note, puis une SECONDE note de suite
  await ctx.setOffline(true);
  await ouvrirNote();
  r.horsReseau = await ecran();
  await geste('Point B', 'clore'); await nouveau('Point E : seuil de la porte du local vélos');
  await page.fill('#meta-auteur', 'Rédacteur Essai'); await page.fill('#meta-objet', 'Note 1 sans réseau');
  await envoyer();
  r.file1 = await file(); r.messageHorsReseau = await message();
  await page.waitForTimeout(1200);
  r.apresNote1 = await ecran();
  await geste('Point E', 'deplier'); await geste('Point E', 'completer');
  await page.fill('#points-liste textarea', 'Point E : seuil de la porte du local vélos, à recouper de 5 mm');
  await nouveau('Point F : nez de marche du R+2');
  await page.fill('#meta-objet', 'Note 2 sans réseau');
  r.base2 = await page.evaluate(async () => { const f = await LOUE.stockage.tout('file'); return donneesFiche(false).points.base === f[0].id; });
  await envoyer();
  r.file2 = await file();
  await ctx.setOffline(false);
  await page.evaluate(() => { LOUE.viderFile(true); });
  r.parties = await attendreFileVide(80);
  await page.waitForTimeout(2500);
  r.lignes4 = await lignesCR();
  r.apresRetour = await ecran();

  // 6. Réponse perdue : la note est traitée, la réponse n'arrive pas ; elle n'est comptée qu'une fois
  await reglage('perdue');
  await nouveau('Point G : joint de la baie du séjour');
  await page.fill('#meta-objet', 'Réponse perdue');
  await envoyer(); await page.waitForTimeout(9000);
  r.perdueEnFile = await file();
  r.pendantPerdue = await ecran();
  await reglage('normal');
  await page.evaluate(() => { LOUE.viderFile(true); });
  r.perduePartie = await attendreFileVide(80);
  r.perdue = await attendreMessage('déjà reçu');
  await page.waitForTimeout(2500);
  r.lignes5 = await lignesCR();
  r.apresPerdue = await ecran();

  // 6 bis. Ordre d'envoi : la première note attend encore son prochain essai ; la suivante du MÊME chantier ne passe pas devant,
  //        une note d'un AUTRE chantier, elle, part
  r.ordre = await page.evaluate(async () => {
    const note = (chantier, objet) => ({ chantier, auteur: 'Ordre Essai', date: document.getElementById('meta-date').value, objet, remarques: '', commentaires: '', destinataires: [], photosBase64: [],
      points: { base: chantier === 'CHANTIER TEST 1' ? LISTE.base : '', gestes: [{ id: CR.nouvelId(), g: 'nouveau', t: 'Point de « ' + objet + ' »' }] } });
    const un = await LOUE.mettreEnFile('note', note('CHANTIER TEST 1', 'Ordre 1'), [], 'Note de réunion');
    un.prochainEssai = Date.now() + 3600000; un.essais = 1; un.message = 'essai : pas encore l’heure';
    await LOUE.stockage.ecrire('file', un);
    await new Promise(ok => setTimeout(ok, 30));
    await LOUE.mettreEnFile('note', note('CHANTIER TEST 1', 'Ordre 2'), [], 'Note de réunion');
    await LOUE.mettreEnFile('note', note('CHANTIER TEST 2', 'Ordre autre chantier'), [], 'Note de réunion');
    await LOUE.viderFile();
    await new Promise(ok => setTimeout(ok, 6000));
    return (await LOUE.stockage.tout('file')).sort((a, b) => a.cree - b.cree).map(e => e.donnees.objet).join(' | ');
  });
  await page.evaluate(() => { LOUE.viderFile(true); });
  r.ordrePartie = await attendreFileVide(80);
  await page.waitForTimeout(2000);
  r.lignes6 = (await lignesCR()).map(l => l.objet);

  // 7. HORS RÉSEAU sans rien de gardé (téléphone neuf) : message clair, on peut écrire de nouveaux points
  await page.evaluate(() => new Promise(ok => { const d = indexedDB.deleteDatabase('loue_cr_local'); d.onsuccess = d.onerror = d.onblocked = () => ok(); }));
  await ctx.setOffline(true);
  await ouvrirNote();
  r.sansListe = await ecran();
  await ctx.setOffline(false);

  // 8. Largeur PC
  await page.setViewportSize({ width: 1280, height: 800 });
  await ouvrirNote();
  r.pc = await page.evaluate(() => ({ largeur: document.documentElement.scrollWidth <= innerWidth, cartes: document.querySelectorAll('#points-liste .pt').length,
    plus: document.getElementById('btn-nouveau-point').getBoundingClientRect().bottom <= innerHeight }));
  await page.setViewportSize({ width: 375, height: 812 });
  r.version = (await etatServeur()).version;
  await toutVider();
  return JSON.stringify(r);
}`;
}

// ── B. Poseur du chantier : brouillon face à une liste qui a changé ; accès retiré ; second compte ; sans compte ; réseau lent ──
function scenarioDroits() {
  return DEBUT + `
  // Le conducteur ouvre trois points
  r.c1 = await connecter('conducteur1');
  await ouvrirNote();
  await page.fill('#meta-auteur', 'Conducteur Essai'); await page.fill('#meta-objet', 'Ouverture');
  await nouveau('Point A'); await nouveau('Point B'); await nouveau('Point C');
  await envoyer(); await attendreFileVide(); await page.waitForTimeout(1500);

  // Le poseur du chantier voit les points, complète A et clôt B, puis laisse son brouillon
  r.p1 = await connecter('poseur1');
  await ouvrirNote();
  r.poseur = await ecran();
  await page.fill('#meta-auteur', 'Poseur Essai'); await page.fill('#meta-objet', 'Note du poseur');
  await geste('Point A', 'deplier'); await geste('Point A', 'completer');
  await page.fill('#points-liste textarea', 'Point A, complété par le poseur');
  await geste('Point B', 'clore');
  await page.evaluate(() => BROUILLON.sauverMaintenant()); await page.waitForTimeout(1000);
  // Entre-temps, un autre appareil (le bureau) clôt le point A
  r.autre = await page.evaluate(async () => { const a = LISTE.ouverts[0];
    const rep = await LOUE.appeler({ action: 'fiche', id: LOUE.nouvelId('fiche'), donnees: { type: 'note', chantier: 'CHANTIER TEST 1', auteur: 'Bureau Essai', date: document.getElementById('meta-date').value,
      objet: 'Note du bureau', remarques: '', commentaires: '', destinataires: [], photosBase64: [], points: { base: LISTE.base, gestes: [{ id: a.id, g: 'clos', t: a.t }] } } }, 60000);
    return rep.code; });
  await ouvrirNote();
  r.bandeau = await bandeau();
  await restaurer();
  r.listeChangee = await ecran();
  // Rien n'est jeté en silence : le texte tapé est montré, avec un choix. Ici : en faire un nouveau point.
  await page.click('#points-orphelins [data-geste="orphelin-nouveau"]'); await page.waitForTimeout(300);
  r.apresChoix = await ecran();
  await envoyer(); await attendreFileVide(); await page.waitForTimeout(1500);
  r.lignes = await lignesCR();

  // Accès au chantier retiré par le bureau : les points ne sont plus affichés, la liste gardée est effacée
  await reglage('acces&id=poseur1&valeur=0');
  await ouvrirNote();
  r.interdit = await ecran();
  await ctx.setOffline(true); await ouvrirNote();
  r.interditHorsReseau = await ecran();
  await ctx.setOffline(false);
  // … mais sa note part toujours, et ses nouveaux points sont pris
  await ouvrirNote();
  await page.fill('#meta-auteur', 'Poseur Essai'); await page.fill('#meta-objet', 'Sans accès');
  await nouveau('Point du poseur sans accès');
  await envoyer(); r.sansAccesPartie = await attendreFileVide(); await page.waitForTimeout(1000);
  await reglage('acces&id=poseur1&valeur=1');

  // Second compte sur le même téléphone : rien de ce qu'a gardé le premier ne lui est rendu
  await ouvrirNote(); await page.waitForTimeout(500);
  r.gardeesAvant = await page.evaluate(() => new Promise(ok => { const o = indexedDB.open('loue_cr_local'); o.onsuccess = () => { const q = o.result.transaction('cache').objectStore('cache').getAll(); q.onsuccess = () => ok(q.result.map(e => e.compte).join()); }; }));
  r.p2 = await connecter('poseur2'); await page.waitForTimeout(1500);
  r.gardeesApres = await page.evaluate(() => new Promise(ok => { const o = indexedDB.open('loue_cr_local'); o.onsuccess = () => { const q = o.result.transaction('cache').objectStore('cache').getAll(); q.onsuccess = () => ok(q.result.map(e => e.compte).join()); }; }));
  await ouvrirNote();
  r.second = await ecran();

  // Sans compte (période de transition) : pas de liste, mais la note part et ses nouveaux points sont pris
  await page.evaluate(() => LOUE.deconnecter());
  await ouvrirNote();
  r.sansCompte = await ecran();
  await page.fill('#meta-auteur', 'Sans Compte'); await page.fill('#meta-objet', 'Sans compte');
  await nouveau('Point écrit sans compte');
  await envoyer(); r.sansComptePartie = await attendreFileVide(); await page.waitForTimeout(1000);
  r.lignesFin = await lignesCR();

  // Réseau lent (6 s par réponse) : la page s'affiche tout de suite avec la liste gardée, puis la liste du bureau ; la note part
  r.c2 = await connecter('conducteur1');
  await ouvrirNote();   // la liste est gardée dans le téléphone
  await reglage('lent');
  await page.goto(NOTE); await page.waitForTimeout(1800);
  r.lentTout2s = await ecran();
  await page.waitForTimeout(9000);
  r.lentApres = await ecran();
  await page.fill('#meta-auteur', 'Conducteur Essai'); await page.fill('#meta-objet', 'Réseau lent');
  await nouveau('Point écrit avec un réseau lent');
  await envoyer(); r.lentPartie = await attendreFileVide(120);
  await reglage('normal');
  r.lignesLent = await lignesCR();

  // Quota de mails presque atteint (5 restants) : la page prévient sous les destinataires
  await reglage('quota');
  await ouvrirNote();
  r.quota = await page.evaluate(() => document.getElementById('dest-quota').textContent);
  await reglage('normal');
  await ouvrirNote();
  r.quotaNormal = await page.evaluate(() => document.getElementById('dest-quota').textContent);

  // Une liste gardée depuis plus d'un jour (autre chantier) est rafraîchie à l'ouverture (5 au plus), pas celle du chantier affiché
  r.rafraichi = await page.evaluate(async () => {
    await CR.lire('CHANTIER TEST 2');
    const lireTout = () => new Promise(ok => { const o = indexedDB.open('loue_cr_local'); o.onsuccess = () => { const q = o.result.transaction('cache').objectStore('cache').getAll(); q.onsuccess = () => { o.result.close(); ok(q.result); }; }; });
    const vieille = (await lireTout()).find(e => e.chantier === 'CHANTIER TEST 2');
    vieille.date = Date.now() - 3 * 24 * 3600 * 1000;
    await new Promise(ok => { const o = indexedDB.open('loue_cr_local'); o.onsuccess = () => { const t = o.result.transaction('cache', 'readwrite'); t.objectStore('cache').put(vieille); t.oncomplete = () => { o.result.close(); ok(); }; }; });
    const n = await CR.rafraichirAnciennes('CHANTIER TEST 1');
    await CR.gardee('CHANTIER TEST 2');
    const apres = (await lireTout()).find(e => e.chantier === 'CHANTIER TEST 2');
    return { n, rajeunie: Date.now() - apres.date < 60000 };
  });
  await toutVider();
  return JSON.stringify(r);
}`;
}

// ── C. La NOUVELLE page avec l'ANCIEN serveur (déploiement en retard, ou retour arrière du serveur) ──
function scenarioAncienServeur() {
  return DEBUT + `
  r.c1 = await connecter('conducteur1');
  await ouvrirNote();
  r.ecran = await ecran();
  await page.fill('#meta-auteur', 'Rédacteur Essai'); await page.fill('#meta-objet', 'Avec l’ancien serveur'); await page.fill('#meta-commentaires', 'Remarque pour l’ancien serveur');
  await nouveau('Point A pour l’ancien serveur');
  await nouveau('Point B, réglé', true);
  await page.evaluate(() => { photoPour = NOUVEAUX[0].id; }); await page.setInputFiles('#photo-galerie', PHOTO); await page.waitForTimeout(2500);
  await envoyer();
  r.partie = await attendreFileVide();
  r.message = await attendreMessage('Compte rendu');
  r.photosEnAttente = await page.evaluate(() => LOUE.stockage.tout('photos').then(l => l.length));
  const e = await etatServeur();
  r.version = e.version; r.onglet = e.comptesRendus.length;
  r.envois = e.envois.slice(1).map(l => [l[2], l[4]].join(':'));
  r.pdf = e.pdfs[e.pdfs.length - 1] || {};
  await page.waitForTimeout(4500); await ouvrirNote();
  r.bandeauApres = await bandeau();
  await toutVider();
  return JSON.stringify(r);
}`;
}

// ── D. Retour arrière de la PAGE : un brouillon écrit par la page 10.2 est rouvert par la page de repli ──
function scenarioRepli() {
  return DEBUT + `
  r.c1 = await connecter('conducteur1');
  await ouvrirNote();
  await page.fill('#meta-auteur', 'Conducteur Essai'); await page.fill('#meta-objet', 'Ouverture');
  await nouveau('Point A'); await nouveau('Point B');
  await envoyer(); await attendreFileVide(); await page.waitForTimeout(1500);
  // Un brouillon en cours sur la page 10.2 : un point complété, un point clos, un nouveau point avec sa photo, une remarque
  await page.fill('#meta-objet', 'Avant le retour arrière'); await page.fill('#meta-commentaires', 'Remarque déjà tapée');
  await geste('Point A', 'deplier'); await geste('Point A', 'completer');
  await page.fill('#points-liste textarea', 'Point A, complété avant le retour arrière');
  await geste('Point B', 'clore');
  await nouveau('Nouveau point tapé avant le retour arrière', true);
  await page.evaluate(() => { photoPour = NOUVEAUX[0].id; }); await page.setInputFiles('#photo-galerie', PHOTO); await page.waitForTimeout(2500);
  await page.evaluate(() => BROUILLON.sauverMaintenant()); await page.waitForTimeout(1000);
  await page.goto(BASE + 'note-reunion-repli.html?' + q + '&chantier=CHANTIER%20TEST%201'); await page.waitForTimeout(2500);
  r.page = await page.evaluate(() => ({ points: !!document.getElementById('btn-nouveau-point'), compteur: !!document.getElementById('dest-compteur') }));
  r.bandeau = await bandeau();
  await restaurer();
  r.repli = { objet: await page.inputValue('#meta-objet'), texte: await page.inputValue('#meta-commentaires'), photos: await page.evaluate(() => photos.length) };
  // … et la note part depuis la page de repli (le serveur 11.1 accepte l'ancien format)
  await page.fill('#meta-auteur', 'Conducteur Essai');
  await page.evaluate(() => envoyer()); r.partie = await attendreFileVide();
  r.pdf = await dernierPdf();
  r.lignes = await lignesCR();
  await toutVider();
  return JSON.stringify(r);
}`;
}

// Un fichier tel qu'il était dans un commit précédent : le plus récent qui satisfait « convient » (null s'il n'y en a pas)
function ancienFichier(chemin, convient) {
  const log = spawnSync('git', ['log', '--format=%H', '--', chemin], { cwd: racine, encoding: 'utf8' });
  for (const h of String(log.stdout || '').split(/\r?\n/).filter(Boolean)) {
    const v = spawnSync('git', ['show', h + ':' + chemin], { cwd: racine, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (v.status === 0 && convient(v.stdout)) return v.stdout;
  }
  return null;
}
const pause = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
function serveurNeuf(env) {
  faux.kill(); pause(1500);
  faux = spawn('node', [path.join(__dirname, 'faux-serveur.js'), '8796'], { stdio: 'ignore', env: Object.assign({}, process.env, env || {}) });
  pause(3000);
}
function lancer(nom, texte) {
  const f = path.join(dossier, 'scenario-' + nom + '.js');
  fs.writeFileSync(f, texte);
  spawnSync('playwright-cli', ['-s=loue-l8c', 'close'], { shell: true });
  spawnSync('playwright-cli', ['-s=loue-l8c', 'open', '--browser=chrome', '--mobile', 'about:blank'], { shell: true, encoding: 'utf8' });
  const sortie = spawnSync('playwright-cli', ['-s=loue-l8c'].concat(process.env.LOUE_DEBUG ? [] : ['--raw'], ['run-code', '--filename=' + f]), { shell: true, encoding: 'utf8', timeout: 900000 });
  // Pour comprendre un échec : LOUE_DEBUG=<fichier> garde la sortie brute du navigateur
  if (process.env.LOUE_DEBUG) fs.writeFileSync(process.env.LOUE_DEBUG + '-' + nom + '.json', JSON.stringify({ status: sortie.status, out: sortie.stdout, err: sortie.stderr }, null, 1));
  const ligne = (sortie.stdout || '').split(/\r?\n/).map(l => l.trim()).filter(l => /^"\{/.test(l)).pop();
  if (!ligne) throw new Error('scénario « ' + nom + ' » sans résultat : ' + (sortie.stdout || sortie.stderr || '').slice(0, 900));
  return JSON.parse(JSON.parse(ligne));
}

let reussis = 0, echecs = 0;
function verifier(nom, cond, detail) {
  if (cond) { reussis++; console.log('  ✓ ' + nom); } else { echecs++; console.log('  ✗ ' + nom + '\n    ' + detail); }
}
const j = x => JSON.stringify(x);
const jm = d => String(d).slice(0, 5);
const textes = e => e.cartes.map(c => c.t);

function partiePoints() {
  console.log('Lot 8c — la note en points : reprise, gestes, brouillon, hors réseau (vrai Chrome, 375 px, conducteur)');
  const a = lancer('points', scenarioPoints());
  if (process.env.LOUE_ARRET) { console.log(JSON.stringify(a, null, 1)); return; }
  const D = a.date, d = jm(D);
  verifier('première note du chantier : « Premier compte rendu de ce chantier : aucun point à reprendre. », titre « Points ouverts (0) »',
    a.connexion === 'CONNECTE' && a.premier.info === 'Premier compte rendu de ce chantier : aucun point à reprendre.' && a.premier.titre === 'Points ouverts (0)' && a.premier.cartes.length === 0, j(a.premier));
  verifier('page ouverte, liste reçue, rien touché : aucun « Brouillon retrouvé » à l’ouverture suivante', a.fauxBrouillon === '', j(a.fauxBrouillon));
  verifier('trois nouveaux points (« Réglé pendant la réunion » sur le 2e) ; titre « Nouveaux points (3) »',
    j(a.nouveaux.nouveaux) === j(['Point A : fuite sur le châssis du R+1', 'Point B : plinthes du hall [réglé]', 'Point C : porte palière B12']) && a.nouveaux.titreNouveaux === 'Nouveaux points (3)', j(a.nouveaux));
  verifier('375 px : pas de défilement horizontal, boutons de 48 px au moins, « + Nouveau point » toujours visible au-dessus de la barre du bas',
    a.mesures.largeur === true && a.mesures.boutons === true && a.mesures.plusVisible === true, j(a.mesures));
  verifier('la photo d’un point est dans la carte de ce point, la photo générale dans « Photos et croquis » ; compteur « 2 photos sur 10 … »',
    a.mesures.photosDuPoint === 1 && a.mesures.photosGenerales === 1 && /^2 photos sur 10 au maximum par note/.test(a.mesures.compteur), j(a.mesures));
  verifier('aperçu : tableau « Points (3) — 2 ouverts, 1 clos », mentions, « Remarques générales », légende « Point 1 — vue du châssis »',
    /Points \(3\) — 2 ouverts, 1 clos/.test(a.apercu) && /1 Point A : fuite sur le châssis du R\+1 nouveau point OUVERT 2 Point B : plinthes du hall nouveau point, réglé pendant la réunion CLOS/.test(a.apercu)
    && /Remarques générales Remarque de la première réunion/.test(a.apercu) && /Point 1 — vue du châssis/.test(a.apercu), a.apercu);
  verifier('envoi : « ✓ Compte rendu du <date> envoyé — 1 mail envoyé » ; le PDF du bureau porte les points, les remarques UNE fois, les 2 photos',
    a.partie1 === true && a.message1 === '✓ Compte rendu du ' + D + ' envoyé — 1 mail envoyé' && /Points \(3\) — 2 ouverts, 1 clos/.test(a.pdf1.texte || '')
    && a.pdf1.texte.split('Remarque de la première réunion').length === 2 && a.pdf1.texte.indexOf('POINTS 1.') < 0 && /Point 1 — vue du châssis/.test(a.pdf1.texte) && a.pdf1.images === 2, j([a.message1, a.pdf1]));
  verifier('note suivante : les 2 points ouverts reviennent tout seuls (« Points ouverts (2) »), en cartes repliées, « repris du compte rendu du jj/mm » ; le point clos est dans « Clos récemment »',
    a.repris.titre === 'Points ouverts (2)' && j(textes(a.repris)) === j(['Point A : fuite sur le châssis du R+1', 'Point C : porte palière B12']) && a.repris.cartes.every(c => c.plie && c.bouton === 'Clore' && c.m === 'repris du compte rendu du ' + d)
    && a.repris.info === 'Points repris du compte rendu du ' + D + '.' && a.repris.closVisible && j(a.repris.clos) === j(['Point B : plinthes du hall | clos par le compte rendu du ' + d]) && a.repris.nouveaux.length === 0, j(a.repris));
  verifier('cartes à 375 px : une ligne de texte, boutons de 48 px, pas de défilement horizontal', a.cartes.largeur && a.cartes.boutons && a.cartes.uneLigne, j(a.cartes));
  verifier('après l’envoi, page rouverte : aucun « Brouillon retrouvé » (les points reçus n’entrent pas dans le brouillon)', a.bandeauApresEnvoi === '', j(a.bandeauApresEnvoi));
  verifier('« Clore » : la carte passe en gris avec « Clos ✓ » et « Rouvrir », le titre passe à (1) ; « Rouvrir » avant l’envoi défait le geste (brouillon de nouveau vierge)',
    a.clos.cartes[0].clos === true && a.clos.cartes[0].bouton === 'Rouvrir' && a.clos.titre === 'Points ouverts (1)' && a.ravise.cartes[0].clos === false && a.ravise.titre === 'Points ouverts (2)' && a.brouillonVierge === '{}', j([a.clos, a.ravise, a.brouillonVierge]));
  verifier('« Compléter » ouvre le texte du point dans un champ (curseur dedans) ; le point porte « · complété »',
    a.focus === 'TEXTAREA|Point C : porte palière B12' && a.gestes.cartes.some(c => /serrure changée/.test(c.t) && /· complété$/.test(c.m)), j([a.focus, a.gestes.cartes]));
  verifier('« Rouvrir » un point de « Clos récemment » : il revient dans les points ouverts (« rouvert · clos par le compte rendu du … »)',
    a.gestes.cartes.some(c => /^Point B/.test(c.t) && c.m === 'rouvert · clos par le compte rendu du ' + d) && a.gestes.closVisible === false && a.gestes.titre === 'Points ouverts (2)', j(a.gestes));
  const br = a.brouillon;
  verifier('brouillon : il ne garde QUE les gestes de la personne (ni la liste reçue, ni le texte d’un point simplement clos)',
    /"gestes":/.test(br) && /"g":"clos"/.test(br) && /"g":"rouvert"/.test(br) && /serrure changée/.test(br) && /garde-corps du balcon/.test(br) && br.indexOf('fuite sur le châssis') < 0 && br.indexOf('plinthes du hall') < 0 && br.indexOf('"ouverts"') < 0, br.slice(0, 900));
  verifier('page rechargée : « Brouillon retrouvé », et les gestes sont rejoués (A clos, C complété, B rouvert, nouveau point D)',
    /Brouillon retrouvé/.test(a.bandeau) && a.restaure.cartes.some(c => /^Point A/.test(c.t) && c.clos) && a.restaure.cartes.some(c => /serrure changée/.test(c.t)) && a.restaure.cartes.some(c => /^Point B/.test(c.t) && /^rouvert/.test(c.m))
    && j(a.restaure.nouveaux) === j(['Point D : garde-corps du balcon']), j(a.restaure));
  const l2 = a.lignes2[1] || {};
  verifier('envoi : le bureau applique les gestes (ouverts : C complété, B rouvert, D ; clos par cette note : A), sans remarque',
    a.partie2 === true && l2.ouverts === '• Point C : porte palière B12, serrure changée, reste le ferme-porte / • Point B : plinthes du hall / • Point D : garde-corps du balcon'
    && l2.clos === '• Point A : fuite sur le châssis du R+1' && l2.remarque === '', j(a.lignes2));
  verifier('… et son PDF le dit point par point (clos, complété, rouvert, nouveau)',
    /1 Point A : fuite sur le châssis du R\+1 clos · ouvert depuis le /.test(a.pdf2.texte || '') && /2 Point C : porte palière B12, serrure changée, reste le ferme-porte complété · ouvert depuis le /.test(a.pdf2.texte)
    && /3 Point B : plinthes du hall rouvert \(clos par le compte rendu du /.test(a.pdf2.texte) && /4 Point D : garde-corps du balcon nouveau point OUVERT/.test(a.pdf2.texte), j(a.pdf2));
  verifier('… la liste du téléphone est à jour tout de suite (3 points ouverts, A dans « Clos récemment »)',
    a.apres2.titre === 'Points ouverts (3)' && a.apres2.clos.length === 1 && /^Point A/.test(a.apres2.clos[0]), j(a.apres2));
  verifier('HORS RÉSEAU : la liste gardée s’affiche avec sa date (« Pas de réseau : points du jj/mm, gardés dans le téléphone. »)',
    a.horsReseau.titre === 'Points ouverts (3)' && a.horsReseau.info === 'Pas de réseau : points du ' + d + ', gardés dans le téléphone.', j(a.horsReseau));
  verifier('note envoyée sans réseau : gardée dans le téléphone ; la suivante montre déjà ses effets (« note du jj/mm (en attente d’envoi) », point clos passé dans « Clos récemment »)',
    a.file1 === 1 && /Pas de réseau : la note est gardée dans le téléphone/.test(a.messageHorsReseau) && a.apresNote1.cartes.some(c => /^Point E/.test(c.t) && c.m === 'note du ' + d + ' (en attente d’envoi)')
    && !a.apresNote1.cartes.some(c => /^Point B/.test(c.t)) && a.apresNote1.clos.some(x => /^Point B : plinthes du hall \| clos par la note du /.test(x)) && /Une note de ce chantier \(du \d\d\/\d\d\) attend encore d’être envoyée : ses points sont repris ici\./.test(a.apresNote1.info), j(a.apresNote1));
  verifier('SECONDE note de suite sans réseau : elle part de la première (sa « base » est le numéro de fiche de la note en attente) ; deux notes dans le téléphone',
    a.base2 === true && a.file2 === 2, j([a.base2, a.file2]));
  const n1 = a.lignes4[2] || {}, n2 = a.lignes4[3] || {};
  verifier('retour du réseau : les deux notes partent DANS L’ORDRE où elles ont été écrites, sans remarque ; la seconde a complété le point de la première',
    a.parties === true && n1.objet === 'Note 1 sans réseau' && n2.objet === 'Note 2 sans réseau' && n1.remarque === '' && n2.remarque === '' && n1.clos === '• Point B : plinthes du hall'
    && /• Point E : seuil de la porte du local vélos, à recouper de 5 mm/.test(n2.ouverts) && /• Point F : nez de marche du R\+2/.test(n2.ouverts) && n2.ouverts.split('Point E').length === 2, j(a.lignes4));
  verifier('… et l’écran suit (4 points ouverts : C, D, E complété, F)', a.apresRetour.titre === 'Points ouverts (4)' && a.apresRetour.cartes.every(c => c.m.indexOf('en attente') < 0), j(a.apresRetour));
  const n3 = a.lignes5[4] || {};
  verifier('réponse perdue : la note reste dans le téléphone (ses points déjà repris à l’écran), puis « déjà reçu » ; au bureau, une seule ligne et un seul « Point G »',
    a.perdueEnFile === 1 && a.pendantPerdue.cartes.some(c => /^Point G/.test(c.t)) && a.perduePartie === true && /déjà reçu par le bureau/.test(a.perdue) && a.lignes5.length === 5
    && n3.ouverts.split('Point G').length === 2 && a.apresPerdue.titre === 'Points ouverts (5)' && a.apresPerdue.cartes.filter(c => /^Point G/.test(c.t)).length === 1, j([a.perdue, a.lignes5.length, n3, a.apresPerdue.titre]));
  verifier('ordre d’envoi : tant que la 1re note d’un chantier attend son nouvel essai, la 2e du même chantier ne passe pas devant (une note d’un autre chantier part) ; puis elles arrivent dans l’ordre',
    a.ordre === 'Ordre 1 | Ordre 2' && a.ordrePartie === true && a.lignes6.indexOf('Ordre autre chantier') > -1 && a.lignes6.indexOf('Ordre autre chantier') < a.lignes6.indexOf('Ordre 1') && a.lignes6.indexOf('Ordre 1') < a.lignes6.indexOf('Ordre 2'), j([a.ordre, a.lignes6]));
  verifier('hors réseau SANS liste gardée : « Points de la dernière note indisponibles sans réseau. Écrivez vos nouveaux points : … »',
    a.sansListe.info === 'Points de la dernière note indisponibles sans réseau. Écrivez vos nouveaux points : les anciens restent ouverts et reviendront à la note suivante.' && a.sansListe.cartes.length === 0 && a.sansListe.titre === 'Points ouverts', j(a.sansListe));
  verifier('largeur PC (1 280 px) : pas de défilement horizontal, les 7 cartes, « + Nouveau point » visible', a.pc.largeur && a.pc.cartes === 7 && a.pc.plus, j(a.pc));
  verifier('serveur du lot 8c (v11.1)', /v11\.1/.test(a.version), j(a.version));
}

function partieDroits() {
  console.log('Lot 8c — poseur, liste qui a changé, accès retiré, second compte, sans compte, réseau lent');
  serveurNeuf();
  const b = lancer('droits', scenarioDroits());
  verifier('un poseur DU chantier voit les points ouverts de son chantier', b.p1 === 'CONNECTE' && j(textes(b.poseur)) === j(['Point A', 'Point B', 'Point C']), j(b.poseur));
  verifier('brouillon restauré face à une liste qui a changé (point clos entre-temps par le bureau) : rien n’est jeté, le texte tapé est montré avec un choix',
    b.autre === 'ENREGISTRE' && /Brouillon retrouvé/.test(b.bandeau) && b.listeChangee.orphelins.length === 1
    && /Ce point a été clos par le compte rendu du \d\d\/\d\d\. Votre texte : Point A, complété par le poseur Rouvrir avec mon texte En faire un nouveau point Retirer mon texte/.test(b.listeChangee.orphelins[0])
    && b.listeChangee.cartes.some(c => c.t === 'Point B' && c.clos) && !b.listeChangee.cartes.some(c => /^Point A/.test(c.t)), j(b.listeChangee));
  verifier('… « En faire un nouveau point » : le texte devient un nouveau point', b.apresChoix.orphelins.length === 0 && j(b.apresChoix.nouveaux) === j(['Point A, complété par le poseur']), j(b.apresChoix));
  const l = b.lignes[2] || {};
  verifier('… au bureau : le nouveau point est ouvert, B est clos par le poseur, A reste clos ; aucune remarque (la liste avait été relue)',
    l.objet === 'Note du poseur' && l.ouverts === '• Point C / • Point A, complété par le poseur' && l.clos === '• Point B' && l.remarque === '' && /\(poseur1\)$/.test(l.compte), j(b.lignes));
  verifier('accès au chantier retiré : « Ce chantier n’est pas dans vos chantiers … », aucun point affiché ; sans réseau ensuite, la liste gardée a bien été effacée',
    /^Ce chantier n’est pas dans vos chantiers/.test(b.interdit.info) && b.interdit.cartes.length === 0 && /^Points de la dernière note indisponibles sans réseau/.test(b.interditHorsReseau.info) && b.interditHorsReseau.cartes.length === 0, j([b.interdit, b.interditHorsReseau]));
  const s = b.lignesFin.find(x => x.objet === 'Sans accès') || {};
  verifier('… sa note part quand même, et son nouveau point est pris', b.sansAccesPartie === true && /• Point du poseur sans accès/.test(s.ouverts || ''), j(s));
  verifier('second compte sur le même téléphone : la liste gardée par le premier est effacée à la connexion du second, qui lit la sienne au bureau (une seule liste gardée : la sienne)',
    b.gardeesAvant === 'poseur1' && b.gardeesApres === 'poseur2' && b.p2 === 'CONNECTE' && b.second.cartes.length > 0, j([b.gardeesAvant, b.gardeesApres, b.second.titre]));
  const sc = b.lignesFin.find(x => x.objet === 'Sans compte') || {};
  verifier('sans compte : « Connectez-vous depuis l’accueil … », aucun point affiché ; la note part et son nouveau point est pris',
    /^Connectez-vous depuis l’accueil pour retrouver les points ouverts/.test(b.sansCompte.info) && b.sansCompte.cartes.length === 0 && b.sansComptePartie === true && /• Point écrit sans compte/.test(sc.ouverts || '') && sc.compte === 'sans compte', j([b.sansCompte, sc]));
  verifier('réseau lent (6 s par réponse) : la page affiche tout de suite la liste gardée (« mise à jour en cours… »), puis celle du bureau ; la note finit par partir',
    b.lentTout2s.cartes.length > 0 && /gardés dans le téléphone \(mise à jour en cours…\)\.$/.test(b.lentTout2s.info) && /^Points repris du compte rendu du /.test(b.lentApres.info) && b.lentPartie === true
    && b.lignesLent.some(x => x.objet === 'Réseau lent' && /Point écrit avec un réseau lent/.test(x.ouverts)), j([b.lentTout2s.info, b.lentApres.info, b.lentPartie]));
  verifier('quota de mails presque atteint : « ⚠ Il ne reste que 5 mails possibles aujourd’hui … » sous les destinataires ; rien d’affiché en temps normal',
    /^⚠ Il ne reste que \d+ mails? possibles? aujourd’hui pour toute l’appli/.test(b.quota) && b.quotaNormal === '', j([b.quota, b.quotaNormal]));
  verifier('une liste gardée depuis plus d’un jour pour un autre chantier est rafraîchie à l’ouverture', b.rafraichi.n === 1 && b.rafraichi.rajeunie === true, j(b.rafraichi));
}

function partieAncienServeur() {
  console.log('Lot 8c — la NOUVELLE page avec l’ANCIEN serveur (celui d’avant le lot 8, relu dans l’historique Git)');
  const code = ancienFichier('A-COLLER-DANS-APPS-SCRIPT/Code.gs', c => c.indexOf('function crReserver_(') < 0 && c.indexOf('function crEnregistrer_(') < 0 && c.indexOf('function traiterNoteReunion(') > -1);
  if (!code) { verifier('ancien serveur retrouvé dans l’historique Git', false, 'aucun Code.gs d’avant le lot 8 dans l’historique : essai impossible'); return; }
  const fichier = path.join(dossier, 'Code-ancien.gs');
  fs.writeFileSync(fichier, code);
  serveurNeuf({ LOUE_CODE_GS: fichier });
  const c = lancer('ancien-serveur', scenarioAncienServeur());
  verifier('c’est bien l’ancien serveur qui répond (pas de v11, pas d’onglet « Comptes rendus ») ; la page n’affiche ni liste ni message d’erreur',
    /Loué App API v/.test(c.version) && !/v11\./.test(c.version) && c.onglet === 0 && c.ecran.info === '' && c.ecran.cartes.length === 0, j([c.version, c.onglet, c.ecran]));
  verifier('la note part, rien ne reste dans le téléphone, message « ✓ Compte rendu du <date> envoyé — 1 mail envoyé »',
    c.partie === true && c.photosEnAttente === 0 && c.envois.join() === 'note:traité' && /^✓ Compte rendu du \d\d\/\d\d\/\d{4} envoyé — 1 mail envoyé$/.test(c.message), j([c.message, c.envois, c.photosEnAttente]));
  verifier('rien n’est perdu dans le PDF de l’ancien serveur : les points (copie lisible), les remarques, la photo du point avec « Point 1 »',
    /POINTS 1\. \[OUVERT\] Point A pour l’ancien serveur \(nouveau point\) 2\. \[CLOS\] Point B, réglé \(nouveau point, réglé pendant la réunion\) REMARQUES GÉNÉRALES Remarque pour l’ancien serveur/.test(c.pdf.texte || '')
    && /Point 1/.test(c.pdf.texte) && c.pdf.images === 1, j(c.pdf));
  verifier('… et aucun « Brouillon retrouvé » ensuite', c.bandeauApres === '', j(c.bandeauApres));
}

function partieRepli() {
  console.log('Lot 8c — retour arrière de la page : un brouillon de la page 10.2 rouvert par la PAGE DE REPLI (outils/repli-lot8)');
  serveurNeuf();
  const d = lancer('repli', scenarioRepli());
  verifier('la page de repli (sans points) propose le brouillon de la page 10.2', d.page.points === false && d.page.compteur === true && /Brouillon retrouvé/.test(d.bandeau), j([d.page, d.bandeau]));
  verifier('… rien n’est perdu : les points du brouillon sont versés en tête de « Notes et commentaires », la remarque et la photo du point reviennent',
    d.repli.objet === 'Avant le retour arrière' && d.repli.photos === 1
    && d.repli.texte === 'POINTS DU BROUILLON\n- Nouveau point tapé avant le retour arrière (réglé pendant la réunion)\n- Point A, complété avant le retour arrière\n(1 point(s) repris étaient clos ou rouverts dans ce brouillon : à refaire dans une prochaine note)\n\nRemarque déjà tapée', j(d.repli));
  const l = d.lignes[1] || {};
  verifier('… et la note envoyée depuis la page de repli arrive au serveur 11.1 : texte et photo dans le PDF, les points ouverts du chantier ne bougent pas',
    d.partie === true && /POINTS DU BROUILLON/.test(d.pdf.texte || '') && d.pdf.images === 1 && l.ouverts === '• Point A / • Point B' && l.remarque === '', j([d.pdf, d.lignes]));
}

// LOUE_PARTIES=points,droits,repli,ancien : ne lancer que certaines parties (mise au point)
const PARTIES = (process.env.LOUE_PARTIES || 'points,droits,repli,ancien').split(',');
setTimeout(() => {
  try {
    if (PARTIES.indexOf('points') > -1) partiePoints();
    if (PARTIES.indexOf('droits') > -1) partieDroits();
    if (PARTIES.indexOf('repli') > -1) partieRepli();
    if (PARTIES.indexOf('ancien') > -1) partieAncienServeur();
  } catch (e) { echecs++; console.log('  ✗ ' + e.message); }
  spawnSync('playwright-cli', ['-s=loue-l8c', 'close'], { shell: true });
  site.kill(); faux.kill();
  fs.rmSync(dossier, { recursive: true, force: true });
  console.log(reussis + ' test(s) réussi(s)' + (echecs ? ' — DES TESTS ÉCHOUENT' : ''));
  if (echecs) process.exitCode = 1;
}, 2500);
