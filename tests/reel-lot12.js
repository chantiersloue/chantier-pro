// Lot 12 — essais contre le VRAI serveur de la copie TEST, par la porte de service : node tests/reel-lot12.js
// (lancé par Claude, après un envoi « --avec-porte » de la branche du lot 12 ; ce n'est PAS un test automatique de la série :
// il parle à Google. Ne jamais le lancer contre la production : il ne connaît que l'adresse de la copie TEST.)
//
// Ce qu'il vérifie, et que le faux Google des autres tests ne peut pas prouver : la VRAIE case à cocher du vrai Sheet.
//   - réglage éteint : un compte de poseur d'essai ne voit et ne lit que ses chantiers cochés ;
//   - réglage allumé : il voit tous les chantiers et lit ceux qui ne sont pas les siens, tout de suite ;
//   - réglage éteint de nouveau : tout redevient comme avant, tout de suite ;
//   - le passage de 10 minutes écrit l'état dans l'onglet Réglages.
// AUCUN MAIL n'est envoyé. Rien n'est écrit dans Drive. Le réglage est remis comme il était trouvé.
// Aucun secret n'est affiché, ni aucun nom de chantier : la clé et les jetons de session restent dans _prive/.
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
const court = x => JSON.stringify(x).slice(0, 300);
let initial = null;
const ranger = async () => {
  try { if (initial !== null) await geste('reglerTousChantiers', { valeur: initial }); await geste('fermerSessions'); await geste('retirerDeclencheurs'); } catch (x) {}
};
// Les quatre lectures « par chantier », sans jamais afficher de nom : vrai = le serveur accepte
async function lectures(jeton, chantier) {
  const r = {};
  for (const action of ['notes', 'carnet', 'dossiers', 'recapNotes']) r[action] = (await poster({ action: action, chantier: chantier, jeton: jeton })).ok === true;
  return r;
}
const toutes = (r, v) => Object.keys(r).every(k => r[k] === v);

