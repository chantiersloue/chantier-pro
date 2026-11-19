// Lot 5c — essais contre le VRAI serveur de la copie TEST, par la porte de service :
//   node tests/reel-lot5c.js "<racine du Drive TEST sur le PC>"
// (lancé par Claude, après un envoi « --avec-porte » de la branche lot-5c ; ce n'est PAS un test automatique de la série :
// il parle à Google. Ne jamais le lancer contre la production : il ne connaît que l'adresse de la copie TEST.)
//
// Ce qu'il vérifie, et que le faux Google des autres tests ne peut pas prouver :
//   - sans compte, le planning n'est plus servi (ni par l'ancienne lecture GET, ni par la nouvelle) ;
//   - avec un compte, la liste arrive SANS aucun lien Google Drive, et un document arrive entier (un vrai PDF) ;
//   - après cette lecture, AUCUN fichier du dossier Planning de TEST n'est lisible par son lien, sans compte Google ;
//   - un PDF de 4,9 Mo passe (temps mesuré), un PDF de plus de 5 Mo est refusé avec le bon message.
// Il dépose deux PDF d'essai dans le dossier « Planning TEST » du PC (Google Drive pour ordinateur les envoie), et les
// retire à la fin (ils partent à la corbeille de Drive). Aucun mail. Aucun secret ni identifiant de fichier affiché.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const porte = require('../outils/porte.js');
const { deploiementTest } = require('../outils/envoyer-test.js');
const { assembler } = require('../outils/construire.js');

const URL_TEST = deploiementTest().url;
const VERSION = 'v10.1';
const RACINE = process.argv[2] || '';
const DOSSIER_PLANNING = 'Planning TEST';
const GROS = 'ESSAI 5c - 4,9 Mo (a supprimer).pdf', TROP_GROS = 'ESSAI 5c - 5,2 Mo (a supprimer).pdf';
const resultats = [];
let echecs = 0;
function verifier(nom, cond, detail) {
  resultats.push((cond ? '  ✓ ' : '  ✗ ') + nom + (cond || detail === undefined ? '' : '\n      ' + String(detail).slice(0, 500)));
  if (!cond) echecs++;
  console.log(resultats[resultats.length - 1]);
}
const geste = (nom, donnees) => porte.appeler(nom, donnees || null, { maxMs: 150000 });
const sansId = x => JSON.stringify(x, (k, v) => (k === 'id' || k === 'jeton' || k === 'b64' ? '…' : v)).slice(0, 400);
const s1 = ms => (ms / 1000).toFixed(1).replace('.', ',') + ' s';
async function demander(corps) {
  const debut = Date.now();
  const r = await fetch(URL_TEST, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(corps), signal: AbortSignal.timeout(180000) });
  const texte = await r.text();
  let rep; try { rep = JSON.parse(texte); } catch (e) { rep = { ok: false, code: 'PAS_JSON', message: texte.slice(0, 120) }; }
  return { rep: rep, ms: Date.now() - debut, poids: texte.length };
}
// Un PDF valide du poids voulu : une page vide, suivie d'un objet de remplissage (octets au hasard, jamais affichés)
function pdfDe(octets) {
  const tete = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n'
    + '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\n';
  const fin = '\nendstream\nendobj\ntrailer<</Root 1 0 R>>\n%%EOF\n';
  const reste = octets - Buffer.byteLength(tete) - Buffer.byteLength(fin) - 40;
  const entete = '4 0 obj<</Length ' + reste + '>>stream\n';
  return Buffer.concat([Buffer.from(tete + entete, 'latin1'), crypto.randomBytes(reste), Buffer.from(fin, 'latin1')]);
}
// Lecture SANS compte Google du lien de téléchargement d'un fichier : vrai si Google en donne le contenu.
// Google répond par une suite de redirections : pour un fichier privé, elle finit sur sa page de connexion
// (accounts.google.com) ; pour un fichier partagé par lien, sur le fichier lui-même ou sur sa page de téléchargement.
async function lisibleParLien(id) {
  let adresse = 'https://drive.google.com/uc?export=download&id=' + encodeURIComponent(id);
  for (let saut = 0; saut < 8; saut++) {
    const r = await fetch(adresse, { redirect: 'manual', signal: AbortSignal.timeout(30000) });
    if (/(^|\.)accounts\.google\.com$/.test(new URL(adresse).host)) return false;
    const vers = r.headers.get('location');
    if (r.status >= 300 && r.status < 400 && vers) { adresse = new URL(vers, adresse).toString(); continue; }
    if (r.status !== 200) return false;
    const type = String(r.headers.get('content-type') || '');
    if (!/html/i.test(type)) return true;                       // le fichier lui-même
    return !/Sign-in|ServiceLogin|identifier/i.test((await r.text()).slice(0, 5000));   // page de téléchargement d'un fichier public
  }
  return true;   // suite de redirections anormale : compté comme « lisible » pour que l'essai échoue et soit regardé
}
function retirerFichiersEssai(dossier) {
  [GROS, TROP_GROS].forEach(n => { try { fs.unlinkSync(path.join(dossier, n)); } catch (e) {} });
}

