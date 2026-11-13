// Lot 3 — page « Notes » dans un VRAI Chrome, en largeur téléphone : node tests/lot3-page.test.js
// Demande playwright-cli (npm i -g @playwright/cli) et Python sur le PC ; sinon le test est sauté.
// Lance lui-même le site (http://127.0.0.1:8785) et le faux serveur (8786) : jamais la copie TEST, jamais la production.
// Les comptes et le mot de passe sont ceux du faux serveur local (tests/faux-serveur.js), jamais de vrais comptes.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { spawn, spawnSync } = require('child_process');

const racine = path.join(__dirname, '..');
const outil = spawnSync('playwright-cli', ['--version'], { shell: true, encoding: 'utf8' });
const python = spawnSync('python', ['--version'], { shell: true, encoding: 'utf8' });
if (outil.status !== 0 || python.status !== 0) { console.log('Lot 3, page : playwright-cli ou Python absent, test sauté'); process.exit(0); }

const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'loue-l3-'));
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

const SITE = 'http://127.0.0.1:8785/', SERVEUR = 'http://127.0.0.1:8786', API = SERVEUR + '/exec';
const site = spawn('python', ['-m', 'http.server', '8785', '--bind', '127.0.0.1', '--directory', racine], { stdio: 'ignore' });
const faux = spawn('node', [path.join(__dirname, 'faux-serveur.js'), '8786'], { stdio: 'ignore' });

