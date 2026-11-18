// Lot 10a-1 — page « À commander » dans un VRAI Chrome, en largeur téléphone (375 px) et PC : node tests/lot10-page.test.js
// Demande playwright-cli (npm i -g @playwright/cli) et Python sur le PC ; sinon le test est sauté.
// Lance lui-même le site (http://127.0.0.1:8797) et le faux serveur (8798, horloge réglable, heure de Paris), puis vérifie :
//  A. la tuile de l'accueil ; la page à 375 px (pas de défilement horizontal, zones à toucher de 48 px au moins, aucune liste
//     à dérouler) ; l'envoi et ses messages (avant et après le passage du jour) ; réseau lent ; réponse perdue (pas de doublon) ;
//     « ✓ Commandé » ; « Outil en panne » ; le brouillon restauré ; un texte hostile ; la largeur PC ;
//  B. hors réseau puis retour ; « Mes demandes » hors réseau ; second compte sur le même téléphone ; sans compte.
// Si l'un des deux ports est déjà pris (une autre série en cours), le test ATTEND qu'il se libère : il n'arrête rien.
'use strict';
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const racine = path.join(__dirname, '..');
const outil = spawnSync('playwright-cli', ['--version'], { shell: true, encoding: 'utf8' });
const python = spawnSync('python', ['--version'], { shell: true, encoding: 'utf8' });
if (outil.status !== 0 || python.status !== 0) { console.log('Lot 10 (page) : playwright-cli ou Python absent, test sauté'); process.exit(0); }

const PORT_SITE = 8797, PORT_API = 8798, SESSION = '-s=loue-l10';
const SITE = 'http://127.0.0.1:' + PORT_SITE + '/', SERVEUR = 'http://127.0.0.1:' + PORT_API, API = SERVEUR + '/exec';
const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'loue-l10-'));
// Mardi 17/11/2026 à l'heure de Paris (hiver, UTC+1) : l'horloge du faux serveur est réglée par le test
const HEURE = (h, jour) => encodeURIComponent('2026-11-' + (jour || '17') + 'T' + h + ':00+01:00');

function portLibre(port) {
  return new Promise(ok => {
    const s = net.createServer();
    s.once('error', () => ok(false));
    s.once('listening', () => s.close(() => ok(true)));
    s.listen(port, '127.0.0.1');
  });
}
async function attendrePorts() {
  for (let i = 0; i < 90; i++) {
    if (await portLibre(PORT_SITE) && await portLibre(PORT_API)) return true;
    if (i === 0) console.log('  (port ' + PORT_SITE + ' ou ' + PORT_API + ' déjà pris : attente, 3 minutes au plus)');
    await new Promise(r => setTimeout(r, 2000));
  }
  return false;
}

