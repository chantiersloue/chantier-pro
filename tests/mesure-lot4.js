// Lot 4, étape 4.0-B — MESURE de la rapidité du serveur du carnet sur la copie TEST : node tests/mesure-lot4.js
// (lancé par Claude, après un envoi « --avec-porte » ; ce n'est PAS un test automatique : il parle à Google)
//
// Ce que fait la mesure :
//   1. garde-fous : la porte répond, environnement TEST, le serveur de CETTE branche répond 6 fois de suite ;
//   2. la porte dépose un FAUX document (octets au hasard) dans le carnet du chantier d'essai ;
//   3. un compte d'essai demande la liste, les aperçus et des tuiles, plusieurs fois : durée totale, durée passée
//      dans le serveur, poids de la réponse ; chaque image reçue est comparée à ce qui a été déposé ;
//   4. 10 puis 15 téléphones simulés en même temps ;
//   5. le faux document est retiré, les comptes d'essai refermés.
// La durée « avec une barre de réseau » est CALCULÉE (elle n'est pas mesurée) : durée mesurée ici
//   + 3 allers-retours à 400 ms + poids de la réponse à 50 Ko/s (réglage « 3G lente » des outils de Chrome).
// Aucun mail, aucune donnée réelle. Aucun secret affiché.
'use strict';
const porte = require('../outils/porte.js');
const { deploiementTest } = require('../outils/envoyer-test.js');
const { assembler } = require('../outils/construire.js');

const URL_TEST = deploiementTest().url;
const CHANTIER = 'CHANTIER TEST AUTO';
const geste = (nom, donnees) => porte.appeler(nom, donnees || null, { maxMs: 300000 });
const somme = octets => { let s = 0; for (let i = 0; i < octets.length; i++) s = (s * 31 + octets[i]) % 1000000007; return s; };
const mediane = t => { const u = t.slice().sort((a, b) => a - b); return u[Math.floor(u.length / 2)]; };
const s1 = ms => (ms / 1000).toFixed(1).replace('.', ',') + ' s';
const LENT = poids => 3 * 400 + poids / 50;   // ms : 3 allers-retours (dont la redirection de Google) + 50 Ko/s

async function demander(corps) {
  const debut = Date.now();
  const r = await fetch(URL_TEST, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(corps), signal: AbortSignal.timeout(120000) });
  const texte = await r.text();
  let rep; try { rep = JSON.parse(texte); } catch (e) { rep = { ok: false, code: 'PAS_JSON', message: texte.slice(0, 120) }; }
  return { rep: rep, ms: Date.now() - debut, poids: texte.length };
}

