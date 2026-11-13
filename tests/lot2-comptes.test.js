// Tests du lot 2 (comptes, jetons, droits, transition, 9a) : node tests/lot2-comptes.test.js
'use strict';
const assert = require('assert');
const { creerGoogle, chargerScript } = require('./gas-harness');

const FRANCK = 'franck@loue.test', SEB = 'seb@loue.test';
const JOUR = 24 * 3600 * 1000;

function environnement(options = {}) {
  const google = creerGoogle(Object.assign({
    proprietes: Object.assign({ DRIVE_ROOT_ID: 'RACINE', DRIVE_PLANNING_ID: 'PLANNING', HACHAGE_ITERATIONS: '200' }, options.proprietes || {}),
    feuilles: {
      'Contacts': [['Nom', 'Role', 'Email', 'ChefEquipe', 'Destinataire', 'ConducteurDefaut', 'ChefAtelier', 'absenceNotif'],
        ['Franck PAVAGEAU', 'Conducteur de travaux', FRANCK, 'O', 'N', 'O', 'N', 'O'],
        ['Sébastien', 'Conducteur de travaux', SEB, 'O', 'N', 'N', 'N', 'N'],
        ['Thomas', 'Poseur', 'thomas@loue.test', 'N', 'N', 'N', 'N', 'N']],
      'Contacts notes': [['Nom', 'Email']],
      'Chantiers': [['Nom', 'Référence', 'Statut', 'Conducteur'],
        ['CHANTIER TEST 1', 'LIEU 1', 'En cours', 'Sébastien'],
        ['CHANTIER TEST 2', 'LIEU 2', 'En cours', 'Franck PAVAGEAU'],
        ['CHANTIER FINI', 'LIEU 3', 'Terminé', 'Sébastien']],
    },
  }, options.google || {}));
  google.racine = google.creerElement('dossier', 'Loué Menuiserie - Chantiers', null, { id: 'RACINE' });
  google.creerElement('dossier', 'Planning', null, { id: 'PLANNING' });
  google.ctx = chargerScript(google);
  google.t = Date.now();
  google.ctx.maintenant_ = () => google.t;
  if (options.sansMiseEnPlace) return google;
  google.ctx.genererCle();
  google.ctx.preparerOngletsLot2();
  const u = google.feuilles['Utilisateurs'];
  // Identifiant, Nom, Rôle, Actif, Réinitialiser, Provisoire, Valable, Déconnecter, Tous, État
  // En haut de l'onglet, comme Franck (lignes 2 à 4, là où preparerOngletsLot2 a mis des cases)
  u.lignes[1] = ['thomas27', 'Thomas', 'Poseur', true, false, '', '', false, false, ''];
  u.lignes[2] = ['seb', 'Sébastien', 'Conducteur', true, false, '', '', false, false, ''];
  u.lignes[3] = ['franck', 'Franck PAVAGEAU', 'Admin', true, false, '', '', false, false, ''];
  google.ctx.traiterComptes();
  return google;
}
const poster = (g, corps) => JSON.parse(g.ctx.doPost({ postData: { contents: JSON.stringify(corps) } }).contenu);
const lireGet = (g, p) => JSON.parse(g.ctx.doGet({ parameter: p }).contenu);
const ligneU = (g, id) => g.feuilles['Utilisateurs'].lignes.find(l => l[0] === id);
const COL = { reinit: 4, prov: 5, valable: 6, deco: 7, tous: 8, etat: 9, actif: 3, role: 2 };

// Crée le mot de passe d'un compte comme Franck et le gars le feraient : case cochée, provisoire, choix du mot de passe
function activer(g, id, mdp) {
  ligneU(g, id)[COL.reinit] = true;
  g.ctx.traiterComptes();
  const prov = ligneU(g, id)[COL.prov];
  const r1 = poster(g, { action: 'connexion', identifiant: id, motDePasse: prov });
  assert.strictEqual(r1.code, 'NOUVEAU_MDP', JSON.stringify(r1));
  const r2 = poster(g, { action: 'motDePasse', identifiant: id, ancien: prov, nouveau: mdp || 'BonMotDePasse9' });
  assert.strictEqual(r2.code, 'CONNECTE', JSON.stringify(r2));
  return r2.data.jeton;
}
function cocherAcces(g, chantier, id) {
  g.ctx.traiterComptes();
  const a = g.feuilles['Accès chantiers'];
  const col = a.lignes[0].indexOf(id);
  const ligne = a.lignes.find(l => l[0] === chantier);
  assert.ok(col > 1 && ligne, 'colonne ' + id + ' et ligne ' + chantier);
  ligne[col] = true;
}
const quitus = extra => Object.assign({ type: 'quitus', chantier: 'CHANTIER TEST 1', date: '09/11/2026', intervenant: 'Client',
  solde: 'OUI', destinataires: [FRANCK], photosBase64: [] }, extra || {});

let reussis = 0;
function test(nom, fn) {
  try { fn(); reussis++; console.log('  ✓ ' + nom); }
  catch (e) { console.log('  ✗ ' + nom + '\n    ' + e.message); process.exitCode = 1; }
}

console.log('Lot 2 — mise en place');

