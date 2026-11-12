// Lot 7 — essais contre le VRAI serveur de la copie TEST, par la porte de service : node tests/reel-lot7.js
// (lancé par Claude, après un envoi « --avec-porte » ; ce n'est PAS un test automatique de la série : il parle à Google)
//
// Garde-fous avant d'envoyer quoi que ce soit :
//   - la porte répond, et l'environnement est bien TEST ;
//   - il reste au moins 40 mails possibles aujourd'hui (quota partagé avec la production) ;
//   - le Drive visé est celui de TEST, et le chantier d'essai n'a pas pour conducteur une autre personne que Franck ;
//   - l'essai « Prévenir l'atelier » n'est joué QUE si tous les chefs d'atelier de la copie TEST portent l'adresse de
//     Franck : sinon un vrai chef d'atelier recevrait un mail d'essai.
// Mails envoyés : 1 (sans atelier), 2 au plus avec l'essai atelier — tous à l'adresse de Franck.
// Aucun secret n'est affiché : la clé et les jetons de session restent dans _prive/.
'use strict';
const porte = require('../outils/porte.js');
const { deploiementTest } = require('../outils/envoyer-test.js');

const URL_TEST = deploiementTest().url;
const CHANTIER = 'CHANTIER TEST AUTO';
const resultats = [];
let echecs = 0;
function verifier(nom, cond, detail) {
  resultats.push((cond ? '  ✓ ' : '  ✗ ') + nom + (cond || detail === undefined ? '' : '\n      ' + String(detail).slice(0, 400)));
  if (!cond) echecs++;
  console.log(resultats[resultats.length - 1]);
}
async function poster(corps) {
  const r = await fetch(URL_TEST, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(corps), signal: AbortSignal.timeout(150000) });
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
const HEURE = deux(maintenant.getHours()) + 'h' + deux(maintenant.getMinutes());
const numero = suffixe => 'fiche-auto-' + Date.now().toString(36) + '-' + suffixe;
const signalement = extra => Object.assign({ type: 'signalement', chantier: CHANTIER, date: DATE, heure: HEURE, type_signalement: 'Casse', urgence: 'Pas urgent',
  repere: 'ESSAI AUTOMATIQUE', commentaire: 'Essai automatique du lot 7 (outillage) — à ignorer', atelier: false, photosBase64: [] }, extra || {});

