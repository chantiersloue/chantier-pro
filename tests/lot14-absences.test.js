// Tests du lot 14 — la demande d'absence : mail à la direction seule (deux boutons), lien signé à usage unique, état pour le
// poseur, mail au conducteur. Tout se passe dans le faux Google : node tests/lot14-absences.test.js
// Tous les noms sont inventés ; aucun vrai mail ne part.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { creerGoogle, chargerScript } = require('./gas-harness');

const RACINE = path.join(__dirname, '..');
const FRANCK = 'franck@loue.test', SEB = 'seb@loue.test', DIR1 = 'direction@loue.test', DIR2 = 'gerant@loue.test', PERSO = 'kevin.perso@exemple.test';
const MOTIF = 'Rendez-vous médical chez le spécialiste', PRECISIONS = 'Opération du genou prévue ensuite';
const JEUDI = new Date(2026, 10, 19, 10, 0, 0).getTime();
const JOUR = 86400000;
const j = x => JSON.stringify(x);
// Les valeurs lues dans le faux Google viennent d'un autre « monde » JavaScript : on les compare écrites en JSON
const egal = (a, b, m) => assert.strictEqual(j(a), j(b), m);
// Gmail refuse d'écrire à certaines adresses
const refuser = (g, adresses) => { const vrai = g.contexte.GmailApp.sendEmail; g.contexte.GmailApp.sendEmail = (to, s, t, o) => { if (adresses.indexOf(to) > -1) throw new Error('Adresse refusée'); return vrai(to, s, t, o); }; };

function environnement(o = {}) {
  const proprietes = Object.assign({ DRIVE_ROOT_ID: 'RACINE', DRIVE_PLANNING_ID: 'PLANNING', HACHAGE_ITERATIONS: '200' }, o.test ? { ENVIRONNEMENT: 'TEST' } : {});
  if (o.direction !== undefined) proprietes.ABSENCE_DIRECTION = o.direction;
  Object.assign(proprietes, o.proprietes || {});
  const g = creerGoogle({ nomSheet: o.test ? 'ChantierPro TEST' : 'ChantierPro', proprietes: proprietes, quota: o.quota,
    feuilles: {
      'Contacts': [['Nom', 'Role', 'Email', 'ChefEquipe', 'Destinataire', 'ConducteurDefaut', 'ChefAtelier', 'absenceNotif'],
        ['Franck ESSAI', 'Conducteur de travaux', FRANCK, 'O', 'N', 'O', 'N', 'O'],
        ['Sébastien ESSAI', 'Conducteur de travaux', SEB, 'O', 'N', 'N', 'N', 'O']],
      'Contacts notes': [['Nom', 'Email']],
      'Chantiers': [['Nom', 'Référence', 'Statut', 'Conducteur', 'N°'], ['CHANTIER TEST 1', 'LIEU 1', 'En cours', 'Sébastien ESSAI', '0501']],
    } });
  g.creerElement('dossier', 'Loué Menuiserie - Chantiers', null, { id: 'RACINE' });
  g.creerElement('dossier', 'Planning', null, { id: 'PLANNING' });
  g.ctx = chargerScript(g);
  g.now = JEUDI; g.ctx.maintenant_ = () => g.now;
  g.ctx.genererCle(); g.ctx.preparerOngletsLot2();
  const u = g.feuilles['Utilisateurs'];
  u.lignes[1] = ['kevin', 'Kévin ESSAI', 'Poseur', true, false, '', '', false, false, ''];
  u.lignes[2] = ['thomas27', 'Thomas ESSAI', 'Poseur', true, false, '', '', false, false, ''];
  g.ctx.traiterComptes();
  g.mails.length = 0;
  return g;
}
let numero = 0;
const idFiche = () => 'fiche-' + String(++numero).padStart(4, '0') + '-abcd';
const poster = (g, corps) => JSON.parse(g.ctx.doPost({ postData: { contents: JSON.stringify(corps) } }).contenu);
const jeton = (g, id) => g.ctx.fabriquerJeton_(id, 1);
const demande = extra => Object.assign({ type: 'absence', nom: 'Kévin ESSAI', emailPerso: PERSO, dateDepot: '19/11/2026', dateAbsence: 'Du 30/11/2026 au 02/12/2026',
  duree: 'Journée entière', imputation: 'Sans solde', motif: MOTIF, precisions: PRECISIONS }, extra || {});
