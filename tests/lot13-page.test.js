// Lot 13 — « Mes notes » et « Garder pour plus tard » dans un VRAI Chrome, en largeur téléphone :
//   node tests/lot13-page.test.js
// Demande playwright-cli (npm i -g @playwright/cli) et Python sur le PC ; sinon le test est sauté.
// Lance lui-même le site (http://127.0.0.1:8799) et le faux serveur (8800) : jamais la copie TEST, jamais la production.
// Les comptes et le mot de passe sont ceux du faux serveur local (tests/faux-serveur.js), jamais de vrais comptes.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const racine = path.join(__dirname, '..');
const outil = spawnSync('playwright-cli', ['--version'], { shell: true, encoding: 'utf8' });
const python = spawnSync('python', ['--version'], { shell: true, encoding: 'utf8' });
if (outil.status !== 0 || python.status !== 0) { console.log('Lot 13, page : playwright-cli ou Python absent, test sauté'); process.exit(0); }

const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'loue-l13-'));
const SITE = 'http://127.0.0.1:8799/', SERVEUR = 'http://127.0.0.1:8800', API = SERVEUR + '/exec';
const site = spawn('python', ['-m', 'http.server', '8799', '--bind', '127.0.0.1', '--directory', racine], { stdio: 'ignore' });
const faux = spawn('node', [path.join(__dirname, 'faux-serveur.js'), '8800'], { stdio: 'ignore' });

