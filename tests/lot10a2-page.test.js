// Lot 10a-2 — « À commander » : les gros boutons des articles habituels et les propositions pendant la frappe, dans un
// VRAI Chrome, en largeur téléphone (375 px) et PC : node tests/lot10a2-page.test.js
// Demande playwright-cli (npm i -g @playwright/cli) et Python sur le PC ; sinon le test est sauté.
// Lance lui-même le site (http://127.0.0.1:8799) et le faux serveur (8800, horloge réglable, heure de Paris), puis vérifie :
//  A. un poseur : aucun bouton tant qu'il n'a rien demandé ; propositions dès 2 lettres (avec et sans accents, « x » et « × »,
//     début de chaque mot, 3 au plus) ; boutons après 1, 5 et 20 demandes ; quantité reprise ; brouillon gardé ; clavier
//     ouvert (peu de hauteur) ; « Outil en panne » ; largeur PC ; hors réseau ; stockage du téléphone effacé ; onglet
//     « Articles » absent puis très long ; aucune liste à dérouler ; pas de défilement horizontal ;
//  B. un second compte sur le même téléphone : chacun ses boutons ; sans compte : ni bouton ni proposition.
// Si l'un des deux ports est déjà pris (une autre série en cours), le test ATTEND qu'il se libère : il n'arrête rien.
// Noms d'articles inventés (le dépôt est public).
'use strict';
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const racine = path.join(__dirname, '..');
const outil = spawnSync('playwright-cli', ['--version'], { shell: true, encoding: 'utf8' });
const python = spawnSync('python', ['--version'], { shell: true, encoding: 'utf8' });
if (outil.status !== 0 || python.status !== 0) { console.log('Lot 10a-2 (page) : playwright-cli ou Python absent, test sauté'); process.exit(0); }

const PORT_SITE = 8799, PORT_API = 8800, SESSION = '-s=loue-l10a2';
const SITE = 'http://127.0.0.1:' + PORT_SITE + '/', SERVEUR = 'http://127.0.0.1:' + PORT_API, API = SERVEUR + '/exec';
const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'loue-l10a2-'));
// La liste « Articles » du faux Sheet (l'ordre compte : c'est celui des propositions tirées du Sheet)
const ARTICLES = ['Vis 5×50', 'Visière de protection', 'Embout de vissage', 'Cartouches silicone blanc', 'Éclisse alu', 'Chevilles 8 mm'];

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
  const LISTE = ${JSON.stringify(ARTICLES)};
  const ctx = page.context(), r = { erreursJs: [] };
  page.on('dialog', d => d.accept().catch(() => {}));
  page.on('pageerror', e => r.erreursJs.push(String(e.message).slice(0, 200)));
  const reglage = m => page.evaluate(u => fetch(u).then(x => x.text()), SERVEUR + '/reglage?mode=' + m);
  // l'horloge du faux serveur : mardi 17/11/2026 à l'heure de Paris (hiver, UTC+1), à la minute voulue
  const horloge = (heure, minute) => reglage('horloge&quand=' + encodeURIComponent('2026-11-17T' + heure + ':' + String(minute).padStart(2, '0') + ':00+01:00'));
  const etatServeur = () => page.evaluate(u => fetch(u).then(x => x.json()), SERVEUR + '/etat');
  const fileN = () => page.evaluate(() => LOUE.stockage.tout('file').then(l => l.length));
  const attendreFileVide = async max => { for (let i = 0; i < (max || 40) * 4; i++) { await page.waitForTimeout(250); if (!(await fileN())) return true; } return false; };
  const connecter = id => page.evaluate(a => { LOUE.deconnecter(); return LOUE.connexion(a[0], a[1]).then(x => x.code); }, [id, MDP]);
  const texteBouton = "x => x.querySelector('b').textContent + (x.querySelector('small') ? ' | ' + x.querySelector('small').textContent : '')";
  const boutons = () => page.evaluate(f => { const b = document.getElementById('dem-appris'); return b.hidden ? [] : Array.from(b.querySelectorAll('.dem-art')).map(eval(f)); }, texteBouton);
  const propositions = () => page.evaluate(f => { const b = document.getElementById('dem-propositions'); return b.hidden ? [] : Array.from(b.querySelectorAll('.dem-prop')).map(eval(f)); }, texteBouton);
  // frappe au clavier dans « Quoi ? » (le champ est vidé d'abord) ; rend les propositions affichées
  const taper = async texte => { await page.click('#dem-quoi'); await page.fill('#dem-quoi', ''); await page.keyboard.type(texte); await page.waitForTimeout(200); return propositions(); };
  const champs = () => page.evaluate(() => ({ quoi: document.getElementById('dem-quoi').value, quantite: document.getElementById('dem-quantite').value,
    curseur: (document.activeElement || {}).id || '', sorte: (document.querySelector('input[name=sorte]:checked') || {}).value,
    etat: document.getElementById('dem-etat').hidden ? '' : document.getElementById('dem-etat').textContent,
    nonConnecte: !document.getElementById('dem-connexion').hidden }));
  const attendreEtat = async (motif, max) => { let e = ''; for (let i = 0; i < (max || 20) * 4; i++) { e = (await champs()).etat; if (motif.test(e)) return e; await page.waitForTimeout(250); } return 'PAS ARRIVÉ : ' + e; };
  // fait un geste qui lance une demande, puis attend que le message ait changé (la réponse à la demande précédente,
  // encore à l'écran quelques millisecondes, ne doit pas être prise pour la nouvelle)
  const lancer = async geste => { const avant = (await champs()).etat; await geste(); for (let i = 0; i < 60 && (await champs()).etat === avant; i++) await page.waitForTimeout(50); };
  const ouvrir = async () => { await page.goto(BASE + 'commander.html?' + q); await page.waitForTimeout(2500); };
  // oublie le brouillon de la page (ses deux copies), sans passer par le bandeau (qui pose une question)
  const oublierBrouillon = () => page.evaluate(() => { Object.keys(localStorage).filter(k => /^loue_brouillon_/.test(k)).forEach(k => localStorage.removeItem(k));
    return LOUE.stockage.supprimer('brouillons', 'brouillon_commander').catch(() => {}).then(() => 1); });
  const ouvrirPropre = async () => { await oublierBrouillon(); await ouvrir(); };
  // une demande rangée directement dans la file d'envoi du téléphone (plus rapide que la saisie), à la minute voulue du serveur
  const vite = async (quoi, quantite, minute) => {
    await horloge('10', minute);
    await page.evaluate(a => LOUE.mettreEnFile('demande', { sorte: 'commander', quoi: a[0], quantite: a[1] }, [], 'À commander : ' + a[0]).then(() => { LOUE.viderFile(); }), [quoi, quantite]);
    return attendreFileVide(20);
  };
  const mesures = () => page.evaluate(() => {
    const visibles = Array.from(document.querySelectorAll('button, a.btn, .choix span, .renvoi a, input.meta-input')).filter(x => x.offsetParent !== null);
    const haut = sel => Array.from(document.querySelectorAll(sel)).map(x => Math.round(x.getBoundingClientRect().height));
    return { largeur: document.documentElement.scrollWidth <= innerWidth, largeurEcran: innerWidth,
      petits: visibles.filter(x => x.getBoundingClientRect().height < 48).map(x => (x.id || x.className || x.tagName) + ':' + Math.round(x.getBoundingClientRect().height)),
      debordent: visibles.filter(x => x.getBoundingClientRect().right > innerWidth + 0.5 || x.getBoundingClientRect().left < -0.5).length,
      listes: document.querySelectorAll('select, datalist, [list]').length, auto: document.getElementById('dem-quoi').getAttribute('autocomplete'),
      hautBoutons: haut('#dem-appris .dem-art'), hautPropositions: haut('#dem-propositions .dem-prop'),
      titre: (document.querySelector('.dem-appris-titre') || { textContent: '' }).textContent };
  });
  await ctx.setOffline(false);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(BASE + 'index.html?' + q);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => 1));
  await page.reload(); await page.waitForTimeout(1500);
  await page.evaluate(async () => { for (const e of await LOUE.stockage.tout('file')) await LOUE.abandonner(e.id);
    Object.keys(localStorage).filter(k => /^loue_(demandes|brouillon|articles)_/.test(k)).forEach(k => localStorage.removeItem(k)); });
  await oublierBrouillon();
