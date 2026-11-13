// Accueil après le retrait de la tuile « Plans » (lot 4b), dans un VRAI Chrome, en largeur téléphone :
//   node tests/accueil-page.test.js
// Demande playwright-cli (npm i -g @playwright/cli) et Python sur le PC ; sinon le test est sauté.
// Lance lui-même le site (http://127.0.0.1:8791) et le faux serveur (8792) : jamais la copie TEST, jamais la production.
// Les comptes et le mot de passe sont ceux du faux serveur local (tests/faux-serveur.js), jamais de vrais comptes.
// Vérifie : la tuile « Plans » et sa fenêtre n'existent plus, les autres tuiles sont là, le planning marche toujours
// (avec compte, sans compte, hors réseau puis au retour du réseau, après la fin de la période sans compte), et une
// ancienne page qui demanderait encore les plans d'un chantier reçoit une liste vide, sans erreur et sans partage.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const racine = path.join(__dirname, '..');
const outil = spawnSync('playwright-cli', ['--version'], { shell: true, encoding: 'utf8' });
const python = spawnSync('python', ['--version'], { shell: true, encoding: 'utf8' });
if (outil.status !== 0 || python.status !== 0) { console.log('Accueil, page : playwright-cli ou Python absent, test sauté'); process.exit(0); }

const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'loue-acc-'));
const SITE = 'http://127.0.0.1:8791/', SERVEUR = 'http://127.0.0.1:8792', API = SERVEUR + '/exec';
const site = spawn('python', ['-m', 'http.server', '8791', '--bind', '127.0.0.1', '--directory', racine], { stdio: 'ignore' });
const faux = spawn('node', [path.join(__dirname, 'faux-serveur.js'), '8792'], { stdio: 'ignore' });