function scenario() {
  return `async page => {
  const BASE = ${JSON.stringify(SITE)}, SERVEUR = ${JSON.stringify(SERVEUR)}, q = 'api=${API}&sw=1', MDP = 'Essai-' + '2026';
  const MES = BASE + 'mes-notes.html?' + q, NOTE = BASE + 'note-reunion.html?' + q + '&chantier=CHANTIER%20TEST%201';
  const ctx = page.context(), r = {};
  page.on('dialog', d => d.accept());   // les « confirm » de la page : on répond « OK »
  const connecter = id => page.evaluate(a => { LOUE.deconnecter(); return LOUE.connexion(a[0], a[1]).then(x => x.code); }, [id, MDP]);
  const serveur = () => page.evaluate(u => fetch(u + '/etat').then(x => x.json()).then(e => e.notes.slice(1).map(l => [l[2], l[3]])), SERVEUR);
  const file = () => page.evaluate(() => LOUE.stockage.tout('file').then(l => l.filter(e => e.etat !== 'erreur').length));
  const attendreFileVide = async () => { for (let i = 0; i < 40; i++) { await page.waitForTimeout(500); if (!(await file())) return; } };
  const ajouterNote = t => page.evaluate(a => LOUE.appeler({ action: 'fiche', id: LOUE.nouvelId('fiche'), saisiPar: LOUE.compte().profil.id,
    donnees: { type: 'note-chantier', chantier: 'CHANTIER TEST 1', texte: a } }, 30000).then(x => x.code), t);

  // ═══ « Mes notes » ═══
  const etatNotes = () => page.evaluate(() => {
    const lignes = sel => Array.from(document.querySelectorAll(sel + ' .el')).map(c => ({ texte: c.querySelector('.el-texte').firstChild ? c.querySelector('.el-texte').firstChild.textContent : '',
      info: (c.querySelector('.el-info') || {}).textContent || '', faite: c.classList.contains('faite'), attente: !!c.querySelector('.el-marque') }));
    const cases = Array.from(document.querySelectorAll('.case')).map(b => b.getBoundingClientRect());
    const f = document.getElementById('faites'), b = document.getElementById('btn-tous-notes');
    return { haut: lignes('#liste'), bas: lignes('#liste-faites'), faites: f.hidden ? '' : document.getElementById('faites-titre').textContent,
      info: document.getElementById('info').textContent, vide: (document.querySelector('#liste .vide') || {}).textContent || '',
      tousChantiers: !b.hidden, xss: window.__xss || 0, dangereux: document.querySelectorAll('#liste img, #liste script, #liste b').length,
      caseMin: cases.length ? Math.round(Math.min.apply(null, cases.map(x => Math.min(x.width, x.height)))) : 0,
      largeur: document.documentElement.scrollWidth <= innerWidth }; });
  const cocher = t => page.evaluate(a => { const c = Array.from(document.querySelectorAll('.el')).find(x => x.textContent.indexOf(a) > -1); if (c) c.querySelector('.case').click(); return !!c; }, t);

  await ctx.setOffline(false);
  await page.goto(BASE + 'index.html?' + q);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => 1));
  await page.reload(); await page.waitForTimeout(1500);
  r.connexion = await connecter('poseur1');
  await page.evaluate(async () => { for (const e of await LOUE.stockage.tout('file')) await LOUE.abandonner(e.id); });
  // 1. Aucune note encore
  await page.goto(MES); await page.waitForTimeout(2500);
  r.vide = await etatNotes();
  // 2. Deux notes du poseur 1 (dont un texte hostile), une du poseur 2 sur le même chantier
  r.ajouts = [await ajouterNote('Note un'), await ajouterNote('<b>gras</b> <img src=x onerror="window.__xss=1">')];
  await connecter('poseur2'); r.ajoutAutre = await ajouterNote('Note de Kévin');
  r.connexion1 = await connecter('poseur1');
  await page.goto(MES); await page.waitForTimeout(2500);
  r.liste = await etatNotes();
  // 3. Cocher dans la liste : la note reste barrée 3 s, puis descend dans « Faites » ; le serveur l'a
  await cocher('Note un'); await page.waitForTimeout(800);
  r.justeCochee = await etatNotes();
  await attendreFileVide(); await page.waitForTimeout(4200);
  r.cochee = await etatNotes();
  r.serveurCochee = await serveur();
  // 4. HORS RÉSEAU : la liste gardée s'affiche ; une case cochée attend dans le téléphone (⏳) et part au retour du réseau
  await ctx.setOffline(true);
  await page.goto(MES).catch(() => {}); await page.waitForTimeout(3000);
  r.horsReseau = await etatNotes();
  await cocher('gras'); await page.waitForTimeout(4200);
  r.horsReseauCochee = await etatNotes(); r.horsReseauCochee.file = await file();
  await ctx.setOffline(false);
  await page.evaluate(() => LOUE.viderFile()); await attendreFileVide(); await page.waitForTimeout(1500);
  r.serveurApresRetour = await serveur();
  // 5. Décocher depuis « Faites »
  await page.goto(MES); await page.waitForTimeout(2500);
  await page.evaluate(() => { document.getElementById('faites').open = true; }); await page.waitForTimeout(200);
  await cocher('Note un'); await attendreFileVide(); await page.waitForTimeout(1500);
  r.decochee = await etatNotes();
  // 6. L'accueil : la tuile « Notes » pour un poseur, sans chiffre rouge ; elle ouvre « Mes notes »
  await page.goto(BASE + 'index.html?' + q); await page.waitForTimeout(3000);
  r.tuile = await page.evaluate(() => { const t = document.getElementById('tuile-notes-accueil'); return { visible: !t.hidden && getComputedStyle(t).display !== 'none',
    titre: t.querySelector('.tile-title').firstChild.textContent, sous: t.querySelector('.tile-sub').textContent, badgeCache: document.getElementById('badge-notes-accueil').hidden }; });
  await page.evaluate(() => document.getElementById('tuile-notes-accueil').click()); await page.waitForTimeout(2000);
  r.tuileAdresse = page.url();
  // 7. Conducteur : seulement ses notes à lui, et le bouton vers la vue « tous chantiers » d'avant
  r.connexionC = await connecter('conducteur1');
  await page.goto(MES); await page.waitForTimeout(2500);
  r.conducteur = await etatNotes();
  // 8. Sans compte
  await page.evaluate(() => LOUE.deconnecter());
  await page.goto(MES); await page.waitForTimeout(2000);
  r.sansCompte = await etatNotes();

  // ═══ « Garder pour plus tard » (sur la note de réunion ; la brique est la même pour toutes les fiches) ═══
  r.connexionB = await connecter('poseur1');
  const viderBrouillons = () => page.evaluate(async () => {
    Object.keys(localStorage).filter(k => /^loue_brouillon_/.test(k)).forEach(k => localStorage.removeItem(k));
    for (const e of await LOUE.stockage.tout('brouillons')) await LOUE.stockage.supprimer('brouillons', e.cle);
    try { sessionStorage.clear(); } catch (e) {}
  });
  const ouvrirNote = async () => { await page.goto(NOTE); await page.waitForTimeout(2200); };
  const saisir = async (objet, texte) => { await page.fill('#meta-objet', objet); await page.fill('#meta-commentaires', texte); await page.waitForTimeout(5200); };
  const etatB = () => page.evaluate(async () => {
    const b = document.querySelector('.loue-brouillon:not(.loue-maj)'), p = document.querySelector('.loue-brouillons-pastille'), pan = document.getElementById('loue-brouillons-panneau');
    const liste = ((await LOUE.stockage.lire('brouillons', 'brouillon_note_mis_de_cote')) || {}).liste || [];
    const courant = await LOUE.stockage.lire('brouillons', 'brouillon_note');
    return { bandeau: b ? b.querySelector('span').textContent : '', boutons: b ? Array.from(b.querySelectorAll('button')).map(x => x.textContent) : [],
      pastille: p && !p.hidden ? p.textContent : '', objet: document.getElementById('meta-objet').value, texte: document.getElementById('meta-commentaires').value,
      panneau: pan ? Array.from(pan.querySelectorAll('.loue-brouillons-ligne')).map(l => l.querySelector('.loue-brouillons-texte').textContent) : null,
      garderEnCours: pan ? !!pan.querySelector('.loue-brouillons-garder') : null,
      liste: liste.map(e => [(e.champs['meta-objet'] || {}).v || '', e.garde ? 'gardé' : 'auto']), courant: courant ? ((courant.champs['meta-objet'] || {}).v || '') : null,
      message: (document.querySelector('#loue-message.visible') || {}).textContent || '',
      pastilleHaute: p && !p.hidden ? Math.round(p.getBoundingClientRect().height) : 0, largeur: document.documentElement.scrollWidth <= innerWidth };
  });
  const clic = sel => page.evaluate(s => { const e = document.querySelector(s); if (e) e.click(); return !!e; }, sel);
  const reprendre = objetVoulu => page.evaluate(async o => {
    const liste = ((await LOUE.stockage.lire('brouillons', 'brouillon_note_mis_de_cote')) || {}).liste || [];
    const rang = liste.filter(e => true).sort((a, b) => b.t - a.t).findIndex(e => ((e.champs['meta-objet'] || {}).v || '') === o);
    const b = document.querySelectorAll('#loue-brouillons-panneau .loue-brouillons-reprendre')[rang]; if (b) b.click(); return rang;
  }, objetVoulu);

  await ouvrirNote(); await viderBrouillons(); await ouvrirNote();
  // B1. On commence une fiche A : la ligne « Garder pour plus tard » apparaît
  await saisir('Réunion A', 'Texte A');
  r.b1 = await etatB();
  // B2. On rouvre la fiche : le bandeau propose trois choix ; « Garder pour plus tard » range A et laisse la fiche vide
  await ouvrirNote();
  r.b2Bandeau = await etatB();
  await clic('.loue-brouillon [data-garder]'); await page.waitForTimeout(1200);
  r.b2 = await etatB();
  // B3. On rouvre : A n'est plus reproposé par le bandeau, il attend dans « Brouillons gardés (1) »
  await ouvrirNote();
  r.b3 = await etatB();
  // B4. On fait une fiche B, puis on reprend A : B est gardé à son tour, A revient dans la fiche
  await saisir('Réunion B', 'Texte B');
  await clic('.loue-brouillons-pastille'); await page.waitForTimeout(600);
  r.b4Panneau = await etatB();
  await reprendre('Réunion A'); await page.waitForTimeout(4500);
  r.b4 = await etatB();
  // B5. « Garder la fiche en cours pour plus tard » : A est rangé de nouveau, la fiche repart vide ; deux brouillons gardés
  await page.waitForTimeout(4500);
  await clic('.loue-brouillons-pastille'); await page.waitForTimeout(600);
  await clic('.loue-brouillons-garder'); await page.waitForTimeout(4500);
  r.b5 = await etatB();
  // B6. Effacer un brouillon gardé (avec confirmation)
  await clic('.loue-brouillons-pastille'); await page.waitForTimeout(600);
  await clic('.loue-brouillons-effacer'); await page.waitForTimeout(1200);
  r.b6 = await etatB();
  // B7. Limite : 5 brouillons gardés. Le sixième est REFUSÉ, et rien n'est effacé (la fiche en cours reste à l'écran et dans le téléphone)
  await page.evaluate(async () => {
    const liste = Array.from({ length: 5 }, (_, i) => ({ cle: 'brouillon_note', t: Date.now() - (i + 1) * 60000, garde: true,
      champs: { 'meta-chantier': { v: 'CHANTIER TEST 1' }, 'meta-objet': { v: 'Gardé ' + (i + 1) } }, extra: { destinataires: [], photos: [] } }));
    localStorage.setItem('loue_brouillon_' + LOUE_CONFIG.env + '_note_mis_de_cote', JSON.stringify(liste));
    await LOUE.stockage.ecrire('brouillons', { cle: 'brouillon_note_mis_de_cote', liste: liste });
  });
  await ouvrirNote();
  await saisir('Réunion de trop', 'Texte de trop');
  await clic('.loue-brouillons-pastille'); await page.waitForTimeout(600);
  await clic('.loue-brouillons-garder'); await page.waitForTimeout(1500);
  r.b7 = await etatB();
  // … et « Reprendre » marche encore à la limite : la fiche en cours prend la place de celui qu'on reprend
  await reprendre('Gardé 3'); await page.waitForTimeout(4500);
  r.b7Reprise = await etatB();
  // B8. Un brouillon mis de côté TOUT SEUL (bandeau resté sans réponse) est toujours reproposé à l'ouverture, comme avant
  await viderBrouillons();
  await page.evaluate(async () => {
    const e = { cle: 'brouillon_note', t: Date.now() - 3600000, champs: { 'meta-chantier': { v: 'CHANTIER TEST 1' }, 'meta-objet': { v: 'Mis de côté tout seul' } }, extra: { destinataires: [], photos: [] } };
    localStorage.setItem('loue_brouillon_' + LOUE_CONFIG.env + '_note_mis_de_cote', JSON.stringify([e]));
    await LOUE.stockage.ecrire('brouillons', { cle: 'brouillon_note_mis_de_cote', liste: [e] });
  });
  await ouvrirNote();
  r.b8 = await etatB();
  await clic('.loue-brouillon [data-oui]'); await page.waitForTimeout(1500);
  r.b8Restaure = await etatB();
  await viderBrouillons();
  return JSON.stringify(r);
}`;
}

