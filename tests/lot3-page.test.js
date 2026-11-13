// Lot 3 — page « Notes » (la liste des choses à faire d'un chantier) dans un VRAI Chrome, en largeur téléphone :
//   node tests/lot3-page.test.js
// Demande playwright-cli (npm i -g @playwright/cli) et Python sur le PC ; sinon le test est sauté.
// Lance lui-même le site (http://127.0.0.1:8785) et le faux serveur (8786) : jamais la copie TEST, jamais la production.
// Les comptes et le mot de passe sont ceux du faux serveur local (tests/faux-serveur.js), jamais de vrais comptes.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const racine = path.join(__dirname, '..');
const outil = spawnSync('playwright-cli', ['--version'], { shell: true, encoding: 'utf8' });
const python = spawnSync('python', ['--version'], { shell: true, encoding: 'utf8' });
if (outil.status !== 0 || python.status !== 0) { console.log('Lot 3, page : playwright-cli ou Python absent, test sauté'); process.exit(0); }

const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'loue-l3-'));
const SITE = 'http://127.0.0.1:8785/', SERVEUR = 'http://127.0.0.1:8786', API = SERVEUR + '/exec';
const site = spawn('python', ['-m', 'http.server', '8785', '--bind', '127.0.0.1', '--directory', racine], { stdio: 'ignore' });
const faux = spawn('node', [path.join(__dirname, 'faux-serveur.js'), '8786'], { stdio: 'ignore' });