test('preparerOngletsLot2 : onglets, colonnes E à K de Chantiers, cases ; relancé : rien n’est remplacé', () => {
  const g = environnement();
  assert.ok(g.feuilles['Utilisateurs'] && g.feuilles['Accès chantiers'] && g.feuilles['Intervenants']);
  assert.deepStrictEqual(g.feuilles['Chantiers'].lignes[0].slice(4, 11), ['N°', 'Nom court', 'Adresse', 'Client', 'Architecte', 'Date « Terminé »', 'Chemin MEGA']);
  ligneU(g, 'thomas27')[COL.tous] = true;   // une case cochée par Franck ne doit pas être décochée
  const avant = JSON.stringify(g.feuilles['Utilisateurs'].lignes);
  const rapport = g.ctx.preparerOngletsLot2();
  assert.strictEqual(JSON.stringify(g.feuilles['Utilisateurs'].lignes), avant, 'Utilisateurs intact');
  assert.ok(rapport.indexOf('déjà présent') > -1, rapport);
});

test('preparerOngletsLot2 : colonnes de Chantiers déjà utilisées → rien n’est écrit, c’est signalé', () => {
  const g = environnement({ sansMiseEnPlace: true });
  g.feuilles['Chantiers'].lignes[0][5] = 'Mes notes';
  const rapport = g.ctx.preparerOngletsLot2();
  assert.ok(/❌ Onglet Chantiers.*F1/.test(rapport), rapport);
  assert.strictEqual(g.feuilles['Chantiers'].lignes[0][5], 'Mes notes');
  assert.strictEqual(g.feuilles['Chantiers'].lignes[0][4], undefined);
});

test('genererCle : n’écrase jamais ; changerCle refuse sans confirmation, puis la confirmation ne sert qu’une fois', () => {
  const g = environnement();
  const cle = g.proprietes.CLE_JETON;
  assert.ok(cle && cle.length >= 64);
  g.ctx.genererCle();
  assert.strictEqual(g.proprietes.CLE_JETON, cle);
  assert.ok(/Refusé/.test(g.ctx.changerCle()));
  assert.strictEqual(g.proprietes.CLE_JETON, cle);
  g.proprietes.CONFIRMER_CHANGER_CLE = 'OUI';
  g.ctx.changerCle();
  assert.notStrictEqual(g.proprietes.CLE_JETON, cle);
  assert.ok(!('CONFIRMER_CHANGER_CLE' in g.proprietes), 'confirmation effacée');
});

console.log('Lot 2 — mot de passe provisoire et connexion');

test('Réinitialiser : provisoire de 8 caractères lisibles, case décochée, valable 48 h ; rien dans le Sheet qui ressemble à une empreinte', () => {
  const g = environnement();
  ligneU(g, 'thomas27')[COL.reinit] = true;
  g.ctx.traiterComptes();
  const l = ligneU(g, 'thomas27');
  assert.ok(/^[a-hjkmnp-z2-9]{8}$/.test(l[COL.prov]), l[COL.prov]);
  assert.strictEqual(l[COL.reinit], false);
  assert.ok(/provisoire créé/.test(l[COL.etat]), l[COL.etat]);
  const compte = JSON.parse(g.proprietes.COMPTE_thomas27);
  assert.ok(compte.prov && compte.prov.emp && !JSON.stringify(compte).includes(l[COL.prov]), 'provisoire jamais en clair dans les Propriétés');
  // relancé (déclencheur des 10 min juste après) : PAS de deuxième provisoire
  const p = l[COL.prov];
  g.ctx.traiterComptes();
  assert.strictEqual(ligneU(g, 'thomas27')[COL.prov], p);
});

test('connexion : provisoire → choix obligatoire ; mot de passe choisi ; provisoire effacé du Sheet', () => {
  const g = environnement();
  const jeton = activer(g, 'thomas27', 'Escalier2026');
  assert.ok(/^thomas27\.p\.\d+\.\d+\./.test(jeton), jeton);
  assert.strictEqual(ligneU(g, 'thomas27')[COL.prov], '');
  const r = poster(g, { action: 'connexion', identifiant: 'Thomas27 ', motDePasse: 'Escalier2026' });
  assert.strictEqual(r.code, 'CONNECTE', JSON.stringify(r));
  assert.deepStrictEqual(r.data.profil, { id: 'thomas27', nom: 'Thomas', role: 'Poseur', tous: false, conducteur: false });
});

test('mot de passe choisi : règles (8 caractères, pas l’identifiant, pas évident)', () => {
  const g = environnement();
  ligneU(g, 'thomas27')[COL.reinit] = true; g.ctx.traiterComptes();
  const prov = ligneU(g, 'thomas27')[COL.prov];
  ['court', 'thomas27abc', '12345678', 'aaaaaaaaa', prov].forEach(m => {
    const r = poster(g, { action: 'motDePasse', identifiant: 'thomas27', ancien: prov, nouveau: m });
    assert.strictEqual(r.code, 'MDP_REFUSE', m + ' : ' + JSON.stringify(r));
  });
});