function lancer() {
  const f = path.join(dossier, 'scenario.js');
  fs.writeFileSync(f, scenario());
  spawnSync('playwright-cli', ['-s=loue-l13', 'close'], { shell: true });
  spawnSync('playwright-cli', ['-s=loue-l13', 'open', '--browser=chrome', '--mobile', 'about:blank'], { shell: true, encoding: 'utf8' });
  const sortie = spawnSync('playwright-cli', ['-s=loue-l13'].concat(process.env.LOUE_DEBUG ? [] : ['--raw'], ['run-code', '--filename=' + f]), { shell: true, encoding: 'utf8', timeout: 500000 });
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
  if (cond) { reussis++; console.log('  ✓ ' + nom); } else { echecs++; console.log('  ✗ ' + nom + '\n    ' + String(detail).slice(0, 1300)); }
}
setTimeout(() => {
  try {
    console.log('Lot 13 — « Mes notes » et « Garder pour plus tard » dans un vrai Chrome, largeur téléphone (service worker actif, faux serveur)');
    const r = lancer(), j = x => JSON.stringify(x);
    const HOSTILE = '<b>gras</b> <img src=x onerror="window.__xss=1">';
    console.log(' « Mes notes »');
    verifier('aucune note encore : la page dit comment en ajouter une', r.connexion === 'CONNECTE' && r.vide.haut.length === 0 && /Vous n’avez encore écrit aucune note/.test(r.vide.vide), j(r.vide));
    verifier('ses notes à lui seulement, la plus récente en haut, avec le chantier et la date ; pas celle d’un autre gars du même chantier',
      j(r.ajouts) === j(['ENREGISTRE', 'ENREGISTRE']) && r.ajoutAutre === 'ENREGISTRE' && j(r.liste.haut.map(n => n.texte)) === j([HOSTILE, 'Note un'])
      && r.liste.haut.every(n => /^CHANTIER TEST 1 — \d\d\/\d\d\/\d{4}$/.test(n.info)), j(r.liste));
    verifier('un texte hostile reste du texte ; case de 48 px au moins ; pas de défilement horizontal', r.liste.xss === 0 && r.liste.dangereux === 0 && r.liste.caseMin >= 48 && r.liste.largeur === true, j([r.liste.xss, r.liste.dangereux, r.liste.caseMin, r.liste.largeur]));
    verifier('cocher dans la liste : la note reste barrée à sa place, puis descend dans « Faites (1) » ; le bureau l’a',
      r.justeCochee.haut.some(n => n.texte === 'Note un' && n.faite) && j(r.cochee.haut.map(n => n.texte)) === j([HOSTILE]) && r.cochee.faites === 'Faites (1)'
      && r.serveurCochee.some(l => l[0] === 'Note un' && l[1] === 'Oui'), j([r.justeCochee.haut, r.cochee, r.serveurCochee]));
    verifier('hors réseau : la liste gardée s’affiche, avec sa date', r.horsReseau.haut.length === 1 && /gardée dans le téléphone/.test(r.horsReseau.info), j(r.horsReseau));
    verifier('… une case cochée sans réseau est gardée dans le téléphone, et part toute seule au retour du réseau', r.horsReseauCochee.file === 1 && r.horsReseauCochee.faites === 'Faites (2)'
      && r.serveurApresRetour.filter(l => l[1] === 'Oui').length === 2, j([r.horsReseauCochee, r.serveurApresRetour]));
    verifier('décocher depuis « Faites » : la note revient dans la liste', r.decochee.haut.some(n => n.texte === 'Note un' && !n.faite), j(r.decochee));
    verifier('accueil : la tuile « Notes » existe pour un poseur, sans chiffre rouge, et ouvre « Mes notes »', r.tuile.visible === true && r.tuile.titre === 'Notes'
      && /écrites/.test(r.tuile.sous) && r.tuile.badgeCache === true && /mes-notes\.html/.test(r.tuileAdresse), j([r.tuile, r.tuileAdresse]));
    verifier('conducteur : seulement ses notes à lui (aucune ici), et le bouton « Les notes de tous les chantiers »', r.connexionC === 'CONNECTE' && r.conducteur.haut.length === 0 && r.conducteur.tousChantiers === true
      && r.liste.tousChantiers === false, j([r.conducteur, r.liste.tousChantiers]));
    verifier('sans compte : rien n’est affiché, connexion demandée', r.sansCompte.haut.length === 0 && /Connectez-vous/.test(r.sansCompte.vide), j(r.sansCompte));

    console.log(' « Garder pour plus tard »');
    verifier('une fiche commencée : la ligne « 📝 Garder pour plus tard » apparaît en haut (48 px au moins)', r.b1.pastille === '📝 Garder pour plus tard' && r.b1.pastilleHaute >= 48 && r.b1.largeur === true, j(r.b1));
    verifier('à la réouverture : le bandeau propose Restaurer, Garder pour plus tard, Repartir à zéro ; la ligne du haut est cachée pendant ce temps',
      /Brouillon retrouvé/.test(r.b2Bandeau.bandeau) && j(r.b2Bandeau.boutons) === j(['Restaurer', 'Garder pour plus tard', 'Repartir à zéro']) && r.b2Bandeau.pastille === '', j(r.b2Bandeau));
    verifier('« Garder pour plus tard » : la fiche reste vide, le brouillon est rangé (gardé exprès), il n’est plus « le brouillon courant »',
      r.b2.bandeau === '' && r.b2.objet === '' && j(r.b2.liste) === j([['Réunion A', 'gardé']]) && r.b2.courant === null && r.b2.pastille === '📝 Brouillons gardés (1)' && /Brouillon gardé/.test(r.b2.message), j(r.b2));
    verifier('… à l’ouverture suivante, il n’est PAS reproposé par le bandeau : il attend dans « Brouillons gardés (1) »', r.b3.bandeau === '' && r.b3.objet === '' && r.b3.pastille === '📝 Brouillons gardés (1)', j(r.b3));
    verifier('la liste montre le chantier, la date et la date limite ; elle propose de garder la fiche en cours', r.b4Panneau.panneau && r.b4Panneau.panneau.length === 1
      && /^CHANTIER TEST 1du \d\d\/\d\d à \d\dh\d\d — gardé jusqu’au \d\d\/\d\d$/.test(r.b4Panneau.panneau[0]) && r.b4Panneau.garderEnCours === true, j(r.b4Panneau));
    verifier('« Reprendre » A alors que B est à l’écran : B est gardé à son tour, A revient dans la fiche ; rien n’est écrasé',
      r.b4.objet === 'Réunion A' && r.b4.texte === 'Texte A' && j(r.b4.liste) === j([['Réunion B', 'gardé']]) && r.b4.bandeau === '', j(r.b4));
    verifier('« Garder la fiche en cours pour plus tard » : la fiche repart vide, deux brouillons gardés, aucun bandeau', r.b5.objet === '' && r.b5.bandeau === ''
      && j(r.b5.liste.map(l => l[0]).sort()) === j(['Réunion A', 'Réunion B']) && r.b5.liste.every(l => l[1] === 'gardé') && r.b5.pastille === '📝 Brouillons gardés (2)', j(r.b5));
    verifier('« Effacer » un brouillon gardé (après confirmation) : il sort de la liste, l’autre reste', r.b6.liste.length === 1 && r.b6.panneau && r.b6.panneau.length === 1, j(r.b6));
    verifier('limite de 5 : le sixième est REFUSÉ avec un message clair ; la fiche en cours reste à l’écran et dans le téléphone', /Déjà 5 brouillons gardés/.test(r.b7.message)
      && r.b7.objet === 'Réunion de trop' && r.b7.liste.length === 5 && r.b7.courant === 'Réunion de trop', j(r.b7));
    verifier('… « Reprendre » marche à la limite : la fiche en cours prend la place du brouillon repris (toujours 5, aucun perdu)', r.b7Reprise.objet === 'Gardé 3'
      && r.b7Reprise.liste.length === 5 && r.b7Reprise.liste.some(l => l[0] === 'Réunion de trop') && !r.b7Reprise.liste.some(l => l[0] === 'Gardé 3'), j(r.b7Reprise));
    verifier('un brouillon mis de côté TOUT SEUL est toujours reproposé à l’ouverture, et se restaure comme avant', /Brouillon mis de côté/.test(r.b8.bandeau)
      && r.b8Restaure.objet === 'Mis de côté tout seul' && r.b8Restaure.liste.length === 0, j([r.b8, r.b8Restaure]));
  } catch (e) { echecs++; console.log('  ✗ ' + e.message); }
  spawnSync('playwright-cli', ['-s=loue-l13', 'close'], { shell: true });
  site.kill(); faux.kill();
  fs.rmSync(dossier, { recursive: true, force: true });
  console.log(reussis + ' test(s) réussi(s)' + (echecs ? ' — DES TESTS ÉCHOUENT' : ''));
  if (echecs) process.exitCode = 1;
}, 2500);
