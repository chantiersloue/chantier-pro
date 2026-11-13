// Faux serveur local : exécute le VRAI code Apps Script (apps-script/*.gs) avec les services Google simulés.
// Sert à tester les pages dans le navigateur sans toucher ni au TEST ni à la production.
//   node tests/faux-serveur.js [port]          (8790 par défaut)
// Puis ouvrir la page locale avec ?api=http://127.0.0.1:8790/exec (accepté seulement sur localhost).
// Réglages à chaud : GET /reglage?mode=normal|lent|panne|perdue|quota
//   lent   : chaque réponse attend 6 s       panne : erreur 500
//   perdue : la fiche est traitée mais la réponse n'arrive pas (le téléphone renverra : doublon ignoré)
//   quota  : plus que 5 mails possibles aujourd'hui
// Lot 2 — comptes d'essai (mot de passe « Essai-2026 ») : poseur1 (CHANTIER TEST 1 coché), conducteur1 (Sébastien TEST), admin1 ;
//   « nouveau1 » n'a qu'un mot de passe provisoire (affiché au démarrage).
// Lot 4 — LOUE_RACINE_ESSAI=<dossier> : ce dossier (un faux « Drive de l'appli » rempli par outils/depot_carnet.py) est recopié dans le faux Drive ;
//   GET /reglage?mode=acces&id=poseur1&valeur=0 retire au compte la case de CHANTIER TEST 1 (1 : la remet) ; /recharger-carnet relit le dossier.
//   GET /reglage?mode=transition-finie (fin de la période sans compte) | transition-ouverte | deconnecter&id=poseur1 | jeton-ancien
'use strict';
const http = require('http');
const { creerGoogle, chargerScript } = require('./gas-harness');

const port = Number(process.argv[2] || 8790);
const google = creerGoogle({
  proprietes: { DRIVE_ROOT_ID: 'RACINE', DRIVE_PLANNING_ID: 'PLANNING' },
  feuilles: {
    'Contacts': [['Nom', 'Role', 'Email', 'ChefEquipe', 'Destinataire', 'ConducteurDefaut', 'ChefAtelier', 'absenceNotif'],
      ['Franck TEST', 'Conducteur de travaux', 'franck@loue.test', 'O', 'N', 'O', 'N', 'O'],
      ['Sébastien TEST', 'Conducteur de travaux', 'seb@loue.test', 'O', 'N', 'N', 'N', 'N'],
      ['Thomas TEST', "Chef d'atelier", 'atelier@loue.test', 'N', 'N', 'N', 'O', 'N']],
    'Contacts notes': [['Nom', 'Email'], ['Archi TEST', 'archi@ext.test']],
    'Chantiers': [['Nom', 'Référence', 'Statut', 'Conducteur'], ['CHANTIER TEST 1', 'LIEU 1', 'En cours', 'Sébastien TEST'],
      ['CHANTIER TEST 2', 'LIEU 2', 'En cours', 'Franck TEST']],
    'Materiaux': [['Materiaux'], ['Médium'], ['Mélaminé']],
    'Finitions': [['Finitions'], ['BLANC']],
    'Quincaillerie': [['Quincaillerie'], ['Paumelles']],
    'Fonctions': [['Fonctions'], ['OPC']],
    'Types': [['Types'], ['Pass GENERAL']],
    'Matériaux bordereau': [['Type', 'Matériau', 'Quantité'], ['Kit pose fenêtre', 'Vis inox 4x40', 20], ['Kit pose fenêtre', 'Cartouche de mousse', 1],
      ['Kit pose porte', 'Cales', 8], ['Clés de chantier', '', '']],
    'Prise de Cote': [['', 'REF']], 'Fabrication': [['Ref']],
  },
});
google.creerElement('dossier', 'Loué Menuiserie - Chantiers', null, { id: 'RACINE' });
google.creerElement('dossier', 'Planning', null, { id: 'PLANNING' });
const ctx = chargerScript(google);
let mode = 'normal';
// Lot 4 : recopie d'un dossier du PC dans le faux Drive (dossiers et fichiers, octets compris)
const fs = require('fs'), path = require('path');
function recopier(dossierPc, parent) {
  fs.readdirSync(dossierPc, { withFileTypes: true }).forEach(e => {
    const chemin = path.join(dossierPc, e.name);
    const existant = parent.enfants.find(x => x.nom === e.name && !x.corbeille);
    if (e.isDirectory()) recopier(chemin, existant || google.creerElement('dossier', e.name, parent));
    else if (existant) { existant.contenu = fs.readFileSync(chemin); existant.maj = fs.statSync(chemin).mtimeMs; }
    else google.creerElement('fichier', e.name, parent, { contenu: fs.readFileSync(chemin) }).maj = fs.statSync(chemin).mtimeMs;
  });
}
const chargerCarnet = () => { if (process.env.LOUE_RACINE_ESSAI) recopier(process.env.LOUE_RACINE_ESSAI, google.elements.RACINE); };
const viderCacheCarnet = () => Object.keys(google.cache).forEach(k => { if (/^carnet:/.test(k)) delete google.cache[k]; });
// le dossier CARNET du chantier d'essai dans le faux Drive
const dossierCarnet = () => { const ch = google.elements.RACINE.enfants.find(x => x.nom === 'CHANTIER TEST 1' && !x.corbeille); return ch ? ch.enfants.find(x => x.nom === 'CARNET' && !x.corbeille) : null; };
chargerCarnet();
// Lot 2 : comptes d'essai
ctx.genererCle();
ctx.preparerOngletsLot2();
const U = google.feuilles['Utilisateurs'];
[['poseur1', 'Thomas TEST', 'Poseur'], ['conducteur1', 'Sébastien TEST', 'Conducteur'], ['admin1', 'Franck TEST', 'Admin'], ['nouveau1', 'Thomas TEST', 'Poseur'],
  ['atelier1', 'Thomas TEST', 'Atelier'], ['poseur2', 'Kévin TEST', 'Poseur']]   // lot 7 : un compte Atelier et un second poseur
  .forEach(([id, nom, role], i) => { U.lignes[i + 1] = [id, nom, role, true, true, '', '', false, false, '']; });   // en haut, comme Franck
