// Tests du lot 11.1 — les RÈGLES du planning (planning/Regles.gs), sans aucun Google : node tests/lot11-regles.test.js
// Tous les noms sont inventés.
'use strict';
const assert = require('assert');
const { creerFaux, charger } = require('./faux-google-planning');

const R = charger(creerFaux(), ['Regles.gs']);
const j = x => JSON.stringify(x);
const egal = (a, b, m) => assert.strictEqual(j(a), j(b), m);
let reussis = 0;
function test(nom, fn) {
  try { fn(); reussis++; console.log('  ✓ ' + nom); }
  catch (e) { console.log('  ✗ ' + nom + '\n    ' + String(e.stack || e.message).split('\n').slice(0, 7).join('\n    ')); process.exitCode = 1; }
}
const CHANTIERS = [{ numero: '901', nom: 'LES TILLEULS', court: 'Tilleuls' }, { numero: '903', nom: 'LES LILAS', court: '' }, { numero: '90', nom: 'ÉCOLE DU BOURG', court: '' },
  { numero: '912', nom: 'RÉSIDENCE DE L’HÔPITAL', court: 'Rés. Hôpital' }, { numero: '920', nom: 'MAIRIE', court: '' }, { numero: '921', nom: 'MAISON DUPONT', court: '' }];
const index = R.plIndex_(CHANTIERS, R.lire('PL_CAS'));

