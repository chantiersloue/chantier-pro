// Tests du lot 14 — les absences ACCEPTÉES par la direction, inscrites toutes seules dans le planning (programme de publication) :
//   node tests/lot14-planning.test.js
// Tous les noms sont inventés. Faux Google : tests/faux-google-planning.js.
'use strict';
const assert = require('assert');
const { creerFaux, charger } = require('./faux-google-planning');

const j = x => JSON.stringify(x);
const egal = (a, b, m) => assert.strictEqual(j(a), j(b), m);
let reussis = 0;
function test(nom, fn) {
  try { fn(); reussis++; console.log('  ✓ ' + nom); }
  catch (e) { console.log('  ✗ ' + nom + '\n    ' + String(e.stack || e.message).split('\n').slice(0, 7).join('\n    ')); process.exitCode = 1; }
}
const JEUDI = Date.UTC(2026, 10, 19, 15, 10);          // jeudi 19/11/2026 : la semaine en cours est 2026-S47 (lundi 16/11)
const LISTES = () => [
  ['N°', 'Chantier', 'Nom court (affiche)', 'Liste de saisie', '', 'Véhicule', 'Couleur', '', 'Autres cas', '', 'Tâches', '', 'Liste des chantiers', 'jamais mise à jour'],
  ['0501', 'CHANTIER TEST 1', 'Test 1', '0501 CHANTIER TEST 1', '', 'Plateau 1', '#FFE0B2', '', 'Absent', '', '', '', 'Mettre à jour maintenant', false],
  ['0502', 'CHANTIER TEST 2', '', '0502 CHANTIER TEST 2', '', 'Fourgon 2', '#C8E6C9', '', 'Congés', '', '', '', '', ''],
];
const SALARIES = () => [['Nom', 'Équipe', 'Véhicule habituel', 'Compte de l’appli'], ['Kévin E.', 'Pose', 'Plateau 1', 'kevin'], ['Thomas E.', 'Pose', 'Fourgon 2', ''], ['Marc E.', 'Atelier', '', 'atelier1']];
const SUIVI_TITRES = ['Numéro', 'Reçue le', 'Compte', 'Demandeur', 'Date d’absence', 'Du', 'Au', 'Durée', 'Appellation (planning)', 'État', 'Décidée le', 'Mail au conducteur'];
// Une demande telle que l'appli l'écrit dans « Absences suivi » (aucun motif)
const demande = (id, compte, du, au, duree, libelle, etat) => [id, new Date(JEUDI), compte, 'Nom complet de ' + compte, 'texte de la date', du, au, duree || 'Journée entière', libelle || 'Congés', etat || 'Acceptée', '', ''];
const semaineModele = lundi => ({ lundi: lundi, publier: false, etat: '',
  pose: [{ nom: 'Kévin E.', vehicule: 'Plateau 1', jours: ['0501 CHANTIER TEST 1', '0501 CHANTIER TEST 1', '½ 0501 CHANTIER TEST 1\n½ 0502 CHANTIER TEST 2', '', 'Mr DUPONT'], vehiculesJour: ['', '', '', '', ''] },
    { nom: 'Thomas E.', vehicule: 'Fourgon 2', jours: ['0502 CHANTIER TEST 2', '', '', '', ''], vehiculesJour: ['', '', '', '', ''] }],
  atelier: [{ nom: 'Marc E.', jours: ['Huisseries 0501', '', '', '', ''] }] });

