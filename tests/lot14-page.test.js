// Lot 14 — la demande d'absence dans un VRAI Chrome, en largeur téléphone : « Mes demandes » du poseur, et la page de
// confirmation de la direction (absence-reponse.html) :   node tests/lot14-page.test.js
// Demande playwright-cli (npm i -g @playwright/cli) et Python sur le PC ; sinon le test est sauté.
// Lance lui-même le site (http://127.0.0.1:8801) et le faux serveur (8802) : jamais la copie TEST, jamais la production.
// Les comptes et le mot de passe sont ceux du faux serveur local (tests/faux-serveur.js), jamais de vrais comptes.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const racine = path.join(__dirname, '..');
const outil = spawnSync('playwright-cli', ['--version'], { shell: true, encoding: 'utf8' });
const python = spawnSync('python', ['--version'], { shell: true, encoding: 'utf8' });
if (outil.status !== 0 || python.status !== 0) { console.log('Lot 14, page : playwright-cli ou Python absent, test sauté'); process.exit(0); }

const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'loue-l14-'));
const SITE = 'http://127.0.0.1:8801/', SERVEUR = 'http://127.0.0.1:8802', API = SERVEUR + '/exec';
const site = spawn('python', ['-m', 'http.server', '8801', '--bind', '127.0.0.1', '--directory', racine], { stdio: 'ignore' });
const faux = spawn('node', [path.join(__dirname, 'faux-serveur.js'), '8802'], { stdio: 'ignore' });

