// Lot 3 — essais contre le VRAI serveur de la copie TEST, par la porte de service : node tests/reel-lot3.js
// (lancé par Claude, après un envoi « --avec-porte » ; ce n'est PAS un test automatique de la série : il parle à Google)
//
// Garde-fous avant d'écrire quoi que ce soit :
//   - la porte répond, l'environnement est bien TEST, le serveur est en v8.0 ;
//   - le Drive visé est celui de TEST, et le chantier d'essai existe.
// Aucun mail n'est envoyé (la liste d'un chantier n'en envoie pas) : le nombre de mails possibles est contrôlé avant et après.
// Les éléments d'essai sont écrits par les comptes d'essai sur « CHANTIER TEST AUTO » ; comme on ne supprime plus rien dans
// l'appli, ils sont retirés à la fin par la porte (purgerNotesEssai : seulement les lignes « fiche-auto-… »).
// Aucun secret n'est affiché : la clé et les jetons de session restent dans _prive/.
'use strict';
const porte = require('../outils/porte.js');
const { deploiementTest } = require('../outils/envoyer-test.js');
const { assembler } = require('../outils/construire.js');

const URL_TEST = deploiementTest().url;
const CHANTIER = 'CHANTIER TEST AUTO';
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
const graine = Date.now().toString(36);
const numero = suffixe => 'fiche-auto-' + graine + '-' + suffixe;
const element = texte => ({ type: 'note-chantier', chantier: CHANTIER, texte: texte });
const action = (idNote, g, extra) => Object.assign({ type: 'note-action', chantier: CHANTIER, note: idNote, geste: g }, extra || {});
const fiche = (jeton, qui, id, donnees) => poster({ action: 'fiche', id: id, jeton: jeton, saisiPar: qui, donnees: donnees });
const court = x => JSON.stringify(x).slice(0, 450);
const lire = (jeton, extra) => poster(Object.assign({ action: 'notes', jeton: jeton, chantier: CHANTIER }, extra || {}));
const miens = liste => (liste || []).filter(n => /ESSAI AUTOMATIQUE/.test(n.texte));