test('provisoire expiré après 48 h : refusé, effacé du Sheet, État explique quoi faire', () => {
  const g = environnement();
  ligneU(g, 'thomas27')[COL.reinit] = true; g.ctx.traiterComptes();
  const prov = ligneU(g, 'thomas27')[COL.prov];
  g.t += 49 * 3600 * 1000;
  const r = poster(g, { action: 'connexion', identifiant: 'thomas27', motDePasse: prov });
  assert.strictEqual(r.code, 'PROVISOIRE_EXPIRE');
  assert.ok(/expiré/.test(r.message), r.message);
  g.ctx.traiterComptes();
  assert.strictEqual(ligneU(g, 'thomas27')[COL.prov], '');
  assert.ok(/expiré/.test(ligneU(g, 'thomas27')[COL.etat]));
});

test('mauvais mot de passe et identifiant inconnu : même message', () => {
  const g = environnement();
  activer(g, 'thomas27');
  const a = poster(g, { action: 'connexion', identifiant: 'thomas27', motDePasse: 'mauvais-mdp' });
  const b = poster(g, { action: 'connexion', identifiant: 'personne', motDePasse: 'mauvais-mdp' });
  assert.strictEqual(a.message, b.message);
  assert.strictEqual(a.code, b.code);
});

test('force brute : 5 essais → bloqué 15 min ; débloqué après 15 min ; « Réinitialiser » débloque tout de suite', () => {
  const g = environnement();
  activer(g, 'thomas27', 'Escalier2026');
  for (let i = 0; i < 5; i++) poster(g, { action: 'connexion', identifiant: 'thomas27', motDePasse: 'faux' + i });
  const r = poster(g, { action: 'connexion', identifiant: 'thomas27', motDePasse: 'Escalier2026' });
  assert.strictEqual(r.code, 'BLOQUE', 'même le bon mot de passe est refusé pendant le blocage');
  assert.ok(/bloqué/.test(ligneU(g, 'thomas27')[COL.etat]), 'État écrit tout de suite (essai 14) : ' + ligneU(g, 'thomas27')[COL.etat]);
  for (let i = 0; i < 5; i++) poster(g, { action: 'connexion', identifiant: 'inconnu99', motDePasse: 'faux' + i });
  assert.ok(!g.feuilles['Utilisateurs'].lignes.some(l => /inconnu99/.test(String(l[COL.etat] || ''))), 'un identifiant inventé n’écrit rien');
  g.ctx.traiterComptes();
  assert.ok(/bloqué/.test(ligneU(g, 'thomas27')[COL.etat]), ligneU(g, 'thomas27')[COL.etat]);
  g.t += 16 * 60 * 1000;
  assert.strictEqual(poster(g, { action: 'connexion', identifiant: 'thomas27', motDePasse: 'Escalier2026' }).code, 'CONNECTE');
  for (let i = 0; i < 5; i++) poster(g, { action: 'connexion', identifiant: 'thomas27', motDePasse: 'faux' + i });
  ligneU(g, 'thomas27')[COL.reinit] = true; g.ctx.traiterComptes();
  const prov = ligneU(g, 'thomas27')[COL.prov];
  assert.strictEqual(poster(g, { action: 'connexion', identifiant: 'thomas27', motDePasse: prov }).code, 'NOUVEAU_MDP');
});

test('blocage : les téléphones déjà connectés continuent de marcher', () => {
  const g = environnement();
  const jeton = activer(g, 'thomas27', 'Escalier2026');
  for (let i = 0; i < 6; i++) poster(g, { action: 'connexion', identifiant: 'thomas27', motDePasse: 'faux' + i });
  assert.strictEqual(poster(g, { action: 'moi', jeton }).code, 'OK');
});

test('plus de 50 échecs en une heure : une seule alerte à Franck, pas de pause', () => {
  const g = environnement();
  for (let i = 0; i < 60; i++) poster(g, { action: 'connexion', identifiant: 'x' + i, motDePasse: 'faux' });
  const alertes = g.mails.filter(m => /connexions ratées/.test(m.sujet));
  assert.strictEqual(alertes.length, 1);
  assert.ok(!g.etat.pauses, 'aucune pause (elle occuperait les exécutions du serveur)');
});

test('identifiant en double, compte inactif, rôle inconnu : connexion refusée avec la raison', () => {
  const g = environnement();
  activer(g, 'thomas27', 'Escalier2026');
  ligneU(g, 'thomas27')[COL.actif] = false;
  assert.ok(/désactivé/.test(poster(g, { action: 'connexion', identifiant: 'thomas27', motDePasse: 'Escalier2026' }).message));
  ligneU(g, 'thomas27')[COL.actif] = true;
  ligneU(g, 'thomas27')[COL.role] = 'poseur ';
  assert.ok(/Rôle/.test(poster(g, { action: 'connexion', identifiant: 'thomas27', motDePasse: 'Escalier2026' }).message));
  ligneU(g, 'thomas27')[COL.role] = 'Poseur';
  g.feuilles['Utilisateurs'].lignes.push(['THOMAS27', 'Autre', 'Poseur', true, false, '', '', false, false, '']);
  assert.ok(/double/.test(poster(g, { action: 'connexion', identifiant: 'thomas27', motDePasse: 'Escalier2026' }).message));
  g.ctx.traiterComptes();
  assert.ok(/double/.test(ligneU(g, 'thomas27')[COL.etat]));
});

