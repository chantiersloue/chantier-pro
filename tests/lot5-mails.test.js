// Tests du lot 5, ligne « Mails envoyés de plus de 3 mois » de l'onglet Purges : node tests/lot5-mails.test.js
// Tout se passe dans le faux Google (tests/gas-harness.js) : aucun vrai mail n'est lu, envoyé ni mis à la corbeille.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { creerGoogle, chargerScript } = require('./gas-harness');

const RACINE = path.join(__dirname, '..');
const JOUR = 24 * 3600 * 1000, MO = 1024 * 1024;
const MAINTENANT = new Date(2026, 10, 16, 10, 0).getTime();
const COMPTE = 'franck@loue.test';   // le compte Google de l'appli (celui du faux Google)
const QUOI = 'Mails envoyés de plus de 3 mois';
const P = { chantier: 0, quoi: 1, poids: 2, fichiers: 3, possible: 4, pourquoi: 5, corbeille: 6, etat: 7, message: 8, faitLe: 9, nbFaits: 10, libere: 11, annuler: 12, jusquau: 13, maj: 14, cle: 15 };
const D = { cle: 0, type: 1, id: 2, chemin: 3, taille: 4, fichiers: 5, note: 6, etat: 7, maj: 8 };

const mail = (id, o) => Object.assign({ id: id, labels: ['SENT'], taille: 200 * 1024, date: MAINTENANT - 120 * JOUR, de: 'Loué Menuiserie <' + COMPTE + '>',
  a: 'seb@loue.test', cc: '', cci: '', objet: '[Loué App] Quitus — CHANTIER A', pj: true }, o || {});
// Deux mails de l'appli à purger, et tout ce qui ne doit JAMAIS partir
function boite() {
  return [
    mail('bon1'), mail('bon2', { objet: '[Loué App] Note de réunion — CHANTIER B — point', a: 'client@exemple.test, archi@exemple.test', taille: 300 * 1024 }),
    mail('recu', { labels: ['INBOX'], de: 'Client <client@exemple.test>', a: COMPTE, objet: 'RE: [Loué App] Quitus — CHANTIER A' }),
    mail('transfere', { objet: 'TR: [Loué App] Quitus — CHANTIER A', de: 'Loué Menuiserie <' + COMPTE + '>' }),
    mail('sansPJ', { objet: '[Loué App] Place Google : 82 % utilisés', a: 'bureau@loue.test', pj: false }),
    mail('recent', { date: MAINTENANT - 10 * JOUR }),
    mail('aMoi', { a: 'franck+contact1@loue.test' }),
    mail('cciMoi', { cci: COMPTE }),
    mail('etoile', { labels: ['SENT', 'STARRED'] }),
    mail('aussiRecu', { labels: ['SENT', 'INBOX'] }),
    mail('brouillon', { labels: ['DRAFT'] }),
    mail('adresseLibre', { objet: 'Loué Menuiserie — Quitus — CHANTIER A' }),
    mail('aLaMain', { de: 'Franck <' + COMPTE + '>', objet: '[Loué App] mon mail à moi' }),
  ];
}
function environnement(o = {}) {
  const g = creerGoogle({
    nomSheet: o.test ? 'ChantierPro TEST' : 'ChantierPro',
    proprietes: Object.assign({ DRIVE_ROOT_ID: 'RACINE', DRIVE_PLANNING_ID: 'PLANNING', EMAIL_ADMIN: 'bureau@loue.test' }, o.test ? { ENVIRONNEMENT: 'TEST' } : {}, o.proprietes || {}),
    feuilles: { 'Chantiers': [['Nom', 'Référence', 'Statut', 'Conducteur', 'N°', 'Nom court', 'Adresse', 'Client', 'Architecte', 'Date « Terminé »', 'Chemin MEGA']],
      'Dossiers chantiers': [['Chantier', 'Dossier Drive', 'Identifiant du dossier', 'Trouvé par', 'À vérifier']] },
    gmail: o.sansGmail ? undefined : (o.gmail || boite()),
  });
  g.creerElement('dossier', o.test ? 'CHANTIERPRO-TEST' : 'Loué Menuiserie - Chantiers', null, { id: 'RACINE' });
  g.creerElement('dossier', 'Planning', null, { id: 'PLANNING' });
  g.ctx = chargerScript(g);
  g.now = MAINTENANT;
  g.ctx.maintenant_ = () => g.now;
  return g;
}
const ligne = g => (g.feuilles['Purges'] ? g.feuilles['Purges'].lignes.slice(1).filter(l => l && l[P.quoi] === QUOI).pop() : undefined);
const detail = g => (g.feuilles['Purges détail'] ? g.feuilles['Purges détail'].lignes.slice(1).filter(l => l && l[D.cle]) : []);
const aLaCorbeille = g => g.etat.gmail.filter(m => m.labels.indexOf('TRASH') > -1).map(m => m.id).sort();
const mesurer = g => g.ctx.mesurerStockage();