(async () => {
  const d = new Date();
  console.log('Lot 3 — essais réels sur la copie TEST (' + d.toLocaleString('fr-FR') + ')');
  // ── Garde-fous ──
  const etat = await geste('etat');
  if (!etat.ok) throw new Error('la porte de service ne répond pas (' + (etat.code || '') + ') : envoyer d’abord le serveur « --avec-porte »');
  verifier('la porte répond, environnement TEST, serveur ' + etat.data.version + ' (empreinte ' + etat.data.empreinte + ')', etat.data.environnement === 'TEST' && etat.data.version === 'v8.0', court(etat.data));
  if (etat.data.environnement !== 'TEST' || etat.data.version !== 'v8.0') throw new Error('environnement ou version inattendus : essais annulés');
  // Constaté le 13/11/2026 : pendant une minute environ après un envoi, Google sert encore certaines demandes avec l'ANCIEN
  // serveur (qui a alors « installé » les onglets de l'ancienne version). On n'écrit rien tant que le serveur attendu
  // n'a pas répondu 6 fois de suite.
  const attendue = assembler(true).empreinte;
  let suite = 0;
  for (let essai = 0; essai < 40 && suite < 6; essai++) {
    const e = await geste('etat');
    if (e.ok && e.data.empreinte === attendue) suite++;
    else { suite = 0; await new Promise(r => setTimeout(r, 15000)); }
  }
  verifier('le serveur attendu (empreinte ' + attendue + ') répond 6 fois de suite : l’ancien n’est plus servi', suite >= 6, 'empreinte lue : ' + etat.data.empreinte);
  if (suite < 6) throw new Error('le serveur en ligne n’est pas celui de cette branche : refaire l’envoi « --avec-porte », ou attendre');
  // Les onglets laissés par la première version du lot 3 sont renommés (rien n'est effacé), puis le lot est installé
  const range = await geste('rangerAnciennesNotes');
  verifier('onglets des notes de la première version rangés (renommés avec la date, rien d’effacé)', range.ok, court(range));
  console.log('    renommés : ' + JSON.stringify((range.data || {}).renommes));
  const inst = await geste('installerLot3');
  verifier('installation du lot 3 sur TEST (onglets Notes, Notes historique, Notes vues)', inst.ok, inst.message);
  const pc = await geste('preparerComptes'), ch = await geste('preparerChantier');
  verifier('comptes et chantier d’essai prêts', pc.ok && ch.ok, court([pc, ch]));
  const titres = await geste('titresNotes');
  const bons = (titres.data || []).filter(o => ['Notes', 'Notes historique', 'Notes vues'].indexOf(o.onglet) > -1);
  verifier('les trois onglets des notes ont les bons titres, contrôlés sur le vrai Sheets', titres.ok && bons.length === 3 && bons.every(o => o.bons === true),
    court((titres.data || []).map(o => [o.onglet, o.colonnes, o.bons])));
  if (!range.ok || !inst.ok || !pc.ok || !ch.ok || !(bons.length === 3 && bons.every(o => o.bons === true))) throw new Error('préparatifs incomplets : aucun élément d’essai n’est écrit');
  const dest = (await geste('destinatairesEssai')).data;
  if (!dest.racineDriveNommeeTest) throw new Error('le dossier Drive de ce serveur ne s’appelle pas « … TEST … » : essais annulés');
  if (!dest.chantierEssaiPresent) throw new Error('le chantier d’essai est absent de la copie TEST : essais annulés');
  // Où le serveur range les documents du chantier d'essai (question du PDF introuvable) : lecture seule
  const dossier = await geste('dossierChantierEssai');
  console.log('    dossier Drive du chantier d’essai : ' + JSON.stringify(dossier.ok ? dossier.data : dossier.message));

  // ── Droits : un poseur sans la case du chantier ne lit ni n'écrit ──
  let jPoseur = await session('auto-poseur');
  const tc = await geste('traiterComptes');
  const sansCase = await geste('accesChantier', { id: 'auto-poseur', valeur: false });
  verifier('case du chantier d’essai décochée pour le poseur d’essai', tc.ok && sansCase.ok, court([tc, sansCase]));
  const refusLecture = await lire(jPoseur);
  const refusEcriture = await fiche(jPoseur, 'auto-poseur', numero('x'), element('ESSAI AUTOMATIQUE refusé'));
  verifier('poseur sans accès au chantier : lecture refusée, ajout refusé pour de bon', refusLecture.code === 'INTERDIT' && refusEcriture.code === 'DONNEES_INVALIDES', court([refusLecture, refusEcriture]));
  const avecCase = await geste('accesChantier', { id: 'auto-poseur', valeur: true });
  verifier('case du chantier d’essai cochée pour le poseur d’essai', avecCase.ok, court(avecCase));

  // ── Trois éléments ajoutés par le poseur ──
  const id1 = numero('a'), id2 = numero('b'), id3 = numero('c');
  const r1 = await fiche(jPoseur, 'auto-poseur', id1, element('ESSAI AUTOMATIQUE 1 — cales de 5'));
  verifier('élément ajouté : « Enregistré », aucun mail', r1.ok && r1.code === 'ENREGISTRE' && r1.message === 'Enregistré', court(r1));
  const r1b = await fiche(jPoseur, 'auto-poseur', id1, element('ESSAI AUTOMATIQUE 1 — cales de 5'));
  verifier('le même élément renvoyé : « déjà reçu »', r1b.code === 'DEJA_RECU', court(r1b));
  const env = await geste('lireEnvois', { n: 4 });
  const envoi = (env.data.lignes || []).find(l => l[0] === id1) || [];
  verifier('une ligne dans l’onglet Envois : note-chantier, « traité »', envoi[2] === 'note-chantier' && envoi[3] === 'traité', court(envoi));
  // un texte qui commence par « + », et un texte « 12/11 » collé sur deux lignes
  const r2 = await fiche(jPoseur, 'auto-poseur', id2, element('+2 cales au R+1 — ESSAI AUTOMATIQUE 2'));
  const r3 = await fiche(jPoseur, 'auto-poseur', id3, element('12/11\nESSAI AUTOMATIQUE 3 sur deux lignes'));
  verifier('deux autres éléments ajoutés', r2.ok && r3.ok, court([r2, r3]));

  const luP = await lire(jPoseur);
  const aFaire = miens((luP.data || {}).aFaire);
  verifier('le poseur relit la liste : ses trois éléments, dans l’ordre d’ajout', luP.ok && aFaire.map(n => n.id).join() === [id1, id2, id3].join(), court(aFaire));
  verifier('un texte qui commence par « + » revient sans apostrophe', (aFaire[1] || {}).texte === '+2 cales au R+1 — ESSAI AUTOMATIQUE 2', court((aFaire[1] || {}).texte));
  verifier('un texte « 12/11 » collé sur deux lignes revient sur une seule ligne, pas transformé en date', (aFaire[2] || {}).texte === '12/11 ESSAI AUTOMATIQUE 3 sur deux lignes', court((aFaire[2] || {}).texte));
  verifier('la réponse ne contient ni auteur, ni date : seulement numéro, texte, fait, nouveau', aFaire.every(n => Object.keys(n).sort().join() === 'fait,id,nouveau,texte'), court(aFaire[0]));

  // ── Gestes : cocher, modification libre par quelqu'un d'autre, décocher ──
  const g1 = await fiche(jPoseur, 'auto-poseur', numero('g1'), action(id1, 'fait'));
  const jCond = await session('auto-conducteur');
  const luC = await lire(jCond);
  const cAFaire = miens(luC.data.aFaire), cTermines = miens(luC.data.termines);
  verifier('coché par le poseur : pour le conducteur, il est dans « terminés », les deux autres sont « nouveaux »', g1.ok && luC.ok && cTermines.map(n => n.id).join() === id1
    && cAFaire.map(n => n.id).join() === [id2, id3].join() && cAFaire.every(n => n.nouveau === true) && luC.data.nbTermines >= 1, court([cAFaire, cTermines, luC.data.nbTermines]));
  const nouv1 = await poster({ action: 'notesNouvelles', jeton: jCond });
  const vues = await poster({ action: 'notesVues', jeton: jCond, chantier: CHANTIER, jusqua: luC.data.heure });
  const nouv2 = await poster({ action: 'notesNouvelles', jeton: jCond });
  verifier('chiffre rouge du conducteur : compté, puis à zéro pour ce chantier après sa visite', nouv1.ok && (nouv1.data.parChantier[CHANTIER] || 0) >= 2 && vues.ok
    && !(nouv2.data.parChantier[CHANTIER]), court([nouv1.data, vues, nouv2.data]));
  // le conducteur corrige l'élément du poseur ; puis arrive une correction du poseur écrite sur l'ancien texte (hors réseau)
  const g2 = await fiche(jCond, 'auto-conducteur', numero('g2'), action(id2, 'modifier', { texte: 'ESSAI AUTOMATIQUE 2 — corrigé par le conducteur', vu: '+2 cales au R+1 — ESSAI AUTOMATIQUE 2' }));
  jPoseur = await session('auto-poseur');
  const g3 = await fiche(jPoseur, 'auto-poseur', numero('g3'), action(id2, 'modifier', { texte: 'ESSAI AUTOMATIQUE 2 — corrigé par le poseur (hors réseau)', vu: '+2 cales au R+1 — ESSAI AUTOMATIQUE 2' }));
  const g4 = await fiche(jPoseur, 'auto-poseur', numero('g4'), action(id1, 'defaire'));
  const apres = await lire(jPoseur);
  const liste = miens(apres.data.aFaire);
  verifier('modification libre par un autre, puis la dernière reçue gagne, sans mention à l’écran ; décoché : l’élément reprend sa place', g2.ok && g3.ok && g4.ok
    && liste.map(n => n.id).join() === [id1, id2, id3].join() && liste[1].texte === 'ESSAI AUTOMATIQUE 2 — corrigé par le poseur (hors réseau)'
    && Object.keys(liste[1]).length === 4 && !miens(apres.data.termines).length, court(liste));
  const refusVide = await fiche(jPoseur, 'auto-poseur', numero('g5'), action(id3, 'modifier', { texte: '   ' }));
  const refusSuppr = await fiche(jPoseur, 'auto-poseur', numero('g6'), action(id3, 'supprimer'));
  const refusTous = await poster({ action: 'notes', jeton: jPoseur });
  verifier('pas de suppression : texte vide refusé, geste « supprimer » inconnu ; vue « Tous chantiers » refusée au poseur', refusVide.code === 'DONNEES_INVALIDES' && refusSuppr.code === 'DONNEES_INVALIDES'
    && refusTous.code === 'INTERDIT', court([refusVide, refusSuppr, refusTous]));
  const retire = await Promise.all(['notePhoto', 'noteHistorique', 'notesPdf'].map(a => poster({ action: a, jeton: jPoseur, note: id1, rang: 1, chantier: CHANTIER })));
  verifier('ce qui a été retiré n’existe plus sur le serveur (photo, historique visible, PDF)', retire.every(x => x.code === 'ACTION_INCONNUE'), court(retire));

  // ── Vue « Tous chantiers » du conducteur ──
  const jCond2 = await session('auto-conducteur');
  const tous = await poster({ action: 'notes', jeton: jCond2, recherche: 'sur deux lignes' });
  verifier('vue « Tous chantiers » du conducteur : recherche faite par le serveur, chaque élément porte son chantier', tous.ok && tous.data.aFaire.some(n => n.id === id3 && n.chantier === CHANTIER)
    && !tous.data.aFaire.some(n => n.id === id1), court((tous.data || {}).aFaire));
  const sans = await poster({ action: 'notes', chantier: CHANTIER });
  const sansAjout = await poster({ action: 'fiche', id: numero('y'), donnees: element('ESSAI AUTOMATIQUE sans compte') });
  verifier('sans compte : lecture refusée, et un ajout attend la connexion (jamais enregistré sans auteur)', sans.code === 'CONNEXION_REQUISE' && sansAjout.code === 'CONNEXION_REQUISE', court([sans, sansAjout]));

  // ── Rangement : les éléments d'essai sont retirés de la copie TEST par la porte (l'appli ne supprime rien) ──
  const purge = await geste('purgerNotesEssai');
  // 3 lignes dans Notes ; dans l'historique : 3 créations + coché + 2 modifications + décoché = 7 (davantage s'il restait
  // des lignes d'un passage interrompu)
  verifier('éléments des essais retirés de la copie TEST : au moins 3 lignes de Notes et 7 lignes d’historique', purge.ok && purge.data.lignesRetirees >= 10, court(purge));
  const reste = miens((await lire(jCond2)).data.aFaire).length;
  verifier('la liste du chantier d’essai ne contient plus rien de ces essais', reste === 0, String(reste));
  await geste('accesChantier', { id: 'auto-poseur', valeur: false });
  const fin = await geste('fermerSessions');
  verifier('sessions d’essai fermées, comptes d’essai désactivés', fin.ok, court(fin));
  await geste('retirerDeclencheurs');   // le déclencheur de fin d'essai automatique n'a plus lieu d'être
  const etatFin = (await geste('etat')).data;
  verifier('copie TEST en ordre : aucun déclencheur d’essai, transition intacte', !(etatFin.declencheurs || []).length && etatFin.transitionARetablir === false, court(etatFin));
  verifier('aucun mail envoyé par ces essais', etatFin.mailsPossibles === etat.data.mailsPossibles, etat.data.mailsPossibles + ' avant, ' + etatFin.mailsPossibles + ' après');
  console.log('\n' + (resultats.length - echecs) + ' vérification(s) réussie(s) sur ' + resultats.length + (echecs ? ' — DES ESSAIS ÉCHOUENT' : ''));
  if (echecs) process.exitCode = 1;
})().catch(async e => {
  console.error('❌ ' + e.message);
  try { await geste('purgerNotesEssai'); await geste('accesChantier', { id: 'auto-poseur', valeur: false }); await geste('fermerSessions'); await geste('retirerDeclencheurs'); } catch (x) {}
  process.exit(1);
});