console.log('Lot 2 — jeton');

function avecTransitionFinie(g) { g.proprietes.FIN_TRANSITION = String(g.t - 1000); }

test('jeton falsifié, expiré, d’un autre environnement : JETON_INVALIDE (transition finie)', () => {
  const g = environnement();
  const jeton = activer(g, 'thomas27');
  avecTransitionFinie(g);
  assert.strictEqual(poster(g, { action: 'moi', jeton }).code, 'OK');
  const morceaux = jeton.split('.');
  const faux = ['seb', morceaux[1], morceaux[2], morceaux[3], morceaux[4]].join('.');
  assert.strictEqual(poster(g, { action: 'moi', jeton: faux }).code, 'JETON_INVALIDE', 'identifiant changé');
  const autreEnv = [morceaux[0], 't', morceaux[2], morceaux[3], morceaux[4]].join('.');
  assert.strictEqual(poster(g, { action: 'moi', jeton: autreEnv }).code, 'JETON_INVALIDE', 'environnement changé');
  g.t += 91 * JOUR;
  g.proprietes.FIN_TRANSITION = String(g.t - 1000);
  assert.strictEqual(poster(g, { action: 'moi', jeton }).code, 'JETON_INVALIDE', 'expiré');
});

test('jeton TEST refusé par le serveur de production (et inversement)', () => {
  const t = environnement({ proprietes: { ENVIRONNEMENT: 'TEST' } });
  const jetonTest = activer(t, 'thomas27');
  assert.ok(/^thomas27\.t\./.test(jetonTest));
  const p = environnement();
  p.proprietes.CLE_JETON = t.proprietes.CLE_JETON;   // même clé (copie du script) : refusé quand même
  p.proprietes.COMPTE_thomas27 = t.proprietes.COMPTE_thomas27;
  avecTransitionFinie(p);
  assert.strictEqual(poster(p, { action: 'moi', jeton: jetonTest }).code, 'JETON_INVALIDE');
});

test('« Déconnecter ses téléphones » : jeton révoqué à la requête suivante ; la connexion marche de nouveau', () => {
  const g = environnement();
  const jeton = activer(g, 'thomas27', 'Escalier2026');
  avecTransitionFinie(g);
  ligneU(g, 'thomas27')[COL.deco] = true;
  g.ctx.surModificationSheet({ range: { getSheet: () => ({ getName: () => 'Utilisateurs' }), getColumn: () => 8 } });
  assert.strictEqual(ligneU(g, 'thomas27')[COL.deco], false);
  assert.strictEqual(poster(g, { action: 'moi', jeton }).code, 'JETON_INVALIDE');
  assert.strictEqual(poster(g, { action: 'connexion', identifiant: 'thomas27', motDePasse: 'Escalier2026' }).code, 'CONNECTE');
});

test('compte désactivé ou rôle mal tapé : COMPTE_REFUSE, le jeton reste bon une fois corrigé', () => {
  const g = environnement();
  const jeton = activer(g, 'thomas27');
  avecTransitionFinie(g);
  ligneU(g, 'thomas27')[COL.actif] = false;
  assert.strictEqual(poster(g, { action: 'moi', jeton }).code, 'COMPTE_REFUSE');
  ligneU(g, 'thomas27')[COL.actif] = true;
  assert.strictEqual(poster(g, { action: 'moi', jeton }).code, 'OK');
});

test('ligne supprimée du Sheet : JETON_INVALIDE', () => {
  const g = environnement();
  const jeton = activer(g, 'thomas27');
  avecTransitionFinie(g);
  const u = g.feuilles['Utilisateurs'];
  u.lignes = u.lignes.filter(l => l[0] !== 'thomas27');
  assert.strictEqual(poster(g, { action: 'moi', jeton }).code, 'JETON_INVALIDE');
});

test('panne du serveur (onglet Utilisateurs renommé, clé absente) : COMPTES_INDISPONIBLES, jamais JETON_INVALIDE', () => {
  const g = environnement();
  const jeton = activer(g, 'thomas27');
  avecTransitionFinie(g);
  const u = g.feuilles['Utilisateurs'];
  delete g.feuilles['Utilisateurs'];
  assert.strictEqual(poster(g, { action: 'moi', jeton }).code, 'COMPTES_INDISPONIBLES');
  assert.strictEqual(poster(g, { action: 'fiche', id: 'fiche-erreur-0001', jeton, donnees: quitus() }).code, 'COMPTES_INDISPONIBLES');
  assert.strictEqual(poster(g, { action: 'connexion', identifiant: 'thomas27', motDePasse: 'x' }).code, 'COMPTES_INDISPONIBLES');
  g.feuilles['Utilisateurs'] = u;
  const cle = g.proprietes.CLE_JETON;
  delete g.proprietes.CLE_JETON;
  assert.strictEqual(poster(g, { action: 'moi', jeton }).code, 'COMPTES_INDISPONIBLES');
  g.proprietes.CLE_JETON = cle;
  assert.strictEqual(poster(g, { action: 'moi', jeton }).code, 'OK');
});