function scenario() {
  return `async page => {
  const BASE = ${JSON.stringify(SITE)}, SERVEUR = ${JSON.stringify(SERVEUR)}, q = 'api=${API}&sw=1', MDP = 'Essai-' + '2026';
  const ABS = BASE + 'absence.html?' + q;
  const ctx = page.context(), r = {};
  const connecter = id => page.evaluate(a => { LOUE.deconnecter(); return LOUE.connexion(a[0], a[1]).then(x => x.code); }, [id, MDP]);
  const etat = () => page.evaluate(u => fetch(u + '/etat').then(x => x.json()), SERVEUR);
  const reglage = m => page.evaluate(u => fetch(u).then(x => x.text()), SERVEUR + '/reglage?mode=' + m);
  const file = () => page.evaluate(() => LOUE.stockage.tout('file').then(l => l.filter(e => e.etat !== 'erreur').length));
  const attendreFileVide = async () => { for (let i = 0; i < 40; i++) { await page.waitForTimeout(500); if (!(await file())) return; } };
  // Ce que le poseur voit dans « Mes demandes »
  const vue = () => page.evaluate(() => ({ section: !document.getElementById('mes-demandes').hidden, email: !document.getElementById('champ-email').hidden,
    lignes: Array.from(document.querySelectorAll('#demandes-liste .dem')).map(l => [l.querySelector('.dem-texte').firstChild.textContent, l.querySelector('.dem-etat').textContent, (l.querySelector('small') || {}).textContent || '']),
    vide: (document.querySelector('#demandes-liste .listes-info') || {}).textContent || '', info: document.getElementById('demandes-info').textContent,
    motifs: Array.from(document.querySelectorAll('#meta-motif option')).map(o => o.value).filter(Boolean), largeur: document.documentElement.scrollWidth <= innerWidth }));
  const remplir = async (date, motif) => {
    await page.fill('#meta-nom', 'Kévin ESSAI'); await page.fill('#date-precise', date); await page.selectOption('#meta-duree', 'Journée entière');
    await page.evaluate(() => basculerImputation(2)); await page.selectOption('#meta-motif', motif); await page.fill('#meta-precisions', 'Rendez-vous chez le spécialiste');
  };
  const envoyer = () => page.evaluate(() => document.getElementById('btn-envoyer').click());
  // Le lien du mail, ramené sur le site local (même page, mêmes paramètres signés)
  const local = (liens, choix) => { const l = liens.filter(x => x.indexOf('c=' + choix) > -1)[0] || ''; return BASE + 'absence-reponse.html?' + l.split('?')[1] + '&' + q; };
  // Ce que la direction voit sur la page de confirmation
  const pageDirection = () => page.evaluate(() => { const v = id => !document.getElementById(id).hidden, b = document.getElementById('btn-confirmer');
    return { demande: v('carte-demande'), choix: v('carte-choix'), resultat: v('carte-resultat') ? document.getElementById('resultat').textContent : '',
      nom: document.getElementById('d-nom').textContent, date: document.getElementById('d-date').textContent, duree: document.getElementById('d-duree').textContent,
      bouton: b.textContent, autre: document.getElementById('btn-autre').textContent, hautBouton: Math.round(b.getBoundingClientRect().height), hautAutre: Math.round(document.getElementById('btn-autre').getBoundingClientRect().height),
      corps: document.body.innerText, largeur: document.documentElement.scrollWidth <= innerWidth, sw: !!(navigator.serviceWorker && navigator.serviceWorker.controller) }; });

  await ctx.setOffline(false);
  await page.goto(BASE + 'index.html?' + q);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => 1));
  await page.reload(); await page.waitForTimeout(1500);
  r.connexion = await connecter('poseur1');
  await page.evaluate(async () => { for (const e of await LOUE.stockage.tout('file')) await LOUE.abandonner(e.id); });
  // 1. Lot 14 ÉTEINT côté serveur : la page est celle d'avant (pas de section, le champ e-mail est là)
  await reglage('absences-avant');
  await page.goto(ABS); await page.waitForTimeout(2500);
  r.avant = await vue();
  // 2. ALLUMÉ : « Mes demandes » apparaît, le champ e-mail disparaît
  await reglage('absences-direction');
  await page.goto(ABS); await page.waitForTimeout(2500);
  r.allume = await vue();
  // 3. Une demande part : elle est « En attente » ; le mail n'est allé qu'à la direction
  await remplir('2026-12-07', 'Médical'); await envoyer();
  await attendreFileVide(); await page.waitForTimeout(2500);
  r.apresEnvoi = await vue();
  let e = await etat();
  r.serveur1 = e.absences; r.mails1 = e.mails.filter(m => /Demande d'absence/.test(m.sujet)).map(m => m.to);
  // 4. La direction ouvre le lien « Accepter » du mail : la page rappelle la demande, sans le motif, et NE DÉCIDE RIEN
  await page.goto(local(e.liensAbsence, 'accepter')); await page.waitForTimeout(2500);
  r.direction = await pageDirection();
  r.serveurAvantConfirmer = (await etat()).absences;
  // 5. Elle confirme : acceptée ; le conducteur reçoit un mail
  await page.evaluate(() => document.getElementById('btn-confirmer').click()); await page.waitForTimeout(3000);
  r.confirme = await pageDirection();
  e = await etat();
  r.serveur2 = e.absences; r.mailsConducteur = e.mails.filter(m => /Absence acceptée/.test(m.sujet)).length;
  // 6. Le même lien rouvert (ou le lien « Refuser ») : la réponse déjà donnée, plus aucun bouton
  await page.goto(local(e.liensAbsence, 'refuser')); await page.waitForTimeout(2500);
  r.dejaDecide = await pageDirection();
  // 7. Le poseur rouvre la page : « Acceptée »
  await page.goto(ABS); await page.waitForTimeout(2500);
  r.acceptee = await vue();
  // 8. HORS RÉSEAU : l'état gardé s'affiche ; une nouvelle demande attend dans le téléphone, puis part au retour du réseau
  await ctx.setOffline(true);
  await page.goto(ABS).catch(() => {}); await page.waitForTimeout(3000);
  r.horsReseau = await vue();
  await remplir('2026-12-14', 'École'); await envoyer(); await page.waitForTimeout(3000);
  r.enFile = await vue();
  await ctx.setOffline(false);
  await page.evaluate(() => LOUE.viderFile()); await attendreFileVide(); await page.waitForTimeout(3000);
  r.partie = await vue();
  // 9. La direction ouvre « Refuser » pour la seconde demande, hésite (change deux fois d'avis), puis refuse
  e = await etat();
  await page.goto(local(e.liensAbsence, 'refuser')); await page.waitForTimeout(2500);
  r.refus = await pageDirection();
  await page.evaluate(() => document.getElementById('btn-autre').click()); await page.waitForTimeout(200);
  r.refusChange = await pageDirection();
  await page.evaluate(() => document.getElementById('btn-autre').click()); await page.waitForTimeout(200);
  await page.evaluate(() => document.getElementById('btn-confirmer').click()); await page.waitForTimeout(3000);
  r.refuse = await pageDirection();
  e = await etat();
  r.serveur3 = e.absences; r.mailsConducteur3 = e.mails.filter(m => /Absence acceptée/.test(m.sujet)).length;
  // 10. Un lien trafiqué (signature changée), un lien sans paramètres
  await page.goto(local(e.liensAbsence, 'accepter').replace(/&s=[^&]{6}/, '&s=XXXXXX')); await page.waitForTimeout(2500);
  r.trafique = await pageDirection();
  await page.goto(BASE + 'absence-reponse.html?' + q); await page.waitForTimeout(1500);
  r.sansParametres = await pageDirection();
  // 11. Le poseur voit ses deux demandes ; un autre poseur ne voit rien
  await page.goto(ABS); await page.waitForTimeout(2500);
  r.fin = await vue();
  await connecter('poseur2');
  await page.goto(ABS); await page.waitForTimeout(2500);
  r.autrePoseur = await vue();
  await reglage('absences-avant');
  return JSON.stringify(r);
}`;
}