(async () => {
  console.log('Lot 4 — mesure du serveur du carnet sur la copie TEST (' + new Date().toLocaleString('fr-FR') + ')');
  const etat = await geste('etat');
  if (!etat.ok) throw new Error('la porte de service ne répond pas : envoyer d’abord le serveur « --avec-porte »');
  if (etat.data.environnement !== 'TEST') throw new Error('environnement inattendu : mesure annulée');
  const attendue = assembler(true).empreinte;
  let suite = 0;
  for (let essai = 0; essai < 40 && suite < 6; essai++) {
    const e = await geste('etat');
    if (e.ok && e.data.empreinte === attendue) suite++; else { suite = 0; await new Promise(r => setTimeout(r, 15000)); }
  }
  if (suite < 6) throw new Error('le serveur en ligne n’est pas celui de cette branche (attendu ' + attendue + ') : refaire l’envoi « --avec-porte »');
  console.log('  ✓ serveur de cette branche en ligne (empreinte ' + attendue + ')');
  const dest = (await geste('destinatairesEssai')).data;
  if (!dest.racineDriveNommeeTest || !dest.chantierEssaiPresent) throw new Error('Drive ou chantier d’essai inattendus : mesure annulée');
  const pc = await geste('preparerComptes'), ch = await geste('preparerChantier');
  if (!pc.ok || !ch.ok) throw new Error('comptes ou chantier d’essai non prêts');
  const s = await geste('session', { id: 'auto-poseur' });
  if (!s.ok) throw new Error('session : ' + s.message);
  let jeton = porte.lireSession().jeton;
  await geste('traiterComptes');
  const acces = await geste('accesChantier', { id: 'auto-poseur', valeur: true });
  if (!acces.ok) throw new Error('accès au chantier d’essai : ' + acces.message);

  const depot = await geste('carnetFauxDepot', { colonnes: 8, lignes: 6, koTuile: 25, bloc: 4, koLeger: 70, koNet: 250 });
  if (!depot.ok) throw new Error('faux dépôt : ' + depot.message);
  console.log('  ✓ faux document déposé : ' + depot.data.paquets + ' paquets, ' + Math.round(depot.data.poids / 1024) + ' Ko, ' + depot.data.colonnes + ' × ' + depot.data.lignes + ' tuiles');
  const sommes = depot.data.sommes;
  let faux = 0;
  const appel = async corps => {
    const r = await demander(Object.assign({ jeton: jeton, chantier: CHANTIER }, corps));
    if (r.rep.jeton) jeton = r.rep.jeton;
    return r;
  };
  const controler = (rep, quoi) => (rep.data && rep.data.images || []).forEach(i => {
    const cle = quoi === 'tuiles' ? i.c + ',' + i.l : quoi;
    if (somme(Buffer.from(i.b64, 'base64')) !== sommes[cle]) faux++;
  });
  const gestes = [
    ['liste des documents', { action: 'carnet' }, null, 8000],
    ['aperçu léger (70 Ko)', { action: 'carnetTuiles', doc: depot.data.doc, page: 1, quoi: 'leger' }, 'leger', 10000],
    ['aperçu net (250 Ko)', { action: 'carnetTuiles', doc: depot.data.doc, page: 1, quoi: 'net' }, 'net', null],
    ['écran de 4 tuiles voisines (1 paquet)', { action: 'carnetTuiles', doc: depot.data.doc, page: 1, quoi: 'tuiles', niveau: 0, tuiles: [[1, 1], [2, 1], [1, 2], [2, 2]] }, 'tuiles', 15000],
    ['écran de 6 tuiles à cheval sur 2 paquets', { action: 'carnetTuiles', doc: depot.data.doc, page: 1, quoi: 'tuiles', niveau: 0, tuiles: [[3, 1], [4, 1], [3, 2], [4, 2], [3, 3], [4, 3]] }, 'tuiles', 15000],
    ['téléchargement de masse : 16 tuiles d’un paquet', { action: 'carnetTuiles', doc: depot.data.doc, page: 1, quoi: 'tuiles', niveau: 0, masse: true,
      tuiles: [0, 1, 2, 3].reduce((t, l) => t.concat([0, 1, 2, 3].map(c => [c, l])), []) }, 'tuiles', null],
  ];
  const lignes = [];
  let horsObjectif = 0;
  for (const g of gestes) {
    const durees = [], serveur = []; let poids = 0, premier = 0, erreur = '';
    for (let i = 0; i < 6; i++) {
      const r = await appel(g[1]);
      if (!r.rep.ok) { erreur = (r.rep.code || '') + ' ' + (r.rep.message || ''); break; }
      if (g[2]) controler(r.rep, g[2]);
      if (i === 0) premier = r.ms; else { durees.push(r.ms); serveur.push(r.rep.data.ms); }
      poids = r.poids;
    }
    if (erreur) { lignes.push('  ✗ ' + g[0] + ' : ' + erreur.slice(0, 200)); horsObjectif++; continue; }
    const med = mediane(durees), lent = med + LENT(poids), tenu = !g[3] || lent <= g[3];
    if (!tenu) horsObjectif++;
    lignes.push('  ' + (tenu ? '✓' : '✗') + ' ' + g[0] + ' : 1re fois ' + s1(premier) + ' ; ensuite ' + s1(med) + ' (dont serveur ' + s1(mediane(serveur)) + ') ; réponse de ' + Math.round(poids / 1024)
      + ' Ko ; avec une barre de réseau (calcul) ' + s1(lent) + (g[3] ? ' — objectif ' + s1(g[3]) : ''));
    console.log(lignes[lignes.length - 1]);
  }
  console.log('  ' + (faux ? '✗ ' + faux + ' image(s) différente(s) de ce qui a été déposé' : '✓ toutes les images reçues sont identiques, à l’octet près, à ce qui a été déposé'));

  // Charge : n téléphones, chacun 2 demandes à la fois, 6 demandes de tuiles par téléphone
  for (const n of [10, 15]) {
    const debut = Date.now(); let ok = 0, ko = 0, pire = 0; const codes = {};
    const telephone = async () => {
      const file = [0, 1, 2, 3, 4, 5].map(i => ({ action: 'carnetTuiles', doc: depot.data.doc, page: 1, quoi: 'tuiles', niveau: 0, tuiles: [[i, 0], [i, 1], [i + 1, 0], [i + 1, 1]] }));
      const ouvrier = async () => { while (file.length) { const r = await demander(Object.assign({ jeton: jeton, chantier: CHANTIER }, file.shift()));
        if (r.rep.ok) ok++; else { ko++; codes[r.rep.code || '?'] = (codes[r.rep.code || '?'] || 0) + 1; } pire = Math.max(pire, r.ms); } };
      await Promise.all([ouvrier(), ouvrier()]);
    };
    await Promise.all(Array.from({ length: n }, telephone));
    const ligne = '  ' + (ko ? '✗' : '✓') + ' ' + n + ' téléphones en même temps (' + (n * 6) + ' demandes, 2 à la fois par téléphone) : ' + ok + ' réussies, ' + ko + ' en erreur ' + (ko ? JSON.stringify(codes) + ' ' : '')
      + '; la plus lente ' + s1(pire) + ' ; le tout en ' + s1(Date.now() - debut);
    if (ko) horsObjectif++;
    console.log(ligne);
  }

  const retire = await geste('carnetRetirerFauxDepot');
  console.log('  ' + (retire.ok ? '✓' : '✗') + ' faux document retiré du carnet du chantier d’essai');
  await geste('accesChantier', { id: 'auto-poseur', valeur: false });
  const fin = await geste('fermerSessions'); await geste('retirerDeclencheurs');
  const etatFin = (await geste('etat')).data;
  console.log('  ' + (fin.ok && etatFin.mailsPossibles === etat.data.mailsPossibles ? '✓' : '✗') + ' comptes d’essai refermés, aucun mail envoyé');
  console.log('\n' + (horsObjectif || faux ? 'MESURE : ' + (horsObjectif + (faux ? 1 : 0)) + ' point(s) hors objectif' : 'MESURE : tous les objectifs sont tenus'));
  if (horsObjectif || faux) process.exitCode = 1;
})().catch(async e => {
  console.error('❌ ' + e.message);
  try { await geste('carnetRetirerFauxDepot'); await geste('accesChantier', { id: 'auto-poseur', valeur: false }); await geste('fermerSessions'); await geste('retirerDeclencheurs'); } catch (x) {}
  process.exit(1);
});