test('prolongation : un jeton de plus de 30 jours est remplacé par un neuf dans la réponse', () => {
  const g = environnement();
  const jeton = activer(g, 'thomas27');
  const r1 = poster(g, { action: 'listes', jeton });
  assert.ok(!r1.jeton, 'jeton récent : pas de remplacement');
  g.t += 31 * JOUR;
  const r2 = poster(g, { action: 'listes', jeton });
  assert.ok(r2.jeton && r2.jeton !== jeton, 'jeton neuf');
  g.t += 80 * JOUR;   // l'ancien aurait expiré, le neuf est encore bon
  avecTransitionFinie(g);
  assert.strictEqual(poster(g, { action: 'moi', jeton: r2.jeton }).code, 'OK');
});

test('panne des comptes PENDANT la transition : la fiche passe « sans compte »', () => {
  const g = environnement();
  const jeton = activer(g, 'thomas27');
  delete g.feuilles['Utilisateurs'];
  assert.strictEqual(poster(g, { action: 'fiche', id: 'fiche-panne-0001', jeton, donnees: quitus() }).code, 'ENREGISTRE');
});

test('« Réinitialiser » : l’ancien mot de passe ne marche plus', () => {
  const g = environnement();
  activer(g, 'thomas27', 'Escalier2026');
  ligneU(g, 'thomas27')[COL.reinit] = true; g.ctx.traiterComptes();
  assert.strictEqual(poster(g, { action: 'connexion', identifiant: 'thomas27', motDePasse: 'Escalier2026' }).code, 'REFUS');
});

test('blocage : il vaut aussi pour le provisoire (et les essais pendant le blocage comptent dans l’alerte)', () => {
  const g = environnement();
  ligneU(g, 'thomas27')[COL.reinit] = true; g.ctx.traiterComptes();
  const prov = ligneU(g, 'thomas27')[COL.prov];
  for (let i = 0; i < 5; i++) poster(g, { action: 'connexion', identifiant: 'thomas27', motDePasse: 'faux' + i });
  assert.strictEqual(poster(g, { action: 'connexion', identifiant: 'thomas27', motDePasse: prov }).code, 'BLOQUE');
  for (let i = 0; i < 60; i++) poster(g, { action: 'connexion', identifiant: 'thomas27', motDePasse: 'faux' });
  assert.strictEqual(g.mails.filter(m => /connexions ratées/.test(m.sujet)).length, 1, 'alerte globale');
});

test('traiterComptes ne réécrit que les cases traitées (une case cochée ailleurs sur la ligne reste)', () => {
  const g = environnement();
  activer(g, 'thomas27');
  const l = ligneU(g, 'thomas27');
  l[COL.deco] = true;
  // simulation : pendant le passage, Franck coche « Tous les chantiers » et « Réinitialiser » d'une autre ligne
  const getRange = g.feuilles['Utilisateurs'].api.getRange;
  let fait = false;
  g.feuilles['Utilisateurs'].api.getRange = (...a) => { if (!fait) { fait = true; l[COL.tous] = true; } return getRange(...a); };
  g.ctx.traiterComptes();
  g.feuilles['Utilisateurs'].api.getRange = getRange;
  assert.strictEqual(l[COL.tous], true, 'case cochée pendant le passage gardée');
  assert.strictEqual(l[COL.deco], false);
});

test('compte désactivé (transition finie) : ses fiches sont quand même acceptées, notées « compte désactivé »', () => {
  const g = environnement();
  const jeton = activer(g, 'thomas27');
  avecTransitionFinie(g);
  ligneU(g, 'thomas27')[COL.actif] = false;
  assert.strictEqual(poster(g, { action: 'listes', jeton }).code, 'COMPTE_REFUSE');
  assert.strictEqual(poster(g, { action: 'fiche', id: 'fiche-inactif-01', jeton, saisiPar: 'thomas27', donnees: quitus() }).code, 'ENREGISTRE');
  assert.strictEqual(g.feuilles['Envois'].lignes.find(x => x[0] === 'fiche-inactif-01')[6], 'thomas27 (compte désactivé)');
  // 7 jours plus tard (date de désactivation notée par traiterComptes) : refusé, la fiche attend dans le téléphone
  g.ctx.traiterComptes();
  g.t += 8 * JOUR;
  g.proprietes.FIN_TRANSITION = String(g.t - 1000);
  assert.strictEqual(poster(g, { action: 'fiche', id: 'fiche-inactif-02', jeton, donnees: quitus() }).code, 'COMPTE_REFUSE');
  // réactivé : tout remarche
  ligneU(g, 'thomas27')[COL.actif] = true; g.ctx.traiterComptes();
  assert.strictEqual(poster(g, { action: 'fiche', id: 'fiche-inactif-03', jeton, donnees: quitus() }).code, 'ENREGISTRE');
});

