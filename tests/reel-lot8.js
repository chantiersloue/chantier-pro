// Lot 8 — essais contre le VRAI serveur de la copie TEST, par la porte de service : node tests/reel-lot8.js
// (lancé par Claude, après un envoi « --avec-porte » de la branche du lot 8 ; ce n'est PAS un test automatique de la série :
// il parle à Google. Ne jamais le lancer contre la production : il ne connaît que l'adresse de la copie TEST.)
//
// Ce qu'il vérifie, et que le faux Google des autres tests ne peut pas prouver : le VRAI verrou de Google.
//   - deux notes de réunion du même chantier envoyées AU MÊME INSTANT, chacune avec un nouveau point : la liste du chantier
//     contient ensuite LES DEUX points (la seconde a lu la ligne écrite par la première : verrou et écriture poussée) ;
//   - les gestes d'une troisième note (clore, compléter) sont appliqués ; renvoyée, elle n'est comptée qu'une fois.
// Ce qu'il ne vérifie PAS : la hauteur réelle du tableau des points dans le PDF de Google (à regarder à la main dans un des
// 3 PDF laissés dans le Drive de TEST).
// Garde-fous avant d'écrire quoi que ce soit :
//   - la porte répond, l'environnement est bien TEST, le serveur est en v11.1 et c'est celui de CETTE branche (empreinte) ;
//   - il reste au moins 40 mails possibles aujourd'hui (quota partagé avec la production) ;
//   - le Drive visé est celui de TEST, le chantier d'essai existe et son conducteur n'est pas une autre personne que Franck.
// Mails envoyés : 3 (un par note), tous à l'adresse de Franck (copie au conducteur du chantier d'essai, sinon Franck). Aucun autre destinataire.
// Ce qui reste après l'essai : 3 PDF « COMPTE RENDU CHANTIER TEST AUTO … » dans le Drive de TEST (l'appli ne supprime rien dans Drive).
// Les 3 lignes écrites dans l'onglet « Comptes rendus » sont retirées à la fin par la porte (seulement les numéros « fiche-auto-… ») :
// les points d'essai disparaissent avec elles (ils ne sont gardés que dans ces lignes).
// Aucun secret n'est affiché : la clé et les jetons de session restent dans _prive/.
'use strict';
const porte = require('../outils/porte.js');
const { deploiementTest } = require('../outils/envoyer-test.js');
const { assembler } = require('../outils/construire.js');

const URL_TEST = deploiementTest().url;
const CHANTIER = 'CHANTIER TEST AUTO';
const VERSION = 'v11.1';
const resultats = [];
let echecs = 0;
function verifier(nom, cond, detail) {
  resultats.push((cond ? '  ✓ ' : '  ✗ ') + nom + (cond || detail === undefined ? '' : '\n      ' + String(detail).slice(0, 500)));
  if (!cond) echecs++;
  console.log(resultats[resultats.length - 1]);
}
async function poster(corps) {
  const r = await fetch(URL_TEST, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(corps), signal: AbortSignal.timeout(180000) });
  return porte.masquerJetons(await r.json());
}
const geste = (nom, donnees) => porte.appeler(nom, donnees || null, { maxMs: 150000 });
async function session(id) {
  const r = await geste('session', { id: id });
  if (!r.ok) throw new Error('session ' + id + ' : ' + r.message);
  return porte.lireSession().jeton;   // lu dans _prive/, jamais affiché
}
const maintenant = new Date(), deux = n => String(n).padStart(2, '0');
const DATE = deux(maintenant.getDate()) + '/' + deux(maintenant.getMonth() + 1) + '/' + maintenant.getFullYear();
const graine = Date.now().toString(36);
const numero = suffixe => 'fiche-auto-' + graine + '-' + suffixe;
// Aucun destinataire choisi : seul part le mail de copie au conducteur du chantier d'essai (ou à Franck)
const note = (objet, base, gestes) => ({ type: 'note', chantier: CHANTIER, auteur: 'ESSAI AUTOMATIQUE', date: DATE, objet: objet,
  commentaires: 'Essai automatique du lot 8 — à ignorer', remarques: 'Essai automatique du lot 8 — à ignorer',
  destinataires: [], photosBase64: [], points: { base: base || '', gestes: gestes || [] } });
const fiche = (jeton, id, donnees) => poster({ action: 'fiche', id: id, jeton: jeton, saisiPar: 'auto-conducteur', donnees: donnees });
const lirePoints = jeton => poster({ action: 'compteRendu', chantier: CHANTIER, jeton: jeton });
const court = x => JSON.stringify(x).slice(0, 450);
const ranger = async () => { try { await geste('purgerComptesRendusEssai'); await geste('fermerSessions'); await geste('retirerDeclencheurs'); } catch (x) {} };