// Outils communs aux deux scénarios (exécutés dans Chrome par playwright-cli run-code)
const OUTILS = `
  const BASE = ${JSON.stringify(SITE)}, SERVEUR = ${JSON.stringify(SERVEUR)}, q = 'api=${API}&sw=1', MDP = 'Essai-' + '2026';
  const ctx = page.context(), r = { erreursJs: [] };
  page.on('dialog', d => d.accept().catch(() => {}));
  page.on('pageerror', e => r.erreursJs.push(String(e.message).slice(0, 200)));
  const reglage = m => page.evaluate(u => fetch(u).then(x => x.text()), SERVEUR + '/reglage?mode=' + m);
  const etatServeur = () => page.evaluate(u => fetch(u).then(x => x.json()), SERVEUR + '/etat');
  const fileN = () => page.evaluate(() => LOUE.stockage.tout('file').then(l => l.length));
  const attendreFileVide = async max => { for (let i = 0; i < (max || 40) * 2; i++) { await page.waitForTimeout(500); if (!(await fileN())) return true; } return false; };
  const connecter = id => page.evaluate(a => { LOUE.deconnecter(); return LOUE.connexion(a[0], a[1]).then(x => x.code); }, [id, MDP]);
  const ecran = () => page.evaluate(() => {
    const e = document.getElementById('dem-etat'), t = id => { const x = document.getElementById(id); return x.hidden ? '' : x.textContent.trim(); };
    return { etat: e.hidden ? '' : e.textContent, classe: e.className, lignes: Array.from(document.querySelectorAll('#dem-liste .dem-ligne')).map(li => li.textContent),
      info: t('dem-info'), vide: t('dem-vide'), quoi: document.getElementById('dem-quoi').value, quantite: document.getElementById('dem-quantite').value,
      sorte: (document.querySelector('input[name=sorte]:checked') || {}).value, label: document.getElementById('label-quantite').textContent,
      bouton: document.getElementById('btn-demander').textContent, boutonLibre: !document.getElementById('btn-demander').disabled,
      nonConnecte: !document.getElementById('dem-connexion').hidden, erreur: document.getElementById('valBanner').classList.contains('show') ? document.getElementById('valBanner').textContent : '',
      largeur: document.documentElement.scrollWidth <= innerWidth };
  });
  const demander = async (quoi, quantite, panne) => {
    if (panne) await page.check('#sorte-panne');
    await page.fill('#dem-quoi', quoi); await page.fill('#dem-quantite', quantite || '');
    const avant = (await ecran()).etat;
    await page.click('#btn-demander');
    // la réponse à la demande PRÉCÉDENTE est encore à l'écran quelques millisecondes : on attend qu'elle ait changé
    // (sinon « attendreEtat(/✓/) » la prend pour la nouvelle, selon la vitesse du PC)
    for (let i = 0; i < 60 && (await ecran()).etat === avant; i++) await page.waitForTimeout(50);
  };
  const attendreEtat = async (motif, max) => { let e = ''; for (let i = 0; i < (max || 20) * 4; i++) { e = (await ecran()).etat; if (motif.test(e)) return e; await page.waitForTimeout(250); } return 'PAS ARRIVÉ : ' + e; };
  const ouvrir = async () => { await page.goto(BASE + 'commander.html?' + q); await page.waitForTimeout(2500); };
  const sansBrouillon = async () => { const b = await page.$('.loue-brouillon:not(.loue-maj) [data-non]'); if (b) { await b.click(); await page.waitForTimeout(500); } };
  const mesures = () => page.evaluate(() => {
    const visibles = Array.from(document.querySelectorAll('button, a.btn, .choix span, .renvoi a, .dem-connexion a, input.meta-input')).filter(x => x.offsetParent !== null);
    const petits = visibles.filter(x => x.getBoundingClientRect().height < 48).map(x => (x.id || x.className || x.tagName) + ':' + Math.round(x.getBoundingClientRect().height));
    return { largeur: document.documentElement.scrollWidth <= innerWidth, largeurEcran: innerWidth, zones: visibles.length, petits: petits,
      listes: document.querySelectorAll('select, datalist, [list]').length, champs: document.querySelectorAll('.main input:not([type=radio])').length,
      max: [document.getElementById('dem-quoi').maxLength, document.getElementById('dem-quantite').maxLength],
      demanderLarge: document.getElementById('btn-demander').getBoundingClientRect().width / innerWidth,
      renvoi: document.querySelector('.renvoi').textContent.trim(), lienRenvoi: document.querySelector('.renvoi a').getAttribute('href') };
  });
  await ctx.setOffline(false);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(BASE + 'index.html?' + q);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => 1));
  await page.reload(); await page.waitForTimeout(1500);
  await page.evaluate(async () => { for (const e of await LOUE.stockage.tout('file')) await LOUE.abandonner(e.id);
    Object.keys(localStorage).filter(k => /^loue_(demandes|brouillon)_/.test(k)).forEach(k => localStorage.removeItem(k)); });
`;