test('État : « Actif » qui n’est pas une case signalé ; message d’identifiant en double effacé une fois corrigé', () => {
  const g = environnement();
  ligneU(g, 'thomas27')[COL.actif] = 'OUI';
  g.ctx.traiterComptes();
  assert.ok(/n’est pas une case à cocher/.test(ligneU(g, 'thomas27')[COL.etat]));
  ligneU(g, 'thomas27')[COL.actif] = true;
  g.feuilles['Utilisateurs'].lignes.push(['thomas27', 'Autre', 'Poseur', true, false, '', '', false, false, '']);
  g.ctx.traiterComptes();
  assert.ok(/double/.test(ligneU(g, 'thomas27')[COL.etat]));
  g.feuilles['Utilisateurs'].lignes.pop();
  g.ctx.traiterComptes();
  assert.ok(!/double|case/.test(ligneU(g, 'thomas27')[COL.etat]), ligneU(g, 'thomas27')[COL.etat]);
  assert.ok(/❌ Colonne/.test(g.ctx.preparerOngletsLot2()) === false, 'cases en place : rien à signaler');
  ligneU(g, 'seb')[COL.actif] = 'x';
  assert.ok(g.ctx.preparerOngletsLot2().indexOf('❌ Colonne(s) D ') > -1);
});

test('compteurs « Sans compte » : le total ne baisse pas et une seule ligne par jour et par sorte', () => {
  const g = environnement();
  for (let i = 0; i < 3; i++) lireGet(g, { action: 'getContacts' });
  g.ctx.traiterComptes();
  for (let i = 0; i < 2; i++) lireGet(g, { action: 'getContacts' });
  g.ctx.traiterComptes(); g.ctx.traiterComptes();
  const lignes = g.feuilles['Sans compte'].lignes.filter(l => /^lectures listes/.test(l[1]));
  assert.strictEqual(lignes.length, 1);
  assert.strictEqual(lignes[0][5], 5);
});

test('verifierConfig : le propriétaire du Sheet (compte Google de Loué) n’est pas signalé', () => {
  const g = environnement({ google: { editeurs: ['franck@loue.test', 'loue.compte@gmail.test'] }, proprietes: { EMAIL_ADMIN: 'franck@loue.test' } });
  g.contexte.Session.getEffectiveUser = () => ({ getEmail: () => 'loue.compte@gmail.test' });
  assert.ok(!/❌ Le Sheet peut être modifié/.test(g.ctx.verifierConfig()));
});

console.log('Lot 2 — droits');

test('poseur : seulement ses chantiers cochés (pas les terminés) ; conducteur : tous, les siens marqués', () => {
  const g = environnement();
  const jt = activer(g, 'thomas27');
  cocherAcces(g, 'CHANTIER TEST 1', 'thomas27');
  cocherAcces(g, 'CHANTIER FINI', 'thomas27');
  const r = poster(g, { action: 'listes', jeton: jt });
  assert.deepStrictEqual(r.data.chantiers.map(c => c.nom), ['CHANTIER TEST 1']);
  assert.strictEqual(r.data.partiel, true);
  assert.ok(r.data.contacts.length, 'contacts fournis aux comptes');
  const js = activer(g, 'seb');
  const s = poster(g, { action: 'listes', jeton: js });
  assert.deepStrictEqual(s.data.chantiers.map(c => c.nom + ':' + c.mien), ['CHANTIER TEST 1:true', 'CHANTIER TEST 2:false', 'CHANTIER FINI:true']);
  assert.strictEqual(s.data.partiel, false);
});

test('case « Tous les chantiers » : un poseur voit tout (et n’a pas de colonne dans Accès chantiers)', () => {
  const g = environnement();
  ligneU(g, 'thomas27')[COL.tous] = true;
  const jt = activer(g, 'thomas27');
  assert.strictEqual(poster(g, { action: 'listes', jeton: jt }).data.chantiers.length, 3);
  // (sa colonne, créée avant que la case soit cochée, reste : rien n'est jamais supprimé de l'onglet)
});

test('action « dossiers » : poseur refusé sur un chantier non coché ; sur le sien, liste vide (tuile Plans retirée, lot 4b) ; planning pour tous', () => {
  const g = environnement();
  const jt = activer(g, 'thomas27');
  cocherAcces(g, 'CHANTIER TEST 1', 'thomas27');
  // un dossier Plans rempli : il n'est plus lu, et plus aucun de ses fichiers n'est mis en partage par lien
  const racine = g.elements['RACINE'];
  const plan = g.creerElement('fichier', 'plan.pdf', g.creerElement('dossier', 'Plans', g.creerElement('dossier', 'CHANTIER TEST 1', racine)));
  const s46 = g.creerElement('fichier', 'S46.pdf', g.elements['PLANNING']);
  assert.strictEqual(poster(g, { action: 'dossiers', jeton: jt, chantier: 'CHANTIER TEST 2' }).code, 'INTERDIT');
  const r = poster(g, { action: 'dossiers', jeton: jt, chantier: 'chantier test 1' });
  assert.strictEqual(r.code, 'OK');
  assert.deepStrictEqual(r.data.dossiers, { plans: [] });
  assert.strictEqual(plan.acces, 'PRIVATE', 'le plan n’est plus partagé par lien');
  const p = poster(g, { action: 'dossiers', jeton: jt, chantier: '__PLANNING__' });
  assert.strictEqual(p.code, 'OK');
  assert.deepStrictEqual(p.data.dossiers.planning.map(d => d.nom), ['S46.pdf']);
  assert.strictEqual(s46.acces, 'ANYONE_WITH_LINK', 'le planning garde son partage par lien');
  assert.strictEqual(plan.acces, 'PRIVATE');
});