let reussis = 0;
function test(nom, fn) {
  try { fn(); reussis++; console.log('  ✓ ' + nom); }
  catch (e) { console.log('  ✗ ' + nom + '\n    ' + String(e.stack || e.message).split('\n').slice(0, 6).join('\n    ')); process.exitCode = 1; }
}

console.log('Lot 5 — mails envoyés de plus de 3 mois');
test('la règle, mail par mail : seuls les mails envoyés par l’appli, avec pièce jointe, de plus de 90 jours, que ce compte n’a pas reçus', () => {
  const g = environnement(), regles = g.ctx.prgMailsRegles_({});
  const refus = id => g.ctx.prgMailRefus_(g.ctx.prgMailLu_(id), regles);
  assert.deepStrictEqual([refus('bon1'), refus('bon2')], ['', '']);
  assert.ok(/pas dans les messages envoyés/.test(refus('recu')));
  assert.ok(/ne commence pas par « \[Loué App\] »/.test(refus('transfere')));
  assert.ok(/sans pièce jointe/.test(refus('sansPJ')));
  assert.ok(/depuis moins de 90 jours/.test(refus('recent')));
  assert.ok(/lui-même destinataire/.test(refus('aMoi')) && /lui-même destinataire/.test(refus('cciMoi')));
  assert.ok(/étoile/.test(refus('etoile')) && /boîte de réception/.test(refus('aussiRecu')) && /pas dans les messages envoyés/.test(refus('brouillon')));
  assert.ok(/ne commence pas par/.test(refus('adresseLibre')), 'les mails aux adresses tapées à la main ne sont pas visés');
  assert.ok(/nom de l’expéditeur/.test(refus('aLaMain')));
  g.etat.gmail.push(mail('autreCompte', { de: 'Loué Menuiserie <autre@loue.test>' }), mail('deja', { labels: ['SENT', 'TRASH'] }), mail('brouillonEnvoye', { labels: ['SENT', 'DRAFT'] }), mail('spam', { labels: ['SENT', 'SPAM'] }));
  assert.ok(/pas envoyé par ce compte/.test(refus('autreCompte')) && /déjà à la corbeille/.test(refus('deja')) && /brouillon/.test(refus('brouillonEnvoye')) && /indésirable/.test(refus('spam')));
});
test('la mesure de la nuit propose UNE ligne, à clé fixe, avec le nombre de mails et le poids estimé ; rien n’est mis à la corbeille', () => {
  const g = environnement();
  mesurer(g);
  const l = ligne(g);
  assert.deepStrictEqual([l[P.chantier], l[P.quoi], l[P.possible], l[P.etat], l[P.fichiers], l[P.poids], l[P.corbeille], l[P.annuler]], ['(tout le compte)', QUOI, 'oui', 'Proposé', 2, 0.5, false, false], l[P.pourquoi]);
  assert.strictEqual(l[P.cle], 'mails|(tout le compte)|envoyes|1');
  assert.ok(/^Possible : environ 2 mail\(s\) envoyé\(s\) par l’appli avant le 18\/08\/2026, avec pièce jointe \(environ 0,5 Mo, estimation\)/.test(l[P.pourquoi]) && /Avant de cocher : vérifie/.test(l[P.pourquoi]) && /30 jours plus tard/.test(l[P.pourquoi]), l[P.pourquoi]);
  assert.deepStrictEqual(aLaCorbeille(g), []);
  mesurer(g); mesurer(g);
  assert.strictEqual(g.feuilles['Purges'].lignes.slice(1).filter(x => x[P.quoi] === QUOI).length, 1, 'toujours une seule ligne');
  assert.strictEqual(g.ctx.traiterPurges(), 'rien', 'jamais automatique : sans case cochée, rien');
  assert.deepStrictEqual(aLaCorbeille(g), []);
});
test('rien à gagner : pas de ligne ; service avancé Gmail absent : pas de ligne, et verifierConfig le dit', () => {
  let g = environnement({ gmail: boite().filter(m => !/^bon/.test(m.id)) });
  mesurer(g);
  assert.strictEqual(ligne(g), undefined);
  g = environnement({ sansGmail: true });
  assert.ok(/^Tour de mesure terminé/.test(mesurer(g)));
  assert.strictEqual(ligne(g), undefined);
  assert.ok(/Service avancé Gmail .* : absent, cette ligne ne sera pas proposée/.test(g.ctx.verifierConfig()));
});
test('case cochée : seuls les deux mails de l’appli partent à la corbeille de Gmail, mail par mail ; journal écrit AVANT ; compte rendu par mail ; rien dans Drive ; verrou des fiches jamais pris', () => {
  const g = environnement();
  mesurer(g);
  ligne(g)[P.corbeille] = true;
  const fautes = [];
  g.etat.avantCorbeilleMail = m => {
    const d = detail(g).filter(x => x[D.id] === m.id)[0];
    if (!d || d[D.etat] !== 'à faire') fautes.push(m.id + ' : pas noté « à faire » avant sa mise à la corbeille');
    if (!g.etat.flush) fautes.push('journal pas encore enregistré');
  };
  const avant = g.mails.length;
  assert.strictEqual(g.ctx.traiterPurges(), '1 ligne(s) traitée(s)');
  assert.deepStrictEqual(fautes, []);
  assert.deepStrictEqual(aLaCorbeille(g), ['bon1', 'bon2']);
  assert.strictEqual(g.etat.gmail.length, 13, 'aucun mail supprimé');
  const d = detail(g);
  assert.deepStrictEqual(d.map(x => [x[D.cle], x[D.type], x[D.id], x[D.etat]]), [['mails|(tout le compte)|envoyes|1', 'mail', 'bon1', 'fait'], ['mails|(tout le compte)|envoyes|1', 'mail', 'bon2', 'fait']]);
  assert.ok(/— \[Loué App\] Quitus — CHANTIER A$/.test(d[0][D.chemin]) && d[0][D.taille] === 200 * 1024, d[0][D.chemin]);
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
  assert.strictEqual(g.etat.corbeilles.length, 0, 'rien dans Drive');
  assert.strictEqual(g.etat.verrousScript, 0);
  assert.strictEqual(g.ctx.traiterPurges(), 'rien');
  mesurer(g);
  assert.strictEqual(g.feuilles['Purges'].lignes.slice(1).filter(x => x[P.quoi] === QUOI).length, 1, 'plus rien à proposer : pas de nouvelle ligne');
});
test('« Annuler » (25 jours) : les mails ressortent de la corbeille de Gmail ; un mail supprimé à la main entre-temps est compté', () => {
  const g = environnement();
  mesurer(g); ligne(g)[P.corbeille] = true; g.ctx.traiterPurges();
  g.etat.gmail = g.etat.gmail.filter(m => m.id !== 'bon2');   // supprimé définitivement dans la corbeille de Gmail, à la main
  g.now += 5 * JOUR;
  ligne(g)[P.annuler] = true; g.ctx.traiterPurges();
  assert.deepStrictEqual(aLaCorbeille(g), []);
  assert.deepStrictEqual(g.etat.gmail.filter(m => m.id === 'bon1')[0].labels, ['SENT'], 'le mail revient tel qu’il était, dans les messages envoyés');
  const l = ligne(g);
  assert.strictEqual(l[P.etat], 'Annulé');
  assert.ok(/1 mail\(s\) remis en place\./.test(l[P.message]) && /1 mail\(s\) n’ont PAS pu revenir/.test(l[P.message]), l[P.message]);
  // passé 25 jours : refusé
  const g2 = environnement();
  mesurer(g2); ligne(g2)[P.corbeille] = true; g2.ctx.traiterPurges();
  g2.now += 26 * JOUR; ligne(g2)[P.annuler] = true; g2.ctx.traiterPurges();
  assert.ok(/Annulation refusée/.test(ligne(g2)[P.message]) && /corbeille de Gmail/.test(ligne(g2)[P.message]), ligne(g2)[P.message]);
  assert.deepStrictEqual(aLaCorbeille(g2), ['bon1', 'bon2']);
});
test('conditions revérifiées : un mail qui a changé depuis la proposition (étoile, réponse reçue) n’est pas touché, même au dernier moment', () => {
  let g = environnement();
  mesurer(g);
  g.etat.gmail.filter(m => /^bon/.test(m.id)).forEach(m => m.labels.push('STARRED'));
  ligne(g)[P.corbeille] = true; g.ctx.traiterPurges();
  assert.deepStrictEqual(aLaCorbeille(g), []);
  assert.deepStrictEqual([ligne(g)[P.etat], ligne(g)[P.possible], ligne(g)[P.corbeille]], ['Impossible', 'non', false]);
  assert.ok(/Aucun mail de l’appli de plus de 90 jours/.test(ligne(g)[P.pourquoi]), ligne(g)[P.pourquoi]);
  g = environnement();
  mesurer(g); ligne(g)[P.corbeille] = true;
  g.etat.avantCorbeilleMail = m => { if (m.id === 'bon1') g.etat.gmail.filter(x => x.id === 'bon2')[0].labels.push('INBOX'); };
  g.ctx.traiterPurges();
  assert.deepStrictEqual(aLaCorbeille(g), ['bon1']);
  assert.ok(/^refusé : aussi dans la boîte de réception/.test(detail(g).filter(x => x[D.id] === 'bon2')[0][D.etat]));
  assert.deepStrictEqual([ligne(g)[P.etat], ligne(g)[P.nbFaits]], ['Fait', 1]);
});
test('beaucoup de mails : par passages de 200, la ligne reste « En cours » entre deux, sous le plafond de temps du jour ; tout finit par partir', () => {
  const gmail = boite();
  for (let i = 0; i < 450; i++) gmail.push(mail('vieux' + i, { objet: '[Loué App] Prise de cotes — CHANTIER ' + i, taille: 100 * 1024 }));
  const g = environnement({ gmail: gmail });
  mesurer(g);
  assert.strictEqual(ligne(g)[P.possible], 'oui');
  assert.ok(ligne(g)[P.fichiers] > 300, 'estimation : ' + ligne(g)[P.fichiers]);
  ligne(g)[P.corbeille] = true;
  g.ctx.traiterPurges();
  assert.strictEqual(aLaCorbeille(g).length, 200);
  assert.deepStrictEqual([ligne(g)[P.etat], ligne(g)[P.corbeille]], ['En cours', true]);
  assert.ok(/suite au prochain passage/.test(ligne(g)[P.message]));
  g.proprietes.PURGE_TEMPS = JSON.stringify({ jour: g.ctx.jour_(), ms: 31 * 60 * 1000 });
  g.ctx.traiterPurges();
  assert.strictEqual(aLaCorbeille(g).length, 200, 'plafond du jour atteint : rien de plus');
  assert.ok(/la suite demain/.test(ligne(g)[P.message]));
  delete g.proprietes.PURGE_TEMPS;
  g.ctx.traiterPurges(); g.ctx.traiterPurges();
  assert.strictEqual(aLaCorbeille(g).length, 452);
  assert.deepStrictEqual([ligne(g)[P.etat], ligne(g)[P.nbFaits], ligne(g)[P.corbeille]], ['Fait', 452, false]);
  assert.strictEqual(g.mails.filter(m => /Mise à la corbeille/.test(m.sujet)).length, 1, 'un seul compte rendu, à la fin');
  assert.strictEqual(detail(g).filter(x => x[D.etat] === 'fait').length, 452);
  assert.ok(!g.etat.gmail.some(m => !/^(bon|vieux)/.test(m.id) && m.labels.indexOf('TRASH') > -1), 'aucun des mails à ne jamais toucher');
});
test('copie TEST (même compte Google que la production) : seuls les mails du chantier d’essai sont visés ; l’âge réduit par PURGE_MAILS_JOURS_TEST ne vaut que sur TEST', () => {
  const essai = () => [mail('essaiVieux', { objet: '[Loué App] Quitus — CHANTIER TEST AUTO' }), mail('essaiRecent', { objet: '[Loué App] Quitus — CHANTIER TEST AUTO', date: MAINTENANT - 3 * JOUR })];
  let g = environnement({ test: true, gmail: boite().concat(essai()) });
  mesurer(g);
  assert.strictEqual(ligne(g)[P.fichiers], 1);
  assert.ok(/sur la copie TEST, seulement ceux du chantier d’essai/.test(ligne(g)[P.pourquoi]));
  ligne(g)[P.corbeille] = true; g.ctx.traiterPurges();
  assert.deepStrictEqual(aLaCorbeille(g), ['essaiVieux'], 'les mails de la production (bon1, bon2) ne sont jamais touchés depuis la copie TEST');
  g = environnement({ test: true, gmail: boite().concat(essai()), proprietes: { PURGE_MAILS_JOURS_TEST: '1' } });
  mesurer(g); ligne(g)[P.corbeille] = true; g.ctx.traiterPurges();
  assert.deepStrictEqual(aLaCorbeille(g), ['essaiRecent', 'essaiVieux']);
  g = environnement({ gmail: boite().concat(essai()), proprietes: { PURGE_MAILS_JOURS_TEST: '1' } });   // en production : propriété ignorée
  mesurer(g); ligne(g)[P.corbeille] = true; g.ctx.traiterPurges();
  assert.deepStrictEqual(aLaCorbeille(g), ['bon1', 'bon2', 'essaiVieux'], 'jamais un mail de moins de 90 jours en production');
  // environnement incohérent : rien
  g = environnement({ gmail: boite(), proprietes: { ENVIRONNEMENT: 'TEST' } });
  mesurer(g);
  assert.strictEqual(ligne(g), undefined);
});
test('ligne des mails : mêmes protections que les autres (deux cases, ligne mélangée, clé en double)', () => {
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
  assert.strictEqual(typeof MO, 'number');
});

console.log('\n' + reussis + ' test(s) réussi(s)' + (process.exitCode ? ' — DES TESTS ÉCHOUENT' : ''));
