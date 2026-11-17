// Tests du lot 5, ligne « Mails envoyés de plus de 3 mois » de l'onglet Purges : node tests/lot5-mails.test.js
// Tout se passe dans le faux Google (tests/gas-harness.js) : aucun vrai mail n'est lu, envoyé ni mis à la corbeille.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { creerGoogle, chargerScript } = require('./gas-harness');

const RACINE = path.join(__dirname, '..');
const JOUR = 24 * 3600 * 1000;
const MAINTENANT = new Date(2026, 10, 16, 10, 0).getTime();
const COMPTE = 'franck@loue.test';   // le compte Google de l'appli (celui du faux Google)
const QUOI = 'Mails envoyés de plus de 3 mois';
const PDF = 150000;                  // taille du PDF joint aux mails, et du même PDF rangé dans le dossier Drive du chantier
const QUITUS = '05 - CHANTIER/OPR - RESERVES - QUITUS';
const P = { chantier: 0, quoi: 1, poids: 2, fichiers: 3, possible: 4, pourquoi: 5, corbeille: 6, etat: 7, message: 8, faitLe: 9, nbFaits: 10, libere: 11, annuler: 12, jusquau: 13, maj: 14, cle: 15 };
const D = { cle: 0, type: 1, id: 2, chemin: 3, taille: 4, fichiers: 5, note: 6, etat: 7, maj: 8 };

const mail = (id, o) => Object.assign({ id: id, labels: ['SENT'], taille: 200 * 1024, date: MAINTENANT - 120 * JOUR, de: 'Loué Menuiserie <' + COMPTE + '>',
  a: 'seb@loue.test', cc: '', cci: '', objet: '[Loué App] Quitus — CHANTIER A', pj: true, pjTaille: PDF }, o || {});
// Deux mails de fiches de chantier à purger, et tout ce qui ne doit JAMAIS partir
const JAMAIS = ['recu', 'transfere', 'sansPJ', 'recent', 'aMoi', 'cciMoi', 'etoile', 'aussiRecu', 'brouillon', 'adresseLibre', 'aLaMain', 'absence', 'chantierInconnu',
  'rangementEchoue', 'libellePerso', 'important', 'autreFiche'];