function lancer() {
  const f = path.join(dossier, 'scenario.js');
  fs.writeFileSync(f, scenario());
  spawnSync('playwright-cli', ['-s=loue-l14', 'close'], { shell: true });
  spawnSync('playwright-cli', ['-s=loue-l14', 'open', '--browser=chrome', '--mobile', 'about:blank'], { shell: true, encoding: 'utf8' });
  const sortie = spawnSync('playwright-cli', ['-s=loue-l14'].concat(process.env.LOUE_DEBUG ? [] : ['--raw'], ['run-code', '--filename=' + f]), { shell: true, encoding: 'utf8', timeout: 400000 });
  if (process.env.LOUE_DEBUG) fs.writeFileSync(process.env.LOUE_DEBUG, JSON.stringify({ status: sortie.status, signal: sortie.signal, out: sortie.stdout, err: sortie.stderr }, null, 1));
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
    console.log('Lot 14 — la demande d’absence dans un vrai Chrome, largeur téléphone (service worker actif, faux serveur)');
    const r = lancer(), j = x => JSON.stringify(x);
    console.log(' Le poseur');
    verifier('lot 14 éteint côté serveur : la page est celle d’avant (pas de « Mes demandes », champ e-mail présent)', r.connexion === 'CONNECTE' && r.avant.section === false && r.avant.email === true, j(r.avant));
    verifier('allumé : « Mes demandes » apparaît (vide), le champ e-mail disparaît, les motifs Congés, École, Formation sont proposés ; pas de défilement horizontal',
      r.allume.section === true && r.allume.email === false && /Aucune demande/.test(r.allume.vide) && j(r.allume.motifs.slice(0, 3)) === j(['Congés', 'École', 'Formation'])
      && r.allume.motifs.indexOf('Médical') > -1 && r.allume.largeur === true, j(r.allume));
    verifier('la demande envoyée s’affiche « En attente » ; le mail n’est parti qu’à la direction ; le serveur ne garde aucun motif',
      j(r.apresEnvoi.lignes.map(l => l.slice(0, 2))) === j([['07/12/2026', 'En attente']]) && /Journée entière — demandée le/.test(r.apresEnvoi.lignes[0][2])
      && j(r.mails1) === j(['direction@loue.test']) && j(r.serveur1.map(l => l.slice(1, 7))) === j([['poseur1', 'Kévin ESSAI', '07/12/2026', 'Journée entière', 'Absent', 'En attente']]), j([r.apresEnvoi, r.mails1, r.serveur1]));
    console.log(' La direction');
    verifier('le lien du mail ouvre une page qui rappelle la demande (qui, quelle date, quelle durée), sans le motif ; ouvrir la page ne décide rien',
      r.direction.demande && r.direction.choix && r.direction.nom === 'Kévin ESSAI' && r.direction.date === '07/12/2026' && r.direction.duree === 'Journée entière'
      && !/spécialiste|Médical/.test(r.direction.corps) && r.serveurAvantConfirmer[0][6] === 'En attente', j([r.direction, r.serveurAvantConfirmer]));
    verifier('un gros bouton « ✅ Confirmer : j’accepte » (56 px au moins), un second pour changer d’avis (48 px au moins) ; tient dans 375 px ; pas de service worker sur cette page… ou sans effet',
      r.direction.bouton === '✅ Confirmer : j’accepte' && /préfère refuser/.test(r.direction.autre) && r.direction.hautBouton >= 56 && r.direction.hautAutre >= 48 && r.direction.largeur === true, j(r.direction));
    verifier('« Confirmer » : la demande est acceptée, la page le dit, le conducteur reçoit un mail',
      /✅ Demande acceptée\./.test(r.confirme.resultat) && !r.confirme.choix && r.serveur2[0][6] === 'Acceptée' && r.mailsConducteur === 1, j([r.confirme.resultat, r.serveur2, r.mailsConducteur]));
    verifier('usage unique : le lien rouvert (même « Refuser ») redit la réponse donnée, sans aucun bouton',
      /Une réponse a déjà été donnée : demande acceptée/.test(r.dejaDecide.resultat) && r.dejaDecide.choix === false && r.dejaDecide.demande === true, j(r.dejaDecide));
    verifier('« Refuser » : le bouton est rouge, on peut changer d’avis avant de confirmer ; confirmé : refusée, aucun mail de plus au conducteur',
      r.refus.bouton === '❌ Confirmer : je refuse' && r.refusChange.bouton === '✅ Confirmer : j’accepte' && /❌ Demande refusée\./.test(r.refuse.resultat)
      && r.serveur3.some(l => l[3] === '14/12/2026' && l[6] === 'Refusée' && l[5] === 'École') && r.mailsConducteur3 === 1, j([r.refus.bouton, r.refusChange.bouton, r.refuse.resultat, r.serveur3, r.mailsConducteur3]));
    verifier('un lien trafiqué ou sans paramètres : « ce lien n’est pas valable », aucun bouton, rien de la demande',
      /n’est pas valable/.test(r.trafique.resultat) && !r.trafique.choix && !r.trafique.demande && /n’est pas valable/.test(r.sansParametres.resultat) && !r.sansParametres.choix, j([r.trafique, r.sansParametres]));
    console.log(' Le poseur, ensuite');
    verifier('il voit « Acceptée » en rouvrant la page', j(r.acceptee.lignes.map(l => l.slice(0, 2))) === j([['07/12/2026', 'Acceptée']]) && /réponse du/.test(r.acceptee.lignes[0][2]), j(r.acceptee));
    verifier('hors réseau : l’état gardé dans le téléphone s’affiche, avec sa date', j(r.horsReseau.lignes.map(l => l.slice(0, 2))) === j([['07/12/2026', 'Acceptée']]) && /Pas de réseau : état du/.test(r.horsReseau.info), j(r.horsReseau));
    verifier('… une demande faite sans réseau s’affiche « ⏳ dans le téléphone », et part toute seule au retour du réseau',
      j(r.enFile.lignes.map(l => l.slice(0, 2))) === j([['14/12/2026', '⏳ dans le téléphone'], ['07/12/2026', 'Acceptée']])
      && j(r.partie.lignes.map(l => l.slice(0, 2))) === j([['14/12/2026', 'En attente'], ['07/12/2026', 'Acceptée']]), j([r.enFile, r.partie]));
    verifier('à la fin : ses deux demandes, la plus récente en haut (Refusée, Acceptée) ; un autre poseur ne voit rien',
      j(r.fin.lignes.map(l => l.slice(0, 2))) === j([['14/12/2026', 'Refusée'], ['07/12/2026', 'Acceptée']]) && r.autrePoseur.section === true && r.autrePoseur.lignes.length === 0, j([r.fin, r.autrePoseur]));
  } catch (e) { echecs++; console.log('  ✗ ' + e.message); }
  spawnSync('playwright-cli', ['-s=loue-l14', 'close'], { shell: true });
  site.kill(); faux.kill();
  fs.rmSync(dossier, { recursive: true, force: true });
  console.log(reussis + ' test(s) réussi(s)' + (echecs ? ' — DES TESTS ÉCHOUENT' : ''));
  if (echecs) process.exitCode = 1;
}, 2500);