(async () => {
  console.log('Lot 8 — essais réels sur la copie TEST (' + maintenant.toLocaleString('fr-FR') + ')');
  // ── Garde-fous ──
  const etat = await geste('etat');
  if (!etat.ok) throw new Error('la porte de service ne répond pas (' + (etat.code || '') + ') : envoyer d’abord le serveur « --avec-porte »');
  verifier('la porte répond, environnement TEST, serveur ' + etat.data.version + ' (empreinte ' + etat.data.empreinte + ')', etat.data.environnement === 'TEST' && etat.data.version === VERSION, court(etat.data));
  if (etat.data.environnement !== 'TEST' || etat.data.version !== VERSION) throw new Error('environnement ou version inattendus : essais annulés');
  if (etat.data.mailsPossibles < 40) throw new Error('moins de 40 mails possibles aujourd’hui (' + etat.data.mailsPossibles + ') : essais reportés');
  // Juste après un envoi, Google peut encore servir l'ancien serveur : rien n'est écrit tant que le serveur de CETTE branche
  // n'a pas répondu 6 fois de suite
  const attendue = assembler(true).empreinte;
  let suite = 0;
  for (let essai = 0; essai < 40 && suite < 6; essai++) {
    const e = await geste('etat');
    if (e.ok && e.data.empreinte === attendue) suite++;
    else { suite = 0; await new Promise(r => setTimeout(r, 15000)); }
  }
  verifier('le serveur de cette branche (empreinte ' + attendue + ') répond 6 fois de suite : l’ancien n’est plus servi', suite >= 6, 'empreinte lue : ' + etat.data.empreinte);
  if (suite < 6) throw new Error('le serveur en ligne n’est pas celui de cette branche : refaire l’envoi « --avec-porte », ou attendre');
  const inst = await geste('installerLot8');
  verifier('installation du lot 8 sur TEST (onglet Comptes rendus)', inst.ok, inst.message);
  const pc = await geste('preparerComptes'), ch = await geste('preparerChantier');
  verifier('comptes et chantier d’essai prêts', pc.ok && ch.ok, court([pc, ch]));
  if (!inst.ok || !pc.ok || !ch.ok) throw new Error('préparatifs incomplets : aucune note d’essai n’est envoyée');
  const dest = (await geste('destinatairesEssai')).data;
  console.log('    destinataires d’un essai : ' + JSON.stringify(dest));
  if (!dest.racineDriveNommeeTest) throw new Error('le dossier Drive de ce serveur ne s’appelle pas « … TEST … » : essais annulés');
  if (!dest.chantierEssaiPresent) throw new Error('le chantier d’essai est absent de la copie TEST : essais annulés (les points ne seraient pas suivis)');
  if (dest.conducteurChantierEssai === 'AUTRE PERSONNE') throw new Error('le chantier d’essai a pour conducteur une autre personne que Franck : essais annulés (elle recevrait un mail d’essai)');
  // Lignes laissées par un essai précédent interrompu : retirées avant de commencer
  const menage = await geste('purgerComptesRendusEssai');
  verifier('onglet Comptes rendus : aucune ligne d’un essai précédent ne reste', menage.ok, court(menage));
  if (!menage.ok) throw new Error('nettoyage préalable impossible : essais annulés');

  // ── Deux notes du même chantier, envoyées au même instant, chacune avec un nouveau point ──
  const jeton = await session('auto-conducteur');
  const idA = numero('a'), idB = numero('b'), idC = numero('c'), ptA = 'pt-auto-' + graine + '-a', ptB = 'pt-auto-' + graine + '-b';
  const noteA = note('ESSAI AUTOMATIQUE A', '', [{ id: ptA, g: 'nouveau', t: 'Point d’essai A' }]), noteB = note('ESSAI AUTOMATIQUE B', '', [{ id: ptB, g: 'nouveau', t: 'Point d’essai B' }]);
  const [a, b] = await Promise.all([fiche(jeton, idA, noteA), fiche(jeton, idB, noteB)]);
  // « serveur occupé » est une réponse permise (le verrou a fait attendre trop longtemps) : la note est alors renvoyée, comme le ferait le téléphone
  const renvoyer = async (r, id, n) => { for (let k = 0; k < 5 && !r.ok && r.code === 'SERVEUR_OCCUPE'; k++) { await new Promise(x => setTimeout(x, 5000)); r = await fiche(jeton, id, n); } return r; };
  const ra = await renvoyer(a, idA, noteA), rb = await renvoyer(b, idB, noteB);
  verifier('les deux notes sont enregistrées', ra.ok && rb.ok && ra.code === 'ENREGISTRE' && rb.code === 'ENREGISTRE', court([ra, rb]));
  const lu = await lirePoints(jeton);
  const textes = ((lu.data || {}).ouverts || []).map(p => p.t).sort();
  verifier('VRAI VERROU : la liste du chantier contient LES DEUX points (la seconde note a lu la ligne de la première, aucune n’a écrasé l’autre)',
    lu.ok && textes.join(' | ') === 'Point d’essai A | Point d’essai B', court(lu));
  verifier('… et une seule des deux porte « Rédigé sans connaître le compte rendu du … » (celle arrivée en second)',
    [ra, rb].filter(r => /^Rédigé sans connaître le compte rendu du /.test(String((r.data || {}).remarqueCR || ''))).length === 1, court([ra.data, rb.data]));
  verifier('chaque note : un seul mail (la copie au conducteur du chantier d’essai, ou à Franck), aucun reporté', (ra.data || {}).envoyes === 1 && (rb.data || {}).envoyes === 1
    && !(ra.data || {}).reportes && !(rb.data || {}).reportes, court([ra.data, rb.data]));
  const lignes1 = await geste('lireComptesRendus', { n: 10 });
  verifier('onglet Comptes rendus : une ligne par note', lignes1.ok && ((lignes1.data || {}).lignes || []).filter(l => l[0] === idA || l[0] === idB).length === 2, court(lignes1));

  // ── Une troisième note, partie de la liste à jour : elle clôt un point et complète l'autre ──
  const noteC = note('ESSAI AUTOMATIQUE C', (lu.data || {}).base, [{ id: ptA, g: 'clos', t: 'Point d’essai A' }, { id: ptB, g: 'complete', t: 'Point d’essai B, complété' }]);
  const rc = await renvoyer(await fiche(jeton, idC, noteC), idC, noteC);
  const pts = (rc.data || {}).points || {};
  verifier('gestes appliqués par le vrai serveur : A clos, B complété ; aucune remarque (liste à jour)',
    rc.ok && (pts.ouverts || []).map(p => p.t).join() === 'Point d’essai B, complété' && (pts.clos || []).map(p => p.t).join() === 'Point d’essai A' && !(rc.data || {}).remarqueCR, court(rc));

  // ── Rejeu : la même fiche renvoyée ──
  const rejeu = await fiche(jeton, idC, noteC);
  verifier('note renvoyée : « déjà reçue »', rejeu.ok && rejeu.code === 'DEJA_RECU', court(rejeu));
  const lu2 = await geste('lireComptesRendus', { n: 10 });
  verifier('… aucune ligne de plus dans l’onglet (3 lignes d’essai)', ((lu2.data || {}).lignes || []).filter(l => l[0] === idA || l[0] === idB || l[0] === idC).length === 3, court((lu2.data || {}).lignes));
  const lu3 = await lirePoints(jeton);
  verifier('… et les gestes n’ont pas été appliqués deux fois', lu3.ok && (lu3.data.ouverts || []).length === 1 && (lu3.data.clos || []).length === 1, court(lu3));
  const env = await geste('lireEnvois', { n: 8 });
  const envois = ((env.data || {}).lignes || []).filter(l => l[0] === idA || l[0] === idB || l[0] === idC);
  verifier('onglet Envois : les trois notes « traité »', envois.length === 3 && envois.every(l => l[2] === 'note' && l[3] === 'traité'), court(envois));

  // ── Rangement ──
  const purge = await geste('purgerComptesRendusEssai');
  verifier('les 3 lignes d’essai sont retirées de l’onglet Comptes rendus', purge.ok && purge.data.lignesRetirees === 3, court(purge));
  const fin = await geste('fermerSessions');
  verifier('sessions d’essai fermées, comptes d’essai désactivés', fin.ok, court(fin));
  await geste('retirerDeclencheurs');
  const etatFin = (await geste('etat')).data;
  verifier('copie TEST en ordre : aucun déclencheur d’essai, transition intacte', !(etatFin.declencheurs || []).length && etatFin.transitionARetablir === false, court(etatFin));
  verifier('3 mails envoyés par ces essais, pas un de plus (le rejeu n’en envoie pas)', etat.data.mailsPossibles - etatFin.mailsPossibles === 3, etat.data.mailsPossibles + ' avant, ' + etatFin.mailsPossibles + ' après');
  console.log('    (restent dans le Drive de TEST : 3 PDF « COMPTE RENDU ' + CHANTIER + ' … » : regarder dans l’un d’eux le tableau des points, puis les supprimer à la main)');
  console.log('\n' + (resultats.length - echecs) + ' vérification(s) réussie(s) sur ' + resultats.length + (echecs ? ' — DES ESSAIS ÉCHOUENT' : ''));
  if (echecs) process.exitCode = 1;
})().catch(async e => {
  console.error('❌ ' + e.message);
  await ranger();
  process.exit(1);
});