test('fiche d’un poseur pour un chantier non coché : acceptée, auteur noté dans Envois', () => {
  const g = environnement();
  const jt = activer(g, 'thomas27');
  avecTransitionFinie(g);
  const r = poster(g, { action: 'fiche', id: 'fiche-auteur-0001', jeton: jt, saisiPar: 'seb', donnees: quitus({ chantier: 'CHANTIER TEST 2' }) });
  assert.strictEqual(r.code, 'ENREGISTRE', JSON.stringify(r));
  const ligne = g.feuilles['Envois'].lignes.find(l => l[0] === 'fiche-auteur-0001');
  assert.strictEqual(ligne[6], 'thomas27 (rangée par seb, selon le téléphone)');
});

test('Accès chantiers : colonnes et lignes ajoutées sans rien effacer ; ligne orpheline signalée', () => {
  const g = environnement();
  cocherAcces(g, 'CHANTIER TEST 1', 'thomas27');
  const a = g.feuilles['Accès chantiers'];
  assert.strictEqual(JSON.stringify(a.lignes[0]), JSON.stringify(['Chantier', 'Remarque (appli)', 'thomas27']), 'pas de colonne pour conducteur et admin');
  g.feuilles['Chantiers'].lignes.push(['CHANTIER NEUF', '', 'En préparation', 'Sébastien']);
  g.feuilles['Chantiers'].lignes[1][0] = 'CHANTIER TEST 1 BIS';   // renommé
  g.ctx.traiterComptes();
  const ancienne = a.lignes.find(l => l[0] === 'CHANTIER TEST 1');
  assert.strictEqual(ancienne[2], true, 'case gardée');
  assert.ok(/absent/.test(ancienne[1]));
  assert.ok(a.lignes.find(l => l[0] === 'CHANTIER NEUF'));
  assert.ok(a.lignes.find(l => l[0] === 'CHANTIER TEST 1 BIS'));
});

test('déclencheur « à la modification » : rien hors de l’onglet Utilisateurs', () => {
  const g = environnement();
  ligneU(g, 'thomas27')[COL.reinit] = true;
  g.ctx.surModificationSheet({ range: { getSheet: () => ({ getName: () => 'Contacts' }), getColumn: () => 5 } });
  assert.strictEqual(ligneU(g, 'thomas27')[COL.prov], '', 'pas traité');
  g.ctx.surModificationSheet({ range: { getSheet: () => ({ getName: () => 'Utilisateurs' }), getColumn: () => 5 } });
  assert.ok(ligneU(g, 'thomas27')[COL.prov], 'traité');
});

console.log('Lot 2 — période de transition');

test('pas commencée : tout marche sans compte (ancien format, GET, fiche) et c’est noté', () => {
  const g = environnement();
  assert.ok(Array.isArray(lireGet(g, { action: 'getContacts' }).chantiers));
  assert.strictEqual(poster(g, { action: 'fiche', id: 'fiche-sans-0001', donnees: quitus({ redacteur: 'Thomas' }) }).code, 'ENREGISTRE');
  assert.strictEqual(poster(g, quitus()).status, 'ok');
  const sc = g.feuilles['Sans compte'].lignes;
  assert.ok(sc.filter(l => l[1] === 'fiche').length === 2, JSON.stringify(sc));
  assert.ok(sc.some(l => l[4] === 'Thomas'), 'nom saisi noté');
  g.ctx.traiterComptes();
  assert.ok(sc.some(l => /^lectures listes du/.test(l[1]) && l[5] === 1), 'lectures comptées');
  assert.strictEqual(g.feuilles['Envois'].lignes.find(l => l[0] === 'fiche-sans-0001')[6], 'sans compte');
});

test('fiche sans compte : lectures POST refusées (CONNEXION_REQUISE), mais la fiche passe', () => {
  const g = environnement();
  assert.strictEqual(poster(g, { action: 'listes' }).code, 'CONNEXION_REQUISE');
});

test('jeton révoqué PENDANT la transition : fiche acceptée « sans compte », la page est priée d’effacer le jeton', () => {
  const g = environnement();
  const jeton = activer(g, 'thomas27');
  ligneU(g, 'thomas27')[COL.deco] = true; g.ctx.traiterComptes();
  const r = poster(g, { action: 'fiche', id: 'fiche-revoque-01', jeton, donnees: quitus() });
  assert.strictEqual(r.code, 'ENREGISTRE');
  assert.strictEqual(r.jetonInvalide, true);
});