function monde(o = {}) {
  const g = creerFaux({ maintenant: JEUDI,
    classeurs: { PLANNING: { nom: 'Planning Loué', onglets: { 'LISTES': LISTES(), 'SALARIÉS': SALARIES() } },
      APPLI: { nom: 'ChantierPro', onglets: Object.assign({ 'Chantiers': [['Nom', 'Référence', 'Statut', 'Conducteur', 'N°', 'Nom court'], ['CHANTIER TEST 1', '', 'En cours', '', '0501', ''], ['CHANTIER TEST 2', '', 'En cours', '', '0502', '']] },
        o.sansSuivi ? {} : { 'Absences suivi': [SUIVI_TITRES].concat(o.demandes || []) }) } },
    dossiers: { DOSSIER: 'Planning' }, actif: 'PLANNING', proprietes: { PLANNING_ID: 'PLANNING', APPLI_SHEET_ID: 'APPLI', DOSSIER_PLANNING_ID: 'DOSSIER' } });
  const ctx = charger(g, ['Regles.gs', 'Affiche.gs', 'Planning.gs', 'Publication.gs']);
  const ss = g.classeurs.PLANNING.api;
  const m = { g: g, ctx: ctx, ss: ss };
  m.creer = lundi => { const sh = ss.insertSheet(ctx.plNomOnglet_(lundi), 0); ctx.plgEcrireSemaine_(ss, sh, semaineModele(lundi), ctx.plgListes_(ss)); return sh; };
  m.f = nom => g.onglet('PLANNING', nom);
  // les 5 cases d'un gars dans une semaine
  m.cases = (onglet, nom) => { const l = m.f(onglet).lignes.filter(x => x[1] === nom)[0]; return l ? l.slice(2, 7) : null; };
  m.journal = () => (m.f('ABSENCES') ? m.f('ABSENCES').lignes.slice(1).filter(l => l[0]) : []);
  m.ajouterDemande = d => { g.onglet('APPLI', 'Absences suivi').lignes.push(d); };
  m.ecrituresAppli = () => g.classeurs.APPLI.onglets.reduce((n, f) => n + f.ecritures, 0);
  (o.semaines || ['2026-11-16', '2026-11-23']).forEach(l => m.creer(l));
  return m;
}

console.log('Lot 14 — une absence dans une case (les règles)');
const R = charger(creerFaux(), ['Regles.gs']);
test('journée entière : la case devient l’appellation ; ce qui y était écrit est rendu pour le journal', () => {
  egal(R.plAvecAbsence_('', 'Journée entière', 'Congés'), { valeur: 'Congés', change: true, avant: '' });
  egal(R.plAvecAbsence_('0501 CHANTIER TEST 1', 'Journée entière', 'Absent'), { valeur: 'Absent', change: true, avant: '0501 CHANTIER TEST 1' });
  egal(R.plAvecAbsence_('½ 0501 A\n½ 0502 B', 'Journée entière', 'École'), { valeur: 'École', change: true, avant: '½ 0501 A / ½ 0502 B' });
  egal(R.plAvecAbsence_('Congés', 'Journée entière', 'Congés').change, false, 'déjà inscrite');
  egal(R.plAvecAbsence_('½ Congés', 'Journée entière', 'Congés'), { valeur: 'Congés', change: true, avant: '½ Congés' }, 'une demi-journée devient la journée');
  egal(R.plAvecAbsence_('0501 X', 'une durée inconnue', 'Absent').valeur, 'Absent', 'durée inconnue = journée entière');
});
test('matin : « ½ Congés » en premier ; après-midi : en dernier ; le chantier seul de la case devient « ½ … » ; jamais deux fois', () => {
  egal(R.plAvecAbsence_('', 'Matin', 'Congés').valeur, '½ Congés');
  egal(R.plAvecAbsence_('0501 CHANTIER TEST 1', 'Matin', 'Congés'), { valeur: '½ Congés\n½ 0501 CHANTIER TEST 1', change: true, avant: '' });
  egal(R.plAvecAbsence_('0501 CHANTIER TEST 1', 'Après-midi', 'Formation').valeur, '½ 0501 CHANTIER TEST 1\n½ Formation');
  egal(R.plAvecAbsence_('½ 0501 CHANTIER TEST 1', 'Après-midi', 'Absent').valeur, '½ 0501 CHANTIER TEST 1\n½ Absent');
  egal(R.plAvecAbsence_('½ 0501 A\n½ 0502 B', 'Matin', 'Absent'), { valeur: '½ Absent\n½ 0502 B', change: true, avant: '½ 0501 A' }, 'journée déjà coupée en deux : l’absence remplace sa moitié');
  egal(R.plAvecAbsence_('½ 0501 A\n½ 0502 B', 'Après-midi', 'Absent'), { valeur: '½ 0501 A\n½ Absent', change: true, avant: '½ 0502 B' });
  egal(R.plAvecAbsence_('¼ 0501 A\n¾ 0502 B', 'Matin', 'Absent').valeur, '½ Absent\n¼ 0501 A\n¾ 0502 B', 'autre découpage : ajoutée, « Vérifier la semaine » dira que les parts dépassent');
  const une = R.plAvecAbsence_('0501 CHANTIER TEST 1', 'Matin', 'Congés').valeur;
  egal(R.plAvecAbsence_(une, 'Matin', 'Congés'), { valeur: une, change: false, avant: '' });
});
test('deux demandes le même jour (matin, puis après-midi) : la journée entière devient l’absence ; un jour « Férié » reste férié', () => {
  const matin = R.plAvecAbsence_('0501 CHANTIER TEST 1', 'Matin', 'Congés').valeur;
  egal(R.plAvecAbsence_(matin, 'Après-midi', 'Congés'), { valeur: 'Congés', change: true, avant: '½ 0501 CHANTIER TEST 1' });
  egal(R.plAvecAbsence_('½ Congés', 'Après-midi', 'Congés').valeur, 'Congés');
  egal(R.plAvecAbsence_('Congés', 'Matin', 'Congés').change, false, 'déjà absent toute la journée');
  egal(R.plAvecAbsence_('Férié', 'Journée entière', 'Congés'), { valeur: 'Férié', change: false, avant: '' });
  egal(R.plAvecAbsence_('Férié', 'Matin', 'Absent').change, false);
});
test('les jours d’une absence : du lundi au vendredi seulement, passage d’année compris ; dates fausses = aucun jour', () => {
  egal(R.plJoursAbsence_('2026-11-27', '2026-12-01'), ['2026-11-27', '2026-11-30', '2026-12-01']);
  egal(R.plJoursAbsence_('2026-12-31', '2027-01-04'), ['2026-12-31', '2027-01-01', '2027-01-04']);
  egal(R.plJoursAbsence_('2026-11-21', '2026-11-22'), [], 'un week-end');
  egal(R.plJoursAbsence_('2026-12-01', '2026-11-27'), []);
  egal(R.plJoursAbsence_('', '2026-11-27'), []);
});
test('le modèle d’une semaine sait à quelle ligne est chaque gars, sans que cela change sa grille ni son empreinte', () => {
  const g = R.plGrilleSemaine_(semaineModele('2026-11-16')), s = R.plLireSemaine_(g);
  egal([s.lignesDe['kevin e.'], s.lignesDe['thomas e.'], s.lignesDe['marc e.']], [5, 7, 10]);
  egal(Object.keys(s), ['lundi', 'publier', 'etat', 'pose', 'atelier']);
  egal(R.plGrilleSemaine_(s), g);
});