function boite() {
  return [
    mail('bon1'), mail('bon2', { objet: '[Loué App] Note de réunion — CHANTIER B — point du lundi', a: 'client@exemple.test, archi@exemple.test', taille: 300 * 1024 }),
    mail('recu', { labels: ['INBOX'], de: 'Client <client@exemple.test>', a: COMPTE, objet: 'RE: [Loué App] Quitus — CHANTIER A' }),
    mail('transfere', { objet: 'TR: [Loué App] Quitus — CHANTIER A' }),
    mail('sansPJ', { objet: '[Loué App] Quitus — CHANTIER A', pj: false }),
    mail('recent', { date: MAINTENANT - 10 * JOUR }),
    mail('aMoi', { a: 'franck+contact1@loue.test' }),
    mail('cciMoi', { cci: COMPTE }),
    mail('etoile', { labels: ['SENT', 'STARRED'] }),
    mail('aussiRecu', { labels: ['SENT', 'INBOX'] }),
    mail('brouillon', { labels: ['DRAFT'] }),
    mail('adresseLibre', { objet: 'Loué Menuiserie — Quitus — CHANTIER A' }),
    mail('aLaMain', { de: 'Franck <' + COMPTE + '>' }),
    mail('absence', { objet: "[Loué App] Demande d'absence — DUPONT Jean — 01/08/2026" }),             // PDF hors chantier, jamais recopié sur le PC
    mail('chantierInconnu', { objet: '[Loué App] Quitus — CHANTIER PAS DANS LA LISTE' }),                // fiche rangée dans « _À CLASSER »
    mail('rangementEchoue', { objet: '[Loué App] Quitus — CHANTIER A', pjTaille: 777777 }),              // aucun PDF de cette taille dans le dossier du chantier
    mail('libellePerso', { labels: ['SENT', 'Label_7'] }),
    mail('important', { labels: ['SENT', 'IMPORTANT'] }),
    mail('autreFiche', { objet: '[Loué App] Fiche inventée — CHANTIER A' }),
  ];
}
function environnement(o = {}) {
  const chantiers = o.chantiers || ['CHANTIER A', 'CHANTIER B'];
  const g = creerGoogle({
    nomSheet: o.test ? 'ChantierPro TEST' : 'ChantierPro',
    proprietes: Object.assign({ DRIVE_ROOT_ID: 'RACINE', DRIVE_PLANNING_ID: 'PLANNING', EMAIL_ADMIN: 'bureau@loue.test' }, o.test ? { ENVIRONNEMENT: 'TEST' } : {}, o.proprietes || {}),
    feuilles: { 'Chantiers': [['Nom', 'Référence', 'Statut', 'Conducteur', 'N°', 'Nom court', 'Adresse', 'Client', 'Architecte', 'Date « Terminé »', 'Chemin MEGA']]
        .concat(chantiers.map(n => [n, 'LIEU', 'En cours', 'Franck', '', '', '', '', '', '', ''])),
      'Dossiers chantiers': [['Chantier', 'Dossier Drive', 'Identifiant du dossier', 'Trouvé par', 'À vérifier']].concat(chantiers.map((n, i) => [n, n, 'D' + i, 'créé', ''])) },
    gmail: o.sansGmail ? undefined : (o.gmail || boite()),
  });
  const racine = g.creerElement('dossier', o.test ? 'CHANTIERPRO-TEST' : 'Loué Menuiserie - Chantiers', null, { id: 'RACINE' });
  g.creerElement('dossier', 'Planning', null, { id: 'PLANNING' });
  // le PDF de chaque fiche est rangé dans le dossier Drive de son chantier (même taille que la pièce jointe du mail)
  g.pdf = chantiers.map((n, i) => {
    let d = g.creerElement('dossier', n, racine, { id: 'D' + i });
    QUITUS.split('/').forEach(nom => { d = g.creerElement('dossier', nom, d); });
    return g.creerElement('fichier', 'QUITUS ' + n + ' 2026-07-01.pdf', d, { taille: PDF });
  });
  g.ctx = chargerScript(g);
  g.now = MAINTENANT;
  g.ctx.maintenant_ = () => g.now;
  return g;
}
const ligne = g => (g.feuilles['Purges'] ? g.feuilles['Purges'].lignes.slice(1).filter(l => l && l[P.quoi] === QUOI).pop() : undefined);
const detail = g => (g.feuilles['Purges détail'] ? g.feuilles['Purges détail'].lignes.slice(1).filter(l => l && l[D.cle]) : []);
const aLaCorbeille = g => g.etat.gmail.filter(m => m.labels.indexOf('TRASH') > -1).map(m => m.id).sort();
const mesurer = g => g.ctx.mesurerStockage();
const cocherEtTraiter = g => { mesurer(g); ligne(g)[P.corbeille] = true; return g.ctx.traiterPurges(); };
const constante = (g, nom) => Array.from(require('vm').runInContext(nom, g.ctx));

let reussis = 0;
function test(nom, fn) {
  try { fn(); reussis++; console.log('  ✓ ' + nom); }
  catch (e) { console.log('  ✗ ' + nom + '\n    ' + String(e.stack || e.message).split('\n').slice(0, 12).join('\n    ')); process.exitCode = 1; }
}

