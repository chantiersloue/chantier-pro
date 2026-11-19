// Lot 8d — page « Récapitulatif des notes » dans un VRAI Chrome, en largeur téléphone :
//   node tests/lot8d-page.test.js
// Demande playwright-cli (npm i -g @playwright/cli) et Python sur le PC ; sinon le test est sauté.
// Lance lui-même le site (http://127.0.0.1:8795) et le faux serveur (8796) : jamais la copie TEST, jamais la production.
// Les comptes et le mot de passe sont ceux du faux serveur local (tests/faux-serveur.js), jamais de vrais comptes.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const racine = path.join(__dirname, '..');
const outil = spawnSync('playwright-cli', ['--version'], { shell: true, encoding: 'utf8' });
const python = spawnSync('python', ['--version'], { shell: true, encoding: 'utf8' });
if (outil.status !== 0 || python.status !== 0) { console.log('Lot 8d, page : playwright-cli ou Python absent, test sauté'); process.exit(0); }

const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'loue-l8d-'));
const SITE = 'http://127.0.0.1:8795/', SERVEUR = 'http://127.0.0.1:8796', API = SERVEUR + '/exec';
const site = spawn('python', ['-m', 'http.server', '8795', '--bind', '127.0.0.1', '--directory', racine], { stdio: 'ignore' });
const faux = spawn('node', [path.join(__dirname, 'faux-serveur.js'), '8796'], { stdio: 'ignore' });