function scenario() {
  return `async page => {
  const BASE = ${JSON.stringify(SITE)}, SERVEUR = ${JSON.stringify(SERVEUR)}, q = 'api=${API}&sw=1', MDP = 'Essai-' + '2026';
  const ACCUEIL = BASE + 'index.html?' + q;
  const ctx = page.context(), r = { erreurs: [] };
  page.on('dialog', d => d.accept().catch(() => {}));
  page.on('pageerror', e => r.erreurs.push(String(e && e.message)));
  const reglage = m => page.evaluate(u => fetch(u).then(x => x.text()), SERVEUR + '/reglage?mode=' + m);
  const partages = () => page.evaluate(u => fetch(u + '/etat').then(x => x.json()).then(e => e.partagesParLien), SERVEUR);
  // La page d'un chantier : ce qui existe, ce qui se voit
  const chantier = () => page.evaluate(() => {
    ouvrirFiches({ nom: 'CHANTIER TEST 1', reference: 'LIEU 1' });
    const visible = id => { const e = document.getElementById(id); return !!e && !e.hidden && getComputedStyle(e).display !== 'none'; };
    const p = document.getElementById('page-chantier-fiches');
    return { tuilePlans: !!document.getElementById('tuile-plans'), fenetre: !!document.getElementById('chantierModal'),
      restes: document.querySelectorAll('.sOnglet, #docs-container, #modal-chantier-name, .modal-overlay').length,
      fonctions: [typeof window.ouvrirPlans, typeof window.showSousOnglet, typeof window.renderDocs, typeof window.closeModal, typeof window.chargerDossiers].join(','),
      titres: Array.from(p.querySelectorAll('.home-tile')).filter(t => !t.hidden).map(t => t.querySelector('.tile-title').firstChild.textContent.trim()),
      carnet: visible('tuile-carnet'), signalements: visible('tuile-signalements'), notes: visible('tuile-notes'),
      fiches: p.querySelectorAll('a.fiche-card').length, pageActive: p.classList.contains('active'),
      marge: (() => { const t = document.getElementById('tuile-carnet'); return t ? getComputedStyle(t).marginBottom : ''; })(),
      largeur: document.documentElement.scrollWidth <= innerWidth };
  });
  // Le planning : on l'ouvre et on attend la fin du chargement
  const planning = async () => {
    await page.evaluate(() => { showPage('planning'); });
    let e = null;
    for (let i = 0; i < 80; i++) {
      await page.waitForTimeout(500);
      e = await page.evaluate(() => { const c = document.getElementById('planning-container');
        return { charge: !c.querySelector('.loading'), texte: c.textContent.trim(),
          docs: Array.from(c.querySelectorAll('a.doc-item')).map(a => ({ nom: a.querySelector('.doc-name').textContent, lien: a.getAttribute('href'), marque: (a.querySelector('.doc-meta span') || {}).textContent || '',
            hauteur: Math.round(a.getBoundingClientRect().height) })),
          largeur: document.documentElement.scrollWidth <= innerWidth }; });
      if (e.charge) break;
    }
    return e;
  };

  await ctx.setOffline(false);
  await page.goto(ACCUEIL);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => 1));
  await page.reload(); await page.waitForTimeout(1500);
  await reglage('transition-ouverte');

  // 1. Avec un compte
  r.connexion = await page.evaluate(a => { LOUE.deconnecter(); return LOUE.connexion(a[0], a[1]).then(x => x.code); }, ['poseur1', MDP]);
  await page.goto(ACCUEIL); await page.waitForTimeout(2000);
  r.compte = await chantier();
  r.planningCompte = await planning();
  // une ancienne page gardée dans un téléphone demande encore les plans du chantier
  r.anciennePageCompte = await page.evaluate(() => LOUE.lireDossiers('CHANTIER TEST 1').then(d => JSON.stringify(d), e => 'ERREUR ' + e.message));
  r.autreChantier = await page.evaluate(() => LOUE.lireDossiers('CHANTIER TEST 2').then(d => JSON.stringify(d), e => 'ERREUR ' + e.message));

  // 2. Hors réseau (page rouverte par le service worker), puis retour du réseau sans recharger
  await ctx.setOffline(true);
  await page.goto(ACCUEIL); await page.waitForTimeout(2500);
  r.horsReseau = await chantier();
  r.planningHorsReseau = await planning();
  await ctx.setOffline(false);
  r.planningRetour = await planning();

  // 3. Sans compte, pendant la période sans compte
  await page.evaluate(() => { LOUE.deconnecter(); });
  await page.goto(ACCUEIL); await page.waitForTimeout(2000);
  r.boutonSansCompte = await page.evaluate(() => document.getElementById('cnx-sans-compte').textContent);
  await page.evaluate(() => { continuerSansCompte(); });
  await page.waitForTimeout(1500);
  r.sans = await chantier();
  r.planningSans = await planning();
  r.anciennePageSans = await page.evaluate(() => LOUE.lireDossiers('CHANTIER TEST 1').then(d => JSON.stringify(d), e => 'ERREUR ' + e.message));
  r.chantierInconnu = await page.evaluate(() => LOUE.lireDossiers('CHANTIER QUI N EXISTE PAS').then(d => JSON.stringify(d), e => 'ERREUR ' + e.message));

  // 4. Période sans compte terminée : le planning demande la connexion
  await reglage('transition-finie');
  await page.goto(ACCUEIL); await page.waitForTimeout(2000);
  await page.evaluate(() => { MODE = 'sans'; });
  r.planningFini = await planning();
  await reglage('transition-ouverte');
  r.partages = await partages();
  return JSON.stringify(r);
}`;
}