console.log('Lot 5 — mails envoyés de plus de 3 mois');
test('la règle, mail par mail : seuls les mails de fiches de chantier envoyés par l’appli, dont le PDF est rangé dans le dossier du chantier', () => {
  const g = environnement(), ctx = g.ctx.prgContexte_(), regles = g.ctx.prgMailsRegles_();
  const refus = id => g.ctx.prgMailRefus_(g.ctx.prgMailLu_(id), regles, ctx, true);
  assert.deepStrictEqual([refus('bon1'), refus('bon2')], ['', '']);
  assert.ok(/pas dans les messages envoyés/.test(refus('recu')));
  assert.ok(/ne commence pas par « \[Loué App\] »/.test(refus('transfere')));
  assert.ok(/sans pièce jointe/.test(refus('sansPJ')));
  assert.ok(/depuis moins de 90 jours/.test(refus('recent')));
  assert.ok(/lui-même destinataire/.test(refus('aMoi')) && /lui-même destinataire/.test(refus('cciMoi')));
  assert.ok(/étoile/.test(refus('etoile')) && /boîte de réception/.test(refus('aussiRecu')) && /pas dans les messages envoyés/.test(refus('brouillon')));
  assert.ok(/ne commence pas par/.test(refus('adresseLibre')), 'les mails aux adresses tapées à la main ne sont pas visés');
  assert.ok(/nom de l’expéditeur/.test(refus('aLaMain')));
  // N1 : jamais une demande d'absence, une fiche d'un chantier inconnu, une fiche dont le rangement a échoué, un autre type de mail
  assert.strictEqual(refus('absence'), 'demande d’absence : jamais visée');
  assert.ok(/chantier inconnu de l’onglet Chantiers \(fiche rangée dans « _À CLASSER » \?\)/.test(refus('chantierInconnu')), refus('chantierInconnu'));
  assert.ok(/PDF de la fiche introuvable dans le dossier Drive du chantier \(rangement échoué, ou chantier déjà purgé\)/.test(refus('rangementEchoue')), refus('rangementEchoue'));
  assert.strictEqual(refus('autreFiche'), 'pas une fiche de chantier de la liste');
  // m1 : jamais un mail qui porte un libellé de l'utilisateur, ni « Important »
  assert.strictEqual(refus('libellePerso'), 'porte un libellé');
  assert.strictEqual(refus('important'), 'marqué « Important »');
  g.etat.gmail.push(mail('autreCompte', { de: 'Loué Menuiserie <autre@loue.test>' }), mail('deja', { labels: ['SENT', 'TRASH'] }), mail('brouillonEnvoye', { labels: ['SENT', 'DRAFT'] }),
    mail('spam', { labels: ['SENT', 'SPAM'] }), mail('categorie', { labels: ['SENT', 'CATEGORY_PERSONAL'] }), mail('nonLu', { labels: ['SENT', 'UNREAD'] }));
  assert.ok(/pas envoyé par ce compte/.test(refus('autreCompte')) && /déjà à la corbeille/.test(refus('deja')) && /brouillon/.test(refus('brouillonEnvoye')) && /indésirable/.test(refus('spam')));
  assert.strictEqual(refus('categorie'), '', 'une catégorie posée par Gmail n’est pas un libellé de l’utilisateur');
  assert.strictEqual(refus('nonLu'), 'porte un libellé', 'tout libellé inconnu : pas visé');
  // le dossier Drive du chantier n'est plus sûr (« À vérifier ») : plus aucun mail de ce chantier
  g.feuilles['Dossiers chantiers'].lignes[1][4] = 'OUI — à vérifier';
  assert.strictEqual(g.ctx.prgMailRefus_(g.ctx.prgMailLu_('bon1'), g.ctx.prgMailsRegles_(), g.ctx.prgContexte_(), true), 'dossier Drive du chantier non sûr');
  // le chantier a été purgé (le PDF est à la corbeille de Drive) : son mail n'est plus visé
  const g3 = environnement();
  g3.pdf[0].corbeille = true;
  assert.ok(/introuvable dans le dossier Drive du chantier/.test(g3.ctx.prgMailRefus_(g3.ctx.prgMailLu_('bon1'), g3.ctx.prgMailsRegles_(), g3.ctx.prgContexte_(), true)));
});
// Lot 5b (« un seul mail par fiche ») : Purges.gs n'a PAS été modifié. Ce test prouve qu'un mail groupé — « À » vide, toutes
// les adresses connues en copie cachée, ou « À » = le conducteur — est lu, trouvé et jugé comme un mail ordinaire.
test('lot 5b — mail groupé (« À » vide, plusieurs copies cachées) : reconnu et visé comme un mail ordinaire ; jamais si le compte est l’une des copies cachées', () => {
  const cci = 'seb@loue.test, client@exemple.test, archi@exemple.test';
  const g = environnement({ gmail: boite().concat([
    mail('groupe', { a: '', cci: cci, taille: 210 * 1024 }),                                            // réglage « cache »
    mail('groupeConducteur', { a: 'seb@loue.test', cci: 'client@exemple.test, archi@exemple.test' }),   // réglage « conducteur »
    mail('groupeAvecCompte', { a: '', cci: 'seb@loue.test, ' + COMPTE }),
    mail('groupeAvecAlias', { a: '', cci: 'seb@loue.test, franck+contact1@loue.test' }),
    mail('groupeRecent', { a: '', cci: cci, date: MAINTENANT - 10 * JOUR }),
  ]) });
  const ctx = g.ctx.prgContexte_(), regles = g.ctx.prgMailsRegles_();
  assert.strictEqual(g.ctx.prgMailLu_('groupe').a, cci, 'les copies cachées sont lues comme des destinataires');
  const refus = id => g.ctx.prgMailRefus_(g.ctx.prgMailLu_(id), regles, ctx, true);
  assert.deepStrictEqual([refus('groupe'), refus('groupeConducteur')], ['', '']);
  assert.ok(/lui-même destinataire/.test(refus('groupeAvecCompte')) && /lui-même destinataire/.test(refus('groupeAvecAlias')), 'comme aujourd’hui le mail envoyé à l’adresse du compte');
  assert.ok(/depuis moins de 90 jours/.test(refus('groupeRecent')));
  // la recherche dans Gmail les trouve, et la case cochée les met à la corbeille avec les autres
  const trouves = Array.from(g.ctx.prgMailsListe_(regles, 100).ids);
  assert.ok(trouves.indexOf('groupe') > -1 && trouves.indexOf('groupeConducteur') > -1 && trouves.indexOf('groupeAvecCompte') < 0, trouves.join());
  cocherEtTraiter(g);
  assert.deepStrictEqual(aLaCorbeille(g), ['bon1', 'bon2', 'groupe', 'groupeConducteur']);
});
test('N1 — liste FERMÉE des fiches de chantier : tout objet de mail « [Loué App] … » écrit par le serveur est soit dans la liste, soit dans les « jamais »', () => {
  const g = environnement();
  const liste = constante(g, 'PRG_MAILS_FICHES'), jamais = constante(g, 'PRG_MAILS_JAMAIS');
  const trouves = {};
  ['Documents.gs', 'Signalements.gs', 'Api.gs', 'Notes.gs', 'Carnet.gs'].forEach(f => {
    fs.readFileSync(path.join(RACINE, 'apps-script', f), 'utf8').split('\n').forEach(l => {
      if (!/sujet/i.test(l)) return;
      const m = l.match(/\[Loué App\] ([^`]*)/);
      if (!m) return;
      const suite = m[1];
      if (suite.indexOf('${') === 0) (suite.slice(0, suite.indexOf('}')).match(/'[^']+'/g) || []).forEach(x => { trouves[x.slice(1, -1)] = f; });   // ${a ? 'X' : 'Y'}
      else trouves[suite.split(' — ')[0].trim()] = f;
    });
  });
  const noms = Object.keys(trouves).sort();
  assert.ok(noms.length >= 10, 'objets trouvés dans les sources : ' + noms.join(' | '));
  noms.forEach(n => assert.ok(liste.indexOf(n) > -1 || jamais.indexOf(n) > -1,
    'nouvel objet de mail « ' + n + ' » (' + trouves[n] + ') : décider s’il entre dans PRG_MAILS_FICHES (fiche de chantier dont le PDF est rangé dans le dossier du chantier) ou dans PRG_MAILS_JAMAIS'));
  liste.concat(jamais).forEach(n => assert.ok(trouves[n], '« ' + n + ' » n’est plus un objet envoyé par le serveur : le retirer de la liste'));
  assert.deepStrictEqual(jamais, ["Demande d'absence"]);
  assert.ok(liste.indexOf("Demande d'absence") < 0);
});
test('la mesure de la nuit propose UNE ligne, à clé fixe ; la phrase dit vrai, et dit ce qui n’est jamais visé ; rien n’est mis à la corbeille', () => {
  const g = environnement();
  mesurer(g);
  const l = ligne(g);
  assert.deepStrictEqual([l[P.chantier], l[P.quoi], l[P.possible], l[P.etat], l[P.corbeille], l[P.annuler]], ['(tout le compte)', QUOI, 'oui', 'Proposé', false, false], l[P.pourquoi]);
  assert.strictEqual(l[P.cle], 'mails|(tout le compte)|envoyes|1');
  assert.strictEqual(l[P.fichiers], 3, 'estimation « au plus » : le PDF dans Drive n’est vérifié qu’au moment de la purge');
  assert.ok(/^Possible : au plus environ 3 mail\(s\) de fiches de chantier envoyé\(s\) par l’appli avant le 18\/08\/2026/.test(l[P.pourquoi]), l[P.pourquoi]);
  assert.ok(/les PDF de ces fiches sont rangés dans le Drive et recopiés dans le dossier du chantier sur le PC/.test(l[P.pourquoi]) && /Un mail ne part que si le PDF de sa fiche est retrouvé dans le dossier Drive de son chantier/.test(l[P.pourquoi]));
  assert.ok(/Jamais visés : les demandes d’absence, les fiches d’un chantier inconnu ou mal rangées, les mails aux adresses tapées à la main/.test(l[P.pourquoi]) && /« Important » ou portant un libellé/.test(l[P.pourquoi]));
  assert.ok(/Avant de cocher : vérifie/.test(l[P.pourquoi]) && /30 jours plus tard/.test(l[P.pourquoi]) && !/restent dans Drive/.test(l[P.pourquoi]));
  assert.deepStrictEqual(aLaCorbeille(g), []);
  mesurer(g); mesurer(g);
  assert.strictEqual(g.feuilles['Purges'].lignes.slice(1).filter(x => x[P.quoi] === QUOI).length, 1, 'toujours une seule ligne');
  assert.strictEqual(g.ctx.traiterPurges(), 'rien', 'jamais automatique : sans case cochée, rien');
  assert.deepStrictEqual(aLaCorbeille(g), []);
});
test('rien à gagner : pas de ligne ; service avancé Gmail absent : pas de ligne, et verifierConfig le dit clairement (N3)', () => {
  let g = environnement({ gmail: boite().filter(m => !/^bon|rangementEchoue/.test(m.id)) });
  mesurer(g);
  assert.strictEqual(ligne(g), undefined);
  g = environnement({ sansGmail: true });
  assert.ok(/^Tour de mesure terminé/.test(mesurer(g)));
  assert.strictEqual(ligne(g), undefined);
  assert.ok(/➖ Service avancé Gmail .* : absent, cette ligne ne sera pas proposée \(éditeur → Services → Gmail API\)/.test(g.ctx.verifierConfig()));
  assert.ok(/✅ Service avancé Gmail/.test(environnement().ctx.verifierConfig()));
  ['apps-script/Purges.gs', 'apps-script/Stockage.gs', 'docs/lot5-procedure.md', 'CHANGELOG.md'].forEach(f =>
    assert.ok(!/déjà dans (le|son) manifeste/.test(fs.readFileSync(path.join(RACINE, f), 'utf8')), f + ' : rien ne prouve que le service avancé Gmail est déjà activé'));
});
test('case cochée : seuls les deux mails de fiches de chantier partent ; UNE lecture par mail ; journal écrit AVANT, sans rien d’un mail non visé ; compte rendu ; rien dans Drive', () => {
  const g = environnement();
  mesurer(g);
  ligne(g)[P.corbeille] = true;
  const fautes = [];
  g.etat.avantCorbeilleMail = m => {
    const d = detail(g).filter(x => x[D.id] === m.id)[0];
    if (!d || d[D.etat] !== 'à faire') fautes.push(m.id + ' : pas noté « à faire » avant sa mise à la corbeille');
    if (!g.etat.flush) fautes.push('journal pas encore enregistré');
  };
  const avant = g.mails.length, lectures = g.etat.lecturesMail, trouves = g.ctx.prgMailsListe_(g.ctx.prgMailsRegles_(), 999).ids.length;
  assert.strictEqual(g.ctx.traiterPurges(), '1 ligne(s) traitée(s)');
  assert.deepStrictEqual(fautes, []);
  assert.deepStrictEqual(aLaCorbeille(g), ['bon1', 'bon2']);
  assert.ok(JAMAIS.every(id => g.etat.gmail.filter(m => m.id === id)[0].labels.indexOf('TRASH') < 0), 'aucun des mails à ne jamais toucher');
  assert.strictEqual(g.etat.gmail.length, boite().length, 'aucun mail supprimé');
  assert.strictEqual(g.etat.lecturesMail - lectures, trouves, 'm5 : une seule lecture par mail trouvé (' + trouves + '), aucune de plus avant la corbeille');
  const d = detail(g);
  assert.deepStrictEqual(d.map(x => [x[D.cle], x[D.type], x[D.id], x[D.etat]]), [['mails|(tout le compte)|envoyes|1', 'mail', 'bon1', 'fait'], ['mails|(tout le compte)|envoyes|1', 'mail', 'bon2', 'fait']],
    'm6 : le journal ne contient que les mails visés');
  assert.ok(/^\d\d\/\d\d\/2026 \d\d:\d\d — \[Loué App\] Quitus — CHANTIER A$/.test(d[0][D.chemin]) && d[0][D.taille] === 200 * 1024, d[0][D.chemin]);
  assert.ok(!/DUPONT|PAS DANS LA LISTE|Fiche inventée/.test(JSON.stringify(g.feuilles['Purges détail'].lignes) + JSON.stringify(g.feuilles['Purges'].lignes)), 'rien d’un mail non visé n’est écrit dans le Sheet');
  const l = ligne(g);
  assert.deepStrictEqual([l[P.etat], l[P.nbFaits], l[P.corbeille]], ['Fait', 2, false]);
  assert.strictEqual(l[P.libere].getTime(), MAINTENANT + 30 * JOUR);
  assert.strictEqual(l[P.jusquau].getTime(), MAINTENANT + 25 * JOUR);
  assert.ok(/^2 mail\(s\) à la corbeille \(0,5 Mo\)\. Pour annuler : coche « Annuler » avant le 11\/12\/2026\./.test(l[P.message]), l[P.message]);
  assert.strictEqual(g.mails.length, avant + 1);
  const m = g.mails[avant];
  assert.strictEqual(m.to, 'bureau@loue.test');
  assert.ok(/Mise à la corbeille — \(tout le compte\) — Mails envoyés de plus de 3 mois/.test(m.sujet), m.sujet);
  assert.ok(/2 mail\(s\)/.test(m.texte) && /corbeille de Gmail/.test(m.texte) && !/corbeille de Drive/.test(m.texte) && /POUR ANNULER/.test(m.texte) && /Rien n’est supprimé définitivement/.test(m.texte), m.texte);
  assert.ok(/les PDF de ces fiches sont rangés dans le Drive et recopiés dans le dossier du chantier sur le PC/.test(m.texte) && /Jamais visés : les demandes d’absence/.test(m.texte) && !/restent dans Drive/.test(m.texte), m.texte);
  assert.strictEqual(g.etat.corbeilles.length, 0, 'rien dans Drive');
  assert.strictEqual(g.etat.verrousScript, 0);
  assert.strictEqual(g.ctx.traiterPurges(), 'rien');
});
test('« Annuler » (25 jours) : les mails ressortent de la corbeille de Gmail ; un mail supprimé à la main entre-temps est compté', () => {
  const g = environnement();
  cocherEtTraiter(g);
  g.etat.gmail = g.etat.gmail.filter(m => m.id !== 'bon2');   // supprimé définitivement dans la corbeille de Gmail, à la main
  g.now += 5 * JOUR;
  ligne(g)[P.annuler] = true; g.ctx.traiterPurges();
  assert.deepStrictEqual(aLaCorbeille(g), []);
  assert.deepStrictEqual(g.etat.gmail.filter(m => m.id === 'bon1')[0].labels, ['SENT'], 'le mail revient tel qu’il était, dans les messages envoyés');
  const l = ligne(g);
  assert.strictEqual(l[P.etat], 'Annulé');
  assert.ok(/1 mail\(s\) remis en place\./.test(l[P.message]) && /1 mail\(s\) n’ont PAS pu revenir/.test(l[P.message]), l[P.message]);
  const g2 = environnement();
  cocherEtTraiter(g2);
  g2.now += 26 * JOUR; ligne(g2)[P.annuler] = true; g2.ctx.traiterPurges();
  assert.ok(/Annulation refusée/.test(ligne(g2)[P.message]) && /corbeille de Gmail/.test(ligne(g2)[P.message]), ligne(g2)[P.message]);
  assert.deepStrictEqual(aLaCorbeille(g2), ['bon1', 'bon2']);
});
test('conditions revérifiées quand la case est traitée : un mail qui a changé depuis la proposition (libellé, réponse reçue, PDF absent de Drive) n’est pas touché', () => {
  let g = environnement();
  mesurer(g);
  g.etat.gmail.filter(m => /^bon/.test(m.id)).forEach((m, i) => m.labels.push(i ? 'Label_3' : 'INBOX'));
  ligne(g)[P.corbeille] = true; g.ctx.traiterPurges();
  assert.deepStrictEqual(aLaCorbeille(g), []);
  assert.deepStrictEqual([ligne(g)[P.etat], ligne(g)[P.corbeille]], ['Impossible', false]);
  assert.ok(/Rien n’a été mis à la corbeille/.test(ligne(g)[P.message]), ligne(g)[P.message]);
  assert.strictEqual(detail(g).length, 0);
  g = environnement();
  mesurer(g);
  g.pdf[1].corbeille = true;   // le PDF de la fiche du chantier B n'est plus dans Drive
  ligne(g)[P.corbeille] = true; g.ctx.traiterPurges();
  assert.deepStrictEqual(aLaCorbeille(g), ['bon1']);
  assert.deepStrictEqual([ligne(g)[P.etat], ligne(g)[P.nbFaits]], ['Fait', 1]);
});
test('beaucoup de mails, sur plusieurs jours (N2) : par passages, « En cours » entre deux, plafond du jour ; les délais se comptent depuis la PREMIÈRE mise à la corbeille', () => {
  const gmail = boite();
  for (let i = 0; i < 450; i++) gmail.push(mail('vieux' + i, { objet: '[Loué App] Prise de cotes — CHANTIER A', taille: 100 * 1024 }));
  const g = environnement({ gmail: gmail });
  mesurer(g);
  assert.ok(ligne(g)[P.possible] === 'oui' && ligne(g)[P.fichiers] > 300, 'estimation : ' + ligne(g)[P.fichiers]);
  ligne(g)[P.corbeille] = true;
  g.ctx.traiterPurges();
  const premier = aLaCorbeille(g).length;
  assert.ok(premier > 150 && premier <= 200, 'premier passage : ' + premier);
  assert.deepStrictEqual([ligne(g)[P.etat], ligne(g)[P.corbeille]], ['En cours', true]);
  assert.ok(/suite au prochain passage/.test(ligne(g)[P.message]) && ligne(g)[P.message].indexOf('Déjà ' + premier + ' mail(s) à la corbeille, depuis le 16/11/2026 : pour tout annuler, coche « Annuler » avant le 11/12/2026') > -1, ligne(g)[P.message]);
  assert.strictEqual(ligne(g)[P.jusquau].getTime(), MAINTENANT + 25 * JOUR, 'pendant la purge, la ligne donne déjà le vrai délai');
  g.proprietes.PURGE_TEMPS = JSON.stringify({ jour: g.ctx.jour_(), ms: 31 * 60 * 1000 });
  g.ctx.traiterPurges();
  assert.strictEqual(aLaCorbeille(g).length, premier, 'plafond du jour atteint : rien de plus');
  assert.ok(/la suite demain/.test(ligne(g)[P.message]));
  delete g.proprietes.PURGE_TEMPS;
  g.now += 7 * JOUR;   // la suite une semaine plus tard
  for (let n = 0; n < 8 && ligne(g)[P.etat] === 'En cours'; n++) g.ctx.traiterPurges();
  assert.strictEqual(aLaCorbeille(g).length, 452);
  const l = ligne(g);
  assert.deepStrictEqual([l[P.etat], l[P.nbFaits], l[P.corbeille]], ['Fait', 452, false]);
  assert.strictEqual(l[P.faitLe].getTime(), MAINTENANT, 'date de la première mise à la corbeille');
  assert.strictEqual(l[P.jusquau].getTime(), MAINTENANT + 25 * JOUR, 'annulation : 25 jours après la PREMIÈRE mise à la corbeille, pas après la fin');
  assert.strictEqual(l[P.libere].getTime(), MAINTENANT + 30 * JOUR);
  assert.ok(/Purge commencée le 16\/11\/2026, finie le 23\/11\/2026 : les délais se comptent depuis le début\. Pour annuler : coche « Annuler » avant le 11\/12\/2026\./.test(l[P.message]), l[P.message]);
  const rapports = g.mails.filter(m => /Mise à la corbeille/.test(m.sujet));
  assert.strictEqual(rapports.length, 1, 'un seul compte rendu, à la fin');
  assert.ok(/avant le 11\/12\/2026/.test(rapports[0].texte) && /libérée le 16\/12\/2026/.test(rapports[0].texte), rapports[0].texte);
  assert.strictEqual(detail(g).filter(x => x[D.etat] === 'fait').length, 452);
  assert.ok(JAMAIS.every(id => g.etat.gmail.filter(m => m.id === id)[0].labels.indexOf('TRASH') < 0), 'aucun des mails à ne jamais toucher');
  assert.strictEqual(g.proprietes.PURGE_MAILS_SAUT, undefined, 'le repère de reprise est effacé à la fin');
  // annulation le 26e jour après le DÉBUT : refusée (les premiers mails vont être supprimés par Gmail)
  g.now = MAINTENANT + 26 * JOUR; l[P.annuler] = true; g.ctx.traiterPurges();
  assert.ok(/Annulation refusée/.test(l[P.message]), l[P.message]);
});
test('copie TEST (même compte Google que la production) : seuls les mails du chantier d’essai sont visés ; l’âge réduit par PURGE_MAILS_JOURS_TEST ne vaut que sur TEST', () => {
  const essai = () => [mail('essaiVieux', { objet: '[Loué App] Quitus — CHANTIER TEST AUTO' }), mail('essaiRecent', { objet: '[Loué App] Quitus — CHANTIER TEST AUTO', date: MAINTENANT - 3 * JOUR })];
  const TOUS = ['CHANTIER A', 'CHANTIER B', 'CHANTIER TEST AUTO'];
  let g = environnement({ test: true, gmail: boite().concat(essai()), chantiers: TOUS });
  mesurer(g);
  assert.strictEqual(ligne(g)[P.fichiers], 1);
  assert.ok(/Sur la copie TEST : seulement les mails du chantier d’essai/.test(ligne(g)[P.pourquoi]));
  ligne(g)[P.corbeille] = true; g.ctx.traiterPurges();
  assert.deepStrictEqual(aLaCorbeille(g), ['essaiVieux'], 'les mails de la production (bon1, bon2) ne sont jamais touchés depuis la copie TEST');
  g = environnement({ test: true, gmail: boite().concat(essai()), chantiers: TOUS, proprietes: { PURGE_MAILS_JOURS_TEST: '1' } });
  cocherEtTraiter(g);
  assert.deepStrictEqual(aLaCorbeille(g), ['essaiRecent', 'essaiVieux']);
  g = environnement({ gmail: boite().concat(essai()), chantiers: TOUS, proprietes: { PURGE_MAILS_JOURS_TEST: '1' } });   // en production : propriété ignorée
  cocherEtTraiter(g);
  assert.deepStrictEqual(aLaCorbeille(g), ['bon1', 'bon2', 'essaiVieux'], 'jamais un mail de moins de 90 jours en production');
  g = environnement({ gmail: boite(), proprietes: { ENVIRONNEMENT: 'TEST' } });   // environnement incohérent : rien
  mesurer(g);
  assert.strictEqual(ligne(g), undefined);
});
test('ligne des mails : mêmes protections que les autres (deux cases, ligne mélangée)', () => {
  const g = environnement();
  mesurer(g);
  const l = ligne(g);
  l[P.corbeille] = true; l[P.annuler] = true; g.ctx.traiterPurges();
  assert.ok(/Les deux cases étaient cochées/.test(l[P.message]) && aLaCorbeille(g).length === 0);
  l[P.chantier] = 'CHANTIER A'; l[P.corbeille] = true; g.ctx.traiterPurges();
  assert.ok(/mélangée/.test(l[P.message]) && l[P.chantier] === '(tout le compte)' && aLaCorbeille(g).length === 0, l[P.message]);
});
test('jamais de suppression définitive de mail : ni dans les sources, ni dans le serveur à coller', () => {
  const INTERDITS = /Messages\s*\.\s*(remove|delete|batchDelete|batchModify|send|insert|import)|Threads\s*\.|Drafts\s*\.|moveThreadToTrash|moveMessageToTrash|\.deleteMessage|emptyTrash/;
  ['apps-script/Purges.gs', 'apps-script/Stockage.gs', 'A-COLLER-DANS-APPS-SCRIPT/Code.gs'].forEach(f => {
    const m = fs.readFileSync(path.join(RACINE, f), 'utf8').match(INTERDITS);
    assert.ok(!m, f + ' contient « ' + (m && m[0]) + ' »');
  });
  const code = fs.readFileSync(path.join(RACINE, 'apps-script/Purges.gs'), 'utf8');
  assert.deepStrictEqual((code.match(/Gmail\.Users\.Messages\.\w+/g) || []).filter((x, i, t) => t.indexOf(x) === i).sort(),
    ['Gmail.Users.Messages.get', 'Gmail.Users.Messages.list', 'Gmail.Users.Messages.trash', 'Gmail.Users.Messages.untrash'], 'les seuls appels à Gmail : lire, lister, corbeille, sortie de corbeille');
  assert.ok(!/GmailApp\.(search|getInboxThreads|moveThread|getMessageById)/.test(code), 'jamais par fil de discussion');
});

console.log('\n' + reussis + ' test(s) réussi(s)' + (process.exitCode ? ' — DES TESTS ÉCHOUENT' : ''));