const envoyer = (g, qui, donnees, id) => poster(g, Object.assign({ action: 'fiche', id: id || idFiche(), donnees: donnees || demande() }, qui ? { jeton: jeton(g, qui) } : {}));
const fiches = g => g.mails.filter(m => /Demande d'absence/.test(m.sujet));
const suivi = g => (g.feuilles['Absences suivi'] ? g.feuilles['Absences suivi'].lignes.slice(1) : []);
// Les paramètres du lien « Accepter » (ou « Refuser ») du dernier mail à la direction
const lien = (g, quoi) => {
  const texte = fiches(g)[fiches(g).length - 1].texte, m = new RegExp('(https://\\S+absence-reponse\\.html\\?\\S*c=' + (quoi || 'accepter') + '\\S*)').exec(texte);
  assert.ok(m, 'lien « ' + (quoi || 'accepter') + ' » dans le mail');
  const u = new URL(m[1]);
  return { url: m[1], n: u.searchParams.get('n'), e: u.searchParams.get('e'), s: u.searchParams.get('s'), c: u.searchParams.get('c'), env: u.searchParams.get('env1'), envRetenu: u.searchParams.get('env') };
};
const voir = (g, l) => poster(g, { action: 'absenceVoir', n: l.n, e: l.e, s: l.s });
const decider = (g, l, choix) => poster(g, { action: 'absenceDecider', n: l.n, e: l.e, s: l.s, choix: choix });
const miennes = (g, qui) => poster(g, Object.assign({ action: 'absencesMiennes' }, qui ? { jeton: jeton(g, qui) } : {}));
// Tout ce qui est écrit dans le Sheet, en un seul texte (pour vérifier qu'un mot n'y est nulle part)
const toutLeSheet = g => Object.keys(g.feuilles).map(n => j(g.feuilles[n].lignes)).join('\n');

let reussis = 0;
function test(nom, fn) {
  try { fn(); reussis++; console.log('  ✓ ' + nom); }
  catch (e) { console.log('  ✗ ' + nom + '\n    ' + String(e.stack || e.message).split('\n').slice(0, 8).join('\n    ')); process.exitCode = 1; }
}

console.log('Lot 14 — éteint (pas de réglage ABSENCE_DIRECTION) : exactement comme avant');
test('la demande part aux personnes prévenues des absences et à l’adresse personnelle ; le motif est dans l’onglet Absences ; aucun onglet de suivi', () => {
  const g = environnement();
  const r = envoyer(g, 'kevin');
  assert.strictEqual(r.code, 'ENREGISTRE', j(r));
  assert.deepStrictEqual(fiches(g).map(m => m.to).sort(), [FRANCK, PERSO, SEB].sort());
  assert.ok(!/absence-reponse/.test(j(g.mails)), 'aucun bouton');
  assert.strictEqual(g.feuilles['Absences'].lignes[1][6], MOTIF);
  assert.strictEqual(g.feuilles['Absences suivi'], undefined);
  assert.deepStrictEqual(miennes(g, 'kevin').data, { suivi: false, direction: false, demandes: [], jours: 7 });
});
test('un réglage vide ou illisible est lu comme éteint, et verifierConfig le dit', () => {
  ['', '   ', 'pas une adresse'].forEach(v => {
    const g = environnement({ direction: v });
    envoyer(g, 'kevin');
    assert.deepStrictEqual(fiches(g).map(m => m.to).sort(), [FRANCK, PERSO, SEB].sort(), '« ' + v + ' »');
  });
  const ligne = d => environnement(d === undefined ? {} : { direction: d }).ctx.verifierConfig().split('\n').filter(l => /ABSENCE_DIRECTION/.test(l))[0];
  assert.ok(/^✅ Absences .* : éteint/.test(ligne(undefined)), ligne(undefined));
  assert.ok(/^❌ Absences .*aucune adresse lisible, lu comme éteint/.test(ligne('pas une adresse')), ligne('pas une adresse'));
  assert.ok(/^✅ Absences .* : allumé — 2 adresse\(s\) de la direction ; boutons du mail vers https:\/\/chantiersloue\.github\.io\/chantier-pro\/$/.test(ligne(DIR1 + ', ' + DIR2)), ligne(DIR1 + ', ' + DIR2));
  assert.ok(ligne(DIR1).indexOf(DIR1) < 0, 'les adresses ne sont pas affichées');
});

console.log('Lot 14 — allumé : le mail part à la direction, et à elle seule');
test('un mail par adresse de la direction, avec le PDF et les deux boutons ; rien aux personnes prévenues d’avant ni à l’adresse personnelle', () => {
  const g = environnement({ direction: DIR1 + ', ' + DIR2 });
  const r = envoyer(g, 'kevin');
  assert.deepStrictEqual([r.code, r.data.envoyes, r.data.reportes], ['ENREGISTRE', 2, 0], j(r));
  assert.deepStrictEqual(g.mails.map(m => m.to), [DIR1, DIR2], 'aucun autre mail, d’aucune sorte');
  const m = g.mails[0];
  assert.strictEqual(m.sujet, "[Loué App] Demande d'absence — Kévin ESSAI — Du 30/11/2026 au 02/12/2026");
  assert.strictEqual(m.opts.attachments.length, 1);
  assert.ok(!m.opts.bcc && !m.opts.cc);
  assert.ok(m.texte.indexOf(MOTIF) > -1 && m.texte.indexOf(PRECISIONS) > -1, 'la direction lit le motif');
  // les boutons : deux liens, dans des cases de tableau colorées (Outlook), et les liens écrits en clair en secours
  const h = m.opts.htmlBody;
  assert.ok(/<td bgcolor="#1E7B34"[^>]*><a href="https:\/\/chantiersloue\.github\.io\/chantier-pro\/absence-reponse\.html\?n=[^"]+&amp;c=accepter&amp;env1=prod"[^>]*>✅ Accepter<\/a><\/td>/.test(h), h.slice(0, 1500));
  assert.ok(/<td bgcolor="#B3261E"[^>]*><a href="[^"]+&amp;c=refuser&amp;env1=prod"[^>]*>❌ Refuser<\/a><\/td>/.test(h));
  assert.ok(/Liens valables jusqu'au 26\/11\/2026/.test(h) && /Liens valables jusqu'au 26\/11\/2026/.test(m.texte));
  assert.ok(!/<script|javascript:/i.test(h));
});
test('le motif et les précisions ne sont écrits NULLE PART dans le Sheet ; le PDF n’est pas rangé dans Drive ; rien dans « Mails en attente »', () => {
  const g = environnement({ direction: DIR1 });
  envoyer(g, 'kevin');
  const tout = toutLeSheet(g);
  ['médical', 'spécialiste', 'Opération', 'genou'].forEach(mot => assert.ok(tout.indexOf(mot) < 0, '« ' + mot + ' » est dans le Sheet'));
  assert.ok(tout.indexOf(PERSO) < 0, 'l’adresse personnelle non plus');
  egal(g.feuilles['Absences'].lignes[1].slice(1, 9), ['Kévin ESSAI', '19/11/2026', 'Du 30/11/2026 au 02/12/2026', 'Journée entière', '(réservé à la direction)', '(réservé à la direction)', '(réservé à la direction)', '']);
  assert.ok(tout.indexOf('Sans solde') < 0, 'l’imputation non plus');
  assert.strictEqual(Object.values(g.elements).filter(e => e.type === 'fichier').length, 0, 'aucun fichier créé dans Drive');
  assert.strictEqual(g.feuilles['Mails en attente'], undefined);
  assert.strictEqual(g.feuilles['Journal'], undefined);
});
test('la ligne de suivi : qui, quand (dates lisibles par le planning), durée, appellation, « En attente » — et le compte du poseur', () => {
  const g = environnement({ direction: DIR1 });
  const id = idFiche(); envoyer(g, 'kevin', demande(), id);
  const l = suivi(g)[0];
  assert.deepStrictEqual([l[0], l[2], l[3], l[4], l[5], l[6], l[7], l[8], l[9], l[10] || '', l[11] || ''],
    [id, 'kevin', 'Kévin ESSAI', 'Du 30/11/2026 au 02/12/2026', '2026-11-30', '2026-12-02', 'Journée entière', 'Absent', 'En attente', '', '']);
  egal(g.feuilles['Absences suivi'].lignes[0].slice(0, 4), ['Numéro', 'Reçue le', 'Compte', 'Demandeur']);
  assert.ok(/^envoyé le 19\/11\/2026/.test(l[12]), 'colonne « Mail à la direction » : ' + l[12]);
});
test('un texte hostile dans la demande reste du texte dans le mail (aucune balise, aucune formule dans le Sheet)', () => {
  const g = environnement({ direction: DIR1 });
  envoyer(g, 'kevin', demande({ nom: '<img src=x onerror=alert(1)>', motif: '=HYPERLINK("http://x")', precisions: '<script>x</script>' }));
  const h = g.mails[0].opts.htmlBody;
  assert.ok(h.indexOf('<img') < 0 && h.indexOf('<script') < 0 && h.indexOf('&lt;img') > -1, h.slice(0, 600));
  assert.ok(!suivi(g)[0].some(v => /^=/.test(String(v))), 'aucune formule');
});

console.log('Lot 14 — le lien du mail');
test('copie TEST : le lien porte « env1=test » (serveur de cette page seulement, rien n’est retenu dans le navigateur) ; le réglage ADRESSE_APPLI change l’adresse des pages ; une adresse douteuse est ignorée', () => {
  const t = environnement({ direction: DIR1, test: true, proprietes: { ADRESSE_APPLI: 'https://loue-essai.github.io/chantier-pro' } });
  envoyer(t, 'kevin');
  const l = lien(t);
  assert.ok(/^https:\/\/loue-essai\.github\.io\/chantier-pro\/absence-reponse\.html\?/.test(l.url) && l.env === 'test' && l.envRetenu === null, l.url);
  ['http://pas-securise.test/', 'https://x.test/"><script>', 'javascript:alert(1)', 'https://x.test/?a=b'].forEach(a => {
    const g = environnement({ direction: DIR1, proprietes: { ADRESSE_APPLI: a } });
    envoyer(g, 'kevin');
    assert.ok(/^https:\/\/chantiersloue\.github\.io\/chantier-pro\/absence-reponse\.html\?/.test(lien(g).url), a);
    assert.deepStrictEqual([lien(g).env, lien(g).envRetenu], ['prod', null]);
  });
});
test('la page de confirmation rappelle la demande (qui, quelles dates, quelle durée) — jamais le motif — et ne modifie rien', () => {
  const g = environnement({ direction: DIR1 });
  envoyer(g, 'kevin');
  const avant = toutLeSheet(g), r = voir(g, lien(g));
  assert.deepStrictEqual(r.data, { demandeur: 'Kévin ESSAI', dateAbsence: 'Du 30/11/2026 au 02/12/2026', duree: 'Journée entière', etat: 'En attente', decideeLe: '', expire: false });
  assert.strictEqual(toutLeSheet(g), avant);
  assert.strictEqual(g.mails.length, 1);
});
test('un lien modifié (numéro, date limite, signature), incomplet ou inventé est refusé, sans rien lire ni écrire', () => {
  const g = environnement({ direction: DIR1 });
  envoyer(g, 'kevin'); const autre = idFiche(); envoyer(g, 'thomas27', demande({ nom: 'Thomas ESSAI' }), autre);
  const l = lien(g), avant = toutLeSheet(g);
  const essais = [Object.assign({}, l, { n: suivi(g)[0][0] }), Object.assign({}, l, { e: String(Number(l.e) + 1) }), Object.assign({}, l, { s: l.s.slice(0, -2) + 'xx' }),
    Object.assign({}, l, { s: '' }), { n: l.n }, {}, Object.assign({}, l, { n: 'pas un numéro' }), Object.assign({}, l, { e: 'demain' })];
  essais.forEach((x, i) => {
    assert.strictEqual(voir(g, x).code, 'LIEN_INVALIDE', 'voir ' + i);
    assert.strictEqual(decider(g, x, 'accepter').code, 'LIEN_INVALIDE', 'décider ' + i);
  });
  // une signature juste, mais pour une demande qui n'existe pas
  const e = String(g.now + JOUR), n = 'fiche-9999-abcd';
  assert.strictEqual(voir(g, { n: n, e: e, s: g.ctx.absSignature_(n, e) }).code, 'LIEN_INVALIDE');
  assert.strictEqual(toutLeSheet(g), avant, 'rien n’a changé');
  assert.strictEqual(decider(g, l, 'peut-être').code, 'DONNEES_INVALIDES');
  assert.strictEqual(suivi(g)[1][9], 'En attente');
});
test('la signature d’une session de l’appli ne vaut pas pour un lien d’absence (et inversement)', () => {
  const g = environnement({ direction: DIR1 });
  envoyer(g, 'kevin');
  const l = lien(g);
  assert.strictEqual(voir(g, Object.assign({}, l, { s: jeton(g, 'kevin').split('.').pop() })).code, 'LIEN_INVALIDE');
  assert.ok(!poster(g, { action: 'absencesMiennes', jeton: l.s }).ok);
});

console.log('Lot 14 — la direction répond');
test('ACCEPTER : la demande passe « Acceptée » ; un mail part au conducteur, sans aucun motif, avec l’appellation du planning', () => {
  const g = environnement({ direction: DIR1 });
  envoyer(g, 'kevin');
  g.now += 3600000;
  const r = decider(g, lien(g), 'accepter');
  assert.deepStrictEqual([r.code, r.data.etat, r.data.decideeLe], ['OK', 'Acceptée', '19/11/2026 à 11:00'], j(r));
  assert.strictEqual(suivi(g)[0][9], 'Acceptée');
  const m = g.mails[1];
  assert.deepStrictEqual([g.mails.length, m.to, m.sujet], [2, FRANCK, '[Loué App] Absence acceptée — Kévin ESSAI — Du 30/11/2026 au 02/12/2026']);
  assert.ok(/Salarié : Kévin ESSAI\nDate : Du 30\/11\/2026 au 02\/12\/2026\nDurée : Journée entière\nDans le planning : Absent/.test(m.texte), m.texte);
  ['médical', 'spécialiste', 'Opération', 'genou', 'Sans solde'].forEach(mot => assert.ok(j(m).indexOf(mot) < 0, '« ' + mot + ' » dans le mail au conducteur'));
  assert.ok(!m.opts.attachments, 'pas de PDF pour le conducteur');
  assert.ok(/^envoyé le 19\/11\/2026/.test(suivi(g)[0][11]), suivi(g)[0][11]);
});
test('REFUSER : la demande passe « Refusée » ; aucun mail au conducteur', () => {
  const g = environnement({ direction: DIR1 });
  envoyer(g, 'kevin');
  const r = decider(g, lien(g, 'refuser'), 'refuser');
  assert.deepStrictEqual([r.code, r.data.etat, suivi(g)[0][9], suivi(g)[0][11], g.mails.length], ['OK', 'Refusée', 'Refusée', '', 1]);
});
test('USAGE UNIQUE : une seconde réponse (autre directeur, double clic, autre bouton) ne change rien ; elle redit la réponse donnée ; pas de second mail', () => {
  const g = environnement({ direction: DIR1 + ',' + DIR2 });
  envoyer(g, 'kevin');
  decider(g, lien(g), 'accepter');
  const mails = g.mails.length;
  [['refuser', lien(g, 'refuser')], ['accepter', lien(g)]].forEach(([choix, l]) => {
    const r = decider(g, l, choix);
    assert.deepStrictEqual([r.ok, r.code, r.data.etat], [true, 'DEJA_DECIDE', 'Acceptée'], j(r));
  });
  assert.deepStrictEqual([suivi(g)[0][9], g.mails.length], ['Acceptée', mails]);
  assert.strictEqual(voir(g, lien(g)).data.etat, 'Acceptée', 'la page rouverte dit la réponse déjà donnée');
});
test('lien expiré (plus de 7 jours) : la page le dit, la réponse est refusée, la demande reste « En attente »', () => {
  const g = environnement({ direction: DIR1 });
  envoyer(g, 'kevin');
  const l = lien(g);
  g.now += 7 * JOUR - 60000;
  assert.strictEqual(voir(g, l).data.expire, false, 'encore valable une minute avant');
  g.now += 120000;
  assert.strictEqual(voir(g, l).data.expire, true);
  const r = decider(g, l, 'accepter');
  assert.deepStrictEqual([r.ok, r.code, suivi(g)[0][9], g.mails.length], [false, 'LIEN_EXPIRE', 'En attente', 1]);
});
test('serveur occupé au moment de la réponse : « appuyez de nouveau », rien n’est enregistré à moitié', () => {
  const g = environnement({ direction: DIR1 });
  envoyer(g, 'kevin');
  const vrai = g.contexte.LockService.getScriptLock;
  g.contexte.LockService.getScriptLock = () => ({ tryLock: () => false, releaseLock: () => {} });
  assert.strictEqual(decider(g, lien(g), 'accepter').code, 'SERVEUR_OCCUPE');
  g.contexte.LockService.getScriptLock = vrai;
  assert.strictEqual(suivi(g)[0][9], 'En attente');
  assert.strictEqual(decider(g, lien(g), 'accepter').code, 'OK');
});

console.log('Lot 14 — l’appellation (planning et mail au conducteur)');
test('Congés, École, Formation gardent leur nom ; santé = « Absent » même imputée sur les congés ; tout le reste = « Absent »', () => {
  const g = environnement({ direction: DIR1 });
  const L = (m, i) => g.ctx.absLibelle_(m, i);
  [['Congés', '', 'Congés'], ['congé', '', 'Congés'], ['École', '', 'École'], ['ecole CFA', '', 'École'], ['Formation', '', 'Formation'], ['formation CACES', 'Sans solde', 'Formation'],
    ['Personnel', 'Congés payés', 'Congés'], ['Sépulture', 'Repos compensateur, Congés payés', 'Congés'],
    ['Médical', '', 'Absent'], ['Médical', 'Congés payés', 'Absent'], ['Maladie', 'Congés payés', 'Absent'], ['Accident du travail', '', 'Absent'], ['arrêt', '', 'Absent'], ['Formation suite à un accident', '', 'Absent'],
    ['Personnel', 'Sans solde', 'Absent'], ['Sépulture', '', 'Absent'], ['Naissance', 'Repos compensateur', 'Absent'], ['un motif tapé à la main', '', 'Absent'], ['', '', 'Absent'], [undefined, undefined, 'Absent']]
    .forEach(([m, i, attendu]) => assert.strictEqual(L(m, i), attendu, '« ' + m + ' » / « ' + i + ' »'));
});
test('le mail au conducteur d’une absence « École » dit « École » ; d’une absence médicale imputée sur les congés, « Absent »', () => {
  const g = environnement({ direction: DIR1 });
  envoyer(g, 'kevin', demande({ motif: 'École', imputation: '' })); decider(g, lien(g), 'accepter');
  assert.ok(/Dans le planning : École/.test(g.mails[g.mails.length - 1].texte));
  envoyer(g, 'kevin', demande({ motif: 'Médical', imputation: 'Congés payés' })); decider(g, lien(g), 'accepter');
  const m = g.mails[g.mails.length - 1];
  assert.ok(/Dans le planning : Absent/.test(m.texte) && !/Congés|Médical/.test(m.texte), m.texte);
});
test('les dates de la demande sont lues pour le planning : un jour, une période, une semaine ; illisible = vide (à inscrire à la main)', () => {
  const g = environnement({ direction: DIR1 }), D = t => g.ctx.absDates_(t);
  egal(D('30/11/2026'), { du: '2026-11-30', au: '2026-11-30' });
  egal(D('Du 30/11/2026 au 04/12/2026'), { du: '2026-11-30', au: '2026-12-04' });
  egal(D('Semaine 53 (du lundi 28/12/2026 au vendredi 01/01/2027)'), { du: '2026-12-28', au: '2027-01-01' });
  ['', 'bientôt', '31/02/2026', 'Du 04/12/2026 au 30/11/2026', 'Du 01/01/2026 au 31/12/2027', '1/1/2026 2/1/2026 3/1/2026', undefined].forEach(t => egal(D(t), { du: '', au: '' }, String(t)));
});

console.log('Lot 14 — quand un mail ne peut pas partir');
test('quota du jour atteint : la demande n’est PAS reçue (le téléphone la garde) ; renvoyée plus tard, elle part — une seule ligne de suivi, aucun doublon', () => {
  const g = environnement({ direction: DIR1 + ',' + DIR2, quota: 1 });
  const id = idFiche(), r1 = envoyer(g, 'kevin', demande(), id);
  assert.deepStrictEqual([r1.ok, r1.code], [false, 'SERVEUR_OCCUPE'], j(r1));
  assert.ok(/gardée dans le téléphone/.test(r1.message), r1.message);
  assert.deepStrictEqual([fiches(g).length, suivi(g).length], [0, 1]);
  assert.deepStrictEqual(miennes(g, 'kevin').data.demandes, [], 'le poseur ne lit pas « En attente » tant que le mail à la direction n’est pas parti');
  const alerte = g.mails.filter(m => !/Demande d'absence/.test(m.sujet));
  assert.ok(alerte.length === 1 && /n’a pas pu partir vers la direction/.test(alerte[0].texte) && !/Kévin|médical|genou|30\/11/.test(j(alerte)), 'Franck est prévenu, sans aucun détail : ' + j(alerte));
  assert.strictEqual(g.feuilles['Mails en attente'], undefined, 'rien n’est rangé dans « Mails en attente »');
  ['médical', 'genou'].forEach(mot => assert.ok(toutLeSheet(g).indexOf(mot) < 0));
  g.etat.quota = 50;
  const r2 = envoyer(g, 'kevin', demande(), id);
  assert.deepStrictEqual([r2.code, r2.data.envoyes, fiches(g).length, suivi(g).length, g.feuilles['Absences'].lignes.length], ['ENREGISTRE', 2, 2, 1, 2], j(r2));
  assert.strictEqual(miennes(g, 'kevin').data.demandes.length, 1, 'maintenant il la voit');
  // … et renvoyée encore (réponse perdue) : « déjà reçue », aucun mail de plus
  assert.strictEqual(envoyer(g, 'kevin', demande(), id).code, 'DEJA_RECU');
  assert.strictEqual(fiches(g).length, 2);
});
test('le mail est parti mais l’exécution a été coupée avant de noter « traité » : le téléphone renvoie la demande, AUCUN second mail ne part à la direction', () => {
  const g = environnement({ direction: DIR1 });
  const id = idFiche(); envoyer(g, 'kevin', demande(), id);
  const envoi = g.feuilles['Envois'].lignes.filter(l => l[0] === id)[0];
  envoi[4] = 'en cours'; envoi[1] = new (envoi[1].constructor)(g.now - 10 * 60000);      // comme si l'exécution était morte il y a 10 minutes
  const r = envoyer(g, 'kevin', demande(), id);
  assert.strictEqual(r.ok, true, j(r));
  assert.deepStrictEqual([fiches(g).length, suivi(g).length], [1, 1]);
});
test('premier essai raté, puis le même numéro revient avec un AUTRE contenu : la ligne de suivi dit ce que dit le mail', () => {
  const g = environnement({ direction: DIR1, quota: 0 });
  const id = idFiche(); envoyer(g, 'kevin', demande({ dateAbsence: 'Du 30/11/2026 au 18/12/2026' }), id);
  g.etat.quota = 50;
  envoyer(g, 'kevin', demande({ dateAbsence: '30/11/2026', duree: 'Matin', motif: 'École' }), id);
  assert.ok(fiches(g)[0].texte.indexOf('Date : 30/11/2026') > -1);
  egal(suivi(g)[0].slice(4, 9), ['30/11/2026', '2026-11-30', '2026-11-30', 'Matin', 'École']);
  assert.strictEqual(suivi(g).length, 1);
});
test('demande d’UN SEUL JOUR : la date est écrite comme un texte (pas par « ajouter une ligne », que le tableur transformerait en date)', () => {
  const g = environnement({ direction: DIR1 });
  envoyer(g, 'kevin');                                     // crée les onglets
  ['Absences suivi', 'Absences'].forEach(n => { g.feuilles[n].api.appendRow = () => { throw new Error('appendRow ne doit plus servir pour ' + n); }; });
  const r = envoyer(g, 'kevin', demande({ dateAbsence: '30/11/2026' }));
  assert.strictEqual(r.code, 'ENREGISTRE', j(r));
  egal(suivi(g)[1].slice(2, 7), ['kevin', 'Kévin ESSAI', '30/11/2026', '2026-11-30', '2026-11-30']);
  assert.strictEqual(voir(g, lien(g)).data.dateAbsence, '30/11/2026');
  assert.strictEqual(g.feuilles['Absences'].lignes[2][3], '30/11/2026');
});
test('pas plus de 5 demandes par compte et par jour (chacune envoie des mails) : la sixième est refusée pour de bon, sans mail ; le lendemain, c’est reparti', () => {
  const g = environnement({ direction: DIR1 });
  for (let i = 0; i < 5; i++) assert.strictEqual(envoyer(g, 'kevin').code, 'ENREGISTRE');
  const r = envoyer(g, 'kevin');
  assert.deepStrictEqual([r.ok, r.code], [false, 'DONNEES_INVALIDES'], j(r));
  assert.ok(/Déjà 5 demandes d’absence aujourd’hui/.test(r.message), r.message);
  assert.deepStrictEqual([fiches(g).length, suivi(g).length], [5, 5]);
  assert.strictEqual(envoyer(g, 'thomas27', demande({ nom: 'Thomas ESSAI' })).code, 'ENREGISTRE', 'un autre compte n’est pas gêné');
  g.now += JOUR;
  assert.strictEqual(envoyer(g, 'kevin').code, 'ENREGISTRE');
});
test('Gmail refuse tous les mails : même chose, le téléphone garde ; aucune alerte ne contient la demande', () => {
  const g = environnement({ direction: DIR1 });
  refuser(g, [DIR1]);
  const r = envoyer(g, 'kevin');
  assert.deepStrictEqual([r.ok, r.code], [false, 'SERVEUR_OCCUPE']);
  assert.ok(!/médical|genou|Kévin/.test(j(g.mails)), j(g.mails));
});
test('une adresse de la direction sur deux échoue : la demande est reçue (l’autre est prévenue) ; Franck reçoit une alerte sans aucun détail de la demande', () => {
  const g = environnement({ direction: DIR1 + ',' + DIR2 });
  refuser(g, [DIR2]);
  const r = envoyer(g, 'kevin');
  assert.deepStrictEqual([r.code, r.data.envoyes], ['ENREGISTRE', 1], j(r));
  const alerte = g.mails.filter(m => m.to !== DIR1)[0];
  assert.ok(alerte && !/Kévin|médical|genou|30\/11/.test(j(alerte)), j(alerte));
});
test('le mail au conducteur ne peut pas partir (quota) : noté « à envoyer », renvoyé par le passage de 10 minutes, une seule fois', () => {
  const g = environnement({ direction: DIR1 });
  envoyer(g, 'kevin');
  g.etat.quota = 0;
  assert.strictEqual(decider(g, lien(g), 'accepter').code, 'OK', 'la réponse est enregistrée quand même');
  assert.deepStrictEqual([suivi(g)[0][9], suivi(g)[0][11], g.proprietes.ABS_MAIL_A_ENVOYER, g.mails.length], ['Acceptée', 'à envoyer', '1', 1]);
  g.ctx.traiterComptes();
  assert.strictEqual(suivi(g)[0][11], 'à envoyer', 'toujours pas de quota');
  g.etat.quota = 30; g.ctx.traiterComptes();
  assert.ok(/^envoyé le/.test(suivi(g)[0][11]));
  assert.deepStrictEqual([g.mails.filter(m => /Absence acceptée/.test(m.sujet)).length, g.proprietes.ABS_MAIL_A_ENVOYER], [1, undefined]);
  g.ctx.traiterComptes();
  assert.strictEqual(g.mails.filter(m => /Absence acceptée/.test(m.sujet)).length, 1);
});
test('le passage de 10 minutes tombe PENDANT l’envoi du mail au conducteur : un seul mail part ; un envoi resté « en cours » plus de 15 minutes est repris', () => {
  const g = environnement({ direction: DIR1 });
  envoyer(g, 'kevin');
  g.etat.quota = 0; decider(g, lien(g), 'accepter'); g.etat.quota = 50;
  g.feuilles['Absences suivi'].lignes[1][11] = 'envoi en cours ' + g.now;              // un autre passage est en train de l'envoyer
  g.ctx.traiterComptes();
  assert.strictEqual(g.mails.filter(m => /Absence acceptée/.test(m.sujet)).length, 0, 'pas de second envoi par-dessus');
  g.now += 16 * 60000; g.ctx.traiterComptes();                                           // l'autre passage est mort : celui-ci reprend
  assert.strictEqual(g.mails.filter(m => /Absence acceptée/.test(m.sujet)).length, 1);
  assert.ok(/^envoyé le/.test(suivi(g)[0][11]));
  g.ctx.traiterComptes();
  assert.strictEqual(g.mails.filter(m => /Absence acceptée/.test(m.sujet)).length, 1);
});
test('aucun conducteur coché « par défaut » : le mail va à l’adresse de Franck (EMAIL_ADMIN ou le compte)', () => {
  const g = environnement({ direction: DIR1 });
  g.feuilles['Contacts'].lignes[1][5] = 'N';
  envoyer(g, 'kevin'); decider(g, lien(g), 'accepter');
  assert.strictEqual(g.mails[1].to, 'franck@loue.test');
});

console.log('Lot 14 — le poseur voit l’état de ses demandes');
test('ses demandes à lui, la plus récente en haut : En attente, Acceptée, Refusée ; jamais celles d’un autre ; aucun motif', () => {
  const g = environnement({ direction: DIR1 });
  envoyer(g, 'kevin', demande({ dateAbsence: '30/11/2026' })); const l1 = lien(g); g.now += 60000;
  envoyer(g, 'kevin', demande({ dateAbsence: '07/12/2026' })); const l2 = lien(g, 'refuser'); g.now += 60000;
  envoyer(g, 'kevin', demande({ dateAbsence: '14/12/2026' })); g.now += 60000;
  envoyer(g, 'thomas27', demande({ nom: 'Thomas ESSAI', dateAbsence: '21/12/2026' }));
  decider(g, l1, 'accepter'); decider(g, l2, 'refuser');
  const r = miennes(g, 'kevin');
  assert.strictEqual(r.data.suivi, true);
  assert.deepStrictEqual(r.data.demandes.map(d => [d.dateAbsence, d.duree, d.etat]), [['14/12/2026', 'Journée entière', 'En attente'], ['07/12/2026', 'Journée entière', 'Refusée'], ['30/11/2026', 'Journée entière', 'Acceptée']]);
  assert.ok(!/médical|genou|Thomas/.test(j(r)), j(r));
  assert.deepStrictEqual(miennes(g, 'thomas27').data.demandes.map(d => d.dateAbsence), ['21/12/2026']);
});
test('sans réponse depuis plus de 7 jours : « Sans réponse » ; sans compte ou jeton faux : rien n’est donné', () => {
  const g = environnement({ direction: DIR1 });
  envoyer(g, 'kevin');
  g.now += 7 * JOUR + 60000;
  assert.strictEqual(miennes(g, 'kevin').data.demandes[0].etat, 'Sans réponse');
  assert.ok(!poster(g, { action: 'absencesMiennes', jeton: 'faux' }).ok);
});
test('retour arrière (réglage retiré) : le poseur voit encore ses demandes déjà faites, et le lien du mail déjà parti marche toujours', () => {
  const g = environnement({ direction: DIR1 });
  envoyer(g, 'kevin'); const l = lien(g);
  delete g.proprietes.ABSENCE_DIRECTION;
  const r = miennes(g, 'kevin').data;
  assert.deepStrictEqual([r.suivi, r.direction, r.demandes.length], [true, false, 1]);
  assert.strictEqual(decider(g, l, 'refuser').data.etat, 'Refusée');
  assert.deepStrictEqual(miennes(g, 'thomas27').data, { suivi: false, direction: false, demandes: [], jours: 7 });
});
test('ancienne page (fiche sans numéro, période de transition) avec le lot allumé : la demande est traitée, le serveur lui donne un numéro', () => {
  const g = environnement({ direction: DIR1 });
  let rep = null;
  try { rep = poster(g, demande()); } catch (e) { rep = { erreur: e.message }; }
  if (fiches(g).length) { assert.ok(/^abs-[0-9a-f-]{20,}$/.test(String(suivi(g)[0][0])), String(suivi(g)[0][0])); assert.ok(voir(g, lien(g)).ok, 'son lien marche'); }
  else assert.ok(/CONNEXION|connect/i.test(j(rep)), 'transition fermée : ' + j(rep));
});
test('une demande envoyée par un téléphone sans compte (période de transition) est traitée, mais n’est rattachée à personne', () => {
  const g = environnement({ direction: DIR1 });
  const r = envoyer(g, null);
  if (r.code === 'ENREGISTRE') { assert.strictEqual(suivi(g)[0][2], ''); assert.deepStrictEqual(miennes(g, 'kevin').data.demandes, []); }
  else assert.ok(/CONNEXION/.test(r.code), j(r));   // transition fermée : la page demande de se connecter
});

console.log('Lot 14 — la livraison');
test('le serveur à coller contient le lot 14, éteint ; aucune adresse de direction dans le code', () => {
  const code = fs.readFileSync(path.join(RACINE, 'A-COLLER-DANS-APPS-SCRIPT', 'Code.gs'), 'utf8');
  ["const VERSION_API = 'v11.4'", 'function absTraiter_(', 'function absVoir_(', 'function absDecider_(', 'function absMiennes_(', 'function absPassage_(', "const ABS_PROP_DIRECTION = 'ABSENCE_DIRECTION'"]
    .forEach(t => assert.ok(code.indexOf(t) > -1, t));
  assert.ok(!/ABSENCE_DIRECTION\s*=\s*['"][^'"]*@/.test(code));
  assert.ok(/VERSION_APPLI = '10\.5'/.test(fs.readFileSync(path.join(RACINE, 'commun', 'config.js'), 'utf8')));
});
test('la page de réponse de la direction n’est jamais gardée ni servie par le cache hors réseau (son adresse porte le lien signé)', () => {
  const sw = fs.readFileSync(path.join(RACINE, 'sw.js'), 'utf8');
  assert.ok(/if \(\/\\\/absence-reponse\\\.html\$\/\.test\(url\.pathname\)\) return;/.test(sw), 'exclusion absente de sw.js');
  assert.ok(sw.indexOf("'absence-reponse.html'") < 0, 'pas dans la liste des pages gardées');
  assert.ok(sw.indexOf('absence-reponse') < sw.indexOf('respondWith'), 'l’exclusion est AVANT toute réponse du cache');
});
test('le motif n’est écrit par le lot 14 qu’à un seul endroit du programme : le mail à la direction', () => {
  const code = fs.readFileSync(path.join(RACINE, 'apps-script', 'Absences.gs'), 'utf8').replace(/\/\/.*$/gm, '');
  const usages = code.split('\n').filter(l => /brut\.(motif|precisions)/.test(l));
  assert.ok(usages.length >= 2 && usages.every(l => /absLibelle_\(brut\.motif|\['Motif', brut\.motif|\['Précisions', brut\.precisions/.test(l)), usages.join('\n'));
});

console.log('\n' + reussis + ' test(s) réussi(s)' + (process.exitCode ? ' — DES TESTS ONT ÉCHOUÉ' : ''));
