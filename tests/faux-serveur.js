// Faux serveur local : exécute le VRAI code Apps Script (apps-script/*.gs) avec les services Google simulés.
// Sert à tester les pages dans le navigateur sans toucher ni au TEST ni à la production.
//   node tests/faux-serveur.js [port]          (8790 par défaut)
// Puis ouvrir la page locale avec ?api=http://127.0.0.1:8790/exec (accepté seulement sur localhost).
// Réglages à chaud : GET /reglage?mode=normal|lent|panne|perdue|quota
//   lent   : chaque réponse attend 6 s       panne : erreur 500
//   perdue : la fiche est traitée mais la réponse n'arrive pas (le téléphone renverra : doublon ignoré)
//   quota  : plus que 5 mails possibles aujourd'hui
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

http.createServer((req, res) => {
  const entetes = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json; charset=utf-8' };
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/reglage') {
    mode = url.searchParams.get('mode') || 'normal';
    if (mode === 'quota') google.etat.quota = 5; else google.etat.quota = 100;
    res.writeHead(200, entetes); return res.end(JSON.stringify({ mode }));
  }
  if (url.pathname === '/etat') {
    res.writeHead(200, entetes);
    return res.end(JSON.stringify({ mode, mails: google.mails.map(m => ({ to: m.to, sujet: m.sujet, bcc: m.opts.bcc || '' })),
      envois: (google.feuilles['Envois'] || { lignes: [] }).lignes, quota: google.etat.quota }));
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