function scenario() {
  return `async page => {
  const BASE = ${JSON.stringify(SITE)}, SERVEUR = ${JSON.stringify(SERVEUR)}, q = 'api=${API}&sw=1', MDP = 'Essai-' + '2026';
  const RECAP = BASE + 'recap-notes.html?' + q + '&chantier=CHANTIER%20TEST%201';
  const ctx = page.context(), r = {};
  const connecter = id => page.evaluate(a => { LOUE.deconnecter(); return LOUE.connexion(a[0], a[1]).then(x => x.code); }, [id, MDP]);
  const reglage = m => page.evaluate(u => fetch(u).then(x => x.text()), SERVEUR + '/reglage?mode=' + m);
  const note = (date, objet, texte) => page.evaluate(a => LOUE.appeler({ action: 'fiche', id: LOUE.nouvelId('fiche'), donnees: { type: 'note', chantier: 'CHANTIER TEST 1',
    auteur: 'Thomas TEST', date: a[0], objet: a[1], remarques: a[2], commentaires: a[2], destinataires: [], photosBase64: [] } }, 30000).then(x => x.code), [date, objet, texte]);
  const etat = () => page.evaluate(() => ({
    titres: Array.from(document.querySelectorAll('.rn-carte .rn-date')).map(e => e.textContent),
    textes: Array.from(document.querySelectorAll('.rn-carte .rn-texte')).map(e => e.textContent),
    auteurs: Array.from(document.querySelectorAll('.rn-carte .rn-auteur')).map(e => e.textContent),
    info: document.getElementById('info').textContent, entete: document.getElementById('entete').textContent,
    vide: (document.querySelector('#liste .vide') || {}).textContent || '',
    xss: window.__xss || 0, dangereux: document.querySelectorAll('#liste img, #liste script, #liste iframe, #liste b').length,
    largeur: document.documentElement.scrollWidth <= innerWidth,
    police: (() => { const t = document.querySelector('.rn-texte'); return t ? parseFloat(getComputedStyle(t).fontSize) : 0; })(),
    retour: (() => { const a = document.querySelector('.topbar a'); const b = a.getBoundingClientRect(); return { href: a.getAttribute('href'), haut: Math.round(b.height) }; })(),
    preWrap: (() => { const t = document.querySelector('.rn-texte'); return t ? getComputedStyle(t).whiteSpace : ''; })() }));

  await ctx.setOffline(false);
  await page.goto(BASE + 'index.html?' + q);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => 1));
  await page.reload(); await page.waitForTimeout(1500);
  r.connexion = await connecter('poseur1');

  // 1. Aucune note de réunion encore
  await page.goto(RECAP); await page.waitForTimeout(2500);
  r.vide = await etat();
  // 2. Trois notes envoyées (dont un texte hostile et un texte sur plusieurs lignes), dans le désordre des dates
  r.envois = [await note('05/11/2026', 'Réunion A', 'Premier texte'),
    await note('19/11/2026', 'Réunion C', '<b>gras</b> <img src=x onerror="window.__xss=1">'),
    await note('12/11/2026', '', 'Ligne 1\\nLigne 2\\n- un tiret')];
  await page.goto(RECAP); await page.waitForTimeout(2500);
  r.liste = await etat();
  // 3. Depuis l'accueil : la tuile de l'écran du chantier ouvre cette page
  await page.goto(BASE + 'index.html?' + q); await page.waitForTimeout(2500);
  await page.evaluate(() => { const c = document.querySelector('.chantier-card'); if (c) c.click(); }); await page.waitForTimeout(800);
  r.tuile = await page.evaluate(() => { const t = document.getElementById('tuile-recap'); const b = t.getBoundingClientRect();
    return { visible: !t.hidden && getComputedStyle(t).display !== 'none', titre: t.querySelector('.tile-title').textContent, haut: Math.round(b.height) }; });
  await page.evaluate(() => document.getElementById('tuile-recap').click()); await page.waitForTimeout(2500);
  r.depuisTuile = { adresse: page.url(), titres: (await etat()).titres.length };
  // 4. HORS RÉSEAU, après rechargement : la dernière liste est gardée, avec sa date
  await ctx.setOffline(true);
  await page.goto(RECAP).catch(() => {}); await page.waitForTimeout(3000);
  r.horsReseau = await etat();
  await ctx.setOffline(false);
  // 5. Réseau lent : la liste gardée s'affiche tout de suite
  await reglage('lent');
  await page.goto(RECAP); await page.waitForTimeout(900);
  r.lentAvant = await etat();
  await reglage('normal'); await page.waitForTimeout(9000);
  r.lentApres = await etat();
  // 6. Téléphone partagé : un autre poseur, sans accès à ce chantier, ne voit rien — ni en ligne, ni hors réseau
  r.connexion2 = await connecter('poseur2');
  await reglage('acces&id=poseur2&valeur=0');
  await page.goto(RECAP); await page.waitForTimeout(2500);
  r.autre = await etat();
  await ctx.setOffline(true);
  await page.goto(RECAP).catch(() => {}); await page.waitForTimeout(3000);
  r.autreHorsReseau = await etat();
  await ctx.setOffline(false);
  // 7. Accès retiré au premier poseur : la liste gardée dans son téléphone est effacée
  r.connexion3 = await connecter('poseur1');
  await page.goto(RECAP); await page.waitForTimeout(2500);
  r.avantRetrait = (await etat()).titres.length;
  await reglage('acces&id=poseur1&valeur=0');
  await page.goto(RECAP); await page.waitForTimeout(2500);
  r.retire = await etat();
  await ctx.setOffline(true);
  await page.goto(RECAP).catch(() => {}); await page.waitForTimeout(3000);
  r.retireHorsReseau = await etat();
  await ctx.setOffline(false);
  await reglage('acces&id=poseur1&valeur=1');
  // 8. Sans chantier dans l'adresse, puis sans compte
  await page.goto(BASE + 'recap-notes.html?' + q); await page.waitForTimeout(1500);
  r.sansChantier = await etat();
  await page.evaluate(() => LOUE.deconnecter());
  await page.goto(RECAP); await page.waitForTimeout(2000);
  r.sansCompte = await etat();
  await page.goto(BASE + 'index.html?' + q); await page.waitForTimeout(1500);
  r.tuileSansCompte = await page.evaluate(() => { ouvrirFiches({ nom: 'CHANTIER TEST 1', reference: 'LIEU 1' }); return document.getElementById('tuile-recap').hidden; });
  return JSON.stringify(r);
}`;
}