function scenario() {
  return `async page => {
  const BASE = ${JSON.stringify(SITE)}, SERVEUR = ${JSON.stringify(SERVEUR)}, q = 'api=${API}&sw=1', MDP = 'Essai-' + '2026', PHOTO = ${JSON.stringify(PHOTO.replace(/\\/g, '/'))};
  const NOTES = BASE + 'notes.html?' + q + '&chantier=CHANTIER%20TEST%201';
  const ctx = page.context(), r = {};
  page.on('dialog', d => d.accept().catch(() => {}));
  const file = () => page.evaluate(() => LOUE.stockage.tout('file').then(l => l.filter(e => e.etat !== 'erreur').length));
  const attendreFileVide = async () => { for (let i = 0; i < 40; i++) { await page.waitForTimeout(500); if (!(await file())) return; } };
  const connecter = id => page.evaluate(a => { LOUE.deconnecter(); return LOUE.connexion(a[0], a[1]).then(x => x.code); }, [id, MDP]);
  const serveur = () => page.evaluate(u => fetch(u + '/etat').then(x => x.json()), SERVEUR);
  const reglage = m => page.evaluate(u => fetch(u).then(x => x.text()), SERVEUR + '/reglage?mode=' + m);
  const etat = () => page.evaluate(() => { const visible = id => getComputedStyle(document.getElementById(id)).display !== 'none'; return {
    cartes: document.querySelectorAll('#liste .note').length, attente: document.querySelectorAll('#liste .pastille.orange').length,
    faites: document.querySelectorAll('#liste .note.faite').length, nouveau: document.querySelectorAll('#liste .pastille.rouge').length,
    info: document.getElementById('info').textContent, vide: (document.querySelector('#liste .vide') || {}).textContent || '',
    texte: document.getElementById('liste').textContent, saisie: document.getElementById('saisie-texte').value,
    saisieCachee: !visible('saisie'), photosSaisie: document.querySelectorAll('#saisie-photos img').length,
    boutonsInactifs: document.querySelectorAll('#liste .note-actions button:disabled').length, boutons: document.querySelectorAll('#liste .note-actions button').length,
    modifier: Array.from(document.querySelectorAll('#liste .note-actions button')).filter(b => b.textContent === 'Modifier').length,
    outils: visible('outils'), filtres: visible('filtres'),
    xss: window.__xss || 0, dangereux: document.querySelectorAll('#liste img[onerror], #liste script, #liste iframe, #liste .note-texte *').length,
    largeur: document.documentElement.scrollWidth <= innerWidth, premier: (document.querySelector('#liste .note .note-texte') || {}).textContent || '',
    pied: (document.querySelector('#liste .note .note-pied') || {}).textContent || '' }; });
  const clic = (texte, n) => page.evaluate(a => { const b = Array.from(document.querySelectorAll('#liste button, #corbeille button')).filter(x => x.textContent.indexOf(a[0]) === 0)[a[1] || 0]; if (b) b.click(); return !!b; }, [texte, n || 0]);

  await ctx.setOffline(false);
  await page.goto(BASE + 'index.html?' + q);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => 1));
  await page.reload(); await page.waitForTimeout(1500);
  await page.evaluate(async () => { for (const e of await LOUE.stockage.tout('file')) await LOUE.abandonner(e.id); });
  r.connexion = await connecter('poseur1');

  // 1. Page vierge, puis une note écrite HORS RÉSEAU, avec une photo et un texte hostile
  await page.goto(NOTES); await page.waitForTimeout(2500);
  r.vierge = await etat();
  await ctx.setOffline(true);
  await page.fill('#saisie-texte', 'Cales de 5 <b>gras</b> <img src=x onerror="window.__xss=1">');
  await page.setInputFiles('#photo-cam', PHOTO); await page.waitForTimeout(2500);
  // 2. l'appli se ferme avant « Ajouter » : la saisie en cours est retrouvée, sans question
  await page.reload(); await page.waitForTimeout(3000);
  r.saisieRetrouvee = await etat();
  await page.evaluate(() => ajouter()); await page.waitForTimeout(2500);
  r.horsReseau = await etat(); r.horsReseau.file = await file();
  // 3. le réseau revient : la note part toute seule
  await ctx.setOffline(false);
  await page.evaluate(() => LOUE.viderFile(true)); await attendreFileVide(); await page.waitForTimeout(2500);
  r.envoyee = await etat();
  r.message = await page.evaluate(() => (document.getElementById('loue-message') || {}).textContent || '');
  r.serveur1 = (await serveur()).notes.length - 1;
  // 4. la photo se charge à la demande
  await clic('📷 Voir la photo'); await page.waitForTimeout(2500);
  r.photo = await page.evaluate(() => document.querySelectorAll('#liste .note-photos img').length);
  // 5. « Fait », puis modification par l'auteur
  await clic('Marquer « Fait »'); await page.waitForTimeout(3000);
  r.fait = await etat();
  await clic('Modifier'); await page.waitForTimeout(500);
  await page.fill('.note-edit', 'TEXTE EN COURS DE FRAPPE');
  await page.evaluate(() => { charger(); majAttente(true); }); await page.waitForTimeout(3000);   // la liste est relue pendant la frappe
  r.frappe = await page.evaluate(() => (document.querySelector('.note-edit') || {}).value || '(zone disparue)');
  await page.fill('.note-edit', 'Cales de 8'); await clic('Enregistrer'); await page.waitForTimeout(3500);
  r.modifiee = await etat();
  // 6. deux gestes HORS RÉSEAU sur la même note (annuler « Fait », puis « Fait ») : ils partent dans l'ordre
  await ctx.setOffline(true);
  await clic('✓ Fait'); await page.waitForTimeout(1200);
  r.defaitHorsReseau = await etat();
  await clic('Marquer « Fait »'); await page.waitForTimeout(1200);
  r.deuxGestes = await file();
  // 7. hors réseau, après rechargement : la dernière liste, avec sa date, et les gestes en attente par-dessus
  await page.reload(); await page.waitForTimeout(3000);
  r.listeHorsReseau = await etat();
  await ctx.setOffline(false);
  await page.evaluate(() => LOUE.viderFile(true)); await attendreFileVide(); await page.waitForTimeout(2500);
  r.apresDeuxGestes = (await serveur()).notes.slice(1).map(l => [l[5], l[7]]);
  // 7 bis. AVEC du réseau : le serveur refuse passagèrement (panne), deux gestes attendent ; le plus ancien est reporté d'une heure,
  //        le plus récent est prêt : il ne doit PAS partir avant l'autre
  await reglage('panne');
  await clic('✓ Fait'); await page.waitForTimeout(2000);
  await clic('Marquer « Fait »'); await page.waitForTimeout(2000);
  await page.evaluate(async () => { const l = (await LOUE.stockage.tout('file')).sort((a, b) => a.cree - b.cree);
    l.forEach((e, i) => { e.prochainEssai = i ? 0 : Date.now() + 3600000; e.attenteReseau = false; e.aConfirmer = false; e.message = 'Serveur occupé'; });
    for (const e of l) await LOUE.stockage.ecrire('file', e); });
  await reglage('normal');
  await page.evaluate(() => LOUE.viderFile()); await page.waitForTimeout(3000);
  r.ordreRetenu = { file: await file(), serveur: (await serveur()).notes.slice(1).map(l => l[7]) };
  await page.evaluate(() => LOUE.viderFile(true)); await attendreFileVide(); await page.waitForTimeout(2000);
  r.ordreRetenu.apres = (await serveur()).notes.slice(1).map(l => l[7]);
  // 8. réseau lent (6 s par réponse) : la page reste utilisable, puis la liste arrive
  await reglage('lent');
  await page.reload(); await page.waitForTimeout(1500);
  r.lentAvant = await etat();
  await page.waitForTimeout(8000);
  r.lentApres = await etat();
  await reglage('normal');

  // 9. téléphone partagé : poseur1 laisse une note en attente et une saisie commencée ; poseur2 se connecte
  await ctx.setOffline(true);
  await page.fill('#saisie-texte', 'NOTE EN ATTENTE DE POSEUR1'); await page.evaluate(() => ajouter()); await page.waitForTimeout(2000);
  await page.fill('#saisie-texte', 'SAISIE SECRETE DE POSEUR1'); await page.waitForTimeout(1200);
  await ctx.setOffline(false);
  r.connexion2 = await connecter('poseur2'); await page.waitForTimeout(3500);
  r.poseur2Premier = await etat();   // première fois qu'il voit ce chantier : la note du premier est « nouvelle »
  await page.reload(); await page.waitForTimeout(3000);
  r.poseur2 = await etat(); r.poseur2.file = await file();
  r.serveurPoseur2 = (await serveur()).notes.slice(1).map(l => l[5]);
  await ctx.setOffline(true); await page.reload(); await page.waitForTimeout(3000);
  r.poseur2HorsReseau = await etat();
  await ctx.setOffline(false);
  // … poseur1 se reconnecte : sa note part, sous SON nom
  r.connexion1 = await connecter('poseur1'); await attendreFileVide(); await page.waitForTimeout(2000);
  r.apresRetour = (await serveur()).notes.slice(1).map(l => [l[2], l[5]]);

  // 10. conducteur : tout modifiable, suppression, corbeille, restauration, export PDF
  // 9 bis. poseur1 laisse un geste en attente sur une note ; poseur2 fait un geste sur la MÊME note : le sien part
  await ctx.setOffline(true);
  await page.goto(NOTES); await page.waitForTimeout(2500);
  await clic('✓ Fait'); await page.waitForTimeout(1200);          // poseur1 annule « Fait » sur « Cales de 8 », hors réseau
  await ctx.setOffline(false);
  await connecter('poseur2'); await page.waitForTimeout(3000);
  await page.reload(); await page.waitForTimeout(3000);
  await page.evaluate(() => { const c = Array.from(document.querySelectorAll('#liste .note')).find(x => x.textContent.indexOf('NOTE EN ATTENTE') > -1); c.querySelector('.btn-fait').click(); });
  await page.waitForTimeout(4000);
  r.partage = { fait: (await serveur()).notes.slice(1).map(l => [l[5], l[7]]), file: await file() };
  await connecter('poseur1'); await attendreFileVide(); await page.waitForTimeout(1500);
  r.partage.apres = (await serveur()).notes.slice(1).map(l => [l[5], l[7]]);
  r.connexion3 = await connecter('conducteur1');
  await page.goto(NOTES); await page.waitForTimeout(3000);
  r.conducteur = await etat();
  // les questions « Supprimer ? » et « Fabriquer le PDF ? » reçoivent « oui » (l'outil de test bloque sur une vraie fenêtre)
  await page.evaluate(() => { window.confirm = () => true; });
  await clic('Supprimer'); await page.waitForTimeout(3500);
  r.apresSuppression = await etat();
  await page.evaluate(() => basculerCorbeille()); await page.waitForTimeout(2500);
  r.corbeille = await page.evaluate(() => ({ cartes: document.querySelectorAll('#corbeille .note').length, texte: document.getElementById('corbeille').textContent }));
  await clic('↩ Restaurer'); await page.waitForTimeout(4000);
  r.apresRestauration = await etat();
  await page.evaluate(() => exporter()); await page.waitForTimeout(3000);
  r.pdf = await page.evaluate(() => (document.getElementById('loue-message') || {}).textContent || '');

  // 11. vue « Tous chantiers » : conducteur seulement, recherche faite par le serveur
  await page.goto(BASE + 'notes.html?' + q); await page.waitForTimeout(3000);
  r.tous = await etat();
  await page.fill('#f-recherche', 'cales'); await page.waitForTimeout(2500);
  r.recherche = await etat();
  // « tout marquer comme lu » : le chiffre rouge de l'accueil du conducteur repart de zéro
  await page.evaluate(() => toutMarquerLu()); await page.waitForTimeout(3000);
  r.toutLu = await page.evaluate(() => LOUE.notes.nouvelles().then(d => d.total));
  await connecter('poseur1'); await page.reload(); await page.waitForTimeout(3000);
  r.tousPoseur = await etat();
  // une note de plus, écrite par poseur1 après la dernière visite de poseur2 (pour le chiffre rouge de l'accueil)
  await page.goto(NOTES); await page.waitForTimeout(2500);
  await page.fill('#saisie-texte', 'Note pour le badge'); await page.evaluate(() => ajouter()); await attendreFileVide(); await page.waitForTimeout(1500);

  // 12. accueil : badge « notes nouvelles » pour poseur2 (les notes de poseur1 arrivées depuis sa visite)
  await page.goto(BASE + 'index.html?' + q); await page.waitForTimeout(1500);   // depuis l'accueil : se connecter sur la page des notes les marquerait « vues »
  await connecter('poseur2');
  await page.reload(); await page.waitForTimeout(4000);
  r.badge = await page.evaluate(() => ({ carte: (document.querySelector('.chantier-card .badge-notes') || {}).textContent || '',
    tuileConducteur: document.getElementById('tuile-notes-accueil').hidden }));
  await page.evaluate(() => { const c = document.querySelector('.chantier-card'); if (c) c.click(); }); await page.waitForTimeout(800);
  r.badge.tuile = await page.evaluate(() => ({ visible: !document.getElementById('tuile-notes').hidden, badge: document.getElementById('badge-notes').textContent }));

  // 13. sans compte : rien
  await page.evaluate(() => LOUE.deconnecter());
  await page.goto(NOTES); await page.waitForTimeout(2500);
  r.sansCompte = await etat();
  return JSON.stringify(r);
}`;
}

