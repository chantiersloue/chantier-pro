// Fabrique ET publie la copie d'essai dans le dépôt d'essai de l'organisation GitHub :
//   node outils/publier-essai.js --preparer   → une seule fois : copie le dépôt d'essai dans ..\chantier-pro-essai\
//   node outils/publier-essai.js              → fabrique, enregistre, pousse, attend la publication et la contrôle
//   node outils/publier-essai.js --sans-attendre → idem, sans attendre la publication (1 à 3 min)
// Garde-fous :
//   - le dossier voisin doit être la copie de travail du dépôt réglé dans outils/essai-cible.json, en lecture comme
//     en envoi, et ce dépôt ne peut pas être celui de production (refus sinon) ;
//   - le dépôt de production doit être sans modification en cours et à jour (construire.js --verifier) :
//     ce qui est publié correspond toujours à un état enregistré, noté dans le message de publication ;
//   - jamais d'écrasement forcé (pas de « push --force ») : chaque publication s'ajoute à l'historique.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const essai = require('./essai.js');

const RACINE = path.join(__dirname, '..');
function git(dossier) {
  return execFileSync('git', ['-C', dossier].concat(Array.prototype.slice.call(arguments, 1)),
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
const pause = ms => new Promise(r => setTimeout(r, ms));

function preparer(o) {
  o = o || {};
  const racine = o.racine || RACINE, cible = o.cible || essai.lireCible();
  const dossier = o.dossier || essai.dossierVoisin(racine);
  if (fs.existsSync(dossier)) { essai.controlerDossier(dossier, cible, racine); return { dossier: dossier, deja: true }; }
  execFileSync('git', ['clone', '--quiet', o.adresseGit || cible.adresseGit, dossier], { stdio: ['ignore', 'pipe', 'pipe'] });
  essai.controlerDossier(dossier, cible, racine);
  return { dossier: dossier, deja: false };
}

// Fabrique, enregistre et pousse. Rend { publie, marque, adresse } ; ne fait AUCUN appel réseau autre que Git.
function publier(o) {
  o = o || {};
  const racine = o.racine || RACINE, cible = o.cible || essai.lireCible();
  const dossier = essai.controlerDossier(o.dossier || essai.dossierVoisin(racine), cible, racine);

  // 1. Le dépôt de production : état enregistré et livraison à jour
  if (git(racine, 'status', '--porcelain')) throw new Error('Des modifications ne sont pas enregistrées dans le dépôt : les enregistrer d’abord');
  if (!o.sansVerifier) {
    try { execFileSync(process.execPath, [path.join(__dirname, 'construire.js'), '--verifier'], { cwd: racine, stdio: 'pipe' }); }
    catch (e) { throw new Error('La livraison n’est pas à jour : lancer « node outils/construire.js » et enregistrer'); }
  }
  const source = git(racine, 'rev-parse', '--short', 'HEAD'), branche = git(racine, 'rev-parse', '--abbrev-ref', 'HEAD');
  const version = (/VERSION_APPLI = '([^']+)'/.exec(fs.readFileSync(path.join(racine, 'commun', 'config.js'), 'utf8')) || [])[1] || '?';

  // 2. Le dépôt d'essai : sur main, sans rien en cours, au même point que GitHub
  if (git(dossier, 'rev-parse', '--abbrev-ref', 'HEAD') !== 'main') throw new Error('Le dossier de la copie d’essai n’est pas sur sa branche main');
  try { git(dossier, 'fetch', '--quiet', 'origin'); }
  catch (e) { throw new Error('Impossible de joindre le dépôt d’essai sur GitHub (réseau ?) : rien n’a été publié'); }
  // Ce dossier ne contient que des fichiers fabriqués : on le remet exactement au point de GitHub avant de refabriquer.
  // Les restes d'une fabrication non publiée ou d'un envoi raté sont ainsi repris proprement ; rien n'est écrasé sur GitHub.
  git(dossier, 'reset', '--quiet', '--hard', 'origin/main');
  git(dossier, 'clean', '-fdq');

  // 3. Fabrication + marque de version (sert à vérifier que la publication est bien arrivée)
  essai.fabriquer({ racine: racine, dossier: dossier, cible: cible });
  const marque = 'appli ' + version + ' — source ' + branche + ' ' + source;
  fs.writeFileSync(path.join(dossier, essai.MARQUE), marque + '\n');
  git(dossier, 'add', '-A');
  if (!git(dossier, 'status', '--porcelain')) return { publie: false, marque: marque, adresse: cible.adresseSite, dossier: dossier };
  git(dossier, '-c', 'user.name=' + (o.auteur || git(racine, 'config', 'user.name')), '-c', 'user.email=' + (o.email || git(racine, 'config', 'user.email')),
    'commit', '--quiet', '-m', 'Copie d’essai — ' + marque + '\n\nFabriquée par outils/publier-essai.js. Ne pas modifier ce dépôt à la main.\n\nCo-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>');
  try { git(dossier, 'push', '--quiet', 'origin', 'main'); }   // jamais --force
  catch (e) {
    throw new Error('GitHub a refusé l’envoi de la copie d’essai. Rien n’est publié ; on peut relancer la commande sans risque. '
      + 'Si c’est le premier envoi : dans l’organisation, Settings → Third-party Access → OAuth app policy → Remove restrictions. '
      + 'Détail : ' + String(e.stderr || e.message).trim().split('\n').slice(-2).join(' / '));
  }
  return { publie: true, marque: marque, adresse: cible.adresseSite, dossier: dossier };
}

// Attend que GitHub Pages serve la nouvelle version (le paramètre ?t= contourne le cache de 10 min)
async function attendrePublication(adresse, marque, o) {
  o = o || {};
  const lire = o.lire || (async u => { const r = await fetch(u, { cache: 'no-store' }); return r.ok ? r.text() : ''; });
  const fin = Date.now() + (o.maxMs || 6 * 60 * 1000);
  for (;;) {
    let t = '';
    try { t = await lire(adresse + essai.MARQUE + '?t=' + Date.now()); } catch (e) {}
    if (t.trim() === marque) return true;
    if (Date.now() > fin) return false;
    await pause(o.pasMs || 10000);
  }
}

module.exports = { preparer, publier, attendrePublication };
if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    const inconnu = args.find(a => ['--preparer', '--sans-attendre'].indexOf(a) < 0);
    if (inconnu) throw new Error('Option inconnue : ' + inconnu);
    if (args.indexOf('--preparer') > -1) {
      const p = preparer();
      console.log(p.deja ? 'Le dossier ' + p.dossier + ' existe déjà et il est bien relié au dépôt d’essai.' : 'Dépôt d’essai copié dans ' + p.dossier + '.');
      return;
    }
    const r = publier();
    if (!r.publie) console.log('Rien de nouveau à publier (' + r.marque + ').');
    else console.log('Copie d’essai poussée : ' + r.marque + '.');
    if (args.indexOf('--sans-attendre') > -1) { console.log('Adresse : ' + r.adresse); return; }
    console.log('Attente de la publication par GitHub (1 à 3 min)…');
    if (await attendrePublication(r.adresse, r.marque)) console.log('✅ Publiée et vérifiée : ' + r.adresse);
    else { console.error('❌ La publication n’est pas visible après 6 min à ' + r.adresse + ' (vérifier Settings → Pages du dépôt d’essai)'); process.exit(1); }
  })().catch(e => { console.error('❌ ' + e.message); process.exit(1); });
}
