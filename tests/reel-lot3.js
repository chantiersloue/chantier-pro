// Lot 3 — essais contre le VRAI serveur de la copie TEST, par la porte de service : node tests/reel-lot3.js
// (lancé par Claude, après un envoi « --avec-porte » ; ce n'est PAS un test automatique de la série : il parle à Google)
//
// Garde-fous avant d'écrire quoi que ce soit :
//   - la porte répond, et l'environnement est bien TEST ;
//   - le Drive visé est celui de TEST, et le chantier d'essai existe.
// Aucun mail n'est envoyé (les notes n'en envoient pas) : le nombre de mails possibles est contrôlé avant et après.
// Les notes d'essai sont écrites par les comptes d'essai sur « CHANTIER TEST AUTO », puis mises à la corbeille.
// Aucun secret n'est affiché : la clé et les jetons de session restent dans _prive/.
'use strict';
const zlib = require('zlib');
const porte = require('../outils/porte.js');
const { deploiementTest } = require('../outils/envoyer-test.js');

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
// Une vraie petite image PNG (un rectangle gris de 320 × 240) : le convertisseur PDF de Google doit pouvoir la dessiner
function png(w, h) {
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = b => { let c = 0xFFFFFFFF; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const bloc = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([Buffer.from(t), d]))); return Buffer.concat([l, Buffer.from(t), d, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const ligne = Buffer.alloc(1 + 3 * w, 120); ligne[0] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), bloc('IHDR', ihdr),
    bloc('IDAT', zlib.deflateSync(Buffer.concat(Array.from({ length: h }, () => ligne)))), bloc('IEND', Buffer.alloc(0))]);
}
const PHOTO = png(320, 240).toString('base64');
const maintenant = new Date(), deux = n => String(n).padStart(2, '0');
const DATE = deux(maintenant.getDate()) + '/' + deux(maintenant.getMonth() + 1) + '/' + maintenant.getFullYear();
const HEURE = deux(maintenant.getHours()) + 'h' + deux(maintenant.getMinutes());
const graine = Date.now().toString(36);
const numero = suffixe => 'fiche-auto-' + graine + '-' + suffixe;
const note = extra => Object.assign({ type: 'note-chantier', chantier: CHANTIER, date: DATE, heure: HEURE, texte: 'ESSAI AUTOMATIQUE du lot 3 — à ignorer', photos: [] }, extra || {});
const action = (idNote, g, extra) => Object.assign({ type: 'note-action', chantier: CHANTIER, note: idNote, geste: g }, extra || {});
const fiche = (jeton, qui, id, donnees) => poster({ action: 'fiche', id: id, jeton: jeton, saisiPar: qui, donnees: donnees });
const court = x => JSON.stringify(x).slice(0, 400);

