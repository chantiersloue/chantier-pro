// Lot 12 — l'accueil « Mes chantiers » / « Tous les chantiers » dans un VRAI Chrome, en largeur téléphone :
//   node tests/lot12-page.test.js
// Demande playwright-cli (npm i -g @playwright/cli) et Python sur le PC ; sinon le test est sauté.
// Lance lui-même le site (http://127.0.0.1:8797) et le faux serveur (8798) : jamais la copie TEST, jamais la production.
// Les comptes et le mot de passe sont ceux du faux serveur local (tests/faux-serveur.js), jamais de vrais comptes.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const racine = path.join(__dirname, '..');
const outil = spawnSync('playwright-cli', ['--version'], { shell: true, encoding: 'utf8' });
const python = spawnSync('python', ['--version'], { shell: true, encoding: 'utf8' });
if (outil.status !== 0 || python.status !== 0) { console.log('Lot 12, page : playwright-cli ou Python absent, test sauté'); process.exit(0); }

const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'loue-l12-'));
const SITE = 'http://127.0.0.1:8797/', SERVEUR = 'http://127.0.0.1:8798', API = SERVEUR + '/exec';
const site = spawn('python', ['-m', 'http.server', '8797', '--bind', '127.0.0.1', '--directory', racine], { stdio: 'ignore' });
const faux = spawn('node', [path.join(__dirname, 'faux-serveur.js'), '8798'], { stdio: 'ignore' });

