// ENVOI DU SERVEUR SUR LA COPIE TEST, avec clasp. C'est FRANCK qui lance cette commande, dans PowerShell :
//   node outils\envoyer-test.js --avec-porte     (serveur + outils d'essai : pendant les essais)
//   node outils\envoyer-test.js --sans-porte     (le fichier de production exact : avant le feu vert)
// Une page Google s'ouvre : choisir le compte de Loué, cliquer « Autoriser ». La commande fait tout le reste
// et finit par « ✅ Envoi réussi » ou « ❌ … ». Elle efface le jeton de Google à la fin, DANS TOUS LES CAS.
//
// Pourquoi Franck et pas Claude : le jeton de clasp ouvre tous les projets Apps Script du compte, production
// comprise. Lancé ainsi, il n'existe sur le PC que pendant ces 2 à 3 minutes, et jamais dans la séance de Claude.
//
// Ce que fait la commande, dans l'ordre (elle s'arrête au premier écart) :
//   1. contrôles sans réseau : dépôt sans modification en cours, dossier clasp en place, pas de jeton oublié ;
//   2. connexion Google (clasp login) ;
//   3. le projet relié au dossier clasp est-il bien celui de la copie TEST ? Il doit contenir le déploiement
//      dont l'adresse est URL_TEST (commun/config.js), et son identifiant doit être celui mémorisé la 1re fois ;
//   4. sauvegarde du serveur en ligne dans _prive/ (date et heure) ; contrôle du manifeste ;
//   5. assemblage du serveur en UN fichier (avec ou sans la porte de service), envoi, mise à jour du déploiement ;
//   6. vérification : l'adresse TEST doit répondre avec l'empreinte du fichier qui vient d'être envoyé ;
//   7. effacement du jeton (clasp logout, puis suppression du fichier s'il est encore là) ;
//   8. compte rendu dans _prive/envois/ (sans aucun secret).
// Elle ne touche JAMAIS à la production : aucun autre projet que celui de la copie TEST n'est accepté.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const construire = require('./construire.js');

const RACINE = path.join(__dirname, '..');
const FICHIERS_ATTENDUS = ['.clasp.json', 'appsscript.json', 'Code.js'];   // rien d'autre ne doit partir
const pause = ms => new Promise(r => setTimeout(r, ms));
const horodatage = d => {
  const z = n => String(n).padStart(2, '0');
  return d.getFullYear() + z(d.getMonth() + 1) + z(d.getDate()) + '-' + z(d.getHours()) + z(d.getMinutes()) + z(d.getSeconds());
};

// L'identifiant du déploiement TEST est public : c'est la partie de URL_TEST entre /s/ et /exec
function deploiementTest(racine) {
  const config = fs.readFileSync(path.join(racine, 'commun', 'config.js'), 'utf8');
  const m = /var URL_TEST = '(https:\/\/script\.google\.com\/macros\/s\/([A-Za-z0-9_-]{20,})\/exec)'/.exec(config);
  if (!m) throw new Error('URL_TEST introuvable dans commun/config.js');
  return { url: m[1], id: m[2] };
}
function git(racine) {
  return execFileSync('git', ['-C', racine].concat(Array.prototype.slice.call(arguments, 1)), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

// Lance clasp dans le dossier clasp. interactif : la fenêtre de Franck voit et répond (connexion Google).
function lancerClasp(o, args, options) {
  options = options || {};
  const base = o.claspCmd || (process.platform === 'win32' ? ['cmd.exe', '/d', '/s', '/c', 'clasp'] : ['clasp']);
  const r = spawnSync(base[0], base.slice(1).concat(args), {
    cwd: o.dossierClasp, encoding: 'utf8', timeout: options.maxMs || 120000, windowsHide: true,
    env: Object.assign({}, process.env, o.env || {}),
    stdio: options.interactif ? 'inherit' : ['pipe', 'pipe', 'pipe'],
    input: options.interactif ? undefined : 'n\n',   // si clasp pose une question (manifeste modifié) : NON, donc aucun envoi
  });
  const sortie = (r.stdout || '') + (r.stderr || '');
  if (r.error) throw new Error('clasp ' + args[0] + ' : ' + (r.error.code === 'ETIMEDOUT' ? 'trop long, arrêté' : r.error.message));
  if (r.status !== 0) throw new Error('clasp ' + args[0] + ' a échoué' + (sortie.trim() ? ' : ' + sortie.trim().split('\n').slice(-3).join(' / ') : ''));
  return sortie;
}

// Vérifie en ligne que le déploiement TEST exécute bien le fichier envoyé (jusqu'à maxMs)
async function attendreEmpreinte(url, attendue, o) {
  o = o || {};
  const appeler = o.appeler || (async u => {
    const r = await fetch(u, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'ping', v: 5 }) });
    return r.json();
  });
  const fin = Date.now() + (o.maxMs || 90000);
  let vue = '';
  for (;;) {
    try { const rep = await appeler(url); vue = (rep && rep.data && rep.data.empreinte) || ''; if (vue === attendue) return { ok: true, vue: vue, version: rep.data.version }; }
    catch (e) { vue = 'pas de réponse (' + e.message + ')'; }
    if (Date.now() > fin) return { ok: false, vue: vue };
    await pause(o.pasMs || 5000);
  }
}