// ── A. Un poseur : tuile, page, envois, messages, réseau lent, réponse perdue, « Commandé », panne, brouillon, PC ──
function scenarioA() {
  return `async page => {
  ${OUTILS}
  await reglage('normal'); await reglage('horloge&quand=${HEURE('10:00')}'); await reglage('oublier-passage');
  r.connexion = await connecter('poseur1');
  await page.reload(); await page.waitForTimeout(2500);
  // 1. la tuile de l'accueil, hors des chantiers
  r.tuile = await page.evaluate(() => { const t = document.getElementById('tuile-commander');
    return { visible: !!t && t.offsetParent !== null, titre: t.querySelector('.tile-title').textContent.trim(), sous: t.querySelector('.tile-sub').textContent.trim(),
      section: t.parentElement.previousElementSibling.textContent.trim(), dansUnChantier: !!t.closest('#page-chantier-fiches'), hauteur: Math.round(t.getBoundingClientRect().height) }; });
  await page.click('#tuile-commander'); await page.waitForTimeout(2500);
  r.pageOuverte = await page.evaluate(() => location.pathname.split('/').pop() + ' | ' + document.title + ' | ' + document.querySelector('.tb-name').textContent);
  await sansBrouillon();
  // 2. la page à 375 px
  r.mesures = await mesures();
  r.depart = await ecran();
  await page.check('#sorte-panne'); r.panneLabel = (await ecran()).label;
  await page.check('#sorte-commander'); r.commanderLabel = (await ecran()).label;
  // 3. rien de saisi : rien ne part
  await page.click('#btn-demander'); await page.waitForTimeout(400);
  r.vide = await ecran(); r.videFile = await fileN();
  await page.fill('#dem-quoi', 'Vis 4×40'); await page.click('#btn-demander'); await page.waitForTimeout(400);
  r.sansQuantite = await ecran(); r.sansQuantiteFile = await fileN();
  // 4. un envoi, avant le passage du jour
  await demander('Vis 4×40', '2 boîtes');
  r.avantPassage = await attendreEtat(/^Vis 4×40 — 2 boîtes✓/);
  await page.waitForTimeout(2500);
  r.apresEnvoi = await ecran();
  // 5. réseau lent (6 s par réponse) : « Demande notée » tout de suite, la page est prête pour l'article suivant
  await reglage('lent');
  await demander('Cartouches silicone blanc', '6');
  await page.waitForTimeout(1200);
  r.lentTout = await ecran();
  r.lentFin = await attendreEtat(/✓/, 40);
  await reglage('normal'); await page.waitForTimeout(8000);
  r.lentListe = (await ecran()).lignes;
  // 6. réponse perdue : la demande est arrivée, le téléphone la renvoie, une seule ligne au bureau
  await reglage('perdue');
  await demander('Gants de manutention', '1 paire');
  await page.waitForTimeout(3000);
  r.perdueAvant = await ecran();
  await reglage('normal');
  r.perdueFin = await attendreEtat(/✓/, 60);
  // 7. le passage du jour (15 h 50) : le mail part ; une demande faite ensuite part dans le récapitulatif suivant, jour nommé
  await reglage('horloge&quand=${HEURE('15:50')}'); r.reveil = await reglage('reveil');
  await demander('Mousse expansive', '3');
  r.apresPassage = await attendreEtat(/✓/);
  await page.waitForTimeout(3000);
  r.listeApresPassage = (await ecran()).lignes;
  // 8. « Outil en panne », précision vide ; la page revient sur « À commander »
  await demander('Visseuse à choc', '', true);
  r.panne = await attendreEtat(/✓/);
  r.apresPanne = await ecran();
  // 9. texte hostile : affiché comme du texte
  await demander('<img src=x onerror="window.__xss=1">', '<b>2</b>');
  await attendreEtat(/✓/); await page.waitForTimeout(2500);
  r.hostile = await page.evaluate(() => ({ xss: window.__xss || 0, balises: document.querySelectorAll('#dem-liste img, #dem-liste b, #dem-etat img, #dem-liste script').length,
    texte: document.querySelector('#dem-liste .dem-ligne').textContent }));
  // 10. la case « Commandé » cochée au bureau : « ✓ Commandé » dans le téléphone ; décochée : la mention disparaît
  await reglage('commande&quoi=' + encodeURIComponent('Vis 4×40') + '&valeur=1');
  await ouvrir();
  r.commande = (await ecran()).lignes.filter(l => /Vis 4×40/.test(l));
  r.classeCommande = await page.evaluate(() => Array.from(document.querySelectorAll('#dem-liste .dem-ligne.commande')).length);
  await reglage('commande&quoi=' + encodeURIComponent('Vis 4×40') + '&valeur=0');
  await ouvrir();
  r.decommande = (await ecran()).lignes.filter(l => /Vis 4×40/.test(l));
  // 11. brouillon : le choix et les deux champs sont repris après fermeture de la page
  await page.check('#sorte-panne'); await page.fill('#dem-quoi', 'Scie circulaire'); await page.fill('#dem-quantite', 'lame voilée');
  await page.waitForTimeout(1800);
  await ouvrir();
  const oui = await page.$('.loue-brouillon:not(.loue-maj) [data-oui]');
  r.bandeauBrouillon = !!oui;
  if (oui) { await oui.click(); await page.waitForTimeout(1500); }
  r.brouillon = await ecran();
  await page.click('#btn-demander');
  r.brouillonEnvoye = await attendreEtat(/✓/);
  await ouvrir();
  r.plusDeBrouillon = !(await page.$('.loue-brouillon:not(.loue-maj) [data-oui]'));
  // 12. largeur PC
  await page.setViewportSize({ width: 1280, height: 800 }); await page.waitForTimeout(600);
  r.pc = await mesures(); r.pcLignes = (await ecran()).lignes.length;
  await page.setViewportSize({ width: 375, height: 812 });
  // 13. la phrase de renvoi sur « Signaler »
  await page.goto(BASE + 'signaler.html?' + q); await page.waitForTimeout(1500);
  r.signaler = await page.evaluate(() => { const a = Array.from(document.querySelectorAll('a')).find(x => x.getAttribute('href') === 'commander.html');
    return a ? a.parentElement.textContent.trim() : ''; });
  const etat = await etatServeur();
  r.lignesServeur = etat.demandes.slice(1).filter(l => l[8]).map(l => [l[1], l[2], l[3], l[4], l[5], l[6], l[7]].join(' | '));
  r.recaps = etat.recaps; r.version = etat.version;
  r.envois = etat.envois.slice(1).filter(l => l[2] === 'demande').map(l => l[4]);
  await reglage('horloge&quand=reel');
  await page.evaluate(() => LOUE.deconnecter());
  return JSON.stringify(r);
}`;
}