(async () => {
  console.log('Lot 3 — essais réels sur la copie TEST (' + DATE + ' ' + HEURE + ')');
  // ── Garde-fous ──
  const etat = await geste('etat');
  if (!etat.ok) throw new Error('la porte de service ne répond pas (' + (etat.code || '') + ') : envoyer d’abord le serveur « --avec-porte »');
  verifier('la porte répond, environnement TEST, serveur ' + etat.data.version + ' (empreinte ' + etat.data.empreinte + ')', etat.data.environnement === 'TEST' && etat.data.version === 'v8.0', court(etat.data));
  if (etat.data.environnement !== 'TEST' || etat.data.version !== 'v8.0') throw new Error('environnement ou version inattendus : essais annulés');
  const inst = await geste('installerLot3');
  verifier('installation du lot 3 sur TEST (onglets Notes, Notes historique, Notes vues)', inst.ok, inst.message);
  const pc = await geste('preparerComptes'), ch = await geste('preparerChantier');
  verifier('comptes et chantier d’essai prêts', pc.ok && ch.ok, court([pc, ch]));
  if (!inst.ok || !pc.ok || !ch.ok) throw new Error('préparatifs incomplets : aucune note d’essai n’est écrite');
  const dest = (await geste('destinatairesEssai')).data;
  if (!dest.racineDriveNommeeTest) throw new Error('le dossier Drive de ce serveur ne s’appelle pas « … TEST … » : essais annulés');
  if (!dest.chantierEssaiPresent) throw new Error('le chantier d’essai est absent de la copie TEST : essais annulés');

  // ── Droits : un poseur sans la case du chantier ne lit ni n'écrit ──
  let jPoseur = await session('auto-poseur');
  const tc = await geste('traiterComptes');
  const sansCase = await geste('accesChantier', { id: 'auto-poseur', valeur: false });
  verifier('case du chantier d’essai décochée pour le poseur d’essai', tc.ok && sansCase.ok, court([tc, sansCase]));
  const refusLecture = await poster({ action: 'notes', jeton: jPoseur, chantier: CHANTIER });
  const refusEcriture = await fiche(jPoseur, 'auto-poseur', numero('x'), note());
  verifier('poseur sans accès au chantier : lecture refusée, note refusée pour de bon', refusLecture.code === 'INTERDIT' && refusEcriture.code === 'DONNEES_INVALIDES', court([refusLecture, refusEcriture]));
  const avecCase = await geste('accesChantier', { id: 'auto-poseur', valeur: true });
  verifier('case du chantier d’essai cochée pour le poseur d’essai', avecCase.ok, court(avecCase));

  // ── Une note avec une photo, écrite par le poseur ──
  const id1 = numero('a'), idPhoto = 'photo-auto-' + graine + '-1';
  const ph = await poster({ action: 'photo', id: idPhoto, fiche: id1, mime: 'image/png', data: PHOTO, jeton: jPoseur });
  verifier('photo déposée', ph.ok, court(ph));
  const r1 = await fiche(jPoseur, 'auto-poseur', id1, note({ photos: [{ photoRef: idPhoto }] }));
  verifier('note reçue : « Note enregistrée », aucun mail', r1.ok && r1.code === 'ENREGISTRE' && r1.message === 'Note enregistrée' && r1.data.note === true, court(r1));
  const r1b = await fiche(jPoseur, 'auto-poseur', id1, note({ photos: [{ photoRef: idPhoto }] }));
  verifier('la même note renvoyée : « déjà reçu »', r1b.code === 'DEJA_RECU', court(r1b));
  const env = await geste('lireEnvois', { n: 4 });
  const envoi = (env.data.lignes || []).find(l => l[0] === id1) || [];
  verifier('une ligne dans l’onglet Envois : note-chantier, « traité »', envoi[2] === 'note-chantier' && envoi[3] === 'traité', court(envoi));
  // une note qui commence par « + » : elle doit revenir telle quelle (sans apostrophe de protection)
  const id2 = numero('b');
  const r2 = await fiche(jPoseur, 'auto-poseur', id2, note({ texte: '+2 cales au R+1 — ESSAI AUTOMATIQUE' }));
  // une note sur deux lignes, avec un texte qui ressemble à une date
  const id3 = numero('c');
  const r3 = await fiche(jPoseur, 'auto-poseur', id3, note({ texte: '12/11\nESSAI AUTOMATIQUE sur deux lignes' }));
  verifier('deux autres notes reçues', r2.ok && r3.ok, court([r2, r3]));

  const luP = await poster({ action: 'notes', jeton: jPoseur, chantier: CHANTIER });
  const notesP = (luP.data && luP.data.notes) || [], n1 = notesP.find(n => n.id === id1) || {}, n2 = notesP.find(n => n.id === id2) || {}, n3 = notesP.find(n => n.id === id3) || {};
  verifier('le poseur relit ses notes : les plus récentes en haut, 1 photo, « la mienne », modifiable par lui', luP.ok && luP.data.chef === false
    && n1.photos === 1 && n1.mien === true && n1.peutModifier === true && n1.auteur && notesP.findIndex(n => n.id === id3) < notesP.findIndex(n => n.id === id1), court(notesP.slice(0, 3)));
  verifier('une note qui commence par « + » revient sans apostrophe', n2.texte === '+2 cales au R+1 — ESSAI AUTOMATIQUE', court(n2.texte));
  verifier('un texte « 12/11 » sur deux lignes revient tel quel (pas transformé en date)', n3.texte === '12/11\nESSAI AUTOMATIQUE sur deux lignes', court(n3.texte));
  verifier('aucun identifiant de fichier Drive dans la réponse', !/"photos":"|drive\.google|[A-Za-z0-9_-]{28,}/.test(JSON.stringify(notesP.map(n => Object.assign({}, n, { id: '' })))), '');
  const photo = await poster({ action: 'notePhoto', jeton: jPoseur, note: id1, rang: 1 });
  verifier('la photo est rendue par le serveur, identique à celle déposée', photo.ok && photo.data.mime === 'image/png' && photo.data.data === PHOTO, court({ ok: photo.ok, code: photo.code, mime: photo.data && photo.data.mime }));

  // ── Gestes ──
  const g1 = await fiche(jPoseur, 'auto-poseur', numero('g1'), action(id1, 'fait'));
  const g2 = await fiche(jPoseur, 'auto-poseur', numero('g2'), action(id1, 'modifier', { texte: 'ESSAI AUTOMATIQUE — texte modifié par le poseur', base: 1 }));
  verifier('« Fait » puis modification par l’auteur', g1.ok && g2.ok && g1.message === 'Enregistré', court([g1, g2]));
  const jCond = await session('auto-conducteur');
  const luC = await poster({ action: 'notes', jeton: jCond, chantier: CHANTIER });
  const c1 = ((luC.data && luC.data.notes) || []).find(n => n.id === id1) || {};
  verifier('le conducteur voit la note : faite, modifiée, « nouvelle » pour lui, modifiable', luC.ok && luC.data.chef === true && c1.fait === true && c1.version === 2
    && c1.texte === 'ESSAI AUTOMATIQUE — texte modifié par le poseur' && c1.nouveau === true && c1.peutModifier === true && c1.mien === false, court(c1));
  const nouv1 = await poster({ action: 'notesNouvelles', jeton: jCond });
  const vues = await poster({ action: 'notesVues', jeton: jCond, chantier: CHANTIER, jusqua: luC.data.heure });
  const nouv2 = await poster({ action: 'notesNouvelles', jeton: jCond });
  verifier('notes nouvelles du conducteur : comptées, puis à zéro pour ce chantier après sa visite', nouv1.ok && (nouv1.data.parChantier[CHANTIER] || 0) >= 3 && vues.ok
    && !(nouv2.data.parChantier[CHANTIER]), court([nouv1.data, vues, nouv2.data]));
  // conflit : le conducteur modifie (version 3), puis arrive une modification du poseur écrite sur la version 2
  const g3 = await fiche(jCond, 'auto-conducteur', numero('g3'), action(id1, 'modifier', { texte: 'ESSAI AUTOMATIQUE — version du conducteur', base: 2 }));
  jPoseur = await session('auto-poseur');
  const g4 = await fiche(jPoseur, 'auto-poseur', numero('g4'), action(id1, 'modifier', { texte: 'ESSAI AUTOMATIQUE — version du poseur (hors réseau)', base: 2 }));
  const apres = ((await poster({ action: 'notes', jeton: jPoseur, chantier: CHANTIER })).data.notes || []).find(n => n.id === id1) || {};
  verifier('conflit : la dernière reçue gagne, la note dit « modifiée en même temps par … »', g3.ok && g4.ok && apres.texte === 'ESSAI AUTOMATIQUE — version du poseur (hors réseau)'
    && apres.version === 4 && /^modifiée en même temps par /.test(apres.remarque || ''), court(apres));
  const histo = await poster({ action: 'noteHistorique', jeton: jPoseur, note: id1 });
  verifier('historique : trois anciennes versions, dont celle écartée par le conflit', histo.ok && histo.data.versions.length === 3
    && histo.data.versions[0].motif === 'modification en même temps' && histo.data.versions[0].texte === 'ESSAI AUTOMATIQUE — version du conducteur', court(histo.data));
  const refusRest = await fiche(jPoseur, 'auto-poseur', numero('g5'), action(id1, 'restaurer'));
  const refusPdf = await poster({ action: 'notesPdf', jeton: jPoseur, chantier: CHANTIER });
  const refusTous = await poster({ action: 'notes', jeton: jPoseur });
  verifier('le poseur ne peut ni restaurer, ni exporter, ni ouvrir la vue « Tous chantiers »', refusRest.code === 'DONNEES_INVALIDES' && refusPdf.code === 'INTERDIT' && refusTous.code === 'INTERDIT', court([refusRest, refusPdf, refusTous]));

  // ── Le vrai PDF de Google, avec la photo ──
  const jCond2 = await session('auto-conducteur');
  const pdf = await poster({ action: 'notesPdf', jeton: jCond2, chantier: CHANTIER });
  verifier('export PDF fabriqué par Google et rangé dans le dossier du chantier', pdf.ok && /^NOTES DE CHANTIER .*\.pdf$/.test((pdf.data || {}).nom || '') && pdf.data.notes >= 3, court(pdf));
  console.log('    PDF à regarder dans le Drive TEST (05 - CHANTIER/COMPTE RENDU) : ' + ((pdf.data || {}).nom || '—'));
  const tous = await poster({ action: 'notes', jeton: jCond2, recherche: 'deux lignes' });
  verifier('vue « Tous chantiers » du conducteur : la recherche est faite par le serveur', tous.ok && tous.data.notes.some(n => n.id === id3) && !tous.data.notes.some(n => n.id === id1), court((tous.data || {}).notes));

  // ── Corbeille, puis rangement : les trois notes d'essai finissent à la corbeille ──
  const s1 = await fiche(jCond2, 'auto-conducteur', numero('s1'), action(id1, 'supprimer'));
  const corb = await poster({ action: 'notes', jeton: jCond2, chantier: CHANTIER, corbeille: true });
  const r5 = await fiche(jCond2, 'auto-conducteur', numero('s2'), action(id1, 'restaurer'));
  const revenu = ((await poster({ action: 'notes', jeton: jCond2, chantier: CHANTIER })).data.notes || []).some(n => n.id === id1);
  verifier('suppression → corbeille → restauration', s1.ok && corb.ok && corb.data.notes.some(n => n.id === id1) && r5.ok && revenu, court([s1, r5, revenu]));
  const rangement = [];
  for (const [i, id] of [id1, id2, id3].entries()) rangement.push((await fiche(jCond2, 'auto-conducteur', numero('z' + i), action(id, 'supprimer'))).ok);
  const reste = ((await poster({ action: 'notes', jeton: jCond2, chantier: CHANTIER })).data.notes || []).filter(n => [id1, id2, id3].indexOf(n.id) > -1).length;
  verifier('notes d’essai mises à la corbeille', rangement.every(Boolean) && reste === 0, court([rangement, reste]));
  const sans = await poster({ action: 'notes', chantier: CHANTIER });
  const sansNote = await poster({ action: 'fiche', id: numero('y'), donnees: note() });
  verifier('sans compte : lecture refusée, et une note attend la connexion (jamais enregistrée sans auteur)', sans.code === 'CONNEXION_REQUISE' && sansNote.code === 'CONNEXION_REQUISE', court([sans, sansNote]));

  // ── Rangement ──
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
  try { await geste('accesChantier', { id: 'auto-poseur', valeur: false }); await geste('fermerSessions'); await geste('retirerDeclencheurs'); } catch (x) {}
  process.exit(1);
});