(async () => {
  console.log('Lot 7 — essais réels sur la copie TEST (' + DATE + ' ' + HEURE + ')');
  // ── Garde-fous ──
  const etat = await geste('etat');
  if (!etat.ok) throw new Error('la porte de service ne répond pas (' + (etat.code || '') + ') : envoyer d’abord le serveur « --avec-porte »');
  verifier('la porte répond, environnement TEST, serveur ' + etat.data.version + ' (empreinte ' + etat.data.empreinte + ')', etat.data.environnement === 'TEST');
  if (etat.data.environnement !== 'TEST') throw new Error('environnement inattendu');
  if (etat.data.mailsPossibles < 40) throw new Error('moins de 40 mails possibles aujourd’hui (' + etat.data.mailsPossibles + ') : essais reportés');
  verifier('installation du lot 7 sur TEST', (await geste('installerLot7')).ok);
  const pc = await geste('preparerComptes'), ch = await geste('preparerChantier');
  verifier('comptes et chantier d’essai prêts', pc.ok && ch.ok, JSON.stringify([pc, ch]));
  const dest = (await geste('destinatairesEssai')).data;
  console.log('    destinataires d’un essai : ' + JSON.stringify(dest));
  if (!dest.racineDriveNommeeTest) throw new Error('le dossier Drive de ce serveur ne s’appelle pas « … TEST … » : essais annulés');
  if (dest.conducteurChantierEssai === 'AUTRE PERSONNE') throw new Error('le chantier d’essai a pour conducteur une autre personne que Franck : essais annulés');

  // ── Un signalement, envoyé par le poseur d'essai ──
  const jPoseur = await session('auto-poseur');
  const id1 = numero('a');
  const r1 = await poster({ action: 'fiche', id: id1, jeton: jPoseur, donnees: signalement() });
  verifier('signalement reçu : enregistré, 1 mail envoyé', r1.ok && r1.code === 'ENREGISTRE' && r1.data.envoyes === 1 && r1.data.reportes === 0, JSON.stringify(r1));
  const lu = await geste('lireSignalements', { n: 3 });
  const ligne = (lu.data.lignes || []).find(l => l[0] === id1) || [];
  verifier('une ligne dans l’onglet Signalements : auteur vérifié, « À traiter », mail « envoyé »',
    ligne[2] === 'auto-poseur' && ligne[3] === 'Casse' && ligne[4] === 'Pas urgent' && ligne[6] === 'Non' && ligne[7] === 'À traiter' && ligne[8] === 'envoyé', JSON.stringify(ligne));
  const env = await geste('lireEnvois', { n: 3 });
  const envoi = (env.data.lignes || []).find(l => l[0] === id1) || [];
  verifier('une ligne dans l’onglet Envois : signalement, « traité »', envoi[2] === 'signalement' && envoi[3] === 'traité', JSON.stringify(envoi));
  const r1b = await poster({ action: 'fiche', id: id1, jeton: jPoseur, donnees: signalement() });
  verifier('le même numéro renvoyé : « déjà reçu », pas de 2e ligne', r1b.code === 'DEJA_RECU'
    && ((await geste('lireSignalements', { n: 5 })).data.lignes || []).filter(l => l[0] === id1).length === 1, JSON.stringify(r1b));
  const r2 = await poster({ action: 'fiche', id: numero('b'), jeton: jPoseur, donnees: signalement({ type_signalement: 'Vol' }) });
  verifier('données invalides : refus définitif', r2.ok === false && r2.code === 'DONNEES_INVALIDES', JSON.stringify(r2));

  // ── Suivi : qui voit quoi, qui change le statut ──
  const vuP = await poster({ action: 'signalements', jeton: jPoseur, chantier: CHANTIER });
  verifier('le poseur voit le sien, ne peut pas changer le statut', vuP.ok && vuP.data.peutChanger === false && vuP.data.signalements.some(s => s.id === id1)
    && vuP.data.signalements.every(s => s.mien === true), JSON.stringify(vuP).slice(0, 300));
  const stP = await poster({ action: 'signalementStatut', jeton: jPoseur, id: id1, statut: 'Clos' });
  verifier('le poseur ne peut pas changer le statut', stP.ok === false && stP.code === 'INTERDIT', JSON.stringify(stP));
  const jCond = await session('auto-conducteur');
  const vuC = await poster({ action: 'signalements', jeton: jCond, chantier: CHANTIER });
  verifier('le conducteur le voit et peut changer le statut', vuC.ok && vuC.data.peutChanger === true && vuC.data.signalements.some(s => s.id === id1 && s.mien === false), JSON.stringify(vuC).slice(0, 300));
  const stC = await poster({ action: 'signalementStatut', jeton: jCond, id: id1, statut: 'Commandé' });
  verifier('le conducteur passe le statut à « Commandé »', stC.ok && stC.data.statut === 'Commandé', JSON.stringify(stC));
  const jAt = await session('auto-atelier');
  const vuA = await poster({ action: 'signalements', jeton: jAt, chantier: CHANTIER });
  verifier('l’atelier le voit, statut « Commandé », et peut le changer', vuA.ok && vuA.data.peutChanger === true && vuA.data.signalements.some(s => s.id === id1 && s.statut === 'Commandé'), JSON.stringify(vuA).slice(0, 300));
  const stA = await poster({ action: 'signalementStatut', jeton: jAt, id: id1, statut: 'Clos' });
  verifier('l’atelier le clôt ; il disparaît de la liste « en cours »', stA.ok
    && !(await poster({ action: 'signalements', jeton: jAt, chantier: CHANTIER })).data.signalements.some(s => s.id === id1), JSON.stringify(stA));
  const sans = await poster({ action: 'signalements' });
  verifier('sans compte : la liste est refusée', sans.ok === false && sans.code === 'CONNEXION_REQUISE', JSON.stringify(sans));

  // ── Avec « Prévenir l'atelier » : seulement si le chef d'atelier de TEST est Franck ──
  if (dest.chefsAtelierSontFranck) {
    const id3 = numero('c');
    const r3 = await poster({ action: 'fiche', id: id3, jeton: await session('auto-poseur'), donnees: signalement({ atelier: true, type_signalement: 'À recommander' }) });
    verifier('avec « Prévenir l’atelier » : enregistré, mail(s) envoyé(s) à Franck', r3.ok && r3.data.envoyes >= 1, JSON.stringify(r3));
    const l3 = ((await geste('lireSignalements', { n: 3 })).data.lignes || []).find(l => l[0] === id3) || [];
    verifier('… la ligne dit « atelier prévenu : Oui »', l3[6] === 'Oui', JSON.stringify(l3));
    await poster({ action: 'signalementStatut', jeton: await session('auto-conducteur'), id: id3, statut: 'Clos' });
  } else {
    console.log('    (essai « Prévenir l’atelier » NON joué : ' + (dest.chefsAtelier ? 'un chef d’atelier de la copie TEST n’a pas l’adresse de Franck' : 'aucun chef d’atelier dans la copie TEST') + ')');
  }

  // ── Rangement ──
  const fin = await geste('fermerSessions');
  verifier('sessions d’essai fermées, comptes d’essai désactivés', fin.ok, JSON.stringify(fin));
  const etatFin = (await geste('etat')).data;
  verifier('copie TEST en ordre : aucun déclencheur d’essai, transition intacte', !(etatFin.declencheurs || []).length && etatFin.transitionARetablir === false, JSON.stringify(etatFin));
  console.log('    mails possibles : ' + etat.data.mailsPossibles + ' avant, ' + etatFin.mailsPossibles + ' après');
  console.log('\n' + (resultats.length - echecs) + ' vérification(s) réussie(s) sur ' + resultats.length + (echecs ? ' — DES ESSAIS ÉCHOUENT' : ''));
  if (echecs) process.exitCode = 1;
})().catch(async e => {
  console.error('❌ ' + e.message);
  try { await geste('fermerSessions'); } catch (x) {}
  process.exit(1);
});