console.log('Lot 14 — chaque nuit : les absences acceptées s’inscrivent');
test('absence acceptée de 3 jours : les cases du gars deviennent « Congés » ; le journal ABSENCES dit ce qui a été inscrit et ce qui était écrit', () => {
  const m = monde({ demandes: [demande('fiche-0001-abcd', 'kevin', '2026-11-23', '2026-11-25')] });
  const r = m.ctx.passageDeNuit();
  assert.ok(/absences : 3 jour\(s\) inscrit\(s\)/.test(r), r);
  egal(m.cases('2026-S48', 'Kévin E.'), ['Congés', 'Congés', 'Congés', '', 'Mr DUPONT']);
  egal(m.cases('2026-S47', 'Kévin E.')[0], '0501 CHANTIER TEST 1', 'l’autre semaine n’est pas touchée');
  egal(m.cases('2026-S48', 'Thomas E.'), ['0502 CHANTIER TEST 2', '', '', '', ''], 'les autres gars non plus');
  const l = m.journal()[0];
  egal(l.slice(0, 8), ['fiche-0001-abcd', 'Kévin E.', '2026-11-23', '2026-11-25', 'Journée entière', 'Congés', 'inscrite : 3 jour(s)', '2026-11-23 2026-11-24 2026-11-25']);
  egal(l[8], '23/11 : 0501 CHANTIER TEST 1 ; 24/11 : 0501 CHANTIER TEST 1 ; 25/11 : ½ 0501 CHANTIER TEST 1 / ½ 0502 CHANTIER TEST 2');
});
test('les demandes « En attente » ou « Refusée » ne sont jamais inscrites ; le Sheet de l’appli n’est que lu', () => {
  const m = monde({ demandes: [demande('fiche-0001-abcd', 'kevin', '2026-11-23', '2026-11-23', '', '', 'En attente'), demande('fiche-0002-abcd', 'kevin', '2026-11-24', '2026-11-24', '', '', 'Refusée')] });
  assert.ok(/absences : aucune/.test(m.ctx.passageDeNuit()));
  egal(m.cases('2026-S48', 'Kévin E.').slice(0, 2), ['0501 CHANTIER TEST 1', '0501 CHANTIER TEST 1']);
  egal([m.f('ABSENCES'), m.ecrituresAppli()], [null, 0]);
});
test('matin ou après-midi : la demi-journée s’ajoute au chantier de la case', () => {
  const m = monde({ demandes: [demande('fiche-0001-abcd', 'kevin', '2026-11-23', '2026-11-23', 'Matin', 'Formation'), demande('fiche-0002-abcd', 'kevin', '2026-11-26', '2026-11-26', 'Après-midi', 'Absent')] });
  m.ctx.passageDeNuit();
  egal(m.cases('2026-S48', 'Kévin E.'), ['½ Formation\n½ 0501 CHANTIER TEST 1', '0501 CHANTIER TEST 1', '½ 0501 CHANTIER TEST 1\n½ 0502 CHANTIER TEST 2', '½ Absent', 'Mr DUPONT']);
});
test('RTT et Récupération s’inscrivent avec leur nom ; et ne sont pas recopiés dans la semaine suivante', () => {
  const m = monde({ demandes: [demande('fiche-0001-abcd', 'kevin', '2026-11-23', '2026-11-23', '', 'RTT'), demande('fiche-0002-abcd', 'kevin', '2026-11-24', '2026-11-24', '', 'Récupération')] });
  m.ctx.passageDeNuit();
  egal(m.cases('2026-S48', 'Kévin E.').slice(0, 2), ['RTT', 'Récupération']);
  egal(m.ctx.plSemaineSuivante_(m.ctx.plgLireSemaine_(m.f('2026-S48').api), m.ctx.plgListes_(m.ss).index).pose[0].jours.slice(0, 2), ['', '']);
});
test('un gars de l’atelier, une appellation inconnue (lue « Absent »), un week-end dans la période', () => {
  const m = monde({ demandes: [demande('fiche-0001-abcd', 'atelier1', '2026-11-20', '2026-11-23', '', 'Maladie')] });
  m.ctx.passageDeNuit();
  egal([m.cases('2026-S47', 'Marc E.')[4], m.cases('2026-S48', 'Marc E.')[0]], ['Absent', 'Absent']);
  egal(m.journal()[0].slice(5, 8), ['Absent', 'inscrite : 2 jour(s)', '2026-11-20 2026-11-23']);
});
test('jamais deux fois : relancé, rien ne change ; une case corrigée à la main ensuite n’est PAS réécrite', () => {
  const m = monde({ demandes: [demande('fiche-0001-abcd', 'kevin', '2026-11-23', '2026-11-24')] });
  m.ctx.passageDeNuit();
  m.f('2026-S48').api.getRange(5, 3).setValue('0502 CHANTIER TEST 2');      // Franck : finalement il vient lundi
  const ecritures = m.f('2026-S48').ecritures;
  assert.ok(/absences : 0 jour\(s\) inscrit\(s\)/.test(m.ctx.passageDeNuit()));
  egal(m.cases('2026-S48', 'Kévin E.').slice(0, 2), ['0502 CHANTIER TEST 2', 'Congés']);
  egal(m.f('2026-S48').ecritures, ecritures, 'aucune écriture dans la semaine');
  egal(m.journal().length, 1);
});
test('la semaine n’existe pas encore : l’absence attend ; dès que l’onglet est créé, elle s’inscrit (les jours déjà faits ne sont pas refaits)', () => {
  const m = monde({ demandes: [demande('fiche-0001-abcd', 'kevin', '2026-11-27', '2026-12-01')] });
  m.ctx.passageDeNuit();
  egal(m.cases('2026-S48', 'Kévin E.')[4], 'Congés');
  egal(m.journal()[0][6], 'inscrite : 1 jour(s) ; 2 jour(s) en attente (semaine pas encore créée ou illisible)');
  m.creer('2026-11-30');
  m.ctx.passageDeNuit();
  egal(m.cases('2026-S49', 'Kévin E.'), ['Congés', 'Congés', '½ 0501 CHANTIER TEST 1\n½ 0502 CHANTIER TEST 2', '', 'Mr DUPONT']);
  egal([m.journal().length, m.journal()[0][6], m.journal()[0][7]], [1, 'inscrite : 3 jour(s)', '2026-11-27 2026-11-30 2026-12-01']);
});
test('le gars n’a pas de compte dans SALARIÉS : « à inscrire à la main », rien n’est écrit au hasard ; la colonne remplie ensuite, l’absence s’inscrit', () => {
  const m = monde({ demandes: [demande('fiche-0001-abcd', 'thomas27', '2026-11-23', '2026-11-23')] });
  const r = m.ctx.passageDeNuit();
  assert.ok(/1 demande\(s\) à inscrire à la main \(onglet ABSENCES\)/.test(r), r);
  egal(m.cases('2026-S48', 'Thomas E.')[0], '0502 CHANTIER TEST 2');
  assert.ok(/^⚠ à inscrire à la main : aucun gars du planning n’a ce compte/.test(m.journal()[0][6]), m.journal()[0][6]);
  egal(m.journal()[0][1], 'Nom complet de thomas27');
  m.f('SALARIÉS').api.getRange(3, 4).setValue('thomas27');
  m.ctx.passageDeNuit();
  egal(m.cases('2026-S48', 'Thomas E.')[0], 'Congés');
  egal([m.journal().length, m.journal()[0][1], m.journal()[0][6]], [1, 'Thomas E.', 'inscrite : 1 jour(s)']);
});
test('dates illisibles, ou gars absent de la semaine : noté « à inscrire à la main », le reste se fait', () => {
  const m = monde({ demandes: [demande('fiche-0001-abcd', 'kevin', '', ''), demande('fiche-0002-abcd', 'kevin', '2026-11-23', '2026-11-23')] });
  m.ctx.plgRetirer_(m.ss, 'Marc E.', false);
  m.ajouterDemande(demande('fiche-0003-abcd', 'atelier1', '2026-11-24', '2026-11-24'));
  m.ctx.passageDeNuit();
  egal(m.journal().map(l => l[6]), ['⚠ à inscrire à la main : dates illisibles', 'inscrite : 1 jour(s)', 'pas encore inscrite ; ⚠ 1 jour(s) à inscrire à la main : le gars n’est pas dans la semaine']);
});
test('quelqu’un ajoute un gars (les lignes bougent) entre la lecture de la semaine et l’écriture : l’absence va quand même sur la ligne DU BON GARS, jamais sur celle d’un autre', () => {
  const m = monde({ demandes: [demande('fiche-0001-abcd', 'atelier1', '2026-11-23', '2026-11-23')] });
  // Au moment précis où le programme va relire la ligne de Marc E. (ligne 10), un gars est ajouté à la pose : tout descend de deux lignes
  const f = m.f('2026-S48'), vrai = f.api.getRange;
  let fait = false;
  f.api.getRange = (r, c, nr, nc) => {
    if (!fait && r === 10 && nr === 1 && nc === 8) { fait = true; f.api.getRange = vrai; m.ss.setActiveSheet(f.api); m.ctx.plgAjouter_(m.ss, 'Alain A.', 'pose'); }
    return vrai(r, c, nr, nc);
  };
  m.ctx.passageDeNuit();
  assert.ok(fait, 'le déplacement a bien eu lieu pendant le passage');
  egal(m.cases('2026-S48', 'Marc E.')[0], 'Congés');
  egal(m.cases('2026-S48', 'Thomas E.'), ['0502 CHANTIER TEST 2', '', '', '', ''], 'la ligne qui a pris la place de Marc n’est pas touchée');
  egal(m.cases('2026-S48', 'Kévin E.')[0], '0501 CHANTIER TEST 1');
  egal(m.journal()[0][6], 'inscrite : 1 jour(s)');
});
test('absence un samedi seul : rien à inscrire, et ce n’est pas « dates illisibles » ; journal protégé contre une modification par mégarde', () => {
  const m = monde({ demandes: [demande('fiche-0001-abcd', 'kevin', '2026-11-21', '2026-11-22')] });
  m.ctx.passageDeNuit();
  egal(m.journal()[0][6], 'inscrite : 0 jour(s) (aucun jour du lundi au vendredi dans la période)');
  assert.ok(m.g.journal.some(l => l[0] === 'Sheet' && l[1] === 'protect'), 'le journal ABSENCES est protégé (avertissement)');
});
test('journal ABSENCES effacé par mégarde : une demande acceptée depuis plus de 14 jours n’est PAS réinscrite toute seule (les cases corrigées à la main restent) ; le journal ne garde rien au-delà de 12 mois', () => {
  const vieille = demande('fiche-0001-abcd', 'kevin', '2026-11-23', '2026-11-23'); vieille[10] = new Date(JEUDI - 20 * 86400000);
  const recente = demande('fiche-0002-abcd', 'kevin', '2026-11-24', '2026-11-24'); recente[10] = new Date(JEUDI - 2 * 86400000);
  const m = monde({ demandes: [vieille, recente] });
  m.ctx.passageDeNuit();
  egal(m.cases('2026-S48', 'Kévin E.').slice(0, 2), ['0501 CHANTIER TEST 1', 'Congés']);
  assert.ok(/^⚠ à inscrire à la main : acceptée depuis plus de 14 jours et jamais vue/.test(m.journal()[0][6]), m.journal()[0][6]);
  // une ligne du journal vieille de plus de 12 mois est effacée la nuit
  m.f('ABSENCES').api.getRange(4, 1, 1, 10).setValues([['fiche-0000-abcd', 'Ancien A.', '2025-10-01', '2025-10-03', 'Journée entière', 'Congés', 'inscrite : 3 jour(s)', '2025-10-01 2025-10-02 2025-10-03', '', '']]);
  assert.ok(/journal des absences : 1 ligne\(s\) de plus de 12 mois effacée\(s\)/.test(m.ctx.passageDeNuit()));
  egal(m.journal().map(l => l[0]), ['fiche-0001-abcd', 'fiche-0002-abcd']);
});
test('pas d’onglet « Absences suivi » dans l’appli (lot 14 pas installé), ou Sheet de l’appli en panne : rien ne se passe, le reste de la nuit se fait', () => {
  const m = monde({ sansSuivi: true });
  assert.ok(/absences : aucune ; PDF des semaines terminées/.test(m.ctx.passageDeNuit()));
  const n = monde({ demandes: [demande('fiche-0001-abcd', 'kevin', '2026-11-23', '2026-11-23')] });
  n.g.classeurs.APPLI.enPanne = true;
  const r = n.ctx.passageDeNuit();
  assert.ok(/absences : ⚠/.test(r) && /historique : 0 semaine/.test(r), r);
  egal(n.cases('2026-S48', 'Kévin E.')[0], '0501 CHANTIER TEST 1');
});