console.log('Lot 11.1 — les semaines');
test('lundi d’un jour, décalage, passage de mois et d’année', () => {
  egal(R.plLundi_('2026-11-19'), '2026-11-16');
  egal(R.plLundi_('2026-11-16'), '2026-11-16');
  egal(R.plLundi_('2026-11-22'), '2026-11-16', 'un dimanche appartient à la semaine qui finit');
  egal(R.plDecaler_('2026-12-28', 7), '2027-01-04');
  egal(R.plDecaler_('2028-02-28', 1), '2028-02-29', 'année bissextile');
});
test('numéro de semaine ISO : 2026 a 53 semaines, puis 2027-S01', () => {
  egal(R.plSemaine_('2026-11-19'), { annee: 2026, semaine: 47 });
  egal(R.plSemaine_('2026-12-28'), { annee: 2026, semaine: 53 });
  egal(R.plSemaine_('2027-01-01'), { annee: 2026, semaine: 53 }, 'le 1er janvier 2027 est encore dans la semaine 53 de 2026');
  egal(R.plSemaine_('2027-01-04'), { annee: 2027, semaine: 1 });
  egal(R.plSemaine_('2025-12-29'), { annee: 2026, semaine: 1 }, 'le 29/12/2025 est déjà dans la semaine 1 de 2026');
  egal(R.plSemaine_('2024-12-30'), { annee: 2025, semaine: 1 });
});
test('nom de l’onglet et retour : « 2026-S48 » ↔ lundi ; un nom qui n’est pas une vraie semaine est refusé', () => {
  egal(R.plNomOnglet_('2026-11-23'), '2026-S48');
  egal(R.plLundiDeNom_('2026-S48'), '2026-11-23');
  egal(R.plNomOnglet_('2026-12-28'), '2026-S53');
  egal(R.plLundiDeNom_('2026-S53'), '2026-12-28');
  egal(R.plLundiDeNom_('2027-S01'), '2027-01-04');
  egal(R.plLundiDeNom_('2025-S53'), '', '2025 n’a pas de semaine 53');
  ['LISTES', 'AFFICHE A3', '2026-S00', '2026-S54', '2026-S4', 'S48', '2026-s48 '].forEach(n => egal(R.plLundiDeNom_(n), '', n));
  // toutes les semaines de 2024 à 2032 : aller et retour
  for (let l = '2024-01-01'; l < '2033-01-01'; l = R.plDecaler_(l, 7)) egal(R.plLundiDeNom_(R.plNomOnglet_(l)), l, l);
});
test('la semaine suivante de S53 est 2027-S01', () => {
  egal(R.plNomOnglet_(R.plDecaler_(R.plLundiDeNom_('2026-S53'), 7)), '2027-S01');
  egal(R.plNomOnglet_(R.plDecaler_(R.plLundiDeNom_('2027-S52'), 7)), '2028-S01', '2027 n’a que 52 semaines');
});
test('titres, en-têtes et nom du PDF, y compris à cheval sur deux mois ou deux années', () => {
  egal(R.plTitre_('2026-11-23'), 'Semaine 48 — du 23 au 27/11/2026');
  egal(R.plTitre_('2026-11-30'), 'Semaine 49 — du 30/11 au 04/12/2026');
  egal(R.plTitre_('2026-12-28'), 'Semaine 53 — du 28/12/2026 au 01/01/2027');
  egal(R.plNomFichier_('2026-11-23'), 'Planning S48 du 23 au 27-11');
  egal(R.plNomFichier_('2026-11-30'), 'Planning S49 du 30-11 au 04-12');
  egal(R.plNomFichier_('2026-12-28'), 'Planning S53 du 28-12 au 01-01');
  assert.ok(!/[\/\\:*?"<>|]/.test(R.plNomFichier_('2026-12-28')), 'aucun caractère interdit dans un nom de fichier');
  egal(R.plEntetes_('2026-11-30'), ['Véhicule', 'Nom', 'Lundi 30/11', 'Mardi 01/12', 'Mercredi 02/12', 'Jeudi 03/12', 'Vendredi 04/12']);
});

console.log('Lot 11.1 — la saisie');
test('« 901 » + Entrée → « 901 LES TILLEULS » ; le numéro exact d’abord (« 90 » n’est pas « 901 »)', () => {
  egal(R.plCompleter_('901', index), '901 LES TILLEULS');
  egal(R.plCompleter_(901, index), '901 LES TILLEULS', 'un nombre tapé dans une case non « texte »');
  egal(R.plCompleter_('90', index), '90 ÉCOLE DU BOURG');
  egal(R.plCompleter_(' 901  les  til ', index), '901 LES TILLEULS');
  egal(R.plCompleter_('901 LES TILLEULS', index), '901 LES TILLEULS', 'déjà complet : inchangé');
  egal(R.plCompleter_('901 pose des plinthes', index), '901 pose des plinthes', 'un texte après le numéro est gardé');
});
test('le début d’un nom de chantier complète s’il n’y en a qu’un ; sinon rien n’est deviné', () => {
  egal(R.plCompleter_('91', index), '912 RÉSIDENCE DE L’HÔPITAL', 'un seul chantier commence par 91');
  egal(R.plCompleter_('92', index), '92', 'deux chantiers commencent par 92 : on ne devine pas');
  egal(R.plCompleter_('9', index), '9', 'un seul caractère : rien');
});
test('saisie libre : acceptée telle quelle, jamais refusée', () => {
  egal(R.plCompleter_('Mr DUPONT', index), 'Mr DUPONT');
  egal(R.plCompleter_('12 rue des Lilas', index), '12 rue des Lilas');
  egal(R.plCompleter_('', index), '');
  egal(R.plCompleter_(null, index), '');
  egal(R.plCompleter_('   ', index), '');
});
test('les autres cas : en entier ou par leur début, sans accents ni majuscules', () => {
  egal(R.plCompleter_('absent', index), 'Absent');
  egal(R.plCompleter_('abs', index), 'Absent');
  egal(R.plCompleter_('CONGES', index), 'Congés');
  egal(R.plCompleter_('cong', index), 'Congés');
  egal(R.plCompleter_('ecole', index), 'École');
  egal(R.plCompleter_('for', index), 'Formation');
  egal(R.plCompleter_('sav', index), 'SAV / divers');
  egal(R.plCompleter_('fe', index), 'fe', 'deux lettres : trop court');
});
test('journée coupée : « 901 + 903 » → deux demi-journées, l’une sous l’autre', () => {
  egal(R.plCompleter_('901 + 903', index), '½ 901 LES TILLEULS\n½ 903 LES LILAS');
  egal(R.plCompleter_('901 ; 903', index), '½ 901 LES TILLEULS\n½ 903 LES LILAS');
  egal(R.plCompleter_('901;903', index), '½ 901 LES TILLEULS\n½ 903 LES LILAS');
  egal(R.plCompleter_('901+903', index), '½ 901 LES TILLEULS\n½ 903 LES LILAS', 'sans espaces autour du +');
  egal(R.plCompleter_('901\n903', index), '½ 901 LES TILLEULS\n½ 903 LES LILAS');
  egal(R.plCompleter_('901 + 903 + 920', index), '½ 901 LES TILLEULS\n¼ 903 LES LILAS\n¼ 920 MAIRIE');
  egal(R.plCompleter_('901 + 903 + 920 + abs', index), '¼ 901 LES TILLEULS\n¼ 903 LES LILAS\n¼ 920 MAIRIE\n¼ Absent');
});
test('parts écrites à la main : « 1/4 901 + 903 » → ¼ et ¾ ; les parts manquantes se partagent le reste', () => {
  egal(R.plCompleter_('1/4 901 + 903', index), '¼ 901 LES TILLEULS\n¾ 903 LES LILAS');
  egal(R.plCompleter_('3/4 901 + 1/4 903', index), '¾ 901 LES TILLEULS\n¼ 903 LES LILAS');
  egal(R.plCompleter_('1/2 901 + 903 + 920', index), '½ 901 LES TILLEULS\n¼ 903 LES LILAS\n¼ 920 MAIRIE');
  egal(R.plCompleter_('1/2 901', index), '½ 901 LES TILLEULS', 'une demi-journée seule (le reste de la journée est vide)');
  egal(R.plCompleter_('½ 901 LES TILLEULS\n½ 903 LES LILAS', index), '½ 901 LES TILLEULS\n½ 903 LES LILAS', 'déjà complet : inchangé');
  egal(R.plCompleter_('3/4 901 + 903 + 920', index), '¾ 901 LES TILLEULS\n903 LES LILAS\n920 MAIRIE', 'le reste ne tombe pas juste : rien n’est inventé');
});
test('un « + » dans un texte n’est PAS une coupure : « 901 R+1 », un chantier « RÉSIDENCE A+B », une tâche d’atelier', () => {
  const avecPlus = R.plIndex_(CHANTIERS.concat([{ numero: '905', nom: 'RÉSIDENCE A+B', court: '' }, { numero: '906', nom: 'LOT 1 ; LOT 2', court: '' }]), R.lire('PL_CAS'));
  egal(R.plCompleter_('901 R+1', avecPlus), '901 R+1');
  egal(R.plCompleter_('901 LES TILLEULS R+2', avecPlus), '901 LES TILLEULS R+2');
  egal(R.plCompleter_('Mr DUPONT R+1', avecPlus), 'Mr DUPONT R+1');
  egal(R.plCompleter_('905', avecPlus), '905 RÉSIDENCE A+B');
  egal(R.plCompleter_('905 RÉSIDENCE A+B', avecPlus), '905 RÉSIDENCE A+B', 'choisi dans la liste : jamais coupé');
  egal(R.plCompleter_('906 LOT 1 ; LOT 2', avecPlus), '906 LOT 1 ; LOT 2');
  egal(R.plCompleter_('905 + 901', avecPlus), '½ 905 RÉSIDENCE A+B\n½ 901 LES TILLEULS');
  egal(R.plCompleter_('905+901', avecPlus), '½ 905 RÉSIDENCE A+B\n½ 901 LES TILLEULS', 'collé : coupé seulement si chaque morceau est un numéro connu');
  egal(R.plCompleter_('901+R', avecPlus), '901+R');
  // … et relu, rangé, vérifié, affiché : toujours le même texte
  ['901 R+1', '½ 905 RÉSIDENCE A+B\n½ 901 LES TILLEULS', '906 LOT 1 ; LOT 2'].forEach(t => {
    egal(R.plCompleter_(R.plCompleter_(t, avecPlus), avecPlus), t, t);
    egal(R.plLireCase_(t, avecPlus).morceaux.length, t.split('\n').length, t);
  });
  egal(R.plTexteAffiche_('½ 905 RÉSIDENCE A+B\n½ 901 LES TILLEULS', avecPlus), '½ 905 RÉSIDENCE A+B / ½ 901 Tilleuls');
  const s = { lundi: '2026-11-23', pose: [], atelier: [{ nom: 'Thomas R.', jours: ['Débit R+1', '', '', '', ''] }] };
  egal(R.plVerifier_(s, avecPlus).semaine.atelier[0].jours[0], 'Débit R+1');
});
test('compléter deux fois ne change plus rien (aucune boucle possible)', () => {
  ['901', '901 + 903', '1/4 901 + 903', 'abs', 'Mr DUPONT + 901', '901 + 903 + 920 + 921 + 90', '¾ 901 + 903 + 920'].forEach(t => {
    const une = R.plCompleter_(t, index);
    egal(R.plCompleter_(une, index), une, t);
  });
});
test('lire une case : morceaux, parts, numéros ; ce qui cloche est dit, jamais refusé', () => {
  egal(R.plLireCase_('901 LES TILLEULS', index), { morceaux: [{ quarts: 0, texte: '901 LES TILLEULS', numero: '901' }], probleme: '' });
  egal(R.plLireCase_('½ 901 LES TILLEULS\n½ Mr DUPONT', index).morceaux.map(m => [m.quarts, m.numero]), [[2, '901'], [2, '']]);
  egal(R.plLireCase_('¾ 901\n¾ 903', index).probleme, 'les parts dépassent la journée');
  egal(R.plLireCase_('901\n903\n920\n921\n90', index).probleme, 'plus de 4 morceaux dans la journée');
  egal(R.plLireCase_('¾ 901\n903\n920', index).probleme, 'un morceau n’a pas sa part (¼, ½, ¾)');
  egal(R.plLireCase_('', index), { morceaux: [], probleme: '' });
});
test('le numéro d’une ligne : le PREMIER mot, exact ; une adresse ne devient pas un chantier', () => {
  egal(R.plNumero_('901 LES TILLEULS', index), '901');
  egal(R.plNumero_('9010 autre chose', index), '');
  egal(R.plNumero_('12 rue des Lilas', index), '');
  egal(R.plNumero_('rue 901', index), '');
  egal(R.plNumero_('90 ÉCOLE DU BOURG', index), '90');
});
test('un numéro en double dans la liste ne sert ni à compléter ni à reconnaître un chantier', () => {
  const double = R.plIndex_(CHANTIERS.concat([{ numero: '901', nom: 'UN AUTRE', court: '' }]), R.lire('PL_CAS'));
  egal(R.plNumero_('901 LES TILLEULS', double), '');
  egal(R.plCompleter_('901', double), '901');
  egal(R.plCompleter_('903', double), '903 LES LILAS');
});
test('mots à éviter (santé) : trouvés en mot entier, sans accents ; pas dans le nom d’un chantier de la liste', () => {
  egal(R.plMotAEviter_('Arrêt maladie', index), 'arret');
  egal(R.plMotAEviter_('½ 901 LES TILLEULS\n½ malade', index), 'malade');
  egal(R.plMotAEviter_('HOPITAL', index), 'hopital');
  egal(R.plMotAEviter_('accident de trajet', index), 'accident');
  egal(R.plMotAEviter_('AT', index), 'at');
  egal(R.plMotAEviter_('912 RÉSIDENCE DE L’HÔPITAL', index), '', 'le nom d’un chantier de la liste');
  egal(R.plMotAEviter_('Atelier', index), '', '« at » n’est pas trouvé dans « Atelier »');
  egal(R.plMotAEviter_('Absent', index), '');
  egal(R.plMotAEviter_('Formation', index), '');
  egal(R.plMotAEviter_('', index), '');
});

console.log('Lot 11.1 — le modèle d’une semaine');
const semaine = () => ({ lundi: '2026-11-23', publier: false, etat: '',
  pose: [{ nom: 'Kévin L.', vehicule: 'Plateau 1', jours: ['901 LES TILLEULS', '901 LES TILLEULS', '½ 901 LES TILLEULS\n½ 903 LES LILAS', 'Absent', 'Congés'], vehiculesJour: ['', '', 'Fourgon 2', '', ''] },
    { nom: 'Bruno M.', vehicule: 'Fourgon 2', jours: ['903 LES LILAS', 'Mr DUPONT', 'École', 'Formation', 'Férié'], vehiculesJour: ['', '', '', '', ''] }],
  atelier: [{ nom: 'Thomas R.', jours: ['Huisseries 901, 903\nPlacards 920', '', 'Bureau', '', 'Congés'] }] });
test('grille écrite puis relue : la même semaine (aller et retour)', () => {
  const s = semaine(), grille = R.plGrilleSemaine_(s);
  egal(grille[0][7], '2026-11-23');
  egal(grille[0][1], 'Semaine 48 — du 23 au 27/11/2026');
  egal(grille[1].slice(0, 3), ['Publier pour les gars', false, 'Pas encore publié']);
  egal(grille.map(l => l[7]).slice(2), ['', 'T', 'P', 'V', 'P', 'V', 'T', 'A']);
  assert.ok(grille.every(l => l.length === 8), 'toujours 8 colonnes');
  const relue = R.plLireSemaine_(grille);
  egal([relue.lundi, relue.pose, relue.atelier], [s.lundi, s.pose, s.atelier]);
});
test('onglet illisible (colonne H effacée, date fausse, lundi qui n’en est pas un) : rendu « null », jamais deviné', () => {
  const g = R.plGrilleSemaine_(semaine());
  egal(R.plLireSemaine_(g.map(l => l.slice(0, 7))), null);
  const faux = g.map(l => l.slice()); faux[0][7] = '2026-11-24';
  egal(R.plLireSemaine_(faux), null, 'un mardi');
  const sansReperes = g.map((l, i) => { const c = l.slice(); if (i > 1) c[7] = ''; return c; });
  egal(R.plLireSemaine_(sansReperes), null, 'les repères des lignes effacés (la date est encore là) : illisible, pas « une semaine vide »');
  const ligneEnTrop = g.map(l => l.slice()); ligneEnTrop.push(['', 'Ajouté à la main', '901', '', '', '', '', '']);
  egal(R.plLireSemaine_(ligneEnTrop), null, 'une ligne ajoutée à la main sous le tableau, sans repère');
  assert.ok(/repères des lignes .* ont été effacés/.test(R.plPourquoiIllisible_(sansReperes)), R.plPourquoiIllisible_(sansReperes));
  assert.ok(/^la ligne 11 \(« Ajouté à la main »\) n’est pas une ligne du planning/.test(R.plPourquoiIllisible_(ligneEnTrop)), R.plPourquoiIllisible_(ligneEnTrop));
  assert.ok(/date de la semaine/.test(R.plPourquoiIllisible_(faux)));
  egal(R.plPourquoiIllisible_(g), '', 'un onglet lisible : rien à dire');
  egal(R.plLireSemaine_([]), null);
  egal(R.plLireSemaine_(null), null);
});
test('semaine suivante : mêmes gars et véhicules, chantiers recopiés ; absences, congés, école, formation, fériés et véhicule du jour NON recopiés', () => {
  const s = R.plSemaineSuivante_(semaine(), index);
  egal(s.lundi, '2026-11-30');
  egal([s.publier, s.etat], [false, '']);
  egal(s.pose[0].jours, ['901 LES TILLEULS', '901 LES TILLEULS', '½ 901 LES TILLEULS\n½ 903 LES LILAS', '', '']);
  egal(s.pose[0].vehiculesJour, ['', '', '', '', '']);
  egal(s.pose[0].vehicule, 'Plateau 1');
  egal(s.pose[1].jours, ['903 LES LILAS', 'Mr DUPONT', '', '', '']);
  egal(s.atelier[0].jours, ['Huisseries 901, 903\nPlacards 920', '', 'Bureau', '', '']);
});
test('… une demi-journée d’absence vide toute la journée (à ressaisir) plutôt que de recopier une moitié fausse', () => {
  const s = semaine(); s.pose[0].jours[0] = '½ 901 LES TILLEULS\n½ Absent';
  egal(R.plSemaineSuivante_(s, index).pose[0].jours[0], '');
});
test('ajouter un gars : à sa place dans l’ordre alphabétique (accents ignorés) ; doublon, nom vide et trop-plein refusés avec un message', () => {
  let r = R.plAjouterGars_(semaine(), 'Éric A.', 'pose', 'Plateau 1');
  assert.ok(r.ok);
  egal(r.semaine.pose.map(g => g.nom), ['Bruno M.', 'Éric A.', 'Kévin L.']);
  egal(r.semaine.pose[1], { nom: 'Éric A.', vehicule: 'Plateau 1', jours: ['', '', '', '', ''], vehiculesJour: ['', '', '', '', ''] });
  r = R.plAjouterGars_(semaine(), 'Alain Z.', 'atelier', '');
  egal(r.semaine.atelier.map(g => g.nom), ['Alain Z.', 'Thomas R.']);
  assert.ok(!R.plAjouterGars_(semaine(), 'kevin l.', 'pose', '').ok, 'déjà là (majuscules et accents ignorés)');
  assert.ok(!R.plAjouterGars_(semaine(), 'Thomas R.', 'pose', '').ok, 'déjà à l’atelier');
  assert.ok(!R.plAjouterGars_(semaine(), '  ', 'pose', '').ok);
  const plein = semaine(); for (let i = plein.pose.length; i < 20; i++) plein.pose.push({ nom: 'Gars ' + i, vehicule: '', jours: ['', '', '', '', ''], vehiculesJour: ['', '', '', '', ''] });
  assert.ok(/Déjà 20 gars/.test(R.plAjouterGars_(plein, 'Un de trop', 'pose', '').message));
});
test('retirer un gars : dit s’il avait des saisies ; inconnu = message, rien ne change', () => {
  const r = R.plRetirerGars_(semaine(), 'KÉVIN L.');
  assert.ok(r.ok && r.avaitDesSaisies === true);
  egal(r.semaine.pose.map(g => g.nom), ['Bruno M.']);
  const s = semaine(), inconnu = R.plRetirerGars_(s, 'Personne');
  assert.ok(!inconnu.ok); egal(s.pose.length, 2);
});
test('vérifier la semaine : saisies complétées, gars triés, remarques (hors liste, mot à éviter, parts, doublon)', () => {
  const s = semaine();
  s.pose[0].jours = ['901', '901 + 903', 'arrêt maladie', '¾ 901\n¾ 903', 'Mr DUPONT'];
  s.pose.push({ nom: 'bruno m.', vehicule: '', jours: ['', '', '', '', ''], vehiculesJour: ['', '', '', '', ''] });
  const r = R.plVerifier_(s, index);
  egal(r.semaine.pose.map(g => g.nom), ['Bruno M.', 'bruno m.', 'Kévin L.']);
  egal(r.semaine.pose[2].jours.slice(0, 2), ['901 LES TILLEULS', '½ 901 LES TILLEULS\n½ 903 LES LILAS']);
  const tout = r.remarques.join(' | ');
  assert.ok(/Kévin L\., mercredi : le mot « arret » ne doit pas être écrit/.test(tout), tout);
  assert.ok(/Kévin L\., jeudi : les parts dépassent la journée/.test(tout), tout);
  assert.ok(/Kévin L\., vendredi : « Mr DUPONT » n’est pas dans la liste \(accepté tel quel\)/.test(tout), tout);
  assert.ok(/« bruno m\. » est écrit deux fois/.test(tout), tout);
  const r2 = R.plVerifier_(semaine(), index);
  assert.ok(!/n’est pas dans la liste/.test(r2.remarques.filter(x => !/Mr DUPONT/.test(x)).join(' | ')), 'Absent, Congés, École… ne sont pas des remarques : ' + r2.remarques.join(' | '));
});

console.log('Lot 11.1 — l’affiche compacte');
test('une ligne par gars ; nom court ; journée coupée dans la même case ; marque du véhicule du jour quand il diffère', () => {
  const a = R.plAffiche_(semaine(), index);
  egal(a.titre, 'PLANNING LOUÉ — Semaine 48 — du 23 au 27/11/2026');
  egal(a.sortes, ['entete', 'section', 'pose', 'pose', 'section', 'atelier']);
  egal(a.lignes[2], ['Plateau 1', 'Kévin L.', '901 Tilleuls', '901 Tilleuls', '½ 901 Tilleuls / ½ 903 LES LILAS [Fou.]', 'Absent', 'Congés']);
  egal(a.lignes[3], ['Fourgon 2', 'Bruno M.', '903 LES LILAS', 'Mr DUPONT', 'École', 'Formation', 'Férié']);
  egal(a.lignes[5], ['', 'Thomas R.', 'Huisseries 901, 903 / Placards 920', '', 'Bureau', '', 'Congés']);
  egal(a.vehicules[2], ['Plateau 1', 'Plateau 1', 'Fourgon 2', 'Plateau 1', 'Plateau 1']);
  assert.ok(a.lignes.every(l => l.length === 7));
});
test('taille du texte : environ 16 points pour 12 poseurs et 4 gars d’atelier, plus petit mais lisible pour 20 + 7', () => {
  const faire = (np, na) => { const s = { lundi: '2026-11-23', pose: [], atelier: [] };
    for (let i = 0; i < np; i++) s.pose.push({ nom: 'Poseur ' + i, vehicule: 'Plateau 1', jours: ['901 LES TILLEULS', '901 LES TILLEULS', '903 LES LILAS', '903 LES LILAS', 'Congés'], vehiculesJour: ['', '', '', '', ''] });
    for (let i = 0; i < na; i++) s.atelier.push({ nom: 'Atelier ' + i, jours: ['Huisseries 901', '', '', '', ''] });
    return R.plMesuresAffiche_(R.plAffiche_(s, index)); };
  const ordinaire = faire(12, 4), pire = faire(20, 7);
  assert.ok(ordinaire.taille >= 14 && ordinaire.taille <= 24, 'ordinaire : ' + ordinaire.taille);
  assert.ok(pire.taille >= 9 && pire.taille < ordinaire.taille, 'pire cas : ' + pire.taille);
  // tout tient sur la feuille A3 paysage : 404 mm × 281 mm utiles, à 96 points par pouce
  [ordinaire, pire].forEach(m => {
    assert.ok(m.largeurs.reduce((s, x) => s + x, 0) <= Math.round(404 * 3.7795) + 7, 'largeur');
    assert.strictEqual(m.largeurs.length, 7);
  });
  assert.ok(pire.hauteurLigne * (20 + 7 + 4) <= Math.round(281 * 3.7795) + 31, 'hauteur : ' + pire.hauteurLigne);
});

console.log('Lot 11.1 — ce que lit l’appli (onglet APPLI)');
test('une ligne SEMAINE, puis une ligne PLANIFIE par gars de la pose et par chantier ; l’atelier, les saisies libres et les gars sans compte sont ignorés', () => {
  const comptes = R.plComptes_([['Kévin L.', 'Pose', 'Plateau 1', 'poseur01'], ['Bruno M.', 'Pose', '', ''], ['Thomas R.', 'Atelier', '', 'atelier01']]);
  egal(comptes.problemes, []);
  const l = R.plLignesAppli_([{ semaine: semaine(), publieLe: '20/11 à 16 h 10' }], comptes.comptes, index);
  egal(l, [['SEMAINE', '2026-11-23', '', '', '20/11 à 16 h 10'], ['PLANIFIE', '2026-11-23', 'poseur01', '901', '20/11 à 16 h 10'], ['PLANIFIE', '2026-11-23', 'poseur01', '903', '20/11 à 16 h 10']]);
});
test('une semaine publiée sans personne de planifié donne quand même sa ligne SEMAINE (c’est elle qui fait une coupure)', () => {
  const vide = { lundi: '2026-11-30', pose: [{ nom: 'Kévin L.', vehicule: '', jours: ['Congés', 'Congés', '', '', ''], vehiculesJour: ['', '', '', '', ''] }], atelier: [] };
  egal(R.plLignesAppli_([{ semaine: vide, publieLe: 'x' }], { 'kevin l.': 'poseur01' }, index), [['SEMAINE', '2026-11-30', '', '', 'x']]);
});
test('un compte donné à deux gars, ou deux lignes du même nom : ignorés tous les deux, et signalés', () => {
  const c = R.plComptes_([['Kévin L.', 'Pose', '', 'poseur01'], ['Bruno M.', 'Pose', '', 'POSEUR01'], ['Éric A.', 'Pose', '', 'poseur03'], ['eric a.', 'Pose', '', 'poseur04'], ['Seul S.', 'Pose', '', 'poseur05']]);
  egal(c.comptes['kevin l.'], ''); egal(c.comptes['bruno m.'], ''); egal(c.comptes['eric a.'], '');
  egal(c.comptes['seul s.'], 'poseur05');
  egal(c.problemes.length, 2);
});
test('« 90 » ne vaut pas pour « 901 » ; un numéro tapé dans une adresse ne compte pas', () => {
  const s = { lundi: '2026-11-23', pose: [{ nom: 'Kévin L.', vehicule: '', jours: ['90 ÉCOLE DU BOURG', '9010 inconnu', '12 rue des Lilas', 'voir 901', ''], vehiculesJour: ['', '', '', '', ''] }], atelier: [] };
  egal(R.plLignesAppli_([{ semaine: s, publieLe: '' }], { 'kevin l.': 'poseur01' }, index).filter(l => l[0] === 'PLANIFIE').map(l => l[3]), ['90']);
});
test('empreinte du contenu : change quand une case change, pas quand on coche « Publier » ou que l’état change', () => {
  const a = semaine(), b = semaine(); b.publier = true; b.etat = 'Publié le 20/11 à 16 h 10';
  egal(R.plEmpreinte_(R.plContenu_(a)), R.plEmpreinte_(R.plContenu_(b)));
  b.pose[0].jours[1] = '903 LES LILAS';
  assert.notStrictEqual(R.plEmpreinte_(R.plContenu_(a)), R.plEmpreinte_(R.plContenu_(b)));
});

console.log('Lot 11.1 — les listes, l’historique, les couleurs');
test('liste des chantiers recopiée de l’appli : non « Terminé », avec numéro, triée par numéro ; le nom court tapé dans le planning est gardé', () => {
  const lignes = [['LES TILLEULS', 'LIEU', 'En cours', 'Franck', '901', 'Tilleuls (appli)'], ['VIEUX CHANTIER', '', 'Terminé', '', '850', ''], ['SANS NUMÉRO', '', 'En cours', '', '', ''],
    ['LES LILAS', '', 'En cours', '', '903', ''], ['ÉCOLE DU BOURG', '', 'En attente', '', 90, 'École'], ['DOUBLON', '', 'En cours', '', '903', ''], ['', '', '', '', '', '']];
  const l = R.plListeChantiers_(lignes, [{ numero: '901', court: 'Tilleuls' }, { numero: '850', court: 'Vieux' }]);
  egal(l, [{ numero: '90', nom: 'ÉCOLE DU BOURG', court: 'École' }, { numero: '901', nom: 'LES TILLEULS', court: 'Tilleuls' }, { numero: '903', nom: 'LES LILAS', court: '' }]);
});
test('la liste de saisie : tous les « N° NOM », puis les autres cas', () => {
  const choix = R.plChoix_(index);
  egal(choix.slice(0, 2), ['901 LES TILLEULS', '903 LES LILAS']);
  egal(choix.slice(-8), R.lire('PL_CAS'));
});
test('historique : une ligne par gars, journée coupée sur une ligne', () => {
  const l = R.plLignesHistorique_(semaine());
  egal(l.length, 3);
  egal(l[0], ['2026-11-23', 'Pose', 'Kévin L.', '901 LES TILLEULS', '901 LES TILLEULS', '½ 901 LES TILLEULS / ½ 903 LES LILAS', 'Absent', 'Congés']);
  egal(l[2].slice(0, 4), ['2026-11-23', 'Atelier', 'Thomas R.', 'Huisseries 901, 903 / Placards 920']);
});
test('couleurs : la case prend la couleur du véhicule DU JOUR, sinon de la semaine ; mot à éviter en rouge ; véhicule inconnu = blanc', () => {
  const vehicules = [{ nom: 'Plateau 1', couleur: '#ffe0b2' }, { nom: 'Fourgon 2', couleur: '#C8E6C9' }, { nom: 'Sans couleur', couleur: 'vert' }];
  const s = semaine(); s.pose[1].jours[1] = 'arrêt maladie'; s.pose[1].vehicule = 'Inconnu';
  const st = R.plStyles_(R.plGrilleSemaine_(s), vehicules, index);
  egal(st.fonds.length, 7); egal(st.fonds[0][0], '#1A4A8A', 'ligne POSE');
  egal(st.fonds[1], ['#FFE0B2', '#FFE0B2', '#FFE0B2', '#FFE0B2', '#C8E6C9', '#FFE0B2', '#FFE0B2'], 'Kévin : Plateau 1, sauf mercredi en Fourgon 2');
  egal(st.fonds[3].slice(0, 3), ['#FFFFFF', '#FFFFFF', '#FFFFFF'], 'véhicule inconnu : blanc');
  egal(st.textes[3][3], '#CC0000', 'mot à éviter en rouge');
  egal(st.textes[1][2], '#000000');
  egal(R.plCouleurVehicule_('sans couleur', vehicules), '#FFFFFF', 'un code de couleur mal écrit est ignoré');
});

console.log('\n' + reussis + ' test(s) réussi(s)' + (process.exitCode ? ' — DES TESTS ONT ÉCHOUÉ' : ''));