// ── B. Hors réseau, « Mes demandes » hors réseau, second compte sur le même téléphone, sans compte ──
function scenarioB() {
  return `async page => {
  ${OUTILS}
  // le lendemain (mercredi 18/11) : les demandes de ce scénario sont les plus récentes de la liste
  await reglage('normal'); await reglage('horloge&quand=${HEURE('10:00', '18')}'); await reglage('oublier-passage');
  r.connexion = await connecter('poseur1');
  await ouvrir(); await sansBrouillon();
  await demander('Chevilles 8 mm', '1 boîte');
  r.enLigne = await attendreEtat(/✓/);
  await page.waitForTimeout(2500);
  r.avant = await ecran();
  // 1. hors réseau : la page s'ouvre (service worker), « Mes demandes » vient du téléphone ; la demande est gardée
  await ctx.setOffline(true);
  await ouvrir();
  r.horsReseau = await ecran();
  await demander('Lames de scie sauteuse', '2');
  r.horsReseauEtat = await attendreEtat(/En attente/, 15);
  r.horsReseauApres = await ecran(); r.horsReseauFile = await fileN();
  await ouvrir();
  r.horsReseauRouvert = await ecran();
  r.horsReseauBrouillon = !!(await page.$('.loue-brouillon:not(.loue-maj) [data-oui]'));
  // 2. retour du réseau : elle part toute seule, une seule fois
  await ctx.setOffline(false);
  await page.evaluate(() => { LOUE.viderFile(true); });
  r.partie = await attendreFileVide(40);
  await page.waitForTimeout(3000);
  r.retour = await ecran();
  // 3. second compte sur le même téléphone : Poseur 1 écrit hors réseau, se déconnecte ; Poseur 2 se connecte
  await ctx.setOffline(true);
  await demander('Demande du premier poseur', '4');
  await attendreEtat(/En attente/, 15);
  await page.evaluate(() => LOUE.deconnecter());
  await ctx.setOffline(false);
  r.connexion2 = await connecter('poseur2');
  await page.waitForTimeout(3000);
  await ouvrir();
  r.poseur2 = await ecran(); r.poseur2File = await fileN();
  await demander('Scotch de masquage', '2 rouleaux');
  r.poseur2Envoi = await attendreEtat(/✓/);
  await page.waitForTimeout(2500);
  r.poseur2Apres = await ecran();
  await ctx.setOffline(true); await ouvrir();
  r.poseur2HorsReseau = await ecran();
  await ctx.setOffline(false);
  let etat = await etatServeur();
  r.serveurPendantPoseur2 = etat.demandes.slice(1).filter(l => l[8]).map(l => l[1] + ' | ' + l[3]);
  // … Poseur 1 revient : sa demande part sous SON nom
  r.connexion3 = await connecter('poseur1');
  r.partieApresRetour = await attendreFileVide(40);
  await ouvrir();
  r.poseur1Retour = await ecran();
  // 4. sans compte : la demande attend dans le téléphone, elle part après la connexion
  await page.evaluate(() => LOUE.deconnecter());
  await ouvrir();
  r.sansCompte = await ecran();
  await demander('Écrite sans être connecté', '1');
  r.sansCompteEtat = await attendreEtat(/En attente/, 15);
  r.sansCompteApres = await ecran(); r.sansCompteFile = await fileN();
  etat = await etatServeur();
  r.serveurSansCompte = etat.demandes.slice(1).filter(l => l[3] === 'Écrite sans être connecté').length;
  r.connexion4 = await connecter('poseur1');
  r.partieApresConnexion = await attendreFileVide(40);
  await ouvrir();
  r.apresConnexion = await ecran();
  etat = await etatServeur();
  r.lignesServeur = etat.demandes.slice(1).filter(l => l[8]).map(l => l[1] + ' | ' + l[3]);
  r.sansCompteOnglet = etat.sansCompte.slice(1).filter(l => l[2] === 'demande').length;
  await reglage('horloge&quand=reel');
  await page.evaluate(() => LOUE.deconnecter());
  return JSON.stringify(r);
}`;
}