console.log('Lot 14 — et toujours avant une publication');
test('« Publier » coché : l’absence acceptée est inscrite AVANT de fabriquer le PDF, qui la montre', () => {
  const m = monde({ demandes: [demande('fiche-0001-abcd', 'kevin', '2026-11-19', '2026-11-20', '', 'École')] });
  m.f('2026-S47').api.getRange(2, 2).setValue(true);
  egal(m.ctx.passagePublication(), '2026-S47 : publiée');
  egal(m.cases('2026-S47', 'Kévin E.').slice(3), ['École', 'École']);
  const affiche = m.g.classeurs[m.g.crees[0]].onglets[0].lignes;
  egal(affiche[3].slice(5, 7), ['École', 'École']);
  egal(m.f('2026-S47').lignes[1][2], 'Publié le 19/11 à 16 h 10', 'publiée avec l’absence : pas d’avertissement « modifié »');
  m.ctx.passagePublication();
  egal(m.f('2026-S47').lignes[1][2], 'Publié le 19/11 à 16 h 10');
});
test('une absence qui s’inscrit dans une semaine DÉJÀ publiée : l’état prévient (« modifié depuis la publication »), Franck recoche', () => {
  const m = monde();
  m.f('2026-S47').api.getRange(2, 2).setValue(true); m.ctx.passagePublication();
  m.ajouterDemande(demande('fiche-0001-abcd', 'kevin', '2026-11-20', '2026-11-20'));
  m.ctx.passageDeNuit();
  egal(m.cases('2026-S47', 'Kévin E.')[4], 'Congés');
  m.ctx.passagePublication();
  assert.ok(/^⚠ Modifié depuis la publication/.test(m.f('2026-S47').lignes[1][2]), m.f('2026-S47').lignes[1][2]);
});
test('rien de coché : le passage de 10 minutes ne lit pas les absences (aucune ouverture du Sheet de l’appli)', () => {
  const m = monde({ demandes: [demande('fiche-0001-abcd', 'kevin', '2026-11-23', '2026-11-23')] });
  egal(m.ctx.passagePublication(), 'rien à faire');
  egal([m.g.classeurs.APPLI.ouvertures, m.cases('2026-S48', 'Kévin E.')[0]], [0, '0501 CHANTIER TEST 1']);
});

console.log('\n' + reussis + ' test(s) réussi(s)' + (process.exitCode ? ' — DES TESTS ONT ÉCHOUÉ' : ''));