function lancer() {
  const f = path.join(dossier, 'scenario.js');
  fs.writeFileSync(f, scenario());
  spawnSync('playwright-cli', ['-s=loue-l8d', 'close'], { shell: true });
  spawnSync('playwright-cli', ['-s=loue-l8d', 'open', '--browser=chrome', '--mobile', 'about:blank'], { shell: true, encoding: 'utf8' });
  const sortie = spawnSync('playwright-cli', ['-s=loue-l8d'].concat(process.env.LOUE_DEBUG ? [] : ['--raw'], ['run-code', '--filename=' + f]), { shell: true, encoding: 'utf8', timeout: 400000 });
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
  if (cond) { reussis++; console.log('  ✓ ' + nom); } else { echecs++; console.log('  ✗ ' + nom + '\n    ' + String(detail).slice(0, 1000)); }
}
setTimeout(() => {
  try {
    console.log('Lot 8d — page « Récapitulatif des notes » dans un vrai Chrome, largeur téléphone (service worker actif, faux serveur)');
    const r = lancer(), j = x => JSON.stringify(x);
    verifier('aucune note de réunion : la page le dit, sans erreur ni défilement horizontal', r.connexion === 'CONNECTE' && r.vide.titres.length === 0
      && /Aucune note de réunion pour ce chantier/.test(r.vide.vide) && r.vide.largeur === true && /CHANTIER TEST 1/.test(r.vide.entete), j(r.vide));
    verifier('trois notes : la plus récente en haut, avec la date, l’objet et le rédacteur', j(r.envois) === j(['ENREGISTRE', 'ENREGISTRE', 'ENREGISTRE'])
      && j(r.liste.titres) === j(['Réunion du 19/11/2026 — Réunion C', 'Réunion du 12/11/2026', 'Réunion du 05/11/2026 — Réunion A'])
      && r.liste.auteurs.every(a => a === 'Rédigé par Thomas TEST') && /3 notes, la plus récente en haut/.test(r.liste.info), j(r.liste));
    verifier('le texte est rendu tel qu’il a été tapé : retours à la ligne et tiret gardés, HTML tapé jamais exécuté', r.liste.textes[1] === 'Ligne 1\nLigne 2\n- un tiret'
      && r.liste.textes[0] === '<b>gras</b> <img src=x onerror="window.__xss=1">' && r.liste.xss === 0 && r.liste.dangereux === 0 && /pre-wrap/.test(r.liste.preWrap), j(r.liste));
    verifier('lisible sur le chantier : texte de 16 px au moins, pas de défilement horizontal, bouton Retour vers l’accueil', r.liste.police >= 16 && r.liste.largeur === true
      && r.liste.retour.href === 'index.html' && r.liste.retour.haut >= 36, j([r.liste.police, r.liste.largeur, r.liste.retour]));
    verifier('écran du chantier : la tuile « Récapitulatif des notes » est là (48 px au moins) et ouvre la page du chantier', r.tuile.visible === true && /Récapitulatif des notes/.test(r.tuile.titre)
      && r.tuile.haut >= 48 && /recap-notes\.html\?chantier=CHANTIER%20TEST%201/.test(r.depuisTuile.adresse) && r.depuisTuile.titres === 3, j([r.tuile, r.depuisTuile]));
    verifier('hors réseau après rechargement : la dernière liste gardée s’affiche, avec sa date', r.horsReseau.titres.length === 3
      && /Pas de réseau : liste gardée dans le téléphone le \d\d\/\d\d à \d\d h \d\d/.test(r.horsReseau.info), j(r.horsReseau));
    verifier('réseau lent : la liste gardée s’affiche tout de suite, puis celle du serveur la remplace', r.lentAvant.titres.length === 3 && /gardée dans le téléphone/.test(r.lentAvant.info)
      && r.lentApres.titres.length === 3 && /3 notes, la plus récente en haut/.test(r.lentApres.info), j([r.lentAvant.info, r.lentApres.info]));
    verifier('téléphone partagé : un poseur sans accès au chantier ne voit rien, en ligne comme hors réseau', r.connexion2 === 'CONNECTE' && r.autre.titres.length === 0
      && /n’est pas dans votre liste/.test(r.autre.vide) && r.autreHorsReseau.titres.length === 0 && r.autreHorsReseau.textes.length === 0, j([r.autre, r.autreHorsReseau]));
    verifier('accès retiré : la liste gardée dans le téléphone est effacée (plus rien hors réseau)', r.connexion3 === 'CONNECTE' && r.avantRetrait === 3 && r.retire.titres.length === 0
      && /n’est pas dans votre liste/.test(r.retire.vide) && r.retireHorsReseau.titres.length === 0, j([r.avantRetrait, r.retire, r.retireHorsReseau]));
    verifier('sans chantier dans l’adresse : un message clair et un lien vers l’accueil', /Ouvrez le récapitulatif depuis un chantier/.test(r.sansChantier.vide), j(r.sansChantier));
    verifier('sans compte : rien n’est affiché, connexion demandée ; la tuile est cachée', r.sansCompte.titres.length === 0 && /Connectez-vous/.test(r.sansCompte.vide) && r.tuileSansCompte === true, j([r.sansCompte, r.tuileSansCompte]));
  } catch (e) { echecs++; console.log('  ✗ ' + e.message); }
  spawnSync('playwright-cli', ['-s=loue-l8d', 'close'], { shell: true });
  site.kill(); faux.kill();
  fs.rmSync(dossier, { recursive: true, force: true });
  console.log(reussis + ' test(s) réussi(s)' + (echecs ? ' — DES TESTS ÉCHOUENT' : ''));
  if (echecs) process.exitCode = 1;
}, 2500);