// o : { avecPorte (obligatoire), description, et pour les tests : racine, dossierClasp, dossierJeton, dossierPrive, claspCmd, env, appeler, pasMs, maxMs, dire }
async function envoyer(o) {
  if (typeof o.avecPorte !== 'boolean') throw new Error('Préciser --avec-porte ou --sans-porte');
  const racine = o.racine || RACINE;
  o.dossierClasp = o.dossierClasp || path.join(os.homedir(), 'clasp-loue', 'TEST');
  const jeton = path.join(o.dossierJeton || os.homedir(), '.clasprc.json');
  const prive = o.dossierPrive || path.join(racine, '_prive');
  const memoire = path.join(prive, 'script-test-id.txt');
  const dire = o.dire || (t => console.log(t));
  const rapport = [];
  const noter = t => { rapport.push(t); dire(t); };
  const debut = new Date();
  let connecte = false, envoiCommence = false, reussi = false, erreur = null;

  try {
    // ── 1. Contrôles sans réseau ──
    const cible = deploiementTest(racine);
    if (git(racine, 'status', '--porcelain')) throw new Error('Des modifications ne sont pas enregistrées dans le dépôt : préviens Claude, rien n’a été envoyé');
    const source = git(racine, 'rev-parse', '--abbrev-ref', 'HEAD') + ' ' + git(racine, 'rev-parse', '--short', 'HEAD');
    const serveur = construire.assembler(o.avecPorte);
    if (construire.MARQUE_PORTE.test(serveur.code) !== o.avecPorte) throw new Error('Assemblage incohérent (porte de service) : rien n’a été envoyé');
    noter('Envoi sur la copie TEST — ' + debut.toLocaleString('fr-FR') + ' — source ' + source
      + ' — serveur ' + (o.avecPorte ? 'AVEC outils d’essai' : 'SANS outils d’essai (fichier de production)') + ' — empreinte ' + serveur.empreinte);
    if (!fs.existsSync(path.join(o.dossierClasp, '.clasp.json'))) throw new Error('Dossier clasp introuvable ou pas relié (' + o.dossierClasp + ') : refaire l’installation de docs/clasp.md');
    const scriptId = JSON.parse(fs.readFileSync(path.join(o.dossierClasp, '.clasp.json'), 'utf8')).scriptId;
    if (!scriptId) throw new Error('.clasp.json sans identifiant de script');
    if (fs.existsSync(memoire)) {
      if (fs.readFileSync(memoire, 'utf8').trim() !== scriptId) throw new Error('Le dossier clasp n’est PAS relié au projet de la copie TEST mémorisé : rien n’a été envoyé, préviens Claude');
    }
    if (fs.existsSync(jeton)) { fs.rmSync(jeton, { force: true }); noter('⚠ Un jeton Google était resté sur le PC : il a été effacé avant de commencer.'); }

    // ── 2. Connexion Google ──
    noter('1/6 Connexion Google : une page s’ouvre, choisis le compte de Loué puis « Autoriser »…');
    connecte = true;   // à partir d'ici, le jeton peut exister : il sera effacé quoi qu'il arrive
    lancerClasp(o, ['login'], { interactif: !o.claspCmd, maxMs: 5 * 60 * 1000 });

    // ── 3. Est-ce bien le projet de la copie TEST ? (contrôle indépendant : il contient le déploiement de URL_TEST) ──
    const deploiements = lancerClasp(o, ['list-deployments']);
    if (deploiements.indexOf(cible.id) < 0) throw new Error('Le projet relié au dossier clasp ne contient PAS le déploiement de la copie TEST : rien n’a été envoyé, préviens Claude');
    if (!fs.existsSync(memoire)) { fs.mkdirSync(prive, { recursive: true }); fs.writeFileSync(memoire, scriptId + '\n'); noter('   (identifiant du projet TEST mémorisé dans _prive/script-test-id.txt)'); }
    noter('2/6 Projet vérifié : c’est bien celui de la copie TEST.');

    // ── 4. Sauvegarde du serveur en ligne, contrôle du manifeste ──
    lancerClasp(o, ['pull']);
    const present = fs.readdirSync(o.dossierClasp).filter(f => f !== '.claspignore');
    const enTrop = present.filter(f => FICHIERS_ATTENDUS.indexOf(f) < 0), manquant = FICHIERS_ATTENDUS.filter(f => present.indexOf(f) < 0);
    if (enTrop.length || manquant.length) throw new Error('Le dossier clasp ne contient pas exactement appsscript.json et Code.js'
      + (enTrop.length ? ' (en trop : ' + enTrop.join(', ') + ')' : '') + (manquant.length ? ' (manquant : ' + manquant.join(', ') + ')' : '') + ' : rien n’a été envoyé, préviens Claude');
    const manifeste = JSON.parse(fs.readFileSync(path.join(o.dossierClasp, 'appsscript.json'), 'utf8'));
    if (!manifeste.webapp || manifeste.webapp.access !== 'ANYONE_ANONYMOUS' || manifeste.webapp.executeAs !== 'USER_DEPLOYING') {
      throw new Error('Le manifeste du projet n’a pas le réglage attendu (webapp : ANYONE_ANONYMOUS, USER_DEPLOYING) : rien n’a été envoyé, préviens Claude');
    }
    const sauvegarde = 'Code-TEST-avant-' + horodatage(debut) + '.gs';
    fs.copyFileSync(path.join(o.dossierClasp, 'Code.js'), path.join(prive, sauvegarde));
    noter('3/6 Serveur en ligne sauvegardé : _prive/' + sauvegarde);

    // ── 5. Envoi et mise à jour du déploiement ──
    fs.writeFileSync(path.join(o.dossierClasp, 'Code.js'), serveur.code);
    envoiCommence = true;
    const pousse = lancerClasp(o, ['push']);   // jamais --force
    if (/skipping|manifest file has been updated|do you want to push/i.test(pousse)) throw new Error('clasp a posé une question sur le manifeste : l’envoi a été annulé, préviens Claude');
    noter('4/6 Serveur envoyé.');
    const description = String(o.description || ('Outillage ' + (o.avecPorte ? 'avec porte' : 'sans porte') + ' ' + serveur.empreinte)).replace(/[^A-Za-z0-9 ._-]/g, '').slice(0, 80);
    lancerClasp(o, ['update-deployment', cible.id, '--description', description]);
    noter('5/6 Déploiement TEST mis à jour (même adresse).');

    // ── 6. Vérification en ligne ──
    const v = await attendreEmpreinte(cible.url, serveur.empreinte, o);
    if (!v.ok) throw new Error('L’adresse TEST ne répond pas avec le nouveau serveur (attendu ' + serveur.empreinte + ', vu « ' + v.vue + ' ») : la mise à jour du déploiement n’a pas été prise. Préviens Claude');
    noter('6/6 Vérifié en ligne : l’adresse TEST exécute bien ce serveur (' + v.version + ', empreinte ' + v.vue + ').');
    reussi = true;
  } catch (e) {
    erreur = e;
    noter('❌ ' + e.message);
    if (envoiCommence) noter('⚠ L’envoi avait commencé : le serveur TEST est peut-être dans un état intermédiaire. La sauvegarde est dans _prive/. Préviens Claude avant tout essai.');
  } finally {
    // ── 7. Effacement du jeton, dans tous les cas ──
    if (connecte) {
      try { lancerClasp(o, ['logout'], { maxMs: 30000 }); } catch (e) { noter('(clasp logout a échoué : ' + e.message + ')'); }
    }
    if (fs.existsSync(jeton)) { try { fs.rmSync(jeton, { force: true }); } catch (e) {} }
    noter(fs.existsSync(jeton)
      ? '❌ LE JETON GOOGLE EST ENCORE SUR LE PC (' + jeton + ') : supprime ce fichier à la main et préviens Claude.'
      : 'Jeton Google effacé du PC.');
    noter(reussi ? '✅ Envoi réussi. Dis à Claude : « envoi fait ».' : '❌ Envoi NON réussi. Envoie ce texte à Claude.');
    // ── 8. Compte rendu (aucun secret : ni jeton, ni clé, ni identifiant de script) ──
    try {
      const dossier = path.join(prive, 'envois'); fs.mkdirSync(dossier, { recursive: true });
      fs.writeFileSync(path.join(dossier, horodatage(debut) + (reussi ? '-reussi' : '-ECHEC') + '.txt'), rapport.join('\n') + '\n');
    } catch (e) { dire('(compte rendu non écrit : ' + e.message + ')'); }
  }
  return { ok: reussi, erreur: erreur ? erreur.message : '', rapport: rapport, jetonRestant: fs.existsSync(jeton) };
}

module.exports = { envoyer, deploiementTest, attendreEmpreinte, FICHIERS_ATTENDUS };
if (require.main === module) {
  const args = process.argv.slice(2);
  const o = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--avec-porte') o.avecPorte = true;
    else if (args[i] === '--sans-porte') o.avecPorte = false;
    else if (args[i] === '--description') o.description = args[++i];
    else { console.error('❌ Option inconnue : ' + args[i]); process.exit(1); }
  }
  envoyer(o).then(r => process.exit(r.ok ? 0 : 1)).catch(e => { console.error('❌ ' + e.message); process.exit(1); });
}