function scenario() {
  return `async page => {
  const BASE = ${JSON.stringify(SITE)}, SERVEUR = ${JSON.stringify(SERVEUR)}, q = 'api=${API}&sw=1', MDP = 'Essai-' + '2026';
  const ACCUEIL = BASE + 'index.html?' + q;
  const ctx = page.context(), r = {};
  const connecter = id => page.evaluate(a => { LOUE.deconnecter(); return LOUE.connexion(a[0], a[1]).then(x => x.code); }, [id, MDP]);
  const reglage = m => page.evaluate(u => fetch(u).then(x => x.text()), SERVEUR + '/reglage?mode=' + m);
  const ouvrir = async () => { await page.goto(ACCUEIL); await page.waitForTimeout(3500); };
  const etat = () => page.evaluate(() => {
    const visible = e => !!e && !e.hidden && getComputedStyle(e).display !== 'none';
    const cartes = sel => Array.from(document.querySelectorAll(sel + ' .chantier-card')).map(c => {
      const e = c.querySelector('.ch-etoile');
      return [c.getAttribute('data-nom'), e ? e.textContent : (c.querySelector('.ch-etoile-vide') ? '(place vide)' : ''), c.classList.contains('fini') ? 'fini' : ''].filter(Boolean).join(' ');
    });
    const etoiles = Array.from(document.querySelectorAll('.ch-etoile')).map(e => e.getBoundingClientRect());
    const btn = document.getElementById('btn-tous-ch');
    return { label: document.getElementById('label-chantiers').textContent, mes: cartes('#chantiers-container'),
      tous: visible(document.getElementById('tous-chantiers')) ? cartes('#tous-container') : null,
      titreFinis: (document.querySelector('.titre-finis') || {}).textContent || '',
      bouton: visible(btn) ? btn.textContent.replace(/\\s+/g, ' ').trim() + ' [' + btn.getAttribute('aria-expanded') + ']' : '',
      vide: (document.querySelector('#chantiers-container .empty') || {}).textContent || '', annuler: visible(document.getElementById('annuler-favori')),
      recherche: visible(document.getElementById('recherche')),
      etoileMin: etoiles.length ? Math.round(Math.min.apply(null, etoiles.map(b => Math.min(b.width, b.height)))) : 0,
      largeur: document.documentElement.scrollWidth <= innerWidth,
      page: (document.querySelector('.page.active') || {}).id || '' };
  });
  const etoile = (zone, nom) => page.evaluate(a => { const c = Array.from(document.querySelectorAll(a[0] + ' .chantier-card')).find(x => x.getAttribute('data-nom') === a[1]);
    const e = c && c.querySelector('.ch-etoile'); if (e) e.click(); return !!e; }, [zone, nom]);
  const deplier = () => page.evaluate(() => document.getElementById('btn-tous-ch').click());

  await ctx.setOffline(false);
  await page.goto(ACCUEIL);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => 1));
  await page.reload(); await page.waitForTimeout(1500);
  await reglage('lot12');
  // Un téléphone d'AVANT le lot 12 : le classement « derniers ouverts » est dans le téléphone, aucune étoile encore
  r.connexion = await connecter('poseur1');
  await page.evaluate(() => { localStorage.setItem('loue_recents_local_poseur1', '["CHANTIER TEST 1"]'); Object.keys(localStorage).filter(k => /^loue_favoris_/.test(k)).forEach(k => localStorage.removeItem(k)); });

  // 1. Réglage ÉTEINT : le chantier coché est dans « Mes chantiers » (premier jour : rien ne disparaît) ; « Tous les chantiers » replié
  await ouvrir();
  r.eteint = await etat();
  r.ancienClassement = await page.evaluate(() => localStorage.getItem('loue_recents_local_poseur1'));
  // 2. Réglage ALLUMÉ : tous les chantiers, par numéro, les terminés en bas
  await reglage('tous-chantiers&valeur=1');
  await ouvrir();
  r.allumeReplie = await etat();
  await deplier(); await page.waitForTimeout(300);
  r.allume = await etat();
  // 3. ☆ : le chantier va dans « Mes chantiers » ; ★ : il en sort, « Annuler » le remet
  await etoile('#tous-container', 'CHANTIER TEST 4'); await page.waitForTimeout(300);
  r.ajoute = await etat();
  await etoile('#chantiers-container', 'CHANTIER TEST 1'); await page.waitForTimeout(300);
  r.retire = await etat();
  await page.evaluate(() => document.querySelector('#annuler-favori button').click()); await page.waitForTimeout(300);
  r.annule = await etat();
  await etoile('#chantiers-container', 'CHANTIER TEST 1'); await page.waitForTimeout(6600);
  r.apres6s = await etat();
  // 4. Les étoiles sont gardées : après rechargement, puis HORS RÉSEAU
  await ouvrir();
  r.recharge = await etat();
  await ctx.setOffline(true);
  await page.goto(ACCUEIL).catch(() => {}); await page.waitForTimeout(3000);
  r.horsReseau = await etat();
  await deplier(); await page.waitForTimeout(300);
  await etoile('#tous-container', 'CHANTIER TEST 3'); await page.waitForTimeout(300);   // une étoile mise sans réseau
  r.horsReseauEtoile = await etat();
  await ctx.setOffline(false);
  // 5. Toucher le chantier (pas l'étoile) l'ouvre ; la recherche filtre « Tous les chantiers »
  await ouvrir();
  await page.evaluate(() => document.querySelector('#chantiers-container .chantier-card .ch-ouvrir').click()); await page.waitForTimeout(500);
  r.ouvert = await page.evaluate(() => ({ page: (document.querySelector('.page.active') || {}).id, titre: document.getElementById('titre-chantier').textContent }));
  await ouvrir(); await deplier(); await page.waitForTimeout(300);
  await page.fill('#recherche', 'sans num'); await page.waitForTimeout(300);
  r.recherche = await etat();
  await page.fill('#recherche', '1201'); await page.waitForTimeout(300);
  r.rechercheNumero = (await etat()).tous;
  // 6. PLANNING : un chantier où le gars est planifié arrive tout seul ; retiré, il ne revient pas ; nouvelle série : il revient
  await reglage('planifie&id=poseur1&numero=0502&debut=2026-11-23');
  await ouvrir();
  r.planifie = await etat();
  await etoile('#chantiers-container', 'CHANTIER TEST 2'); await page.waitForTimeout(300);
  await ouvrir();
  r.planifieRetire = await etat();
  await reglage('planifie&id=poseur1&numero=0502&debut=2026-12-14');
  await ouvrir();
  r.nouvelleSerie = await etat();
  // 7. Une case cochée par le bureau pendant que le réglage est allumé : le chantier arrive aussi dans « Mes chantiers »
  await reglage('acces&id=poseur1&valeur=1&chantier=CHANTIER%20SANS%20NUMERO');
  await ouvrir();
  r.caseCochee = await etat();
  // 8. Un autre gars sur le même téléphone a SES étoiles ; « Mes chantiers » vide : la liste entière est dépliée d'office
  r.connexion2 = await connecter('poseur2');
  await ouvrir();
  r.autre = await etat();
  await etoile('#chantiers-container', 'CHANTIER TEST 1'); await page.waitForTimeout(6600);
  r.autreVide = await etat();
  // 9. Le premier revient : ses étoiles sont intactes
  r.connexion3 = await connecter('poseur1');
  await ouvrir();
  r.retour = await etat();
  // 10. Conducteur : ses chantiers (colonne D) arrivent tout seuls, sauf le terminé ; il voit tout
  r.connexion4 = await connecter('conducteur1');
  await ouvrir(); await deplier(); await page.waitForTimeout(300);
  r.conducteur = await etat();
  // 11. Réglage ÉTEINT de nouveau : le poseur ne voit plus que ses cases ; son étoile sur un chantier fermé n'apparaît plus
  await reglage('tous-chantiers&valeur=0');
  r.connexion5 = await connecter('poseur1');
  await ouvrir(); await deplier(); await page.waitForTimeout(300);
  r.eteintApres = await etat();
  // 12. Sans compte : pas d'étoile, une seule liste
  await page.evaluate(() => LOUE.deconnecter());
  await page.goto(ACCUEIL); await page.waitForTimeout(1500);
  await page.evaluate(() => continuerSansCompte()); await page.waitForTimeout(3000);
  r.sansCompte = await etat();
  r.erreurs = await page.evaluate(() => window.__erreurs || 0);
  return JSON.stringify(r);
}`;
}