function lancer() {
  const f = path.join(dossier, 'scenario.js');
  fs.writeFileSync(f, scenario());
  spawnSync('playwright-cli', ['-s=loue-l3', 'close'], { shell: true });
  spawnSync('playwright-cli', ['-s=loue-l3', 'open', '--browser=chrome', '--mobile', 'about:blank'], { shell: true, encoding: 'utf8' });
  const sortie = spawnSync('playwright-cli', ['-s=loue-l3'].concat(process.env.LOUE_DEBUG ? [] : ['--raw'], ['run-code', '--filename=' + f]), { shell: true, encoding: 'utf8', timeout: 400000 });
  // Pour comprendre un échec : LOUE_DEBUG=<fichier> garde la sortie brute du navigateur et le scénario joué
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
  if (cond) { reussis++; console.log('  ✓ ' + nom); } else { echecs++; console.log('  ✗ ' + nom + '\n    ' + String(detail).slice(0, 900)); }
}
setTimeout(() => {
  try {
    console.log('Lot 3 — page « Notes » dans un vrai Chrome, largeur téléphone (service worker actif, faux serveur)');
    const r = lancer(), j = x => JSON.stringify(x);
    verifier('page vierge : saisie visible en bas, aucune note, pas de défilement horizontal', r.connexion === 'CONNECTE' && r.vierge.cartes === 0 && !r.vierge.saisieCachee
      && /Écrivez la première/.test(r.vierge.vide) && r.vierge.largeur === true && r.vierge.filtres === false && r.vierge.outils === false, j(r.vierge));
    verifier('saisie en cours (texte et photo) retrouvée après fermeture, hors réseau, sans question', /^Cales de 5/.test(r.saisieRetrouvee.saisie) && r.saisieRetrouvee.photosSaisie === 1, j(r.saisieRetrouvee));
    verifier('note écrite hors réseau : affichée tout de suite « en attente », boutons inactifs, saisie vidée, rangée dans le téléphone',
      r.horsReseau.cartes === 1 && r.horsReseau.attente === 1 && r.horsReseau.boutons > 0 && r.horsReseau.boutonsInactifs === r.horsReseau.boutons
      && r.horsReseau.saisie === '' && r.horsReseau.photosSaisie === 0 && r.horsReseau.file === 1, j(r.horsReseau));
    verifier('au retour du réseau elle part toute seule : une ligne sur le serveur, plus de « en attente », message sans alerte « aucun mail »',
      r.serveur1 === 1 && r.envoyee.cartes === 1 && r.envoyee.attente === 0 && !/aucun mail/.test(r.message), j([r.serveur1, r.envoyee, r.message]));
    verifier('un texte hostile s’affiche comme du texte, jamais comme du code', r.envoyee.xss === 0 && r.envoyee.dangereux === 0
      && r.envoyee.premier.indexOf('<b>gras</b> <img src=x onerror=') > -1 && r.envoyee.largeur === true, j(r.envoyee));
    verifier('la photo de la note se charge à la demande', r.photo === 1, j(r.photo));
    verifier('« Fait » : la note est marquée, avec le nom', r.fait.faites === 1 && /Fait par Thomas TEST/.test(r.fait.pied), j(r.fait));
    verifier('une modification en cours de frappe n’est pas écrasée quand la liste est relue', r.frappe === 'TEXTE EN COURS DE FRAPPE', j(r.frappe));
    verifier('modification par l’auteur : nouveau texte, « Modifiée par »', r.modifiee.premier === 'Cales de 8' && /Modifiée par Thomas TEST/.test(r.modifiee.pied), j(r.modifiee));
    verifier('deux gestes hors réseau sur la même note : affichés tout de suite, deux éléments en file', r.defaitHorsReseau.faites === 0 && r.defaitHorsReseau.attente === 1 && r.deuxGestes === 2, j([r.defaitHorsReseau, r.deuxGestes]));
    verifier('le geste le plus ancien est retardé : le plus récent sur la même note attend son tour (rien ne part dans le désordre)',
      r.ordreRetenu.file === 2 && j(r.ordreRetenu.serveur) === j(['Oui']) && j(r.ordreRetenu.apres) === j(['Oui']), j(r.ordreRetenu));
    verifier('hors réseau après rechargement : dernière liste avec sa date, gestes en attente appliqués', r.listeHorsReseau.cartes === 1 && /Liste du .* gardée dans le téléphone/.test(r.listeHorsReseau.info)
      && r.listeHorsReseau.faites === 1 && r.listeHorsReseau.attente === 1, j(r.listeHorsReseau));
    verifier('… ils arrivent dans l’ordre : la note est « Fait » sur le serveur', j(r.apresDeuxGestes) === j([['Cales de 8', 'Oui']]), j(r.apresDeuxGestes));
    verifier('réseau lent : la liste gardée s’affiche tout de suite, la saisie reste utilisable, puis la liste du serveur arrive',
      !r.lentAvant.saisieCachee && r.lentAvant.cartes === 1 && /gardée dans le téléphone/.test(r.lentAvant.info) && r.lentApres.cartes === 1 && r.lentApres.info === '', j([r.lentAvant, r.lentApres]));
    verifier('téléphone partagé : le second poseur ne voit ni la note en attente ni la saisie du premier', r.connexion2 === 'CONNECTE' && r.poseur2.cartes === 1 && r.poseur2.attente === 0
      && r.poseur2.saisie === '' && r.poseur2.texte.indexOf('POSEUR1') < 0 && r.poseur2.modifier === 0, j(r.poseur2));
    verifier('… la note du premier est marquée « nouveau » à sa première visite, plus à la suivante', r.poseur2Premier.nouveau === 1 && r.poseur2.nouveau === 0, j([r.poseur2Premier, r.poseur2]));
    verifier('… la note en attente du premier ne part pas sous le nom du second (elle reste dans le téléphone)', r.poseur2.file === 1 && j(r.serveurPoseur2) === j(['Cales de 8']), j([r.poseur2.file, r.serveurPoseur2]));
    verifier('… hors réseau non plus', r.poseur2HorsReseau.texte.indexOf('POSEUR1') < 0 && r.poseur2HorsReseau.saisie === '' && r.poseur2HorsReseau.attente === 0, j(r.poseur2HorsReseau));
    verifier('… elle part quand le premier se reconnecte, sous SON nom', r.connexion1 === 'CONNECTE' && j(r.apresRetour) === j([['poseur1', 'Cales de 8'], ['poseur1', 'NOTE EN ATTENTE DE POSEUR1']]), j(r.apresRetour));
    verifier('téléphone partagé : le geste resté en attente d’un autre compte ne bloque pas le mien sur la même note', r.partage.file === 1
      && j(r.partage.fait) === j([['Cales de 8', 'Oui'], ['NOTE EN ATTENTE DE POSEUR1', 'Oui']]) && j(r.partage.apres) === j([['Cales de 8', ''], ['NOTE EN ATTENTE DE POSEUR1', 'Oui']]), j(r.partage));
    verifier('conducteur : peut modifier toutes les notes, outils « Corbeille » et « PDF » visibles', r.connexion3 === 'CONNECTE' && r.conducteur.cartes === 2 && r.conducteur.modifier === 2 && r.conducteur.outils === true, j(r.conducteur));
    verifier('suppression : la note quitte la liste et se retrouve dans la corbeille', r.apresSuppression.cartes === 1 && r.corbeille.cartes === 1 && /Supprimée par Sébastien TEST/.test(r.corbeille.texte), j([r.apresSuppression, r.corbeille]));
    verifier('restauration : la note revient dans la liste', r.apresRestauration.cartes === 2, j(r.apresRestauration));
    verifier('export PDF : message « PDF rangé dans le dossier du chantier »', /PDF rangé dans le dossier du chantier : NOTES DE CHANTIER/.test(r.pdf), r.pdf);
    verifier('vue « Tous chantiers » (conducteur) : filtres visibles, pas de saisie ; la recherche est faite par le serveur', r.tous.cartes === 2 && r.tous.filtres === true && r.tous.saisieCachee === true
      && r.recherche.cartes === 1 && /Cales de 8/.test(r.recherche.texte), j([r.tous, r.recherche]));
    verifier('« Tout marquer comme lu » remet à zéro les notes nouvelles du conducteur', r.toutLu === 0, j(r.toutLu));
    verifier('vue « Tous chantiers » refusée à un poseur', r.tousPoseur.cartes === 0 && /réservée aux conducteurs/.test(r.tousPoseur.info), j(r.tousPoseur));
    verifier('accueil : badge de notes nouvelles sur le chantier et sur la tuile « Notes » ; pas de tuile « tous chantiers » pour un poseur',
      r.badge.carte === '1' && r.badge.tuile.visible === true && r.badge.tuile.badge === '1' && r.badge.tuileConducteur === true, j(r.badge));
    verifier('sans compte : rien n’est affiché, connexion demandée, pas de saisie', r.sansCompte.cartes === 0 && /Connectez-vous/.test(r.sansCompte.vide) && r.sansCompte.saisieCachee === true, j(r.sansCompte));
  } catch (e) { echecs++; console.log('  ✗ ' + e.message); }
  spawnSync('playwright-cli', ['-s=loue-l3', 'close'], { shell: true });
  site.kill(); faux.kill();
  fs.rmSync(dossier, { recursive: true, force: true });
  console.log(reussis + ' test(s) réussi(s)' + (echecs ? ' — DES TESTS ÉCHOUENT' : ''));
  if (echecs) process.exitCode = 1;
}, 2500);