(async () => {
  console.log('Lot 12 — essais réels sur la copie TEST (' + new Date().toLocaleString('fr-FR') + ')');
  // ── Garde-fous ──
  const etat = await geste('etat');
  if (!etat.ok) throw new Error('la porte de service ne répond pas (' + (etat.code || '') + ') : envoyer d’abord le serveur « --avec-porte »');
  verifier('la porte répond, environnement TEST, serveur ' + etat.data.version + ' (empreinte ' + etat.data.empreinte + ')', etat.data.environnement === 'TEST' && etat.data.version === VERSION, court(etat.data));
  if (etat.data.environnement !== 'TEST' || etat.data.version !== VERSION) throw new Error('environnement ou version inattendus : essais annulés');
  const attendue = assembler(true).empreinte;
  let suite = 0;
  for (let essai = 0; essai < 40 && suite < 6; essai++) {
    const e = await geste('etat');
    if (e.ok && e.data.empreinte === attendue) suite++;
    else { suite = 0; await new Promise(r => setTimeout(r, 15000)); }
  }
  verifier('le serveur de cette branche (empreinte ' + attendue + ') répond 6 fois de suite', suite >= 6, 'empreinte lue : ' + etat.data.empreinte);
  if (suite < 6) throw new Error('le serveur en ligne n’est pas celui de cette branche : refaire l’envoi « --avec-porte », ou attendre');
  const inst = await geste('installerLot12');
  verifier('installation du lot 12 sur TEST (onglet Réglages)', inst.ok, inst.message);
  const pc = await geste('preparerComptes'), ch = await geste('preparerChantier');
  verifier('comptes et chantier d’essai prêts', pc.ok && ch.ok, court([pc, ch]));
  if (!inst.ok || !pc.ok || !ch.ok) throw new Error('préparatifs incomplets : essais annulés');
  const lu = await geste('reglerTousChantiers');
  if (!lu.ok) throw new Error('réglage illisible : ' + lu.message);
  initial = lu.data.avant;
  console.log('    réglage trouvé : ' + (initial ? 'allumé' : 'éteint') + ' (il sera remis ainsi à la fin)');

  // ── Un chantier qui n'est PAS celui du poseur d'essai, choisi dans la liste d'un compte qui voit tout ──
  const admin = await session('auto-admin');
  const tout = await poster({ action: 'moi', jeton: admin });
  const tous = ((tout.data || {}).chantiers || []);
  const autre = tous.find(c => c.nom !== CHANTIER && String(c.statut || '').trim() !== 'Terminé');
  verifier('la copie TEST a au moins un autre chantier en cours que le chantier d’essai (' + tous.length + ' chantiers)', !!autre, tous.length);
  if (!autre) throw new Error('aucun autre chantier sur la copie TEST : essais annulés');
  await geste('accesChantier', { id: 'auto-poseur', valeur: true });
  const poseur = await session('auto-poseur');

  // ── Éteint ──
  await geste('reglerTousChantiers', { valeur: false });
  const m0 = await poster({ action: 'moi', jeton: poseur });
  const l0 = await lectures(poseur, autre.nom);
  verifier('ÉTEINT : le poseur d’essai ne voit que ses chantiers cochés (' + ((m0.data || {}).chantiers || []).length + ' sur ' + tous.length + '), jamais l’autre chantier',
    m0.ok && m0.data.chantiers.length < tous.length && !m0.data.chantiers.some(c => c.nom === autre.nom), (m0.data || {}).chantiers && m0.data.chantiers.length);
  verifier('ÉTEINT : notes, carnet, documents et récapitulatif de l’autre chantier sont refusés', toutes(l0, false), court(l0));
  verifier('ÉTEINT : son propre chantier d’essai reste lisible', toutes(await lectures(poseur, CHANTIER), true));

  // ── Allumé : tout de suite ──
  const on = await geste('reglerTousChantiers', { valeur: true });
  const m1 = await poster({ action: 'moi', jeton: poseur });
  const l1 = await lectures(poseur, autre.nom);
  verifier('VRAIE CASE COCHÉE : le poseur d’essai voit tous les chantiers (' + ((m1.data || {}).chantiers || []).length + '), tout de suite', on.ok && m1.ok && m1.data.chantiers.length === tous.length, court([on, (m1.data || {}).chantiers && m1.data.chantiers.length]));
  verifier('ALLUMÉ : notes, carnet, documents et récapitulatif de l’autre chantier s’ouvrent', toutes(l1, true), court(l1));
  verifier('ALLUMÉ : son profil ne change pas (il n’est pas « tous chantiers »)', m1.ok && m1.data.profil.tous === false, court((m1.data || {}).profil));
  const sans = await poster({ action: 'notes', chantier: autre.nom });
  verifier('ALLUMÉ : sans compte, toujours refusé', sans.ok === false, court(sans));
  const inconnu = await lectures(poseur, 'CHANTIER QUI N’EXISTE PAS ' + Date.now());
  verifier('ALLUMÉ : un chantier inconnu reste refusé', toutes(inconnu, false), court(inconnu));
  const passage = await geste('traiterComptes');
  const etatOn = await geste('reglerTousChantiers');
  verifier('le passage écrit l’état dans l’onglet Réglages (« Allumé depuis le … »)', passage.ok && /^Allumé depuis le /.test((etatOn.data || {}).etat || ''), court(etatOn.data));

  // ── Éteint de nouveau : tout de suite ──
  await geste('reglerTousChantiers', { valeur: false });
  const l2 = await lectures(poseur, autre.nom);
  const m2 = await poster({ action: 'moi', jeton: poseur });
  verifier('VRAIE CASE DÉCOCHÉE : tout redevient comme avant, tout de suite', toutes(l2, false) && m2.ok && m2.data.chantiers.length === m0.data.chantiers.length, court([l2, (m2.data || {}).chantiers && m2.data.chantiers.length]));
  await geste('traiterComptes');
  const etatOff = await geste('reglerTousChantiers');
  verifier('… et l’état dit « Éteint depuis le … »', /^Éteint depuis le /.test((etatOff.data || {}).etat || ''), court(etatOff.data));

  // ── Rangement ──
  const remis = await geste('reglerTousChantiers', { valeur: initial });
  verifier('le réglage est remis comme il a été trouvé (' + (initial ? 'allumé' : 'éteint') + ')', remis.ok && remis.data.maintenant === initial, court(remis));
  initial = null;
  const fin = await geste('fermerSessions');
  verifier('sessions d’essai fermées, comptes d’essai désactivés', fin.ok, court(fin));
  await geste('retirerDeclencheurs');
  const etatFin = (await geste('etat')).data;
  verifier('copie TEST en ordre : aucun déclencheur d’essai, transition intacte', !(etatFin.declencheurs || []).length && etatFin.transitionARetablir === false, court(etatFin));
  verifier('aucun mail envoyé par cet essai (compteur du compte : ' + etat.data.mailsPossibles + ' avant, ' + etatFin.mailsPossibles + ' après)', etatFin.mailsPossibles >= etat.data.mailsPossibles, etatFin.mailsPossibles);
  console.log(echecs ? '\n' + echecs + ' vérification(s) en échec' : '\nTout est bon.');
  if (echecs) process.exitCode = 1;
})().catch(async e => { console.log('\nARRÊT : ' + e.message); await ranger(); process.exitCode = 1; });