function lancer() {
  const f = path.join(dossier, 'scenario.js');
  fs.writeFileSync(f, scenario());
  spawnSync('playwright-cli', ['-s=loue-l12', 'close'], { shell: true });
  spawnSync('playwright-cli', ['-s=loue-l12', 'open', '--browser=chrome', '--mobile', 'about:blank'], { shell: true, encoding: 'utf8' });
  const sortie = spawnSync('playwright-cli', ['-s=loue-l12'].concat(process.env.LOUE_DEBUG ? [] : ['--raw'], ['run-code', '--filename=' + f]), { shell: true, encoding: 'utf8', timeout: 400000 });
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
    console.log('Lot 12 — accueil « Mes chantiers » / « Tous les chantiers » dans un vrai Chrome, largeur téléphone (service worker actif, faux serveur)');
    const r = lancer(), j = x => JSON.stringify(x);
    const T1 = 'CHANTIER TEST 1', T2 = 'CHANTIER TEST 2', T3 = 'CHANTIER TEST 3', T4 = 'CHANTIER TEST 4', T5 = 'CHANTIER TEST 5', SN = 'CHANTIER SANS NUMERO', FINI = 'CHANTIER FINI';
    verifier('réglage éteint, premier jour : le chantier coché est dans « Mes chantiers » avec son étoile ★ ; « Tous les chantiers (1) » replié ; l’ancien classement est effacé',
      r.connexion === 'CONNECTE' && r.eteint.label === 'Mes chantiers' && j(r.eteint.mes) === j([T1 + ' ★']) && r.eteint.tous === null
      && r.eteint.bouton === 'Tous les chantiers (1)▾ [false]' && r.ancienClassement === null, j([r.eteint, r.ancienClassement]));
    verifier('réglage allumé : « Mes chantiers » ne bouge pas ; « Tous les chantiers (7) » replié par défaut', j(r.allumeReplie.mes) === j([T1 + ' ★'])
      && r.allumeReplie.tous === null && r.allumeReplie.bouton === 'Tous les chantiers (7)▾ [false]', j(r.allumeReplie));
    verifier('déplié : classés par NUMÉRO (90, 0501, 0502, 0700, 1201), le chantier sans numéro ensuite, les terminés en bas, grisés, sans étoile',
      j(r.allume.tous) === j([T3 + ' ☆', T1 + ' ★', T2 + ' ☆', T5 + ' ☆', T4 + ' ☆', SN + ' ☆', FINI + ' (place vide) fini']) && r.allume.titreFinis === 'Chantiers terminés'
      && /\[true\]$/.test(r.allume.bouton), j(r.allume));
    verifier('terrain : étoile de 48 px au moins, pas de défilement horizontal', r.allume.etoileMin >= 48 && r.allume.largeur === true, j([r.allume.etoileMin, r.allume.largeur]));
    verifier('☆ : le chantier passe dans « Mes chantiers », à sa place par numéro', j(r.ajoute.mes) === j([T1 + ' ★', T4 + ' ★']) && r.ajoute.tous.indexOf(T4 + ' ★') > -1 && !r.ajoute.annuler, j(r.ajoute));
    verifier('★ : le chantier sort de « Mes chantiers » ; « Annuler » le remet ; la barre disparaît au bout de 6 secondes', j(r.retire.mes) === j([T4 + ' ★']) && r.retire.annuler === true
      && j(r.annule.mes) === j([T1 + ' ★', T4 + ' ★']) && r.annule.annuler === false && j(r.apres6s.mes) === j([T4 + ' ★']) && r.apres6s.annuler === false, j([r.retire, r.annule, r.apres6s]));
    verifier('les étoiles sont gardées dans le téléphone : après rechargement, et hors réseau (où l’on peut encore en mettre une)', j(r.recharge.mes) === j([T4 + ' ★'])
      && j(r.horsReseau.mes) === j([T4 + ' ★']) && j(r.horsReseauEtoile.mes) === j([T3 + ' ★', T4 + ' ★']), j([r.recharge.mes, r.horsReseau.mes, r.horsReseauEtoile.mes]));
    verifier('toucher le chantier (pas l’étoile) l’ouvre', r.ouvert.page === 'page-chantier-fiches' && r.ouvert.titre === T3, j(r.ouvert));
    verifier('la recherche filtre « Tous les chantiers », par nom ou par numéro', r.recherche.recherche === true && (j(r.recherche.tous) === j([SN + ' ☆']) && j(r.rechercheNumero) === j([T4 + ' ★'])), j([r.recherche, r.rechercheNumero]));
    verifier('planning : le chantier où le gars est planifié arrive tout seul ; retiré, il ne revient pas ; à la série suivante, il revient',
      j(r.planifie.mes) === j([T3 + ' ★', T2 + ' ★', T4 + ' ★']) && j(r.planifieRetire.mes) === j([T3 + ' ★', T4 + ' ★']) && j(r.nouvelleSerie.mes) === j([T3 + ' ★', T2 + ' ★', T4 + ' ★']),
      j([r.planifie.mes, r.planifieRetire.mes, r.nouvelleSerie.mes]));
    verifier('une case cochée par le bureau met encore le chantier dans « Mes chantiers », même réglage allumé', r.caseCochee.mes.indexOf(SN + ' ★') > -1, j(r.caseCochee.mes));
    verifier('un autre gars sur le même téléphone a ses propres étoiles', r.connexion2 === 'CONNECTE' && j(r.autre.mes) === j([T1 + ' ★']), j(r.autre));
    verifier('« Mes chantiers » vide : un message qui dit quoi faire, et la liste entière dépliée d’office', r.autreVide.mes.length === 0 && /Touchez l’étoile ☆/.test(r.autreVide.vide)
      && r.autreVide.tous && r.autreVide.tous.length === 7, j(r.autreVide));
    verifier('le premier gars retrouve ses étoiles intactes', r.connexion3 === 'CONNECTE' && j(r.retour.mes) === j([T3 + ' ★', T2 + ' ★', T4 + ' ★', SN + ' ★']), j(r.retour.mes));
    verifier('conducteur : ses chantiers (colonne D) arrivent tout seuls, sauf le terminé ; il voit tout', r.connexion4 === 'CONNECTE' && j(r.conducteur.mes) === j([T1 + ' ★'])
      && r.conducteur.tous.length === 7 && r.conducteur.tous[6] === FINI + ' (place vide) fini', j(r.conducteur));
    verifier('réglage éteint de nouveau : le poseur ne voit plus que ses chantiers cochés ; rien d’autre ne s’affiche, même étoilé', r.connexion5 === 'CONNECTE'
      && j(r.eteintApres.tous) === j([T1 + ' ☆', SN + ' ★']) && j(r.eteintApres.mes) === j([SN + ' ★']), j(r.eteintApres));
    verifier('sans compte : une seule liste « Chantiers », sans étoile ni bouton', r.sansCompte.label === 'Chantiers' && r.sansCompte.mes.length === 0 && r.sansCompte.bouton === ''
      && r.sansCompte.tous && r.sansCompte.tous.length >= 2 && r.sansCompte.tous.every(t => !/[★☆]/.test(t)), j(r.sansCompte));
  } catch (e) { echecs++; console.log('  ✗ ' + e.message); }
  spawnSync('playwright-cli', ['-s=loue-l12', 'close'], { shell: true });
  site.kill(); faux.kill();
  fs.rmSync(dossier, { recursive: true, force: true });
  console.log(reussis + ' test(s) réussi(s)' + (echecs ? ' — DES TESTS ÉCHOUENT' : ''));
  if (echecs) process.exitCode = 1;
}, 2500);
