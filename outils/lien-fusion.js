// Prépare le LIEN qui ouvre une demande de fusion déjà remplie sur GitHub :
//   node outils/lien-fusion.js <branche> --titre "Lot 7 — production" [--texte "Ce que ça contient"] [--procedure docs/lot7-procedure.md]
// Franck n'a plus qu'à ouvrir le lien, puis cliquer « Create pull request », « Merge pull request », « Confirm merge ».
// La commande REFUSE de donner un lien si :
//   - la branche n'est pas sur GitHub, ou n'y est pas identique à celle du PC ;
//   - elle ne contient pas le dernier état de main (il faut d'abord amener main dans la branche : aucun conflit
//     possible ensuite, et le serveur annoncé dans la demande est bien celui qui sera dans main après fusion) ;
//   - on n'est pas placé sur cette branche, ou des modifications ne sont pas enregistrées ;
//   - la livraison n'est pas à jour (node outils/construire.js --verifier).
// Elle ne crée rien et ne fusionne rien : elle fabrique seulement une adresse.
'use strict';
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const LONGUEUR_MAX = 6000;   // GitHub refuse une adresse trop longue (erreur 414) : la description reste courte

// ── Partie pure (testée par tests/outils.test.js) ─────────────────────────────────────────────────────────
// « https://github.com/proprio/depot.git » ou « git@github.com:proprio/depot.git » → « proprio/depot »
function depotDepuisAdresse(adresse) {
  const m = /^(?:https:\/\/github\.com\/|git@github\.com:)([A-Za-z0-9][A-Za-z0-9-]*)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/.exec(String(adresse).trim());
  if (!m) throw new Error('Adresse GitHub non reconnue : ' + adresse);
  return m[1] + '/' + m[2];
}
// Un nom de branche sûr : lettres, chiffres, « . _ - / » ; rien qui puisse changer le sens de l'adresse
function brancheSure(b) {
  if (!/^[A-Za-z0-9._\/-]+$/.test(b) || /\.\./.test(b) || /^[\/-]/.test(b)) throw new Error('Nom de branche refusé : ' + b);
  return b;
}
function construireLien(o) {
  if (!o.titre || !String(o.titre).trim()) throw new Error('Il faut un titre (--titre "…")');
  const base = brancheSure(o.base || 'main'), branche = brancheSure(o.branche);
  const lien = 'https://github.com/' + o.depot + '/compare/' + base + '...' + branche
    + '?quick_pull=1&title=' + encodeURIComponent(String(o.titre).trim())
    + '&body=' + encodeURIComponent(String(o.corps || '').trim());
  if (lien.length > LONGUEUR_MAX) throw new Error('Lien trop long (' + lien.length + ' caractères, ' + LONGUEUR_MAX + ' au plus) : raccourcir --texte');
  return lien;
}
function empreinte(texte) {   // fins de ligne Windows ou non : même empreinte
  return crypto.createHash('sha256').update(String(texte).replace(/\r\n/g, '\n')).digest('hex').slice(0, 12);
}
// La description de la demande : courte, toujours la même forme
function construireCorps(o) {
  const l = [];
  if (o.texte) l.push(String(o.texte).trim(), '');
  l.push('**Fichiers modifiés** : ' + o.nbFichiers);
  l.push(o.serveurChange
    ? '**Serveur** : `Code.gs` MODIFIÉ, à mettre dans Apps Script avant de fusionner — empreinte `' + o.empreinteServeur + '`'
    : '**Serveur** : inchangé (rien à faire dans Apps Script) — empreinte `' + o.empreinteServeur + '`');
  l.push(o.pagesChangent
    ? '**Pages de l’appli** : modifiées' + (o.versionAppli ? ' (version ' + o.versionAppli + ' dans « À propos »)' : '')
    : '**Pages de l’appli** : inchangées (rien ne change sur les téléphones)');
  if (o.procedure) l.push('**Procédure et vérifications** : `' + o.procedure + '`');
  l.push('', 'Sans conflit avec `main` (vérifié le ' + o.date + ').');
  return l.join('\n');
}