(async () => {
  console.log('Lot 5c — essais réels sur la copie TEST (' + new Date().toLocaleString('fr-FR') + ')');
  const local = path.join(RACINE, DOSSIER_PLANNING);
  if (!RACINE || !/TEST/i.test(path.basename(RACINE)) || !fs.existsSync(path.join(RACINE, 'dossiers.json')) || !fs.existsSync(local)) {
    throw new Error('donner en argument la racine du Drive TEST sur le PC (dossier « … TEST … » contenant dossiers.json et « ' + DOSSIER_PLANNING + ' »)');
  }
  const etat = await geste('etat');
  if (!etat.ok || etat.data.environnement !== 'TEST' || etat.data.version !== VERSION) throw new Error('porte, environnement ou version inattendus : essais annulés');
  const empreinte = assembler(true).empreinte;
  let suite = 0;
  for (let essai = 0; essai < 40 && suite < 6; essai++) { const e = await geste('etat'); if (e.ok && e.data.empreinte === empreinte) suite++; else { suite = 0; await new Promise(r => setTimeout(r, 15000)); } }
  verifier('le serveur de cette branche (' + VERSION + ', empreinte ' + empreinte + ') répond 6 fois de suite sur TEST', suite >= 6);
  if (suite < 6) throw new Error('le serveur en ligne n’est pas celui de cette branche');
  const dest = (await geste('destinatairesEssai')).data;
  if (!dest.racineDriveNommeeTest) throw new Error('Drive d’essai inattendu : essais annulés');

  // ── Sans compte ──
  const ancien = await (await fetch(URL_TEST + '?action=getDossiers&chantier=__PLANNING__', { signal: AbortSignal.timeout(60000) })).text();
  verifier('sans compte, ancienne lecture (GET) : « Connectez-vous », aucun document, aucun lien', /CONNEXION_REQUISE/.test(ancien) && !/drive\.google|"planning"\s*:\s*\[\s*\{/.test(ancien), ancien.slice(0, 200));
  const sansListe = await demander({ action: 'dossiers', chantier: '__PLANNING__' });
  const sansFichier = await demander({ action: 'planningFichier', id: 'abc' });
  verifier('sans compte, nouvelle lecture : liste et document refusés', sansListe.rep.ok === false && sansFichier.rep.ok === false && !sansListe.rep.data, sansId([sansListe.rep, sansFichier.rep]));

  // ── Avec un compte de poseur ──
  const pc = await geste('preparerComptes');
  if (!pc.ok) throw new Error('comptes d’essai non prêts');
  const s = await geste('session', { id: 'auto-poseur' });
  if (!s.ok) throw new Error('session : ' + s.message);
  let jeton = porte.lireSession().jeton;
  await geste('traiterComptes');
  const appel = async corps => { const r = await demander(Object.assign({ jeton: jeton }, corps)); if (r.rep.jeton) jeton = r.rep.jeton; return r; };
  const lirePlanning = async () => { const r = await appel({ action: 'dossiers', chantier: '__PLANNING__' }); return { r: r, docs: (((r.rep.data || {}).dossiers || {}).planning) || [] }; };

  // Les deux PDF d'essai, déposés par le dossier du PC ; on attend que Google Drive pour ordinateur les ait envoyés
  retirerFichiersEssai(local);
  fs.writeFileSync(path.join(local, GROS), pdfDe(Math.round(4.9 * 1024 * 1024)));
  fs.writeFileSync(path.join(local, TROP_GROS), pdfDe(Math.round(5.2 * 1024 * 1024)));
  let lu = null;
  const debutAttente = Date.now();
  for (;;) {
    lu = await lirePlanning();
    if (lu.r.rep.ok && lu.docs.some(d => d.nom === GROS && d.taille > 5000000) && lu.docs.some(d => d.nom === TROP_GROS && d.taille > 5300000)) break;
    if (Date.now() - debutAttente > 12 * 60 * 1000) break;
    await new Promise(r => setTimeout(r, 20000));
  }
  const docs = lu.docs;
  verifier('avec un compte : la liste du planning arrive (' + docs.length + ' document(s), ' + s1(lu.r.ms) + ')', lu.r.rep.ok && docs.length >= 2, sansId(lu.r.rep));
  verifier('… sans aucun lien Google Drive dans la réponse', !/drive\.google\.com|docs\.google\.com|https?:\/\//.test(JSON.stringify(lu.r.rep.data || {})), 'un lien figure dans la réponse');
  verifier('… chaque document a son nom, son poids et sa date', docs.every(d => d.nom && d.taille > 0 && /^\d\d\/\d\d\/\d{4}$/.test(d.date)), sansId(docs.slice(0, 3)));
  const gros = docs.find(d => d.nom === GROS), trop = docs.find(d => d.nom === TROP_GROS);
  verifier('les deux PDF d’essai sont arrivés dans le Drive de TEST (' + s1(Date.now() - debutAttente) + ')', !!gros && !!trop, docs.map(d => d.nom + ' ' + d.taille));

  // ── Plus aucun partage par lien ──
  const ouverts = [];
  for (const d of docs) { if (await lisibleParLien(d.id)) ouverts.push(d.nom); }
  verifier('aucun des ' + docs.length + ' fichiers du planning n’est lisible par son lien, sans compte Google', ouverts.length === 0, ouverts);

  // ── Un document arrive entier ──
  const petit = docs.filter(d => d.type === 'pdf' && d.taille < 1500000 && d.nom !== GROS)[0];
  if (petit) {
    const f = await appel({ action: 'planningFichier', id: petit.id });
    const octets = f.rep.ok ? Buffer.from(f.rep.data.b64, 'base64') : Buffer.alloc(0);
    verifier('un PDF du planning (' + Math.round(petit.taille / 1024) + ' Ko) arrive entier par le serveur, en ' + s1(f.ms), f.rep.ok && f.rep.data.mime === 'application/pdf'
      && octets.length === petit.taille && octets.slice(0, 5).toString('latin1') === '%PDF-', sansId(f.rep));
  } else console.log('    (aucun petit PDF dans le planning de TEST : essai du petit document sauté)');
  if (gros) {
    const temps = [];
    let bon = true, dernier = null;
    for (let i = 0; i < 3; i++) {
      dernier = await appel({ action: 'planningFichier', id: gros.id });
      const o = dernier.rep.ok ? Buffer.from(dernier.rep.data.b64, 'base64') : Buffer.alloc(0);
      bon = bon && dernier.rep.ok && o.length === gros.taille && o.slice(0, 5).toString('latin1') === '%PDF-';
      temps.push(dernier.ms);
    }
    verifier('le PDF de 4,9 Mo arrive entier, 3 fois de suite (' + temps.map(s1).join(', ') + ' ; réponse de ' + (dernier.poids / 1048576).toFixed(1).replace('.', ',') + ' Mo)', bon, sansId(dernier.rep));
  }
  if (trop) {
    const f = await appel({ action: 'planningFichier', id: trop.id });
    verifier('le PDF de 5,2 Mo est refusé : « ' + f.rep.message + ' »', f.rep.ok === false && f.rep.code === 'TROP_GROS' && !f.rep.data, sansId(f.rep));
  }
  const ailleurs = await appel({ action: 'planningFichier', id: 'un-identifiant-qui-n-existe-pas' });
  verifier('un document qui n’est pas dans le dossier Planning : refusé', ailleurs.rep.ok === false && ailleurs.rep.code === 'INTROUVABLE', sansId(ailleurs.rep));

  // ── Ménage ──
  retirerFichiersEssai(local);
  const fin = await geste('fermerSessions');
  await geste('retirerDeclencheurs');
  const etatFin = (await geste('etat')).data || {};
  verifier('sessions d’essai fermées, les deux PDF d’essai retirés du dossier du PC, aucun mail envoyé', fin.ok && !fs.existsSync(path.join(local, GROS)) && !fs.existsSync(path.join(local, TROP_GROS))
    && etatFin.mailsPossibles >= etat.data.mailsPossibles, etat.data.mailsPossibles + ' mails possibles avant, ' + etatFin.mailsPossibles + ' après');
  console.log('\n' + (resultats.length - echecs) + ' vérification(s) réussie(s) sur ' + resultats.length + (echecs ? ' — DES ESSAIS ÉCHOUENT' : ''));
  if (echecs) process.exitCode = 1;
})().catch(async e => {
  console.error('❌ ' + e.message);
  try { if (RACINE) retirerFichiersEssai(path.join(RACINE, DOSSIER_PLANNING)); await geste('fermerSessions'); await geste('retirerDeclencheurs'); } catch (x) {}
  process.exit(1);
});
