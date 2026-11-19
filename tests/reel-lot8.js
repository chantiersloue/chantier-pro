// Lot 8b — essais contre le VRAI serveur de la copie TEST, par la porte de service : node tests/reel-lot8.js
// (lancé par Claude, après un envoi « --avec-porte » de la branche du lot 8 ; ce n'est PAS un test automatique de la série :
// il parle à Google. Ne jamais le lancer contre la production : il ne connaît que l'adresse de la copie TEST.)
//
// Ce qu'il vérifie, et que le faux Google des autres tests ne peut pas prouver : le VRAI verrou de Google.
//   - deux notes de réunion du même chantier envoyées AU MÊME INSTANT reçoivent deux numéros différents et qui se suivent ;
//   - une note renvoyée (même numéro de fiche) retrouve son numéro, sans seconde ligne ni second mail.
// Garde-fous avant d'écrire quoi que ce soit :
//   - la porte répond, l'environnement est bien TEST, le serveur est en v11.0 et c'est celui de CETTE branche (empreinte) ;
//   - il reste au moins 40 mails possibles aujourd'hui (quota partagé avec la production) ;
//   - le Drive visé est celui de TEST, le chantier d'essai existe et son conducteur n'est pas une autre personne que Franck.
// Mails envoyés : 2 (un par note), tous à l'adresse de Franck (copie au conducteur du chantier d'essai, sinon Franck). Aucun autre destinataire.
// Ce qui reste après l'essai : 2 PDF « COMPTE RENDU CHANTIER TEST AUTO … » dans le Drive de TEST (l'appli ne supprime rien dans Drive).
// Les 2 lignes écrites dans l'onglet « Comptes rendus » sont retirées à la fin par la porte (seulement les numéros « fiche-auto-… »).
// Aucun secret n'est affiché : la clé et les jetons de session restent dans _prive/.
'use strict';
const porte = require('../outils/porte.js');
const { deploiementTest } = require('../outils/envoyer-test.js');
const { assembler } = require('../outils/construire.js');

const URL_TEST = deploiementTest().url;
const CHANTIER = 'CHANTIER TEST AUTO';
const VERSION = 'v11.0';
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
const note = objet => ({ type: 'note', chantier: CHANTIER, auteur: 'ESSAI AUTOMATIQUE', date: DATE, objet: objet,
  commentaires: 'Essai automatique du lot 8 (deux envois au même instant) — à ignorer', remarques: 'Essai automatique du lot 8 (deux envois au même instant) — à ignorer',
  presents: ['Présent Essai 01', 'Présent Essai 02'], destinataires: [], photosBase64: [] });
const fiche = (jeton, id, donnees) => poster({ action: 'fiche', id: id, jeton: jeton, saisiPar: 'auto-poseur', donnees: donnees });
const court = x => JSON.stringify(x).slice(0, 450);
const ranger = async () => { try { await geste('purgerComptesRendusEssai'); await geste('fermerSessions'); await geste('retirerDeclencheurs'); } catch (x) {} };