function lancer(nom, texte) {
  const f = path.join(dossier, 'scenario-' + nom + '.js');
  fs.writeFileSync(f, texte);
  spawnSync('playwright-cli', [SESSION, 'close'], { shell: true });
  spawnSync('playwright-cli', [SESSION, 'open', '--browser=chrome', '--mobile', 'about:blank'], { shell: true, encoding: 'utf8' });
  const sortie = spawnSync('playwright-cli', [SESSION, '--raw', 'run-code', '--filename=' + f], { shell: true, encoding: 'utf8', timeout: 420000 });
  // --raw renvoie la valeur du scénario encodée en JSON (une chaîne qui contient elle-même du JSON)
  const ligne = (sortie.stdout || '').split(/\r?\n/).map(l => l.trim()).filter(l => /^"\{/.test(l)).pop();
  if (!ligne) throw new Error('scénario ' + nom + ' sans résultat : ' + (sortie.stdout || sortie.stderr || '').slice(0, 600));
  return JSON.parse(JSON.parse(ligne));
}

let reussis = 0, echecs = 0;
function verifier(nom, cond, detail) {
  if (cond) { reussis++; console.log('  ✓ ' + nom); } else { echecs++; console.log('  ✗ ' + nom + '\n    ' + String(detail).slice(0, 1500)); }
}
const j = x => JSON.stringify(x);
const AUJOURDHUI = '✓ Elle part dans le récapitulatif d’aujourd’hui (vers 15 h 45).';

(async () => {
  if (!(await attendrePorts())) { console.log('  ✗ ports ' + PORT_SITE + ' / ' + PORT_API + ' toujours pris après 3 minutes : série non lancée (rien n’a été arrêté)'); process.exitCode = 1; return; }
  const site = spawn('python', ['-m', 'http.server', String(PORT_SITE), '--bind', '127.0.0.1', '--directory', racine], { stdio: 'ignore' });
  const faux = spawn('node', [path.join(__dirname, 'faux-serveur.js'), String(PORT_API)], { stdio: 'ignore', env: Object.assign({}, process.env, { LOUE_FUSEAUX: '1' }) });
  await new Promise(r => setTimeout(r, 2500));
  try {
    console.log('Lot 10a-1 — page « À commander » dans un vrai Chrome, 375 px (service worker actif)');
    const a = lancer('a', scenarioA());
    verifier('accueil : tuile « À commander » dans « Hors chantier », rattachée à aucun chantier, 48 px au moins', a.connexion === 'CONNECTE' && a.tuile.visible && a.tuile.titre === 'À commander'
      && a.tuile.section === 'Hors chantier' && !a.tuile.dansUnChantier && a.tuile.hauteur >= 48 && /^commander\.html \| Loué App — À commander \| À commander$/.test(a.pageOuverte), j([a.tuile, a.pageOuverte]));
    verifier('375 px : pas de défilement horizontal, toutes les zones à toucher font 48 px au moins, « Demander » sur toute la largeur', a.mesures.largeurEcran === 375 && a.mesures.largeur
      && a.mesures.zones >= 7 && a.mesures.petits.length === 0 && a.mesures.demanderLarge > 0.8, j(a.mesures));
    verifier('AUCUNE liste à dérouler ; deux champs seulement : « Quoi ? » (80 caractères) et « Quantité » (30)', a.mesures.listes === 0 && a.mesures.champs === 2 && j(a.mesures.max) === '[80,30]', j(a.mesures));
    verifier('« À commander » est choisi d’avance ; « Outil en panne » : le second champ devient « Précision (facultative) »', a.depart.sorte === 'commander' && a.depart.label === 'Quantité'
      && a.panneLabel === 'Précision (facultative)' && a.commanderLabel === 'Quantité' && a.depart.etat === '' && !a.depart.nonConnecte, j([a.depart, a.panneLabel]));
    verifier('phrase de renvoi vers « Signaler » (et, sur « Signaler », vers « À commander »)', a.mesures.renvoi === 'Menuiserie cassée ou manquante ? Utilise Signaler.' && a.mesures.lienRenvoi === 'signaler.html'
      && a.signaler === 'Vis, consommables, outil en panne ? Utilise À commander (sur l’accueil).', j([a.mesures.renvoi, a.signaler]));
    verifier('rien de saisi, ou quantité oubliée : message clair, rien ne part', /^À compléter : écris ce qu’il faut commander, indique la quantité/.test(a.vide.erreur) && a.videFile === 0
      && /^À compléter : indique la quantité \(exemple : 2 boîtes\)\.$/.test(a.sansQuantite.erreur) && a.sansQuantiteFile === 0 && a.sansQuantite.quoi === 'Vis 4×40', j([a.vide.erreur, a.sansQuantite.erreur]));
    verifier('envoi avant le passage du jour : « ✓ Elle part dans le récapitulatif d’aujourd’hui (vers 15 h 45). » ; la page est prête pour l’article suivant',
      a.avantPassage === 'Vis 4×40 — 2 boîtes' + AUJOURDHUI && a.apresEnvoi.quoi === '' && a.apresEnvoi.quantite === '' && a.apresEnvoi.sorte === 'commander' && a.apresEnvoi.boutonLibre
      && a.apresEnvoi.bouton === 'Demander' && /ok/.test(a.apresEnvoi.classe), j([a.avantPassage, a.apresEnvoi]));
    verifier('… et « Mes demandes » la montre : « partira dans le prochain récapitulatif »', a.apresEnvoi.lignes.length === 1 && /^Vis 4×40 — 2 boîtes\d\d\/\d\d · À commander · partira dans le prochain récapitulatif$/.test(a.apresEnvoi.lignes[0])
      && a.apresEnvoi.info === '', j(a.apresEnvoi));
    verifier('réseau lent (6 s par réponse) : « ⏳ Demande notée » tout de suite, bouton libre, la demande en tête de liste « ⏳ en attente d’envoi » ; puis la réponse du bureau',
      a.lentTout.etat === 'Cartouches silicone blanc — 6⏳ Demande notée' && /attente/.test(a.lentTout.classe) && a.lentTout.boutonLibre && a.lentTout.quoi === ''
      && /^Cartouches silicone blanc — 6.*⏳ en attente d’envoi$/.test(a.lentTout.lignes[0]) && a.lentFin === 'Cartouches silicone blanc — 6' + AUJOURDHUI
      && a.lentListe.length === 2 && /^Cartouches silicone blanc/.test(a.lentListe[0]) && /prochain récapitulatif$/.test(a.lentListe[0]), j([a.lentTout, a.lentFin, a.lentListe]));
    verifier('réponse perdue : le téléphone redemande, le bureau répond « déjà reçue » avec le récapitulatif ; UNE seule ligne au bureau', /Demande notée|En attente/.test(a.perdueAvant.etat)
      && a.perdueFin === 'Gants de manutention — 1 paire' + AUJOURDHUI && a.lignesServeur.filter(l => /Gants de manutention/.test(l)).length === 1, j([a.perdueAvant.etat, a.perdueFin]));
    verifier('après le passage du jour : « ✓ Le récapitulatif d’aujourd’hui est déjà parti : elle sera dans celui de mercredi 18/11. »',
      a.apresPassage === 'Mousse expansive — 3✓ Le récapitulatif d’aujourd’hui est déjà parti : elle sera dans celui de mercredi 18/11.', j(a.apresPassage));
    verifier('… « Mes demandes » dit où en est chaque ligne : la nouvelle « partira… », les trois autres « récapitulatif du 17/11 » ; le mail du bureau les contient',
      a.listeApresPassage.length === 4 && /^Mousse expansive — 3.*partira dans le prochain récapitulatif$/.test(a.listeApresPassage[0])
      && a.listeApresPassage.slice(1).every(l => /récapitulatif du 17\/11$/.test(l)) && a.recaps.length === 1 && a.recaps[0].sujet === 'À commander — mardi 17/11 (3 demandes)'
      && /Thomas TEST — Vis 4×40 — 2 boîtes/.test(a.recaps[0].texte), j([a.listeApresPassage, a.recaps, a.reveil]));
    verifier('« Outil en panne » sans précision : accepté ; la page revient sur « À commander »', /^Outil en panne : Visseuse à choc✓/.test(a.panne) && a.apresPanne.sorte === 'commander'
      && a.apresPanne.label === 'Quantité' && a.lignesServeur.some(l => /^Thomas TEST \| Outil en panne \| Visseuse à choc \|  \| false/.test(l)), j([a.panne, a.apresPanne, a.lignesServeur]));
    verifier('un texte hostile s’affiche comme du texte, jamais comme du code', a.hostile.xss === 0 && a.hostile.balises === 0 && a.hostile.texte.indexOf('<img src=x onerror=') === 0, j(a.hostile));
    verifier('case « Commandé » cochée au bureau : « ✓ Commandé » ; décochée : la mention disparaît', a.commande.length === 1 && /✓ Commandé$/.test(a.commande[0]) && a.classeCommande === 1
      && a.decommande.length === 1 && /récapitulatif du 17\/11$/.test(a.decommande[0]), j([a.commande, a.decommande]));
    verifier('brouillon : page fermée en cours de saisie, le choix et les deux champs sont restaurés ; envoyé, il n’est plus proposé', a.bandeauBrouillon && a.brouillon.sorte === 'panne'
      && a.brouillon.quoi === 'Scie circulaire' && a.brouillon.quantite === 'lame voilée' && a.brouillon.label === 'Précision (facultative)' && /✓/.test(a.brouillonEnvoye) && a.plusDeBrouillon, j([a.bandeauBrouillon, a.brouillon]));
    verifier('largeur PC (1280 px) : pas de défilement horizontal, mêmes zones de 48 px, la liste est là', a.pc.largeurEcran === 1280 && a.pc.largeur && a.pc.petits.length === 0 && a.pc.listes === 0 && a.pcLignes >= 6, j(a.pc));
    verifier('au bureau : le nom du poseur est celui du COMPTE ; serveur v11.2 ; chaque demande « traité » dans Envois ; aucune erreur dans la page',
      a.lignesServeur.length === 7 && a.lignesServeur.every(l => /^Thomas TEST \| /.test(l) && / \| poseur1$/.test(l)) && /v11.2/.test(a.version)
      && a.envois.length === 7 && a.envois.every(s => s === 'traité') && a.erreursJs.length === 0, j([a.lignesServeur, a.version, a.envois, a.erreursJs]));

    console.log('Lot 10a-1 — hors réseau, second compte sur le même téléphone, sans compte');
    const b = lancer('b', scenarioB());
    verifier('hors réseau : la page s’ouvre, « Mes demandes » vient du téléphone, avec sa date', b.connexion === 'CONNECTE' && /✓/.test(b.enLigne) && b.horsReseau.lignes.length === b.avant.lignes.length
      && b.horsReseau.lignes.some(l => /^Chevilles 8 mm — 1 boîte/.test(l)) && /^Pas de réseau : liste du \d\d\/\d\d à \d\dh\d\d gardée dans le téléphone\.$/.test(b.horsReseau.info) && b.horsReseau.largeur, j([b.enLigne, b.avant, b.horsReseau]));
    verifier('hors réseau : « ⏳ En attente : elle partira au retour du réseau, dans le récapitulatif qui suivra. » ; elle est en tête de liste, « ⏳ en attente d’envoi »',
      b.horsReseauEtat === 'Lames de scie sauteuse — 2⏳ En attente : elle partira au retour du réseau, dans le récapitulatif qui suivra.' && b.horsReseauFile === 1
      && /^Lames de scie sauteuse — 2.*⏳ en attente d’envoi$/.test(b.horsReseauApres.lignes[0]) && b.horsReseauApres.quoi === '', j([b.horsReseauEtat, b.horsReseauApres]));
    verifier('… page rouverte hors réseau : la demande en attente est toujours en tête, aucun brouillon à restaurer', /^Lames de scie sauteuse — 2.*⏳ en attente d’envoi$/.test(b.horsReseauRouvert.lignes[0])
      && b.horsReseauRouvert.lignes.length === b.horsReseau.lignes.length + 1 && b.horsReseauBrouillon === false, j(b.horsReseauRouvert));
    verifier('retour du réseau : elle part toute seule ; la liste la montre, plus rien n’attend', b.partie === true && /^Lames de scie sauteuse — 2.*partira dans le prochain récapitulatif$/.test(b.retour.lignes[0])
      && b.retour.info === '' && b.lignesServeur.filter(l => /Lames de scie sauteuse/.test(l)).length === 1, j([b.partie, b.retour]));
    verifier('second compte sur le même téléphone : rien de la liste ni des demandes en attente du premier (en ligne et hors réseau)', b.connexion2 === 'CONNECTE' && b.poseur2.lignes.length === 0
      && b.poseur2.vide === 'Aucune demande depuis 90 jours.' && b.poseur2File === 1 && /✓/.test(b.poseur2Envoi) && b.poseur2Apres.lignes.length === 1 && /^Scotch de masquage/.test(b.poseur2Apres.lignes[0])
      && b.poseur2HorsReseau.lignes.length === 1 && /^Scotch de masquage/.test(b.poseur2HorsReseau.lignes[0]), j([b.poseur2, b.poseur2File, b.poseur2Apres, b.poseur2HorsReseau]));
    verifier('… ce qu’a écrit le premier ne part pas sous le nom du second ; à son retour, cela part sous SON nom', !b.serveurPendantPoseur2.some(l => /Demande du premier poseur/.test(l))
      && b.serveurPendantPoseur2.indexOf('Kévin TEST | Scotch de masquage') > -1 && b.connexion3 === 'CONNECTE' && b.partieApresRetour === true
      && b.lignesServeur.indexOf('Thomas TEST | Demande du premier poseur') > -1 && b.poseur1Retour.lignes.some(l => /^Demande du premier poseur/.test(l))
      && !b.poseur1Retour.lignes.some(l => /Scotch/.test(l)), j([b.serveurPendantPoseur2, b.lignesServeur, b.poseur1Retour.lignes]));
    verifier('sans compte : la page le dit, la demande attend dans le téléphone (rien au bureau, rien dans « Sans compte »)', b.sansCompte.nonConnecte && b.sansCompte.lignes.length === 0
      && /^Connecte-toi depuis l’accueil/.test(b.sansCompte.vide) && /^Écrite sans être connecté — 1⏳ En attente : elle partira après la connexion/.test(b.sansCompteEtat)
      && b.sansCompteFile === 1 && b.serveurSansCompte === 0 && b.sansCompteOnglet === 0 && /connexion nécessaire/.test(b.sansCompteApres.lignes[0]), j([b.sansCompte, b.sansCompteEtat, b.sansCompteApres]));
    verifier('… après la connexion, elle part sous le nom du compte', b.connexion4 === 'CONNECTE' && b.partieApresConnexion === true && b.lignesServeur.indexOf('Thomas TEST | Écrite sans être connecté') > -1
      && b.apresConnexion.lignes.some(l => /^Écrite sans être connecté/.test(l)) && !b.apresConnexion.nonConnecte, j([b.lignesServeur, b.apresConnexion]));
    verifier('aucune erreur dans la page', b.erreursJs.length === 0, j(b.erreursJs));
  } catch (e) { echecs++; console.log('  ✗ ' + e.message); }
  spawnSync('playwright-cli', [SESSION, 'close'], { shell: true });
  site.kill(); faux.kill();
  fs.rmSync(dossier, { recursive: true, force: true });
  console.log(reussis + ' test(s) réussi(s)' + (echecs ? ' — DES TESTS ÉCHOUENT' : ''));
  if (echecs) process.exitCode = 1;
})();