test('demarrerTransition : 15 jours ; puis refus sans compte (fiche, ancien format, GET), message de mise à jour', () => {
  const g = environnement();
  g.ctx.demarrerTransition();
  assert.ok(/déjà commencé/.test(g.ctx.demarrerTransition()), 'pas de second démarrage');
  g.t += 14 * JOUR;
  assert.strictEqual(poster(g, { action: 'fiche', id: 'fiche-j14-00001', donnees: quitus() }).code, 'ENREGISTRE');
  g.t += 2 * JOUR;
  const r = poster(g, { action: 'fiche', id: 'fiche-j16-00001', donnees: quitus() });
  assert.strictEqual(r.code, 'CONNEXION_REQUISE');
  assert.ok(/Mettre à jour/.test(r.message) && /gardée/.test(r.message), r.message);
  assert.strictEqual(poster(g, quitus()).status, 'error');
  assert.strictEqual(lireGet(g, { action: 'getContacts' }).erreur, 'CONNEXION_REQUISE');
  assert.strictEqual(lireGet(g, { action: 'getDossiers', chantier: 'CHANTIER TEST 1' }).erreur, 'CONNEXION_REQUISE');
  const jt = activer(g, 'thomas27');
  assert.strictEqual(poster(g, { action: 'fiche', id: 'fiche-j16-00002', jeton: jt, donnees: quitus() }).code, 'ENREGISTRE');
});

test('alerte 3 jours avant la fin (une seule) ; prolongerTransition ; finirTransitionMaintenant refusé hors TEST', () => {
  const g = environnement();
  g.ctx.demarrerTransition();
  g.t += 13 * JOUR; g.ctx.traiterComptes(); g.ctx.traiterComptes();
  assert.strictEqual(g.mails.filter(m => /Fin de la période/.test(m.sujet)).length, 1);
  const fin = Number(g.proprietes.FIN_TRANSITION);
  g.ctx.prolongerTransition();
  assert.strictEqual(Number(g.proprietes.FIN_TRANSITION), fin + 7 * JOUR);
  assert.ok(/Refusé/.test(g.ctx.finirTransitionMaintenant()));
  const t = environnement({ proprietes: { ENVIRONNEMENT: 'TEST' } });
  t.ctx.finirTransitionMaintenant();
  assert.strictEqual(poster(t, { action: 'fiche', id: 'fiche-test-fin-1', donnees: quitus() }).code, 'CONNEXION_REQUISE');
});

test('transition oubliée : rappel à Franck 7 jours après la première connexion, ❌ dans verifierConfig', () => {
  const g = environnement();
  activer(g, 'thomas27');
  g.t += 8 * JOUR;
  g.ctx.traiterComptes();
  assert.strictEqual(g.mails.filter(m => /pas démarrée/.test(m.sujet)).length, 1);
  assert.ok(/❌ Transition : pas commencée/.test(g.ctx.verifierConfig()));
});

test('ping : version, date de fin de transition', () => {
  const g = environnement();
  const r = poster(g, { action: 'ping' });
  assert.strictEqual(r.data.comptes, true);
  assert.strictEqual(r.data.transitionOuverte, true);
  assert.strictEqual(r.data.transitionJusquau, null);
});

console.log('Lot 2 — 9a et rangement');

test('nom court de l’onglet Chantiers dans le nom du PDF', () => {
  const g = environnement();
  g.feuilles['Chantiers'].lignes[1][5] = 'TEST1';
  poster(g, { action: 'fiche', id: 'fiche-court-0001', donnees: quitus() });
  const noms = Object.values(g.elements).filter(e => e.type === 'fichier').map(e => e.nom);
  assert.ok(noms.some(n => /^QUITUS TEST1 2026-11-09\.pdf$/.test(n)), noms.join(' | '));
});

test('chantier inconnu : aucun dossier créé, PDF dans _À CLASSER, Franck prévenu, mails partis', () => {
  const g = environnement();
  const r = poster(g, { action: 'fiche', id: 'fiche-inconnu-01', donnees: quitus({ chantier: 'CHANTEIR TSET 1' }) });
  assert.strictEqual(r.code, 'ENREGISTRE');
  const dossiers = Object.values(g.elements).filter(e => e.type === 'dossier').map(e => e.nom);
  assert.ok(dossiers.indexOf('CHANTEIR TSET 1') < 0, dossiers.join(' | '));
  const aClasser = Object.values(g.elements).find(e => e.type === 'dossier' && e.nom === '_À CLASSER');
  assert.ok(aClasser && aClasser.enfants.length === 1);
  assert.ok(g.mails.some(m => /Document à classer/.test(m.sujet)));
  assert.ok(g.mails.some(m => m.to === FRANCK && /Quitus/.test(m.sujet)));
});

test('chantier retiré de l’onglet mais dont le dossier existe : rangé dans son dossier (pas _À CLASSER)', () => {
  const g = environnement();
  g.creerElement('dossier', 'ANCIEN CHANTIER', g.racine);
  poster(g, { action: 'fiche', id: 'fiche-ancien-001', donnees: quitus({ chantier: 'ANCIEN CHANTIER' }) });
  assert.ok(!Object.values(g.elements).some(e => e.type === 'dossier' && e.nom === '_À CLASSER'));
});

test('verifierConfig : Sheet partagé avec un autre compte → ❌ (il pourrait lire la clé)', () => {
  const g = environnement({ google: { editeurs: [FRANCK, 'autre@ext.test'] } });
  assert.ok(/❌ Le Sheet peut être modifié par d’autres comptes \(autre@ext\.test\)/.test(g.ctx.verifierConfig()));
});

console.log('\n' + reussis + ' test(s) réussi(s)' + (process.exitCode ? ' — DES TESTS ÉCHOUENT' : ''));
