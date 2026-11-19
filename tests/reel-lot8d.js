// Lot 8d — essais contre le VRAI serveur de la copie TEST, par la porte de service : node tests/reel-lot8d.js
// (lancé par Claude, après un envoi « --avec-porte » de la branche du lot 8d ; ce n'est PAS un test automatique de la série :
// il parle à Google. Ne jamais le lancer contre la production : il ne connaît que l'adresse de la copie TEST.)
//
// Ce qu'il vérifie, et que le faux Google des autres tests ne peut pas prouver :
//   - le texte d'une note (retours à la ligne, tiret en tête, signe « = » en tête) est gardé tel quel par le vrai Sheet ;
//   - le vrai Google fabrique le PDF du récapitulatif et le range dans le dossier des notes du chantier d'essai ;
//   - une note de plus : le fichier est REMPLACÉ (toujours un seul récapitulatif, l'ancien à la corbeille de Drive).
// Garde-fous avant d'écrire quoi que ce soit : la porte répond, l'environnement est TEST, le serveur est celui de CETTE
// branche (empreinte), il reste au moins 40 mails possibles aujourd'hui, le Drive visé est celui de TEST, le chantier
// d'essai existe et son conducteur n'est pas une autre personne que Franck.
// Mails envoyés : 3 (un par note), tous à l'adresse de Franck. Aucun autre destinataire. Le récapitulatif n'envoie aucun mail.
// Ce qui reste après l'essai : 3 PDF « COMPTE RENDU CHANTIER TEST AUTO … » et 1 « RÉCAPITULATIF DES NOTES - CHANTIER TEST AUTO.pdf »
// dans le Drive de TEST. Les lignes écrites dans l'onglet « Comptes rendus » sont retirées à la fin par la porte.
// Aucun secret n'est affiché : la clé et les jetons de session restent dans _prive/.
'use strict';
const fs = require('fs');
const path = require('path');
const porte = require('../outils/porte.js');
const { deploiementTest } = require('../outils/envoyer-test.js');
const { assembler } = require('../outils/construire.js');