ctx.traiterComptes();
ctx.installerLot3Production();   // lot 3 : onglets des notes de chantier
console.log(ctx.installerLot7Production().split(String.fromCharCode(10)).filter(l => /installation terminée|❌|Refusé/.test(l)).join(' ') || 'Lot 7 : installation non confirmée');   // lot 7 : onglet Signalements
U.lignes.slice(1).filter(l => l[0]).forEach(l => {
  if (l[0] === 'nouveau1') { console.log('Compte « nouveau1 » : mot de passe provisoire ' + l[5]); return; }
  const r = ctx.motDePasse_({ identifiant: l[0], ancien: l[5], nouveau: 'Essai-2026' });
  if (!r.ok) console.log('Compte ' + l[0] + ' : ' + r.message);
});
ctx.traiterComptes();
const A = google.feuilles['Accès chantiers'];
const colP = A.lignes[0].indexOf('poseur1'), colP2 = A.lignes[0].indexOf('poseur2');
A.lignes.forEach(l => { if (l[0] === 'CHANTIER TEST 1') { l[colP] = true; l[colP2] = true; } });   // lot 3 : poseur2 aussi sur ce chantier

http.createServer((req, res) => {
  const entetes = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json; charset=utf-8' };
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/reglage') {
    const m = url.searchParams.get('mode') || 'normal';
    if (m === 'transition-finie') { google.proprietes.FIN_TRANSITION = String(Date.now() - 1000); res.writeHead(200, entetes); return res.end('{"transition":"finie"}'); }
    if (m === 'transition-ouverte') { delete google.proprietes.FIN_TRANSITION; res.writeHead(200, entetes); return res.end('{"transition":"ouverte"}'); }
    if (m === 'deconnecter') {
      const l = U.lignes.find(x => x[0] === url.searchParams.get('id'));
      if (l) { l[7] = true; ctx.traiterComptes(); }
      res.writeHead(200, entetes); return res.end('{"deconnecte":' + !!l + '}');
    }
    if (m === 'acces') {
      const col = A.lignes[0].indexOf(url.searchParams.get('id'));
      if (col > 1) A.lignes.forEach(l => { if (l[0] === 'CHANTIER TEST 1') l[col] = url.searchParams.get('valeur') === '1'; });
      res.writeHead(200, entetes); return res.end('{"acces":' + (col > 1) + '}');
    }
    if (m === 'recharger-carnet') { chargerCarnet(); viderCacheCarnet(); res.writeHead(200, entetes); return res.end('{"carnet":"relu"}'); }
    // Lot 4 : la liste carnet.json absente (en cours d'arrivée) puis revenue ; un second état du Drive (redépôt, nouvel indice) ; un compte désactivé
    if (m === 'carnet-sans-liste' || m === 'carnet-liste') {
      const c = dossierCarnet(); if (c) c.enfants.forEach(x => { if (x.nom === 'carnet.json') x.corbeille = m === 'carnet-sans-liste'; });
      viderCacheCarnet(); res.writeHead(200, entetes); return res.end('{"liste":"' + m + '"}');
    }
    if (m === 'carnet-2') {
      const c = dossierCarnet(); if (c) c.enfants.forEach(x => { x.corbeille = true; });
      if (process.env.LOUE_RACINE_ESSAI_2) recopier(process.env.LOUE_RACINE_ESSAI_2, google.elements.RACINE);
      viderCacheCarnet(); res.writeHead(200, entetes); return res.end('{"carnet":"second état"}');
    }
    if (m === 'desactiver') {
      const l = U.lignes.find(x => x[0] === url.searchParams.get('id'));
      if (l) { l[3] = false; ctx.traiterComptes(); }
      res.writeHead(200, entetes); return res.end('{"desactive":' + !!l + '}');
    }
    mode = m;
    if (mode === 'quota') google.etat.quota = 5; else google.etat.quota = 100;
    res.writeHead(200, entetes); return res.end(JSON.stringify({ mode }));
  }
  if (url.pathname === '/etat') {
    res.writeHead(200, entetes);
    return res.end(JSON.stringify({ mode, mails: google.mails.map(m => ({ to: m.to, sujet: m.sujet, bcc: m.opts.bcc || '' })),
      envois: (google.feuilles['Envois'] || { lignes: [] }).lignes, quota: google.etat.quota,
      signalements: (google.feuilles['Signalements'] || { lignes: [] }).lignes,   // lot 7
      notes: (google.feuilles['Notes'] || { lignes: [] }).lignes,                 // lot 3
      sansCompte: (google.feuilles['Sans compte'] || { lignes: [] }).lignes, utilisateurs: U.lignes.map(l => [l[0], l[2], l[5], l[9]]) }));
  }
  let corps = '';
  req.on('data', c => { corps += c; });
  req.on('end', () => {
    const repondre = () => {
      if (mode === 'panne') { res.writeHead(500, entetes); return res.end('{"erreur":"panne simulée"}'); }
      let sortie;
      try {
        const parametres = Object.fromEntries(url.searchParams);
        sortie = req.method === 'POST' ? ctx.doPost({ postData: { contents: corps } }) : ctx.doGet({ parameter: parametres });
      } catch (e) {
        res.writeHead(500, entetes); return res.end(JSON.stringify({ erreur: e.message }));
      }
      // « perdue » : seule la réponse de la FICHE est perdue (la fiche, elle, a bien été traitée)
      if (mode === 'perdue' && req.method === 'POST' && corps.indexOf('"action":"fiche"') > -1) { req.socket.destroy(); return; }
      const jsonp = /^[A-Za-z_$][\w$]*\(/.test(sortie.contenu);
      res.writeHead(200, Object.assign({}, entetes, jsonp ? { 'Content-Type': 'application/javascript' } : {}));
      res.end(sortie.contenu);
    };
    if (mode === 'lent') setTimeout(repondre, 6000); else repondre();
  });
}).listen(port, '127.0.0.1', () => console.log('Faux serveur Apps Script sur http://127.0.0.1:' + port + '/exec'));