(async () => {
  console.log('Lot 8b — essais réels sur la copie TEST (' + maintenant.toLocaleString('fr-FR') + ')');
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
  if (!dest.chantierEssaiPresent) throw new Error('le chantier d’essai est absent de la copie TEST : essais annulés (la note n’aurait pas de numéro)');
  if (dest.conducteurChantierEssai === 'AUTRE PERSONNE') throw new Error('le chantier d’essai a pour conducteur une autre personne que Franck : essais annulés (elle recevrait un mail d’essai)');
  // Lignes laissées par un essai précédent interrompu : retirées avant de commencer
  const menage = await geste('purgerComptesRendusEssai');
  verifier('onglet Comptes rendus : aucune ligne d’un essai précédent ne reste', menage.ok, court(menage));
  if (!menage.ok) throw new Error('nettoyage préalable impossible : essais annulés');

  // ── Deux notes du même chantier, envoyées au même instant ──
  const jeton = await session('auto-poseur');
  const idA = numero('a'), idB = numero('b');
  const [a, b] = await Promise.all([fiche(jeton, idA, note('ESSAI AUTOMATIQUE A')), fiche(jeton, idB, note('ESSAI AUTOMATIQUE B'))]);
  // « serveur occupé » est une réponse permise (le verrou a fait attendre trop longtemps) : la note est alors renvoyée, comme le ferait le téléphone
  const renvoyer = async (r, id, objet) => { for (let k = 0; k < 5 && !r.ok && r.code === 'SERVEUR_OCCUPE'; k++) { await new Promise(x => setTimeout(x, 5000)); r = await fiche(jeton, id, note(objet)); } return r; };
  const ra = await renvoyer(a, idA, 'ESSAI AUTOMATIQUE A'), rb = await renvoyer(b, idB, 'ESSAI AUTOMATIQUE B');
  verifier('les deux notes sont enregistrées, chacune avec un numéro', ra.ok && rb.ok && ra.data.numeroCR > 0 && rb.data.numeroCR > 0, court([ra, rb]));
  const nA = Number((ra.data || {}).numeroCR), nB = Number((rb.data || {}).numeroCR);
  verifier('VRAI VERROU : deux numéros DIFFÉRENTS et qui se suivent (' + nA + ' et ' + nB + ')', nA > 0 && nB > 0 && Math.abs(nA - nB) === 1, court([nA, nB]));
  verifier('chaque note : un seul mail (la copie au conducteur du chantier d’essai, ou à Franck), aucun reporté', (ra.data || {}).envoyes === 1 && (rb.data || {}).envoyes === 1
    && !(ra.data || {}).reportes && !(rb.data || {}).reportes, court([ra.data, rb.data]));
  const lu = await geste('lireComptesRendus', { n: 10 });
  const lignes = ((lu.data || {}).lignes || []).filter(l => l[0] === idA || l[0] === idB);
  verifier('onglet Comptes rendus : une ligne par note, avec son numéro', lu.ok && lignes.length === 2
    && String((lignes.find(l => l[0] === idA) || [])[2]) === String(nA) && String((lignes.find(l => l[0] === idB) || [])[2]) === String(nB), court(lignes));

  // ── Rejeu : la même fiche renvoyée ──
  const rejeu = await fiche(jeton, idA, note('ESSAI AUTOMATIQUE A'));
  verifier('note renvoyée : « déjà reçue », avec le MÊME numéro', rejeu.ok && rejeu.code === 'DEJA_RECU' && Number(rejeu.data.numeroCR) === nA, court(rejeu));
  const lu2 = await geste('lireComptesRendus', { n: 10 });
  verifier('… aucune ligne de plus dans l’onglet', ((lu2.data || {}).lignes || []).filter(l => l[0] === idA).length === 1, court((lu2.data || {}).lignes));
  const env = await geste('lireEnvois', { n: 6 });
  const envois = ((env.data || {}).lignes || []).filter(l => l[0] === idA || l[0] === idB);
  verifier('onglet Envois : les deux notes « traité »', envois.length === 2 && envois.every(l => l[2] === 'note' && l[3] === 'traité'), court(envois));

  // ── Rangement ──
  const purge = await geste('purgerComptesRendusEssai');
  verifier('les 2 lignes d’essai sont retirées de l’onglet Comptes rendus', purge.ok && purge.data.lignesRetirees === 2, court(purge));
  const fin = await geste('fermerSessions');
  verifier('sessions d’essai fermées, comptes d’essai désactivés', fin.ok, court(fin));
  await geste('retirerDeclencheurs');
  const etatFin = (await geste('etat')).data;
  verifier('copie TEST en ordre : aucun déclencheur d’essai, transition intacte', !(etatFin.declencheurs || []).length && etatFin.transitionARetablir === false, court(etatFin));
  verifier('2 mails envoyés par ces essais, pas un de plus (le rejeu n’en envoie pas)', etat.data.mailsPossibles - etatFin.mailsPossibles === 2, etat.data.mailsPossibles + ' avant, ' + etatFin.mailsPossibles + ' après');
  console.log('    (restent dans le Drive de TEST : 2 PDF « COMPTE RENDU ' + CHANTIER + ' … », à supprimer à la main si besoin)');
  console.log('\n' + (resultats.length - echecs) + ' vérification(s) réussie(s) sur ' + resultats.length + (echecs ? ' — DES ESSAIS ÉCHOUENT' : ''));
  if (echecs) process.exitCode = 1;
})().catch(async e => {
  console.error('❌ ' + e.message);
  await ranger();
  process.exit(1);
});