const URL_TEST = deploiementTest().url;
const CHANTIER = 'CHANTIER TEST AUTO';
const VERSION = (/VERSION_API = '([^']+)'/.exec(fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Config.gs'), 'utf8')) || [])[1];
let echecs = 0;
function verifier(nom, cond, detail) {
  if (!cond) echecs++;
  console.log((cond ? '  ✓ ' : '  ✗ ') + nom + (cond || detail === undefined ? '' : '\n      ' + String(detail).slice(0, 500)));
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
const graine = Date.now().toString(36);
const numero = suffixe => 'fiche-auto-' + graine + '-' + suffixe;
const NL = String.fromCharCode(10);
const TEXTES = { a: 'Essai automatique du lot 8d — note A' + NL + 'deuxième ligne' + NL + NL + 'quatrième ligne',
  b: '- essai automatique du lot 8d, note B : le texte commence par un tiret',
  c: '=1+1 essai automatique du lot 8d, note C : le texte commence par un signe égal' };
const note = (date, objet, texte) => ({ type: 'note', chantier: CHANTIER, auteur: 'ESSAI AUTOMATIQUE', date: date, objet: objet,
  commentaires: texte, remarques: texte, destinataires: [], photosBase64: [] });
const fiche = async (jeton, id, donnees) => {
  let r = await poster({ action: 'fiche', id: id, jeton: jeton, saisiPar: 'auto-poseur', donnees: donnees });
  // « serveur occupé » est une réponse permise : la note est renvoyée, comme le ferait le téléphone
  for (let k = 0; k < 5 && !r.ok && r.code === 'SERVEUR_OCCUPE'; k++) { await new Promise(x => setTimeout(x, 5000)); r = await poster({ action: 'fiche', id: id, jeton: jeton, saisiPar: 'auto-poseur', donnees: donnees }); }
  return r;
};
const court = x => JSON.stringify(x).slice(0, 450);
const ranger = async () => { try { await geste('purgerComptesRendusEssai'); await geste('fermerSessions'); await geste('retirerDeclencheurs'); } catch (x) {} };

(async () => {
  console.log('Lot 8d — essais réels sur la copie TEST (' + new Date().toLocaleString('fr-FR') + ')');
  // ── Garde-fous ──
  const etat = await geste('etat');
  if (!etat.ok) throw new Error('la porte de service ne répond pas (' + (etat.code || '') + ') : envoyer d’abord le serveur « --avec-porte »');
  verifier('la porte répond, environnement TEST, serveur ' + etat.data.version + ' (empreinte ' + etat.data.empreinte + ')', etat.data.environnement === 'TEST' && etat.data.version === VERSION, court(etat.data));
  if (etat.data.environnement !== 'TEST' || etat.data.version !== VERSION) throw new Error('environnement ou version inattendus : essais annulés');
  if (etat.data.mailsPossibles < 40) throw new Error('moins de 40 mails possibles aujourd’hui (' + etat.data.mailsPossibles + ') : essais reportés');
  const attendue = assembler(true).empreinte;
  let suite = 0;
  for (let essai = 0; essai < 40 && suite < 6; essai++) {
    const e = await geste('etat');
    if (e.ok && e.data.empreinte === attendue) suite++;
    else { suite = 0; await new Promise(r => setTimeout(r, 15000)); }
  }
  verifier('le serveur de cette branche (empreinte ' + attendue + ') répond 6 fois de suite', suite >= 6, 'empreinte lue : ' + etat.data.empreinte);
  if (suite < 6) throw new Error('le serveur en ligne n’est pas celui de cette branche : refaire l’envoi « --avec-porte », ou attendre');
  const inst = await geste('installerLot8d');
  verifier('installation du lot 8d sur TEST (colonne « Texte de la note »)', inst.ok, inst.message);
  const pc = await geste('preparerComptes'), ch = await geste('preparerChantier');
  verifier('comptes et chantier d’essai prêts', pc.ok && ch.ok, court([pc, ch]));
  if (!inst.ok || !pc.ok || !ch.ok) throw new Error('préparatifs incomplets : aucune note d’essai n’est envoyée');
  const dest = (await geste('destinatairesEssai')).data;
  if (!dest.racineDriveNommeeTest) throw new Error('le dossier Drive de ce serveur ne s’appelle pas « … TEST … » : essais annulés');
  if (!dest.chantierEssaiPresent) throw new Error('le chantier d’essai est absent de la copie TEST : essais annulés');
  if (dest.conducteurChantierEssai === 'AUTRE PERSONNE') throw new Error('le chantier d’essai a pour conducteur une autre personne que Franck : essais annulés (elle recevrait un mail d’essai)');
  const menage = await geste('purgerComptesRendusEssai');
  verifier('onglet Comptes rendus : aucune ligne d’un essai précédent ne reste', menage.ok, court(menage));
  if (!menage.ok) throw new Error('nettoyage préalable impossible : essais annulés');
  const avant = (await geste('lireRecap')).data || {};
  console.log('    avant l’essai : ' + JSON.stringify(avant));

  // ── Deux notes, puis le passage : un récapitulatif ──
  const jeton = await session('auto-poseur');
  const ra = await fiche(jeton, numero('a'), note('03/11/2026', 'ESSAI AUTOMATIQUE A', TEXTES.a));
  const rb = await fiche(jeton, numero('b'), note('17/11/2026', 'ESSAI AUTOMATIQUE B', TEXTES.b));
  verifier('deux notes enregistrées, un mail chacune', ra.ok && rb.ok && (ra.data || {}).envoyes === 1 && (rb.data || {}).envoyes === 1, court([ra, rb]));
  const lu1 = await poster({ action: 'recapNotes', chantier: CHANTIER, jeton: jeton });
  const notes1 = ((lu1.data || {}).notes || []).filter(n => /^ESSAI AUTOMATIQUE [AB]$/.test(n.objet));
  verifier('lecture par l’appli : les deux notes, la plus récente en haut', lu1.ok && notes1.map(n => n.objet).join() === 'ESSAI AUTOMATIQUE B,ESSAI AUTOMATIQUE A', court(lu1));
  verifier('VRAI SHEET : le texte est rendu tel qu’il a été tapé (retours à la ligne, tiret en tête)', notes1.length === 2 && notes1[0].texte === TEXTES.b && notes1[1].texte === TEXTES.a, court(notes1));
  const attente1 = (await geste('lireRecap')).data || {};
  verifier('le fichier n’est pas fait pendant l’envoi : le chantier est en attente', attente1.enAttente >= 1 && attente1.fichiers === (avant.fichiers || 0), court(attente1));
  const p1 = await geste('traiterComptes');
  const apres1 = (await geste('lireRecap')).data || {};
  verifier('VRAI GOOGLE : après le passage, UN récapitulatif dans le dossier des notes du chantier d’essai (un vrai PDF, plus de 1 000 octets), plus rien en attente',
    p1.ok && apres1.fichiers === 1 && apres1.octets > 1000 && apres1.enAttente === 0, court([p1, apres1]));

  // ── Une note de plus : le fichier est remplacé ──
  const rc = await fiche(jeton, numero('c'), note('19/11/2026', 'ESSAI AUTOMATIQUE C', TEXTES.c));
  verifier('troisième note enregistrée, un mail', rc.ok && (rc.data || {}).envoyes === 1, court(rc));
  const lu2 = await poster({ action: 'recapNotes', chantier: CHANTIER, jeton: jeton });
  const c = ((lu2.data || {}).notes || []).find(n => n.objet === 'ESSAI AUTOMATIQUE C');
  verifier('VRAI SHEET : un texte qui commence par « = » reste du texte (ni formule, ni erreur)', !!c && c.texte === TEXTES.c, court(c));
  const p2 = await geste('traiterComptes');
  const apres2 = (await geste('lireRecap')).data || {};
  verifier('VRAI GOOGLE : le récapitulatif est remplacé — toujours UN seul fichier, l’ancien à la corbeille',
    p2.ok && apres2.fichiers === 1 && apres2.corbeille >= (apres1.corbeille || 0) + 1 && apres2.enAttente === 0, court([p2, apres1, apres2]));
  const sans = await poster({ action: 'recapNotes', chantier: CHANTIER });
  verifier('sans compte : la lecture est refusée, aucun texte rendu', !sans.ok && JSON.stringify(sans).indexOf('essai automatique') < 0, court(sans));

  // ── Rangement ──
  const purge = await geste('purgerComptesRendusEssai');
  verifier('les 3 lignes d’essai sont retirées de l’onglet Comptes rendus', purge.ok && purge.data.lignesRetirees === 3, court(purge));
  const fin = await geste('fermerSessions');
  verifier('sessions d’essai fermées, comptes d’essai désactivés', fin.ok, court(fin));
  await geste('retirerDeclencheurs');
  const etatFin = (await geste('etat')).data;
  verifier('copie TEST en ordre : aucun déclencheur d’essai, transition intacte', !(etatFin.declencheurs || []).length && etatFin.transitionARetablir === false, court(etatFin));
  const partis = etat.data.mailsPossibles - etatFin.mailsPossibles;
  verifier('compteur de mails du compte : au moins 3 de moins (' + etat.data.mailsPossibles + ' avant, ' + etatFin.mailsPossibles + ' après)', partis >= 3, partis);
  console.log(echecs ? '\n' + echecs + ' vérification(s) en échec' : '\nTout est bon. À regarder à la main dans le Drive de TEST : le PDF « RÉCAPITULATIF DES NOTES - ' + CHANTIER + '.pdf » (présentation).');
  if (echecs) process.exitCode = 1;
})().catch(async e => { console.log('\nARRÊT : ' + e.message); await ranger(); process.exitCode = 1; });
