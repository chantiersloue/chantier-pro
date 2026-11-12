// Outils de la « porte de service » de la copie TEST (utilisés par Claude, depuis le PC) :
//   node outils/porte.js --creer-cle                → fabrique la clé dans _prive/cle-outils-test.txt, SANS l'afficher
//   node outils/porte.js etat                       → état du serveur TEST (version, empreinte, déclencheurs, transition…)
//   node outils/porte.js <geste> [nom=valeur …]     → un geste de la liste fermée du serveur, par exemple :
//        node outils/porte.js lireEnvois n=3
//        node outils/porte.js cocher id=auto-poseur case=reinit valeur=true
//        node outils/porte.js session id=auto-admin
// SECRETS : la clé n'est jamais affichée ni écrite ailleurs que dans _prive/ (dossier exclu de GitHub). Le jeton d'une
// session d'essai n'est jamais affiché non plus : il est rangé dans _prive/session-essai.json, et la réponse montrée
// dit seulement où il est.
// Ces appels ne vont QUE vers l'adresse de la copie TEST (URL_TEST de commun/config.js, différente de la production).
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { deploiementTest } = require('./envoyer-test.js');

const RACINE = path.join(__dirname, '..');
const dossierPrive = prive => prive || path.join(RACINE, '_prive');
const fichierCle = prive => path.join(dossierPrive(prive), 'cle-outils-test.txt');
const fichierSession = prive => path.join(dossierPrive(prive), 'session-essai.json');

function creerCle(prive) {
  const f = fichierCle(prive);
  if (fs.existsSync(f) && fs.readFileSync(f, 'utf8').trim().length >= 32) return { cree: false, fichier: f };
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, crypto.randomBytes(36).toString('base64url') + '\n');   // 48 caractères, lettres, chiffres, - et _
  return { cree: true, fichier: f };
}
function lireCle(prive) {
  const f = fichierCle(prive);
  if (!fs.existsSync(f)) throw new Error('Clé absente : lancer « node outils/porte.js --creer-cle »');
  const cle = fs.readFileSync(f, 'utf8').trim();
  if (cle.length < 32) throw new Error('Clé trop courte dans ' + f);
  return cle;
}
// Session d'essai en cours (rangée par le geste « session ») : { id, jeton, profil } ou null
function lireSession(prive) {
  try { return JSON.parse(fs.readFileSync(fichierSession(prive), 'utf8')); } catch (e) { return null; }
}

// Appelle la porte. La réponse RENDUE ne contient jamais la clé ni un jeton de session.
async function appeler(geste, donnees, o) {
  o = o || {};
  const url = o.url || deploiementTest(o.racine || RACINE).url;
  const envoyer = o.envoyer || (async (u, corps) => {
    const r = await fetch(u, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(corps),
      signal: AbortSignal.timeout(o.maxMs || 120000) });
    return r.json();
  });
  const rep = await envoyer(url, Object.assign({}, donnees || {}, { action: 'outilTest', v: 5, geste: geste, cle: lireCle(o.prive) }));
  if (rep && rep.data && typeof rep.data.jeton === 'string') {
    fs.mkdirSync(dossierPrive(o.prive), { recursive: true });
    fs.writeFileSync(fichierSession(o.prive), JSON.stringify({ id: rep.data.id, jeton: rep.data.jeton, profil: rep.data.profil, ouverteLe: new Date().toISOString() }));
  }
  if (geste === 'fermerSessions' && rep && rep.ok) { try { fs.rmSync(fichierSession(o.prive), { force: true }); } catch (e) {} }
  return masquerJetons(rep);
}
// Remplace, partout dans une réponse, toute chaîne qui a la forme d'un jeton de session (identifiant.p|t.version.expiration.signature)
const FORME_JETON = /[a-z0-9_-]{2,30}\.[pt]\.\d{1,9}\.\d{10,16}\.[A-Za-z0-9_-]{20,}/g;
function masquerJetons(rep) {
  if (rep === undefined) return rep;
  return JSON.parse(JSON.stringify(rep).replace(FORME_JETON, '(jeton rangé dans _prive/session-essai.json, jamais affiché)'));
}
// « n=3 », « valeur=true », « id=auto-poseur » → { n: 3, valeur: true, id: 'auto-poseur' }
function lireParametres(args) {
  const d = {};
  args.forEach(a => {
    const i = a.indexOf('=');
    if (i < 1) throw new Error('Paramètre mal écrit (attendu nom=valeur) : ' + a);
    const nom = a.slice(0, i), v = a.slice(i + 1);
    if (['action', 'v', 'geste', 'cle'].indexOf(nom) > -1) throw new Error('Paramètre réservé : ' + nom);
    d[nom] = v === 'true' ? true : v === 'false' ? false : /^\d+$/.test(v) ? Number(v) : v;
  });
  return d;
}

module.exports = { creerCle, lireCle, lireSession, appeler, lireParametres, masquerJetons, fichierCle, fichierSession };
if (require.main === module) {
  (async () => {
    const a = process.argv.slice(2);
    if (a[0] === '--creer-cle') {
      const r = creerCle();
      console.log((r.cree ? 'Clé fabriquée et écrite' : 'La clé existe déjà') + ' dans _prive/cle-outils-test.txt (elle n’est pas affichée).');
      return;
    }
    if (!a[0] || !/^[A-Za-z][A-Za-z0-9]*$/.test(a[0])) throw new Error('Usage : node outils/porte.js --creer-cle | <geste> [nom=valeur …]');
    const rep = await appeler(a[0], lireParametres(a.slice(1)));
    console.log(JSON.stringify(rep, null, 2));
    if (!rep || !rep.ok) process.exitCode = 1;
  })().catch(e => { console.error('❌ ' + e.message); process.exit(1); });
}
