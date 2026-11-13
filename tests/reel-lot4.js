// Lot 4a — essais contre le VRAI serveur de la copie TEST : node tests/reel-lot4.js "<racine du Drive TEST sur le PC>"
// (lancé par Claude, après un envoi « --avec-porte » et un dépôt fait par outils/depot_carnet.py dans le chantier d'essai ;
//  ce n'est PAS un test automatique de la série : il parle à Google)
//
// Ce qui est vérifié : le serveur lit ce que le VRAI programme de dépôt a écrit dans le Drive (synchronisé par Google Drive
// pour ordinateur) ; chaque image rendue est comparée, à l'octet près, au fichier écrit sur le PC ; les droits ; les durées ;
// 15 téléphones en même temps. Rien n'est écrit ni supprimé par ces essais ; aucun mail. Aucun secret affiché.
'use strict';
const fs = require('fs');
const path = require('path');
const porte = require('../outils/porte.js');
const { deploiementTest } = require('../outils/envoyer-test.js');
const { assembler } = require('../outils/construire.js');

const RACINE = process.argv[2];
const URL_TEST = deploiementTest().url;
const CHANTIER = 'CHANTIER TEST AUTO';
const resultats = [];
let echecs = 0;
function verifier(nom, cond, detail) {
  resultats.push((cond ? '  ✓ ' : '  ✗ ') + nom + (cond || detail === undefined ? '' : '\n      ' + String(detail).slice(0, 500)));
  if (!cond) echecs++;
  console.log(resultats[resultats.length - 1]);
}
const geste = (nom, donnees) => porte.appeler(nom, donnees || null, { maxMs: 150000 });
const court = x => JSON.stringify(x).slice(0, 400);
const s1 = ms => (ms / 1000).toFixed(1).replace('.', ',') + ' s';
const mediane = t => { const u = t.slice().sort((a, b) => a - b); return u[Math.floor(u.length / 2)]; };
async function demander(corps) {
  const debut = Date.now();
  const r = await fetch(URL_TEST, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(corps), signal: AbortSignal.timeout(120000) });
  const texte = await r.text();
  let rep; try { rep = JSON.parse(texte); } catch (e) { rep = { ok: false, code: 'PAS_JSON', message: texte.slice(0, 120) }; }
  return { rep: rep, ms: Date.now() - debut, poids: texte.length };
}