`;

// ── A. Un poseur : propositions, boutons après 1, 5 et 20 demandes, quantité reprise, clavier ouvert, hors réseau… ──
function scenarioA() {
  return `async page => {
  ${OUTILS}
  try {
  await reglage('normal'); await horloge('10', 0); await reglage('oublier-passage');
  await reglage('articles&liste=' + encodeURIComponent(LISTE.join('|')));
  r.connexion = await connecter('poseur1');
  await ouvrirPropre();
  r.etape = 1;
  // 1. rien demandé : aucun bouton ; aucune liste à dérouler
  r.depart = { boutons: await boutons(), cache: await page.evaluate(() => document.getElementById('dem-appris').hidden), mesures: await mesures() };
  r.etape = 2;
  // 2. propositions pendant la frappe (tirées de la liste du Sheet : ce compte n'a encore rien demandé)
  r.uneLettre = await taper('v');
  r.deuxLettres = await taper('vi');
  r.mesuresPropositions = await mesures();
  r.majuscules = await taper('VI');
  r.sansAccent = await taper('ecl');
  r.avecAccent = await taper('Écl');
  r.avecX = await taper('5x50');
  r.avecCroix = await taper('5×50');
  r.avecEspaces = await taper('5 x 50');
  r.deuxMots = await taper('sil bl');
  r.milieuDeMot = await taper('ssage');
  r.inconnu = await taper('zz');
  r.etape = 3;
  // 3. toucher une proposition du Sheet : « Quoi ? » rempli, le curseur passe à la quantité (vide), les propositions partent
  await taper('vi');
  await page.click('#dem-propositions .dem-prop');
  await page.waitForTimeout(300);
  r.apresProposition = await champs(); r.propositionsApres = await propositions();
  await page.keyboard.type('1 boîte'); await lancer(() => page.keyboard.press('Enter'));
  r.premiere = await attendreEtat(/✓/);
  await page.waitForTimeout(2500);
  r.etape = 4;
  // 4. après UNE demande : un bouton, sur toute la largeur, avec la quantité
  r.apres1 = await boutons(); r.mesures1 = await mesures();
  r.largeurBouton1 = await page.evaluate(() => document.querySelector('#dem-appris .dem-art').getBoundingClientRect().width / innerWidth);
  r.etape = 5;
  // 5. un toucher sur le bouton : « Quoi ? » et la dernière quantité ; la quantité se modifie ; « Demander »
  await horloge('10', 1);
  await page.click('#dem-appris .dem-art'); await page.waitForTimeout(300);
  r.apresBouton = await champs();
  await page.fill('#dem-quantite', '3 boîtes');
  await lancer(() => page.click('#btn-demander'));
  r.deuxieme = await attendreEtat(/^Vis 5×50 — 3 boîtes✓/);
  await page.waitForTimeout(2500);
  r.apres2 = await boutons();
  r.etape = 6;
  // 6. le texte libre reste possible (un article que personne ne connaît)
  await horloge('10', 2);
  r.libreProps = await taper('Truc jamais vu');
  await page.fill('#dem-quantite', '1'); await lancer(() => page.click('#btn-demander'));
  r.libre = await attendreEtat(/^Truc jamais vu — 1✓/);
  r.etape = 7;
  // 7. après 5 demandes (4 articles différents)
  r.vite5 = [await vite('Cartouches silicone blanc', '6', 3), await vite('Mousse expansive', '2', 4)];
  await page.waitForTimeout(3000);
  r.apres5 = await boutons(); r.mesures5 = await mesures();
  r.etape = 8;
  // 8. après 20 demandes : 5 boutons, les plus demandés d'abord ; à égalité, le plus récent ; la DERNIÈRE quantité
  const suite = [['Cartouches silicone blanc', '6'], ['Cartouches silicone blanc', '6'], ['Cartouches silicone blanc', '6'], ['Cartouches silicone blanc', '12'],
    ['Mousse expansive', '2'], ['Mousse expansive', '2'], ['Mousse expansive', '4'], ['Chevilles 8 mm', '1 boîte'], ['Chevilles 8 mm', '1 boîte'], ['Chevilles 8 mm', '1 boîte'],
    ['Gants taille 9', '2 paires'], ['Gants taille 9', '2 paires'], ['Scotch de masquage', '1'], ['Lames de scie', '1 jeu'], ['vis 5x50', '2 boîtes']];
  r.vite20 = [];
  for (let i = 0; i < suite.length; i++) r.vite20.push(await vite(suite[i][0], suite[i][1], 5 + i));
  await page.waitForTimeout(3000);
  r.apres20 = await boutons(); r.mesures20 = await mesures();
  r.nombreServeur = (await etatServeur()).demandes.slice(1).filter(l => l[8]).length;
  r.etape = 9;
  // 9. toucher le 2e bouton, puis une proposition : la quantité remplie par la page suit l'article ; celle du poseur est gardée
  await page.click('#dem-appris .dem-art:nth-of-type(2)'); await page.waitForTimeout(300);
  r.bouton2 = await champs();
  r.propositionsVi = await taper('vi');
  r.propositionsCa = await taper('ca');
  r.mesuresCa = await mesures();
  await page.click('#dem-propositions .dem-prop'); await page.waitForTimeout(300);
  r.quantiteSuit = await champs();
  r.selection = await page.evaluate(() => { const n = document.getElementById('dem-quantite'); return n.value.slice(n.selectionStart, n.selectionEnd); });
  await page.fill('#dem-quantite', '99');
  await taper('vi');
  await page.click('#dem-propositions .dem-prop'); await page.waitForTimeout(300);
  r.quantiteGardee = await champs();
  r.propositionsCh = await taper('ch');
  r.etape = 10;
  // 10. brouillon : un bouton touché, page fermée sans « Demander » : le brouillon rend l'article et la quantité
  await page.fill('#dem-quantite', '');
  await page.click('#dem-appris .dem-art'); await page.waitForTimeout(1800);
  r.avantBrouillon = await champs();
  await ouvrir();
  const oui = await page.$('.loue-brouillon:not(.loue-maj) [data-oui]');
  r.bandeauBrouillon = !!oui;
  if (oui) { await oui.click(); await page.waitForTimeout(1500); }
  r.brouillon = await champs(); r.brouillonPropositions = await propositions();
  await horloge('10', 20);
  await lancer(() => page.click('#btn-demander'));
  r.brouillonEnvoye = await attendreEtat(/✓/);
  await ouvrir();
  r.plusDeBrouillon = !(await page.$('.loue-brouillon:not(.loue-maj) [data-oui]'));
  r.etape = 11;
  // 11. clavier ouvert : il reste peu de hauteur. (En mode local, un bandeau rouge de 40 px occupe le haut de l'écran :
  //     320 px ici valent 280 px dans la vraie appli.) Le champ remonte, les 3 propositions tiennent, « Demander » est là.
  await page.setViewportSize({ width: 375, height: 320 }); await page.waitForTimeout(600);
  r.clavierProps = await taper('vi');
  r.clavier = await page.evaluate(() => { const c = document.getElementById('dem-quoi').getBoundingClientRect();
    return { classe: document.body.classList.contains('dem-clavier'), barre: getComputedStyle(document.querySelector('.topbar')).position, hauteur: innerHeight,
      hautChamp: Math.round(c.top), basPropositions: Array.from(document.querySelectorAll('.dem-prop')).map(x => Math.round(x.getBoundingClientRect().bottom)),
      largeur: document.documentElement.scrollWidth <= innerWidth }; });
  await page.click('#dem-propositions .dem-prop'); await page.waitForTimeout(400);
  r.clavierApres = await champs();
  r.clavierDemander = await page.evaluate(() => { const b = document.getElementById('btn-demander').getBoundingClientRect(), n = document.getElementById('dem-quantite').getBoundingClientRect();
    return { haut: Math.round(b.top), bas: Math.round(b.bottom), hauteur: innerHeight, quantiteBas: Math.round(n.bottom), quoiHaut: Math.round(document.getElementById('dem-quoi').getBoundingClientRect().top) }; });
  await horloge('10', 21);
  await lancer(() => page.keyboard.press('Enter'));
  r.clavierEnvoi = await attendreEtat(/✓/);
  await page.setViewportSize({ width: 375, height: 812 }); await page.waitForTimeout(600);
  r.clavierFerme = await page.evaluate(() => ({ classe: document.body.classList.contains('dem-clavier'), barre: getComputedStyle(document.querySelector('.topbar')).position }));
  await page.waitForTimeout(2500);
  r.apres22 = await boutons();
  r.etape = 12;
  // 12. « Outil en panne » : ni boutons ni propositions ; retour sur « À commander » : ils reviennent
  await page.check('#sorte-panne'); await page.waitForTimeout(200);
  r.panne = { boutons: await boutons(), propositions: await taper('vi') };
  await page.check('#sorte-commander'); await page.waitForTimeout(200);
  r.retourCommander = (await boutons()).length;
  await page.fill('#dem-quoi', ''); await page.waitForTimeout(1800);
  r.etape = 13;
  // 13. largeur PC
  await page.setViewportSize({ width: 1280, height: 800 }); await page.waitForTimeout(600);
  await taper('vi');
  r.pc = await mesures(); r.pcBoutons = (await boutons()).length;
  await page.fill('#dem-quoi', ''); await page.waitForTimeout(1800);
  await page.setViewportSize({ width: 375, height: 812 });
  r.etape = 14;
  // 14. hors réseau : la page s'ouvre, les boutons et les propositions (historique ET liste du Sheet) viennent du téléphone ;
  //     une demande en attente d'envoi compte déjà pour les boutons
  await ctx.setOffline(true);
  await ouvrirPropre();
  r.horsReseau = await boutons();
  r.horsReseauSheet = await taper('ecl');
  r.horsReseauHistorique = await taper('la');
  for (let i = 0; i < 2; i++) {
    await taper('la');
    await page.click('#dem-propositions .dem-prop'); await page.waitForTimeout(300);
    if (i === 0) r.horsReseauChamps = await champs();
    await lancer(() => page.keyboard.press('Enter'));
    await attendreEtat(/En attente/, 15); await page.waitForTimeout(600);
  }
  r.horsReseauFile = await fileN();
  r.horsReseauApres = await boutons();
  await ouvrir();
  r.horsReseauRouvert = await boutons();
  await horloge('10', 30).catch(() => {});
  await ctx.setOffline(false);
  await horloge('10', 30);
  await page.evaluate(() => { LOUE.viderFile(true); });
  r.partie = await attendreFileVide(40);
  await page.waitForTimeout(3000);
  r.retourReseau = await boutons();
  r.etape = 15;
  // 15. stockage du téléphone effacé (appli réinstallée, téléphone changé) : après la connexion, tout revient du bureau
  await page.evaluate(() => { localStorage.clear(); });
  await ouvrir();
  r.efface = { boutons: await boutons(), propositions: await taper('vi'), nonConnecte: (await champs()).nonConnecte };
  r.reconnexion = await connecter('poseur1');
  await ouvrirPropre();
  r.refaits = await boutons();
  r.refaitsSheet = await taper('ecl');
  r.etape = 16;
  // 16. onglet « Articles » retiré du Sheet : tout marche, les propositions viennent de l'historique seulement
  await reglage('articles&absent=1');
  await ouvrir();
  r.absent = { boutons: (await boutons()).length, sheet: await taper('ecl'), historique: await taper('ca'), gardes: await page.evaluate(() => LOUE.demandes.articles().length) };
  r.etape = 17;
  // 17. onglet très long (600 articles) : 500 gardés, 3 propositions au plus
  await reglage('articles&nombre=600');
  await ouvrir();
  r.long = { gardes: await page.evaluate(() => LOUE.demandes.articles().length), propositions: await taper('article long 05'), auDela: await taper('long 600'),
    mesures: await mesures(), boutons: (await boutons()).length };
  await page.fill('#dem-quoi', ''); await page.waitForTimeout(1800);
  const etat = await etatServeur();
  r.lignesServeur = etat.demandes.slice(1).filter(l => l[8]).map(l => [l[1], l[2], l[3], l[4]].join(' | '));
  r.version = etat.version;
  } catch (e) { r.plante = 'étape ' + r.etape + ' : ' + String(e && e.message ? e.message : e).slice(0, 400); }
  await reglage('articles&liste=' + encodeURIComponent(LISTE.join('|'))).catch(() => {});
  await reglage('horloge&quand=reel').catch(() => {});
  await page.evaluate(() => LOUE.deconnecter()).catch(() => {});
  return JSON.stringify(r);
}`;
}

// ── B. Second compte sur le même téléphone : chacun ses boutons ; sans compte : rien ──
function scenarioB() {
  return `async page => {
  ${OUTILS}
  try {
  await reglage('normal'); await horloge('11', 0);
  await reglage('articles&liste=' + encodeURIComponent(LISTE.join('|')));
  // le premier poseur : ses boutons ; il écrit une demande hors réseau, puis se déconnecte
  r.connexion1 = await connecter('poseur1');
  await ouvrirPropre();
  r.poseur1 = await boutons();
  await ctx.setOffline(true);
  await page.fill('#dem-quoi', 'Article du premier poseur'); await page.fill('#dem-quantite', '7'); await lancer(() => page.click('#btn-demander'));
  await attendreEtat(/En attente/, 15);
  r.poseur1EnAttente = (await boutons()).length;
  await page.evaluate(() => LOUE.deconnecter());
  await ctx.setOffline(false);
  // le second poseur se connecte sur le même téléphone : aucun bouton, aucune proposition tirée des demandes du premier
  r.connexion2 = await connecter('poseur2');
  await page.waitForTimeout(2500);
  await ouvrirPropre();
  r.poseur2 = { boutons: await boutons(), file: await fileN(), historiqueDuPremier: await taper('mou'), enAttenteDuPremier: await taper('article du'), sheet: await taper('ecl') };
  await page.fill('#dem-quoi', 'Mousse PU'); await page.fill('#dem-quantite', '1'); await lancer(() => page.click('#btn-demander'));
  r.poseur2Envoi = await attendreEtat(/✓/);
  await page.waitForTimeout(2500);
  r.poseur2Apres = await boutons();
  r.poseur2Propositions = await taper('mou');
  await page.fill('#dem-quoi', ''); await page.waitForTimeout(1800);
  await ctx.setOffline(true); await ouvrirPropre();
  r.poseur2HorsReseau = await boutons();
  await ctx.setOffline(false);
  // le premier revient : ses boutons à lui, sans l'article du second ; sa demande en attente part sous son nom
  r.connexion3 = await connecter('poseur1');
  r.partie = await attendreFileVide(40);
  await ouvrirPropre();
  r.poseur1Retour = await boutons();
  r.poseur1Propositions = await taper('mou');
  await ctx.setOffline(true); await ouvrirPropre();
  r.poseur1HorsReseau = await boutons();
  await ctx.setOffline(false);
  // sans compte : ni bouton, ni proposition (la liste du Sheet n'est donnée qu'aux comptes)
  await page.evaluate(() => LOUE.deconnecter());
  await ouvrirPropre();
  r.sansCompte = { boutons: await boutons(), propositions: await taper('vi'), nonConnecte: (await champs()).nonConnecte, mesures: await mesures() };
  await page.fill('#dem-quoi', ''); await page.waitForTimeout(1800);
  const etat = await etatServeur();
  r.lignesServeur = etat.demandes.slice(1).filter(l => l[8]).map(l => l[1] + ' | ' + l[3]);
  } catch (e) { r.plante = 'étape ' + r.etape + ' : ' + String(e && e.message ? e.message : e).slice(0, 400); }
  await reglage('horloge&quand=reel').catch(() => {});
  return JSON.stringify(r);
}`;
}

function lancer(nom, texte) {
  const f = path.join(dossier, 'scenario-' + nom + '.js');
  fs.writeFileSync(f, texte);
  spawnSync('playwright-cli', [SESSION, 'close'], { shell: true });
  spawnSync('playwright-cli', [SESSION, 'open', '--browser=chrome', '--mobile', 'about:blank'], { shell: true, encoding: 'utf8' });
  const sortie = spawnSync('playwright-cli', [SESSION, '--raw', 'run-code', '--filename=' + f], { shell: true, encoding: 'utf8', timeout: 540000 });
  // --raw renvoie la valeur du scénario encodée en JSON (une chaîne qui contient elle-même du JSON)
  const ligne = (sortie.stdout || '').split(/\r?\n/).map(l => l.trim()).filter(l => /^"\{/.test(l)).pop();
  if (!ligne) throw new Error('scénario ' + nom + ' sans résultat : ' + (sortie.stdout || sortie.stderr || '').slice(0, 900));
  return JSON.parse(JSON.parse(ligne));
}

let reussis = 0, echecs = 0;
function verifier(nom, cond, detail) {
  if (cond) { reussis++; console.log('  ✓ ' + nom); } else { echecs++; console.log('  ✗ ' + nom + '\n    ' + String(detail).slice(0, 1800)); }
}
const j = x => JSON.stringify(x);
const pareil = (a, b) => j(a) === j(b);
const propre = m => m.largeur && m.debordent === 0 && m.petits.length === 0 && m.listes === 0 && m.auto === 'off';

(async () => {
  if (!(await attendrePorts())) { console.log('  ✗ ports ' + PORT_SITE + ' / ' + PORT_API + ' toujours pris après 3 minutes : série non lancée (rien n’a été arrêté)'); process.exitCode = 1; return; }
  const site = spawn('python', ['-m', 'http.server', String(PORT_SITE), '--bind', '127.0.0.1', '--directory', racine], { stdio: 'ignore' });
  const faux = spawn('node', [path.join(__dirname, 'faux-serveur.js'), String(PORT_API)], { stdio: 'ignore', env: Object.assign({}, process.env, { LOUE_FUSEAUX: '1' }) });
  await new Promise(r => setTimeout(r, 2500));
  try {
    console.log('Lot 10a-2 — propositions pendant la frappe et boutons appris, dans un vrai Chrome, 375 px (service worker actif)');
    const a = lancer('a', scenarioA());
    verifier('rien demandé : aucun bouton ; aucune liste à dérouler (ni select, ni datalist), autocomplete="off" ; pas de défilement horizontal',
      a.connexion === 'CONNECTE' && a.depart.boutons.length === 0 && a.depart.cache === true && propre(a.depart.mesures) && a.depart.mesures.largeurEcran === 375, j(a.depart));
    verifier('une lettre : rien ; dès 2 lettres : 3 gros boutons au plus sous le champ, au début de chaque mot (« vi » propose « Vis 5×50 » et « Embout de vissage »)',
      a.uneLettre.length === 0 && pareil(a.deuxLettres, ['Vis 5×50', 'Visière de protection', 'Embout de vissage']) && a.milieuDeMot.length === 0 && a.inconnu.length === 0, j([a.uneLettre, a.deuxLettres, a.milieuDeMot, a.inconnu]));
    verifier('les propositions font 48 px de haut au moins, tiennent dans 375 px, et ne sont pas une liste à dérouler',
      propre(a.mesuresPropositions) && a.mesuresPropositions.hautPropositions.length === 3 && a.mesuresPropositions.hautPropositions.every(h => h >= 48), j(a.mesuresPropositions));
    verifier('recherche sans majuscules ni accents ; « x », « × » et « 5 x 50 » sont identiques ; deux débuts de mots (« sil bl »)',
      pareil(a.majuscules, a.deuxLettres) && pareil(a.sansAccent, ['Éclisse alu']) && pareil(a.avecAccent, ['Éclisse alu']) && pareil(a.avecX, ['Vis 5×50'])
      && pareil(a.avecCroix, ['Vis 5×50']) && pareil(a.avecEspaces, ['Vis 5×50']) && pareil(a.deuxMots, ['Cartouches silicone blanc']), j([a.majuscules, a.sansAccent, a.avecAccent, a.avecX, a.avecCroix, a.avecEspaces, a.deuxMots]));
    verifier('toucher une proposition : « Quoi ? » est rempli, le curseur passe à la quantité, les propositions disparaissent ; la touche « Envoyer » fait la demande',
      a.apresProposition.quoi === 'Vis 5×50' && a.apresProposition.quantite === '' && a.apresProposition.curseur === 'dem-quantite' && a.propositionsApres.length === 0
      && /^Vis 5×50 — 1 boîte✓/.test(a.premiere), j([a.apresProposition, a.propositionsApres, a.premiere]));
    verifier('après 1 demande : UN gros bouton, sur toute la largeur, avec la dernière quantité', pareil(a.apres1, ['Vis 5×50 | 1 boîte']) && a.largeurBouton1 > 0.8 && propre(a.mesures1)
      && a.mesures1.hautBoutons.every(h => h >= 48) && /habituels/.test(a.mesures1.titre), j([a.apres1, a.largeurBouton1, a.mesures1]));
    verifier('un toucher sur le bouton : « Quoi ? » ET la dernière quantité sont remplis ; la quantité se modifie ; le bouton reprend la nouvelle',
      a.apresBouton.quoi === 'Vis 5×50' && a.apresBouton.quantite === '1 boîte' && /^Vis 5×50 — 3 boîtes✓/.test(a.deuxieme) && pareil(a.apres2, ['Vis 5×50 | 3 boîtes']), j([a.apresBouton, a.deuxieme, a.apres2]));
    verifier('le texte libre reste possible : un article inconnu ne propose rien et part quand même', a.libreProps.length === 0 && /^Truc jamais vu — 1✓/.test(a.libre), j([a.libreProps, a.libre]));
    verifier('après 5 demandes (4 articles) : 4 boutons, le plus demandé d’abord, puis les plus récents', a.vite5.every(Boolean)
      && pareil(a.apres5, ['Vis 5×50 | 3 boîtes', 'Mousse expansive | 2', 'Cartouches silicone blanc | 6', 'Truc jamais vu | 1']) && propre(a.mesures5) && a.mesures5.hautBoutons.every(h => h >= 48), j([a.vite5, a.apres5, a.mesures5]));
    verifier('après 20 demandes (8 articles) : 5 boutons, dans l’ordre du plus demandé ; à égalité le plus récent ; « vis 5x50 » et « Vis 5×50 » comptent ensemble ; dernière quantité',
      a.vite20.every(Boolean) && a.nombreServeur === 20 && pareil(a.apres20, ['Cartouches silicone blanc | 12', 'Mousse expansive | 4', 'vis 5x50 | 2 boîtes', 'Chevilles 8 mm | 1 boîte', 'Gants taille 9 | 2 paires'])
      && propre(a.mesures20) && a.mesures20.hautBoutons.length === 5 && a.mesures20.hautBoutons.every(h => h >= 48), j([a.apres20, a.nombreServeur, a.mesures20]));
    verifier('propositions : ses demandes passées d’abord (avec leur dernière quantité), puis la liste du Sheet, sans doublon',
      pareil(a.propositionsVi, ['vis 5x50 | 2 boîtes', 'Visière de protection', 'Embout de vissage']) && pareil(a.propositionsCa, ['Cartouches silicone blanc | 12'])
      && pareil(a.propositionsCh, ['Chevilles 8 mm | 1 boîte']) && propre(a.mesuresCa) && a.mesuresCa.hautPropositions.every(h => h >= 48), j([a.propositionsVi, a.propositionsCa, a.propositionsCh, a.mesuresCa]));
    verifier('la quantité remplie par la page suit l’article choisi (et elle est sélectionnée : une frappe la remplace) ; celle tapée par le poseur n’est jamais remplacée',
      a.bouton2.quoi === 'Mousse expansive' && a.bouton2.quantite === '4' && a.quantiteSuit.quoi === 'Cartouches silicone blanc' && a.quantiteSuit.quantite === '12' && a.selection === '12'
      && a.quantiteSuit.curseur === 'dem-quantite' && a.quantiteGardee.quoi === 'vis 5x50' && a.quantiteGardee.quantite === '99', j([a.bouton2, a.quantiteSuit, a.selection, a.quantiteGardee]));
    verifier('brouillon automatique : un bouton touché puis la page fermée, le brouillon rend l’article et la quantité (sans rouvrir de propositions) ; envoyé, il n’est plus proposé',
      a.avantBrouillon.quoi === 'Cartouches silicone blanc' && a.avantBrouillon.quantite === '12' && a.bandeauBrouillon && a.brouillon.quoi === 'Cartouches silicone blanc' && a.brouillon.quantite === '12'
      && a.brouillonPropositions.length === 0 && /^Cartouches silicone blanc — 12✓/.test(a.brouillonEnvoye) && a.plusDeBrouillon, j([a.avantBrouillon, a.bandeauBrouillon, a.brouillon, a.brouillonEnvoye]));
    verifier('clavier ouvert (280 px de haut dans la vraie appli) : la barre du haut ne reste plus collée, le champ remonte, les 3 propositions sont entières à l’écran',
      a.clavier.classe && a.clavier.barre === 'static' && a.clavier.hauteur === 320 && a.clavierProps.length === 3 && a.clavier.hautChamp <= 80
      && a.clavier.basPropositions.length === 3 && a.clavier.basPropositions.every(b => b <= a.clavier.hauteur) && a.clavier.largeur, j([a.clavier, a.clavierProps]));
    verifier('… une proposition touchée : la quantité reprise, « Quoi ? », « Quantité » et « Demander » sont tous à l’écran ; « Envoyer » fait la demande ; clavier fermé : la barre recolle',
      a.clavierApres.quoi === 'vis 5x50' && a.clavierApres.quantite === '2 boîtes' && a.clavierApres.curseur === 'dem-quantite' && a.clavierDemander.quoiHaut >= 0
      && a.clavierDemander.quantiteBas <= a.clavierDemander.hauteur && a.clavierDemander.bas <= a.clavierDemander.hauteur && /^vis 5x50 — 2 boîtes✓/.test(a.clavierEnvoi)
      && a.clavierFerme.classe === false && a.clavierFerme.barre === 'sticky', j([a.clavierApres, a.clavierDemander, a.clavierEnvoi, a.clavierFerme]));
    verifier('après 22 demandes : l’ordre a suivi (Cartouches 6, vis 5x50 4, Mousse 4, Chevilles 3, Gants 2)',
      pareil(a.apres22, ['Cartouches silicone blanc | 12', 'vis 5x50 | 2 boîtes', 'Mousse expansive | 4', 'Chevilles 8 mm | 1 boîte', 'Gants taille 9 | 2 paires']), j(a.apres22));
    verifier('« Outil en panne » : ni boutons ni propositions ; retour sur « À commander » : les boutons reviennent', a.panne.boutons.length === 0 && a.panne.propositions.length === 0 && a.retourCommander === 5, j([a.panne, a.retourCommander]));
    verifier('largeur PC (1280 px) : pas de défilement horizontal, boutons et propositions de 48 px au moins, aucune liste à dérouler',
      a.pc.largeurEcran === 1280 && propre(a.pc) && a.pcBoutons === 5 && a.pc.hautPropositions.length === 3 && a.pc.hautPropositions.concat(a.pc.hautBoutons).every(h => h >= 48), j(a.pc));
    verifier('hors réseau : les boutons sont là ; les propositions viennent de ses demandes ET de la liste du Sheet gardée dans le téléphone',
      pareil(a.horsReseau, a.apres22) && pareil(a.horsReseauSheet, ['Éclisse alu']) && pareil(a.horsReseauHistorique, ['Lames de scie | 1 jeu'])
      && a.horsReseauChamps.quoi === 'Lames de scie' && a.horsReseauChamps.quantite === '1 jeu', j([a.horsReseau, a.horsReseauSheet, a.horsReseauHistorique, a.horsReseauChamps]));
    verifier('hors réseau : deux demandes en attente d’envoi comptent déjà (« Lames de scie » entre dans les 5, « Gants » en sort), aussi après réouverture de la page',
      a.horsReseauFile === 2 && a.horsReseauApres.length === 5 && a.horsReseauApres[0] === 'Cartouches silicone blanc | 12' && a.horsReseauApres.indexOf('Lames de scie | 1 jeu') > -1
      && !a.horsReseauApres.some(t => /^Gants/.test(t)) && pareil(a.horsReseauRouvert.slice().sort(), a.horsReseauApres.slice().sort()), j([a.horsReseauFile, a.horsReseauApres, a.horsReseauRouvert]));
    verifier('retour du réseau : elles partent, les boutons restent', a.partie === true && pareil(a.retourReseau.slice().sort(), a.horsReseauApres.slice().sort())
      && a.lignesServeur.filter(l => /Lames de scie/.test(l)).length === 3, j([a.partie, a.retourReseau]));
    verifier('stockage du téléphone effacé : plus rien (déconnecté) ; après la connexion, les boutons et la liste du Sheet sont refaits depuis le bureau',
      a.efface.boutons.length === 0 && a.efface.propositions.length === 0 && a.efface.nonConnecte && a.reconnexion === 'CONNECTE'
      && pareil(a.refaits.slice().sort(), a.retourReseau.slice().sort()) && a.refaits[0] === 'Cartouches silicone blanc | 12' && pareil(a.refaitsSheet, ['Éclisse alu']), j([a.efface, a.refaits, a.refaitsSheet]));
    verifier('onglet « Articles » retiré du Sheet : tout marche ; les propositions viennent de ses demandes seulement',
      a.absent.boutons === 5 && a.absent.gardes === 0 && a.absent.sheet.length === 0 && pareil(a.absent.historique, ['Cartouches silicone blanc | 12']), j(a.absent));
    verifier('onglet « Articles » très long (600 lignes) : 500 gardés dans le téléphone, 3 propositions au plus, la page reste propre',
      a.long.gardes === 500 && pareil(a.long.propositions, ['Article long 050', 'Article long 051', 'Article long 052']) && a.long.auDela.length === 0 && a.long.boutons === 5 && propre(a.long.mesures), j(a.long));
    verifier('au bureau : 24 demandes, toutes au nom du compte ; serveur v11.4 ; aucune erreur dans la page, le scénario est allé au bout',
      a.lignesServeur.length === 24 && a.lignesServeur.every(l => /^Thomas TEST \| À commander \| /.test(l)) && /v11\.4/.test(a.version) && a.erreursJs.length === 0 && !a.plante, j([a.lignesServeur.length, a.version, a.erreursJs, a.plante]));

    console.log('Lot 10a-2 — second compte sur le même téléphone, sans compte');
    const b = lancer('b', scenarioB());
    verifier('le premier poseur retrouve ses 5 boutons', b.connexion1 === 'CONNECTE' && b.poseur1.length === 5 && b.poseur1[0] === 'Cartouches silicone blanc | 12' && b.poseur1EnAttente === 5, j([b.poseur1, b.poseur1EnAttente]));
    verifier('second compte sur le même téléphone : AUCUN bouton, aucune proposition tirée des demandes du premier (ni des siennes en attente) ; la liste du Sheet, oui',
      b.connexion2 === 'CONNECTE' && b.poseur2.boutons.length === 0 && b.poseur2.file === 1 && b.poseur2.historiqueDuPremier.length === 0 && b.poseur2.enAttenteDuPremier.length === 0
      && pareil(b.poseur2.sheet, ['Éclisse alu']), j(b.poseur2));
    verifier('… il fait une demande : SON bouton, seul ; hors réseau aussi', /^Mousse PU — 1✓/.test(b.poseur2Envoi) && pareil(b.poseur2Apres, ['Mousse PU | 1']) && pareil(b.poseur2Propositions, ['Mousse PU | 1'])
      && pareil(b.poseur2HorsReseau, ['Mousse PU | 1']), j([b.poseur2Envoi, b.poseur2Apres, b.poseur2Propositions, b.poseur2HorsReseau]));
    verifier('le premier revient : ses boutons à lui (sans « Mousse PU »), en ligne et hors réseau ; sa demande en attente est partie sous son nom',
      b.connexion3 === 'CONNECTE' && b.partie === true && b.poseur1Retour.length === 5 && !b.poseur1Retour.concat(b.poseur1HorsReseau).some(t => /Mousse PU/.test(t))
      && pareil(b.poseur1Propositions, ['Mousse expansive | 4']) && pareil(b.poseur1HorsReseau, b.poseur1Retour)
      && b.lignesServeur.indexOf('Thomas TEST | Article du premier poseur') > -1 && b.lignesServeur.indexOf('Kévin TEST | Mousse PU') > -1, j([b.poseur1Retour, b.poseur1Propositions, b.poseur1HorsReseau, b.lignesServeur.slice(-3)]));
    verifier('sans compte : ni bouton ni proposition (la liste du Sheet n’est donnée qu’aux comptes) ; la page reste propre',
      b.sansCompte.boutons.length === 0 && b.sansCompte.propositions.length === 0 && b.sansCompte.nonConnecte && propre(b.sansCompte.mesures), j(b.sansCompte));
    verifier('aucune erreur dans la page, le scénario est allé au bout', b.erreursJs.length === 0 && !b.plante, j([b.erreursJs, b.plante]));
  } catch (e) { echecs++; console.log('  ✗ ' + e.message); }
  spawnSync('playwright-cli', [SESSION, 'close'], { shell: true });
  site.kill(); faux.kill();
  fs.rmSync(dossier, { recursive: true, force: true });
  console.log(reussis + ' test(s) réussi(s)' + (echecs ? ' — DES TESTS ÉCHOUENT' : ''));
  if (echecs) process.exitCode = 1;
})();