function lancer() {
  const f = path.join(dossier, 'scenario.js');
  fs.writeFileSync(f, scenario());
  spawnSync('playwright-cli', ['-s=loue-acc', 'close'], { shell: true });
  spawnSync('playwright-cli', ['-s=loue-acc', 'open', '--browser=chrome', '--mobile', 'about:blank'], { shell: true, encoding: 'utf8' });
  const sortie = spawnSync('playwright-cli', ['-s=loue-acc'].concat(process.env.LOUE_DEBUG ? [] : ['--raw'], ['run-code', '--filename=' + f]), { shell: true, encoding: 'utf8', timeout: 400000 });
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
  if (cond) { reussis++; console.log('  ✓ ' + nom); } else { echecs++; console.log('  ✗ ' + nom + '\n    ' + String(detail).slice(0, 1000)); }
}
setTimeout(() => {
  try {
    console.log('Accueil sans la tuile « Plans » dans un vrai Chrome, largeur téléphone (service worker actif, faux serveur)');
    const r = lancer(), j = x => JSON.stringify(x);
    const sansRestes = e => e.tuilePlans === false && e.fenetre === false && e.restes === 0 && e.fonctions === 'undefined,undefined,undefined,undefined,undefined';
    const unPlanning = e => e.charge === true && e.docs.length === 1 && e.docs[0].nom === 'Planning S46.pdf' && /^https:\/\/drive\.google\.com\//.test(e.docs[0].lien) && e.docs[0].marque === 'PDF';
    verifier('avec un compte : plus de tuile « Plans », plus de fenêtre des documents, plus aucune de leurs fonctions', r.connexion === 'CONNECTE' && sansRestes(r.compte), j([r.connexion, r.compte]));
    verifier('… les tuiles Carnet, Signalements et Notes sont là, dans cet ordre, puis les fiches ; pas de défilement horizontal',
      j(r.compte.titres) === j(['Carnet', 'Signalements', 'Notes']) && r.compte.carnet && r.compte.signalements && r.compte.notes && r.compte.fiches >= 8
      && r.compte.pageActive === true && r.compte.largeur === true && r.compte.marge === '18px', j(r.compte));
    verifier('planning avec un compte : le document s’affiche, avec son lien Drive et sa marque « PDF », assez haut pour un doigt',
      unPlanning(r.planningCompte) && r.planningCompte.docs[0].hauteur >= 44 && r.planningCompte.largeur === true, j(r.planningCompte));
    verifier('ancienne page (avec compte) qui demande encore les plans : liste vide, sans erreur ; chantier d’un autre : refus comme avant',
      r.anciennePageCompte === '{"plans":[]}' && /^ERREUR .*ne fait pas partie de vos chantiers/.test(r.autreChantier), j([r.anciennePageCompte, r.autreChantier]));
    verifier('hors réseau : la page du chantier s’ouvre pareil (rien ne manque, rien ne casse)', sansRestes(r.horsReseau) && j(r.horsReseau.titres) === j(['Carnet', 'Signalements', 'Notes']), j(r.horsReseau));
    verifier('planning hors réseau : message clair, pas de chargement sans fin', r.planningHorsReseau.charge === true && r.planningHorsReseau.docs.length === 0
      && /Impossible de charger/.test(r.planningHorsReseau.texte) && /Vérifiez le réseau, puis rouvrez le planning/.test(r.planningHorsReseau.texte), j(r.planningHorsReseau));
    verifier('… au retour du réseau, rouvrir le planning suffit (sans recharger la page)', unPlanning(r.planningRetour), j(r.planningRetour));
    verifier('sans compte : le bouton parle du planning (plus des plans) ; ni tuile « Plans » ni tuiles réservées aux comptes',
      /chantiers et planning comme avant/.test(r.boutonSansCompte) && !/plans/i.test(r.boutonSansCompte) && sansRestes(r.sans) && r.sans.titres.length === 0 && r.sans.fiches >= 8, j([r.boutonSansCompte, r.sans]));
    verifier('planning sans compte (période sans compte ouverte) : le document s’affiche', unPlanning(r.planningSans), j(r.planningSans));
    verifier('ancienne page (sans compte) : liste vide, sans erreur, même pour un chantier inconnu', r.anciennePageSans === '{"plans":[]}' && r.chantierInconnu === '{"plans":[]}', j([r.anciennePageSans, r.chantierInconnu]));
    verifier('période sans compte terminée : le planning demande de se connecter', r.planningFini.charge === true && r.planningFini.docs.length === 0 && /Connectez-vous pour voir le planning/.test(r.planningFini.texte), j(r.planningFini));
    verifier('dans le faux Drive, seul le planning est partagé par lien', j(r.partages) === j(['Planning S46.pdf']), j(r.partages));
    verifier('aucune erreur JavaScript pendant tout le parcours', r.erreurs.length === 0, j(r.erreurs));
  } catch (e) { echecs++; console.log('  ✗ ' + e.message); }
  spawnSync('playwright-cli', ['-s=loue-acc', 'close'], { shell: true });
  site.kill(); faux.kill();
  fs.rmSync(dossier, { recursive: true, force: true });
  console.log(reussis + ' test(s) réussi(s)' + (echecs ? ' — DES TESTS ÉCHOUENT' : ''));
  if (echecs) process.exitCode = 1;
}, 2500);