(async () => {
  console.log('Lot 4a — essais réels sur la copie TEST (' + new Date().toLocaleString('fr-FR') + ')');
  if (!RACINE || !fs.existsSync(path.join(RACINE, 'dossiers.json')) || !/TEST/i.test(path.basename(RACINE))) throw new Error('donner en argument la racine du Drive TEST sur le PC (dossier « … TEST … » contenant dossiers.json)');
  const local = path.join(RACINE, CHANTIER, 'CARNET');
  const attendu = JSON.parse(fs.readFileSync(path.join(local, 'carnet.json'), 'utf8'));
  const etat = await geste('etat');
  if (!etat.ok || etat.data.environnement !== 'TEST' || etat.data.version !== 'v9.0') throw new Error('porte, environnement ou version inattendus : essais annulés');
  const empreinte = assembler(true).empreinte;
  let suite = 0;
  for (let essai = 0; essai < 40 && suite < 6; essai++) { const e = await geste('etat'); if (e.ok && e.data.empreinte === empreinte) suite++; else { suite = 0; await new Promise(r => setTimeout(r, 15000)); } }
  verifier('le serveur de cette branche (v9.0, empreinte ' + empreinte + ') répond 6 fois de suite sur TEST', suite >= 6);
  if (suite < 6) throw new Error('le serveur en ligne n’est pas celui de cette branche');
  const dest = (await geste('destinatairesEssai')).data;
  if (!dest.racineDriveNommeeTest || !dest.chantierEssaiPresent) throw new Error('Drive ou chantier d’essai inattendus : essais annulés');
  const pc = await geste('preparerComptes'), ch = await geste('preparerChantier');
  if (!pc.ok || !ch.ok) throw new Error('comptes ou chantier d’essai non prêts');
  const s = await geste('session', { id: 'auto-poseur' });
  if (!s.ok) throw new Error('session : ' + s.message);
  let jeton = porte.lireSession().jeton;
  await geste('traiterComptes');
  const appel = async corps => { const r = await demander(Object.assign({ jeton: jeton, chantier: CHANTIER }, corps)); if (r.rep.jeton) jeton = r.rep.jeton; return r; };

  // ── Droits ──
  await geste('accesChantier', { id: 'auto-poseur', valeur: false });
  const refus = await appel({ action: 'carnet' }), refusImage = await appel({ action: 'carnetTuiles', doc: attendu.documents[0].id, page: 1, quoi: 'leger' });
  const inconnu = await appel({ action: 'carnet', chantier: 'CHANTIER QUI N EXISTE PAS' });
  verifier('poseur sans la case du chantier : liste et image refusées ; même réponse que pour un chantier inconnu', refus.rep.code === 'INTERDIT' && refusImage.rep.code === 'INTERDIT'
    && inconnu.rep.code === 'INTERDIT' && inconnu.rep.message === refus.rep.message, court([refus.rep, refusImage.rep, inconnu.rep]));
  const sansCompte = await demander({ action: 'carnet', chantier: CHANTIER });
  verifier('sans compte : refusé', sansCompte.rep.ok === false, court(sansCompte.rep));
  const acces = await geste('accesChantier', { id: 'auto-poseur', valeur: true });
  if (!acces.ok) throw new Error('accès au chantier d’essai : ' + acces.message);

  // ── La liste : on attend que Google Drive pour ordinateur ait tout envoyé (10 minutes au plus) ──
  const ids = attendu.documents.filter(d => !d.retire).map(d => d.id);
  let liste = null, debutAttente = Date.now();
  for (;;) {
    liste = await appel({ action: 'carnet' });
    if (liste.rep.ok && ids.every(id => liste.rep.data.documents.some(d => d.id === id))) break;
    if (Date.now() - debutAttente > 600000) break;
    await new Promise(r => setTimeout(r, 20000));
  }
  verifier('la liste du serveur contient les documents déposés par le programme (' + ids.join(', ') + '), ' + s1(Date.now() - debutAttente) + ' après le début des essais',
    liste.rep.ok && ids.every(id => liste.rep.data.documents.some(d => d.id === id)), court(liste.rep));
  if (!liste.rep.ok) throw new Error('liste non reçue : arrêt');
  const texteListe = JSON.stringify(liste.rep);
  verifier('aucun identifiant Drive dans la liste (ni adresse, ni identifiant de fichier)', !/drive\.google|docs\.google|"[A-Za-z0-9_-]{28,}"/.test(texteListe), (texteListe.match(/"[A-Za-z0-9_-]{28,}"/) || [''])[0]);
  verifier('chaque document a son empreinte de dépôt', liste.rep.data.documents.every(d => /^\d{4}-\d\d-\d\dT/.test(d.empreinte)), court(liste.rep.data.documents.map(d => d.empreinte)));

  // ── Les images : comparées aux fichiers écrits sur le PC ──
  const mesures = { leger: [], net: [], tuiles: [] };
  let comparees = 0, fausses = 0, arrive = 0;
  const lireLocal = (doc, nom) => fs.readFileSync(path.join(local, doc.dossier, nom));
  // un fichier peut ne pas être encore monté dans Drive : on réessaie pendant 10 minutes
  const obtenir = async corps => { for (let i = 0; i < 30; i++) { const r = await appel(corps); if (r.rep.code !== 'CARNET_ARRIVE') return r; arrive++; await new Promise(x => setTimeout(x, 20000)); } return appel(corps); };
  for (const doc of attendu.documents.filter(d => !d.retire)) {
    for (let n = 1; n <= doc.pages.length; n++) {
      const page = doc.pages[n - 1];
      for (const quoi of ['leger', 'net']) {
        const r = await obtenir({ action: 'carnetTuiles', doc: doc.id, page: n, quoi: quoi });
        const bon = r.rep.ok && Buffer.from(r.rep.data.images[0].b64, 'base64').equals(lireLocal(doc, page[quoi].f));
        comparees++; if (!bon) { fausses++; console.log('      ✗ ' + doc.id + ' page ' + n + ' ' + quoi + ' : ' + court(r.rep).slice(0, 200)); }
        mesures[quoi].push([r.ms, r.rep.ok ? r.rep.data.ms : 0, r.poids]);
      }
      for (const nv of page.niveaux || []) {
        // dans chaque niveau : le premier et le dernier paquet, 4 tuiles chacun (dont une de bord)
        const paquets = nv.paquets.length > 1 ? [nv.paquets[0], nv.paquets[nv.paquets.length - 1]] : nv.paquets;
        for (const p of paquets) {
          const choisies = p.tuiles.slice(0, 2).concat(p.tuiles.slice(-2)).filter((t, i, a) => a.indexOf(t) === i);
          const r = await obtenir({ action: 'carnetTuiles', doc: doc.id, page: n, quoi: 'tuiles', niveau: nv.z, tuiles: choisies.map(t => [t[0], t[1]]) });
          const fichier = r.rep.ok ? lireLocal(doc, p.f) : null;
          const recues = r.rep.ok ? r.rep.data.images.concat([]) : [];
          let suiteReste = r.rep.ok ? r.rep.data.reste : [];
          while (suiteReste.length) { const r2 = await obtenir({ action: 'carnetTuiles', doc: doc.id, page: n, quoi: 'tuiles', niveau: nv.z, tuiles: suiteReste }); if (!r2.rep.ok) break; recues.push(...r2.rep.data.images); suiteReste = r2.rep.data.reste; }
          choisies.forEach(t => {
            const im = recues.filter(i => i.c === t[0] && i.l === t[1])[0];
            const bon = !!im && Buffer.from(im.b64, 'base64').equals(fichier.subarray(t[2], t[2] + t[3]));
            comparees++; if (!bon) { fausses++; console.log('      ✗ ' + doc.id + ' page ' + n + ' niveau ' + nv.z + ' tuile ' + t[0] + ',' + t[1]); }
          });
          if (r.rep.ok) mesures.tuiles.push([r.ms, r.rep.data.ms, r.poids]);
        }
      }
    }
  }
  verifier(comparees + ' images rendues par le serveur (aperçus et tuiles de chaque niveau de chaque page), toutes identiques à l’octet près aux fichiers écrits sur le PC', comparees > 20 && fausses === 0, fausses + ' différente(s)');
  console.log('    réponses « en cours d’arrivée » rencontrées pendant la synchronisation : ' + arrive);
  ['leger', 'net', 'tuiles'].forEach(q => { const m = mesures[q]; if (m.length) console.log('    ' + q + ' : ' + m.length + ' demandes ; durée médiane ' + s1(mediane(m.map(x => x[0]))) + ' (dont serveur ' + s1(mediane(m.map(x => x[1])))
    + ') ; la plus longue ' + s1(Math.max.apply(null, m.map(x => x[0]))) + ' ; réponse la plus lourde ' + Math.round(Math.max.apply(null, m.map(x => x[2])) / 1024) + ' Ko'); });
  verifier('aucune réponse de lecture ne dépasse 450 Ko (300 Ko d’images, plus le codage)', Math.max.apply(null, mesures.tuiles.concat(mesures.leger).map(x => x[2])) <= 450 * 1024, court(mesures.tuiles.map(x => Math.round(x[2] / 1024))));

  // ── Paramètres hostiles ──
  const gros = attendu.documents.filter(d => d.pages.some(p => (p.niveaux || []).length))[0];
  const hostiles = [
    await appel({ action: 'carnetTuiles', doc: '../' + gros.id, page: 1, quoi: 'leger' }),
    await appel({ action: 'carnetTuiles', doc: gros.id, page: 99, quoi: 'net' }),
    await appel({ action: 'carnetTuiles', doc: gros.id, page: 1, quoi: 'tuiles', niveau: 0, tuiles: 'tout' }),
    await appel({ action: 'carnetTuiles', doc: gros.id, page: 1, quoi: 'carnet.json' }),
  ];
  verifier('demandes mal formées (chemin, page inconnue, tuiles illisibles, nom de fichier) : refusées proprement', hostiles.every(h => h.rep.ok === false && h.rep.code === 'CARNET_INCONNU'), court(hostiles.map(h => h.rep.code)));

  // ── Charge : 15 téléphones, 2 demandes à la fois chacun, de vraies tuiles ──
  const pg = gros.pages.findIndex(p => (p.niveaux || []).length) + 1, nv0 = gros.pages[pg - 1].niveaux.filter(n => n.z === 0)[0];
  const debut = Date.now(); let ok = 0, ko = 0, pire = 0; const codes = {};
  const telephone = async k => {
    const file = [0, 1, 2, 3, 4, 5].map(i => { const p = nv0.paquets[(k * 3 + i) % nv0.paquets.length]; return { action: 'carnetTuiles', doc: gros.id, page: pg, quoi: 'tuiles', niveau: 0, tuiles: p.tuiles.slice(0, 4).map(t => [t[0], t[1]]) }; });
    const ouvrier = async () => { while (file.length) { const r = await demander(Object.assign({ jeton: jeton, chantier: CHANTIER }, file.shift())); if (r.rep.ok) ok++; else { ko++; codes[r.rep.code || '?'] = (codes[r.rep.code || '?'] || 0) + 1; } pire = Math.max(pire, r.ms); } };
    await Promise.all([ouvrier(), ouvrier()]);
  };
  await Promise.all(Array.from({ length: 15 }, (x, k) => telephone(k)));
  verifier('15 téléphones en même temps sur un vrai plan (90 demandes) : aucune erreur ; la plus lente ' + s1(pire) + ' ; le tout en ' + s1(Date.now() - debut), ko === 0 && ok === 90, court(codes));

  // ── Lot 4b : 15 téléphones en « Tout télécharger » (une demande de 1,2 Mo à la fois chacun), et une fiche envoyée pendant ──
  // sur la page la plus lourde du document le plus lourd (de vrais lots de 1,2 Mo)
  const lourd = attendu.documents.filter(d => !d.retire).sort((a, b) => b.poids - a.poids)[0];
  const poidsPage = p => (p.niveaux || []).reduce((s, n) => s + n.paquets.reduce((s2, q) => s2 + q.o, 0), 0);
  const pgM = lourd.pages.map((p, i) => [poidsPage(p), i + 1]).sort((a, b) => b[0] - a[0])[0][1], nvM = lourd.pages[pgM - 1].niveaux.filter(n => n.z === 0)[0];
  const lotsMasse = [];
  { let lot = [], o = 0;
    nvM.paquets.forEach(p => p.tuiles.forEach(t => { if (o + t[3] > 1200 * 1024 || lot.length >= 60) { lotsMasse.push(lot); lot = []; o = 0; } lot.push([t[0], t[1]]); o += t[3]; }));
    if (lot.length) lotsMasse.push(lot); }
  const debutM = Date.now(); let okM = 0, koM = 0, pireM = 0, octetsM = 0; const codesM = {}, dureesM = [];
  const masse = async k => {
    for (let i = 0; i < 3; i++) {
      const r = await demander({ jeton: jeton, chantier: CHANTIER, action: 'carnetTuiles', doc: lourd.id, page: pgM, quoi: 'tuiles', niveau: 0, masse: true, tuiles: lotsMasse[(k + i) % lotsMasse.length] });
      if (r.rep.ok && r.rep.data.images.length) { okM++; octetsM += r.poids; dureesM.push(r.ms); } else { koM++; codesM[r.rep.code || '?'] = (codesM[r.rep.code || '?'] || 0) + 1; }
      pireM = Math.max(pireM, r.ms);
    }
  };
  const graine = Date.now().toString(36);
  const ficheP = (async () => { await new Promise(r => setTimeout(r, 3000)); return demander({ action: 'fiche', id: 'fiche-auto-' + graine + '-carnet', jeton: jeton, saisiPar: 'auto-poseur',
    donnees: { type: 'note-chantier', chantier: CHANTIER, texte: 'ESSAI AUTOMATIQUE fiche envoyée pendant 15 téléchargements du carnet' } }); })();
  await Promise.all(Array.from({ length: 15 }, (x, k) => masse(k)));
  const fiche = await ficheP;
  verifier('15 téléphones en « Tout télécharger » (45 demandes de masse, ' + Math.round(octetsM / 1048576) + ' Mo reçus en ' + s1(Date.now() - debutM) + ') : aucune erreur ; médiane ' + s1(mediane(dureesM.length ? dureesM : [0]))
    + ', la plus lente ' + s1(pireM), koM === 0 && okM === 45, court(codesM));
  verifier('… une fiche envoyée pendant ce temps est enregistrée (' + s1(fiche.ms) + ')', fiche.rep.ok === true, court(fiche.rep));
  const purge = await geste('purgerNotesEssai');
  verifier('la note d’essai est retirée de la copie TEST', purge.ok, court(purge));

  // ── Fin : on laisse les documents (ils servent aux essais de Franck), on referme les comptes d'essai ──
  await geste('accesChantier', { id: 'auto-poseur', valeur: false });
  const fin = await geste('fermerSessions'); await geste('retirerDeclencheurs');
  const etatFin = (await geste('etat')).data;
  // un mail envoyé ferait BAISSER ce nombre (il peut remonter tout seul : le compteur de Google glisse sur 24 heures)
  verifier('comptes d’essai refermés, aucun mail envoyé', fin.ok && etatFin.mailsPossibles >= etat.data.mailsPossibles, etat.data.mailsPossibles + ' avant, ' + etatFin.mailsPossibles + ' après');
  console.log('\n' + (resultats.length - echecs) + ' vérification(s) réussie(s) sur ' + resultats.length + (echecs ? ' — DES ESSAIS ÉCHOUENT' : ''));
  if (echecs) process.exitCode = 1;
})().catch(async e => {
  console.error('❌ ' + e.message);
  try { await geste('accesChantier', { id: 'auto-poseur', valeur: false }); await geste('fermerSessions'); await geste('retirerDeclencheurs'); } catch (x) {}
  process.exit(1);
});