// ── Partie qui interroge Git ──────────────────────────────────────────────────────────────────────────────
let racine = RACINE;   // changé seulement par les tests : principal(argv, { racine })
function git() {
  return execFileSync('git', Array.prototype.slice.call(arguments), { cwd: racine, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
// Contenu exact d'un fichier d'une version (sans rien retirer : l'empreinte doit être celle du fichier réel)
function fichierDe(version, chemin) {
  return execFileSync('git', ['show', version + ':' + chemin], { cwd: racine, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
}
function gitOk() {
  try { git.apply(null, arguments); return true; } catch (e) { return false; }
}
function lireArguments(argv) {
  const o = { branche: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--titre' || a === '--texte' || a === '--procedure') {
      const v = argv[++i];
      if (v === undefined || String(v).indexOf('--') === 0) throw new Error('Il manque la valeur de ' + a);
      o[a.slice(2)] = v;
    }
    else if (a.indexOf('--') === 0) throw new Error('Option inconnue : ' + a);
    else if (!o.branche) o.branche = a;
    else throw new Error('Un seul nom de branche attendu (reçu aussi : ' + a + ')');
  }
  if (!o.branche) throw new Error('Usage : node outils/lien-fusion.js <branche> --titre "…" [--texte "…"] [--procedure docs/….md]');
  return o;
}
// Fichiers qui arrivent sur les téléphones (tout le reste : documents, outils, tests, sources du serveur)
const estPage = f => /^[^/]+\.(html|json|png)$/.test(f) || f === 'sw.js' || /^(commun|modeles)\//.test(f);

// options (tests seulement) : { racine, sansVerifier }
function principal(argv, options) {
  options = options || {};
  racine = options.racine || RACINE;
  const o = lireArguments(argv);
  const branche = brancheSure(o.branche);
  if (branche === 'main') throw new Error('La branche à fusionner ne peut pas être main');
  if (o.procedure && !fs.existsSync(path.join(racine, o.procedure))) throw new Error('Procédure introuvable : ' + o.procedure);
  const depot = depotDepuisAdresse(git('config', '--get', 'remote.origin.url'));

  if (!gitOk('rev-parse', '--verify', '--quiet', 'refs/heads/' + branche)) throw new Error('La branche « ' + branche + ' » n’existe pas sur ce PC');
  try { git('fetch', '--quiet', '--prune', 'origin'); }
  catch (e) { throw new Error('Impossible d’interroger GitHub (réseau ?) : le lien n’est donné qu’après vérification'); }
  if (!gitOk('rev-parse', '--verify', '--quiet', 'refs/remotes/origin/' + branche)) throw new Error('La branche « ' + branche + ' » n’est pas sur GitHub : la pousser d’abord (git push)');
  const ici = git('rev-parse', 'refs/heads/' + branche), labas = git('rev-parse', 'refs/remotes/origin/' + branche);
  if (ici !== labas) throw new Error('La branche du PC et celle de GitHub sont différentes : pousser d’abord (git push)');
  const main = git('rev-parse', 'refs/remotes/origin/main');
  if (ici === main || gitOk('merge-base', '--is-ancestor', ici, main)) throw new Error('Rien à fusionner : main contient déjà cette branche');
  // La branche doit contenir le dernier état de main : aucun conflit possible, et ce que la demande annonce
  // (serveur, version) est exactement ce qui sera dans main après la fusion
  if (!gitOk('merge-base', '--is-ancestor', main, ici)) throw new Error('main a avancé depuis la création de la branche : amener main dans la branche (git merge origin/main), reconstruire, pousser, puis relancer');

  // Livraison à jour ? Seulement vérifiable quand le dossier de travail EST cette branche, sans modification en cours
  const courante = git('rev-parse', '--abbrev-ref', 'HEAD');
  if (courante !== branche) throw new Error('Se placer d’abord sur la branche « ' + branche + ' » (actuellement : ' + courante + ')');
  if (git('status', '--porcelain')) throw new Error('Des modifications ne sont pas enregistrées : les enregistrer et les pousser d’abord');
  if (!options.sansVerifier) {
    try { execFileSync(process.execPath, [path.join(__dirname, 'construire.js'), '--verifier'], { cwd: racine, stdio: 'pipe' }); }
    catch (e) { throw new Error('La livraison n’est pas à jour : lancer « node outils/construire.js », enregistrer, pousser'); }
  }

  // Ce que la fusion change dans main
  const fichiers = git('diff', '--name-only', main, ici).split('\n').filter(Boolean);
  const serveur = 'A-COLLER-DANS-APPS-SCRIPT/Code.gs';
  let versionAppli = '';
  try { versionAppli = (/VERSION_APPLI = '([^']+)'/.exec(git('show', ici + ':commun/config.js')) || [])[1] || ''; } catch (e) {}
  const corps = construireCorps({
    texte: o.texte, nbFichiers: fichiers.length,
    serveurChange: fichiers.indexOf(serveur) > -1, empreinteServeur: empreinte(fichierDe(ici, serveur)),
    pagesChangent: fichiers.some(estPage), versionAppli: versionAppli,
    procedure: o.procedure, date: new Date().toLocaleDateString('fr-FR'),
  });
  const lien = construireLien({ depot: depot, branche: branche, titre: o.titre, corps: corps });
  console.log('Branche « ' + branche + ' » : sur GitHub, à jour, sans conflit avec main (' + fichiers.length + ' fichier(s) modifié(s)).');
  console.log('\nDescription qui sera pré-remplie :\n' + corps.split('\n').map(x => '  ' + x).join('\n'));
  console.log('\nLien à donner à Franck :\n' + lien);
  return lien;
}

module.exports = { principal, lireArguments, depotDepuisAdresse, brancheSure, construireLien, construireCorps, empreinte, estPage, LONGUEUR_MAX };
if (require.main === module) {
  try { principal(process.argv.slice(2)); }
  catch (e) { console.error('❌ ' + e.message); process.exit(1); }
}