function scenario() {
  return `async page => {
  const BASE = ${JSON.stringify(SITE)}, SERVEUR = ${JSON.stringify(SERVEUR)}, q = 'api=${API}&sw=1', MDP = 'Essai-' + '2026';
  const NOTES = BASE + 'notes.html?' + q + '&chantier=CHANTIER%20TEST%201';
  const ctx = page.context(), r = {};
  const file = () => page.evaluate(() => LOUE.stockage.tout('file').then(l => l.filter(e => e.etat !== 'erreur').length));
  const attendreFileVide = async () => { for (let i = 0; i < 40; i++) { await page.waitForTimeout(500); if (!(await file())) return; } };
  const connecter = id => page.evaluate(a => { LOUE.deconnecter(); return LOUE.connexion(a[0], a[1]).then(x => x.code); }, [id, MDP]);
  // lignes de l'onglet Notes du faux serveur : [texte, fait, créé par, modifié par (identifiant)]
  const serveur = () => page.evaluate(u => fetch(u + '/etat').then(x => x.json()).then(e => e.notes.slice(1).map(l => [l[2], l[3], l[5], l[7]])), SERVEUR);
  const reglage = m => page.evaluate(u => fetch(u).then(x => x.text()), SERVEUR + '/reglage?mode=' + m);
  const etat = () => page.evaluate(() => { const visible = id => getComputedStyle(document.getElementById(id)).display !== 'none';
    const textes = sel => Array.from(document.querySelectorAll(sel + ' .el')).map(c => (c.querySelector('.el-texte') || {}).firstChild ? c.querySelector('.el-texte').firstChild.textContent : '');
    return { haut: textes('#liste'), bas: textes('#liste-termines'), titreTermines: document.getElementById('termines-titre').textContent,
    terminesVisible: visible('termines'), terminesOuvert: document.getElementById('termines').open,
    barres: document.querySelectorAll('#liste .el.faite').length, attente: document.querySelectorAll('#liste .el-marque.attente, #liste-termines .el-marque.attente').length,
    nouveau: document.querySelectorAll('#liste .el-marque.nouveau').length, casesInactives: document.querySelectorAll('#liste .case:disabled').length,
    info: document.getElementById('info').textContent, vide: (document.querySelector('#liste .vide') || {}).textContent || '',
    tout: document.querySelector('.main').textContent, saisie: document.getElementById('saisie-texte').value,
    saisieCachee: !visible('saisie'), filtres: visible('filtres'),
    xss: window.__xss || 0, dangereux: document.querySelectorAll('#liste img, #liste script, #liste iframe, #liste .el-texte b').length,
    largeur: document.documentElement.scrollWidth <= innerWidth,
    grandeCase: Array.from(document.querySelectorAll('#liste .case')).every(b => b.getBoundingClientRect().width >= 48 && b.getBoundingClientRect().height >= 48) }; });
  const ligne = t => page.evaluate(a => { const c = Array.from(document.querySelectorAll('.el')).find(x => x.textContent.indexOf(a) > -1); return c ? c.dataset.note : ''; }, t);
  const cocher = t => page.evaluate(a => { const c = Array.from(document.querySelectorAll('.el')).find(x => x.textContent.indexOf(a) > -1); if (c) c.querySelector('.case').click(); return !!c; }, t);
  const toucherTexte = t => page.evaluate(a => { const c = Array.from(document.querySelectorAll('#liste .el')).find(x => x.textContent.indexOf(a) > -1); if (c) c.querySelector('.el-texte').click(); return !!c; }, t);
  const ajouter = async t => { await page.fill('#saisie-texte', t); await page.evaluate(() => ajouter()); };

  await ctx.setOffline(false);
  await page.goto(BASE + 'index.html?' + q);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => 1));
  await page.reload(); await page.waitForTimeout(1500);
  await page.evaluate(async () => { for (const e of await LOUE.stockage.tout('file')) await LOUE.abandonner(e.id); });
  r.connexion = await connecter('poseur1');

  // 1. Page vierge
  await page.goto(NOTES); await page.waitForTimeout(2500);
  r.vierge = await etat();
  // 2. HORS RÉSEAU : un texte commencé est retrouvé après fermeture ; puis trois éléments ajoutés, dont un texte hostile
  await ctx.setOffline(true);
  await page.fill('#saisie-texte', 'Cales de 5'); await page.waitForTimeout(1200);
  await page.reload(); await page.waitForTimeout(3000);
  r.texteRetrouve = await etat();
  await page.evaluate(() => ajouter()); await page.waitForTimeout(1200);
  await ajouter('<b>gras</b> <img src=x onerror="window.__xss=1">'); await page.waitForTimeout(1200);
  await page.fill('#saisie-texte', 'Seuil A12'); await page.press('#saisie-texte', 'Enter'); await page.waitForTimeout(1200);   // la touche Entrée ajoute aussi
  r.horsReseau = await etat(); r.horsReseau.file = await file();
  // 3. toujours hors réseau : on corrige et on coche ce qu'on vient d'ajouter (l'ajout n'est pas encore parti)
  await toucherTexte('Cales de 5'); await page.waitForTimeout(600);
  r.enModification = await page.evaluate(() => ({ zone: (document.querySelector('.el-edit') || {}).value, saisieCachee: getComputedStyle(document.getElementById('saisie')).display === 'none',
    autresInactives: document.querySelectorAll('#liste .case:disabled').length }));
  await page.fill('.el-edit', 'TEXTE EN COURS DE FRAPPE');
  await page.evaluate(() => { charger(); majAttente(true); }); await page.waitForTimeout(2500);   // la liste est relue pendant la frappe
  r.frappe = await page.evaluate(() => (document.querySelector('.el-edit') || {}).value || '(zone disparue)');
  await page.fill('.el-edit', 'Cales de 8'); await page.press('.el-edit', 'Enter'); await page.waitForTimeout(1200);
  await cocher('Seuil A12'); await page.waitForTimeout(800);
  r.justeCoche = await etat();                       // resté en place, barré
  await page.waitForTimeout(3200);
  r.apresDelai = await etat();                       // descendu dans « Éléments terminés »
  r.fileAvantReseau = await file();
  // 4. le réseau revient : tout part, dans l'ordre (ajouts, puis gestes)
  await ctx.setOffline(false);
  await page.evaluate(() => LOUE.viderFile(true)); await attendreFileVide(); await page.waitForTimeout(2500);
  r.envoye = await etat();
  r.message = await page.evaluate(() => (document.getElementById('loue-message') || {}).textContent || '');
  r.serveur1 = await serveur();
  // 5. cocher puis annuler tout de suite (élément encore en place) ; ouvrir « Éléments terminés » et décocher
  await cocher('Cales de 8'); await page.waitForTimeout(700);
  await cocher('Cales de 8'); await page.waitForTimeout(4000);
  r.annule = await etat();
  await page.evaluate(() => { document.querySelector('#termines summary').click(); }); await page.waitForTimeout(400);
  await cocher('Seuil A12'); await page.waitForTimeout(3500);
  r.decoche = await etat();
  r.serveur2 = await serveur();
  // 6. un appui par erreur sur un texte : en sortir sans rien changer referme la zone toute seule
  await toucherTexte('Seuil A12'); await page.waitForTimeout(500);
  await page.evaluate(() => document.querySelector('.el-edit').blur()); await page.waitForTimeout(900);
  r.refermee = await page.evaluate(() => ({ zone: !!document.querySelector('.el-edit'), casesInactives: document.querySelectorAll('#liste .case:disabled').length,
    saisieVisible: getComputedStyle(document.getElementById('saisie')).display !== 'none' }));
  // 6 bis. une modification ouverte sans changement, puis un appui sur le texte d'une AUTRE ligne : la première se referme,
  //        la seconde s'ouvre ; avec un changement en cours, on ne perd pas la frappe
  await toucherTexte('Seuil A12'); await page.waitForTimeout(400);
  await toucherTexte('Cales de 8'); await page.waitForTimeout(600);
  r.autreLigne = await page.evaluate(() => ({ zones: document.querySelectorAll('.el-edit').length, valeur: (document.querySelector('.el-edit') || {}).value }));
  await page.fill('.el-edit', 'Cales de 8 modifié'); await toucherTexte('Seuil A12'); await page.waitForTimeout(600);
  r.autreLigneFrappe = await page.evaluate(() => ({ zones: document.querySelectorAll('.el-edit').length, valeur: (document.querySelector('.el-edit') || {}).value }));
  await page.evaluate(() => { Array.from(document.querySelectorAll('.el-boutons button')).find(b => b.textContent === 'Annuler').click(); }); await page.waitForTimeout(400);
  // 6 ter. deux cases cochées coup sur coup : aucune n'est perdue
  await page.evaluate(() => { const c = document.querySelectorAll('#liste .case'); c[0].click(); c[2].click(); }); await page.waitForTimeout(5000);
  r.deuxCoches = await etat(); r.deuxCochesServeur = (await serveur()).map(l => l[1]);
  await page.evaluate(() => { if (!document.getElementById('termines').open) document.querySelector('#termines summary').click(); }); await page.waitForTimeout(300);
  await cocher('Cales de 8'); await page.waitForTimeout(1500); await cocher('Seuil A12'); await page.waitForTimeout(4000);
  // 7. AVEC du réseau, le serveur refuse passagèrement : un ajout et un geste sur cet ajout attendent ; l'ajout est reporté
  //    d'une heure, le geste est prêt : il ne doit PAS partir avant l'ajout
  await reglage('panne');
  await ajouter('Ajout retardé'); await page.waitForTimeout(2000);
  await cocher('Ajout retardé'); await page.waitForTimeout(2000);
  await page.evaluate(async () => { const l = (await LOUE.stockage.tout('file')).sort((a, b) => a.cree - b.cree);
    l.forEach((e, i) => { e.prochainEssai = i ? 0 : Date.now() + 3600000; e.attenteReseau = false; e.aConfirmer = false; e.message = 'Serveur occupé'; });
    for (const e of l) await LOUE.stockage.ecrire('file', e); });
  await reglage('normal');
  await page.evaluate(() => LOUE.viderFile()); await page.waitForTimeout(3000);
  r.ordreRetenu = { file: await file(), types: await page.evaluate(() => LOUE.stockage.tout('file').then(l => l.sort((a, b) => a.cree - b.cree).map(e => e.type + ':' + e.etat))),
    serveur: (await serveur()).length };
  await page.evaluate(() => LOUE.viderFile(true)); await attendreFileVide(); await page.waitForTimeout(2500);
  r.ordreRetenu.apres = (await serveur()).filter(l => l[0] === 'Ajout retardé');
  // 8. hors réseau après rechargement : la dernière liste, avec sa date ; puis réseau lent (6 s par réponse)
  await ctx.setOffline(true); await page.reload(); await page.waitForTimeout(3000);
  r.listeHorsReseau = await etat();
  await ctx.setOffline(false);
  await reglage('lent');
  await page.reload(); await page.waitForTimeout(1500);
  r.lentAvant = await etat();
  await page.waitForTimeout(8000);
  r.lentApres = await etat();
  await reglage('normal');

  // 8 bis. un élément ajouté hors réseau part depuis l'ACCUEIL (la page Notes est fermée), puis le réseau retombe :
  //        en rouvrant Notes hors réseau, l'élément est bien là (la liste gardée a suivi), il n'a pas « disparu »
  await page.reload(); await page.waitForTimeout(2500);
  await ctx.setOffline(true);
  await ajouter('Parti depuis l’accueil'); await page.waitForTimeout(1200);
  await page.goto(BASE + 'index.html?' + q); await page.waitForTimeout(1500);
  await ctx.setOffline(false);
  await page.evaluate(() => LOUE.viderFile(true)); await attendreFileVide(); await page.waitForTimeout(1500);
  await ctx.setOffline(true);
  await page.goto(NOTES); await page.waitForTimeout(3000);
  r.partiAccueil = await etat(); r.partiAccueil.file = await file();
  await ctx.setOffline(false); await page.reload(); await page.waitForTimeout(2500);
  // 9. téléphone partagé : poseur1 laisse un ajout en attente et un texte commencé ; poseur2 se connecte
  await ctx.setOffline(true);
  await ajouter('AJOUT EN ATTENTE DE POSEUR1'); await page.waitForTimeout(1500);
  await cocher('Cales de 8'); await page.waitForTimeout(1200);          // et un geste de poseur1 en attente sur « Cales de 8 »
  await page.fill('#saisie-texte', 'TEXTE SECRET DE POSEUR1'); await page.waitForTimeout(1200);
  await ctx.setOffline(false);
  r.connexion2 = await connecter('poseur2'); await page.waitForTimeout(3500);
  r.poseur2Premier = await etat();   // première fois qu'il voit ce chantier : les éléments des autres sont « nouveaux »
  await page.reload(); await page.waitForTimeout(3000);
  r.poseur2 = await etat(); r.poseur2.file = await file();
  r.serveurPoseur2 = await serveur();
  // poseur2 modifie librement un élément écrit par poseur1, et coche « Cales de 8 » alors que le geste de poseur1 attend encore
  await toucherTexte('Seuil A12'); await page.waitForTimeout(500);
  await page.fill('.el-edit', 'Seuil A12 à reprendre'); await page.evaluate(() => { Array.from(document.querySelectorAll('.el-boutons button')).find(b => b.textContent === 'OK').click(); });
  await page.waitForTimeout(3000);
  await cocher('Cales de 8'); await page.waitForTimeout(4500);
  r.partage = { serveur: await serveur(), file: await file() };
  await ctx.setOffline(true); await page.reload(); await page.waitForTimeout(3000);
  r.poseur2HorsReseau = await etat();
  await ctx.setOffline(false);
  // … poseur1 se reconnecte : ce qu'il avait écrit part, sous SON nom
  r.connexion1 = await connecter('poseur1'); await attendreFileVide(); await page.waitForTimeout(2000);
  r.apresRetour = await serveur();

  // 10. vue « Tous chantiers » : conducteur seulement, en lecture, recherche faite par le serveur, « tout marquer comme lu »
  await page.goto(BASE + 'index.html?' + q); await page.waitForTimeout(1500);   // depuis l'accueil : se connecter sur la page d'un chantier marquerait sa liste « vue »
  r.connexion3 = await connecter('conducteur1');
  await page.goto(BASE + 'notes.html?' + q); await page.waitForTimeout(3000);
  r.tous = await etat();
  r.tousLiens = await page.evaluate(() => Array.from(document.querySelectorAll('#liste .el-info a')).map(a => a.getAttribute('href')).slice(0, 1));
  await page.fill('#f-recherche', 'seuil'); await page.waitForTimeout(2500);
  r.recherche = await etat();
  await page.fill('#f-recherche', ''); await page.selectOption('#f-chantier', 'CHANTIER TEST 1'); await page.waitForTimeout(2500);
  r.unChantier = await etat();
  r.unChantierLiens = await page.evaluate(() => Array.from(document.querySelectorAll('#liste .el-info a')).map(a => a.textContent + ' → ' + a.getAttribute('href')).slice(0, 1));
  await page.selectOption('#f-chantier', ''); await page.check('#f-termines'); await page.waitForTimeout(2500);
  r.avecTermines = await etat();
  r.nouvellesAvant = await page.evaluate(() => LOUE.notes.nouvelles().then(d => d.total));
  await page.evaluate(() => toutMarquerLu()); await page.waitForTimeout(3000);
  r.toutLu = await page.evaluate(() => LOUE.notes.nouvelles().then(d => d.total));
  await connecter('poseur1'); await page.reload(); await page.waitForTimeout(3000);
  r.tousPoseur = await etat();

  // 11. accueil : chiffre rouge pour poseur2 (deux éléments de poseur1 arrivés depuis sa visite : l'ajout resté en attente, et celui-ci)
  await page.goto(NOTES); await page.waitForTimeout(2500);
  await ajouter('Pour le chiffre rouge'); await attendreFileVide(); await page.waitForTimeout(1500);
  await page.goto(BASE + 'index.html?' + q); await page.waitForTimeout(1500);   // depuis l'accueil : se connecter sur la page des notes les marquerait « vues »
  await connecter('poseur2');
  await page.reload(); await page.waitForTimeout(4000);
  r.badge = await page.evaluate(() => ({ carte: (document.querySelector('.chantier-card .badge-notes') || {}).textContent || '',
    tuileConducteur: document.getElementById('tuile-notes-accueil').hidden }));
  await page.evaluate(() => { const c = document.querySelector('.chantier-card'); if (c) c.click(); }); await page.waitForTimeout(800);
  r.badge.tuile = await page.evaluate(() => ({ visible: !document.getElementById('tuile-notes').hidden, badge: document.getElementById('badge-notes').textContent }));

  // 12. sans compte : rien
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
  if (cond) { reussis++; console.log('  ✓ ' + nom); } else { echecs++; console.log('  ✗ ' + nom + '\n    ' + String(detail).slice(0, 1000)); }
}
setTimeout(() => {
  try {
    console.log('Lot 3 — page « Notes » (liste façon Keep) dans un vrai Chrome, largeur téléphone (service worker actif, faux serveur)');
    const r = lancer(), j = x => JSON.stringify(x);
    const HOSTILE = '<b>gras</b> <img src=x onerror="window.__xss=1">';
    verifier('page vierge : champ d’ajout visible en bas, liste vide, ni filtres ni section « terminés », pas de défilement horizontal', r.connexion === 'CONNECTE' && r.vierge.haut.length === 0
      && !r.vierge.saisieCachee && /Ajoutez le premier élément/.test(r.vierge.vide) && r.vierge.largeur === true && r.vierge.filtres === false && r.vierge.terminesVisible === false, j(r.vierge));
    verifier('texte en cours de frappe retrouvé après fermeture, hors réseau, sans question', r.texteRetrouve.saisie === 'Cales de 5', j(r.texteRetrouve.saisie));
    verifier('trois éléments ajoutés hors réseau (bouton et touche Entrée) : affichés tout de suite dans l’ordre, « ⏳ », champ vidé, rangés dans le téléphone',
      j(r.horsReseau.haut) === j(['Cales de 5', HOSTILE, 'Seuil A12']) && r.horsReseau.attente === 3 && r.horsReseau.saisie === '' && r.horsReseau.file === 3, j(r.horsReseau));
    verifier('à l’écran : ni auteur, ni date, ni photo, ni PDF, ni corbeille, ni historique', !/Thomas|TEST 20|\d{2}\/\d{2}\/\d{4}|photo|PDF|Corbeille|Historique|Supprimer/i.test(r.horsReseau.tout), r.horsReseau.tout);
    verifier('cases à cocher d’au moins 48 px, utilisables avec des gants', r.horsReseau.grandeCase === true && r.horsReseau.casesInactives === 0, j(r.horsReseau));
    verifier('toucher le texte ouvre la modification : la barre d’ajout se cache, les autres cases attendent', r.enModification.zone === 'Cales de 5' && r.enModification.saisieCachee === true
      && r.enModification.autresInactives === 2, j(r.enModification));
    verifier('une modification en cours de frappe n’est pas écrasée quand la liste est relue', r.frappe === 'TEXTE EN COURS DE FRAPPE', j(r.frappe));
    verifier('hors réseau, on corrige et on coche ce qu’on vient d’ajouter : l’élément coché reste en place, barré', j(r.justeCoche.haut) === j(['Cales de 8', HOSTILE, 'Seuil A12'])
      && r.justeCoche.barres === 1, j(r.justeCoche));
    verifier('… puis il descend dans « Éléments terminés (1) », replié', j(r.apresDelai.haut) === j(['Cales de 8', HOSTILE]) && j(r.apresDelai.bas) === j(['Seuil A12'])
      && r.apresDelai.titreTermines === 'Éléments terminés (1)' && r.apresDelai.terminesOuvert === false && r.fileAvantReseau === 5, j([r.apresDelai, r.fileAvantReseau]));
    verifier('au retour du réseau tout part, dans l’ordre : le serveur a les trois éléments, le texte corrigé, la case cochée', r.envoye.attente === 0 && !/aucun mail/.test(r.message)
      && j(r.serveur1.map(l => [l[0], l[1]])) === j([['Cales de 8', ''], [HOSTILE, ''], ['Seuil A12', 'Oui']]), j([r.serveur1, r.envoye, r.message]));
    verifier('un texte hostile s’affiche comme du texte, jamais comme du code', r.envoye.xss === 0 && r.envoye.dangereux === 0 && r.envoye.haut.indexOf(HOSTILE) === 1 && r.envoye.largeur === true, j(r.envoye));
    verifier('cocher puis toucher de nouveau tout de suite : annulé, l’élément reste à faire', r.annule.haut.indexOf('Cales de 8') === 0 && r.annule.barres === 0, j(r.annule));
    verifier('« Éléments terminés » ouvert : décocher remet l’élément dans la liste ; la section reste ouverte tant qu’elle a du contenu', j(r.decoche.haut) === j(['Cales de 8', HOSTILE, 'Seuil A12'])
      && r.decoche.bas.length === 0 && j(r.serveur2.map(l => l[1])) === j(['', '', '']), j([r.decoche, r.serveur2]));
    verifier('un appui par erreur sur un texte : sortir sans rien changer referme la zone, rien ne reste bloqué', r.refermee.zone === false && r.refermee.casesInactives === 0 && r.refermee.saisieVisible === true, j(r.refermee));
    verifier('modification ouverte sans changement, appui sur une autre ligne : la première se referme, la seconde s’ouvre', r.autreLigne.zones === 1 && r.autreLigne.valeur === 'Cales de 8', j(r.autreLigne));
    verifier('… avec une frappe en cours, l’appui sur une autre ligne ne fait rien perdre', r.autreLigneFrappe.zones === 1 && r.autreLigneFrappe.valeur === 'Cales de 8 modifié', j(r.autreLigneFrappe));
    verifier('deux cases cochées coup sur coup : les deux sont enregistrées', j(r.deuxCoches.bas.slice().sort()) === j(['Cales de 8', 'Seuil A12']) && j(r.deuxCochesServeur) === j(['Oui', '', 'Oui']), j([r.deuxCoches.bas, r.deuxCochesServeur]));
    verifier('l’ajout est retardé : le geste sur cet élément attend son tour (rien ne part dans le désordre)', r.ordreRetenu.file === 2 && r.ordreRetenu.serveur === 3
      && j(r.ordreRetenu.types) === j(['note-chantier:en attente', 'note-action:en attente']) && j(r.ordreRetenu.apres.map(l => l[1])) === j(['Oui']), j(r.ordreRetenu));
    verifier('hors réseau après rechargement : dernière liste gardée, avec sa date', r.listeHorsReseau.haut.length === 3 && /Liste du .* gardée dans le téléphone/.test(r.listeHorsReseau.info)
      && r.listeHorsReseau.titreTermines === 'Éléments terminés (1)', j(r.listeHorsReseau));
    verifier('réseau lent : la liste gardée s’affiche tout de suite, l’ajout reste possible, puis la liste du serveur arrive',
      !r.lentAvant.saisieCachee && r.lentAvant.haut.length === 3 && /gardée dans le téléphone/.test(r.lentAvant.info) && r.lentApres.haut.length === 3 && r.lentApres.info === '', j([r.lentAvant, r.lentApres]));
    verifier('un élément parti depuis l’accueil est retrouvé hors réseau en rouvrant la liste (il ne « disparaît » pas)', r.partiAccueil.file === 0 && r.partiAccueil.haut.indexOf('Parti depuis l’accueil') > -1
      && /gardée dans le téléphone/.test(r.partiAccueil.info), j(r.partiAccueil));
    verifier('téléphone partagé : le second poseur ne voit ni l’ajout en attente ni le texte commencé du premier', r.connexion2 === 'CONNECTE' && r.poseur2.haut.length === 4 && r.poseur2.attente === 0
      && r.poseur2.saisie === '' && r.poseur2.tout.indexOf('POSEUR1') < 0, j(r.poseur2));
    verifier('… les éléments des autres sont « nouveaux » à sa première visite, plus à la suivante', r.poseur2Premier.nouveau === 4 && r.poseur2.nouveau === 0, j([r.poseur2Premier.nouveau, r.poseur2.nouveau]));
    verifier('… ce que le premier a laissé en attente ne part pas sous le nom du second', r.poseur2.file === 2 && !r.serveurPoseur2.some(l => /POSEUR1/.test(l[0])), j([r.poseur2.file, r.serveurPoseur2]));
    verifier('modification libre : le second poseur corrige un élément écrit par le premier ; son geste part même si celui du premier attend encore sur le même élément',
      r.partage.file === 2 && r.partage.serveur.some(l => l[0] === 'Seuil A12 à reprendre' && l[3] === 'poseur2') && r.partage.serveur.some(l => l[0] === 'Cales de 8' && l[1] === 'Oui'), j(r.partage));
    verifier('… hors réseau non plus, rien du premier', r.poseur2HorsReseau.tout.indexOf('POSEUR1') < 0 && r.poseur2HorsReseau.saisie === '', j(r.poseur2HorsReseau.tout));
    verifier('… tout part quand le premier se reconnecte, sous SON nom', r.connexion1 === 'CONNECTE' && r.apresRetour.some(l => l[0] === 'AJOUT EN ATTENTE DE POSEUR1' && /\(poseur1\)$/.test(l[2])), j(r.apresRetour));
    verifier('vue « Tous chantiers » (conducteur) : en lecture (cases inactives, pas d’ajout), chaque élément renvoie à son chantier', r.connexion3 === 'CONNECTE' && r.tous.haut.length >= 3
      && r.tous.filtres === true && r.tous.saisieCachee === true && r.tous.casesInactives === r.tous.haut.length && /notes\.html\?chantier=CHANTIER%20TEST%201/.test(r.tousLiens[0] || ''), j([r.tous, r.tousLiens]));
    verifier('… avec un chantier choisi dans le filtre : chaque élément renvoie toujours à ce chantier, et les terminés restent cachés', r.unChantier.haut.length >= 3 && r.unChantier.terminesVisible === false
      && /^CHANTIER TEST 1 → notes\.html\?chantier=CHANTIER%20TEST%201$/.test(r.unChantierLiens[0] || ''), j([r.unChantier.haut, r.unChantier.terminesVisible, r.unChantierLiens]));
    verifier('… la recherche est faite par le serveur ; « Avec les terminés » les ajoute', j(r.recherche.haut) === j(['Seuil A12 à reprendre']) && r.avecTermines.terminesVisible === true
      && r.avecTermines.bas.length >= 2, j([r.recherche.haut, r.avecTermines.bas]));
    verifier('… « Tout marquer comme lu » remet à zéro les éléments nouveaux du conducteur', r.nouvellesAvant > 0 && r.toutLu === 0, j([r.nouvellesAvant, r.toutLu]));
    verifier('vue « Tous chantiers » refusée à un poseur', r.tousPoseur.haut.length === 0 && /réservée aux conducteurs/.test(r.tousPoseur.info), j(r.tousPoseur.info));
    verifier('accueil : chiffre rouge sur le chantier et sur la tuile « Notes » ; pas de tuile « tous chantiers » pour un poseur',
      r.badge.carte === '2' && r.badge.tuile.visible === true && r.badge.tuile.badge === '2' && r.badge.tuileConducteur === true, j(r.badge));
    verifier('sans compte : rien n’est affiché, connexion demandée, pas d’ajout', r.sansCompte.haut.length === 0 && /Connectez-vous/.test(r.sansCompte.vide) && r.sansCompte.saisieCachee === true, j(r.sansCompte));
  } catch (e) { echecs++; console.log('  ✗ ' + e.message); }
  spawnSync('playwright-cli', ['-s=loue-l3', 'close'], { shell: true });
  site.kill(); faux.kill();
  fs.rmSync(dossier, { recursive: true, force: true });
  console.log(reussis + ' test(s) réussi(s)' + (echecs ? ' — DES TESTS ÉCHOUENT' : ''));
  if (echecs) process.exitCode = 1;
}, 2500);
